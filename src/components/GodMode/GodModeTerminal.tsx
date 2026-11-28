import React, {useRef, useState} from 'react';
import {ClipboardCopy, Play, Terminal as TerminalIcon, Trash2} from 'lucide-react';
import {
  GOD_MODE_I18N,
  GodModeLang,
  fmtGodBytes,
  fmtGodShortTime,
} from '../../engine/godModeI18n';
import {
  RuntimeTelemetrySnapshot,
  runRealDiagnostics,
} from '../../engine/godModeTelemetry';
import {
  createGodModeSnapshot,
  loadGodModeFlags,
  runGodModeAiPrompt,
} from '../../engine/godModeExtended';
import {GodModeThemeId} from '../../engine/godModeThemes';
import type {GodModeModuleId} from './GodModeShell';

interface GodModeTerminalProps {
  lang: GodModeLang;
  activeTheme: GodModeThemeId;
  telemetry: RuntimeTelemetrySnapshot;
  onSelectModule: (id: GodModeModuleId) => void;
  onChangeLang: (lang: GodModeLang) => void;
  onShowToast?: (msg: string) => void;
}

interface TermLine {
  id: string;
  ts: number;
  kind: 'cmd' | 'out' | 'ok' | 'err';
  text: string;
}

const QUICK_COMMANDS = ['help', 'status', 'diagnostics', 'storage', 'flags', 'snapshot'];

