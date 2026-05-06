import { useEffect, useRef, useState, type ReactNode } from 'react';

type MenuSection = 'presets' | 'connection' | 'visual' | 'personas' | 'security' | 'lorebooks' | 'cards';
type IconName = 'sliders' | 'plug' | 'palette' | 'user' | 'card' | 'book' | 'bot' | 'lock' | 'menu' | 'send' | 'edit' | 'trash' | 'eye' | 'eyeOff' | 'check' | 'x';
type ThemeId = 'midnight' | 'parchment' | 'abyss' | 'forest' | 'ocean' | 'plum' | 'ember';
type VisualSettings = {
  theme: ThemeId;
  textScale: 'small' | 'normal' | 'large' | 'huge';
  density: 'compact' | 'comfortable' | 'spacious';
  messageWidth: 'narrow' | 'standard' | 'wide';
  radius: 'sharp' | 'soft' | 'round';
  motion: boolean;
  highContrast: boolean;
  showAvatars: boolean;
  stickyComposer: boolean;
};

type CharacterCard = {
  id: string;
  filename: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_message: string;
  message_example: string;
  creator: string;
  tags: string[];
  spec: string;
  spec_version: string;
  image_url: string;
};

type CardDraft = {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  messageExample: string;
  creator: string;
  tags: string;
};

type Persona = {
  id: string;
  name: string;
  description: string;
  avatar: string;
  avatar_url: string;
  active: boolean;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  author: string;
  participant_id: string;
  avatar_url: string;
  username: string;
  is_admin: boolean;
  content: string;
  hidden: boolean;
  swipes?: string[];
  active_swipe_index?: number;
  created_at: string;
  updated_at: string;
};

type BotChatSummary = {
  id: string;
  title: string;
  filename: string;
  message_count: number;
  created_at: string;
  updated_at: string;
};

type BotChat = BotChatSummary & {
  card_id: string;
  character_name: string;
  messages: ChatMessage[];
};

type GenerationSettings = {
  provider: string;
  base_url: string;
  model: string;
  bot_name: string;
  system_prompt: string;
  temperature: number;
  max_tokens: number;
  timeout_seconds: number;
  api_key: string;
  clear_api_key: boolean;
  api_key_configured?: boolean;
};

type ConnectionPreset = Omit<GenerationSettings, 'api_key' | 'clear_api_key' | 'api_key_configured' | 'bot_name'> & {
  name: string;
};

type PresetTypeInfo = {
  id: string;
  label: string;
  directory: string;
};

type PresetSummary = {
  name: string;
  filename: string;
  type: string;
  updated_at: number;
};

type LorebookBinding = { book: string; target_type: 'global' | 'card' | 'chat' | 'persona'; target_id: string };
type LorebookSummary = { name: string; filename: string; entry_count: number; updated_at: number; bindings: LorebookBinding[] };

type Participant = {
  id: string;
  name: string;
  role: string;
  connected: boolean;
  persona_id: string;
  persona_name: string;
  avatar_url: string;
  username: string;
  is_admin: boolean;
};

type AuthUser = {
  username: string;
  is_admin: boolean;
};

type PermissionMode = 'everyone' | 'admins' | 'users';
type PermissionRule = { mode: PermissionMode; users: string[] };
type SecurityPermissions = Record<string, PermissionRule>;
type AccessDeniedState = { cards: boolean; personas: boolean; chats: boolean; presets: boolean; lorebooks: boolean };

type ToastMessage = {
  id: string;
  message: string;
};

type RealtimePayload = {
  type?: string;
  card_id?: string;
  chat_id?: string;
  chat?: BotChat;
  session?: { participants?: Record<string, Participant> };
  message?: string;
  replace_message_id?: string | null;
  auth_required?: boolean;
  permissions?: SecurityPermissions;
};

type RawPreset = Record<string, unknown>;

type OpenAiPrompt = RawPreset & {
  identifier?: string;
  name?: string;
  role?: string;
  content?: string;
  marker?: boolean;
  system_prompt?: boolean;
  injection_position?: number | string;
  injection_depth?: number | string;
  injection_order?: number | string;
  injection_trigger?: unknown;
  forbid_overrides?: boolean;
};

type PromptOrderItem = {
  identifier: string;
  enabled: boolean;
};

type ReasoningDisplaySettings = {
  autoParse: boolean;
  autoExpand: boolean;
  showHidden: boolean;
  addToPrompts: boolean;
  maxAdditions: number;
  prefix: string;
  suffix: string;
  separator: string;
};

const menuItems: Array<{ id: MenuSection; label: string; icon: IconName; description: string }> = [
  { id: 'presets', label: 'Пресеты', icon: 'sliders', description: 'Prompt, sampler, параметры генерации' },
  { id: 'connection', label: 'Подключение', icon: 'plug', description: 'Provider, endpoint, model, API key' },
  { id: 'visual', label: 'Визуал', icon: 'palette', description: 'Тема, плотность, размер текста' },
  { id: 'cards', label: 'Карточки', icon: 'card', description: 'Character cards, боты и чаты карточек' },
  { id: 'personas', label: 'Персоны', icon: 'user', description: 'Профили игроков и persona prompt' },
  { id: 'lorebooks', label: 'Лорбуки', icon: 'book', description: 'World Info ST, ключи и привязки' },
  { id: 'security', label: 'Безопасность', icon: 'lock', description: 'Пароль фронта, локальная сеть, key checking' },
];

const VISUAL_STORAGE_KEY = 'doubletrouble.visualSettings';
const SELECTED_PERSONA_STORAGE_KEY = 'doubletrouble.selectedPersonaId';
const PARTICIPANT_STORAGE_KEY = 'doubletrouble.participantId';
const LAST_CARD_STORAGE_KEY = 'doubletrouble.lastCardId';
const LAST_CHAT_BY_CARD_STORAGE_KEY = 'doubletrouble.lastChatByCard';
const AUTH_TOKEN_STORAGE_KEY = 'doubletrouble.authToken';
const OPENAI_PROMPT_ORDER_CHARACTER_ID = 100001;

const permissionLabels: Record<string, string> = {
  view_cards: 'Просмотр карточек',
  view_personas: 'Просмотр персон',
  view_chats: 'Просмотр чатов',
  view_presets: 'Просмотр пресетов',
  view_lorebooks: 'Просмотр лорбуков',
  edit_cards: 'Создание и правка карточек',
  delete_cards: 'Удаление карточек',
  edit_personas: 'Создание и правка персон',
  delete_personas: 'Удаление персон',
  manage_chats: 'Управление чатами',
  edit_messages: 'Правка/скрытие сообщений',
  delete_messages: 'Удаление сообщений',
  generate: 'Генерация, swipes и reroll',
  manage_presets: 'Пресеты и подключения',
  manage_lorebooks: 'Лорбуки и привязки',
  manage_security: 'Настройки безопасности',
};

const defaultSecurityPermissions: SecurityPermissions = Object.fromEntries(Object.keys(permissionLabels).map((key) => [key, { mode: key === 'manage_security' ? 'admins' : 'everyone', users: [] }])) as SecurityPermissions;
const accessDeniedText = 'Доступ запрещен. Войдите или попросите администратора выдать права.';

const emptyCardDraft: CardDraft = { name: '', description: '', personality: '', scenario: '', firstMessage: '', messageExample: '', creator: '', tags: '' };

const connectionMethods = [
  ['disabled', 'Отключено'],
  ['openai_compatible', 'OpenAI-compatible / Custom proxy'],
  ['openrouter', 'OpenRouter'],
  ['lm_studio', 'LM Studio'],
  ['ollama_openai', 'Ollama OpenAI'],
  ['vllm', 'vLLM'],
  ['tabby', 'TabbyAPI'],
  ['aphrodite', 'Aphrodite'],
  ['textgen_webui', 'Text generation web UI'],
  ['koboldcpp', 'KoboldCpp OpenAI'],
  ['mistral_proxy', 'Mistral-compatible proxy'],
  ['claude_proxy', 'Claude-compatible proxy'],
  ['google_proxy', 'Google-compatible proxy'],
] as const;

const defaultGenerationSettings: GenerationSettings = {
  provider: 'disabled',
  base_url: '',
  model: '',
  bot_name: 'Bot',
  system_prompt: 'You are a collaborative roleplay assistant. Continue the scene naturally.',
  temperature: 0.8,
  max_tokens: 350,
  timeout_seconds: 60,
  api_key: '',
  clear_api_key: false,
};

function draftFromCard(card: CharacterCard): CardDraft {
  return {
    name: card.name,
    description: card.description,
    personality: card.personality,
    scenario: card.scenario,
    firstMessage: card.first_message,
    messageExample: card.message_example,
    creator: card.creator,
    tags: card.tags.join(', '),
  };
}

function filenameFromContentDisposition(disposition: string | null): string {
  if (!disposition) {
    return '';
  }
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }
  return disposition.match(/filename="?([^";]+)"?/i)?.[1] || '';
}

