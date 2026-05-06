from __future__ import annotations

import json
from pathlib import Path

from backend.app.models import Message, ParticipantRole


SILLYTAVERN_DIRECTORIES = (
    "characters",
    "User Avatars",
    "chats",
    "group chats",
    "groups",
    "worlds",
    "OpenAI Settings",
    "KoboldAI Settings",
    "TextGen Settings",
    "NovelAI Settings",
    "instruct",
    "context",
    "sysprompt",
    "reasoning",
)


class FileStorage:
    def __init__(self, data_root: Path, default_user: str) -> None:
        self.data_root = data_root
        self.default_user = default_user
        self.user_root = self.data_root / self.default_user

    def ensure_layout(self) -> None:
        self.user_root.mkdir(parents=True, exist_ok=True)
        for directory in SILLYTAVERN_DIRECTORIES:
            (self.user_root / directory).mkdir(parents=True, exist_ok=True)

    def session_chat_path(self, session_id: str) -> Path:
        safe_session_id = session_id.replace("/", "_").replace("\\", "_")
        return self.user_root / "group chats" / f"{safe_session_id}.jsonl"

    def append_message(self, message: Message) -> None:
        path = self.session_chat_path(message.session_id)
        if not path.exists():
            self._write_chat_header(path, message.session_id)

        with path.open("a", encoding="utf-8") as chat_file:
            chat_file.write(json.dumps(self._to_sillytavern_message(message), ensure_ascii=False))
            chat_file.write("\n")

    def load_messages(self, session_id: str) -> list[Message]:
        path = self.session_chat_path(session_id)
        if not path.exists():
            return []

        messages: list[Message] = []
        with path.open("r", encoding="utf-8") as chat_file:
            for line_number, line in enumerate(chat_file, start=1):
                line = line.strip()
                if not line:
                    continue

                raw_message = json.loads(line)
                if line_number == 1 and "chat_metadata" in raw_message:
                    continue

                extra = raw_message.get("extra") or {}
                messages.append(
                    Message(
                        id=extra.get("message_id") or f"{session_id}-{line_number}",
                        session_id=extra.get("session_id") or session_id,
                        participant_id=extra.get("participant_id") or raw_message.get("name", "unknown"),
                        participant_name=raw_message.get("name", "Unknown"),
                        role=ParticipantRole.PLAYER if raw_message.get("is_user", True) else ParticipantRole.BOT,
                        content=raw_message.get("mes", ""),
                        created_at=raw_message.get("send_date"),
                    )
                )
        return messages

    def _write_chat_header(self, path: Path, session_id: str) -> None:
        header = {
            "chat_metadata": {"session_id": session_id, "source": "DoubleTrouble"},
            "user_name": "unused",
            "character_name": "unused",
        }
        with path.open("w", encoding="utf-8") as chat_file:
            chat_file.write(json.dumps(header, ensure_ascii=False))
            chat_file.write("\n")

    def _to_sillytavern_message(self, message: Message) -> dict[str, object]:
        return {
            "name": message.participant_name,
            "is_user": message.role == ParticipantRole.PLAYER,
            "send_date": message.created_at.isoformat(),
            "mes": message.content,
            "extra": {
                "source": "DoubleTrouble",
                "message_id": message.id,
                "session_id": message.session_id,
                "participant_id": message.participant_id,
                "participant_role": message.role,
            },
        }
