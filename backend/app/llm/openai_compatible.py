from __future__ import annotations

from typing import Any

import httpx

from backend.app.llm.base import GenerationRequest


class OpenAICompatibleProvider:
    def __init__(self, base_url: str, api_key: str = "", timeout_seconds: float = 60.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    async def status(self) -> dict[str, Any]:
        if not self.base_url:
            return {"ok": False, "error": "base_url is not configured"}

        headers = self._headers()
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            try:
                response = await client.get(f"{self.base_url}/models", headers=headers)
            except httpx.HTTPError as error:
                return {"ok": False, "error": str(error)}
            if response.status_code >= 400:
                return {"ok": False, "status_code": response.status_code, "error": response.text}
            return {"ok": True, "models": response.json()}

    async def generate(self, request: GenerationRequest) -> str:
        if not self.base_url:
            raise RuntimeError("LLM provider base_url is not configured")
        if not request.model:
            raise RuntimeError("LLM model is not configured")

        parameters = dict(request.parameters)
        excluded_body_keys = {str(key) for key in parameters.pop("__exclude_body_keys", [])}
        body: dict[str, Any] = {
            "model": request.model,
            "messages": [self._message_to_dict(message) for message in request.messages],
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "stream": False,
        }
        body.update(parameters)
        for key in excluded_body_keys:
            body.pop(key, None)

        timeout = httpx.Timeout(
            connect=self.timeout_seconds,
            write=self.timeout_seconds,
            read=max(self.timeout_seconds, 300.0),
            pool=self.timeout_seconds,
        )
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(f"{self.base_url}/chat/completions", headers=self._headers(), json=body)
            response.raise_for_status()
            data = response.json()

        choice = (data.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        content = message.get("content") or choice.get("text") or ""
        if not isinstance(content, str) or not content.strip():
            raise RuntimeError("LLM provider returned an empty response")
        return content.strip()

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _message_to_dict(self, message: Any) -> dict[str, str]:
        data = {"role": message.role, "content": message.content}
        if message.name:
            data["name"] = message.name
        return data
