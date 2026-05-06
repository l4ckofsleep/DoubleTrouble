from __future__ import annotations

import json
import re
import shutil
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field


class PresetTypeInfo(BaseModel):
    id: str
    label: str
    directory: str


class PresetSummary(BaseModel):
    name: str
    filename: str
    type: str
    updated_at: float


class PresetPayload(BaseModel):
    name: str
    preset: dict[str, Any] = Field(default_factory=dict)


class PresetsService:
    TYPES: dict[str, tuple[str, str]] = {
        "openai": ("OpenAI", "OpenAI Settings"),
        "textgenerationwebui": ("TextGen", "TextGen Settings"),
        "kobold": ("KoboldAI", "KoboldAI Settings"),
        "novel": ("NovelAI", "NovelAI Settings"),
        "instruct": ("Instruct", "instruct"),
        "context": ("Context", "context"),
        "sysprompt": ("System Prompt", "sysprompt"),
        "reasoning": ("Reasoning", "reasoning"),
    }

    def __init__(self, user_root: Path) -> None:
        self.user_root = user_root

    def types(self) -> list[PresetTypeInfo]:
        return [PresetTypeInfo(id=preset_type, label=label, directory=directory) for preset_type, (label, directory) in self.TYPES.items()]

    def list_presets(self, preset_type: str) -> list[PresetSummary]:
        directory = self._directory(preset_type)
        directory.mkdir(parents=True, exist_ok=True)
        return [self._summary(preset_type, path) for path in sorted(directory.glob("*.json"), key=lambda item: item.stem.lower())]

    def get_preset(self, preset_type: str, name: str) -> dict[str, Any]:
        path = self._path(preset_type, name)
        if not path.exists():
            raise FileNotFoundError(name)
        return json.loads(path.read_text(encoding="utf-8"))

    def save_preset(self, preset_type: str, request: PresetPayload) -> PresetSummary:
        name = self._safe_name(request.name)
        if not name:
            raise ValueError("Preset name is required")
        directory = self._directory(preset_type)
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / f"{name}.json"
        path.write_text(json.dumps(request.preset, ensure_ascii=False, indent=4), encoding="utf-8")
        return self._summary(preset_type, path)

    def import_preset(self, preset_type: str, filename: str, content: bytes) -> PresetSummary:
        if not filename.lower().endswith(".json"):
            raise ValueError("Only JSON presets are supported")
        parsed = json.loads(content.decode("utf-8-sig"))
        if not isinstance(parsed, dict):
            raise ValueError("Preset JSON must be an object")
        name = self._safe_name(str(parsed.get("name") or Path(filename).stem))
        return self.save_preset(preset_type, PresetPayload(name=name, preset=parsed))

    def delete_preset(self, preset_type: str, name: str) -> None:
        path = self._path(preset_type, name)
        if not path.exists():
            raise FileNotFoundError(name)
        path.unlink()

    def export_preset(self, preset_type: str, name: str) -> tuple[str, str]:
        preset = self.get_preset(preset_type, name)
        filename = f"{self._safe_name(name)}.json"
        return filename, json.dumps(preset, ensure_ascii=False, indent=4)

    def import_directory(self, source_root: Path) -> int:
        copied = 0
        for preset_type, (_, directory_name) in self.TYPES.items():
            source_dir = source_root / self._default_content_directory(preset_type)
            if not source_dir.exists():
                continue
            target_dir = self._directory(preset_type)
            target_dir.mkdir(parents=True, exist_ok=True)
            for source in source_dir.glob("*.json"):
                target = target_dir / source.name
                if not target.exists():
                    shutil.copy2(source, target)
                    copied += 1
        return copied

    def _directory(self, preset_type: str) -> Path:
        if preset_type not in self.TYPES:
            raise KeyError(preset_type)
        return self.user_root / self.TYPES[preset_type][1]

    def _path(self, preset_type: str, name: str) -> Path:
        safe_name = self._safe_name(name)
        return self._directory(preset_type) / f"{safe_name}.json"

    def _summary(self, preset_type: str, path: Path) -> PresetSummary:
        return PresetSummary(name=path.stem, filename=path.name, type=preset_type, updated_at=path.stat().st_mtime)

    def _safe_name(self, name: str) -> str:
        return re.sub(r"[\\/:*?\"<>|]+", "_", name).strip(" .")

    def _default_content_directory(self, preset_type: str) -> Path:
        match preset_type:
            case "openai":
                return Path("presets/openai")
            case "textgenerationwebui":
                return Path("presets/textgen")
            case "kobold":
                return Path("presets/kobold")
            case "novel":
                return Path("presets/novel")
            case _:
                return Path("presets") / preset_type
