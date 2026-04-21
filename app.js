const assetBoardConfig = window.AssetBoardConfig;
const assetBoardUiHelpers = window.AssetBoardUiHelpers;
const assetStrategyState = window.AssetStrategyState;
const assetChartShell = window.AssetChartShell;
const assetChartsPanel = window.AssetChartsPanel;
const assetMetricCards = window.AssetMetricCards;
const assetNotesBoard = window.AssetNotesBoard;
const assetRealizedDefense = window.AssetRealizedDefense;
const assetSettingsPanel = window.AssetSettingsPanel;
const assetPortfolioPanels = window.AssetPortfolioPanels;
const assetTimelinePanel = window.AssetTimelinePanel;
const assetTradeFeePolicy = window.AssetTradeFeePolicy;

if (!assetBoardConfig) {
  throw new Error("AssetBoardConfig is missing. Load client/app-config.js before app.js.");
}

if (!assetBoardUiHelpers) {
  throw new Error("AssetBoardUiHelpers is missing. Load client/app-ui-helpers.js before app.js.");
}

if (!assetStrategyState) {
  throw new Error("AssetStrategyState is missing. Load client/strategy-state.js before app.js.");
}

if (!assetChartShell) {
  throw new Error("AssetChartShell is missing. Load client/asset-chart-shell.js before app.js.");
}

if (!assetChartsPanel) {
  throw new Error("AssetChartsPanel is missing. Load client/charts-panel.js before app.js.");
}

if (!assetMetricCards) {
  throw new Error("AssetMetricCards is missing. Load client/metric-cards.js before app.js.");
}

if (!assetNotesBoard) {
  throw new Error("AssetNotesBoard is missing. Load client/notes-board.js before app.js.");
}

if (!assetRealizedDefense) {
  throw new Error("AssetRealizedDefense is missing. Load client/realized-defense.js before app.js.");
}

if (!assetSettingsPanel) {
  throw new Error("AssetSettingsPanel is missing. Load client/settings-panel.js before app.js.");
}

if (!assetPortfolioPanels) {
  throw new Error("AssetPortfolioPanels is missing. Load client/portfolio-panels.js before app.js.");
}

if (!assetTimelinePanel) {
  throw new Error("AssetTimelinePanel is missing. Load client/timeline-panel.js before app.js.");
}

if (!assetTradeFeePolicy) {
  throw new Error("AssetTradeFeePolicy is missing. Load lib/trade-fee-policy.js before app.js.");
}

const {
  currencyFormatter,
  numberFormatter,
  compactNumberFormatter,
  usdFormatter,
  NOTES_STORAGE_KEY,
  PENDING_MUTATIONS_STORAGE_KEY,
  ACCESS_SESSION_STORAGE_KEY,
  PORTFOLIO_STORAGE_KEY,
  ACCESS_SESSION_TTL_MS,
  PORTFOLIO_CACHE_TTL_MS,
  PENDING_MUTATION_RETRY_INTERVAL_MS,
  SERVER_STATE_SYNC_INTERVAL_MS,
  UI_PREFERENCES_SAVE_DEBOUNCE_MS,
  PULL_REFRESH_TRIGGER_PX,
  PULL_REFRESH_MAX_SHIFT_PX,
  LIVE_REFRESH_WATCHDOG_INTERVAL_MS,
  LIVE_REFRESH_STALL_MIN_MS,
  US_STOCK_TAX_ALLOWANCE,
  US_STOCK_TAX_RATE,
  EMPTY_BOARD_VARIANT,
  SETTINGS_SECTION_ID,
  DEFAULT_LIVE_PRICE_PREFERENCES,
  BOARD_DEFAULT_CONFIG,
  ASSET_AUTOCOMPLETE_SEEDS,
  INITIAL_SETUP_MARKET_OPTIONS,
  INITIAL_SETUP_BROKER_OPTIONS,
  getAssetChartRanges,
  getDefaultAssetChartRange,
  MOBILE_SECTION_SHORTCUTS,
  LIVE_PRICE_TOGGLE_OPTIONS,
  MAX_TRADE_QUICK_ASSETS,
  EMPTY_BOARD_SHORTCUT_SUMMARIES,
  MOBILE_DEFERRED_SECTION_DELAYS,
  TRADE_STRATEGY_STAGE_OPTIONS,
  normalizeTradeStrategyStage,
  isBuyStrategyStage,
  isSellStrategyStage,
  resolveStrategyBudgetRatio,
  resolveStrategyStageSummary,
  resolveTradeStrategyTone,
} = assetBoardConfig;

window.getAssetChartRanges = getAssetChartRanges;
window.getDefaultAssetChartRange = getDefaultAssetChartRange;

const {
  getBoardVariant: resolveBoardVariant,
  getToggleableSectionOptions: resolveToggleableSectionOptions,
  isEmptyBoardVariant: resolveEmptyBoardVariant,
  getTargetGroups,
  countTargetItems,
  hasMeaningfulBoardContent: resolveMeaningfulBoardContent,
  getShortcutSummary: resolveShortcutSummary,
  shouldShowGuideByDefault: resolveShouldShowGuideByDefault,
  getDefaultVisibleSectionIds: resolveDefaultVisibleSectionIds,
  normalizeVisibleSectionIds: resolveVisibleSectionIds,
  normalizeLivePricePreferencesState,
  normalizeAutocompleteToken,
  normalizeTradeQuickAssetItemState,
  buildTradeQuickAssetStateKey,
  normalizeTradeQuickAssetsState,
  normalizeHiddenHoldingItemState,
  buildHiddenHoldingStateKey,
  normalizeHiddenHoldingsState,
  buildHoldingPreferenceItem,
  filterHiddenHoldingsToActiveItems: resolveActiveHiddenHoldings,
  normalizeUiPreferencesState: resolveUiPreferencesState,
  normalizeBoardConfigState,
} = assetBoardUiHelpers;

const {
  BROKER_OPTIONS_BY_MARKET,
  buildTradeFeeSummaryText,
  estimateTradeFee,
  buildMarketTradeFeeHelpText,
} = assetTradeFeePolicy;

const shortDecimalFormatter = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
const preciseCryptoQuantityFormatter = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 8,
});
const MUTATION_REQUEST_TIMEOUT_MS = 9000;

const colors = ["#17F9A6", "#5EC8FF", "#FFB84D", "#FF6B87"];
let currentPortfolioData = null;
let basePortfolioData = null;
let livePortfolioSnapshot = null;
let liveRefreshTimer = null;
let livePortfolioRefreshPromise = null;
let liveRefreshIntervalMs = 0;
let liveRefreshLifecycleBound = false;
let lastLiveRefreshWakeAt = 0;
let lastLiveRefreshTickAt = 0;
let lastLiveRefreshAttemptAt = 0;
let lastSuccessfulLiveRefreshAt = 0;
let lastLiveRecoveryAt = 0;
let lastLiveWatchdogFrameAt = 0;
let liveRefreshRequestSerial = 0;
let liveRefreshWatchdogTimer = null;
let liveRefreshWatchdogFrameId = 0;
let serverStateSyncTimer = null;
let serverStateSyncTimeout = null;
let serverStateSyncPromise = null;
let currentDateBadgeTimer = null;
let lastPortfolioLoadSource = "unknown";
let notesState = [];
let strategyBudgetEditorKey = "";
let tradeModalController = null;
let timelineTradeRegistry = new Map();
let strategyTradeRegistry = new Map();
let strategyStateEntryRegistry = new Map();
let hasBootedDashboard = false;
let activeAccessCode = "";
let activeAccessMode = "owner";
let activeBoardConfig = { ...BOARD_DEFAULT_CONFIG };
let currentUiPreferences = {
  visibleSections: [],
  livePrice: { ...DEFAULT_LIVE_PRICE_PREFERENCES },
  tradeQuickAssets: [],
  hiddenHoldings: [],
  updatedAt: "",
};
let lastSyncedUiPreferences = {
  visibleSections: [],
  livePrice: { ...DEFAULT_LIVE_PRICE_PREFERENCES },
  tradeQuickAssets: [],
  hiddenHoldings: [],
  updatedAt: "",
};
let pendingUiPreferencesMutation = null;
let pendingUiPreferencesSaveTimer = null;
let uiPreferencesSavePromise = null;

const notesHelpers = assetNotesBoard.createNotesHelpers({
  getNotesStorageKey,
  setNotesBoardStatus,
  canManagePortfolioMutations,
  escapeHtml,
  formatNumber,
  showAppConfirm,
  runSerializedNotesMutation,
  clearPendingMutationsByKind,
  scheduleServerStateSync,
  fetchWithAccessTimeout,
  createMutationRequestError,
  isServerMutationErrorRetryable,
  MUTATION_REQUEST_TIMEOUT_MS,
  isEmptyBoardVariant,
  getNotesState: () => notesState,
  setNotesState: (nextNotes) => {
    notesState = Array.isArray(nextNotes) ? nextNotes : [];
    return notesState;
  },
});

const {
  applyNotesServerResult,
  ensureNotesLoaded,
  normalizeStoredNotes,
  persistNotesToStorage,
  requestNotesMutation,
  hydrateNotesFromServer,
  renderNotes,
  initNotesBoard,
  bindNotesSection,
} = notesHelpers;

const chartsHelpers = assetChartsPanel.createChartsHelpers({
  alpha,
  formatPercent,
  formatSignedCurrency,
  formatCurrency,
  formatCompactNumber,
  formatPerformanceStartLabel,
});

const {
  renderCharts,
  renderChartStats,
  destroyCharts,
  renderChartUnavailable,
  readChartTheme,
  renderRealizedChartNote,
} = chartsHelpers;

const metricCardsHelpers = assetMetricCards.createMetricCardHelpers({
  METRIC_CARD_TONES: assetBoardConfig.METRIC_CARD_TONES,
  isEmptyBoardVariant,
  formatPerformanceStartLabel,
  formatCurrency,
  formatSignedCurrency,
  toneClass,
  estimateUsStockTax,
  setTextContentIfChanged,
  onCashMetricAction: (trigger) => {
    handleCashMetricCardAction(trigger);
  },
});

const {
  renderMetricCards,
  patchMetricCardsForLiveRefresh,
  initMetricCardActions,
} = metricCardsHelpers;

const realizedDefenseHelpers = assetRealizedDefense.createRealizedDefenseHelpers({
  bindPanelAccordion,
  bindSectionBarMenu,
  toneClass,
  escapeHtml,
  formatSignedCurrency,
  formatCurrency,
  formatPercent,
  formatSignedPercent,
  formatNumber,
  parsePerformanceStartDateValue,
  parseMonthDayToDate,
  isXrpTradeLike,
  buildXrpRecentBuyPoolAnalytics,
  getDisplayTradeNote,
  roundXrpDefenseValue,
});

const {
  buildXrpDefenseSnapshot,
  renderDefense,
  renderRealized,
  bindDefenseSection,
} = realizedDefenseHelpers;

const settingsPanelHelpers = assetSettingsPanel.createSettingsPanelHelpers({
  MOBILE_SECTION_SHORTCUTS,
  LIVE_PRICE_TOGGLE_OPTIONS,
  EMPTY_BOARD_VARIANT,
  SETTINGS_SECTION_ID,
  DEFAULT_LIVE_PRICE_PREFERENCES,
  getBoardVariant,
  getToggleableSectionOptions,
  isEmptyBoardVariant,
  hasMeaningfulBoardContent,
  getShortcutSummary,
  getDefaultVisibleSectionIds,
  normalizeVisibleSectionIds,
  normalizeLivePricePreferencesState,
  normalizeTradeQuickAssetsState,
  normalizeHiddenHoldingsState,
  escapeHtml,
  setInnerHtmlIfChanged,
  getDisplayAssetName,
  getCurrentUiPreferences: () => currentUiPreferences,
  getCurrentPortfolioData: () => currentPortfolioData,
  getBasePortfolioData: () => basePortfolioData,
  getMobileSectionState: () => mobileSectionState,
  closeMobileSectionOverlay,
  queueUiPreferencesMutation,
  openGuideDestination,
  restoreHoldingPosition,
  showAppToast,
  setSettingsStatus,
  getPendingUiPreferencesMutation: () => pendingUiPreferencesMutation,
  getUiPreferencesSavePromise: () => uiPreferencesSavePromise,
});

const {
  getVisibleSectionIds,
  getLivePricePreferences,
  getTradeQuickAssets,
  getHiddenHoldings,
  shouldShowGlobalIndices,
  isSectionVisible,
  renderMobileSectionHub,
  renderSettingsSection,
  applySectionVisibility,
  areVisibleSectionListsEqual,
  areLivePricePreferencesEqual,
  areTradeQuickAssetsEqual,
  areUiPreferencesEqual,
  bindSettingsSection,
} = settingsPanelHelpers;

const portfolioPanelsHelpers = assetPortfolioPanels.createPortfolioPanelsHelpers({
  colors,
  escapeHtml,
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
  toneClass,
  getDisplayAssetName,
  getBlankFamilyTargetContent,
  isEmptyBoardVariant,
  buildLiveTimestampCopy,
  renderTargetListItem,
  buildTableQuoteMarkup,
  buildTableFallbackMarkup,
  tableCell,
  resolveQuoteChangeDisplay,
  getHiddenHoldings,
  buildHiddenHoldingStateKey,
  buildHoldingPreferenceItem,
  resolveHoldingLiveStatus,
  formatHoldingQuantity,
  buildHoldingQuoteMarkup,
});

const {
  normalizeTargetTone,
  renderTargets,
  renderAllocation,
  renderAssetTable,
  renderHoldings,
} = portfolioPanelsHelpers;

const timelineHelpers = assetTimelinePanel.createTimelineHelpers({
  escapeHtml,
  formatNumber,
  formatCurrency,
  formatSignedCurrency,
  formatPercent,
  formatSignedPercent,
  formatDateTime,
  getSignedPriceToneClass,
  renderTradeStageBadge,
  getDisplayAssetName,
  getDisplayTradeNote,
  formatTradeQuantity,
  normalizeTradeQuantityKey,
  normalizeTimelineMoney,
  isXrpTradeLike,
  isEmptyBoardVariant,
  buildXrpRecentBuyPoolAnalytics,
  computeXrpDefenseOverrideOutcome,
  formatXrpDefenseGapLabel,
  parseTradeOutcomeNote,
  buildXrpDefenseSnapshot,
  getCurrentBasisYear,
  getCurrentContext: () => currentPortfolioData || basePortfolioData || {},
  setTimelineTradeRegistry: (nextRegistry) => {
    timelineTradeRegistry = nextRegistry instanceof Map ? nextRegistry : new Map();
    return timelineTradeRegistry;
  },
  canManagePortfolioMutations,
  bindTimelineSection,
});

const {
  buildRealizedTradeKey,
  getTimelineTradeKey,
  normalizeTimelineTrades,
  resolveXrpDefenseRecentTenBuyAverage,
  renderTimeline,
} = timelineHelpers;
let pendingMutationRetryTimer = null;
let pendingMutationFlushTimeout = null;
let appFeedbackState = {
  dialogResolver: null,
  dialogReturnFocus: null,
  cashEditorReturnFocus: null,
  toastSerial: 0,
};
let pullRefreshState = {
  bound: false,
  active: false,
  refreshing: false,
  startX: 0,
  startY: 0,
  distance: 0,
  scroller: null,
  resetTimer: null,
};
let pendingMutationEventsBound = false;
let serverStateSyncEventsBound = false;
let isFlushingPendingMutations = false;
let portfolioMutationChain = Promise.resolve();
let notesMutationChain = Promise.resolve();
let deferredMobileDashboardData = null;
let deferredMobileSectionTimers = new Map();
let deferredMobileSectionsRendered = new Set();
let motionObserver = null;
let mobileSectionState = {
  section: null,
  sectionId: "",
  returnSectionId: "",
  placeholder: null,
  originalParent: null,
};
let mobileSectionScrollTop = 0;
let mobileSectionContentScrollTops = new Map();
let pendingMobileSectionRestoreId = "";
let pendingMobileSectionRestoreReturnId = "";
let interactionLockUntil = 0;
let initialSetupState = {
  rows: [],
  nextId: 1,
};

function getBoardVariant() {
  return resolveBoardVariant(activeBoardConfig);
}

function getToggleableSectionOptions(variant = getBoardVariant()) {
  return resolveToggleableSectionOptions(variant);
}

function isEmptyBoardVariant() {
  return resolveEmptyBoardVariant(getBoardVariant());
}

function hasMeaningfulBoardContent(data = currentPortfolioData || basePortfolioData || {}) {
  return resolveMeaningfulBoardContent(data, notesState);
}

function getShortcutSummary(item = {}) {
  return resolveShortcutSummary(item, getBoardVariant());
}

function shouldShowGuideByDefault(data = currentPortfolioData || basePortfolioData || {}) {
  return resolveShouldShowGuideByDefault(getBoardVariant(), data, notesState);
}

function getDefaultVisibleSectionIds(variant = getBoardVariant(), data = currentPortfolioData || basePortfolioData || {}) {
  return resolveDefaultVisibleSectionIds(variant, data, notesState);
}

function normalizeVisibleSectionIds(visibleSections, variant = getBoardVariant(), data = currentPortfolioData || basePortfolioData || {}) {
  return resolveVisibleSectionIds(visibleSections, variant, data, notesState);
}

function filterHiddenHoldingsToActiveItems(hiddenHoldings = [], data = currentPortfolioData || basePortfolioData || {}) {
  return resolveActiveHiddenHoldings(hiddenHoldings, data);
}

function normalizeUiPreferencesState(uiPreferences = {}, variant = getBoardVariant(), data = currentPortfolioData || basePortfolioData || {}) {
  return resolveUiPreferencesState(uiPreferences, variant, data, notesState);
}

function applyBoardConfig(board = null, options = {}) {
  activeBoardConfig = normalizeBoardConfigState(board);
  if (typeof document !== "undefined" && document.body) {
    const isEmptyVariant = getBoardVariant() === EMPTY_BOARD_VARIANT;
    document.body.classList.toggle("board-variant-empty", isEmptyVariant);
    document.body.classList.toggle("board-variant-personal", !isEmptyVariant);
  }
  if (!options.skipRender) {
    renderHeroChrome(currentPortfolioData?.metadata || basePortfolioData?.metadata || {});
  }
}

function renderHeroChrome(metadata = {}) {
  const kicker = document.querySelector("#hero-kicker");
  const title = document.querySelector("#page-title");
  const heroEyebrow = String(activeBoardConfig.heroEyebrow || BOARD_DEFAULT_CONFIG.heroEyebrow).trim();
  const heroTitle =
    getBoardVariant() === EMPTY_BOARD_VARIANT
      ? String(activeBoardConfig.heroTitle || BOARD_DEFAULT_CONFIG.heroTitle).trim()
      : String(metadata?.mantra || activeBoardConfig.heroTitle || BOARD_DEFAULT_CONFIG.heroTitle).trim();
  const browserTitle =
    getBoardVariant() === EMPTY_BOARD_VARIANT
      ? String(activeBoardConfig.browserTitle || BOARD_DEFAULT_CONFIG.browserTitle).trim()
      : String(activeBoardConfig.browserTitle || BOARD_DEFAULT_CONFIG.browserTitle).trim();

  setTextContentIfChanged(kicker, heroEyebrow || BOARD_DEFAULT_CONFIG.heroEyebrow);
  setTextContentIfChanged(title, heroTitle || BOARD_DEFAULT_CONFIG.heroTitle);
  if (browserTitle) {
    document.title = browserTitle;
  }
}

function resolveStrategyMarketKey(value = "") {
  const market = String(value || "").trim();
  if (market === "암호화폐" || market === "crypto") {
    return "crypto";
  }
  if (market === "미국주식" || market === "us-stock") {
    return "us-stock";
  }
  if (market === "국내주식" || market === "kr-stock") {
    return "kr-stock";
  }
  return market;
}

function normalizeStrategySymbol(symbol = "", market = "") {
  const raw = String(symbol || "").trim();
  if (!raw) {
    return "";
  }

  if (market === "crypto") {
    const upper = raw.toUpperCase();
    return upper.startsWith("KRW-") ? upper : `KRW-${upper}`;
  }

  if (market === "us-stock") {
    return raw.toUpperCase();
  }

  return raw;
}

function buildStrategyEntityKey({ market = "", symbol = "", asset = "" } = {}) {
  const marketKey = resolveStrategyMarketKey(market);
  const normalizedSymbol = normalizeStrategySymbol(symbol, marketKey);
  const normalizedAsset = String(asset || "").trim();
  return `${marketKey}::${normalizedSymbol || normalizedAsset}`;
}

function buildTrackedEntityKey({ market = "", symbol = "", asset = "", name = "" } = {}) {
  return buildStrategyEntityKey({
    market,
    symbol,
    asset: asset || name,
  });
}

function buildTradeStageOptionsMarkup(selectedValue = "") {
  const normalizedSelected = normalizeTradeStrategyStage(selectedValue);
  const hasKnownOption = TRADE_STRATEGY_STAGE_OPTIONS.some((item) => item.value === normalizedSelected);
  return [
    '<option value="">선택 안 함</option>',
    ...(normalizedSelected && !hasKnownOption
      ? [`<option value="${escapeHtml(normalizedSelected)}" selected>${escapeHtml(normalizedSelected)}</option>`]
      : []),
    ...TRADE_STRATEGY_STAGE_OPTIONS.map(
      (item) => `<option value="${escapeHtml(item.value)}" ${item.value === normalizedSelected ? "selected" : ""}>${escapeHtml(item.label)}</option>`
    ),
  ].join("");
}

function renderTradeStageBadge(stage = "") {
  const normalized = normalizeTradeStrategyStage(stage);
  if (!normalized) {
    return "";
  }

  return `<span class="trade-stage-badge trade-stage-badge--${resolveTradeStrategyTone(normalized)}">${escapeHtml(normalized)}</span>`;
}

function getMarketLabelFromMetaMarket(value = "") {
  if (value === "crypto") {
    return "암호화폐";
  }
  if (value === "us-stock") {
    return "미국주식";
  }
  if (value === "kr-stock") {
    return "국내주식";
  }
  return String(value || "").trim();
}

function normalizeAssetDisplayTicker(symbol = "", marketLabel = "") {
  const raw = String(symbol || "").trim();
  if (!raw) {
    return "";
  }

  if (marketLabel === "암호화폐") {
    return raw.replace(/^KRW-/i, "").trim().toUpperCase();
  }

  if (marketLabel === "미국주식") {
    return raw.toUpperCase();
  }

  return raw;
}

