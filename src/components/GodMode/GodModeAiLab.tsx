import React, {useMemo, useState} from 'react';
import {
  BrainCircuit,
  ClipboardCopy,
  Cpu,
  History,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  GOD_MODE_I18N,
  GodModeLang,
  fmtGodDateTime,
  fmtGodNumber,
} from '../../engine/godModeI18n';
import {
  AiHistoryEntry,
  GOD_MODE_AI_MODELS,
  GodModeAiModelId,
  GodModeThinkingLevel,
  loadAiHistory,
  runGodModeAiPrompt,
  saveAiHistory,
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
  const [model, setModel] = useState<GodModeAiModelId>('gemini-4-hydrogen');
  const [thinking, setThinking] = useState<GodModeThinkingLevel>('LOW');
  const [systemInstruction, setSystemInstruction] = useState('');
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AiHistoryEntry[]>(() => loadAiHistory());
  const [latest, setLatest] = useState<AiHistoryEntry | null>(() => loadAiHistory()[0] ?? null);

  const selectedSpec = useMemo(
    () => GOD_MODE_AI_MODELS.find((m) => m.id === model) ?? GOD_MODE_AI_MODELS[0],
    [model]
  );

  const isVerified = security.mode === 'server_verified';

  const handleRun = async (overridePrompt?: string) => {
    const textToSend = (overridePrompt ?? prompt).trim();
    if (!textToSend || running) return;
    setRunning(true);
    setError(null);
    const res = await runGodModeAiPrompt({
      model,
      prompt: textToSend,
      systemInstruction: systemInstruction.trim() || undefined,
      thinkingLevel: selectedSpec.supportsThinking ? thinking : undefined,
    });
    setRunning(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
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
                className={`flex min-h-[36px] items-center justify-center text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
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
            className="gm-btn-primary min-h-[36px] px-3 text-xs font-semibold whitespace-nowrap"
          >
            {t.aiLab.openSecurity}
          </button>
        </div>
      )}

      {tab === 'studio' && (
        <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1.05fr_1fr]">
          {/* Prompt Composer */}
          <div className="gm-card space-y-3 p-4">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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
                        className={`min-h-[40px] text-[11px] font-semibold ${
                          thinking === lvl ? 'gm-btn-primary' : 'gm-btn-ghost'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

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

            {/* Quick developer prompts */}
            <div className="flex flex-wrap gap-1.5">
              {t.aiLab.quickPrompts.map((qp) => (
                <button
                  key={qp.label}
                  type="button"
                  onClick={() => setPrompt(qp.prompt)}
                  className="gm-btn-ghost min-h-[32px] px-2.5 text-[11px]"
                >
                  {qp.label}
                </button>
              ))}
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleRun()}
              disabled={running || !prompt.trim()}
              className="gm-btn-primary inline-flex min-h-[42px] w-full items-center justify-center gap-2 px-4 text-xs font-semibold disabled:opacity-50"
            >
              {running ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span>{running ? t.aiLab.running : t.aiLab.runPrompt}</span>
            </button>
          </div>

          {/* Live Output & Token Inspector */}
          <div className="gm-card flex flex-col justify-between gap-3 p-4">
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
                  className="gm-btn-ghost inline-flex min-h-[32px] items-center gap-1 px-2.5 text-[11px]"
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
                  className="gm-inset max-h-[300px] flex-1 overflow-y-auto whitespace-pre-wrap p-3 text-xs leading-relaxed"
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
                  className={`min-h-[38px] px-3 text-xs font-semibold ${
                    active ? 'gm-btn-primary' : 'gm-btn-ghost'
                  }`}
                >
                  {active ? t.designLab.activeDesign : t.designLab.select}
                </button>
              </div>
            );
          })}
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
                className="gm-btn-ghost inline-flex min-h-[34px] items-center gap-1.5 px-3 text-xs"
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
