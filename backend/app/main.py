from __future__ import annotations

import json
import asyncio

import httpx
from pathlib import Path
from urllib.parse import quote

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from backend.app.config import PROJECT_ROOT, load_config
from backend.app.models import ClientEvent, JoinSessionRequest, SendMessageRequest
from pydantic import BaseModel

from backend.app.services.bot_chats_service import BotChatsService, ChatCreate, ChatMessageCreate, ChatMessageUpdate, ChatSwipeRequest, ChatUpdate
from backend.app.services.character_cards_service import CharacterCardCreate, CharacterCardsService, CharacterCardUpdate
from backend.app.realtime.connection_manager import ConnectionManager
from backend.app.secrets import SecretStore
from backend.app.services.generation_service import GenerationService
from backend.app.services.lorebooks_service import LorebookBindingPayload, LorebookPayload, LorebooksService
from backend.app.llm.openai_compatible import OpenAICompatibleProvider
from backend.app.services.personas_service import PersonaCreate, PersonasService, PersonaUpdate
from backend.app.services.auth_service import AuthService, AuthUser
from backend.app.services.presets_service import PresetPayload, PresetsService
from backend.app.services.settings_service import GenerationPresetSave, GenerationSettingsUpdate, SecuritySettingsPayload, SettingsService
from backend.app.services.session_service import DEFAULT_SESSION_ID, SessionService
from backend.app.storage.file_storage import FileStorage


config = load_config()
storage = FileStorage(config.storage.data_root, config.storage.default_user)
session_service = SessionService(storage)
secret_store = SecretStore(storage.user_root / "secrets.yaml")
settings_service = SettingsService(storage.user_root / "settings.yaml", secret_store)
auth_service = AuthService(storage.user_root / "users.yaml")
generation_service = GenerationService(settings_service.generation_config(), secret_store, session_service)
character_cards_service = CharacterCardsService(storage.user_root / "characters")
bot_chats_service = BotChatsService(storage.user_root / "chats")
personas_service = PersonasService(storage.user_root / "personas.yaml", storage.user_root / "User Avatars")
presets_service = PresetsService(storage.user_root)
lorebooks_service = LorebooksService(storage.user_root / "worlds", storage.user_root / "lorebook_bindings.yaml")
connection_manager = ConnectionManager()
generation_tasks: dict[str, asyncio.Task[str]] = {}


class BotReplyRequest(BaseModel):
    replace_message_id: str | None = None
    reset_swipes: bool = False
    persona_id: str | None = None
    persona_name: str | None = None
    persona_description: str | None = None


class AuthRequest(BaseModel):
    username: str
    password: str


class AdminClaimRequest(BaseModel):
    code: str


async def _broadcast_chat(card_id: str, chat_id: str) -> None:
    chat = bot_chats_service.get_chat(card_id, chat_id)
    await connection_manager.broadcast(
        DEFAULT_SESSION_ID,
        {"type": "chat.updated", "card_id": card_id, "chat": chat.model_dump(mode="json")},
    )


def _ensure_card_first_message(card_id: str, chat_id: str) -> object:
    chat = bot_chats_service.get_chat(card_id, chat_id)
    if chat.messages:
        return chat
    character_data = character_cards_service.card_data(card_id)
    first_message = str(character_data.get("first_mes") or character_data.get("first_message") or "").strip()
    if not first_message:
        return chat
    avatar_url = next((card.image_url for card in character_cards_service.list_cards() if card.id == card_id), "")
    return bot_chats_service.add_bot_message(card_id, chat_id, chat.character_name, first_message, avatar_url)


async def _broadcast_generation_state(card_id: str, chat_id: str, event_type: str, message: str = "", replace_message_id: str | None = None) -> None:
    event: dict[str, object] = {"type": event_type, "card_id": card_id, "chat_id": chat_id, "replace_message_id": replace_message_id}
    if message:
        event["message"] = message
    await connection_manager.broadcast(DEFAULT_SESSION_ID, event)


async def _broadcast_presence(session_id: str = DEFAULT_SESSION_ID) -> None:
    await connection_manager.broadcast(
        session_id,
        {"type": "presence.updated", "session": session_service.snapshot(session_id)},
    )


def _actor_from_request(request: Request) -> str:
    actor = request.headers.get("x-doubletrouble-actor", "").strip()
    user = _auth_user_from_request(request)
    if user:
        return user.username
    return actor


def _token_from_request(request: Request) -> str:
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return str(request.query_params.get("auth") or "").strip()


def _auth_user_from_request(request: Request) -> AuthUser | None:
    return auth_service.user_by_token(_token_from_request(request))