function stripRepeatedTickerSuffix(value = "", ticker = "") {
  const normalizedTicker = String(ticker || "").trim();
  let next = String(value || "").trim();

  if (!next || !normalizedTicker) {
    return next;
  }

  const escapedTicker = normalizedTicker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\s*\\(${escapedTicker}\\)\\s*$`, "i");

  while (pattern.test(next)) {
    next = next.replace(pattern, "").trim();
  }

  return next;
}

function stripAssetInputTickerSuffix(value = "", market = "", symbol = "") {
  const marketLabel = ["암호화폐", "미국주식", "국내주식"].includes(market) ? market : getMarketLabelFromMetaMarket(market);
  const explicitTicker = normalizeAssetDisplayTicker(symbol, marketLabel);
  let next = String(value || "").trim();

  if (!next) {
    return "";
  }

  while (true) {
    const suffixMatch = next.match(/^(.*?)(?:\s*\(([^()]+)\))\s*$/);
    const candidateTicker = explicitTicker || normalizeAssetDisplayTicker(suffixMatch?.[2] || "", marketLabel);
    if (!suffixMatch || !candidateTicker) {
      return next;
    }

    const stripped = stripRepeatedTickerSuffix(next, candidateTicker);
    if (stripped === next) {
      return next;
    }
    next = stripped || candidateTicker;
  }
}

function formatAssetInputValue(item = {}, marketLabel = "") {
  const safeItem = item && typeof item === "object" ? item : {};
  const resolvedMarketLabel = marketLabel || getMarketLabelFromMetaMarket(safeItem.market);
  const symbol = String(safeItem.symbol || "").trim();
  const rawName = String(safeItem.name || safeItem.asset || "").trim();
  const ticker = normalizeAssetDisplayTicker(symbol, resolvedMarketLabel);
  const normalizedName = stripRepeatedTickerSuffix(rawName, ticker) || rawName || ticker;

  if (resolvedMarketLabel === "암호화폐") {
    if (!ticker) {
      return normalizedName;
    }
    return normalizeAutocompleteToken(normalizedName) === normalizeAutocompleteToken(ticker)
      ? `${ticker}(${ticker})`
      : `${normalizedName}(${ticker})`;
  }

  if (resolvedMarketLabel === "미국주식") {
    if (!ticker) {
      return normalizedName;
    }
    return normalizeAutocompleteToken(normalizedName) === normalizeAutocompleteToken(ticker)
      ? ticker
      : `${normalizedName} (${ticker})`;
  }

  if (resolvedMarketLabel === "국내주식") {
    if (!ticker) {
      return normalizedName;
    }
    return normalizedName === ticker ? ticker : `${normalizedName}(${ticker})`;
  }

  return normalizedName;
}

function buildDynamicAutocompleteEntry(item = {}) {
  const safeItem = item && typeof item === "object" ? item : {};
  const market = getMarketLabelFromMetaMarket(safeItem.market);
  if (!["암호화폐", "미국주식", "국내주식"].includes(market)) {
    return null;
  }

  const value = formatAssetInputValue(safeItem, market);
  if (!value) {
    return null;
  }

  return {
    value,
    title: value,
    meta:
      market === "암호화폐"
        ? "업비트 KRW 마켓"
        : market === "미국주식"
          ? "미국주식 티커"
          : "국내주식 종목코드",
    symbol: String(safeItem.symbol || "").trim(),
    aliases: [
      String(safeItem.name || "").trim(),
      String(safeItem.asset || "").trim(),
      String(safeItem.symbol || "").trim(),
      getDisplayAssetName(safeItem),
    ].filter(Boolean),
  };
}

function buildAssetAutocompleteCatalog() {
  const registry = new Map();
  const addEntry = (market, entry) => {
    if (!entry || !market) {
      return;
    }

    const key = `${market}:${entry.symbol || normalizeAutocompleteToken(entry.value)}`;
    const nextEntry = {
      ...entry,
      market,
      aliases: [...new Set([entry.value, entry.title, entry.meta, ...(entry.aliases || [])].filter(Boolean))],
    };

    if (registry.has(key)) {
      const existing = registry.get(key);
      registry.set(key, {
        ...existing,
        ...nextEntry,
        aliases: [...new Set([...(existing.aliases || []), ...(nextEntry.aliases || [])])],
      });
      return;
    }

    registry.set(key, nextEntry);
  };

  Object.entries(ASSET_AUTOCOMPLETE_SEEDS).forEach(([market, items]) => {
    items.forEach((item) => addEntry(market, item));
  });

  const source = currentPortfolioData || basePortfolioData;
  if (source?.holdings) {
    source.holdings.forEach((item) => {
      if (!isPlainObjectRecord(item)) {
        return;
      }
      addEntry(getMarketLabelFromMetaMarket(item.market), buildDynamicAutocompleteEntry(item));
    });
  }
  if (source?.targets?.groups) {
    source.targets.groups.forEach((group) => {
      if (!isPlainObjectRecord(group)) {
        return;
      }
      (group.items || []).forEach((item) => {
        if (!isPlainObjectRecord(item)) {
          return;
        }
        addEntry(getMarketLabelFromMetaMarket(item.market), buildDynamicAutocompleteEntry(item));
      });
    });
  }

  return [...registry.values()];
}

function getAssetAutocompleteSuggestions(market, query = "") {
  const normalizedMarket = String(market || "").trim();
  const normalizedQuery = normalizeAutocompleteToken(query);
  if (!normalizedQuery) {
    return [];
  }

  const candidates = buildAssetAutocompleteCatalog().filter((item) => item.market === normalizedMarket);

  return candidates
    .map((item) => {
      const aliasTokens = (item.aliases || []).map((alias) => normalizeAutocompleteToken(alias)).filter(Boolean);
      const exactMatch = aliasTokens.some((token) => token === normalizedQuery);
      const prefixMatch = aliasTokens.some((token) => token.startsWith(normalizedQuery));
      const includesMatch = aliasTokens.some((token) => token.includes(normalizedQuery));

      if (!exactMatch && !prefixMatch && !includesMatch) {
        return null;
      }

      return {
        ...item,
        score: exactMatch ? 0 : prefixMatch ? 1 : 2,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }
      return left.title.localeCompare(right.title, "ko");
    })
    .slice(0, 12);
}

function resolveBestAssetAutocomplete(market, query = "") {
  const suggestions = getAssetAutocompleteSuggestions(market, query);
  const normalizedQuery = normalizeAutocompleteToken(query);
  if (!normalizedQuery || !suggestions.length) {
    return null;
  }

  const exact = suggestions.find((item) =>
    (item.aliases || []).some((alias) => normalizeAutocompleteToken(alias) === normalizedQuery)
  );
  if (exact) {
    return exact;
  }

  return suggestions.length === 1 ? suggestions[0] : null;
}

function mergeAutocompleteSuggestions(primary = [], secondary = []) {
  const registry = new Map();

  [...primary, ...secondary].forEach((item) => {
    if (!item) {
      return;
    }

    const key = `${item.market || ""}:${item.symbol || normalizeAutocompleteToken(item.value || item.title || "")}`;
    if (!key) {
      return;
    }

    if (!registry.has(key)) {
      registry.set(key, {
        ...item,
        aliases: [...new Set([...(item.aliases || [])].filter(Boolean))],
      });
      return;
    }

    const existing = registry.get(key);
    registry.set(key, {
      ...existing,
      ...item,
      aliases: [...new Set([...(existing.aliases || []), ...(item.aliases || [])].filter(Boolean))],
    });
  });

  return [...registry.values()].slice(0, 12);
}

async function fetchRemoteAssetSuggestions(market, query) {
  const trimmedMarket = String(market || "").trim();
  const trimmedQuery = String(query || "").trim();

  if (!trimmedMarket || !normalizeAutocompleteToken(trimmedQuery)) {
    return [];
  }

  const url = new URL("/api/asset-search", window.location.origin);
  url.searchParams.set("market", trimmedMarket);
  url.searchParams.set("query", trimmedQuery);

  const response = await fetchWithAccess(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "자산 검색에 실패했습니다.");
  }

  return Array.isArray(payload?.suggestions) ? payload.suggestions : [];
}

function setupAssetAutocomplete({ input, marketSelect, panel, onSelect, asyncSource, disabledMarkets = [] }) {
  if (!input || !marketSelect || !panel || panel.dataset.bound === "true") {
    return {
      hide() {},
      syncValue() {},
    };
  }

  let currentSuggestions = [];
  let blurTimer = null;
  let latestRequestId = 0;
  const disabledMarketSet = new Set(disabledMarkets.map((item) => String(item || "").trim()));
  const formGroup = input.closest(".form-group--autocomplete");
  const tradeModal = input.closest(".trade-modal");
  const tradeForm = input.closest(".trade-form");
  const isDisabledMarket = () => disabledMarketSet.has(String(marketSelect.value || "").trim());
  const setSuggestingState = (isSuggesting) => {
    formGroup?.classList.toggle("is-suggesting", Boolean(isSuggesting));
    tradeModal?.classList.toggle("is-suggesting", Boolean(isSuggesting));
    tradeForm?.classList.toggle("is-autocomplete-open", Boolean(isSuggesting));
  };

  const hidePanel = () => {
    panel.hidden = true;
    panel.innerHTML = "";
    currentSuggestions = [];
    setSuggestingState(false);
  };

  const applySuggestion = (suggestion) => {
    if (!suggestion) {
      return;
    }

    input.value = suggestion.value;
    hidePanel();
    onSelect?.(suggestion);
  };

  const syncValue = () => {
    if (isDisabledMarket()) {
      return;
    }

    const normalizedInput = normalizeAutocompleteToken(input.value);
    const fromCurrent = currentSuggestions.find((item) =>
      (item.aliases || [item.value, item.title, item.symbol]).some(
        (alias) => normalizeAutocompleteToken(alias) === normalizedInput
      )
    );
    const suggestion = fromCurrent || resolveBestAssetAutocomplete(marketSelect.value, input.value);
    if (suggestion) {
      applySuggestion(suggestion);
    }
  };

  const renderSuggestionItems = (suggestions) => {
    currentSuggestions = suggestions;

    if (!suggestions.length) {
      hidePanel();
      return;
    }

    panel.hidden = false;
    setSuggestingState(true);
    panel.innerHTML = suggestions
      .map(
        (item, index) => `
          <button type="button" class="asset-suggestion-button" data-asset-suggestion-index="${index}">
            <span class="asset-suggestion-name">${escapeHtml(item.title)}</span>
            <span class="asset-suggestion-meta">${escapeHtml(item.meta)}</span>
          </button>
        `
      )
      .join("");
  };

  const renderSuggestions = async () => {
    if (isDisabledMarket()) {
      hidePanel();
      return;
    }

    const query = input.value;
    const normalizedQuery = normalizeAutocompleteToken(query);

    if (!normalizedQuery) {
      hidePanel();
      return;
    }

    const localSuggestions = getAssetAutocompleteSuggestions(marketSelect.value, query);
    if (!asyncSource) {
      renderSuggestionItems(localSuggestions);
      return;
    }

    const requestId = ++latestRequestId;
    try {
      const remoteSuggestions = await asyncSource(marketSelect.value, query);
      if (requestId !== latestRequestId) {
        return;
      }
      renderSuggestionItems(mergeAutocompleteSuggestions(remoteSuggestions, localSuggestions));
    } catch (error) {
      if (requestId !== latestRequestId) {
        return;
      }
      renderSuggestionItems(localSuggestions);
    }
  };

  input.addEventListener("focus", () => {
    if (isDisabledMarket()) {
      hidePanel();
      return;
    }

    if (normalizeAutocompleteToken(input.value)) {
      renderSuggestions();
    } else {
      hidePanel();
    }
  });
  input.addEventListener("input", renderSuggestions);
  input.addEventListener("blur", () => {
    blurTimer = window.setTimeout(() => {
      syncValue();
      hidePanel();
    }, 120);
  });
  marketSelect.addEventListener("change", () => {
    latestRequestId += 1;
    input.value = "";
    hidePanel();
  });
  panel.addEventListener("mousedown", (event) => {
    event.preventDefault();
    if (blurTimer) {
      window.clearTimeout(blurTimer);
      blurTimer = null;
    }
  });
  panel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-asset-suggestion-index]");
    if (!button) {
      return;
    }

    const suggestion = currentSuggestions[Number(button.dataset.assetSuggestionIndex)];
    applySuggestion(suggestion);
    input.focus();
  });

  panel.dataset.bound = "true";
  hidePanel();

  return {
    hide: hidePanel,
    syncValue,
  };
}

function getNotesStorageKey() {
  const suffix = activeAccessCode ? `:${String(activeAccessCode).trim().toLowerCase()}` : "";
  return `${NOTES_STORAGE_KEY}${suffix}`;
}

function getPendingMutationsStorageKey() {
  const suffix = activeAccessCode ? `:${String(activeAccessCode).trim().toLowerCase()}` : "";
  return `${PENDING_MUTATIONS_STORAGE_KEY}${suffix}`;
}

function getPortfolioStorageKey() {
  const suffix = activeAccessCode ? `:${String(activeAccessCode).trim().toLowerCase()}` : "";
  return `${PORTFOLIO_STORAGE_KEY}${suffix}`;
}

function loadPersistedAccessSession() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(ACCESS_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const code = String(parsed?.code || "").trim();
    const mode = String(parsed?.mode || "owner").trim() || "owner";
    const expiresAt = Number(parsed?.expiresAt || 0);
    if (!code || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      window.localStorage.removeItem(ACCESS_SESSION_STORAGE_KEY);
      return null;
    }

    return {
      code,
      mode,
      expiresAt,
    };
  } catch (error) {
    console.warn("Failed to load access session", error);
    window.localStorage.removeItem(ACCESS_SESSION_STORAGE_KEY);
    return null;
  }
}

function persistAccessSession(code = "", mode = "owner", ttlMs = ACCESS_SESSION_TTL_MS) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  const normalizedCode = String(code || "").trim();
  if (!normalizedCode) {
    window.localStorage.removeItem(ACCESS_SESSION_STORAGE_KEY);
    return;
  }

  try {
    window.localStorage.setItem(
      ACCESS_SESSION_STORAGE_KEY,
      JSON.stringify({
        code: normalizedCode,
        mode: String(mode || "owner").trim() || "owner",
        expiresAt: Date.now() + ttlMs,
      })
    );
  } catch (error) {
    console.warn("Failed to persist access session", error);
  }
}

function clearPersistedAccessSession() {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.removeItem(ACCESS_SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear access session", error);
  }
}

function isPlainObjectRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeObjectArray(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.filter((item) => isPlainObjectRecord(item));
}

function sanitizePortfolioPayload(data = null) {
  if (!isPlainObjectRecord(data)) {
    return null;
  }

  const next = structuredClone(data);
  next.holdings = sanitizeObjectArray(next.holdings);
  next.realized = sanitizeObjectArray(next.realized);
  next.assetStatus = sanitizeObjectArray(next.assetStatus);

  if (isPlainObjectRecord(next.trades)) {
    next.trades = {
      ...next.trades,
      stocks: sanitizeObjectArray(next.trades.stocks),
      crypto: sanitizeObjectArray(next.trades.crypto),
    };
  }

  if (isPlainObjectRecord(next.targets) && Array.isArray(next.targets.groups)) {
    next.targets = {
      ...next.targets,
      groups: next.targets.groups
        .filter((group) => isPlainObjectRecord(group))
        .map((group) => ({
          ...group,
          items: sanitizeObjectArray(group.items),
        })),
    };
  }

  if (isPlainObjectRecord(next.uiPreferences)) {
    next.uiPreferences = {
      ...next.uiPreferences,
      visibleSections: Array.isArray(next.uiPreferences.visibleSections)
        ? next.uiPreferences.visibleSections.filter((item) => typeof item === "string")
        : [],
      tradeQuickAssets: sanitizeObjectArray(next.uiPreferences.tradeQuickAssets),
      hiddenHoldings: sanitizeObjectArray(next.uiPreferences.hiddenHoldings),
    };
  }

  if (isPlainObjectRecord(next.strategyBudgets)) {
    next.strategyBudgets = {
      ...next.strategyBudgets,
      items: sanitizeObjectArray(next.strategyBudgets.items),
    };
  }

  return next;
}

function loadCachedPortfolioData() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getPortfolioStorageKey());
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const data = sanitizePortfolioPayload(parsed?.data);
    const savedAt = Number(parsed?.savedAt || 0);
    if (!data) {
      window.localStorage.removeItem(getPortfolioStorageKey());
      return null;
    }

    if (Number.isFinite(savedAt) && savedAt > 0 && Date.now() - savedAt > PORTFOLIO_CACHE_TTL_MS) {
      window.localStorage.removeItem(getPortfolioStorageKey());
      return null;
    }

    return data;
  } catch (error) {
    console.warn("Failed to load cached portfolio", error);
    try {
      window.localStorage.removeItem(getPortfolioStorageKey());
    } catch (_error) {
      // Ignore cleanup failures.
    }
    return null;
  }
}

function persistPortfolioToStorage(data = null) {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  const normalizedData = sanitizePortfolioPayload(data);
  if (!normalizedData) {
    return false;
  }

  try {
    window.localStorage.setItem(
      getPortfolioStorageKey(),
      JSON.stringify({
        savedAt: Date.now(),
        revision: getPortfolioRevisionValue(normalizedData),
        data: normalizedData,
      })
    );
    return true;
  } catch (error) {
    console.warn("Failed to cache portfolio", error);
    return false;
  }
}

function setTradeFormStatus(message = "", tone = "neutral") {
  const status = document.querySelector("#trade-form-status");
  if (!status) {
    return;
  }

  status.textContent = message;
  status.dataset.tone = tone;
}

function setNotesBoardStatus(message = "", tone = "neutral") {
  const status = document.querySelector("#notes-status");
  if (!status) {
    return;
  }

  status.textContent = message;
  status.dataset.tone = tone;
}

function setStrategyStateStatus(message = "", tone = "neutral") {
  const status = document.querySelector("#strategy-state-status");
  if (!status) {
    return;
  }

  status.textContent = message;
  status.dataset.tone = tone;
}

function setSettingsStatus(message = "", tone = "neutral") {
  const status = document.querySelector("#settings-status");
  if (!status) {
    return;
  }

  status.textContent = message;
  status.dataset.tone = tone;
}

function initAppFeedback() {
  const dialog = document.querySelector("#app-dialog");
  const confirmButton = document.querySelector("#app-dialog-confirm");
  if (!dialog || dialog.dataset.bound === "true") {
    return;
  }

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target.closest("[data-app-dialog-close]")) {
      closeAppDialog(false);
    }
  });

  confirmButton?.addEventListener("click", () => {
    closeAppDialog(true);
  });

  document.addEventListener(
    "keydown",
    (event) => {
      if (dialog.hidden) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeAppDialog(false);
      }
    },
    true
  );

  dialog.dataset.bound = "true";
  initCashEditorDialog();
}

function closeAppDialog(result = false) {
  const dialog = document.querySelector("#app-dialog");
  const confirmButton = document.querySelector("#app-dialog-confirm");
  const cancelButton = document.querySelector("#app-dialog-cancel");
  const resolver = appFeedbackState.dialogResolver;
  const returnFocus = appFeedbackState.dialogReturnFocus;

  appFeedbackState.dialogResolver = null;
  appFeedbackState.dialogReturnFocus = null;

  if (dialog) {
    dialog.hidden = true;
    dialog.setAttribute("aria-hidden", "true");
    dialog.classList.remove("is-open");
  }
  if (confirmButton) {
    confirmButton.removeAttribute("data-tone");
  }
  if (cancelButton) {
    cancelButton.hidden = false;
  }

  if (returnFocus && typeof returnFocus.focus === "function" && returnFocus.isConnected) {
    window.requestAnimationFrame(() => {
      returnFocus.focus({ preventScroll: true });
    });
  }

  if (typeof resolver === "function") {
    resolver(result);
  }
}

function setCashEditorStatus(message = "", tone = "neutral") {
  const status = document.querySelector("#cash-editor-status");
  if (!status) {
    return;
  }

  status.textContent = String(message || "").trim();
  if (tone && tone !== "neutral") {
    status.dataset.tone = tone;
  } else {
    delete status.dataset.tone;
  }
}

function stripCashEditorFormatting(value = "") {
  return String(value || "").replace(/[,\s원₩]/g, "");
}

function normalizeCashEditorTokens(value = "") {
  const stripped = stripCashEditorFormatting(value);
  const sign = stripped.startsWith("+") || stripped.startsWith("-") ? stripped[0] : "";
  const digits = (sign ? stripped.slice(1) : stripped)
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "");

  return {
    sign,
    digits,
  };
}

function formatCashEditorDigits(value = "") {
  const digits = String(value || "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "";
}

function formatCashEditorDisplayValue(value = "", options = {}) {
  const { sign, digits } = normalizeCashEditorTokens(value);
  if (!digits) {
    return options.allowSignOnly && sign ? sign : "";
  }

  return `${sign}${formatCashEditorDigits(digits)}`;
}

function formatCashEditorValue(value = 0) {
  const numeric = Math.max(0, Math.trunc(Number(value || 0)));
  return formatCashEditorDigits(String(numeric));
}

function formatCashEditorInputElement(input) {
  if (!input) {
    return;
  }

  input.value = formatCashEditorDisplayValue(input.value, { allowSignOnly: true });
}

function parseCashEditorValue(value = "", currentCashTotal = 0) {
  const stripped = stripCashEditorFormatting(value);
  if (!stripped) {
    return {
      mode: "empty",
      nextCashTotal: Number.NaN,
      delta: Number.NaN,
    };
  }

  if (/^[+-]\d+$/.test(stripped)) {
    const delta = Number(stripped);
    return {
      mode: "delta",
      nextCashTotal: Math.trunc(Number(currentCashTotal || 0) + delta),
      delta,
    };
  }

  if (/^\d+$/.test(stripped)) {
    const nextCashTotal = Number(stripped);
    return {
      mode: "absolute",
      nextCashTotal,
      delta: nextCashTotal - Math.trunc(Number(currentCashTotal || 0)),
    };
  }

  return {
    mode: "invalid",
    nextCashTotal: Number.NaN,
    delta: Number.NaN,
  };
}

function syncCashEditorSummary() {
  const dialog = document.querySelector("#cash-editor-dialog");
  const input = document.querySelector("#cash-editor-input");
  const currentNode = document.querySelector("#cash-editor-current");
  const deltaNode = document.querySelector("#cash-editor-delta");
  const currentCashTotal = Math.max(0, Math.trunc(Number(dialog?.dataset.currentCashTotal || 0)));
  const parsed = parseCashEditorValue(input?.value || "", currentCashTotal);
  const nextCashTotal = Number(parsed?.nextCashTotal);
  const delta = Number(parsed?.delta);

  if (currentNode) {
    currentNode.textContent = `현재 기준 ${formatCurrency(currentCashTotal)}`;
  }
  if (!deltaNode) {
    return;
  }

  if (!Number.isFinite(nextCashTotal) || !Number.isFinite(delta)) {
    deltaNode.textContent = "차이 계산 대기";
    delete deltaNode.dataset.tone;
    return;
  }

  if (nextCashTotal < 0) {
    deltaNode.textContent = `차이 ${formatSignedCurrency(delta)} · 0원 미만 저장 불가`;
    deltaNode.dataset.tone = "loss";
    return;
  }

  deltaNode.textContent = `차이 ${formatSignedCurrency(delta)} · 예상 ${formatCurrency(nextCashTotal)}`;

  if (delta !== 0) {
    deltaNode.dataset.tone = toneClass(delta);
  } else {
    delete deltaNode.dataset.tone;
  }
}

function closeCashEditorDialog(options = {}) {
  const dialog = document.querySelector("#cash-editor-dialog");
  const input = document.querySelector("#cash-editor-input");
  const submitButton = document.querySelector("#cash-editor-submit");
  const returnFocus = appFeedbackState.cashEditorReturnFocus;
  const shouldRestoreFocus = options.restoreFocus !== false;

  appFeedbackState.cashEditorReturnFocus = null;

  if (dialog) {
    dialog.hidden = true;
    dialog.setAttribute("aria-hidden", "true");
    dialog.classList.remove("is-open");
    delete dialog.dataset.currentCashTotal;
  }
  if (input) {
    input.disabled = false;
    input.value = "";
  }
  if (submitButton) {
    submitButton.disabled = false;
  }

  setCashEditorStatus("");

  if (shouldRestoreFocus && returnFocus && typeof returnFocus.focus === "function" && returnFocus.isConnected) {
    window.requestAnimationFrame(() => {
      returnFocus.focus({ preventScroll: true });
    });
  }
}

function openCashEditorDialog(currentCashTotal = 0, trigger = null) {
  const dialog = document.querySelector("#cash-editor-dialog");
  const input = document.querySelector("#cash-editor-input");
  if (!dialog || !input) {
    return;
  }

  const normalizedCashTotal = Math.max(0, Math.trunc(Number(currentCashTotal || 0)));
  appFeedbackState.cashEditorReturnFocus = trigger instanceof HTMLElement
    ? trigger
    : document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  dialog.dataset.currentCashTotal = String(normalizedCashTotal);
  dialog.hidden = false;
  dialog.setAttribute("aria-hidden", "false");
  dialog.classList.add("is-open");

  input.disabled = false;
  input.value = formatCashEditorValue(normalizedCashTotal);
  formatCashEditorInputElement(input);
  setCashEditorStatus("");
  syncCashEditorSummary();

  window.requestAnimationFrame(() => {
    input.focus({ preventScroll: true });
    input.setSelectionRange?.(0, input.value.length);
  });
}

function initCashEditorDialog() {
  const dialog = document.querySelector("#cash-editor-dialog");
  const form = document.querySelector("#cash-editor-form");
  const input = document.querySelector("#cash-editor-input");
  const submitButton = document.querySelector("#cash-editor-submit");

  if (!dialog || !form || !input || dialog.dataset.bound === "true") {
    return;
  }

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target.closest("[data-cash-editor-close]")) {
      closeCashEditorDialog();
    }
  });

  input.addEventListener("input", () => {
    syncCashEditorSummary();
    setCashEditorStatus("");
  });

  input.addEventListener("focusin", () => {
    syncCashEditorSummary();
  });

  input.addEventListener("focusout", () => {
    formatCashEditorInputElement(input);
    syncCashEditorSummary();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const currentCashTotal = Math.max(0, Math.trunc(Number(dialog.dataset.currentCashTotal || 0)));
    const parsed = parseCashEditorValue(input.value, currentCashTotal);
    const nextCashTotal = Number(parsed?.nextCashTotal);

    if (!Number.isFinite(nextCashTotal) || nextCashTotal < 0) {
      setCashEditorStatus("현재 총액 또는 +/- 조정값을 입력해주세요. 결과는 0원 이상이어야 합니다.", "error");
      input.focus();
      return;
    }

    input.disabled = true;
    submitButton.disabled = true;
    setCashEditorStatus("현금 보유를 반영하는 중입니다...", "neutral");

    try {
      await applyCashMutation(
        {
          cashTotal: nextCashTotal,
          note: "현금 보유 카드에서 직접 수정",
        },
        {
          successMessage:
            nextCashTotal === currentCashTotal
              ? `현금 보유를 ${formatCurrency(nextCashTotal)} 기준으로 다시 맞췄습니다.`
              : `현금 보유를 ${formatCurrency(nextCashTotal)}로 반영했습니다.`,
        }
      );
      closeCashEditorDialog();
    } catch (error) {
      console.error(error);
      input.disabled = false;
      submitButton.disabled = false;
      setCashEditorStatus(error?.message || "현금 보유 수정에 실패했습니다.", "error");
      showAppToast(error?.message || "현금 보유 수정에 실패했습니다.", "error", {
        title: "현금 저장 실패",
      });
      input.focus();
    }
  });

  document.addEventListener(
    "keydown",
    (event) => {
      if (dialog.hidden) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeCashEditorDialog();
      }
    },
    true
  );

  dialog.dataset.bound = "true";
}

function showAppConfirm({
  eyebrow = "Confirm",
  title = "확인",
  message = "",
  confirmText = "확인",
  cancelText = "취소",
  tone = "accent",
} = {}) {
  const dialog = document.querySelector("#app-dialog");
  const eyebrowNode = document.querySelector("#app-dialog-eyebrow");
  const titleNode = document.querySelector("#app-dialog-title");
  const messageNode = document.querySelector("#app-dialog-message");
  const confirmButton = document.querySelector("#app-dialog-confirm");
  const cancelButton = document.querySelector("#app-dialog-cancel");

  if (!dialog || !confirmButton || !cancelButton) {
    return Promise.resolve(window.confirm([title, message].filter(Boolean).join("\n\n")));
  }

  if (appFeedbackState.dialogResolver) {
    closeAppDialog(false);
  }

  appFeedbackState.dialogReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  if (eyebrowNode) {
    eyebrowNode.textContent = eyebrow;
  }
  if (titleNode) {
    titleNode.textContent = title;
  }
  if (messageNode) {
    messageNode.textContent = message;
  }

  confirmButton.textContent = confirmText || "확인";
  if (tone) {
    confirmButton.dataset.tone = tone;
  } else {
    confirmButton.removeAttribute("data-tone");
  }

  const hasCancel = cancelText !== false;
  cancelButton.hidden = !hasCancel;
  cancelButton.textContent = typeof cancelText === "string" && cancelText.trim() ? cancelText : "취소";

  dialog.hidden = false;
  dialog.setAttribute("aria-hidden", "false");
  dialog.classList.add("is-open");

  return new Promise((resolve) => {
    appFeedbackState.dialogResolver = resolve;
    window.requestAnimationFrame(() => {
      const focusTarget = hasCancel ? cancelButton : confirmButton;
      focusTarget?.focus({ preventScroll: true });
    });
  });
}

function getAppToastTitle(tone = "info") {
  if (tone === "error") {
    return "작업 실패";
  }
  if (tone === "success") {
    return "완료";
  }
  return "안내";
}

function showAppToast(message = "", tone = "info", options = {}) {
  const stack = document.querySelector("#app-toast-stack");
  if (!stack || !String(message || "").trim()) {
    return;
  }

  const toastTone = tone === "error" ? "error" : tone === "success" ? "success" : "info";
  const toast = document.createElement("article");
  const head = document.createElement("div");
  const copy = document.createElement("div");
  const title = document.createElement("strong");
  const body = document.createElement("p");
  const closeButton = document.createElement("button");
  const toastId = `toast-${Date.now()}-${appFeedbackState.toastSerial += 1}`;
  const duration = Number(options.duration) > 0 ? Number(options.duration) : toastTone === "error" ? 4200 : 2800;
  let dismissTimer = null;

  toast.className = `app-toast app-toast--${toastTone}`;
  toast.id = toastId;
  toast.setAttribute("role", toastTone === "error" ? "alert" : "status");
  toast.setAttribute("aria-live", toastTone === "error" ? "assertive" : "polite");

  head.className = "app-toast-head";
  copy.className = "app-toast-copy";
  title.textContent = String(options.title || getAppToastTitle(toastTone));
  body.textContent = String(message || "").trim();

  closeButton.type = "button";
  closeButton.className = "app-toast-close";
  closeButton.textContent = "닫기";
  closeButton.setAttribute("aria-label", "알림 닫기");

  copy.append(title, body);
  head.append(copy, closeButton);
  toast.append(head);
  stack.append(toast);

  const dismiss = () => {
    if (!toast.isConnected) {
      return;
    }
    if (dismissTimer) {
      window.clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    toast.classList.remove("is-visible");
    window.setTimeout(() => {
      toast.remove();
    }, 180);
  };

  closeButton.addEventListener("click", dismiss);
  dismissTimer = window.setTimeout(dismiss, duration);

  window.requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });
}

function broadcastPendingMutationStatus(message = "", tone = "neutral", kinds = ["trade", "target", "note"]) {
  const normalizedKinds = Array.isArray(kinds) ? kinds : [kinds];
  const uniqueKinds = new Set(normalizedKinds.filter(Boolean));

  if (uniqueKinds.has("trade")) {
    setTradeFormStatus(message, tone);
  }
  if (uniqueKinds.has("target")) {
    setTargetFormStatus(message, tone);
  }
  if (uniqueKinds.has("note")) {
    setNotesBoardStatus(message, tone);
  }
  if (uniqueKinds.has("strategy-budget")) {
    setStrategyStateStatus(message, tone);
  }
  if (uniqueKinds.has("ui-preferences")) {
    setSettingsStatus(message, tone);
  }
  if (uniqueKinds.has("cash") && String(message || "").trim()) {
    showAppToast(message, tone === "error" ? "error" : tone === "success" ? "success" : "info", {
      title: tone === "error" ? "현금 변경 실패" : tone === "success" ? "현금 변경 반영" : "현금 변경 대기",
      duration: tone === "neutral" ? 2600 : 3600,
    });
  }
}

function normalizePendingMutationEntry(entry = {}) {
  const id = String(entry.id || "").trim();
  const kind = String(entry.kind || "").trim();
  const method = String(entry.method || "").trim().toUpperCase();
  if (!id || !kind || !method) {
    return null;
  }

  return {
    id,
    kind,
    method,
    payload: entry.payload || {},
    queuedAt: entry.queuedAt || new Date().toISOString(),
    successMessage: String(entry.successMessage || "").trim(),
  };
}

function loadPendingMutationsFromStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getPendingMutationsStorageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(normalizePendingMutationEntry).filter(Boolean);
  } catch (error) {
    console.error(error);
    return [];
  }
}

function persistPendingMutationsToStorage(entries = []) {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  try {
    const normalized = (Array.isArray(entries) ? entries : []).map(normalizePendingMutationEntry).filter(Boolean);
    window.localStorage.setItem(getPendingMutationsStorageKey(), JSON.stringify(normalized));
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

function removePendingMutations(predicate = () => false) {
  const queue = loadPendingMutationsFromStorage();
  const nextQueue = queue.filter((entry) => !predicate(entry));
  if (nextQueue.length === queue.length) {
    return 0;
  }

  persistPendingMutationsToStorage(nextQueue);
  return queue.length - nextQueue.length;
}

function clearPendingMutationsByKind(kind = "") {
  const normalizedKind = String(kind || "").trim();
  if (!normalizedKind) {
    return 0;
  }

  return removePendingMutations((entry) => entry.kind === normalizedKind);
}

function buildPendingTargetMutationScopeKey(payload = {}) {
  const normalized = normalizeTradeQuickAssetItemState({
    market: payload?.market,
    asset: payload?.asset || payload?.name,
    symbol: payload?.symbol,
  });
  return normalized ? buildTradeQuickAssetStateKey(normalized) : "";
}

function getPendingMutationScopeKey(entry = {}) {
  if (entry?.kind === "target") {
    return `target:${buildPendingTargetMutationScopeKey(entry.payload || {})}`;
  }

  if (entry?.kind === "ui-preferences") {
    return "ui-preferences";
  }

  return "";
}

function clearPendingTargetMutationsForPayload(payload = {}) {
  const scopeKey = buildPendingTargetMutationScopeKey(payload);
  if (!scopeKey) {
    return 0;
  }

  return removePendingMutations(
    (entry) => entry.kind === "target" && buildPendingTargetMutationScopeKey(entry.payload || {}) === scopeKey
  );
}

function enqueuePendingMutation(entry = {}) {
  const normalized = normalizePendingMutationEntry(entry);
  if (!normalized) {
    return loadPendingMutationsFromStorage().length;
  }

  const scopeKey = getPendingMutationScopeKey(normalized);
  let queue = loadPendingMutationsFromStorage();
  if (scopeKey) {
    queue = queue.filter((item) => getPendingMutationScopeKey(item) !== scopeKey);
  }
  const existingIndex = queue.findIndex((item) => item.id === normalized.id);
  if (existingIndex >= 0) {
    queue[existingIndex] = normalized;
  } else {
    queue.push(normalized);
  }

  persistPendingMutationsToStorage(queue);
  return queue.length;
}

function createMutationId(kind = "mutation") {
  const prefix = String(kind || "mutation").trim().toLowerCase() || "mutation";
  if (window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function createMutationRequestError(message = "", options = {}) {
  const error = new Error(message || "요청 처리에 실패했습니다.");
  error.status = Number.isFinite(Number(options.status)) ? Number(options.status) : 0;
  error.retryable = Boolean(options.retryable);
  return error;
}

function isRetryableMutationError(error) {
  return Boolean(error?.retryable);
}

function isServerMutationErrorRetryable(status = 0, message = "") {
  const normalizedStatus = Number(status) || 0;
  const normalizedMessage = String(message || "").trim();

  if (normalizedStatus === 429) {
    return true;
  }

  if (normalizedStatus < 500) {
    return false;
  }

  if (!normalizedMessage) {
    return true;
  }

  const nonRetryableHints = [
    "다른 변경이 먼저 저장되었습니다",
    "찾지 못했습니다",
    "확인하세요",
    "이미 관심종목에 있는",
    "과거 거래는 추가할 수 없습니다",
    "플랫폼을 선택하세요",
    "수량은 0보다 커야 합니다",
    "단가는 0보다 커야 합니다",
    "거래금액을 확인하세요",
    "수수료를 확인하세요",
    "평균단가를 찾지 못했습니다",
    "보유수량이 부족합니다",
  ];

  return !nonRetryableHints.some((hint) => normalizedMessage.includes(hint));
}

function isStalePortfolioWriteMessage(message = "") {
  return String(message || "").includes("다른 변경이 먼저 저장되었습니다");
}

function waitForMutationRetryBackoff(attempt = 1) {
  const delay = Math.min(400, 120 * Math.max(1, Number(attempt) || 1));
  return new Promise((resolve) => {
    window.setTimeout(resolve, delay);
  });
}

function runSerializedPortfolioMutation(task) {
  const run = portfolioMutationChain.catch(() => {}).then(task);
  portfolioMutationChain = run.catch(() => {});
  return run;
}

function runSerializedNotesMutation(task) {
  const run = notesMutationChain.catch(() => {}).then(task);
  notesMutationChain = run.catch(() => {});
  return run;
}

function describePendingMutationCount(count = 0) {
  return `저장 대기 ${formatNumber(count)}건 · 연결 복구 후 자동 저장`;
}

function schedulePendingMutationFlush(delayMs = 1200) {
  if (typeof window === "undefined") {
    return;
  }

  if (pendingMutationFlushTimeout) {
    window.clearTimeout(pendingMutationFlushTimeout);
  }

  pendingMutationFlushTimeout = window.setTimeout(() => {
    pendingMutationFlushTimeout = null;
    void flushPendingMutations();
  }, delayMs);
}

function buildAccessHeaders(headers = {}) {
  const nextHeaders = {
    ...headers,
  };

  if (activeAccessCode) {
    nextHeaders["X-Access-Code"] = activeAccessCode;
  }

  return nextHeaders;
}

async function fetchWithAccess(input, options = {}) {
  const headers = buildAccessHeaders(options.headers || {});
  return fetch(input, {
    ...options,
    headers,
  });
}

async function fetchWithTimeout(input, options = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchWithAccessTimeout(input, options = {}, timeoutMs = 4500) {
  const headers = buildAccessHeaders(options.headers || {});
  return fetchWithTimeout(
    input,
    {
      ...options,
      headers,
    },
    timeoutMs
  );
}

async function extractResponseErrorMessage(response, fallbackMessage = "") {
  const fallback =
    String(fallbackMessage || "").trim() || `요청에 실패했습니다. (${Number(response?.status) || 0})`;

  try {
    const payload = await response.clone().json();
    if (typeof payload?.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch (_error) {
    // Ignore JSON parse failures and keep resolving a readable fallback.
  }

  if (response?.status === 401 || response?.status === 403) {
    return "접속 코드가 만료되었거나 올바르지 않습니다. 다시 입력해주세요.";
  }

  if ((Number(response?.status) || 0) >= 500) {
    return "서버 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
  }

  return fallback;
}

async function fetchJsonWithTimeout(input, options = {}, timeoutMs = 3500) {
  try {
    const response = await fetchWithTimeout(input, options, timeoutMs);
    if (!response.ok) {
      throw new Error(await extractResponseErrorMessage(response, `JSON 응답을 불러오지 못했습니다. (${response.status})`));
    }
    return response.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.");
    }
    throw error;
  }
}

async function fetchJsonWithAccessTimeout(input, options = {}, timeoutMs = 3500) {
  try {
    const response = await fetchWithAccessTimeout(input, options, timeoutMs);
    if (!response.ok) {
      throw new Error(await extractResponseErrorMessage(response, `서버 데이터를 불러오지 못했습니다. (${response.status})`));
    }
    return response.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.");
    }
    throw error;
  }
}

async function replayPendingMutation(entry) {
  if (entry.kind === "trade") {
    return runSerializedPortfolioMutation(() => requestTradeMutation(entry.method, entry.payload, { mutationId: entry.id }));
  }

  if (entry.kind === "cash") {
    return runSerializedPortfolioMutation(() => requestCashMutation(entry.payload, { mutationId: entry.id }));
  }

  if (entry.kind === "target") {
    return runSerializedPortfolioMutation(() => requestTargetMutation(entry.method, entry.payload, { mutationId: entry.id }));
  }

  if (entry.kind === "strategy-budget") {
    return runSerializedPortfolioMutation(() => requestStrategyBudgetMutation(entry.method, entry.payload, { mutationId: entry.id }));
  }

  if (entry.kind === "ui-preferences") {
    return runSerializedPortfolioMutation(() => requestUiPreferencesMutation(entry.payload, { mutationId: entry.id }));
  }

  if (entry.kind === "note") {
    return runSerializedNotesMutation(() =>
      requestNotesMutation(entry.method, entry.payload, { mutationId: entry.id })
    );
  }

  throw createMutationRequestError("지원하지 않는 임시보관 항목입니다.");
}

async function applyReplayedMutation(entry, result) {
  if (entry.kind === "trade") {
    await reconcilePortfolioAfterMutation(result, {
      resetLiveSnapshot: true,
    });
    return;
  }

  if (entry.kind === "cash") {
    await reconcilePortfolioAfterMutation(result);
    return;
  }

  if (entry.kind === "target") {
    await reconcilePortfolioAfterMutation(result);
    return;
  }

  if (entry.kind === "strategy-budget") {
    await reconcilePortfolioAfterMutation(result);
    return;
  }

  if (entry.kind === "ui-preferences") {
    applyUiPreferencesServerResult(result);
    return;
  }

  if (entry.kind === "note") {
    applyNotesServerResult(result);
  }
}

async function flushPendingMutations() {
  if (isFlushingPendingMutations || activeAccessMode !== "owner" || !activeAccessCode || window.location.protocol === "file:") {
    return false;
  }

  let queue = loadPendingMutationsFromStorage();
  if (!queue.length) {
    return true;
  }

  isFlushingPendingMutations = true;
  const flushedKinds = new Set();
  const discardedKinds = new Set();
  let discardedCount = 0;

  try {
    for (const entry of [...queue]) {
      try {
        const result = await replayPendingMutation(entry);
        await applyReplayedMutation(entry, result);
        flushedKinds.add(entry.kind);
        queue = queue.filter((item) => item.id !== entry.id);
        persistPendingMutationsToStorage(queue);
      } catch (error) {
        if (isRetryableMutationError(error)) {
          broadcastPendingMutationStatus(describePendingMutationCount(queue.length), "neutral", [entry.kind]);
          return false;
        }

        queue = queue.filter((item) => item.id !== entry.id);
        persistPendingMutationsToStorage(queue);
        discardedKinds.add(entry.kind);
        discardedCount += 1;
      }
    }

    if (flushedKinds.size && discardedCount) {
      broadcastPendingMutationStatus(
        `임시보관된 변경을 반영했고 적용할 수 없는 ${formatNumber(discardedCount)}건은 정리했습니다.`,
        "success",
        [...new Set([...flushedKinds, ...discardedKinds])]
      );
    } else if (flushedKinds.size) {
      broadcastPendingMutationStatus("임시보관된 변경을 모두 반영했습니다.", "success", [...flushedKinds]);
    } else if (discardedCount) {
      broadcastPendingMutationStatus(
        `적용할 수 없는 저장 대기 ${formatNumber(discardedCount)}건을 정리했습니다.`,
        "neutral",
        [...discardedKinds]
      );
    }
    return true;
  } finally {
    isFlushingPendingMutations = false;
  }
}

function initPendingMutationRetryLoop() {
  if (pendingMutationEventsBound || typeof window === "undefined") {
    return;
  }

  pendingMutationEventsBound = true;
  window.addEventListener("online", () => {
    void flushPendingMutations();
  });
  window.addEventListener("focus", () => {
    void flushPendingMutations();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void flushPendingMutations();
    }
  });

  pendingMutationRetryTimer = window.setInterval(() => {
    void flushPendingMutations();
  }, PENDING_MUTATION_RETRY_INTERVAL_MS);
}

function initServerStateSyncLoop() {
  if (serverStateSyncEventsBound || typeof window === "undefined") {
    return;
  }

  const syncIfUnlocked = (delayMs = 0, options = {}) => {
    if (window.location.protocol === "file:" || !activeAccessCode) {
      return;
    }

    scheduleServerStateSync(delayMs, options);
  };

  serverStateSyncEventsBound = true;

  window.addEventListener("focus", () => {
    syncIfUnlocked(120, {
      includePortfolio: true,
      includeNotes: true,
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      syncIfUnlocked(120, {
        includePortfolio: true,
        includeNotes: true,
      });
    }
  });

  window.addEventListener("pageshow", () => {
    syncIfUnlocked(120, {
      includePortfolio: true,
      includeNotes: true,
    });
  });

  window.addEventListener("storage", (event) => {
    const watchedKey = event.key || "";
    if (![getNotesStorageKey(), getPendingMutationsStorageKey()].includes(watchedKey)) {
      return;
    }

    syncIfUnlocked(80, {
      includePortfolio: true,
      includeNotes: true,
    });
  });

  serverStateSyncTimer = window.setInterval(() => {
    if (document.hidden) {
      return;
    }

    syncIfUnlocked(0, {
      includePortfolio: true,
      includeNotes: true,
    });
  }, SERVER_STATE_SYNC_INTERVAL_MS);
}

function waitForPortfolioLoadRetry(attempt = 1) {
  const delay = Math.min(900, 220 * Math.max(1, Number(attempt) || 1));
  return new Promise((resolve) => {
    window.setTimeout(resolve, delay);
  });
}

function normalizeBootstrapFailureMessage(error) {
  const message = String(error?.message || "").trim();
  if (!message) {
    return "서버 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
  }

  if (message === "Failed to load portfolio data." || message.startsWith("Failed to load JSON:")) {
    return "서버 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
  }

  return message;
}

function renderBootstrapFailureScreen(error) {
  if (window.location.protocol === "file:") {
    document.body.innerHTML = `
      <main style="padding: 32px; font-family: 'Avenir Next', sans-serif;">
        <h1>데이터를 불러오지 못했습니다.</h1>
        <p><code>python3 scripts/export_workbook.py</code> 실행 후 다시 확인하세요.</p>
      </main>
    `;
    return;
  }

  const message = normalizeBootstrapFailureMessage(error);
  document.body.innerHTML = `
    <main style="padding: 32px; font-family: 'Avenir Next', sans-serif; color: #f4f7f5; background: linear-gradient(180deg, #071110 0%, #020606 100%); min-height: 100vh; box-sizing: border-box;">
      <div style="max-width: 440px;">
        <p style="margin: 0 0 12px; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(244, 247, 245, 0.52);">Connection Issue</p>
        <h1 style="margin: 0 0 14px; font-size: 42px; line-height: 1.05; letter-spacing: -0.04em;">데이터를 불러오지 못했습니다.</h1>
        <p style="margin: 0; font-size: 18px; line-height: 1.7; color: rgba(244, 247, 245, 0.82);">${escapeHtml(message)}</p>
        <button type="button" id="bootstrap-retry" style="margin-top: 22px; min-height: 46px; padding: 0 18px; border-radius: 14px; border: 1px solid rgba(94, 200, 255, 0.34); background: rgba(94, 200, 255, 0.12); color: #f4f7f5; font: inherit; font-weight: 700; cursor: pointer;">
          다시 시도
        </button>
      </div>
    </main>
  `;

  document.querySelector("#bootstrap-retry")?.addEventListener("click", () => {
    window.location.reload();
  });
}

function bootDashboard() {
  if (hasBootedDashboard) {
    return;
  }

  hasBootedDashboard = true;
  initPendingMutationRetryLoop();
  initServerStateSyncLoop();
  initLiveRefreshLifecycle();
  initPullToRefresh();
  syncViewportHeight();
  syncResponsiveShellMode();
  initAppFeedback();
  scheduleCurrentDateBadgeRefresh();
  ensureNotesLoaded();
  initNotesBoard();
  renderNotes(notesState);
  hydrateNotesFromServer();
  initTargetManager();
  initTargetRemovalActions();
  initMetricCardActions();
  bindAllPanelAccordions();
  bindMobileSectionOverlay();
  const initialLiveRefreshPromise = refreshLivePortfolio();
  loadPortfolio()
    .then(async (data) => {
      applyPortfolioData(data, livePortfolioSnapshot, { renderMode: "full" });
      if (lastPortfolioLoadSource === "cache") {
        showAppToast("최근 저장된 데이터로 먼저 열었습니다. 연결되면 최신 상태를 자동으로 다시 불러옵니다.", "info", {
          title: "임시 복구",
          duration: 3600,
        });
      }
      initTradeModal();
      const startupTasks = [initialLiveRefreshPromise];
      if (lastPortfolioLoadSource !== "api") {
        startupTasks.push(syncPortfolioBaseData());
      }
      await Promise.allSettled(startupTasks);
      scheduleLivePortfolioRefresh();
      schedulePendingMutationFlush(800);
    })
    .catch((error) => {
      console.error(error);
      const normalizedMessage = normalizeBootstrapFailureMessage(error);
      if (normalizedMessage.includes("접속 코드")) {
        relockAccessGate({ focusInput: true, clearInput: true, clearSession: true });
        setAccessGateStatus(normalizedMessage, "error");
        return;
      }

      renderBootstrapFailureScreen(error);
    });
}

function setAccessGateStatus(message = "", tone = "neutral") {
  const status = document.querySelector("#access-gate-status");
  if (!status) {
    return;
  }

  status.textContent = message;
  status.dataset.tone = tone;
}

function unlockAccessGate() {
  const gate = document.querySelector("#access-gate");
  if (gate) {
    gate.hidden = true;
    gate.setAttribute("aria-hidden", "true");
  }
  document.body.classList.remove("access-locked");
  interactionLockUntil = Date.now() + 900;
  closeMobileSectionOverlay();
  closeAssetChartModal();

  const tradeModal = document.querySelector("#trade-modal");
  if (tradeModal) {
    tradeModal.hidden = true;
    tradeModal.setAttribute("aria-hidden", "true");
    tradeModal.classList.remove("is-open");
  }

  document.body.classList.remove("modal-open", "mobile-section-open", "asset-chart-open");
}

function relockAccessGate(options = {}) {
  const { focusInput = false, clearInput = true, clearSession = false } = options;
  const gate = document.querySelector("#access-gate");
  const input = document.querySelector("#access-gate-code");

  activeAccessCode = "";
  activeAccessMode = "owner";
  if (clearSession) {
    clearPersistedAccessSession();
  }

  if (liveRefreshTimer) {
    window.clearTimeout(liveRefreshTimer);
    liveRefreshTimer = null;
  }
  liveRefreshIntervalMs = 0;

  closeMobileSectionOverlay();
  closeAssetChartModal();

  const tradeModal = document.querySelector("#trade-modal");
  if (tradeModal) {
    tradeModal.hidden = true;
    tradeModal.setAttribute("aria-hidden", "true");
    tradeModal.classList.remove("is-open");
  }

  document.body.classList.remove("modal-open", "mobile-section-open");
  document.body.classList.add("access-locked");

  if (gate) {
    gate.hidden = false;
    gate.setAttribute("aria-hidden", "false");
  }

  if (input) {
    if (clearInput) {
      input.value = "";
    }
    if (focusInput) {
      window.setTimeout(() => {
        input.focus();
      }, 30);
    }
  }

  setAccessGateStatus("접속 코드를 입력해주세요.");
}

function initAccessGate() {
  const gate = document.querySelector("#access-gate");
  const form = document.querySelector("#access-gate-form");
  const input = document.querySelector("#access-gate-code");
  let isSubmittingCode = false;
  let ownerCodeLength = 0;
  let ownerCodeLengths = [];
  let lastAutoSubmittedCode = "";

  const getAccessGateIdleMessage = () => {
    if (ownerCodeLengths.length > 1) {
      return "접속 코드를 모두 입력한 뒤 엔터로 열 수 있습니다.";
    }
    if (ownerCodeLength) {
      return "접속 코드를 끝까지 입력하면 자동으로 열립니다.";
    }
    return "접속 코드를 입력해주세요.";
  };

  syncViewportHeight();
  relockAccessGate();

  if (!gate || !form || !input) {
    bootDashboard();
    return;
  }

  setAccessGateStatus(getAccessGateIdleMessage());

  const syncAutoSubmitConfig = async () => {
    try {
      const response = await fetch("./api/access", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });
      const payload = await response.json().catch(() => null);
      const nextLength = Number(payload?.ownerCodeLength);
      const nextLengths = Array.isArray(payload?.ownerCodeLengths)
        ? [...new Set(payload.ownerCodeLengths.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))]
            .sort((left, right) => left - right)
        : [];
      if (payload?.board) {
        applyBoardConfig(payload.board);
      }

      if (!response.ok) {
        return;
      }

      ownerCodeLengths = nextLengths.length
        ? nextLengths
        : Number.isInteger(nextLength) && nextLength > 0
          ? [nextLength]
          : [];
      ownerCodeLength = ownerCodeLengths.length === 1 ? ownerCodeLengths[0] : 0;
      input.maxLength = ownerCodeLengths.length ? Math.max(...ownerCodeLengths) : 12;

      if (!String(input.value || "").trim()) {
        setAccessGateStatus(getAccessGateIdleMessage());
      }
    } catch (error) {
      console.error("Failed to load access gate config", error);
    }
  };

  const submitAccessCode = async (submittedCode, options = {}) => {
    const { autoRestore = false } = options;
    if (isSubmittingCode) {
      return false;
    }

    isSubmittingCode = true;
    setAccessGateStatus(autoRestore ? "이전 세션을 확인하는 중입니다." : "코드를 확인하는 중입니다.");

    try {
      const response = await fetch("./api/access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          code: submittedCode,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "코드가 맞지 않습니다.");
      }

      activeAccessCode = submittedCode;
      activeAccessMode = payload?.mode || "owner";
      if (payload?.board) {
        applyBoardConfig(payload.board, { skipRender: true });
      }
      persistAccessSession(submittedCode, activeAccessMode);
      const blankBoardMessage =
        getBoardVariant() === EMPTY_BOARD_VARIANT ? "중립 보드를 여는 중입니다." : "비어 있는 보드를 여는 중입니다.";
      const ownerBoardMessage =
        getBoardVariant() === EMPTY_BOARD_VARIANT ? "보드를 여는 중입니다." : "내 보드를 여는 중입니다.";
      setAccessGateStatus(
        autoRestore
          ? activeAccessMode === "owner"
            ? `이전 세션을 확인했습니다. ${ownerBoardMessage}`
            : `이전 세션을 확인했습니다. ${blankBoardMessage}`
          : activeAccessMode === "owner"
            ? `확인되었습니다. ${ownerBoardMessage}`
            : `확인되었습니다. ${blankBoardMessage}`,
        "success"
      );
      unlockAccessGate();
      if (hasBootedDashboard) {
        scheduleServerStateSync(80, {
          includePortfolio: true,
          includeNotes: true,
          includeLive: true,
        });
        refreshLivePortfolio();
        scheduleLivePortfolioRefresh();
        schedulePendingMutationFlush(400);
      } else {
        bootDashboard();
      }
      return true;
    } catch (error) {
      if (autoRestore) {
        clearPersistedAccessSession();
        relockAccessGate({ focusInput: true, clearInput: true, clearSession: false });
        setAccessGateStatus("세션이 만료되어 접속 코드를 다시 입력해주세요.", "error");
      } else {
        setAccessGateStatus(error.message || "코드가 맞지 않습니다. 다시 확인해주세요.", "error");
        input.focus();
        input.select();
      }
      return false;
    } finally {
      isSubmittingCode = false;
    }
  };

  input.addEventListener("input", () => {
    const submittedCode = String(input.value || "").trim();

    if (!submittedCode) {
      lastAutoSubmittedCode = "";
      setAccessGateStatus(getAccessGateIdleMessage());
      return;
    }

    if (submittedCode !== lastAutoSubmittedCode && document.querySelector("#access-gate-status")?.dataset.tone === "error") {
      setAccessGateStatus(getAccessGateIdleMessage());
    }

    if (!ownerCodeLength || submittedCode.length !== ownerCodeLength || isSubmittingCode) {
      const longestKnownLength = ownerCodeLengths.length ? Math.max(...ownerCodeLengths) : ownerCodeLength;
      if (submittedCode.length < longestKnownLength) {
        lastAutoSubmittedCode = "";
      }
      return;
    }

    if (submittedCode === lastAutoSubmittedCode) {
      return;
    }

    lastAutoSubmittedCode = submittedCode;
    submitAccessCode(submittedCode);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submittedCode = String(input.value || "").trim();
    await submitAccessCode(submittedCode);
  });

  syncAutoSubmitConfig();

  const restoreSession = async () => {
    const session = loadPersistedAccessSession();
    if (!session?.code) {
      window.setTimeout(() => {
        input.focus();
      }, 60);
      return;
    }

    await submitAccessCode(session.code, { autoRestore: true });
  };

  restoreSession();
}

document.addEventListener("DOMContentLoaded", initAccessGate);

async function fetchPortfolioFromApi(timeoutMs = 4500) {
  return fetchJsonWithAccessTimeout(
    "./api/portfolio",
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    },
    timeoutMs
  );
}

async function fetchPortfolioFromStaticFile(timeoutMs = 2000) {
  return fetchJsonWithTimeout(
    "./data/portfolio-sample.json",
    {
      cache: "no-store",
    },
    timeoutMs
  );
}

async function loadPortfolio(options = {}) {
  const { allowMemory = true, allowStaticFallback = true, timeoutMs = 4500 } = options;

  if (allowMemory && window.__PORTFOLIO_DATA__) {
    const memoryData = sanitizePortfolioPayload(window.__PORTFOLIO_DATA__);
    if (memoryData) {
      window.__PORTFOLIO_DATA__ = memoryData;
      lastPortfolioLoadSource = "memory";
      return memoryData;
    }

    lastPortfolioLoadSource = "memory";
    return window.__PORTFOLIO_DATA__;
  }

  let lastApiError = null;
  if (window.location.protocol !== "file:") {
    const retryTimeoutMs = Math.max(timeoutMs, activeAccessCode ? 9000 : 6500);
    const apiTimeouts = retryTimeoutMs > timeoutMs ? [timeoutMs, retryTimeoutMs] : [timeoutMs];

    for (let attempt = 0; attempt < apiTimeouts.length; attempt += 1) {
      try {
        const apiData = sanitizePortfolioPayload(await fetchPortfolioFromApi(apiTimeouts[attempt]));
        if (!apiData) {
          throw new Error("서버 데이터 형식이 올바르지 않습니다.");
        }

        lastPortfolioLoadSource = "api";
        return apiData;
      } catch (error) {
        lastApiError = error;
        console.error(error);
        if (attempt < apiTimeouts.length - 1) {
          await waitForPortfolioLoadRetry(attempt + 1);
        }
      }
    }
  }

  const cachedPortfolio = loadCachedPortfolioData();
  if (cachedPortfolio) {
    lastPortfolioLoadSource = "cache";
    return cachedPortfolio;
  }

  if (allowStaticFallback) {
    try {
      const staticData = sanitizePortfolioPayload(await fetchPortfolioFromStaticFile(2000));
      if (!staticData) {
        throw new Error("로컬 데이터 형식이 올바르지 않습니다.");
      }

      lastPortfolioLoadSource = "static";
      return staticData;
    } catch (error) {
      console.error(error);
      throw lastApiError || error || new Error("Failed to load portfolio data.");
    }
  }

  throw lastApiError || new Error("Failed to load portfolio data.");
}

function alignLiveSnapshotWithPortfolio(portfolioData, snapshot = livePortfolioSnapshot) {
  if (!portfolioData || !snapshot?.portfolioLive) {
    return snapshot;
  }

  const hasFreshPortfolioLive = isLiveSnapshotFreshForPortfolio(portfolioData, snapshot);

  return {
    ...snapshot,
    portfolioLive: {
      ...snapshot.portfolioLive,
      summary: hasFreshPortfolioLive ? snapshot.portfolioLive.summary || portfolioData.summary : portfolioData.summary,
      assetStatus: hasFreshPortfolioLive
        ? snapshot.portfolioLive.assetStatus || portfolioData.assetStatus
        : portfolioData.assetStatus,
      holdings: mergeHoldingsWithLiveSnapshot(portfolioData.holdings || [], snapshot.portfolioLive.holdings || []),
      charts: hasFreshPortfolioLive ? snapshot.portfolioLive.charts || portfolioData.charts : portfolioData.charts,
      analytics: {
        ...(portfolioData.analytics || {}),
        ...(snapshot.portfolioLive.analytics || {}),
      },
      targets: mergeTargetsWithLiveSnapshot(portfolioData.targets || {}, snapshot.portfolioLive.targets || {}),
    },
  };
}

function isMobileSectionMode() {
  return window.matchMedia("(max-width: 980px)").matches;
}

function isStandaloneDisplayMode() {
  if (typeof window === "undefined") {
    return false;
  }

  if (window.navigator?.standalone) {
    return true;
  }

  try {
    return Boolean(window.matchMedia?.("(display-mode: standalone)").matches);
  } catch (error) {
    return false;
  }
}

function isMobileAppleSafari() {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent = String(window.navigator?.userAgent || "");
  const isAppleMobile = /iPhone|iPad|iPod/i.test(userAgent);
  const isSafariEngine = /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(userAgent);
  return isAppleMobile && isSafariEngine;
}

function isPullToRefreshEnabled() {
  return (
    typeof window !== "undefined" &&
    Boolean(activeAccessCode) &&
    isMobileSectionMode() &&
    isStandaloneDisplayMode() &&
    !document.body.classList.contains("access-locked") &&
    !document.body.classList.contains("modal-open") &&
    !document.body.classList.contains("asset-chart-open")
  );
}

function shouldIgnorePullRefreshTarget(target) {
  return Boolean(
    target?.closest?.(
      "input, textarea, select, button, [contenteditable='true'], .access-gate-card, .trade-modal-dialog, .asset-chart-dialog"
    )
  );
}

function getPullRefreshScroller() {
  if (document.body.classList.contains("mobile-section-open")) {
    return document.querySelector("#mobile-section-content");
  }

  return document.scrollingElement || document.documentElement || document.body;
}

function isPullRefreshScrollerAtTop(scroller) {
  if (!scroller) {
    return false;
  }

  if (scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body) {
    return (window.scrollY || window.pageYOffset || Number(document.scrollingElement?.scrollTop) || 0) <= 2;
  }

  return Number(scroller.scrollTop || 0) <= 2;
}

function getPullRefreshNodes() {
  return {
    indicator: document.querySelector("#pull-refresh-indicator"),
    title: document.querySelector("#pull-refresh-title"),
    message: document.querySelector("#pull-refresh-message"),
  };
}

function setPullRefreshVisual(distance = 0, mode = "idle") {
  const { indicator, title, message } = getPullRefreshNodes();
  if (!indicator || !title || !message) {
    return;
  }

  const clampedDistance = Math.max(0, Math.min(PULL_REFRESH_MAX_SHIFT_PX, Number(distance) || 0));
  const progress = Math.max(0, Math.min(1, clampedDistance / PULL_REFRESH_TRIGGER_PX));
  const isVisible = mode === "refreshing" || clampedDistance > 0;
  const isReady = mode === "pull" && clampedDistance >= PULL_REFRESH_TRIGGER_PX;
  const isRefreshing = mode === "refreshing";

  if (pullRefreshState.resetTimer) {
    window.clearTimeout(pullRefreshState.resetTimer);
    pullRefreshState.resetTimer = null;
  }

  document.body.style.setProperty("--pull-refresh-shift", `${clampedDistance}px`);
  document.body.style.setProperty("--pull-refresh-progress", progress.toFixed(3));
  document.body.classList.toggle("pull-refresh-active", mode === "pull");
  document.body.classList.toggle("pull-refresh-animating", mode !== "pull" && isVisible);

  indicator.classList.toggle("is-visible", isVisible);
  indicator.classList.toggle("is-ready", isReady);
  indicator.classList.toggle("is-refreshing", isRefreshing);
  indicator.setAttribute("aria-hidden", isVisible ? "false" : "true");

  if (isRefreshing) {
    title.textContent = "새로고침 중";
    message.textContent = "최신 가격과 저장 데이터를 다시 불러오고 있습니다.";
  } else if (isReady) {
    title.textContent = "놓으면 새로고침";
    message.textContent = "손을 떼면 홈화면 데이터가 바로 갱신됩니다.";
  } else {
    title.textContent = "새로고침";
    message.textContent = "아래로 당기면 최신 데이터로 갱신됩니다.";
  }

  if (!isVisible) {
    document.body.classList.remove("pull-refresh-animating");
    return;
  }

  if (mode !== "pull") {
    pullRefreshState.resetTimer = window.setTimeout(() => {
      document.body.classList.remove("pull-refresh-animating");
      pullRefreshState.resetTimer = null;
    }, 220);
  }
}

function resetPullRefreshVisual() {
  setPullRefreshVisual(0, "idle");
}

async function triggerPullToRefresh() {
  if (pullRefreshState.refreshing || !isPullToRefreshEnabled()) {
    resetPullRefreshVisual();
    return;
  }

  pullRefreshState.refreshing = true;
  setPullRefreshVisual(PULL_REFRESH_TRIGGER_PX * 0.78, "refreshing");

  try {
    await syncDashboardFromServer({ includeLive: true });
    showAppToast("최신 가격과 저장 데이터를 다시 불러왔습니다.", "success", {
      title: "새로고침 완료",
      duration: 2200,
    });
  } catch (error) {
    console.error(error);
    showAppToast(error?.message || "새로고침에 실패했습니다.", "error", {
      title: "새로고침 실패",
      duration: 3600,
    });
  } finally {
    pullRefreshState.refreshing = false;
    resetPullRefreshVisual();
  }
}

function initPullToRefresh() {
  if (pullRefreshState.bound || typeof window === "undefined") {
    return;
  }

  const resetInteraction = () => {
    pullRefreshState.active = false;
    pullRefreshState.distance = 0;
    pullRefreshState.scroller = null;
  };

  document.addEventListener(
    "touchstart",
    (event) => {
      if (!isPullToRefreshEnabled() || pullRefreshState.refreshing || event.touches.length !== 1) {
        return;
      }

      if (shouldIgnorePullRefreshTarget(event.target)) {
        return;
      }

      const scroller = getPullRefreshScroller();
      if (!isPullRefreshScrollerAtTop(scroller)) {
        return;
      }

      const touch = event.touches[0];
      pullRefreshState.active = true;
      pullRefreshState.startX = touch.clientX;
      pullRefreshState.startY = touch.clientY;
      pullRefreshState.distance = 0;
      pullRefreshState.scroller = scroller;
    },
    { passive: true }
  );

  document.addEventListener(
    "touchmove",
    (event) => {
      if (!pullRefreshState.active || pullRefreshState.refreshing || event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];
      const deltaX = touch.clientX - pullRefreshState.startX;
      const deltaY = touch.clientY - pullRefreshState.startY;

      if (deltaY <= 0) {
        resetInteraction();
        resetPullRefreshVisual();
        return;
      }

      if (Math.abs(deltaX) > deltaY) {
        return;
      }

      if (!isPullRefreshScrollerAtTop(pullRefreshState.scroller || getPullRefreshScroller())) {
        resetInteraction();
        resetPullRefreshVisual();
        return;
      }

      const nextDistance = Math.min(PULL_REFRESH_MAX_SHIFT_PX, deltaY * 0.56);
      pullRefreshState.distance = nextDistance;
      setPullRefreshVisual(nextDistance, "pull");
      event.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "touchend",
    () => {
      if (!pullRefreshState.active) {
        return;
      }

      const shouldRefresh = pullRefreshState.distance >= PULL_REFRESH_TRIGGER_PX;
      resetInteraction();
      if (shouldRefresh) {
        void triggerPullToRefresh();
        return;
      }
      resetPullRefreshVisual();
    },
    { passive: true }
  );

  document.addEventListener(
    "touchcancel",
    () => {
      resetInteraction();
      if (!pullRefreshState.refreshing) {
        resetPullRefreshVisual();
      }
    },
    { passive: true }
  );

  pullRefreshState.bound = true;
}

function syncViewportHeight() {
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  if (!viewportHeight) {
    return;
  }

  document.documentElement.style.setProperty("--app-height", `${Math.round(viewportHeight)}px`);
}

function syncResponsiveShellMode() {
  syncViewportHeight();
  document.body.classList.toggle("mobile-menu-mode", isMobileSectionMode());
  if (!isMobileSectionMode()) {
    closeMobileSectionOverlay();
  }
}

function getRenderablePortfolioSnapshot() {
  if (currentPortfolioData) {
    return currentPortfolioData;
  }

  if (basePortfolioData) {
    return buildRenderablePortfolio(basePortfolioData, livePortfolioSnapshot);
  }

  return null;
}

function getBasisYearFromPortfolioMetadata(metadata = {}) {
  const labelMatch = String(metadata?.basisDateLabel || "")
    .trim()
    .match(/(\d{4})/);
  if (labelMatch) {
    return Number(labelMatch[1]);
  }

  const performanceStartDate = parsePerformanceStartDateValue(metadata?.realizedPerformanceStartDate);
  return performanceStartDate ? performanceStartDate.getFullYear() : getCurrentBasisYear();
}

function buildDefenseAdjustedRenderablePortfolio(portfolio = {}) {
  const realizedEntries = Array.isArray(portfolio?.realized) ? portfolio.realized : [];
  const trades = portfolio?.trades || {};
  const basisYear = getBasisYearFromPortfolioMetadata(portfolio?.metadata || {});
  const normalizedTrades = normalizeTimelineTrades(trades, basisYear, realizedEntries);
  const overridesByKey = normalizedTrades.reduce((map, trade) => {
    if (
      trade.side !== "매도" ||
      !isXrpTradeLike(trade) ||
      !Number.isFinite(Number(trade.defenseRealizedPnl))
    ) {
      return map;
    }

    const key = buildRealizedTradeKey({
      date: trade.date,
      platform: trade.broker || (trade.market === "암호화폐" ? "업비트" : ""),
      asset: trade.asset,
      symbol: trade.symbol,
      quantity: trade.quantity,
    });
    map.set(key, {
      pnl: normalizeTimelineMoney(Number(trade.defenseRealizedPnl || 0)),
      returnRate: Number.isFinite(Number(trade.defenseRealizedReturnRate))
        ? normalizeTimelineRate(Number(trade.defenseRealizedReturnRate))
        : null,
    });
    return map;
  }, new Map());

  if (!overridesByKey.size) {
    return portfolio;
  }

  const next = structuredClone(portfolio);
  const pnlDeltaByDate = new Map();
  next.realized = realizedEntries.map((entry) => {
    const key = buildRealizedTradeKey({
      date: entry.date,
      platform: entry.platform,
      asset: entry.assetName || entry.asset,
      symbol: entry.symbol,
      quantity: entry.quantity,
    });
    const override = overridesByKey.get(key);
    if (!override) {
      return entry;
    }

    const pnlDelta = normalizeTimelineMoney(Number(override.pnl || 0) - Number(entry?.pnl || 0));
    if (pnlDelta !== 0) {
      const dateKey = String(entry?.date || "").trim();
      pnlDeltaByDate.set(
        dateKey,
        normalizeTimelineMoney(Number(pnlDeltaByDate.get(dateKey) || 0) + pnlDelta)
      );
    }

    return {
      ...entry,
      pnl: override.pnl,
      returnRate: override.returnRate != null ? override.returnRate : entry.returnRate,
    };
  });

  const performanceStartDate = parsePerformanceStartDateValue(next?.metadata?.realizedPerformanceStartDate);
  next.summary = {
    ...(next.summary || {}),
    realizedProfitTotal: normalizeTimelineMoney(
      next.realized.reduce((total, entry) => {
        if (!performanceStartDate) {
          return total + Number(entry?.pnl || 0);
        }

        const entryDate = parseMonthDayToDate(entry?.date, basisYear);
        if (entryDate && entryDate.getTime() < performanceStartDate.getTime()) {
          return total;
        }

        return total + Number(entry?.pnl || 0);
      }, 0)
    ),
  };

  if (Array.isArray(next?.charts?.realizedHistory) && pnlDeltaByDate.size) {
    let runningDelta = 0;
    next.charts = {
      ...(next.charts || {}),
      realizedHistory: next.charts.realizedHistory.map((item) => {
        const dateKey = String(item?.date || "").trim();
        const dailyDelta = normalizeTimelineMoney(Number(pnlDeltaByDate.get(dateKey) || 0));
        runningDelta = normalizeTimelineMoney(runningDelta + dailyDelta);
        return {
          ...item,
          dailyPnl: normalizeTimelineMoney(Number(item?.dailyPnl || 0) + dailyDelta),
          cumulativePnl: normalizeTimelineMoney(Number(item?.cumulativePnl || 0) + runningDelta),
        };
      }),
    };
  }

  return next;
}

const CASH_PLATFORM_ORDER = [
  "카카오증권 예수금",
  "카카오페이머니",
  "업비트 KRW잔액",
  "미래에셋 예수금",
  "수동 현금 조정",
];
const MANUAL_CASH_ADJUSTMENT_PLATFORM = "수동 현금 조정";

function sortCashPositionsForDisplay(cashPositions = []) {
  return [...cashPositions].sort((left, right) => {
    const leftIndex = CASH_PLATFORM_ORDER.indexOf(String(left?.platform || "").trim());
    const rightIndex = CASH_PLATFORM_ORDER.indexOf(String(right?.platform || "").trim());

    if (leftIndex !== -1 || rightIndex !== -1) {
      if (leftIndex === -1) {
        return 1;
      }
      if (rightIndex === -1) {
        return -1;
      }
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }
    }

    return String(left?.platform || "").localeCompare(String(right?.platform || ""), "ko");
  });
}

function buildOptimisticCashAdjustedPortfolio(portfolio = {}, payload = {}) {
  const next = structuredClone(portfolio || {});
  const rawCashTotal =
    typeof payload?.cashTotal === "string"
      ? String(payload.cashTotal).replace(/[,\s원₩]/g, "")
      : payload?.cashTotal;
  const numericCashTotal = Number(rawCashTotal);

  if (!Number.isFinite(numericCashTotal) || numericCashTotal < 0) {
    return next;
  }

  const cashTotal = normalizeTimelineMoney(numericCashTotal);
  const note = String(payload?.note || "현금 보유 카드에서 직접 수정").trim() || "현금 보유 카드에서 직접 수정";
  const baseCashPositions = sortCashPositionsForDisplay(
    (Array.isArray(next.cashPositions) ? next.cashPositions : [])
      .filter((item) => String(item?.platform || "").trim() !== MANUAL_CASH_ADJUSTMENT_PLATFORM)
      .map((item) => ({
        platform: String(item?.platform || "").trim(),
        amount: normalizeTimelineMoney(Number(item?.amount || 0)),
      }))
      .filter((item) => item.platform)
  );
  const baseCashTotal = normalizeTimelineMoney(
    baseCashPositions.reduce((total, item) => total + Number(item.amount || 0), 0)
  );
  const delta = normalizeTimelineMoney(cashTotal - baseCashTotal);
  next.cashPositions =
    delta === 0
      ? baseCashPositions
      : sortCashPositionsForDisplay([
          ...baseCashPositions,
          {
            platform: MANUAL_CASH_ADJUSTMENT_PLATFORM,
            amount: delta,
          },
        ]);

  const assetValuationTotal = normalizeTimelineMoney(
    Number(next.summary?.assetValuationTotal || 0) ||
      (Array.isArray(next.assetStatus)
        ? next.assetStatus.reduce((total, item) => total + Number(item?.valuation || 0), 0)
        : 0)
  );
  const totalAssets = normalizeTimelineMoney(assetValuationTotal + cashTotal);

  next.metadata = {
    ...(next.metadata || {}),
    manualCashAdjustment: {
      targetCashTotal: cashTotal,
      baseCashTotal,
      delta,
      note,
      updatedAt: new Date().toISOString(),
      active: delta !== 0,
      platform: MANUAL_CASH_ADJUSTMENT_PLATFORM,
    },
  };
  next.summary = {
    ...(next.summary || {}),
    cashTotal,
    totalAssets,
    liquidityRatio: totalAssets ? normalizeTimelineRate(cashTotal / totalAssets) : 0,
  };

  return next;
}

function renderUiPreferencesState(data = getRenderablePortfolioSnapshot(), options = {}) {
  if (options.rerenderSettings !== false) {
    renderSettingsSection();
  }
  renderMobileSectionHub();
  applySectionVisibility();

  if (!data) {
    syncActiveMobileSectionOverlay();
    return;
  }

  renderPriceStrip(data.live?.quotes || {}, data.holdings || [], data.targets || {}, data.live?.fx || {}, data.live?.indices || {});

  deferredMobileDashboardData = data;

  if (isMobileSectionMode()) {
    clearDeferredMobileSectionTimers();
    if (mobileSectionState.sectionId && isSectionVisible(mobileSectionState.sectionId)) {
      ensureDeferredMobileSectionRendered(mobileSectionState.sectionId);
      renderActiveMobileLiveSection(mobileSectionState.sectionId, data);
    }
    queueDeferredMobileDashboardSections(data);
    syncActiveMobileSectionOverlay();
    return;
  }

  if (isSectionVisible("targets-section")) {
    renderTargets(data.targets, data.live);
  }
  if (isSectionVisible("portfolio-overview-section")) {
    renderAllocation(data.summary, data.assetStatus, data.cashPositions);
    renderAssetTable(data.assetStatus, data.holdings);
  }
  if (isSectionVisible("insights-section")) {
    renderDefense({
      metadata: data.metadata,
      trades: data.trades,
      holdings: data.holdings,
      realized: data.realized,
      analytics: data.analytics,
    });
  }
  if (isSectionVisible("strategy-state-section") && !strategyBudgetEditorKey) {
    renderStrategyState(data);
  }
  if (isSectionVisible("performance-section")) {
    renderRealizedChartNote(data.metadata);
    renderCharts(data.charts);
    renderRealized(data.realized, data.summary?.realizedProfitTotal || 0);
  }
  if (isSectionVisible("holdings-section")) {
    renderHoldings(data.holdings || []);
  }
  if (isSectionVisible("timeline-section")) {
    renderTimeline(
      data.trades || [],
      getCurrentBasisYear(),
      data.charts?.realizedHistory || [],
      data.realized || []
    );
  }
  if (isSectionVisible("strategy-section")) {
    renderStrategy(data.strategy);
  }

  syncActiveMobileSectionOverlay();
}

function forceOpenPanelAccordionsWithin(root) {
  if (!root) {
    return;
  }

  const panels = [root, ...root.querySelectorAll(".panel-accordion")].filter((panel) => panel?.classList?.contains("panel-accordion"));
  panels.forEach((panel) => {
    const trigger = panel.querySelector(".section-toggle");
    const body = panel.querySelector(".panel-collapse");
    if (!trigger || !body) {
      return;
    }
    toggleDisclosure(panel, trigger, body, true);
  });
}

function forceVisibleRevealsWithin(root) {
  if (!root) {
    return;
  }

  const nodes = [root, ...root.querySelectorAll(".scroll-reveal")];
  nodes.forEach((node) => {
    if (node?.classList?.contains("scroll-reveal")) {
      node.classList.add("is-visible");
    }
  });
}

function prepareTimelineSectionForMobile(section) {
  if (!section) {
    return;
  }

  forceOpenPanelAccordionsWithin(section);

  const firstGroup = section.querySelector(".timeline-group");
  const firstToggle = firstGroup?.querySelector(".timeline-toggle");
  const firstPanel = firstGroup?.querySelector(".timeline-panel");
  if (firstGroup && firstToggle && firstPanel) {
    toggleDisclosure(firstGroup, firstToggle, firstPanel, true);
  }
}

function recoverDetachedMobileSection() {
  const section = mobileSectionState.section;
  const placeholder = mobileSectionState.placeholder;
  if (!section || section.isConnected) {
    return;
  }

  if (placeholder?.parentNode) {
    section.classList.remove("mobile-section-active");
    section.classList.remove("mobile-section-shell-section");
    placeholder.replaceWith(section);
  }
}

function rememberMobileSectionRestore(
  sectionId = mobileSectionState.sectionId || "",
  returnSectionId = mobileSectionState.returnSectionId || "",
) {
  pendingMobileSectionRestoreId = sectionId || "";
  pendingMobileSectionRestoreReturnId = returnSectionId || "";
}

function consumeMobileSectionRestore() {
  const sectionId = pendingMobileSectionRestoreId;
  const returnSectionId = pendingMobileSectionRestoreReturnId;
  pendingMobileSectionRestoreId = "";
  pendingMobileSectionRestoreReturnId = "";
  return {
    sectionId,
    returnSectionId,
  };
}

function reopenPendingMobileSection() {
  const { sectionId, returnSectionId } = consumeMobileSectionRestore();
  if (!sectionId || !isMobileSectionMode()) {
    return;
  }

  window.requestAnimationFrame(() => {
    openMobileSectionOverlay(sectionId, {
      returnSectionId,
    });
  });
}

function lockMobileSectionBackgroundScroll() {
  mobileSectionScrollTop = window.scrollY || window.pageYOffset || 0;
}

function unlockMobileSectionBackgroundScroll() {
  const root = document.documentElement;
  const previousRootScrollBehavior = root.style.scrollBehavior;
  const previousBodyScrollBehavior = document.body.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  document.body.style.scrollBehavior = "auto";
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  window.scrollTo({
    top: mobileSectionScrollTop,
    left: 0,
    behavior: "auto",
  });

  window.requestAnimationFrame(() => {
    root.style.scrollBehavior = previousRootScrollBehavior;
    document.body.style.scrollBehavior = previousBodyScrollBehavior;
  });
}

function closeMobileSectionOverlay(options = {}) {
  const overlay = document.querySelector("#mobile-section-overlay");
  const content = document.querySelector("#mobile-section-content");
  const wasOpen = Boolean(overlay && !overlay.hidden && overlay.getAttribute("aria-hidden") !== "true");
  const shouldRestoreReturnSection = Boolean(options.restoreReturnSection);
  const returnSectionId = shouldRestoreReturnSection ? String(mobileSectionState.returnSectionId || "").trim() : "";
  document.body.classList.remove("strategy-budget-focus");
  recoverDetachedMobileSection();
  if (!overlay) {
    return;
  }

  if (wasOpen && mobileSectionState.sectionId && content) {
    mobileSectionContentScrollTops.set(mobileSectionState.sectionId, Math.max(0, Number(content.scrollTop) || 0));
  }

  if (mobileSectionState.section) {
    mobileSectionState.section.classList.remove("mobile-section-active");
    mobileSectionState.section.classList.remove("mobile-section-shell-section");
    if (mobileSectionState.placeholder?.parentNode) {
      mobileSectionState.placeholder.replaceWith(mobileSectionState.section);
    } else if (mobileSectionState.originalParent) {
      mobileSectionState.originalParent.appendChild(mobileSectionState.section);
    }
  }

  if (content) {
    content.scrollTop = 0;
    content.innerHTML = "";
  }

  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("mobile-section-open");
  if (wasOpen) {
    unlockMobileSectionBackgroundScroll();
  }
  mobileSectionState = {
    section: null,
    sectionId: "",
    returnSectionId: "",
    placeholder: null,
    originalParent: null,
  };

  if (shouldRestoreReturnSection && returnSectionId && isSectionVisible(returnSectionId)) {
    window.requestAnimationFrame(() => {
      openMobileSectionOverlay(returnSectionId);
    });
    return;
  }

  if (wasOpen && isMobileSectionMode()) {
    const data = getRenderablePortfolioSnapshot();
    if (data) {
      renderPriceStrip(data.live?.quotes || {}, data.holdings || [], data.targets || {}, data.live?.fx || {}, data.live?.indices || {});
      renderVisibleLiveSections(data);
    }
    triggerForegroundLiveRefresh();
  }
}

function openMobileSectionOverlay(sectionId, options = {}) {
  if (!isSectionVisible(sectionId)) {
    return;
  }

  if (!isMobileSectionMode()) {
    const section = document.getElementById(sectionId);
    if (section && !section.hidden) {
      ensureDeferredMobileSectionRendered(sectionId);
      section.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    }
    return;
  }

  const overlay = document.querySelector("#mobile-section-overlay");
  const content = document.querySelector("#mobile-section-content");
  const kicker = document.querySelector("#mobile-section-kicker");
  const title = document.querySelector("#mobile-section-title");
  const section = document.getElementById(sectionId);
  const config = MOBILE_SECTION_SHORTCUTS.find((item) => item.id === sectionId);
  const returnSectionId = String(options.returnSectionId || "").trim();

  if (!overlay || !content || !section || !config) {
    return;
  }

  ensureDeferredMobileSectionRendered(sectionId);
  closeMobileSectionOverlay();

  const originalParent = section.parentElement;
  const placeholder = document.createElement("div");
  placeholder.hidden = true;
  placeholder.dataset.mobileSectionPlaceholder = sectionId;
  section.before(placeholder);
  section.classList.add("mobile-section-active");
  section.classList.add("mobile-section-shell-section");
  content.appendChild(section);
  if (sectionId === "timeline-section") {
    prepareTimelineSectionForMobile(section);
  } else {
    forceOpenPanelAccordionsWithin(section);
  }
  forceVisibleRevealsWithin(section);

  if (kicker) {
    kicker.textContent = config.eyebrow;
  }
  if (title) {
    title.textContent = config.title;
  }

  mobileSectionState = {
    section,
    sectionId,
    returnSectionId,
    placeholder,
    originalParent,
  };

  overlay.hidden = false;
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("mobile-section-open");
  lockMobileSectionBackgroundScroll();
  triggerForegroundLiveRefresh();
  window.requestAnimationFrame(() => {
    if (content) {
      const savedTop = Number(mobileSectionContentScrollTops.get(sectionId) || 0);
      content.scrollTop = Number.isFinite(savedTop) ? Math.max(0, savedTop) : 0;
    }
    document.querySelector("#mobile-section-close")?.focus();
  });
}

function syncActiveMobileSectionOverlay() {
  const activeSectionId = mobileSectionState.sectionId;
  if (!activeSectionId || !isMobileSectionMode()) {
    return;
  }

  window.requestAnimationFrame(() => {
    openMobileSectionOverlay(activeSectionId, {
      returnSectionId: mobileSectionState.returnSectionId || "",
    });
  });
}

function bindMobileSectionOverlay() {
  const hub = document.querySelector("#mobile-hub-grid");
  const overlay = document.querySelector("#mobile-section-overlay");
  const closeButton = document.querySelector("#mobile-section-close");

  if (hub && hub.dataset.mobileHubBound !== "true") {
    hub.addEventListener("click", (event) => {
      const button = event.target.closest("[data-mobile-section-open]");
      if (!button || !hub.contains(button)) {
        return;
      }

      openMobileSectionOverlay(button.dataset.mobileSectionOpen || "");
    });
    hub.dataset.mobileHubBound = "true";
  }

  if (overlay && overlay.dataset.mobileOverlayBound !== "true") {
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeMobileSectionOverlay({
          restoreReturnSection: true,
        });
      }
    });

    closeButton?.addEventListener("click", () => {
      closeMobileSectionOverlay({
        restoreReturnSection: true,
      });
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !overlay.hidden) {
        closeMobileSectionOverlay({
          restoreReturnSection: true,
        });
      }
    });

    window.addEventListener("resize", syncResponsiveShellMode);
    window.visualViewport?.addEventListener("resize", syncViewportHeight);
    window.visualViewport?.addEventListener("scroll", syncViewportHeight);

    overlay.dataset.mobileOverlayBound = "true";
  }
}

function applyPortfolioData(data, liveSnapshot = livePortfolioSnapshot, options = {}) {
  recoverDetachedMobileSection();
  basePortfolioData = data;
  window.__PORTFOLIO_DATA__ = data;
  persistPortfolioToStorage(data);

  const renderable = buildRenderablePortfolio(data, liveSnapshot);
  currentUiPreferences = normalizeUiPreferencesState(renderable.uiPreferences, getBoardVariant(), renderable);
  lastSyncedUiPreferences = {
    ...currentUiPreferences,
  };
  currentPortfolioData = renderable;
  renderDashboard(renderable, options);
}

function getPortfolioRevisionValue(portfolio = {}) {
  const revision = Number(portfolio?.metadata?.stateRevision || 0);
  return revision > 0 ? revision : 0;
}

function getLiveSnapshotPortfolioRevision(snapshot = {}) {
  const revision = Number(snapshot?.portfolioLive?.stateRevision || 0);
  return revision > 0 ? revision : 0;
}

function isLiveSnapshotFreshForPortfolio(portfolio = {}, snapshot = livePortfolioSnapshot) {
  if (!snapshot?.portfolioLive) {
    return false;
  }

  const portfolioRevision = getPortfolioRevisionValue(portfolio);
  const snapshotRevision = getLiveSnapshotPortfolioRevision(snapshot);

  if (portfolioRevision > 0 && snapshotRevision > 0) {
    return snapshotRevision >= portfolioRevision;
  }

  if (portfolioRevision > 0 && snapshotRevision <= 0) {
    return false;
  }

  return true;
}

function mergeHoldingsWithLiveSnapshot(baseHoldings = [], liveHoldings = []) {
  const liveByKey = new Map(
    (Array.isArray(liveHoldings) ? liveHoldings : []).map((item) => [
      buildTrackedEntityKey({
        market: item.market || "",
        symbol: item.symbol || "",
        asset: item.asset || "",
        name: item.name || "",
      }),
      item,
    ])
  );

  return (Array.isArray(baseHoldings) ? baseHoldings : []).map((item) => {
    const liveItem = liveByKey.get(
      buildTrackedEntityKey({
        market: item.market || "",
        symbol: item.symbol || "",
        asset: item.asset || "",
        name: item.name || "",
      })
    );

    if (!liveItem) {
      return item;
    }

    return {
      ...item,
      currentPrice: liveItem.currentPrice ?? item.currentPrice,
      currentPriceKrw: liveItem.currentPriceKrw ?? item.currentPriceKrw,
      currentPriceUsd: liveItem.currentPriceUsd ?? item.currentPriceUsd,
      valuation: liveItem.valuation ?? item.valuation,
      pnl: liveItem.pnl ?? item.pnl,
      returnRate: liveItem.returnRate ?? item.returnRate,
      liveQuote: liveItem.liveQuote || item.liveQuote || null,
      currency: liveItem.currency || item.currency,
      priceSource: liveItem.priceSource || item.priceSource,
      name: liveItem.name || item.name,
      symbol: liveItem.symbol || item.symbol,
      market: liveItem.market || item.market,
    };
  });
}

function mergeTargetsWithLiveSnapshot(baseTargets = {}, liveTargets = {}) {
  const liveGroups = Array.isArray(liveTargets?.groups) ? liveTargets.groups : [];
  const liveItemByKey = new Map();

  liveGroups.forEach((group) => {
    (Array.isArray(group.items) ? group.items : []).forEach((item) => {
      liveItemByKey.set(
        buildTrackedEntityKey({
          market: item.market || "",
          symbol: item.symbol || "",
          asset: item.asset || "",
          name: item.name || "",
        }),
        item
      );
    });
  });

  return {
    ...(baseTargets || {}),
    groups: (Array.isArray(baseTargets?.groups) ? baseTargets.groups : []).map((group) => ({
      ...group,
      items: (Array.isArray(group.items) ? group.items : []).map((item) => {
        const liveItem = liveItemByKey.get(
          buildTrackedEntityKey({
            market: item.market || "",
            symbol: item.symbol || "",
            asset: item.asset || "",
            name: item.name || "",
          })
        );

        return liveItem
          ? {
              ...item,
              liveQuote: liveItem.liveQuote || item.liveQuote || null,
            }
          : item;
      }),
    })),
  };
}

function buildRenderablePortfolio(data, liveSnapshot = null) {
  const next = structuredClone(data);
  next.holdings = normalizeHoldingsForDisplay(next.holdings || []);
  next.targets = normalizeTargetsForDisplay(next.targets || {});
  next.strategyBudgets = normalizeStrategyBudgetsForDisplay(next.strategyBudgets || {});
  next.uiPreferences = normalizeUiPreferencesState(next.uiPreferences, getBoardVariant(), next);
  next.live = buildLiveState(liveSnapshot);

  if (!liveSnapshot?.portfolioLive) {
    return buildDefenseAdjustedRenderablePortfolio(next);
  }

  const hasFreshPortfolioLive = isLiveSnapshotFreshForPortfolio(next, liveSnapshot);

  next.summary = hasFreshPortfolioLive ? liveSnapshot.portfolioLive.summary || next.summary : next.summary;
  next.assetStatus = hasFreshPortfolioLive ? liveSnapshot.portfolioLive.assetStatus || next.assetStatus : next.assetStatus;
  next.holdings = normalizeHoldingsForDisplay(
    mergeHoldingsWithLiveSnapshot(next.holdings, liveSnapshot.portfolioLive.holdings || [])
  );
  next.charts = hasFreshPortfolioLive ? liveSnapshot.portfolioLive.charts || next.charts : next.charts;
  next.analytics = {
    ...(next.analytics || {}),
    ...(liveSnapshot.portfolioLive.analytics || {}),
  };
  next.targets = normalizeTargetsForDisplay(
    mergeTargetsWithLiveSnapshot(next.targets, liveSnapshot.portfolioLive.targets || {})
  );

  return buildDefenseAdjustedRenderablePortfolio(next);
}

async function syncServerState(options = {}) {
  const {
    includePortfolio = true,
    includeNotes = true,
    portfolioTimeoutMs = 5000,
  } = options;

  if (window.location.protocol === "file:" || !activeAccessCode) {
    return null;
  }

  if (serverStateSyncPromise) {
    return serverStateSyncPromise;
  }

  const syncTask = (async () => {
    const operations = [];

    if (includePortfolio) {
      operations.push(
        loadPortfolio({ allowMemory: false, allowStaticFallback: false, timeoutMs: portfolioTimeoutMs })
          .then((data) => ({ kind: "portfolio", data }))
          .catch((error) => ({ kind: "portfolio", error }))
      );
    }

    if (includeNotes) {
      operations.push(
        requestNotesMutation("GET")
          .then((data) => ({ kind: "notes", data }))
          .catch((error) => ({ kind: "notes", error }))
      );
    }

    if (!operations.length) {
      return {
        portfolio: basePortfolioData,
        notes: notesState,
      };
    }

    const results = await Promise.all(operations);
    const portfolioResult = results.find((entry) => entry.kind === "portfolio");
    const notesResult = results.find((entry) => entry.kind === "notes");

    if (portfolioResult?.data) {
      const nextPortfolioData = portfolioResult.data;
      const currentRevision = getPortfolioRevisionValue(basePortfolioData);
      const nextRevision = getPortfolioRevisionValue(nextPortfolioData);
      const shouldSkipFullRender =
        currentRevision > 0 &&
        nextRevision > 0 &&
        currentRevision === nextRevision &&
        Boolean(currentPortfolioData);

      livePortfolioSnapshot = alignLiveSnapshotWithPortfolio(nextPortfolioData, livePortfolioSnapshot);

      if (shouldSkipFullRender) {
        basePortfolioData = nextPortfolioData;
        window.__PORTFOLIO_DATA__ = nextPortfolioData;
      } else {
        applyPortfolioData(nextPortfolioData, livePortfolioSnapshot, { renderMode: "full" });
      }
    }

    if (notesResult?.data) {
      applyNotesServerResult(notesResult.data);
    }

    if (!portfolioResult?.data && !notesResult?.data) {
      throw notesResult?.error || portfolioResult?.error || new Error("동기화할 서버 데이터를 불러오지 못했습니다.");
    }

    return {
      portfolio: portfolioResult?.data || basePortfolioData,
      notes: notesResult?.data ? normalizeStoredNotes(notesResult.data.notes) : notesState,
    };
  })();

  serverStateSyncPromise = syncTask.finally(() => {
    serverStateSyncPromise = null;
  });

  return serverStateSyncPromise;
}

async function syncDashboardFromServer(options = {}) {
  const { includeLive = false } = options;
  const synced = await syncServerState(options);

  if (includeLive && basePortfolioData) {
    try {
      await refreshLivePortfolio();
    } catch (error) {
      console.error(error);
    }
  }

  return synced;
}

function scheduleServerStateSync(delayMs = 0, options = {}) {
  if (typeof window === "undefined") {
    return;
  }

  if (serverStateSyncTimeout) {
    window.clearTimeout(serverStateSyncTimeout);
  }

  serverStateSyncTimeout = window.setTimeout(() => {
    serverStateSyncTimeout = null;
    void syncDashboardFromServer(options).catch((error) => {
      console.error(error);
    });
  }, Math.max(0, Number(delayMs) || 0));
}

async function syncPortfolioBaseData() {
  if (window.location.protocol === "file:" || !activeAccessCode) {
    return null;
  }

  try {
    const synced = await syncServerState({
      includePortfolio: true,
      includeNotes: false,
      portfolioTimeoutMs: 5000,
    });
    return synced?.portfolio || null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function refreshLivePortfolio(options = {}) {
  const { force = false, timeoutMs = getLiveRefreshTimeoutMs(), bustCache = false } = options;
  if (window.location.protocol === "file:") {
    return null;
  }

  if (livePortfolioRefreshPromise && !force) {
    return livePortfolioRefreshPromise;
  }

  const refreshSerial = ++liveRefreshRequestSerial;
  const refreshTask = (async () => {
    try {
      lastLiveRefreshAttemptAt = Date.now();
      const liveUrl = buildLiveRefreshUrl(force || bustCache || isStandaloneDisplayMode());
      const response = await fetchWithAccessTimeout(
        liveUrl,
        {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        },
        timeoutMs
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "실시간 가격을 불러오지 못했습니다.");
      }

      if (payload && typeof payload === "object") {
        payload.live = payload.live || {};
        payload.live.clientRefreshedAt = new Date().toISOString();
      }

      if (refreshSerial === liveRefreshRequestSerial) {
        lastSuccessfulLiveRefreshAt = Date.now();
        livePortfolioSnapshot = payload;
        if (basePortfolioData) {
          applyPortfolioData(basePortfolioData, livePortfolioSnapshot, { renderMode: "live" });
        }
        scheduleLivePortfolioRefresh();
      }
      return payload;
    } catch (error) {
      console.error(error);
      const message = error?.name === "AbortError" ? "실시간 가격 응답이 지연되고 있습니다." : error.message;
      if (refreshSerial === liveRefreshRequestSerial) {
        livePortfolioSnapshot = decorateFailedLiveSnapshot(livePortfolioSnapshot, message);
        if (basePortfolioData) {
          applyPortfolioData(basePortfolioData, livePortfolioSnapshot, { renderMode: "live" });
        }
        scheduleLivePortfolioRefresh();
      }
      return null;
    }
  })();

  livePortfolioRefreshPromise = refreshTask.finally(() => {
    if (livePortfolioRefreshPromise === refreshTask) {
      livePortfolioRefreshPromise = null;
    }
  });

  return livePortfolioRefreshPromise;
}

function getLiveRefreshTimeoutMs() {
  return isStandaloneDisplayMode() ? 8500 : 6500;
}

function isLocalLiveTestOrigin() {
  if (typeof window === "undefined") {
    return false;
  }

  const host = String(window.location.hostname || "").trim();
  return host === "127.0.0.1" || host === "localhost";
}

function getLiveRefreshIntervalMs() {
  return Math.max(5_000, Number(currentPortfolioData?.live?.refreshIntervalSeconds || 10) * 1000);
}

function buildLiveRefreshUrl(bustCache = false) {
  const shouldBustCache = bustCache || isLocalLiveTestOrigin() || isStandaloneDisplayMode() || isMobileAppleSafari();
  if (!shouldBustCache || typeof window === "undefined") {
    return "./api/live-prices";
  }

  const url = new URL("./api/live-prices", window.location.href);
  url.searchParams.set("_ts", String(Date.now()));
  return url.toString();
}

function getLiveRefreshStallThresholdMs() {
  return Math.max(LIVE_REFRESH_STALL_MIN_MS, Math.round(getLiveRefreshIntervalMs() * 1.8));
}

function shouldRecoverLiveRefresh(now = Date.now()) {
  if (
    typeof window === "undefined" ||
    window.location.protocol === "file:" ||
    !activeAccessCode ||
    document.hidden
  ) {
    return false;
  }

  const baseline = Math.max(lastSuccessfulLiveRefreshAt || 0, lastLiveRefreshTickAt || 0, 0);
  if (!baseline) {
    return false;
  }

  if (now - baseline < getLiveRefreshStallThresholdMs()) {
    return false;
  }

  const timeoutWindowMs = Math.max(getLiveRefreshTimeoutMs() + 1200, 8000);
  if (livePortfolioRefreshPromise && now - lastLiveRefreshAttemptAt < timeoutWindowMs) {
    return false;
  }

  if (now - lastLiveRecoveryAt < 6000) {
    return false;
  }

  return true;
}

function recoverLiveRefreshIfNeeded() {
  const now = Date.now();
  if (!shouldRecoverLiveRefresh(now)) {
    return;
  }

  lastLiveRecoveryAt = now;
  scheduleLivePortfolioRefresh({ force: true });
  void refreshLivePortfolio({ force: true, bustCache: true }).catch((error) => {
    console.error(error);
  });
}

function scheduleLiveRefreshWatchdogFrame() {
  if (typeof window === "undefined") {
    return;
  }

  if (liveRefreshWatchdogFrameId) {
    window.cancelAnimationFrame(liveRefreshWatchdogFrameId);
  }

  const tick = (frameTime) => {
    liveRefreshWatchdogFrameId = window.requestAnimationFrame(tick);

    if (document.hidden || !activeAccessCode) {
      return;
    }

    const now = typeof frameTime === "number" ? frameTime : performance.now();
    if (now - lastLiveWatchdogFrameAt < 1000) {
      return;
    }

    lastLiveWatchdogFrameAt = now;
    recoverLiveRefreshIfNeeded();
  };

  liveRefreshWatchdogFrameId = window.requestAnimationFrame(tick);
}

function triggerForegroundLiveRefresh() {
  if (window.location.protocol === "file:" || !activeAccessCode) {
    return;
  }

  const now = Date.now();

  // Re-initialize watchdog timers on wake
  if (liveRefreshWatchdogTimer) {
    window.clearInterval(liveRefreshWatchdogTimer);
  }
  liveRefreshWatchdogTimer = window.setInterval(() => {
    recoverLiveRefreshIfNeeded();
  }, LIVE_REFRESH_WATCHDOG_INTERVAL_MS);
  scheduleLiveRefreshWatchdogFrame();

  if (now - lastLiveRefreshWakeAt < 900) {
    return;
  }

  lastLiveRefreshWakeAt = now;

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return;
  }

  // Clear stuck fetch promise
  livePortfolioRefreshPromise = null;

  // Delay the wake-up fetch slightly to let iOS Safari network catch up
  window.setTimeout(() => {
    scheduleLivePortfolioRefresh({ force: true });
    void refreshLivePortfolio({ force: true, bustCache: true }).catch((error) => {
      console.error(error);
    });
  }, 350);
}

function initLiveRefreshLifecycle() {
  if (liveRefreshLifecycleBound || typeof window === "undefined") {
    return;
  }

  liveRefreshLifecycleBound = true;
  const handleWake = () => {
    triggerForegroundLiveRefresh();
  };

  window.addEventListener("online", handleWake);
  window.addEventListener("focus", handleWake);
  window.addEventListener("pageshow", handleWake);
  window.addEventListener("orientationchange", handleWake);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      handleWake();
    }
  });

  if (liveRefreshWatchdogTimer) {
    window.clearInterval(liveRefreshWatchdogTimer);
  }

  liveRefreshWatchdogTimer = window.setInterval(() => {
    recoverLiveRefreshIfNeeded();
  }, LIVE_REFRESH_WATCHDOG_INTERVAL_MS);
  scheduleLiveRefreshWatchdogFrame();
}

function scheduleLivePortfolioRefresh(options = {}) {
  const { force = false } = options;
  if (window.location.protocol === "file:") {
    return;
  }

  const refreshIntervalMs = getLiveRefreshIntervalMs();
  if (!force && liveRefreshTimer && liveRefreshIntervalMs === refreshIntervalMs) {
    return;
  }

  if (liveRefreshTimer) {
    window.clearTimeout(liveRefreshTimer);
  }

  liveRefreshIntervalMs = refreshIntervalMs;
  liveRefreshTimer = window.setTimeout(() => {
    liveRefreshTimer = null;

    if (document.hidden) {
      scheduleLivePortfolioRefresh();
      return;
    }

    const now = Date.now();
    const drifted = lastLiveRefreshTickAt > 0 && now - lastLiveRefreshTickAt > refreshIntervalMs * 2.5;
    lastLiveRefreshTickAt = now;
    void refreshLivePortfolio(drifted ? { force: true, bustCache: true } : {});
  }, refreshIntervalMs);
}

function clearDeferredMobileSectionTimers() {
  deferredMobileSectionTimers.forEach((timerId) => {
    window.clearTimeout(timerId);
  });
  deferredMobileSectionTimers.clear();
}

function renderDeferredMobileSection(sectionId, data = deferredMobileDashboardData) {
  if (!data || deferredMobileSectionsRendered.has(sectionId) || !isSectionVisible(sectionId)) {
    return;
  }

  if (sectionId === "holdings-section") {
    renderHoldings(data.holdings || []);
  } else if (sectionId === "strategy-state-section") {
    renderStrategyState(data);
  } else if (sectionId === "performance-section") {
    renderCharts(data.charts);
    renderRealized(data.realized, data.summary?.realizedProfitTotal || 0);
  } else if (sectionId === "timeline-section") {
    renderTimeline(data.trades, getCurrentBasisYear(), data.charts?.realizedHistory || [], data.realized || []);
  } else if (sectionId === "strategy-section") {
    renderStrategy(data.strategy);
  } else {
    return;
  }

  deferredMobileSectionsRendered.add(sectionId);
}

function queueDeferredMobileSection(sectionId, delayMs = 0) {
  if (!(sectionId in MOBILE_DEFERRED_SECTION_DELAYS)) {
    return;
  }

  if (!isMobileSectionMode()) {
    renderDeferredMobileSection(sectionId);
    return;
  }

  if (deferredMobileSectionsRendered.has(sectionId)) {
    return;
  }

  const existingTimer = deferredMobileSectionTimers.get(sectionId);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }

  const timerId = window.setTimeout(() => {
    deferredMobileSectionTimers.delete(sectionId);
    renderDeferredMobileSection(sectionId);
  }, delayMs);

  deferredMobileSectionTimers.set(sectionId, timerId);
}

function ensureDeferredMobileSectionRendered(sectionId) {
  if (!(sectionId in MOBILE_DEFERRED_SECTION_DELAYS)) {
    return;
  }

  const pendingTimer = deferredMobileSectionTimers.get(sectionId);
  if (pendingTimer) {
    window.clearTimeout(pendingTimer);
    deferredMobileSectionTimers.delete(sectionId);
  }

  renderDeferredMobileSection(sectionId);
}

function queueDeferredMobileDashboardSections(data) {
  deferredMobileDashboardData = data;
  deferredMobileSectionsRendered = new Set();
  clearDeferredMobileSectionTimers();

  Object.entries(MOBILE_DEFERRED_SECTION_DELAYS).forEach(([sectionId, delayMs]) => {
    if (!isSectionVisible(sectionId)) {
      return;
    }
    queueDeferredMobileSection(sectionId, delayMs);
  });
}

function renderActiveMobileLiveSection(sectionId, data) {
  if (!sectionId || !data || !isSectionVisible(sectionId)) {
    return false;
  }

  const {
    metadata,
    summary,
    assetStatus,
    cashPositions,
    holdings,
    targets,
    realized,
    trades,
    analytics,
    live,
  } = data;

  if (sectionId === "holdings-section") {
    renderHoldings(holdings);
    return true;
  }

  if (sectionId === "strategy-state-section") {
    if (!strategyBudgetEditorKey) {
      renderStrategyState(data);
    }
    return true;
  }

  if (sectionId === "targets-section") {
    renderTargets(targets, live);
    return true;
  }

  if (sectionId === "portfolio-overview-section") {
    renderAllocation(summary, assetStatus, cashPositions);
    renderAssetTable(assetStatus, holdings);
    return true;
  }

  if (sectionId === "insights-section") {
    renderDefense({
      metadata,
      trades,
      holdings,
      realized,
      analytics,
    });
    return true;
  }

  if (sectionId === "performance-section") {
    renderRealizedChartNote(metadata);
    return true;
  }

  return false;
}

function renderVisibleLiveSections(data) {
  const {
    metadata,
    summary,
    assetStatus,
    cashPositions,
    holdings,
    targets,
    realized,
    trades,
    analytics,
    live,
  } = data;

  deferredMobileDashboardData = data;

  if (isMobileSectionMode()) {
    const activeSectionId = mobileSectionState.sectionId;
    if (activeSectionId && isSectionVisible(activeSectionId)) {
      renderActiveMobileLiveSection(activeSectionId, data);
      return;
    }

    patchMetricCardsForLiveRefresh(summary, realized, metadata, data, getMetricCardRenderOptions());
    return;
  }

  patchMetricCardsForLiveRefresh(summary, realized, metadata, data, getMetricCardRenderOptions());
  if (isSectionVisible("targets-section")) {
    renderTargets(targets, live);
  }
  if (isSectionVisible("portfolio-overview-section")) {
    renderAllocation(summary, assetStatus, cashPositions);
    renderAssetTable(assetStatus, holdings);
  }
  if (isSectionVisible("insights-section")) {
    renderDefense({
      metadata,
      trades,
      holdings,
      realized,
      analytics,
    });
  }
  if (isSectionVisible("strategy-state-section") && !strategyBudgetEditorKey) {
    renderStrategyState(data);
  }
  if (isSectionVisible("performance-section")) {
    renderRealizedChartNote(metadata);
  }
  if (isSectionVisible("holdings-section")) {
    renderHoldings(holdings);
  }
}

function renderDashboard(data, options = {}) {
  const isLiveRefresh = options.renderMode === "live";
  const {
    metadata,
    summary,
    assetStatus,
    cashPositions,
    holdings,
    targets,
    realized,
    strategy,
    trades,
    analytics,
    charts,
    live,
  } = data;

  renderHeroChrome(metadata);
  text("#hero-summary", buildHeroSummary(live));
  renderCurrentDateBadge();

  renderPriceStrip(live?.quotes || {}, holdings, targets, live?.fx || {}, live?.indices || {});
  bindPriceStripInteractions();

  if (isLiveRefresh) {
    renderVisibleLiveSections(data);
    return;
  }

  renderInitialSetupSection(data);

  renderMetricCards(summary, realized, metadata, data, getMetricCardRenderOptions());
  if (isSectionVisible("targets-section")) {
    renderTargets(targets, live);
  }
  if (isSectionVisible("portfolio-overview-section")) {
    renderAllocation(summary, assetStatus, cashPositions);
    renderAssetTable(assetStatus, holdings);
  }
  if (isSectionVisible("insights-section")) {
    renderDefense({
      metadata,
      trades,
      holdings,
      realized,
      analytics,
    });
  }
  if (isSectionVisible("strategy-state-section")) {
    renderStrategyState(data);
  }
  if (isSectionVisible("performance-section")) {
    renderRealizedChartNote(metadata);
  }
  deferredMobileDashboardData = data;

  renderSettingsSection();
  renderMobileSectionHub();
  applySectionVisibility();
  renderNotes(notesState);
  bindAllPanelAccordions();
  ensureGuideSectionDefaultOpen(data);
  bindGuideSection(document.querySelector("#guide-section"));
  bindInitialSetupSection(document.querySelector("#initial-setup-section"));
  bindMobileSectionOverlay();
  bindNotesSection(document.querySelector("#notes-section"));
  bindStrategyStateSection(document.querySelector("#strategy-state-section"));
  bindHoldingsSection(document.querySelector("#holdings-section"));
  bindSettingsSection(document.querySelector("#settings-section"));
  clearDeferredMobileSectionTimers();

  if (isMobileSectionMode()) {
    queueDeferredMobileDashboardSections(data);
  } else {
    if (isSectionVisible("holdings-section")) {
      renderHoldings(holdings);
    }
    if (isSectionVisible("performance-section")) {
      renderCharts(charts);
      renderRealized(realized, summary.realizedProfitTotal);
    }
    if (isSectionVisible("timeline-section")) {
      renderTimeline(trades, getCurrentBasisYear(), charts.realizedHistory, realized, {
        xrpDefenseReferencePrice: resolveXrpDefenseRecentTenBuyAverage(data),
      });
    }
    if (isSectionVisible("strategy-section")) {
      renderStrategy(strategy);
    }
  }

  initializeMotion();
  syncActiveMobileSectionOverlay();
}

function getDisplayAssetName(item = {}) {
  const symbol = String(item.symbol || "").trim().toUpperCase();
  const rawName = String(item.name || item.asset || "").trim();
  const normalizedName = rawName.toUpperCase();

  if (symbol === "KRW-BTC" || normalizedName === "BTC" || rawName === "비트코인" || rawName === "비트코인(BTC)") {
    return "비트코인 BTC";
  }

  if (symbol === "KRW-ETH" || normalizedName === "ETH" || rawName === "이더리움" || rawName === "이더리움(ETH)") {
    return "이더리움 ETH";
  }

  if (
    symbol === "KRW-XRP" ||
    normalizedName === "XRP" ||
    rawName === "엑스알피" ||
    rawName === "엑스알피(XRP)" ||
    rawName === "엑스알피(리플)"
  ) {
    return "엑스알피(리플) XRP";
  }

  if (symbol === "PLTR" || normalizedName === "PLTR" || rawName === "팔란티어" || rawName === "Palantir Technologies") {
    return "Palantir Technologies (PLTR)";
  }

  if (symbol === "CRCL" || normalizedName === "CRCL" || rawName === "써클" || rawName === "Circle Internet Group") {
    return "Circle Internet Group (CRCL)";
  }

  if (item.market === "us-stock" && rawName && symbol && normalizedName !== symbol) {
    return `${rawName}(${symbol})`;
  }

  if (item.market === "crypto" && rawName && symbol.startsWith("KRW-")) {
    const ticker = symbol.replace(/^KRW-/, "");
    if (ticker && normalizedName !== ticker) {
      return `${rawName}(${ticker})`;
    }
  }

  return rawName;
}

function renderPricePillMarkup(instrument, quotes = {}, fx = {}) {
  const quote = getDisplayQuoteForPriceStrip(instrument, resolveInstrumentQuoteFromMap(instrument, quotes));
  const tone = normalizeTargetTone(instrument.market);
  const quoteStateClass = quote?.available ? "" : " price-pill--inactive";
  const staleClass = quote?.isDelayed ? " price-pill--stale" : "";
  const movementClass = getQuoteToneClass(quote);
  const displayName = getDisplayAssetName(instrument);

  return `
    <button
      type="button"
      class="price-pill price-pill--${tone}${quoteStateClass}${staleClass}"
      data-asset-chart-trigger
      data-asset-chart-name="${escapeHtml(displayName)}"
      data-asset-chart-market="${escapeHtml(instrument.market || "")}"
      data-asset-chart-symbol="${escapeHtml(instrument.symbol || "")}"
      aria-label="${escapeHtml(displayName)} 차트 보기"
    >
      <div class="price-copy">
        <span class="price-name">${escapeHtml(displayName)}</span>
        <span class="price-meta">${escapeHtml(buildInstrumentMeta(instrument, quote))}</span>
      </div>
      <div class="price-value-wrap">
        <strong class="price-value ${movementClass}">${escapeHtml(formatLivePricePrimary(quote, instrument, fx))}</strong>
        <span class="price-secondary">${renderQuoteSecondaryMarkup(quote, instrument, {
          includeKimchiPremium: true,
          includeKrwForUsStock: false,
        })}</span>
      </div>
    </button>
  `;
}

function buildFxSourceLabel(source = "") {
  const normalized = String(source || "").trim().toLowerCase();
  if (normalized === "twelve-data") {
    return "Twelve Data";
  }
  if (normalized === "yahoo-finance") {
    return "Yahoo Finance";
  }
  if (normalized === "fallback") {
    return "Fallback";
  }
  return normalized ? source : "FX API";
}

function getBlankFamilyTargetContent() {
  return {
    heroSummary: "관심종목부터 차근차근 정리하면 실시간 가격과 보유 흐름을 한 화면에서 보기 쉬워집니다.",
    emptyBoardTitle: "아직 관심종목이 없습니다.",
    emptyBoardDescription: "자주 확인할 종목부터 하나씩 추가해보세요.",
    entrySummary: "거래 전에 먼저 보고 싶은 종목을 정리하는 칸입니다. 저장하면 실시간 추적 대상에도 같이 반영됩니다.",
    entryHelpByMarket: {
      암호화폐: "예시: 비트코인(BTC), 이더리움(ETH), 엑스알피(리플) (XRP)",
      미국주식: "예시: Apple Inc. (AAPL), Microsoft Corporation (MSFT), NVDA",
      국내주식: "예시: 삼성전자(005930), SK하이닉스(000660)",
    },
    idleStatus: "저장한 뒤에는 관심종목과 실시간 가격 영역에서 바로 확인할 수 있습니다.",
    groupSummaries: {
      암호화폐: "먼저 확인하고 싶은 코인을 정리합니다.",
      해외주식: "장기 관점에서 보고 싶은 미국 주식을 모아둡니다.",
      국내주식: "국내주식 후보를 따로 모아두는 영역입니다.",
    },
    groupEmptyTitle: "아직 비어 있습니다.",
    groupEmptyDescription: "나중에 보고 싶은 종목이 생기면 여기에 추가하세요.",
  };
}

function getTargetFormHelpText(market = "") {
  if (isEmptyBoardVariant()) {
    const blankFamilyContent = getBlankFamilyTargetContent();
    return blankFamilyContent.entryHelpByMarket[market] || blankFamilyContent.entryHelpByMarket.국내주식;
  }

  if (market === "암호화폐") {
    return "예시: 솔라나(SOL), 도지코인(DOGE), 에이다(ADA)";
  }

  if (market === "미국주식") {
    return "영어 회사명이나 티커를 몇 글자만 입력해도 아래 추천 목록이 뜹니다. 예시: Apple Inc. (AAPL), TSLA, NVDA";
  }

  return "예시: 삼성전자(005930), SK하이닉스(000660) · 종목 코드까지 넣으면 국내주식 현재가 추적이 더 정확해집니다.";
}

function getTargetFormIdleStatusText() {
  if (isEmptyBoardVariant()) {
    return getBlankFamilyTargetContent().idleStatus;
  }

  return "저장하면 관심종목과 Live price 추적 대상에 바로 반영됩니다.";
}

function createInitialSetupRowDraft(overrides = {}) {
  const market = String(overrides.market || "국내주식").trim() || "국내주식";
  const brokers = INITIAL_SETUP_BROKER_OPTIONS[market] || INITIAL_SETUP_BROKER_OPTIONS.국내주식;
  return {
    id: overrides.id || `setup-row-${initialSetupState.nextId++}`,
    market,
    broker: String(overrides.broker || brokers[0]?.value || "").trim(),
    asset: String(overrides.asset || "").trim(),
    quantity: overrides.quantity ?? "",
    averagePrice: overrides.averagePrice ?? "",
  };
}

function resetInitialSetupState() {
  initialSetupState.rows = [createInitialSetupRowDraft()];
}

function ensureInitialSetupRows() {
  if (!initialSetupState.rows.length) {
    resetInitialSetupState();
  }
}

function getInitialSetupAssetPlaceholder(market = "") {
  if (market === "암호화폐") {
    return "예: 비트코인(BTC)";
  }
  if (market === "미국주식") {
    return "예: Apple Inc. (AAPL)";
  }
  return "예: 삼성전자(005930)";
}

function renderInitialSetupRows() {
  const container = document.querySelector("#initial-setup-row-list");
  if (!container) {
    return;
  }

  ensureInitialSetupRows();
  const markup = initialSetupState.rows
    .map((row, index) => {
      const brokerOptions = INITIAL_SETUP_BROKER_OPTIONS[row.market] || INITIAL_SETUP_BROKER_OPTIONS.국내주식;
      const canRemove = initialSetupState.rows.length > 1;
      return `
        <article class="initial-setup-row" data-initial-setup-row="${escapeHtml(row.id)}">
          <div class="initial-setup-row-head">
            <p class="initial-setup-row-title">보유 종목 ${index + 1}</p>
            ${canRemove ? `<button type="button" class="initial-setup-row-remove" data-initial-setup-remove="${escapeHtml(row.id)}">삭제</button>` : ""}
          </div>
          <div class="initial-setup-row-grid">
            <div class="form-group form-group--select">
              <label>시장</label>
              <select data-initial-setup-field="market">
                ${INITIAL_SETUP_MARKET_OPTIONS.map((option) => `<option value="${escapeHtml(option.value)}" ${row.market === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
              </select>
            </div>
            <div class="form-group form-group--select">
              <label>증권사 / 거래소</label>
              <select data-initial-setup-field="broker">
                ${brokerOptions.map((option) => `<option value="${escapeHtml(option.value)}" ${row.broker === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label>종목명</label>
              <input
                type="text"
                data-initial-setup-field="asset"
                value="${escapeHtml(row.asset)}"
                placeholder="${escapeHtml(getInitialSetupAssetPlaceholder(row.market))}"
              />
            </div>
            <div class="form-group">
              <label>보유 수량</label>
              <input type="number" min="0" step="0.00000001" data-initial-setup-field="quantity" value="${escapeHtml(String(row.quantity ?? ""))}" placeholder="0" />
            </div>
            <div class="form-group">
              <label>평균 단가 (원)</label>
              <input type="number" min="0" step="0.01" data-initial-setup-field="averagePrice" value="${escapeHtml(String(row.averagePrice ?? ""))}" placeholder="0" />
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  setInnerHtmlIfChanged(container, markup);
}

function ensureGuideSectionDefaultOpen(data = currentPortfolioData || basePortfolioData || {}) {
  if (getBoardVariant() !== EMPTY_BOARD_VARIANT || !isSectionVisible("guide-section")) {
    return;
  }

  const guideSection = document.querySelector("#guide-section");
  const trigger = guideSection?.querySelector(".section-toggle");
  const panel = guideSection?.querySelector(".panel-collapse");
  const shouldOpen = shouldShowGuideByDefault(data) || !String(currentUiPreferences?.updatedAt || "").trim();

  if (!guideSection || guideSection.hidden || !trigger || !panel || !shouldOpen) {
    return;
  }

  if (isMobileSectionMode()) {
    if (mobileSectionState.sectionId && mobileSectionState.sectionId !== "guide-section") {
      return;
    }

    if (mobileSectionState.sectionId !== "guide-section") {
      openMobileSectionOverlay("guide-section");
    } else {
      forceOpenPanelAccordionsWithin(guideSection);
    }
    return;
  }

  toggleDisclosure(guideSection, trigger, panel, true);
}

function setInitialSetupStatus(message = "", tone = "neutral") {
  const status = document.querySelector("#initial-setup-status");
  if (!status) {
    return;
  }
  status.textContent = message;
  status.dataset.tone = tone;
}

function renderInitialSetupSection(data = currentPortfolioData || basePortfolioData || {}) {
  const section = document.querySelector("#initial-setup-section");
  if (!section) {
    return;
  }

  if (!isEmptyBoardVariant()) {
    section.hidden = true;
    section.setAttribute("aria-hidden", "true");
    section.classList.remove("mobile-section-active", "mobile-section-shell-section");
    return;
  }

  const visible = isEmptyBoardVariant() && !hasMeaningfulBoardContent(data);
  section.hidden = !visible;
  section.setAttribute("aria-hidden", visible ? "false" : "true");

  if (!visible) {
    return;
  }

  renderInitialSetupRows();
  setInitialSetupStatus("현재 기준 자산만 입력하면 보드가 바로 시작됩니다.");
}

function openGuideDestination(sectionId = "") {
  const normalizedId = String(sectionId || "").trim();
  if (!normalizedId) {
    return;
  }

  if (normalizedId === "initial-setup-section") {
    const initialSetupSection = document.getElementById(normalizedId);
    if (!initialSetupSection || initialSetupSection.hidden) {
      showAppToast("시작 자산 입력은 빈 보드에서만 사용할 수 있습니다.", "info", {
        title: "이동할 수 없습니다.",
      });
      return;
    }

    const revealInitialSetup = () => {
      forceVisibleRevealsWithin(initialSetupSection);
      initialSetupSection.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    };

    if (isMobileSectionMode()) {
      closeMobileSectionOverlay();
      window.setTimeout(revealInitialSetup, 80);
      return;
    }

    revealInitialSetup();
    return;
  }

  if (!isSectionVisible(normalizedId) && normalizedId !== SETTINGS_SECTION_ID) {
    showAppToast("세팅에서 이 메뉴를 다시 켜면 바로 이동할 수 있습니다.", "info", {
      title: "메뉴가 숨겨져 있습니다.",
    });
    return;
  }

  if (isMobileSectionMode()) {
    openMobileSectionOverlay(normalizedId, {
      returnSectionId: "guide-section",
    });
    return;
  }

  const section = document.getElementById(normalizedId);
  if (!section || section.hidden) {
    return;
  }

  ensureDeferredMobileSectionRendered(normalizedId);
  forceOpenPanelAccordionsWithin(section);
  forceVisibleRevealsWithin(section);
  section.scrollIntoView({
    block: "start",
    behavior: "smooth",
  });
}

function bindGuideSection(section) {
  if (!section || section.dataset.guideBound === "true") {
    return;
  }

  section.addEventListener("click", (event) => {
    const button = event.target.closest("[data-guide-open]");
    if (!button || !section.contains(button)) {
      return;
    }

    openGuideDestination(String(button.dataset.guideOpen || ""));
  });

  section.dataset.guideBound = "true";
}

async function requestInitialSetupMutation(payload, options = {}) {
  if (window.location.protocol === "file:") {
    throw new Error("초기 자산 저장은 로컬 서버에서만 가능합니다. `node scripts/dev-server.js` 실행 후 접속하세요.");
  }

  const mutationId = String(options.mutationId || "").trim();
  let response = null;

  try {
    response = await fetchWithAccessTimeout(
      "./api/initial-setup",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(mutationId ? { "X-Mutation-Id": mutationId } : {}),
        },
        body: JSON.stringify(payload || {}),
      },
      MUTATION_REQUEST_TIMEOUT_MS
    );
  } catch (error) {
    throw createMutationRequestError("초기 자산 저장 연결이 일시적으로 끊겼습니다.", {
      retryable: true,
    });
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage = result?.error || "초기 자산 저장에 실패했습니다.";
    throw createMutationRequestError(errorMessage, {
      status: response.status,
      retryable: isServerMutationErrorRetryable(response.status, errorMessage),
    });
  }

  return result;
}

async function applyInitialSetupMutation(payload) {
  return runSerializedPortfolioMutation(async () => {
    const mutationId = createMutationId("initial-setup");
    const updatedPortfolio = await requestInitialSetupMutation(payload, { mutationId });
    const confirmedPortfolio = await reconcilePortfolioAfterMutation(updatedPortfolio, {
      resetLiveSnapshot: true,
    });
    showAppToast("시작 자산을 저장했습니다.", "success", {
      title: "초기 자산 저장 완료",
    });
    setInitialSetupStatus("시작 자산을 저장했습니다.", "success");
    return confirmedPortfolio;
  });
}

function bindInitialSetupSection(section) {
  if (!section || section.dataset.bound === "true") {
    return;
  }

  const form = section.querySelector("#initial-setup-form");
  const addRowButton = section.querySelector("#initial-setup-add-row");
  const resetButton = section.querySelector("#initial-setup-reset");
  const cashInput = section.querySelector("#initial-setup-cash");
  const submitButton = section.querySelector("#initial-setup-submit");
  if (!form || !addRowButton || !resetButton || !cashInput || !submitButton) {
    return;
  }

  const setSubmitting = (isSubmitting) => {
    submitButton.disabled = isSubmitting;
    resetButton.disabled = isSubmitting;
    addRowButton.disabled = isSubmitting;
    submitButton.textContent = isSubmitting ? "저장 중..." : "시작 자산 저장";
  };

  section.addEventListener("click", (event) => {
    const addButton = event.target.closest("#initial-setup-add-row");
    if (addButton) {
      initialSetupState.rows.push(createInitialSetupRowDraft());
      renderInitialSetupRows();
      return;
    }

    const removeButton = event.target.closest("[data-initial-setup-remove]");
    if (removeButton) {
      const rowId = String(removeButton.dataset.initialSetupRemove || "").trim();
      initialSetupState.rows = initialSetupState.rows.filter((row) => row.id !== rowId);
      ensureInitialSetupRows();
      renderInitialSetupRows();
      return;
    }
  });

  section.addEventListener("change", (event) => {
    const rowElement = event.target.closest("[data-initial-setup-row]");
    const field = String(event.target.dataset.initialSetupField || "").trim();
    if (!rowElement || !field) {
      return;
    }

    const rowId = String(rowElement.dataset.initialSetupRow || "").trim();
    const row = initialSetupState.rows.find((item) => item.id === rowId);
    if (!row) {
      return;
    }

    row[field] = event.target.value;
    if (field === "market") {
      const brokers = INITIAL_SETUP_BROKER_OPTIONS[row.market] || INITIAL_SETUP_BROKER_OPTIONS.국내주식;
      row.broker = brokers[0]?.value || "";
      renderInitialSetupRows();
    }
  });

  section.addEventListener("input", (event) => {
    const rowElement = event.target.closest("[data-initial-setup-row]");
    const field = String(event.target.dataset.initialSetupField || "").trim();
    if (!rowElement || !field) {
      return;
    }

    const rowId = String(rowElement.dataset.initialSetupRow || "").trim();
    const row = initialSetupState.rows.find((item) => item.id === rowId);
    if (!row) {
      return;
    }

    row[field] = event.target.value;
  });

  resetButton.addEventListener("click", () => {
    cashInput.value = "";
    resetInitialSetupState();
    renderInitialSetupRows();
    setInitialSetupStatus("입력을 비웠습니다.");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      cashAmount: cashInput.value,
      holdings: initialSetupState.rows
        .map((row) => ({
          market: row.market,
          broker: row.broker,
          asset: row.asset,
          quantity: row.quantity,
          averagePrice: row.averagePrice,
        }))
        .filter((row) => String(row.asset || "").trim() || String(row.quantity || "").trim() || String(row.averagePrice || "").trim()),
    };

    setSubmitting(true);
    try {
      await applyInitialSetupMutation(payload);
    } catch (error) {
      setInitialSetupStatus(error.message || "초기 자산 저장에 실패했습니다.", "error");
    } finally {
      setSubmitting(false);
    }
  });

  section.dataset.bound = "true";
}

