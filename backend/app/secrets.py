from __future__ import annotations

import os
from pathlib import Path

import yaml


class SecretStore:
    def __init__(self, path: Path) -> None:
        self.path = path

    def read(self, key: str, env_name: str | None = None) -> str:
        if env_name:
            env_value = os.getenv(env_name)
            if env_value:
                return env_value

        if not self.path.exists():
            return ""

        with self.path.open("r", encoding="utf-8") as secrets_file:
            secrets = yaml.safe_load(secrets_file) or {}

        value = secrets.get(key, "")
        return value if isinstance(value, str) else ""

    def exists(self, key: str, env_name: str | None = None) -> bool:
        return bool(self.read(key, env_name))

    def write(self, key: str, value: str) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        secrets = self._read_all()
        secrets[key] = value
        with self.path.open("w", encoding="utf-8") as secrets_file:
            yaml.safe_dump(secrets, secrets_file, sort_keys=False, allow_unicode=True)

    def delete(self, key: str) -> None:
        if not self.path.exists():
            return
        secrets = self._read_all()
        secrets.pop(key, None)
        with self.path.open("w", encoding="utf-8") as secrets_file:
            yaml.safe_dump(secrets, secrets_file, sort_keys=False, allow_unicode=True)

    def _read_all(self) -> dict[str, str]:
        if not self.path.exists():
            return {}
        with self.path.open("r", encoding="utf-8") as secrets_file:
            raw = yaml.safe_load(secrets_file) or {}
        return {key: value for key, value in raw.items() if isinstance(key, str) and isinstance(value, str)}