def _require_permission(request: Request, action: str) -> None:
    user = _auth_user_from_request(request)
    if settings_service.auth_required() and not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    permissions = settings_service.security_permissions().model_dump()
    rule = permissions.get(action, {"mode": "everyone", "users": []})
    mode = str(rule.get("mode") or "everyone")
    allowed_users = {str(username).lower() for username in rule.get("users", []) if str(username).strip()}
    if mode == "everyone":
        return
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    if mode == "admins" and user.is_admin:
        return
    if mode == "users" and (user.is_admin or user.username.lower() in allowed_users):
        return
    raise HTTPException(status_code=403, detail="Not enough permissions")


def _notification_text(message: str, actor: str = "") -> str:
    return f"{actor}: {message}" if actor else message


async def _broadcast_notification(message: str, session_id: str = DEFAULT_SESSION_ID, actor: str = "") -> None:
    await connection_manager.broadcast(session_id, {"type": "notification", "message": _notification_text(message, actor)})


def _apply_generation_preset(preset_type: str, preset: dict[str, object]) -> object | None:
    current = settings_service.generation_settings()
    update = GenerationSettingsUpdate(
        provider=str(current.get("provider") or "disabled"),
        base_url=str(current.get("base_url") or ""),
        model=str(current.get("model") or ""),
        system_prompt=str(current.get("system_prompt") or ""),
        temperature=float(current.get("temperature") or 0.8),
        max_tokens=int(current.get("max_tokens") or 350),
        timeout_seconds=float(current.get("timeout_seconds") or 60),
    )

    if preset_type == "sysprompt":
        update.system_prompt = str(preset.get("content") or update.system_prompt)
    if preset_type == "openai":
        update.temperature = float(preset.get("temperature") or update.temperature)
        update.max_tokens = int(preset.get("openai_max_tokens") or preset.get("max_tokens") or update.max_tokens)
        update.model = str(preset.get("custom_model") or preset.get("openai_model") or preset.get("openrouter_model") or update.model)
    if preset_type in {"textgenerationwebui", "kobold"}:
        update.temperature = float(preset.get("temp") or preset.get("temperature") or update.temperature)
        update.max_tokens = int(preset.get("max_length") or preset.get("max_tokens") or update.max_tokens)

    if preset_type in {"openai", "textgenerationwebui", "kobold", "sysprompt"}:
        return settings_service.update_generation_settings(update)
    return None


def _active_openai_preset() -> dict[str, object] | None:
    name = settings_service.active_preset_settings().get("openai")
    if not name:
        return None
    try:
        return presets_service.get_preset("openai", name)
    except (KeyError, FileNotFoundError, json.JSONDecodeError):
        return None

app = FastAPI(title="DoubleTrouble", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup() -> None:
    storage.ensure_layout()
    session_service.get_or_create_session(DEFAULT_SESSION_ID)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/config/public")
async def public_config() -> dict[str, object]:
    return {
        "server": {
            "listen_ip": config.server.listen_ip,
            "listen_port": config.server.listen_port,
            "public_url": config.server.public_url,
        },
        "auth": {"mode": config.auth.mode, "required": settings_service.auth_required()},
        "default_session_id": DEFAULT_SESSION_ID,
    }


@app.post("/api/auth/register")
async def auth_register(payload: AuthRequest) -> dict[str, object]:
    try:
        user, token = auth_service.register(payload.username, payload.password)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {"token": token, "user": auth_service.public_user(user)}


@app.post("/api/auth/login")
async def auth_login(payload: AuthRequest) -> dict[str, object]:
    try:
        user, token = auth_service.login(payload.username, payload.password)
    except ValueError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    return {"token": token, "user": auth_service.public_user(user)}


@app.get("/api/auth/me")
async def auth_me(request: Request) -> dict[str, object]:
    return {"user": auth_service.public_user(_auth_user_from_request(request))}


@app.post("/api/auth/logout")
async def auth_logout(request: Request) -> dict[str, object]:
    auth_service.logout(_token_from_request(request))
    return {"ok": True}


@app.post("/api/auth/claim-admin")
async def claim_admin(payload: AdminClaimRequest, request: Request) -> dict[str, object]:
    try:
        user = auth_service.claim_admin(_token_from_request(request), payload.code, config.auth.admin_code)
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {"user": auth_service.public_user(user)}


@app.get("/api/security/permissions")
async def get_security_permissions() -> dict[str, object]:
    return {"auth_required": settings_service.auth_required(), "permissions": settings_service.security_permissions().model_dump(mode="json")}


@app.put("/api/security/permissions")
async def update_security_permissions(payload: SecuritySettingsPayload, request: Request) -> dict[str, object]:
    _require_permission(request, "manage_security")
    settings = settings_service.update_security_settings(payload)
    await connection_manager.broadcast(
        DEFAULT_SESSION_ID,
        {
            "type": "security.updated",
            "auth_required": settings.auth_required,
            "permissions": settings.permissions.model_dump(mode="json"),
        },
    )
    return {"auth_required": settings.auth_required, "permissions": settings.permissions.model_dump(mode="json")}


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str) -> dict[str, object]:
    return session_service.snapshot(session_id)


