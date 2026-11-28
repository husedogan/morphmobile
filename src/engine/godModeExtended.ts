/**
 * MORPH // GOD MODE — Extended Client Engines (Phases 5–10)
 * Provider Adapter API client, Model Presets, Prompt Versioning, Token Budgets,
 * Custom Scoped Agents & Delegation, Visual Workflow Studio, Real Media Job History,
 * DNS/TLS Network Probe, Integrity-Hashed Snapshots & Isolated Digital Twin Profiles.
 */

import {getGodModeAuthHeaders, hasInMemorySessionToken} from './godModeSecurity';
import {GodModeLang} from './godModeI18n';
import {GodModeBrandMode, GodModeThemeId} from './godModeThemes';
import {pushGodModeLog} from './godModeTelemetry';

// ============================================================================
// CRYPTO INTEGRITY HELPER
// ============================================================================
export async function computeSha256Hex(input: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const bytes = new TextEncoder().encode(input);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Deterministic lightweight fallback only if SubtleCrypto unavailable
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv_${(h >>> 0).toString(16).padStart(8, '0')}`;
}

// ============================================================================
// PHASE 5: AI LAB — PROVIDER ADAPTER, MODEL REGISTRY, VERSIONS & BUDGET
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

export interface CustomModelPreset {
  id: string;
  name: string;
  baseModel: GodModeAiModelId;
  temperature: number;
  maxOutputTokens: number;
  thinkingLevel: GodModeThinkingLevel;
  responseMimeType: 'text/plain' | 'application/json';
  timeoutMs: number;
}

export interface PromptVersionEntry {
  id: string;
  label: string;
  ts: string;
  model: GodModeAiModelId;
  systemInstruction: string;
  prompt: string;
}

export interface AiBudgetState {
  capTokens: number;
  usedTokens: number;
}

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

export interface AiHealthStatus {
  ok: boolean;
  provider: string;
  configured: boolean;
  reachable: boolean | null;
  latencyMs: number | null;
  models: string[];
  aiTokensUsedTotal: number;
  sampleReply?: string;
  detail?: string;
}

const AI_HISTORY_KEY = 'morph_godmode_ai_history_v1';
const AI_PRESETS_KEY = 'morph_godmode_ai_presets_v1';
const AI_VERSIONS_KEY = 'morph_godmode_ai_prompt_versions_v1';
const AI_BUDGET_KEY = 'morph_godmode_ai_budget_v1';

export const DEFAULT_AI_MODEL_PRESETS: CustomModelPreset[] = [
  {
    id: 'preset_balanced',
    name: 'Balanced Architect',
    baseModel: 'gemini-4-hydrogen',
    temperature: 0.4,
    maxOutputTokens: 2048,
    thinkingLevel: 'MEDIUM',
    responseMimeType: 'text/plain',
    timeoutMs: 25000,
  },
  {
    id: 'preset_json_strict',
    name: 'Strict JSON Extractor',
    baseModel: 'gemini-3.1-flash-lite',
    temperature: 0.1,
    maxOutputTokens: 1024,
    thinkingLevel: 'LOW',
    responseMimeType: 'application/json',
    timeoutMs: 15000,
  },
];

export function loadAiPresets(): CustomModelPreset[] {
  try {
    const raw = window.localStorage.getItem(AI_PRESETS_KEY);
    if (!raw) return DEFAULT_AI_MODEL_PRESETS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_AI_MODEL_PRESETS;
  } catch {
    return DEFAULT_AI_MODEL_PRESETS;
  }
}

export function saveAiPresets(list: CustomModelPreset[]): void {
  try {
    window.localStorage.setItem(AI_PRESETS_KEY, JSON.stringify(list.slice(0, 12)));
  } catch {
    // Ignore
  }
}

export function loadPromptVersions(): PromptVersionEntry[] {
  try {
    const raw = window.localStorage.getItem(AI_VERSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 30) : [];
  } catch {
    return [];
  }
}

export function savePromptVersions(list: PromptVersionEntry[]): void {
  try {
    window.localStorage.setItem(AI_VERSIONS_KEY, JSON.stringify(list.slice(0, 30)));
  } catch {
    // Ignore
  }
}

export function loadAiBudget(): AiBudgetState {
  try {
    const raw = window.localStorage.getItem(AI_BUDGET_KEY);
    if (!raw) return {capTokens: 150000, usedTokens: 0};
    const parsed = JSON.parse(raw) as Partial<AiBudgetState>;
    return {
      capTokens: Math.max(1000, Math.min(10_000_000, Number(parsed.capTokens) || 150000)),
      usedTokens: Math.max(0, Number(parsed.usedTokens) || 0),
    };
  } catch {
    return {capTokens: 150000, usedTokens: 0};
  }
}

export function saveAiBudget(state: AiBudgetState): void {
  try {
    window.localStorage.setItem(AI_BUDGET_KEY, JSON.stringify(state));
  } catch {
    // Ignore
  }
}

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
    // Ignore
  }
}

export async function checkAiProviderHealth(
  liveTest = false
): Promise<{ok: true; health: AiHealthStatus} | {ok: false; error: string; needsAuth?: boolean}> {
  if (!hasInMemorySessionToken()) {
    return {ok: false, error: 'Sahip oturumu doğrulanmalı.', needsAuth: true};
  }
  try {
    const res = await fetch(`/api/godmode/ai/health${liveTest ? '?liveTest=true' : ''}`, {
      headers: getGodModeAuthHeaders(),
      cache: 'no-store',
    });
    const data = (await res.json().catch(() => ({}))) as Partial<AiHealthStatus> & {detail?: string};
    if (res.status === 401 || res.status === 403) {
      return {ok: false, error: data.detail || `HTTP ${res.status}`, needsAuth: res.status === 401};
    }
    if (!res.ok) {
      return {ok: false, error: data.detail || `HTTP ${res.status}`};
    }
    return {
      ok: true,
      health: {
        ok: Boolean(data.ok),
        provider: data.provider || 'google-genai',
        configured: Boolean(data.configured),
        reachable: data.reachable ?? null,
        latencyMs: data.latencyMs ?? null,
        models: Array.isArray(data.models) ? data.models : [],
        aiTokensUsedTotal: Number(data.aiTokensUsedTotal) || 0,
        sampleReply: data.sampleReply,
        detail: data.detail,
      },
    };
  } catch (err) {
    return {ok: false, error: err instanceof Error ? err.message : 'Network error'};
  }
}

export async function runGodModeAiPrompt(
  params: {
    model: GodModeAiModelId;
    prompt: string;
    systemInstruction?: string;
    thinkingLevel?: GodModeThinkingLevel;
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: 'text/plain' | 'application/json';
    timeoutMs?: number;
  },
  signal?: AbortSignal
): Promise<
  | {ok: true; model: GodModeAiModelId; text: string; latencyMs: number; usage: AiTokenUsage}
  | {ok: false; error: string; needsAuth?: boolean; cancelled?: boolean}
> {
  if (!hasInMemorySessionToken()) {
    return {ok: false, error: 'Sahip oturumu doğrulanmalı.', needsAuth: true};
  }
  try {
    const res = await fetch('/api/godmode/ai/generate', {
      method: 'POST',
      headers: getGodModeAuthHeaders(),
      body: JSON.stringify(params),
      signal,
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
    if (signal?.aborted) {
      return {ok: false, error: 'İstek iptal edildi.', cancelled: true};
    }
    return {ok: false, error: err instanceof Error ? err.message : 'Network error'};
  }
}

// ============================================================================
// PHASE 6: AUTONOMOUS AGENTS — SCOPED TOOLS, CUSTOM AGENTS & DELEGATION
// ============================================================================
export type GodModeAgentId =
  | 'architect'
  | 'auditor'
  | 'qa'
  | 'performance'
  | 'media'
  | 'security'
  | 'automation'
  | 'self_evolution'
  | string;

export type AgentToolScope =
  | 'telemetry_read'
  | 'diagnostics_read'
  | 'storage_read'
  | 'network_read'
  | 'media_read';

export const ALL_AGENT_TOOL_SCOPES: ReadonlyArray<AgentToolScope> = [
  'telemetry_read',
  'diagnostics_read',
  'storage_read',
  'network_read',
  'media_read',
];

export interface CustomAgentProfile {
  id: string;
  name: string;
  systemInstruction: string;
  allowedTools: AgentToolScope[];
  model: GodModeAiModelId;
  retryCount: 0 | 1 | 2;
}

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
  agentName?: string;
  model: string;
  latencyMs: number;
  usage: AiTokenUsage;
  allowedTools?: string[];
  delegationDepth?: number;
  attempts?: number;
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
const CUSTOM_AGENTS_KEY = 'morph_godmode_custom_agents_v1';

export function loadCustomAgents(): CustomAgentProfile[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_AGENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function saveCustomAgents(list: CustomAgentProfile[]): void {
  try {
    window.localStorage.setItem(CUSTOM_AGENTS_KEY, JSON.stringify(list.slice(0, 12)));
  } catch {
    // Ignore
  }
}

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

export async function runGodModeAgent(
  params: {
    agentId: GodModeAgentId;
    agentName?: string;
    customAgent?: {
      name: string;
      systemInstruction: string;
      allowedTools: AgentToolScope[];
    };
    allowedTools?: AgentToolScope[];
    delegatedFrom?: {
      agentName: string;
      summary: string;
      depth: number;
    };
    model?: GodModeAiModelId;
    lang: GodModeLang;
    focusPrompt?: string;
    runtimeContext: Record<string, unknown>;
    retryCount?: 0 | 1 | 2;
    timeoutMs?: number;
  },
  signal?: AbortSignal
): Promise<
  | {ok: true; run: AgentRunRecord}
  | {ok: false; error: string; needsAuth?: boolean; cancelled?: boolean}
> {
  if (!hasInMemorySessionToken()) {
    return {ok: false, error: 'Sahip oturumu doğrulanmalı.', needsAuth: true};
  }
  const maxAttempts = Math.min(3, Math.max(1, (params.retryCount ?? 0) + 1));
  let lastError = 'Unknown agent error';

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (signal?.aborted) {
      return {ok: false, error: 'Ajan çalıştırması iptal edildi.', cancelled: true};
    }
    try {
      const res = await fetch('/api/godmode/ai/agent', {
        method: 'POST',
        headers: getGodModeAuthHeaders(),
        body: JSON.stringify(params),
        signal,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        agentId?: GodModeAgentId;
        model?: string;
        latencyMs?: number;
        usage?: AiTokenUsage;
        allowedTools?: string[];
        delegationDepth?: number;
        report?: AgentReport;
        detail?: string;
      };
      if (res.status === 401 || res.status === 403) {
        return {ok: false, error: data.detail || `HTTP ${res.status}`, needsAuth: res.status === 401};
      }
      if (!res.ok || !data.ok || !data.report) {
        lastError = data.detail || `HTTP ${res.status}`;
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 450 * attempt));
          continue;
        }
        return {ok: false, error: lastError};
      }
      const run: AgentRunRecord = {
        id: `ag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        ts: new Date().toISOString(),
        agentId: data.agentId ?? params.agentId,
        agentName: params.agentName,
        model: data.model ?? params.model ?? 'gemini-4-hydrogen',
        latencyMs: data.latencyMs ?? 0,
        usage: data.usage ?? {promptTokens: 0, candidatesTokens: 0, totalTokens: 0},
        allowedTools: data.allowedTools,
        delegationDepth: data.delegationDepth,
        attempts: attempt,
        report: data.report,
      };
      pushGodModeLog('info', 'agents', `Agent ${params.agentId} tamamlandı (${run.latencyMs}ms)`);
      return {ok: true, run};
    } catch (err) {
      if (signal?.aborted) {
        return {ok: false, error: 'Ajan çalıştırması iptal edildi.', cancelled: true};
      }
      lastError = err instanceof Error ? err.message : 'Network error';
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 450 * attempt));
        continue;
      }
    }
  }
  return {ok: false, error: lastError};
}

