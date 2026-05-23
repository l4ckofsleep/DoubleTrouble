import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  type MagicTranslationSettings,
  type AutoMode,
  type PromptPreset,
  type ConnectionProfile,
  languageCodes,
  loadMagicTranslationSettings,
  saveMagicTranslationSettings,
  getDefaultSettings,
} from './magicTranslationEngine';

const AUTO_MODE_OPTIONS: { value: AutoMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'responses', label: 'Translate responses' },
  { value: 'inputs', label: 'Translate inputs' },
  { value: 'both', label: 'Translate both' },
];

const PROVIDERS = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'claude', label: 'Claude (Anthropic)' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'google', label: 'Google Gemini' },
  { id: 'groq', label: 'Groq' },
  { id: 'mistral', label: 'Mistral' },
  { id: 'cohere', label: 'Cohere' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'xai', label: 'xAI (Grok)' },
  { id: 'perplexity', label: 'Perplexity' },
  { id: 'custom', label: 'Custom (OpenAI-compatible)' },
  { id: 'oobabooga', label: 'Text Generation WebUI (oobabooga)' },
  { id: 'tabbyapi', label: 'TabbyAPI' },
  { id: 'koboldcpp', label: 'KoboldCPP' },
  { id: 'llamacpp', label: 'llama.cpp' },
  { id: 'openai_compatible', label: 'OpenAI-compatible' },
  { id: 'novelai', label: 'NovelAI' },
  { id: 'ai21', label: 'AI21' },
  { id: 'dreamgen', label: 'DreamGen' },
  { id: 'minimax', label: 'MiniMax' },
];