@app.post("/api/sessions/{session_id}/join")
async def join_session(session_id: str, request: JoinSessionRequest) -> dict[str, object]:
    participant = session_service.join_session(session_id, request.name, request.participant_id)
    await _broadcast_presence(session_id)
    return {"participant": participant.model_dump(mode="json"), "session": session_service.snapshot(session_id)}


@app.post("/api/sessions/{session_id}/messages")
async def send_message(session_id: str, request: SendMessageRequest) -> dict[str, object]:
    message = session_service.add_message(session_id, request)
    await connection_manager.broadcast(
        session_id,
        {"type": "session.updated", "session": session_service.snapshot(session_id), "message": message.model_dump(mode="json")},
    )
    return {"message": message.model_dump(mode="json")}


@app.get("/api/generation/status")
async def generation_status() -> dict[str, object]:
    return await generation_service.status()


@app.get("/api/generation/settings")
async def generation_settings() -> dict[str, object]:
    return settings_service.generation_settings()


@app.put("/api/generation/settings")
async def update_generation_settings(request: GenerationSettingsUpdate) -> dict[str, object]:
    generation = settings_service.update_generation_settings(request)
    generation_service.update_config(generation)
    return settings_service.generation_settings()


@app.get("/api/generation/presets")
async def generation_presets(request: Request) -> dict[str, object]:
    _require_permission(request, "view_presets")
    return {"presets": [preset.model_dump(mode="json") for preset in settings_service.generation_presets()], "active": settings_service.active_generation_preset()}


@app.post("/api/generation/presets")
async def save_generation_preset(request: GenerationPresetSave, http_request: Request) -> dict[str, object]:
    _require_permission(http_request, "manage_presets")
    try:
        preset = settings_service.save_generation_preset(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    generation_service.update_config(settings_service.generation_config())
    return {"preset": preset.model_dump(mode="json"), "settings": settings_service.generation_settings(), "active": settings_service.active_generation_preset()}


@app.post("/api/generation/presets/{name}/active")
async def apply_generation_connection_preset(name: str) -> dict[str, object]:
    try:
        generation = settings_service.apply_generation_preset(name)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Preset not found") from error
    generation_service.update_config(generation)
    return {"settings": settings_service.generation_settings(), "active": settings_service.active_generation_preset()}


@app.delete("/api/generation/presets/{name}")
async def delete_generation_preset(name: str, request: Request) -> dict[str, object]:
    _require_permission(request, "manage_presets")
    try:
        settings_service.delete_generation_preset(name)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Preset not found") from error
    return {"ok": True, "active": settings_service.active_generation_preset()}


@app.post("/api/generation/models")
async def generation_models(request: GenerationSettingsUpdate) -> dict[str, object]:
    if request.provider == "disabled":
        return {"ok": False, "error": "generation provider is disabled"}
    api_key = request.api_key.strip() or secret_store.read(settings_service.generation_config().api_key_secret, settings_service.generation_config().api_key_env)
    provider = OpenAICompatibleProvider(request.base_url, api_key, request.timeout_seconds)
    return await provider.status()


@app.get("/api/presets/types")
async def preset_types(request: Request) -> dict[str, object]:
    _require_permission(request, "view_presets")
    return {"types": [preset_type.model_dump(mode="json") for preset_type in presets_service.types()]}


@app.get("/api/presets/active")
async def active_presets(request: Request) -> dict[str, object]:
    _require_permission(request, "view_presets")
    return {"active": settings_service.active_preset_settings()}


@app.get("/api/presets/{preset_type}")
async def list_presets(preset_type: str, request: Request) -> dict[str, object]:
    _require_permission(request, "view_presets")
    try:
        presets = presets_service.list_presets(preset_type)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Preset type not found") from error
    return {"presets": [preset.model_dump(mode="json") for preset in presets]}


@app.get("/api/presets/{preset_type}/{name}")
async def get_preset(preset_type: str, name: str, request: Request) -> dict[str, object]:
    _require_permission(request, "view_presets")
    try:
        preset = presets_service.get_preset(preset_type, name)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Preset type not found") from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Preset not found") from error
    return {"preset": preset}


@app.put("/api/presets/{preset_type}")
async def save_preset(preset_type: str, payload: PresetPayload, request: Request) -> dict[str, object]:
    _require_permission(request, "manage_presets")
    try:
        preset = presets_service.save_preset(preset_type, payload)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Preset type not found") from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await _broadcast_notification(f"сохранил пресет: {preset.name}", actor=_actor_from_request(request))
    return {"preset": preset.model_dump(mode="json")}