async function downloadResponse(response: Response, fallbackName: string) {
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filenameFromContentDisposition(response.headers.get('Content-Disposition')) || fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

const defaultVisualSettings: VisualSettings = {
  theme: 'midnight',
  textScale: 'normal',
  density: 'comfortable',
  messageWidth: 'standard',
  radius: 'soft',
  motion: true,
  highContrast: false,
  showAvatars: true,
  stickyComposer: true,
};

const themes: Array<{ id: ThemeId; name: string; description: string; swatches: string[] }> = [
  { id: 'midnight', name: 'Midnight', description: 'Темная библиотека, янтарь и teal', swatches: ['#0f1418', '#1d2630', '#d8a75f', '#73b7a7'] },
  { id: 'parchment', name: 'Parchment', description: 'Светлая бумага, чернила, бронза', swatches: ['#f4eddf', '#fffaf0', '#9c6b2f', '#3e746c'] },
  { id: 'abyss', name: 'Abyss', description: 'Почти полный черный для OLED', swatches: ['#000000', '#0a0a0a', '#d6b46a', '#6fb5a5'] },
  { id: 'forest', name: 'Forest', description: 'Темный лес, мох, теплый свет', swatches: ['#0f1712', '#1c2a20', '#c69a55', '#7fb069'] },
  { id: 'ocean', name: 'Ocean', description: 'Холодная ночь, синий и циан', swatches: ['#0c1420', '#172638', '#7fb7ff', '#76d1cf'] },
  { id: 'plum', name: 'Plum', description: 'Черничный тон без кислотности', swatches: ['#17111b', '#261d2d', '#c69ad7', '#d2a75f'] },
  { id: 'ember', name: 'Ember', description: 'Уголь, медь и приглушенное тепло', swatches: ['#17110d', '#2a1d17', '#e09a58', '#c76f54'] },
];

const slashCommands = [
  { command: '/hide', hint: '0-3', description: 'Скрыть сообщения' },
  { command: '/unhide', hint: '0-3', description: 'Показать сообщения' },
  { command: '/delete', hint: '4 7-9', description: 'Удалить сообщения' },
  { command: '/reroll', hint: '', description: 'Полный реролл последнего ответа' },
  { command: '/copy', hint: '0-5', description: 'Скопировать сообщения' },
  { command: '/help', hint: '', description: 'Показать команды' },
];

function loadVisualSettings(): VisualSettings {
  try {
    const saved = window.localStorage.getItem(VISUAL_STORAGE_KEY);
    return saved ? { ...defaultVisualSettings, ...JSON.parse(saved) } : defaultVisualSettings;
  } catch {
    return defaultVisualSettings;
  }
}

function participantId(): string {
  const saved = window.localStorage.getItem(PARTICIPANT_STORAGE_KEY);
  if (saved) {
    return saved;
  }
  const id = window.crypto?.randomUUID?.() || `player_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(PARTICIPANT_STORAGE_KEY, id);
  return id;
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<MenuSection>('presets');
  const [visualSettings, setVisualSettings] = useState<VisualSettings>(loadVisualSettings);
  const [cards, setCards] = useState<CharacterCard[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personaDraft, setPersonaDraft] = useState({ name: '', description: '' });
  const [cardDraft, setCardDraft] = useState<CardDraft>(emptyCardDraft);
  const [cardAvatar, setCardAvatar] = useState<File | null>(null);
  const [activeCard, setActiveCard] = useState<CharacterCard | null>(null);
  const [activeChat, setActiveChat] = useState<BotChat | null>(null);
  const [botChats, setBotChats] = useState<BotChatSummary[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [composerMenuOpen, setComposerMenuOpen] = useState(false);
  const [chatPickerOpen, setChatPickerOpen] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState(() => window.localStorage.getItem(SELECTED_PERSONA_STORAGE_KEY) || '');
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings>(defaultGenerationSettings);
  const [models, setModels] = useState<string[]>([]);
  const [connectionPresets, setConnectionPresets] = useState<ConnectionPreset[]>([]);
  const [activeConnectionPresetName, setActiveConnectionPresetName] = useState('');
  const [connectionPresetName, setConnectionPresetName] = useState('');
  const [presetToDelete, setPresetToDelete] = useState('');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [libraryMessage, setLibraryMessage] = useState('');
  const [editingMessageId, setEditingMessageId] = useState('');
  const [editingMessageText, setEditingMessageText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [topbarVisible, setTopbarVisible] = useState(true);
  const [chatRenameDrafts, setChatRenameDrafts] = useState<Record<string, string>>({});
  const [presetTypes, setPresetTypes] = useState<PresetTypeInfo[]>([]);
  const [selectedPresetType, setSelectedPresetType] = useState('openai');
  const [presets, setPresets] = useState<PresetSummary[]>([]);
  const [selectedPresetName, setSelectedPresetName] = useState('');
  const [presetNameDraft, setPresetNameDraft] = useState('');
  const [presetJsonDraft, setPresetJsonDraft] = useState('{}');
  const [presetMessage, setPresetMessage] = useState('');
  const [lorebooks, setLorebooks] = useState<LorebookSummary[]>([]);
  const [selectedLorebookName, setSelectedLorebookName] = useState('');
  const [lorebookNameDraft, setLorebookNameDraft] = useState('');
  const [lorebookJsonDraft, setLorebookJsonDraft] = useState('{\n  "entries": {}\n}');
  const [lorebookBindings, setLorebookBindings] = useState<LorebookBinding[]>([]);
  const [lorebookBindingDraft, setLorebookBindingDraft] = useState<LorebookBinding>({ book: '', target_type: 'global', target_id: '' });
  const [lorebookMessage, setLorebookMessage] = useState('');
  const [activePresets, setActivePresets] = useState<Record<string, string>>({});
  const [editingPromptId, setEditingPromptId] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [imagePreview, setImagePreview] = useState<{ src: string; title: string } | null>(null);
  const [authToken, setAuthToken] = useState(() => window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || '');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authDraft, setAuthDraft] = useState({ username: '', password: '', adminCode: '' });
  const [authMessage, setAuthMessage] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [securityPermissions, setSecurityPermissions] = useState<SecurityPermissions>(defaultSecurityPermissions);
  const [accessDenied, setAccessDenied] = useState<AccessDeniedState>({ cards: false, personas: false, chats: false, presets: false, lorebooks: false });
  const activeMessages = activeChat?.messages ?? [];
  const reasoningDisplay = reasoningSettingsFromPreset(parsePresetDraft(presetJsonDraft));
  const selectedPersona = personas.find((persona) => persona.id === selectedPersonaId) ?? personas[0] ?? null;
  const connectedPlayers = participants.filter((participant) => participant.connected && participant.role === 'player');
  const websocketRef = useRef<WebSocket | null>(null);
  const participantIdRef = useRef(participantId());
  const authTokenRef = useRef(authToken);
  const authUserRef = useRef<AuthUser | null>(null);
  const activeCardRef = useRef<CharacterCard | null>(null);
  const activeChatRef = useRef<BotChat | null>(null);
  const swipeTouchStartRef = useRef<Record<string, number>>({});
  const restoredSelectionRef = useRef(false);

  useEffect(() => {
    activeCardRef.current = activeCard;
    activeChatRef.current = activeChat;
  }, [activeCard, activeChat]);

  useEffect(() => {
    authUserRef.current = authUser;
  }, [authUser]);

  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);

  useEffect(() => {
    window.localStorage.setItem(VISUAL_STORAGE_KEY, JSON.stringify(visualSettings));
    document.documentElement.dataset.theme = visualSettings.theme;
    document.documentElement.dataset.textScale = visualSettings.textScale;
    document.documentElement.dataset.density = visualSettings.density;
    document.documentElement.dataset.radius = visualSettings.radius;
    document.documentElement.dataset.motion = String(visualSettings.motion);
    document.documentElement.dataset.contrast = String(visualSettings.highContrast);
  }, [visualSettings]);

  useEffect(() => {
    void refreshLibrary();
    void loadGenerationSettings();
    void loadConnectionPresets();
    void loadPresetTypes();
    void loadLorebooks();
    void loadSecurityPermissions();
  }, []);

  useEffect(() => {
    if (authToken) {
      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authToken);
      void loadCurrentUser(authToken);
    } else {
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      setAuthUser(null);
    }
  }, [authToken]);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const currentY = window.scrollY;
      if (currentY < 24) {
        setTopbarVisible(true);
      } else if (currentY < lastY - 8) {
        setTopbarVisible(true);
      } else if (currentY > lastY + 8) {
        setTopbarVisible(false);
      }
      lastY = currentY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (selectedPersonaId) {
      window.localStorage.setItem(SELECTED_PERSONA_STORAGE_KEY, selectedPersonaId);
    }
  }, [selectedPersonaId]);

  useEffect(() => {
    sendPresence(selectedPersona);
  }, [selectedPersona?.id, selectedPersona?.name, selectedPersona?.avatar_url, authUser?.username, authUser?.is_admin]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws/sessions/default`);
    websocketRef.current = socket;
    socket.onopen = () => sendPresence(selectedPersona);
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data) as RealtimePayload;
      if (payload.type === 'chat.updated' && payload.chat) {
        if (activeChatRef.current?.id === payload.chat.id) {
          setActiveChat(payload.chat);
        }
        if (payload.card_id && activeCardRef.current?.id === payload.card_id) {
          void refreshCardChats(payload.card_id);
        }
      }
      if (payload.type === 'chat.deleted' && payload.chat_id === activeChatRef.current?.id) {
        setActiveChat(null);
      }
      if (payload.type === 'card.deleted' && payload.card_id) {
        setCards((current) => current.filter((card) => card.id !== payload.card_id));
        if (activeCardRef.current?.id === payload.card_id) {
          setActiveCard(null);
          setActiveChat(null);
          setBotChats([]);
        }
      }
      if ((payload.type === 'presence.updated' || payload.type === 'session.snapshot' || payload.type === 'session.updated') && payload.session?.participants) {
        setParticipants(Object.values(payload.session.participants));
      }
      if (payload.type === 'notification' && payload.message) {
        addToast(payload.message);
      }
      if (payload.type === 'generation.started' && payload.card_id === activeCardRef.current?.id && payload.chat_id === activeChatRef.current?.id) {
        setIsGenerating(true);
        setGenerationStatus(payload.replace_message_id ? 'Бот перегенерирует ответ...' : 'Бот думает...');
      }
      if ((payload.type === 'generation.finished' || payload.type === 'generation.cancelled' || payload.type === 'generation.failed') && payload.card_id === activeCardRef.current?.id && payload.chat_id === activeChatRef.current?.id) {
        setIsGenerating(false);
        setGenerationStatus('');
        if (payload.type === 'generation.failed' && payload.message) {
          addToast(payload.message);
        }
      }
      if (payload.type === 'security.updated') {
        setAuthRequired(Boolean(payload.auth_required));
        if (payload.permissions) {
          setSecurityPermissions({ ...defaultSecurityPermissions, ...payload.permissions });
        }
        void refreshAccessControlledData();
      }
    };
    return () => socket.close();
  }, []);

  const addToast = (message: string) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [...current.slice(-3), { id, message }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200);
  };

  const sendRealtimeEvent = (event: Record<string, unknown>) => {
    const socket = websocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(JSON.stringify({ username: authUserRef.current?.username || '', is_admin: Boolean(authUserRef.current?.is_admin), ...event }));
  };

  const actorHeaders = (token = authToken) => ({
    'X-DoubleTrouble-Actor': authUserRef.current?.username || selectedPersona?.name || 'Player',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const sendPresence = (persona: Persona | null) => {
    sendRealtimeEvent({
      type: 'presence.update',
      participant_id: participantIdRef.current,
      name: persona?.name || 'Player',
      persona_id: persona?.id || '',
      persona_name: persona?.name || '',
      avatar_url: persona?.avatar_url || '',
      username: authUserRef.current?.username || '',
      is_admin: Boolean(authUserRef.current?.is_admin),
    });
  };

  const authJsonHeaders = (token = authToken) => ({ 'Content-Type': 'application/json', ...actorHeaders(token) });
  const authedFetch = (url: string, init: RequestInit = {}, token = authToken) => fetch(url, { ...init, headers: { ...(init.headers || {}), ...actorHeaders(token) } });
  const imageSrc = (url: string) => authToken && url.startsWith('/api/') ? `${url}${url.includes('?') ? '&' : '?'}auth=${encodeURIComponent(authToken)}` : url;
  const deniedResponse = (response: Response) => response.status === 401 || response.status === 403;
  const markAccessDenied = (section: keyof AccessDeniedState, denied: boolean) => setAccessDenied((current) => ({ ...current, [section]: denied }));

  const loadCurrentUser = async (token = authToken) => {
    if (!token) {
      return;
    }
    const response = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      setAuthToken('');
      return;
    }
    const data = await response.json() as { user: AuthUser | null };
    setAuthUser(data.user);
  };

  const submitAuth = async (mode: 'login' | 'register') => {
    const response = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: authDraft.username, password: authDraft.password }),
    });
    const data = await response.json().catch(() => null) as { token?: string; user?: AuthUser; detail?: string } | null;
    if (!response.ok || !data?.token) {
      setAuthMessage(data?.detail || 'Не удалось войти');
      return;
    }
    setAuthToken(data.token);
    setAuthUser(data.user || null);
    setAuthDraft({ ...authDraft, password: '' });
    setAuthMessage(mode === 'login' ? 'Вход выполнен' : 'Пользователь создан');
    await Promise.all([refreshLibrary(data.token), loadGenerationSettings(data.token), loadConnectionPresets(data.token), loadPresetTypes(data.token), loadLorebooks(data.token)]);
    sendPresence(selectedPersona);
  };

  const logout = async () => {
    if (authToken) {
      await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${authToken}` } });
    }
    setAuthToken('');
    setAuthUser(null);
    setAuthMessage('Вы вышли');
    await Promise.all([refreshLibrary(''), loadGenerationSettings(''), loadConnectionPresets(''), loadPresetTypes(''), loadLorebooks('')]);
    sendPresence(selectedPersona);
  };

  const claimAdmin = async () => {
    const response = await fetch('/api/auth/claim-admin', {
      method: 'POST',
      headers: authJsonHeaders(),
      body: JSON.stringify({ code: authDraft.adminCode }),
    });
    const data = await response.json().catch(() => null) as { user?: AuthUser; detail?: string } | null;
    if (!response.ok || !data?.user) {
      setAuthMessage(data?.detail || 'Не удалось получить админ-права');
      return;
    }
    setAuthUser(data.user);
    setAuthDraft({ ...authDraft, adminCode: '' });
    setAuthMessage('Админ-права включены');
    sendPresence(selectedPersona);
  };

  const loadSecurityPermissions = async () => {
    const response = await fetch('/api/security/permissions');
    if (!response.ok) {
      return;
    }
    const data = await response.json() as { auth_required?: boolean; permissions: SecurityPermissions };
    setAuthRequired(Boolean(data.auth_required));
    setSecurityPermissions({ ...defaultSecurityPermissions, ...data.permissions });
  };

  const saveSecurityPermissions = async () => {
    const response = await fetch('/api/security/permissions', {
      method: 'PUT',
      headers: authJsonHeaders(),
      body: JSON.stringify({ auth_required: authRequired, permissions: securityPermissions }),
    });
    const data = await response.json().catch(() => null) as { auth_required?: boolean; permissions?: SecurityPermissions; detail?: string } | null;
    if (!response.ok || !data?.permissions) {
      setAuthMessage(data?.detail || 'Не удалось сохранить права');
      return;
    }
    setAuthRequired(Boolean(data.auth_required));
    setSecurityPermissions({ ...defaultSecurityPermissions, ...data.permissions });
    setAuthMessage('Права сохранены');
  };

  const refreshLibrary = async (token = authToken) => {
    const [cardsResponse, personasResponse] = await Promise.all([authedFetch('/api/cards', {}, token), authedFetch('/api/personas', {}, token)]);
    if (cardsResponse.ok) {
      const data = await cardsResponse.json() as { cards: CharacterCard[] };
      markAccessDenied('cards', false);
      setCards(data.cards);
      void restoreLastSelection(data.cards);
    } else if (deniedResponse(cardsResponse)) {
      markAccessDenied('cards', true);
      setCards([]);
      setActiveCard(null);
      setActiveChat(null);
      setBotChats([]);
    }
    if (personasResponse.ok) {
      const data = await personasResponse.json() as { personas: Persona[] };
      markAccessDenied('personas', false);
      setPersonas(data.personas);
      if (!selectedPersonaId && data.personas[0]) {
        setSelectedPersonaId(data.personas[0].id);
      }
    } else if (deniedResponse(personasResponse)) {
      markAccessDenied('personas', true);
      setPersonas([]);
    }
  };

  const loadGenerationSettings = async (token = authToken) => {
    const response = await authedFetch('/api/generation/settings', {}, token);
    if (!response.ok) {
      return;
    }
    const data = await response.json() as Partial<GenerationSettings>;
    setGenerationSettings({ ...defaultGenerationSettings, ...data, api_key: '', clear_api_key: false });
  };

  const loadConnectionPresets = async (token = authToken) => {
    const response = await authedFetch('/api/generation/presets', {}, token);
    if (!response.ok) {
      if (deniedResponse(response)) {
        markAccessDenied('presets', true);
        setConnectionPresets([]);
        setActiveConnectionPresetName('');
      }
      return;
    }
    const data = await response.json() as { presets: ConnectionPreset[]; active?: string };
    markAccessDenied('presets', false);
    setConnectionPresets(data.presets);
    setActiveConnectionPresetName(data.active || '');
  };

  const loadPresetTypes = async (token = authToken) => {
    const [typesResponse, activeResponse] = await Promise.all([authedFetch('/api/presets/types', {}, token), authedFetch('/api/presets/active', {}, token)]);
    let active: Record<string, string> = {};
    if (typesResponse.ok) {
      const data = await typesResponse.json() as { types: PresetTypeInfo[] };
      markAccessDenied('presets', false);
      setPresetTypes(data.types);
    }
    if (activeResponse.ok) {
      const data = await activeResponse.json() as { active: Record<string, string> };
      markAccessDenied('presets', false);
      active = data.active;
      setActivePresets(active);
    }
    if (deniedResponse(typesResponse) || deniedResponse(activeResponse)) {
      markAccessDenied('presets', true);
      setPresetTypes([]);
      setPresets([]);
      setSelectedPresetName('');
      setPresetNameDraft('');
      setPresetJsonDraft('{}');
      return;
    }
    await loadPresets(selectedPresetType, active[selectedPresetType], token);
  };

  const loadPresets = async (presetType: string, presetToOpen = '', token = authToken) => {
    const response = await authedFetch(`/api/presets/${encodeURIComponent(presetType)}`, {}, token);
    if (!response.ok) {
      if (deniedResponse(response)) {
        markAccessDenied('presets', true);
        setPresets([]);
        setSelectedPresetName('');
        setPresetNameDraft('');
        setPresetJsonDraft('{}');
      }
      setPresetMessage('Не удалось загрузить пресеты');
      return;
    }
    const data = await response.json() as { presets: PresetSummary[] };
    markAccessDenied('presets', false);
    setPresets(data.presets);
    if (presetToOpen && data.presets.some((preset) => preset.name === presetToOpen)) {
      await openPreset(presetType, presetToOpen, false, token);
    }
  };

  const changePresetType = async (presetType: string) => {
    setSelectedPresetType(presetType);
    setSelectedPresetName('');
    setPresetNameDraft('');
    setPresetJsonDraft('{}');
    await loadPresets(presetType, activePresets[presetType] || '');
  };

  const openPreset = async (presetType: string, name: string, apply: boolean, token = authToken) => {
    if (!name) {
      return;
    }
    const response = await authedFetch(`/api/presets/${encodeURIComponent(presetType)}/${encodeURIComponent(name)}`, {}, token);
    if (!response.ok) {
      if (deniedResponse(response)) {
        markAccessDenied('presets', true);
        setSelectedPresetName('');
        setPresetNameDraft('');
        setPresetJsonDraft('{}');
      }
      setPresetMessage('Не удалось открыть пресет');
      return;
    }
    const data = await response.json() as { preset: unknown };
    markAccessDenied('presets', false);
    setSelectedPresetName(name);
    setPresetNameDraft(name);
    setPresetJsonDraft(JSON.stringify(data.preset, null, 2));
    if (!apply) {
      return;
    }
    const applyResponse = await fetch(`/api/presets/${encodeURIComponent(presetType)}/${encodeURIComponent(name)}/apply`, { method: 'POST', headers: actorHeaders() });
    if (applyResponse.ok) {
      const applied = await applyResponse.json() as { active: Record<string, string>; settings: Partial<GenerationSettings> };
      setActivePresets(applied.active);
      setGenerationSettings({ ...generationSettings, ...applied.settings, api_key: '', clear_api_key: false });
    }
  };

  const selectPreset = async (name: string) => {
    await openPreset(selectedPresetType, name, true);
  };

  const savePreset = async () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(presetJsonDraft) as Record<string, unknown>;
    } catch {
      setPresetMessage('JSON пресета невалидный');
      return;
    }
    const name = presetNameDraft.trim() || selectedPresetName;
    if (!name) {
      setPresetMessage('Введи имя пресета');
      return;
    }
    const response = await fetch(`/api/presets/${encodeURIComponent(selectedPresetType)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...actorHeaders() },
      body: JSON.stringify({ name, preset: parsed }),
    });
    if (!response.ok) {
      setPresetMessage('Не удалось сохранить пресет');
      return;
    }
    setPresetMessage('Пресет сохранен');
    await loadPresets(selectedPresetType, name);
  };

  const importPreset = async (file: File | null) => {
    if (!file) {
      return;
    }
    const body = new FormData();
    body.append('file', file);
    const response = await fetch(`/api/presets/${encodeURIComponent(selectedPresetType)}/import`, { method: 'POST', headers: actorHeaders(), body });
    if (!response.ok) {
      setPresetMessage('Не удалось импортировать пресет');
      return;
    }
    const data = await response.json() as { preset?: PresetSummary };
    const importedName = data.preset?.name;
    setPresetMessage(importedName ? `Пресет импортирован: ${importedName}` : 'Пресет импортирован');
    await loadPresets(selectedPresetType);
    if (importedName) {
      await selectPreset(importedName);
    }
  };

  const applyPreset = async () => {
    if (!selectedPresetName) {
      setPresetMessage('Сначала выбери пресет');
      return;
    }
    const response = await fetch(`/api/presets/${encodeURIComponent(selectedPresetType)}/${encodeURIComponent(selectedPresetName)}/apply`, { method: 'POST', headers: actorHeaders() });
    if (!response.ok) {
      setPresetMessage('Не удалось применить пресет');
      return;
    }
    const data = await response.json() as { active: Record<string, string>; settings: Partial<GenerationSettings> };
    setActivePresets(data.active);
    setGenerationSettings({ ...generationSettings, ...data.settings, api_key: '', clear_api_key: false });
    setPresetMessage('Пресет применен');
  };

  const deletePreset = async () => {
    if (!selectedPresetName) {
      return;
    }
    const response = await fetch(`/api/presets/${encodeURIComponent(selectedPresetType)}/${encodeURIComponent(selectedPresetName)}`, { method: 'DELETE', headers: actorHeaders() });
    if (!response.ok) {
      setPresetMessage('Не удалось удалить пресет');
      return;
    }
    setSelectedPresetName('');
    setPresetNameDraft('');
    setPresetJsonDraft('{}');
    setPresetMessage('Пресет удален');
    await loadPresets(selectedPresetType);
  };

  const importSillyTavernDefaults = async () => {
    const body = new FormData();
    body.append('source_root', 'E:/ST/SillyTavern/default/content');
    const response = await fetch('/api/presets/import-sillytavern-defaults', { method: 'POST', headers: actorHeaders(), body });
    const data = await response.json().catch(() => null) as { copied?: number } | null;
    setPresetMessage(response.ok ? `Импортировано дефолтных пресетов: ${data?.copied ?? 0}` : 'Не удалось импортировать дефолты SillyTavern');
    await loadPresets(selectedPresetType);
  };

  const exportPreset = async () => {
    if (!selectedPresetName) {
      setPresetMessage('Сначала выбери пресет');
      return;
    }
    const response = await fetch(`/api/presets/${encodeURIComponent(selectedPresetType)}/${encodeURIComponent(selectedPresetName)}/export`, { headers: actorHeaders() });
    if (!response.ok) {
      setPresetMessage('Не удалось экспортировать пресет');
      return;
    }
    await downloadResponse(response, `${selectedPresetName}.json`);
    setPresetMessage('Экспорт пресета готов');
  };

  const loadLorebooks = async (token = authToken) => {
    const response = await authedFetch('/api/lorebooks', {}, token);
    if (!response.ok) {
      if (deniedResponse(response)) {
        markAccessDenied('lorebooks', true);
        setLorebooks([]);
        setLorebookBindings([]);
      }
      return;
    }
    const data = await response.json() as { lorebooks: LorebookSummary[]; bindings: LorebookBinding[] };
    markAccessDenied('lorebooks', false);
    setLorebooks(data.lorebooks);
    setLorebookBindings(data.bindings);
  };

  const openLorebook = async (name: string) => {
    if (!name) {
      return;
    }
    const response = await authedFetch(`/api/lorebooks/${encodeURIComponent(name)}`);
    if (!response.ok) {
      setLorebookMessage('Не удалось открыть лорбук');
      return;
    }
    const data = await response.json() as { book: unknown };
    setSelectedLorebookName(name);
    setLorebookNameDraft(name);
    setLorebookBindingDraft({ ...lorebookBindingDraft, book: name });
    setLorebookJsonDraft(JSON.stringify(data.book, null, 2));
  };

  const saveLorebook = async () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(lorebookJsonDraft) as Record<string, unknown>;
    } catch {
      setLorebookMessage('JSON лорбука невалидный');
      return;
    }
    const name = lorebookNameDraft.trim() || selectedLorebookName;
    if (!name) {
      setLorebookMessage('Введи имя лорбука');
      return;
    }
    const response = await fetch('/api/lorebooks', { method: 'PUT', headers: authJsonHeaders(), body: JSON.stringify({ name, book: parsed }) });
    if (!response.ok) {
      setLorebookMessage('Не удалось сохранить лорбук');
      return;
    }
    setLorebookMessage('Лорбук сохранен');
    await loadLorebooks();
    await openLorebook(name);
  };

  const importLorebook = async (file: File | null) => {
    if (!file) {
      return;
    }
    const body = new FormData();
    body.append('file', file);
    const response = await fetch('/api/lorebooks/import', { method: 'POST', headers: actorHeaders(), body });
    if (!response.ok) {
      setLorebookMessage('Не удалось импортировать лорбук');
      return;
    }
    const data = await response.json() as { lorebook?: LorebookSummary };
    await loadLorebooks();
    if (data.lorebook?.name) {
      await openLorebook(data.lorebook.name);
    }
    setLorebookMessage('Лорбук импортирован');
  };

  const exportLorebook = async () => {
    if (!selectedLorebookName) {
      setLorebookMessage('Сначала выбери лорбук');
      return;
    }
    const response = await fetch(`/api/lorebooks/${encodeURIComponent(selectedLorebookName)}/export`, { headers: actorHeaders() });
    if (!response.ok) {
      setLorebookMessage('Не удалось экспортировать лорбук');
      return;
    }
    await downloadResponse(response, `${selectedLorebookName}.json`);
    setLorebookMessage('Экспорт лорбука готов');
  };

  const deleteLorebook = async () => {
    if (!selectedLorebookName || !window.confirm(`Удалить лорбук "${selectedLorebookName}"?`)) {
      return;
    }
    const response = await fetch(`/api/lorebooks/${encodeURIComponent(selectedLorebookName)}`, { method: 'DELETE', headers: actorHeaders() });
    if (!response.ok) {
      setLorebookMessage('Не удалось удалить лорбук');
      return;
    }
    setSelectedLorebookName('');
    setLorebookNameDraft('');
    setLorebookJsonDraft('{\n  "entries": {}\n}');
    await loadLorebooks();
  };

  const saveLorebookBindings = async (bindings = lorebookBindings) => {
    const response = await fetch('/api/lorebooks/bindings', { method: 'PUT', headers: authJsonHeaders(), body: JSON.stringify({ bindings }) });
    if (!response.ok) {
      setLorebookMessage('Не удалось сохранить привязки');
      return;
    }
    const data = await response.json() as { bindings: LorebookBinding[] };
    setLorebookBindings(data.bindings);
    setLorebookMessage('Привязки сохранены');
    await loadLorebooks();
  };

  const addLorebookBinding = async () => {
    const book = lorebookBindingDraft.book || selectedLorebookName;
    if (!book) {
      setLorebookMessage('Выбери лорбук для привязки');
      return;
    }
    const binding = { ...lorebookBindingDraft, book, target_id: lorebookBindingDraft.target_type === 'global' ? '' : lorebookBindingDraft.target_id };
    await saveLorebookBindings([...lorebookBindings, binding]);
  };

  const removeLorebookBinding = async (index: number) => {
    await saveLorebookBindings(lorebookBindings.filter((_, itemIndex) => itemIndex !== index));
  };

  const lastChatByCard = () => {
    try {
      return JSON.parse(window.localStorage.getItem(LAST_CHAT_BY_CARD_STORAGE_KEY) || '{}') as Record<string, string>;
    } catch {
      return {};
    }
  };

  const rememberChatSelection = (cardId: string, chatId: string) => {
    const map = lastChatByCard();
    map[cardId] = chatId;
    window.localStorage.setItem(LAST_CARD_STORAGE_KEY, cardId);
    window.localStorage.setItem(LAST_CHAT_BY_CARD_STORAGE_KEY, JSON.stringify(map));
  };

  const forgetChatSelection = (cardId: string, chatId: string) => {
    const map = lastChatByCard();
    if (map[cardId] === chatId) {
      delete map[cardId];
      window.localStorage.setItem(LAST_CHAT_BY_CARD_STORAGE_KEY, JSON.stringify(map));
    }
  };

  const openChatForCard = async (card: CharacterCard, chatId: string, token = authToken) => {
    const response = await authedFetch(`/api/cards/${encodeURIComponent(card.id)}/chats/${encodeURIComponent(chatId)}`, {}, token);
    if (!response.ok) {
      if (deniedResponse(response)) {
        markAccessDenied('chats', true);
        setActiveChat(null);
        setBotChats([]);
        setChatPickerOpen(false);
      }
      return false;
    }
    const data = await response.json() as { chat: BotChat };
    markAccessDenied('chats', false);
    setActiveCard(card);
    setActiveChat(data.chat);
    setChatPickerOpen(false);
    rememberChatSelection(card.id, data.chat.id);
    await refreshCardChats(card.id, token);
    return true;
  };

  const refreshAccessControlledData = async () => {
    const token = authTokenRef.current;
    await Promise.all([refreshLibrary(token), loadConnectionPresets(token), loadPresetTypes(token), loadLorebooks(token)]);
    const card = activeCardRef.current;
    const chat = activeChatRef.current;
    if (card) {
      await refreshCardChats(card.id, token);
    }
    if (card && chat) {
      await openChatForCard(card, chat.id, token);
    }
  };

  const restoreLastSelection = async (availableCards: CharacterCard[]) => {
    if (restoredSelectionRef.current) {
      return;
    }
    restoredSelectionRef.current = true;
    const lastCardId = window.localStorage.getItem(LAST_CARD_STORAGE_KEY) || '';
    const card = availableCards.find((item) => item.id === lastCardId);
    if (card) {
      await selectBotCard(card, false);
    }
  };

  const saveGenerationSettings = async () => {
    const name = connectionPresetName.trim();
    if (!name) {
      setConnectionMessage('Введи название пресета');
      return;
    }
    setConnectionMessage('Сохраняю подключение и пресет...');
    const response = await fetch('/api/generation/presets', {
      method: 'POST',
      headers: authJsonHeaders(),
      body: JSON.stringify({ name, settings: generationSettings }),
    });
    if (!response.ok) {
      setConnectionMessage('Не удалось сохранить подключение');
      return;
    }
    const data = await response.json() as { settings: Partial<GenerationSettings> };
    setGenerationSettings({ ...generationSettings, ...data.settings, api_key: '', clear_api_key: false });
    setConnectionPresetName('');
    await loadConnectionPresets();
    setConnectionMessage('Подключение сохранено в пресет');
  };

  const applyConnectionPreset = async (presetName: string) => {
    const preset = connectionPresets.find((item) => item.name === presetName);
    if (!preset) {
      return;
    }
    const response = await fetch(`/api/generation/presets/${encodeURIComponent(presetName)}/active`, { method: 'POST', headers: actorHeaders() });
    if (!response.ok) {
      setConnectionMessage('Не удалось выбрать пресет подключения');
      return;
    }
    const data = await response.json() as { settings: Partial<GenerationSettings>; active: string };
    setGenerationSettings({ ...generationSettings, ...data.settings, api_key: '', clear_api_key: false });
    setActiveConnectionPresetName(data.active);
    setConnectionMessage(`Пресет выбран: ${preset.name}`);
  };

  const deleteConnectionPreset = async (presetName: string) => {
    if (!presetName) {
      return;
    }
    const response = await fetch(`/api/generation/presets/${encodeURIComponent(presetName)}`, { method: 'DELETE', headers: actorHeaders() });
    if (!response.ok) {
      setConnectionMessage('Не удалось удалить пресет');
      return;
    }
    const data = await response.json().catch(() => null) as { active?: string } | null;
    setActiveConnectionPresetName(data?.active || '');
    await loadConnectionPresets();
    setConnectionMessage('Пресет удален');
  };

  const checkConnection = async () => {
    setConnectionMessage('Проверяю подключение...');
    const response = await fetch('/api/generation/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generationSettings),
    });
    const data = await response.json().catch(() => null) as { ok?: boolean; error?: string; models?: unknown } | null;
    if (!response.ok || !data?.ok) {
      setConnectionMessage(data?.error || 'Провайдер недоступен');
      return;
    }
    const modelNames = extractModelNames(data.models);
    setModels(modelNames);
    setConnectionMessage(modelNames.length ? `Найдено моделей: ${modelNames.length}` : 'Подключение работает, но список моделей пуст');
  };

  const refreshCardChats = async (cardId: string, token = authToken) => {
    const response = await authedFetch(`/api/cards/${encodeURIComponent(cardId)}/chats`, {}, token);
    if (response.ok) {
      const data = await response.json() as { chats: BotChatSummary[] };
      markAccessDenied('chats', false);
      setBotChats(data.chats);
      return true;
    }
    if (deniedResponse(response)) {
      markAccessDenied('chats', true);
      setBotChats([]);
      setActiveChat(null);
      setChatPickerOpen(false);
    }
    return false;
  };

  const importCard = async (file: File | null) => {
    if (!file) {
      return;
    }
    const body = new FormData();
    body.append('file', file);
    setLibraryMessage('Импортирую карточку...');
    const response = await fetch('/api/cards/import', { method: 'POST', headers: actorHeaders(), body });
    if (!response.ok) {
      const error = await response.json().catch(() => null) as { detail?: string } | null;
      setLibraryMessage(error?.detail || 'Не удалось импортировать карточку');
      return;
    }
    setLibraryMessage('Карточка импортирована');
    await refreshLibrary();
  };

  const createCard = async () => {
    const name = cardDraft.name.trim();
    if (!name) {
      setLibraryMessage('Введите имя карточки');
      return;
    }
    const body = new FormData();
    body.append('name', name);
    body.append('description', cardDraft.description);
    body.append('personality', cardDraft.personality);
    body.append('scenario', cardDraft.scenario);
    body.append('first_message', cardDraft.firstMessage);
    body.append('message_example', cardDraft.messageExample);
    body.append('creator', cardDraft.creator);
    body.append('tags', cardDraft.tags);
    if (cardAvatar) {
      body.append('avatar', cardAvatar);
    }
    setLibraryMessage('Создаю карточку...');
    const response = await fetch('/api/cards', { method: 'POST', headers: actorHeaders(), body });
    if (!response.ok) {
      const error = await response.json().catch(() => null) as { detail?: string } | null;
      setLibraryMessage(error?.detail || 'Не удалось создать карточку');
      return;
    }
    setCardDraft(emptyCardDraft);
    setCardAvatar(null);
    setLibraryMessage('Карточка создана');
    await refreshLibrary();
  };

  const updateCard = async (cardId: string, draft: CardDraft) => {
    const name = draft.name.trim();
    if (!name) {
      setLibraryMessage('Введите имя карточки');
      return;
    }
    const response = await fetch(`/api/cards/${encodeURIComponent(cardId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...actorHeaders() },
      body: JSON.stringify({
        name,
        description: draft.description,
        personality: draft.personality,
        scenario: draft.scenario,
        first_message: draft.firstMessage,
        message_example: draft.messageExample,
        creator: draft.creator,
        tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null) as { detail?: string } | null;
      setLibraryMessage(error?.detail || 'Не удалось сохранить карточку');
      return;
    }
    const data = await response.json() as { card: CharacterCard };
    setCards((current) => current.map((card) => card.id === data.card.id ? data.card : card));
    if (activeCard?.id === data.card.id) {
      setActiveCard(data.card);
    }
    setLibraryMessage('Карточка сохранена');
  };

  const deleteCard = async (card: CharacterCard) => {
    if (!window.confirm(`Удалить карточку "${card.name}" и ее чаты?`)) {
      return;
    }
    const response = await fetch(`/api/cards/${encodeURIComponent(card.id)}`, { method: 'DELETE', headers: actorHeaders() });
    if (!response.ok) {
      setLibraryMessage('Не удалось удалить карточку');
      return;
    }
    setCards((current) => current.filter((item) => item.id !== card.id));
    if (activeCard?.id === card.id) {
      setActiveCard(null);
      setActiveChat(null);
      setBotChats([]);
    }
    setLibraryMessage('Карточка удалена');
  };

  const uploadCardAvatar = async (card: CharacterCard, file: File | null) => {
    if (!file) {
      return;
    }
    const body = new FormData();
    body.append('file', file);
    const response = await fetch(`/api/cards/${encodeURIComponent(card.id)}/avatar`, { method: 'POST', headers: actorHeaders(), body });
    if (!response.ok) {
      const error = await response.json().catch(() => null) as { detail?: string } | null;
      setLibraryMessage(error?.detail || 'Не удалось обновить аватар карточки');
      return;
    }
    const data = await response.json() as { card: CharacterCard };
    setCards((current) => current.map((item) => item.id === data.card.id ? data.card : item));
    if (activeCard?.id === data.card.id) {
      setActiveCard(data.card);
    }
    setLibraryMessage('Аватар карточки обновлен');
  };

  const selectBotCard = async (card: CharacterCard, notify = true) => {
    const rememberedChatId = lastChatByCard()[card.id];
    if (rememberedChatId && await openChatForCard(card, rememberedChatId)) {
      setLibraryMessage(`Открыт последний чат: ${card.name}`);
      if (notify) {
        sendRealtimeEvent({ type: 'card.select', name: card.name, persona_name: selectedPersona?.name || 'Player' });
      }
      return;
    }

    const response = await fetch(`/api/cards/${encodeURIComponent(card.id)}/chats/current`, {
      method: 'POST',
      headers: authJsonHeaders(),
      body: JSON.stringify({ character_name: card.name, title: 'New Chat' }),
    });
    if (!response.ok) {
      setLibraryMessage('Не удалось открыть чат бота');
      return;
    }
    const chatData = await response.json() as { chat: BotChat };
    await refreshCardChats(card.id);
    setActiveCard(card);
    setActiveChat(chatData.chat);
    rememberChatSelection(card.id, chatData.chat.id);
    setLibraryMessage(`Открыт чат: ${chatData.chat.title}`);
    if (notify) {
      sendRealtimeEvent({ type: 'card.select', name: card.name, persona_name: selectedPersona?.name || 'Player' });
    }
  };

  const createBotChat = async () => {
    if (!activeCard) {
      setLibraryMessage('Сначала выбери карточку бота');
      return;
    }
    const response = await fetch(`/api/cards/${encodeURIComponent(activeCard.id)}/chats`, {
      method: 'POST',
      headers: authJsonHeaders(),
      body: JSON.stringify({ character_name: activeCard.name, title: `Chat ${new Date().toLocaleString()}` }),
    });
    if (!response.ok) {
      setLibraryMessage('Не удалось создать чат');
      return;
    }
    const { chat } = await response.json() as { chat: BotChat };
    setActiveChat(chat);
    rememberChatSelection(activeCard.id, chat.id);
    await refreshCardChats(activeCard.id);
  };

  const selectChat = async (chatId: string) => {
    if (!activeCard) {
      return;
    }
    const opened = await openChatForCard(activeCard, chatId);
    if (!opened) {
      setLibraryMessage('Не удалось открыть чат');
    }
  };

  const copyChat = async (chatId: string) => {
    if (!activeCard) {
      return;
    }
    const response = await fetch(`/api/cards/${encodeURIComponent(activeCard.id)}/chats/${encodeURIComponent(chatId)}/copy`, { method: 'POST', headers: actorHeaders() });
    if (!response.ok) {
      setLibraryMessage('Не удалось скопировать чат');
      return;
    }
    const data = await response.json() as { chat: BotChat };
    setActiveChat(data.chat);
    rememberChatSelection(activeCard.id, data.chat.id);
    await refreshCardChats(activeCard.id);
  };

  const exportChat = async (chatId: string) => {
    if (!activeCard) {
      return;
    }
    const response = await fetch(`/api/cards/${encodeURIComponent(activeCard.id)}/chats/${encodeURIComponent(chatId)}/export/sillytavern`, { headers: actorHeaders() });
    if (!response.ok) {
      setLibraryMessage('Не удалось экспортировать чат для SillyTavern');
      return;
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filenameFromContentDisposition(response.headers.get('Content-Disposition')) || `${activeCard.name}.jsonl`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    setLibraryMessage('Экспорт SillyTavern .jsonl готов');
  };

  const renameChat = async (chat: BotChatSummary) => {
    if (!activeCard) {
      return;
    }
    const title = (chatRenameDrafts[chat.id] || chat.title).trim();
    if (!title || title === chat.title) {
      return;
    }
    const response = await fetch(`/api/cards/${encodeURIComponent(activeCard.id)}/chats/${encodeURIComponent(chat.id)}`, {
      method: 'PUT',
      headers: authJsonHeaders(),
      body: JSON.stringify({ title }),
    });
    if (!response.ok) {
      setLibraryMessage('Не удалось переименовать чат');
      return;
    }
    const data = await response.json() as { chat: BotChat };
    if (activeChat?.id === data.chat.id) {
      setActiveChat(data.chat);
    }
    await refreshCardChats(activeCard.id);
    setChatRenameDrafts((current) => ({ ...current, [chat.id]: '' }));
  };

  const deleteChat = async (chatId: string) => {
    if (!activeCard) {
      return;
    }
    const response = await fetch(`/api/cards/${encodeURIComponent(activeCard.id)}/chats/${encodeURIComponent(chatId)}`, { method: 'DELETE', headers: actorHeaders() });
    if (!response.ok) {
      setLibraryMessage('Не удалось удалить чат');
      return;
    }
    if (activeChat?.id === chatId) {
      setActiveChat(null);
    }
    forgetChatSelection(activeCard.id, chatId);
    await refreshCardChats(activeCard.id);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isGenerating) {
      return;
    }
    if (chatInput.trimStart().startsWith('/')) {
      await executeSlashCommand(chatInput);
      return;
    }
    if (!activeCard || !activeChat) {
      return;
    }
    const content = chatInput;
    setChatInput('');
    const response = await fetch(`/api/cards/${encodeURIComponent(activeCard.id)}/chats/${encodeURIComponent(activeChat.id)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: selectedPersona?.name || 'Player', participant_id: participantIdRef.current, avatar_url: selectedPersona?.avatar_url || '', username: authUser?.username || '', is_admin: Boolean(authUser?.is_admin), role: 'user', content }),
    });
    if (!response.ok) {
      setChatInput(content);
      setLibraryMessage('Не удалось отправить сообщение');
      return;
    }
    const data = await response.json() as { chat: BotChat };
    setActiveChat(data.chat);
  };

  const messageIndexesFromInput = (input: string) => {
    const tokens = input.split(/[\s,]+/).map((token) => token.trim()).filter(Boolean);
    const indexes = new Set<number>();
    for (const token of tokens) {
      const range = token.match(/^(\d+)-(\d+)$/);
      if (range) {
        const start = Number(range[1]);
        const end = Number(range[2]);
        const step = start <= end ? 1 : -1;
        for (let index = start; step > 0 ? index <= end : index >= end; index += step) {
          if (activeMessages[index]) {
            indexes.add(index);
          }
        }
        continue;
      }
      const index = Number(token);
      if (Number.isInteger(index) && activeMessages[index]) {
        indexes.add(index);
      }
    }
    return [...indexes].sort((left, right) => left - right);
  };

  const updateMessagesHidden = async (indexes: number[], hidden: boolean) => {
    if (!activeCard || !activeChat || !indexes.length) {
      setLibraryMessage('Укажи номера сообщений, например /hide 1-3');
      return;
    }
    let latestChat: BotChat | null = null;
    for (const index of indexes) {
      const message = activeMessages[index];
      if (!message) {
        continue;
      }
      const response = await fetch(`/api/cards/${encodeURIComponent(activeCard.id)}/chats/${encodeURIComponent(activeChat.id)}/messages/${encodeURIComponent(message.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...actorHeaders() },
        body: JSON.stringify({ hidden }),
      });
      if (response.ok) {
        const data = await response.json() as { chat: BotChat };
        latestChat = data.chat;
      }
    }
    if (latestChat) {
      setActiveChat(latestChat);
      setLibraryMessage(hidden ? 'Сообщения скрыты' : 'Сообщения показаны');
    }
  };

  const deleteMessagesByIndex = async (indexes: number[]) => {
    if (!activeCard || !activeChat || !indexes.length) {
      setLibraryMessage('Укажи номера сообщений, например /delete 2 4-5');
      return;
    }
    let latestChat: BotChat | null = null;
    for (const index of [...indexes].sort((left, right) => right - left)) {
      const message = activeMessages[index];
      if (!message) {
        continue;
      }
      const response = await fetch(`/api/cards/${encodeURIComponent(activeCard.id)}/chats/${encodeURIComponent(activeChat.id)}/messages/${encodeURIComponent(message.id)}`, { method: 'DELETE', headers: actorHeaders() });
      if (response.ok) {
        const data = await response.json() as { chat: BotChat };
        latestChat = data.chat;
      }
    }
    if (latestChat) {
      setActiveChat(latestChat);
      setLibraryMessage('Сообщения удалены');
    }
  };

  const executeSlashCommand = async (rawCommand: string) => {
    const [commandToken, ...args] = rawCommand.trim().split(/\s+/);
    const command = commandToken.toLowerCase();
    const argText = args.join(' ');
    if (command === '/help') {
      setLibraryMessage(`Команды: ${slashCommands.map((item) => `${item.command}${item.hint ? ` ${item.hint}` : ''}`).join(', ')}`);
      setChatInput('');
      return;
    }
    if (command === '/reroll') {
      setChatInput('');
      await rerollLastBotMessage();
      return;
    }
    const indexes = messageIndexesFromInput(argText || `${Math.max(0, activeMessages.length - 1)}`);
    if (command === '/hide') {
      setChatInput('');
      await updateMessagesHidden(indexes, true);
      return;
    }
    if (command === '/unhide') {
      setChatInput('');
      await updateMessagesHidden(indexes, false);
      return;
    }
    if (command === '/delete') {
      setChatInput('');
      await deleteMessagesByIndex(indexes);
      return;
    }
    if (command === '/copy') {
      const text = indexes.map((index) => {
        const message = activeMessages[index];
        return message ? `#${index} ${message.author}: ${message.content}` : '';
      }).filter(Boolean).join('\n\n');
      if (!text) {
        setLibraryMessage('Нечего копировать');
        return;
      }
      await window.navigator.clipboard.writeText(text);
      setChatInput('');
      setLibraryMessage('Сообщения скопированы');
      return;
    }
    setLibraryMessage('Неизвестная команда. Используй /help');
  };

  const startEditMessage = (message: ChatMessage) => {
    setEditingMessageId(message.id);
    setEditingMessageText(message.content);
  };

  const editChatMessage = async (message: ChatMessage) => {
    if (!activeCard || !activeChat) {
      return;
    }
    const content = editingMessageText.trim();
    if (!content || content === message.content) {
      setEditingMessageId('');
      setEditingMessageText('');
      return;
    }
    const response = await fetch(`/api/cards/${encodeURIComponent(activeCard.id)}/chats/${encodeURIComponent(activeChat.id)}/messages/${encodeURIComponent(message.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...actorHeaders() },
      body: JSON.stringify({ content }),
    });
    if (!response.ok) {
      setLibraryMessage('Не удалось отредактировать сообщение');
      return;
    }
    const data = await response.json() as { chat: BotChat };
    setActiveChat(data.chat);
    setEditingMessageId('');
    setEditingMessageText('');
  };

  const toggleMessageHidden = async (message: ChatMessage) => {
    if (!activeCard || !activeChat) {
      return;
    }
    const response = await fetch(`/api/cards/${encodeURIComponent(activeCard.id)}/chats/${encodeURIComponent(activeChat.id)}/messages/${encodeURIComponent(message.id)}`, {
      method: 'PUT',
      headers: authJsonHeaders(),
      body: JSON.stringify({ hidden: !message.hidden }),
    });
    if (!response.ok) {
      setLibraryMessage('Не удалось скрыть сообщение');
      return;
    }
    const data = await response.json() as { chat: BotChat };
    setActiveChat(data.chat);
  };

  const deleteChatMessage = async (message: ChatMessage) => {
    if (!activeCard || !activeChat) {
      return;
    }
    const response = await fetch(`/api/cards/${encodeURIComponent(activeCard.id)}/chats/${encodeURIComponent(activeChat.id)}/messages/${encodeURIComponent(message.id)}`, { method: 'DELETE', headers: actorHeaders() });
    if (!response.ok) {
      setLibraryMessage('Не удалось удалить сообщение');
      return;
    }
    const data = await response.json() as { chat: BotChat };
    setActiveChat(data.chat);
  };

  const swipeBotMessage = async (message: ChatMessage, direction: -1 | 1) => {
    if (!activeCard || !activeChat || message.role !== 'assistant') {
      return;
    }
    const response = await fetch(`/api/cards/${encodeURIComponent(activeCard.id)}/chats/${encodeURIComponent(activeChat.id)}/messages/${encodeURIComponent(message.id)}/swipe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction }),
    });
    if (!response.ok) {
      setLibraryMessage('Не удалось переключить swipe');
      return;
    }
    const data = await response.json() as { chat: BotChat };
    setActiveChat(data.chat);
  };

  const requestBotReply = async (replaceMessageId?: string, sourceChat?: BotChat, resetSwipes = false) => {
    const chat = sourceChat || activeChat;
    if (!activeCard || !chat || isGenerating) {
      setLibraryMessage('Сначала выбери карточку и чат');
      return;
    }
    setIsGenerating(true);
    setGenerationStatus(replaceMessageId ? 'Бот перегенерирует ответ...' : 'Бот думает...');
    setLibraryMessage(replaceMessageId ? 'Реролл ответа...' : 'Бот отвечает...');
    try {
      const response = await fetch(`/api/cards/${encodeURIComponent(activeCard.id)}/chats/${encodeURIComponent(chat.id)}/bot/reply`, {
        method: 'POST',
        headers: authJsonHeaders(),
        body: JSON.stringify({
          replace_message_id: replaceMessageId || null,
          reset_swipes: resetSwipes,
          persona_id: selectedPersona?.id || '',
          persona_name: selectedPersona?.name || '',
          persona_description: selectedPersona?.description || '',
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null) as { detail?: string } | null;
        setLibraryMessage(response.status === 499 ? 'Генерация отменена' : error?.detail || 'Не удалось получить ответ бота');
        return;
      }
      const data = await response.json() as { chat: BotChat };
      setActiveChat(data.chat);
      setLibraryMessage(replaceMessageId ? 'Реролл добавлен в swipes' : 'Ответ бота добавлен');
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
    }
  };

  const rerollLastBotMessage = async () => {
    const lastBotMessage = [...activeMessages].reverse().find((message) => message.role === 'assistant');
    if (!lastBotMessage) {
      setLibraryMessage('Нет ответа бота для реролла');
      return;
    }
    await requestBotReply(lastBotMessage.id, undefined, true);
  };

  const cancelGeneration = async () => {
    if (!activeCard || !activeChat || !isGenerating) {
      return;
    }
    setGenerationStatus('Отмена генерации...');
    await fetch(`/api/cards/${encodeURIComponent(activeCard.id)}/chats/${encodeURIComponent(activeChat.id)}/bot/cancel`, { method: 'POST', headers: actorHeaders() });
  };

  const createPersona = async () => {
    const name = personaDraft.name.trim();
    if (!name) {
      setLibraryMessage('Введите имя персоны');
      return;
    }
    const response = await fetch('/api/personas', {
      method: 'POST',
      headers: authJsonHeaders(),
      body: JSON.stringify({ name, description: personaDraft.description }),
    });
    if (!response.ok) {
      setLibraryMessage('Не удалось создать персону');
      return;
    }
    const data = await response.json() as { persona: Persona };
    setPersonaDraft({ name: '', description: '' });
    setSelectedPersonaId(data.persona.id);
    setLibraryMessage('Персона создана');
    await refreshLibrary();
  };

  const selectLocalPersona = (personaId: string) => {
    const persona = personas.find((item) => item.id === personaId) ?? null;
    setSelectedPersonaId(personaId);
    setLibraryMessage('Персона выбрана для этого браузера');
    if (persona) {
      sendRealtimeEvent({ type: 'notification', content: `выбрал персону: ${persona.name}`, persona_name: persona.name });
      sendPresence(persona);
    }
  };

  const activatePersona = async (personaId: string) => {
    const response = await fetch(`/api/personas/${personaId}/active`, { method: 'PUT', headers: actorHeaders() });
    if (!response.ok) {
      setLibraryMessage('Не удалось активировать персону');
      return;
    }
    await refreshLibrary();
  };

  const editPersona = (personaId: string, patch: Partial<Pick<Persona, 'name' | 'description'>>) => {
    setPersonas((current) => current.map((persona) => persona.id === personaId ? { ...persona, ...patch } : persona));
  };

  const updatePersona = async (persona: Persona) => {
    const response = await fetch(`/api/personas/${persona.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...actorHeaders() },
      body: JSON.stringify({ name: persona.name, description: persona.description }),
    });
    if (!response.ok) {
      setLibraryMessage('Не удалось сохранить персону');
      return;
    }
    setLibraryMessage('Персона сохранена');
    await refreshLibrary();
  };

  const deletePersona = async (persona: Persona) => {
    if (!window.confirm(`Удалить персону "${persona.name}"?`)) {
      return;
    }
    const response = await fetch(`/api/personas/${persona.id}`, { method: 'DELETE', headers: actorHeaders() });
    if (!response.ok) {
      setLibraryMessage('Не удалось удалить персону');
      return;
    }
    if (selectedPersonaId === persona.id) {
      setSelectedPersonaId('');
      window.localStorage.removeItem(SELECTED_PERSONA_STORAGE_KEY);
    }
    setLibraryMessage('Персона удалена');
    await refreshLibrary();
  };

  const uploadPersonaAvatar = async (personaId: string, file: File | null) => {
    if (!file) {
      return;
    }
    const body = new FormData();
    body.append('file', file);
    const response = await fetch(`/api/personas/${personaId}/avatar`, { method: 'POST', headers: actorHeaders(), body });
    if (!response.ok) {
      setLibraryMessage('Не удалось загрузить аватарку');
      return;
    }
    setLibraryMessage('Аватарка обновлена');
    await refreshLibrary();
  };

  if (authRequired && !authUser) {
    return (
      <AuthGate
        authDraft={authDraft}
        setAuthDraft={setAuthDraft}
        authMessage={authMessage}
        login={() => submitAuth('login')}
        register={() => submitAuth('register')}
      />
    );
  }

  return (
    <main
      className="app-shell"
      data-message-width={visualSettings.messageWidth}
      data-show-avatars={String(visualSettings.showAvatars)}
      data-sticky-composer={String(visualSettings.stickyComposer)}
    >
      <header className={topbarVisible ? 'topbar topbar-visible' : 'topbar topbar-hidden'}>
        <button className="menu-trigger" type="button" onClick={() => setMenuOpen(true)}>
          <Icon name="menu" />
          Меню
        </button>
        <div className="brand-block">
          <div>
            <strong>DoubleTrouble</strong>
            <small>default session · 127.0.0.1:8017</small>
          </div>
          <span className="brand-mark">DT</span>
        </div>
      </header>

      <div className="turn-strip app-status-strip">
        <div>
          <span>Персона</span>
          <strong>{selectedPersona?.name || 'не выбрана'}</strong>
        </div>
        <div>
          <span>Активный чат</span>
          <strong>{activeCard?.name || 'карточка не выбрана'} · {activeChat?.title || 'чат не выбран'}</strong>
        </div>
        <div>
          <span>Игроки</span>
          <div className="players-strip">
            {connectedPlayers.length ? connectedPlayers.map((player) => (
              <span className="player-pill" key={player.id} title={player.persona_name || player.name}>
                {player.avatar_url ? <button className="avatar-preview-button" type="button" onClick={() => setImagePreview({ src: imageSrc(player.avatar_url), title: player.persona_name || player.name })}><img src={imageSrc(player.avatar_url)} alt="" loading="lazy" /></button> : <i>{(player.persona_name || player.name).slice(0, 1) || '?'}</i>}
                <strong className="identity-name">{player.is_admin ? <span className="admin-crown">♛</span> : null}<span>{player.persona_name || player.name}</span></strong>
                {player.username ? <small className="hover-username">({player.username})</small> : null}
              </span>
            )) : <strong>нет подключенных</strong>}
          </div>
        </div>
      </div>

      <section className="hybrid-layout">
        <section className="chat-stage">
          <div className="chat-scroll">
            {accessDenied.chats ? <AccessDeniedNotice /> : activeMessages.length ? activeMessages.map((message, messageIndex) => {
              const isOwnMessage = message.role === 'user' && (message.participant_id ? message.participant_id === participantIdRef.current : message.author === selectedPersona?.name);
              const messageClass = `${message.role === 'assistant' ? 'message bot-message' : 'message'}${message.hidden ? ' hidden-message' : ''}${isOwnMessage ? ' own-message' : ''}`;
              const swipeCount = message.swipes?.length ?? 0;
              const canSwipe = message.role === 'assistant' && swipeCount > 1;
              return (
              <article
                className={messageClass}
                key={message.id}
                tabIndex={canSwipe ? 0 : undefined}
                onKeyDown={(event) => {
                  if (!canSwipe || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) {
                    return;
                  }
                  event.preventDefault();
                  void swipeBotMessage(message, event.key === 'ArrowLeft' ? -1 : 1);
                }}
                onTouchStart={(event) => {
                  if (canSwipe) {
                    swipeTouchStartRef.current[message.id] = event.touches[0]?.clientX ?? 0;
                  }
                }}
                onTouchEnd={(event) => {
                  if (!canSwipe) {
                    return;
                  }
                  const startX = swipeTouchStartRef.current[message.id] ?? 0;
                  const deltaX = (event.changedTouches[0]?.clientX ?? startX) - startX;
                  delete swipeTouchStartRef.current[message.id];
                  if (Math.abs(deltaX) > 48) {
                    void swipeBotMessage(message, deltaX > 0 ? -1 : 1);
                  }
                }}
              >
                <div className="message-actions" aria-label="Действия сообщения">
                  {canSwipe ? <button type="button" title="Предыдущий swipe" onClick={() => void swipeBotMessage(message, -1)}>‹</button> : null}
                  {canSwipe ? <button type="button" title="Следующий swipe" onClick={() => void swipeBotMessage(message, 1)}>›</button> : null}
                  {message.role === 'assistant' ? <button type="button" title="Новый swipe" onClick={() => void requestBotReply(message.id)}>↻</button> : null}
                  <button type="button" title="Редактировать" onClick={() => startEditMessage(message)}><Icon name="edit" /></button>
                  <button type="button" title={message.hidden ? 'Показать' : 'Скрыть'} onClick={() => void toggleMessageHidden(message)}><Icon name={message.hidden ? 'eye' : 'eyeOff'} /></button>
                  <button type="button" title="Удалить" onClick={() => void deleteChatMessage(message)}><Icon name="trash" /></button>
                </div>
                <header>
                  <span className="message-author">
                    {message.avatar_url ? <button className="avatar-preview-button" type="button" onClick={() => setImagePreview({ src: imageSrc(message.avatar_url), title: message.author })}><img src={imageSrc(message.avatar_url)} alt="" loading="lazy" /></button> : <i>{message.author.slice(0, 1) || '?'}</i>}
                    <span className="message-name-block">
                      <strong className="identity-name">{message.is_admin ? <span className="admin-crown">♛</span> : null}<span>{message.author}</span></strong>
                      {message.username ? <small className="hover-username">({message.username})</small> : null}
                    </span>
                    <small className="message-index">#{messageIndex}</small>
                  </span>
                </header>
                {editingMessageId === message.id ? (
                  <div className="message-editor">
                    <textarea value={editingMessageText} onChange={(event) => setEditingMessageText(event.target.value)} />
                    <div>
                      <button type="button" title="Сохранить" onClick={() => void editChatMessage(message)}><Icon name="check" /></button>
                      <button type="button" title="Отмена" onClick={() => { setEditingMessageId(''); setEditingMessageText(''); }}><Icon name="x" /></button>
                    </div>
                  </div>
                ) : <MessageContent content={message.content} reasoning={reasoningDisplay} />}
                {canSwipe ? <small className="swipe-counter">Swipe {(message.active_swipe_index ?? 0) + 1}/{swipeCount}</small> : null}
              </article>
              );
            }) : <p className="empty-library">Выбери карточку и чат в меню у поля ввода или во вкладке Карточки.</p>}
            {isGenerating ? (
              <article className="message bot-message thinking-message">
                <header><span className="message-author">{activeCard?.image_url ? <button className="avatar-preview-button" type="button" onClick={() => setImagePreview({ src: imageSrc(activeCard.image_url), title: activeCard.name })}><img src={imageSrc(activeCard.image_url)} alt="" loading="lazy" /></button> : <i>{activeCard?.name.slice(0, 1) || '?'}</i>}<strong>{activeCard?.name || 'Бот'}</strong></span></header>
                <p><span className="thinking-dots"><i /> <i /> <i /></span>{generationStatus || 'Бот думает...'}</p>
              </article>
            ) : null}
          </div>

          <form className="composer" onSubmit={(event) => { event.preventDefault(); void sendChatMessage(); }}>
            <button className="composer-menu-button" type="button" aria-label="Дополнительные действия" onClick={() => setComposerMenuOpen(!composerMenuOpen)}>+</button>
            {composerMenuOpen ? (
              <ComposerActionMenu
                activeChat={activeChat}
                isGenerating={isGenerating}
                openChats={() => { setChatPickerOpen((open) => !open); setComposerMenuOpen(false); }}
                rerollLastBotMessage={rerollLastBotMessage}
              />
            ) : null}
            {chatPickerOpen ? (
              <ChatPicker
                activeChat={activeChat}
                botChats={botChats}
                createBotChat={createBotChat}
                copyChat={copyChat}
                exportChat={exportChat}
                deleteChat={deleteChat}
                renameChat={renameChat}
                chatRenameDrafts={chatRenameDrafts}
                setChatRenameDrafts={setChatRenameDrafts}
                selectChat={selectChat}
                close={() => setChatPickerOpen(false)}
              />
            ) : null}
            {chatInput.trimStart().startsWith('/') ? (
              <div className="slash-command-menu">
                {slashCommands.map((item) => (
                  <button type="button" key={item.command} onClick={() => setChatInput(`${item.command}${item.hint ? ' ' : ''}`)}>
                    <strong>{item.command}</strong>
                    {item.hint ? <code>{item.hint}</code> : null}
                    <small>{item.description}</small>
                  </button>
                ))}
              </div>
            ) : null}
            <textarea value={chatInput} placeholder="Напишите действие или реплику..." onChange={(event) => setChatInput(event.target.value)} />
            <div className="composer-actions">
              <button className="send-button" type="submit" aria-label="Отправить ход" disabled={!activeChat || isGenerating || accessDenied.chats}>
                <span>{isGenerating ? 'Думает...' : 'Отправить'}</span>
                <Icon name="send" />
              </button>
              {isGenerating ? (
                <button className="ghost-button bot-reply-button" type="button" onClick={() => void cancelGeneration()}>Отмена</button>
              ) : (
                <button className="ghost-button bot-reply-button" type="button" disabled={!activeChat || accessDenied.chats} onClick={() => void requestBotReply()}>Ответ бота</button>
              )}
            </div>
          </form>
        </section>

      </section>

      {toasts.length ? (
        <div className="toast-stack" aria-live="polite" aria-atomic="false">
          {toasts.map((toast) => <div className="toast" key={toast.id}>{toast.message}</div>)}
        </div>
      ) : null}

      {imagePreview ? (
        <div className="image-preview-overlay" role="dialog" aria-modal="true" onClick={() => setImagePreview(null)}>
          <button className="image-preview-close" type="button" onClick={() => setImagePreview(null)}>Закрыть</button>
          <img src={imagePreview.src} alt={imagePreview.title} />
          <strong>{imagePreview.title}</strong>
        </div>
      ) : null}

      {menuOpen ? (
        <MenuOverlay
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          visualSettings={visualSettings}
          setVisualSettings={setVisualSettings}
          cards={cards}
          personas={personas}
          selectedPersonaId={selectedPersonaId}
          personaDraft={personaDraft}
          setPersonaDraft={setPersonaDraft}
          cardDraft={cardDraft}
          setCardDraft={setCardDraft}
          setCardAvatar={setCardAvatar}
          activeCard={activeCard}
          activeChat={activeChat}
          setActiveChat={setActiveChat}
          botChats={botChats}
          chatRenameDrafts={chatRenameDrafts}
          setChatRenameDrafts={setChatRenameDrafts}
          generationSettings={generationSettings}
          setGenerationSettings={setGenerationSettings}
          connectionPresets={connectionPresets}
          activeConnectionPresetName={activeConnectionPresetName}
          connectionPresetName={connectionPresetName}
          setConnectionPresetName={setConnectionPresetName}
          presetToDelete={presetToDelete}
          setPresetToDelete={setPresetToDelete}
          models={models}
          connectionMessage={connectionMessage}
          libraryMessage={libraryMessage}
          presetTypes={presetTypes}
          selectedPresetType={selectedPresetType}
          presets={presets}
          selectedPresetName={selectedPresetName}
          presetNameDraft={presetNameDraft}
          presetJsonDraft={presetJsonDraft}
          presetMessage={presetMessage}
          lorebooks={lorebooks}
          selectedLorebookName={selectedLorebookName}
          lorebookNameDraft={lorebookNameDraft}
          lorebookJsonDraft={lorebookJsonDraft}
          lorebookBindings={lorebookBindings}
          lorebookBindingDraft={lorebookBindingDraft}
          lorebookMessage={lorebookMessage}
          activePresets={activePresets}
          accessDenied={accessDenied}
          authUser={authUser}
          authDraft={authDraft}
          setAuthDraft={setAuthDraft}
          authMessage={authMessage}
          securityPermissions={securityPermissions}
          authRequired={authRequired}
          setAuthRequired={setAuthRequired}
          setSecurityPermissions={setSecurityPermissions}
          openImagePreview={(src, title) => setImagePreview({ src: imageSrc(src), title })}
          imageSrc={imageSrc}
          editingPromptId={editingPromptId}
          setEditingPromptId={setEditingPromptId}
          importCard={importCard}
          createCard={createCard}
          updateCard={updateCard}
          deleteCard={deleteCard}
          uploadCardAvatar={uploadCardAvatar}
          selectBotCard={selectBotCard}
          createBotChat={createBotChat}
          selectChat={selectChat}
          copyChat={copyChat}
          exportChat={exportChat}
          deleteChat={deleteChat}
          renameChat={renameChat}
          createPersona={createPersona}
          editPersona={editPersona}
          updatePersona={updatePersona}
          deletePersona={deletePersona}
          selectLocalPersona={selectLocalPersona}
          uploadPersonaAvatar={uploadPersonaAvatar}
          saveGenerationSettings={saveGenerationSettings}
          checkConnection={checkConnection}
          applyConnectionPreset={applyConnectionPreset}
          deleteConnectionPreset={deleteConnectionPreset}
          changePresetType={changePresetType}
          selectPreset={selectPreset}
          setPresetNameDraft={setPresetNameDraft}
          setPresetJsonDraft={setPresetJsonDraft}
          savePreset={savePreset}
          importPreset={importPreset}
          applyPreset={applyPreset}
          exportPreset={exportPreset}
          deletePreset={deletePreset}
          importSillyTavernDefaults={importSillyTavernDefaults}
          openLorebook={openLorebook}
          setLorebookNameDraft={setLorebookNameDraft}
          setLorebookJsonDraft={setLorebookJsonDraft}
          setLorebookBindingDraft={setLorebookBindingDraft}
          saveLorebook={saveLorebook}
          importLorebook={importLorebook}
          exportLorebook={exportLorebook}
          deleteLorebook={deleteLorebook}
          addLorebookBinding={addLorebookBinding}
          removeLorebookBinding={removeLorebookBinding}
          login={() => submitAuth('login')}
          register={() => submitAuth('register')}
          logout={logout}
          claimAdmin={claimAdmin}
          saveSecurityPermissions={saveSecurityPermissions}
          close={() => setMenuOpen(false)}
        />
      ) : null}
    </main>
  );
}

function MenuOverlay({
  activeSection,
  setActiveSection,
  visualSettings,
  setVisualSettings,
  cards,
  personas,
  selectedPersonaId,
  personaDraft,
  setPersonaDraft,
  cardDraft,
  setCardDraft,
  setCardAvatar,
  activeCard,
  activeChat,
  setActiveChat,
  botChats,
  chatRenameDrafts,
  setChatRenameDrafts,
  generationSettings,
  setGenerationSettings,
  connectionPresets,
  activeConnectionPresetName,
  connectionPresetName,
  setConnectionPresetName,
  presetToDelete,
  setPresetToDelete,
  models,
  connectionMessage,
  libraryMessage,
  presetTypes,
  selectedPresetType,
  presets,
  selectedPresetName,
  presetNameDraft,
  presetJsonDraft,
  presetMessage,
  lorebooks,
  selectedLorebookName,
  lorebookNameDraft,
  lorebookJsonDraft,
  lorebookBindings,
  lorebookBindingDraft,
  lorebookMessage,
  activePresets,
  accessDenied,
  authUser,
  authDraft,
  setAuthDraft,
  authMessage,
  securityPermissions,
  authRequired,
  setAuthRequired,
  setSecurityPermissions,
  openImagePreview,
  imageSrc,
  editingPromptId,
  setEditingPromptId,
  importCard,
  createCard,
  updateCard,
  deleteCard,
  uploadCardAvatar,
  selectBotCard,
  createBotChat,
  selectChat,
  copyChat,
  exportChat,
  deleteChat,
  renameChat,
  createPersona,
  editPersona,
  updatePersona,
  deletePersona,
  selectLocalPersona,
  uploadPersonaAvatar,
  saveGenerationSettings,
  checkConnection,
  applyConnectionPreset,
  deleteConnectionPreset,
  changePresetType,
  selectPreset,
  setPresetNameDraft,
  setPresetJsonDraft,
  savePreset,
  importPreset,
  applyPreset,
  exportPreset,
  deletePreset,
  importSillyTavernDefaults,
  openLorebook,
  setLorebookNameDraft,
  setLorebookJsonDraft,
  setLorebookBindingDraft,
  saveLorebook,
  importLorebook,
  exportLorebook,
  deleteLorebook,
  addLorebookBinding,
  removeLorebookBinding,
  login,
  register,
  logout,
  claimAdmin,
  saveSecurityPermissions,
  close,
}: {
  activeSection: MenuSection;
  setActiveSection: (section: MenuSection) => void;
  visualSettings: VisualSettings;
  setVisualSettings: (settings: VisualSettings) => void;
  cards: CharacterCard[];
  personas: Persona[];
  selectedPersonaId: string;
  personaDraft: { name: string; description: string };
  setPersonaDraft: (draft: { name: string; description: string }) => void;
  cardDraft: CardDraft;
  setCardDraft: (draft: CardDraft) => void;
  setCardAvatar: (avatar: File | null) => void;
  activeCard: CharacterCard | null;
  activeChat: BotChat | null;
  setActiveChat: (chat: BotChat) => void;
  botChats: BotChatSummary[];
  chatRenameDrafts: Record<string, string>;
  setChatRenameDrafts: (drafts: Record<string, string>) => void;
  generationSettings: GenerationSettings;
  setGenerationSettings: (settings: GenerationSettings) => void;
  connectionPresets: ConnectionPreset[];
  activeConnectionPresetName: string;
  connectionPresetName: string;
  setConnectionPresetName: (name: string) => void;
  presetToDelete: string;
  setPresetToDelete: (name: string) => void;
  models: string[];
  connectionMessage: string;
  libraryMessage: string;
  presetTypes: PresetTypeInfo[];
  selectedPresetType: string;
  presets: PresetSummary[];
  selectedPresetName: string;
  presetNameDraft: string;
  presetJsonDraft: string;
  presetMessage: string;
  lorebooks: LorebookSummary[];
  selectedLorebookName: string;
  lorebookNameDraft: string;
  lorebookJsonDraft: string;
  lorebookBindings: LorebookBinding[];
  lorebookBindingDraft: LorebookBinding;
  lorebookMessage: string;
  activePresets: Record<string, string>;
  accessDenied: AccessDeniedState;
  authUser: AuthUser | null;
  authDraft: { username: string; password: string; adminCode: string };
  setAuthDraft: (draft: { username: string; password: string; adminCode: string }) => void;
  authMessage: string;
  securityPermissions: SecurityPermissions;
  authRequired: boolean;
  setAuthRequired: (required: boolean) => void;
  setSecurityPermissions: (permissions: SecurityPermissions) => void;
  openImagePreview: (src: string, title: string) => void;
  imageSrc: (src: string) => string;
  editingPromptId: string;
  setEditingPromptId: (id: string) => void;
  importCard: (file: File | null) => Promise<void>;
  createCard: () => Promise<void>;
  updateCard: (cardId: string, draft: CardDraft) => Promise<void>;
  deleteCard: (card: CharacterCard) => Promise<void>;
  uploadCardAvatar: (card: CharacterCard, file: File | null) => Promise<void>;
  selectBotCard: (card: CharacterCard) => Promise<void>;
  createBotChat: () => Promise<void>;
  selectChat: (chatId: string) => Promise<void>;
  copyChat: (chatId: string) => Promise<void>;
  exportChat: (chatId: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  renameChat: (chat: BotChatSummary) => Promise<void>;
  createPersona: () => Promise<void>;
  editPersona: (personaId: string, patch: Partial<Pick<Persona, 'name' | 'description'>>) => void;
  updatePersona: (persona: Persona) => Promise<void>;
  deletePersona: (persona: Persona) => Promise<void>;
  selectLocalPersona: (personaId: string) => void;
  uploadPersonaAvatar: (personaId: string, file: File | null) => Promise<void>;
  saveGenerationSettings: () => Promise<void>;
  checkConnection: () => Promise<void>;
  applyConnectionPreset: (presetName: string) => Promise<void>;
  deleteConnectionPreset: (presetName: string) => Promise<void>;
  changePresetType: (presetType: string) => Promise<void>;
  selectPreset: (name: string) => Promise<void>;
  setPresetNameDraft: (name: string) => void;
  setPresetJsonDraft: (json: string) => void;
  savePreset: () => Promise<void>;
  importPreset: (file: File | null) => Promise<void>;
  applyPreset: () => Promise<void>;
  exportPreset: () => Promise<void>;
  deletePreset: () => Promise<void>;
  importSillyTavernDefaults: () => Promise<void>;
  openLorebook: (name: string) => Promise<void>;
  setLorebookNameDraft: (name: string) => void;
  setLorebookJsonDraft: (json: string) => void;
  setLorebookBindingDraft: (binding: LorebookBinding) => void;
  saveLorebook: () => Promise<void>;
  importLorebook: (file: File | null) => Promise<void>;
  exportLorebook: () => Promise<void>;
  deleteLorebook: () => Promise<void>;
  addLorebookBinding: () => Promise<void>;
  removeLorebookBinding: (index: number) => Promise<void>;
  login: () => Promise<void>;
  register: () => Promise<void>;
  logout: () => Promise<void>;
  claimAdmin: () => Promise<void>;
  saveSecurityPermissions: () => Promise<void>;
  close: () => void;
}) {
  const activeItem = menuItems.find((item) => item.id === activeSection) ?? menuItems[0];

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <button className="overlay-scrim" type="button" aria-label="Закрыть меню" onClick={close} />
      <section className="settings-drawer">
        <header className="drawer-header">
          <div>
            <span className="eyebrow">Меню</span>
            <h2>{activeItem.label}</h2>
          </div>
          <button className="close-button" type="button" onClick={close}>Закрыть</button>
        </header>

        <div className="drawer-body">
          <nav className="menu-list" aria-label="Settings sections">
            {menuItems.map((item) => (
              <button
                className={activeSection === item.id ? 'menu-card active' : 'menu-card'}
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
              >
                <Icon name={item.icon} />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            ))}
          </nav>

          <section className="section-preview">
            <SettingsSection
              section={activeSection}
              visualSettings={visualSettings}
              setVisualSettings={setVisualSettings}
              cards={cards}
              personas={personas}
              selectedPersonaId={selectedPersonaId}
              personaDraft={personaDraft}
              setPersonaDraft={setPersonaDraft}
              cardDraft={cardDraft}
              setCardDraft={setCardDraft}
              setCardAvatar={setCardAvatar}
              activeCard={activeCard}
              activeChat={activeChat}
              setActiveChat={setActiveChat}
              botChats={botChats}
              chatRenameDrafts={chatRenameDrafts}
              setChatRenameDrafts={setChatRenameDrafts}
              generationSettings={generationSettings}
              setGenerationSettings={setGenerationSettings}
              connectionPresets={connectionPresets}
              activeConnectionPresetName={activeConnectionPresetName}
              connectionPresetName={connectionPresetName}
              setConnectionPresetName={setConnectionPresetName}
              presetToDelete={presetToDelete}
              setPresetToDelete={setPresetToDelete}
              models={models}
              connectionMessage={connectionMessage}
              libraryMessage={libraryMessage}
              presetTypes={presetTypes}
              selectedPresetType={selectedPresetType}
              presets={presets}
              selectedPresetName={selectedPresetName}
              presetNameDraft={presetNameDraft}
              presetJsonDraft={presetJsonDraft}
              presetMessage={presetMessage}
              lorebooks={lorebooks}
              selectedLorebookName={selectedLorebookName}
              lorebookNameDraft={lorebookNameDraft}
              lorebookJsonDraft={lorebookJsonDraft}
              lorebookBindings={lorebookBindings}
              lorebookBindingDraft={lorebookBindingDraft}
              lorebookMessage={lorebookMessage}
              activePresets={activePresets}
              accessDenied={accessDenied}
              authUser={authUser}
              authDraft={authDraft}
              setAuthDraft={setAuthDraft}
              authMessage={authMessage}
              securityPermissions={securityPermissions}
              authRequired={authRequired}
              setAuthRequired={setAuthRequired}
              setSecurityPermissions={setSecurityPermissions}
              openImagePreview={openImagePreview}
              imageSrc={imageSrc}
              editingPromptId={editingPromptId}
              setEditingPromptId={setEditingPromptId}
              importCard={importCard}
              createCard={createCard}
              updateCard={updateCard}
              deleteCard={deleteCard}
              uploadCardAvatar={uploadCardAvatar}
              selectBotCard={selectBotCard}
              createBotChat={createBotChat}
              selectChat={selectChat}
              copyChat={copyChat}
              exportChat={exportChat}
              deleteChat={deleteChat}
              renameChat={renameChat}
              createPersona={createPersona}
              editPersona={editPersona}
              updatePersona={updatePersona}
              deletePersona={deletePersona}
              selectLocalPersona={selectLocalPersona}
              uploadPersonaAvatar={uploadPersonaAvatar}
              saveGenerationSettings={saveGenerationSettings}
              checkConnection={checkConnection}
              applyConnectionPreset={applyConnectionPreset}
              deleteConnectionPreset={deleteConnectionPreset}
              changePresetType={changePresetType}
              selectPreset={selectPreset}
              setPresetNameDraft={setPresetNameDraft}
              setPresetJsonDraft={setPresetJsonDraft}
              savePreset={savePreset}
              importPreset={importPreset}
              applyPreset={applyPreset}
              exportPreset={exportPreset}
              deletePreset={deletePreset}
              importSillyTavernDefaults={importSillyTavernDefaults}
              openLorebook={openLorebook}
              setLorebookNameDraft={setLorebookNameDraft}
              setLorebookJsonDraft={setLorebookJsonDraft}
              setLorebookBindingDraft={setLorebookBindingDraft}
              saveLorebook={saveLorebook}
              importLorebook={importLorebook}
              exportLorebook={exportLorebook}
              deleteLorebook={deleteLorebook}
              addLorebookBinding={addLorebookBinding}
              removeLorebookBinding={removeLorebookBinding}
              login={login}
              register={register}
              logout={logout}
              claimAdmin={claimAdmin}
              saveSecurityPermissions={saveSecurityPermissions}
            />
          </section>
        </div>
      </section>
    </div>
  );
}

function AuthGate({ authDraft, setAuthDraft, authMessage, login, register }: { authDraft: { username: string; password: string; adminCode: string }; setAuthDraft: (draft: { username: string; password: string; adminCode: string }) => void; authMessage: string; login: () => Promise<void>; register: () => Promise<void> }) {
  return (
    <main className="auth-gate-shell">
      <section className="auth-gate-card">
        <div>
          <span className="eyebrow">DoubleTrouble</span>
          <h1>Вход закрыт</h1>
          <p>Этот сервер требует аккаунт для просмотра карточек, персон, чатов и аватарок.</p>
        </div>
        <div className="form-stack">
          <EditableField label="Ник" value={authDraft.username} onChange={(username) => setAuthDraft({ ...authDraft, username })} />
          <EditableField label="Пароль" type="password" value={authDraft.password} onChange={(password) => setAuthDraft({ ...authDraft, password })} />
          <div className="preset-actions">
            <button type="button" onClick={() => void login()}>Войти</button>
            <button className="ghost-button" type="button" onClick={() => void register()}>Регистрация</button>
          </div>
          {authMessage ? <p className="library-message">{authMessage}</p> : null}
        </div>
      </section>
    </main>
  );
}

function SettingsSection({
  section,
  visualSettings,
  setVisualSettings,
  cards,
  personas,
  selectedPersonaId,
  personaDraft,
  setPersonaDraft,
  cardDraft,
  setCardDraft,
  setCardAvatar,
  activeCard,
  activeChat,
  setActiveChat,
  botChats,
  chatRenameDrafts,
  setChatRenameDrafts,
  generationSettings,
  setGenerationSettings,
  connectionPresets,
  activeConnectionPresetName,
  connectionPresetName,
  setConnectionPresetName,
  presetToDelete,
  setPresetToDelete,
  models,
  connectionMessage,
  libraryMessage,
  presetTypes,
  selectedPresetType,
  presets,
  selectedPresetName,
  presetNameDraft,
  presetJsonDraft,
  presetMessage,
  lorebooks,
  selectedLorebookName,
  lorebookNameDraft,
  lorebookJsonDraft,
  lorebookBindings,
  lorebookBindingDraft,
  lorebookMessage,
  activePresets,
  accessDenied,
  authUser,
  authDraft,
  setAuthDraft,
  authMessage,
  securityPermissions,
  authRequired,
  setAuthRequired,
  setSecurityPermissions,
  openImagePreview,
  imageSrc,
  editingPromptId,
  setEditingPromptId,
  importCard,
  createCard,
  updateCard,
  deleteCard,
  uploadCardAvatar,
  selectBotCard,
  createBotChat,
  selectChat,
  copyChat,
  exportChat,
  deleteChat,
  renameChat,
  createPersona,
  editPersona,
  updatePersona,
  deletePersona,
  selectLocalPersona,
  uploadPersonaAvatar,
  saveGenerationSettings,
  checkConnection,
  applyConnectionPreset,
  deleteConnectionPreset,
  changePresetType,
  selectPreset,
  setPresetNameDraft,
  setPresetJsonDraft,
  savePreset,
  importPreset,
  applyPreset,
  exportPreset,
  deletePreset,
  importSillyTavernDefaults,
  openLorebook,
  setLorebookNameDraft,
  setLorebookJsonDraft,
  setLorebookBindingDraft,
  saveLorebook,
  importLorebook,
  exportLorebook,
  deleteLorebook,
  addLorebookBinding,
  removeLorebookBinding,
  login,
  register,
  logout,
  claimAdmin,
  saveSecurityPermissions,
}: {
  section: MenuSection;
  visualSettings: VisualSettings;
  setVisualSettings: (settings: VisualSettings) => void;
  cards: CharacterCard[];
  personas: Persona[];
  selectedPersonaId: string;
  personaDraft: { name: string; description: string };
  setPersonaDraft: (draft: { name: string; description: string }) => void;
  cardDraft: CardDraft;
  setCardDraft: (draft: CardDraft) => void;
  setCardAvatar: (avatar: File | null) => void;
  activeCard: CharacterCard | null;
  activeChat: BotChat | null;
  setActiveChat: (chat: BotChat) => void;
  botChats: BotChatSummary[];
  chatRenameDrafts: Record<string, string>;
  setChatRenameDrafts: (drafts: Record<string, string>) => void;
  generationSettings: GenerationSettings;
  setGenerationSettings: (settings: GenerationSettings) => void;
  connectionPresets: ConnectionPreset[];
  activeConnectionPresetName: string;
  connectionPresetName: string;
  setConnectionPresetName: (name: string) => void;
  presetToDelete: string;
  setPresetToDelete: (name: string) => void;
  models: string[];
  connectionMessage: string;
  libraryMessage: string;
  presetTypes: PresetTypeInfo[];
  selectedPresetType: string;
  presets: PresetSummary[];
  selectedPresetName: string;
  presetNameDraft: string;
  presetJsonDraft: string;
  presetMessage: string;
  lorebooks: LorebookSummary[];
  selectedLorebookName: string;
  lorebookNameDraft: string;
  lorebookJsonDraft: string;
  lorebookBindings: LorebookBinding[];
  lorebookBindingDraft: LorebookBinding;
  lorebookMessage: string;
  activePresets: Record<string, string>;
  accessDenied: AccessDeniedState;
  authUser: AuthUser | null;
  authDraft: { username: string; password: string; adminCode: string };
  setAuthDraft: (draft: { username: string; password: string; adminCode: string }) => void;
  authMessage: string;
  securityPermissions: SecurityPermissions;
  authRequired: boolean;
  setAuthRequired: (required: boolean) => void;
  setSecurityPermissions: (permissions: SecurityPermissions) => void;
  openImagePreview: (src: string, title: string) => void;
  imageSrc: (src: string) => string;
  editingPromptId: string;
  setEditingPromptId: (id: string) => void;
  importCard: (file: File | null) => Promise<void>;
  createCard: () => Promise<void>;
  updateCard: (cardId: string, draft: CardDraft) => Promise<void>;
  deleteCard: (card: CharacterCard) => Promise<void>;
  uploadCardAvatar: (card: CharacterCard, file: File | null) => Promise<void>;
  selectBotCard: (card: CharacterCard) => Promise<void>;
  createBotChat: () => Promise<void>;
  selectChat: (chatId: string) => Promise<void>;
  copyChat: (chatId: string) => Promise<void>;
  exportChat: (chatId: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  renameChat: (chat: BotChatSummary) => Promise<void>;
  createPersona: () => Promise<void>;
  editPersona: (personaId: string, patch: Partial<Pick<Persona, 'name' | 'description'>>) => void;
  updatePersona: (persona: Persona) => Promise<void>;
  deletePersona: (persona: Persona) => Promise<void>;
  selectLocalPersona: (personaId: string) => void;
  uploadPersonaAvatar: (personaId: string, file: File | null) => Promise<void>;
  saveGenerationSettings: () => Promise<void>;
  checkConnection: () => Promise<void>;
  applyConnectionPreset: (presetName: string) => Promise<void>;
  deleteConnectionPreset: (presetName: string) => Promise<void>;
  changePresetType: (presetType: string) => Promise<void>;
  selectPreset: (name: string) => Promise<void>;
  setPresetNameDraft: (name: string) => void;
  setPresetJsonDraft: (json: string) => void;
  savePreset: () => Promise<void>;
  importPreset: (file: File | null) => Promise<void>;
  applyPreset: () => Promise<void>;
  exportPreset: () => Promise<void>;
  deletePreset: () => Promise<void>;
  importSillyTavernDefaults: () => Promise<void>;
  openLorebook: (name: string) => Promise<void>;
  setLorebookNameDraft: (name: string) => void;
  setLorebookJsonDraft: (json: string) => void;
  setLorebookBindingDraft: (binding: LorebookBinding) => void;
  saveLorebook: () => Promise<void>;
  importLorebook: (file: File | null) => Promise<void>;
  exportLorebook: () => Promise<void>;
  deleteLorebook: () => Promise<void>;
  addLorebookBinding: () => Promise<void>;
  removeLorebookBinding: (index: number) => Promise<void>;
  login: () => Promise<void>;
  register: () => Promise<void>;
  logout: () => Promise<void>;
  claimAdmin: () => Promise<void>;
  saveSecurityPermissions: () => Promise<void>;
}) {
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [loreEntriesOpen, setLoreEntriesOpen] = useState(true);
  const [editingCardId, setEditingCardId] = useState('');
  const [cardEditDraft, setCardEditDraft] = useState<CardDraft>(emptyCardDraft);
  const [editingPersonaId, setEditingPersonaId] = useState('');
  const [editingLoreEntryUid, setEditingLoreEntryUid] = useState('');
  const presetObject = parsePresetDraft(presetJsonDraft);
  const openAiPrompts = presetObject && selectedPresetType === 'openai' ? orderedOpenAiPrompts(presetObject) : [];
  const lorebookObject = parsePresetDraft(lorebookJsonDraft) || { entries: {} };
  const lorebookEntries = lorebookEntriesFromBook(lorebookObject);
  const editingCard = cards.find((card) => card.id === editingCardId) ?? null;
  const editingPersona = personas.find((persona) => persona.id === editingPersonaId) ?? personas.find((persona) => persona.id === selectedPersonaId) ?? personas[0] ?? null;
  const startEditCard = (card: CharacterCard) => {
    setEditingCardId(card.id);
    setCardEditDraft(draftFromCard(card));
  };
  const saveEditingCard = async () => {
    if (!editingCard) {
      return;
    }
    await updateCard(editingCard.id, cardEditDraft);
    setEditingCardId('');
  };
  const updatePresetField = (key: string, value: unknown) => {
    const current = parsePresetDraft(presetJsonDraft) || {};
    setPresetJsonDraft(JSON.stringify({ ...current, [key]: value }, null, 2));
  };
  const updateReasoningPreset = (patch: Partial<ReasoningDisplaySettings>) => {
    const current = parsePresetDraft(presetJsonDraft) || {};
    const currentReasoning = reasoningSettingsFromPreset(current);
    const nextReasoning = { ...currentReasoning, ...patch };
    setPresetJsonDraft(JSON.stringify({
      ...current,
      reasoning_auto_parse: nextReasoning.autoParse,
      reasoning_auto_expand: nextReasoning.autoExpand,
      reasoning_show_hidden: nextReasoning.showHidden,
      reasoning_add_to_prompts: nextReasoning.addToPrompts,
      reasoning_max_additions: nextReasoning.maxAdditions,
      reasoning_prefix: nextReasoning.prefix,
      reasoning_suffix: nextReasoning.suffix,
      reasoning_separator: nextReasoning.separator,
    }, null, 2));
  };
  const updateAssistantPrefill = (value: string) => {
    updatePresetField('assistant_prefill', value);
  };
  const updateOpenAiPrompt = (identifier: string, patch: Record<string, unknown>) => {
    const current = parsePresetDraft(presetJsonDraft) || {};
    const prompts = Array.isArray(current.prompts) ? current.prompts : [];
    const nextPrompts = prompts.map((prompt) => {
      if (!isObjectRecord(prompt) || prompt.identifier !== identifier) {
        return prompt;
      }
      return { ...prompt, ...patch };
    });
    setPresetJsonDraft(JSON.stringify({ ...current, prompts: nextPrompts }, null, 2));
  };
  const toggleOpenAiPrompt = (identifier: string) => {
    const current = parsePresetDraft(presetJsonDraft) || {};
    const order = normalizePromptOrder(current.prompt_order);
    const target = order.find((item) => item.identifier === identifier);
    const nextOrder = target
      ? order.map((item) => item.identifier === identifier ? { ...item, enabled: !item.enabled } : item)
      : [...order, { identifier, enabled: true }];
    setPresetJsonDraft(JSON.stringify({ ...current, prompt_order: updateOpenAiPromptOrder(current.prompt_order, nextOrder) }, null, 2));
  };
  const moveOpenAiPrompt = (identifier: string, direction: -1 | 1) => {
    const current = parsePresetDraft(presetJsonDraft) || {};
    const order = buildFullPromptOrder(current);
    const index = order.findIndex((item) => item.identifier === identifier);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= order.length) {
      return;
    }
    const nextOrder = [...order];
    [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
    setPresetJsonDraft(JSON.stringify({ ...current, prompt_order: updateOpenAiPromptOrder(current.prompt_order, nextOrder) }, null, 2));
  };
  const setOpenAiPromptPosition = (identifier: string, value: number | string) => {
    if (typeof value !== 'number') {
      return;
    }
    const current = parsePresetDraft(presetJsonDraft) || {};
    const order = buildFullPromptOrder(current);
    const index = order.findIndex((item) => item.identifier === identifier);
    if (index < 0) {
      return;
    }
    const nextIndex = clampNumber(Math.round(value) - 1, 0, order.length - 1);
    const nextOrder = [...order];
    const [item] = nextOrder.splice(index, 1);
    nextOrder.splice(nextIndex, 0, item);
    setPresetJsonDraft(JSON.stringify({ ...current, prompt_order: updateOpenAiPromptOrder(current.prompt_order, nextOrder) }, null, 2));
  };
  const deleteOpenAiPrompt = (identifier: string) => {
    const current = parsePresetDraft(presetJsonDraft) || {};
    const prompts = Array.isArray(current.prompts) ? current.prompts : [];
    const nextPrompts = prompts.filter((prompt) => !isObjectRecord(prompt) || String(prompt.identifier || '') !== identifier);
    setPresetJsonDraft(JSON.stringify({ ...current, prompts: nextPrompts, prompt_order: removePromptFromAllOrders(current.prompt_order, identifier) }, null, 2));
    if (editingPromptId === identifier) {
      setEditingPromptId('');
    }
  };
  const addOpenAiPrompt = () => {
    const current = parsePresetDraft(presetJsonDraft) || {};
    const identifier = `custom_${Date.now()}`;
    const prompts = Array.isArray(current.prompts) ? current.prompts : [];
    const order = normalizePromptOrder(current.prompt_order);
    const next = {
      ...current,
      prompts: [...prompts, { identifier, name: 'New Prompt', role: 'system', content: '', system_prompt: false, marker: false, injection_position: 0, injection_depth: 4, injection_order: 100, injection_trigger: [] }],
      prompt_order: updateOpenAiPromptOrder(current.prompt_order, [...order, { identifier, enabled: true }]),
    };
    setPresetJsonDraft(JSON.stringify(next, null, 2));
    setEditingPromptId(identifier);
    setPromptsOpen(true);
  };

  const setLorebookDraft = (book: RawPreset) => {
    setLorebookJsonDraft(JSON.stringify({ ...book, entries: isObjectRecord(book.entries) ? book.entries : {} }, null, 2));
  };
  const updateLorebookEntry = (uid: string, patch: RawPreset) => {
    const current = parsePresetDraft(lorebookJsonDraft) || { entries: {} };
    const entries = isObjectRecord(current.entries) ? { ...current.entries } : {};
    const existing = isObjectRecord(entries[uid]) ? entries[uid] : {};
    entries[uid] = { ...existing, ...patch };
    setLorebookDraft({ ...current, entries });
  };
  const addLorebookEntry = () => {
    const current = parsePresetDraft(lorebookJsonDraft) || { entries: {} };
    const entries = isObjectRecord(current.entries) ? { ...current.entries } : {};
    const nextUid = nextLorebookUid(entries);
    entries[String(nextUid)] = {
      uid: nextUid,
      key: [],
      keysecondary: [],
      comment: 'New entry',
      content: '',
      constant: false,
      selective: false,
      order: 100,
      position: 0,
      disable: false,
      displayIndex: nextUid,
      addMemo: true,
      group: '',
      groupOverride: false,
      groupWeight: 100,
      sticky: 0,
      cooldown: 0,
      delay: 0,
      probability: 100,
      depth: 4,
      useProbability: false,
      role: null,
      vectorized: false,
      excludeRecursion: false,
      preventRecursion: false,
      delayUntilRecursion: false,
      scanDepth: null,
      caseSensitive: null,
      matchWholeWords: null,
      useGroupScoring: null,
      automationId: '',
    };
    setLorebookDraft({ ...current, entries });
    setEditingLoreEntryUid(String(nextUid));
  };
  const duplicateLorebookEntry = (uid: string) => {
    const current = parsePresetDraft(lorebookJsonDraft) || { entries: {} };
    const entries = isObjectRecord(current.entries) ? { ...current.entries } : {};
    const source = isObjectRecord(entries[uid]) ? entries[uid] : null;
    if (!source) {
      return;
    }
    const nextUid = nextLorebookUid(entries);
    entries[String(nextUid)] = { ...source, uid: nextUid, comment: `${String(source.comment || 'Entry')} copy`, displayIndex: nextUid };
    setLorebookDraft({ ...current, entries });
    setEditingLoreEntryUid(String(nextUid));
  };
  const deleteLorebookEntry = (uid: string) => {
    const current = parsePresetDraft(lorebookJsonDraft) || { entries: {} };
    const entries = isObjectRecord(current.entries) ? { ...current.entries } : {};
    delete entries[uid];
    setLorebookDraft({ ...current, entries });
    if (editingLoreEntryUid === uid) {
      setEditingLoreEntryUid('');
    }
  };

  if (section === 'presets') {
    if (accessDenied.presets) {
      return (
        <div className="form-stack preset-editor">
          <div className="preset-title-row">
            <div>
              <span className="eyebrow">SillyTavern compatible</span>
              <h3>Пресеты</h3>
            </div>
          </div>
          <AccessDeniedNotice />
        </div>
      );
    }
    return (
      <div className="form-stack preset-editor">
        <div className="preset-title-row">
          <div>
            <span className="eyebrow">SillyTavern compatible</span>
            <h3>{selectedPresetType === 'openai' ? 'Пресеты для OpenAI' : 'Пресеты SillyTavern'}</h3>
          </div>
          <button className="ghost-button" type="button" onClick={() => void importSillyTavernDefaults()}>Импорт дефолтов ST</button>
        </div>
        <TwoColumns
          left={(
            <label className="field-preview">
              <span>Пресет</span>
              <select value={selectedPresetName} onChange={(event) => void selectPreset(event.target.value)}>
                <option value="">Выбрать пресет</option>
                {presets.map((preset) => <option value={preset.name} key={preset.filename}>{preset.name}{activePresets[preset.type] === preset.name ? ' · active' : ''}</option>)}
              </select>
            </label>
          )}
          right={<EditableField label="Имя для сохранения" value={presetNameDraft} onChange={setPresetNameDraft} />}
        />
        <label className="upload-card compact-upload">
          <span>Импорт JSON пресета</span>
          <input type="file" accept="application/json,.json" onChange={(event) => { void importPreset(event.target.files?.[0] ?? null); event.target.value = ''; }} />
        </label>
        {selectedPresetType === 'openai' && presetObject ? (
          <div className="tavern-preset-panel">
            <section className="preset-card-section">
              <h3>Генерация</h3>
              <ToggleRow label="Неограниченный размер контекста" checked={Boolean(presetObject.max_context_unlocked)} onChange={(checked) => updatePresetField('max_context_unlocked', checked)} />
              <SliderField label="Размер контекста (в токенах)" value={presetObject.openai_max_context} fallback={4095} min={0} max={1000000} step={512} onChange={(value) => updatePresetField('openai_max_context', value)} />
              <NumberInputField label="Макс. длина ответа (в токенах)" value={presetObject.openai_max_tokens} fallback={300} min={0} step={1} onChange={(value) => updatePresetField('openai_max_tokens', value)} />
              <NumberInputField label="Несколько свайпов на генерацию" value={presetObject.n} fallback={1} min={0} step={1} onChange={(value) => updatePresetField('n', value)} />
              <ToggleRow label="Стриминг текста" checked={Boolean(presetObject.stream_openai)} onChange={(checked) => updatePresetField('stream_openai', checked)} />
              <SliderField label="Температура" value={presetObject.temperature} fallback={1} min={0} max={2} step={0.01} onChange={(value) => updatePresetField('temperature', value)} />
              <SliderField label="Штраф за частоту" value={presetObject.frequency_penalty} fallback={0} min={-2} max={2} step={0.01} onChange={(value) => updatePresetField('frequency_penalty', value)} />
              <SliderField label="Штраф за присутствие" value={presetObject.presence_penalty} fallback={0} min={-2} max={2} step={0.01} onChange={(value) => updatePresetField('presence_penalty', value)} />
              <SliderField label="Top P" value={presetObject.top_p} fallback={1} min={0} max={1} step={0.01} onChange={(value) => updatePresetField('top_p', value)} />
            </section>

            <section className="preset-card-section">
              <h3>Служебные промпты</h3>
              <NumberInputField label="Зерно" value={presetObject.seed} fallback={-1} step={1} onChange={(value) => updatePresetField('seed', value)} />
              <NumberInputField label="Вставка имени персонажа" value={presetObject.names_behavior} fallback={0} min={0} step={1} onChange={(value) => updatePresetField('names_behavior', value)} />
              <EditableField label="Постфикс для продолжения" value={String(presetObject.continue_nudge_prompt ?? '')} onChange={(value) => updatePresetField('continue_nudge_prompt', value)} />
              <ToggleRow label="Префилл для продолжения" checked={Boolean(presetObject.continue_prefill)} onChange={(checked) => updatePresetField('continue_prefill', checked)} />
              <ToggleRow label="Склеивать сообщения системы" checked={Boolean(presetObject.squash_system_messages)} onChange={(checked) => updatePresetField('squash_system_messages', checked)} />
              <ToggleRow label="Включить функции" checked={Boolean(presetObject.function_calling)} onChange={(checked) => updatePresetField('function_calling', checked)} />
              <ToggleRow label="Send inline media" checked={Boolean(presetObject.send_inline_images)} onChange={(checked) => updatePresetField('send_inline_images', checked)} />
              <SelectField label="Рассуждения" value={String(presetObject.reasoning_effort ?? 'auto')} options={['auto', 'minimal', 'low', 'medium', 'high']} onChange={(value) => updatePresetField('reasoning_effort', value)} />
              <SelectField label="Verbosity" value={String(presetObject.verbosity ?? 'auto')} options={['auto', 'low', 'medium', 'high']} onChange={(value) => updatePresetField('verbosity', value)} />
            </section>

            <section className="preset-card-section">
              <div className="preset-title-row">
                <div>
                  <h3>Просмотр / Редактирование пресета промптов</h3>
                  <small>Порядок, тоглы и содержимое сохраняются в SillyTavern `prompts` и `prompt_order`.</small>
                </div>
                <div className="prompt-header-actions">
                  <button className="ghost-button" type="button" onClick={() => setPromptsOpen((open) => !open)}>{promptsOpen ? 'Свернуть' : `Показать (${openAiPrompts.length})`}</button>
                  <button type="button" onClick={addOpenAiPrompt}>Добавить</button>
                </div>
              </div>
              {promptsOpen ? <div className="prompt-list">
                {openAiPrompts.map(({ prompt, enabled }) => {
                  const identifier = String(prompt.identifier || prompt.name || 'prompt');
                  const isEditing = editingPromptId === identifier;
                  const isInChatPrompt = String(prompt.injection_position ?? 0) === '1';
                  const promptKind = isInChatPrompt ? 'In-chat' : prompt.marker ? 'Marker' : prompt.system_prompt ? 'System' : 'Preset';
                  const promptPosition = Math.max(1, buildFullPromptOrder(presetObject).findIndex((item) => item.identifier === identifier) + 1);
                  return (
                    <article className={enabled ? 'prompt-row enabled' : 'prompt-row'} key={identifier}>
                      <button className="drag-handle" type="button" aria-label="Переместить выше" onClick={() => moveOpenAiPrompt(identifier, -1)}>↑</button>
                      <span className="prompt-kind">{isInChatPrompt ? '@' : prompt.marker ? '◆' : prompt.system_prompt ? '★' : '*'}</span>
                      <div className="prompt-main">
                        <strong>{String(prompt.name || identifier)}</strong>
                        <small>#{promptPosition} · {promptKind} · {String(prompt.role || 'system')} · {approxTokens(String(prompt.content || ''))} ток.</small>
                      </div>
                      <button className="prompt-icon" type="button" title="Переместить ниже" onClick={() => moveOpenAiPrompt(identifier, 1)}>↓</button>
                      <button className="prompt-icon" type="button" title="Редактировать" onClick={() => setEditingPromptId(isEditing ? '' : identifier)}><Icon name="edit" /></button>
                      <button className="prompt-icon danger" type="button" title={prompt.system_prompt ? 'Системные prompt ST не удаляются' : 'Удалить prompt'} disabled={Boolean(prompt.system_prompt)} onClick={() => deleteOpenAiPrompt(identifier)}><Icon name="trash" /></button>
                      <button className={enabled ? 'prompt-toggle active' : 'prompt-toggle'} type="button" onClick={() => toggleOpenAiPrompt(identifier)} aria-label="Toggle prompt"><i /></button>
                      {isEditing ? (
                        <div className="prompt-edit-panel">
                          <div className="prompt-edit-header">
                            <div>
                              <h4>Edit</h4>
                              <small>{String(prompt.name || 'Prompt settings')}</small>
                            </div>
                            <button className="ghost-button" type="button" onClick={() => setEditingPromptId('')}>Закрыть</button>
                          </div>
                          <div className="prompt-edit-grid">
                            <EditableField label="Name" value={String(prompt.name || '')} onChange={(value) => updateOpenAiPrompt(identifier, { name: value })} />
                            <SelectField label="Role" value={String(prompt.role || 'system')} options={['system', 'user', 'assistant']} onChange={(value) => updateOpenAiPrompt(identifier, { role: value })} />
                            <SelectChoicesField label="Position" value={String(prompt.injection_position ?? 0)} options={[["0", "Relative"], ["1", "In-chat @ Depth"]]} onChange={(value) => updateOpenAiPrompt(identifier, { injection_position: Number(value) })} />
                            {isInChatPrompt ? <NumberInputField label="Depth" value={prompt.injection_depth} fallback={4} min={0} max={9999} step={1} onChange={(value) => updateOpenAiPrompt(identifier, { injection_depth: value })} /> : <NumberInputField label="Позиция в списке" value={promptPosition} fallback={promptPosition} min={1} max={openAiPrompts.length} step={1} onChange={(value) => setOpenAiPromptPosition(identifier, value)} />}
                            {isInChatPrompt ? <NumberInputField label="Order" value={prompt.injection_order} fallback={100} min={0} max={9999} step={1} onChange={(value) => updateOpenAiPrompt(identifier, { injection_order: value })} /> : <div className="relative-position-help"><span>Relative</span><small>Как в Tavern: место задается порядком строк в списке, не in-chat depth/order.</small></div>}
                          </div>
                          <CheckboxGroupField label="Triggers" values={promptTriggerValues(prompt.injection_trigger)} options={['normal', 'continue', 'impersonate', 'swipe', 'regenerate', 'quiet']} onChange={(values) => updateOpenAiPrompt(identifier, { injection_trigger: values })} />
                          <div className="prompt-option-list">
                            <PromptOptionRow title="Forbid Overrides" text="Запретить замену этого prompt override-ами из character card." checked={Boolean(prompt.forbid_overrides)} onChange={(checked) => updateOpenAiPrompt(identifier, { forbid_overrides: checked })} />
                            <PromptOptionRow title="System Prompt" text="Служебный prompt Tavern. Такие prompt обычно не удаляются." checked={Boolean(prompt.system_prompt)} onChange={(checked) => updateOpenAiPrompt(identifier, { system_prompt: checked })} />
                            <PromptOptionRow title="Marker" text="Плейсхолдер для куска контекста: chat history, examples, persona, world info." checked={Boolean(prompt.marker)} onChange={(checked) => updateOpenAiPrompt(identifier, { marker: checked })} />
                          </div>
                          <EditableTextArea label="Prompt" value={String(prompt.content || '')} disabled={Boolean(prompt.marker)} onChange={(value) => updateOpenAiPrompt(identifier, { content: value })} />
                          {prompt.marker ? <small>Marker prompt content is pulled from context pieces, like in SillyTavern.</small> : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div> : <p className="prompt-list-collapsed">Список prompt скрыт. Пресет загружен, порядок и toggles сохраняются без изменений.</p>}
            </section>

            <ReasoningPresetPanel
              settings={reasoningSettingsFromPreset(presetObject)}
              assistantPrefill={String(presetObject.assistant_prefill ?? '')}
              update={updateReasoningPreset}
              updateAssistantPrefill={updateAssistantPrefill}
            />
          </div>
        ) : null}

        <details className="raw-preset-details">
          <summary>Raw JSON пресета</summary>
          <EditableTextArea label="Raw JSON" value={presetJsonDraft} onChange={setPresetJsonDraft} />
        </details>
        {presetMessage ? <p className="library-message">{presetMessage}</p> : null}
        <div className="preset-actions">
          <button type="button" onClick={() => void savePreset()}>Сохранить пресет</button>
          <button type="button" onClick={() => void applyPreset()}>Применить</button>
          <button type="button" onClick={() => void exportPreset()}>Экспорт ST JSON</button>
          <button type="button" onClick={() => void deletePreset()}>Удалить</button>
        </div>
      </div>
    );
  }

  if (section === 'connection') {
    return (
      <div className="form-stack">
        {accessDenied.presets ? <AccessDeniedNotice /> : null}
        <TwoColumns
          left={(
            <label className="field-preview">
              <span>Пресет подключения</span>
              <select value={activeConnectionPresetName} onChange={(event) => void applyConnectionPreset(event.target.value)}>
                <option value="">Выбрать пресет</option>
                {connectionPresets.map((preset) => <option value={preset.name} key={preset.name}>{preset.name}{activeConnectionPresetName === preset.name ? ' · active' : ''}</option>)}
              </select>
            </label>
          )}
          right={(
            <label className="field-preview">
              <span>Удалить пресет</span>
              <select value={presetToDelete} onChange={(event) => setPresetToDelete(event.target.value)}>
                <option value="">Выбрать</option>
                {connectionPresets.map((preset) => <option value={preset.name} key={preset.name}>{preset.name}</option>)}
              </select>
              <button type="button" onClick={() => void deleteConnectionPreset(presetToDelete)}>Удалить</button>
            </label>
          )}
        />
        <label className="field-preview">
          <span>Метод подключения</span>
          <select value={generationSettings.provider} onChange={(event) => setGenerationSettings({ ...generationSettings, provider: event.target.value })}>
            {connectionMethods.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <EditableField label="Endpoint / proxy URL" value={generationSettings.base_url} onChange={(base_url) => setGenerationSettings({ ...generationSettings, base_url })} />
        <p className="helper-text">Имя и аватар бота берутся из выбранной карточки. Имя и аватар игрока берутся из локально выбранной персоны.</p>
        <TwoColumns
          left={(
            <label className="field-preview">
              <span>Model</span>
              <input list="model-options" value={generationSettings.model} onChange={(event) => setGenerationSettings({ ...generationSettings, model: event.target.value })} />
              <datalist id="model-options">
                {models.map((model) => <option value={model} key={model} />)}
              </datalist>
            </label>
          )}
          right={<EditableField label={generationSettings.api_key_configured ? 'API key (сохранен)' : 'API key'} value={generationSettings.api_key} onChange={(api_key) => setGenerationSettings({ ...generationSettings, api_key })} />}
        />
        <EditableTextArea label="System prompt" value={generationSettings.system_prompt} onChange={(system_prompt) => setGenerationSettings({ ...generationSettings, system_prompt })} />
        <TwoColumns
          left={<EditableField label="Temperature" value={String(generationSettings.temperature)} onChange={(temperature) => setGenerationSettings({ ...generationSettings, temperature: Number(temperature) || 0 })} />}
          right={<EditableField label="Max tokens" value={String(generationSettings.max_tokens)} onChange={(maxTokens) => setGenerationSettings({ ...generationSettings, max_tokens: Number(maxTokens) || 1 })} />}
        />
        <ToggleRow label="Очистить сохраненный API key" checked={generationSettings.clear_api_key} onChange={(clear_api_key) => setGenerationSettings({ ...generationSettings, clear_api_key })} />
        <EditableField label="Название пресета для сохранения" value={connectionPresetName} onChange={setConnectionPresetName} />
        {connectionMessage ? <p className="library-message">{connectionMessage}</p> : null}
        <TwoColumns left={<button type="button" onClick={() => void saveGenerationSettings()}>Сохранить подключение</button>} right={<button type="button" onClick={() => void checkConnection()}>Запросить модели / проверить</button>} />
      </div>
    );
  }

  if (section === 'visual') {
    return (
      <div className="form-stack visual-settings">
        <section className="visual-group">
          <h3>Тема</h3>
          <div className="theme-grid">
            {themes.map((theme) => (
              <button
                className={visualSettings.theme === theme.id ? 'theme-card active' : 'theme-card'}
                key={theme.id}
                type="button"
                onClick={() => setVisualSettings({ ...visualSettings, theme: theme.id })}
              >
                <span className="theme-swatches">
                  {theme.swatches.map((swatch) => <i key={swatch} style={{ background: swatch }} />)}
                </span>
                <strong>{theme.name}</strong>
                <small>{theme.description}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="visual-group">
          <h3>Читаемость</h3>
          <SegmentedControl
            label="Размер текста"
            value={visualSettings.textScale}
            options={[
              ['small', 'Мелкий'],
              ['normal', 'Обычный'],
              ['large', 'Крупный'],
              ['huge', 'Очень крупный'],
            ]}
            onChange={(textScale) => setVisualSettings({ ...visualSettings, textScale: textScale as VisualSettings['textScale'] })}
          />
          <SegmentedControl
            label="Плотность"
            value={visualSettings.density}
            options={[
              ['compact', 'Компактно'],
              ['comfortable', 'Нормально'],
              ['spacious', 'Свободно'],
            ]}
            onChange={(density) => setVisualSettings({ ...visualSettings, density: density as VisualSettings['density'] })}
          />
          <SegmentedControl
            label="Ширина сообщений"
            value={visualSettings.messageWidth}
            options={[
              ['narrow', 'Узко'],
              ['standard', 'Стандарт'],
              ['wide', 'Широко'],
            ]}
            onChange={(messageWidth) => setVisualSettings({ ...visualSettings, messageWidth: messageWidth as VisualSettings['messageWidth'] })}
          />
        </section>

        <section className="visual-group">
          <h3>Поведение</h3>
          <SegmentedControl
            label="Скругления"
            value={visualSettings.radius}
            options={[
              ['sharp', 'Строго'],
              ['soft', 'Мягко'],
              ['round', 'Кругло'],
            ]}
            onChange={(radius) => setVisualSettings({ ...visualSettings, radius: radius as VisualSettings['radius'] })}
          />
          <ToggleRow label="Легкие анимации" checked={visualSettings.motion} onChange={(motion) => setVisualSettings({ ...visualSettings, motion })} />
          <ToggleRow label="Высокий контраст" checked={visualSettings.highContrast} onChange={(highContrast) => setVisualSettings({ ...visualSettings, highContrast })} />
          <ToggleRow label="Аватары в списках" checked={visualSettings.showAvatars} onChange={(showAvatars) => setVisualSettings({ ...visualSettings, showAvatars })} />
          <ToggleRow label="Закрепить поле ввода" checked={visualSettings.stickyComposer} onChange={(stickyComposer) => setVisualSettings({ ...visualSettings, stickyComposer })} />
        </section>

        <button type="button" onClick={() => setVisualSettings(defaultVisualSettings)}>Сбросить визуал</button>
      </div>
    );
  }

  if (section === 'lorebooks') {
    const bindingTargetOptions = lorebookBindingDraft.target_type === 'card'
      ? cards.map((card) => ({ id: card.id, label: card.name }))
      : lorebookBindingDraft.target_type === 'chat'
        ? botChats.map((chat) => ({ id: chat.id, label: chat.title }))
        : lorebookBindingDraft.target_type === 'persona'
          ? personas.map((persona) => ({ id: persona.id, label: persona.name }))
          : [];
    return (
      <div className="form-stack preset-editor">
        <div className="preset-title-row">
          <div>
            <span className="eyebrow">SillyTavern World Info</span>
            <h3>Лорбуки</h3>
          </div>
          <button className="ghost-button" type="button" onClick={() => void exportLorebook()}>Экспорт ST JSON</button>
        </div>
        {accessDenied.lorebooks ? <AccessDeniedNotice /> : <>
          <TwoColumns
            left={(
              <label className="field-preview">
                <span>Лорбук</span>
                <select value={selectedLorebookName} onChange={(event) => void openLorebook(event.target.value)}>
                  <option value="">Выбрать лорбук</option>
                  {lorebooks.map((book) => <option value={book.name} key={book.filename}>{book.name} · {book.entry_count} entries</option>)}
                </select>
              </label>
            )}
            right={<EditableField label="Имя для сохранения" value={lorebookNameDraft} onChange={setLorebookNameDraft} />}
          />
          <label className="upload-card compact-upload">
            <span>Импорт ST World Info JSON</span>
            <small>Формат `worlds/*.json`: объект с `entries` как в SillyTavern.</small>
            <input type="file" accept="application/json,.json" onChange={(event) => { void importLorebook(event.target.files?.[0] ?? null); event.target.value = ''; }} />
          </label>
          <section className="preset-card-section">
            <div className="preset-title-row">
              <div>
                <h3>Entries</h3>
                <small>Редактор World Info записей: ключи, позиция, depth, probability, recursion и timing.</small>
              </div>
              <div className="prompt-header-actions">
                <button className="ghost-button" type="button" onClick={() => setLoreEntriesOpen((open) => !open)}>{loreEntriesOpen ? 'Свернуть' : `Показать (${lorebookEntries.length})`}</button>
                <button type="button" onClick={addLorebookEntry}>Добавить entry</button>
              </div>
            </div>
            {loreEntriesOpen ? <div className="prompt-list">
              {lorebookEntries.length ? lorebookEntries.map((entry) => {
                const uid = String(entry.uid ?? '0');
                const isEditing = editingLoreEntryUid === uid;
                const disabled = Boolean(entry.disable);
                return (
                  <article className={disabled ? 'prompt-row lore-entry-row' : 'prompt-row lore-entry-row enabled'} key={uid}>
                    <span className="prompt-kind">{disabled ? '×' : '◆'}</span>
                    <div className="prompt-main">
                      <strong>{String(entry.comment || `Entry ${uid}`)}</strong>
                      <small>uid {uid} · {lorebookPositionLabel(entry.position)} · order {String(entry.order ?? 100)} · {csvFromArray(entry.key).join(', ') || 'без ключей'}</small>
                    </div>
                    <div className="lore-entry-actions">
                      <button className="prompt-icon" type="button" title="Редактировать" onClick={() => setEditingLoreEntryUid(isEditing ? '' : uid)}><Icon name="edit" /></button>
                      <button className="prompt-icon" type="button" title="Дубликат" onClick={() => duplicateLorebookEntry(uid)}>⧉</button>
                      <button className="prompt-icon danger" type="button" title="Удалить" onClick={() => deleteLorebookEntry(uid)}><Icon name="trash" /></button>
                      <button className={disabled ? 'prompt-toggle' : 'prompt-toggle active'} type="button" onClick={() => updateLorebookEntry(uid, { disable: !disabled })} aria-label="Toggle entry"><i /></button>
                    </div>
                    {isEditing ? (
                      <div className="prompt-edit-panel">
                        <div className="prompt-edit-header">
                          <div>
                            <h4>{String(entry.comment || `Entry ${uid}`)}</h4>
                            <small>Все поля сохраняются обратно в ST-compatible `entries[uid]`.</small>
                          </div>
                          <button className="ghost-button" type="button" onClick={() => setEditingLoreEntryUid('')}>Закрыть</button>
                        </div>
                        <div className="prompt-edit-grid">
                          <EditableField label="Comment / Memo" value={String(entry.comment || '')} onChange={(value) => updateLorebookEntry(uid, { comment: value })} />
                          <EditableField label="Automation ID" value={String(entry.automationId || '')} onChange={(value) => updateLorebookEntry(uid, { automationId: value })} />
                          <NumberInputField label="Display Index" value={entry.displayIndex} fallback={numberField(entry.uid, 0)} step={1} onChange={(value) => updateLorebookEntry(uid, { displayIndex: value })} />
                          <NumberInputField label="Order" value={entry.order} fallback={100} step={1} onChange={(value) => updateLorebookEntry(uid, { order: value })} />
                          <SelectChoicesField label="Position" value={String(entry.position ?? 0)} options={[["0", "↑Char / Before"], ["1", "↓Char / After"], ["2", "↑Author's Note"], ["3", "↓Author's Note"], ["4", "@ Depth"], ["5", "↑Examples"], ["6", "↓Examples"], ["7", "Outlet"]]} onChange={(value) => updateLorebookEntry(uid, { position: Number(value) })} />
                          <SelectChoicesField label="Role @ Depth" value={String(entry.role ?? 'null')} options={[["null", "Default/System"], ["0", "System"], ["1", "User"], ["2", "Assistant"]]} onChange={(value) => updateLorebookEntry(uid, { role: value === 'null' ? null : Number(value) })} />
                          <NumberInputField label="Depth" value={entry.depth} fallback={4} min={0} step={1} onChange={(value) => updateLorebookEntry(uid, { depth: value })} />
                          <EditableField label="Group" value={String(entry.group || '')} onChange={(value) => updateLorebookEntry(uid, { group: value })} />
                          <NumberInputField label="Group Weight" value={entry.groupWeight} fallback={100} step={1} onChange={(value) => updateLorebookEntry(uid, { groupWeight: value })} />
                          <NumberInputField label="Probability %" value={entry.probability} fallback={100} min={0} max={100} step={1} onChange={(value) => updateLorebookEntry(uid, { probability: value })} />
                          <NumberInputField label="Sticky" value={entry.sticky} fallback={0} min={0} step={1} onChange={(value) => updateLorebookEntry(uid, { sticky: value })} />
                          <NumberInputField label="Cooldown" value={entry.cooldown} fallback={0} min={0} step={1} onChange={(value) => updateLorebookEntry(uid, { cooldown: value })} />
                          <NumberInputField label="Delay" value={entry.delay} fallback={0} min={0} step={1} onChange={(value) => updateLorebookEntry(uid, { delay: value })} />
                          <NumberInputField label="Scan Depth" value={entry.scanDepth ?? ''} fallback={0} min={0} step={1} onChange={(value) => updateLorebookEntry(uid, { scanDepth: value === '' ? null : value })} />
                        </div>
                        <TwoColumns
                          left={<EditableTextArea label="Primary Keys (one per line or comma)" value={csvFromArray(entry.key).join('\n')} onChange={(value) => updateLorebookEntry(uid, { key: csvToArray(value) })} />}
                          right={<EditableTextArea label="Secondary Keys" value={csvFromArray(entry.keysecondary).join('\n')} onChange={(value) => updateLorebookEntry(uid, { keysecondary: csvToArray(value) })} />}
                        />
                        <EditableTextArea label="Content" value={String(entry.content || '')} onChange={(value) => updateLorebookEntry(uid, { content: value })} />
                        <div className="prompt-option-list">
                          <PromptOptionRow title="Enabled" text="Инверсия ST `disable`: выключенная запись не активируется." checked={!disabled} onChange={(checked) => updateLorebookEntry(uid, { disable: !checked })} />
                          <PromptOptionRow title="Constant" text="Всегда активировать запись без ключей." checked={Boolean(entry.constant)} onChange={(checked) => updateLorebookEntry(uid, { constant: checked })} />
                          <PromptOptionRow title="Selective" text="Требовать secondary key после primary key." checked={Boolean(entry.selective)} onChange={(checked) => updateLorebookEntry(uid, { selective: checked })} />
                          <PromptOptionRow title="Use Probability" text="Применять шанс активации." checked={Boolean(entry.useProbability)} onChange={(checked) => updateLorebookEntry(uid, { useProbability: checked })} />
                          <PromptOptionRow title="Add Memo" text="ST addMemo, сохраняется в JSON." checked={entry.addMemo !== false} onChange={(checked) => updateLorebookEntry(uid, { addMemo: checked })} />
                          <PromptOptionRow title="Group Override" text="Перекрытие группы, как в Tavern." checked={Boolean(entry.groupOverride)} onChange={(checked) => updateLorebookEntry(uid, { groupOverride: checked })} />
                          <PromptOptionRow title="Use Group Scoring" text="null в ST означает глобальную настройку." checked={entry.useGroupScoring === true} onChange={(checked) => updateLorebookEntry(uid, { useGroupScoring: checked ? true : null })} />
                          <PromptOptionRow title="Case Sensitive" text="null в ST означает глобальную настройку." checked={entry.caseSensitive === true} onChange={(checked) => updateLorebookEntry(uid, { caseSensitive: checked ? true : null })} />
                          <PromptOptionRow title="Match Whole Words" text="null в ST означает глобальную настройку." checked={entry.matchWholeWords === true} onChange={(checked) => updateLorebookEntry(uid, { matchWholeWords: checked ? true : null })} />
                          <PromptOptionRow title="Vectorized" text="Сохраняется для совместимости ST vector storage." checked={Boolean(entry.vectorized)} onChange={(checked) => updateLorebookEntry(uid, { vectorized: checked })} />
                          <PromptOptionRow title="Exclude Recursion" text="Исключить запись из recursive scan." checked={Boolean(entry.excludeRecursion)} onChange={(checked) => updateLorebookEntry(uid, { excludeRecursion: checked })} />
                          <PromptOptionRow title="Prevent Recursion" text="Запрещать рекурсию после активации." checked={Boolean(entry.preventRecursion)} onChange={(checked) => updateLorebookEntry(uid, { preventRecursion: checked })} />
                          <PromptOptionRow title="Delay Until Recursion" text="Отложить до recursive pass." checked={Boolean(entry.delayUntilRecursion)} onChange={(checked) => updateLorebookEntry(uid, { delayUntilRecursion: checked })} />
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              }) : <p className="empty-library">Записей пока нет. Нажми `Добавить entry` или импортируй ST World Info JSON.</p>}
            </div> : <p className="prompt-list-collapsed">Entries скрыты. JSON лорбука остается загруженным и сохранится без изменений.</p>}
          </section>
          <section className="preset-card-section">
            <div className="preset-title-row">
              <div>
                <h3>Привязки</h3>
                <small>Один лорбук можно привязать к нескольким чатам, карточкам, персонам или сделать global.</small>
              </div>
              <button type="button" onClick={() => void addLorebookBinding()}>Добавить привязку</button>
            </div>
            <div className="prompt-edit-grid">
              <label className="field-preview">
                <span>Лорбук</span>
                <select value={lorebookBindingDraft.book || selectedLorebookName} onChange={(event) => setLorebookBindingDraft({ ...lorebookBindingDraft, book: event.target.value })}>
                  <option value="">Выбрать</option>
                  {lorebooks.map((book) => <option value={book.name} key={book.filename}>{book.name}</option>)}
                </select>
              </label>
              <SelectChoicesField label="Цель" value={lorebookBindingDraft.target_type} options={[["global", "Global"], ["card", "Карточка"], ["chat", "Чат"], ["persona", "Персона"]]} onChange={(value) => setLorebookBindingDraft({ ...lorebookBindingDraft, target_type: value as LorebookBinding['target_type'], target_id: '' })} />
              {lorebookBindingDraft.target_type === 'global' ? <div className="relative-position-help"><span>Global</span><small>Активен в любом чате.</small></div> : (
                <label className="field-preview">
                  <span>ID цели</span>
                  <select value={lorebookBindingDraft.target_id} onChange={(event) => setLorebookBindingDraft({ ...lorebookBindingDraft, target_id: event.target.value })}>
                    <option value="">Выбрать</option>
                    {bindingTargetOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
                  </select>
                </label>
              )}
            </div>
            <div className="prompt-list">
              {lorebookBindings.length ? lorebookBindings.map((binding, index) => (
                <article className="prompt-row enabled" key={`${binding.book}:${binding.target_type}:${binding.target_id}:${index}`}>
                  <span className="prompt-kind">◆</span>
                  <div className="prompt-main">
                    <strong>{binding.book}</strong>
                    <small>{binding.target_type}{binding.target_id ? ` · ${binding.target_id}` : ''}</small>
                  </div>
                  <button className="prompt-icon danger" type="button" onClick={() => void removeLorebookBinding(index)}><Icon name="trash" /></button>
                </article>
              )) : <p className="empty-library">Привязок пока нет.</p>}
            </div>
          </section>
          <details className="raw-preset-details" open>
            <summary>Raw JSON лорбука</summary>
            <EditableTextArea label="World Info JSON" value={lorebookJsonDraft} onChange={setLorebookJsonDraft} />
          </details>
          {lorebookMessage ? <p className="library-message">{lorebookMessage}</p> : null}
          <div className="preset-actions">
            <button type="button" onClick={() => void saveLorebook()}>Сохранить лорбук</button>
            <button type="button" onClick={() => void exportLorebook()}>Экспорт ST JSON</button>
            <button type="button" onClick={() => void deleteLorebook()}>Удалить</button>
          </div>
        </>}
      </div>
    );
  }

  if (section === 'cards') {
    return (
      <div className="form-stack library-workspace card-workspace">
        <section className="library-column library-list-panel">
          <div className="panel-heading compact-heading">
            <div>
              <span className="eyebrow">Карточки</span>
              <strong>{cards.length ? `${cards.length} в библиотеке` : 'Пустая библиотека'}</strong>
            </div>
          </div>

          {accessDenied.cards ? <AccessDeniedNotice /> : <>
          <details className="create-card-panel">
            <summary>Новая / импорт</summary>
            <div className="form-stack">
              <TwoColumns
                left={<EditableField label="Имя" value={cardDraft.name} onChange={(name) => setCardDraft({ ...cardDraft, name })} />}
                right={<EditableField label="Теги" value={cardDraft.tags} onChange={(tags) => setCardDraft({ ...cardDraft, tags })} />}
              />
              <EditableTextArea label="Описание" value={cardDraft.description} onChange={(description) => setCardDraft({ ...cardDraft, description })} />
              <TwoColumns
                left={<EditableTextArea label="Personality" value={cardDraft.personality} onChange={(personality) => setCardDraft({ ...cardDraft, personality })} />}
                right={<EditableTextArea label="Scenario" value={cardDraft.scenario} onChange={(scenario) => setCardDraft({ ...cardDraft, scenario })} />}
              />
              <EditableTextArea label="First message" value={cardDraft.firstMessage} onChange={(firstMessage) => setCardDraft({ ...cardDraft, firstMessage })} />
              <TwoColumns
                left={<EditableTextArea label="Example dialogue" value={cardDraft.messageExample} onChange={(messageExample) => setCardDraft({ ...cardDraft, messageExample })} />}
                right={<EditableField label="Creator" value={cardDraft.creator} onChange={(creator) => setCardDraft({ ...cardDraft, creator })} />}
              />
              <TwoColumns
                left={<button className="compact-action-button" type="button" onClick={() => void createCard()}>Создать PNG</button>}
                right={(
                  <label className="upload-card compact-upload">
                    <span>PNG аватарка</span>
                    <small>Если файл не выбран, будет PNG-заглушка.</small>
                    <input type="file" accept="image/png" onChange={(event) => setCardAvatar(event.target.files?.[0] ?? null)} />
                  </label>
                )}
              />
              <label className="upload-card">
                <span>Импорт ST PNG</span>
                <input type="file" accept="image/png" onChange={(event) => void importCard(event.target.files?.[0] ?? null)} />
              </label>
            </div>
          </details>

          <div className="compact-card-list">
            {cards.length ? cards.map((card) => (
              <CharacterCardView active={activeCard?.id === card.id} editing={editingCardId === card.id} card={card} key={card.filename} onSelect={selectBotCard} onEdit={startEditCard} onDelete={deleteCard} openImagePreview={openImagePreview} imageSrc={imageSrc} />
            )) : <EmptyLibrary text="Карточек пока нет. Создай PNG карточку или импортируй character card из SillyTavern." />}
          </div>
          </>}
        </section>

        <section className="library-column library-detail-panel">
        {libraryMessage ? <p className="library-message">{libraryMessage}</p> : null}
        {accessDenied.cards ? <AccessDeniedNotice /> : activeCard ? (
          <article className="active-bot-panel">
            <button className="avatar-preview-button card-image-button" type="button" onClick={() => openImagePreview(activeCard.image_url, activeCard.name)}><img src={imageSrc(activeCard.image_url)} alt="" loading="lazy" /></button>
            <div>
              <span className="eyebrow">Выбранная карточка</span>
              <strong>{activeCard.name}</strong>
              <p>{activeCard.description || activeCard.first_message || 'Описание отсутствует.'}</p>
              <button type="button" onClick={() => void createBotChat()}>Новый чат с этой карточкой</button>
            </div>
          </article>
        ) : null}

        {editingCard ? (
          <section className="card-edit-panel">
            <div className="panel-heading compact-heading">
              <div>
                <span className="eyebrow">Редактирование PNG metadata</span>
                <strong>{editingCard.name}</strong>
              </div>
              <button className="ghost-button" type="button" onClick={() => setEditingCardId('')}>Закрыть</button>
            </div>
            <TwoColumns
              left={<EditableField label="Имя" value={cardEditDraft.name} onChange={(name) => setCardEditDraft({ ...cardEditDraft, name })} />}
              right={<EditableField label="Теги" value={cardEditDraft.tags} onChange={(tags) => setCardEditDraft({ ...cardEditDraft, tags })} />}
            />
            <EditableTextArea label="Описание" value={cardEditDraft.description} onChange={(description) => setCardEditDraft({ ...cardEditDraft, description })} />
            <TwoColumns
              left={<EditableTextArea label="Personality" value={cardEditDraft.personality} onChange={(personality) => setCardEditDraft({ ...cardEditDraft, personality })} />}
              right={<EditableTextArea label="Scenario" value={cardEditDraft.scenario} onChange={(scenario) => setCardEditDraft({ ...cardEditDraft, scenario })} />}
            />
            <EditableTextArea label="First message" value={cardEditDraft.firstMessage} onChange={(firstMessage) => setCardEditDraft({ ...cardEditDraft, firstMessage })} />
            <TwoColumns
              left={<EditableTextArea label="Example dialogue" value={cardEditDraft.messageExample} onChange={(messageExample) => setCardEditDraft({ ...cardEditDraft, messageExample })} />}
              right={<EditableField label="Creator" value={cardEditDraft.creator} onChange={(creator) => setCardEditDraft({ ...cardEditDraft, creator })} />}
            />
            <label className="upload-card compact-upload">
              <span>Заменить PNG аватарку</span>
              <small>Metadata карточки сохранится, заменится только картинка PNG.</small>
              <input type="file" accept="image/png" onChange={(event) => { void uploadCardAvatar(editingCard, event.target.files?.[0] ?? null); event.target.value = ''; }} />
            </label>
            <div className="preset-actions">
              <button type="button" onClick={() => void saveEditingCard()}>Сохранить карточку</button>
              <button className="ghost-button" type="button" onClick={() => { setEditingCardId(''); setCardEditDraft(emptyCardDraft); }}>Отмена</button>
            </div>
          </section>
        ) : <EmptyLibrary text="Выбери карточку слева или нажми `Править`, чтобы открыть редактор metadata." />}

        <section className="chat-list">
          <h3>Чаты выбранной карточки</h3>
          {accessDenied.chats ? <AccessDeniedNotice /> : botChats.length ? botChats.map((chat) => (
            <article className={activeChat?.id === chat.id ? 'chat-row active' : 'chat-row'} key={chat.id}>
              <button type="button" onClick={() => void selectChat(chat.id)}>
                <strong>{chat.title}</strong>
                <small>{chat.message_count} сообщений · {new Date(chat.updated_at).toLocaleString()}</small>
              </button>
              <div className="chat-row-actions">
                <input aria-label="Новое имя чата" value={chatRenameDrafts[chat.id] ?? ''} placeholder="Новое имя" onChange={(event) => setChatRenameDrafts({ ...chatRenameDrafts, [chat.id]: event.target.value })} />
                <button type="button" onClick={() => void copyChat(chat.id)}>Копия</button>
                <button type="button" onClick={() => void exportChat(chat.id)}>ST .jsonl</button>
                <button type="button" onClick={() => void renameChat(chat)}>Имя</button>
                <button type="button" onClick={() => void deleteChat(chat.id)}>Удалить</button>
              </div>
            </article>
          )) : <EmptyLibrary text="Выбери карточку, чтобы увидеть или создать ее чаты." />}
        </section>
        </section>
      </div>
    );
  }

  if (section === 'personas') {
    return (
      <div className="form-stack library-workspace personas-workspace">
        <section className="library-column library-list-panel">
          <div className="panel-heading compact-heading">
            <div>
              <span className="eyebrow">Персоны</span>
              <strong>{personas.length ? `${personas.length} профилей` : 'Профилей нет'}</strong>
            </div>
          </div>

          {accessDenied.personas ? <AccessDeniedNotice /> : <>
          <details className="create-card-panel">
            <summary>Новая персона</summary>
            <div className="form-stack">
              <EditableField label="Имя" value={personaDraft.name} onChange={(name) => setPersonaDraft({ ...personaDraft, name })} />
              <EditableTextArea label="Persona prompt" value={personaDraft.description} onChange={(description) => setPersonaDraft({ ...personaDraft, description })} />
              <button type="button" onClick={() => void createPersona()}>Создать</button>
            </div>
          </details>

          <div className="persona-list">
            {personas.length ? personas.map((persona) => (
              <article className={selectedPersonaId === persona.id ? 'persona-card persona-card-compact active' : 'persona-card persona-card-compact'} key={persona.id}>
                <div className="persona-list-main">
                  <div className="persona-heading persona-heading-card">
                    {persona.avatar_url ? <button className="avatar-preview-button persona-image-button" type="button" onClick={() => openImagePreview(persona.avatar_url, persona.name)}><img src={imageSrc(persona.avatar_url)} alt="" loading="lazy" /></button> : <i className="persona-avatar-fallback">{persona.name.slice(0, 1) || '?'}</i>}
                    <div>
                      <strong>{persona.name}</strong>
                      <small>{selectedPersonaId === persona.id ? 'Выбрана здесь' : 'Не выбрана'}</small>
                      <p>{persona.description || 'Persona prompt пустой.'}</p>
                    </div>
                  </div>
                </div>
                <div className="card-row-actions">
                  <button type="button" onClick={() => selectLocalPersona(persona.id)}>{selectedPersonaId === persona.id ? 'Выбрана' : 'Выбрать'}</button>
                  <button className="ghost-button" type="button" onClick={() => setEditingPersonaId(persona.id)}>Править</button>
                  <button className="ghost-button danger-button" type="button" onClick={() => void deletePersona(persona)}>Удалить</button>
                </div>
              </article>
            )) : <EmptyLibrary text="Персон пока нет. Создай профиль игрока для prompt-а." />}
          </div>
          </>}
        </section>

        <section className="library-column library-detail-panel">
          {libraryMessage ? <p className="library-message">{libraryMessage}</p> : null}
          {accessDenied.personas ? <AccessDeniedNotice /> : editingPersona ? (
            <article className={selectedPersonaId === editingPersona.id ? 'persona-card persona-card-compact active' : 'persona-card persona-card-compact'} key={editingPersona.id}>
              <div className="persona-heading">
                {editingPersona.avatar_url ? <button className="avatar-preview-button persona-image-button" type="button" onClick={() => openImagePreview(editingPersona.avatar_url, editingPersona.name)}><img src={imageSrc(editingPersona.avatar_url)} alt="" loading="lazy" /></button> : <span>{editingPersona.name.slice(0, 1) || '?'}</span>}
                <div>
                  <input aria-label="Имя персоны" value={editingPersona.name} onChange={(event) => editPersona(editingPersona.id, { name: event.target.value })} />
                  <small>{selectedPersonaId === editingPersona.id ? 'Локально выбрана в этом браузере' : 'Не выбрана локально'}</small>
                </div>
              </div>
              <EditableTextArea label="Описание / persona prompt" value={editingPersona.description} onChange={(description) => editPersona(editingPersona.id, { description })} />
              <div className="persona-actions">
                <button type="button" onClick={() => void updatePersona(editingPersona)}>Сохранить</button>
                <button className="ghost-button" type="button" onClick={() => selectLocalPersona(editingPersona.id)}>{selectedPersonaId === editingPersona.id ? 'Выбрана' : 'Выбрать'}</button>
                <button className="ghost-button danger-button" type="button" onClick={() => void deletePersona(editingPersona)}>Удалить</button>
                <label className="avatar-upload">
                  <span>Аватарка</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadPersonaAvatar(editingPersona.id, event.target.files?.[0] ?? null)} />
                </label>
              </div>
            </article>
          ) : <EmptyLibrary text="Выбери персону слева или создай новую." />}
        </section>
      </div>
    );
  }

  return (
    <div className="form-stack security-panel">
      <section className="preset-card-section">
        <div className="preset-title-row">
          <div>
            <span className="eyebrow">Аккаунт</span>
            <h3>{authUser ? `${authUser.is_admin ? '♛ ' : ''}${authUser.username}` : 'Гость'}</h3>
          </div>
          {authUser ? <button className="ghost-button" type="button" onClick={() => void logout()}>Выйти</button> : null}
        </div>
        {!authUser ? (
          <div className="form-stack">
            <TwoColumns
              left={<EditableField label="Ник" value={authDraft.username} onChange={(username) => setAuthDraft({ ...authDraft, username })} />}
              right={<EditableField label="Пароль" type="password" value={authDraft.password} onChange={(password) => setAuthDraft({ ...authDraft, password })} />}
            />
            <div className="preset-actions">
              <button type="button" onClick={() => void login()}>Войти</button>
              <button className="ghost-button" type="button" onClick={() => void register()}>Регистрация</button>
            </div>
          </div>
        ) : (
          <div className="form-stack">
            <p className="helper-text">Токен сохранен локально в браузере, следующий вход будет автоматическим.</p>
            {!authUser.is_admin ? (
              <TwoColumns
                left={<EditableField label="Код админа" type="password" value={authDraft.adminCode} onChange={(adminCode) => setAuthDraft({ ...authDraft, adminCode })} />}
                right={<button type="button" onClick={() => void claimAdmin()}>Получить админ-права</button>}
              />
            ) : <p className="library-message">Админ-права активны.</p>}
          </div>
        )}
        {authMessage ? <p className="library-message">{authMessage}</p> : null}
      </section>

      <section className="preset-card-section">
        <div className="preset-title-row">
          <div>
            <span className="eyebrow">Разрешения</span>
            <h3>Кто может менять данные</h3>
          </div>
          <button type="button" onClick={() => void saveSecurityPermissions()}>Сохранить права</button>
        </div>
        <ToggleRow label="Требовать вход для просмотра контента" checked={authRequired} onChange={setAuthRequired} />
        <p className="helper-text">Если включено, карточки, персоны, чаты, аватарки и пресеты не отдаются гостям. Для тонкой настройки используй права просмотра ниже.</p>
        <div className="permission-grid">
          {Object.entries(permissionLabels).map(([key, label]) => {
            const rule = securityPermissions[key] || defaultSecurityPermissions[key];
            return (
              <article className="permission-row" key={key}>
                <strong>{label}</strong>
                <select value={rule.mode} onChange={(event) => setSecurityPermissions({ ...securityPermissions, [key]: { ...rule, mode: event.target.value as PermissionMode } })}>
                  <option value="everyone">Все</option>
                  <option value="admins">Только админы</option>
                  <option value="users">Админы + список</option>
                </select>
                <input value={rule.users.join(', ')} placeholder="ники через запятую" onChange={(event) => setSecurityPermissions({ ...securityPermissions, [key]: { ...rule, users: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) } })} />
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ChatPicker({
  activeChat,
  botChats,
  createBotChat,
  copyChat,
  exportChat,
  deleteChat,
  renameChat,
  chatRenameDrafts,
  setChatRenameDrafts,
  selectChat,
  close,
}: {
  activeChat: BotChat | null;
  botChats: BotChatSummary[];
  createBotChat: () => Promise<void>;
  copyChat: (chatId: string) => Promise<void>;
  exportChat: (chatId: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  renameChat: (chat: BotChatSummary) => Promise<void>;
  chatRenameDrafts: Record<string, string>;
  setChatRenameDrafts: (drafts: Record<string, string>) => void;
  selectChat: (chatId: string) => Promise<void>;
  close: () => void;
}) {
  return (
    <div className="chat-picker">
      <header>
        <strong>Чаты карточки</strong>
        <div className="chat-picker-header-actions">
          <button type="button" onClick={() => void createBotChat()}>Новый</button>
          <button className="ghost-button" type="button" onClick={close}>Закрыть</button>
        </div>
      </header>
      {botChats.length ? botChats.map((chat) => (
        <article className={activeChat?.id === chat.id ? 'chat-row active' : 'chat-row'} key={chat.id}>
          <button type="button" onClick={() => void selectChat(chat.id)}>
            <strong>{chat.title}</strong>
            <small>{chat.message_count} сообщений</small>
          </button>
          <div className="chat-row-actions">
            <input aria-label="Новое имя чата" value={chatRenameDrafts[chat.id] ?? ''} placeholder="Новое имя" onChange={(event) => setChatRenameDrafts({ ...chatRenameDrafts, [chat.id]: event.target.value })} />
            <button type="button" onClick={() => void copyChat(chat.id)}>Копия</button>
            <button type="button" onClick={() => void exportChat(chat.id)}>ST .jsonl</button>
            <button type="button" onClick={() => void renameChat(chat)}>Имя</button>
            <button type="button" onClick={() => void deleteChat(chat.id)}>Удалить</button>
          </div>
        </article>
      )) : <p className="empty-library">У выбранной карточки пока нет чатов.</p>}
    </div>
  );
}

function ComposerActionMenu({ activeChat, isGenerating, openChats, rerollLastBotMessage }: { activeChat: BotChat | null; isGenerating: boolean; openChats: () => void; rerollLastBotMessage: () => Promise<void> }) {
  return (
    <div className="composer-action-menu">
      <button type="button" onClick={openChats}>Чаты</button>
      <button type="button" disabled={!activeChat || isGenerating} onClick={() => void rerollLastBotMessage()}>Реролл</button>
    </div>
  );
}

function ReasoningPresetPanel({ settings, assistantPrefill, update, updateAssistantPrefill }: { settings: ReasoningDisplaySettings; assistantPrefill: string; update: (patch: Partial<ReasoningDisplaySettings>) => void; updateAssistantPrefill: (value: string) => void }) {
  const applyTemplate = (name: string) => {
    const templates: Record<string, Pick<ReasoningDisplaySettings, 'prefix' | 'suffix' | 'separator'>> = {
      DeepSeek: { prefix: '<think>\n', suffix: '\n</think>', separator: '\n\n' },
      'Think XML': { prefix: '<think>', suffix: '</think>', separator: '\n' },
      Blank: { prefix: '', suffix: '', separator: '\n' },
    };
    update(templates[name] || templates.DeepSeek);
  };

  return (
    <section className="preset-card-section reasoning-settings-panel">
      <h3>Рассуждения / Reasoning</h3>
      <div className="reasoning-toggle-grid">
        <label><input type="checkbox" checked={settings.autoParse} onChange={(event) => update({ autoParse: event.target.checked })} />Авто-парсинг</label>
        <label><input type="checkbox" checked={settings.autoExpand} onChange={(event) => update({ autoExpand: event.target.checked })} />Разворачивать</label>
        <label><input type="checkbox" checked={settings.showHidden} onChange={(event) => update({ showHidden: event.target.checked })} />Показывать скрытое</label>
        <label><input type="checkbox" checked={settings.addToPrompts} onChange={(event) => update({ addToPrompts: event.target.checked })} />Добавлять в промпт</label>
        <NumberInputField label="Макс." value={settings.maxAdditions} fallback={1} min={0} max={99} step={1} onChange={(value) => typeof value === 'number' && update({ maxAdditions: value })} />
      </div>
      <div className="reasoning-format-row">
        <label className="field-preview">
          <span>Форматирование рассуждений</span>
          <select value={reasoningTemplateName(settings)} onChange={(event) => applyTemplate(event.target.value)}>
            <option value="Custom">Custom</option>
            <option value="DeepSeek">DeepSeek</option>
            <option value="Think XML">Think XML</option>
            <option value="Blank">Blank</option>
          </select>
        </label>
      </div>
      <div className="reasoning-text-grid">
        <EditableTextArea label="Префикс" value={settings.prefix} onChange={(prefix) => update({ prefix })} />
        <EditableTextArea label="Постфикс" value={settings.suffix} onChange={(suffix) => update({ suffix })} />
        <EditableTextArea label="Разделитель" value={settings.separator} onChange={(separator) => update({ separator })} />
      </div>
      <EditableTextArea label="Начинать ответ с" value={assistantPrefill} onChange={updateAssistantPrefill} />
    </section>
  );
}

function MessageContent({ content, reasoning }: { content: string; reasoning: ReasoningDisplaySettings }) {
  const parsed = reasoning.autoParse ? splitReasoning(content, reasoning) : { reasoning: '', visible: content };
  return (
    <div className="message-content">
      {parsed.reasoning && !reasoning.showHidden ? (
        <details className="reasoning-block" open={reasoning.autoExpand}>
          <summary>Какое-то время заняли размышления</summary>
          <pre>{parsed.reasoning}</pre>
        </details>
      ) : null}
      {parsed.reasoning && reasoning.showHidden ? <pre className="reasoning-visible">{parsed.reasoning}</pre> : null}
      {formatMessageText(parsed.visible)}
    </div>
  );
}

function reasoningSettingsFromPreset(preset: RawPreset | null): ReasoningDisplaySettings {
  return {
    autoParse: preset?.reasoning_auto_parse !== false,
    autoExpand: Boolean(preset?.reasoning_auto_expand),
    showHidden: Boolean(preset?.reasoning_show_hidden),
    addToPrompts: preset?.reasoning_add_to_prompts !== false,
    maxAdditions: numberField(preset?.reasoning_max_additions, 1),
    prefix: String(preset?.reasoning_prefix ?? '<think>'),
    suffix: String(preset?.reasoning_suffix ?? '</think>'),
    separator: String(preset?.reasoning_separator ?? '\n'),
  };
}

function reasoningTemplateName(settings: ReasoningDisplaySettings): string {
  if (settings.prefix === '<think>\n' && settings.suffix === '\n</think>' && settings.separator === '\n\n') {
    return 'DeepSeek';
  }
  if (settings.prefix === '<think>' && settings.suffix === '</think>' && settings.separator === '\n') {
    return 'Think XML';
  }
  if (!settings.prefix && !settings.suffix) {
    return 'Blank';
  }
  return 'Custom';
}

function splitReasoning(content: string, settings: ReasoningDisplaySettings): { reasoning: string; visible: string } {
  if (!settings.prefix || !settings.suffix) {
    return { reasoning: '', visible: content };
  }
  const start = content.indexOf(settings.prefix);
  if (start < 0) {
    return { reasoning: '', visible: content };
  }
  const bodyStart = start + settings.prefix.length;
  const end = content.indexOf(settings.suffix, bodyStart);
  if (end < 0) {
    return { reasoning: '', visible: content };
  }
  const reasoning = content.slice(bodyStart, end);
  const visible = `${content.slice(0, start)}${content.slice(end + settings.suffix.length)}`.trim();
  return { reasoning, visible };
}

function formatMessageText(content: string): ReactNode {
  const nodes: ReactNode[] = [];
  const pattern = /("[^"\n]+"|\*'[^']+'\*|'[^'\n]+'|<\/?[a-zA-Z_][^>\n]{0,80}>|◈[^\n]+◈|⟪[^\n]+⟫)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<span key={`t-${lastIndex}`}>{content.slice(lastIndex, match.index)}</span>);
    }
    const token = match[0];
    const className = token.startsWith('"') ? 'message-dialogue' : token.startsWith("*'") || token.startsWith("'") ? 'message-thought' : 'message-tag';
    nodes.push(<span className={className} key={`m-${match.index}`}>{token}</span>);
    lastIndex = match.index + token.length;
  }
  if (lastIndex < content.length) {
    nodes.push(<span key={`t-${lastIndex}`}>{content.slice(lastIndex)}</span>);
  }
  return <p>{nodes}</p>;
}

function extractModelNames(rawModels: unknown): string[] {
  if (!rawModels || typeof rawModels !== 'object') {
    return [];
  }
  const maybeData = rawModels as { data?: unknown };
  const list = Array.isArray(maybeData.data) ? maybeData.data : Array.isArray(rawModels) ? rawModels : [];
  return list
    .map((item) => typeof item === 'string' ? item : typeof item === 'object' && item && 'id' in item ? String((item as { id: unknown }).id) : '')
    .filter(Boolean);
}

function isObjectRecord(value: unknown): value is RawPreset {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parsePresetDraft(value: string): RawPreset | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function numberField(value: unknown, fallback: number): number {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function numberInputText(value: unknown, fallback: number): string {
  if (value === '' || value === '-' || value === '.' || value === '-.') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  return String(fallback);
}

function parseNumberInput(value: string): number | string {
  if (value === '' || value === '-' || value === '.' || value === '-.') {
    return value;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : value;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function approxTokens(value: string): number {
  return Math.ceil(value.length / 4);
}

function csvFromArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return csvToArray(value);
  }
  return [];
}

function csvToArray(value: string): string[] {
  return value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
}

function lorebookEntriesFromBook(book: RawPreset): RawPreset[] {
  const entries = isObjectRecord(book.entries) ? book.entries : {};
  return Object.values(entries)
    .filter(isObjectRecord)
    .sort((left, right) => numberField(left.displayIndex, numberField(left.uid, 0)) - numberField(right.displayIndex, numberField(right.uid, 0)));
}

function nextLorebookUid(entries: RawPreset): number {
  const used = Object.values(entries).filter(isObjectRecord).map((entry) => numberField(entry.uid, -1));
  return Math.max(-1, ...used) + 1;
}

function lorebookPositionLabel(value: unknown): string {
  const labels: Record<string, string> = {
    '0': '↑Char',
    '1': '↓Char',
    '2': '↑AN',
    '3': '↓AN',
    '4': '@Depth',
    '5': '↑EM',
    '6': '↓EM',
    '7': 'Outlet',
  };
  return labels[String(value ?? 0)] || '↑Char';
}

function normalizePromptOrder(rawOrder: unknown): PromptOrderItem[] {
  if (!Array.isArray(rawOrder)) {
    return [];
  }
  const preferredOrder = rawOrder.find((entry) => isObjectRecord(entry) && String(entry.character_id) === String(OPENAI_PROMPT_ORDER_CHARACTER_ID) && Array.isArray(entry.order));
  const firstOrder = preferredOrder || rawOrder.find((entry) => isObjectRecord(entry) && Array.isArray(entry.order));
  const order = isObjectRecord(firstOrder) && Array.isArray(firstOrder.order) ? firstOrder.order : [];
  return order
    .filter(isObjectRecord)
    .map((entry) => ({ identifier: String(entry.identifier || ''), enabled: entry.enabled !== false }))
    .filter((entry) => entry.identifier);
}

function updateOpenAiPromptOrder(rawOrder: unknown, nextOrder: PromptOrderItem[]): RawPreset[] {
  const promptOrder = Array.isArray(rawOrder) ? [...rawOrder] : [];
  const preferredIndex = promptOrder.findIndex((entry) => isObjectRecord(entry) && String(entry.character_id) === String(OPENAI_PROMPT_ORDER_CHARACTER_ID) && Array.isArray(entry.order));
  const firstIndex = promptOrder.findIndex((entry) => isObjectRecord(entry) && Array.isArray(entry.order));
  const targetIndex = preferredIndex >= 0 ? preferredIndex : firstIndex;
  const normalizedOrder = nextOrder.map((item) => ({ identifier: item.identifier, enabled: item.enabled }));

  if (targetIndex >= 0 && isObjectRecord(promptOrder[targetIndex])) {
    promptOrder[targetIndex] = { ...promptOrder[targetIndex], order: normalizedOrder };
  } else {
    promptOrder.push({ character_id: OPENAI_PROMPT_ORDER_CHARACTER_ID, order: normalizedOrder });
  }

  return promptOrder.filter(isObjectRecord);
}

function buildFullPromptOrder(preset: RawPreset): PromptOrderItem[] {
  const order = normalizePromptOrder(preset.prompt_order);
  const prompts = Array.isArray(preset.prompts) ? preset.prompts.filter(isObjectRecord) as OpenAiPrompt[] : [];
  const knownIds = new Set(order.map((item) => item.identifier));
  const missing = prompts
    .map((prompt) => String(prompt.identifier || ''))
    .filter((identifier) => identifier && !knownIds.has(identifier))
    .map((identifier) => ({ identifier, enabled: true }));
  return [...order, ...missing];
}

function removePromptFromAllOrders(rawOrder: unknown, identifier: string): RawPreset[] {
  if (!Array.isArray(rawOrder)) {
    return [];
  }
  return rawOrder
    .filter(isObjectRecord)
    .map((entry) => Array.isArray(entry.order)
      ? { ...entry, order: entry.order.filter((item) => !isObjectRecord(item) || String(item.identifier || '') !== identifier) }
      : entry);
}

function orderedOpenAiPrompts(preset: RawPreset): Array<{ prompt: OpenAiPrompt; enabled: boolean }> {
  const prompts = Array.isArray(preset.prompts) ? preset.prompts.filter(isObjectRecord) as OpenAiPrompt[] : [];
  const order = normalizePromptOrder(preset.prompt_order);
  const ordered = order
    .map((orderItem) => {
      const prompt = prompts.find((item) => String(item.identifier || '') === orderItem.identifier);
      return prompt ? { prompt, enabled: orderItem.enabled } : null;
    })
    .filter((item): item is { prompt: OpenAiPrompt; enabled: boolean } => Boolean(item));
  const orderedIds = new Set(ordered.map((item) => String(item.prompt.identifier || '')));
  const rest = prompts
    .filter((prompt) => !orderedIds.has(String(prompt.identifier || '')))
    .map((prompt) => ({ prompt, enabled: true }));
  return [...ordered, ...rest];
}

function promptTriggerValues(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function SliderField({
  label,
  value,
  fallback,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: unknown;
  fallback: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number | string) => void;
}) {
  const rangeValue = clampNumber(numberField(value, fallback), min, max);
  return (
    <label className="slider-field">
      <span>{label}</span>
      <div>
        <input type="range" min={min} max={max} step={step} value={rangeValue} onChange={(event) => onChange(Number(event.target.value))} />
        <input type="number" min={min} max={max} step={step} value={numberInputText(value, fallback)} onChange={(event) => onChange(parseNumberInput(event.target.value))} />
      </div>
    </label>
  );
}

function NumberInputField({ label, value, fallback, min, max, step, onChange }: { label: string; value: unknown; fallback: number; min?: number; max?: number; step?: number; onChange: (value: number | string) => void }) {
  return (
    <label className="field-preview">
      <span>{label}</span>
      <input type="number" min={min} max={max} step={step} value={numberInputText(value, fallback)} onChange={(event) => onChange(parseNumberInput(event.target.value))} />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="field-preview">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option value={option} key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function SelectChoicesField({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return (
    <label className="field-preview">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => <option value={optionValue} key={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function CheckboxGroupField({ label, values, options, onChange }: { label: string; values: string[]; options: string[]; onChange: (values: string[]) => void }) {
  const selected = new Set(values);
  return (
    <div className="checkbox-group-field">
      <span>{label}</span>
      <div>
        {options.map((option) => (
          <label key={option}>
            <input
              type="checkbox"
              checked={selected.has(option)}
              onChange={(event) => {
                const next = new Set(selected);
                event.target.checked ? next.add(option) : next.delete(option);
                onChange(Array.from(next));
              }}
            />
            <small>{option}</small>
          </label>
        ))}
      </div>
    </div>
  );
}

function PromptOptionRow({ title, text, checked, onChange }: { title: string; text: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="prompt-option-row">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
    </label>
  );
}

function SegmentedControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="segmented-row">
      <span>{label}</span>
      <div className="segmented-control">
        {options.map(([optionValue, optionLabel]) => (
          <button
            className={value === optionValue ? 'segment active' : 'segment'}
            key={optionValue}
            type="button"
            onClick={() => onChange(optionValue)}
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button className={checked ? 'toggle-row active' : 'toggle-row'} type="button" onClick={() => onChange(!checked)}>
      <span>{label}</span>
      <i aria-hidden="true" />
    </button>
  );
}

function PanelHeading({ label }: { label: string }) {
  return (
    <header className="panel-heading">
      <strong>{label}</strong>
    </header>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    sliders: (
      <>
        <path d="M4 7h7" />
        <path d="M15 7h5" />
        <path d="M4 17h5" />
        <path d="M13 17h7" />
        <circle cx="13" cy="7" r="2" />
        <circle cx="11" cy="17" r="2" />
      </>
    ),
    plug: (
      <>
        <path d="M9 3v5" />
        <path d="M15 3v5" />
        <path d="M7 8h10v4a5 5 0 0 1-10 0V8Z" />
        <path d="M12 17v4" />
      </>
    ),
    palette: (
      <>
        <path d="M12 3a9 9 0 0 0 0 18h1.2a2.2 2.2 0 0 0 1.4-3.9l-.5-.4a1.4 1.4 0 0 1 .9-2.5h1.2A4.8 4.8 0 0 0 21 9.4C21 5.9 17 3 12 3Z" />
        <circle cx="8" cy="10" r="1" />
        <circle cx="11" cy="7" r="1" />
        <circle cx="15" cy="8" r="1" />
      </>
    ),
    bot: (
      <>
        <path d="M12 4v3" />
        <rect x="5" y="7" width="14" height="11" rx="3" />
        <path d="M9 12h.01" />
        <path d="M15 12h.01" />
        <path d="M9 16h6" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    card: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M8 8h8" />
        <path d="M8 12h8" />
        <path d="M8 16h5" />
      </>
    ),
    book: (
      <>
        <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z" />
        <path d="M8 4v16" />
        <path d="M11 8h5" />
        <path d="M11 12h4" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        <path d="M12 14v2" />
      </>
    ),
    menu: (
      <>
        <path d="M5 7h14" />
        <path d="M5 12h14" />
        <path d="M5 17h14" />
      </>
    ),
    send: (
      <>
        <path d="M4 12 20 4l-4 16-3-7-9-1Z" />
        <path d="m13 13 7-9" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M6 7l1 14h10l1-14" />
        <path d="M9 7V4h6v3" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    eyeOff: (
      <>
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6A3 3 0 0 0 13.4 13.4" />
        <path d="M9.9 5.3A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a16.1 16.1 0 0 1-3.1 4.2" />
        <path d="M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.1-.9" />
      </>
    ),
    check: (
      <>
        <path d="M20 6 9 17l-5-5" />
      </>
    ),
    x: (
      <>
        <path d="M18 6 6 18" />
        <path d="M6 6l12 12" />
      </>
    ),
  };

  return (
    <svg className={`icon icon-${name}`} viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="field-preview">
      <span>{label}</span>
      <input value={value} readOnly />
    </label>
  );
}

function EditableField({ label, value, type = 'text', onChange }: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return (
    <label className="field-preview">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({ label, value }: { label: string; value: string }) {
  return (
    <label className="field-preview">
      <span>{label}</span>
      <textarea value={value} readOnly />
    </label>
  );
}

function EditableTextArea({ label, value, disabled = false, onChange }: { label: string; value: string; disabled?: boolean; onChange: (value: string) => void }) {
  return (
    <label className="field-preview">
      <span>{label}</span>
      <textarea value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TwoColumns({ left, right }: { left: ReactNode; right: ReactNode }) {
  return <div className="two-columns">{left}{right}</div>;
}

function Option({ title, text, active = false }: { title: string; text: string; active?: boolean }) {
  return (
    <article className={active ? 'option-card active' : 'option-card'}>
      <strong>{title}</strong>
      <span>{text}</span>
    </article>
  );
}

function CharacterCardView({ active = false, editing = false, card, onSelect, onEdit, onDelete, openImagePreview, imageSrc = (src) => src }: { active?: boolean; editing?: boolean; card: CharacterCard; onSelect?: (card: CharacterCard) => Promise<void>; onEdit?: (card: CharacterCard) => void; onDelete?: (card: CharacterCard) => Promise<void>; openImagePreview?: (src: string, title: string) => void; imageSrc?: (src: string) => string }) {
  return (
    <article className={`${active ? 'character-card-view active' : 'character-card-view'}${editing ? ' editing' : ''}`}>
      <button className="avatar-preview-button card-image-button" type="button" onClick={() => openImagePreview?.(card.image_url, card.name)}><img src={imageSrc(card.image_url)} alt="" loading="lazy" /></button>
      <div>
        <strong>{card.name}</strong>
        <small>{card.spec || 'legacy'} {card.spec_version}</small>
        <p>{card.description || card.first_message || 'Описание отсутствует.'}</p>
        {card.tags.length ? <span>{card.tags.slice(0, 4).join(', ')}</span> : null}
        <div className="card-row-actions">
          {onSelect ? <button type="button" onClick={() => void onSelect(card)}>{active ? 'Открыта' : 'Открыть'}</button> : null}
          {onEdit ? <button className="ghost-button" type="button" onClick={() => onEdit(card)}>{editing ? 'Правится' : 'Править'}</button> : null}
          {onDelete ? <button className="ghost-button danger-button" type="button" onClick={() => void onDelete(card)}>Удалить</button> : null}
        </div>
      </div>
    </article>
  );
}

function EmptyLibrary({ text }: { text: string }) {
  return <p className="empty-library">{text}</p>;
}

function AccessDeniedNotice() {
  return <p className="empty-library access-denied">{accessDeniedText}</p>;
}