function formatUsdKrwRate(value) {
  const numeric = toFiniteNumber(value);
  if (numeric == null || numeric <= 0) {
    return "연결 대기";
  }
  return `${formatNumber(numeric)}원 / $1`;
}

function renderFxPricePillMarkup(fx = {}) {
  const hasRate = toFiniteNumber(fx.usdkrw) != null && Number(fx.usdkrw) > 0;
  const quoteStateClass = hasRate ? "" : " price-pill--inactive";
  const staleClass = fx?.isDelayed ? " price-pill--stale" : "";
  const statusCopy = fx?.isDelayed ? "업데이트 지연" : "실시간";
  const sourceCopy = buildFxSourceLabel(fx?.source);
  const updatedCopy = fx?.updatedAt ? formatDateTime(fx.updatedAt) : "업데이트 대기";

  return `
    <button
      type="button"
      class="price-pill price-pill--fx price-pill--global price-pill--static${quoteStateClass}${staleClass}"
      data-asset-chart-trigger
      data-asset-chart-name="USD/KRW"
      data-asset-chart-market="fx"
      data-asset-chart-symbol="KRW=X"
      aria-label="USD/KRW 차트 보기"
    >
      <div class="price-copy">
        <span class="price-name">원/달러</span>
        <span class="price-meta">USD/KRW · ${statusCopy}</span>
      </div>
      <div class="price-value-wrap">
        <strong class="price-value price-move-neutral">${escapeHtml(formatUsdKrwRate(fx.usdkrw))}</strong>
        <span class="price-secondary">${escapeHtml(`${sourceCopy} · ${updatedCopy}`)}</span>
      </div>
    </button>
  `;
}