// ============================================================================
// PHASE 4 EXPERIMENTAL LAB FEATURE FLAGS
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

export const GOD_MODE_FLAGS_EVENT = 'morph:gm-flags-changed';

export function isGodModeFlagEnabled(key: string): boolean {
  const flags = loadGodModeFlags();
  const found = flags.find((f) => f.key === key);
  return found ? found.value : false;
}

function notifyGodModeFlagsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GOD_MODE_FLAGS_EVENT));
  }
}

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
  notifyGodModeFlagsChanged();
}

export function resetGodModeFlags(): GodModeFeatureFlag[] {
  try {
    window.localStorage.removeItem(FLAGS_KEY);
  } catch {
    // Ignore
  }
  notifyGodModeFlagsChanged();
  return DEFAULT_GOD_MODE_FLAGS.map((def) => ({...def, value: def.defaultValue}));
}

// ============================================================================
// PHASE 7: AUTOMATION STUDIO WORKFLOWS — TRIGGERS, GATES, RETRIES & HISTORY
// ============================================================================
export type WorkflowTriggerMode = 'manual' | 'on_open' | 'interval_30s';
export type WorkflowConditionGate =
  | 'always'
  | 'if_fps_lt_45'
  | 'if_heap_gt_80mb'
  | 'if_offline'
  | 'if_storage_gt_50kb';

