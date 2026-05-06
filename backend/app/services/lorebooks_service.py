from __future__ import annotations

import json
import random
import re
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field


class LorebookSummary(BaseModel):
    name: str
    filename: str
    entry_count: int
    updated_at: float
    bindings: list[dict[str, str]] = Field(default_factory=list)


class LorebookPayload(BaseModel):
    name: str
    book: dict[str, Any] = Field(default_factory=lambda: {"entries": {}})


class LorebookBinding(BaseModel):
    book: str
    target_type: str = "global"
    target_id: str = ""


class LorebookBindingPayload(BaseModel):
    bindings: list[LorebookBinding] = Field(default_factory=list)


class LorebookContext(BaseModel):
    worldInfoBefore: str = ""
    worldInfoAfter: str = ""
    depthPrompts: list[dict[str, object]] = Field(default_factory=list)


class LorebooksService:
    def __init__(self, worlds_dir: Path, bindings_path: Path) -> None:
        self.worlds_dir = worlds_dir
        self.bindings_path = bindings_path

    def list_books(self) -> list[LorebookSummary]:
        self.worlds_dir.mkdir(parents=True, exist_ok=True)
        bindings = self._load_bindings()
        summaries: list[LorebookSummary] = []
        for path in sorted(self.worlds_dir.glob("*.json"), key=lambda item: item.stem.lower()):
            try:
                book = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue
            entries = book.get("entries") if isinstance(book, dict) else {}
            summaries.append(
                LorebookSummary(
                    name=path.stem,
                    filename=path.name,
                    entry_count=len(entries) if isinstance(entries, dict) else 0,
                    updated_at=path.stat().st_mtime,
                    bindings=[binding.model_dump(mode="json") for binding in bindings if binding.book == path.stem],
                )
            )
        return summaries

    def get_book(self, name: str) -> dict[str, Any]:
        path = self._path(name)
        if not path.exists():
            raise FileNotFoundError(name)
        return json.loads(path.read_text(encoding="utf-8"))

    def save_book(self, payload: LorebookPayload) -> LorebookSummary:
        name = self._safe_name(payload.name)
        if not name:
            raise ValueError("Lorebook name is required")
        book = payload.book if isinstance(payload.book, dict) else {"entries": {}}
        if not isinstance(book.get("entries"), dict):
            book["entries"] = {}
        self.worlds_dir.mkdir(parents=True, exist_ok=True)
        path = self.worlds_dir / f"{name}.json"
        path.write_text(json.dumps(book, ensure_ascii=False, indent=4), encoding="utf-8")
        return next(summary for summary in self.list_books() if summary.name == name)

    def import_book(self, filename: str, content: bytes) -> LorebookSummary:
        if not filename.lower().endswith(".json"):
            raise ValueError("Only JSON lorebooks are supported")
        parsed = json.loads(content.decode("utf-8-sig"))
        if not isinstance(parsed, dict):
            raise ValueError("Lorebook JSON must be an object")
        return self.save_book(LorebookPayload(name=Path(filename).stem, book=parsed))

    def delete_book(self, name: str) -> None:
        path = self._path(name)
        if not path.exists():
            raise FileNotFoundError(name)
        path.unlink()
        self.save_bindings([binding for binding in self._load_bindings() if binding.book != self._safe_name(name)])

    def bindings(self) -> list[LorebookBinding]:
        return self._load_bindings()

    def save_bindings(self, bindings: list[LorebookBinding]) -> list[LorebookBinding]:
        cleaned = [binding for binding in bindings if binding.book and binding.target_type in {"global", "card", "chat", "persona"}]
        self.bindings_path.parent.mkdir(parents=True, exist_ok=True)
        self.bindings_path.write_text(yaml.safe_dump([binding.model_dump(mode="json") for binding in cleaned], sort_keys=False, allow_unicode=True), encoding="utf-8")
        return cleaned

    def active_context(self, history: list[str], card_id: str = "", chat_id: str = "", persona_id: str = "") -> LorebookContext:
        target_keys = {("global", ""), ("card", card_id), ("chat", chat_id), ("persona", persona_id)}
        active_books = {binding.book for binding in self._load_bindings() if (binding.target_type, binding.target_id) in target_keys or binding.target_type == "global"}
        if not active_books:
            return LorebookContext()

        before: list[tuple[int, str]] = []
        after: list[tuple[int, str]] = []
        depth_prompts: list[dict[str, object]] = []
        scan_text = "\n".join(history)
        for book_name in sorted(active_books):
            try:
                book = self.get_book(book_name)
            except (FileNotFoundError, json.JSONDecodeError, UnicodeDecodeError):
                continue
            entries = book.get("entries")
            if not isinstance(entries, dict):
                continue
            for entry in sorted((item for item in entries.values() if isinstance(item, dict)), key=lambda item: (self._int_value(item.get("order"), 100), self._int_value(item.get("displayIndex"), self._int_value(item.get("uid"), 0)))):
                if not self._entry_active(entry, scan_text):
                    continue
                content = str(entry.get("content") or "").strip()
                if not content:
                    continue
                order = self._int_value(entry.get("order"), 100)
                position = self._int_value(entry.get("position"), 0)
                if position in {1, 3, 6}:
                    after.append((order, content))
                elif position == 4:
                    depth_prompts.append({"role": self._entry_role(entry.get("role")), "content": content, "injection_depth": self._int_value(entry.get("depth"), 4), "injection_order": order})
                else:
                    before.append((order, content))
        return LorebookContext(
            worldInfoBefore="\n".join(content for _, content in sorted(before)),
            worldInfoAfter="\n".join(content for _, content in sorted(after)),
            depthPrompts=depth_prompts,
        )

    def _entry_active(self, entry: dict[str, Any], scan_text: str) -> bool:
        if entry.get("disable") is True:
            return False
        if entry.get("useProbability") is True and random.random() * 100 > self._float_value(entry.get("probability"), 100.0):
            return False
        if entry.get("constant") is True:
            return True
        primary = [str(item) for item in entry.get("key") or [] if str(item).strip()]
        secondary = [str(item) for item in entry.get("keysecondary") or [] if str(item).strip()]
        if not primary:
            return False
        matched_primary = any(self._keyword_matches(scan_text, key, entry) for key in primary)
        if not matched_primary:
            return False
        if entry.get("selective") is True and secondary:
            return any(self._keyword_matches(scan_text, key, entry) for key in secondary)
        return True

    def _keyword_matches(self, text: str, keyword: str, entry: dict[str, Any]) -> bool:
        flags = 0 if entry.get("caseSensitive") is True else re.IGNORECASE
        escaped = re.escape(keyword)
        pattern = rf"(?<!\w){escaped}(?!\w)" if entry.get("matchWholeWords") is True else escaped
        return re.search(pattern, text, flags=flags) is not None

    def _entry_role(self, value: Any) -> str:
        if value in (1, "1", "user"):
            return "user"
        if value in (2, "2", "assistant"):
            return "assistant"
        return "system"

    def _int_value(self, value: Any, fallback: int) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return fallback

    def _float_value(self, value: Any, fallback: float) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return fallback

    def _load_bindings(self) -> list[LorebookBinding]:
        if not self.bindings_path.exists():
            return []
        raw = yaml.safe_load(self.bindings_path.read_text(encoding="utf-8")) or []
        return [LorebookBinding.model_validate(item) for item in raw if isinstance(item, dict)]

    def _path(self, name: str) -> Path:
        return self.worlds_dir / f"{self._safe_name(name)}.json"

    def _safe_name(self, name: str) -> str:
        return re.sub(r"[\\/:*?\"<>|]+", "_", name).strip(" .")