function renderFxPriceSection(fx = {}) {
  return `
    <section class="price-sector price-sector--fx">
      <div class="price-sector-head">
        <span class="price-sector-label">환율</span>
        <span class="price-sector-count">USD/KRW</span>
      </div>
      <div class="price-sector-list">
        ${renderFxPricePillMarkup(fx)}
      </div>
    </section>
  `;
}

function formatIndexValue(value) {
  const numeric = toFiniteNumber(value);
  if (numeric == null || numeric <= 0) {
    return "연결 대기";
  }
  return formatNumber(numeric);
}

function renderIndexPricePillMarkup(item = {}) {
  const quoteStateClass = item?.available ? "" : " price-pill--inactive";
  const staleClass = item?.isDelayed ? " price-pill--stale" : "";
  const movementClass = getQuoteToneClass(item);
  const statusCopy = item?.isDelayed ? "Delayed" : "Live";
  const sourceCopy = buildFxSourceLabel(item?.source);
  const updatedCopy = item?.updatedAt ? formatDateTime(item.updatedAt) : "업데이트 대기";
  const secondaryCopy = item?.available
    ? `${formatSignedPercent(Number(item.changePercent || 0))} · ${updatedCopy}`
    : item?.error || "연결 대기";

  return `
    <button
      type="button"
      class="price-pill price-pill--${escapeHtml(item.tone || "global")} price-pill--static${quoteStateClass}${staleClass}"
      data-asset-chart-trigger
      data-asset-chart-name="${escapeHtml(item.label || item.id || "주요지수")}"
      data-asset-chart-market="major-index"
      data-asset-chart-symbol="${escapeHtml(item.symbol || "")}"
      aria-label="${escapeHtml(item.label || item.id || "주요지수")} 차트 보기"
    >
      <div class="price-copy">
        <span class="price-name">${escapeHtml(item.label || item.id || "주요지수")}</span>
        <span class="price-meta">${escapeHtml(`Index · ${statusCopy}`)}</span>
      </div>
      <div class="price-value-wrap">
        <strong class="price-value ${movementClass}">${escapeHtml(formatIndexValue(item.value))}</strong>
        <span class="price-secondary ${movementClass}">${escapeHtml(`${sourceCopy} · ${secondaryCopy}`)}</span>
      </div>
    </button>
  `;
}