export type WorkflowStepType =
  | 'telemetry_check'
  | 'diagnostics_run'
  | 'storage_audit'
  | 'api_ping'
  | 'create_snapshot'
  | 'ai_summary'
  | 'media_bench'
  | 'json_export';

export interface WorkflowStep {
  id: string;
  type: WorkflowStepType;
  retryCount?: 0 | 1 | 2;
}

export interface GodModeWorkflow {
  id: string;
  nameTr: string;
  nameEn: string;
  trigger?: WorkflowTriggerMode;
  condition?: WorkflowConditionGate;
  steps: WorkflowStep[];
  lastRunAt?: string;
  lastStatus?: 'pass' | 'warn' | 'fail';
}

export interface WorkflowExecutionRecord {
  id: string;
  workflowId: string;
  workflowName: string;
  ts: string;
  trigger: WorkflowTriggerMode;
  condition: WorkflowConditionGate;
  conditionPassed: boolean;
  durationMs: number;
  status: 'pass' | 'warn' | 'fail' | 'skipped' | 'cancelled';
  steps: Array<{
    stepType: WorkflowStepType;
    status: 'pass' | 'warn' | 'fail';
    attempts: number;
    detail: string;
  }>;
}

const WORKFLOWS_KEY = 'morph_godmode_workflows_v1';
const WORKFLOW_HISTORY_KEY = 'morph_godmode_wf_history_v1';

