from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, Field
import yaml


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG_PATH = PROJECT_ROOT / "config" / "config.yaml"


class ServerConfig(BaseModel):
    listen_ip: str = Field(default="127.0.0.1", validation_alias=AliasChoices("listen_ip", "host"))
    listen_port: int = Field(default=8017, validation_alias=AliasChoices("listen_port", "port"))
    public_url: str | None = None
    open_browser_on_start: bool = True


class StorageConfig(BaseModel):
    data_root: Path = Field(default=PROJECT_ROOT / "data")
    default_user: str = "default-user"


class AuthConfig(BaseModel):
    mode: Literal["disabled", "room_password", "users"] = "disabled"
    frontend_password: str = ""
    admin_code: str = "123456"


class GenerationConfig(BaseModel):
    provider: str = "disabled"
    base_url: str = ""
    model: str = ""
    api_key_secret: str = "provider_api_key"
    api_key_env: str = "DOUBLE_TROUBLE_API_KEY"
    bot_name: str = "Bot"
    system_prompt: str = "You are a collaborative roleplay assistant. Continue the scene naturally."
    temperature: float = 0.8
    max_tokens: int = 350
    timeout_seconds: float = 60.0
    parameters: dict[str, Any] = Field(default_factory=dict)


class SecurityConfig(BaseModel):
    allow_key_checking: bool = True
    allow_external_connections: bool = False


class AppConfig(BaseModel):
    server: ServerConfig = Field(default_factory=ServerConfig)
    storage: StorageConfig = Field(default_factory=StorageConfig)
    auth: AuthConfig = Field(default_factory=AuthConfig)
    security: SecurityConfig = Field(default_factory=SecurityConfig)


def load_config(path: Path = DEFAULT_CONFIG_PATH) -> AppConfig:
    if not path.exists():
        return AppConfig()

    with path.open("r", encoding="utf-8") as config_file:
        raw_config = yaml.safe_load(config_file) or {}

    config = AppConfig.model_validate(raw_config)
    if not config.storage.data_root.is_absolute():
        config.storage.data_root = PROJECT_ROOT / config.storage.data_root
    return config


def save_config(config: AppConfig, path: Path = DEFAULT_CONFIG_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = config.model_dump(mode="json")
    data["storage"]["data_root"] = _relative_to_project(Path(config.storage.data_root))

    with path.open("w", encoding="utf-8") as config_file:
        yaml.safe_dump(data, config_file, sort_keys=False, allow_unicode=True)


def _relative_to_project(path: Path) -> str:
    try:
        return path.relative_to(PROJECT_ROOT).as_posix()
    except ValueError:
        return path.as_posix()