function PresetSelect({
  presets,
  activePreset,
  onChange,
  onCreate,
  onRename,
  onDelete,
}: {
  presets: Record<string, PromptPreset>;
  activePreset: string;
  onChange: (name: string) => void;
  onCreate: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (name: string) => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameTarget, setRenameTarget] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createValue, setCreateValue] = useState('');
  const names = Object.keys(presets);

  return (
    <div className="magic-translation-preset-manager">
      <select value={activePreset} onChange={(e) => onChange(e.target.value)}>
        {names.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
      <div className="preset-actions">
        <button className="ghost-button tiny-button" type="button" onClick={() => { setIsCreating(true); setCreateValue(''); }}>
          New
        </button>
        <button className="ghost-button tiny-button" type="button" disabled={activePreset === 'default'} onClick={() => { setIsRenaming(true); setRenameTarget(activePreset); setRenameValue(activePreset); }}>
          Rename
        </button>
        <button className="ghost-button tiny-button danger-button" type="button" disabled={activePreset === 'default'} onClick={() => onDelete(activePreset)}>
          Delete
        </button>
      </div>
      {isCreating && (
        <div className="regex-editor-overlay">
          <div className="regex-editor-panel">
            <h3>New Preset</h3>
            <input value={createValue} placeholder="Preset name" onChange={(e) => setCreateValue(e.target.value)} />
            <div className="regex-editor-actions">
              <button type="button" onClick={() => { onCreate(createValue.trim()); setIsCreating(false); }}>Create</button>
              <button type="button" className="ghost-button" onClick={() => setIsCreating(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {isRenaming && (
        <div className="regex-editor-overlay">
          <div className="regex-editor-panel">
            <h3>Rename Preset</h3>
            <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
            <div className="regex-editor-actions">
              <button type="button" onClick={() => { onRename(renameTarget, renameValue.trim()); setIsRenaming(false); }}>Rename</button>
              <button type="button" className="ghost-button" onClick={() => setIsRenaming(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileManager({
  profiles,
  activeProfile,
  onChange,
  onCreate,
  onRename,
  onDelete,
  onUpdate,
}: {
  profiles: Record<string, ConnectionProfile>;
  activeProfile: string;
  onChange: (name: string) => void;
  onCreate: (name: string, profile: ConnectionProfile) => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (name: string) => void;
  onUpdate: (name: string, patch: Partial<ConnectionProfile>) => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameTarget, setRenameTarget] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createValue, setCreateValue] = useState('');
  const names = Object.keys(profiles);
  const profile = activeProfile ? profiles[activeProfile] : undefined;

  return (
    <div className="magic-translation-profile-section">
      <div className="magic-translation-preset-manager">
        <select value={activeProfile} onChange={(e) => onChange(e.target.value)}>
          <option value="">Use main connection</option>
          {names.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <div className="preset-actions">
          <button className="ghost-button tiny-button" type="button" onClick={() => { setIsCreating(true); setCreateValue(''); }}>New</button>
          <button className="ghost-button tiny-button" type="button" disabled={!activeProfile} onClick={() => { setIsRenaming(true); setRenameTarget(activeProfile); setRenameValue(activeProfile); }}>Rename</button>
          <button className="ghost-button tiny-button danger-button" type="button" disabled={!activeProfile} onClick={() => onDelete(activeProfile)}>Delete</button>
        </div>
      </div>
      {profile && (
        <div className="magic-translation-profile-fields" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem' }}>
          <label>
            Provider
            <select value={profile.provider} onChange={(e) => onUpdate(activeProfile, { provider: e.target.value })}>
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </label>
          <label>
            Base URL
            <input type="text" value={profile.baseUrl} onChange={(e) => onUpdate(activeProfile, { baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" />
          </label>
          <label>
            Model
            <input type="text" value={profile.model} onChange={(e) => onUpdate(activeProfile, { model: e.target.value })} placeholder="gpt-4o-mini" />
          </label>
          <label>
            API Key
            <input type="password" value={profile.apiKey} onChange={(e) => onUpdate(activeProfile, { apiKey: e.target.value })} placeholder="sk-..." />
          </label>
          <label>
            Temperature
            <input type="number" step={0.1} min={0} max={2} value={profile.temperature} onChange={(e) => onUpdate(activeProfile, { temperature: Number(e.target.value) })} />
          </label>
          <label>
            Max Tokens
            <input type="number" min={1} max={8192} value={profile.maxTokens} onChange={(e) => onUpdate(activeProfile, { maxTokens: Number(e.target.value) })} />
          </label>
          <label>
            Timeout (seconds)
            <input type="number" step={1} min={5} max={300} value={profile.timeoutSeconds} onChange={(e) => onUpdate(activeProfile, { timeoutSeconds: Number(e.target.value) })} />
          </label>
        </div>
      )}
      {isCreating && (
        <div className="regex-editor-overlay">
          <div className="regex-editor-panel">
            <h3>New Profile</h3>
            <input value={createValue} placeholder="Profile name" onChange={(e) => setCreateValue(e.target.value)} />
            <div className="regex-editor-actions">
              <button type="button" onClick={() => {
                const name = createValue.trim();
                if (name) {
                  onCreate(name, { name, provider: 'openai', baseUrl: '', model: '', apiKey: '', temperature: 0.3, maxTokens: 4096, timeoutSeconds: 60 });
                }
                setIsCreating(false);
              }}>Create</button>
              <button type="button" className="ghost-button" onClick={() => setIsCreating(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {isRenaming && (
        <div className="regex-editor-overlay">
          <div className="regex-editor-panel">
            <h3>Rename Profile</h3>
            <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
            <div className="regex-editor-actions">
              <button type="button" onClick={() => { onRename(renameTarget, renameValue.trim()); setIsRenaming(false); }}>Rename</button>
              <button type="button" className="ghost-button" onClick={() => setIsRenaming(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MagicTranslationSettings() {
  const [settings, setSettingsState] = useState<MagicTranslationSettings>(loadMagicTranslationSettings);

  const setSettings = useCallback((next: MagicTranslationSettings | ((prev: MagicTranslationSettings) => MagicTranslationSettings)) => {
    setSettingsState((prev) => {
      const updated = typeof next === 'function' ? next(prev) : next;
      saveMagicTranslationSettings(updated);
      return updated;
    });
  }, []);

  const currentPreset = settings.promptPresets[settings.promptPreset];

  const updatePreset = (patch: Partial<PromptPreset>) => {
    setSettings((prev) => ({
      ...prev,
      promptPresets: {
        ...prev.promptPresets,
        [prev.promptPreset]: { ...prev.promptPresets[prev.promptPreset], ...patch },
      },
    }));
  };

  const createPreset = (name: string) => {
    if (!name || settings.promptPresets[name]) return;
    const base = settings.promptPresets[settings.promptPreset];
    setSettings((prev) => ({
      ...prev,
      promptPreset: name,
      promptPresets: { ...prev.promptPresets, [name]: { content: base.content, filterCodeBlock: base.filterCodeBlock } },
    }));
  };

  const renamePreset = (oldName: string, newName: string) => {
    if (!newName || oldName === newName || settings.promptPresets[newName]) return;
    setSettings((prev) => {
      const nextPresets = { ...prev.promptPresets };
      nextPresets[newName] = nextPresets[oldName];
      delete nextPresets[oldName];
      return { ...prev, promptPreset: prev.promptPreset === oldName ? newName : prev.promptPreset, promptPresets: nextPresets };
    });
  };

  const deletePreset = (name: string) => {
    if (name === 'default') return;
    setSettings((prev) => {
      const nextPresets = { ...prev.promptPresets };
      delete nextPresets[name];
      return { ...prev, promptPreset: prev.promptPreset === name ? 'default' : prev.promptPreset, promptPresets: nextPresets };
    });
  };

  const createProfile = (name: string, profile: ConnectionProfile) => {
    if (!name || settings.connectionProfiles[name]) return;
    setSettings((prev) => ({
      ...prev,
      activeProfile: name,
      connectionProfiles: { ...prev.connectionProfiles, [name]: profile },
    }));
  };

  const renameProfile = (oldName: string, newName: string) => {
    if (!newName || oldName === newName || settings.connectionProfiles[newName]) return;
    setSettings((prev) => {
      const nextProfiles = { ...prev.connectionProfiles };
      nextProfiles[newName] = nextProfiles[oldName];
      delete nextProfiles[oldName];
      return { ...prev, activeProfile: prev.activeProfile === oldName ? newName : prev.activeProfile, connectionProfiles: nextProfiles };
    });
  };

  const deleteProfile = (name: string) => {
    setSettings((prev) => {
      const nextProfiles = { ...prev.connectionProfiles };
      delete nextProfiles[name];
      return { ...prev, activeProfile: prev.activeProfile === name ? '' : prev.activeProfile, connectionProfiles: nextProfiles };
    });
  };

  const updateProfile = (name: string, patch: Partial<ConnectionProfile>) => {
    setSettings((prev) => ({
      ...prev,
      connectionProfiles: {
        ...prev.connectionProfiles,
        [name]: { ...prev.connectionProfiles[name], ...patch },
      },
    }));
  };

  return (
    <div className="magic-translation-settings">
      <div className="magic-translation-settings-header">
        <h3>Magic Translation</h3>
        <p className="helper-text">Translate chat messages using your configured LLM.</p>
      </div>

      <label>
        Target Language
        <select value={settings.targetLanguage} onChange={(e) => setSettings({ ...settings, targetLanguage: e.target.value })}>
          {Object.entries(languageCodes).map(([name, code]) => (
            <option value={code} key={code}>{name}</option>
          ))}
        </select>
      </label>

      <label>
        Auto Mode
        <select value={settings.autoMode} onChange={(e) => setSettings({ ...settings, autoMode: e.target.value as AutoMode })}>
          {AUTO_MODE_OPTIONS.map((opt) => (
            <option value={opt.value} key={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      <label>
        Internal Language (for outgoing translation)
        <select value={settings.internalLanguage} onChange={(e) => setSettings({ ...settings, internalLanguage: e.target.value })}>
          {Object.entries(languageCodes).map(([name, code]) => (
            <option value={code} key={code}>{name}</option>
          ))}
        </select>
      </label>

      <div className="magic-translation-preset-section">
        <label>Connection Profile</label>
        <ProfileManager
          profiles={settings.connectionProfiles}
          activeProfile={settings.activeProfile}
          onChange={(name) => setSettings({ ...settings, activeProfile: name })}
          onCreate={createProfile}
          onRename={renameProfile}
          onDelete={deleteProfile}
          onUpdate={updateProfile}
        />
      </div>

      <div className="magic-translation-preset-section">
        <label>Prompt Preset</label>
        <PresetSelect
          presets={settings.promptPresets}
          activePreset={settings.promptPreset}
          onChange={(name) => setSettings({ ...settings, promptPreset: name })}
          onCreate={createPreset}
          onRename={renamePreset}
          onDelete={deletePreset}
        />
      </div>

      <label>
        <div className="title-restorable">
          Prompt
          <button className="ghost-button tiny-button" type="button" onClick={() => {
            if (window.confirm('Restore default prompt?')) {
              updatePreset({ content: getDefaultSettings().promptPresets.default.content });
            }
          }}>
            Restore Default
          </button>
        </div>
        <textarea
          className="magic-translation-prompt"
          rows={6}
          value={currentPreset?.content || ''}
          onChange={(e) => updatePreset({ content: e.target.value })}
        />
      </label>

      <label className="checkbox_label">
        <input
          type="checkbox"
          checked={currentPreset?.filterCodeBlock ?? true}
          onChange={(e) => updatePreset({ filterCodeBlock: e.target.checked })}
        />
        Filter Code Block: extract text between ``` marks
      </label>
    </div>
  );
}

export function MagicTranslationSettingsPortal() {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(document.getElementById('extensions_settings'));
  }, []);

  if (!host) {
    return null;
  }

  return createPortal(
    <div className="magic-translation-settings image-extension-settings-portal" data-dt-extension-owner="magic-translation">
      <MagicTranslationSettings />
    </div>,
    host,
  );
}
