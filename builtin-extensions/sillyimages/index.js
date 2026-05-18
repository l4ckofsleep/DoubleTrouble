/**
 * SillyImages extension for SillyTavern
 *
 * Catches [IMG:GEN:{json}] tags in AI messages and generates images via configured API.
 * Supports OpenAI-compatible and Gemini-compatible (nano-banana) endpoints.
 */

const MODULE_NAME = 'sillyimages';
const LEGACY_MODULE_NAMES = ['inline_image_gen', 'inlineImageGeneration', 'iig'];

// Track messages currently being processed to prevent duplicate processing
const processingMessages = new Set();
const processingControllers = new Map();

// Log buffer for debugging
const logBuffer = [];
const MAX_LOG_ENTRIES = 200;

function iigLog(level, ...args) {
    const timestamp = new Date().toISOString();
    const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    const entry = `[${timestamp}] [${level}] ${message}`;

    logBuffer.push(entry);
    if (logBuffer.length > MAX_LOG_ENTRIES) {
        logBuffer.shift();
    }

    if (level === 'ERROR') {
        console.error('[IIG]', ...args);
    } else if (level === 'WARN') {
        console.warn('[IIG]', ...args);
    } else {
        console.log('[IIG]', ...args);
    }
}

function isGenerationCancelled(error) {
    const message = String(error?.message || '').toLowerCase();
    return error?.name === 'AbortError' || message.includes('abort') || message.includes('cancel');
}

function cancelMessageImageGeneration(messageId) {
    const controller = processingControllers.get(messageId);
    if (!controller || controller.signal.aborted) {
        return false;
    }
    controller.abort();
    document.querySelector(`#chat .mes[mesid="${messageId}"]`)?.classList.remove('iig-local-pending');
    toastr.info('Генерация картинки отменяется...', 'Генерация картинок', { timeOut: 2000 });
    return true;
}

function notifyDoubleTroubleImagePending(messageId, pending) {
    window.dispatchEvent(new CustomEvent('doubletrouble:iig-pending', { detail: { messageIndex: messageId, pending } }));
}

function resolveCancelMessageIndex(detail) {
    const byIndex = Number(detail?.messageIndex);
    if (Number.isInteger(byIndex)) {
        return byIndex;
    }

    const messageId = String(detail?.messageId || '');
    if (!messageId) {
        return -1;
    }

    const context = window.SillyTavern?.getContext?.();
    const chat = Array.isArray(context?.chat) ? context.chat : [];
    return chat.findIndex(message => message?.dt_message_id === messageId);
}

window.addEventListener('doubletrouble:iig-cancel', (event) => {
    const messageId = resolveCancelMessageIndex(event?.detail);
    if (messageId >= 0) {
        cancelMessageImageGeneration(messageId);
    }
});

window.DoubleTroubleIIG = {
    ...(window.DoubleTroubleIIG || {}),
    cancelMessageImageGeneration: (messageIndex, messageId) => {
        const resolvedIndex = resolveCancelMessageIndex({ messageIndex, messageId });
        return resolvedIndex >= 0 ? cancelMessageImageGeneration(resolvedIndex) : false;
    },
};

function exportLogs() {
    const logsText = logBuffer.join('\n');
    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iig-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toastr.success('Логи экспортированы', 'Генерация картинок');
}

// Default settings
const defaultSettings = Object.freeze({
    enabled: true,
    externalBlocks: false,
    imageContextEnabled: false,
    imageContextCount: 1,
    styles: [],
    activeStyleId: '',
    apiType: 'openai', // 'openai' | 'gemini' | 'naistera'
    endpoint: '',
    apiKey: '',
    model: '',
    size: '1024x1024',
    quality: 'standard',
    maxRetries: 0, // No auto-retry - user clicks error image to retry manually
    retryDelay: 1000,
    // Nano-banana specific
    sendCharAvatar: false,
    sendUserAvatar: false,
    useActiveUserPersonaAvatar: false,
    userAvatarFile: '', // Selected user avatar filename from /User Avatars/
    aspectRatio: '1:1', // "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"
    imageSize: '1K', // "1K", "2K", "4K"
    // Naistera specific
    naisteraAspectRatio: '1:1',
    naisteraModel: 'grok', // 'grok' | 'grok-pro' | 'nano banana 2' | 'novelai'
    naisteraSendCharAvatar: false,
    naisteraSendUserAvatar: false,
    naisteraVideoTest: false,
    naisteraVideoEveryN: 1,
    additionalReferences: [],
});

const MAX_CONTEXT_IMAGES = 3;
const MAX_GENERATION_REFERENCE_IMAGES = 5;
const MAX_ADDITIONAL_REFERENCES = 8;
const PERSONAS_MODULE_PATHS = Object.freeze([
    '/scripts/personas.js',
    '../../../personas.js',
]);

let personasModulePromise = null;
let cachedUserAvatars = [];

// Image model detection keywords (from your api_client.py)
const IMAGE_MODEL_KEYWORDS = [
    'dall-e', 'midjourney', 'mj', 'journey', 'stable-diffusion', 'sdxl', 'flux',
    'imagen', 'drawing', 'paint', 'image', 'seedream', 'hidream', 'dreamshaper',
    'ideogram', 'nano-banana', 'gpt-image', 'wanx', 'qwen'
];

// Video model keywords to exclude
const VIDEO_MODEL_KEYWORDS = [
    'sora', 'kling', 'jimeng', 'veo', 'pika', 'runway', 'luma',
    'video', 'gen-3', 'minimax', 'cogvideo', 'mochi', 'seedance',
    'vidu', 'wan-ai', 'hunyuan', 'hailuo'
];

// We'll parse tags manually since JSON can contain nested braces
// Tag format: [IMG:GEN:{...json...}] or <img src="[IMG:GEN:{...json...}]">

/**
 * Check if model ID is an image generation model
 */
function isImageModel(modelId) {
    const mid = modelId.toLowerCase();

    // Exclude video models
    for (const kw of VIDEO_MODEL_KEYWORDS) {
        if (mid.includes(kw)) return false;
    }

    // Exclude vision models
    if (mid.includes('vision') && mid.includes('preview')) return false;

    // Check for image model keywords
    for (const kw of IMAGE_MODEL_KEYWORDS) {
        if (mid.includes(kw)) return true;
    }

    return false;
}

/**
 * Check if model is Gemini/nano-banana type
 */
function isGeminiModel(modelId) {
    const mid = modelId.toLowerCase();
    return mid.includes('nano-banana');
}

const NAISTERA_MODELS = Object.freeze(['grok', 'grok-pro', 'nano banana 2', 'novelai']);
const DEFAULT_ENDPOINTS = Object.freeze({
    naistera: 'https://naistera.org',
});
const ENDPOINT_PLACEHOLDERS = Object.freeze({
    openai: 'https://api.openai.com',
    gemini: 'https://generativelanguage.googleapis.com',
    naistera: 'https://naistera.org',
});

function normalizeNaisteraModel(model) {
    const raw = String(model || '').trim().toLowerCase();
    if (!raw) return 'grok';
    if (raw === 'grok pro') return 'grok-pro';
    if (raw === 'grok-pro') return 'grok-pro';
    if (raw === 'grok-imagine-pro') return 'grok-pro';
    if (raw === 'imagine-pro') return 'grok-pro';
    if (raw === 'nano-banana') return 'nano banana 2';
    if (raw === 'nano banana') return 'nano banana 2';
    // Legacy value migration: map removed "nano banana pro" to "nano banana 2".
    if (raw === 'nano-banana-pro') return 'nano banana 2';
    if (raw === 'nano banana pro') return 'nano banana 2';
    if (raw === 'nano-banana-2') return 'nano banana 2';
    if (raw === 'nano banana 2') return 'nano banana 2';
    if (raw === 'novel ai') return 'novelai';
    if (raw === 'novelai') return 'novelai';
    if (NAISTERA_MODELS.includes(raw)) return raw;
    return 'grok';
}

function naisteraModelSupportsReferences(model) {
    const normalized = normalizeNaisteraModel(model);
    return normalized !== 'novelai' && normalized !== 'grok-pro';
}

function shouldUseNaisteraVideoTest(model) {
    const normalized = normalizeNaisteraModel(model);
    return normalized === 'grok' || normalized === 'grok-pro' || normalized.startsWith('nano banana');
}

function normalizeNaisteraVideoFrequency(value) {
    const numeric = Number.parseInt(String(value ?? '').trim(), 10);
    if (!Number.isFinite(numeric) || numeric < 1) return 1;
    return Math.min(numeric, 999);
}

function normalizeImageContextCount(value) {
    const numeric = Number.parseInt(String(value ?? '').trim(), 10);
    if (!Number.isFinite(numeric) || numeric < 1) return 1;
    return Math.min(numeric, MAX_CONTEXT_IMAGES);
}

function getAssistantMessageOrdinal(messageId) {
    const context = SillyTavern.getContext();
    const chat = Array.isArray(context?.chat) ? context.chat : [];
    let ordinal = 0;
    for (let i = 0; i < chat.length; i++) {
        const message = chat[i];
        if (!message || message.is_user || message.is_system) {
            continue;
        }
        ordinal += 1;
        if (i === messageId) {
            return ordinal;
        }
    }
    return Math.max(1, messageId + 1);
}

function shouldTriggerNaisteraVideoForMessage(messageId, everyN) {
    const normalizedEveryN = normalizeNaisteraVideoFrequency(everyN);
    if (normalizedEveryN <= 1) return true;
    const ordinal = getAssistantMessageOrdinal(messageId);
    return ordinal % normalizedEveryN === 0;
}

function getEndpointPlaceholder(apiType) {
    return ENDPOINT_PLACEHOLDERS[apiType] || 'https://api.example.com';
}

function normalizeConfiguredEndpoint(apiType, endpoint) {
    const trimmed = String(endpoint || '').trim().replace(/\/+$/, '');
    if (!trimmed) {
        return apiType === 'naistera' ? DEFAULT_ENDPOINTS.naistera : '';
    }
    if (apiType === 'naistera') {
        return trimmed.replace(/\/api\/generate$/i, '');
    }
    return trimmed;
}

function shouldReplaceEndpointForApiType(apiType, endpoint) {
    const trimmed = String(endpoint || '').trim();
    if (!trimmed) return true;
    if (apiType !== 'naistera') return false;
    return /\/v1\/images\/generations\/?$/i.test(trimmed)
        || /\/v1\/models\/?$/i.test(trimmed)
        || /\/v1beta\/models\//i.test(trimmed);
}

function getEffectiveEndpoint(settings = getSettings()) {
    return normalizeConfiguredEndpoint(settings.apiType, settings.endpoint);
}

/**
 * Get extension settings
 */
function getSettings() {
    const context = SillyTavern.getContext();

    if (!context.extensionSettings[MODULE_NAME]) {
        const legacySettings = LEGACY_MODULE_NAMES.map(name => context.extensionSettings[name]).find(settings => settings && typeof settings === 'object');
        context.extensionSettings[MODULE_NAME] = { ...structuredClone(defaultSettings), ...(legacySettings || {}) };
    }

    // Ensure all default keys exist
    for (const key of Object.keys(defaultSettings)) {
        if (!Object.hasOwn(context.extensionSettings[MODULE_NAME], key)) {
            context.extensionSettings[MODULE_NAME][key] = defaultSettings[key];
        }
    }

    return context.extensionSettings[MODULE_NAME];
}

/**
 * Save settings
 */
function saveSettings() {
    const context = SillyTavern.getContext();
    context.saveSettingsDebounced();
}

