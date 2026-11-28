/**
 * MORPH // GOD MODE — Extended Client Engines (Phases 3–6)
 * Real API clients (AI Lab, Autonomous Agents, Network Probe) and isolated
 * local persistence stores (Experimental Flags, Workflows, Snapshots, Digital Twin).
 */

import {getGodModeAuthHeaders, hasInMemorySessionToken} from './godModeSecurity';
import {GodModeLang} from './godModeI18n';
import {GodModeThemeId} from './godModeThemes';
import {pushGodModeLog} from './godModeTelemetry';

// ============================================================================
// PHASE 3: AI LAB & AUTONOMOUS AGENTS
// ============================================================================
export type GodModeAiModelId = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';
export type GodModeThinkingLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface GodModeAiModelSpec {
  id: GodModeAiModelId;
  name: string;
  tierTr: string;
  tierEn: string;
  descTr: string;
  descEn: string;
  supportsThinking: boolean;
}

export const GOD_MODE_AI_MODELS: ReadonlyArray<GodModeAiModelSpec> = [
  {
    id: 'gemini-4-hydrogen',
    name: 'Gemini 4 Hydrogen',
    tierTr: 'Varsayılan · Hızlı Akıl Yürütme',
    tierEn: 'Default · Fast Reasoning',
    descTr: 'Yüksek hız ve derin analiz gerektiren geliştirici istemleri ve otonom ajanlar.',
    descEn: 'High-speed reasoning for developer prompts and autonomous agents.',
    supportsThinking: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    tierTr: 'Ultra Hafif · Düşük Gecikme',
    tierEn: 'Ultra-Light · Low Latency',
    descTr: 'Kısa özetler, hızlı sınıflandırma ve anlık terminal sorguları için ideal.',
    descEn: 'Ideal for short summaries, quick classification, and instant terminal queries.',
    supportsThinking: false,
  },
];

export interface AiTokenUsage {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
}

export interface AiHistoryEntry {
  id: string;
  ts: string;
  model: GodModeAiModelId;
  thinkingLevel?: GodModeThinkingLevel;
  prompt: string;
  response: string;
  latencyMs: number;
  usage: AiTokenUsage;
}

const AI_HISTORY_KEY = 'morph_godmode_ai_history_v1';

export function loadAiHistory(): AiHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(AI_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 30) : [];
  } catch {
    return [];
  }
}

export function saveAiHistory(items: AiHistoryEntry[]): void {
  try {
    window.localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(items.slice(0, 30)));
  } catch {
    // Ignore storage quota errors
  }
}

export async function runGodModeAiPrompt(params: {
  model: GodModeAiModelId;
  prompt: string;
  systemInstruction?: string;
  thinkingLevel?: GodModeThinkingLevel;
}): Promise<
  | {ok: true; model: GodModeAiModelId; text: string; latencyMs: number; usage: AiTokenUsage}
  | {ok: false; error: string; needsAuth?: boolean}
