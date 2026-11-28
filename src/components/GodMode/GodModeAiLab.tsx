import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Activity,
  BookmarkPlus,
  BrainCircuit,
  ClipboardCopy,
  Cpu,
  Download,
  History,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  GOD_MODE_I18N,
  GodModeLang,
  fmtGodDateTime,
  fmtGodNumber,
} from '../../engine/godModeI18n';
import {
  AiBudgetState,
  AiHealthStatus,
  AiHistoryEntry,
  CustomModelPreset,
  GOD_MODE_AI_MODELS,
  GOD_MODE_FLAGS_EVENT,
  GodModeAiModelId,
  GodModeThinkingLevel,
  PromptVersionEntry,
  checkAiProviderHealth,
  isGodModeFlagEnabled,
  loadAiBudget,
  loadAiHistory,
  loadAiPresets,
  loadPromptVersions,
  runGodModeAiPrompt,
  saveAiBudget,
  saveAiHistory,
  saveAiPresets,
  savePromptVersions,
} from '../../engine/godModeExtended';
import {OwnerSecurityState} from '../../engine/godModeSecurity';
import type {GodModeModuleId} from './GodModeShell';

interface GodModeAiLabProps {
  lang: GodModeLang;
  security: OwnerSecurityState;
  onSelectModule: (id: GodModeModuleId) => void;
  onShowToast?: (msg: string) => void;
}

type AiLabTab = 'studio' | 'models' | 'history';

