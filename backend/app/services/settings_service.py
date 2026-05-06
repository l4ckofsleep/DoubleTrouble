from __future__ import annotations

from pathlib import Path
from pydantic import BaseModel, Field
import yaml

from backend.app.config import GenerationConfig
from backend.app.secrets import SecretStore


class GenerationSettingsUpdate(BaseModel):
    provider: str = "disabled"
    base_url: str = ""
    model: str = ""
    bot_name: str = "Bot"
    system_prompt: str = "You are a collaborative roleplay assistant. Continue the scene naturally."
    temperature: float = Field(default=0.8, ge=0, le=2)
    max_tokens: int = Field(default=350, ge=1, le=32000)
    timeout_seconds: float = Field(default=60, ge=1, le=600)
    api_key: str = ""
    clear_api_key: bool = False


class GenerationConnectionPreset(BaseModel):
    name: str
    provider: str = "disabled"
    base_url: str = ""
    model: str = ""
    system_prompt: str = "You are a collaborative roleplay assistant. Continue the scene naturally."
    temperature: float = Field(default=0.8, ge=0, le=2)
    max_tokens: int = Field(default=350, ge=1, le=32000)
    timeout_seconds: float = Field(default=60, ge=1, le=600)


class GenerationPresetSave(BaseModel):
    name: str
    settings: GenerationSettingsUpdate


class PermissionRule(BaseModel):
    mode: str = "everyone"
    users: list[str] = Field(default_factory=list)


class SecurityPermissions(BaseModel):
    view_cards: PermissionRule = Field(default_factory=PermissionRule)
    view_personas: PermissionRule = Field(default_factory=PermissionRule)
    view_chats: PermissionRule = Field(default_factory=PermissionRule)
    view_presets: PermissionRule = Field(default_factory=PermissionRule)
    view_lorebooks: PermissionRule = Field(default_factory=PermissionRule)
    edit_cards: PermissionRule = Field(default_factory=PermissionRule)
    delete_cards: PermissionRule = Field(default_factory=PermissionRule)
    edit_personas: PermissionRule = Field(default_factory=PermissionRule)
    delete_personas: PermissionRule = Field(default_factory=PermissionRule)
    manage_chats: PermissionRule = Field(default_factory=PermissionRule)
    edit_messages: PermissionRule = Field(default_factory=PermissionRule)
    delete_messages: PermissionRule = Field(default_factory=PermissionRule)
    generate: PermissionRule = Field(default_factory=PermissionRule)
    manage_presets: PermissionRule = Field(default_factory=PermissionRule)
    manage_lorebooks: PermissionRule = Field(default_factory=PermissionRule)
    manage_security: PermissionRule = Field(default_factory=lambda: PermissionRule(mode="admins"))


class SecuritySettingsPayload(BaseModel):
    auth_required: bool = False
    permissions: SecurityPermissions = Field(default_factory=SecurityPermissions)


class UserSettings(BaseModel):
    generation: GenerationConfig = Field(default_factory=GenerationConfig)
    generation_presets: list[GenerationConnectionPreset] = Field(default_factory=list)
    active_generation_preset: str = ""
    active_presets: dict[str, str] = Field(default_factory=dict)
    auth_required: bool = False
    security_permissions: SecurityPermissions = Field(default_factory=SecurityPermissions)


