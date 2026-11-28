/**
 * MORPH // GOD MODE — Independent Centralized Localization System (TR default + EN)
 * Strictly isolated from normal Morph language preferences (`morph_godmode_lang_v1`).
 */

export type GodModeLang = 'tr' | 'en';

const GOD_MODE_LANG_KEY = 'morph_godmode_lang_v1';

export function loadGodModeLang(): GodModeLang {
  try {
    if (typeof window === 'undefined') return 'tr';
    const stored = window.localStorage.getItem(GOD_MODE_LANG_KEY);
    if (stored === 'en' || stored === 'tr') return stored;
    return 'tr';
  } catch {
    return 'tr';
  }
}

export function saveGodModeLang(lang: GodModeLang): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(GOD_MODE_LANG_KEY, lang);
  } catch {
    // Ignore storage quota errors
  }
}

export function getGodModeLocale(lang: GodModeLang): string {
  return lang === 'tr' ? 'tr-TR' : 'en-US';
}

export function fmtGodNumber(value: number, lang: GodModeLang): string {
  return new Intl.NumberFormat(getGodModeLocale(lang)).format(value);
}

export function fmtGodPercent(value: number, lang: GodModeLang): string {
  const rounded = Math.round(value);
  return lang === 'tr' ? `%${rounded}` : `${rounded}%`;
}

