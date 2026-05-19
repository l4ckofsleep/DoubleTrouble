from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class SourceDefinition:
    """Static description of a Chat Completion source."""

    id: str
    label: str
    default_base_url: str
    adapter: str = "openai"
    """Which low-level adapter handles requests: 'openai', 'anthropic', 'google_ai_studio'."""

    requires_api_key: bool = True
    supports_reverse_proxy: bool = False
    """Whether a user-supplied reverse proxy URL replaces the default base URL."""

    custom_url_field: bool = False
    """If True (custom source), the user must supply the base URL themselves."""

    extra_field_keys: tuple[str, ...] = ()
    """Keys of additional per-source settings shown in the UI."""

    extra_param_keys: tuple[str, ...] = ()
    """Keys of optional generation parameters merged into the request body."""

    api_key_env: str = ""
    """Environment variable used for the API key (fallback)."""

    secret_key_name: str = ""
    """SecretStore key used to read/write the API key."""

    extra_headers: dict[str, str] = field(default_factory=dict)


SOURCES: dict[str, SourceDefinition] = {
    "openai": SourceDefinition(
        id="openai",
        label="OpenAI",
        default_base_url="https://api.openai.com/v1",
        supports_reverse_proxy=True,
        extra_param_keys=("top_p", "frequency_penalty", "presence_penalty", "seed", "reasoning_effort", "verbosity"),
        api_key_env="OPENAI_API_KEY",
        secret_key_name="provider_api_key_openai",
    ),
    "claude": SourceDefinition(
        id="claude",
        label="Claude (Anthropic)",
        default_base_url="https://api.anthropic.com/v1",
        adapter="anthropic",
        supports_reverse_proxy=True,
        extra_param_keys=("top_p", "top_k"),
        api_key_env="ANTHROPIC_API_KEY",
        secret_key_name="provider_api_key_claude",
    ),
    "openrouter": SourceDefinition(
        id="openrouter",
        label="OpenRouter",
        default_base_url="https://openrouter.ai/api/v1",
        extra_field_keys=("openrouter_providers", "openrouter_quantizations", "openrouter_middleout", "openrouter_use_fallback"),
        extra_param_keys=("top_p", "top_k", "min_p", "top_a", "repetition_penalty", "frequency_penalty", "presence_penalty"),
        api_key_env="OPENROUTER_API_KEY",
        secret_key_name="provider_api_key_openrouter",
        extra_headers={"HTTP-Referer": "https://github.com/l4ckofsleep/DoubleTrouble", "X-Title": "DoubleTrouble"},
    ),
    "ai21": SourceDefinition(
        id="ai21",
        label="AI21",
        default_base_url="https://api.ai21.com/studio/v1",
        extra_param_keys=("top_p",),
        api_key_env="AI21_API_KEY",
        secret_key_name="provider_api_key_ai21",
    ),
    "makersuite": SourceDefinition(
        id="makersuite",
        label="Google AI Studio (Gemini)",
        default_base_url="https://generativelanguage.googleapis.com",
        adapter="google_ai_studio",
        supports_reverse_proxy=True,
        extra_field_keys=("google_safety_off", "google_use_sysprompt"),
        extra_param_keys=("top_p", "top_k", "thinking_budget"),
        api_key_env="GOOGLE_API_KEY",
        secret_key_name="provider_api_key_makersuite",
    ),
    "vertexai": SourceDefinition(
        id="vertexai",
        label="Google Vertex AI",
        default_base_url="https://us-central1-aiplatform.googleapis.com",
        adapter="google_ai_studio",
        extra_field_keys=("vertexai_region", "vertexai_express_project_id", "vertexai_auth_mode"),
        extra_param_keys=("top_p", "top_k", "thinking_budget"),
        api_key_env="GOOGLE_API_KEY",
        secret_key_name="provider_api_key_vertexai",
    ),
    "mistralai": SourceDefinition(
        id="mistralai",
        label="MistralAI",
        default_base_url="https://api.mistral.ai/v1",
        supports_reverse_proxy=True,
        extra_param_keys=("top_p",),
        api_key_env="MISTRAL_API_KEY",
        secret_key_name="provider_api_key_mistralai",
    ),
    "custom": SourceDefinition(
        id="custom",
        label="Custom (OpenAI-compatible)",
        default_base_url="",
        custom_url_field=True,
        extra_field_keys=("custom_include_headers", "custom_include_body", "custom_exclude_body"),
        extra_param_keys=("top_p", "top_k", "min_p", "top_a", "repetition_penalty", "frequency_penalty", "presence_penalty", "seed"),
        api_key_env="DOUBLE_TROUBLE_API_KEY",
        secret_key_name="provider_api_key_custom",
    ),
    "cohere": SourceDefinition(
        id="cohere",
        label="Cohere",
        default_base_url="https://api.cohere.ai/v2",
        extra_param_keys=("top_p", "top_k", "frequency_penalty", "presence_penalty"),
        api_key_env="COHERE_API_KEY",
        secret_key_name="provider_api_key_cohere",
    ),
    "perplexity": SourceDefinition(
        id="perplexity",
        label="Perplexity",
        default_base_url="https://api.perplexity.ai",
        extra_param_keys=("top_p", "top_k", "frequency_penalty", "presence_penalty"),
        api_key_env="PERPLEXITY_API_KEY",
        secret_key_name="provider_api_key_perplexity",
    ),
    "groq": SourceDefinition(
        id="groq",
        label="Groq",
        default_base_url="https://api.groq.com/openai/v1",
        extra_param_keys=("top_p", "frequency_penalty", "presence_penalty"),
        api_key_env="GROQ_API_KEY",
        secret_key_name="provider_api_key_groq",
    ),
    "electronhub": SourceDefinition(
        id="electronhub",
        label="Electron Hub",
        default_base_url="https://api.electronhub.ai/v1",
        extra_param_keys=("top_p", "frequency_penalty", "presence_penalty"),
        api_key_env="ELECTRONHUB_API_KEY",
        secret_key_name="provider_api_key_electronhub",
    ),
    "chutes": SourceDefinition(
        id="chutes",
        label="Chutes",
        default_base_url="https://llm.chutes.ai/v1",
        extra_param_keys=("top_p", "top_k", "min_p", "repetition_penalty"),
        api_key_env="CHUTES_API_KEY",
        secret_key_name="provider_api_key_chutes",
    ),
    "nanogpt": SourceDefinition(
        id="nanogpt",
        label="NanoGPT",
        default_base_url="https://nano-gpt.com/api/v1",
        extra_param_keys=("top_p", "top_k", "min_p", "repetition_penalty"),
        api_key_env="NANOGPT_API_KEY",
        secret_key_name="provider_api_key_nanogpt",
    ),
    "deepseek": SourceDefinition(
        id="deepseek",
        label="DeepSeek",
        default_base_url="https://api.deepseek.com",
        supports_reverse_proxy=True,
        extra_param_keys=("top_p", "frequency_penalty", "presence_penalty"),
        api_key_env="DEEPSEEK_API_KEY",
        secret_key_name="provider_api_key_deepseek",
    ),
    "aimlapi": SourceDefinition(
        id="aimlapi",
        label="AI/ML API",
        default_base_url="https://api.aimlapi.com/v1",
        extra_param_keys=("top_p", "top_k", "min_p", "frequency_penalty", "presence_penalty"),
        api_key_env="AIMLAPI_API_KEY",
        secret_key_name="provider_api_key_aimlapi",
    ),
    "xai": SourceDefinition(
        id="xai",
        label="xAI (Grok)",
        default_base_url="https://api.x.ai/v1",
        supports_reverse_proxy=True,
        extra_param_keys=("top_p", "frequency_penalty", "presence_penalty", "reasoning_effort"),
        api_key_env="XAI_API_KEY",
        secret_key_name="provider_api_key_xai",
    ),
    "pollinations": SourceDefinition(
        id="pollinations",
        label="Pollinations",
        default_base_url="https://gen.pollinations.ai/v1",
        requires_api_key=False,
        extra_param_keys=("top_p", "frequency_penalty", "presence_penalty"),
        api_key_env="POLLINATIONS_API_KEY",
        secret_key_name="provider_api_key_pollinations",
    ),
    "moonshot": SourceDefinition(
        id="moonshot",
        label="Moonshot AI",
        default_base_url="https://api.moonshot.ai/v1",
        supports_reverse_proxy=True,
        extra_param_keys=("top_p", "frequency_penalty", "presence_penalty"),
        api_key_env="MOONSHOT_API_KEY",
        secret_key_name="provider_api_key_moonshot",
    ),
    "fireworks": SourceDefinition(
        id="fireworks",
        label="Fireworks AI",
        default_base_url="https://api.fireworks.ai/inference/v1",
        extra_param_keys=("top_p", "top_k", "min_p", "frequency_penalty", "presence_penalty"),
        api_key_env="FIREWORKS_API_KEY",
        secret_key_name="provider_api_key_fireworks",
    ),
    "cometapi": SourceDefinition(
        id="cometapi",
        label="CometAPI",
        default_base_url="https://api.cometapi.com/v1",
        extra_param_keys=("top_p", "frequency_penalty", "presence_penalty"),
        api_key_env="COMETAPI_API_KEY",
        secret_key_name="provider_api_key_cometapi",
    ),
    "azure_openai": SourceDefinition(
        id="azure_openai",
        label="Azure OpenAI",
        default_base_url="",
        extra_field_keys=("azure_base_url", "azure_deployment_name", "azure_api_version"),
        extra_param_keys=("top_p", "frequency_penalty", "presence_penalty"),
        api_key_env="AZURE_OPENAI_API_KEY",
        secret_key_name="provider_api_key_azure_openai",
    ),
    "zai": SourceDefinition(
        id="zai",
        label="Z.AI (GLM)",
        default_base_url="https://api.z.ai/api/paas/v4",
        extra_field_keys=("zai_endpoint",),
        extra_param_keys=("top_p", "top_k"),
        api_key_env="ZAI_API_KEY",
        secret_key_name="provider_api_key_zai",
    ),
    "siliconflow": SourceDefinition(
        id="siliconflow",
        label="SiliconFlow",
        default_base_url="https://api.siliconflow.com/v1",
        extra_field_keys=("siliconflow_endpoint",),
        extra_param_keys=("top_p", "top_k", "frequency_penalty"),
        api_key_env="SILICONFLOW_API_KEY",
        secret_key_name="provider_api_key_siliconflow",
    ),
    "workers_ai": SourceDefinition(
        id="workers_ai",
        label="Cloudflare Workers AI",
        default_base_url="https://api.cloudflare.com/client/v4/accounts",
        extra_field_keys=("workers_ai_account_id",),
        extra_param_keys=("top_p", "top_k", "frequency_penalty", "presence_penalty"),
        api_key_env="CLOUDFLARE_API_KEY",
        secret_key_name="provider_api_key_workers_ai",
    ),
    "minimax": SourceDefinition(
        id="minimax",
        label="MiniMax",
        default_base_url="https://api.minimax.io/v1",
        extra_field_keys=("minimax_endpoint",),
        extra_param_keys=("top_p", "top_k", "frequency_penalty", "presence_penalty"),
        api_key_env="MINIMAX_API_KEY",
        secret_key_name="provider_api_key_minimax",
    ),
}