@app.post("/api/presets/{preset_type}/import")
async def import_preset(preset_type: str, request: Request, file: UploadFile = File(...)) -> dict[str, object]:
    _require_permission(request, "manage_presets")
    if not file.filename:
        raise HTTPException(status_code=400, detail="Preset file is required")
    try:
        preset = presets_service.import_preset(preset_type, file.filename, await file.read())
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Preset type not found") from error
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await _broadcast_notification(f"импортировал пресет: {preset.name}", actor=_actor_from_request(request))
    return {"preset": preset.model_dump(mode="json")}


@app.delete("/api/presets/{preset_type}/{name}")
async def delete_preset(preset_type: str, name: str, request: Request) -> dict[str, object]:
    _require_permission(request, "manage_presets")
    try:
        presets_service.delete_preset(preset_type, name)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Preset type not found") from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Preset not found") from error
    await _broadcast_notification(f"удалил пресет: {name}", actor=_actor_from_request(request))
    return {"ok": True}


@app.get("/api/presets/{preset_type}/{name}/export")
async def export_preset(preset_type: str, name: str, request: Request) -> Response:
    _require_permission(request, "view_presets")
    try:
        filename, content = presets_service.export_preset(preset_type, name)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Preset type not found") from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Preset not found") from error
    return Response(
        content=content,
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=preset.json; filename*=UTF-8''{quote(filename)}"},
    )


@app.post("/api/presets/{preset_type}/{name}/apply")
async def apply_preset(preset_type: str, name: str, request: Request) -> dict[str, object]:
    _require_permission(request, "manage_presets")
    try:
        preset = presets_service.get_preset(preset_type, name)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Preset type not found") from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Preset not found") from error
    active = settings_service.set_active_preset(preset_type, name)
    generation = _apply_generation_preset(preset_type, preset)
    if generation:
        generation_service.update_config(generation)
    await _broadcast_notification(f"изменил активный пресет: {name}", actor=_actor_from_request(request))
    return {"active": active, "settings": settings_service.generation_settings()}


@app.post("/api/presets/import-sillytavern-defaults")
async def import_sillytavern_defaults(request: Request, source_root: str = Form("E:/ST/SillyTavern/default/content")) -> dict[str, object]:
    _require_permission(request, "manage_presets")
    copied = presets_service.import_directory(Path(source_root))
    await _broadcast_notification(f"импортировал дефолтные пресеты ST: {copied}", actor=_actor_from_request(request))
    return {"copied": copied}


@app.get("/api/lorebooks")
async def list_lorebooks(request: Request) -> dict[str, object]:
    _require_permission(request, "view_lorebooks")
    return {"lorebooks": [book.model_dump(mode="json") for book in lorebooks_service.list_books()], "bindings": [binding.model_dump(mode="json") for binding in lorebooks_service.bindings()]}


@app.post("/api/lorebooks/import")
async def import_lorebook(request: Request, file: UploadFile = File(...)) -> dict[str, object]:
    _require_permission(request, "manage_lorebooks")
    if not file.filename:
        raise HTTPException(status_code=400, detail="Lorebook file is required")
    try:
        book = lorebooks_service.import_book(file.filename, await file.read())
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await _broadcast_notification(f"импортировал лорбук: {book.name}", actor=_actor_from_request(request))
    return {"lorebook": book.model_dump(mode="json")}


@app.get("/api/lorebooks/{name}")
async def get_lorebook(name: str, request: Request) -> dict[str, object]:
    _require_permission(request, "view_lorebooks")
    try:
        return {"book": lorebooks_service.get_book(name)}
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Lorebook not found") from error