function renderMajorIndicesSection(indices = {}) {
  if (!shouldShowGlobalIndices()) {
    return "";
  }

  const groups = [
    {
      key: "korea",
      label: "Korea Indices",
      countLabel: "KOSPI · KOSDAQ",
      tone: "domestic",
      items: Array.isArray(indices?.korea) ? indices.korea : [],
    },
    {
      key: "us",
      label: "US Indices",
      countLabel: "NASDAQ · S&P · DOW",
      tone: "global",
      items: Array.isArray(indices?.us) ? indices.us : [],
    },
  ];

  return groups
    .map((group) => {
      if (!group.items.length) {
        return "";
      }

      return `
        <section class="price-sector price-sector--${group.tone}">
          <div class="price-sector-head">
            <span class="price-sector-label">${escapeHtml(group.label)}</span>
            <span class="price-sector-count">${escapeHtml(group.countLabel)}</span>
          </div>
          <div class="price-sector-list">
            ${group.items.map((item) => renderIndexPricePillMarkup(item)).join("")}
          </div>
        </section>
      `;
    })
    .join("");
}

window.renderMajorIndicesSection = renderMajorIndicesSection;

function renderPriceStrip(quotes = {}, holdings = [], targets = {}, fx = {}, indices = {}) {
  window.AssetChartShell?.renderPriceStrip?.(quotes, holdings, targets, fx, indices);
}

function canManagePortfolioMutations() {
  return activeAccessMode === "owner" && window.location.protocol !== "file:";
}

function isCashMetricEditable() {
  return canManagePortfolioMutations();
}

function getMetricCardRenderOptions() {
  return {
    formatPercent,
    isCashMetricEditable: isCashMetricEditable(),
  };
}

async function handleCashMetricCardAction(trigger) {
  if (!isCashMetricEditable()) {
    return;
  }

  const portfolio = currentPortfolioData || basePortfolioData || {};
  const currentCashTotal = Number(portfolio?.summary?.cashTotal || 0);
  openCashEditorDialog(currentCashTotal, trigger instanceof HTMLElement ? trigger : null);
}

function resolveRealizedMarket(item = {}) {
  const rawMarket = String(item.market || "").trim();
  if (rawMarket === "us-stock" || rawMarket === "미국주식") {
    return "us-stock";
  }
  if (rawMarket === "kr-stock" || rawMarket === "국내주식") {
    return "kr-stock";
  }
  if (rawMarket === "crypto" || rawMarket === "암호화폐") {
    return "crypto";
  }

  const rawSymbol = String(item.symbol || "").trim().toUpperCase();
  if (rawSymbol && !rawSymbol.startsWith("KRW-") && /^[A-Z.\-]{1,15}$/.test(rawSymbol)) {
    return "us-stock";
  }

  const haystack = [item.assetName, item.asset, item.symbol]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  if (["PLTR", "팔란티어", "CRCL", "써클", "ORCL", "ORACLE"].some((keyword) => haystack.includes(String(keyword).toUpperCase()))) {
    return "us-stock";
  }
  if (["삼성전자", "SK하이닉스", "에스케이하이닉스"].some((keyword) => haystack.includes(keyword.toUpperCase()))) {
    return "kr-stock";
  }
  if (["BTC", "비트코인", "ETH", "이더리움", "XRP", "엑스알피"].some((keyword) => haystack.includes(keyword.toUpperCase()))) {
    return "crypto";
  }

  return "";
}

function estimateUsStockTax(realized = [], referenceDate = new Date()) {
  const currentYear = getCurrentBasisYear(referenceDate);
  const usStockRealized = realized.filter((item) => resolveRealizedMarket(item) === "us-stock");
  const realizedPnl = usStockRealized.reduce((total, item) => total + Number(item.pnl || 0), 0);
  const allowanceProgress = formatUsStockTaxAllowanceProgress(realizedPnl);

  if (!usStockRealized.length) {
    return {
      taxEstimate: 0,
      detail: `${currentYear}년 미국주식 순이익 ${allowanceProgress} · 과세 없음`,
    };
  }

  if (realizedPnl <= 0) {
    return {
      taxEstimate: 0,
      detail: `${currentYear}년 미국주식 순이익 ${allowanceProgress} · 과세 없음`,
    };
  }

  const taxableGain = Math.max(realizedPnl - US_STOCK_TAX_ALLOWANCE, 0);
  const taxEstimate = taxableGain > 0 ? taxableGain * US_STOCK_TAX_RATE : 0;
  if (taxableGain <= 0) {
    return {
      taxEstimate: 0,
      detail: `${currentYear}년 미국주식 순이익 ${allowanceProgress} · 과세 없음`,
    };
  }

  return {
    taxEstimate,
    detail: `${currentYear}년 미국주식 순이익 ${allowanceProgress} · 과세대상 ${formatCurrency(taxableGain)}`,
  };
}

function getStrategyBudgetEntry(strategyBudgets = {}, matcher = {}) {
  const items = Array.isArray(strategyBudgets?.items) ? strategyBudgets.items : [];
  return (
    items.find(
      (item) =>
        isPlainObjectRecord(item) &&
        item.market === matcher.market &&
        matcher.symbol &&
        item.symbol &&
        item.symbol === matcher.symbol
    ) ||
    items.find(
      (item) =>
        isPlainObjectRecord(item) &&
        item.market === matcher.market &&
        matcher.asset &&
        item.asset === matcher.asset
    ) ||
    null
  );
}

const strategyStateHelpers = assetStrategyState.createStrategyStateHelpers({
  TRADE_STRATEGY_STAGE_OPTIONS,
  getCurrentBasisYear,
  parseTradeDate,
  resolveStrategyMarketKey,
  normalizeTradeStrategyStage,
  buildStrategyEntityKey,
  isBuyStrategyStage,
  isSellStrategyStage,
  getStrategyBudgetEntry,
  resolveStrategyBudgetRatio,
  resolveStrategyStageSummary,
  getDisplayAssetName,
  getMarketLabelFromMetaMarket,
  getTimelineTradeKey,
  renderTradeStageBadge,
  escapeHtml,
  formatNumber,
  formatCurrency,
  formatSignedCurrency,
  formatPercent,
  toneClass,
});

const {
  buildStrategyStatusGroups,
  renderStrategyStateCard,
  resolveStrategyBaselineQuantityValue,
} = strategyStateHelpers;

function formatBudgetInputValue(value = 0) {
  return value > 0 ? formatNumber(Math.round(value)) : "";
}

function sanitizeStrategyBudgetDigits(value = "") {
  return String(value || "")
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "");
}

function formatStrategyBudgetDigits(value = "") {
  const digits = sanitizeStrategyBudgetDigits(value);
  return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "";
}

function findStrategyBudgetCaretFromDigitIndex(value = "", digitIndex = 0) {
  if (!(digitIndex > 0)) {
    return 0;
  }

  let seenDigits = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (/\d/.test(value[index])) {
      seenDigits += 1;
      if (seenDigits >= digitIndex) {
        return index + 1;
      }
    }
  }

  return value.length;
}

function formatStrategyBudgetInputElement(input, options = {}) {
  if (!input) {
    return;
  }

  const preserveCaret = options.preserveCaret !== false;
  const rawValue = String(input.value || "");
  const selectionStart = typeof input.selectionStart === "number" ? input.selectionStart : rawValue.length;
  const digitsBeforeCaret = preserveCaret ? sanitizeStrategyBudgetDigits(rawValue.slice(0, selectionStart)).length : 0;
  const formatted = formatStrategyBudgetDigits(rawValue);

  input.value = formatted;

  if (
    preserveCaret &&
    document.activeElement === input &&
    typeof input.setSelectionRange === "function"
  ) {
    const nextCaret = findStrategyBudgetCaretFromDigitIndex(formatted, digitsBeforeCaret);
    window.requestAnimationFrame(() => {
      input.setSelectionRange(nextCaret, nextCaret);
    });
  }
}

function renderStrategyBudgetForm(entry, { editing = false } = {}) {
  const budget = Number(entry.strategyBudget || entry.budgetEntry?.budget || 0);
  return `
    <form class="strategy-budget-form" data-strategy-budget-form>
      <input type="hidden" name="market" value="${escapeHtml(entry.holding.market || "")}">
      <input type="hidden" name="asset" value="${escapeHtml(entry.holding.asset || entry.holding.name || "")}">
      <input type="hidden" name="symbol" value="${escapeHtml(entry.holding.symbol || "")}">
      <label class="strategy-budget-label" for="strategy-budget-${escapeHtml(entry.key)}">전략 자금</label>
      <div class="strategy-budget-row">
        <div class="strategy-budget-field">
          <input
            class="strategy-budget-input"
            id="strategy-budget-${escapeHtml(entry.key)}"
            name="budget"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            enterkeyhint="done"
            pattern="[0-9,]*"
            placeholder="예: 1,000,000"
            value="${escapeHtml(formatBudgetInputValue(budget))}"
            data-strategy-budget-input
          >
          <span class="strategy-budget-suffix" aria-hidden="true">원</span>
        </div>
        <button type="submit" class="status-tag status-tag--action">${editing ? "수정 저장" : "자금 저장"}</button>
        ${
          editing
            ? `
              <button type="button" class="status-tag status-tag--action" data-strategy-budget-cancel="${escapeHtml(entry.key)}">취소</button>
              <button
                type="button"
                class="status-tag status-tag--action status-tag--danger"
                data-strategy-budget-delete="${escapeHtml(entry.key)}"
                data-strategy-market="${escapeHtml(entry.holding.market || "")}"
                data-strategy-symbol="${escapeHtml(entry.holding.symbol || "")}"
                data-strategy-asset="${escapeHtml(entry.holding.asset || entry.holding.name || "")}"
              >삭제</button>
            `
            : ""
        }
      </div>
    </form>
  `;
}

function renderStrategyState(data) {
  const grid = document.querySelector("#strategy-state-grid");
  const empty = document.querySelector("#strategy-state-empty");
  if (!grid || !empty) {
    return;
  }

  const { entries, totalEntries } = buildStrategyStatusGroups({
    holdings: data?.holdings || [],
    trades: data?.trades || {},
    strategyBudgets: data?.strategyBudgets || {},
    basisYear: getCurrentBasisYear(),
  });

  strategyTradeRegistry = entries.reduce((registry, entry) => {
    registry.set(entry.tradeKey, entry.trade);
    return registry;
  }, new Map());
  strategyStateEntryRegistry = entries.reduce((registry, entry) => {
    registry.set(entry.tradeKey, entry);
    return registry;
  }, new Map());

  if (strategyBudgetEditorKey && !entries.some((entry) => entry.mode === "buy" && entry.key === strategyBudgetEditorKey)) {
    strategyBudgetEditorKey = "";
  }

  grid.innerHTML = entries.length
    ? entries
        .map((entry) =>
          renderStrategyStateCard(entry, {
            canManage: canManagePortfolioMutations(),
            strategyBudgetEditorKey,
            renderStrategyBudgetForm,
          })
        )
        .join("")
    : "";

  empty.hidden = totalEntries > 0;
  empty.innerHTML = totalEntries
    ? ""
    : `
      <div class="targets-empty strategy-state-empty-card">
        <strong>전략 상태 종목이 아직 없습니다.</strong>
        <p>전략 단계를 지정한 보유 종목이 생기면 여기서 진입률과 남은 포지션을 한 번에 관리할 수 있습니다.</p>
        ${
          canManagePortfolioMutations()
            ? '<button type="button" class="btn-primary strategy-state-empty-action" data-strategy-open-trade>거래 추가</button>'
            : ""
        }
      </div>
    `;
}

function setTargetFormStatus(message = "", tone = "neutral") {
  const status = document.querySelector("#target-form-status");
  if (!status) {
    return;
  }

  status.textContent = message;
  status.dataset.tone = tone;
}

async function requestCashMutation(payload, options = {}) {
  if (window.location.protocol === "file:") {
    throw new Error("현금 보유 수정은 로컬 서버에서만 가능합니다. `node scripts/dev-server.js` 실행 후 접속하세요.");
  }

  const mutationId = String(options.mutationId || "").trim();
  let response = null;

  try {
    response = await fetchWithAccessTimeout(
      "./api/cash-positions",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(mutationId ? { "X-Mutation-Id": mutationId } : {}),
        },
        body: JSON.stringify(payload || {}),
      },
      MUTATION_REQUEST_TIMEOUT_MS
    );
  } catch (error) {
    throw createMutationRequestError("현금 보유 저장 연결이 일시적으로 끊겼습니다.", {
      retryable: true,
    });
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage = result?.error || "현금 보유 수정에 실패했습니다.";
    throw createMutationRequestError(errorMessage, {
      status: response.status,
      retryable: isServerMutationErrorRetryable(response.status, errorMessage),
    });
  }

  return result;
}