ORDER: tuple[str, ...] = (
    "openai",
    "claude",
    "openrouter",
    "ai21",
    "makersuite",
    "vertexai",
    "mistralai",
    "custom",
    "cohere",
    "perplexity",
    "groq",
    "electronhub",
    "chutes",
    "nanogpt",
    "deepseek",
    "aimlapi",
    "xai",
    "pollinations",
    "moonshot",
    "fireworks",
    "cometapi",
    "azure_openai",
    "zai",
    "siliconflow",
    "workers_ai",
    "minimax",
)


LEGACY_PROVIDER_TO_SOURCE: dict[str, str] = {
    "openai_compatible": "custom",
    "lm_studio": "custom",
    "ollama_openai": "custom",
    "vllm": "custom",
    "tabby": "custom",
    "aphrodite": "custom",
    "textgen_webui": "custom",
    "koboldcpp": "custom",
    "mistral_proxy": "mistralai",
    "claude_proxy": "claude",
    "google_proxy": "makersuite",
}


def resolve_source_id(provider_or_source: str) -> str:
    if not provider_or_source:
        return ""
    key = provider_or_source.strip().lower()
    if key == "disabled":
        return "disabled"
    if key in SOURCES:
        return key
    if key in LEGACY_PROVIDER_TO_SOURCE:
        return LEGACY_PROVIDER_TO_SOURCE[key]
    return key