export const GodModeTerminal: React.FC<GodModeTerminalProps> = ({
  lang,
  activeTheme,
  telemetry,
  onSelectModule,
  onChangeLang,
  onShowToast,
}) => {
  const t = GOD_MODE_I18N[lang];
  const [input, setInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histCursor, setHistCursor] = useState<number>(-1);
  const [lines, setLines] = useState<TermLine[]>(() => [
    {id: 'init', ts: Date.now(), kind: 'ok', text: t.terminal.welcome},
  ]);
  const endRef = useRef<HTMLDivElement | null>(null);

  const append = (kind: TermLine['kind'], text: string) => {
    setLines((prev) => [
      ...prev.slice(-90),
      {id: `ln_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, ts: Date.now(), kind, text},
    ]);
    window.setTimeout(() => endRef.current?.scrollIntoView({behavior: 'smooth'}), 20);
  };

  const execute = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setCmdHistory((prev) => [trimmed, ...prev.slice(0, 39)]);
    setHistCursor(-1);
    append('cmd', `morph@godmode:~$ ${trimmed}`);
    setInput('');

    const [cmd, ...rest] = trimmed.split(/\s+/);
    const arg = rest.join(' ').trim();
    const lc = cmd.toLowerCase();

    if (lc === 'clear' || lc === 'cls') {
      setLines([]);
      return;
    }

    if (lc === 'help') {
      append(
        'out',
        [
          'help              — List commands',
          'status            — Live FPS, memory, DOM & API latency',
          'diagnostics       — Run 8 live subsystem probes',
          'storage           — Inspect localStorage footprint',
          'flags             — Show experimental flag overrides',
          'snapshot [name]   — Save Time Machine snapshot',
          'lang <tr|en>      — Switch GOD MODE language',
          'open <module_id>  — Jump to module (e.g. open ai_lab)',
          'ai <prompt>       — Query Gemini 3.1 Flash-Lite',
          'clear             — Clear output buffer',
        ].join('\n')
      );
      return;
    }

    if (lc === 'status') {
      append(
        'ok',
        `FPS: ${telemetry.fps} (${telemetry.frameMs}ms) | Heap: ${fmtGodBytes(
          telemetry.heapUsedBytes,
          lang
        )} | DOM: ${telemetry.domNodes} | API Ping: ${
          telemetry.apiPingMs !== null ? `${telemetry.apiPingMs}ms` : 'N/A'
        } | Theme: ${activeTheme} | Lang: ${lang.toUpperCase()}`
      );
      return;
    }

    if (lc === 'storage') {
      append(
        'out',
        `LocalStorage: ${telemetry.localStorageKeys} keys (${fmtGodBytes(
          telemetry.localStorageBytes,
          lang
        )}) | Cache Buckets: ${telemetry.cacheBuckets ?? 'N/A'} | SW: ${
          telemetry.serviceWorkerActive ? 'ACTIVE' : 'IDLE'
        }`
      );
      return;
    }

    if (lc === 'flags') {
      const flags = loadGodModeFlags();
      const linesOut = flags.map(
        (f) => `${f.key}: ${f.value ? 'ON' : 'OFF'}${f.value !== f.defaultValue ? ' [MODIFIED]' : ''}`
      );
      append('out', linesOut.join('\n'));
      return;
    }

    if (lc === 'snapshot') {
      const snap = createGodModeSnapshot({
        label: arg || `CLI ${fmtGodShortTime(Date.now(), lang)}`,
        theme: activeTheme,
        lang,
      });
      append('ok', `Snapshot saved: ${snap.id} (${snap.label})`);
      return;
    }

    if (lc === 'lang') {
      if (arg === 'tr' || arg === 'en') {
        onChangeLang(arg);
        append('ok', `GOD MODE language -> ${arg.toUpperCase()}`);
      } else {
        append('err', 'Usage: lang tr | lang en');
      }
      return;
    }

    if (lc === 'open') {
      const validIds: GodModeModuleId[] = [
        'dashboard',
        'design_lab',
        'system_core',
        'diagnostics',
        'dev_toolkit',
        'security_center',
        'settings',
        'deadpool_studio',
        'chaos_lab',
        'ai_lab',
        'autonomous_agents',
        'experimental_lab',
        'media_engine',
        'terminal',
        'automation_studio',
        'network_lab',
        'storage_lab',
        'time_machine',
        'digital_twin',
      ];
      if (validIds.includes(arg as GodModeModuleId)) {
        append('ok', `Opening module: ${arg}`);
        onSelectModule(arg as GodModeModuleId);
      } else {
        append('err', `Unknown module "${arg}". Valid: ${validIds.join(', ')}`);
      }
      return;
    }

    if (lc === 'diagnostics') {
      append('out', 'Running 8 live subsystem probes...');
      const results = await runRealDiagnostics();
      const summary = results
        .map(
          (r) =>
            `[${r.status.toUpperCase()}] ${lang === 'tr' ? r.titleTr : r.titleEn} (${r.durationMs}ms)`
        )
        .join('\n');
      append('ok', summary);
      return;
    }

    if (lc === 'ai') {
      if (!arg) {
        append('err', 'Usage: ai <your prompt>');
        return;
      }
      append('out', 'Calling gemini-3.1-flash-lite...');
      const res = await runGodModeAiPrompt({
        model: 'gemini-3.1-flash-lite',
        prompt: arg,
      });
      if (!res.ok) {
        append('err', res.error);
      } else {
        append('ok', `[${res.latencyMs}ms · ${res.usage.totalTokens} tok]\n${res.text}`);
      }
      return;
    }

    append('err', `Unknown command: "${cmd}". Type "help".`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void execute(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length === 0) return;
      const nextIdx = Math.min(cmdHistory.length - 1, histCursor + 1);
      setHistCursor(nextIdx);
      setInput(cmdHistory[nextIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histCursor <= 0) {
        setHistCursor(-1);
        setInput('');
      } else {
        const nextIdx = histCursor - 1;
        setHistCursor(nextIdx);
        setInput(cmdHistory[nextIdx]);
      }
    }
  };

  const handleExport = () => {
    const text = lines.map((l) => `[${fmtGodShortTime(l.ts, lang)}] ${l.text}`).join('\n');
    navigator.clipboard?.writeText(text).catch(() => {});
    onShowToast?.(t.terminal.exportedToast);
  };

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-4 w-4" style={{color: 'var(--gm-accent)'}} />
          <h2 className="text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>
            {t.terminal.title}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleExport}
            className="gm-btn-ghost inline-flex min-h-[36px] items-center gap-1.5 px-3 text-xs"
          >
            <ClipboardCopy className="h-3.5 w-3.5" />
            <span>{t.terminal.exportLog}</span>
          </button>
          <button
            type="button"
            onClick={() => setLines([])}
            className="gm-btn-ghost inline-flex min-h-[36px] items-center gap-1.5 px-3 text-xs"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{t.terminal.clear}</span>
          </button>
        </div>
      </div>

      {/* Quick Command Chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold" style={{color: 'var(--gm-muted)'}}>
          {t.terminal.quickCmds}:
        </span>
        {QUICK_COMMANDS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => void execute(c)}
            className="gm-btn-ghost gm-mono min-h-[30px] px-2.5 text-[11px]"
          >
            {c}
          </button>
        ))}
      </div>

      {/* Console Buffer */}
      <div className="gm-card overflow-hidden">
        <div
          className="h-[310px] overflow-y-auto p-3.5 gm-mono text-xs leading-relaxed space-y-2"
          style={{background: 'var(--gm-inset)'}}
        >
          {lines.map((l) => (
            <pre
              key={l.id}
              className={`whitespace-pre-wrap break-words ${
                l.kind === 'cmd'
                  ? 'font-bold'
                  : l.kind === 'err'
                    ? 'text-rose-400'
                    : l.kind === 'ok'
                      ? 'text-emerald-300'
                      : ''
              }`}
              style={
                l.kind === 'cmd'
                  ? {color: 'var(--gm-accent)'}
                  : l.kind === 'out'
                    ? {color: 'var(--gm-ink)'}
                    : undefined
              }
            >
              {l.text}
            </pre>
          ))}
          <div ref={endRef} />
        </div>

        <div
          className="flex items-center gap-2 border-t p-2.5"
          style={{borderColor: 'var(--gm-border)', background: 'var(--gm-bg-elevated)'}}
        >
          <span className="gm-mono text-xs font-bold" style={{color: 'var(--gm-accent)'}}>
            $
          </span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.terminal.placeholder}
            className="gm-mono min-h-[38px] flex-1 bg-transparent text-xs outline-none"
            style={{color: 'var(--gm-ink)'}}
          />
          <button
            type="button"
            onClick={() => void execute(input)}
            className="gm-btn-primary inline-flex min-h-[36px] items-center gap-1.5 px-3 text-xs font-semibold"
          >
            <Play className="h-3.5 w-3.5" />
            <span>{t.terminal.run}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