export const DEFAULT_GOD_MODE_WORKFLOWS: GodModeWorkflow[] = [
  {
    id: 'wf_health_sweep',
    nameTr: 'Tam Sistem Sağlık Taraması',
    nameEn: 'Full System Health Sweep',
    trigger: 'manual',
    condition: 'always',
    steps: [
      {id: 'st_1', type: 'telemetry_check', retryCount: 0},
      {id: 'st_2', type: 'api_ping', retryCount: 1},
      {id: 'st_3', type: 'diagnostics_run', retryCount: 0},
      {id: 'st_4', type: 'storage_audit', retryCount: 0},
    ],
  },
  {
    id: 'wf_safe_checkpoint',
    nameTr: 'Güvenli Kontrol Noktası & Yedek',
    nameEn: 'Safe Checkpoint & Backup',
    trigger: 'manual',
    condition: 'always',
    steps: [
      {id: 'st_a', type: 'storage_audit', retryCount: 0},
      {id: 'st_b', type: 'create_snapshot', retryCount: 0},
      {id: 'st_c', type: 'json_export', retryCount: 0},
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

export function loadWorkflowHistory(): WorkflowExecutionRecord[] {
  try {
    const raw = window.localStorage.getItem(WORKFLOW_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 30) : [];
  } catch {
    return [];
  }
}

export function saveWorkflowHistory(items: WorkflowExecutionRecord[]): void {
  try {
    window.localStorage.setItem(WORKFLOW_HISTORY_KEY, JSON.stringify(items.slice(0, 30)));
  } catch {
    // Ignore
  }
}

// ============================================================================
// PHASE 8: MEDIA ENGINE LAB HISTORY
// ============================================================================
export interface MediaLabJobRecord {
  id: string;
  ts: string;
  preset: string;
  codecUsed: string;
  ok: boolean;
  cancelled?: boolean;
  durationMs: number;
  outputBytes: number;
  error?: string;
}

const MEDIA_HISTORY_KEY = 'morph_godmode_media_history_v1';

export function loadMediaJobHistory(): MediaLabJobRecord[] {
  try {
    const raw = window.localStorage.getItem(MEDIA_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 25) : [];
  } catch {
    return [];
  }
}

export function saveMediaJobHistory(items: MediaLabJobRecord[]): void {
  try {
    window.localStorage.setItem(MEDIA_HISTORY_KEY, JSON.stringify(items.slice(0, 25)));
  } catch {
    // Ignore
  }
}

// ============================================================================
// PHASE 9: NETWORK LAB PROBE (DNS + TLS + HTTP + ERROR TAXONOMY)
// ============================================================================
export interface NetworkTlsInfo {
  protocol: string | null;
  cipherName: string | null;
  alpnProtocol: string | null;
  authorized: boolean;
  authorizationError: string | null;
  subjectCN: string | null;
  issuerO: string | null;
  validFrom: string | null;
  validTo: string | null;
  daysRemaining: number | null;
  tlsMs: number;
}

export interface NetworkDnsRecords {
  a: string[];
  aaaa: string[];
  cname: string[];
  mx: string[];
}

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
  dnsMs?: number;
  resolvedIp: string | null;
  dnsRecords?: NetworkDnsRecords;
  tlsInfo?: NetworkTlsInfo | null;
  errorCategory?: 'SSRF_BLOCKED' | 'DNS_ERROR' | 'TLS_ERROR' | 'TIMEOUT' | 'HTTP_ERROR' | null;
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
      dnsMs: data.dnsMs,
      resolvedIp: data.resolvedIp ?? null,
      dnsRecords: data.dnsRecords,
      tlsInfo: data.tlsInfo ?? null,
      errorCategory: data.errorCategory ?? null,
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
      errorCategory: res.status >= 400 ? 'HTTP_ERROR' : null,
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
      errorCategory: 'HTTP_ERROR',
      contentType: null,
      serverHeader: null,
      cacheControl: null,
      redirectedTo: null,
    };
  }
}