export const GodModeAiLab: React.FC<GodModeAiLabProps> = ({
  lang,
  security,
  onSelectModule,
  onShowToast,
}) => {
  const t = GOD_MODE_I18N[lang];
  const [tab, setTab] = useState<AiLabTab>('studio');
  const [presets, setPresets] = useState<CustomModelPreset[]>(() => loadAiPresets());
  const [selectedPresetId, setSelectedPresetId] = useState<string>(presets[0]?.id ?? 'preset_balanced');
  const [model, setModel] = useState<GodModeAiModelId>('gemini-4-hydrogen');
  const [thinking, setThinking] = useState<GodModeThinkingLevel>('LOW');
  const [temperature, setTemperature] = useState<number>(0.4);
  const [maxOutputTokens, setMaxOutputTokens] = useState<number>(2048);
  const [responseMimeType, setResponseMimeType] = useState<'text/plain' | 'application/json'>(() =>
    isGodModeFlagEnabled('gm_ai_structured_json') ? 'application/json' : 'text/plain'
  );
  useEffect(() => {
    const syncFlag = () => {
      setResponseMimeType(
        isGodModeFlagEnabled('gm_ai_structured_json') ? 'application/json' : 'text/plain'
      );
    };
    window.addEventListener(GOD_MODE_FLAGS_EVENT, syncFlag);
    return () => window.removeEventListener(GOD_MODE_FLAGS_EVENT, syncFlag);
  }, []);
  const [timeoutMs, setTimeoutMs] = useState<number>(25000);
  const [systemInstruction, setSystemInstruction] = useState('');
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AiHistoryEntry[]>(() => loadAiHistory());
  const [latest, setLatest] = useState<AiHistoryEntry | null>(() => loadAiHistory()[0] ?? null);
  const [versions, setVersions] = useState<PromptVersionEntry[]>(() => loadPromptVersions());
  const [budget, setBudget] = useState<AiBudgetState>(() => loadAiBudget());
  const [health, setHealth] = useState<AiHealthStatus | null>(null);
  const [testingHealth, setTestingHealth] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const selectedSpec = useMemo(
    () => GOD_MODE_AI_MODELS.find((m) => m.id === model) ?? GOD_MODE_AI_MODELS[0],
    [model]
  );

  const isVerified = security.mode === 'server_verified';
  const remainingTokens = Math.max(0, budget.capTokens - budget.usedTokens);
  const budgetExceeded = budget.usedTokens >= budget.capTokens;

  const handleApplyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const p = presets.find((item) => item.id === presetId);
    if (!p) return;
    setModel(p.baseModel);
    setTemperature(p.temperature);
    setMaxOutputTokens(p.maxOutputTokens);
    setThinking(p.thinkingLevel);
    setResponseMimeType(p.responseMimeType);
    setTimeoutMs(p.timeoutMs);
  };

  const handleSaveCustomPreset = () => {
    const clean = presetNameInput.trim();
    if (!clean) return;
    const item: CustomModelPreset = {
      id: `preset_${Date.now().toString(36)}`,
      name: clean,
      baseModel: model,
      temperature,
      maxOutputTokens,
      thinkingLevel: thinking,
      responseMimeType,
      timeoutMs,
    };
    const next = [item, ...presets].slice(0, 12);
    setPresets(next);
    saveAiPresets(next);
    setSelectedPresetId(item.id);
    setPresetNameInput('');
  };

  const handleHealthTest = async (liveTest = true) => {
    if (testingHealth) return;
    setTestingHealth(true);
    setError(null);
    const res = await checkAiProviderHealth(liveTest);
    setTestingHealth(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setHealth(res.health);
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleRun = async (overridePrompt?: string) => {
    const textToSend = (overridePrompt ?? prompt).trim();
    if (!textToSend || running) return;
    if (budgetExceeded) {
      setError(t.aiLab.budgetExceeded);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);

    setRunning(true);
    setError(null);
    const res = await runGodModeAiPrompt(
      {
        model,
        prompt: textToSend,
        systemInstruction: systemInstruction.trim() || undefined,
        thinkingLevel: selectedSpec.supportsThinking ? thinking : undefined,
        temperature,
        maxOutputTokens,
        responseMimeType,
        timeoutMs,
      },
      controller.signal
    );
    window.clearTimeout(timer);
    abortRef.current = null;
    setRunning(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    const nextBudget: AiBudgetState = {
      capTokens: budget.capTokens,
      usedTokens: budget.usedTokens + (res.usage.totalTokens || 0),
    };
    setBudget(nextBudget);
    saveAiBudget(nextBudget);

    const entry: AiHistoryEntry = {
      id: `ai_${Date.now().toString(36)}`,
      ts: new Date().toISOString(),
      model: res.model,
      thinkingLevel: selectedSpec.supportsThinking ? thinking : undefined,
      prompt: textToSend,
      response: res.text,
      latencyMs: res.latencyMs,
      usage: res.usage,
    };
    const next = [entry, ...history].slice(0, 30);
    setHistory(next);
    setLatest(entry);
    saveAiHistory(next);
  };

  const handleSavePromptVersion = () => {
    if (!prompt.trim()) return;
    const nextVer: PromptVersionEntry = {
      id: `pv_${Date.now().toString(36)}`,
      label: `v${versions.length + 1} · ${prompt.trim().slice(0, 26)}`,
      ts: new Date().toISOString(),
      model,
      systemInstruction: systemInstruction.trim(),
      prompt: prompt.trim(),
    };
    const next = [nextVer, ...versions].slice(0, 30);
    setVersions(next);
    savePromptVersions(next);
  };

  const handleExportVersions = () => {
    const blob = new Blob([JSON.stringify(versions, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `morph-prompt-versions-${Date.now()}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleImportVersions = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) return;
      const valid = parsed.filter(
        (v) => v && typeof v.id === 'string' && typeof v.prompt === 'string'
      ) as PromptVersionEntry[];
      const merged = [...valid, ...versions].slice(0, 30);
      setVersions(merged);
      savePromptVersions(merged);
    } catch {
      // Ignore malformed file
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    onShowToast?.(t.aiLab.copiedToast);
  };

  const handleClearHistory = () => {
    setHistory([]);
    setLatest(null);
    saveAiHistory([]);
  };

  const tabs: ReadonlyArray<{id: AiLabTab; label: string; icon: React.FC<{className?: string}>}> = [
    {id: 'studio', label: t.aiLab.studioTab, icon: Sparkles},
    {id: 'models', label: t.aiLab.modelsTab, icon: Cpu},
    {id: 'history', label: t.aiLab.historyTab, icon: History},
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h2 className="text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>
          {t.aiLab.title}
        </h2>
        <div
          className="flex items-center gap-1 rounded-xl p-1"
          style={{background: 'var(--gm-inset)', border: '1px solid var(--gm-border)'}}
        >
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                title={item.label}
                className={`flex min-h-[38px] items-center justify-center text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
                  active ? 'gm-nav-icon-active gap-1.5 px-3' : 'w-10 px-0 hover:bg-white/[0.04]'
                }`}
                style={active ? undefined : {color: 'var(--gm-muted)'}}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {active && <span>{item.label}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {!isVerified && (
        <div
          className="gm-card flex flex-wrap items-center justify-between gap-3 p-3.5"
          style={{borderColor: 'rgba(245, 158, 11, 0.35)'}}
        >
          <div className="flex items-center gap-2 text-xs text-amber-300">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{t.aiLab.authNeeded}</span>
          </div>
          <button
            type="button"
            onClick={() => onSelectModule('security_center')}
            className="gm-btn-primary min-h-[38px] px-3 text-xs font-semibold whitespace-nowrap"
          >
            {t.aiLab.openSecurity}
          </button>
        </div>
      )}

      {/* Provider Health & Execution Token Budget Strip */}
      <div className="gm-card grid grid-cols-1 gap-3 p-3.5 md:grid-cols-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
              <Activity className="h-3.5 w-3.5" style={{color: 'var(--gm-accent)'}} />
              <span>{health?.provider ?? 'Google GenAI'}</span>
            </div>
            <div className="gm-mono mt-0.5 text-[11px]" style={{color: 'var(--gm-muted)'}}>
              {health
                ? `${health.reachable ? t.aiLab.providerOnline : t.aiLab.providerOffline}${
                    health.latencyMs !== null ? ` · ${health.latencyMs} ms` : ''
                  }`
                : '—'}
            </div>
          </div>
          <button
            type="button"
            disabled={testingHealth || !isVerified}
            onClick={() => void handleHealthTest(true)}
            className="gm-btn-ghost inline-flex min-h-[38px] items-center gap-1.5 px-3 text-xs font-semibold disabled:opacity-45"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${testingHealth ? 'animate-spin' : ''}`} />
            <span>{t.aiLab.healthTestBtn}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2.5 md:border-l md:border-t-0 md:pl-3 md:pt-0" style={{borderColor: 'var(--gm-border)'}}>
          <div className="min-w-0">
            <div className="text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
              {t.aiLab.budgetTitle}:{' '}
              <span className={`gm-mono ${budgetExceeded ? 'text-rose-400' : 'text-emerald-400'}`}>
                {fmtGodNumber(remainingTokens, lang)} {t.aiLab.budgetRemaining}
              </span>
            </div>
            <div className="gm-mono mt-0.5 text-[10px]" style={{color: 'var(--gm-muted)'}}>
              {fmtGodNumber(budget.usedTokens, lang)} / {fmtGodNumber(budget.capTokens, lang)}
            </div>
          </div>
          <label className="flex items-center gap-1.5 text-[11px]" style={{color: 'var(--gm-muted)'}}>
            <span>{t.aiLab.budgetCapLabel}</span>
            <input
              type="number"
              min={1000}
              step={5000}
              value={budget.capTokens}
              onChange={(e) => {
                const cap = Math.max(1000, Number(e.target.value) || 1000);
                const next = {...budget, capTokens: cap};
                setBudget(next);
                saveAiBudget(next);
              }}
              className="gm-inset gm-mono min-h-[34px] w-24 px-2 text-xs outline-none"
              style={{color: 'var(--gm-ink)'}}
            />
          </label>
        </div>
      </div>

      {tab === 'studio' && (
        <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1.05fr_1fr]">
          {/* Prompt Composer */}
          <div className="gm-card min-w-0 space-y-3 p-4">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold" style={{color: 'var(--gm-muted)'}}>
                  {t.aiLab.presetsLabel}
                </span>
                <select
                  value={selectedPresetId}
                  onChange={(e) => handleApplyPreset(e.target.value)}
                  className="gm-inset w-full min-h-[40px] px-3 text-xs font-semibold outline-none"
                  style={{color: 'var(--gm-ink)'}}
                >
                  {presets.map((p) => (
                    <option key={p.id} value={p.id} className="bg-zinc-950 text-white">
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-semibold" style={{color: 'var(--gm-muted)'}}>
                  {t.aiLab.modelLabel}
                </span>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value as GodModeAiModelId)}
                  className="gm-inset w-full min-h-[40px] px-3 text-xs font-semibold outline-none"
                  style={{color: 'var(--gm-ink)'}}
                >
                  {GOD_MODE_AI_MODELS.map((m) => (
                    <option key={m.id} value={m.id} className="bg-zinc-950 text-white">
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="space-y-1">
                <span className="text-[10px] font-semibold" style={{color: 'var(--gm-muted)'}}>
                  {t.aiLab.temperatureLabel}: {temperature}
                </span>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="mt-2 w-full accent-violet-500"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[10px] font-semibold" style={{color: 'var(--gm-muted)'}}>
                  {t.aiLab.maxTokensLabel}
                </span>
                <input
                  type="number"
                  min={128}
                  max={8192}
                  step={128}
                  value={maxOutputTokens}
                  onChange={(e) => setMaxOutputTokens(Math.max(128, Math.min(8192, Number(e.target.value) || 1024)))}
                  className="gm-inset gm-mono min-h-[36px] w-full px-2 text-xs outline-none"
                  style={{color: 'var(--gm-ink)'}}
                />
              </label>

              <label className="space-y-1">
                <span className="text-[10px] font-semibold" style={{color: 'var(--gm-muted)'}}>
                  {t.aiLab.mimeLabel}
                </span>
                <select
                  value={responseMimeType}
                  onChange={(e) => setResponseMimeType(e.target.value as 'text/plain' | 'application/json')}
                  className="gm-inset min-h-[36px] w-full px-2 text-xs outline-none"
                  style={{color: 'var(--gm-ink)'}}
                >
                  <option value="text/plain" className="bg-zinc-950">text/plain</option>
                  <option value="application/json" className="bg-zinc-950">application/json</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[10px] font-semibold" style={{color: 'var(--gm-muted)'}}>
                  {t.aiLab.timeoutLabel}
                </span>
                <select
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(Number(e.target.value))}
                  className="gm-inset min-h-[36px] w-full px-2 text-xs outline-none"
                  style={{color: 'var(--gm-ink)'}}
                >
                  <option value={10000} className="bg-zinc-950">10s</option>
                  <option value={25000} className="bg-zinc-950">25s</option>
                  <option value={45000} className="bg-zinc-950">45s</option>
                </select>
              </label>
            </div>

            {selectedSpec.supportsThinking && (
              <div className="space-y-1">
                <span className="text-[11px] font-semibold" style={{color: 'var(--gm-muted)'}}>
                  {t.aiLab.thinkingLabel}
                </span>
                <div className="grid grid-cols-3 gap-1">
                  {(['LOW', 'MEDIUM', 'HIGH'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setThinking(lvl)}
                      className={`min-h-[38px] text-[11px] font-semibold ${
                        thinking === lvl ? 'gm-btn-primary' : 'gm-btn-ghost'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="block space-y-1">
              <span className="text-[11px] font-semibold" style={{color: 'var(--gm-muted)'}}>
                {t.aiLab.systemLabel}
              </span>
              <input
                type="text"
                value={systemInstruction}
                onChange={(e) => setSystemInstruction(e.target.value)}
                placeholder={t.aiLab.systemPlaceholder}
                className="gm-inset w-full min-h-[38px] px-3 text-xs outline-none"
                style={{color: 'var(--gm-ink)'}}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-[11px] font-semibold" style={{color: 'var(--gm-muted)'}}>
                {t.aiLab.promptLabel}
              </span>
              <textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t.aiLab.promptPlaceholder}
                className="gm-inset w-full resize-y p-3 text-xs leading-relaxed outline-none"
                style={{color: 'var(--gm-ink)'}}
              />
            </label>

            {/* Quick developer prompts & Prompt Versioning controls */}
            <div className="flex flex-wrap gap-1.5">
              {t.aiLab.quickPrompts.map((qp) => (
                <button
                  key={qp.label}
                  type="button"
                  onClick={() => setPrompt(qp.prompt)}
                  className="gm-btn-ghost min-h-[34px] px-2.5 text-[11px]"
                >
                  {qp.label}
                </button>
              ))}
              <button
                type="button"
                disabled={!prompt.trim()}
                onClick={handleSavePromptVersion}
                className="gm-btn-ghost inline-flex min-h-[34px] items-center gap-1 px-2.5 text-[11px] disabled:opacity-40"
              >
                <BookmarkPlus className="h-3 w-3" />
                <span>{t.aiLab.saveVersionBtn}</span>
              </button>
            </div>

            {versions.length > 0 && (
              <div className="gm-inset space-y-2 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold" style={{color: 'var(--gm-muted)'}}>
                    {t.aiLab.versionsLabel} ({versions.length})
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleExportVersions}
                      className="gm-btn-ghost inline-flex min-h-[30px] items-center gap-1 px-2 text-[10px]"
                    >
                      <Download className="h-3 w-3" />
                      <span>{t.aiLab.exportVersionsBtn}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => importInputRef.current?.click()}
                      className="gm-btn-ghost inline-flex min-h-[30px] items-center gap-1 px-2 text-[10px]"
                    >
                      <Upload className="h-3 w-3" />
                      <span>{t.aiLab.importVersionsBtn}</span>
                    </button>
                    <input
                      ref={importInputRef}
                      type="file"
                      accept="application/json"
                      className="hidden"
                      onChange={(e) => void handleImportVersions(e.target.files?.[0])}
                    />
                  </div>
                </div>
                <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                  {versions.slice(0, 8).map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setModel(v.model);
                        setSystemInstruction(v.systemInstruction);
                        setPrompt(v.prompt);
                      }}
                      className="gm-btn-ghost max-w-full truncate px-2 py-1 text-[10px]"
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                {error}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleRun()}
                disabled={running || !prompt.trim()}
                className="gm-btn-primary inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 px-4 text-xs font-semibold disabled:opacity-50"
              >
                {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                <span>{running ? t.aiLab.running : t.aiLab.runPrompt}</span>
              </button>
              {running && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="gm-btn-ghost inline-flex min-h-[44px] items-center gap-1.5 px-3.5 text-xs font-semibold text-rose-300"
                >
                  <Square className="h-3.5 w-3.5" />
                  <span>{t.aiLab.cancelBtn}</span>
                </button>
              )}
            </div>
          </div>

          {/* Live Output & Token Inspector */}
          <div className="gm-card flex min-w-0 flex-col justify-between gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4" style={{color: 'var(--gm-accent)'}} />
                <span className="text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
                  {t.aiLab.outputTitle}
                </span>
              </div>
              {latest && (
                <button
                  type="button"
                  onClick={() => handleCopy(latest.response)}
                  className="gm-btn-ghost inline-flex min-h-[34px] items-center gap-1 px-2.5 text-[11px]"
                >
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  <span>{t.aiLab.copyOutput}</span>
                </button>
              )}
            </div>

            {latest ? (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="gm-inset p-2">
                    <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
                      {t.aiLab.latency}
                    </div>
                    <div className="gm-mono text-xs font-bold" style={{color: 'var(--gm-accent)'}}>
                      {fmtGodNumber(latest.latencyMs, lang)} ms
                    </div>
                  </div>
                  <div className="gm-inset p-2">
                    <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
                      {t.aiLab.promptTokens}
                    </div>
                    <div className="gm-mono text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
                      {fmtGodNumber(latest.usage.promptTokens, lang)}
                    </div>
                  </div>
                  <div className="gm-inset p-2">
                    <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
                      {t.aiLab.outputTokens}
                    </div>
                    <div className="gm-mono text-xs font-bold" style={{color: 'var(--gm-ink)'}}>
                      {fmtGodNumber(latest.usage.candidatesTokens, lang)}
                    </div>
                  </div>
                  <div className="gm-inset p-2">
                    <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
                      {t.aiLab.totalTokens}
                    </div>
                    <div className="gm-mono text-xs font-bold" style={{color: 'var(--gm-accent-2)'}}>
                      {fmtGodNumber(latest.usage.totalTokens, lang)}
                    </div>
                  </div>
                </div>

                <div
                  className="gm-inset max-h-[340px] flex-1 overflow-y-auto whitespace-pre-wrap break-words p-3 text-xs leading-relaxed"
                  style={{color: 'var(--gm-ink)'}}
                >
                  {latest.response}
                </div>
              </>
            ) : (
              <div
                className="gm-inset flex min-h-[200px] items-center justify-center p-4 text-center text-xs"
                style={{color: 'var(--gm-muted)'}}
              >
                {t.aiLab.emptyOutput}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'models' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {GOD_MODE_AI_MODELS.map((m) => {
              const active = model === m.id;
              return (
                <div
                  key={m.id}
                  className={`${active ? 'gm-card-featured' : 'gm-card'} flex flex-col justify-between gap-3 p-4`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold" style={{color: 'var(--gm-ink)'}}>
                        {m.name}
                      </div>
                      <div className="gm-mono mt-0.5 text-[11px]" style={{color: 'var(--gm-accent)'}}>
                        {m.id}
                      </div>
                    </div>
                    <span className="gm-mono text-[10px] font-semibold" style={{color: 'var(--gm-muted)'}}>
                      {lang === 'tr' ? m.tierTr : m.tierEn}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{color: 'var(--gm-muted)'}}>
                    {lang === 'tr' ? m.descTr : m.descEn}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setModel(m.id);
                      setTab('studio');
                    }}
                    className={`min-h-[40px] px-3 text-xs font-semibold ${
                      active ? 'gm-btn-primary' : 'gm-btn-ghost'
                    }`}
                  >
                    {active ? t.designLab.activeDesign : t.designLab.select}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="gm-card space-y-3 p-4">
            <div className="text-xs font-bold uppercase tracking-wider" style={{color: 'var(--gm-muted)'}}>
              {t.aiLab.presetsLabel}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={presetNameInput}
                onChange={(e) => setPresetNameInput(e.target.value)}
                placeholder={t.aiLab.presetsLabel}
                className="gm-inset min-h-[40px] min-w-0 flex-1 px-3 text-xs outline-none"
                style={{color: 'var(--gm-ink)'}}
              />
              <button
                type="button"
                disabled={!presetNameInput.trim()}
                onClick={handleSaveCustomPreset}
                className="gm-btn-primary inline-flex min-h-[40px] items-center gap-1.5 px-3.5 text-xs font-semibold disabled:opacity-40"
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                <span>{t.aiLab.saveVersionBtn}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="gm-card space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="gm-mono text-xs font-semibold" style={{color: 'var(--gm-muted)'}}>
              {fmtGodNumber(history.length, lang)}
            </span>
            {history.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="gm-btn-ghost inline-flex min-h-[36px] items-center gap-1.5 px-3 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t.aiLab.clearHistory}</span>
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <div className="gm-inset p-5 text-center text-xs" style={{color: 'var(--gm-muted)'}}>
              {t.aiLab.emptyHistory}
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setLatest(item);
                    setTab('studio');
                  }}
                  className="gm-inset block w-full p-3 text-left transition-colors hover:border-[var(--gm-border-strong)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="gm-mono text-[11px] font-semibold" style={{color: 'var(--gm-accent)'}}>
                      {item.model} · {item.latencyMs}ms · {item.usage.totalTokens} tok
                    </span>
                    <span className="gm-mono text-[10px]" style={{color: 'var(--gm-muted)'}}>
                      {fmtGodDateTime(item.ts, lang)}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
                    {item.prompt}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
