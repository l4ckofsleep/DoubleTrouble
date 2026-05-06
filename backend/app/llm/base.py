from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(frozen=True)
class ChatMessage:
    role: str
    content: str
    name: str | None = None


@dataclass(frozen=True)
class GenerationRequest:
    model: str
    messages: list[ChatMessage]
    temperature: float
    max_tokens: int
    parameters: dict[str, Any] = field(default_factory=dict)


class LlmProvider(Protocol):
    async def status(self) -> dict[str, Any]:
        pass

    async def generate(self, request: GenerationRequest) -> str:
        pass
