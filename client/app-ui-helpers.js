(function initAssetBoardUiHelpers() {
  const assetBoardConfig = window.AssetBoardConfig;

  if (!assetBoardConfig) {
    throw new Error("AssetBoardConfig is missing. Load client/app-config.js before client/app-ui-helpers.js.");
  }

  const {
    EMPTY_BOARD_VARIANT,
    SETTINGS_SECTION_ID,
    DEFAULT_LIVE_PRICE_PREFERENCES,
    BOARD_DEFAULT_CONFIG,
    MOBILE_SECTION_SHORTCUTS,
    MAX_TRADE_QUICK_ASSETS,
    EMPTY_BOARD_SHORTCUT_SUMMARIES,
  } = assetBoardConfig;

  function normalizeAutocompleteToken(value = "") {
    return String(value || "")
      .toLowerCase()
      .replace(/[\s.,/#!$%^&*;:{}=\-_`~()]/g, "");
  }

  function getBoardVariant(boardConfig = null) {
    return String(boardConfig?.variant || BOARD_DEFAULT_CONFIG.variant).trim() || BOARD_DEFAULT_CONFIG.variant;
  }

  function getToggleableSectionOptions(variant = BOARD_DEFAULT_CONFIG.variant) {
    const normalizedVariant = String(variant || BOARD_DEFAULT_CONFIG.variant).trim() || BOARD_DEFAULT_CONFIG.variant;
    const isBlankFamily = normalizedVariant === EMPTY_BOARD_VARIANT;
    return MOBILE_SECTION_SHORTCUTS
      .filter((item) => item.id !== SETTINGS_SECTION_ID && item.id !== "strategy-section")
      .filter((item) => isBlankFamily || item.id !== "guide-section")
      .map((item) => ({
        id: item.id,
        title: item.title,
        eyebrow: item.eyebrow,
      }));
  }

  function isEmptyBoardVariant(variant = BOARD_DEFAULT_CONFIG.variant) {
    return getBoardVariant({ variant }) === EMPTY_BOARD_VARIANT;
  }

  function getTargetGroups(targets = {}) {
    return Array.isArray(targets?.groups) ? targets.groups : [];
  }

  function countTargetItems(targets = {}) {
    return getTargetGroups(targets).reduce((total, group) => {
      const items = Array.isArray(group?.items) ? group.items.filter(Boolean) : [];
      return total + items.length;
    }, 0);
  }

  function hasMeaningfulBoardContent(data = {}, notes = []) {
    if (!data) {
      return false;
    }

    const tradeCount =
      (Array.isArray(data?.trades?.stocks) ? data.trades.stocks.length : 0) +
      (Array.isArray(data?.trades?.crypto) ? data.trades.crypto.length : 0);
    const holdingsCount = Array.isArray(data?.holdings) ? data.holdings.length : 0;
    const notesCount = Array.isArray(notes) ? notes.length : 0;
    const targetCount = countTargetItems(data?.targets || {});
    const totalAssets = Number(data?.summary?.totalAssets || 0);

    return tradeCount > 0 || holdingsCount > 0 || notesCount > 0 || targetCount > 0 || totalAssets > 0;
  }

  function getShortcutSummary(item = {}, variant = BOARD_DEFAULT_CONFIG.variant) {
    if (isEmptyBoardVariant(variant)) {
      return EMPTY_BOARD_SHORTCUT_SUMMARIES[item.id] || item.summary || "";
    }

    return item.summary || "";
  }

  function shouldShowGuideByDefault(variant = BOARD_DEFAULT_CONFIG.variant, data = {}, notes = []) {
    return isEmptyBoardVariant(variant) && !hasMeaningfulBoardContent(data, notes);
  }

  function getDefaultVisibleSectionIds(variant = BOARD_DEFAULT_CONFIG.variant, data = {}, notes = []) {
    if (variant === EMPTY_BOARD_VARIANT) {
      const visibleSections = [
        "targets-section",
        "portfolio-overview-section",
        "timeline-section",
        "notes-section",
        "holdings-section",
      ];

      if (shouldShowGuideByDefault(variant, data, notes)) {
        visibleSections.unshift("guide-section");
      }

      return visibleSections;
    }

    return getToggleableSectionOptions(variant).map((item) => item.id);
  }

  function normalizeVisibleSectionIds(visibleSections, variant = BOARD_DEFAULT_CONFIG.variant, data = {}, notes = []) {
    const validIds = new Set(getToggleableSectionOptions(variant).map((item) => item.id));
    if (!Array.isArray(visibleSections)) {
      return getDefaultVisibleSectionIds(variant, data, notes);
    }
    const requested = visibleSections.map((item) => String(item || "").trim()).filter((item) => validIds.has(item));
    return [...new Set(requested)];
  }

  function normalizeLivePricePreferencesState(livePrice = {}) {
    return {
      showGlobalIndices: livePrice?.showGlobalIndices !== false,
    };
  }

  function normalizeTradeQuickAssetItemState(item = {}) {
    const market = String(item?.market || "").trim();
    if (!["국내주식", "미국주식", "암호화폐"].includes(market)) {
      return null;
    }

    const asset = String(item?.asset || item?.name || "").trim();
    const rawSymbol = String(item?.symbol || "").trim();
    let symbol = rawSymbol;

    if (market === "미국주식") {
      const upper = rawSymbol.toUpperCase();
      symbol = /^[A-Z.-]{1,15}$/.test(upper) ? upper : "";
    } else if (market === "국내주식") {
      symbol = /^[0-9]{6}$/.test(rawSymbol) ? rawSymbol : "";
    } else if (market === "암호화폐") {
      const ticker = rawSymbol.toUpperCase().replace(/^KRW-/, "");
      symbol = /^[A-Z0-9]{2,15}$/.test(ticker) ? `KRW-${ticker}` : "";
    }

    if (!asset && !symbol) {
      return null;
    }

    return {
      market,
      asset: asset || symbol.replace(/^KRW-/, ""),
      symbol,
      updatedAt: String(item?.updatedAt || item?.addedAt || "").trim(),
    };
  }

  function buildTradeQuickAssetStateKey(item = {}) {
    const safeItem = item && typeof item === "object" ? item : {};
    return `${String(safeItem.market || "").trim()}:${String(safeItem.symbol || "").trim() || normalizeAutocompleteToken(safeItem.asset || "")}`;
  }

  function normalizeTradeQuickAssetsState(items = []) {
    if (!Array.isArray(items)) {
      return [];
    }

    const registry = new Map();
    items.forEach((item) => {
      const normalized = normalizeTradeQuickAssetItemState(item);
      if (!normalized) {
        return;
      }
      const key = buildTradeQuickAssetStateKey(normalized);
      if (!key) {
        return;
      }
      if (registry.has(key)) {
        registry.delete(key);
      }
      registry.set(key, normalized);
    });

    return Array.from(registry.values()).slice(-MAX_TRADE_QUICK_ASSETS);
  }

  function normalizeHiddenHoldingItemState(item = {}) {
    return normalizeTradeQuickAssetItemState(item);
  }

  function buildHiddenHoldingStateKey(item = {}) {
    return buildTradeQuickAssetStateKey(item);
  }

  function normalizeHiddenHoldingsState(items = []) {
    if (!Array.isArray(items)) {
      return [];
    }

    const registry = new Map();
    items.forEach((item) => {
      const normalized = normalizeHiddenHoldingItemState(item);
      if (!normalized) {
        return;
      }
      const key = buildHiddenHoldingStateKey(normalized);
      if (!key) {
        return;
      }
      if (registry.has(key)) {
        registry.delete(key);
      }
      registry.set(key, normalized);
    });

    return Array.from(registry.values());
  }

  function buildHoldingPreferenceItem(holding = {}) {
    return normalizeHiddenHoldingItemState({
      market: holding?.market,
      asset: holding?.asset || holding?.name,
      symbol: holding?.symbol,
      updatedAt: holding?.updatedAt,
    });
  }

  function filterHiddenHoldingsToActiveItems(hiddenHoldings = [], data = {}) {
    const normalizedHiddenHoldings = normalizeHiddenHoldingsState(hiddenHoldings);
    if (!Array.isArray(data?.holdings)) {
      return normalizedHiddenHoldings;
    }

    const activeHoldingKeys = new Set(
      data.holdings
        .filter((item) => Number(item?.quantity || 0) > 0)
        .map((item) => buildHiddenHoldingStateKey(buildHoldingPreferenceItem(item)))
        .filter(Boolean)
    );

    return normalizedHiddenHoldings.filter((item) => activeHoldingKeys.has(buildHiddenHoldingStateKey(item)));
  }

  function normalizeUiPreferencesState(uiPreferences = {}, variant = BOARD_DEFAULT_CONFIG.variant, data = {}, notes = []) {
    const updatedAt = String(uiPreferences?.updatedAt || "").trim();
    let visibleSections = normalizeVisibleSectionIds(uiPreferences?.visibleSections, variant, data, notes);

    if (
      variant === EMPTY_BOARD_VARIANT &&
      shouldShowGuideByDefault(variant, data, notes) &&
      !updatedAt &&
      !visibleSections.includes("guide-section")
    ) {
      visibleSections = ["guide-section", ...visibleSections];
    }

    return {
      visibleSections,
      livePrice: normalizeLivePricePreferencesState(uiPreferences?.livePrice),
      tradeQuickAssets: normalizeTradeQuickAssetsState(uiPreferences?.tradeQuickAssets),
      hiddenHoldings: filterHiddenHoldingsToActiveItems(uiPreferences?.hiddenHoldings, data),
      updatedAt,
    };
  }

  function normalizeBoardConfigState(board = null) {
    const variant = String(board?.variant || BOARD_DEFAULT_CONFIG.variant).trim() || BOARD_DEFAULT_CONFIG.variant;
    return {
      variant,
      heroEyebrow: String(board?.heroEyebrow || BOARD_DEFAULT_CONFIG.heroEyebrow).trim() || BOARD_DEFAULT_CONFIG.heroEyebrow,
      heroTitle: String(board?.heroTitle || BOARD_DEFAULT_CONFIG.heroTitle).trim() || BOARD_DEFAULT_CONFIG.heroTitle,
      browserTitle: String(board?.browserTitle || BOARD_DEFAULT_CONFIG.browserTitle).trim() || BOARD_DEFAULT_CONFIG.browserTitle,
    };
  }

  window.AssetBoardUiHelpers = Object.freeze({
    getBoardVariant,
    getToggleableSectionOptions,
    isEmptyBoardVariant,
    getTargetGroups,
    countTargetItems,
    hasMeaningfulBoardContent,
    getShortcutSummary,
    shouldShowGuideByDefault,
    getDefaultVisibleSectionIds,
    normalizeVisibleSectionIds,
    normalizeLivePricePreferencesState,
    normalizeAutocompleteToken,
    normalizeTradeQuickAssetItemState,
    buildTradeQuickAssetStateKey,
    normalizeTradeQuickAssetsState,
    normalizeHiddenHoldingItemState,
    buildHiddenHoldingStateKey,
    normalizeHiddenHoldingsState,
    buildHoldingPreferenceItem,
    filterHiddenHoldingsToActiveItems,
    normalizeUiPreferencesState,
    normalizeBoardConfigState,
  });
})();