export function fmtGodTime(ts: number | string, lang: GodModeLang): string {
  return new Date(ts).toLocaleTimeString(getGodModeLocale(lang), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function fmtGodShortTime(ts: number | string, lang: GodModeLang): string {
  return new Date(ts).toLocaleTimeString(getGodModeLocale(lang), {
    minute: '2-digit',
    second: '2-digit',
  });
}

export function fmtGodDateTime(ts: number | string, lang: GodModeLang): string {
  return new Date(ts).toLocaleString(getGodModeLocale(lang));
}

export function fmtGodBytes(bytes: number | null, lang: GodModeLang): string {
  if (bytes === null || !Number.isFinite(bytes)) return '—';
  const locale = getGodModeLocale(lang);
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toLocaleString(locale, {maximumFractionDigits: 1})} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toLocaleString(locale, {maximumFractionDigits: 1})} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toLocaleString(locale, {maximumFractionDigits: 2})} GB`;
}

export function fmtGodUptime(sec: number, lang: GodModeLang): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (lang === 'tr') {
    if (h > 0) return `${h} sa ${m} dk ${s} sn`;
    if (m > 0) return `${m} dk ${s} sn`;
    return `${s} sn`;
  }
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export interface GodModeDictionary {
  // Navigation & Modules
  modules: {
    dashboard: {label: string; short: string; summary: string};
    design_lab: {label: string; short: string; summary: string};
    system_core: {label: string; short: string; summary: string};
    performance_lab: {label: string; short: string; summary: string};
    ui_inspector: {label: string; short: string; summary: string};
    animation_lab: {label: string; short: string; summary: string};
    diagnostics: {label: string; short: string; summary: string};
    dev_toolkit: {label: string; short: string; summary: string};
    security_center: {label: string; short: string; summary: string};
    settings: {label: string; short: string; summary: string};
    deadpool_studio: {label: string; short: string; summary: string};
    chaos_lab: {label: string; short: string; summary: string};
    ai_lab: {label: string; short: string; summary: string};
    autonomous_agents: {label: string; short: string; summary: string};
    experimental_lab: {label: string; short: string; summary: string};
    experimental_tools: {label: string; short: string; summary: string};
    logs_events: {label: string; short: string; summary: string};
    media_engine: {label: string; short: string; summary: string};
    terminal: {label: string; short: string; summary: string};
    automation_studio: {label: string; short: string; summary: string};
    network_lab: {label: string; short: string; summary: string};
    storage_lab: {label: string; short: string; summary: string};
    time_machine: {label: string; short: string; summary: string};
    digital_twin: {label: string; short: string; summary: string};
  };
  shell: {
    activeSection: string;
    roadmapSection: string;
    roadmapShort: string;
    allModules: string;
    collapseDock: string;
    expandDock: string;
    iconsOnly: string;
    previewTag: string;
    close: string;
    ownerVerified: string;
    localVerified: string;
    claimOwner: string;
    verifySession: string;
    checking: string;
    plannedSlot: string;
    plannedNote: string;
    openLiveModule: string;
    backToDashboard: string;
    deadpoolStudioTitle: string;
    chaosLabTitle: string;
    designAppliedToast: (name: string) => string;
    langChangedToast: (langName: string) => string;
    brandChangedToast: (brandName: string) => string;
  };
  overview: {
    frameRate: string;
    frameBuckets: string;
    stability: string;
    nominal: string;
    errorsSuffix: string;
    localTag: string;
    keysSuffix: string;
    telemetryTitle: string;
    fpsMode: string;
    loadMode: string;
    sourcesTitle: string;
    inspect: string;
    netAndEvents: string;
    domNodes: string;
    activeModules: string;
    liveCount: (n: number) => string;
    providersTitle: string;
    ready: string;
    noKey: string;
    active: string;
    idle: string;
    offline: string;
    verified: string;
    localMode: string;
    bundled: string;
    cdn: string;
    probesCount: (n: number) => string;
    reqCount: (n: number) => string;
    recentEvents: string;
    noEvents: string;
    topologyTitle: string;
    moduleGraph: string;
    eventsCount: (n: number) => string;
    openDesignLab: string;
    topoLabels: {
      core: string;
      ffmpeg: string;
      state: string;
      auth: string;
      themes: string;
      chaos: string;
    };
  };
  designLab: {
    title: string;
    compare: string;
    restorePrev: (name: string) => string;
    resetDefault: string;
    livePreviewLabel: string;
    savedLabel: string;
    cancelPreview: string;
    applyAndSave: string;
    compareTitle: string;
    select: string;
    defaultBadge: string;
    altBadge: (n: number) => string;
    experimentalBadge: string;
    previewing: string;
    livePreviewBtn: string;
    activeDesign: string;
    apply: string;
    persistedDesign: string;
    isolatedNote: string;
    allFilter: string;
    coreFilter: string;
    liveFpsStream: string;
    unsupported: string;
    layoutModes: {
      obsidian: string;
      cyber: string;
      minimal: string;
      holographic: string;
      terminal: string;
    };
    tabs: {
      panelThemes: string;
      morphUi: string;
    };
  };
  systemCore: {
    title: string;
    probeLatency: string;
    exportSnapshot: string;
    snapshotExported: string;
    fpsFrameTime: string;
    drops: string;
    unsupported: string;
    chromiumOnly: string;
    backendLatency: string;
    online: string;
    offline: string;
    domViewport: string;
    liveRender: string;
    samples: string;
    targetFps: string;
    collecting: string;
    hardwareMemory: string;
    cpuCores: string;
    osCpuPct: string;
    browserSandboxNote: string;
    deviceRam: string;
    notExposed: string;
    storageSubsystems: string;
    storageQuota: string;
    keys: string;
    cacheSw: string;
    swActive: string;
    swIdle: string;
    nativeBridge: string;
    androidNativeActive: string;
    runtimeSuffix: string;
    serverHealth: string;
    connected: string;
    locked: string;
    runtime: string;
    uptime: string;
    serverMemory: string;
    serverEngines: string;
    serverLockedHint: string;
    ready: string;
    noKey: string;
    bundled: string;
    cdn: string;
    fullscreen: string;
    wakeLock: string;
  };
  diagnostics: {
    title: string;
    copyJson: string;
    running: string;
    runAll: string;
    emptyTitle: string;
    emptyHint: string;
    startProbes: string;
    passed: string;
    warnings: string;
    failed: string;
    statusPass: string;
    statusWarn: string;
    statusFail: string;
    doneToast: (pass: number, total: number) => string;
    copiedToast: string;
  };
  devToolkit: {
    title: string;
    tabs: {
      modules: string;
      state: string;
      inspectors: string;
      logs: string;
      network: string;
      profiler: string;
      build: string;
    };
    directDeps: string;
    leafLayer: string;
    searchPlaceholder: string;
    copyMaskedJson: string;
    copiedStateToast: string;
    clear: string;
    logLevels: {all: string; info: string; warn: string; error: string};
    noLogs: string;
    networkHint: string;
    noNetwork: string;
    method: string;
    endpoint: string;
    status: string;
    latency: string;
    errTag: string;
    profiler: {
      ttfb: string;
      fcp: string;
      domInteractive: string;
      domComplete: string;
      resources: string;
      liveDom: string;
    };
    build: {
      appVersion: string;
      channel: string;
      platform: string;
      viewport: string;
      nodeVersion: string;
      geminiKey: string;
      passcodeSource: string;
      userAgent: string;
      offlineLocked: string;
      configuredMasked: string;
      notSet: string;
      unknownLocked: string;
      localLocked: string;
    };
  };
  security: {
    title: string;
    refresh: string;
    signOut: string;
    authStatus: string;
    verifiedDevices: string;
    failedLogins: string;
    sessionStorage: string;
    ownerVerified: string;
    localVerified: string;
    setupRequired: string;
    locked: string;
    total: string;
    rateLimit: string;
    ramOnly: string;
    offlineLocal: string;
    none: string;
    zeroLocalToken: string;
    expPrefix: string;
    claimTitle: string;
    verifyTitle: string;
    claimHint: string;
    verifyHint: string;
    passcodeLabel: string;
    confirmPasscodeLabel: string;
    deviceLabel: string;
    claimBtn: string;
    verifyBtn: string;
    devicePlaceholder: string;
    save: string;
    thisDevice: string;
    revoke: string;
    revokePrompt: (id: string) => string;
    reenterPasscode: string;
    cancel: string;
    confirmRevoke: string;
    auditTitle: string;
    entries: string;
    noAudit: string;
    errMinPasscode: string;
    errMismatch: string;
    errEnterPasscode: string;
    errClaimFailed: string;
    errVerifyFailed: string;
    errRevokeFailed: string;
    toastClaimed: string;
    toastVerified: string;
    toastDeviceSaved: string;
    toastSelfRevoked: string;
    toastRevoked: string;
    toastSignedOut: string;
    ownerEmailLabel: string;
    ownerEmailPlaceholder: string;
    bootstrapTokenLabel: string;
    recoveryCodesTitle: string;
    recoveryHint: string;
    recoveryCodesAck: string;
    openRecoverBtn: string;
    recoverTitle: string;
    recoveryCodeLabel: string;
    newPasscodeLabel: string;
    recoverSubmitBtn: string;
    regenRecoveryBtn: string;
    passkeyTitle: string;
    enrollPasskeyBtn: string;
    loginPasskeyBtn: string;
    passkeysCount: string;
    deviceCryptoTitle: string;
    verifyDeviceCryptoBtn: string;
    cryptoVerifiedBadge: string;
    cryptoPendingBadge: string;
    androidKeystoreNote: string;
    rotateKeyBtn: string;
    activeKeyLabel: string;
    sessionsTitle: string;
    revokeSessionBtn: string;
    revokeOtherSessionsBtn: string;
    persistenceTitle: string;
    ephemeralWarning: string;
    durableOk: string;
    storeLockedTitle: string;
    errInvalidEmail: string;
    errMinPasscode8: string;
    toastDeviceCryptoOk: string;
    toastPasskeyAdded: string;
    toastKeyRotated: string;
    toastRecovered: string;
    toastSessionRevoked: string;
    toastRegenCodes: string;
  };
  settings: {
    title: string;
    languageTitle: string;
    languageDesc: string;
    trLabel: string;
    enLabel: string;
    isolatedBadge: string;
    designTitle: string;
    activeTheme: string;
    openDesignLab: string;
    resetToDefault: string;
    layoutTitle: string;
    dockMode: string;
    dockIcons: string;
    dockExpanded: string;
    securityTitle: string;
    openSecurity: string;
    currentSession: string;
    brandTitle: string;
    brandDesc: string;
    brandAdmin: string;
    brandGodMode: string;
  };
  aiLab: {
    title: string;
    modelsTab: string;
    studioTab: string;
    historyTab: string;
    modelLabel: string;
    thinkingLabel: string;
    systemLabel: string;
    systemPlaceholder: string;
    promptLabel: string;
    promptPlaceholder: string;
    runPrompt: string;
    running: string;
    clearHistory: string;
    copyOutput: string;
    copiedToast: string;
    authNeeded: string;
    openSecurity: string;
    outputTitle: string;
    emptyOutput: string;
    emptyHistory: string;
    promptTokens: string;
    outputTokens: string;
    totalTokens: string;
    latency: string;
    quickPrompts: ReadonlyArray<{label: string; prompt: string}>;
    healthTestBtn: string;
    providerOnline: string;
    providerOffline: string;
    cancelBtn: string;
    timeoutLabel: string;
    temperatureLabel: string;
    maxTokensLabel: string;
    mimeLabel: string;
    presetsLabel: string;
    saveVersionBtn: string;
    versionsLabel: string;
    exportVersionsBtn: string;
    importVersionsBtn: string;
    budgetTitle: string;
    budgetRemaining: string;
    budgetCapLabel: string;
    budgetExceeded: string;
  };
  agents: {
    title: string;
    agentsTab: string;
    evolutionTab: string;
    logsTab: string;
    runAgent: string;
    running: string;
    focusPlaceholder: string;
    generateProposal: string;
    noRuns: string;
    noProposals: string;
    authNeeded: string;
    openSecurity: string;
    findings: string;
    actions: string;
    risk: string;
    approve: string;
    reject: string;
    statusPending: string;
    statusApproved: string;
    statusRejected: string;
    gatedNote: string;
    roles: Record<
      'architect' | 'auditor' | 'qa' | 'performance' | 'media' | 'security' | 'automation',
      {name: string; scope: string}
    >;
    customAgentsTab: string;
    createCustomBtn: string;
    customNameLabel: string;
    customPromptLabel: string;
    toolScopesLabel: string;
    retryPolicyLabel: string;
    delegateBtn: string;
    delegatedFromLabel: string;
    exportReportBtn: string;
    cancelBtn: string;
    attemptsLabel: string;
    scopes: Record<
      'telemetry_read' | 'diagnostics_read' | 'storage_read' | 'network_read' | 'media_read',
      string
    >;
  };
  experimentalLab: {
    title: string;
    overrides: string;
    rollbackAll: string;
    resetToast: string;
    flagsTitle: string;
    morphPrefsTitle: string;
    defaultOn: string;
    defaultOff: string;
    modified: string;
    catRuntime: string;
    catMedia: string;
    catUi: string;
    catAi: string;
  };
  mediaLab: {
    title: string;
    coreStatus: string;
    wasmBundled: string;
    crossOrigin: string;
    sharedArrayBuffer: string;
    webAudio: string;
    supported: string;
    unavailable: string;
    builderTitle: string;
    presetLabel: string;
    formatLabel: string;
    codecLabel: string;
    crfLabel: string;
    fpsLabel: string;
    scaleLabel: string;
    copyCmd: string;
    copiedCmd: string;
    benchTitle: string;
    runBench: string;
    runningBench: string;
    framesRendered: string;
    avgFrameMs: string;
    throughput: string;
    benchDone: string;
    inspectEngineBtn: string;
    inspectingEngine: string;
    terminateEngineBtn: string;
    realBenchTitle: string;
    runRealBenchBtn: string;
    cancelBenchBtn: string;
    presetX264Ultra: string;
    presetX264Veryfast: string;
    presetAudioMp3: string;
    presetGifTest: string;
    encodersFound: string;
    decodersFound: string;
    historyTitle: string;
    noHistory: string;
    outputSize: string;
    durationLabel: string;
  };
  terminal: {
    title: string;
    placeholder: string;
    run: string;
    clear: string;
    exportLog: string;
    exportedToast: string;
    welcome: string;
    quickCmds: string;
  };
  automation: {
    title: string;
    runFlow: string;
    running: string;
    addStep: string;
    newFlow: string;
    deleteFlow: string;
    stepCount: (n: number) => string;
    lastRun: string;
    never: string;
    stepLabels: Record<
      | 'telemetry_check'
      | 'diagnostics_run'
      | 'storage_audit'
      | 'api_ping'
      | 'create_snapshot'
      | 'ai_summary'
      | 'media_bench'
      | 'json_export',
      string
    >;
    doneToast: (name: string) => string;
    triggerLabel: string;
    conditionLabel: string;
    triggers: Record<'manual' | 'on_open' | 'interval_30s', string>;
    conditions: Record<
      'always' | 'if_fps_lt_45' | 'if_heap_gt_80mb' | 'if_offline' | 'if_storage_gt_50kb',
      string
    >;
    retryLabel: string;
    cancelRunBtn: string;
    historyTab: string;
    flowCanvasTab: string;
    noHistory: string;
  };
  networkLab: {
    title: string;
    targetPlaceholder: string;
    serverProbe: string;
    originProbe: string;
    probing: string;
    presets: string;
    onlineStatus: string;
    connectionType: string;
    downlink: string;
    rtt: string;
    ssrfNote: string;
    historyTitle: string;
    emptyHistory: string;
    statusCol: string;
    latencyCol: string;
    ipCol: string;
    authNeeded: string;
    openSecurity: string;
    dnsTitle: string;
    tlsTitle: string;
    issuerLabel: string;
    protocolLabel: string;
    cipherLabel: string;
    expiryLabel: string;
    daysLeft: string;
    errorCategoryLabel: string;
  };
  storageLab: {
    title: string;
    refresh: string;
    exportBackup: string;
    exportedToast: string;
    localTab: string;
    idbTab: string;
    cacheTab: string;
    searchKeys: string;
    totalSize: string;
    keysCount: string;
    protectedKey: string;
    deleteKey: string;
    deletedToast: string;
    noIdb: string;
    noCaches: string;
    clearCache: string;
    cacheCleared: string;
    entriesSuffix: string;
    importBackupBtn: string;
    confirmTitle: string;
    confirmDeleteMsg: (key: string) => string;
    confirmClearMsg: (name: string) => string;
    confirmRestoreMsg: (count: number) => string;
    checksumValid: string;
    checksumInvalid: string;
    inspectIdbBtn: string;
    storesCount: string;
    recordsCount: string;
    urlsTitle: string;
    flushTempBtn: string;
    hardReloadBtn: string;
  };
  timeMachine: {
    title: string;
    labelPlaceholder: string;
    captureBtn: string;
    capturedToast: string;
    emptyTitle: string;
    emptyHint: string;
    restoreBtn: string;
    restoredToast: (label: string) => string;
    deleteBtn: string;
    compareTitle: string;
    currentState: string;
    selectedSnap: string;
    themeKey: string;
    langKey: string;
    overridesKey: string;
    workflowsKey: string;
    shaLabel: string;
    brandModeKey: string;
    restoreHistoryTitle: string;
    noRestoreHistory: string;
    confirmRestoreMsg: (label: string) => string;
  };
  digitalTwin: {
    title: string;
    resetBtn: string;
    runSimBtn: string;
    runningSim: string;
    openChaosBtn: string;
    latencyLabel: string;
    errorRateLabel: string;
    frameStressLabel: string;
    offlineLabel: string;
    resultsTitle: string;
    noResults: string;
    passRate: string;
    avgLatency: string;
    simulatedFrames: string;
    isolatedNote: string;
    liveMeasuredBadge: string;
    simulatedBadge: string;
    baselineCompareTitle: string;
    profilesTitle: string;
    saveProfileBtn: string;
    profileNamePlaceholder: string;
    applyProfileBtn: string;
  };
}

export const GOD_MODE_I18N: Record<GodModeLang, GodModeDictionary> = {
  tr: {
    modules: {
      dashboard: {label: 'Komuta Paneli', short: 'Panel', summary: 'Canlı telemetri ve sistem özeti.'},
      design_lab: {label: 'Tasarım Laboratuvarı', short: 'Tasarım', summary: 'İzole GOD MODE temaları ve canlı karşılaştırma.'},
      system_core: {label: 'Sistem İzleyici', short: 'Sistem', summary: 'Canlı FPS, bellek, depolama ve cihaz metrikleri.'},
      performance_lab: {label: 'Performans', short: 'Performans', summary: 'HUD kontrolü, kare hızı geçmişi ve JSON dışa aktarma.'},
      ui_inspector: {label: 'Arayüz Müfettişi', short: 'Arayüz', summary: 'Izgara, dokunma hedefleri ve canlı token denetimi.'},
      animation_lab: {label: 'Animasyon', short: 'Animasyon', summary: 'Global animasyon hızı, hareket ve dokunsal tezgâh.'},
      diagnostics: {label: 'Tanılama', short: 'Tanılama', summary: 'Sistem, depolama, ağ ve medya doğrulama testleri.'},
      dev_toolkit: {label: 'Geliştirici Araçları', short: 'Araçlar', summary: 'Modül grafiği, maskeli durum ve profilleyici.'},
      security_center: {label: 'Güvenlik Merkezi', short: 'Güvenlik', summary: 'Sahip doğrulama, cihaz yönetimi ve denetim günlüğü.'},
      settings: {label: 'Ayarlar', short: 'Ayarlar', summary: 'Bağımsız panel dili, tasarım ve görünüm tercihleri.'},
      deadpool_studio: {label: 'Deadpool Stüdyosu', short: 'Deadpool', summary: 'Özel logo, renk, maske ve efekt kontrolleri.'},
      chaos_lab: {label: 'Kaos Laboratuvarı', short: 'Kaos', summary: 'Risk dereceli, süre sınırlı ve kurtarmalı stres testleri.'},
      ai_lab: {label: 'Yapay Zekâ', short: 'Yapay Zekâ', summary: 'Model yönetimi, canlı istem stüdyosu ve token izleyici.'},
      autonomous_agents: {label: 'Otonom Ajanlar', short: 'Ajanlar', summary: 'Uzman ajanlar ve onay kapılı sistem önerileri.'},
      experimental_lab: {label: 'Özellik Bayrakları', short: 'Bayraklar', summary: 'Canlı özellik bayrakları ve tek tıkla geri alma.'},
      experimental_tools: {label: 'Deneysel Araçlar', short: 'Deneysel', summary: 'Deneysel etkileşim anahtarları ve platform motorları.'},
      logs_events: {label: 'Kayıtlar ve Olaylar', short: 'Kayıtlar', summary: 'Canlı çalışma zamanı olay akışı ve dışa aktarma.'},
      media_engine: {label: 'Medya Motorları', short: 'Medya', summary: 'FFmpeg WASM denetimi, komut oluşturucu ve test.'},
      terminal: {label: 'Terminal', short: 'Terminal', summary: 'Otomatik tamamlamalı canlı Morph komut motoru.'},
      automation_studio: {label: 'Otomasyon', short: 'Otomasyon', summary: 'Görsel otomasyon akış editörü ve çalıştırıcı.'},
      network_lab: {label: 'Ağ Tanılama', short: 'Ağ', summary: 'SSRF korumalı sunucu ve istemci gecikme testleri.'},
      storage_lab: {label: 'Depolama İnceleyici', short: 'Depolama', summary: 'LocalStorage, IndexedDB ve önbellek gezgini.'},
      time_machine: {label: 'Zaman Makinesi', short: 'Zaman', summary: 'Yapılandırma anlık görüntüleri ve geri yükleme.'},
      digital_twin: {label: 'Dijital İkiz', short: 'İkiz', summary: 'İzole hata enjeksiyonu ve gecikme simülatörü.'},
    },
    shell: {
      activeSection: 'Komuta Merkezi',
      roadmapSection: 'Platform Motorları',
      roadmapShort: 'Motorlar',
      allModules: 'Tüm Modüller',
      collapseDock: 'Simgelere Daralt',
      expandDock: 'Etiketleri Genişlet',
      iconsOnly: 'Simgeler',
      previewTag: 'Önizleme',
      close: 'Kapat',
      ownerVerified: 'SAHİP DOĞRULANDI',
      localVerified: 'YEREL OTURUM',
      claimOwner: 'SAHİP KURULUMU',
      verifySession: 'OTURUM DOĞRULA',
      checking: 'KONTROL...',
      plannedSlot: 'Planlı Modül',
      plannedNote: 'Sahte buton eklenmedi. Bu modül sıradaki fazda gerçek motorlarla aktif edilecek.',
      openLiveModule: 'Canlı Modüle Git',
      backToDashboard: 'Ana Ekrana Dön',
      deadpoolStudioTitle: 'Deadpool Çark Stüdyosu',
      chaosLabTitle: 'Kaos & Stres Laboratuvarı',
      designAppliedToast: (name) => `Tasarım uygulandı: ${name}`,
      langChangedToast: (langName) => `Panel dili: ${langName}`,
      brandChangedToast: (brandName) => `Panel başlığı: ${brandName}`,
    },
    overview: {
      frameRate: 'Kare Hızı',
      frameBuckets: 'Kare Akışı',
      stability: 'Sistem Sağlığı',
      nominal: 'stabil',
      errorsSuffix: 'hata',
      localTag: 'yerel',
      keysSuffix: 'anahtar',
      telemetryTitle: 'Canlı Performans Grafiği',
      fpsMode: 'FPS / ms',
      loadMode: 'Bellek / Yük',
      sourcesTitle: 'Kaynak Dağılımı',
      inspect: 'Detay',
      netAndEvents: 'Ağ & Olay',
      domNodes: 'DOM Düğümü',
      activeModules: 'Aktif Modüller',
      liveCount: (n) => `${n} aktif`,
      providersTitle: 'AI & Motor Durumu',
      ready: 'Hazır',
      noKey: 'Anahtar Yok',
      active: 'Aktif',
      idle: 'Beklemede',
      offline: 'Çevrimdışı',
      verified: 'Doğrulandı',
      localMode: 'Yerel',
      bundled: 'Yerel WASM',
      cdn: 'CDN',
      probesCount: (n) => `${n} test`,
      reqCount: (n) => `${n} istek`,
      recentEvents: 'Son Aktivite',
      noEvents: 'Henüz kayıtlı olay yok.',
      topologyTitle: 'Sistem Topolojisi',
      moduleGraph: 'Modül Grafiği',
      eventsCount: (n) => `${n} olay`,
      openDesignLab: 'Tasarım Laboratuvarı',
      topoLabels: {
        core: 'Sistem',
        ffmpeg: 'Medya',
        state: 'Araçlar',
        auth: 'Güvenlik',
        themes: 'Tasarım',
        chaos: 'Kaos',
      },
    },
    designLab: {
      title: 'Tasarım Laboratuvarı',
      compare: 'Karşılaştır',
      restorePrev: (name) => `Önceki (${name})`,
      resetDefault: 'Varsayılan',
      livePreviewLabel: 'Canlı Önizleme',
      savedLabel: 'Kayıtlı',
      cancelPreview: 'Kapat',
      applyAndSave: 'Uygula ve Kaydet',
      compareTitle: 'Canlı Karşılaştırma',
      select: 'Seç',
      defaultBadge: 'Varsayılan',
      altBadge: (n) => `Alternatif ${n}`,
      experimentalBadge: 'Deneysel',
      previewing: 'Önizlemede',
      livePreviewBtn: 'Önizle',
      activeDesign: 'Aktif',
      apply: 'Uygula',
      persistedDesign: 'Kayıtlı Tasarım',
      isolatedNote: 'Normal Morph temasından izole',
      allFilter: 'Tümü',
      coreFilter: 'Çekirdek',
      liveFpsStream: 'Canlı FPS Akışı',
      unsupported: 'Destek yok',
      layoutModes: {
        obsidian: 'Bento Kontrol Odası',
        cyber: 'Taktik HUD Izgarası',
        minimal: 'Veri Tablosu Düzeni',
        holographic: 'Katmanlı Cam Sahne',
        terminal: 'Saf Konsol TUI',
      },
      tabs: {
        panelThemes: 'Panel Temaları',
        morphUi: 'Morph Arayüz Motoru',
      },
    },
    systemCore: {
      title: 'Sistem Merkezi',
      probeLatency: 'Gecikme Ölç',
      exportSnapshot: 'JSON Dışa Aktar',
      snapshotExported: 'Performans verisi indirildi.',
      fpsFrameTime: 'Kare Hızı · Süre',
      drops: 'düşüş',
      unsupported: 'Destek yok',
      chromiumOnly: 'Yalnızca Chromium',
      backendLatency: 'Sunucu Gecikmesi',
      online: 'Çevrimiçi',
      offline: 'Çevrimdışı',
      domViewport: 'DOM & Ekran',
      liveRender: 'Canlı Render (60 sn)',
      samples: 'örnek',
      targetFps: 'Hedef 60 FPS',
      collecting: 'Veri toplanıyor...',
      hardwareMemory: 'Donanım & Bellek',
      cpuCores: 'CPU Çekirdeği',
      osCpuPct: 'Anlık OS CPU',
      browserSandboxNote: 'Tarayıcı erişimi kapalı',
      deviceRam: 'Cihaz RAM',
      notExposed: 'Gizli',
      storageSubsystems: 'Depolama & Alt Sistemler',
      storageQuota: 'Depolama Kotası',
      keys: 'anahtar',
      cacheSw: 'Önbellek / Service Worker',
      swActive: 'SW Aktif',
      swIdle: 'SW Pasif',
      nativeBridge: 'Yerel Köprü (Capacitor)',
      androidNativeActive: 'Android Yerel Aktif',
      runtimeSuffix: 'Ortamı',
      serverHealth: 'Sunucu Sağlığı',
      connected: 'BAĞLI',
      locked: 'KİLİTLİ',
      runtime: 'Çalışma Zamanı',
      uptime: 'Çalışma Süresi',
      serverMemory: 'Sunucu Belleği',
      serverEngines: 'Sunucu Motorları',
      serverLockedHint: 'Sunucu metrikleri için Güvenlik Merkezinde oturumu doğrulayın.',
      ready: 'Hazır',
      noKey: 'Anahtar Yok',
      bundled: 'Yerel',
      cdn: 'CDN',
      fullscreen: 'Tam Ekran',
      wakeLock: 'Ekran Uyanık',
    },
    diagnostics: {
      title: 'Tanılama',
      copyJson: 'JSON Kopyala',
      running: 'Test Ediliyor...',
      runAll: 'Tanılamayı Çalıştır',
      emptyTitle: 'Henüz tanılama çalıştırılmadı',
      emptyHint: 'API, FFmpeg, depolama ve yerel köprü için 8 canlı testi başlatın.',
      startProbes: '8 Testi Başlat',
      passed: 'Başarılı',
      warnings: 'Uyarı',
      failed: 'Hata',
      statusPass: 'BAŞARILI',
      statusWarn: 'UYARI',
      statusFail: 'HATA',
      doneToast: (pass, total) => `Tanılama bitti: ${pass}/${total} başarılı.`,
      copiedToast: 'Tanılama raporu kopyalandı.',
    },
    devToolkit: {
      title: 'Geliştirici Araçları',
      tabs: {
        modules: 'Modüller',
        state: 'Durum & JSON',
        inspectors: 'Denetçiler & Ses',
        logs: 'Kayıtlar',
        network: 'Ağ',
        profiler: 'Profil',
        build: 'Derleme',
      },
      directDeps: 'Doğrudan Bağımlılıklar',
      leafLayer: 'Harici modül bağımlılığı yok.',
      searchPlaceholder: 'Anahtar veya değer ara...',
      copyMaskedJson: 'Maskeli JSON',
      copiedStateToast: 'Maskelenmiş durum JSON kopyalandı.',
      clear: 'Temizle',
      logLevels: {all: 'Tümü', info: 'Bilgi', warn: 'Uyarı', error: 'Hata'},
      noLogs: 'Yakalanan hata veya olay yok.',
      networkHint: 'Hassas parametreler otomatik maskelenir.',
      noNetwork: 'Henüz gözlemlenen ağ isteği yok.',
      method: 'Yöntem',
      endpoint: 'Uç Nokta',
      status: 'Durum',
      latency: 'Gecikme',
      errTag: 'HATA',
      profiler: {
        ttfb: 'İlk Bayt (TTFB)',
        fcp: 'İlk İçerik Çizimi (FCP)',
        domInteractive: 'DOM Etkileşim',
        domComplete: 'DOM Tamamlanma',
        resources: 'Yüklenen Kaynak',
        liveDom: 'Canlı DOM Düğümü',
      },
      build: {
        appVersion: 'Uygulama Sürümü',
        channel: 'Yayın Kanalı',
        platform: 'Platform',
        viewport: 'Ekran / DPR',
        nodeVersion: 'Node Sunucu',
        geminiKey: 'Gemini Anahtarı',
        passcodeSource: 'Parola Kaynağı',
        userAgent: 'Tarayıcı Kimliği',
        offlineLocked: 'Çevrimdışı / Kilitli',
        configuredMasked: 'TANIMLI [MASKELİ]',
        notSet: 'AYARLANMADI',
        unknownLocked: 'Oturum doğrulaması gerekli',
        localLocked: 'Yerel / Kilitli',
      },
    },
    security: {
      title: 'Güvenlik Merkezi',
      refresh: 'Yenile',
      signOut: 'Çıkış',
      authStatus: 'Doğrulama',
      verifiedDevices: 'Onaylı Cihazlar',
      failedLogins: 'Başarısız Giriş',
      sessionStorage: 'Oturum Tokeni',
      ownerVerified: 'SAHİP DOĞRULANDI',
      localVerified: 'YEREL OTURUM',
      setupRequired: 'KURULUM GEREKLİ',
      locked: 'KİLİTLİ',
      total: 'toplam',
      rateLimit: 'Limit: 10 / 5 dk',
      ramOnly: 'Sadece RAM',
      offlineLocal: 'Yerel Mod',
      none: 'Yok',
      zeroLocalToken: 'LocalStorage token yok',
      expPrefix: 'Bitiş',
      claimTitle: 'İlk Kurulum: Sahip Parolası',
      verifyTitle: 'Sahip Oturumunu Doğrula',
      claimHint: 'Tek seferlik sahip parolanızı belirleyin; sunucuda güvenli özetlenir.',
      verifyHint: 'Sunucu telemetrisi ve cihaz yönetimi için sahip parolanızı girin.',
      passcodeLabel: 'Sahip Parolası',
      confirmPasscodeLabel: 'Parola Tekrar',
      deviceLabel: 'Cihaz Etiketi',
      claimBtn: 'Sahip Kimliği Oluştur',
      verifyBtn: 'Oturumu Doğrula',
      devicePlaceholder: 'Cihaz adı...',
      save: 'Kaydet',
      thisDevice: 'Bu cihaz',
      revoke: 'İptal Et',
      revokePrompt: (id) => `Cihaz İptali Onayı (${id})`,
      reenterPasscode: 'Sahip parolasını tekrar girin...',
      cancel: 'Vazgeç',
      confirmRevoke: 'İptal Et',
      auditTitle: 'Denetim Günlüğü',
      entries: 'kayıt',
      noAudit: 'Denetim kaydı yok veya oturum kilitli.',
      errMinPasscode: 'Parola en az 6 karakter olmalıdır.',
      errMismatch: 'Parolalar eşleşmiyor.',
      errEnterPasscode: 'Sahip parolasını girin.',
      errClaimFailed: 'Kurulum başarısız.',
      errVerifyFailed: 'Doğrulama başarısız.',
      errRevokeFailed: 'İptal işlemi başarısız.',
      toastClaimed: 'Sahip kimliği oluşturuldu ve oturum açıldı.',
      toastVerified: 'Sahip oturumu doğrulandı.',
      toastDeviceSaved: 'Cihaz profili güncellendi.',
      toastSelfRevoked: 'Mevcut cihaz iptal edildi, oturum kapatıldı.',
      toastRevoked: 'Cihaz iptal edildi.',
      toastSignedOut: 'Sunucu oturumu kapatıldı.',
      ownerEmailLabel: 'Sahip E-postası',
      ownerEmailPlaceholder: 'sahip@ornek.com',
      bootstrapTokenLabel: 'Kurulum Anahtarı (Opsiyonel)',
      recoveryCodesTitle: 'Tek Kullanımlık Kurtarma Kodları',
      recoveryHint: 'Bu kodları güvenli bir yerde saklayın. Her kod parolayı sıfırlamak için yalnızca bir kez kullanılabilir.',
      recoveryCodesAck: 'Kopyaladım / Kapat',
      openRecoverBtn: 'Kurtarma Kodu ile Sıfırla',
      recoverTitle: 'Kurtarma Kodu ile Hesap Kurtarma',
      recoveryCodeLabel: 'Kurtarma Kodu',
      newPasscodeLabel: 'Yeni Sahip Parolası (min 8)',
      recoverSubmitBtn: 'Parolayı Sıfırla & Oturum Aç',
      regenRecoveryBtn: 'Kurtarma Kodlarını Yenile',
      passkeyTitle: 'WebAuthn Passkey',
      enrollPasskeyBtn: 'Bu Cihaza Passkey Ekle',
      loginPasskeyBtn: 'Passkey ile Giriş Yap',
      passkeysCount: 'Kayıtlı Passkey',
      deviceCryptoTitle: 'Cihaz Kriptografik Kimliği',
      verifyDeviceCryptoBtn: 'ECDSA P-256 Doğrula',
      cryptoVerifiedBadge: 'KRİPTO ONAYLI',
      cryptoPendingBadge: 'DOĞRULAMA BEKLİYOR',
      androidKeystoreNote: 'Tarayıcıda IndexedDB dışı aktarılamaz P-256 anahtarı aktiftir; yerel AndroidKeyStore köprüsü APK derlemesi gerektirir.',
      rotateKeyBtn: 'İmza Anahtarını Döndür',
      activeKeyLabel: 'Aktif Anahtar',
      sessionsTitle: 'Aktif Sunucu Oturumları',
      revokeSessionBtn: 'Oturumu Sonlandır',
      revokeOtherSessionsBtn: 'Diğer Oturumları Kapat',
      persistenceTitle: 'Kalıcı Depolama',
      ephemeralWarning: 'Geçici kapsayıcı dosya sistemi tespit edildi: kalıcılık için GODMODE_STORE_PATH diskine bağlayın.',
      durableOk: 'Atomik JSON deposu aktif ve sağlıklı.',
      storeLockedTitle: 'Depo Bütünlük Kilidi (Fail-Closed)',
      errInvalidEmail: 'Geçerli bir sahip e-posta adresi girin.',
      errMinPasscode8: 'Sahip parolası en az 8 karakter olmalıdır.',
      toastDeviceCryptoOk: 'Cihaz ECDSA P-256 imza testi doğrulandı.',
      toastPasskeyAdded: 'WebAuthn Passkey başarıyla eklendi.',
      toastKeyRotated: 'İmza anahtarı döndürüldü ve diğer oturumlar kapatıldı.',
      toastRecovered: 'Hesap kurtarıldı, parola ve imza anahtarı yenilendi.',
      toastSessionRevoked: 'Seçilen oturum iptal edildi.',
      toastRegenCodes: '8 adet yeni kurtarma kodu üretildi.',
    },
    settings: {
      title: 'Ayarlar',
      languageTitle: 'Panel Dili',
      languageDesc: 'Normal Morph dilinden bağımsızdır ve kalıcı kaydedilir.',
      trLabel: 'Türkçe (TR)',
      enLabel: 'English (EN)',
      isolatedBadge: 'Bağımsız',
      designTitle: 'Görünüm & Tema',
      activeTheme: 'Aktif Tasarım',
      openDesignLab: 'Tasarım Laboratuvarını Aç',
      resetToDefault: 'Obsidian Violet Sıfırla',
      layoutTitle: 'Gezinme Çubuğu',
      dockMode: 'Masaüstü Kenar Çubuğu',
      dockIcons: 'İkon Çubuğu',
      dockExpanded: 'Genişletilmiş',
      securityTitle: 'Oturum & Güvenlik',
      openSecurity: 'Güvenlik Merkezini Aç',
      currentSession: 'Mevcut Durum',
      brandTitle: 'Panel Başlığı',
      brandDesc: 'Üst başlıkta görünecek yönetim modunu seçin.',
      brandAdmin: 'Administrator',
      brandGodMode: 'God Mode',
    },
    aiLab: {
      title: 'Yapay Zekâ Laboratuvarı',
      modelsTab: 'Modeller',
      studioTab: 'İstem Stüdyosu',
      historyTab: 'Geçmiş',
      modelLabel: 'Model',
      thinkingLabel: 'Akıl Yürütme',
      systemLabel: 'Sistem Yönergesi (Opsiyonel)',
      systemPlaceholder: 'Örn: Kısa ve teknik Türkçe yanıt ver...',
      promptLabel: 'İstem',
      promptPlaceholder: 'Morph mimarisi, FFmpeg komutu veya hata analizi sor...',
      runPrompt: 'Çalıştır',
      running: 'Üretiliyor...',
      clearHistory: 'Temizle',
      copyOutput: 'Kopyala',
      copiedToast: 'AI yanıtı kopyalandı.',
      authNeeded: 'Canlı Gemini çağrıları için Güvenlik Merkezinde sahip oturumunu doğrulayın.',
      openSecurity: 'Güvenlik Merkezini Aç',
      outputTitle: 'Canlı Model Yanıtı',
      emptyOutput: 'Bir istem gönderin; gerçek gecikme ve token metrikleri burada görünür.',
      emptyHistory: 'Henüz kayıtlı AI isteği yok.',
      promptTokens: 'Giriş',
      outputTokens: 'Çıkış',
      totalTokens: 'Toplam Token',
      latency: 'Gecikme',
      quickPrompts: [
        {label: 'FFmpeg 1080p Sıkıştırma', prompt: 'Mobil tarayıcıda FFmpeg WASM ile 1080p MP4 videoyu kalite kaybı minimum olacak şekilde en hızlı sıkıştırma parametrelerini kısa maddelerle ver.'},
        {label: 'Performans Kontrol Listesi', prompt: 'React + Vite mobil WebView uygulaması için 60 FPS koruyan en kritik 5 optimizasyonu kısa yaz.'},
        {label: 'Güvenlik Özeti', prompt: 'Express API proxy rotaları için SSRF ve oturum güvenliğinde en kritik 5 kontrolü özetle.'},
      ],
      healthTestBtn: 'Bağlantıyı Test Et',
      providerOnline: 'Sağlayıcı Erişilebilir',
      providerOffline: 'Anahtar Yok / Erişilemez',
      cancelBtn: 'İptal Et',
      timeoutLabel: 'Zaman Aşımı',
      temperatureLabel: 'Sıcaklık',
      maxTokensLabel: 'Maks. Token',
      mimeLabel: 'Çıktı Biçimi',
      presetsLabel: 'Yapılandırma Şablonu',
      saveVersionBtn: 'Sürüm Kaydet',
      versionsLabel: 'İstem Sürümleri',
      exportVersionsBtn: 'JSON Dışa Aktar',
      importVersionsBtn: 'JSON İçe Aktar',
      budgetTitle: 'Token Bütçesi',
      budgetRemaining: 'Kalan',
      budgetCapLabel: 'Üst Sınır',
      budgetExceeded: 'Oturum token bütçesi sınırı aşıldı. Ayarlardan limiti artırın.',
    },
    agents: {
      title: 'Otonom Ajanlar',
      agentsTab: '7 Uzman Ajan',
      evolutionTab: 'Gelişim Önerileri',
      logsTab: 'Ajan Günlüğü',
      runAgent: 'Analiz Et',
      running: 'Çalışıyor...',
      focusPlaceholder: 'Opsiyonel odak talimatı (örn: bellek kullanımını incele)...',
      generateProposal: 'Yeni Öneri Üret',
      noRuns: 'Henüz ajan çalıştırılmadı.',
      noProposals: 'Henüz onay bekleyen sistem önerisi yok.',
      authNeeded: 'Otonom ajanları çalıştırmak için Güvenlik Merkezinde sahip oturumunu doğrulayın.',
      openSecurity: 'Güvenlik Merkezini Aç',
      findings: 'Bulgular',
      actions: 'Önerilen Adımlar',
      risk: 'Risk',
      approve: 'Onayla',
      reject: 'Reddet',
      statusPending: 'ONAY BEKLİYOR',
      statusApproved: 'ONAYLANDI',
      statusRejected: 'REDDEDİLDİ',
      gatedNote: 'Öneriler hiçbir zaman otomatik uygulanmaz; yalnızca sahip onayı ile işaretlenir.',
      roles: {
        architect: {name: 'Mimari Ajanı', scope: 'Modül sınırları ve ölçeklenebilirlik'},
        auditor: {name: 'Kod Denetçisi', scope: 'Hata riski ve durum tutarlılığı'},
        qa: {name: 'QA & Test Ajanı', scope: 'Dikey/yatay mobil ve regresyon testleri'},
        performance: {name: 'Performans Ajanı', scope: 'FPS, bellek ve DOM darboğazları'},
        media: {name: 'Medya & FFmpeg', scope: 'WASM bellek ve kodek optimizasyonu'},
        security: {name: 'Güvenlik Ajanı', scope: 'Oturum, cihaz ve API koruması'},
        automation: {name: 'Otomasyon Ajanı', scope: 'Tekrarlanabilir bakım akışları'},
      },
      customAgentsTab: 'Özel Ajanlar',
      createCustomBtn: 'Özel Ajan Ekle',
      customNameLabel: 'Ajan Adı',
      customPromptLabel: 'Sistem Rolü',
      toolScopesLabel: 'Yetkili Araç Kapsamları',
      retryPolicyLabel: 'Yeniden Deneme',
      delegateBtn: 'Başka Ajana Devret',
      delegatedFromLabel: 'Devreden',
      exportReportBtn: 'Rapor İndir (JSON)',
      cancelBtn: 'Durdur',
      attemptsLabel: 'Deneme',
      scopes: {
        telemetry_read: 'Telemetri Okuma',
        diagnostics_read: 'Tanılama Okuma',
        storage_read: 'Depolama Okuma',
        network_read: 'Ağ Okuma',
        media_read: 'Medya Okuma',
      },
    },
    experimentalLab: {
      title: 'Deneysel Laboratuvar',
      overrides: 'Geçersiz Kılma',
      rollbackAll: 'Varsayılana Dön',
      resetToast: 'Tüm deneysel bayraklar sıfırlandı.',
      flagsTitle: 'GOD MODE Özellik Bayrakları',
      morphPrefsTitle: 'Canlı Morph Tercih Köprüsü',
      defaultOn: 'Varsayılan: Açık',
      defaultOff: 'Varsayılan: Kapalı',
      modified: 'DEĞİŞTİRİLDİ',
      catRuntime: 'Çalışma Zamanı',
      catMedia: 'Medya',
      catUi: 'Arayüz',
      catAi: 'Yapay Zekâ',
    },
    mediaLab: {
      title: 'Medya Motorları',
      coreStatus: 'FFmpeg & Tarayıcı Yetenekleri',
      wasmBundled: 'Yerel FFmpeg WASM',
      crossOrigin: 'Cross-Origin İzolasyon',
      sharedArrayBuffer: 'SharedArrayBuffer',
      webAudio: 'Web Audio API',
      supported: 'Destekli',
      unavailable: 'Yok',
      builderTitle: 'FFmpeg Komut Oluşturucu',
      presetLabel: 'Ön Ayar',
      formatLabel: 'Biçim',
      codecLabel: 'Kodek',
      crfLabel: 'Kalite (CRF)',
      fpsLabel: 'FPS',
      scaleLabel: 'Çözünürlük',
      copyCmd: 'Komutu Kopyala',
      copiedCmd: 'FFmpeg komutu kopyalandı.',
      benchTitle: 'Canlı Canvas / Kare Kıyaslaması',
      runBench: 'Kıyaslamayı Başlat',
      runningBench: 'Ölçülüyor...',
      framesRendered: 'İşlenen Kare',
      avgFrameMs: 'Ort. Kare Süresi',
      throughput: 'Tahmini Hız',
      benchDone: 'Medya kıyaslaması tamamlandı.',
      inspectEngineBtn: 'FFmpeg Çekirdeğini Denetle',
      inspectingEngine: 'Kodekler Okunuyor...',
      terminateEngineBtn: 'Motoru Sonlandır',
      realBenchTitle: 'Gerçek FFmpeg WASM Kodlama Testi',
      runRealBenchBtn: 'Gerçek FFmpeg Kodla',
      cancelBenchBtn: 'İptal Et',
      presetX264Ultra: 'H.264 Ultrafast (320x240)',
      presetX264Veryfast: 'H.264 Veryfast (320x240)',
      presetAudioMp3: 'Sinüs Ses -> MP3 (libmp3lame)',
      presetGifTest: 'Test Deseni -> GIF',
      encodersFound: 'Aktif Kodlayıcılar',
      decodersFound: 'Çözücü Sayısı',
      historyTitle: 'İşlem Geçmişi',
      noHistory: 'Henüz gerçek FFmpeg veya canvas işi çalıştırılmadı.',
      outputSize: 'Çıktı Boyutu',
      durationLabel: 'Süre',
    },
    terminal: {
      title: 'Terminal',
      placeholder: 'Komut yazın (yardım için: help)...',
      run: 'Çalıştır',
      clear: 'Temizle',
      exportLog: 'Dışa Aktar',
      exportedToast: 'Terminal çıktısı kopyalandı.',
      welcome: 'MORPH Komut Motoru hazır. Kullanılabilir komutlar için "help" yazın.',
      quickCmds: 'Hızlı Komutlar',
    },
    automation: {
      title: 'Otomasyon',
      runFlow: 'Akışı Çalıştır',
      running: 'Çalışıyor...',
      addStep: 'Adım Ekle',
      newFlow: 'Yeni Akış',
      deleteFlow: 'Sil',
      stepCount: (n) => `${n} adım`,
      lastRun: 'Son çalışma',
      never: 'Henüz yok',
      stepLabels: {
        telemetry_check: 'Telemetri Kontrolü',
        diagnostics_run: '8 Canlı Tanılama Testi',
        storage_audit: 'Depolama Denetimi',
        api_ping: 'API Gecikme Ölçümü',
        create_snapshot: 'Zaman Makinesi Yedeği',
        ai_summary: 'AI Durum Özeti',
        media_bench: 'Gerçek FFmpeg Testi',
        json_export: 'Raporu JSON İndir',
      },
      doneToast: (name) => `Otomasyon tamamlandı: ${name}`,
      triggerLabel: 'Tetikleyici',
      conditionLabel: 'Koşul Kapısı',
      triggers: {
        manual: 'Manuel',
        on_open: 'Açılışta Otomatik',
        interval_30s: 'Her 30 Saniye',
      },
      conditions: {
        always: 'Her Zaman Çalıştır',
        if_fps_lt_45: 'Yalnızca FPS < 45 ise',
        if_heap_gt_80mb: 'Yalnızca Bellek > 80 MB ise',
        if_offline: 'Yalnızca Çevrimdışı ise',
        if_storage_gt_50kb: 'Yalnızca Depo > 50 KB ise',
      },
      retryLabel: 'Tekrar',
      cancelRunBtn: 'Akışı Durdur',
      historyTab: 'Çalışma Geçmişi',
      flowCanvasTab: 'Görsel Akış',
      noHistory: 'Henüz otomasyon çalışma kaydı yok.',
    },
    networkLab: {
      title: 'Ağ Laboratuvarı',
      targetPlaceholder: 'https://api.github.com',
      serverProbe: 'Sunucu Testi',
      originProbe: 'Yerel API Ping',
      probing: 'Ölçülüyor...',
      presets: 'Hızlı Hedefler',
      onlineStatus: 'Bağlantı',
      connectionType: 'Ağ Türü',
      downlink: 'Hız Tahmini',
      rtt: 'Tarayıcı RTT',
      ssrfNote: 'SSRF Koruması Aktif: Yerel/özel IP ve metadata adresleri DNS ve TLS öncesi engellenir.',
      historyTitle: 'Test Sonuçları',
      emptyHistory: 'Henüz ağ testi çalıştırılmadı.',
      statusCol: 'Durum',
      latencyCol: 'Gecikme',
      ipCol: 'Çözümlenen IP',
      authNeeded: 'Harici sunucu testi için Güvenlik Merkezinde oturumu doğrulayın.',
      openSecurity: 'Güvenlik',
      dnsTitle: 'DNS Kayıtları',
      tlsTitle: 'TLS Sertifikası',
      issuerLabel: 'Sağlayıcı',
      protocolLabel: 'Protokol',
      cipherLabel: 'Şifre',
      expiryLabel: 'Geçerlilik',
      daysLeft: 'gün',
      errorCategoryLabel: 'Hata Sınıfı',
    },
    storageLab: {
      title: 'Depolama',
      refresh: 'Yenile',
      exportBackup: 'SHA-256 Yedek İndir',
      exportedToast: 'SHA-256 doğrulamalı yedek indirildi.',
      localTab: 'LocalStorage',
      idbTab: 'IndexedDB',
      cacheTab: 'Önbellek',
      searchKeys: 'Anahtar ara...',
      totalSize: 'Toplam Boyut',
      keysCount: 'Anahtar',
      protectedKey: 'Korumalı',
      deleteKey: 'Sil',
      deletedToast: 'Anahtar silindi.',
      noIdb: 'Kayıtlı IndexedDB veritabanı bulunamadı veya tarayıcı listelemeyi desteklemiyor.',
      noCaches: 'Aktif Cache Storage bölümü bulunamadı.',
      clearCache: 'Temizle',
      cacheCleared: 'Önbellek temizlendi.',
      entriesSuffix: 'öğe',
      importBackupBtn: 'Yedek Yükle',
      confirmTitle: 'İşlem Onayı Gerekli',
      confirmDeleteMsg: (key) => `"${key}" anahtarını kalıcı olarak silmek istiyor musunuz?`,
      confirmClearMsg: (name) => `"${name}" önbellek havuzunu temizlemek istiyor musunuz?`,
      confirmRestoreMsg: (count) => `SHA-256 doğrulandı. ${count} anahtar mevcut ayarların üzerine geri yüklensin mi?`,
      checksumValid: 'SHA-256 Doğrulandı',
      checksumInvalid: 'Yedek bütünlüğü veya biçimi geçersiz.',
      inspectIdbBtn: 'Tabloları İncele',
      storesCount: 'Depo',
      recordsCount: 'kayıt',
      urlsTitle: 'Önbellek URL Listesi',
      flushTempBtn: 'Geçici Anahtarları Temizle',
      hardReloadBtn: 'SW Sert Yenileme',
    },
    timeMachine: {
      title: 'Zaman Makinesi',
      labelPlaceholder: 'Anlık görüntü adı (örn: Kararlı Kurulum)...',
      captureBtn: 'Anlık Görüntü Al',
      capturedToast: 'Yapılandırma anlık görüntüsü kaydedildi.',
      emptyTitle: 'Henüz anlık görüntü yok',
      emptyHint: 'Mevcut GOD MODE tasarım, dil ve bayrak ayarlarını tek tıkla kaydedin.',
      restoreBtn: 'Geri Yükle',
      restoredToast: (label) => `Geri yüklendi: ${label}`,
      deleteBtn: 'Sil',
      compareTitle: 'Canlı Fark Görünümü',
      currentState: 'Mevcut',
      selectedSnap: 'Seçili Kayıt',
      themeKey: 'Tasarım',
      langKey: 'Dil',
      overridesKey: 'Bayrak Değişikliği',
      workflowsKey: 'Otomasyon Akışı',
      shaLabel: 'SHA-256 Özeti',
      brandModeKey: 'Panel Başlığı',
      restoreHistoryTitle: 'Geri Yükleme Geçmişi',
      noRestoreHistory: 'Henüz geri yükleme yapılmadı.',
      confirmRestoreMsg: (label) => `"${label}" anlık görüntüsüne geri dönülsün mü?`,
    },
    digitalTwin: {
      title: 'Dijital İkiz',
      resetBtn: 'Sıfırla',
      runSimBtn: 'Simülasyonu Çalıştır',
      runningSim: 'Simüle Ediliyor...',
      openChaosBtn: 'Kaos Laboratuvarı',
      latencyLabel: 'Yapay Gecikme',
      errorRateLabel: 'Hata Enjeksiyon Oranı',
      frameStressLabel: 'Kare Bütçesi Yükü',
      offlineLabel: 'Çevrimdışı Senaryo',
      resultsTitle: 'İzole Stres Testi Sonucu',
      noResults: 'Parametreleri ayarlayıp 12 istekli izole dayanıklılık testini başlatın.',
      passRate: 'Başarı Oranı',
      avgLatency: 'Ort. Gecikme',
      simulatedFrames: 'Tahmini FPS',
      isolatedNote: 'İzole kum havuzu: Normal Morph ağ trafiğini veya window.fetch yapısını değiştirmez.',
      liveMeasuredBadge: 'CANLI ÖLÇÜM',
      simulatedBadge: 'SİMÜLASYON',
      baselineCompareTitle: 'Canlı Gerçeklik vs. İkiz Projeksiyonu',
      profilesTitle: 'Hata Profilleri',
      saveProfileBtn: 'Profil Kaydet',
      profileNamePlaceholder: 'Profil adı...',
      applyProfileBtn: 'Yükle',
    },
  },
  en: {
    modules: {
      dashboard: {label: 'Dashboard', short: 'Home', summary: 'Live telemetry and system health overview.'},
      design_lab: {label: 'Design Lab', short: 'Design', summary: 'Isolated GOD MODE themes and live comparison.'},
      system_core: {label: 'System Monitor', short: 'System', summary: 'Live FPS, memory, storage and device metrics.'},
      performance_lab: {label: 'Performance', short: 'Performance', summary: 'HUD toggle, frame history and JSON export.'},
      ui_inspector: {label: 'UI Inspector', short: 'Inspector', summary: 'Grid, touch targets and live token inspection.'},
      animation_lab: {label: 'Animation', short: 'Animation', summary: 'Global animation speed, motion and haptic bench.'},
      diagnostics: {label: 'Diagnostics', short: 'Probes', summary: 'Live probes for API, storage, network and media.'},
      dev_toolkit: {label: 'Dev Toolkit', short: 'Toolkit', summary: 'Module architecture graph, masked state and profiler.'},
      security_center: {label: 'Security Center', short: 'Security', summary: 'Owner verification, device registry and audit log.'},
      settings: {label: 'Settings', short: 'Settings', summary: 'Independent panel language, design and layout.'},
      deadpool_studio: {label: 'Deadpool Studio', short: 'Deadpool', summary: 'Custom logo, color, mask and visual controls.'},
      chaos_lab: {label: 'Chaos Lab', short: 'Chaos', summary: 'Risk-rated, time-bounded UI stress tests with recovery.'},
      ai_lab: {label: 'AI Studio', short: 'AI Studio', summary: 'Model registry, live prompt studio and token monitor.'},
      autonomous_agents: {label: 'Autonomous Agents', short: 'Agents', summary: 'Specialized agents and approval-gated proposals.'},
      experimental_lab: {label: 'Feature Flags', short: 'Flags', summary: 'Runtime feature flags and one-click rollback.'},
      experimental_tools: {label: 'Experiments', short: 'Experiments', summary: 'Experimental Morph switches and platform engines.'},
      logs_events: {label: 'Logs & Events', short: 'Logs', summary: 'Live runtime event stream, search and JSON export.'},
      media_engine: {label: 'Media Engines', short: 'Media', summary: 'FFmpeg WASM inspector, command builder and benchmark.'},
      terminal: {label: 'Terminal', short: 'Terminal', summary: 'Live autocomplete Morph command engine.'},
      automation_studio: {label: 'Automation', short: 'Automation', summary: 'Visual node-based workflow builder and runner.'},
      network_lab: {label: 'Network Diagnostics', short: 'Network', summary: 'SSRF-hardened server & client latency diagnostics.'},
      storage_lab: {label: 'Storage Inspector', short: 'Storage', summary: 'LocalStorage, IndexedDB and Cache Storage explorer.'},
      time_machine: {label: 'Time Machine', short: 'Time', summary: 'Configuration snapshots, diff viewer and restore.'},
      digital_twin: {label: 'Digital Twin', short: 'Twin', summary: 'Isolated fault-injection and latency simulator.'},
    },
    shell: {
      activeSection: 'Command Center',
      roadmapSection: 'Platform Engines',
      roadmapShort: 'Engines',
      allModules: 'All Modules',
      collapseDock: 'Icon Dock',
      expandDock: 'Expand Labels',
      iconsOnly: 'Icons',
      previewTag: 'Preview',
      close: 'Close',
      ownerVerified: 'OWNER VERIFIED',
      localVerified: 'LOCAL SESSION',
      claimOwner: 'CLAIM OWNER',
      verifySession: 'VERIFY SESSION',
      checking: 'CHECKING...',
      plannedSlot: 'Scheduled Module',
      plannedNote: 'No fake stubs mounted. This module unlocks with live engines in its next phase.',
      openLiveModule: 'Open Live Module',
      backToDashboard: 'Back to Dashboard',
      deadpoolStudioTitle: 'Deadpool Wheel Studio',
      chaosLabTitle: 'Chaos & Stress Lab',
      designAppliedToast: (name) => `Design applied: ${name}`,
      langChangedToast: (langName) => `Panel language: ${langName}`,
      brandChangedToast: (brandName) => `Header title: ${brandName}`,
    },
    overview: {
      frameRate: 'Frame Rate',
      frameBuckets: 'Frame Stream',
      stability: 'System Health',
      nominal: 'nominal',
      errorsSuffix: 'err',
      localTag: 'local',
      keysSuffix: 'keys',
      telemetryTitle: 'Main Performance Graph',
      fpsMode: 'FPS / ms',
      loadMode: 'Heap / Load',
      sourcesTitle: 'Resource Breakdown',
      inspect: 'Inspect',
      netAndEvents: 'Net & Events',
      domNodes: 'DOM Nodes',
      activeModules: 'Active Modules',
      liveCount: (n) => `${n} live`,
      providersTitle: 'AI & Engine Status',
      ready: 'Ready',
      noKey: 'No Key',
      active: 'Active',
      idle: 'Idle',
      offline: 'Offline',
      verified: 'Verified',
      localMode: 'Local',
      bundled: 'Bundled',
      cdn: 'CDN',
      probesCount: (n) => `${n} probes`,
      reqCount: (n) => `${n} req`,
      recentEvents: 'Recent Activity',
      noEvents: 'No events captured yet.',
      topologyTitle: 'System Topology',
      moduleGraph: 'Module Graph',
      eventsCount: (n) => `${n} events`,
      openDesignLab: 'Design Lab',
      topoLabels: {
        core: 'Core',
        ffmpeg: 'Media',
        state: 'Tools',
        auth: 'Auth',
        themes: 'Design',
        chaos: 'Chaos',
      },
    },
    designLab: {
      title: 'Design Lab',
      compare: 'Compare',
      restorePrev: (name) => `Restore (${name})`,
      resetDefault: 'Default',
      livePreviewLabel: 'Live Preview',
      savedLabel: 'Saved',
      cancelPreview: 'Cancel',
      applyAndSave: 'Apply & Save',
      compareTitle: 'Live Comparison',
      select: 'Apply',
      defaultBadge: 'Default',
      altBadge: (n) => `Alternative ${n}`,
      experimentalBadge: 'Experimental',
      previewing: 'Previewing',
      livePreviewBtn: 'Preview',
      activeDesign: 'Active',
      apply: 'Apply',
      persistedDesign: 'Saved Design',
      isolatedNote: 'Isolated from normal Morph theme',
      allFilter: 'All',
      coreFilter: 'Core',
      liveFpsStream: 'Live FPS Stream',
      unsupported: 'N/A',
      layoutModes: {
        obsidian: 'Bento Control Room',
        cyber: 'Tactical HUD Grid',
        minimal: 'Editorial Data Ledger',
        holographic: 'Layered Glass Deck',
        terminal: 'Raw Console TUI',
      },
      tabs: {
        panelThemes: 'Panel Themes',
        morphUi: 'Morph UI Engine',
      },
    },
    systemCore: {
      title: 'System Core',
      probeLatency: 'Probe Latency',
      exportSnapshot: 'Export JSON',
      snapshotExported: 'Performance snapshot exported.',
      fpsFrameTime: 'Frame Rate · Time',
      drops: 'drops',
      unsupported: 'Unsupported',
      chromiumOnly: 'Chromium only',
      backendLatency: 'Backend Latency',
      online: 'Online',
      offline: 'Offline',
      domViewport: 'DOM & Viewport',
      liveRender: 'Live Render (60s)',
      samples: 'samples',
      targetFps: 'Target 60 FPS',
      collecting: 'Collecting telemetry...',
      hardwareMemory: 'Hardware & Memory',
      cpuCores: 'Logical CPU Cores',
      osCpuPct: 'Live OS CPU %',
      browserSandboxNote: 'Unavailable in sandbox',
      deviceRam: 'Device RAM',
      notExposed: 'Not exposed',
      storageSubsystems: 'Storage & Subsystems',
      storageQuota: 'Storage Quota',
      keys: 'keys',
      cacheSw: 'Cache / Service Worker',
      swActive: 'SW Active',
      swIdle: 'SW Idle',
      nativeBridge: 'Native Bridge (Capacitor)',
      androidNativeActive: 'Android Native Active',
      runtimeSuffix: 'Runtime',
      serverHealth: 'Server Health',
      connected: 'CONNECTED',
      locked: 'LOCKED',
      runtime: 'Runtime',
      uptime: 'Uptime',
      serverMemory: 'Server Memory',
      serverEngines: 'Server Engines',
      serverLockedHint: 'Verify your owner session in Security Center to stream server metrics.',
      ready: 'Ready',
      noKey: 'No Key',
      bundled: 'Bundled',
      cdn: 'CDN',
      fullscreen: 'Fullscreen',
      wakeLock: 'Wake Lock',
    },
    diagnostics: {
      title: 'Diagnostics',
      copyJson: 'Copy JSON',
      running: 'Running...',
      runAll: 'Run Diagnostics',
      emptyTitle: 'No diagnostic run yet',
      emptyHint: 'Run 8 live probes across API, FFmpeg, storage and native bridge.',
      startProbes: 'Start 8 Probes',
      passed: 'Passed',
      warnings: 'Warnings',
      failed: 'Failed',
      statusPass: 'PASS',
      statusWarn: 'WARN',
      statusFail: 'FAIL',
      doneToast: (pass, total) => `Diagnostics complete: ${pass}/${total} passed.`,
      copiedToast: 'Diagnostic report copied.',
    },
    devToolkit: {
      title: 'Developer Tools',
      tabs: {
        modules: 'Modules',
        state: 'State & JSON',
        inspectors: 'Inspectors & Audio',
        logs: 'Logs',
        network: 'Network',
        profiler: 'Profiler',
        build: 'Build',
      },
      directDeps: 'Direct Dependencies',
      leafLayer: 'No internal module dependencies.',
      searchPlaceholder: 'Filter keys or values...',
      copyMaskedJson: 'Masked JSON',
      copiedStateToast: 'Masked state JSON copied.',
      clear: 'Clear',
      logLevels: {all: 'All', info: 'Info', warn: 'Warn', error: 'Error'},
      noLogs: 'No captured errors or events.',
      networkHint: 'Sensitive query parameters are auto-masked.',
      noNetwork: 'No observed network requests yet.',
      method: 'Method',
      endpoint: 'Endpoint',
      status: 'Status',
      latency: 'Latency',
      errTag: 'ERR',
      profiler: {
        ttfb: 'TTFB',
        fcp: 'First Contentful Paint',
        domInteractive: 'DOM Interactive',
        domComplete: 'DOM Complete',
        resources: 'Loaded Resources',
        liveDom: 'Live DOM Nodes',
      },
      build: {
        appVersion: 'App Version',
        channel: 'Release Channel',
        platform: 'Platform',
        viewport: 'Viewport / DPR',
        nodeVersion: 'Node Server',
        geminiKey: 'Gemini Key',
        passcodeSource: 'Passcode Source',
        userAgent: 'User Agent',
        offlineLocked: 'Offline / Locked',
        configuredMasked: 'CONFIGURED [MASKED]',
        notSet: 'NOT SET',
        unknownLocked: 'Session verification required',
        localLocked: 'Local / Locked',
      },
    },
    security: {
      title: 'Security Center',
      refresh: 'Refresh',
      signOut: 'Sign Out',
      authStatus: 'Auth Status',
      verifiedDevices: 'Verified Devices',
      failedLogins: 'Failed Logins',
      sessionStorage: 'Session Token',
      ownerVerified: 'OWNER VERIFIED',
      localVerified: 'LOCAL SESSION',
      setupRequired: 'SETUP REQUIRED',
      locked: 'LOCKED',
      total: 'total',
      rateLimit: 'Limit: 10 / 5m',
      ramOnly: 'RAM Only',
      offlineLocal: 'Offline Local',
      none: 'None',
      zeroLocalToken: 'Zero localStorage token',
      expPrefix: 'Exp',
      claimTitle: 'First-Run: Claim Owner Passcode',
      verifyTitle: 'Verify Owner Session',
      claimHint: 'Choose your one-time owner passcode; scrypt-hashed on the server.',
      verifyHint: 'Enter your owner passcode to unlock server health and device management.',
      passcodeLabel: 'Owner Passcode',
      confirmPasscodeLabel: 'Confirm Passcode',
      deviceLabel: 'Device Label',
      claimBtn: 'Claim Owner Access',
      verifyBtn: 'Verify Session',
      devicePlaceholder: 'Device label...',
      save: 'Save',
      thisDevice: 'This device',
      revoke: 'Revoke',
      revokePrompt: (id) => `Confirm Device Revocation (${id})`,
      reenterPasscode: 'Re-enter owner passcode...',
      cancel: 'Cancel',
      confirmRevoke: 'Revoke',
      auditTitle: 'Audit Log',
      entries: 'entries',
      noAudit: 'No audit entries yet or session locked.',
      errMinPasscode: 'Passcode must be at least 6 characters.',
      errMismatch: 'Passcodes do not match.',
      errEnterPasscode: 'Enter your owner passcode.',
      errClaimFailed: 'Claim failed.',
      errVerifyFailed: 'Verification failed.',
      errRevokeFailed: 'Revocation failed.',
      toastClaimed: 'Owner credentials claimed and session active.',
      toastVerified: 'Owner session verified.',
      toastDeviceSaved: 'Device profile updated.',
      toastSelfRevoked: 'Current device revoked; session terminated.',
      toastRevoked: 'Device revoked.',
      toastSignedOut: 'Server session closed.',
      ownerEmailLabel: 'Owner Email',
      ownerEmailPlaceholder: 'owner@example.com',
      bootstrapTokenLabel: 'Bootstrap Token (Optional)',
      recoveryCodesTitle: 'Single-Use Recovery Codes',
      recoveryHint: 'Store these codes safely offline. Each code works once to recover passcode access.',
      recoveryCodesAck: 'Copied / Dismiss',
      openRecoverBtn: 'Recover with Recovery Code',
      recoverTitle: 'Owner Account Recovery',
      recoveryCodeLabel: 'Recovery Code',
      newPasscodeLabel: 'New Passcode (min 8)',
      recoverSubmitBtn: 'Reset Passcode & Sign In',
      regenRecoveryBtn: 'Regenerate Recovery Codes',
      passkeyTitle: 'WebAuthn Passkey',
      enrollPasskeyBtn: 'Enroll Passkey on Device',
      loginPasskeyBtn: 'Sign In with Passkey',
      passkeysCount: 'Enrolled Passkeys',
      deviceCryptoTitle: 'Cryptographic Device Identity',
      verifyDeviceCryptoBtn: 'Verify ECDSA P-256',
      cryptoVerifiedBadge: 'CRYPTO VERIFIED',
      cryptoPendingBadge: 'CHALLENGE PENDING',
      androidKeystoreNote: 'Browser uses non-extractable IndexedDB P-256 keys; native AndroidKeyStore requires Capacitor plugin build.',
      rotateKeyBtn: 'Rotate Signing Key',
      activeKeyLabel: 'Active Key',
      sessionsTitle: 'Active Server Sessions',
      revokeSessionBtn: 'Revoke Session',
      revokeOtherSessionsBtn: 'Revoke All Other Sessions',
      persistenceTitle: 'Durable Persistence',
      ephemeralWarning: 'Ephemeral container filesystem detected: mount a persistent volume at GODMODE_STORE_PATH.',
      durableOk: 'Atomic JSON store is active and healthy.',
      storeLockedTitle: 'Store Integrity Lock (Fail-Closed)',
      errInvalidEmail: 'Enter a valid owner email address.',
      errMinPasscode8: 'Passcode must be at least 8 characters.',
      toastDeviceCryptoOk: 'Device ECDSA P-256 challenge signature verified.',
      toastPasskeyAdded: 'WebAuthn Passkey enrolled.',
      toastKeyRotated: 'Signing key rotated and prior sessions invalidated.',
      toastRecovered: 'Account recovered; passcode and signing key rotated.',
      toastSessionRevoked: 'Selected session revoked.',
      toastRegenCodes: 'Generated 8 fresh recovery codes.',
    },
    settings: {
      title: 'Settings',
      languageTitle: 'Panel Language',
      languageDesc: 'Independent from normal Morph language and persisted automatically.',
      trLabel: 'Türkçe (TR)',
      enLabel: 'English (EN)',
      isolatedBadge: 'Isolated',
      designTitle: 'Appearance & Theme',
      activeTheme: 'Active Design',
      openDesignLab: 'Open Design Lab',
      resetToDefault: 'Reset to Obsidian Violet',
      layoutTitle: 'Navigation Dock',
      dockMode: 'Desktop Sidebar',
      dockIcons: 'Icon Rail',
      dockExpanded: 'Expanded',
      securityTitle: 'Session & Security',
      openSecurity: 'Open Security Center',
      currentSession: 'Current Status',
      brandTitle: 'Console Title',
      brandDesc: 'Choose whether the header displays Administrator or God Mode.',
      brandAdmin: 'Administrator',
      brandGodMode: 'God Mode',
    },
    aiLab: {
      title: 'AI Lab',
      modelsTab: 'Models',
      studioTab: 'Prompt Studio',
      historyTab: 'History',
      modelLabel: 'Model',
      thinkingLabel: 'Reasoning',
      systemLabel: 'System Instruction (Optional)',
      systemPlaceholder: 'e.g. Answer concisely with technical steps...',
      promptLabel: 'Prompt',
      promptPlaceholder: 'Ask about Morph architecture, FFmpeg pipelines, or runtime diagnostics...',
      runPrompt: 'Run Prompt',
      running: 'Generating...',
      clearHistory: 'Clear',
      copyOutput: 'Copy',
      copiedToast: 'AI response copied.',
      authNeeded: 'Verify your owner session in Security Center to run live Gemini requests.',
      openSecurity: 'Open Security Center',
      outputTitle: 'Live Model Output',
      emptyOutput: 'Send a prompt to inspect real latency and token metrics here.',
      emptyHistory: 'No AI requests logged yet.',
      promptTokens: 'Prompt',
      outputTokens: 'Output',
      totalTokens: 'Total Tokens',
      latency: 'Latency',
      quickPrompts: [
        {label: 'FFmpeg 1080p Compress', prompt: 'Give concise FFmpeg WASM parameters to compress 1080p MP4 video on mobile browsers with minimal quality loss.'},
        {label: '60 FPS Checklist', prompt: 'List the 5 highest-impact optimizations to keep a React + Vite mobile WebView locked at 60 FPS.'},
        {label: 'API Security Audit', prompt: 'Summarize the top 5 SSRF and session security checks for an Express API proxy.'},
      ],
      healthTestBtn: 'Test Connection',
      providerOnline: 'Provider Reachable',
      providerOffline: 'Key Missing / Unreachable',
      cancelBtn: 'Cancel',
      timeoutLabel: 'Timeout',
      temperatureLabel: 'Temperature',
      maxTokensLabel: 'Max Tokens',
      mimeLabel: 'Response MIME',
      presetsLabel: 'Config Preset',
      saveVersionBtn: 'Save Version',
      versionsLabel: 'Prompt Versions',
      exportVersionsBtn: 'Export JSON',
      importVersionsBtn: 'Import JSON',
      budgetTitle: 'Token Budget',
      budgetRemaining: 'Remaining',
      budgetCapLabel: 'Budget Cap',
      budgetExceeded: 'Session token budget cap reached. Increase cap in controls.',
    },
    agents: {
      title: 'Autonomous Agents',
      agentsTab: '7 Agents',
      evolutionTab: 'Self-Evolution',
      logsTab: 'Agent Logs',
      runAgent: 'Analyze',
      running: 'Running...',
      focusPlaceholder: 'Optional focus directive (e.g. inspect memory pressure)...',
      generateProposal: 'Generate Proposal',
      noRuns: 'No agent runs recorded yet.',
      noProposals: 'No evolution proposals queued yet.',
      authNeeded: 'Verify your owner session in Security Center to execute autonomous agents.',
      openSecurity: 'Open Security Center',
      findings: 'Findings',
      actions: 'Recommended Actions',
      risk: 'Risk',
      approve: 'Approve',
      reject: 'Reject',
      statusPending: 'PENDING REVIEW',
      statusApproved: 'APPROVED',
      statusRejected: 'REJECTED',
      gatedNote: 'Proposals are never auto-applied; every item requires explicit owner approval.',
      roles: {
        architect: {name: 'Architect Agent', scope: 'Module boundaries & scalability'},
        auditor: {name: 'Code Auditor', scope: 'Reliability & state consistency'},
        qa: {name: 'QA & Test Agent', scope: 'Portrait/landscape & regression'},
        performance: {name: 'Performance Agent', scope: 'FPS, heap & DOM bottlenecks'},
        media: {name: 'Media & FFmpeg', scope: 'WASM memory & codec tuning'},
        security: {name: 'Security Agent', scope: 'Auth, devices & API posture'},
        automation: {name: 'Automation Agent', scope: 'Repeatable maintenance flows'},
      },
      customAgentsTab: 'Custom Agents',
      createCustomBtn: 'Add Custom Agent',
      customNameLabel: 'Agent Name',
      customPromptLabel: 'System Role',
      toolScopesLabel: 'Authorized Tool Scopes',
      retryPolicyLabel: 'Retry Policy',
      delegateBtn: 'Delegate to Agent',
      delegatedFromLabel: 'Delegated from',
      exportReportBtn: 'Export Report (JSON)',
      cancelBtn: 'Abort',
      attemptsLabel: 'Attempt',
      scopes: {
        telemetry_read: 'Telemetry Read',
        diagnostics_read: 'Diagnostics Read',
        storage_read: 'Storage Read',
        network_read: 'Network Read',
        media_read: 'Media Read',
      },
    },
    experimentalLab: {
      title: 'Experimental Lab',
      overrides: 'Overrides',
      rollbackAll: 'Rollback All',
      resetToast: 'All experimental flags reset to defaults.',
      flagsTitle: 'GOD MODE Feature Flags',
      morphPrefsTitle: 'Live Morph Preferences Bridge',
      defaultOn: 'Default: On',
      defaultOff: 'Default: Off',
      modified: 'MODIFIED',
      catRuntime: 'Runtime',
      catMedia: 'Media',
      catUi: 'UI',
      catAi: 'AI',
    },
    mediaLab: {
      title: 'Media Engines',
      coreStatus: 'FFmpeg & Browser Capabilities',
      wasmBundled: 'Bundled FFmpeg WASM',
      crossOrigin: 'Cross-Origin Isolated',
      sharedArrayBuffer: 'SharedArrayBuffer',
      webAudio: 'Web Audio API',
      supported: 'Supported',
      unavailable: 'Unavailable',
      builderTitle: 'FFmpeg Command Builder',
      presetLabel: 'Preset',
      formatLabel: 'Format',
      codecLabel: 'Codec',
      crfLabel: 'Quality (CRF)',
      fpsLabel: 'FPS',
      scaleLabel: 'Resolution',
      copyCmd: 'Copy Command',
      copiedCmd: 'FFmpeg command copied.',
      benchTitle: 'Live Canvas / Frame Benchmark',
      runBench: 'Run Benchmark',
      runningBench: 'Benchmarking...',
      framesRendered: 'Frames Rendered',
      avgFrameMs: 'Avg Frame Time',
      throughput: 'Est. Throughput',
      benchDone: 'Media benchmark completed.',
      inspectEngineBtn: 'Inspect FFmpeg Core',
      inspectingEngine: 'Inspecting Codecs...',
      terminateEngineBtn: 'Terminate Instance',
      realBenchTitle: 'Real FFmpeg WASM Encode Benchmark',
      runRealBenchBtn: 'Run Real FFmpeg Encode',
      cancelBenchBtn: 'Cancel Job',
      presetX264Ultra: 'H.264 Ultrafast (320x240)',
      presetX264Veryfast: 'H.264 Veryfast (320x240)',
      presetAudioMp3: 'Sine Audio -> MP3 (libmp3lame)',
      presetGifTest: 'Testsrc -> Animated GIF',
      encodersFound: 'Real Encoders',
      decodersFound: 'Decoders Count',
      historyTitle: 'Job History',
      noHistory: 'No FFmpeg or canvas jobs run yet.',
      outputSize: 'Output Size',
      durationLabel: 'Duration',
    },
    terminal: {
      title: 'Terminal',
      placeholder: 'Enter command (type "help")...',
      run: 'Run',
      clear: 'Clear',
      exportLog: 'Export',
      exportedToast: 'Terminal output copied.',
      welcome: 'MORPH Command Engine ready. Type "help" to list live commands.',
      quickCmds: 'Quick Commands',
    },
    automation: {
      title: 'Automation',
      runFlow: 'Run Workflow',
      running: 'Running...',
      addStep: 'Add Step',
      newFlow: 'New Flow',
      deleteFlow: 'Delete',
      stepCount: (n) => `${n} steps`,
      lastRun: 'Last run',
      never: 'Never',
      stepLabels: {
        telemetry_check: 'Telemetry Check',
        diagnostics_run: '8 Live Diagnostic Probes',
        storage_audit: 'Storage Audit',
        api_ping: 'API Latency Probe',
        create_snapshot: 'Time Machine Snapshot',
        ai_summary: 'AI Health Summary',
        media_bench: 'Real FFmpeg Encode Probe',
        json_export: 'Export Run JSON',
      },
      doneToast: (name) => `Workflow completed: ${name}`,
      triggerLabel: 'Trigger',
      conditionLabel: 'Condition Gate',
      triggers: {
        manual: 'Manual',
        on_open: 'Auto on Open',
        interval_30s: 'Every 30s Interval',
      },
      conditions: {
        always: 'Always Run',
        if_fps_lt_45: 'Only if FPS < 45',
        if_heap_gt_80mb: 'Only if Heap > 80 MB',
        if_offline: 'Only if Offline',
        if_storage_gt_50kb: 'Only if Storage > 50 KB',
      },
      retryLabel: 'Retries',
      cancelRunBtn: 'Abort Run',
      historyTab: 'Execution History',
      flowCanvasTab: 'Visual Graph',
      noHistory: 'No workflow runs logged yet.',
    },
    networkLab: {
      title: 'Network Lab',
      targetPlaceholder: 'https://api.github.com',
      serverProbe: 'Server Probe',
      originProbe: 'Origin API Ping',
      probing: 'Probing...',
      presets: 'Quick Targets',
      onlineStatus: 'Status',
      connectionType: 'Link Type',
      downlink: 'Est. Downlink',
      rtt: 'Browser RTT',
      ssrfNote: 'SSRF Defense Active: Private, loopback, and metadata IPs are blocked before DNS & TLS.',
      historyTitle: 'Probe Results',
      emptyHistory: 'No network probes executed yet.',
      statusCol: 'Status',
      latencyCol: 'Latency',
      ipCol: 'Resolved IP',
      authNeeded: 'Verify your owner session in Security Center for server-side probes.',
      openSecurity: 'Security',
      dnsTitle: 'DNS Records',
      tlsTitle: 'TLS Certificate',
      issuerLabel: 'Issuer',
      protocolLabel: 'Protocol',
      cipherLabel: 'Cipher',
      expiryLabel: 'Expires',
      daysLeft: 'days',
      errorCategoryLabel: 'Error Class',
    },
    storageLab: {
      title: 'Storage',
      refresh: 'Refresh',
      exportBackup: 'SHA-256 Backup',
      exportedToast: 'SHA-256 checksummed backup downloaded.',
      localTab: 'LocalStorage',
      idbTab: 'IndexedDB',
      cacheTab: 'Cache Storage',
      searchKeys: 'Filter keys...',
      totalSize: 'Total Size',
      keysCount: 'Keys',
      protectedKey: 'Protected',
      deleteKey: 'Delete',
      deletedToast: 'Key removed.',
      noIdb: 'No IndexedDB databases found or listing unsupported by this browser.',
      noCaches: 'No active Cache Storage buckets found.',
      clearCache: 'Clear',
      cacheCleared: 'Cache cleared.',
      entriesSuffix: 'items',
      importBackupBtn: 'Restore Backup',
      confirmTitle: 'Confirmation Required',
      confirmDeleteMsg: (key) => `Permanently delete storage key "${key}"?`,
      confirmClearMsg: (name) => `Clear all cached entries in "${name}"?`,
      confirmRestoreMsg: (count) => `SHA-256 verified. Restore ${count} keys over current settings?`,
      checksumValid: 'SHA-256 Validated',
      checksumInvalid: 'Backup integrity checksum mismatch or invalid format.',
      inspectIdbBtn: 'Inspect Stores',
      storesCount: 'Stores',
      recordsCount: 'records',
      urlsTitle: 'Cached URLs',
      flushTempBtn: 'Flush Temp Keys',
      hardReloadBtn: 'Hard SW Reload',
    },
    timeMachine: {
      title: 'Time Machine',
      labelPlaceholder: 'Snapshot label (e.g. Stable Setup)...',
      captureBtn: 'Capture Snapshot',
      capturedToast: 'Configuration snapshot saved.',
      emptyTitle: 'No snapshots captured yet',
      emptyHint: 'Save current GOD MODE theme, language, and flag state in one click.',
      restoreBtn: 'Restore',
      restoredToast: (label) => `Restored: ${label}`,
      deleteBtn: 'Delete',
      compareTitle: 'Live Diff View',
      currentState: 'Current',
      selectedSnap: 'Selected',
      themeKey: 'Design',
      langKey: 'Language',
      overridesKey: 'Flag Overrides',
      workflowsKey: 'Workflows',
      shaLabel: 'SHA-256 Digest',
      brandModeKey: 'Header Brand',
      restoreHistoryTitle: 'Restore History',
      noRestoreHistory: 'No snapshot restores recorded yet.',
      confirmRestoreMsg: (label) => `Restore configuration from "${label}"?`,
    },
    digitalTwin: {
      title: 'Digital Twin',
      resetBtn: 'Reset',
      runSimBtn: 'Run Simulation',
      runningSim: 'Simulating...',
      openChaosBtn: 'Chaos Lab (23 Tools)',
      latencyLabel: 'Simulated Latency',
      errorRateLabel: 'Fault Injection Rate',
      frameStressLabel: 'Frame Budget Stress',
      offlineLabel: 'Offline Scenario',
      resultsTitle: 'Isolated Stress Test Report',
      noResults: 'Configure parameters and run a 12-request isolated resilience simulation.',
      passRate: 'Pass Rate',
      avgLatency: 'Avg Latency',
      simulatedFrames: 'Projected FPS',
      isolatedNote: 'Isolated sandbox: Never mutates normal Morph traffic or window.fetch.',
      liveMeasuredBadge: 'LIVE MEASURED',
      simulatedBadge: 'SIMULATED',
      baselineCompareTitle: 'Live Measured vs. Twin Projection',
      profilesTitle: 'Fault Profiles',
      saveProfileBtn: 'Save Profile',
      profileNamePlaceholder: 'Profile name...',
      applyProfileBtn: 'Load',
    },
  },
};
