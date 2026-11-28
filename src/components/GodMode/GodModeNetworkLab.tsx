import React, {useState} from 'react';
import {Globe, Lock, Play, RefreshCw, ShieldAlert, ShieldCheck, Wifi} from 'lucide-react';
import {GOD_MODE_I18N, GodModeLang, fmtGodShortTime} from '../../engine/godModeI18n';
import {
  NetworkProbeResult,
  probeClientOriginEndpoint,
  probeServerNetworkTarget,
} from '../../engine/godModeExtended';
import {RuntimeTelemetrySnapshot} from '../../engine/godModeTelemetry';
import {OwnerSecurityState} from '../../engine/godModeSecurity';
import type {GodModeModuleId} from './GodModeShell';

interface GodModeNetworkLabProps {
  lang: GodModeLang;
  telemetry: RuntimeTelemetrySnapshot;
  security: OwnerSecurityState;
  onSelectModule: (id: GodModeModuleId) => void;
}

const PRESET_TARGETS = [
  'https://api.github.com',
  'https://www.google.com',
  'https://cloudflare.com',
];

export const GodModeNetworkLab: React.FC<GodModeNetworkLabProps> = ({
  lang,
  telemetry,
  security,
  onSelectModule,
}) => {
  const t = GOD_MODE_I18N[lang];
  const [targetUrl, setTargetUrl] = useState('https://api.github.com');
  const [probing, setProbing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<NetworkProbeResult[]>([]);

  const isVerified = security.mode === 'server_verified';

  const handleServerProbe = async (overrideUrl?: string) => {
    const url = (overrideUrl ?? targetUrl).trim();
    if (!url || probing) return;
    setProbing(true);
    setError(null);
    const res = await probeServerNetworkTarget(url, 'HEAD');
    setProbing(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResults((prev) => [res.result, ...prev.slice(0, 19)]);
  };

  const handleOriginPing = async () => {
    if (probing) return;
    setProbing(true);
    setError(null);
    const result = await probeClientOriginEndpoint('/api/ping');
    setProbing(false);
    setResults((prev) => [result, ...prev.slice(0, 19)]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 shrink-0" style={{color: 'var(--gm-accent)'}} />
          <h2 className="text-lg font-bold tracking-tight" style={{color: 'var(--gm-ink)'}}>
            {t.networkLab.title}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => void handleOriginPing()}
          disabled={probing}
          className="gm-btn-ghost inline-flex min-h-[40px] items-center gap-1.5 px-3 text-xs font-semibold"
        >
          <Wifi className="h-3.5 w-3.5" />
          <span>{t.networkLab.originProbe}</span>
        </button>
      </div>

      {/* Live Client Connection Cards (2x2 Portrait First) */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="gm-card p-3">
          <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
            {t.networkLab.onlineStatus}
          </div>
          <div className={`gm-mono mt-1 text-sm font-bold ${telemetry.online ? 'text-emerald-400' : 'text-rose-400'}`}>
            {telemetry.online ? t.systemCore.online : t.systemCore.offline}
          </div>
        </div>
        <div className="gm-card p-3">
          <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
            {t.networkLab.connectionType}
          </div>
          <div className="gm-mono mt-1 text-sm font-bold uppercase" style={{color: 'var(--gm-ink)'}}>
            {telemetry.connectionType ?? '—'}
          </div>
        </div>
        <div className="gm-card p-3">
          <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
            {t.networkLab.downlink}
          </div>
          <div className="gm-mono mt-1 text-sm font-bold" style={{color: 'var(--gm-accent)'}}>
            {telemetry.downlinkMbps !== null ? `${telemetry.downlinkMbps} Mbps` : '—'}
          </div>
        </div>
        <div className="gm-card p-3">
          <div className="text-[10px]" style={{color: 'var(--gm-muted)'}}>
            {t.networkLab.rtt}
          </div>
          <div className="gm-mono mt-1 text-sm font-bold" style={{color: 'var(--gm-accent-2)'}}>
            {telemetry.rttMs !== null ? `${telemetry.rttMs} ms` : '—'}
          </div>
        </div>
      </div>

      {/* Server-Side SSRF-Protected DNS + TLS + HTTP Probe Form */}
      <div className="gm-card space-y-3 p-4">
        {!isVerified && (
          <div className="gm-inset flex flex-wrap items-center justify-between gap-2 p-2.5 text-xs text-amber-300">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              {t.networkLab.authNeeded}
            </span>
            <button
              type="button"
              onClick={() => onSelectModule('security_center')}
              className="gm-btn-primary min-h-[34px] px-2.5 text-[11px] font-semibold"
            >
              {t.networkLab.openSecurity}
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="url"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder={t.networkLab.targetPlaceholder}
            className="gm-inset gm-mono min-h-[42px] min-w-0 flex-1 px-3 text-xs outline-none"
            style={{color: 'var(--gm-ink)'}}
          />
          <button
            type="button"
            disabled={probing || !targetUrl.trim()}
            onClick={() => void handleServerProbe()}
            className="gm-btn-primary inline-flex min-h-[42px] items-center gap-1.5 px-4 text-xs font-semibold disabled:opacity-50"
          >
            {probing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            <span>{probing ? t.networkLab.probing : t.networkLab.serverProbe}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px]" style={{color: 'var(--gm-muted)'}}>
            {t.networkLab.presets}:
          </span>
          {PRESET_TARGETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setTargetUrl(preset);
                if (isVerified) void handleServerProbe(preset);
              }}
              className="gm-btn-ghost gm-mono min-h-[34px] px-2.5 text-[11px]"
            >
              {preset.replace(/^https?:\/\//, '')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-[11px]" style={{color: 'var(--gm-muted)'}}>
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span>{t.networkLab.ssrfNote}</span>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            {error}
          </div>
        )}
      </div>

      {/* Results History with DNS Records, TLS Inspection & Failure Classification */}
      <div className="gm-card space-y-2.5 p-4">
        <div className="text-xs font-bold uppercase tracking-wider" style={{color: 'var(--gm-muted)'}}>
          {t.networkLab.historyTitle}
        </div>
        {results.length === 0 ? (
          <div className="gm-inset p-4 text-center text-xs" style={{color: 'var(--gm-muted)'}}>
            {t.networkLab.emptyHistory}
          </div>
        ) : (
          <div className="space-y-2.5">
            {results.map((r) => (
              <div key={r.id} className="gm-inset space-y-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="gm-mono truncate text-xs font-semibold" style={{color: 'var(--gm-ink)'}}>
                      {r.method} {r.url}
                    </div>
                    <div className="gm-mono mt-0.5 truncate text-[10px]" style={{color: 'var(--gm-muted)'}}>
                      {t.networkLab.ipCol}: {r.resolvedIp ?? '—'}
                      {typeof r.dnsMs === 'number' ? ` · DNS ${r.dnsMs}ms` : ''} · {fmtGodShortTime(r.ts, lang)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5 gm-mono text-xs font-bold">
                    {r.errorCategory && (
                      <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] text-rose-300">
                        {r.errorCategory}
                      </span>
                    )}
                    <span
                      className={
                        r.reachable && r.status && r.status < 400
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }
                    >
                      {r.status ?? 'ERR'}
                    </span>
                    <span style={{color: 'var(--gm-accent)'}}>{r.latencyMs}ms</span>
                  </div>
                </div>

                {/* DNS Records Inspector */}
                {r.dnsRecords &&
                  (r.dnsRecords.a.length > 0 ||
                    r.dnsRecords.aaaa.length > 0 ||
                    r.dnsRecords.cname.length > 0 ||
                    r.dnsRecords.mx.length > 0) && (
                    <div className="grid grid-cols-1 gap-1.5 border-t pt-2 gm-mono text-[10px] sm:grid-cols-2" style={{borderColor: 'var(--gm-border)'}}>
                      <div className="font-bold uppercase tracking-wider sm:col-span-2" style={{color: 'var(--gm-muted)'}}>
                        {t.networkLab.dnsTitle}
                      </div>
                      {r.dnsRecords.a.length > 0 && (
                        <div className="break-all" style={{color: 'var(--gm-ink)'}}>
                          <span style={{color: 'var(--gm-accent)'}}>A:</span> {r.dnsRecords.a.slice(0, 4).join(', ')}
                        </div>
                      )}
                      {r.dnsRecords.aaaa.length > 0 && (
                        <div className="break-all" style={{color: 'var(--gm-ink)'}}>
                          <span style={{color: 'var(--gm-accent)'}}>AAAA:</span> {r.dnsRecords.aaaa.slice(0, 2).join(', ')}
                        </div>
                      )}
                      {r.dnsRecords.cname.length > 0 && (
                        <div className="break-all" style={{color: 'var(--gm-ink)'}}>
                          <span style={{color: 'var(--gm-accent)'}}>CNAME:</span> {r.dnsRecords.cname.join(', ')}
                        </div>
                      )}
                      {r.dnsRecords.mx.length > 0 && (
                        <div className="break-all" style={{color: 'var(--gm-ink)'}}>
                          <span style={{color: 'var(--gm-accent)'}}>MX:</span> {r.dnsRecords.mx.slice(0, 3).join(', ')}
                        </div>
                      )}
                    </div>
                  )}

                {/* TLS Certificate Inspector */}
                {r.tlsInfo && (
                  <div className="grid grid-cols-2 gap-1.5 border-t pt-2 gm-mono text-[10px] sm:grid-cols-4" style={{borderColor: 'var(--gm-border)'}}>
                    <div className="flex items-center gap-1 font-bold uppercase tracking-wider col-span-2 sm:col-span-4" style={{color: 'var(--gm-muted)'}}>
                      <Lock className="h-3 w-3 text-emerald-400" />
                      <span>
                        {t.networkLab.tlsTitle} ({r.tlsInfo.tlsMs}ms)
                      </span>
                    </div>
                    <div>
                      <span style={{color: 'var(--gm-muted)'}}>{t.networkLab.protocolLabel}: </span>
                      <span style={{color: 'var(--gm-ink)'}}>{r.tlsInfo.protocol ?? '—'}</span>
                    </div>
                    <div className="truncate">
                      <span style={{color: 'var(--gm-muted)'}}>{t.networkLab.cipherLabel}: </span>
                      <span style={{color: 'var(--gm-ink)'}}>{r.tlsInfo.cipherName ?? '—'}</span>
                    </div>
                    <div className="truncate">
                      <span style={{color: 'var(--gm-muted)'}}>{t.networkLab.issuerLabel}: </span>
                      <span style={{color: 'var(--gm-ink)'}}>{r.tlsInfo.issuerO ?? r.tlsInfo.subjectCN ?? '—'}</span>
                    </div>
                    <div>
                      <span style={{color: 'var(--gm-muted)'}}>{t.networkLab.expiryLabel}: </span>
                      <span className={r.tlsInfo.authorized ? 'text-emerald-400' : 'text-rose-400'}>
                        {r.tlsInfo.daysRemaining !== null
                          ? `${r.tlsInfo.daysRemaining} ${t.networkLab.daysLeft}`
                          : '—'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