def get_source(source_id: str) -> SourceDefinition | None:
    return SOURCES.get(source_id)


def build_provider(
    source_id: str,
    *,
    base_url: str,
    api_key: str,
    timeout_seconds: float,
    extra_settings: dict[str, Any] | None = None,
    reverse_proxy: str = "",
    proxy_password: str = "",
):
    """Construct the low-level provider for the given source."""
    from backend.app.llm.anthropic import AnthropicProvider
    from backend.app.llm.google_ai_studio import GoogleAIStudioProvider
    from backend.app.llm.openai_compatible import OpenAICompatibleProvider

    source = SOURCES.get(source_id)
    if source is None:
        # Fallback: treat unknown source as OpenAI-compatible.
        return OpenAICompatibleProvider(
            base_url=base_url,
            api_key=api_key,
            timeout_seconds=timeout_seconds,
        )

    settings = dict(extra_settings or {})
    effective_base_url = base_url.strip().rstrip("/") or source.default_base_url
    effective_api_key = api_key

    if source.supports_reverse_proxy and reverse_proxy.strip():
        effective_base_url = reverse_proxy.strip().rstrip("/")
        if proxy_password.strip():
            effective_api_key = proxy_password.strip()

    if source.adapter == "anthropic":
        return AnthropicProvider(
            base_url=effective_base_url,
            api_key=effective_api_key,
            timeout_seconds=timeout_seconds,
        )

    if source.adapter == "google_ai_studio":
        default_parameters: dict[str, Any] = {}
        if "google_safety_off" in settings:
            default_parameters["google_safety_off"] = settings["google_safety_off"]
        if "google_use_sysprompt" in settings:
            default_parameters["google_use_sysprompt"] = settings["google_use_sysprompt"]
        if "thinking_budget" in settings and settings["thinking_budget"] not in ("", None):
            default_parameters["thinking_budget"] = settings["thinking_budget"]
        return GoogleAIStudioProvider(
            base_url=effective_base_url,
            api_key=effective_api_key,
            timeout_seconds=timeout_seconds,
            default_parameters=default_parameters,
        )

    chat_path = "/chat/completions"
    models_path = "/models"
    extra_headers = dict(source.extra_headers)
    extra_query: dict[str, str] = {}
    extra_body: dict[str, Any] = {}
    auth_header = "Authorization"
    auth_format = "Bearer {api_key}"
    send_auth = True

    if source.id == "azure_openai":
        azure_base = str(settings.get("azure_base_url", "")).strip().rstrip("/")
        deployment = str(settings.get("azure_deployment_name", "")).strip()
        api_version = str(settings.get("azure_api_version", "2024-02-15-preview")).strip()
        if azure_base:
            effective_base_url = azure_base
        if deployment:
            chat_path = f"/openai/deployments/{deployment}/chat/completions"
            models_path = f"/openai/deployments/{deployment}/completions"
        if api_version:
            extra_query["api-version"] = api_version
        auth_header = "api-key"
        auth_format = "{api_key}"
    elif source.id == "siliconflow":
        endpoint = str(settings.get("siliconflow_endpoint", "global")).strip().lower()
        if endpoint == "cn":
            effective_base_url = "https://api.siliconflow.cn/v1"
    elif source.id == "zai":
        endpoint = str(settings.get("zai_endpoint", "common")).strip().lower()
        if endpoint == "coding":
            effective_base_url = "https://api.z.ai/api/coding/paas/v4"
    elif source.id == "minimax":
        endpoint = str(settings.get("minimax_endpoint", "global")).strip().lower()
        if endpoint == "cn":
            effective_base_url = "https://api.minimaxi.com/v1"
    elif source.id == "workers_ai":
        account_id = str(settings.get("workers_ai_account_id", "")).strip()
        if account_id:
            effective_base_url = f"{source.default_base_url}/{account_id}/ai/v1"
    elif source.id == "custom":
        include_headers_yaml = settings.get("custom_include_headers")
        if isinstance(include_headers_yaml, str) and include_headers_yaml.strip():
            extra_headers.update(_parse_yaml_dict(include_headers_yaml))
        include_body = settings.get("custom_include_body")
        if isinstance(include_body, str) and include_body.strip():
            extra_body.update(_parse_yaml_dict(include_body))
        exclude_body = settings.get("custom_exclude_body")
        if isinstance(exclude_body, str) and exclude_body.strip():
            exclude_list = [item.strip() for item in exclude_body.splitlines() if item.strip()]
            if exclude_list:
                extra_body["__exclude_body_keys"] = exclude_list
    elif source.id == "deepseek":
        # Default is /chat/completions on api.deepseek.com (beta enables some features but optional)
        pass

    return OpenAICompatibleProvider(
        base_url=effective_base_url,
        api_key=effective_api_key,
        timeout_seconds=timeout_seconds,
        chat_path=chat_path,
        models_path=models_path,
        extra_headers=extra_headers,
        extra_query=extra_query,
        extra_body=extra_body,
        auth_header=auth_header,
        auth_format=auth_format,
        send_auth=send_auth and bool(effective_api_key),
    )


def _parse_yaml_dict(text: str) -> dict[str, Any]:
    try:
        import yaml  # type: ignore

        data = yaml.safe_load(text)
        if isinstance(data, dict):
            return {str(key): value for key, value in data.items()}
    except Exception:
        pass
    return {}


def list_sources_payload() -> list[dict[str, Any]]:
    """JSON-serializable list of sources for the UI."""
    payload: list[dict[str, Any]] = []
    for source_id in ORDER:
        source = SOURCES[source_id]
        payload.append(
            {
                "id": source.id,
                "label": source.label,
                "default_base_url": source.default_base_url,
                "adapter": source.adapter,
                "requires_api_key": source.requires_api_key,
                "supports_reverse_proxy": source.supports_reverse_proxy,
                "custom_url_field": source.custom_url_field,
                "extra_field_keys": list(source.extra_field_keys),
                "extra_param_keys": list(source.extra_param_keys),
                "secret_key_name": source.secret_key_name,
                "api_key_env": source.api_key_env,
            }
        )
    return payload