> {
  if (!hasInMemorySessionToken()) {
    return {ok: false, error: 'Sahip oturumu doğrulanmalı.', needsAuth: true};
  }
  try {
    const res = await fetch('/api/godmode/ai/generate', {
      method: 'POST',
      headers: getGodModeAuthHeaders(),
      body: JSON.stringify(params),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      model?: GodModeAiModelId;
      text?: string;
      latencyMs?: number;
      usage?: AiTokenUsage;
      detail?: string;
    };
    if (res.status === 401 || res.status === 403) {
      return {ok: false, error: data.detail || `HTTP ${res.status}`, needsAuth: res.status === 401};
    }
    if (!res.ok || !data.ok) {
      return {ok: false, error: data.detail || `HTTP ${res.status}`};
    }
    pushGodModeLog('info', 'ai_lab', `${params.model} yanıt verdi (${data.latencyMs ?? 0}ms)`);
    return {
      ok: true,
      model: data.model ?? params.model,
      text: data.text ?? '',
      latencyMs: data.latencyMs ?? 0,
      usage: data.usage ?? {promptTokens: 0, candidatesTokens: 0, totalTokens: 0},
    };
  } catch (err) {
    return {ok: false, error: err instanceof Error ? err.message : 'Network error'};
  }
}

export type GodModeAgentId =
  | 'architect'
  | 'auditor'
  | 'qa'
  | 'performance'
  | 'media'
  | 'security'
  | 'automation'
  | 'self_evolution';

export interface AgentFinding {
  title: string;
  severity: string;
  detail: string;
}

export interface AgentAction {
  title: string;
  impact: string;
  effort: string;
}

export interface AgentProposal {
  title: string;
  rationale: string;
  diffOutline: string;
}

export interface AgentReport {
  summary: string;
  riskLevel: string;
  findings: AgentFinding[];
  actions: AgentAction[];
  proposal?: AgentProposal;
}

export interface AgentRunRecord {
  id: string;
  ts: string;
  agentId: GodModeAgentId;
  model: string;
  latencyMs: number;
  usage: AiTokenUsage;
  report: AgentReport;
}

export interface EvolutionProposalRecord {
  id: string;
  ts: string;
  title: string;
  rationale: string;
  diffOutline: string;
  riskLevel: string;
  status: 'pending' | 'approved' | 'rejected';
}

const AGENT_RUNS_KEY = 'morph_godmode_agent_runs_v1';
const PROPOSALS_KEY = 'morph_godmode_proposals_v1';

export function loadAgentRuns(): AgentRunRecord[] {
  try {
    const raw = window.localStorage.getItem(AGENT_RUNS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 24) : [];
  } catch {
    return [];
  }
}

export function saveAgentRuns(runs: AgentRunRecord[]): void {
  try {
    window.localStorage.setItem(AGENT_RUNS_KEY, JSON.stringify(runs.slice(0, 24)));
  } catch {
    // Ignore
  }
}

export function loadEvolutionProposals(): EvolutionProposalRecord[] {
  try {
    const raw = window.localStorage.getItem(PROPOSALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

export function saveEvolutionProposals(list: EvolutionProposalRecord[]): void {
  try {
    window.localStorage.setItem(PROPOSALS_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    // Ignore
  }
}

export async function runGodModeAgent(params: {
  agentId: GodModeAgentId;
  lang: GodModeLang;
  focusPrompt?: string;
  runtimeContext: Record<string, unknown>;
}): Promise<
  | {ok: true; run: AgentRunRecord}
  | {ok: false; error: string; needsAuth?: boolean}
> {
  if (!hasInMemorySessionToken()) {
    return {ok: false, error: 'Sahip oturumu doğrulanmalı.', needsAuth: true};
  }
  try {
    const res = await fetch('/api/godmode/ai/agent', {
      method: 'POST',
      headers: getGodModeAuthHeaders(),
      body: JSON.stringify(params),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      agentId?: GodModeAgentId;
      model?: string;
      latencyMs?: number;
      usage?: AiTokenUsage;
      report?: AgentReport;
      detail?: string;
    };
    if (res.status === 401 || res.status === 403) {
      return {ok: false, error: data.detail || `HTTP ${res.status}`, needsAuth: res.status === 401};
    }
    if (!res.ok || !data.ok || !data.report) {
      return {ok: false, error: data.detail || `HTTP ${res.status}`};
    }
    const run: AgentRunRecord = {
      id: `ag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      ts: new Date().toISOString(),
      agentId: data.agentId ?? params.agentId,
      model: data.model ?? 'gemini-4-hydrogen',
      latencyMs: data.latencyMs ?? 0,
      usage: data.usage ?? {promptTokens: 0, candidatesTokens: 0, totalTokens: 0},
      report: data.report,
    };
    pushGodModeLog('info', 'agents', `Agent ${params.agentId} tamamlandı (${run.latencyMs}ms)`);
    return {ok: true, run};
  } catch (err) {
    return {ok: false, error: err instanceof Error ? err.message : 'Network error'};
  }
}

// ============================================================================
// PHASE 4: EXPERIMENTAL LAB FEATURE FLAGS
// ============================================================================
export interface GodModeFeatureFlag {
  key: string;
  labelTr: string;
  labelEn: string;
  category: 'runtime' | 'media' | 'ui' | 'ai';
  defaultValue: boolean;
  value: boolean;
}

const FLAGS_KEY = 'morph_godmode_flags_v1';

export const DEFAULT_GOD_MODE_FLAGS: ReadonlyArray<Omit<GodModeFeatureFlag, 'value'>> = [
  {
    key: 'gm_high_freq_telemetry',
    labelTr: 'Yüksek Frekanslı Kare Örneklemesi',
    labelEn: 'High-Frequency Frame Sampling',
    category: 'runtime',
    defaultValue: true,
  },
  {
    key: 'gm_ffmpeg_mt_probe',
    labelTr: 'FFmpeg Çoklu İş Parçacığı Denetimi',
    labelEn: 'FFmpeg Multi-Thread Probe',
    category: 'media',
    defaultValue: false,
  },
  {
    key: 'gm_hardware_accel_hint',
    labelTr: 'GPU Hızlandırmalı Canvas Önceliği',
    labelEn: 'GPU-Accelerated Canvas Priority',
    category: 'media',
    defaultValue: true,
  },
  {
    key: 'gm_ai_structured_json',
    labelTr: 'Katı Şemalı Ajan Çıktıları',
    labelEn: 'Strict Schema Agent Outputs',
    category: 'ai',
    defaultValue: true,
  },
  {
    key: 'gm_compact_mobile_cards',
    labelTr: 'Yoğun Dikey Kart Dizilimi',
    labelEn: 'Compact Portrait Card Density',
    category: 'ui',
    defaultValue: true,
  },
  {
    key: 'gm_verbose_audit_trace',
    labelTr: 'Ayrıntılı Denetim Olay İzleme',
    labelEn: 'Verbose Audit Event Tracing',
    category: 'runtime',
    defaultValue: false,
  },
];

export function loadGodModeFlags(): GodModeFeatureFlag[] {
  let overrides: Record<string, boolean> = {};
  try {
    const raw = window.localStorage.getItem(FLAGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') overrides = parsed;
    }
  } catch {
    // Ignore
  }
  return DEFAULT_GOD_MODE_FLAGS.map((def) => ({
    ...def,
    value: typeof overrides[def.key] === 'boolean' ? overrides[def.key] : def.defaultValue,
  }));
}

export function saveGodModeFlags(flags: GodModeFeatureFlag[]): void {
  const map: Record<string, boolean> = {};
  for (const f of flags) {
    if (f.value !== f.defaultValue) {
      map[f.key] = f.value;
    }
  }
  try {
    window.localStorage.setItem(FLAGS_KEY, JSON.stringify(map));
  } catch {
    // Ignore
  }
}

export function resetGodModeFlags(): GodModeFeatureFlag[] {
  try {
    window.localStorage.removeItem(FLAGS_KEY);
  } catch {
    // Ignore
  }
  return DEFAULT_GOD_MODE_FLAGS.map((def) => ({...def, value: def.defaultValue}));
}

// ============================================================================
// PHASE 5: AUTOMATION STUDIO WORKFLOWS
// ============================================================================
export type WorkflowStepType =
  | 'telemetry_check'
  | 'diagnostics_run'
  | 'storage_audit'
  | 'api_ping'
  | 'create_snapshot'
  | 'ai_summary';

export interface WorkflowStep {
  id: string;
  type: WorkflowStepType;
}

export interface GodModeWorkflow {
  id: string;
  nameTr: string;
  nameEn: string;
  steps: WorkflowStep[];
  lastRunAt?: string;
  lastStatus?: 'pass' | 'warn' | 'fail';
}

const WORKFLOWS_KEY = 'morph_godmode_workflows_v1';

export const DEFAULT_GOD_MODE_WORKFLOWS: GodModeWorkflow[] = [
  {
    id: 'wf_health_sweep',
    nameTr: 'Tam Sistem Sağlık Taraması',
    nameEn: 'Full System Health Sweep',
    steps: [
      {id: 'st_1', type: 'telemetry_check'},
      {id: 'st_2', type: 'api_ping'},
      {id: 'st_3', type: 'diagnostics_run'},
      {id: 'st_4', type: 'storage_audit'},
    ],
  },
  {
    id: 'wf_safe_checkpoint',
    nameTr: 'Güvenli Kontrol Noktası & Yedek',
    nameEn: 'Safe Checkpoint & Backup',
    steps: [
      {id: 'st_a', type: 'storage_audit'},
      {id: 'st_b', type: 'create_snapshot'},
      {id: 'st_c', type: 'telemetry_check'},
    ],
  },
];

export function loadGodModeWorkflows(): GodModeWorkflow[] {
  try {
    const raw = window.localStorage.getItem(WORKFLOWS_KEY);
    if (!raw) return DEFAULT_GOD_MODE_WORKFLOWS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return DEFAULT_GOD_MODE_WORKFLOWS;
  } catch {
    return DEFAULT_GOD_MODE_WORKFLOWS;
  }
}

export function saveGodModeWorkflows(workflows: GodModeWorkflow[]): void {
  try {
    window.localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows.slice(0, 16)));
  } catch {
    // Ignore
  }
}

// ============================================================================
// PHASE 5: NETWORK LAB PROBE
// ============================================================================
export interface NetworkProbeResult {
  id: string;
  ts: string;
  mode: 'server' | 'client';
  url: string;
  method: string;
  reachable: boolean;
  status: number | null;
  statusText: string;
  latencyMs: number;
  resolvedIp: string | null;
  contentType: string | null;
  serverHeader: string | null;
  cacheControl: string | null;
  redirectedTo: string | null;
}

export async function probeServerNetworkTarget(
  url: string,
  method: 'HEAD' | 'GET' = 'HEAD'
): Promise<{ok: true; result: NetworkProbeResult} | {ok: false; error: string; needsAuth?: boolean}> {
  if (!hasInMemorySessionToken()) {
    return {ok: false, error: 'Sunucu ağ testi için sahip oturumu doğrulanmalı.', needsAuth: true};
  }
  try {
    const res = await fetch('/api/godmode/network/probe', {
      method: 'POST',
      headers: getGodModeAuthHeaders(),
      body: JSON.stringify({url, method}),
    });
    const data = (await res.json().catch(() => ({}))) as Partial<NetworkProbeResult> & {
      ok?: boolean;
      detail?: string;
    };
    if (res.status === 401 || res.status === 403) {
      return {ok: false, error: data.detail || `HTTP ${res.status}`, needsAuth: res.status === 401};
    }
    if (!res.ok || !data.ok) {
      return {ok: false, error: data.detail || `HTTP ${res.status}`};
    }
    const result: NetworkProbeResult = {
      id: `np_${Date.now().toString(36)}`,
      ts: new Date().toISOString(),
      mode: 'server',
      url: data.url ?? url,
      method: data.method ?? method,
      reachable: Boolean(data.reachable),
      status: data.status ?? null,
      statusText: data.statusText ?? '',
      latencyMs: data.latencyMs ?? 0,
      resolvedIp: data.resolvedIp ?? null,
      contentType: data.contentType ?? null,
      serverHeader: data.serverHeader ?? null,
      cacheControl: data.cacheControl ?? null,
      redirectedTo: data.redirectedTo ?? null,
    };
    pushGodModeLog('info', 'network_lab', `Probe ${url} -> ${result.status ?? 'ERR'} (${result.latencyMs}ms)`);
    return {ok: true, result};
  } catch (err) {
    return {ok: false, error: err instanceof Error ? err.message : 'Network error'};
  }
}

export async function probeClientOriginEndpoint(path: string): Promise<NetworkProbeResult> {
  const safePath = path.startsWith('/') ? path : `/${path}`;
  const started = performance.now();
  try {
    const res = await fetch(safePath, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Math.round(performance.now() - started);
    return {
      id: `np_${Date.now().toString(36)}`,
      ts: new Date().toISOString(),
      mode: 'client',
      url: safePath,
      method: 'GET',
      reachable: true,
      status: res.status,
      statusText: res.statusText,
      latencyMs,
      resolvedIp: 'same-origin',
      contentType: res.headers.get('content-type'),
      serverHeader: res.headers.get('server'),
      cacheControl: res.headers.get('cache-control'),
      redirectedTo: null,
    };
  } catch (err) {
    return {
      id: `np_${Date.now().toString(36)}`,
      ts: new Date().toISOString(),
      mode: 'client',
      url: safePath,
      method: 'GET',
      reachable: false,
      status: null,
      statusText: err instanceof Error ? err.message : 'Failed',
      latencyMs: Math.round(performance.now() - started),
      resolvedIp: 'same-origin',
      contentType: null,
      serverHeader: null,
      cacheControl: null,
      redirectedTo: null,
    };
  }
}

// ============================================================================
// PHASE 6: TIME MACHINE SNAPSHOTS
// ============================================================================
export interface GodModeConfigSnapshot {
  id: string;
  ts: string;
  label: string;
  theme: GodModeThemeId;
  lang: GodModeLang;
  flags: Record<string, boolean>;
  workflowCount: number;
}

const SNAPSHOTS_KEY = 'morph_godmode_snapshots_v1';

export function loadGodModeSnapshots(): GodModeConfigSnapshot[] {
  try {
    const raw = window.localStorage.getItem(SNAPSHOTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

export function saveGodModeSnapshots(list: GodModeConfigSnapshot[]): void {
  try {
    window.localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    // Ignore
  }
}

export function createGodModeSnapshot(params: {
  label: string;
  theme: GodModeThemeId;
  lang: GodModeLang;
}): GodModeConfigSnapshot {
  const flagsList = loadGodModeFlags();
  const flags: Record<string, boolean> = {};
  for (const f of flagsList) flags[f.key] = f.value;
  const workflows = loadGodModeWorkflows();
  const snap: GodModeConfigSnapshot = {
    id: `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    ts: new Date().toISOString(),
    label: params.label.trim() || 'Snapshot',
    theme: params.theme,
    lang: params.lang,
    flags,
    workflowCount: workflows.length,
  };
  const existing = loadGodModeSnapshots();
  saveGodModeSnapshots([snap, ...existing]);
  pushGodModeLog('info', 'time_machine', `Snapshot created: ${snap.label}`);
  return snap;
}

// ============================================================================
// PHASE 6: DIGITAL TWIN FAULT SIMULATION STATE
// ============================================================================
export interface DigitalTwinConfig {
  simulatedLatencyMs: number;
  errorRatePct: number;
  simulateOffline: boolean;
  frameBudgetStressMs: number;
}

const TWIN_KEY = 'morph_godmode_twin_v1';

export const DEFAULT_DIGITAL_TWIN: DigitalTwinConfig = {
  simulatedLatencyMs: 0,
  errorRatePct: 0,
  simulateOffline: false,
  frameBudgetStressMs: 0,
};

export function loadDigitalTwinConfig(): DigitalTwinConfig {
  try {
    const raw = window.localStorage.getItem(TWIN_KEY);
    if (!raw) return DEFAULT_DIGITAL_TWIN;
    const parsed = JSON.parse(raw) as Partial<DigitalTwinConfig>;
    return {
      simulatedLatencyMs: Math.max(0, Math.min(4000, Number(parsed.simulatedLatencyMs) || 0)),
      errorRatePct: Math.max(0, Math.min(100, Number(parsed.errorRatePct) || 0)),
      simulateOffline: Boolean(parsed.simulateOffline),
      frameBudgetStressMs: Math.max(0, Math.min(32, Number(parsed.frameBudgetStressMs) || 0)),
    };
  } catch {
    return DEFAULT_DIGITAL_TWIN;
  }
}

export function saveDigitalTwinConfig(cfg: DigitalTwinConfig): void {
  try {
    window.localStorage.setItem(TWIN_KEY, JSON.stringify(cfg));
  } catch {
    // Ignore
  }
}