function ensureStyles(settings = getSettings()) {
    if (!Array.isArray(settings.styles)) {
        const migratedPresets = Array.isArray(settings.stylePresets) ? settings.stylePresets : [];
        settings.styles = migratedPresets.map((preset) => ({
            id: String(preset?.id || `iig-style-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
            name: String(preset?.name || '').trim(),
            value: String(preset?.style || '').trim(),
        }));
    }

    settings.styles = settings.styles.map((style, index) => ({
        id: String(style?.id || `iig-style-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`),
        name: String(style?.name || `Стиль ${index + 1}`).trim() || `Стиль ${index + 1}`,
        value: String(style?.value ?? style?.style ?? '').trim(),
    }));

    if (!settings.styles.some((style) => style.id === settings.activeStyleId)) {
        settings.activeStyleId = '';
    }

    return settings.styles;
}

function createStyle(name = '') {
    const settings = getSettings();
    const styles = ensureStyles(settings);
    const style = {
        id: `iig-style-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: String(name || '').trim() || `Стиль ${styles.length + 1}`,
        value: '',
    };
    styles.push(style);
    settings.activeStyleId = style.id;
    return style;
}

function getActiveStyle(settings = getSettings()) {
    const styles = ensureStyles(settings);
    return styles.find((style) => style.id === settings.activeStyleId) || null;
}

function updateStyle(styleId, patch) {
    const settings = getSettings();
    const style = ensureStyles(settings).find((item) => item.id === styleId);
    if (!style) {
        return null;
    }

    if (Object.hasOwn(patch, 'name')) {
        style.name = String(patch.name || '').trim() || style.name;
    }
    if (Object.hasOwn(patch, 'value')) {
        style.value = String(patch.value || '').trim();
    }

    return style;
}

function removeStyle(styleId) {
    const settings = getSettings();
    const styles = ensureStyles(settings);
    const index = styles.findIndex((item) => item.id === styleId);
    if (index === -1) {
        return false;
    }

    styles.splice(index, 1);
    if (settings.activeStyleId === styleId) {
        settings.activeStyleId = styles[0]?.id || '';
    }
    return true;
}

function ensureAdditionalReferencesArray(settings = getSettings()) {
    if (!Array.isArray(settings.additionalReferences)) {
        settings.additionalReferences = [];
    }

    settings.additionalReferences = settings.additionalReferences
        .slice(0, MAX_ADDITIONAL_REFERENCES)
        .map((ref) => ({
            name: String(ref?.name || '').trim(),
            description: String(ref?.description || '').trim(),
            imagePath: String(ref?.imagePath || '').trim(),
            matchMode: ref?.matchMode === 'always' ? 'always' : 'match',
            enabled: ref?.enabled !== false,
        }));

    return settings.additionalReferences;
}

function getMessageRenderText(message, settings = getSettings()) {
    if (!message) return '';
    if (settings.externalBlocks && message.extra?.display_text) {
        return message.extra.display_text;
    }
    return message.mes || '';
}

async function parseMessageImageTags(message, options = {}) {
    const settings = getSettings();
    const tags = [];

    const mainTags = await parseImageTags(message?.mes || '', options);
    tags.push(...mainTags.map(tag => ({ ...tag, sourceKey: 'mes' })));

    if (settings.externalBlocks && message?.extra?.extblocks) {
        const extTags = await parseImageTags(message.extra.extblocks, options);
        tags.push(...extTags.map(tag => ({ ...tag, sourceKey: 'extblocks' })));
    }

    return tags;
}

function replaceTagInMessageSource(message, tag, replacement) {
    if (!message || !tag) return;

    if (tag.sourceKey === 'extblocks') {
        if (!message.extra) message.extra = {};
        message.extra.extblocks = (message.extra.extblocks || '').replace(tag.fullMatch, replacement);

        const swipeId = message.swipe_id;
        if (swipeId !== undefined && message.swipe_info?.[swipeId]?.extra?.extblocks) {
            message.swipe_info[swipeId].extra.extblocks =
                message.swipe_info[swipeId].extra.extblocks.replace(tag.fullMatch, replacement);
        }

        if (message.extra.display_text) {
            message.extra.display_text = message.extra.display_text.replace(tag.fullMatch, replacement);
        }
        return;
    }

    message.mes = (message.mes || '').replace(tag.fullMatch, replacement);
    if (message.extra?.display_text) {
        message.extra.display_text = message.extra.display_text.replace(tag.fullMatch, replacement);
    }
}

function extractGeneratedImageUrlsFromText(text) {
    const urls = [];
    const seen = new Set();
    const rawText = String(text || '');

    const legacyMatches = Array.from(rawText.matchAll(/\[IMG:✓:([^\]]+)\]/g));
    for (let i = legacyMatches.length - 1; i >= 0; i--) {
        const src = String(legacyMatches[i][1] || '').trim();
        if (!src || seen.has(src)) continue;
        seen.add(src);
        urls.push(src);
    }

    if (!rawText.includes('<img')) {
        return urls;
    }

    const template = document.createElement('template');
    template.innerHTML = rawText;
    const imageNodes = Array.from(
        template.content.querySelectorAll('img[data-iig-instruction], video[data-iig-instruction]')
    ).reverse();
    for (const node of imageNodes) {
        const src = String(node.getAttribute('src') || '').trim();
        if (
            !src ||
            src.startsWith('data:') ||
            src.includes('[IMG:') ||
            src.includes('[VID:') ||
            src.endsWith('/error.svg') ||
            seen.has(src)
        ) {
            continue;
        }
        seen.add(src);
        urls.push(src);
    }

    return urls;
}

function normalizeStoredImagePath(path) {
    const raw = String(path || '').trim();
    if (!raw) return '';
    if (raw.startsWith('data:')) return raw;
    if (/^(?:https?:)?\/\//i.test(raw)) return raw;
    return raw.startsWith('/') ? raw : `/${raw.replace(/^\/+/, '')}`;
}

function escapeRegex(text) {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeReferenceTriggerText(text) {
    return String(text || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function promptContainsReferenceName(prompt, name) {
    const normalizedPrompt = normalizeReferenceTriggerText(prompt);
    const normalizedName = normalizeReferenceTriggerText(name);

    if (!normalizedPrompt || !normalizedName) {
        return false;
    }

    const pattern = escapeRegex(normalizedName).replace(/\s+/g, '\\s+');
    try {
        const regex = new RegExp(`(^|[^\\p{L}\\p{N}_])${pattern}(?=$|[^\\p{L}\\p{N}_])`, 'iu');
        return regex.test(normalizedPrompt);
    } catch (_error) {
        return normalizedPrompt.includes(normalizedName);
    }
}

function parseReferenceAliases(name) {
    return String(name || '')
        .split(',')
        .map((alias) => normalizeReferenceTriggerText(alias))
        .filter(Boolean);
}

const STYLE_BLOCK_RE = /\[\s*style\s*:\s*[^\]]*\]/gi;

function injectStyleBlock(prompt, styleValue) {
    const normalizedPrompt = String(prompt || '').trim();
    const normalizedStyle = String(styleValue || '').trim();
    if (!normalizedStyle) {
        return normalizedPrompt;
    }

    const styleBlock = `[STYLE: ${normalizedStyle}]`;
    if (!normalizedPrompt) {
        return styleBlock;
    }

    STYLE_BLOCK_RE.lastIndex = 0;
    if (STYLE_BLOCK_RE.test(normalizedPrompt)) {
        STYLE_BLOCK_RE.lastIndex = 0;
        let replacedFirst = false;
        return normalizedPrompt.replace(STYLE_BLOCK_RE, () => {
            if (replacedFirst) {
                return '';
            }
            replacedFirst = true;
            return styleBlock;
        }).trim();
    }

    return `${styleBlock}\n\n${normalizedPrompt}`.trim();
}

function resolveEffectiveStyle(tagStyle = '', settings = getSettings()) {
    const activeStyle = getActiveStyle(settings);
    const extensionStyleValue = String(activeStyle?.value || '').trim();
    const originalStyle = String(tagStyle || '').trim();
    return extensionStyleValue || originalStyle;
}

function buildAdditionalReferencesPromptBlock(matchedRefs = []) {
    const items = matchedRefs
        .map((ref) => String(ref?.description || ref?.name || '').trim())
        .filter(Boolean);

    if (items.length === 0) {
        return '';
    }

    return `Additional References:\n${items.map((item) => `- ${item}`).join('\n')}`;
}

function buildFinalGenerationPrompt(prompt, style, matchedAdditionalRefs = [], settings = getSettings()) {
    const effectiveStyle = resolveEffectiveStyle(style, settings);
    let fullPrompt = injectStyleBlock(prompt, effectiveStyle);

    const additionalReferencesBlock = buildAdditionalReferencesPromptBlock(matchedAdditionalRefs);
    if (additionalReferencesBlock) {
        fullPrompt = `${fullPrompt}\n\n${additionalReferencesBlock}`.trim();
    }

    return fullPrompt;
}

function getMatchedAdditionalReferences(prompt) {
    const refs = ensureAdditionalReferencesArray()
        .map((ref) => ({
            name: String(ref?.name || '').trim(),
            description: String(ref?.description || '').trim(),
            imagePath: normalizeStoredImagePath(ref?.imagePath || ''),
            matchMode: ref?.matchMode === 'always' ? 'always' : 'match',
            enabled: ref?.enabled !== false,
        }))
        .filter((ref) => ref.enabled && ref.name && ref.imagePath);

    const matched = [];
    const seenKeys = new Set();

    for (const ref of refs) {
        const aliases = parseReferenceAliases(ref.name);
        const isMatched = ref.matchMode === 'always'
            || aliases.some((alias) => promptContainsReferenceName(prompt, alias));

        if (!isMatched) {
            continue;
        }

        const dedupeKey = `${ref.name}::${ref.imagePath}`;
        if (seenKeys.has(dedupeKey)) {
            continue;
        }

        seenKeys.add(dedupeKey);
        matched.push(ref);
    }

    return matched;
}

function buildAdditionalReferenceRowsHtml(settings = getSettings()) {
    const refs = ensureAdditionalReferencesArray(settings);

    if (refs.length === 0) {
        return '<p class="hint">Пока пусто. Добавь референс с именем-триггером и картинкой.</p>';
    }

    return refs.map((ref, index) => {
        const previewSrc = normalizeStoredImagePath(ref.imagePath);
        const isAlways = ref.matchMode === 'always';
        const isEnabled = ref.enabled !== false;
        const previewHtml = previewSrc
            ? `<img src="${sanitizeForHtml(previewSrc)}" alt="${sanitizeForHtml(ref.name || `ref-${index + 1}`)}" class="iig-additional-ref-thumb">`
            : '<div class="iig-additional-ref-thumb iig-additional-ref-thumb-placeholder">нет</div>';

        return `
            <div class="iig-additional-ref-row ${isEnabled ? '' : 'iig-additional-ref-row-disabled'}" data-ref-index="${index}">
                <div class="iig-additional-ref-content">
                    <div class="iig-additional-ref-preview">
                        ${previewHtml}
                        <label class="checkbox_label iig-additional-ref-enabled-toggle" title="${isEnabled ? 'Выключить референс' : 'Включить референс'}">
                            <input type="checkbox" class="iig-additional-ref-enabled" ${isEnabled ? 'checked' : ''}>
                            <span></span>
                        </label>
                    </div>
                    <div class="iig-additional-ref-main">
                        <div class="iig-additional-ref-header">
                            <input
                                type="text"
                                class="text_pole flex1 iig-additional-ref-name"
                                placeholder="Имя референса"
                                value="${sanitizeForHtml(ref.name || '')}"
                            >
                            <label class="menu_button iig-additional-ref-upload" title="Загрузить картинку">
                                <i class="fa-solid fa-upload"></i>
                                <input type="file" accept="image/*" class="iig-additional-ref-file" style="display:none">
                            </label>
                            <div class="menu_button iig-additional-ref-remove" title="Удалить">
                                <i class="fa-solid fa-trash"></i>
                            </div>
                        </div>
                        <textarea
                            class="text_pole flex1 iig-additional-ref-description"
                            rows="2"
                            placeholder="Описание референса"
                        >${sanitizeForHtml(ref.description || '')}</textarea>
                        <div class="iig-additional-ref-footer">
                            <label class="checkbox_label">
                                <input type="checkbox" class="iig-additional-ref-always" ${isAlways ? 'checked' : ''}>
                                <span>${isAlways ? 'Отправлять всегда' : 'Отправлять по совпадению'}</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderAdditionalReferencesList() {
    const container = document.getElementById('iig_additional_refs_list');
    if (!container) {
        return;
    }

    container.innerHTML = buildAdditionalReferenceRowsHtml();

    const status = document.getElementById('iig_additional_refs_status');
    if (status) {
        const refs = ensureAdditionalReferencesArray().filter((ref) => String(ref?.name || '').trim() && String(ref?.imagePath || '').trim());
        const enabledRefs = refs.filter((ref) => ref.enabled !== false);
        const alwaysCount = enabledRefs.filter((ref) => ref.matchMode === 'always').length;
        status.textContent = refs.length > 0
            ? `Активных доп. референсов: ${enabledRefs.length}/${refs.length}. Всегда отправляются: ${alwaysCount}.`
            : '';
    }
}

function buildUserAvatarDropdownControl(prefix, selectedAvatar) {
    return `
        <div id="${prefix}_dropdown" class="iig-avatar-dropdown">
            <div id="${prefix}_dropdown_selected" class="iig-avatar-dropdown-selected">
                ${buildUserAvatarSelectedHtml(selectedAvatar)}
            </div>
            <div id="${prefix}_dropdown_list" class="iig-avatar-dropdown-list"></div>
        </div>
    `;
}

function buildStyleListHtml(settings = getSettings()) {
    const styles = ensureStyles(settings);
    const activeId = settings.activeStyleId;

    if (styles.length === 0) {
        return '<p class="hint">Нет стилей. Добавьте стиль и активируйте его.</p>';
    }

    return styles.map((style) => `
        <div class="iig-style-preset-row ${style.id === activeId ? 'iig-style-preset-row-active' : ''}" data-style-id="${style.id}">
            <div class="menu_button iig-style-preset-select" data-style-activate="${style.id}">
                <i class="fa-solid ${style.id === activeId ? 'fa-check-circle' : 'fa-palette'}"></i>
                <span>${sanitizeForHtml(style.name)}</span>
            </div>
            <div class="menu_button iig-style-preset-remove" data-style-remove="${style.id}" title="Удалить стиль">
                <i class="fa-solid fa-trash"></i>
            </div>
        </div>
    `).join('');
}

function buildStyleEditorHtml(settings = getSettings()) {
    const activeStyle = getActiveStyle(settings);
    if (!activeStyle) {
        return '<p class="hint">Активируйте стиль, чтобы редактировать его значение.</p>';
    }

    return `
        <div class="iig-settings-card iig-style-editor-card">
            <h4>Активный стиль: ${sanitizeForHtml(activeStyle.name)}</h4>
            <div class="flex-row">
                <label for="iig_style_name">Название</label>
                <input type="text" id="iig_style_name" class="text_pole flex1" value="${sanitizeForHtml(activeStyle.name)}">
                <div id="iig_style_disable" class="menu_button" title="Выключить стиль">
                    <i class="fa-solid fa-power-off"></i>
                </div>
            </div>
            <div class="flex-row">
                <label for="iig_style_value">Значение</label>
                <textarea id="iig_style_value" class="text_pole flex1 iig-settings-textarea" rows="3" placeholder="masterpiece, cinematic lighting, painterly">${sanitizeForHtml(activeStyle.value)}</textarea>
                <div></div>
            </div>
        </div>
    `;
}

function renderStyleSettings() {
    const settings = getSettings();
    const listContainer = document.getElementById('iig_style_presets');
    const editorContainer = document.getElementById('iig_style_editor');
    if (listContainer) {
        listContainer.innerHTML = buildStyleListHtml(settings);
    }
    if (editorContainer) {
        editorContainer.innerHTML = buildStyleEditorHtml(settings);
    }
}

function applyConfiguredStyleToTag(tag, settings = getSettings()) {
    if (!tag) {
        return tag;
    }

    const effectiveStyle = resolveEffectiveStyle(tag.style, settings);
    tag.style = effectiveStyle;
    return tag;
}

function buildSettingsSectionHtml(sectionId, title, bodyHtml, expanded = true) {
    return `
        <div class="iig-section" data-section-id="${sectionId}">
            <div class="iig-section-toggle" data-section-toggle="${sectionId}">
                <span class="iig-section-title">${title}</span>
                <i class="fa-solid fa-chevron-down iig-section-chevron ${expanded ? '' : 'iig-section-chevron-collapsed'}"></i>
            </div>
            <div class="iig-section-body ${expanded ? '' : 'iig-hidden'}" id="${sectionId}">
                ${bodyHtml}
            </div>
        </div>
    `;
}

function buildApiSettingsSectionHtml(settings = getSettings()) {
    const bodyHtml = `
        <div class="iig-settings-card">
            <label class="checkbox_label">
                <input type="checkbox" id="iig_enabled" ${settings.enabled ? 'checked' : ''}>
                <span>Включить генерацию картинок</span>
            </label>
            <label class="checkbox_label">
                <input type="checkbox" id="iig_external_blocks" ${settings.externalBlocks ? 'checked' : ''}>
                <span>Работа с внешними блоками</span>
            </label>

            <div class="flex-row">
                <label for="iig_api_type">Тип API</label>
                <select id="iig_api_type" class="flex1">
                    <option value="openai" ${settings.apiType === 'openai' ? 'selected' : ''}>OpenAI-совместимый (/v1/images/generations)</option>
                    <option value="gemini" ${settings.apiType === 'gemini' ? 'selected' : ''}>Gemini-совместимый (nano-banana)</option>
                    <option value="naistera" ${settings.apiType === 'naistera' ? 'selected' : ''}>Naistera (naistera.org)</option>
                </select>
                <div></div>
            </div>

            <div class="flex-row">
                <label for="iig_endpoint">URL эндпоинта</label>
                <input type="text" id="iig_endpoint" class="text_pole flex1" value="${settings.endpoint}" placeholder="https://api.example.com">
                <div></div>
            </div>

            <div class="flex-row">
                <label for="iig_api_key">API ключ</label>
                <input type="password" id="iig_api_key" class="text_pole flex1" value="${settings.apiKey}">
                <div id="iig_key_toggle" class="menu_button iig-key-toggle" title="Показать/Скрыть">
                    <i class="fa-solid fa-eye"></i>
                </div>
            </div>

            <p id="iig_naistera_hint" class="hint ${settings.apiType === 'naistera' ? '' : 'iig-hidden'}">Для Naistera: вставьте токен из Telegram бота и выберите модель (grok / grok-pro / nano banana 2 / novelai).</p>

            <div class="flex-row ${settings.apiType === 'naistera' ? 'iig-hidden' : ''}" id="iig_model_row">
                <label for="iig_model">Модель</label>
                <select id="iig_model" class="flex1">
                    ${settings.model ? `<option value="${settings.model}" selected>${settings.model}</option>` : '<option value="">-- Выберите модель --</option>'}
                </select>
                <div id="iig_refresh_models" class="menu_button iig-refresh-btn" title="Обновить список">
                    <i class="fa-solid fa-sync"></i>
                </div>
            </div>

            <div class="flex-row ${settings.apiType !== 'openai' ? 'iig-hidden' : ''}" id="iig_size_row">
                <label for="iig_size">Размер</label>
                <select id="iig_size" class="flex1">
                    <option value="1024x1024" ${settings.size === '1024x1024' ? 'selected' : ''}>1024x1024 (Квадрат)</option>
                    <option value="1792x1024" ${settings.size === '1792x1024' ? 'selected' : ''}>1792x1024 (Альбомная)</option>
                    <option value="1024x1792" ${settings.size === '1024x1792' ? 'selected' : ''}>1024x1792 (Портретная)</option>
                    <option value="512x512" ${settings.size === '512x512' ? 'selected' : ''}>512x512 (Маленький)</option>
                </select>
                <div></div>
            </div>

            <div class="flex-row ${settings.apiType !== 'openai' ? 'iig-hidden' : ''}" id="iig_quality_row">
                <label for="iig_quality">Качество</label>
                <select id="iig_quality" class="flex1">
                    <option value="standard" ${settings.quality === 'standard' ? 'selected' : ''}>Стандартное</option>
                    <option value="hd" ${settings.quality === 'hd' ? 'selected' : ''}>HD</option>
                </select>
                <div></div>
            </div>

            <div class="flex-row ${settings.apiType === 'naistera' ? '' : 'iig-hidden'}" id="iig_naistera_model_row">
                <label for="iig_naistera_model">Модель</label>
                <select id="iig_naistera_model" class="flex1">
                    <option value="grok" ${normalizeNaisteraModel(settings.naisteraModel) === 'grok' ? 'selected' : ''}>grok</option>
                    <option value="grok-pro" ${normalizeNaisteraModel(settings.naisteraModel) === 'grok-pro' ? 'selected' : ''}>grok-pro</option>
                    <option value="nano banana 2" ${normalizeNaisteraModel(settings.naisteraModel) === 'nano banana 2' ? 'selected' : ''}>nano banana 2</option>
                    <option value="novelai" ${normalizeNaisteraModel(settings.naisteraModel) === 'novelai' ? 'selected' : ''}>novelai</option>
                </select>
                <div></div>
            </div>

            <div class="flex-row ${settings.apiType === 'naistera' ? '' : 'iig-hidden'}" id="iig_naistera_aspect_row">
                <label for="iig_naistera_aspect_ratio">Соотношение сторон</label>
                <select id="iig_naistera_aspect_ratio" class="flex1">
                    <option value="1:1" ${settings.naisteraAspectRatio === '1:1' ? 'selected' : ''}>1:1</option>
                    <option value="16:9" ${settings.naisteraAspectRatio === '16:9' ? 'selected' : ''}>16:9</option>
                    <option value="9:16" ${settings.naisteraAspectRatio === '9:16' ? 'selected' : ''}>9:16</option>
                    <option value="3:2" ${settings.naisteraAspectRatio === '3:2' ? 'selected' : ''}>3:2</option>
                    <option value="2:3" ${settings.naisteraAspectRatio === '2:3' ? 'selected' : ''}>2:3</option>
                </select>
                <div></div>
            </div>

            <div id="iig_avatar_section" class="iig-settings-card-nested ${settings.apiType !== 'gemini' ? 'hidden' : ''}">
                <div class="flex-row">
                    <label for="iig_aspect_ratio">Соотношение сторон</label>
                    <select id="iig_aspect_ratio" class="flex1">
                        <option value="1:1" ${settings.aspectRatio === '1:1' ? 'selected' : ''}>1:1 (Квадрат)</option>
                        <option value="2:3" ${settings.aspectRatio === '2:3' ? 'selected' : ''}>2:3 (Портрет)</option>
                        <option value="3:2" ${settings.aspectRatio === '3:2' ? 'selected' : ''}>3:2 (Альбом)</option>
                        <option value="3:4" ${settings.aspectRatio === '3:4' ? 'selected' : ''}>3:4 (Портрет)</option>
                        <option value="4:3" ${settings.aspectRatio === '4:3' ? 'selected' : ''}>4:3 (Альбом)</option>
                        <option value="4:5" ${settings.aspectRatio === '4:5' ? 'selected' : ''}>4:5 (Портрет)</option>
                        <option value="5:4" ${settings.aspectRatio === '5:4' ? 'selected' : ''}>5:4 (Альбом)</option>
                        <option value="9:16" ${settings.aspectRatio === '9:16' ? 'selected' : ''}>9:16 (Вертикальный)</option>
                        <option value="16:9" ${settings.aspectRatio === '16:9' ? 'selected' : ''}>16:9 (Широкий)</option>
                        <option value="21:9" ${settings.aspectRatio === '21:9' ? 'selected' : ''}>21:9 (Ультраширокий)</option>
                    </select>
                    <div></div>
                </div>
                <div class="flex-row">
                    <label for="iig_image_size">Разрешение</label>
                    <select id="iig_image_size" class="flex1">
                        <option value="1K" ${settings.imageSize === '1K' ? 'selected' : ''}>1K (по умолчанию)</option>
                        <option value="2K" ${settings.imageSize === '2K' ? 'selected' : ''}>2K</option>
                        <option value="4K" ${settings.imageSize === '4K' ? 'selected' : ''}>4K</option>
                    </select>
                    <div></div>
                </div>
            </div>

            <div class="iig-settings-card-nested ${settings.apiType === 'naistera' ? '' : 'iig-hidden'}" id="iig_naistera_video_section">
                <h4>Видео</h4>
                <label class="checkbox_label">
                    <input type="checkbox" id="iig_naistera_video_test" ${settings.naisteraVideoTest ? 'checked' : ''}>
                    <span>Включить генерацию видео</span>
                </label>
                <div class="iig-video-frequency-row ${settings.naisteraVideoTest ? '' : 'iig-hidden'}" id="iig_naistera_video_frequency_row">
                    <div class="iig-video-frequency-input">
                        <span>Каждые</span>
                        <input type="number" id="iig_naistera_video_every_n" class="text_pole" min="1" max="999" step="1" value="${normalizeNaisteraVideoFrequency(settings.naisteraVideoEveryN)}">
                        <span>сообщений.</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    return buildSettingsSectionHtml('iig_api_section', 'Настройки API', bodyHtml, true);
}

function buildStylesSettingsSectionHtml() {
    const bodyHtml = `
        <div class="iig-settings-card">
            <div class="flex-row">
                <label for="iig_new_style_name">Новый стиль</label>
                <input type="text" id="iig_new_style_name" class="text_pole flex1" placeholder="Название стиля">
                <div id="iig_style_add" class="menu_button" title="Добавить стиль">
                    <i class="fa-solid fa-plus"></i>
                </div>
            </div>
            <div id="iig_style_presets" class="iig-style-presets"></div>
            <div id="iig_style_editor"></div>
        </div>
    `;
    return buildSettingsSectionHtml('iig_styles_section', 'Стили', bodyHtml, false);
}

function buildReferencesSettingsSectionHtml(settings = getSettings()) {
    const geminiUserAvatarDropdown = buildUserAvatarDropdownControl('iig_user_avatar', settings.userAvatarFile);
    const naisteraUserAvatarDropdown = buildUserAvatarDropdownControl('iig_naistera_user_avatar', settings.userAvatarFile);

    const bodyHtml = `
        <div class="iig-settings-card">
            <div id="iig_avatar_refs_section" class="iig-settings-card-nested ${settings.apiType !== 'gemini' ? 'hidden' : ''}">
                <h4>Gemini / nano-banana</h4>
                <label class="checkbox_label">
                    <input type="checkbox" id="iig_send_char_avatar" ${settings.sendCharAvatar ? 'checked' : ''}>
                    <span>Отправлять аватар {{char}}</span>
                </label>
                <label class="checkbox_label">
                    <input type="checkbox" id="iig_send_user_avatar" ${settings.sendUserAvatar ? 'checked' : ''}>
                    <span>Отправлять аватар {{user}}</span>
                </label>
                <label id="iig_use_active_persona_avatar_row" class="checkbox_label ${!settings.sendUserAvatar ? 'hidden' : ''}">
                    <input type="checkbox" id="iig_use_active_persona_avatar" ${settings.useActiveUserPersonaAvatar ? 'checked' : ''}>
                    <span>Брать аватары всех подключенных персон</span>
                </label>
                <div id="iig_user_avatar_row" class="flex-row ${!settings.sendUserAvatar || settings.useActiveUserPersonaAvatar ? 'hidden' : ''}">
                    <label>Аватар {{user}}</label>
                    ${geminiUserAvatarDropdown}
                    <div id="iig_refresh_avatars" class="menu_button iig-refresh-btn" title="Обновить список">
                        <i class="fa-solid fa-sync"></i>
                    </div>
                </div>
            </div>

            <div class="iig-settings-card-nested ${(settings.apiType === 'naistera' && naisteraModelSupportsReferences(settings.naisteraModel)) ? '' : 'iig-hidden'}" id="iig_naistera_refs_section">
                <h4>Naistera</h4>
                <label class="checkbox_label">
                    <input type="checkbox" id="iig_naistera_send_char_avatar" ${settings.naisteraSendCharAvatar ? 'checked' : ''}>
                    <span>Отправлять аватар {{char}}</span>
                </label>
                <label class="checkbox_label">
                    <input type="checkbox" id="iig_naistera_send_user_avatar" ${settings.naisteraSendUserAvatar ? 'checked' : ''}>
                    <span>Отправлять аватар {{user}}</span>
                </label>
                <label id="iig_naistera_use_active_persona_avatar_row" class="checkbox_label ${!settings.naisteraSendUserAvatar ? 'iig-hidden' : ''}">
                    <input type="checkbox" id="iig_naistera_use_active_persona_avatar" ${settings.useActiveUserPersonaAvatar ? 'checked' : ''}>
                    <span>Брать аватары всех подключенных персон</span>
                </label>
                <div id="iig_naistera_user_avatar_row" class="flex-row ${!settings.naisteraSendUserAvatar || settings.useActiveUserPersonaAvatar ? 'iig-hidden' : ''}">
                    <label>Аватар {{user}}</label>
                    ${naisteraUserAvatarDropdown}
                    <div id="iig_naistera_refresh_avatars" class="menu_button iig-refresh-btn" title="Обновить список">
                        <i class="fa-solid fa-sync"></i>
                    </div>
                </div>
            </div>

            <div class="iig-settings-card-nested ${((settings.apiType === 'gemini') || (settings.apiType === 'naistera' && naisteraModelSupportsReferences(settings.naisteraModel))) ? '' : 'iig-hidden'}" id="iig_image_context_section">
                <h4>Контекст картинок</h4>
                <label class="checkbox_label">
                    <input type="checkbox" id="iig_image_context_enabled" ${settings.imageContextEnabled ? 'checked' : ''}>
                    <span>Включить контекст картинок</span>
                </label>
                <div class="iig-video-frequency-row ${settings.imageContextEnabled ? '' : 'iig-hidden'}" id="iig_image_context_count_row">
                    <div class="iig-video-frequency-input">
                        <span>Использовать</span>
                        <input type="number" id="iig_image_context_count" class="text_pole" min="1" max="${MAX_CONTEXT_IMAGES}" step="1" value="${normalizeImageContextCount(settings.imageContextCount)}">
                        <span>предыдущих картинок.</span>
                    </div>
                </div>
            </div>

            <div class="iig-settings-card-nested ${((settings.apiType === 'gemini') || (settings.apiType === 'naistera' && naisteraModelSupportsReferences(settings.naisteraModel))) ? '' : 'iig-hidden'}" id="iig_additional_refs_section">
                <h4>Дополнительные референсы</h4>
                <div class="iig-additional-ref-actions">
                    <div id="iig_additional_refs_add" class="menu_button iig-button-inline">
                        <i class="fa-solid fa-plus"></i> Добавить референс
                    </div>
                    <div id="iig_additional_refs_import" class="menu_button iig-button-inline">
                        <i class="fa-solid fa-link"></i> Загрузить референс
                    </div>
                </div>
                <div id="iig_additional_refs_status" class="hint" style="margin-bottom: 8px;"></div>
                <div id="iig_additional_refs_list"></div>
            </div>
        </div>
    `;
    return buildSettingsSectionHtml('iig_references_section', 'Референсы', bodyHtml, true);
}

function buildDebugSettingsSectionHtml(settings = getSettings()) {
    const bodyHtml = `
        <div class="iig-settings-card">
            <div class="iig-settings-card-nested">
                <div class="flex-row">
                    <label for="iig_max_retries">Макс. повторов</label>
                    <input type="number" id="iig_max_retries" class="text_pole flex1" value="${settings.maxRetries}" min="0" max="5">
                    <div></div>
                </div>
                <div class="flex-row">
                    <label for="iig_retry_delay">Задержка (мс)</label>
                    <input type="number" id="iig_retry_delay" class="text_pole flex1" value="${settings.retryDelay}" min="500" max="10000" step="500">
                    <div></div>
                </div>
            </div>
            <div class="iig-debug-actions">
                <div id="iig_export_logs" class="menu_button iig-button-inline">
                    <i class="fa-solid fa-download"></i> Экспорт логов
                </div>
            </div>
        </div>
    `;
    return buildSettingsSectionHtml('iig_debug_section', 'Отладка', bodyHtml, false);
}

function buildReferenceImportModalHtml() {
    return `
        <div id="iig_ref_import_modal" class="iig-modal iig-hidden" aria-hidden="true">
            <div class="iig-modal-backdrop" data-iig-modal-close="true"></div>
            <div class="iig-modal-card" role="dialog" aria-modal="true" aria-labelledby="iig_ref_import_title">
                <div class="iig-modal-header">
                    <h4 id="iig_ref_import_title">Загрузить референс по ссылке</h4>
                    <div id="iig_ref_import_close" class="menu_button" title="Закрыть">
                        <i class="fa-solid fa-xmark"></i>
                    </div>
                </div>
                <textarea
                    id="iig_ref_import_urls"
                    class="text_pole iig-modal-textarea"
                    rows="6"
                    placeholder="Одна ссылка на строку"
                ></textarea>
                <div class="iig-modal-actions">
                    <div id="iig_ref_import_submit" class="menu_button iig-button-inline">
                        <i class="fa-solid fa-plus"></i> Добавить
                    </div>
                </div>
            </div>
        </div>
    `;
}

function normalizeReferenceUrlList(rawValue) {
    return String(rawValue || '')
        .split(/\r?\n+/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function getReferenceNameFromUrl(url, fallbackIndex = 0) {
    try {
        const parsed = new URL(url, window.location.href);
        const pathname = parsed.pathname || '';
        const fileName = decodeURIComponent(pathname.split('/').filter(Boolean).pop() || '').trim();
        if (fileName) {
            return fileName;
        }
    } catch (_error) {
        // ignore and fallback
    }
    return `reference-${fallbackIndex + 1}`;
}

async function importAdditionalReferencesFromUrls(rawValue) {
    const settings = getSettings();
    const refs = ensureAdditionalReferencesArray(settings);
    const urls = normalizeReferenceUrlList(rawValue);
    if (urls.length === 0) {
        throw new Error('Добавьте хотя бы одну ссылку');
    }

    const availableSlots = MAX_ADDITIONAL_REFERENCES - refs.length;
    if (availableSlots <= 0) {
        throw new Error(`Достигнут лимит референсов: ${MAX_ADDITIONAL_REFERENCES}`);
    }

    const queue = urls.slice(0, availableSlots);
    const importedNames = [];

    for (let index = 0; index < queue.length; index++) {
        const url = queue[index];
        const dataUrl = await imageUrlToDataUrl(url);
        if (!dataUrl) {
            throw new Error(`Не удалось загрузить изображение: ${url}`);
        }

        const name = getReferenceNameFromUrl(url, refs.length + index);
        const savedPath = await saveImageToFile(dataUrl, {
            mode: 'additional-reference-import',
            sourceUrl: url,
            refIndex: refs.length + index,
            refName: name,
        });

        refs.push({
            name,
            description: '',
            imagePath: normalizeStoredImagePath(savedPath),
            matchMode: 'match',
            enabled: true,
        });
        importedNames.push(name);
    }

    saveSettings();
    renderAdditionalReferencesList();
    return {
        importedCount: importedNames.length,
        skippedCount: Math.max(0, urls.length - queue.length),
    };
}

function openReferenceImportModal() {
    const modal = document.getElementById('iig_ref_import_modal');
    const input = document.getElementById('iig_ref_import_urls');
    if (!modal || !input) {
        return;
    }

    modal.classList.remove('iig-hidden');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => input.focus(), 0);
}

function closeReferenceImportModal() {
    const modal = document.getElementById('iig_ref_import_modal');
    const input = document.getElementById('iig_ref_import_urls');
    if (!modal) {
        return;
    }

    modal.classList.add('iig-hidden');
    modal.setAttribute('aria-hidden', 'true');
    if (input) {
        input.value = '';
    }
}

async function readFileAsDataUrl(file) {
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function getPreviousGeneratedImageUrls(messageId, requestedCount) {
    const count = normalizeImageContextCount(requestedCount);
    if (!Number.isInteger(messageId) || messageId <= 0) {
        return [];
    }

    const settings = getSettings();
    const context = SillyTavern.getContext();
    const chat = Array.isArray(context?.chat) ? context.chat : [];
    const urls = [];
    const seen = new Set();

    for (let idx = messageId - 1; idx >= 0 && urls.length < count; idx--) {
        const message = chat[idx];
        if (!message || message.is_user || message.is_system) {
            continue;
        }

        const text = getMessageRenderText(message, settings);
        const messageUrls = extractGeneratedImageUrlsFromText(text);
        for (const url of messageUrls) {
            if (seen.has(url)) {
                continue;
            }
            seen.add(url);
            urls.push(url);
            if (urls.length >= count) {
                break;
            }
        }
    }

    return urls;
}

async function collectPreviousContextReferences(messageId, format, requestedCount) {
    const urls = getPreviousGeneratedImageUrls(messageId, requestedCount);
    if (urls.length === 0) {
        return [];
    }

    const convert = format === 'dataUrl' ? imageUrlToDataUrl : imageUrlToBase64;
    const converted = await Promise.all(urls.map((url) => convert(url)));
    return converted.filter(Boolean);
}

/**
 * Fetch models list from endpoint
 */
async function fetchModels() {
    const settings = getSettings();
    const endpoint = getEffectiveEndpoint(settings);

    if (!endpoint && settings.apiType !== 'naistera') {
        console.warn('[IIG] Cannot fetch models: endpoint not set');
        return [];
    }

    try {
        const context = SillyTavern.getContext();
        const response = await fetch('/api/image-generation/models', {
            method: 'POST',
            headers: context.getRequestHeaders(),
            body: JSON.stringify({
                api_type: settings.apiType,
                endpoint,
                api_key: settings.apiKey,
                timeout_seconds: 30,
            }),
        });

        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.ok) {
            throw new Error(data?.error || `HTTP ${response.status}`);
        }

        const modelsPayload = data.models;
        const models = Array.isArray(modelsPayload?.data)
            ? modelsPayload.data
            : Array.isArray(modelsPayload?.models)
                ? modelsPayload.models
                : Array.isArray(modelsPayload)
                    ? modelsPayload
                    : [];

        // Filter for image models only
        const names = models
            .map((model) => typeof model === 'string' ? model : String(model?.id || model?.name || ''))
            .map((model) => model.replace(/^models\//, ''))
            .filter(Boolean);
        return settings.apiType === 'naistera' ? names : names.filter(isImageModel);
    } catch (error) {
        console.error('[IIG] Failed to fetch models:', error);
        toastr.error(`Ошибка загрузки моделей: ${error.message}`, 'Генерация картинок');
        return [];
    }
}

/**
 * Fetch list of user avatars from /User Avatars/ directory
 */
async function fetchUserAvatars() {
    try {
        const context = SillyTavern.getContext();
        const response = await fetch('/api/avatars/get', {
            method: 'POST',
            headers: context.getRequestHeaders(),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        const avatars = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.avatars)
                ? payload.avatars
                : Array.isArray(payload?.files)
                    ? payload.files
                    : [];

        cachedUserAvatars = avatars
            .map((avatar) => String(avatar || '').trim())
            .filter(Boolean);

        return cachedUserAvatars;
    } catch (error) {
        console.error('[IIG] Failed to fetch user avatars:', error);
        return [];
    }
}

function getUserAvatarSelects() {
    return ['iig_user_avatar_file', 'iig_naistera_user_avatar_file']
        .map((id) => document.getElementById(id))
        .filter(Boolean);
}

function getUserAvatarDropdownConfigs() {
    return [
        {
            rootId: 'iig_user_avatar_dropdown',
            selectedId: 'iig_user_avatar_dropdown_selected',
            listId: 'iig_user_avatar_dropdown_list',
            refreshId: 'iig_refresh_avatars',
        },
        {
            rootId: 'iig_naistera_user_avatar_dropdown',
            selectedId: 'iig_naistera_user_avatar_dropdown_selected',
            listId: 'iig_naistera_user_avatar_dropdown_list',
            refreshId: 'iig_naistera_refresh_avatars',
        },
    ].filter((config) => document.getElementById(config.selectedId));
}

function buildUserAvatarSelectedHtml(avatarFile) {
    return avatarFile
        ? `<img class="iig-dropdown-thumb" src="/User Avatars/${encodeURIComponent(avatarFile)}" alt="" onerror="this.style.display='none'">
           <span class="iig-dropdown-text">${sanitizeForHtml(avatarFile)}</span>
           <span class="iig-dropdown-arrow fa-solid fa-chevron-down"></span>`
        : `<div class="iig-dropdown-placeholder"><i class="fa-solid fa-user"></i></div>
           <span class="iig-dropdown-text">Выберите аватар</span>
           <span class="iig-dropdown-arrow fa-solid fa-chevron-down"></span>`;
}

function closeUserAvatarDropdowns() {
    for (const { rootId } of getUserAvatarDropdownConfigs()) {
        document.getElementById(rootId)?.classList.remove('open');
    }
}

function renderUserAvatarDropdownList(listElement, avatars, selectedAvatar) {
    if (!listElement) {
        return;
    }

    listElement.innerHTML = '';

    for (const avatarFile of avatars) {
        const item = document.createElement('div');
        item.className = `iig-avatar-dropdown-item ${selectedAvatar === avatarFile ? 'selected' : ''}`;
        item.dataset.value = avatarFile;
        item.innerHTML = `
            <img class="iig-item-thumb" src="/User Avatars/${encodeURIComponent(avatarFile)}" alt="${sanitizeForHtml(avatarFile)}" loading="lazy" onerror="this.style.display='none'">
            <span class="iig-item-name">${sanitizeForHtml(avatarFile)}</span>`;
        item.addEventListener('click', () => {
            const settings = getSettings();
            settings.userAvatarFile = avatarFile;
            saveSettings();
            syncUserAvatarSelection(avatarFile);
        });
        listElement.appendChild(item);
    }
}

function getActivePersonaAvatarCheckboxes() {
    return ['iig_use_active_persona_avatar', 'iig_naistera_use_active_persona_avatar']
        .map((id) => document.getElementById(id))
        .filter(Boolean);
}

function syncActivePersonaAvatarMode(enabled) {
    for (const checkbox of getActivePersonaAvatarCheckboxes()) {
        checkbox.checked = Boolean(enabled);
    }
}

function syncUserAvatarSelection(selectedAvatar) {
    for (const select of getUserAvatarSelects()) {
        if (selectedAvatar && !Array.from(select.options).some((option) => option.value === selectedAvatar)) {
            const option = document.createElement('option');
            option.value = selectedAvatar;
            option.textContent = selectedAvatar;
            select.appendChild(option);
        }
        select.value = selectedAvatar || '';
    }

    for (const config of getUserAvatarDropdownConfigs()) {
        const selectedElement = document.getElementById(config.selectedId);
        const listElement = document.getElementById(config.listId);
        if (selectedElement) {
            selectedElement.innerHTML = buildUserAvatarSelectedHtml(selectedAvatar);
        }
        if (listElement) {
            renderUserAvatarDropdownList(listElement, cachedUserAvatars, selectedAvatar);
        }
    }

    closeUserAvatarDropdowns();
}

function populateUserAvatarSelects(avatars, selectedAvatar) {
    for (const select of getUserAvatarSelects()) {
        select.innerHTML = '<option value="">-- Не выбран --</option>';

        for (const avatar of avatars) {
            const option = document.createElement('option');
            option.value = avatar;
            option.textContent = avatar;
            select.appendChild(option);
        }
    }

    for (const config of getUserAvatarDropdownConfigs()) {
        const listElement = document.getElementById(config.listId);
        renderUserAvatarDropdownList(listElement, avatars, selectedAvatar);
    }

    syncUserAvatarSelection(selectedAvatar);
}

async function refreshUserAvatarSelects() {
    const avatars = await fetchUserAvatars();
    populateUserAvatarSelects(avatars, getSettings().userAvatarFile);
    return avatars;
}

async function loadPersonasModule() {
    if (!personasModulePromise) {
        personasModulePromise = (async () => {
            let lastError = null;
            for (const modulePath of PERSONAS_MODULE_PATHS) {
                try {
                    return await import(modulePath);
                } catch (error) {
                    lastError = error;
                }
            }
            throw lastError || new Error('Unable to import personas.js');
        })();
    }
    return await personasModulePromise;
}

/**
 * Convert image URL to base64
 */
async function imageUrlToBase64(url) {
    try {
        const blob = await fetchImageBlob(url);
        if (!blob) {
            return null;
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                // Remove data URL prefix to get pure base64
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('[IIG] Failed to convert image to base64:', error);
        return null;
    }
}

/**
 * Convert image URL to data URL (data:image/...;base64,...)
 */
async function imageUrlToDataUrl(url) {
    try {
        const blob = await fetchImageBlob(url);
        if (!blob) {
            return null;
        }

        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('[IIG] Failed to convert image to data URL:', error);
        return null;
    }
}

async function fetchImageBlob(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            iigLog('WARN', `Skipping context reference fetch: url=${url} status=${response.status}`);
            return null;
        }

        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        if (!contentType.startsWith('image/')) {
            iigLog(
                'WARN',
                `Skipping context reference with non-image content-type: url=${url} contentType=${contentType || '(empty)'}`
            );
            return null;
        }

        const blob = await response.blob();
        const blobType = String(blob.type || contentType || '').toLowerCase();
        if (!blobType.startsWith('image/')) {
            iigLog(
                'WARN',
                `Skipping context reference with non-image blob type: url=${url} blobType=${blobType || '(empty)'}`
            );
            return null;
        }
        return blob;
    } catch (error) {
        iigLog('WARN', `Skipping context reference fetch failure: url=${url} err=${error?.message || error}`);
        return null;
    }
}

/**
 * Save base64 image to file via SillyTavern API
 * @param {string} dataUrl - Data URL (data:image/png;base64,...)
 * @returns {Promise<string>} - Relative path to saved file
 */
const IIG_UPLOAD_FORMAT_MAP = Object.freeze({
    'jpeg': 'jpg',
    'jpg': 'jpg',
    'pjpeg': 'jpg',
    'jfif': 'jpg',
    'png': 'png',
    'x-png': 'png',
    'webp': 'webp',
    'gif': 'gif',
});

const IIG_UPLOAD_ALLOWED_FORMATS = new Set(['jpg', 'png', 'webp', 'gif']);

function parseImageDataUrl(dataUrl) {
    if (typeof dataUrl !== 'string') {
        throw new Error(`Invalid data URL type: ${typeof dataUrl}`);
    }
    if (!dataUrl.startsWith('data:')) {
        throw new Error('Invalid data URL prefix (expected data:)');
    }

    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx <= 5) {
        throw new Error('Invalid data URL format (missing comma)');
    }

    const meta = dataUrl.slice(5, commaIdx).trim();
    const base64Data = dataUrl.slice(commaIdx + 1).trim();
    const metaParts = meta.split(';').map(s => s.trim()).filter(Boolean);
    const mimeType = (metaParts[0] || '').toLowerCase();
    const hasBase64 = metaParts.some(p => p.toLowerCase() === 'base64');

    if (!mimeType.startsWith('image/')) {
        throw new Error(`Invalid data URL mime type: ${mimeType || '(empty)'}`);
    }
    if (!hasBase64) {
        throw new Error('Invalid data URL encoding (base64 flag missing)');
    }
    if (!base64Data) {
        throw new Error('Invalid data URL payload (empty base64)');
    }

    const subtype = mimeType.slice('image/'.length).toLowerCase();
    const normalizedFormat = IIG_UPLOAD_FORMAT_MAP[subtype] || subtype;

    return {
        mimeType,
        subtype,
        normalizedFormat,
        base64Data,
    };
}

async function convertDataUrlToPng(dataUrl) {
    return await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const width = img.naturalWidth || img.width;
            const height = img.naturalHeight || img.height;
            if (!width || !height) {
                reject(new Error('Image decode failed (no dimensions)'));
                return;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas 2D context unavailable'));
                return;
            }
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error('Failed to decode data URL image'));
        img.src = dataUrl;
    });
}

async function saveImageToFile(dataUrl, debugMeta = {}) {
    const context = SillyTavern.getContext();

    let parsed;
    try {
        parsed = parseImageDataUrl(dataUrl);
    } catch (error) {
        iigLog(
            'ERROR',
            `saveImageToFile parse failed: ${error.message}; debug=${JSON.stringify(debugMeta)}; prefix=${String(dataUrl).slice(0, 120)}`
        );
        throw error;
    }

    if (!IIG_UPLOAD_ALLOWED_FORMATS.has(parsed.normalizedFormat)) {
        iigLog(
            'WARN',
            `Unsupported upload format "${parsed.subtype}" (mime=${parsed.mimeType}); converting to PNG; debug=${JSON.stringify(debugMeta)}`
        );
        const converted = await convertDataUrlToPng(dataUrl);
        parsed = parseImageDataUrl(converted);
    }

    const format = parsed.normalizedFormat;
    const base64Data = parsed.base64Data;
    iigLog(
        'INFO',
        `Uploading image: mime=${parsed.mimeType} subtype=${parsed.subtype} format=${format} b64len=${base64Data.length} debug=${JSON.stringify(debugMeta)}`
    );

    // Get character name for subfolder
    let charName = 'generated';
    if (context.characterId !== undefined && context.characters?.[context.characterId]) {
        charName = context.characters[context.characterId].name || 'generated';
    }

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `iig_${timestamp}`;

    const response = await fetch('/api/images/upload', {
        method: 'POST',
        headers: context.getRequestHeaders(),
        body: JSON.stringify({
            image: base64Data,
            format: format,
            ch_name: charName,
            filename: filename
        })
    });

    if (!response.ok) {
        const raw = await response.text().catch(() => '');
        let parsedError = {};
        try {
            parsedError = raw ? JSON.parse(raw) : {};
        } catch (_e) {
            parsedError = {};
        }
        const errText = parsedError?.error || parsedError?.detail || raw || `Upload failed: ${response.status}`;
        iigLog(
            'ERROR',
            `Upload failed status=${response.status} format=${format} mime=${parsed.mimeType} debug=${JSON.stringify(debugMeta)} response=${String(errText).slice(0, 400)}`
        );
        throw new Error(errText);
    }

    const result = await response.json();
    console.log('[IIG] Image saved to:', result.path);
    return result.path;
}

async function saveNaisteraMediaToFile(dataUrl, mediaKind = 'video', debugMeta = {}) {
    if (mediaKind !== 'video') {
        throw new Error(`Unsupported mediaKind for file upload: ${mediaKind}`);
    }

    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:video/mp4;base64,')) {
        throw new Error('Only data:video/mp4;base64 URLs are supported');
    }

    const context = SillyTavern.getContext();
    const base64Data = dataUrl.slice('data:video/mp4;base64,'.length).trim();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `iig_video_${timestamp}.mp4`;

    const response = await fetch('/api/files/upload', {
        method: 'POST',
        headers: context.getRequestHeaders(),
        body: JSON.stringify({
            name: fileName,
            data: base64Data,
        })
    });

    if (!response.ok) {
        const raw = await response.text().catch(() => '');
        iigLog(
            'ERROR',
            `ST media upload failed status=${response.status} kind=${mediaKind} debug=${JSON.stringify(debugMeta)} response=${String(raw).slice(0, 400)}`
        );
        throw new Error(raw || `Media upload failed: ${response.status}`);
    }

    const result = await response.json();
    if (!result?.path) {
        throw new Error('No path in media upload response');
    }
    return result.path;
}

/**
 * Get character avatar as base64
 */
async function getCharacterAvatarBase64() {
    try {
        const context = SillyTavern.getContext();

        console.log('[IIG] Getting character avatar, characterId:', context.characterId);

        if (context.characterId === undefined || context.characterId === null) {
            console.log('[IIG] No character selected');
            return null;
        }

        // Try context method first
        if (typeof context.getCharacterAvatar === 'function') {
            const avatarUrl = context.getCharacterAvatar(context.characterId);
            console.log('[IIG] getCharacterAvatar returned:', avatarUrl);
            if (avatarUrl) {
                return await imageUrlToBase64(avatarUrl);
            }
        }

        // Fallback: try to get from characters array
        const character = context.characters?.[context.characterId];
        console.log('[IIG] Character from array:', character?.name, 'avatar:', character?.avatar);
        if (character?.avatar) {
            const avatarUrl = `/characters/${encodeURIComponent(character.avatar)}`;
            console.log('[IIG] Found character avatar:', avatarUrl);
            return await imageUrlToBase64(avatarUrl);
        }

        console.log('[IIG] Could not get character avatar');
        return null;
    } catch (error) {
        console.error('[IIG] Error getting character avatar:', error);
        return null;
    }
}

/**
 * Get character avatar as data URL (for Naistera references)
 */
async function getCharacterAvatarDataUrl() {
    try {
        const context = SillyTavern.getContext();

        if (context.characterId === undefined || context.characterId === null) {
            return null;
        }

        if (typeof context.getCharacterAvatar === 'function') {
            const avatarUrl = context.getCharacterAvatar(context.characterId);
            if (avatarUrl) {
                return await imageUrlToDataUrl(avatarUrl);
            }
        }

        const character = context.characters?.[context.characterId];
        if (character?.avatar) {
            const avatarUrl = `/characters/${encodeURIComponent(character.avatar)}`;
            return await imageUrlToDataUrl(avatarUrl);
        }

        return null;
    } catch (error) {
        console.error('[IIG] Error getting character avatar data URL:', error);
        return null;
    }
}

/**
 * Resolve avatar URLs for connected user personas.
 */
function normalizeUserAvatarUrl(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (text.startsWith('/') || /^(?:https?:|data:)/i.test(text)) return text;
    return `/User Avatars/${encodeURIComponent(text)}`;
}

function personaAvatarUrl(persona) {
    if (!persona || typeof persona !== 'object') {
        return '';
    }
    return normalizeUserAvatarUrl(persona.avatar_url || persona.avatar || persona.file || '');
}

async function getSelectedUserAvatarUrls() {
    const settings = getSettings();

    if (settings.useActiveUserPersonaAvatar) {
        const context = SillyTavern.getContext();
        const connectedPersonas = Array.isArray(context.connectedPersonas)
            ? context.connectedPersonas
            : Array.isArray(context.activePersonas)
                ? context.activePersonas
                : [];
        const candidates = connectedPersonas.length > 0
            ? connectedPersonas
            : context.selectedPersona
                ? [context.selectedPersona]
                : [];
        const avatarUrls = [];
        const seen = new Set();
        for (const persona of candidates) {
            const url = personaAvatarUrl(persona);
            if (!url || seen.has(url)) {
                continue;
            }
            seen.add(url);
            avatarUrls.push(url);
        }
        if (avatarUrls.length > 0) {
            console.log('[IIG] Using connected persona avatars:', avatarUrls.length);
            return avatarUrls;
        }

        try {
            const personasModule = await loadPersonasModule();
            const activeAvatarId = String(personasModule?.user_avatar || '').trim();
            if (!activeAvatarId) {
                console.log('[IIG] No active user persona avatar selected');
                if (!settings.userAvatarFile) {
                    return [];
                }
            } else {
                if (typeof personasModule?.getUserAvatar === 'function') {
                    const resolved = String(personasModule.getUserAvatar(activeAvatarId) || '').trim();
                    if (resolved) {
                        const normalized = resolved.replace(/^\/+/, '');
                        console.log('[IIG] Using active user persona avatar:', normalized);
                        return [`/${normalized}`];
                    }
                }

                const fallback = `/User Avatars/${encodeURIComponent(activeAvatarId)}`;
                console.log('[IIG] Falling back to active user persona avatar path:', fallback);
                return [fallback];
            }
        } catch (error) {
            console.error('[IIG] Failed to resolve active user persona avatar:', error);
            if (!settings.userAvatarFile) {
                return [];
            }
        }
    }

    if (!settings.userAvatarFile) {
        console.log('[IIG] No user avatar selected in settings');
        return [];
    }

    const avatarUrl = `/User Avatars/${encodeURIComponent(settings.userAvatarFile)}`;
    console.log('[IIG] Using selected user avatar:', avatarUrl);
    return [avatarUrl];
}

async function getSelectedUserAvatarUrl() {
    const avatars = await getSelectedUserAvatarUrls();
    return avatars[0] || null;
}

/**
 * Get user avatar as base64 (full resolution, not thumbnail)
 */
async function getUserAvatarBase64() {
    try {
        const avatarUrl = await getSelectedUserAvatarUrl();
        if (!avatarUrl) {
            return null;
        }
        return await imageUrlToBase64(avatarUrl);
    } catch (error) {
        console.error('[IIG] Error getting user avatar:', error);
        return null;
    }
}

async function getUserAvatarBase64List() {
    const avatarUrls = await getSelectedUserAvatarUrls();
    const refs = [];
    for (const avatarUrl of avatarUrls) {
        try {
            const b64 = await imageUrlToBase64(avatarUrl);
            if (b64) refs.push(b64);
        } catch (error) {
            console.error('[IIG] Error getting user avatar:', error);
        }
    }
    return refs;
}

/**
 * Generate image via OpenAI-compatible endpoint
 */
async function generateImageOpenAI(prompt, style, referenceImages = [], options = {}) {
    const settings = getSettings();
    const url = `${settings.endpoint.replace(/\/$/, '')}/v1/images/generations`;

    const fullPrompt = buildFinalGenerationPrompt(prompt, style, options.matchedAdditionalRefs || [], settings);

    // Map aspect ratio to size if provided in tag
    let size = settings.size;
    if (options.aspectRatio) {
        if (options.aspectRatio === '16:9') size = '1792x1024';
        else if (options.aspectRatio === '9:16') size = '1024x1792';
        else if (options.aspectRatio === '1:1') size = '1024x1024';
    }

    const body = {
        model: settings.model,
        prompt: fullPrompt,
        n: 1,
        size: size,
        quality: options.quality || settings.quality,
        response_format: 'b64_json'
    };

    // Add reference images if supported by the OpenAI-compatible provider.
    if (referenceImages.length > 0) {
        const images = referenceImages.slice(0, MAX_GENERATION_REFERENCE_IMAGES).map((image) => `data:image/png;base64,${image}`);
        body.image = images.length === 1 ? images[0] : images;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${settings.apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: options.signal,
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API Error (${response.status}): ${text}`);
    }

    const result = await response.json();

    // Parse response - standard OpenAI format
    const dataList = result.data || [];
    if (dataList.length === 0) {
        if (result.url) return result.url;
        throw new Error('No image data in response');
    }

    const imageObj = dataList[0];
    const imageData = imageObj.b64_json || imageObj.url;

    // Return as data URL if b64_json
    if (imageObj.b64_json) {
        return `data:image/png;base64,${imageObj.b64_json}`;
    }

    return imageData;
}

// Valid aspect ratios for Gemini/nano-banana
const VALID_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
// Valid image sizes for Gemini/nano-banana
const VALID_IMAGE_SIZES = ['1K', '2K', '4K'];

/**
 * Generate image via Gemini-compatible endpoint (nano-banana)
 */
async function generateImageGemini(prompt, style, referenceImages = [], options = {}) {
    const settings = getSettings();
    const model = settings.model;
    const url = `${settings.endpoint.replace(/\/$/, '')}/v1beta/models/${model}:generateContent`;

    // Determine aspect ratio: tag option > settings, with validation
    let aspectRatio = options.aspectRatio || settings.aspectRatio || '1:1';
    if (!VALID_ASPECT_RATIOS.includes(aspectRatio)) {
        iigLog('WARN', `Invalid aspect_ratio "${aspectRatio}", falling back to settings or default`);
        aspectRatio = VALID_ASPECT_RATIOS.includes(settings.aspectRatio) ? settings.aspectRatio : '1:1';
    }

    // Determine image size: tag option > settings, with validation
    let imageSize = options.imageSize || settings.imageSize || '1K';
    if (!VALID_IMAGE_SIZES.includes(imageSize)) {
        iigLog('WARN', `Invalid image_size "${imageSize}", falling back to settings or default`);
        imageSize = VALID_IMAGE_SIZES.includes(settings.imageSize) ? settings.imageSize : '1K';
    }

    iigLog('INFO', `Using aspect ratio: ${aspectRatio}, image size: ${imageSize}`);

    // Build parts array
    const parts = [];

    // Add reference images first
    for (const imgB64 of referenceImages.slice(0, MAX_GENERATION_REFERENCE_IMAGES)) {
        parts.push({
            inlineData: {
                mimeType: 'image/png',
                data: imgB64
            }
        });
    }

    // Add prompt with style and reference instruction
    let fullPrompt = buildFinalGenerationPrompt(prompt, style, options.matchedAdditionalRefs || [], settings);

    // If reference images provided, add instruction to copy appearance
    if (referenceImages.length > 0) {
        const refInstruction = `[CRITICAL: The reference image(s) above show the EXACT appearance of the character(s). You MUST precisely copy their: face structure, eye color, hair color and style, skin tone, body type, clothing, and all distinctive features. Do not deviate from the reference appearances.]`;
        fullPrompt = `${refInstruction}\n\n${fullPrompt}`;
    }

    parts.push({ text: fullPrompt });

    console.log(`[IIG] Gemini request: ${referenceImages.length} reference image(s) + prompt (${fullPrompt.length} chars)`);

    const body = {
        contents: [{
            role: 'user',
            parts: parts
        }],
        generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: {
                aspectRatio: aspectRatio,
                imageSize: imageSize
            }
        }
    };

    // Log full request config for debugging 400 errors
    iigLog('INFO', `Gemini request config: model=${model}, aspectRatio=${aspectRatio}, imageSize=${imageSize}, promptLength=${fullPrompt.length}, refImages=${referenceImages.length}`);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${settings.apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: options.signal,
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API Error (${response.status}): ${text}`);
    }

    const result = await response.json();

    // Parse Gemini response
    const candidates = result.candidates || [];
    if (candidates.length === 0) {
        throw new Error('No candidates in response');
    }

    const responseParts = candidates[0].content?.parts || [];

    for (const part of responseParts) {
        // Check both camelCase and snake_case variants
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
        if (part.inline_data) {
            return `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
        }
    }

    throw new Error('No image found in Gemini response');
}

/**
 * Get user avatar as data URL (for Naistera references)
 * Uses either the active persona avatar or the manually selected file.
 */
async function getUserAvatarDataUrl() {
    try {
        const avatarUrl = await getSelectedUserAvatarUrl();
        if (!avatarUrl) {
            return null;
        }
        return await imageUrlToDataUrl(avatarUrl);
    } catch (error) {
        console.error('[IIG] Error getting user avatar data URL:', error);
        return null;
    }
}

async function getUserAvatarDataUrlList() {
    const avatarUrls = await getSelectedUserAvatarUrls();
    const refs = [];
    for (const avatarUrl of avatarUrls) {
        try {
            const dataUrl = await imageUrlToDataUrl(avatarUrl);
            if (dataUrl) refs.push(dataUrl);
        } catch (error) {
            console.error('[IIG] Error getting user avatar data URL:', error);
        }
    }
    return refs;
}

/**
 * Generate image via Naistera custom endpoint
 * POST {endpoint}/api/generate
 * Auth: Authorization: Bearer <token>
 * Response: { data_url, content_type, media_kind?, poster_data_url? }
 */
async function generateImageNaistera(prompt, style, options = {}) {
    const settings = getSettings();
    const endpoint = getEffectiveEndpoint(settings);
    const url = endpoint.endsWith('/api/generate') ? endpoint : `${endpoint}/api/generate`;

    const aspectRatio = options.aspectRatio || settings.naisteraAspectRatio || '1:1';
    const model = normalizeNaisteraModel(options.model || settings.naisteraModel || 'grok');
    const preset = options.preset || null;
    const referenceImages = options.referenceImages || [];
    const wantsVideoTest = Boolean(options.videoTestMode);
    const videoEveryN = normalizeNaisteraVideoFrequency(options.videoEveryN ?? settings.naisteraVideoEveryN);
    let fullPrompt = buildFinalGenerationPrompt(prompt, style, options.matchedAdditionalRefs || [], settings);

    if (referenceImages.length > 0) {
        const refInstruction = `[CRITICAL: The reference image(s) above show the EXACT appearance of the character(s). You MUST precisely copy their: face structure, eye color, hair color and style, skin tone, body type, clothing, and all distinctive features. Do not deviate from the reference appearances.]`;
        fullPrompt = `${refInstruction}\n\n${fullPrompt}`;
    }

    const body = {
        prompt: fullPrompt,
        aspect_ratio: aspectRatio,
        model,
    };
    if (preset) body.preset = preset;
    if (referenceImages.length > 0) {
        body.reference_images = referenceImages.slice(0, MAX_GENERATION_REFERENCE_IMAGES);
    }
    if (wantsVideoTest) {
        body.video_test_mode = true;
        body.video_test_every_n_messages = videoEveryN;
    }

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body),
            signal: options.signal,
        });
    } catch (error) {
        const pageOrigin = window.location.origin;
        let endpointOrigin = endpoint;
        try {
            endpointOrigin = new URL(url, window.location.href).origin;
        } catch (parseErr) {
            console.warn('[IIG] Failed to parse Naistera endpoint origin:', parseErr);
        }
        const rawMessage = String(error?.message || '').trim() || 'Failed to fetch';
        throw new Error(
            `Network/CORS error while requesting ${endpointOrigin} from ${pageOrigin}. `
            + `The browser blocked access to the response before the API could return JSON. `
            + `Original error: ${rawMessage}`
        );
    }

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API Error (${response.status}): ${text}`);
    }

    const result = await response.json();
    if (!result?.data_url) {
        throw new Error('No data_url in response');
    }
    if (result.media_kind === 'video') {
        return {
            kind: 'video',
            dataUrl: result.data_url,
            posterDataUrl: result.poster_data_url || '',
            contentType: result.content_type || 'video/mp4',
        };
    }
    return result.data_url;
}

/**
 * Validate settings before generation
 */
function validateSettings() {
    const settings = getSettings();
    const errors = [];

    if (!settings.endpoint) {
        if (settings.apiType !== 'naistera') {
            errors.push('URL эндпоинта не настроен');
        }
    }
    if (!settings.apiKey) {
        errors.push('API ключ не настроен');
    }
    if (settings.apiType !== 'naistera' && !settings.model) {
        errors.push('Модель не выбрана');
    }
    if (settings.apiType === 'naistera') {
        const m = normalizeNaisteraModel(settings.naisteraModel);
        if (!NAISTERA_MODELS.includes(m)) {
            errors.push('Для Naistera выберите модель: grok / grok-pro / nano banana');
        }
    }

    if (errors.length > 0) {
        throw new Error(`Ошибка настроек: ${errors.join(', ')}`);
    }
}

/**
 * Sanitize text for safe HTML display
 */
function sanitizeForHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

const INSTRUCTION_FIELD_NAMES = Object.freeze([
    'style',
    'prompt',
    'aspect_ratio',
    'aspectRatio',
    'preset',
    'image_size',
    'imageSize',
    'quality',
]);

function normalizeInstructionPayload(text) {
    return String(text || '')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&#34;/g, '"')
        .replace(/&amp;/g, '&');
}

function decodeRelaxedInstructionValue(value) {
    return String(value || '')
        .trim()
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, '\\');
}

function parseRelaxedInstructionObject(payload) {
    const normalized = normalizeInstructionPayload(payload);
    const keyRegex = /(["'])(style|prompt|aspect_ratio|aspectRatio|preset|image_size|imageSize|quality)\1\s*:\s*(["'])/g;
    const matches = Array.from(normalized.matchAll(keyRegex));
    if (matches.length === 0) {
        return null;
    }

    const result = {};

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const key = match[2];
        const valueQuote = match[3];
        const valueStart = match.index + match[0].length;
        const nextKeyIndex = i + 1 < matches.length ? matches[i + 1].index : normalized.lastIndexOf('}');
        const rawValue = normalized.substring(
            valueStart,
            nextKeyIndex === -1 ? normalized.length : nextKeyIndex
        );

        let value = rawValue.trim();
        if (value.endsWith(',')) {
            value = value.slice(0, -1).trimEnd();
        }
        if (value.endsWith(valueQuote)) {
            value = value.slice(0, -1);
        }

        result[key] = decodeRelaxedInstructionValue(value);
    }

    return Object.keys(result).length > 0 ? result : null;
}

function parseInstructionObject(payload) {
    const normalized = normalizeInstructionPayload(payload);

    try {
        return JSON.parse(normalized);
    } catch (error) {
        const relaxed = parseRelaxedInstructionObject(normalized);
        if (relaxed) {
            return relaxed;
        }
        throw error;
    }
}

function sanitizeForSingleQuotedAttribute(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function buildInstructionData(tag) {
    const data = {};

    if (tag.style) data.style = tag.style;
    if (tag.prompt) data.prompt = tag.prompt;
    if (tag.aspectRatio) data.aspect_ratio = tag.aspectRatio;
    if (tag.preset) data.preset = tag.preset;
    if (tag.imageSize) data.image_size = tag.imageSize;
    if (tag.quality) data.quality = tag.quality;

    return data;
}

function getInstructionAttributeValue(tag) {
    if (tag.isNewFormat && tag.fullMatch) {
        const instructionMatch = tag.fullMatch.match(/data-iig-instruction\s*=\s*(['"])([\s\S]*?)\1/i);
        if (instructionMatch) {
            return instructionMatch[2];
        }
    }

    return JSON.stringify(buildInstructionData(tag));
}

function isGeneratedVideoResult(value) {
    return Boolean(value) && typeof value === 'object' && value.kind === 'video' && typeof value.dataUrl === 'string';
}

function createGeneratedMediaElement(result, tag) {
    if (isGeneratedVideoResult(result)) {
        const video = document.createElement('video');
        video.className = 'iig-generated-video';
        video.src = result.dataUrl;
        video.controls = true;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.title = `Style: ${tag.style}\nPrompt: ${tag.prompt}`;
        if (result.posterDataUrl) {
            video.poster = result.posterDataUrl;
        }
        return video;
    }

    const img = document.createElement('img');
    img.className = 'iig-generated-image';
    img.src = result;
    img.alt = tag.prompt;
    img.title = `Style: ${tag.style}\nPrompt: ${tag.prompt}`;
    return img;
}

function buildPersistedVideoTag(templateHtml, persistedSrc, posterSrc = '') {
    let html = String(templateHtml || '').trim()
        .replace(/^<(?:img|video)\b/i, '<video controls autoplay loop muted playsinline')
        .replace(/<\/video>\s*$/i, '')
        .replace(/\/?>\s*$/i, '')
        .replace(/src\s*=\s*(['"])[^'"]*\1/i, `src="${persistedSrc}"`);
    html = html.replace(/\s+poster\s*=\s*(['"])[\s\S]*?\1/i, '');
    if (posterSrc) {
        html = html.replace(/^<video\b/i, `<video poster="${sanitizeForHtml(posterSrc)}"`);
    }
    return `${html}></video>`;
}

function buildPendingLegacyTag(tag) {
    const instruction = sanitizeForSingleQuotedAttribute(getInstructionAttributeValue(tag));
    return `<img data-iig-instruction='${instruction}' src="[IMG:GEN]">`;
}

function buildPendingMediaTag(tag) {
    if (!tag?.isNewFormat) {
        return buildPendingLegacyTag(tag);
    }

    const marker = tag.mediaTagName === 'video' ? '[VID:GEN]' : '[IMG:GEN]';
    const templateHtml = String(tag.fullMatch || '').trim();
    if (/\ssrc\s*=\s*(['"])[\s\S]*?\1/i.test(templateHtml)) {
        return templateHtml.replace(/\ssrc\s*=\s*(['"])[\s\S]*?\1/i, ` src="${marker}"`);
    }
    return templateHtml.replace(/^<(img|video)\b/i, `<$1 src="${marker}"`);
}

function buildPersistedImageTag(tag, persistedSrc) {
    const templateHtml = tag?.isNewFormat ? tag.fullMatch : buildPendingLegacyTag(tag);
    return String(templateHtml || '').replace(/src\s*=\s*(['"])[^'"]*\1/i, `src="${persistedSrc}"`);
}

function buildPersistedMediaTag(tag, generated, persistedSrc, posterSrc = '') {
    return isGeneratedVideoResult(generated)
        ? buildPersistedVideoTag(tag?.fullMatch, persistedSrc, posterSrc)
        : buildPersistedImageTag(tag, persistedSrc);
}

function convertLegacyTagsToInstructionFormat(message, tags) {
    let convertedLegacyTags = 0;

    for (const tag of tags) {
        if (tag.isNewFormat) {
            continue;
        }

        const pendingTag = buildPendingLegacyTag(tag);
        replaceTagInMessageSource(message, tag, pendingTag);
        tag.fullMatch = pendingTag;
        tag.isNewFormat = true;
        convertedLegacyTags += 1;
    }

    return convertedLegacyTags;
}

function rerenderMessageHtml(context, message, settings, messageId, mesTextEl) {
    if (!mesTextEl) {
        return;
    }

    const formattedMessage = typeof context.messageFormatting === 'function'
        ? context.messageFormatting(
            getMessageRenderText(message, settings),
            message.name,
            message.is_system,
            message.is_user,
            messageId
        )
        : getMessageRenderText(message, settings);

    mesTextEl.innerHTML = formattedMessage;
}

/**
 * Generate image with retry logic
 * @param {string} prompt - Image description
 * @param {string} style - Style tag
 * @param {function} onStatusUpdate - Status callback
 * @param {object} options - Additional options (aspectRatio, quality)
 */
async function generateImageWithRetry(prompt, style, onStatusUpdate, options = {}) {
    // Validate settings first
    validateSettings();
    if (options.signal?.aborted) {
        throw new DOMException('Image generation cancelled', 'AbortError');
    }

    const settings = getSettings();
    const maxRetries = settings.maxRetries;
    const baseDelay = settings.retryDelay;
    const normalizedNaisteraModel = normalizeNaisteraModel(options.model || settings.naisteraModel);
    const naisteraRefsSupported = naisteraModelSupportsReferences(normalizedNaisteraModel);

    // Collect reference images (provider-specific)
    const referenceImages = [];
    const referenceDataUrls = [];

    // Gemini/nano-banana references: base64 only
    if (settings.apiType === 'gemini' || isGeminiModel(settings.model)) {
        if (settings.sendCharAvatar) {
            const charAvatar = await getCharacterAvatarBase64();
            if (charAvatar) referenceImages.push(charAvatar);
        }
        if (settings.sendUserAvatar) {
            const userAvatars = await getUserAvatarBase64List();
            referenceImages.push(...userAvatars);
        }
    }

    // Naistera references: data URLs (server uploads to Grok)
    if (settings.apiType === 'naistera' && naisteraRefsSupported) {
        if (settings.naisteraSendCharAvatar) {
            const d = await getCharacterAvatarDataUrl();
            if (d) referenceDataUrls.push(d);
        }
        if (settings.naisteraSendUserAvatar) {
            const userAvatars = await getUserAvatarDataUrlList();
            referenceDataUrls.push(...userAvatars);
        }
    }

    const matchedAdditionalRefs = getMatchedAdditionalReferences(prompt);
    if (matchedAdditionalRefs.length > 0) {
        iigLog(
            'INFO',
            `Matched additional refs: ${matchedAdditionalRefs.map((ref) => `${ref.name} [${ref.matchMode}] => ${ref.description || ref.name}`).join(', ')}`
        );
    }

    for (const ref of matchedAdditionalRefs) {
        if (referenceImages.length >= MAX_GENERATION_REFERENCE_IMAGES && referenceDataUrls.length >= MAX_GENERATION_REFERENCE_IMAGES) {
            break;
        }

        const imagePath = normalizeStoredImagePath(ref.imagePath);
        if (!imagePath) {
            continue;
        }

        if ((settings.apiType === 'gemini' || isGeminiModel(settings.model)) && referenceImages.length < MAX_GENERATION_REFERENCE_IMAGES) {
            const b64 = await imageUrlToBase64(imagePath);
            if (b64) {
                referenceImages.push(b64);
            }
        }

        if (settings.apiType === 'naistera' && naisteraRefsSupported && referenceDataUrls.length < MAX_GENERATION_REFERENCE_IMAGES) {
            const dataUrl = await imageUrlToDataUrl(imagePath);
            if (dataUrl) {
                referenceDataUrls.push(dataUrl);
            }
        }
    }

    if (settings.imageContextEnabled) {
        const contextCount = normalizeImageContextCount(settings.imageContextCount);
        if (settings.apiType === 'gemini' || isGeminiModel(settings.model)) {
            const contextRefs = await collectPreviousContextReferences(
                options.messageId,
                'base64',
                contextCount
            );
            referenceImages.push(...contextRefs);
        }
        if (settings.apiType === 'naistera' && naisteraRefsSupported) {
            const contextRefs = await collectPreviousContextReferences(
                options.messageId,
                'dataUrl',
                contextCount
            );
            referenceDataUrls.push(...contextRefs);
        }
    }

    if (referenceImages.length > MAX_GENERATION_REFERENCE_IMAGES) {
        referenceImages.length = MAX_GENERATION_REFERENCE_IMAGES;
    }
    if (referenceDataUrls.length > MAX_GENERATION_REFERENCE_IMAGES) {
        referenceDataUrls.length = MAX_GENERATION_REFERENCE_IMAGES;
    }

    const enableVideoTest = settings.apiType === 'naistera'
        && settings.naisteraVideoTest
        && shouldUseNaisteraVideoTest(options.model || settings.naisteraModel)
        && shouldTriggerNaisteraVideoForMessage(options.messageId, settings.naisteraVideoEveryN);

    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (options.signal?.aborted) {
                throw new DOMException('Image generation cancelled', 'AbortError');
            }
            onStatusUpdate?.(`Генерация${attempt > 0 ? ` (повтор ${attempt}/${maxRetries})` : ''}...`);
            let generated;
            // Choose API based on type or model
            if (settings.apiType === 'naistera') {
                generated = await generateImageNaistera(prompt, style, {
                    ...options,
                    referenceImages: referenceDataUrls,
                    matchedAdditionalRefs,
                    videoTestMode: enableVideoTest,
                    videoEveryN: settings.naisteraVideoEveryN,
                });
            } else if (settings.apiType === 'gemini' || isGeminiModel(settings.model)) {
                generated = await generateImageGemini(prompt, style, referenceImages, {
                    ...options,
                    matchedAdditionalRefs,
                });
            } else {
                generated = await generateImageOpenAI(prompt, style, referenceImages, {
                    ...options,
                    matchedAdditionalRefs,
                });
            }

            if (generated && typeof generated === 'object' && generated.kind === 'video') {
                iigLog(
                    'INFO',
                    `Generation result: apiType=${settings.apiType} kind=video mime=${generated.contentType} poster=${generated.posterDataUrl ? 'yes' : 'no'}`
                );
            } else if (typeof generated === 'string' && generated.startsWith('data:')) {
                try {
                    const parsed = parseImageDataUrl(generated);
                    iigLog(
                        'INFO',
                        `Generation result: apiType=${settings.apiType} mime=${parsed.mimeType} subtype=${parsed.subtype} b64len=${parsed.base64Data.length}`
                    );
                } catch (parseErr) {
                    iigLog(
                        'WARN',
                        `Generation result has unparsable data URL: ${parseErr.message}; prefix=${generated.slice(0, 120)}`
                    );
                }
            } else {
                iigLog(
                    'INFO',
                    `Generation result is non-data-url: apiType=${settings.apiType} value=${String(generated).slice(0, 160)}`
                );
            }
            return generated;
        } catch (error) {
            if (isGenerationCancelled(error)) {
                throw error;
            }
            lastError = error;
            console.error(`[IIG] Generation attempt ${attempt + 1} failed:`, error);

            // Check if retryable
            const isRetryable = error.message?.includes('429') ||
                               error.message?.includes('503') ||
                               error.message?.includes('502') ||
                               error.message?.includes('504') ||
                               error.message?.includes('timeout') ||
                               error.message?.includes('network');

            if (!isRetryable || attempt === maxRetries) {
                break;
            }

            const delay = baseDelay * Math.pow(2, attempt);
            onStatusUpdate?.(`Повтор через ${delay / 1000}с...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

/**
 * Check if a file exists on the server
 */
async function checkFileExists(path) {
    try {
        const response = await fetch(path, { method: 'HEAD' });
        return response.ok;
    } catch (e) {
        return false;
    }
}

/**
 * Parse image generation tags from message text
 * Supports two formats:
 * 1. NEW: <img|video data-iig-instruction='{"style":"...","prompt":"..."}' src="...">
 * 2. LEGACY: [IMG:GEN:{"style":"...","prompt":"..."}]
 *
 * @param {string} text - Message text
 * @param {object} options - Options
 * @param {boolean} options.checkExistence - Check if image files exist (for hallucination detection)
 * @param {boolean} options.forceAll - Include all instruction tags even with valid paths (for regeneration)
 */
async function parseImageTags(text, options = {}) {
    const { checkExistence = false, forceAll = false } = options;
    const tags = [];

    // === NEW FORMAT: <img|video data-iig-instruction="{...}" src="..."> ===
    // LLM often generates broken HTML with unescaped quotes, so we parse manually
    const imgTagMarker = 'data-iig-instruction=';
    let searchPos = 0;

    while (true) {
        const markerPos = text.indexOf(imgTagMarker, searchPos);
        if (markerPos === -1) break;

        // Find the start of the media tag.
        const imgStart = text.lastIndexOf('<img', markerPos);
        const videoStart = text.lastIndexOf('<video', markerPos);
        const mediaStart = Math.max(imgStart, videoStart);
        const isVideoTag = mediaStart === videoStart && videoStart !== -1;
        const tagName = isVideoTag ? 'video' : 'img';
        if (mediaStart === -1 || markerPos - mediaStart > 800) {
            searchPos = markerPos + 1;
            continue;
        }

        // Find the JSON start (first { after the marker)
        const afterMarker = markerPos + imgTagMarker.length;
        let jsonStart = text.indexOf('{', afterMarker);
        if (jsonStart === -1 || jsonStart > afterMarker + 10) {
            searchPos = markerPos + 1;
            continue;
        }

        // Find matching closing brace using brace counting
        let braceCount = 0;
        let jsonEnd = -1;
        let inString = false;
        let escapeNext = false;

        for (let i = jsonStart; i < text.length; i++) {
            const char = text[i];

            if (escapeNext) {
                escapeNext = false;
                continue;
            }

            if (char === '\\' && inString) {
                escapeNext = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === '{') {
                    braceCount++;
                } else if (char === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        jsonEnd = i + 1;
                        break;
                    }
                }
            }
        }

        if (jsonEnd === -1) {
            searchPos = markerPos + 1;
            continue;
        }

        // Find the end of the media tag.
        let mediaEnd = -1;
        if (isVideoTag) {
            mediaEnd = text.indexOf('</video>', jsonEnd);
            if (mediaEnd !== -1) {
                mediaEnd += '</video>'.length;
            }
        } else {
            mediaEnd = text.indexOf('>', jsonEnd);
            if (mediaEnd !== -1) {
                mediaEnd += 1;
            }
        }
        if (mediaEnd === -1) {
            searchPos = markerPos + 1;
            continue;
        }

        const fullImgTag = text.substring(mediaStart, mediaEnd);
        const instructionJson = text.substring(jsonStart, jsonEnd);

        // Check if src needs generation
        const srcMatch = fullImgTag.match(/src\s*=\s*["']?([^"'\s>]+)/i);
        const srcValue = srcMatch ? srcMatch[1] : '';

        // Determine if this needs generation
        let needsGeneration = false;
        const hasMarker = srcValue.includes('[IMG:GEN]') || srcValue.includes('[IMG:');
        const hasErrorImage = srcValue.includes('error.svg'); // Our error placeholder - NO auto-retry
        const hasPath = srcValue && srcValue.startsWith('/') && srcValue.length > 5;

        // Skip error images - user must click to retry manually (prevents conflict on swipe)
        if (hasErrorImage && !forceAll) {
            iigLog('INFO', `Skipping error image (click to retry): ${srcValue.substring(0, 50)}`);
            searchPos = imgEnd;
            continue;
        }

        if (forceAll) {
            // Regeneration mode: include all tags with instruction (user-triggered)
            needsGeneration = true;
            iigLog('INFO', `Force regeneration mode: including ${srcValue.substring(0, 30)}`);
        } else if (hasMarker || !srcValue) {
            // Explicit marker or empty src = needs generation
            needsGeneration = true;
        } else if (hasPath && checkExistence) {
            // Has a path - check if file actually exists
            const exists = await checkFileExists(srcValue);
            if (!exists) {
                // File doesn't exist = LLM hallucinated the path
                iigLog('WARN', `File does not exist (LLM hallucination?): ${srcValue}`);
                needsGeneration = true;
            } else {
                iigLog('INFO', `Skipping existing image: ${srcValue.substring(0, 50)}`);
            }
        } else if (hasPath) {
            // Has path but not checking existence - skip
            iigLog('INFO', `Skipping path (no existence check): ${srcValue.substring(0, 50)}`);
            searchPos = imgEnd;
            continue;
        }

        if (!needsGeneration) {
            searchPos = imgEnd;
            continue;
        }

        try {
            const data = parseInstructionObject(instructionJson);

            tags.push({
                fullMatch: fullImgTag,
                index: mediaStart,
                style: data.style || '',
                prompt: data.prompt || '',
                aspectRatio: data.aspect_ratio || data.aspectRatio || null,
                preset: data.preset || null,
                imageSize: data.image_size || data.imageSize || null,
                quality: data.quality || null,
                isNewFormat: true,
                mediaTagName: tagName,
                existingSrc: hasPath ? srcValue : null // Store existing src for logging
            });

            iigLog('INFO', `Found NEW format tag: ${data.prompt?.substring(0, 50)}`);
        } catch (e) {
            iigLog('WARN', `Failed to parse instruction JSON: ${instructionJson.substring(0, 100)}`, e.message);
        }

        searchPos = mediaEnd;
    }

    // === LEGACY FORMAT: [IMG:GEN:{...}] ===
    const marker = '[IMG:GEN:';
    let searchStart = 0;

    while (true) {
        const markerIndex = text.indexOf(marker, searchStart);
        if (markerIndex === -1) break;

        const jsonStart = markerIndex + marker.length;

        // Find the matching closing brace for JSON
        let braceCount = 0;
        let jsonEnd = -1;
        let inString = false;
        let escapeNext = false;

        for (let i = jsonStart; i < text.length; i++) {
            const char = text[i];

            if (escapeNext) {
                escapeNext = false;
                continue;
            }

            if (char === '\\' && inString) {
                escapeNext = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === '{') {
                    braceCount++;
                } else if (char === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        jsonEnd = i + 1;
                        break;
                    }
                }
            }
        }

        if (jsonEnd === -1) {
            searchStart = jsonStart;
            continue;
        }

        const jsonStr = text.substring(jsonStart, jsonEnd);

        const afterJson = text.substring(jsonEnd);
        if (!afterJson.startsWith(']')) {
            searchStart = jsonEnd;
            continue;
        }

        const tagOnly = text.substring(markerIndex, jsonEnd + 1);

        try {
            const data = parseInstructionObject(jsonStr);

            tags.push({
                fullMatch: tagOnly,
                index: markerIndex,
                style: data.style || '',
                prompt: data.prompt || '',
                aspectRatio: data.aspect_ratio || data.aspectRatio || null,
                preset: data.preset || null,
                imageSize: data.image_size || data.imageSize || null,
                quality: data.quality || null,
                isNewFormat: false
            });

            iigLog('INFO', `Found LEGACY format tag: ${data.prompt?.substring(0, 50)}`);
        } catch (e) {
            iigLog('WARN', `Failed to parse legacy tag JSON: ${jsonStr.substring(0, 100)}`, e.message);
        }

        searchStart = jsonEnd + 1;
    }

    return tags;
}

/**
 * Create loading placeholder element
 */
function createLoadingPlaceholder(tagId) {
    const placeholder = document.createElement('div');
    placeholder.className = 'iig-loading-placeholder';
    placeholder.dataset.tagId = tagId;
    placeholder.innerHTML = `
        <div class="iig-spinner"></div>
        <div class="iig-status">Генерация картинки...</div>
    `;
    return placeholder;
}

// Error image path - served from extension folder
const ERROR_IMAGE_PATH = '/scripts/extensions/built-in/sillyimages/error.svg';

/**
 * Create error placeholder element - just shows error.svg, no click handlers
 * User uses the regenerate button in message menu to retry
 */
function createErrorPlaceholder(tagId, errorMessage, tagInfo) {
    const img = document.createElement('img');
    img.className = 'iig-error-image';
    img.src = ERROR_IMAGE_PATH;
    img.alt = 'Ошибка генерации';
    img.title = `Ошибка: ${errorMessage}`;
    img.dataset.tagId = tagId;

    // Preserve data-iig-instruction for regenerate button functionality
    if (tagInfo.fullMatch) {
        const instructionMatch = tagInfo.fullMatch.match(/data-iig-instruction\s*=\s*(['"])([\s\S]*?)\1/i);
        if (instructionMatch) {
            img.setAttribute('data-iig-instruction', instructionMatch[2]);
        }
    }

    return img;
}

function normalizeInstructionText(value) {
    return String(value || '')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&#34;/g, '"')
        .replace(/&amp;/g, '&')
        .trim();
}

function parseMediaInstruction(element) {
    const raw = normalizeInstructionText(element?.getAttribute?.('data-iig-instruction'));
    if (!raw) {
        return null;
    }
    try {
        return parseInstructionObject(raw);
    } catch (error) {
        return null;
    }
}

function getMediaElementsForGeneration(mesTextEl) {
    const media = Array.from(mesTextEl.querySelectorAll('img, video'));
    return media.sort((left, right) => {
        const leftHasInstruction = left.hasAttribute('data-iig-instruction') ? 0 : 1;
        const rightHasInstruction = right.hasAttribute('data-iig-instruction') ? 0 : 1;
        return leftHasInstruction - rightHasInstruction;
    });
}

function mediaElementMatchesTag(element, tag) {
    const instruction = parseMediaInstruction(element);
    const prompt = String(tag?.prompt || '').trim();
    if (instruction?.prompt && prompt && String(instruction.prompt).trim() === prompt) {
        return true;
    }

    const currentSrc = element.getAttribute('src') || element.getAttribute('poster') || element.getAttribute('data-iig-pending-src') || element.getAttribute('data-iig-pending-poster') || '';
    return Boolean(tag?.existingSrc && currentSrc === tag.existingSrc);
}

function findMediaElementForTag(mesTextEl, tag, index, cachedMediaElements = null) {
    const mediaElements = cachedMediaElements || getMediaElementsForGeneration(mesTextEl);
    const connectedMedia = mediaElements.filter(element => element.isConnected);
    const indexedElement = mediaElements[index];
    return connectedMedia.find(element => mediaElementMatchesTag(element, tag))
        || (indexedElement?.isConnected ? indexedElement : null)
        || connectedMedia[0]
        || null;
}

/**
 * Process image tags in a message
 */
async function processMessageTags(messageId) {
    const context = SillyTavern.getContext();
    const settings = getSettings();

    if (!settings.enabled) return;

    // Prevent duplicate processing
    if (processingMessages.has(messageId)) {
        iigLog('WARN', `Message ${messageId} is already being processed, skipping`);
        return;
    }

    const message = context.chat[messageId];
    if (!message || message.is_user) return;

    // Check for tags, with file existence check to catch LLM hallucinations
    const tags = await parseMessageImageTags(message, { checkExistence: true });
    iigLog('INFO', `parseImageTags returned: ${tags.length} tags`);
    if (tags.length > 0) {
        iigLog('INFO', `First tag: ${JSON.stringify(tags[0]).substring(0, 200)}`);
    }
    if (tags.length === 0) {
        iigLog('INFO', 'No tags found by parser');
        return;
    }

    // Mark as processing
    processingMessages.add(messageId);
    const controller = new AbortController();
    processingControllers.set(messageId, controller);
    notifyDoubleTroubleImagePending(messageId, true);
    iigLog('INFO', `Found ${tags.length} image tag(s) in message ${messageId}`);
    toastr.info(`Найдено тегов: ${tags.length}. Генерация...`, 'Генерация картинок', { timeOut: 3000 });

    // DOM is ready because we use CHARACTER_MESSAGE_RENDERED event
    const messageElement = document.querySelector(`#chat .mes[mesid="${messageId}"]`);
    if (!messageElement) {
        console.error('[IIG] Message element not found for ID:', messageId);
        toastr.error('Не удалось найти элемент сообщения', 'Генерация картинок');
        processingMessages.delete(messageId);
        processingControllers.delete(messageId);
        notifyDoubleTroubleImagePending(messageId, false);
        return;
    }

    const mesTextEl = messageElement.querySelector('.mes_text');
    if (!mesTextEl) {
        processingMessages.delete(messageId);
        processingControllers.delete(messageId);
        notifyDoubleTroubleImagePending(messageId, false);
        return;
    }

    const convertedLegacyTags = convertLegacyTagsToInstructionFormat(message, tags);

    if (convertedLegacyTags > 0) {
        rerenderMessageHtml(context, message, settings, messageId, mesTextEl);
        iigLog('INFO', `Converted ${convertedLegacyTags} legacy tag(s) to instruction tags before processing`);
    }

    let generationCancelled = false;

    // Process each tag in parallel
    const processTag = async (tag, index) => {
        const tagId = `iig-${messageId}-${index}`;
        applyConfiguredStyleToTag(tag, settings);

        iigLog('INFO', `Processing tag ${index}: ${tag.fullMatch.substring(0, 50)}`);

        // Create loading placeholder
        const loadingPlaceholder = createLoadingPlaceholder(tagId);
        let targetElement = null;

        // NEW FORMAT: <img|video data-iig-instruction='...'> is a real DOM element
        const allImgs = mesTextEl.querySelectorAll('img[data-iig-instruction], video[data-iig-instruction]');
        iigLog('INFO', `Searching for media element. Found ${allImgs.length} [data-iig-instruction] elements in DOM`);

        // Debug: log what we're looking for vs what's in DOM
        const searchPrompt = tag.prompt.substring(0, 30);
        iigLog('INFO', `Searching for prompt starting with: "${searchPrompt}"`);

        for (const img of allImgs) {
            const instruction = img.getAttribute('data-iig-instruction');
            const src = img.getAttribute('src') || '';
            iigLog('INFO', `DOM img - src: "${src.substring(0, 50)}", instruction (first 100): "${instruction?.substring(0, 100)}"`);

            // Try multiple matching strategies
            if (instruction) {
                // Strategy 1: Decode HTML entities and normalize quotes, then match
                const decodedInstruction = instruction
                    .replace(/&quot;/g, '"')
                    .replace(/&apos;/g, "'")
                    .replace(/&#39;/g, "'")
                    .replace(/&#34;/g, '"')
                    .replace(/&amp;/g, '&');

                // Also normalize the search prompt the same way
                const normalizedSearchPrompt = searchPrompt
                    .replace(/&quot;/g, '"')
                    .replace(/&apos;/g, "'")
                    .replace(/&#39;/g, "'")
                    .replace(/&#34;/g, '"')
                    .replace(/&amp;/g, '&');

                // Check if decoded instruction contains the prompt
                if (decodedInstruction.includes(normalizedSearchPrompt)) {
                    iigLog('INFO', `Found img element via decoded instruction match`);
                    targetElement = img;
                    break;
                }

                // Strategy 2: Try to parse the instruction as JSON and compare prompts
                try {
                    const normalizedJson = decodedInstruction.replace(/'/g, '"');
                    const instructionData = JSON.parse(normalizedJson);
                    if (instructionData.prompt && instructionData.prompt.substring(0, 30) === tag.prompt.substring(0, 30)) {
                        iigLog('INFO', `Found img element via JSON prompt match`);
                        targetElement = img;
                        break;
                    }
                } catch (e) {
                    // JSON parse failed, continue with other strategies
                }

                // Strategy 3: Raw instruction contains raw search prompt (original approach)
                if (instruction.includes(searchPrompt)) {
                    iigLog('INFO', `Found img element via raw instruction match`);
                    targetElement = img;
                    break;
                }
            }
        }

        // Alternative: find by src containing markers (when prompt matching fails)
        if (!targetElement) {
            iigLog('INFO', `Prompt matching failed, trying src marker matching...`);
            for (const img of allImgs) {
                const src = img.getAttribute('src') || '';
                // Check for generation markers or empty/broken src
                if (src.includes('[IMG:GEN]') || src.includes('[IMG:ERROR]') || src === '' || src === '#') {
                    iigLog('INFO', `Found img element with generation marker in src: "${src}"`);
                    targetElement = img;
                    break;
                }
            }
        }

        // Strategy 4: If still not found, try looking at all media nodes
        // This handles cases where browser didn't parse data-iig-instruction as a valid attribute
        if (!targetElement) {
            iigLog('INFO', `Trying broader media search...`);
            const allImgsInMes = mesTextEl.querySelectorAll('img, video');
            for (const img of allImgsInMes) {
                const src = img.getAttribute('src') || '';
                // Look for src containing our markers
                if (src.includes('[IMG:GEN]') || src.includes('[IMG:ERROR]')) {
                    iigLog('INFO', `Found img via broad search with marker src: "${src.substring(0, 50)}"`);
                    targetElement = img;
                    break;
                }
            }
        }

        // Replace target with placeholder, preserving parent styling context
        if (targetElement) {
            // Copy some styling context from parent for adaptive placeholder
            const parent = targetElement.parentElement;
            if (parent) {
                const parentStyle = window.getComputedStyle(parent);
                if (parentStyle.display === 'flex' || parentStyle.display === 'grid') {
                    loadingPlaceholder.style.alignSelf = 'center';
                }
            }
            targetElement.replaceWith(loadingPlaceholder);
            iigLog('INFO', `Loading placeholder shown (replaced target element)`);
        } else {
            iigLog('WARN', `Could not find target element, appending placeholder as fallback`);
            mesTextEl.appendChild(loadingPlaceholder);
        }

        const statusEl = loadingPlaceholder.querySelector('.iig-status');

        try {
            const generated = await generateImageWithRetry(
                tag.prompt,
                tag.style,
                (status) => { statusEl.textContent = status; },
                { aspectRatio: tag.aspectRatio, imageSize: tag.imageSize, quality: tag.quality, preset: tag.preset, messageId, signal: controller.signal }
            );

            let persistedSrc = '';
            let persistedPosterSrc = '';
            if (isGeneratedVideoResult(generated)) {
                statusEl.textContent = 'Сохранение видео...';
                persistedSrc = await saveNaisteraMediaToFile(generated.dataUrl, 'video', {
                    messageId,
                    tagIndex: index,
                    mode: 'generate-video',
                    apiType: getSettings().apiType,
                });
                if (generated.posterDataUrl) {
                    statusEl.textContent = 'Сохранение превью...';
                    persistedPosterSrc = await saveImageToFile(generated.posterDataUrl, {
                        messageId,
                        tagIndex: index,
                        mode: 'generate-video-poster',
                        apiType: getSettings().apiType,
                    });
                }
            } else {
                statusEl.textContent = 'Сохранение...';
                persistedSrc = await saveImageToFile(generated, {
                    messageId,
                    tagIndex: index,
                    mode: 'generate',
                    apiType: getSettings().apiType,
                });
            }

            const mediaElement = createGeneratedMediaElement(
                isGeneratedVideoResult(generated)
                    ? { ...generated, dataUrl: persistedSrc, posterDataUrl: persistedPosterSrc || generated.posterDataUrl || '' }
                    : persistedSrc,
                tag,
            );

            const instructionValue = getInstructionAttributeValue(tag);
            if (instructionValue) {
                mediaElement.setAttribute('data-iig-instruction', instructionValue);
            }

            loadingPlaceholder.replaceWith(mediaElement);

            const updatedTag = buildPersistedMediaTag(tag, generated, persistedSrc, persistedPosterSrc);
            replaceTagInMessageSource(message, tag, updatedTag);

            iigLog('INFO', `Successfully generated ${isGeneratedVideoResult(generated) ? 'video' : 'image'} for tag ${index}`);
            toastr.success(
                `${isGeneratedVideoResult(generated) ? 'Видео' : 'Картинка'} ${index + 1}/${tags.length} готов${isGeneratedVideoResult(generated) ? 'о' : 'а'}`,
                'Генерация картинок',
                { timeOut: 2000 }
            );
        } catch (error) {
            if (isGenerationCancelled(error)) {
                generationCancelled = true;
                iigLog('INFO', `Generation cancelled for message ${messageId}, tag ${index}`);
                if (targetElement) {
                    loadingPlaceholder.replaceWith(targetElement);
                } else {
                    loadingPlaceholder.remove();
                }
                return;
            }
            iigLog('ERROR', `Failed to generate image for tag ${index}:`, error.message);

            // Replace with error placeholder
            const errorPlaceholder = createErrorPlaceholder(tagId, error.message, tag);
            loadingPlaceholder.replaceWith(errorPlaceholder);

            // IMPORTANT: Mark tag as failed in message.mes - use error.svg path so it displays properly after swipe
            if (tag.isNewFormat) {
                // NEW FORMAT: update src with error image path (will be detected for retry)
                const errorTag = tag.fullMatch.replace(/src\s*=\s*(['"])[^'"]*\1/i, `src="${ERROR_IMAGE_PATH}"`);
                replaceTagInMessageSource(message, tag, errorTag);
            } else {
                // LEGACY FORMAT: replace with error marker
                const errorMarker = `[IMG:ERROR:${error.message.substring(0, 50)}]`;
                replaceTagInMessageSource(message, tag, errorMarker);
            }
            iigLog('INFO', `Marked tag as failed in message.mes`);

            toastr.error(`Ошибка генерации: ${error.message}`, 'Генерация картинок');
        }
    };

    try {
        // Process all tags in parallel
        await Promise.all(tags.map((tag, index) => processTag(tag, index)));
    } finally {
        // Always remove from processing set
        processingMessages.delete(messageId);
        processingControllers.delete(messageId);
        notifyDoubleTroubleImagePending(messageId, false);
        iigLog('INFO', `Finished processing message ${messageId}`);
    }

    if (generationCancelled) {
        return;
    }

    // Save chat to persist changes
    await context.saveChat();

    // Force re-render the message to show updated content
    // Use SillyTavern's messageFormatting if available
    if (typeof context.messageFormatting === 'function') {
        rerenderMessageHtml(context, message, settings, messageId, mesTextEl);
        console.log('[IIG] Message re-rendered via messageFormatting');
    } else {
        // Fallback: trigger a manual re-render by finding and updating the element
        const freshMessageEl = document.querySelector(`#chat .mes[mesid="${messageId}"] .mes_text`);
        if (freshMessageEl && message.mes) {
            // Simple approach: just reload the message content
            // This works because message.mes now contains the image path instead of the tag
            console.log('[IIG] Attempting manual refresh...');
        }
    }
}

/**
 * Regenerate all images in a message (user-triggered)
 */
async function regenerateMessageImages(messageId) {
    const context = SillyTavern.getContext();
    const settings = getSettings();
    const message = context.chat[messageId];

    if (!message) {
        toastr.error('Сообщение не найдено', 'Генерация картинок');
        return;
    }

    // Parse ALL instruction tags, forcing regeneration
    const tags = await parseMessageImageTags(message, { forceAll: true });

    if (tags.length === 0) {
        toastr.warning('Нет тегов для перегенерации', 'Генерация картинок');
        return;
    }

    iigLog('INFO', `Regenerating ${tags.length} images in message ${messageId}`);
    toastr.info(`Перегенерация ${tags.length} картинок...`, 'Генерация картинок');

    // Process using existing logic
    processingMessages.add(messageId);
    const controller = new AbortController();
    processingControllers.set(messageId, controller);
    notifyDoubleTroubleImagePending(messageId, true);

    const messageElement = document.querySelector(`#chat .mes[mesid="${messageId}"]`);
    if (!messageElement) {
        processingMessages.delete(messageId);
        processingControllers.delete(messageId);
        notifyDoubleTroubleImagePending(messageId, false);
        return;
    }

    const mesTextEl = messageElement.querySelector('.mes_text');
    if (!mesTextEl) {
        processingMessages.delete(messageId);
        processingControllers.delete(messageId);
        notifyDoubleTroubleImagePending(messageId, false);
        return;
    }

    const convertedLegacyTags = convertLegacyTagsToInstructionFormat(message, tags);
    if (convertedLegacyTags > 0) {
        rerenderMessageHtml(context, message, settings, messageId, mesTextEl);
        iigLog('INFO', `Converted ${convertedLegacyTags} legacy tag(s) to instruction tags before regeneration`);
    }

    for (let index = 0; index < tags.length; index++) {
        const tag = tags[index];
        const tagId = `iig-regen-${messageId}-${index}`;
        applyConfiguredStyleToTag(tag, settings);
        const originalFullMatch = tag.fullMatch;
        let existingMedia = null;
        let loadingPlaceholder = null;

        try {
            const pendingTag = buildPendingMediaTag(tag);
            if (pendingTag && pendingTag !== tag.fullMatch) {
                replaceTagInMessageSource(message, tag, pendingTag);
                tag.fullMatch = pendingTag;
                tag.isNewFormat = true;
                rerenderMessageHtml(context, message, settings, messageId, mesTextEl);
            }

            const mediaTargets = getMediaElementsForGeneration(mesTextEl);
            existingMedia = findMediaElementForTag(mesTextEl, tag, index, mediaTargets);
            if (existingMedia) {
                // Preserve the instruction for future regenerations
                const instruction = existingMedia.getAttribute('data-iig-instruction');

                loadingPlaceholder = createLoadingPlaceholder(tagId);
                existingMedia.replaceWith(loadingPlaceholder);

                const statusEl = loadingPlaceholder.querySelector('.iig-status');

                const generated = await generateImageWithRetry(
                    tag.prompt,
                    tag.style,
                    (status) => { statusEl.textContent = status; },
                    { aspectRatio: tag.aspectRatio, imageSize: tag.imageSize, quality: tag.quality, preset: tag.preset, messageId, signal: controller.signal }
                );

                let persistedSrc = '';
                let persistedPosterSrc = '';
                if (isGeneratedVideoResult(generated)) {
                    statusEl.textContent = 'Сохранение видео...';
                    persistedSrc = await saveNaisteraMediaToFile(generated.dataUrl, 'video', {
                        messageId,
                        tagIndex: index,
                        mode: 'regenerate-video',
                        apiType: getSettings().apiType,
                    });
                    if (generated.posterDataUrl) {
                        statusEl.textContent = 'Сохранение превью...';
                        persistedPosterSrc = await saveImageToFile(generated.posterDataUrl, {
                            messageId,
                            tagIndex: index,
                            mode: 'regenerate-video-poster',
                            apiType: getSettings().apiType,
                        });
                    }
                } else {
                    statusEl.textContent = 'Сохранение...';
                    persistedSrc = await saveImageToFile(generated, {
                        messageId,
                        tagIndex: index,
                        mode: 'regenerate',
                        apiType: getSettings().apiType,
                    });
                }

                const mediaElement = createGeneratedMediaElement(
                    isGeneratedVideoResult(generated)
                        ? { ...generated, dataUrl: persistedSrc, posterDataUrl: persistedPosterSrc || generated.posterDataUrl || '' }
                        : persistedSrc,
                    tag,
                );
                if (instruction) {
                    mediaElement.setAttribute('data-iig-instruction', instruction);
                }
                loadingPlaceholder.replaceWith(mediaElement);

                // Update message.mes
                const updatedTag = buildPersistedMediaTag(tag, generated, persistedSrc, persistedPosterSrc);
                replaceTagInMessageSource(message, tag, updatedTag);

                toastr.success(
                    `${isGeneratedVideoResult(generated) ? 'Видео' : 'Картинка'} ${index + 1}/${tags.length} готов${isGeneratedVideoResult(generated) ? 'о' : 'а'}`,
                    'Генерация картинок',
                    { timeOut: 2000 }
                );
            } else {
                iigLog('WARN', `Could not find existing media for regeneration tag ${index}; skipping placeholder append`);
                toastr.warning('Не нашёл картинку в сообщении для перегенерации', 'Генерация картинок');
            }
        } catch (error) {
            if (isGenerationCancelled(error)) {
                iigLog('INFO', `Regeneration cancelled for message ${messageId}, tag ${index}`);
                if (loadingPlaceholder && existingMedia) {
                    loadingPlaceholder.replaceWith(existingMedia);
                }
                if (tag.fullMatch !== originalFullMatch) {
                    replaceTagInMessageSource(message, tag, originalFullMatch);
                    tag.fullMatch = originalFullMatch;
                    rerenderMessageHtml(context, message, settings, messageId, mesTextEl);
                }
                processingMessages.delete(messageId);
                processingControllers.delete(messageId);
                notifyDoubleTroubleImagePending(messageId, false);
                return;
            }
            iigLog('ERROR', `Regeneration failed for tag ${index}:`, error.message);
            toastr.error(`Ошибка: ${error.message}`, 'Генерация картинок');
        }
    }

    processingMessages.delete(messageId);
    processingControllers.delete(messageId);
    notifyDoubleTroubleImagePending(messageId, false);
    await context.saveChat();
    rerenderMessageHtml(context, message, settings, messageId, mesTextEl);
    iigLog('INFO', `Regeneration complete for message ${messageId}`);
}

/**
 * Add regenerate button to message extra menu (three dots)
 */
function addRegenerateButton(messageElement, messageId) {
    // Check if button already exists
    if (messageElement.querySelector('.iig-regenerate-btn')) return;

    // Find the extraMesButtons container (three dots menu)
    const extraMesButtons = messageElement.querySelector('.extraMesButtons');
    if (!extraMesButtons) return;

    const btn = document.createElement('div');
    btn.className = 'mes_button iig-regenerate-btn fa-solid fa-images interactable';
    btn.title = 'Перегенерировать картинки';
    btn.tabIndex = 0;
    btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await regenerateMessageImages(messageId);
    });

    extraMesButtons.appendChild(btn);
}

/**
 * Add regenerate buttons to all existing AI messages in chat
 */
function addButtonsToExistingMessages() {
    const context = SillyTavern.getContext();
    if (!context.chat || context.chat.length === 0) return;

    const messageElements = document.querySelectorAll('#chat .mes');
    let addedCount = 0;

    for (const messageElement of messageElements) {
        const mesId = messageElement.getAttribute('mesid');
        if (mesId === null) continue;

        const messageId = parseInt(mesId, 10);
        const message = context.chat[messageId];

        // Only add to AI messages (not user messages)
        if (message && !message.is_user) {
            addRegenerateButton(messageElement, messageId);
            addedCount++;
        }
    }

    iigLog('INFO', `Added regenerate buttons to ${addedCount} existing messages`);
}

// NOTE: No click handlers on error images - user uses the regenerate button in message menu

/**
 * Handle CHARACTER_MESSAGE_RENDERED event
 * This fires AFTER the message is rendered to DOM
 */
async function onMessageReceived(messageId) {
    iigLog('INFO', `onMessageReceived: ${messageId}`);

    const settings = getSettings();
    if (!settings.enabled) {
        iigLog('INFO', 'Extension disabled, skipping');
        return;
    }

    const context = SillyTavern.getContext();
    const message = context.chat[messageId];

    const messageElement = document.querySelector(`#chat .mes[mesid="${messageId}"]`);
    if (!messageElement) return;

    // Always add regenerate button for AI messages
    addRegenerateButton(messageElement, messageId);

    await processMessageTags(messageId);
}

/**
 * Create settings UI
 */
function createSettingsUI() {
    const settings = getSettings();

    const container = document.getElementById('extensions_settings');
    if (!container) {
        console.error('[IIG] Settings container not found');
        return;
    }

    const html = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Генерация картинок</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div class="iig-settings">
                    ${buildApiSettingsSectionHtml(settings)}
                    ${buildStylesSettingsSectionHtml(settings)}
                    ${buildReferencesSettingsSectionHtml(settings)}
                    ${buildDebugSettingsSectionHtml(settings)}
                </div>
            </div>
        </div>
        ${buildReferenceImportModalHtml()}
    `;

    container.insertAdjacentHTML('beforeend', html);

    // Bind event handlers
    bindSettingsEvents();
    renderStyleSettings();
}

/**
 * Bind settings event handlers
 */
function bindSettingsEvents() {
    const settings = getSettings();

    document.querySelectorAll('[data-section-toggle]').forEach((toggle) => {
        toggle.addEventListener('click', () => {
            const sectionId = toggle.getAttribute('data-section-toggle');
            const body = sectionId ? document.getElementById(sectionId) : null;
            const chevron = toggle.querySelector('.iig-section-chevron');
            if (!body) {
                return;
            }

            body.classList.toggle('iig-hidden');
            chevron?.classList.toggle('iig-section-chevron-collapsed', body.classList.contains('iig-hidden'));
        });
    });

    const updateVisibility = () => {
        const apiType = settings.apiType;
        const isNaistera = apiType === 'naistera';
        const isGemini = apiType === 'gemini';
        const isOpenAI = apiType === 'openai';
        const naisteraRefsSupported = isNaistera && naisteraModelSupportsReferences(settings.naisteraModel);

        // Model is used for OpenAI and Gemini; Naistera does not need a model.
        document.getElementById('iig_model_row')?.classList.toggle('iig-hidden', isNaistera);
        document.getElementById('iig_image_context_section')?.classList.toggle('iig-hidden', !(isGemini || naisteraRefsSupported));
        document.getElementById('iig_image_context_count_row')?.classList.toggle('iig-hidden', !((isGemini || naisteraRefsSupported) && settings.imageContextEnabled));
        document.getElementById('iig_additional_refs_section')?.classList.toggle('iig-hidden', !(isGemini || naisteraRefsSupported));

        // OpenAI-only params
        document.getElementById('iig_size_row')?.classList.toggle('iig-hidden', !isOpenAI);
        document.getElementById('iig_quality_row')?.classList.toggle('iig-hidden', !isOpenAI);

        // Naistera-only params
        document.getElementById('iig_naistera_model_row')?.classList.toggle('iig-hidden', !isNaistera);
        document.getElementById('iig_naistera_aspect_row')?.classList.toggle('iig-hidden', !isNaistera);
        document.getElementById('iig_naistera_video_section')?.classList.toggle('iig-hidden', !isNaistera);
        document.getElementById('iig_naistera_video_frequency_row')?.classList.toggle('iig-hidden', !(isNaistera && settings.naisteraVideoTest));
        document.getElementById('iig_naistera_refs_section')?.classList.toggle('iig-hidden', !naisteraRefsSupported);
        document.getElementById('iig_naistera_use_active_persona_avatar_row')?.classList.toggle('iig-hidden', !(naisteraRefsSupported && settings.naisteraSendUserAvatar));
        document.getElementById('iig_naistera_user_avatar_row')?.classList.toggle(
            'iig-hidden',
            !(naisteraRefsSupported && settings.naisteraSendUserAvatar && !settings.useActiveUserPersonaAvatar)
        );

        document.getElementById('iig_naistera_hint')?.classList.toggle('iig-hidden', !isNaistera);

        const endpointInput = document.getElementById('iig_endpoint');
        if (endpointInput) {
            endpointInput.placeholder = getEndpointPlaceholder(apiType);
        }

        // Avatar section is only for Gemini/nano-banana
        const avatarSection = document.getElementById('iig_avatar_section');
        if (avatarSection) {
            avatarSection.classList.toggle('hidden', !isGemini);
        }
        const avatarRefsSection = document.getElementById('iig_avatar_refs_section');
        if (avatarRefsSection) {
            avatarRefsSection.classList.toggle('hidden', !isGemini);
        }
        document.getElementById('iig_use_active_persona_avatar_row')?.classList.toggle('hidden', !(isGemini && settings.sendUserAvatar));
        document.getElementById('iig_user_avatar_row')?.classList.toggle(
            'hidden',
            !(isGemini && settings.sendUserAvatar && !settings.useActiveUserPersonaAvatar)
        );
    };

    // Enable toggle
    document.getElementById('iig_enabled')?.addEventListener('change', (e) => {
        settings.enabled = e.target.checked;
        saveSettings();
    });

    document.getElementById('iig_external_blocks')?.addEventListener('change', (e) => {
        settings.externalBlocks = e.target.checked;
        saveSettings();
    });

    document.getElementById('iig_image_context_enabled')?.addEventListener('change', (e) => {
        settings.imageContextEnabled = e.target.checked;
        saveSettings();
        updateVisibility();
    });

    document.getElementById('iig_image_context_count')?.addEventListener('input', (e) => {
        const normalized = normalizeImageContextCount(e.target.value);
        settings.imageContextCount = normalized;
        e.target.value = String(normalized);
        saveSettings();
    });

    // API Type
    document.getElementById('iig_api_type')?.addEventListener('change', (e) => {
        const nextApiType = e.target.value;
        const endpointInput = document.getElementById('iig_endpoint');
        if (shouldReplaceEndpointForApiType(nextApiType, settings.endpoint)) {
            settings.endpoint = normalizeConfiguredEndpoint(nextApiType, '');
            if (endpointInput) {
                endpointInput.value = settings.endpoint;
            }
        } else if (nextApiType === 'naistera') {
            settings.endpoint = normalizeConfiguredEndpoint(nextApiType, settings.endpoint);
            if (endpointInput) {
                endpointInput.value = settings.endpoint;
            }
        }
        settings.apiType = nextApiType;
        saveSettings();
        updateVisibility();
    });

    // Endpoint
    document.getElementById('iig_endpoint')?.addEventListener('input', (e) => {
        settings.endpoint = e.target.value;
        saveSettings();
    });

    // API Key
    document.getElementById('iig_api_key')?.addEventListener('input', (e) => {
        settings.apiKey = e.target.value;
        saveSettings();
    });

    // API Key toggle visibility
    document.getElementById('iig_key_toggle')?.addEventListener('click', () => {
        const input = document.getElementById('iig_api_key');
        const icon = document.querySelector('#iig_key_toggle i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.replace('fa-eye-slash', 'fa-eye');
        }
    });

    // Model
    document.getElementById('iig_model')?.addEventListener('change', (e) => {
        settings.model = e.target.value;
        saveSettings();

        // Auto-switch API type based on model
        if (isGeminiModel(e.target.value)) {
            document.getElementById('iig_api_type').value = 'gemini';
            settings.apiType = 'gemini';
            updateVisibility();
        }
    });

    // Refresh models
    document.getElementById('iig_refresh_models')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.classList.add('loading');

        try {
            const models = await fetchModels();
            const select = document.getElementById('iig_model');

            // Keep current selection if it exists in new list
            const currentModel = settings.model;

            select.innerHTML = '<option value="">-- Выберите модель --</option>';

            for (const model of models) {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                option.selected = model === currentModel;
                select.appendChild(option);
            }

            toastr.success(`Найдено моделей: ${models.length}`, 'Генерация картинок');
        } catch (error) {
            toastr.error('Ошибка загрузки моделей', 'Генерация картинок');
        } finally {
            btn.classList.remove('loading');
        }
    });

    // Size
    document.getElementById('iig_size')?.addEventListener('change', (e) => {
        settings.size = e.target.value;
        saveSettings();
    });

    // Quality
    document.getElementById('iig_quality')?.addEventListener('change', (e) => {
        settings.quality = e.target.value;
        saveSettings();
    });

    // Aspect Ratio (nano-banana)
    document.getElementById('iig_aspect_ratio')?.addEventListener('change', (e) => {
        settings.aspectRatio = e.target.value;
        saveSettings();
    });

    // Image Size (nano-banana)
    document.getElementById('iig_image_size')?.addEventListener('change', (e) => {
        settings.imageSize = e.target.value;
        saveSettings();
    });

    // Naistera aspect ratio
    document.getElementById('iig_naistera_model')?.addEventListener('change', (e) => {
        settings.naisteraModel = normalizeNaisteraModel(e.target.value);
        saveSettings();
        updateVisibility();
    });

    // Naistera aspect ratio
    document.getElementById('iig_naistera_aspect_ratio')?.addEventListener('change', (e) => {
        settings.naisteraAspectRatio = e.target.value;
        saveSettings();
    });

    document.getElementById('iig_naistera_video_test')?.addEventListener('change', (e) => {
        settings.naisteraVideoTest = e.target.checked;
        saveSettings();
        updateVisibility();
    });

    document.getElementById('iig_naistera_video_every_n')?.addEventListener('input', (e) => {
        const normalized = normalizeNaisteraVideoFrequency(e.target.value);
        settings.naisteraVideoEveryN = normalized;
        e.target.value = String(normalized);
        saveSettings();
    });

    // Naistera references (UI only for now)
    document.getElementById('iig_naistera_send_char_avatar')?.addEventListener('change', (e) => {
        settings.naisteraSendCharAvatar = e.target.checked;
        saveSettings();
    });
    document.getElementById('iig_naistera_send_user_avatar')?.addEventListener('change', (e) => {
        settings.naisteraSendUserAvatar = e.target.checked;
        saveSettings();
        updateVisibility();
    });

    document.getElementById('iig_naistera_use_active_persona_avatar')?.addEventListener('change', (e) => {
        settings.useActiveUserPersonaAvatar = e.target.checked;
        syncActivePersonaAvatarMode(settings.useActiveUserPersonaAvatar);
        saveSettings();
        updateVisibility();
    });

    // Naistera user avatar file selection (reuses settings.userAvatarFile)
    document.getElementById('iig_naistera_user_avatar_file')?.addEventListener('change', (e) => {
        settings.userAvatarFile = e.target.value;
        syncUserAvatarSelection(settings.userAvatarFile);
        saveSettings();
    });

    // Naistera refresh user avatars list
    document.getElementById('iig_naistera_refresh_avatars')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const btn = e.currentTarget;
        btn.classList.add('loading');

        try {
            const avatars = await refreshUserAvatarSelects();

            toastr.success(`Найдено аватаров: ${avatars.length}`, 'Генерация картинок');
            document.getElementById('iig_naistera_user_avatar_dropdown')?.classList.add('open');
        } catch (error) {
            toastr.error('Ошибка загрузки аватаров', 'Генерация картинок');
        } finally {
            btn.classList.remove('loading');
        }
    });

    // Send char avatar
    document.getElementById('iig_send_char_avatar')?.addEventListener('change', (e) => {
        settings.sendCharAvatar = e.target.checked;
        saveSettings();
    });

    // Send user avatar
    document.getElementById('iig_send_user_avatar')?.addEventListener('change', (e) => {
        settings.sendUserAvatar = e.target.checked;
        saveSettings();
        updateVisibility();
    });

    document.getElementById('iig_use_active_persona_avatar')?.addEventListener('change', (e) => {
        settings.useActiveUserPersonaAvatar = e.target.checked;
        syncActivePersonaAvatarMode(settings.useActiveUserPersonaAvatar);
        saveSettings();
        updateVisibility();
    });

    // User avatar file selection
    document.getElementById('iig_user_avatar_file')?.addEventListener('change', (e) => {
        settings.userAvatarFile = e.target.value;
        syncUserAvatarSelection(settings.userAvatarFile);
        saveSettings();
    });

    // Refresh user avatars list
    document.getElementById('iig_refresh_avatars')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const btn = e.currentTarget;
        btn.classList.add('loading');

        try {
            const avatars = await refreshUserAvatarSelects();

            toastr.success(`Найдено аватаров: ${avatars.length}`, 'Генерация картинок');
            document.getElementById('iig_user_avatar_dropdown')?.classList.add('open');
        } catch (error) {
            toastr.error('Ошибка загрузки аватаров', 'Генерация картинок');
        } finally {
            btn.classList.remove('loading');
        }
    });

    for (const { rootId, selectedId, listId } of getUserAvatarDropdownConfigs()) {
        document.getElementById(selectedId)?.addEventListener('click', async (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById(rootId);
            if (!dropdown) {
                return;
            }

            const willOpen = !dropdown.classList.contains('open');
            closeUserAvatarDropdowns();
            dropdown.classList.toggle('open', willOpen);

            if (willOpen) {
                const list = document.getElementById(listId);
                if (list && list.children.length === 0) {
                    await refreshUserAvatarSelects();
                }
            }
        });
    }

    document.addEventListener('click', (e) => {
        const clickedInsideDropdown = getUserAvatarDropdownConfigs().some(({ rootId }) => {
            const root = document.getElementById(rootId);
            return root?.contains(e.target);
        });
        if (!clickedInsideDropdown) {
            closeUserAvatarDropdowns();
        }
    });

    document.getElementById('iig_style_add')?.addEventListener('click', () => {
        const input = document.getElementById('iig_new_style_name');
        const style = createStyle(input?.value || '');
        if (input) {
            input.value = '';
        }
        saveSettings();
        renderStyleSettings();
        iigLog('INFO', `Created style: ${style.name}`);
    });

    document.getElementById('iig_new_style_name')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('iig_style_add')?.click();
        }
    });

    document.getElementById('iig_style_presets')?.addEventListener('click', (e) => {
        const activateButton = e.target instanceof Element ? e.target.closest('[data-style-activate]') : null;
        if (activateButton) {
            settings.activeStyleId = activateButton.getAttribute('data-style-activate') || '';
            saveSettings();
            renderStyleSettings();
            return;
        }

        const removeButton = e.target instanceof Element ? e.target.closest('[data-style-remove]') : null;
        if (!removeButton) {
            return;
        }

        const styleId = removeButton.getAttribute('data-style-remove') || '';
        removeStyle(styleId);
        saveSettings();
        renderStyleSettings();
    });

    document.getElementById('iig_style_editor')?.addEventListener('input', (e) => {
        const activeStyle = getActiveStyle(settings);
        if (!activeStyle) {
            return;
        }

        const target = e.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
            return;
        }

        if (target.id === 'iig_style_name') {
            updateStyle(activeStyle.id, { name: target.value });
            saveSettings();
            const activeButton = document.querySelector(`[data-style-activate="${activeStyle.id}"] span`);
            if (activeButton) {
                activeButton.textContent = getActiveStyle(settings)?.name || target.value.trim() || activeStyle.name;
            }
            return;
        }
        if (target.id === 'iig_style_value') {
            updateStyle(activeStyle.id, { value: target.value });
            saveSettings();
            return;
        }
    });

    document.getElementById('iig_style_editor')?.addEventListener('click', (e) => {
        const disableButton = e.target instanceof Element ? e.target.closest('#iig_style_disable') : null;
        if (!disableButton) {
            return;
        }

        settings.activeStyleId = '';
        saveSettings();
        renderStyleSettings();
    });

    document.getElementById('iig_additional_refs_add')?.addEventListener('click', () => {
        const refs = ensureAdditionalReferencesArray(settings);
        if (refs.length >= MAX_ADDITIONAL_REFERENCES) {
            toastr.warning(`Максимум дополнительных референсов: ${MAX_ADDITIONAL_REFERENCES}`, 'Генерация картинок');
            return;
        }

        refs.push({ name: '', description: '', imagePath: '', matchMode: 'match', enabled: true });
        saveSettings();
        renderAdditionalReferencesList();
    });

    document.getElementById('iig_additional_refs_import')?.addEventListener('click', () => {
        openReferenceImportModal();
    });

    document.getElementById('iig_ref_import_close')?.addEventListener('click', () => {
        closeReferenceImportModal();
    });

    document.querySelector('#iig_ref_import_modal [data-iig-modal-close="true"]')?.addEventListener('click', () => {
        closeReferenceImportModal();
    });

    document.getElementById('iig_ref_import_submit')?.addEventListener('click', async () => {
        const button = document.getElementById('iig_ref_import_submit');
        const input = document.getElementById('iig_ref_import_urls');
        if (!(button instanceof HTMLDivElement) || !(input instanceof HTMLTextAreaElement)) {
            return;
        }

        button.classList.add('loading');
        try {
            const result = await importAdditionalReferencesFromUrls(input.value);
            closeReferenceImportModal();
            toastr.success(
                `Загружено: ${result.importedCount}${result.skippedCount > 0 ? `, пропущено: ${result.skippedCount}` : ''}`,
                'Генерация картинок'
            );
        } catch (error) {
            toastr.error(`Ошибка импорта: ${error.message || error}`, 'Генерация картинок');
        } finally {
            button.classList.remove('loading');
        }
    });

    document.getElementById('iig_ref_import_urls')?.addEventListener('keydown', async (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('iig_ref_import_submit')?.click();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            closeReferenceImportModal();
        }
    });

    document.getElementById('iig_additional_refs_list')?.addEventListener('input', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
            return;
        }

        const isNameField = target.classList.contains('iig-additional-ref-name');
        const isDescriptionField = target.classList.contains('iig-additional-ref-description');
        if (!isNameField && !isDescriptionField) {
            return;
        }

        const row = target.closest('.iig-additional-ref-row');
        const index = Number.parseInt(String(row?.getAttribute('data-ref-index') || ''), 10);
        if (!Number.isInteger(index)) {
            return;
        }

        const refs = ensureAdditionalReferencesArray(settings);
        if (!refs[index]) {
            return;
        }

        if (isNameField) {
            refs[index].name = target.value;
        }
        if (isDescriptionField) {
            refs[index].description = target.value;
        }
        saveSettings();
    });

    document.getElementById('iig_additional_refs_list')?.addEventListener('change', async (e) => {
        const target = e.target;
        if (target instanceof HTMLInputElement && target.classList.contains('iig-additional-ref-enabled')) {
            const row = target.closest('.iig-additional-ref-row');
            const index = Number.parseInt(String(row?.getAttribute('data-ref-index') || ''), 10);
            if (!Number.isInteger(index)) {
                return;
            }

            const refs = ensureAdditionalReferencesArray(settings);
            if (!refs[index]) {
                return;
            }

            refs[index].enabled = target.checked;
            saveSettings();
            renderAdditionalReferencesList();
            return;
        }

        if (!(target instanceof HTMLInputElement) || !target.classList.contains('iig-additional-ref-file')) {
            return;
        }

        const row = target.closest('.iig-additional-ref-row');
        const index = Number.parseInt(String(row?.getAttribute('data-ref-index') || ''), 10);
        if (!Number.isInteger(index)) {
            target.value = '';
            return;
        }

        const file = target.files?.[0];
        if (!file) {
            target.value = '';
            return;
        }

        const refs = ensureAdditionalReferencesArray(settings);
        if (!refs[index]) {
            target.value = '';
            return;
        }

        try {
            if (!refs[index].name) {
                refs[index].name = file.name.replace(/\.[^.]+$/, '');
            }

            const dataUrl = await readFileAsDataUrl(file);
            const savedPath = await saveImageToFile(dataUrl, {
                mode: 'additional-reference-upload',
                refIndex: index,
                refName: refs[index].name,
            });

            refs[index].imagePath = normalizeStoredImagePath(savedPath);
            saveSettings();
            renderAdditionalReferencesList();
            toastr.success('Дополнительный референс сохранён', 'Генерация картинок');
        } catch (error) {
            console.error('[IIG] Failed to upload additional reference:', error);
            toastr.error(`Ошибка загрузки референса: ${error.message || error}`, 'Генерация картинок');
        } finally {
            target.value = '';
        }
    });

    document.getElementById('iig_additional_refs_list')?.addEventListener('change', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLInputElement) || !target.classList.contains('iig-additional-ref-always')) {
            return;
        }

        const row = target.closest('.iig-additional-ref-row');
        const index = Number.parseInt(String(row?.getAttribute('data-ref-index') || ''), 10);
        if (!Number.isInteger(index)) {
            return;
        }

        const refs = ensureAdditionalReferencesArray(settings);
        if (!refs[index]) {
            return;
        }

        refs[index].matchMode = target.checked ? 'always' : 'match';
        saveSettings();
        renderAdditionalReferencesList();
    });

    document.getElementById('iig_additional_refs_list')?.addEventListener('click', (e) => {
        const target = e.target;
        const button = target instanceof Element ? target.closest('.iig-additional-ref-remove') : null;
        if (!button) {
            return;
        }

        const row = button.closest('.iig-additional-ref-row');
        const index = Number.parseInt(String(row?.getAttribute('data-ref-index') || ''), 10);
        if (!Number.isInteger(index)) {
            return;
        }

        const refs = ensureAdditionalReferencesArray(settings);
        refs.splice(index, 1);
        saveSettings();
        renderAdditionalReferencesList();
    });

    // Max retries
    document.getElementById('iig_max_retries')?.addEventListener('input', (e) => {
        settings.maxRetries = parseInt(e.target.value) || 3;
        saveSettings();
    });

    // Retry delay
    document.getElementById('iig_retry_delay')?.addEventListener('input', (e) => {
        settings.retryDelay = parseInt(e.target.value) || 1000;
        saveSettings();
    });

    // Export logs
    document.getElementById('iig_export_logs')?.addEventListener('click', () => {
        exportLogs();
    });

    // Apply initial state
    syncUserAvatarSelection(settings.userAvatarFile);
    syncActivePersonaAvatarMode(settings.useActiveUserPersonaAvatar);
    renderAdditionalReferencesList();
    updateVisibility();
}

/**
 * Initialize extension
 */
(function init() {
    const context = SillyTavern.getContext();

    // Debug: log available event types
    console.log('[IIG] Available event_types:', context.event_types);
    console.log('[IIG] CHARACTER_MESSAGE_RENDERED:', context.event_types.CHARACTER_MESSAGE_RENDERED);
    console.log('[IIG] MESSAGE_SWIPED:', context.event_types.MESSAGE_SWIPED);

    // Load settings
    getSettings();

    // Create settings UI when app is ready
    context.eventSource.on(context.event_types.APP_READY, () => {
        createSettingsUI();
        // Add buttons to any messages already in chat
        addButtonsToExistingMessages();
        console.log('[IIG] SillyImages extension loaded');
    });

    // When chat is loaded/changed, add buttons to all existing messages
    context.eventSource.on(context.event_types.CHAT_CHANGED, () => {
        iigLog('INFO', 'CHAT_CHANGED event - adding buttons to existing messages');
        // Small delay to ensure DOM is ready
        setTimeout(() => {
            addButtonsToExistingMessages();
        }, 100);
    });

    // Wrapper to add debug logging
    const handleMessage = async (messageId) => {
        console.log('[IIG] Event triggered for message:', messageId);
        await onMessageReceived(messageId);
    };

    // Listen for new messages AFTER they're rendered in DOM
    // CHARACTER_MESSAGE_RENDERED fires after addOneMessage() completes
    // This is the ONLY event we handle - no auto-retry on swipe/update
    context.eventSource.makeLast(context.event_types.CHARACTER_MESSAGE_RENDERED, handleMessage);

    // NOTE: We intentionally DO NOT handle MESSAGE_SWIPED or MESSAGE_UPDATED
    // Swipe = user wants NEW content, not to retry old error images
    // If user wants to retry failed images, they use the regenerate button in menu

    console.log('[IIG] SillyImages extension initialized');
})();