async function requestTargetMutation(method, targetData, options = {}) {
  if (window.location.protocol === "file:") {
    throw new Error("관심종목 저장/삭제는 로컬 서버에서만 가능합니다. `node scripts/dev-server.js` 실행 후 접속하세요.");
  }

  const mutationId = String(options.mutationId || "").trim();
  let response = null;

  try {
    response = await fetchWithAccessTimeout(
      "./api/targets",
      {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(mutationId ? { "X-Mutation-Id": mutationId } : {}),
        },
        body: JSON.stringify(targetData),
      },
      MUTATION_REQUEST_TIMEOUT_MS
    );
  } catch (error) {
    throw createMutationRequestError("관심종목 저장 연결이 일시적으로 끊겼습니다.", {
      retryable: true,
    });
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage = payload?.error || "관심종목 처리에 실패했습니다.";
    throw createMutationRequestError(errorMessage, {
      status: response.status,
      retryable: isServerMutationErrorRetryable(response.status, errorMessage),
    });
  }

  return payload;
}

async function requestStrategyBudgetMutation(method, payload, options = {}) {
  if (window.location.protocol === "file:") {
    throw new Error("전략 자금 저장/삭제는 로컬 서버에서만 가능합니다. `node scripts/dev-server.js` 실행 후 접속하세요.");
  }

  const mutationId = String(options.mutationId || "").trim();
  let response = null;

  try {
    response = await fetchWithAccessTimeout(
      "./api/strategy-budgets",
      {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(mutationId ? { "X-Mutation-Id": mutationId } : {}),
        },
        body: JSON.stringify(payload || {}),
      },
      MUTATION_REQUEST_TIMEOUT_MS
    );
  } catch (error) {
    throw createMutationRequestError("전략 자금 저장 연결이 일시적으로 끊겼습니다.", {
      retryable: true,
    });
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage = result?.error || "전략 자금 처리에 실패했습니다.";
    throw createMutationRequestError(errorMessage, {
      status: response.status,
      retryable: isServerMutationErrorRetryable(response.status, errorMessage),
    });
  }

  return result;
}

async function requestUiPreferencesMutation(payload, options = {}) {
  if (window.location.protocol === "file:") {
    throw new Error("세팅 저장은 로컬 서버에서만 가능합니다. `node scripts/dev-server.js` 실행 후 접속하세요.");
  }

  const mutationId = String(options.mutationId || "").trim();
  let response = null;

  try {
    response = await fetchWithAccessTimeout(
      "./api/ui-preferences",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(mutationId ? { "X-Mutation-Id": mutationId } : {}),
        },
        body: JSON.stringify(payload || {}),
      },
      MUTATION_REQUEST_TIMEOUT_MS
    );
  } catch (error) {
    throw createMutationRequestError("세팅 저장 연결이 일시적으로 끊겼습니다.", {
      retryable: true,
    });
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage = result?.error || "세팅 저장에 실패했습니다.";
    throw createMutationRequestError(errorMessage, {
      status: response.status,
      retryable: isServerMutationErrorRetryable(response.status, errorMessage),
    });
  }

  return result;
}

function syncUiPreferencesLocally(uiPreferences = {}, options = {}) {
  const nextPreferences = normalizeUiPreferencesState(
    uiPreferences,
    getBoardVariant(),
    currentPortfolioData || basePortfolioData || {}
  );
  currentUiPreferences = nextPreferences;

  if (basePortfolioData) {
    basePortfolioData = {
      ...basePortfolioData,
      uiPreferences: nextPreferences,
    };
    window.__PORTFOLIO_DATA__ = basePortfolioData;
  }

  if (currentPortfolioData) {
    currentPortfolioData = {
      ...currentPortfolioData,
      uiPreferences: nextPreferences,
    };
  }

  if (options.render !== false) {
    renderUiPreferencesState(getRenderablePortfolioSnapshot(), {
      rerenderSettings: options.rerenderSettings !== false,
    });
  }

  return nextPreferences;
}

function applyUiPreferencesServerResult(updatedPortfolio = null, options = {}) {
  if (!updatedPortfolio) {
    return currentPortfolioData || basePortfolioData || null;
  }

  const nextPreferences = normalizeUiPreferencesState(updatedPortfolio.uiPreferences, getBoardVariant(), updatedPortfolio);
  const preservedPreferences = options.preserveCurrent ? currentUiPreferences : nextPreferences;
  lastSyncedUiPreferences = {
    ...nextPreferences,
    livePrice: {
      ...nextPreferences.livePrice,
    },
    tradeQuickAssets: [...nextPreferences.tradeQuickAssets],
    hiddenHoldings: [...nextPreferences.hiddenHoldings],
  };

  basePortfolioData = {
    ...(basePortfolioData || {}),
    ...updatedPortfolio,
    uiPreferences: preservedPreferences,
  };
  window.__PORTFOLIO_DATA__ = basePortfolioData;

  const renderable = buildRenderablePortfolio(basePortfolioData, livePortfolioSnapshot);
  currentPortfolioData = renderable;
  currentUiPreferences = normalizeUiPreferencesState(renderable.uiPreferences, getBoardVariant(), renderable);

  if (!options.preserveCurrent) {
    renderUiPreferencesState(renderable, {
      rerenderSettings: options.rerenderSettings !== false,
    });
  }

  return renderable;
}

function handleUiPreferencesMutationError(error) {
  setSettingsStatus(error?.message || "세팅 저장에 실패했습니다.", "error");
  showAppToast(error?.message || "세팅 저장에 실패했습니다.", "error", {
    title: "세팅 저장 실패",
  });
}

function queueUiPreferencesMutation(nextUiPreferences = {}, successMessage = "세팅을 저장했습니다.", options = {}) {
  const nextPreferences = syncUiPreferencesLocally(
    nextUiPreferences,
    {
      render: true,
      rerenderSettings: options.rerenderSettings !== false,
    }
  );

  pendingUiPreferencesMutation = {
    uiPreferences: {
      visibleSections: [...nextPreferences.visibleSections],
      livePrice: {
        ...nextPreferences.livePrice,
      },
      tradeQuickAssets: [...nextPreferences.tradeQuickAssets],
      hiddenHoldings: [...nextPreferences.hiddenHoldings],
    },
    successMessage,
    rerenderSettings: options.rerenderSettings !== false,
  };
  setSettingsStatus("세팅을 적용하는 중입니다.", "neutral");

  if (pendingUiPreferencesSaveTimer) {
    window.clearTimeout(pendingUiPreferencesSaveTimer);
  }

  pendingUiPreferencesSaveTimer = window.setTimeout(() => {
    pendingUiPreferencesSaveTimer = null;
    flushQueuedUiPreferencesMutation().catch(handleUiPreferencesMutationError);
  }, UI_PREFERENCES_SAVE_DEBOUNCE_MS);

  return currentPortfolioData;
}

async function flushQueuedUiPreferencesMutation() {
  if (!pendingUiPreferencesMutation) {
    return currentPortfolioData;
  }

  if (uiPreferencesSavePromise) {
    await uiPreferencesSavePromise;
    if (!pendingUiPreferencesMutation) {
      return currentPortfolioData;
    }
  }

  const entry = pendingUiPreferencesMutation;
  pendingUiPreferencesMutation = null;

  uiPreferencesSavePromise = runSerializedPortfolioMutation(async () => {
    const mutationId = createMutationId("ui-preferences");

    try {
      const updatedPortfolio = await requestUiPreferencesMutation(
        {
          visibleSections: entry.uiPreferences.visibleSections,
          livePrice: entry.uiPreferences.livePrice,
          tradeQuickAssets: entry.uiPreferences.tradeQuickAssets,
          hiddenHoldings: entry.uiPreferences.hiddenHoldings,
        },
        { mutationId }
      );
      const preserveCurrent =
        Boolean(pendingUiPreferencesMutation) &&
        !areUiPreferencesEqual(pendingUiPreferencesMutation.uiPreferences, entry.uiPreferences);
      const confirmedPortfolio = applyUiPreferencesServerResult(updatedPortfolio, {
        preserveCurrent,
        rerenderSettings: !preserveCurrent && entry.rerenderSettings !== false,
      });
      setSettingsStatus(
        preserveCurrent ? "세팅을 이어서 저장하는 중입니다." : entry.successMessage || "세팅을 저장했습니다.",
        preserveCurrent ? "neutral" : "success"
      );
      return confirmedPortfolio;
    } catch (error) {
      if (!isRetryableMutationError(error)) {
        syncUiPreferencesLocally(lastSyncedUiPreferences, { render: true });
        throw error;
      }

      clearPendingMutationsByKind("ui-preferences");
      const pendingCount = enqueuePendingMutation({
        id: mutationId,
        kind: "ui-preferences",
        method: "PUT",
        payload: {
          visibleSections: entry.uiPreferences.visibleSections,
          livePrice: entry.uiPreferences.livePrice,
          tradeQuickAssets: entry.uiPreferences.tradeQuickAssets,
          hiddenHoldings: entry.uiPreferences.hiddenHoldings,
        },
        successMessage: entry.successMessage,
      });
      setSettingsStatus(
        `${String(entry.successMessage || "세팅 저장").split(".")[0]} 요청을 임시보관했습니다. ${describePendingMutationCount(pendingCount)}`,
        "neutral"
      );
      schedulePendingMutationFlush();
      return currentPortfolioData;
    } finally {
      uiPreferencesSavePromise = null;
    }
  });

  const result = await uiPreferencesSavePromise;
  if (pendingUiPreferencesMutation) {
    return flushQueuedUiPreferencesMutation();
  }

  return result;
}

async function reconcilePortfolioAfterMutation(updatedPortfolio, options = {}) {
  livePortfolioSnapshot = options.resetLiveSnapshot
    ? null
    : alignLiveSnapshotWithPortfolio(updatedPortfolio, livePortfolioSnapshot);
  applyPortfolioData(updatedPortfolio, livePortfolioSnapshot, { renderMode: "full" });

  try {
    const synced = await syncDashboardFromServer({
      includePortfolio: true,
      includeNotes: true,
      includeLive: true,
      portfolioTimeoutMs: 5000,
    });
    return synced?.portfolio || updatedPortfolio;
  } catch (error) {
    console.error(error);
    try {
      await refreshLivePortfolio();
    } catch (liveError) {
      console.error(liveError);
    }
    return updatedPortfolio;
  }
}

async function applyCashMutation(payload, options = {}) {
  return runSerializedPortfolioMutation(async () => {
    const mutationId = createMutationId("cash");
    const successMessage = String(options.successMessage || "현금 보유를 반영했습니다.").trim();
    const previousPortfolio = structuredClone(basePortfolioData || currentPortfolioData || {});
    const optimisticPortfolio = buildOptimisticCashAdjustedPortfolio(
      basePortfolioData || currentPortfolioData || {},
      payload
    );

    if (optimisticPortfolio && Object.keys(optimisticPortfolio).length > 0) {
      applyPortfolioData(optimisticPortfolio, livePortfolioSnapshot, { renderMode: "full" });
    }

    try {
      const updatedPortfolio = await requestCashMutation(payload, { mutationId });
      const confirmedPortfolio = await reconcilePortfolioAfterMutation(updatedPortfolio);
      showAppToast(successMessage, "success", {
        title: "현금 반영 완료",
      });
      return confirmedPortfolio;
    } catch (error) {
      if (!isRetryableMutationError(error)) {
        if (previousPortfolio && Object.keys(previousPortfolio).length > 0) {
          applyPortfolioData(previousPortfolio, livePortfolioSnapshot, { renderMode: "full" });
        }
        throw error;
      }

      const pendingCount = enqueuePendingMutation({
        id: mutationId,
        kind: "cash",
        method: "PUT",
        payload,
      });
      showAppToast(`현금 변경을 임시보관했습니다. ${describePendingMutationCount(pendingCount)}`, "info", {
        title: "현금 변경 대기",
        duration: 3600,
      });
      schedulePendingMutationFlush();
      return currentPortfolioData;
    }
  });
}

async function applyTargetMutation(method, targetData, successMessage) {
  return runSerializedPortfolioMutation(async () => {
    const mutationId = createMutationId("target");

    try {
      const updatedPortfolio = await requestTargetMutation(method, targetData, { mutationId });
      const confirmedPortfolio = await reconcilePortfolioAfterMutation(updatedPortfolio);
      clearPendingTargetMutationsForPayload(targetData);
      setTargetFormStatus(successMessage, "success");
      return confirmedPortfolio;
    } catch (error) {
      if (!isRetryableMutationError(error)) {
        throw error;
      }

      const pendingCount = enqueuePendingMutation({
        id: mutationId,
        kind: "target",
        method,
        payload: targetData,
        successMessage,
      });
      setTargetFormStatus(`${successMessage.split(".")[0]} 요청을 임시보관했습니다. ${describePendingMutationCount(pendingCount)}`, "neutral");
      schedulePendingMutationFlush();
      return currentPortfolioData;
    }
  });
}

async function applyStrategyBudgetMutation(method, payload, successMessage = "전략 자금을 저장했습니다.") {
  return runSerializedPortfolioMutation(async () => {
    const mutationId = createMutationId("strategy-budget");

    try {
      const updatedPortfolio = await requestStrategyBudgetMutation(method, payload, { mutationId });
      const confirmedPortfolio = await reconcilePortfolioAfterMutation(updatedPortfolio);
      setStrategyStateStatus(successMessage, "success");
      return confirmedPortfolio;
    } catch (error) {
      if (!isRetryableMutationError(error)) {
        throw error;
      }

      const pendingCount = enqueuePendingMutation({
        id: mutationId,
        kind: "strategy-budget",
        method,
        payload,
      });
      setStrategyStateStatus(`${successMessage.split(".")[0]} 요청을 임시보관했습니다. ${describePendingMutationCount(pendingCount)}`, "neutral");
      schedulePendingMutationFlush();
      return currentPortfolioData;
    }
  });
}

async function requestTradeMutation(method, payload, options = {}) {
  if (window.location.protocol === "file:") {
    throw new Error("거래 저장/수정/삭제는 로컬 서버에서만 가능합니다. `node scripts/dev-server.js` 실행 후 접속하세요.");
  }

  const mutationId = String(options.mutationId || "").trim();
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response = null;

    try {
      response = await fetchWithAccessTimeout(
        "./api/trades",
        {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(mutationId ? { "X-Mutation-Id": mutationId } : {}),
          },
          body: JSON.stringify(payload),
        },
        MUTATION_REQUEST_TIMEOUT_MS
      );
    } catch (error) {
      throw createMutationRequestError("거래 저장 연결이 일시적으로 끊겼습니다.", {
        retryable: true,
      });
    }

    const result = await response.json().catch(() => null);
    if (response.ok) {
      return result;
    }

    const errorMessage = result?.error || "거래 처리에 실패했습니다.";
    if (isStalePortfolioWriteMessage(errorMessage) && attempt < maxAttempts) {
      await waitForMutationRetryBackoff(attempt);
      continue;
    }

    throw createMutationRequestError(errorMessage, {
      status: response.status,
      retryable: isServerMutationErrorRetryable(response.status, errorMessage),
    });
  }

  throw createMutationRequestError("거래 처리에 실패했습니다.", {
    retryable: true,
  });
}

async function applyTradeMutation(method, payload) {
  return runSerializedPortfolioMutation(async () => {
    const mutationId = createMutationId("trade");

    try {
      const updatedPortfolio = await requestTradeMutation(method, payload, { mutationId });
      return reconcilePortfolioAfterMutation(updatedPortfolio, {
        resetLiveSnapshot: true,
      });
    } catch (error) {
      if (!isRetryableMutationError(error)) {
        throw error;
      }

      const pendingCount = enqueuePendingMutation({
        id: mutationId,
        kind: "trade",
        method,
        payload,
      });
      broadcastPendingMutationStatus(`거래 변경을 임시보관했습니다. ${describePendingMutationCount(pendingCount)}`, "neutral", ["trade"]);
      schedulePendingMutationFlush();
      return currentPortfolioData;
    }
  });
}

function finalizeMobileModalLaunch(
  sectionId = mobileSectionState.sectionId || "",
  returnSectionId = mobileSectionState.returnSectionId || "",
) {
  if (!isMobileSectionMode() || !sectionId) {
    return;
  }

  rememberMobileSectionRestore(sectionId, returnSectionId);
  closeMobileSectionOverlay();
}

function initTargetManager() {
  const form = document.querySelector("#target-form");
  const marketSelect = document.querySelector("#target-market");
  const assetInput = document.querySelector("#target-asset");
  const help = document.querySelector("#target-help");
  const status = document.querySelector("#target-form-status");
  const resetButton = document.querySelector("#target-reset");
  const submitButton = document.querySelector("#target-submit");
  const suggestionPanel = document.querySelector("#target-asset-suggestions");

  if (!form || !marketSelect || !assetInput || !help || !status || !submitButton || form.dataset.bound === "true") {
    return;
  }

  const setStatus = (message = "", tone = "neutral") => {
    status.textContent = message;
    status.dataset.tone = tone;
  };

  const setSubmitting = (isSubmitting) => {
    submitButton.disabled = isSubmitting;
    submitButton.textContent = isSubmitting ? "저장 중..." : "관심종목 추가";
    if (resetButton) {
      resetButton.disabled = isSubmitting;
    }
  };

  const syncTargetFormMode = () => {
    const market = marketSelect.value;
    if (market === "암호화폐") {
      assetInput.placeholder = "솔라나(SOL)";
      help.textContent = getTargetFormHelpText(market);
      return;
    }

    if (market === "미국주식") {
      assetInput.placeholder = "Apple Inc. (AAPL)";
      help.textContent = getTargetFormHelpText(market);
      return;
    }

    assetInput.placeholder = "삼성전자(005930)";
    help.textContent = getTargetFormHelpText(market);
  };

  const resetTargetForm = () => {
    form.reset();
    marketSelect.value = "암호화폐";
    syncTargetFormMode();
  };
  const autocomplete = setupAssetAutocomplete({
    input: assetInput,
    marketSelect,
    panel: suggestionPanel,
    asyncSource: fetchRemoteAssetSuggestions,
  });

  marketSelect.addEventListener("change", syncTargetFormMode);
  resetButton?.addEventListener("click", () => {
    resetTargetForm();
    setStatus("입력을 비웠습니다.");
    assetInput.focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("");
    autocomplete.syncValue();

    const targetData = {
      market: marketSelect.value,
      asset: String(assetInput.value || "").trim(),
    };

    try {
      setSubmitting(true);
      await applyTargetMutation("POST", targetData, "관심종목을 저장했습니다. 실시간 추적도 같이 시작합니다.");
      resetTargetForm();
    } catch (error) {
      console.error(error);
      setStatus(error.message || "관심종목 저장에 실패했습니다.", "error");
    } finally {
      setSubmitting(false);
      assetInput.focus();
    }
  });

  syncTargetFormMode();
  bindSectionBarMenu(document.querySelector("#target-entry-menu"));
  if (isEmptyBoardVariant()) {
    const entrySummary = document.querySelector(".targets-entry-summary");
    if (entrySummary) {
      entrySummary.textContent = getBlankFamilyTargetContent().entrySummary;
    }
  }
  setStatus(getTargetFormIdleStatusText());
  form.dataset.bound = "true";
}

function initTargetRemovalActions() {
  const targetsGrid = document.querySelector("#targets-grid");

  const handleRemoval = async (button) => {
    const market = String(button.dataset.targetMarket || "").trim();
    const symbol = String(button.dataset.targetSymbol || "").trim();
    const name = String(button.dataset.targetName || "").trim();

    if (!market || (!symbol && !name)) {
      return;
    }

    const confirmed = await showAppConfirm({
      eyebrow: "Target Delete",
      title: "관심종목을 삭제할까요?",
      message: `관심종목에서 제거합니다.\n대상: ${name || symbol}`,
      confirmText: "삭제",
      cancelText: "취소",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    try {
      button.disabled = true;
      await applyTargetMutation(
        "DELETE",
        {
          market,
          symbol,
          name,
        },
        "관심종목에서 삭제했습니다. 보유 중이 아니면 Live price에서도 같이 빠집니다."
      );
    } catch (error) {
      console.error(error);
      setTargetFormStatus(error.message || "관심종목 삭제에 실패했습니다.", "error");
    } finally {
      if (button.isConnected) {
        button.disabled = false;
      }
    }
  };

  const bindContainer = (container) => {
    if (!container || container.dataset.targetRemovalBound === "true") {
      return;
    }

    container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-target-remove]");
      if (!button) {
        return;
      }

      handleRemoval(button);
    });
    container.dataset.targetRemovalBound = "true";
  };

  bindContainer(targetsGrid);
}

function bindStrategyStateSection(section) {
  if (!section || section.dataset.strategyStateBound === "true") {
    return;
  }

  section.addEventListener("input", (event) => {
    const input = event.target.closest("[data-strategy-budget-input]");
    if (!input || !section.contains(input)) {
      return;
    }

    formatStrategyBudgetInputElement(input);
  });

  section.addEventListener("focusin", (event) => {
    const input = event.target.closest("[data-strategy-budget-input]");
    if (!input || !section.contains(input)) {
      return;
    }

    formatStrategyBudgetInputElement(input, { preserveCaret: false });
  });

  section.addEventListener("focusout", (event) => {
    const input = event.target.closest("[data-strategy-budget-input]");
    if (!input || !section.contains(input)) {
      return;
    }

    formatStrategyBudgetInputElement(input, { preserveCaret: false });
    window.requestAnimationFrame(() => {
      if (!document.activeElement?.closest?.("[data-strategy-budget-input]")) {
        document.body.classList.remove("strategy-budget-focus");
      }
    });
  });

  section.addEventListener("click", async (event) => {
    const tradeOpenButton = event.target.closest("[data-strategy-open-trade]");
    if (tradeOpenButton && section.contains(tradeOpenButton)) {
      if (!canManagePortfolioMutations()) {
        setStrategyStateStatus("거래 추가는 owner 모드에서만 사용할 수 있습니다.", "error");
        return;
      }
      finalizeMobileModalLaunch("strategy-state-section");
      tradeModalController?.openCreate?.();
      return;
    }

    const stageSetButton = event.target.closest("[data-strategy-stage-set]");
    if (stageSetButton && section.contains(stageSetButton)) {
      const tradeKey = stageSetButton.dataset.strategyTradeKey || "";
      const nextStage = normalizeTradeStrategyStage(stageSetButton.dataset.strategyStageSet || "");
      const trade = strategyTradeRegistry.get(tradeKey);
      const entry = strategyStateEntryRegistry.get(tradeKey);
      const selectorPayload = buildTradeMutationSelectorPayload(trade);
      if (!trade || !entry || !nextStage) {
        setStrategyStateStatus("변경할 전략 단계를 찾지 못했습니다.", "error");
        return;
      }
      if (!selectorPayload) {
        setStrategyStateStatus("변경할 전략 거래 정보를 찾지 못했습니다.", "error");
        return;
      }

      if (normalizeTradeStrategyStage(trade.stage) === nextStage) {
        return;
      }

      const storedBaseline = resolveStrategyBaselineQuantityValue(trade.strategyBaselineQuantity);
      const visibleBaseline = resolveStrategyBaselineQuantityValue(entry.sellBaselineQuantity);
      const fallbackBaseline = Number(entry.quantity || 0);
      const nextBaselineQuantity = storedBaseline || visibleBaseline || fallbackBaseline;

      try {
        stageSetButton.disabled = true;
        await applyTradeMutation("PUT", {
          ...selectorPayload,
          trade: {
            ...trade,
            stage: nextStage,
            strategyBaselineQuantity: isSellStrategyStage(nextStage) && nextBaselineQuantity > 0 ? nextBaselineQuantity : null,
          },
        });
        setStrategyStateStatus(`전략 단계를 ${nextStage}(으)로 변경했습니다.`, "success");
      } catch (error) {
        console.error(error);
        setStrategyStateStatus(error.message || "전략 단계 변경에 실패했습니다.", "error");
      } finally {
        if (stageSetButton.isConnected) {
          stageSetButton.disabled = false;
        }
      }
      return;
    }

    const editBudgetButton = event.target.closest("[data-strategy-budget-edit]");
    if (editBudgetButton && section.contains(editBudgetButton)) {
      strategyBudgetEditorKey = editBudgetButton.dataset.strategyBudgetEdit || "";
      renderStrategyState(currentPortfolioData);
      return;
    }

    const cancelBudgetButton = event.target.closest("[data-strategy-budget-cancel]");
    if (cancelBudgetButton && section.contains(cancelBudgetButton)) {
      strategyBudgetEditorKey = "";
      renderStrategyState(currentPortfolioData);
      setStrategyStateStatus("");
      return;
    }

    const deleteBudgetButton = event.target.closest("[data-strategy-budget-delete]");
    if (deleteBudgetButton && section.contains(deleteBudgetButton)) {
      const confirmed = await showAppConfirm({
        eyebrow: "Budget Delete",
        title: "전략 자금을 삭제할까요?",
        message: "이 종목 카드에서 연결된 전략 자금을 제거합니다.",
        confirmText: "삭제",
        cancelText: "취소",
        tone: "danger",
      });
      if (!confirmed) {
        return;
      }

      try {
        await applyStrategyBudgetMutation(
          "DELETE",
          {
            market: deleteBudgetButton.dataset.strategyMarket || "",
            symbol: deleteBudgetButton.dataset.strategySymbol || "",
            asset: deleteBudgetButton.dataset.strategyAsset || "",
          },
          "전략 자금을 삭제했습니다."
        );
        strategyBudgetEditorKey = "";
        renderStrategyState(currentPortfolioData);
      } catch (error) {
        setStrategyStateStatus(error.message || "전략 자금 삭제에 실패했습니다.", "error");
      }
      return;
    }

    const deleteTradeButton = event.target.closest("[data-strategy-trade-delete]");
    if (deleteTradeButton && section.contains(deleteTradeButton)) {
      const trade = strategyTradeRegistry.get(deleteTradeButton.dataset.strategyTradeDelete || "");
      const selectorPayload = buildTradeMutationSelectorPayload(trade);
      if (!trade) {
        setStrategyStateStatus("삭제할 전략 거래를 찾지 못했습니다.", "error");
        return;
      }
      if (!selectorPayload) {
        setStrategyStateStatus("삭제할 전략 거래 정보를 찾지 못했습니다.", "error");
        return;
      }

      const confirmed = await showAppConfirm({
        eyebrow: "Strategy Trade Delete",
        title: "전략 상태에서 제거할까요?",
        message: `거래 원본은 유지하고 전략 단계만 비웁니다.\n대상: ${getDisplayAssetName({
          asset: trade.asset,
          symbol: trade.symbol,
          market: getMarketLabelFromMetaMarket(trade.market),
        })}`,
        confirmText: "전략 제거",
        cancelText: "취소",
        tone: "danger",
      });
      if (!confirmed) {
        return;
      }

      try {
        deleteTradeButton.disabled = true;
        await applyTradeMutation("PUT", {
          ...selectorPayload,
          trade: {
            ...trade,
            stage: "",
          },
        });
        setStrategyStateStatus("전략 상태에서 제거했습니다.", "success");
      } catch (error) {
        console.error(error);
        setStrategyStateStatus(error.message || "전략 제거에 실패했습니다.", "error");
      } finally {
        if (deleteTradeButton.isConnected) {
          deleteTradeButton.disabled = false;
        }
      }
      return;
    }

    if (event.target.closest("button, input, select, textarea, label, form")) {
      return;
    }

    const card = event.target.closest("[data-strategy-card-open]");
    if (!card || !section.contains(card)) {
      return;
    }
    if (!canManagePortfolioMutations()) {
      setStrategyStateStatus("전략 거래 수정은 owner 모드에서만 사용할 수 있습니다.", "error");
      return;
    }

    const trade = strategyTradeRegistry.get(card.dataset.strategyCardOpen || "");
    if (!trade) {
      setStrategyStateStatus("수정할 전략 거래를 찾지 못했습니다.", "error");
      return;
    }

    finalizeMobileModalLaunch("strategy-state-section");
    tradeModalController?.openEdit?.(trade);
  });

  section.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-strategy-budget-form]");
    if (!form || !section.contains(form)) {
      return;
    }

    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const budget = Number(sanitizeStrategyBudgetDigits(formData.get("budget") || ""));

    if (!(budget > 0)) {
      setStrategyStateStatus("전략 자금을 확인하세요.", "error");
      form.querySelector("[data-strategy-budget-input]")?.focus();
      return;
    }

    try {
      if (submitButton) {
        submitButton.disabled = true;
      }
      await applyStrategyBudgetMutation(
        "PUT",
        {
          market: formData.get("market") || "",
          symbol: formData.get("symbol") || "",
          asset: formData.get("asset") || "",
          budget,
        },
        "전략 자금을 저장했습니다."
      );
      strategyBudgetEditorKey = "";
      renderStrategyState(currentPortfolioData);
    } catch (error) {
      setStrategyStateStatus(error.message || "전략 자금 저장에 실패했습니다.", "error");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });

  section.dataset.strategyStateBound = "true";
}

function toggleDisclosure(root, trigger, panel, willOpen) {
  if (!root || !trigger || !panel) {
    return;
  }

  root.classList.toggle("is-open", willOpen);
  trigger.setAttribute("aria-expanded", String(willOpen));
  panel.classList.toggle("is-open", willOpen);
  panel.setAttribute("aria-hidden", String(!willOpen));
}

function bindPanelAccordion(panel) {
  if (!panel || panel.dataset.accordionBound === "true") {
    return;
  }

  panel.addEventListener("click", (event) => {
    // 거래 추가 버튼 클릭은 무시
    if (event.target.closest(".btn-add-trade")) {
      return;
    }

    const trigger = event.target.closest(".section-toggle");
    if (!trigger || !panel.contains(trigger)) {
      return;
    }

    const body = panel.querySelector(".panel-collapse");
    const willOpen = trigger.getAttribute("aria-expanded") !== "true";
    if (willOpen) {
      ensureDeferredMobileSectionRendered(panel.id);
    }
    toggleDisclosure(panel, trigger, body, willOpen);

    if (willOpen && panel.id === "timeline-section") {
      window.requestAnimationFrame(() => {
        panel.scrollIntoView({
          block: "start",
          behavior: "smooth",
        });
      });
    }
  });

  panel.dataset.accordionBound = "true";
}

function bindSectionBarMenu(menu) {
  if (!menu || menu.dataset.sectionBarBound === "true") {
    return;
  }

  menu.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-section-bar-toggle]");
    if (!trigger || !menu.contains(trigger)) {
      return;
    }

    const panel = menu.querySelector("[data-section-bar-panel]");
    const willOpen = trigger.getAttribute("aria-expanded") !== "true";
    toggleDisclosure(menu, trigger, panel, willOpen);
  });

  menu.dataset.sectionBarBound = "true";
}

function bindAllPanelAccordions() {
  document.querySelectorAll(".panel-accordion").forEach((panel) => {
    bindPanelAccordion(panel);
  });
}

function formatTradeQuantity(value) {
  return formatNumber(value);
}