class SettingsService:
    def __init__(self, settings_path: Path, secret_store: SecretStore) -> None:
        self.settings_path = settings_path
        self.secret_store = secret_store
        self.settings = self._load_settings()

    def generation_config(self) -> GenerationConfig:
        return self.settings.generation

    def generation_settings(self) -> dict[str, object]:
        generation = self.settings.generation
        return {
            "provider": generation.provider,
            "base_url": generation.base_url,
            "model": generation.model,
            "bot_name": generation.bot_name,
            "system_prompt": generation.system_prompt,
            "temperature": generation.temperature,
            "max_tokens": generation.max_tokens,
            "timeout_seconds": generation.timeout_seconds,
            "api_key_configured": self.secret_store.exists(generation.api_key_secret, generation.api_key_env),
            "api_key_env": generation.api_key_env,
        }

    def generation_presets(self) -> list[GenerationConnectionPreset]:
        return sorted(self.settings.generation_presets, key=lambda preset: preset.name.lower())

    def active_generation_preset(self) -> str:
        active = self.settings.active_generation_preset
        if any(preset.name == active for preset in self.settings.generation_presets):
            return active
        return ""

    def save_generation_preset(self, request: GenerationPresetSave) -> GenerationConnectionPreset:
        name = request.name.strip()
        if not name:
            raise ValueError("Preset name is required")
        preset = GenerationConnectionPreset(
            name=name,
            provider=request.settings.provider,
            base_url=request.settings.base_url.strip().rstrip("/"),
            model=request.settings.model.strip(),
            system_prompt=request.settings.system_prompt.strip(),
            temperature=request.settings.temperature,
            max_tokens=request.settings.max_tokens,
            timeout_seconds=request.settings.timeout_seconds,
        )
        self.settings.generation_presets = [existing for existing in self.settings.generation_presets if existing.name.lower() != name.lower()]
        self.settings.generation_presets.append(preset)
        self.settings.active_generation_preset = name
        self.update_generation_settings(request.settings)
        return preset

    def apply_generation_preset(self, name: str) -> GenerationConfig:
        preset = next((item for item in self.settings.generation_presets if item.name == name), None)
        if not preset:
            raise KeyError(name)
        current = self.settings.generation
        self.settings.generation = GenerationConfig(
            provider=preset.provider,
            base_url=preset.base_url.strip().rstrip("/"),
            model=preset.model.strip(),
            api_key_secret=current.api_key_secret,
            api_key_env=current.api_key_env,
            bot_name=current.bot_name,
            system_prompt=preset.system_prompt.strip(),
            temperature=preset.temperature,
            max_tokens=preset.max_tokens,
            timeout_seconds=preset.timeout_seconds,
            parameters=current.parameters,
        )
        self.settings.active_generation_preset = name
        self._save_settings()
        return self.settings.generation

    def delete_generation_preset(self, name: str) -> None:
        before = len(self.settings.generation_presets)
        self.settings.generation_presets = [preset for preset in self.settings.generation_presets if preset.name != name]
        if len(self.settings.generation_presets) == before:
            raise KeyError(name)
        if self.settings.active_generation_preset == name:
            self.settings.active_generation_preset = ""
        self._save_settings()

    def active_preset_settings(self) -> dict[str, str]:
        return dict(self.settings.active_presets)

    def set_active_preset(self, preset_type: str, name: str) -> dict[str, str]:
        self.settings.active_presets[preset_type] = name
        self._save_settings()
        return self.active_preset_settings()

    def security_permissions(self) -> SecurityPermissions:
        return self.settings.security_permissions

    def auth_required(self) -> bool:
        return self.settings.auth_required

    def update_security_settings(self, payload: SecuritySettingsPayload) -> SecuritySettingsPayload:
        self.settings.auth_required = payload.auth_required
        self.settings.security_permissions = payload.permissions
        self._save_settings()
        return SecuritySettingsPayload(auth_required=self.settings.auth_required, permissions=self.settings.security_permissions)

    def update_generation_settings(self, request: GenerationSettingsUpdate) -> GenerationConfig:
        current = self.settings.generation
        self.settings.generation = GenerationConfig(
            provider=request.provider,
            base_url=request.base_url.strip().rstrip("/"),
            model=request.model.strip(),
            api_key_secret=current.api_key_secret,
            api_key_env=current.api_key_env,
            bot_name=request.bot_name.strip() or "Bot",
            system_prompt=request.system_prompt.strip(),
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            timeout_seconds=request.timeout_seconds,
            parameters=current.parameters,
        )

        if request.clear_api_key:
            self.secret_store.delete(current.api_key_secret)
        elif request.api_key.strip():
            self.secret_store.write(current.api_key_secret, request.api_key.strip())

        self._save_settings()
        return self.settings.generation

    def _load_settings(self) -> UserSettings:
        if not self.settings_path.exists():
            return UserSettings()

        with self.settings_path.open("r", encoding="utf-8") as settings_file:
            raw_settings = yaml.safe_load(settings_file) or {}
        return UserSettings.model_validate(raw_settings)

    def _save_settings(self) -> None:
        self.settings_path.parent.mkdir(parents=True, exist_ok=True)
        with self.settings_path.open("w", encoding="utf-8") as settings_file:
            yaml.safe_dump(self.settings.model_dump(mode="json"), settings_file, sort_keys=False, allow_unicode=True)