@app.put("/api/lorebooks")
async def save_lorebook(payload: LorebookPayload, request: Request) -> dict[str, object]:
    _require_permission(request, "manage_lorebooks")
    try:
        book = lorebooks_service.save_book(payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await _broadcast_notification(f"сохранил лорбук: {book.name}", actor=_actor_from_request(request))
    return {"lorebook": book.model_dump(mode="json")}


@app.delete("/api/lorebooks/{name}")
async def delete_lorebook(name: str, request: Request) -> dict[str, object]:
    _require_permission(request, "manage_lorebooks")
    try:
        lorebooks_service.delete_book(name)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Lorebook not found") from error
    await _broadcast_notification(f"удалил лорбук: {name}", actor=_actor_from_request(request))
    return {"ok": True}


@app.get("/api/lorebooks/{name}/export")
async def export_lorebook(name: str, request: Request) -> Response:
    _require_permission(request, "view_lorebooks")
    try:
        book = lorebooks_service.get_book(name)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Lorebook not found") from error
    filename = f"{name}.json"
    return Response(
        content=json.dumps(book, ensure_ascii=False, indent=4),
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=lorebook.json; filename*=UTF-8''{quote(filename)}"},
    )


@app.put("/api/lorebooks/bindings")
async def save_lorebook_bindings(payload: LorebookBindingPayload, request: Request) -> dict[str, object]:
    _require_permission(request, "manage_lorebooks")
    bindings = lorebooks_service.save_bindings(payload.bindings)
    await _broadcast_notification("обновил привязки лорбуков", actor=_actor_from_request(request))
    return {"bindings": [binding.model_dump(mode="json") for binding in bindings]}


@app.get("/api/cards")
async def list_character_cards(request: Request) -> dict[str, object]:
    _require_permission(request, "view_cards")
    return {"cards": [card.model_dump(mode="json") for card in character_cards_service.list_cards()]}


@app.post("/api/cards/import")
async def import_character_card(request: Request, file: UploadFile = File(...)) -> dict[str, object]:
    _require_permission(request, "edit_cards")
    if not file.filename or not file.filename.lower().endswith(".png"):
        raise HTTPException(status_code=400, detail="Only PNG character cards are supported")
    try:
        card = character_cards_service.import_card(file.filename, await file.read())
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await _broadcast_notification(f"импортировал карточку: {card.name}", actor=_actor_from_request(request))
    return {"card": card.model_dump(mode="json")}


@app.post("/api/cards")
async def create_character_card(
    http_request: Request,
    name: str = Form(...),
    description: str = Form(""),
    personality: str = Form(""),
    scenario: str = Form(""),
    first_message: str = Form(""),
    message_example: str = Form(""),
    creator: str = Form(""),
    tags: str = Form(""),
    avatar: UploadFile | None = File(None),
) -> dict[str, object]:
    _require_permission(http_request, "edit_cards")
    payload = CharacterCardCreate(
        name=name,
        description=description,
        personality=personality,
        scenario=scenario,
        first_message=first_message,
        message_example=message_example,
        creator=creator,
        tags=[tag.strip() for tag in tags.split(",") if tag.strip()],
    )
    avatar_content = await avatar.read() if avatar and avatar.filename else None
    try:
        card = character_cards_service.create_card(payload, avatar_content)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await _broadcast_notification(f"создал карточку: {card.name}", actor=_actor_from_request(http_request))
    return {"card": card.model_dump(mode="json")}


@app.put("/api/cards/{card_id}")
async def update_character_card(card_id: str, payload: CharacterCardUpdate, request: Request) -> dict[str, object]:
    _require_permission(request, "edit_cards")
    try:
        card = character_cards_service.update_card(card_id, payload)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Card not found") from error
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await _broadcast_notification(f"обновил карточку: {card.name}", actor=_actor_from_request(request))
    return {"card": card.model_dump(mode="json")}


@app.post("/api/cards/{card_id}/avatar")
async def update_character_card_avatar(card_id: str, request: Request, file: UploadFile = File(...)) -> dict[str, object]:
    _require_permission(request, "edit_cards")
    if not file.filename or not file.filename.lower().endswith(".png"):
        raise HTTPException(status_code=400, detail="Only PNG avatar files are supported")
    try:
        card = character_cards_service.update_card_avatar(card_id, await file.read())
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Card not found") from error
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await _broadcast_notification(f"обновил аватар карточки: {card.name}", actor=_actor_from_request(request))
    return {"card": card.model_dump(mode="json")}


@app.delete("/api/cards/{card_id}")
async def delete_character_card(card_id: str, request: Request) -> dict[str, object]:
    _require_permission(request, "delete_cards")
    try:
        card = character_cards_service.delete_card(card_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Card not found") from error
    bot_chats_service.delete_card_chats(card_id)
    await connection_manager.broadcast(DEFAULT_SESSION_ID, {"type": "card.deleted", "card_id": card_id})
    await _broadcast_notification(f"удалил карточку: {card.name}", actor=_actor_from_request(request))
    return {"ok": True, "card": card.model_dump(mode="json")}


@app.get("/api/cards/{card_id}/chats")
async def list_bot_chats(card_id: str, request: Request) -> dict[str, object]:
    _require_permission(request, "view_chats")
    return {"chats": [chat.model_dump(mode="json") for chat in bot_chats_service.list_chats(card_id)]}


@app.post("/api/cards/{card_id}/chats/current")
async def current_bot_chat(card_id: str, request: ChatCreate, http_request: Request) -> dict[str, object]:
    _require_permission(http_request, "view_chats")
    chat = bot_chats_service.current_or_create(card_id, request.character_name)
    chat = _ensure_card_first_message(card_id, chat.id)
    return {"chat": chat.model_dump(mode="json")}


@app.post("/api/cards/{card_id}/chats")
async def create_bot_chat(card_id: str, request: ChatCreate, http_request: Request) -> dict[str, object]:
    _require_permission(http_request, "manage_chats")
    chat = bot_chats_service.create_chat(card_id, request)
    chat = _ensure_card_first_message(card_id, chat.id)
    await _broadcast_chat(card_id, chat.id)
    return {"chat": chat.model_dump(mode="json")}


@app.get("/api/cards/{card_id}/chats/{chat_id}")
async def get_bot_chat(card_id: str, chat_id: str, request: Request) -> dict[str, object]:
    _require_permission(request, "view_chats")
    try:
        chat = bot_chats_service.get_chat(card_id, chat_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Chat not found") from error
    return {"chat": chat.model_dump(mode="json")}


@app.put("/api/cards/{card_id}/chats/{chat_id}")
async def update_bot_chat(card_id: str, chat_id: str, request: ChatUpdate, http_request: Request) -> dict[str, object]:
    _require_permission(http_request, "manage_chats")
    try:
        chat = bot_chats_service.update_chat(card_id, chat_id, request)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Chat not found") from error
    await _broadcast_chat(card_id, chat_id)
    return {"chat": chat.model_dump(mode="json")}


@app.post("/api/cards/{card_id}/chats/{chat_id}/copy")
async def copy_bot_chat(card_id: str, chat_id: str, request: Request) -> dict[str, object]:
    _require_permission(request, "manage_chats")
    try:
        chat = bot_chats_service.copy_chat(card_id, chat_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Chat not found") from error
    await _broadcast_chat(card_id, chat.id)
    return {"chat": chat.model_dump(mode="json")}


@app.delete("/api/cards/{card_id}/chats/{chat_id}")
async def delete_bot_chat(card_id: str, chat_id: str, request: Request) -> dict[str, object]:
    _require_permission(request, "manage_chats")
    try:
        bot_chats_service.delete_chat(card_id, chat_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Chat not found") from error
    await connection_manager.broadcast(DEFAULT_SESSION_ID, {"type": "chat.deleted", "card_id": card_id, "chat_id": chat_id})
    return {"ok": True}


@app.get("/api/cards/{card_id}/chats/{chat_id}/export/sillytavern")
async def export_bot_chat_sillytavern(card_id: str, chat_id: str, request: Request) -> Response:
    _require_permission(request, "view_chats")
    try:
        content = bot_chats_service.export_sillytavern_jsonl(card_id, chat_id)
        filename = bot_chats_service.sillytavern_export_filename(card_id, chat_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Chat not found") from error
    return Response(
        content=content,
        media_type="application/jsonl; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=chat.jsonl; filename*=UTF-8''{quote(filename)}"},
    )


@app.post("/api/cards/{card_id}/chats/{chat_id}/messages")
async def add_bot_chat_message(card_id: str, chat_id: str, request: ChatMessageCreate) -> dict[str, object]:
    try:
        chat = bot_chats_service.add_message(card_id, chat_id, request)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Chat not found") from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await _broadcast_chat(card_id, chat_id)
    return {"chat": chat.model_dump(mode="json")}


@app.put("/api/cards/{card_id}/chats/{chat_id}/messages/{message_id}")
async def update_bot_chat_message(card_id: str, chat_id: str, message_id: str, request: ChatMessageUpdate, http_request: Request) -> dict[str, object]:
    _require_permission(http_request, "edit_messages")
    try:
        chat = bot_chats_service.update_message(card_id, chat_id, message_id, request)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Chat not found") from error
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Message not found") from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await _broadcast_chat(card_id, chat_id)
    return {"chat": chat.model_dump(mode="json")}


@app.delete("/api/cards/{card_id}/chats/{chat_id}/messages/{message_id}")
async def delete_bot_chat_message(card_id: str, chat_id: str, message_id: str, request: Request) -> dict[str, object]:
    _require_permission(request, "delete_messages")
    try:
        chat = bot_chats_service.delete_message(card_id, chat_id, message_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Chat not found") from error
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Message not found") from error
    await _broadcast_chat(card_id, chat_id)
    return {"chat": chat.model_dump(mode="json")}


@app.post("/api/cards/{card_id}/chats/{chat_id}/messages/{message_id}/swipe")
async def swipe_bot_chat_message(card_id: str, chat_id: str, message_id: str, request: ChatSwipeRequest) -> dict[str, object]:
    try:
        chat = bot_chats_service.swipe_bot_message(card_id, chat_id, message_id, request.direction)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Chat not found") from error
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Message not found") from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await _broadcast_chat(card_id, chat_id)
    return {"chat": chat.model_dump(mode="json")}


@app.post("/api/cards/{card_id}/chats/{chat_id}/bot/reply")
async def request_card_bot_reply(card_id: str, chat_id: str, http_request: Request, request: BotReplyRequest | None = None) -> dict[str, object]:
    _require_permission(http_request, "generate")
    task_key = f"{card_id}:{chat_id}"
    if task_key in generation_tasks:
        raise HTTPException(status_code=409, detail="Generation is already running")
    try:
        chat = bot_chats_service.get_chat(card_id, chat_id)
        replace_message_id = request.replace_message_id if request else None
        reset_swipes = bool(request.reset_swipes) if request else False
        history = chat.messages
        if replace_message_id:
            target_index = next((index for index, message in enumerate(chat.messages) if message.id == replace_message_id and message.role == "assistant"), -1)
            if target_index < 0:
                raise KeyError(replace_message_id)
            history = chat.messages[:target_index]
        openai_preset = _active_openai_preset()
        character_data = character_cards_service.card_data(card_id)
        persona_id = request.persona_id if request else None
        persona_name = request.persona_name if request else None
        persona_description = request.persona_description if request else None
        lorebook_context = lorebooks_service.active_context([message.content for message in history if not message.hidden], card_id, chat_id, persona_id or "")
        task = asyncio.create_task(generation_service.generate_chat_reply(chat.character_name, history, openai_preset, character_data, persona_name, persona_description, lorebook_context.model_dump(mode="json")))
        generation_tasks[task_key] = task
        await _broadcast_generation_state(card_id, chat_id, "generation.started", replace_message_id=replace_message_id)
        reply = await task
        avatar_url = next((card.image_url for card in character_cards_service.list_cards() if card.id == card_id), "")
        if replace_message_id:
            chat = bot_chats_service.replace_bot_message(card_id, chat_id, replace_message_id, chat.character_name, reply, avatar_url, reset_swipes)
        else:
            chat = bot_chats_service.add_bot_message(card_id, chat_id, chat.character_name, reply, avatar_url)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Chat not found") from error
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Message not found") from error
    except asyncio.CancelledError as error:
        await _broadcast_generation_state(card_id, chat_id, "generation.cancelled", "Генерация отменена", replace_message_id)
        raise HTTPException(status_code=499, detail="Generation cancelled") from error
    except httpx.ReadTimeout as error:
        message = "Provider did not finish the response in time. Increase timeout or reduce max tokens/context."
        await _broadcast_generation_state(card_id, chat_id, "generation.failed", message, replace_message_id)
        raise HTTPException(status_code=504, detail=message) from error
    except httpx.RemoteProtocolError as error:
        message = f"Provider closed the connection before sending a response: {error}"
        await _broadcast_generation_state(card_id, chat_id, "generation.failed", message, replace_message_id)
        raise HTTPException(status_code=502, detail=message) from error
    except httpx.HTTPStatusError as error:
        message = f"Provider returned {error.response.status_code}: {error.response.text}"
        await _broadcast_generation_state(card_id, chat_id, "generation.failed", message, replace_message_id)
        raise HTTPException(status_code=502, detail=message) from error
    except httpx.HTTPError as error:
        message = f"Provider request failed: {error}"
        await _broadcast_generation_state(card_id, chat_id, "generation.failed", message, replace_message_id)
        raise HTTPException(status_code=502, detail=message) from error
    except RuntimeError as error:
        message = str(error)
        await _broadcast_generation_state(card_id, chat_id, "generation.failed", message, replace_message_id)
        raise HTTPException(status_code=400, detail=message) from error
    finally:
        generation_tasks.pop(task_key, None)
    await _broadcast_chat(card_id, chat_id)
    await _broadcast_generation_state(card_id, chat_id, "generation.finished", replace_message_id=replace_message_id)
    return {"chat": chat.model_dump(mode="json")}


@app.post("/api/cards/{card_id}/chats/{chat_id}/bot/cancel")
async def cancel_card_bot_reply(card_id: str, chat_id: str, request: Request) -> dict[str, object]:
    _require_permission(request, "generate")
    task = generation_tasks.get(f"{card_id}:{chat_id}")
    if task and not task.done():
        task.cancel()
        await _broadcast_generation_state(card_id, chat_id, "generation.cancelled", "Генерация отменяется")
        return {"cancelled": True}
    return {"cancelled": False}


@app.get("/api/cards/{card_id}/image")
async def character_card_image(card_id: str, request: Request) -> FileResponse:
    _require_permission(request, "view_cards")
    try:
        path = character_cards_service.image_path(card_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Card image not found") from error
    return FileResponse(path, media_type="image/png")


@app.get("/api/personas")
async def list_personas(request: Request) -> dict[str, object]:
    _require_permission(request, "view_personas")
    return {"personas": [persona.model_dump(mode="json") for persona in personas_service.list_personas()]}


@app.post("/api/personas")
async def create_persona(payload: PersonaCreate, request: Request) -> dict[str, object]:
    _require_permission(request, "edit_personas")
    persona = personas_service.create_persona(payload)
    await _broadcast_notification(f"создал персону: {persona.name}", actor=_actor_from_request(request))
    return {"persona": persona.model_dump(mode="json")}


@app.put("/api/personas/{persona_id}")
async def update_persona(persona_id: str, payload: PersonaUpdate, request: Request) -> dict[str, object]:
    _require_permission(request, "edit_personas")
    try:
        persona = personas_service.update_persona(persona_id, payload)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Persona not found") from error
    await _broadcast_notification(f"обновил персону: {persona.name}", actor=_actor_from_request(request))
    return {"persona": persona.model_dump(mode="json")}


@app.delete("/api/personas/{persona_id}")
async def delete_persona(persona_id: str, request: Request) -> dict[str, object]:
    _require_permission(request, "delete_personas")
    try:
        persona = personas_service.delete_persona(persona_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Persona not found") from error
    await _broadcast_notification(f"удалил персону: {persona.name}", actor=_actor_from_request(request))
    return {"ok": True, "persona": persona.model_dump(mode="json")}


@app.put("/api/personas/{persona_id}/active")
async def activate_persona(persona_id: str, request: Request) -> dict[str, object]:
    _require_permission(request, "edit_personas")
    try:
        persona = personas_service.activate_persona(persona_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Persona not found") from error
    await _broadcast_notification(f"изменил активную персону: {persona.name}", actor=_actor_from_request(request))
    return {"persona": persona.model_dump(mode="json")}


@app.post("/api/personas/{persona_id}/avatar")
async def upload_persona_avatar(persona_id: str, request: Request, file: UploadFile = File(...)) -> dict[str, object]:
    _require_permission(request, "edit_personas")
    if not file.filename:
        raise HTTPException(status_code=400, detail="Avatar file is required")
    try:
        persona = personas_service.set_avatar(persona_id, file.filename, await file.read())
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Persona not found") from error
    await _broadcast_notification(f"обновил аватар персоны: {persona.name}", actor=_actor_from_request(request))
    return {"persona": persona.model_dump(mode="json")}


@app.get("/api/personas/avatars/{filename}")
async def persona_avatar(filename: str, request: Request) -> FileResponse:
    _require_permission(request, "view_personas")
    try:
        path = personas_service.avatar_path(filename)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Persona avatar not found") from error
    return FileResponse(path)


@app.post("/api/sessions/{session_id}/bot/reply")
async def request_bot_reply(session_id: str) -> dict[str, object]:
    try:
        message = await generation_service.generate_reply(session_id)
    except httpx.HTTPStatusError as error:
        raise HTTPException(status_code=502, detail=f"Provider returned {error.response.status_code}: {error.response.text}") from error
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"Provider request failed: {error}") from error
    except RuntimeError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await connection_manager.broadcast(
        session_id,
        {"type": "session.updated", "session": session_service.snapshot(session_id), "message": message.model_dump(mode="json")},
    )
    return {"message": message.model_dump(mode="json")}


@app.websocket("/ws/sessions/{session_id}")
async def session_websocket(websocket: WebSocket, session_id: str) -> None:
    await connection_manager.connect(session_id, websocket)
    participant_id: str | None = None
    try:
        await websocket.send_json({"type": "session.snapshot", "session": session_service.snapshot(session_id)})
        while True:
            raw_event = await websocket.receive_json()
            event = ClientEvent.model_validate(raw_event)

            if event.type == "participant.join":
                participant = session_service.join_session(
                    session_id,
                    event.name or event.persona_name or "Player",
                    event.participant_id,
                    event.persona_id or "",
                    event.persona_name or "",
                    event.avatar_url or "",
                    event.username or "",
                    bool(event.is_admin),
                )
                participant_id = participant.id
                await _broadcast_presence(session_id)

            if event.type == "presence.update" and event.participant_id:
                participant = session_service.update_presence(
                    session_id,
                    event.participant_id,
                    event.name or event.persona_name or "Player",
                    event.persona_id or "",
                    event.persona_name or "",
                    event.avatar_url or "",
                    event.username or "",
                    bool(event.is_admin),
                )
                participant_id = participant.id
                await _broadcast_presence(session_id)

            if event.type == "card.select" and event.name:
                actor = event.username or event.persona_name or event.name or ""
                await _broadcast_notification(f"выбрал карточку: {event.name}", session_id, actor)

            if event.type == "notification" and event.content:
                await _broadcast_notification(event.content, session_id, event.username or event.persona_name or event.name or "")

            if event.type == "message.send" and event.participant_id and event.content:
                message = session_service.add_message(
                    session_id,
                    SendMessageRequest(participant_id=event.participant_id, content=event.content),
                )
                await connection_manager.broadcast(
                    session_id,
                    {"type": "session.updated", "session": session_service.snapshot(session_id), "message": message.model_dump(mode="json")},
                )
    except WebSocketDisconnect:
        if participant_id:
            session_service.disconnect_participant(session_id, participant_id)
            await _broadcast_presence(session_id)
    finally:
        connection_manager.disconnect(session_id, websocket)


frontend_dist = PROJECT_ROOT / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