function parseMonthDayToDate(value, year) {
  if (typeof value !== "string") {
    return null;
  }

  const [month, day] = value.split("/").map((segment) => Number(segment));
  if (!month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function normalizeTradeQuantityKey(value) {
  return Number(value || 0).toFixed(8);
}

function parseTradeOutcomeNote(note = "") {
  const matched = String(note || "")
    .replace(/\s+/g, " ")
    .match(/([+-])\s*([\d,]+(?:\.\d+)?)원(?:\s*\(([+-]?\d+(?:\.\d+)?)%\))?/);

  if (!matched) {
    return null;
  }

  return {
    pnl: (matched[1] === "-" ? -1 : 1) * Number(matched[2].replace(/,/g, "")),
    returnRate: matched[3] == null ? null : Number(matched[3]) / 100,
  };
}

function getDisplayTradeNote(note = "") {
  const trimmed = String(note || "").trim();
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.replace(/\s+/g, " ");
  const outcomeOnlyPattern = /^([+-])\s*[\d,]+(?:\.\d+)?원(?:\s*\(([+-]?\d+(?:\.\d+)?)%\))?$/;
  if (outcomeOnlyPattern.test(normalized)) {
    return "";
  }

  return trimmed;
}

function normalizeTimelineMoney(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  const rounded = Number(numeric.toFixed(8));
  return Math.abs(rounded) < 1e-10 ? 0 : rounded;
}

function normalizeTimelineRate(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  const rounded = Number(numeric.toFixed(12));
  return Math.abs(rounded) < 1e-10 ? 0 : rounded;
}

function isXrpTradeLike(item = {}) {
  const symbol = String(item?.symbol || "")
    .trim()
    .toUpperCase();
  const assetRaw = String(item?.asset || item?.name || "").trim();
  const normalizedAsset = assetRaw.toUpperCase().replace(/\s+/g, "");

  if (symbol === "KRW-XRP" || symbol === "XRP") {
    return true;
  }

  if (normalizedAsset === "XRP" || normalizedAsset.includes("엑스알피") || normalizedAsset.includes("리플")) {
    return true;
  }

  return assetRaw.includes("(XRP)");
}

function roundXrpDefenseValue(value) {
  return Math.round(Number(value || 0) * 1_000_000) / 1_000_000;
}

function formatXrpDefenseGapLabel(rate = 0) {
  const normalizedRate = Number(rate || 0);
  if (!Number.isFinite(normalizedRate)) {
    return "0%";
  }

  const percent = roundXrpDefenseValue(normalizedRate * 100);
  return `${numberFormatter.format(percent)}%`;
}

function buildXrpRecentBuyPoolAnalytics(trades = [], options = {}) {
  const maxEntries = Math.max(1, Number(options.maxEntries || 10));
  const keyFn = typeof options.keyFn === "function" ? options.keyFn : (trade, index) => String(index);
  const pool = [];
  const sellContextByKey = new Map();
  const holdingState = {
    quantity: 0,
    gross: 0,
  };

  const pruneEmptyEntries = () => {
    for (let index = pool.length - 1; index >= 0; index -= 1) {
      if (!(Number(pool[index]?.remainingQuantity || 0) > 1e-10)) {
        pool.splice(index, 1);
      }
    }
  };

  const summarizePool = () => {
    const activeEntries = pool.filter((entry) => Number(entry?.remainingQuantity || 0) > 1e-10);
    const buyQuantity = roundXrpDefenseValue(
      activeEntries.reduce((total, entry) => total + Number(entry.remainingQuantity || 0), 0)
    );
    const buyGross = roundXrpDefenseValue(
      activeEntries.reduce((total, entry) => total + Number(entry.remainingGross || 0), 0)
    );
    const buyCount = activeEntries.length;
    const averagePrice = buyQuantity > 0 ? roundXrpDefenseValue(buyGross / buyQuantity) : 0;

    return {
      buyCount,
      buyQuantity,
      buyGross,
      averagePrice,
    };
  };

  const summarizeHolding = () => {
    const quantity = roundXrpDefenseValue(Number(holdingState.quantity || 0));
    const gross = normalizeTimelineMoney(Number(holdingState.gross || 0));
    const averagePrice = quantity > 0 ? normalizeTimelineMoney(gross / quantity) : 0;
    return {
      quantity,
      gross,
      averagePrice,
    };
  };

  (Array.isArray(trades) ? trades : []).forEach((trade, index) => {
    if (!isXrpTradeLike(trade)) {
      return;
    }

    const key = keyFn(trade, index);
    const side = String(trade?.side || "").trim();
    const quantity = Number(trade?.quantity || 0);

    if (side === "매수") {
      if (!(quantity > 0)) {
        return;
      }

      const entryGross = roundXrpDefenseValue(Number(trade?.amount || 0) + Number(trade?.fee || 0));
      const entryUnitGross = quantity > 0 ? normalizeTimelineMoney(entryGross / quantity) : 0;

      holdingState.quantity = roundXrpDefenseValue(Number(holdingState.quantity || 0) + quantity);
      holdingState.gross = normalizeTimelineMoney(
        Number(holdingState.gross || 0) + Number(trade?.amount || 0) + Number(trade?.fee || 0)
      );

      pool.push({
        key,
        dateLabel: String(trade?.date || "").trim(),
        recordedAt: String(trade?.createdAt || trade?.addedAt || trade?.updatedAt || "").trim(),
        remainingQuantity: roundXrpDefenseValue(quantity),
        remainingGross: entryGross,
        unitGross: entryUnitGross,
      });

      while (pool.length > maxEntries) {
        pool.shift();
      }
      return;
    }

    if (side !== "매도" || !(quantity > 0)) {
      return;
    }

    const poolBeforeSell = summarizePool();
    const holdingBeforeSell = summarizeHolding();
    const sellUnitPrice =
      quantity > 0
        ? roundXrpDefenseValue(Number(trade?.price || 0) || Number(trade?.amount || 0) / quantity)
        : 0;
    const gapRate =
      poolBeforeSell.averagePrice > 0 && sellUnitPrice > 0
        ? roundXrpDefenseValue(sellUnitPrice / poolBeforeSell.averagePrice - 1)
        : 0;
    const applicableQuantity = roundXrpDefenseValue(Math.min(quantity, poolBeforeSell.buyQuantity));
    const standardQuantity = roundXrpDefenseValue(Math.max(0, quantity - applicableQuantity));

    let remainingDefenseSellQuantity = applicableQuantity;
    const defenseLotItems = [];
    let defenseBasisAmount = 0;

    for (let poolIndex = pool.length - 1; poolIndex >= 0 && remainingDefenseSellQuantity > 1e-10; poolIndex -= 1) {
      const entry = pool[poolIndex];
      const entryQuantity = Number(entry?.remainingQuantity || 0);
      if (!(entryQuantity > 1e-10)) {
        continue;
      }

      const consumeQuantity = Math.min(entryQuantity, remainingDefenseSellQuantity);
      const unitGross =
        Number(entry?.unitGross || 0) > 0
          ? Number(entry.unitGross || 0)
          : entryQuantity > 0
            ? normalizeTimelineMoney(Number(entry?.remainingGross || 0) / entryQuantity)
            : 0;
      const basisAmount = normalizeTimelineMoney(unitGross * consumeQuantity);

      if (consumeQuantity > 0 && unitGross > 0) {
        defenseLotItems.push({
          key: String(entry?.key || ""),
          dateLabel: String(entry?.dateLabel || "").trim(),
          recordedAt: String(entry?.recordedAt || "").trim(),
          quantity: roundXrpDefenseValue(consumeQuantity),
          averagePrice: unitGross,
          basisAmount,
        });
        defenseBasisAmount = normalizeTimelineMoney(defenseBasisAmount + basisAmount);
      }

      entry.remainingQuantity = roundXrpDefenseValue(entryQuantity - consumeQuantity);
      entry.remainingGross = roundXrpDefenseValue(Number(entry?.remainingGross || 0) - basisAmount);
      remainingDefenseSellQuantity = roundXrpDefenseValue(remainingDefenseSellQuantity - consumeQuantity);
    }

    pruneEmptyEntries();
    const effectiveDefenseAveragePrice =
      applicableQuantity > 0 && defenseBasisAmount > 0
        ? normalizeTimelineMoney(defenseBasisAmount / applicableQuantity)
        : 0;

    sellContextByKey.set(key, {
      recentBuyAverage: poolBeforeSell.averagePrice,
      referencePrice: poolBeforeSell.averagePrice,
      gapRate,
      buyCount: poolBeforeSell.buyCount,
      buyQuantity: poolBeforeSell.buyQuantity,
      applicableQuantity,
      standardQuantity,
      standardAveragePrice: holdingBeforeSell.averagePrice,
      holdingQuantity: holdingBeforeSell.quantity,
      defenseBasisAmount,
      effectiveDefenseAveragePrice,
      defenseLotItems,
    });

    if (holdingBeforeSell.quantity > 0) {
      const consumedQuantity = Math.min(quantity, holdingBeforeSell.quantity);
      const consumedGross = normalizeTimelineMoney(holdingBeforeSell.averagePrice * consumedQuantity);
      holdingState.quantity = roundXrpDefenseValue(Math.max(0, holdingBeforeSell.quantity - consumedQuantity));
      holdingState.gross = normalizeTimelineMoney(Math.max(0, holdingBeforeSell.gross - consumedGross));
    }
  });

  const currentPool = summarizePool();
  return {
    recentBuyCount: currentPool.buyCount,
    recentBuyQuantity: currentPool.buyQuantity,
    recentBuyAverage: currentPool.averagePrice,
    sellContextByKey,
  };
}

function computeXrpDefenseOverrideOutcome(trade, referencePrice) {
  const quantity = Number(trade?.quantity || 0);
  const referenceInput =
    referencePrice && typeof referencePrice === "object" ? referencePrice : { referencePrice };
  const normalizedReferencePrice = normalizeTimelineMoney(
    Number((referenceInput.referencePrice ?? trade?.xrpDefenseReferencePrice) || 0)
  );
  const inputDefenseLotItems = Array.isArray(referenceInput.defenseLotItems)
    ? referenceInput.defenseLotItems
    : Array.isArray(trade?.xrpDefenseLotItems)
      ? trade.xrpDefenseLotItems
      : [];
  const defenseLotItems = inputDefenseLotItems
    .map((item) => {
      const lotQuantity = roundXrpDefenseValue(Number(item?.quantity || 0));
      const lotAveragePrice = normalizeTimelineMoney(Number(item?.averagePrice || 0));
      const lotBasisAmount =
        Number(item?.basisAmount || 0) > 0
          ? normalizeTimelineMoney(Number(item.basisAmount || 0))
          : lotQuantity > 0 && lotAveragePrice > 0
            ? normalizeTimelineMoney(lotQuantity * lotAveragePrice)
            : 0;

      if (!(lotQuantity > 0) || !(lotAveragePrice > 0) || !(lotBasisAmount > 0)) {
        return null;
      }

      return {
        dateLabel: String(item?.dateLabel || "").trim(),
        recordedAt: String(item?.recordedAt || "").trim(),
        quantity: lotQuantity,
        averagePrice: lotAveragePrice,
        basisAmount: lotBasisAmount,
      };
    })
    .filter(Boolean);
  const recentBuyQuantity = defenseLotItems.length
    ? roundXrpDefenseValue(defenseLotItems.reduce((total, item) => total + Number(item.quantity || 0), 0))
    : roundXrpDefenseValue(
        Number(
          (referenceInput.applicableQuantity ??
            trade?.xrpDefenseApplicableQuantity ??
            trade?.xrpDefenseRecentBuyQuantity) || 0
        )
      );
  const standardAveragePrice = normalizeTimelineMoney(
    Number((referenceInput.standardAveragePrice ?? trade?.xrpDefenseStandardAveragePrice) || 0)
  );
  const defenseQuantity = normalizedReferencePrice > 0 ? roundXrpDefenseValue(Math.min(quantity, recentBuyQuantity)) : 0;
  const standardQuantity = roundXrpDefenseValue(Math.max(0, quantity - defenseQuantity));

  if (!(quantity > 0)) {
    return null;
  }

  const netAmount = normalizeTimelineMoney(Number(trade?.amount || 0) - Number(trade?.fee || 0));
  const netUnitPrice = quantity > 0 ? normalizeTimelineMoney(netAmount / quantity) : 0;
  const defenseBasisAmount = defenseLotItems.length
    ? normalizeTimelineMoney(defenseLotItems.reduce((total, item) => total + Number(item.basisAmount || 0), 0))
    : normalizeTimelineMoney(defenseQuantity * normalizedReferencePrice);
  const standardBasisAmount =
    standardQuantity > 0 && standardAveragePrice > 0
      ? normalizeTimelineMoney(standardQuantity * standardAveragePrice)
      : 0;
  const basisAmount = normalizeTimelineMoney(defenseBasisAmount + standardBasisAmount);

  if (!(basisAmount > 0)) {
    return null;
  }

  const pnl = normalizeTimelineMoney(netAmount - basisAmount);
  const returnRate = basisAmount > 0 ? normalizeTimelineRate(pnl / basisAmount) : 0;
  const effectiveDefenseAveragePrice =
    defenseQuantity > 0 && defenseBasisAmount > 0
      ? normalizeTimelineMoney(defenseBasisAmount / defenseQuantity)
      : 0;

  return {
    basisAmount,
    defenseBasisAmount,
    pnl,
    returnRate,
    defenseQuantity,
    standardQuantity,
    standardAveragePrice,
    referencePrice: normalizedReferencePrice,
    effectiveDefenseAveragePrice,
    defenseLotItems,
    netAmount,
    netUnitPrice,
    standardBasisAmount,
  };
}

function buildTimelineTradePatch(trade, overrides = {}) {
  const patch = {
    date: trade.date,
    market: trade.market,
    broker: trade.broker || (trade.market === "암호화폐" ? "업비트" : ""),
    asset: trade.asset,
    symbol: trade.symbol || "",
    side: trade.side,
    stage: trade.stage || "",
    quantity: Number(trade.quantity || 0),
    price: Number(trade.price || 0),
    amount: Number(trade.amount || 0),
    fee: Number(trade.fee || 0),
    note: trade.note || "",
  };

  if (trade.strategyBaselineQuantity != null) {
    patch.strategyBaselineQuantity = Number(trade.strategyBaselineQuantity);
  }

  if (trade.realizedPnlOverride != null) {
    patch.realizedPnlOverride = Number(trade.realizedPnlOverride);
  }

  if (trade.realizedReturnRateOverride != null) {
    patch.realizedReturnRateOverride = Number(trade.realizedReturnRateOverride);
  }

  if (trade.realizedReferencePrice != null) {
    patch.realizedReferencePrice = Number(trade.realizedReferencePrice);
  }

  return {
    ...patch,
    ...overrides,
  };
}

function buildTradeMutationMatch(trade = {}) {
  const match = {};
  const createdAt = String(trade.createdAt || trade.addedAt || "").trim();
  const date = String(trade.date || "").trim();
  const market = String(trade.market || "").trim();
  const broker = String(trade.broker || "").trim();
  const asset = String(trade.asset || "").trim();
  const symbol = String(trade.symbol || "").trim().toUpperCase();
  const side = String(trade.side || "").trim();
  const quantity = Number(trade.quantity);
  const price = Number(trade.price);

  if (createdAt) {
    match.createdAt = createdAt;
  }
  if (date) {
    match.date = date;
  }
  if (market) {
    match.market = market;
  }
  if (broker) {
    match.broker = broker;
  }
  if (asset) {
    match.asset = asset;
  }
  if (symbol) {
    match.symbol = symbol;
  }
  if (side) {
    match.side = side;
  }
  if (Number.isFinite(quantity)) {
    match.quantity = quantity;
  }
  if (Number.isFinite(price)) {
    match.price = price;
  }

  return Object.keys(match).length ? match : null;
}

function buildTradeMutationSelectorPayload(trade = {}) {
  if (!trade?.sourceCollection || !Number.isInteger(trade?.sourceIndex)) {
    return null;
  }

  const selector = {
    collection: trade.sourceCollection,
    index: trade.sourceIndex,
  };
  const match = buildTradeMutationMatch(trade);

  if (match) {
    selector.match = match;
  }

  return selector;
}

function renderStrategy(strategy) {
  const container = document.querySelector("#strategy-playbook");
  if (!container || !strategy) {
    return;
  }

  container.innerHTML = `
    <article class="panel strategy-hero-card">
      <div class="strategy-hero-top">
        <div>
          <p class="eyebrow">Revised Playbook</p>
          <h3 class="strategy-hero-title">${escapeHtml(strategy.title)}</h3>
        </div>
        <span class="strategy-version">${escapeHtml(strategy.version)}</span>
      </div>
      <p class="strategy-hero-summary">${escapeHtml(strategy.summary)}</p>
      <p class="strategy-hero-emphasis">${escapeHtml(strategy.mindset)}</p>
      <ul class="strategy-highlights">
        ${strategy.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </article>

    <div class="strategy-layout">
      <article class="panel strategy-block strategy-block--selection">
        <div class="strategy-block-head">
          <span class="strategy-section-index">${escapeHtml(strategy.selection.section)}</span>
          <div>
            <p class="eyebrow">Watchlist Filter</p>
            <h3>${escapeHtml(strategy.selection.title)}</h3>
          </div>
        </div>
        <p class="strategy-block-copy">${escapeHtml(strategy.selection.subtitle)}</p>
        <div class="strategy-subgrid">
          <section class="strategy-mini-card">
            <p class="strategy-mini-label">${escapeHtml(strategy.selection.primaryLabel)}</p>
            ${renderStrategyBulletList(strategy.selection.criteria)}
          </section>
          <section class="strategy-mini-card strategy-mini-card--warn">
            <p class="strategy-mini-label">${escapeHtml(strategy.selection.cautionLabel)}</p>
            ${renderStrategyBulletList(strategy.selection.caution)}
          </section>
        </div>
      </article>

      <article class="panel strategy-block strategy-block--entry">
        <div class="strategy-block-head">
          <span class="strategy-section-index">${escapeHtml(strategy.entry.section)}</span>
          <div>
            <p class="eyebrow">Sizing Ladder</p>
            <h3>${escapeHtml(strategy.entry.title)}</h3>
          </div>
        </div>
        <p class="strategy-block-copy">${escapeHtml(strategy.entry.intro)}</p>
        <div class="strategy-step-grid">
          ${strategy.entry.steps.map(renderEntryStepCard).join("")}
        </div>
        <div class="strategy-reserve-card">
          <div>
            <p class="strategy-mini-label">${escapeHtml(strategy.entry.reserve.label)}</p>
            <strong class="strategy-reserve-title">${escapeHtml(strategy.entry.reserve.summary)}</strong>
          </div>
          ${renderStrategyBulletList(strategy.entry.reserve.details, "strategy-bullet-list strategy-bullet-list--compact")}
        </div>
        <section class="strategy-callout">
          <p class="strategy-mini-label">핵심 변경 포인트</p>
          ${renderStrategyBulletList(strategy.entry.keyPoints, "strategy-bullet-list strategy-bullet-list--compact")}
        </section>
      </article>

      <article class="panel strategy-block strategy-block--exit">
        <div class="strategy-block-head">
          <span class="strategy-section-index">${escapeHtml(strategy.exit.section)}</span>
          <div>
            <p class="eyebrow">Profit Taking</p>
            <h3>${escapeHtml(strategy.exit.title)}</h3>
          </div>
        </div>
        <p class="strategy-block-copy">${escapeHtml(strategy.exit.intro)}</p>
        <div class="strategy-step-grid strategy-step-grid--exit">
          ${strategy.exit.steps.map(renderExitStepCard).join("")}
        </div>
        <section class="strategy-callout strategy-callout--subtle">
          <p class="strategy-mini-label">트레일링 운용 메모</p>
          ${renderStrategyBulletList(strategy.exit.trailingNotes, "strategy-bullet-list strategy-bullet-list--compact")}
        </section>
      </article>

      <article class="panel strategy-block strategy-block--stops">
        <div class="strategy-block-head">
          <span class="strategy-section-index">${escapeHtml(strategy.stops.section)}</span>
          <div>
            <p class="eyebrow">Risk Control</p>
            <h3>${escapeHtml(strategy.stops.title)}</h3>
          </div>
        </div>
        <div class="strategy-subgrid strategy-subgrid--stops">
          <section class="strategy-mini-card">
            <p class="strategy-mini-label">${escapeHtml(strategy.stops.priceStop.label)}</p>
            <strong class="strategy-rule-title">${escapeHtml(strategy.stops.priceStop.rule)}</strong>
            ${renderStrategyBulletList(strategy.stops.priceStop.details, "strategy-bullet-list strategy-bullet-list--compact")}
          </section>
          <section class="strategy-mini-card">
            <p class="strategy-mini-label">${escapeHtml(strategy.stops.timeStop.label)}</p>
            <strong class="strategy-rule-title">${escapeHtml(strategy.stops.timeStop.rule)}</strong>
            ${renderStrategyBulletList(strategy.stops.timeStop.details, "strategy-bullet-list strategy-bullet-list--compact")}
          </section>
        </div>
      </article>
    </div>
  `;
}

function renderEntryStepCard(step) {
  return `
    <article class="strategy-step-card">
      <div class="strategy-step-head">
        <strong>${escapeHtml(step.stage)}</strong>
        <span class="strategy-step-chip">${escapeHtml(step.allocation)}</span>
      </div>
      <p class="strategy-step-summary">${escapeHtml(step.summary)}</p>
      ${renderStrategyBulletList(step.conditions, "strategy-bullet-list strategy-bullet-list--compact")}
    </article>
  `;
}

function renderExitStepCard(step) {
  return `
    <article class="strategy-step-card strategy-step-card--exit">
      <div class="strategy-step-head">
        <strong>${escapeHtml(step.stage)}</strong>
        <span class="strategy-step-chip">${escapeHtml(step.trigger)}</span>
      </div>
      <p class="strategy-step-summary">${escapeHtml(step.action)}</p>
      <p class="strategy-step-note">${escapeHtml(step.note)}</p>
    </article>
  `;
}

function renderStrategyBulletList(items = [], className = "strategy-bullet-list") {
  return `
    <ul class="${className}">
      ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
}

function parseTradeDate(value, year) {
  if (typeof value !== "string") {
    return 0;
  }
  const [month, day] = value.split("/").map((segment) => Number(segment));
  if (!month || !day) {
    return 0;
  }
  return new Date(year, month - 1, day).getTime();
}

function formatTimelineDate(value, year) {
  if (typeof value !== "string") {
    return "";
  }
  const [month, day] = value.split("/").map((segment) => Number(segment));
  if (!month || !day) {
    return value;
  }
  return `${year}년 ${month}월 ${day}일`;
}

function buildTimelineSummary(trades) {
  const buyCount = trades.filter((trade) => trade.side === "매수").length;
  const sellCount = trades.length - buyCount;
  return `매수 ${buyCount}건 · 매도 ${sellCount}건`;
}

function buildMonthDayKey(month, day) {
  const normalizedMonth = Number(month);
  const normalizedDay = Number(day);
  if (!normalizedMonth || !normalizedDay) {
    return "";
  }
  return `${normalizedMonth}/${String(normalizedDay).padStart(2, "0")}`;
}

function normalizeMonthDayKey(value) {
  if (typeof value !== "string") {
    return "";
  }
  const [month, day] = value.split("/").map((segment) => Number(segment));
  return buildMonthDayKey(month, day);
}

function normalizeTradeIdentityToken(value = "") {
  return String(value || "").trim().toUpperCase();
}

function buildHoldingTradeDeletionPlan(target = {}) {
  const source = currentPortfolioData || basePortfolioData;
  const trades = source?.trades || {};
  const targetMarket = getMarketLabelFromMetaMarket(String(target.market || "").trim());
  const targetSymbol = normalizeTradeIdentityToken(target.symbol);
  const targetAsset = String(target.asset || target.name || "").trim();
  const targetName = String(target.name || "").trim();

  const matchesHolding = (trade = {}, collection = "stocks") => {
    const tradeMarket = String(trade.market || (collection === "crypto" ? "암호화폐" : "국내주식")).trim();
    if (targetMarket && tradeMarket && tradeMarket !== targetMarket) {
      return false;
    }

    const tradeSymbol = normalizeTradeIdentityToken(trade.symbol);
    if (targetSymbol && tradeSymbol) {
      return tradeSymbol === targetSymbol;
    }

    const tradeAsset = String(trade.asset || "").trim();
    if (tradeAsset && targetAsset) {
      return tradeAsset === targetAsset;
    }

    if (tradeAsset && targetName) {
      return tradeAsset === targetName;
    }

    return false;
  };

  const entries = [];
  ["stocks", "crypto"].forEach((collection) => {
    const list = Array.isArray(trades[collection]) ? trades[collection] : [];
    list.forEach((trade, index) => {
      if (matchesHolding(trade, collection)) {
        entries.push({ collection, index });
      }
    });
  });

  const ordered = [
    ...entries
      .filter((entry) => entry.collection === "stocks")
      .sort((a, b) => b.index - a.index),
    ...entries
      .filter((entry) => entry.collection === "crypto")
      .sort((a, b) => b.index - a.index),
  ];

  return {
    entries: ordered,
    total: ordered.length,
  };
}

async function deleteHoldingPosition(target = {}) {
  const preferenceItem = normalizeHiddenHoldingItemState({
    market: target.market,
    asset: target.asset || target.name,
    symbol: target.symbol,
    updatedAt: new Date().toISOString(),
  });

  if (!preferenceItem) {
    throw new Error("숨길 보유 종목 정보를 찾지 못했습니다.");
  }

  const hiddenItems = getHiddenHoldings();
  const hiddenKey = buildHiddenHoldingStateKey(preferenceItem);
  const alreadyHidden = hiddenItems.some((item) => buildHiddenHoldingStateKey(item) === hiddenKey);
  if (alreadyHidden) {
    return currentPortfolioData;
  }

  queueUiPreferencesMutation(
    {
      ...currentUiPreferences,
      hiddenHoldings: normalizeHiddenHoldingsState([...hiddenItems, preferenceItem]),
    },
    "보유 종목을 보드에서 제외했습니다.",
    {
      rerenderSettings: false,
    }
  );

  return currentPortfolioData;
}

async function restoreHoldingPosition(target = {}) {
  const preferenceItem = normalizeHiddenHoldingItemState({
    market: target.market,
    asset: target.asset || target.name,
    symbol: target.symbol,
  });

  if (!preferenceItem) {
    throw new Error("다시 보일 보유 종목 정보를 찾지 못했습니다.");
  }

  const hiddenKey = buildHiddenHoldingStateKey(preferenceItem);
  const nextHiddenHoldings = getHiddenHoldings().filter((item) => buildHiddenHoldingStateKey(item) !== hiddenKey);

  queueUiPreferencesMutation(
    {
      ...currentUiPreferences,
      hiddenHoldings: nextHiddenHoldings,
    },
    "보유 종목을 다시 표시했습니다.",
    {
      rerenderSettings: false,
    }
  );

  return currentPortfolioData;
}

async function deleteTimelineTrade(trade) {
  const selectorPayload = buildTradeMutationSelectorPayload(trade);
  if (!selectorPayload) {
    throw new Error("삭제할 거래 정보를 찾지 못했습니다.");
  }

  await applyTradeMutation("DELETE", selectorPayload);
}

async function toggleTimelineTradeDefenseReference(trade, mode = "apply", referencePrice = 0) {
  const selectorPayload = buildTradeMutationSelectorPayload(trade);
  if (!selectorPayload) {
    throw new Error("수정할 거래 정보를 찾지 못했습니다.");
  }

  if (trade.side !== "매도" || trade.market !== "암호화폐" || !isXrpTradeLike(trade)) {
    throw new Error("XRP 매도 거래에서만 사용할 수 있습니다.");
  }

  if (mode === "clear") {
    await applyTradeMutation("PUT", {
      ...selectorPayload,
      trade: buildTimelineTradePatch(trade, {
        realizedPnlOverride: null,
        realizedReturnRateOverride: null,
        realizedReferencePrice: null,
      }),
    });
    return;
  }

  const normalizedReferencePrice = normalizeTimelineMoney(referencePrice);
  const outcome = computeXrpDefenseOverrideOutcome(trade, {
    referencePrice: normalizedReferencePrice,
    applicableQuantity: Number(trade?.xrpDefenseApplicableQuantity || 0),
    standardAveragePrice: Number(trade?.xrpDefenseStandardAveragePrice || 0),
    defenseLotItems: trade?.xrpDefenseLotItems,
  });
  if (!(normalizedReferencePrice > 0) || !outcome) {
    throw new Error("최근 매수 10건 평균 기준가를 계산한 뒤 다시 시도해주세요.");
  }

  await applyTradeMutation("PUT", {
    ...selectorPayload,
    trade: buildTimelineTradePatch(trade, {
      realizedPnlOverride: outcome.pnl,
      realizedReturnRateOverride: outcome.returnRate,
      realizedReferencePrice: normalizedReferencePrice,
    }),
  });
}

function bindHoldingsSection(section) {
  if (!section || section.dataset.holdingsBound === "true") {
    return;
  }

  section.addEventListener("click", async (event) => {
    const restoreButton = event.target.closest("[data-holding-restore-market]");
    if (restoreButton && section.contains(restoreButton)) {
      const target = {
        market: restoreButton.dataset.holdingRestoreMarket || "",
        symbol: restoreButton.dataset.holdingRestoreSymbol || "",
        asset: restoreButton.dataset.holdingRestoreAsset || "",
      };

      const displayName = getDisplayAssetName({
        asset: target.asset,
        symbol: target.symbol,
        market: target.market,
      });

      try {
        await restoreHoldingPosition(target);
        showAppToast(`${displayName} 보유 카드를 다시 표시합니다.`, "success", {
          title: "보유 다시 보기",
        });
      } catch (error) {
        showAppToast(error.message || "보유 종목을 다시 표시하지 못했습니다.", "error", {
          title: "복원 실패",
        });
      }
      return;
    }

    const button = event.target.closest("[data-holding-hide]");
    if (!button || !section.contains(button)) {
      return;
    }

    const target = {
      market: button.dataset.holdingMarket || "",
      symbol: button.dataset.holdingSymbol || "",
      asset: button.dataset.holdingAsset || "",
      name: button.dataset.holdingName || "",
    };

    const displayName = getDisplayAssetName({
      asset: target.asset,
      name: target.name,
      symbol: target.symbol,
      market: target.market,
    });
    try {
      await deleteHoldingPosition(target);
      showAppToast(`${displayName} 거래 기록은 그대로 두고 보유 카드에서만 제외했습니다.`, "success", {
        title: "보유 제외",
      });
    } catch (error) {
      showAppToast(
        error.message || `${displayName} 보유를 숨기지 못했습니다.`,
        "error",
        { title: "보유 제외 실패" }
      );
    }
  });

  section.dataset.holdingsBound = "true";
}

function bindTimelineSection(section) {
  if (!section || section.dataset.timelineBound === "true") {
    return;
  }

  section.addEventListener("click", async (event) => {
    const defenseButton = event.target.closest("[data-trade-defense-toggle]");
    if (defenseButton && section.contains(defenseButton)) {
      const key = `${defenseButton.dataset.tradeCollection}:${defenseButton.dataset.tradeIndex}`;
      const trade = timelineTradeRegistry.get(key);
      if (!trade) {
        showAppToast("기준가를 적용할 거래를 찾지 못했습니다.", "error", { title: "적용 실패" });
        return;
      }

      const mode = defenseButton.dataset.tradeDefenseToggle === "clear" ? "clear" : "apply";
      const referencePrice = Number(defenseButton.dataset.tradeDefenseReferencePrice || 0);
      const preview = computeXrpDefenseOverrideOutcome(trade, {
        referencePrice,
        applicableQuantity: Number(trade?.xrpDefenseApplicableQuantity || 0),
        standardAveragePrice: Number(trade?.xrpDefenseStandardAveragePrice || 0),
        defenseLotItems: trade?.xrpDefenseLotItems,
      });

      const confirmed = await showAppConfirm({
        eyebrow: "XRP Defense",
        title: mode === "clear" ? "방어 기준가 적용을 해제할까요?" : "방어 기준가를 적용할까요?",
        message:
          mode === "clear"
            ? "해제하면 기존 평균단가 기준 손익으로 다시 계산됩니다."
            : `${trade?.xrpDefenseRecentBuyAverage > 0 ? `최근 매수 평균 ${formatCurrency(trade.xrpDefenseRecentBuyAverage)}\n` : ""}${Number.isFinite(Number(trade?.xrpDefenseGapRate)) ? `실제 괴리율 ${formatXrpDefenseGapLabel(trade.xrpDefenseGapRate)}\n` : ""}${Array.isArray(trade?.xrpDefenseLotItems) && trade.xrpDefenseLotItems.length ? `방어손익은 최신 방어 매수부터 차감\n` : ""}${
                preview?.defenseQuantity > 0 ? `방어 적용 ${formatTradeQuantity(preview.defenseQuantity)}\n` : ""
              }${
                preview?.standardQuantity > 0 && preview?.standardAveragePrice > 0
                  ? `일반 기준 ${formatTradeQuantity(preview.standardQuantity)} · ${formatCurrency(preview.standardAveragePrice)}\n`
                  : ""
              }기준가 ${formatCurrency(referencePrice)}\n예상 실현손익 ${preview ? formatSignedCurrency(preview.pnl) : "계산 대기"}`,
        confirmText: mode === "clear" ? "해제" : "적용",
        cancelText: "취소",
        tone: mode === "clear" ? "danger" : "accent",
      });
      if (!confirmed) {
        return;
      }

      try {
        defenseButton.disabled = true;
        await toggleTimelineTradeDefenseReference(trade, mode, referencePrice);
        showAppToast(
          mode === "clear"
            ? "XRP 방어 기준가 적용을 해제했습니다."
            : `XRP 방어 기준가 ${formatCurrency(referencePrice)}를 반영했습니다.`,
          "success",
          { title: mode === "clear" ? "기준가 해제" : "기준가 적용" }
        );
      } catch (error) {
        console.error(error);
        showAppToast(error.message || "XRP 방어 기준가 적용에 실패했습니다.", "error", {
          title: "적용 실패",
        });
      } finally {
        if (defenseButton.isConnected) {
          defenseButton.disabled = false;
        }
      }
      return;
    }

    const editButton = event.target.closest("[data-trade-edit]");
    if (editButton && section.contains(editButton)) {
      if (!canManagePortfolioMutations()) {
        showAppToast("거래 수정은 owner 모드에서만 사용할 수 있습니다.", "error", { title: "수정 불가" });
        return;
      }
      const key = `${editButton.dataset.tradeCollection}:${editButton.dataset.tradeIndex}`;
      const trade = timelineTradeRegistry.get(key);
      if (trade) {
        finalizeMobileModalLaunch("timeline-section");
        tradeModalController?.openEdit?.(trade);
      }
      return;
    }

    const deleteButton = event.target.closest("[data-trade-delete]");
    if (deleteButton && section.contains(deleteButton)) {
      if (!canManagePortfolioMutations()) {
        showAppToast("거래 삭제는 owner 모드에서만 사용할 수 있습니다.", "error", { title: "삭제 불가" });
        return;
      }
      const key = `${deleteButton.dataset.tradeCollection}:${deleteButton.dataset.tradeIndex}`;
      const trade = timelineTradeRegistry.get(key);
      if (!trade) {
        return;
      }

      const confirmed = await showAppConfirm({
        eyebrow: "Trade Delete",
        title: "거래를 삭제할까요?",
        message: `거래내역에서 제거합니다.\n대상: ${getDisplayAssetName({
          asset: trade.asset,
          symbol: trade.symbol,
          market: getMarketLabelFromMetaMarket(trade.market),
        })}`,
        confirmText: "삭제",
        cancelText: "취소",
        tone: "danger",
      });
      if (!confirmed) {
        return;
      }

      try {
        deleteButton.disabled = true;
        await deleteTimelineTrade(trade);
      } catch (error) {
        console.error(error);
        showAppToast(error.message || "거래 삭제에 실패했습니다.", "error", { title: "삭제 실패" });
      } finally {
        if (deleteButton.isConnected) {
          deleteButton.disabled = false;
        }
      }
      return;
    }

    const toggle = event.target.closest(".timeline-toggle");
    if (toggle && section.contains(toggle)) {
      const group = toggle.closest(".timeline-group");
      const panel = group?.querySelector(".timeline-panel");
      const willOpen = toggle.getAttribute("aria-expanded") !== "true";
      toggleDisclosure(group, toggle, panel, willOpen);
      return;
    }

    const monthToggle = event.target.closest(".timeline-month-toggle");
    if (!monthToggle || !section.contains(monthToggle)) {
      return;
    }

    const monthBlock = monthToggle.closest(".timeline-month-block");
    const monthPanel = monthBlock?.querySelector(".timeline-month-panel");
    const willOpen = monthToggle.getAttribute("aria-expanded") !== "true";
    toggleDisclosure(monthBlock, monthToggle, monthPanel, willOpen);
  });

  section.dataset.timelineBound = "true";
}

function closeAssetChartModal() {
  window.AssetChartShell?.closeAssetChartModal?.();
}

async function openAssetChartModal(options = {}) {
  return window.AssetChartShell?.openAssetChartModal?.(options);
}

function bindPriceStripInteractions() {
  window.AssetChartShell?.bindPriceStripInteractions?.();
}

function initializeMotion() {
  const mobileMotion = isMobileSectionMode();
  const revealDistance = mobileMotion ? "18px" : "24px";
  const revealDuration = mobileMotion ? "420ms" : "560ms";
  const selector = mobileMotion
    ? ".reveal, .section, .mobile-hub-button, .price-sector"
    : ".reveal, .metric-card, .panel, .chart-card, .holding-card, .legend-item, .realized-item, .defense-card, .timeline-group, .rule-card, .note-card, .price-sector, .mobile-hub-button";
  const nodes = [...document.querySelectorAll(selector)];

  const uniqueNodes = [...new Set(nodes)];
  if (motionObserver) {
    motionObserver.disconnect();
    motionObserver = null;
  }

  uniqueNodes.forEach((node, index) => {
    node.classList.add("scroll-reveal");
    node.style.setProperty("--reveal-delay", `${Math.min(index % 8, 7) * 60}ms`);
    node.style.setProperty("--reveal-distance", revealDistance);
    node.style.setProperty("--reveal-duration", revealDuration);
  });

  if (mobileMotion) {
    uniqueNodes.forEach((node) => node.classList.add("is-visible"));
    return;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    uniqueNodes.forEach((node) => node.classList.add("is-visible"));
    return;
  }

  motionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        motionObserver?.unobserve(entry.target);
      });
    },
    {
      threshold: 0.18,
      rootMargin: "0px 0px -8% 0px",
    }
  );

  uniqueNodes.forEach((node) => motionObserver?.observe(node));
}

function buildLiveState(liveSnapshot) {
  if (window.location.protocol === "file:") {
    return {
      available: false,
      updatedAt: null,
      refreshIntervalSeconds: 10,
      cryptoRefreshIntervalSeconds: 10,
      marketRefreshIntervalSeconds: 60,
      quotes: {},
      fx: {
        usdkrw: null,
      },
      indices: {
        korea: [],
        us: [],
      },
      status: {
        level: "neutral",
        message: "로컬 파일 모드 · 실시간 시세 비활성화",
      },
      errors: [],
      warnings: [],
    };
  }

  if (!liveSnapshot) {
    return {
      available: false,
      updatedAt: null,
      refreshIntervalSeconds: 10,
      cryptoRefreshIntervalSeconds: 10,
      marketRefreshIntervalSeconds: 60,
      quotes: {},
      fx: {
        usdkrw: null,
      },
      indices: {
        korea: [],
        us: [],
      },
      status: {
        level: "neutral",
        message: "실시간 가격 연결 준비 중",
      },
      errors: [],
      warnings: [],
    };
  }

  return {
    available: Boolean(
      liveSnapshot.portfolioLive || Object.keys(liveSnapshot.quotes || {}).length
    ),
    updatedAt: liveSnapshot.live?.updatedAt || liveSnapshot.updatedAt || null,
    clientRefreshedAt: liveSnapshot.live?.clientRefreshedAt || null,
    refreshIntervalSeconds: liveSnapshot.live?.refreshIntervalSeconds || 10,
    cryptoRefreshIntervalSeconds: liveSnapshot.live?.cryptoRefreshIntervalSeconds || 10,
    marketRefreshIntervalSeconds: liveSnapshot.live?.marketRefreshIntervalSeconds || 60,
    quotes: liveSnapshot.quotes || {},
    fx: liveSnapshot.fx || { usdkrw: null },
    indices: liveSnapshot.indices || { korea: [], us: [] },
    status: liveSnapshot.live?.status || {
      level: "neutral",
      message: "실시간 가격 연결 준비 중",
    },
    errors: Array.isArray(liveSnapshot.live?.errors) ? liveSnapshot.live.errors : [],
    warnings: Array.isArray(liveSnapshot.live?.warnings) ? liveSnapshot.live.warnings : [],
  };
}

function decorateFailedLiveSnapshot(liveSnapshot, errorMessage = "") {
  const fallbackMessage = errorMessage || "실시간 가격 연결이 지연되고 있습니다.";
  if (!liveSnapshot) {
    return {
      updatedAt: null,
      quotes: {},
      fx: {
        usdkrw: null,
        source: "fallback",
        updatedAt: null,
        isDelayed: true,
      },
      indices: {
        korea: [],
        us: [],
      },
      portfolioLive: null,
      live: {
        updatedAt: null,
        refreshIntervalSeconds: 10,
        cryptoRefreshIntervalSeconds: 10,
        marketRefreshIntervalSeconds: 60,
        status: {
          level: "warning",
          message: fallbackMessage,
        },
        errors: [fallbackMessage],
        warnings: [],
      },
    };
  }

  const next = structuredClone(liveSnapshot);
  next.live = next.live || {};
  next.live.status = {
    level: "warning",
    message: next.portfolioLive ? "일부 종목 업데이트 지연 · 마지막 값 유지 중" : fallbackMessage,
  };
  next.live.errors = [...new Set([...(next.live.errors || []), fallbackMessage])];
  next.live.refreshIntervalSeconds = next.live.refreshIntervalSeconds || 10;
  next.live.cryptoRefreshIntervalSeconds = next.live.cryptoRefreshIntervalSeconds || 10;
  next.live.marketRefreshIntervalSeconds = next.live.marketRefreshIntervalSeconds || 60;
  next.quotes = Object.fromEntries(
    Object.entries(next.quotes || {}).map(([key, quote]) => [
      key,
      {
        ...quote,
        isDelayed: true,
      },
    ])
  );
  if (next.fx) {
    next.fx = {
      ...next.fx,
      isDelayed: true,
    };
  }
  return next;
}

function buildHeroSummary(live) {
  if (isEmptyBoardVariant() && !hasMeaningfulBoardContent()) {
    return "아직 비어 있는 보드입니다. 관심종목, 거래, 메모부터 차례대로 채우면 아래 메뉴가 자동으로 정리됩니다.";
  }

  const cryptoRefresh = live?.cryptoRefreshIntervalSeconds || live?.refreshIntervalSeconds || 10;
  const marketRefresh = live?.marketRefreshIntervalSeconds || 60;
  const usMarketRefreshCopy =
    marketRefresh >= 24 * 60 * 60
      ? "미국주식 미국장 시작 이후 정규장에만 갱신"
      : `미국주식 미국장 시작 이후 정규장 ${formatNumber(marketRefresh)}초`;
  const krMarketRefreshCopy =
    marketRefresh >= 24 * 60 * 60 ? "국내주식 국내장에만 갱신" : `국내주식 국내장 ${formatNumber(marketRefresh)}초`;
  const refreshCopy = `코인 ${formatNumber(cryptoRefresh)}초 · ${usMarketRefreshCopy} · ${krMarketRefreshCopy} · 환율 일 1회`;

  if (window.location.protocol === "file:") {
    return `실시간 가격은 서버 모드에서만 동작합니다. \`node scripts/dev-server.js\` 로 실행하면 ${refreshCopy}로 갱신됩니다.`;
  }

  const statusMessage = live?.status?.message || "실시간 가격 연결 준비 중";
  const timestamp = buildLiveTimestampCopy(live);
  return `${statusMessage} · ${timestamp} · ${refreshCopy}`;
}

function normalizeHoldingsForDisplay(holdings = []) {
  return holdings.map((item) => {
    const quantity = Number(item.quantity || 0);
    const valuation = Number(item.valuation || 0);
    const averagePrice = Number(item.averagePrice || 0);
    const principal = quantity * averagePrice;
    const pnl = Number.isFinite(Number(item.pnl)) ? Number(item.pnl) : valuation - principal;
    const fallbackPriceKrw = quantity > 0 ? valuation / quantity : averagePrice;
    const hasExplicitCurrentPriceKrw =
      Number.isFinite(Number(item.currentPriceKrw)) || Number.isFinite(Number(item.liveQuote?.priceKrw));
    const hasExplicitCurrentPriceUsd =
      Number.isFinite(Number(item.currentPriceUsd)) || Number.isFinite(Number(item.liveQuote?.priceUsd));
    const hasExplicitCurrentPrice =
      Number.isFinite(Number(item.currentPrice)) || hasExplicitCurrentPriceKrw || hasExplicitCurrentPriceUsd;
    const liveQuoteAvailable = Boolean(item.liveQuote?.available) || hasExplicitCurrentPrice;
    const resolvedMarket = item.market || (item.platform === "업비트" ? "crypto" : "kr-stock");
    const resolvedCurrency = item.currency || (item.market === "us-stock" ? "USD" : "KRW");
    const currentPriceKrw = Number.isFinite(Number(item.currentPriceKrw))
      ? Number(item.currentPriceKrw)
      : Number.isFinite(Number(item.liveQuote?.priceKrw))
        ? Number(item.liveQuote.priceKrw)
        : fallbackPriceKrw;
    const currentPriceUsd = Number.isFinite(Number(item.currentPriceUsd))
      ? Number(item.currentPriceUsd)
      : Number.isFinite(Number(item.liveQuote?.priceUsd))
        ? Number(item.liveQuote.priceUsd)
        : null;

    return {
      ...item,
      name: item.name || item.asset,
      symbol: item.symbol || "",
      market: resolvedMarket,
      currency: resolvedCurrency,
      priceSource: item.priceSource || "",
      quantity,
      averagePrice,
      valuation,
      pnl,
      returnRate: Number(item.returnRate || 0),
      currentPriceKrw,
      currentPriceUsd,
      currentPrice: resolvedCurrency === "USD" && Number.isFinite(currentPriceUsd) ? currentPriceUsd : currentPriceKrw,
      liveQuote: {
        name: item.name || item.asset,
        symbol: item.symbol || "",
        market: resolvedMarket,
        available: liveQuoteAvailable,
        price:
          liveQuoteAvailable && resolvedCurrency === "USD" && Number.isFinite(currentPriceUsd)
            ? currentPriceUsd
            : liveQuoteAvailable && currentPriceKrw > 0
              ? currentPriceKrw
              : null,
        priceKrw: liveQuoteAvailable && hasExplicitCurrentPriceKrw ? currentPriceKrw : null,
        priceUsd: liveQuoteAvailable && hasExplicitCurrentPriceUsd && Number.isFinite(currentPriceUsd) ? currentPriceUsd : null,
        changePercent: Number.isFinite(Number(item.liveQuote?.changePercent)) ? Number(item.liveQuote.changePercent) : null,
        kimchiPremiumPercent: Number.isFinite(Number(item.liveQuote?.kimchiPremiumPercent))
          ? Number(item.liveQuote.kimchiPremiumPercent)
          : null,
        globalPriceKrw: Number.isFinite(Number(item.liveQuote?.globalPriceKrw)) ? Number(item.liveQuote.globalPriceKrw) : null,
        globalPriceUsd: Number.isFinite(Number(item.liveQuote?.globalPriceUsd)) ? Number(item.liveQuote.globalPriceUsd) : null,
        globalUpdatedAt: item.liveQuote?.globalUpdatedAt || null,
        isMarketOpen: item.liveQuote?.isMarketOpen ?? null,
        isDelayed: item.liveQuote ? Boolean(item.liveQuote.isDelayed) : !liveQuoteAvailable,
        updatedAt: item.liveQuote?.updatedAt || null,
        error:
          item.liveQuote?.error ||
          (!liveQuoteAvailable && isLivePriceTrackableMarket(resolvedMarket) ? "실시간 연결 준비 중" : null),
      },
    };
  });
}

function normalizeTargetsForDisplay(targets = {}) {
  const groups = Array.isArray(targets.groups) ? targets.groups : [];
  return {
    ...targets,
    groups: groups.map((group) => {
      const normalizedItems = (Array.isArray(group.items) ? group.items : []).map((item) => {
        const base = typeof item === "string" ? { name: item } : item;
        const market = base.market || "";
        const currency = base.currency || (market === "us-stock" ? "USD" : "KRW");
        return {
          ...base,
          name: base.name || "",
          symbol: base.symbol || "",
          market,
          currency,
          priceSource: base.priceSource || "",
          liveQuote: base.liveQuote || null,
        };
      });

      return {
        ...group,
        tone: normalizeTargetTone(group.tone || normalizedItems[0]?.market),
        items: normalizedItems,
      };
    }),
  };
}

function normalizeStrategyBudgetsForDisplay(strategyBudgets = {}) {
  const items = Array.isArray(strategyBudgets?.items) ? strategyBudgets.items : [];
  return {
    items: items.reduce((accumulator, item) => {
      const market = resolveStrategyMarketKey(item.market || "");
      const symbol = normalizeStrategySymbol(item.symbol || "", market);
      const asset = String(item.asset || "").trim();
      const budget = Number(item.budget || 0);

      if (!(budget > 0) || (!symbol && !asset)) {
        return accumulator;
      }

      accumulator.push({
        market,
        symbol,
        asset,
        budget,
        updatedAt: item.updatedAt || "",
      });
      return accumulator;
    }, []),
  };
}

function renderTargetListItem(item = {}, tone = "neutral", fx = {}) {
  const quote = item.liveQuote || null;
  const movementClass = getQuoteToneClass(quote);
  const marketLabel = getMarketLabelFromMetaMarket(item.market);
  return `
    <li class="targets-list-item">
      <div class="targets-item-head">
        <div class="targets-item-copy">
          <span class="targets-item-name">${escapeHtml(getDisplayAssetName(item))}</span>
          <span class="targets-item-note">${escapeHtml(buildTargetMeta(item))}</span>
        </div>
      </div>
      <div class="targets-item-foot">
        <div class="targets-item-price">
          <strong class="${movementClass}">${escapeHtml(formatTargetPricePrimary(quote, item, fx))}</strong>
          <span class="price-secondary">${renderQuoteSecondaryMarkup(quote, item, {
            includeKimchiPremium: item.market === "crypto",
            includeKrwForUsStock: false,
          })}</span>
        </div>
        <button
          type="button"
          class="targets-item-remove"
          data-target-remove
          data-target-market="${escapeHtml(marketLabel)}"
          data-target-symbol="${escapeHtml(item.symbol || "")}"
          data-target-name="${escapeHtml(item.name || "")}"
        >
          삭제
        </button>
      </div>
    </li>
  `;
}

function collectTrackedQuoteItems(holdings = [], targets = {}) {
  const registry = new Map();
  const priorityRank = {
    "KRW-BTC": 0,
    비트코인: 0,
    BTC: 0,
    "KRW-ETH": 1,
    ETH: 1,
    "KRW-XRP": 2,
    XRP: 2,
  };
  const scopeRank = {
    holding: 0,
    target: 1,
  };
  const marketRank = {
    crypto: 0,
    "us-stock": 1,
    "kr-stock": 2,
  };

  holdings
    .filter((item) => Number(item.quantity || 0) > 0)
    .forEach((item) => {
      const key = item.symbol || item.name || item.asset;
      if (!key) {
        return;
      }

      registry.set(key, {
        scope: "holding",
        trackedByHolding: true,
        trackedByTarget: false,
        name: item.name || item.asset,
        symbol: item.symbol || "",
        market: item.market || "",
        quantity: Number(item.quantity || 0),
        liveQuote: item.liveQuote || null,
      });
    });

  (targets.groups || []).forEach((group) => {
    (group.items || []).forEach((item) => {
      const key = item.symbol || item.name;
      if (!key) {
        return;
      }

      const hasDisplayName = String(item.name || "").trim().length > 0;
      const hasSymbol = String(item.symbol || "").trim().length > 0;
      if (!hasDisplayName && !hasSymbol) {
        return;
      }

      if (registry.has(key)) {
        const existing = registry.get(key);
        registry.set(key, {
          ...existing,
          trackedByTarget: true,
        });
        return;
      }

      registry.set(key, {
        scope: "target",
        trackedByHolding: false,
        trackedByTarget: true,
        name: item.name,
        symbol: item.symbol || "",
        market: item.market || "",
        quantity: 0,
        liveQuote: item.liveQuote || null,
      });
    });
  });

  return [...registry.values()].sort((left, right) => {
    const leftPriority = priorityRank[left.symbol] ?? priorityRank[left.name] ?? 99;
    const rightPriority = priorityRank[right.symbol] ?? priorityRank[right.name] ?? 99;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const leftScope = scopeRank[left.scope] ?? 99;
    const rightScope = scopeRank[right.scope] ?? 99;
    if (leftScope !== rightScope) {
      return leftScope - rightScope;
    }

    const leftMarket = marketRank[left.market] ?? 99;
    const rightMarket = marketRank[right.market] ?? 99;
    if (leftMarket !== rightMarket) {
      return leftMarket - rightMarket;
    }

    return String(left.name).localeCompare(String(right.name), "ko-KR");
  });
}

function resolveInstrumentQuoteFromMap(instrument = {}, quotes = {}) {
  if (instrument?.liveQuote) {
    return instrument.liveQuote;
  }

  if (!quotes || typeof quotes !== "object") {
    return null;
  }

  const nameCandidates = [instrument.name, instrument.asset]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  for (const candidate of nameCandidates) {
    if (quotes[candidate]) {
      return quotes[candidate];
    }
  }

  const normalizedSymbol = String(instrument.symbol || "").trim().toUpperCase();
  if (!normalizedSymbol) {
    return null;
  }

  return (
    Object.values(quotes).find(
      (quote) => String(quote?.symbol || "").trim().toUpperCase() === normalizedSymbol
    ) || null
  );
}

function buildInstrumentMeta(instrument, quote) {
  const scopeCopy = buildMarketLabel(instrument.market);
  const isClosedQuote =
    ["us-stock", "kr-stock"].includes(String(instrument?.market || "")) &&
    quote?.available &&
    quote?.isMarketOpen === false;
  const statusCopy = isClosedQuote ? "장 마감 종가" : quote?.isDelayed ? "업데이트 지연" : null;

  return [instrument.symbol || scopeCopy, statusCopy || scopeCopy].filter(Boolean).join(" · ");
}

function getDisplayQuoteForPriceStrip(instrument = {}, quote = null) {
  return quote;
}

function toFiniteNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
}

