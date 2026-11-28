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
    diagnostics: {label: string; short: string; summary: string};
    dev_toolkit: {label: string; short: string; summary: string};
    security_center: {label: string; short: string; summary: string};
    settings: {label: string; short: string; summary: string};
    deadpool_chaos: {label: string; short: string; summary: string};
    ai_lab: {label: string; short: string; summary: string};
    autonomous_agents: {label: string; short: string; summary: string};
    experimental_lab: {label: string; short: string; summary: string};
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
    deadpoolTitle: string;
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
      'telemetry_check' | 'diagnostics_run' | 'storage_audit' | 'api_ping' | 'create_snapshot' | 'ai_summary',
      string
    >;
    doneToast: (name: string) => string;
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
  };
}

export const GOD_MODE_I18N: Record<GodModeLang, GodModeDictionary> = {
  tr: {
    modules: {
      dashboard: {label: 'Ana Ekran', short: 'Ana Ekran', summary: 'Canlı performans, AI motorları ve sistem özeti.'},
      design_lab: {label: 'Tasarım Laboratuvarı', short: 'Tasarım', summary: 'İzole GOD MODE temaları ve canlı karşılaştırma.'},
      system_core: {label: 'Sistem Merkezi', short: 'Sistem', summary: 'Canlı FPS, bellek, depolama ve sunucu metrikleri.'},
      diagnostics: {label: 'Tanılama', short: 'Tanılama', summary: '8 canlı sistem, depolama ve medya doğrulama testi.'},
      dev_toolkit: {label: 'Geliştirici Araçları', short: 'Araçlar', summary: 'Modül grafiği, maskeli state, log, ağ ve profilleyici.'},
      security_center: {label: 'Güvenlik Merkezi', short: 'Güvenlik', summary: 'Sahip doğrulama, cihaz yönetimi ve denetim günlüğü.'},
      settings: {label: 'Ayarlar', short: 'Ayarlar', summary: 'Bağımsız GOD MODE dili, tasarım ve görünüm tercihleri.'},
      deadpool_chaos: {label: 'Deadpool & Kaos', short: 'Deadpool', summary: '100 özellikli çark, arayüz motoru ve kaos laboratuvarı.'},
      ai_lab: {label: 'Yapay Zekâ Laboratuvarı', short: 'YZ Lab', summary: 'Model yönetimi, canlı Gemini istem stüdyosu ve token izleyici.'},
      autonomous_agents: {label: 'Otonom Ajanlar', short: 'Ajanlar', summary: '7 uzman ajan ve onay kapılı sistem geliştirme önerileri.'},
      experimental_lab: {label: 'Deneysel Laboratuvar', short: 'Deneysel', summary: 'Özellik bayrakları, geçersiz kılma ve tek tıkla geri alma.'},
      media_engine: {label: 'Medya Motorları', short: 'Medya', summary: 'FFmpeg WASM denetimi, komut oluşturucu ve render testi.'},
      terminal: {label: 'Terminal', short: 'Terminal', summary: 'Otomatik tamamlamalı canlı Morph komut motoru.'},
      automation_studio: {label: 'Otomasyon', short: 'Otomasyon', summary: 'Düğüm tabanlı otomasyon akış editörü ve çalıştırıcı.'},
      network_lab: {label: 'Ağ Laboratuvarı', short: 'Ağ Lab', summary: 'SSRF korumalı sunucu ve istemci gecikme testleri.'},
      storage_lab: {label: 'Depolama', short: 'Depolama', summary: 'LocalStorage, IndexedDB ve önbellek gezgini.'},
      time_machine: {label: 'Zaman Makinesi', short: 'Zaman', summary: 'Yapılandırma anlık görüntüleri, fark ve geri yükleme.'},
      digital_twin: {label: 'Dijital İkiz', short: 'İkiz', summary: 'İzole hata enjeksiyonu ve gecikme simülatörü.'},
    },
    shell: {
      activeSection: 'Çekirdek Modüller',
      roadmapSection: 'Laboratuvarlar',
      roadmapShort: 'Lab & Araç',
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
      deadpoolTitle: 'Deadpool & Kaos (100)',
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
        state: 'Durum',
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
      },
      doneToast: (name) => `Otomasyon tamamlandı: ${name}`,
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
      ssrfNote: 'SSRF Koruması Aktif: Yerel/özel IP ve metadata adresleri sunucu tarafından engellenir.',
      historyTitle: 'Test Sonuçları',
      emptyHistory: 'Henüz ağ testi çalıştırılmadı.',
      statusCol: 'Durum',
      latencyCol: 'Gecikme',
      ipCol: 'Çözümlenen IP',
      authNeeded: 'Harici sunucu testi için Güvenlik Merkezinde oturumu doğrulayın.',
      openSecurity: 'Güvenlik',
    },
    storageLab: {
      title: 'Depolama',
      refresh: 'Yenile',
      exportBackup: 'Yedek İndir',
      exportedToast: 'LocalStorage yedeği indirildi.',
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
    },
    digitalTwin: {
      title: 'Dijital İkiz',
      resetBtn: 'Sıfırla',
      runSimBtn: 'Simülasyonu Çalıştır',
      runningSim: 'Simüle Ediliyor...',
      openChaosBtn: 'Deadpool & Kaos (23 Araç)',
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
    },
  },
  en: {
    modules: {
      dashboard: {label: 'Dashboard', short: 'Dashboard', summary: 'Live telemetry, AI engines and system overview.'},
      design_lab: {label: 'Design Lab', short: 'Design', summary: 'Isolated GOD MODE themes and live comparison.'},
      system_core: {label: 'System Core', short: 'System', summary: 'Live FPS, memory, storage and server health.'},
      diagnostics: {label: 'Diagnostics', short: 'Probes', summary: '8 live probes for API, storage and media engine.'},
      dev_toolkit: {label: 'Developer Tools', short: 'Tools', summary: 'Module graph, masked state, logs, network and profiler.'},
      security_center: {label: 'Security Center', short: 'Security', summary: 'Owner verification, device registry and audit log.'},
      settings: {label: 'Settings', short: 'Settings', summary: 'Independent GOD MODE language, design and layout.'},
      deadpool_chaos: {label: 'Deadpool & Chaos', short: 'Deadpool', summary: '100-feature wheel, UI engine and chaos lab.'},
      ai_lab: {label: 'AI Lab', short: 'AI Lab', summary: 'Model registry, live Gemini prompt studio and token inspector.'},
      autonomous_agents: {label: 'Autonomous Agents', short: 'Agents', summary: '7 specialized agents and approval-gated self-evolution.'},
      experimental_lab: {label: 'Experimental Lab', short: 'Exp Lab', summary: 'Feature flags, overrides and one-click rollback.'},
      media_engine: {label: 'Media Engines', short: 'Media', summary: 'FFmpeg WASM inspector, command builder and benchmark.'},
      terminal: {label: 'Terminal', short: 'Terminal', summary: 'Live autocomplete Morph command engine.'},
      automation_studio: {label: 'Automation', short: 'Flows', summary: 'Visual node-based workflow builder and runner.'},
      network_lab: {label: 'Network Lab', short: 'Network', summary: 'SSRF-hardened server & client latency diagnostics.'},
      storage_lab: {label: 'Storage', short: 'Storage', summary: 'LocalStorage, IndexedDB and Cache Storage explorer.'},
      time_machine: {label: 'Time Machine', short: 'Time', summary: 'Configuration snapshots, diff viewer and restore.'},
      digital_twin: {label: 'Digital Twin', short: 'Twin', summary: 'Isolated fault-injection and latency simulator.'},
    },
    shell: {
      activeSection: 'Core Modules',
      roadmapSection: 'Labs & Engines',
      roadmapShort: 'Labs',
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
      deadpoolTitle: 'Deadpool & Chaos (100)',
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
        state: 'State',
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
      },
      doneToast: (name) => `Workflow completed: ${name}`,
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
      ssrfNote: 'SSRF Defense Active: Private, loopback, and metadata IPs are blocked server-side.',
      historyTitle: 'Probe Results',
      emptyHistory: 'No network probes executed yet.',
      statusCol: 'Status',
      latencyCol: 'Latency',
      ipCol: 'Resolved IP',
      authNeeded: 'Verify your owner session in Security Center for server-side probes.',
      openSecurity: 'Security',
    },
    storageLab: {
      title: 'Storage',
      refresh: 'Refresh',
      exportBackup: 'Export Backup',
      exportedToast: 'LocalStorage backup downloaded.',
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
    },
    digitalTwin: {
      title: 'Digital Twin',
      resetBtn: 'Reset',
      runSimBtn: 'Run Simulation',
      runningSim: 'Simulating...',
      openChaosBtn: 'Deadpool & Chaos (23 Tools)',
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
    },
  },
};
