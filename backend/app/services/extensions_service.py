from __future__ import annotations

import json
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ExtensionInstallRequest(BaseModel):
    source: str
    name: str = ""
    enabled: bool = True
    overwrite: bool = False


class ExtensionRecord(BaseModel):
    name: str
    type: str = "local"
    enabled: bool = True
    source: str = ""
    installed_at: str = Field(default_factory=utc_now)
    updated_at: str = Field(default_factory=utc_now)


class ExtensionSummary(BaseModel):
    name: str
    external_name: str
    type: str
    enabled: bool
    source: str
    manifest: dict[str, Any] = Field(default_factory=dict)
    installed_at: str
    updated_at: str


class ExtensionsService:
    def __init__(self, extensions_root: Path, registry_path: Path) -> None:
        self.extensions_root = extensions_root
        self.registry_path = registry_path

    def list_extensions(self) -> list[ExtensionSummary]:
        records = self._load_registry()
        return [self._summary(record) for record in sorted(records, key=lambda item: item.name.lower()) if self.extension_dir(record.name).exists()]

    def discover_enabled(self) -> list[dict[str, str]]:
        return [
            {"name": summary.external_name, "type": summary.type}
            for summary in self.list_extensions()
            if summary.enabled and summary.manifest
        ]

    def install(self, request: ExtensionInstallRequest) -> ExtensionSummary:
        source = request.source.strip()
        if not source:
            raise ValueError("Extension source is required")
        name = self._safe_name(request.name.strip() or self._name_from_source(source))
        if not name:
            raise ValueError("Extension name is required")

        target = self.extension_dir(name)
        if target.exists():
            if not request.overwrite:
                raise FileExistsError(name)
            shutil.rmtree(target)

        target.parent.mkdir(parents=True, exist_ok=True)
        source_path = Path(source)
        if source_path.exists() and source_path.is_dir():
            shutil.copytree(source_path, target, ignore=shutil.ignore_patterns(".git", "node_modules", "__pycache__"))
        elif self._looks_like_git_url(source):
            self._clone_git(source, target)
        else:
            raise FileNotFoundError(source)

        if not (target / "manifest.json").exists():
            shutil.rmtree(target, ignore_errors=True)
            raise ValueError("Extension must contain manifest.json")

        records = [record for record in self._load_registry() if record.name != name]
        records.append(ExtensionRecord(name=name, enabled=request.enabled, source=source))
        self._save_registry(records)
        return self._summary(records[-1])

    def set_enabled(self, name: str, enabled: bool) -> ExtensionSummary:
        safe_name = self._safe_name(name)
        records = self._load_registry()
        for record in records:
            if record.name == safe_name:
                record.enabled = enabled
                record.updated_at = utc_now()
                self._save_registry(records)
                return self._summary(record)
        raise KeyError(name)

    def delete(self, name: str) -> None:
        safe_name = self._safe_name(name)
        records = self._load_registry()
        next_records = [record for record in records if record.name != safe_name]
        if len(next_records) == len(records):
            raise KeyError(name)
        shutil.rmtree(self.extension_dir(safe_name), ignore_errors=True)
        self._save_registry(next_records)

    def extension_dir(self, name: str) -> Path:
        return self.extensions_root / "third-party" / self._safe_name(name)

    def file_path(self, external_path: str) -> Path:
        parts = [part for part in Path(external_path.replace("\\", "/")).parts if part not in {"/", "..", "."}]
        if len(parts) >= 2 and parts[0] == "third-party":
            base = self.extension_dir(parts[1])
            path = base.joinpath(*parts[2:])
        elif parts:
            base = self.extension_dir(parts[0])
            path = base.joinpath(*parts[1:])
        else:
            raise FileNotFoundError(external_path)
        resolved = path.resolve()
        root = self.extensions_root.resolve()
        if root not in resolved.parents and resolved != root:
            raise FileNotFoundError(external_path)
        if not resolved.exists() or not resolved.is_file():
            raise FileNotFoundError(external_path)
        return resolved

    def _summary(self, record: ExtensionRecord) -> ExtensionSummary:
        return ExtensionSummary(
            name=record.name,
            external_name=f"third-party/{record.name}",
            type=record.type,
            enabled=record.enabled,
            source=record.source,
            manifest=self._manifest(record.name),
            installed_at=record.installed_at,
            updated_at=record.updated_at,
        )

    def _manifest(self, name: str) -> dict[str, Any]:
        path = self.extension_dir(name) / "manifest.json"
        if not path.exists():
            return {}
        try:
            parsed = json.loads(path.read_text(encoding="utf-8-sig"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {}
        return parsed if isinstance(parsed, dict) else {}

    def _load_registry(self) -> list[ExtensionRecord]:
        if not self.registry_path.exists():
            return []
        with self.registry_path.open("r", encoding="utf-8") as registry_file:
            raw = yaml.safe_load(registry_file) or []
        return [ExtensionRecord.model_validate(item) for item in raw if isinstance(item, dict)]

    def _save_registry(self, records: list[ExtensionRecord]) -> None:
        self.registry_path.parent.mkdir(parents=True, exist_ok=True)
        with self.registry_path.open("w", encoding="utf-8") as registry_file:
            yaml.safe_dump([record.model_dump(mode="json") for record in records], registry_file, sort_keys=False, allow_unicode=True)

    def _safe_name(self, value: str) -> str:
        return re.sub(r"[^\w\-.]+", "_", value, flags=re.UNICODE).strip("._-")[:80]

    def _name_from_source(self, source: str) -> str:
        cleaned = source.rstrip("/\\")
        name = Path(cleaned).name
        return name.removesuffix(".git")

    def _looks_like_git_url(self, source: str) -> bool:
        return source.startswith(("https://", "http://", "git@")) or source.endswith(".git")

    def _clone_git(self, source: str, target: Path) -> None:
        result = subprocess.run(["git", "clone", "--depth", "1", source, str(target)], capture_output=True, text=True, timeout=120, check=False)
        if result.returncode != 0:
            raise RuntimeError((result.stderr or result.stdout or "git clone failed").strip())
