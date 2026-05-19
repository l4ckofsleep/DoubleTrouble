from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import httpx

from backend.app.llm.base import GenerationRequest


GEMINI_SAFETY_OFF = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_CIVIC_INTEGRITY", "threshold": "BLOCK_NONE"},
]


class GoogleAIStudioProvider:
    """Adapter for Google AI Studio (MakerSuite) Gemini generateContent API."""

    def __init__(
        self,
        base_url: str,
        api_key: str,
        timeout_seconds: float = 60.0,
        *,
        api_version: str = "v1beta",
        use_query_key: bool = True,
        default_parameters: dict[str, Any] | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/") or "https://generativelanguage.googleapis.com"
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds
        self.api_version = api_version
        self.use_query_key = use_query_key
        self.default_parameters = dict(default_parameters or {})

    async def status(self) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            try:
                response = await client.get(
                    f"{self.base_url}/{self.api_version}/models",
                    params=self._query_params(),
                    headers=self._headers(),
                )
            except httpx.HTTPError as error:
                return {"ok": False, "error": str(error)}
            if response.status_code >= 400:
                return {"ok": False, "status_code": response.status_code, "error": response.text}
            return {"ok": True, "models": response.json()}

    async def generate(self, request: GenerationRequest) -> str:
        body = self._request_body(request)
        url = self._chat_url(request.model, stream=False)
        async with httpx.AsyncClient(timeout=self._timeout()) as client:
            response = await client.post(url, headers=self._headers(), params=self._query_params(), json=body)
            response.raise_for_status()
            data = response.json()
        text = self._extract_text(data)
        if not text.strip():
            raise RuntimeError("Google AI Studio returned an empty response")
        return text.strip()

    async def generate_stream(self, request: GenerationRequest) -> AsyncIterator[str]:
        body = self._request_body(request)
        url = self._chat_url(request.model, stream=True)
        async with httpx.AsyncClient(timeout=self._timeout()) as client:
            async with client.stream(
                "POST",
                url,
                headers=self._headers(),
                params={**self._query_params(), "alt": "sse"},
                json=body,
            ) as response:
                if response.status_code >= 400:
                    await response.aread()
                response.raise_for_status()
                buffer = ""
                async for chunk in response.aiter_text():
                    buffer += chunk
                    while True:
                        sep = self._sep(buffer)
                        if sep < 0:
                            break
                        raw_event, buffer = buffer[:sep], buffer[sep + 2 :]
                        token = self._event_to_token(raw_event)
                        if token:
                            yield token
                if buffer.strip():
                    token = self._event_to_token(buffer)
                    if token:
                        yield token

    def _chat_url(self, model: str, stream: bool) -> str:
        action = "streamGenerateContent" if stream else "generateContent"
        return f"{self.base_url}/{self.api_version}/models/{model}:{action}"

    def _query_params(self) -> dict[str, str]:
        if self.use_query_key and self.api_key:
            return {"key": self.api_key}
        return {}

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if not self.use_query_key and self.api_key:
            headers["x-goog-api-key"] = self.api_key
        return headers

    def _timeout(self) -> httpx.Timeout:
        return httpx.Timeout(
            connect=self.timeout_seconds,
            write=self.timeout_seconds,
            read=max(self.timeout_seconds, 300.0),
            pool=self.timeout_seconds,
        )

    def _request_body(self, request: GenerationRequest) -> dict[str, Any]:
        parameters: dict[str, Any] = {**self.default_parameters, **dict(request.parameters)}
        safety_off = bool(parameters.pop("google_safety_off", True))
        use_sysprompt = bool(parameters.pop("google_use_sysprompt", True))
        thinking_budget = parameters.pop("thinking_budget", None)

        system_parts: list[str] = []
        contents: list[dict[str, Any]] = []
        for message in request.messages:
            text = message.content or ""
            if message.role == "system":
                if text.strip():
                    system_parts.append(text)
                continue
            role = "user" if message.role == "user" else "model"
            contents.append({"role": role, "parts": [{"text": text}]})

        if not contents:
            contents.append({"role": "user", "parts": [{"text": "."}]})

        generation_config: dict[str, Any] = {
            "temperature": request.temperature,
            "maxOutputTokens": request.max_tokens,
        }
        if "top_p" in parameters and parameters["top_p"] is not None:
            generation_config["topP"] = parameters.pop("top_p")
        if "top_k" in parameters and parameters["top_k"] is not None:
            generation_config["topK"] = parameters.pop("top_k")
        if isinstance(thinking_budget, (int, float)):
            generation_config["thinkingConfig"] = {"thinkingBudget": int(thinking_budget)}

        body: dict[str, Any] = {
            "contents": contents,
            "generationConfig": generation_config,
        }
        if safety_off:
            body["safetySettings"] = GEMINI_SAFETY_OFF
        if system_parts and use_sysprompt:
            body["systemInstruction"] = {"parts": [{"text": "\n\n".join(system_parts)}]}
        # Pass remaining parameters into generationConfig if they look reasonable.
        for key in ("candidateCount", "stopSequences"):
            if key in parameters and parameters[key] is not None:
                generation_config[key] = parameters.pop(key)
        return body

    def _sep(self, buffer: str) -> int:
        index = buffer.find("\n\n")
        carriage = buffer.find("\r\n\r\n")
        if carriage >= 0 and (index < 0 or carriage < index):
            return carriage
        return index

    def _event_to_token(self, event: str) -> str:
        data_lines: list[str] = []
        for raw_line in event.splitlines():
            stripped = raw_line.strip()
            if not stripped or stripped.startswith(":"):
                continue
            if stripped.startswith("data:"):
                data_lines.append(stripped[5:].strip())
            else:
                data_lines.append(stripped)
        if not data_lines:
            return ""
        payload = "\n".join(data_lines)
        if payload == "[DONE]":
            return ""
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            return ""
        return self._extract_text(data)

    def _extract_text(self, data: dict[str, Any]) -> str:
        candidates = data.get("candidates") or []
        chunks: list[str] = []
        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue
            content = candidate.get("content") or {}
            parts = content.get("parts") or []
            for part in parts:
                if not isinstance(part, dict) or part.get("thought"):
                    continue
                text = part.get("text") or ""
                if isinstance(text, str):
                    chunks.append(text)
        return "".join(chunks)