// ============================================================================
// PHASE 9: TIME MACHINE SNAPSHOTS (COMPLETE STATE, SHA-256 & RESTORE HISTORY)
// ============================================================================
export interface GodModeConfigSnapshot {
  id: string;
  ts: string;
  label: string;
  theme: GodModeThemeId;
  lang: GodModeLang;
  brandMode: GodModeBrandMode;
  flags: Record<string, boolean>;
  workflowCount: number;
  workflows?: GodModeWorkflow[];
  aiBudgetCapTokens?: number;
  sha256?: string;
}

export interface SnapshotRestoreRecord {
  id: string;
  ts: string;
  snapshotId: string;
  snapshotLabel: string;
  restoredFields: string[];
}

const SNAPSHOTS_KEY = 'morph_godmode_snapshots_v1';
const RESTORE_HISTORY_KEY = 'morph_godmode_restore_history_v1';

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

export function loadSnapshotRestoreHistory(): SnapshotRestoreRecord[] {
  try {
    const raw = window.localStorage.getItem(RESTORE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 25) : [];
  } catch {
    return [];
  }
}

export function recordSnapshotRestore(rec: SnapshotRestoreRecord): SnapshotRestoreRecord[] {
  const next = [rec, ...loadSnapshotRestoreHistory()].slice(0, 25);
  try {
    window.localStorage.setItem(RESTORE_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return next;
}

export function createGodModeSnapshot(params: {
  label: string;
  theme: GodModeThemeId;
  lang: GodModeLang;
  brandMode?: GodModeBrandMode;
}): GodModeConfigSnapshot {
  const flagsList = loadGodModeFlags();
  const flags: Record<string, boolean> = {};
  for (const f of flagsList) flags[f.key] = f.value;
  const workflows = loadGodModeWorkflows();
  const budget = loadAiBudget();
  const snap: GodModeConfigSnapshot = {
    id: `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    ts: new Date().toISOString(),
    label: params.label.trim() || 'Snapshot',
    theme: params.theme,
    lang: params.lang,
    brandMode: params.brandMode ?? 'administrator',
    flags,
    workflowCount: workflows.length,
    workflows,
    aiBudgetCapTokens: budget.capTokens,
  };
  const existing = loadGodModeSnapshots();
  saveGodModeSnapshots([snap, ...existing]);
  // Asynchronously stamp exact SHA-256 digest onto stored snapshot without breaking sync callers
  void computeSha256Hex(
    JSON.stringify({
      theme: snap.theme,
      lang: snap.lang,
      brandMode: snap.brandMode,
      flags: snap.flags,
      workflows: snap.workflows,
      aiBudgetCapTokens: snap.aiBudgetCapTokens,
    })
  ).then((digest) => {
    snap.sha256 = digest;
    const latest = loadGodModeSnapshots().map((s) => (s.id === snap.id ? {...s, sha256: digest} : s));
    saveGodModeSnapshots(latest);
  });
  pushGodModeLog('info', 'time_machine', `Snapshot created: ${snap.label}`);
  return snap;
}

// ============================================================================
// PHASE 10: DIGITAL TWIN FAULT SIMULATION STATE & ISOLATED PROFILES
// ============================================================================
export interface DigitalTwinConfig {
  simulatedLatencyMs: number;
  errorRatePct: number;
  simulateOffline: boolean;
  frameBudgetStressMs: number;
}

export interface DigitalTwinProfile {
  id: string;
  name: string;
  config: DigitalTwinConfig;
  createdAt: string;
}

const TWIN_KEY = 'morph_godmode_twin_v1';
const TWIN_PROFILES_KEY = 'morph_godmode_twin_profiles_v1';

export const DEFAULT_DIGITAL_TWIN: DigitalTwinConfig = {
  simulatedLatencyMs: 0,
  errorRatePct: 0,
  simulateOffline: false,
  frameBudgetStressMs: 0,
};

export const DEFAULT_DIGITAL_TWIN_PROFILES: DigitalTwinProfile[] = [
  {
    id: 'prof_3g',
    name: '3G High-Latency Edge',
    config: {simulatedLatencyMs: 850, errorRatePct: 8, simulateOffline: false, frameBudgetStressMs: 6},
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'prof_blackout',
    name: 'Offline Blackout',
    config: {simulatedLatencyMs: 0, errorRatePct: 100, simulateOffline: true, frameBudgetStressMs: 0},
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'prof_thermal',
    name: 'Thermal Throttle 24ms',
    config: {simulatedLatencyMs: 240, errorRatePct: 4, simulateOffline: false, frameBudgetStressMs: 24},
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

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

export function loadDigitalTwinProfiles(): DigitalTwinProfile[] {
  try {
    const raw = window.localStorage.getItem(TWIN_PROFILES_KEY);
    if (!raw) return DEFAULT_DIGITAL_TWIN_PROFILES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.slice(0, 12) : DEFAULT_DIGITAL_TWIN_PROFILES;
  } catch {
    return DEFAULT_DIGITAL_TWIN_PROFILES;
  }
}

export function saveDigitalTwinProfiles(profiles: DigitalTwinProfile[]): void {
  try {
    window.localStorage.setItem(TWIN_PROFILES_KEY, JSON.stringify(profiles.slice(0, 12)));
  } catch {
    // Ignore
  }
}