function formatLivePricePrimary(quote, instrument = {}, fx = {}) {
  if (!quote?.available) {
    return "연결 대기";
  }

  const krwValue = toFiniteNumber(quote.priceKrw);
  const globalUsdValue = toFiniteNumber(quote.globalPriceUsd);
  const fxRate = toFiniteNumber(fx.usdkrw);
  const usdValue =
    instrument.market === "us-stock"
      ? toFiniteNumber(quote.priceUsd)
      : globalUsdValue != null
        ? globalUsdValue
        : krwValue != null && fxRate != null && fxRate > 0
          ? krwValue / fxRate
          : null;

  if (krwValue != null && usdValue != null) {
    return `${formatCurrency(krwValue)} / ${formatUsd(usdValue)}`;
  }

  return formatQuotePrimary(quote, instrument);
}

function formatTargetPricePrimary(quote, instrument = {}, fx = {}) {
  if (!quote?.available) {
    return "연결 대기";
  }

  const krwValue = toFiniteNumber(quote.priceKrw);
  const globalUsdValue = toFiniteNumber(quote.globalPriceUsd);
  const fxRate = toFiniteNumber(fx.usdkrw);
  const usdValue =
    instrument.market === "us-stock"
      ? toFiniteNumber(quote.priceUsd)
      : globalUsdValue != null
        ? globalUsdValue
        : krwValue != null && fxRate != null && fxRate > 0
          ? krwValue / fxRate
          : null;

  if (instrument.market === "us-stock" && usdValue != null && krwValue != null) {
    return `${formatUsd(usdValue)} / ${formatCurrency(krwValue)}`;
  }

  return formatLivePricePrimary(quote, instrument, fx);
}

function buildTargetMeta(item) {
  return [item.symbol, buildMarketLabel(item.market)].filter(Boolean).join(" · ") || "실시간 연결 준비 중";
}

function buildLiveTimestampCopy(live) {
  const refreshedAt = live?.clientRefreshedAt || live?.updatedAt || null;
  if (!refreshedAt) {
    return "마지막 갱신 대기 중";
  }

  return `마지막 갱신 ${formatDateTime(refreshedAt)}`;
}

function buildHoldingQuoteMarkup(quote, item) {
  const movementClass = getQuoteToneClass(quote);
  const primaryText =
    item?.market === "us-stock" ? formatTargetPricePrimary(quote, item) : formatQuotePrimary(quote, item);
  const secondaryText = formatQuoteSecondary(quote, item, {
    includeKrwForUsStock: false,
  });
  return `
    <span class="mini-value-stack">
      <strong class="mini-value ${movementClass}">${escapeHtml(primaryText)}</strong>
      <span class="mini-subvalue ${movementClass}">${escapeHtml(secondaryText)}</span>
    </span>
  `;
}

function buildTableQuoteMarkup(quote, item) {
  const movementClass = getQuoteToneClass(quote);
  const primaryText =
    item?.market === "us-stock" ? formatTargetPricePrimary(quote, item) : formatQuotePrimary(quote, item);
  const secondaryText = formatQuoteSecondary(quote, item, {
    includeKrwForUsStock: false,
  });
  return `
    <div class="table-price-stack">
      <strong class="table-price-primary ${movementClass}">${escapeHtml(primaryText)}</strong>
      <span class="table-price-secondary ${movementClass}">${escapeHtml(secondaryText)}</span>
    </div>
  `;
}

function buildTableFallbackMarkup() {
  return `
    <div class="table-price-stack">
      <strong class="table-price-primary">-</strong>
      <span class="table-price-secondary">실시간 대상 아님</span>
    </div>
  `;
}

function resolveQuoteChangeDisplay(quote = null) {
  const changePercent = toFiniteNumber(quote?.changePercent);
  if (changePercent == null) {
    return {
      text: "실시간 대기",
      toneClass: "warning",
    };
  }

  return {
    text: formatSignedPercent(changePercent),
    toneClass: toneClass(changePercent),
  };
}

function buildMarketLabel(market) {
  if (market === "crypto") {
    return "암호화폐";
  }
  if (market === "us-stock") {
    return "해외주식";
  }
  if (market === "kr-stock") {
    return "국내주식";
  }
  return "관심 종목";
}

function isLivePriceTrackableMarket(market = "") {
  const normalized = String(market || "").trim().toLowerCase();
  return normalized === "crypto" || normalized === "us-stock" || normalized === "kr-stock";
}

function resolveHoldingLiveStatus(holding = {}, quote = null) {
  if (!isLivePriceTrackableMarket(holding.market)) {
    return {
      label: "실시간 미지원",
      warning: false,
    };
  }

  if (!quote?.available) {
    return {
      label: quote?.error || "업데이트 대기",
      warning: true,
    };
  }

  if (quote.isDelayed) {
    return {
      label: "업데이트 지연",
      warning: true,
    };
  }

  if ((holding.market === "us-stock" || holding.market === "kr-stock") && quote.isMarketOpen === false) {
    return {
      label: "장 마감 종가",
      warning: false,
    };
  }

  return {
    label: "실시간",
    warning: false,
  };
}

function resolveLiveQuoteWaitingCopy(instrument = {}, quote = null) {
  if (!isLivePriceTrackableMarket(instrument.market)) {
    return "실시간 미지원";
  }

  return quote?.error || "업데이트 대기";
}

function getQuoteToneClass(quote) {
  if (!quote?.available || !Number.isFinite(Number(quote.changePercent))) {
    return "price-move-neutral";
  }

  if (Number(quote.changePercent) > 0) {
    return "price-move-up";
  }

  if (Number(quote.changePercent) < 0) {
    return "price-move-down";
  }

  return "price-move-neutral";
}

function formatQuotePrimary(quote, instrument = {}) {
  if (!quote?.available) {
    return isLivePriceTrackableMarket(instrument.market) ? "연결 대기" : "실시간 미지원";
  }

  if (instrument.market === "us-stock" && Number.isFinite(Number(quote.priceUsd))) {
    return formatUsd(Number(quote.priceUsd));
  }

  if (Number.isFinite(Number(quote.priceKrw))) {
    return formatCurrency(Number(quote.priceKrw));
  }

  if (Number.isFinite(Number(quote.price))) {
    return instrument.currency === "USD" ? formatUsd(Number(quote.price)) : formatCurrency(Number(quote.price));
  }

  return "가격 없음";
}

function formatQuoteSecondaryParts(quote, instrument = {}, options = {}) {
  if (!quote?.available) {
    return [{ text: resolveLiveQuoteWaitingCopy(instrument, quote), tone: "price-move-neutral" }];
  }

  const parts = [];
  const includeKimchiPremium = Boolean(options.includeKimchiPremium && instrument.market === "crypto");
  const includeKrwForUsStock = options.includeKrwForUsStock !== false;

  if (instrument.market === "us-stock" && includeKrwForUsStock) {
    const priceKrw = toFiniteNumber(quote.priceKrw);
    if (priceKrw != null) {
      parts.push({ text: `원화 ${formatCurrency(priceKrw)}`, tone: "price-move-neutral" });
    }
  }

  const kimchiPremium = toFiniteNumber(quote.kimchiPremiumPercent);
  if (includeKimchiPremium && kimchiPremium != null) {
    parts.push({
      text: `김프 ${formatSignedPercent(kimchiPremium)}`,
      tone: getSignedPriceToneClass(kimchiPremium),
    });
  }

  const changePercent = toFiniteNumber(quote.changePercent);
  if (changePercent != null) {
    parts.push({
      text: formatSignedPercent(changePercent),
      tone: getSignedPriceToneClass(changePercent),
    });
  }

  if (!parts.length && instrument.scope === "holding") {
    parts.push({ text: `보유 ${formatNumber(instrument.quantity || 0)}`, tone: "price-move-neutral" });
  }

  if (!parts.length) {
    parts.push({
      text: quote.isDelayed ? "업데이트 지연" : buildMarketLabel(instrument.market),
      tone: "price-move-neutral",
    });
  }

  return parts;
}

function renderQuoteSecondaryMarkup(quote, instrument = {}, options = {}) {
  return formatQuoteSecondaryParts(quote, instrument, options)
    .map((part, index) => {
      const separator = index === 0 ? "" : '<span class="price-secondary-separator"> · </span>';
      return `${separator}<span class="price-secondary-fragment ${part.tone}">${escapeHtml(part.text)}</span>`;
    })
    .join("");
}

function formatQuoteSecondary(quote, instrument = {}, options = {}) {
  return formatQuoteSecondaryParts(quote, instrument, options)
    .map((part) => part.text)
    .join(" · ");
}

function text(selector, value) {
  const element = document.querySelector(selector);
  setTextContentIfChanged(element, value ?? "");
}

function setTextContentIfChanged(element, value) {
  if (!element) {
    return false;
  }
  const nextValue = value ?? "";
  if (element.textContent === nextValue) {
    return false;
  }
  element.textContent = nextValue;
  return true;
}

function setInnerHtmlIfChanged(element, markup) {
  if (!element) {
    return false;
  }
  const nextMarkup = markup ?? "";
  if (element.innerHTML === nextMarkup) {
    return false;
  }
  element.innerHTML = nextMarkup;
  return true;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function tableCell(label, value, className = "", options = {}) {
  const normalizedClass = className.trim();
  const classAttribute = normalizedClass ? ` class="${normalizedClass}"` : "";
  const safeLabel = escapeHtml(label);
  const safeValue = options.allowHtml ? String(value ?? "") : escapeHtml(value);
  return `<td data-label="${safeLabel}"${classAttribute}>${safeValue}</td>`;
}

function formatCurrency(value) {
  return currencyFormatter.format(value || 0);
}

function formatUsd(value) {
  return usdFormatter.format(value || 0);
}

function formatSignedUsd(value) {
  const amount = Number(value || 0);
  if (amount > 0) {
    return `+${formatUsd(amount)}`;
  }
  return formatUsd(amount);
}

function formatSignedCurrency(value, forceNeutral = false) {
  const amount = value || 0;
  if (forceNeutral) {
    return formatCurrency(amount);
  }
  if (amount > 0) {
    return `+${formatCurrency(amount)}`;
  }
  return formatCurrency(amount);
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatSignedPercent(value) {
  const numeric = Number(value || 0);
  if (numeric > 0) {
    return `+${formatPercent(numeric)}`;
  }
  return formatPercent(numeric);
}

function formatNumber(value) {
  return numberFormatter.format(value || 0);
}

function isBitcoinHolding(item = {}) {
  const normalizedSymbol = String(item?.symbol || "").trim().toUpperCase();
  if (normalizedSymbol === "KRW-BTC") {
    return true;
  }

  const names = [item?.name, item?.asset]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");

  return names.includes("비트코인") || /\bBTC\b/i.test(names);
}

function formatHoldingQuantity(item = {}) {
  const quantity = Number(item?.quantity || 0);
  if (!Number.isFinite(quantity)) {
    return formatNumber(0);
  }

  if (isBitcoinHolding(item)) {
    return preciseCryptoQuantityFormatter.format(quantity);
  }

  return formatNumber(quantity);
}

function formatCompactNumber(value) {
  return compactNumberFormatter.format(value || 0);
}

function formatCompactCurrency(value) {
  return `${formatCompactNumber(value)}원`;
}

function formatShortDecimal(value) {
  return shortDecimalFormatter.format(value || 0);
}

function formatUsStockTaxAllowanceProgress(value = 0, allowance = US_STOCK_TAX_ALLOWANCE) {
  const current = Math.round((Number(value || 0) / 10000) * 10) / 10;
  const limit = Math.round((Number(allowance || 0) / 10000) * 10) / 10;
  return `${formatShortDecimal(current)}만원 / ${formatShortDecimal(limit)}만원`;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "시간 정보 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function renderCurrentDateBadge(now = new Date()) {
  const badge = document.querySelector("#basis-date");
  if (!badge) {
    return;
  }

  const krLabel = formatCurrentDateLabel(now);
  const usLabel = formatUsEasternTimeLabel(now);
  const markup = `
    <span class="basis-date-main">${escapeHtml(krLabel)}</span>
    <span class="basis-date-us">${escapeHtml(usLabel)}</span>
  `;
  setInnerHtmlIfChanged(badge, markup);
}

function scheduleCurrentDateBadgeRefresh() {
  renderCurrentDateBadge();

  if (currentDateBadgeTimer) {
    window.clearTimeout(currentDateBadgeTimer);
  }

  const now = new Date();
  const nextRefreshAt = new Date(now);
  nextRefreshAt.setSeconds(1, 0);
  nextRefreshAt.setMinutes(now.getMinutes() + 1);
  currentDateBadgeTimer = window.setTimeout(scheduleCurrentDateBadgeRefresh, nextRefreshAt.getTime() - now.getTime());
}

function formatCurrentDateLabel(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const weekday = weekdays[date.getDay()] || "";
  return `${year}.${month}.${day} (${weekday})`;
}

function formatUsEasternTimeLabel(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = dateParts.find((part) => part.type === "year")?.value || "";
  const month = dateParts.find((part) => part.type === "month")?.value || "";
  const day = dateParts.find((part) => part.type === "day")?.value || "";

  const weekday = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(date);
  const time = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  let offsetLabel = "UTC-5";
  let dstApplied = false;

  try {
    const offsetPart = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      timeZoneName: "shortOffset",
    }).formatToParts(date);
    const offsetName = offsetPart.find((part) => part.type === "timeZoneName")?.value || "";
    const offsetMatch = offsetName.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/i);

    if (offsetMatch) {
      const offsetHours = Number(offsetMatch[1] || 0);
      const offsetMinutes = Number(offsetMatch[2] || 0);
      const sign = offsetHours >= 0 ? "+" : "-";
      const absHours = Math.abs(offsetHours);
      const minuteLabel = offsetMinutes ? `:${String(offsetMinutes).padStart(2, "0")}` : "";
      offsetLabel = `UTC${sign}${absHours}${minuteLabel}`;
      dstApplied = offsetHours === -4;
    } else {
      const tzNamePart = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        timeZoneName: "short",
      }).formatToParts(date);
      const tzName = tzNamePart.find((part) => part.type === "timeZoneName")?.value || "";
      dstApplied = /EDT/i.test(tzName);
      offsetLabel = dstApplied ? "UTC-4" : "UTC-5";
    }
  } catch (error) {
    // Older browsers can reject `shortOffset`; fall back to the coarse ET/EST distinction.
    const tzNamePart = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      timeZoneName: "short",
    }).formatToParts(date);
    const tzName = tzNamePart.find((part) => part.type === "timeZoneName")?.value || "";
    dstApplied = /EDT/i.test(tzName);
    offsetLabel = dstApplied ? "UTC-4" : "UTC-5";
  }

  const dstCopy = dstApplied ? "서머타임 적용" : "서머타임 미적용";
  return `미국 동부 ${year}.${month}.${day} (${weekday}) ${time} · ${dstCopy} (${offsetLabel})`;
}

function formatPerformanceStartLabel(value) {
  const match = String(value || "")
    .trim()
    .match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);

  if (!match) {
    return "";
  }

  return `${Number(match[2])}/${String(Number(match[3])).padStart(2, "0")}`;
}

function parsePerformanceStartDateValue(value) {
  const match = String(value || "")
    .trim()
    .match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);

  if (!match) {
    return null;
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatCurrentMonthDay(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getMonth() + 1}/${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateInputValue(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthDayToDateInputValue(value, year = getCurrentBasisYear()) {
  if (typeof value !== "string") {
    return formatDateInputValue();
  }

  const [month, day] = value.split("/").map((segment) => Number(segment));
  if (!month || !day) {
    return formatDateInputValue();
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDateInputToMonthDay(value) {
  const raw = String(value || "").trim();
  let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    match = raw.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (!match) {
      return formatCurrentMonthDay();
    }

    return `${Number(match[1])}/${String(Number(match[2])).padStart(2, "0")}`;
  }

  return `${Number(match[2])}/${match[3]}`;
}

function getCurrentBasisYear(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
}

function getSignedPriceToneClass(value) {
  const numeric = Number(value || 0);
  if (numeric > 0) {
    return "price-move-up";
  }
  if (numeric < 0) {
    return "price-move-down";
  }
  return "price-move-neutral";
}

function toneClass(value) {
  if (value > 0) {
    return "gain";
  }
  if (value < 0) {
    return "loss";
  }
  return "neutral";
}

function alpha(hex, opacity) {
  const normalized = hex.replace("#", "").trim();
  const fullHex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  const bigint = Number.parseInt(fullHex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// 거래 추가 모달 관리는 별도 파일에서 로드합니다.
function initTradeModal() {
  if (typeof window.AssetInitTradeModal !== "function") {
    console.error("거래 모달 초기화 함수를 찾지 못했습니다");
    return;
  }
  window.AssetInitTradeModal();
}
