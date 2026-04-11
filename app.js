const currencyFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 2,
});

const compactNumberFormatter = new Intl.NumberFormat("ko-KR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NOTES_STORAGE_KEY = "sniper-capital-notes-v1";
const US_STOCK_TAX_ALLOWANCE = 2_500_000;
const US_STOCK_TAX_RATE = 0.22;
const ASSET_AUTOCOMPLETE_SEEDS = Object.freeze({
  암호화폐: [
    {
      value: "비트코인(BTC)",
      title: "비트코인(BTC)",
      meta: "업비트 KRW 마켓",
      symbol: "KRW-BTC",
      aliases: ["비트", "비트코인", "btc"],
    },
    {
      value: "이더리움(ETH)",
      title: "이더리움(ETH)",
      meta: "업비트 KRW 마켓",
      symbol: "KRW-ETH",
      aliases: ["이더", "이더리움", "eth"],
    },
    {
      value: "엑스알피(리플) (XRP)",
      title: "엑스알피(리플) (XRP)",
      meta: "업비트 KRW 마켓",
      symbol: "KRW-XRP",
      aliases: ["엑스알피", "리플", "xrp"],
    },
    {
      value: "솔라나(SOL)",
      title: "솔라나(SOL)",
      meta: "업비트 KRW 마켓",
      symbol: "KRW-SOL",
      aliases: ["솔", "솔라", "솔라나", "sol"],
    },
    {
      value: "도지코인(DOGE)",
      title: "도지코인(DOGE)",
      meta: "업비트 KRW 마켓",
      symbol: "KRW-DOGE",
      aliases: ["도지", "도지코인", "doge"],
    },
    {
      value: "에이다(ADA)",
      title: "에이다(ADA)",
      meta: "업비트 KRW 마켓",
      symbol: "KRW-ADA",
      aliases: ["에이다", "ada"],
    },
    {
      value: "수이(SUI)",
      title: "수이(SUI)",
      meta: "업비트 KRW 마켓",
      symbol: "KRW-SUI",
      aliases: ["수이", "sui"],
    },
    {
      value: "아발란체(AVAX)",
      title: "아발란체(AVAX)",
      meta: "업비트 KRW 마켓",
      symbol: "KRW-AVAX",
      aliases: ["아발란체", "avax"],
    },
  ],
  미국주식: [
    {
      value: "Palantir Technologies Inc. (PLTR)",
      title: "Palantir Technologies Inc. (PLTR)",
      meta: "미국주식 티커",
      symbol: "PLTR",
      aliases: ["팔란티어", "palantir", "pltr"],
    },
    {
      value: "Circle Internet Group, Inc. (CRCL)",
      title: "Circle Internet Group, Inc. (CRCL)",
      meta: "미국주식 티커",
      symbol: "CRCL",
      aliases: ["써클", "circle", "crcl"],
    },
    {
      value: "Apple Inc. (AAPL)",
      title: "Apple Inc. (AAPL)",
      meta: "미국주식 티커",
      symbol: "AAPL",
      aliases: ["애플", "apple", "aapl"],
    },
    {
      value: "NVIDIA Corporation (NVDA)",
      title: "NVIDIA Corporation (NVDA)",
      meta: "미국주식 티커",
      symbol: "NVDA",
      aliases: ["엔비디아", "nvidia", "nvda"],
    },
    {
      value: "Tesla, Inc. (TSLA)",
      title: "Tesla, Inc. (TSLA)",
      meta: "미국주식 티커",
      symbol: "TSLA",
      aliases: ["테슬라", "tesla", "tsla"],
    },
    {
      value: "Microsoft Corporation (MSFT)",
      title: "Microsoft Corporation (MSFT)",
      meta: "미국주식 티커",
      symbol: "MSFT",
      aliases: ["마이크로소프트", "microsoft", "msft"],
    },
    {
      value: "Amazon.com, Inc. (AMZN)",
      title: "Amazon.com, Inc. (AMZN)",
      meta: "미국주식 티커",
      symbol: "AMZN",
      aliases: ["아마존", "amazon", "amzn"],
    },
    {
      value: "Meta Platforms, Inc. (META)",
      title: "Meta Platforms, Inc. (META)",
      meta: "미국주식 티커",
      symbol: "META",
      aliases: ["메타", "meta", "meta platforms"],
    },
    {
      value: "Alphabet Inc. Class A (GOOGL)",
      title: "Alphabet Inc. Class A (GOOGL)",
      meta: "미국주식 티커",
      symbol: "GOOGL",
      aliases: ["알파벳", "구글", "google", "alphabet", "googl"],
    },
    {
      value: "Alphabet Inc. Class C (GOOG)",
      title: "Alphabet Inc. Class C (GOOG)",
      meta: "미국주식 티커",
      symbol: "GOOG",
      aliases: ["알파벳c", "구글c", "google", "alphabet", "goog"],
    },
    {
      value: "Advanced Micro Devices, Inc. (AMD)",
      title: "Advanced Micro Devices, Inc. (AMD)",
      meta: "미국주식 티커",
      symbol: "AMD",
      aliases: ["amd", "에이엠디", "어드밴스드마이크로디바이시스"],
    },
    {
      value: "Broadcom Inc. (AVGO)",
      title: "Broadcom Inc. (AVGO)",
      meta: "미국주식 티커",
      symbol: "AVGO",
      aliases: ["브로드컴", "broadcom", "avgo"],
    },
    {
      value: "Coinbase Global, Inc. (COIN)",
      title: "Coinbase Global, Inc. (COIN)",
      meta: "미국주식 티커",
      symbol: "COIN",
      aliases: ["코인베이스", "coinbase", "coin"],
    },
    {
      value: "Netflix, Inc. (NFLX)",
      title: "Netflix, Inc. (NFLX)",
      meta: "미국주식 티커",
      symbol: "NFLX",
      aliases: ["넷플릭스", "netflix", "nflx"],
    },
    {
      value: "Snowflake Inc. (SNOW)",
      title: "Snowflake Inc. (SNOW)",
      meta: "미국주식 티커",
      symbol: "SNOW",
      aliases: ["스노우플레이크", "스노우", "snowflake", "snow"],
    },
    {
      value: "Oracle Corporation (ORCL)",
      title: "Oracle Corporation (ORCL)",
      meta: "미국주식 티커",
      symbol: "ORCL",
      aliases: ["오라클", "oracle", "orcl"],
    },
    {
      value: "Uber Technologies, Inc. (UBER)",
      title: "Uber Technologies, Inc. (UBER)",
      meta: "미국주식 티커",
      symbol: "UBER",
      aliases: ["우버", "uber"],
    },
    {
      value: "Adobe Inc. (ADBE)",
      title: "Adobe Inc. (ADBE)",
      meta: "미국주식 티커",
      symbol: "ADBE",
      aliases: ["어도비", "adobe", "adbe"],
    },
    {
      value: "Salesforce, Inc. (CRM)",
      title: "Salesforce, Inc. (CRM)",
      meta: "미국주식 티커",
      symbol: "CRM",
      aliases: ["세일즈포스", "salesforce", "crm"],
    },
    {
      value: "Taiwan Semiconductor Manufacturing Company Limited (TSM)",
      title: "Taiwan Semiconductor Manufacturing Company Limited (TSM)",
      meta: "미국주식 티커",
      symbol: "TSM",
      aliases: ["tsmc", "tsm", "대만tsmc", "대만반도체"],
    },
    {
      value: "Arm Holdings plc American Depositary Shares (ARM)",
      title: "Arm Holdings plc American Depositary Shares (ARM)",
      meta: "미국주식 티커",
      symbol: "ARM",
      aliases: ["암홀딩스", "암", "arm"],
    },
    {
      value: "Palo Alto Networks, Inc. (PANW)",
      title: "Palo Alto Networks, Inc. (PANW)",
      meta: "미국주식 티커",
      symbol: "PANW",
      aliases: ["팔로알토", "palo alto", "panw"],
    },
    {
      value: "CrowdStrike Holdings, Inc. (CRWD)",
      title: "CrowdStrike Holdings, Inc. (CRWD)",
      meta: "미국주식 티커",
      symbol: "CRWD",
      aliases: ["크라우드스트라이크", "crowdstrike", "crwd"],
    },
    {
      value: "Robinhood Markets, Inc. (HOOD)",
      title: "Robinhood Markets, Inc. (HOOD)",
      meta: "미국주식 티커",
      symbol: "HOOD",
      aliases: ["로빈후드", "robinhood", "hood"],
    },
    {
      value: "SoFi Technologies, Inc. (SOFI)",
      title: "SoFi Technologies, Inc. (SOFI)",
      meta: "미국주식 티커",
      symbol: "SOFI",
      aliases: ["소파이", "sofi"],
    },
  ],
  국내주식: [
    {
      value: "삼성전자(005930)",
      title: "삼성전자(005930)",
      meta: "국내주식 종목코드",
      symbol: "005930",
      aliases: ["삼성", "삼전", "삼성전자", "005930"],
    },
    {
      value: "SK하이닉스(000660)",
      title: "SK하이닉스(000660)",
      meta: "국내주식 종목코드",
      symbol: "000660",
      aliases: ["하이닉스", "sk하이닉스", "에스케이하이닉스", "000660"],
    },
    {
      value: "NAVER(035420)",
      title: "NAVER(035420)",
      meta: "국내주식 종목코드",
      symbol: "035420",
      aliases: ["네이버", "naver", "035420"],
    },
    {
      value: "카카오(035720)",
      title: "카카오(035720)",
      meta: "국내주식 종목코드",
      symbol: "035720",
      aliases: ["카카오", "035720"],
    },
  ],
});
const colors = ["#17F9A6", "#5EC8FF", "#FFB84D", "#FF6B87"];
let chartRegistry = [];
let assetDetailChart = null;
let assetChartRefreshTimer = null;
let currentPortfolioData = null;
let basePortfolioData = null;
let livePortfolioSnapshot = null;
let liveRefreshTimer = null;
let currentDateBadgeTimer = null;
let lastPortfolioLoadSource = "unknown";
let notesState = [];
let noteEditorState = {
  editingId: null,
};
let tradeModalController = null;
let timelineTradeRegistry = new Map();
let hasLoadedNotes = false;
let hasBootedDashboard = false;
let activeAccessCode = "";
let activeAccessMode = "owner";
let deferredMobileDashboardData = null;
let deferredMobileSectionTimers = new Map();
let deferredMobileSectionsRendered = new Set();
let motionObserver = null;
let mobileSectionState = {
  section: null,
  sectionId: "",
  placeholder: null,
  originalParent: null,
};
let mobileSectionScrollTop = 0;
let pendingMobileSectionRestoreId = "";
let interactionLockUntil = 0;
let assetChartState = {
  market: "",
  symbol: "",
  name: "",
  range: "1M",
  granularity: "day",
};

const ASSET_CHART_RANGES = Object.freeze({
  day: Object.freeze([
    { key: "1W", label: "1주" },
    { key: "1M", label: "1개월" },
    { key: "1Y", label: "1년" },
  ]),
  minute: Object.freeze([
    { key: "1D", label: "1일" },
    { key: "1W", label: "1주" },
    { key: "1M", label: "1개월" },
  ]),
});

const ASSET_CHART_GRANULARITIES = Object.freeze([
  { key: "day", label: "일봉" },
  { key: "minute", label: "분봉" },
]);

function getAssetChartRanges(granularity = "day") {
  return ASSET_CHART_RANGES[granularity === "minute" ? "minute" : "day"];
}

function getDefaultAssetChartRange(granularity = "day") {
  return getAssetChartRanges(granularity)[0]?.key || "1M";
}

const MOBILE_SECTION_SHORTCUTS = Object.freeze([
  { id: "targets-section", eyebrow: "Watchlist", title: "관심종목", icon: "◎", summary: "지금 보는 후보 종목" },
  { id: "portfolio-overview-section", eyebrow: "Portfolio Mix", title: "자산 분포", icon: "◔", summary: "비중과 현금 흐름" },
  { id: "timeline-section", eyebrow: "Trade Log", title: "거래 타임라인", icon: "↗", summary: "매수·매도 기록 확인" },
  { id: "notes-section", eyebrow: "Memo Board", title: "메모", icon: "✎", summary: "투자 아이디어 정리" },
  { id: "holdings-section", eyebrow: "Positions", title: "보유 종목", icon: "◫", summary: "현재 보유 상세 보기" },
  { id: "performance-section", eyebrow: "Realized PnL", title: "실현손익 추이", icon: "∿", summary: "누적 손익 흐름 확인" },
  { id: "insights-section", eyebrow: "Defense", title: "XRP 방어지표", icon: "◇", summary: "방어 매매 기준 점검" },
  { id: "strategy-section", eyebrow: "Playbook", title: "플레이 전략", icon: "▣", summary: "매매 원칙 다시 보기" },
]);

const MOBILE_DEFERRED_SECTION_DELAYS = Object.freeze({
  "holdings-section": 90,
  "performance-section": 160,
  "timeline-section": 240,
  "strategy-section": 320,
});

const TRADE_STRATEGY_STAGE_OPTIONS = Object.freeze([
  { value: "관망", label: "관망", tone: "watch" },
  { value: "정찰병", label: "정찰병", tone: "scout" },
  { value: "1차 진입", label: "1차 진입", tone: "entry" },
  { value: "2차 진입", label: "2차 진입", tone: "entry" },
  { value: "3차 진입", label: "3차 진입", tone: "entry" },
  { value: "1단계 익절", label: "1단계 익절", tone: "exit" },
  { value: "2단계 익절", label: "2단계 익절", tone: "exit" },
  { value: "3단계 추적", label: "3단계 추적", tone: "exit" },
  { value: "가격 손절", label: "가격 손절", tone: "stop" },
  { value: "시간 손절", label: "시간 손절", tone: "stop" },
]);

function normalizeTradeStrategyStage(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveTradeStrategyTone(stage = "") {
  const normalized = normalizeTradeStrategyStage(stage);
  return TRADE_STRATEGY_STAGE_OPTIONS.find((item) => item.value === normalized)?.tone || "neutral";
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

function normalizeAutocompleteToken(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s.,/#!$%^&*;:{}=\-_`~()]/g, "");
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

function formatAssetInputValue(item = {}, marketLabel = getMarketLabelFromMetaMarket(item.market)) {
  const symbol = String(item.symbol || "").trim();
  const rawName = String(item.name || item.asset || "").trim();
  const normalizedName = rawName || symbol.replace(/^KRW-/, "");

  if (marketLabel === "암호화폐") {
    const ticker = symbol.replace(/^KRW-/, "").trim().toUpperCase();
    return ticker ? `${normalizedName}(${ticker})` : normalizedName;
  }

  if (marketLabel === "미국주식") {
    return symbol ? `${normalizedName} (${symbol.toUpperCase()})` : normalizedName;
  }

  if (marketLabel === "국내주식") {
    return symbol ? `${normalizedName}(${symbol})` : normalizedName;
  }

  return normalizedName;
}

function buildDynamicAutocompleteEntry(item = {}) {
  const market = getMarketLabelFromMetaMarket(item.market);
  if (!["암호화폐", "미국주식", "국내주식"].includes(market)) {
    return null;
  }

  const value = formatAssetInputValue(item, market);
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
    symbol: String(item.symbol || "").trim(),
    aliases: [
      String(item.name || "").trim(),
      String(item.asset || "").trim(),
      String(item.symbol || "").trim(),
      getDisplayAssetName(item),
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
    source.holdings.forEach((item) => addEntry(getMarketLabelFromMetaMarket(item.market), buildDynamicAutocompleteEntry(item)));
  }
  if (source?.targets?.groups) {
    source.targets.groups.forEach((group) => {
      (group.items || []).forEach((item) =>
        addEntry(getMarketLabelFromMetaMarket(item.market), buildDynamicAutocompleteEntry(item))
      );
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
  const isDisabledMarket = () => disabledMarketSet.has(String(marketSelect.value || "").trim());

  const hidePanel = () => {
    panel.hidden = true;
    panel.innerHTML = "";
    currentSuggestions = [];
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

async function fetchJsonWithTimeout(input, options = {}, timeoutMs = 3500) {
  const response = await fetchWithTimeout(input, options, timeoutMs);
  if (!response.ok) {
    throw new Error(`Failed to load JSON: ${response.status}`);
  }
  return response.json();
}

async function fetchJsonWithAccessTimeout(input, options = {}, timeoutMs = 3500) {
  const response = await fetchWithAccessTimeout(input, options, timeoutMs);
  if (!response.ok) {
    throw new Error(`Failed to load JSON: ${response.status}`);
  }
  return response.json();
}

function bootDashboard() {
  if (hasBootedDashboard) {
    return;
  }

  hasBootedDashboard = true;
  syncViewportHeight();
  syncResponsiveShellMode();
  scheduleCurrentDateBadgeRefresh();
  ensureNotesLoaded();
  initNotesBoard();
  renderNotes(notesState);
  hydrateNotesFromServer();
  initTargetManager();
  initTargetRemovalActions();
  bindAllPanelAccordions();
  bindMobileSectionOverlay();
  loadPortfolio()
    .then(async (data) => {
      applyPortfolioData(data, livePortfolioSnapshot, { renderMode: "full" });
      initTradeModal();
      if (lastPortfolioLoadSource !== "api") {
        await syncPortfolioBaseData();
      }
      await refreshLivePortfolio();
      scheduleLivePortfolioRefresh();
    })
    .catch((error) => {
      console.error(error);
      document.body.innerHTML = `
        <main style="padding: 32px; font-family: 'Avenir Next', sans-serif;">
          <h1>데이터를 불러오지 못했습니다.</h1>
          <p><code>python3 scripts/export_workbook.py</code> 실행 후 다시 확인하세요.</p>
        </main>
      `;
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
  const { focusInput = false, clearInput = true } = options;
  const gate = document.querySelector("#access-gate");
  const input = document.querySelector("#access-gate-code");

  activeAccessCode = "";
  activeAccessMode = "owner";

  if (liveRefreshTimer) {
    window.clearInterval(liveRefreshTimer);
    liveRefreshTimer = null;
  }

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

  syncViewportHeight();
  relockAccessGate();

  if (!gate || !form || !input) {
    bootDashboard();
    return;
  }

  setAccessGateStatus("접속 코드를 입력해주세요.");

  const submitAccessCode = async (submittedCode) => {
    if (isSubmittingCode) {
      return;
    }

    isSubmittingCode = true;
    setAccessGateStatus("코드를 확인하는 중입니다.");

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
      setAccessGateStatus(
        activeAccessMode === "owner" ? "확인되었습니다. 내 보드를 여는 중입니다." : "확인되었습니다. 비어 있는 보드를 여는 중입니다.",
        "success"
      );
      unlockAccessGate();
      if (hasBootedDashboard) {
        refreshLivePortfolio();
        scheduleLivePortfolioRefresh();
      } else {
        bootDashboard();
      }
    } catch (error) {
      setAccessGateStatus(error.message || "코드가 맞지 않습니다. 다시 확인해주세요.", "error");
      isSubmittingCode = false;
      input.focus();
      input.select();
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submittedCode = String(input.value || "").trim();
    await submitAccessCode(submittedCode);
  });

  window.setTimeout(() => {
    input.focus();
  }, 60);

  window.addEventListener("pagehide", () => {
    relockAccessGate({ focusInput: false, clearInput: true });
  });

  window.addEventListener("pageshow", () => {
    relockAccessGate({ focusInput: true, clearInput: true });
  });
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
    "./data/portfolio.json",
    {
      cache: "no-store",
    },
    timeoutMs
  );
}

async function loadPortfolio() {
  if (window.__PORTFOLIO_DATA__) {
    lastPortfolioLoadSource = "memory";
    return window.__PORTFOLIO_DATA__;
  }

  if (window.location.protocol !== "file:") {
    try {
      const apiData = await fetchPortfolioFromApi(4500);
      lastPortfolioLoadSource = "api";
      return apiData;
    } catch (error) {
      console.error(error);
    }
  }

  try {
    const staticData = await fetchPortfolioFromStaticFile(2000);
    lastPortfolioLoadSource = "static";
    return staticData;
  } catch (error) {
    console.error(error);
    throw new Error("Failed to load portfolio data.");
  }
}

function isMobileSectionMode() {
  const isSmallViewport = window.matchMedia("(max-width: 980px)").matches;
  const hasTouchPointer =
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(any-pointer: coarse)").matches ||
    Number(window.navigator?.maxTouchPoints || 0) > 0;

  return isSmallViewport && hasTouchPointer;
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

function renderMobileSectionHub() {
  const container = document.querySelector("#mobile-hub-grid");
  if (!container) {
    return;
  }

  container.innerHTML = MOBILE_SECTION_SHORTCUTS.map((item) => {
    return `
      <button type="button" class="mobile-hub-button" data-mobile-section-open="${escapeHtml(item.id)}">
        <div class="mobile-hub-button-top">
          <span class="mobile-hub-button-icon" aria-hidden="true">${escapeHtml(item.icon || "•")}</span>
          <span class="mobile-hub-button-eyebrow">${escapeHtml(item.eyebrow)}</span>
        </div>
        <strong class="mobile-hub-button-title">${escapeHtml(item.title)}</strong>
        <span class="mobile-hub-button-summary">${escapeHtml(item.summary || "")}</span>
      </button>
    `;
  }).join("");
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

function rememberMobileSectionRestore(sectionId = mobileSectionState.sectionId || "") {
  pendingMobileSectionRestoreId = sectionId || "";
}

function consumeMobileSectionRestore() {
  const sectionId = pendingMobileSectionRestoreId;
  pendingMobileSectionRestoreId = "";
  return sectionId;
}

function reopenPendingMobileSection() {
  const sectionId = consumeMobileSectionRestore();
  if (!sectionId || !isMobileSectionMode()) {
    return;
  }

  window.requestAnimationFrame(() => {
    openMobileSectionOverlay(sectionId);
  });
}

function lockMobileSectionBackgroundScroll() {
  mobileSectionScrollTop = window.scrollY || window.pageYOffset || 0;
  document.body.style.position = "fixed";
  document.body.style.top = `-${mobileSectionScrollTop}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

function unlockMobileSectionBackgroundScroll() {
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  window.scrollTo(0, mobileSectionScrollTop);
}

function closeMobileSectionOverlay() {
  const overlay = document.querySelector("#mobile-section-overlay");
  const content = document.querySelector("#mobile-section-content");
  recoverDetachedMobileSection();
  if (!overlay) {
    return;
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
    content.innerHTML = "";
  }

  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("mobile-section-open");
  unlockMobileSectionBackgroundScroll();
  mobileSectionState = {
    section: null,
    sectionId: "",
    placeholder: null,
    originalParent: null,
  };
}

function openMobileSectionOverlay(sectionId) {
  if (!isMobileSectionMode()) {
    const section = document.getElementById(sectionId);
    if (section) {
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
    placeholder,
    originalParent,
  };

  overlay.hidden = false;
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("mobile-section-open");
  lockMobileSectionBackgroundScroll();
  window.requestAnimationFrame(() => {
    const shell = overlay.querySelector(".mobile-section-shell");
    if (shell) {
      shell.scrollTop = 0;
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
    openMobileSectionOverlay(activeSectionId);
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
        closeMobileSectionOverlay();
      }
    });

    closeButton?.addEventListener("click", closeMobileSectionOverlay);

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !overlay.hidden) {
        closeMobileSectionOverlay();
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

  const renderable = buildRenderablePortfolio(data, liveSnapshot);
  currentPortfolioData = renderable;
  renderDashboard(renderable, options);
}

function buildRenderablePortfolio(data, liveSnapshot = null) {
  const next = structuredClone(data);
  next.holdings = normalizeHoldingsForDisplay(next.holdings || []);
  next.targets = normalizeTargetsForDisplay(next.targets || {});
  next.live = buildLiveState(liveSnapshot);

  if (!liveSnapshot?.portfolioLive) {
    return next;
  }

  next.summary = liveSnapshot.portfolioLive.summary || next.summary;
  next.assetStatus = liveSnapshot.portfolioLive.assetStatus || next.assetStatus;
  next.holdings = normalizeHoldingsForDisplay(liveSnapshot.portfolioLive.holdings || next.holdings);
  next.charts = liveSnapshot.portfolioLive.charts || next.charts;
  next.analytics = {
    ...(next.analytics || {}),
    ...(liveSnapshot.portfolioLive.analytics || {}),
  };
  next.targets = normalizeTargetsForDisplay(liveSnapshot.portfolioLive.targets || next.targets);

  return next;
}

async function syncPortfolioBaseData() {
  if (window.location.protocol === "file:" || !activeAccessCode) {
    return null;
  }

  try {
    const nextData = await fetchPortfolioFromApi(5000);
    lastPortfolioLoadSource = "api";
    applyPortfolioData(nextData, livePortfolioSnapshot, { renderMode: "full" });
    return nextData;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function refreshLivePortfolio() {
  if (window.location.protocol === "file:") {
    return null;
  }

  try {
    const response = await fetchWithAccess("./api/live-prices", {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || "실시간 가격을 불러오지 못했습니다.");
    }

    livePortfolioSnapshot = payload;
    if (basePortfolioData) {
      applyPortfolioData(basePortfolioData, livePortfolioSnapshot, { renderMode: "live" });
    }
    return payload;
  } catch (error) {
    console.error(error);
    livePortfolioSnapshot = decorateFailedLiveSnapshot(livePortfolioSnapshot, error.message);
    if (basePortfolioData) {
      applyPortfolioData(basePortfolioData, livePortfolioSnapshot, { renderMode: "live" });
    }
    return null;
  }
}

function scheduleLivePortfolioRefresh() {
  if (window.location.protocol === "file:") {
    return;
  }

  if (liveRefreshTimer) {
    window.clearInterval(liveRefreshTimer);
  }

  const refreshIntervalMs = Math.max(5_000, Number(currentPortfolioData?.live?.refreshIntervalSeconds || 10) * 1000);
  liveRefreshTimer = window.setInterval(() => {
    if (document.hidden) {
      return;
    }
    refreshLivePortfolio();
  }, refreshIntervalMs);
}

function clearDeferredMobileSectionTimers() {
  deferredMobileSectionTimers.forEach((timerId) => {
    window.clearTimeout(timerId);
  });
  deferredMobileSectionTimers.clear();
}

function renderDeferredMobileSection(sectionId, data = deferredMobileDashboardData) {
  if (!data || deferredMobileSectionsRendered.has(sectionId)) {
    return;
  }

  if (sectionId === "holdings-section") {
    renderHoldings(data.holdings || []);
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
    queueDeferredMobileSection(sectionId, delayMs);
  });
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

  text("#page-title", metadata.mantra);
  text("#hero-summary", buildHeroSummary(live));
  renderCurrentDateBadge();

  renderPriceStrip(live?.quotes || {}, holdings, targets, live?.fx || {});
  bindPriceStripInteractions();
  renderMetricCards(summary, realized, metadata);
  renderTargets(targets, live);
  renderAllocation(summary, assetStatus, cashPositions);
  renderAssetTable(assetStatus, holdings);
  renderDefense({
    metadata,
    trades,
    holdings,
    realized,
  });
  renderRealizedChartNote(metadata);

  if (isLiveRefresh) {
    return;
  }

  renderMobileSectionHub();
  renderNotes(notesState);
  bindAllPanelAccordions();
  bindMobileSectionOverlay();
  bindNotesSection(document.querySelector("#notes-section"));
  clearDeferredMobileSectionTimers();

  if (isMobileSectionMode()) {
    queueDeferredMobileDashboardSections(data);
  } else {
    renderHoldings(holdings);
    renderCharts(charts);
    renderRealized(realized, summary.realizedProfitTotal);
    renderTimeline(trades, getCurrentBasisYear(), charts.realizedHistory, realized);
    renderStrategy(strategy);
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
  const quote = instrument.liveQuote || quotes[instrument.name] || null;
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

function renderPriceStrip(quotes = {}, holdings = [], targets = {}, fx = {}) {
  const container = document.querySelector("#price-strip");
  if (!container) {
    return;
  }

  const instruments = collectTrackedQuoteItems(holdings, targets);
  if (!instruments.length) {
    container.innerHTML = `
      <div class="price-pill price-pill--empty">
        <div class="price-copy">
          <span class="price-name">실시간 가격</span>
          <span class="price-meta">추적 종목이 아직 없습니다.</span>
        </div>
      </div>
    `;
    return;
  }

  const sections = [
    { key: "crypto", label: "암호화폐", tone: "crypto" },
    { key: "us-stock", label: "미국주식", tone: "global" },
    { key: "kr-stock", label: "국내주식", tone: "domestic" },
  ];

  container.innerHTML = sections
    .map((section) => {
      const items = instruments.filter((instrument) => instrument.market === section.key);
      if (!items.length) {
        return "";
      }

      return `
        <section class="price-sector price-sector--${section.tone}">
          <div class="price-sector-head">
            <span class="price-sector-label">${escapeHtml(section.label)}</span>
            <span class="price-sector-count">${formatNumber(items.length)}종목</span>
          </div>
          <div class="price-sector-list">
            ${items.map((instrument) => renderPricePillMarkup(instrument, quotes, fx)).join("")}
          </div>
        </section>
      `;
    })
    .join("");
}

function renderMetricCards(summary, realized = [], metadata = {}) {
  const initialInvestment = summary.initialInvestment || 0;
  const initialInvestmentPnl = (summary.totalAssets || 0) - initialInvestment;
  const usStockTaxEstimate = estimateUsStockTax(realized);
  const realizedBasisDetail = formatPerformanceStartLabel(metadata?.realizedPerformanceStartDate)
    ? `${formatPerformanceStartLabel(metadata.realizedPerformanceStartDate)} 이후 매도 기준`
    : `유동성 비중 ${formatPercent(summary.liquidityRatio)}`;

  const metrics = [
    {
      label: "초기 투자금",
      value: formatCurrency(initialInvestment),
      detail: "업비트 기준 시작 자금",
      tone: "neutral",
    },
    {
      label: "총 자산",
      value: formatCurrency(summary.totalAssets),
      detail: "전체 평가액",
      tone: "neutral",
    },
    {
      label: "초기 투자금 대비 손익",
      value: formatSignedCurrency(initialInvestmentPnl),
      detail: "총 자산 - 초기 투자금",
      tone: toneClass(initialInvestmentPnl),
    },
    {
      label: "현금 보유",
      value: formatCurrency(summary.cashTotal),
      detail: "주식예수금 + 현금 + 업비트 KRW",
      tone: "neutral",
    },
    {
      label: "실현 손익",
      value: formatSignedCurrency(summary.realizedProfitTotal),
      detail: realizedBasisDetail,
      tone: toneClass(summary.realizedProfitTotal),
    },
    {
      label: "해외주식 세금 추정",
      value: formatCurrency(usStockTaxEstimate.taxEstimate),
      detail: usStockTaxEstimate.detail,
      tone: usStockTaxEstimate.taxEstimate > 0 ? "loss" : "neutral",
    },
  ];

  const template = document.querySelector("#metric-card-template");
  const grid = document.querySelector("#metric-grid");
  grid.innerHTML = "";

  metrics.forEach((metric) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.classList.add(`metric-card--${metric.tone}`);
    node.querySelector(".metric-label").textContent = metric.label;
    node.querySelector(".metric-value").textContent = metric.value;
    node.querySelector(".metric-value").classList.add(metric.tone);
    node.querySelector(".metric-detail").textContent = metric.detail;
    grid.appendChild(node);
  });
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

  const haystack = [item.assetName, item.asset, item.symbol]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  if (["PLTR", "팔란티어", "CRCL", "써클"].some((keyword) => haystack.includes(String(keyword).toUpperCase()))) {
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

  if (!usStockRealized.length) {
    return {
      taxEstimate: 0,
      detail: `${currentYear}년 미국주식 매도 발생 시 자동 계산`,
    };
  }

  const realizedPnl = usStockRealized.reduce((total, item) => total + Number(item.pnl || 0), 0);
  if (realizedPnl <= 0) {
    return {
      taxEstimate: 0,
      detail: `실현손익 ${formatSignedCurrency(realizedPnl)} · 참고용`,
    };
  }

  const remainingDeduction = Math.max(US_STOCK_TAX_ALLOWANCE - realizedPnl, 0);
  const taxableGain = Math.max(realizedPnl - US_STOCK_TAX_ALLOWANCE, 0);
  const taxEstimate = taxableGain > 0 ? taxableGain * US_STOCK_TAX_RATE : 0;

  if (taxEstimate > 0) {
    return {
      taxEstimate,
      detail: `과세대상 ${formatCurrency(taxableGain)} · 22% 기준`,
    };
  }

  return {
    taxEstimate: 0,
    detail: `실현손익 ${formatSignedCurrency(realizedPnl)} · 공제 잔여 ${formatCurrency(remainingDeduction)}`,
  };
}

function renderTargets(targets, live) {
  const hero = document.querySelector("#targets-hero");
  const grid = document.querySelector("#targets-grid");
  if (!hero || !grid) {
    return;
  }

  const groups = Array.isArray(targets?.groups) ? targets.groups : [];
  const totalCount = groups.reduce((total, group) => {
    const items = Array.isArray(group?.items) ? group.items.filter(Boolean) : [];
    return total + items.length;
  }, 0);

  hero.innerHTML = `
    <div class="targets-hero-top">
      <div>
        <p class="eyebrow">${escapeHtml(targets?.eyebrow || "Target Board")}</p>
        <h3 class="targets-hero-title">${escapeHtml(targets?.title || "지금 노리는 종목")}</h3>
      </div>
      <div class="targets-counter">
        <span>총 후보</span>
        <strong>${formatNumber(totalCount)}</strong>
      </div>
    </div>
    <p class="targets-hero-summary">${escapeHtml(
      targets?.summary || "매수 버튼보다 먼저 보는 후보군입니다."
    )}</p>
    <div class="targets-live-row">
      <span class="targets-live-badge targets-live-badge--${escapeHtml(live?.status?.level || "neutral")}">${escapeHtml(
        live?.status?.message || "실시간 연결 준비 중"
      )}</span>
      <span class="targets-live-meta">${escapeHtml(buildLiveTimestampCopy(live))}</span>
    </div>
    <div class="targets-strip">
      ${groups
        .map((group) => {
          const items = Array.isArray(group?.items) ? group.items.filter(Boolean) : [];
          const tone = normalizeTargetTone(group?.tone);
          return `
            <div class="targets-strip-item targets-strip-item--${tone}">
              <span>${escapeHtml(group?.title || "목표")}</span>
              <strong>${items.length ? `${formatNumber(items.length)}종목` : "대기중"}</strong>
            </div>
          `;
        })
        .join("")}
    </div>
    ${
      totalCount
        ? `
          <div class="targets-pill-row">
            ${groups
              .flatMap((group) => {
                const tone = normalizeTargetTone(group?.tone);
                const items = Array.isArray(group?.items) ? group.items.filter(Boolean) : [];
                return items.map((item) => {
                  const assetItem = typeof item === "string" ? { name: item } : item;
                  return `<span class="targets-pill targets-pill--${tone}">${escapeHtml(getDisplayAssetName(assetItem))}</span>`;
                });
              })
              .join("")}
          </div>
        `
        : `
          <div class="targets-empty">
            <strong>아직 없음</strong>
            <p>후보 종목이 정리되면 이 보드부터 채워집니다.</p>
          </div>
        `
    }
  `;

  grid.innerHTML = groups.map((group) => renderTargetGroupCard(group, live)).join("");
}

function renderTargetGroupCard(group = {}, live = null) {
  const items = Array.isArray(group.items) ? group.items.filter(Boolean) : [];
  const tone = normalizeTargetTone(group.tone);

  return `
    <article class="panel targets-market-card targets-market-card--${tone}">
      <div class="targets-market-top">
        <div>
          <p class="targets-market-label">${escapeHtml(group.label || group.title || "Target Group")}</p>
          <h3 class="targets-market-title">${escapeHtml(group.title || "목표 종목")}</h3>
        </div>
        <span class="targets-market-count">${items.length ? `${formatNumber(items.length)}종목` : "비어 있음"}</span>
      </div>
      ${group.summary ? `<p class="targets-market-summary">${escapeHtml(group.summary)}</p>` : ""}
      ${
        items.length
          ? `
            <ul class="targets-list">
              ${items.map((item) => renderTargetListItem(item, tone, live?.fx || {})).join("")}
            </ul>
          `
          : `
            <div class="targets-empty">
              <strong>${escapeHtml(group.emptyTitle || "아직 없음")}</strong>
              <p>${escapeHtml(group.emptyDescription || "새 후보가 생기면 여기에 추가합니다.")}</p>
            </div>
          `
      }
    </article>
  `;
}

function normalizeTargetTone(value) {
  if (value === "us-stock") {
    return "global";
  }
  if (value === "kr-stock") {
    return "domestic";
  }
  if (value === "crypto" || value === "global" || value === "domestic") {
    return value;
  }
  return "neutral";
}

function renderAllocation(summary, assetStatus, cashPositions) {
  const isCryptoAsset = (item) => item.category === "암호화폐" || item.platform === "업비트";

  const allocation = [
    {
      label: "암호화폐",
      value: assetStatus
        .filter(isCryptoAsset)
        .reduce((total, item) => total + item.valuation, 0),
    },
    {
      label: "해외주식",
      value: assetStatus
        .filter((item) => item.category === "해외주식")
        .reduce((total, item) => total + item.valuation, 0),
    },
    {
      label: "국내주식",
      value: assetStatus
        .filter((item) => item.category === "국내주식")
        .reduce((total, item) => total + item.valuation, 0),
    },
    {
      label: "현금성 자산",
      value: cashPositions.reduce((total, item) => total + item.amount, 0),
    },
  ].filter((item) => item.value > 0);

  const total = summary.totalAssets || 1;
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = allocation
    .map((item, index) => {
      const length = (item.value / total) * circumference;
      const segment = `
        <circle
          cx="60"
          cy="60"
          r="${radius}"
          fill="none"
          stroke="${colors[index % colors.length]}"
          stroke-width="14"
          stroke-linecap="round"
          stroke-dasharray="${length} ${circumference - length}"
          stroke-dashoffset="${-offset}"
        ></circle>
      `;
      offset += length;
      return segment;
    })
    .join("");

  document.querySelector("#allocation-visual").innerHTML = `
    <div class="donut-chart">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="${radius}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="14"></circle>
        ${segments}
      </svg>
      <div class="donut-center">
        <span>총 자산</span>
        <strong>${formatCurrency(summary.totalAssets)}</strong>
      </div>
    </div>
  `;

  document.querySelector("#allocation-legend").innerHTML = allocation
    .map(
      (item, index) => `
        <div class="legend-item">
          <span class="legend-swatch" style="background:${colors[index % colors.length]}"></span>
          <div>
            <p class="legend-label">${item.label}</p>
            <strong>${formatPercent(item.value / total)}</strong>
          </div>
          <span class="legend-value">${formatCurrency(item.value)}</span>
        </div>
      `
    )
    .join("");
}

function renderCharts(charts) {
  const returnsCanvas = document.querySelector("#returns-chart");
  const realizedCanvas = document.querySelector("#realized-chart");

  if (!charts) {
    if (returnsCanvas) {
      renderChartUnavailable("#returns-chart", "차트 데이터 없음");
    }
    if (realizedCanvas) {
      renderChartUnavailable("#realized-chart", "차트 데이터 없음");
    }
    return;
  }

  renderChartStats(charts);
  destroyCharts();

  if (!window.Chart) {
    if (returnsCanvas) {
      renderChartUnavailable("#returns-chart", "Chart.js 로드 실패");
    }
    if (realizedCanvas) {
      renderChartUnavailable("#realized-chart", "Chart.js 로드 실패");
    }
    return;
  }

  const hasReturns = Array.isArray(charts.returnsComparison) && charts.returnsComparison.length > 0;
  const hasRealized = Array.isArray(charts.realizedHistory) && charts.realizedHistory.length > 0;

  const theme = readChartTheme();
  const commonPlugins = {
    legend: {
      labels: {
        color: theme.mutedStrong,
        usePointStyle: true,
        pointStyle: "circle",
        padding: 16,
        boxWidth: 10,
        font: {
          family: theme.mono,
          size: 11,
          weight: "700",
        },
      },
    },
    tooltip: {
      backgroundColor: "rgba(5, 12, 12, 0.94)",
      borderColor: theme.lineStrong,
      borderWidth: 1,
      titleColor: theme.text,
      bodyColor: theme.text,
      padding: 14,
      titleFont: {
        family: theme.sans,
        weight: "700",
      },
      bodyFont: {
        family: theme.sans,
      },
      callbacks: {
        label(context) {
          const datasetLabel = context.dataset.label ? `${context.dataset.label}: ` : "";
          if (typeof context.raw === "number") {
            return `${datasetLabel}${formatCurrency(context.raw)}`;
          }
          return `${datasetLabel}${context.formattedValue}`;
        },
      },
    },
  };

  if (returnsCanvas && !hasReturns) {
    renderChartUnavailable("#returns-chart", "차트 데이터 없음");
  } else if (returnsCanvas) {
    chartRegistry.push(
      new Chart(returnsCanvas, {
        type: "bar",
        data: {
          labels: charts.returnsComparison.map((item) => item.label),
          datasets: [
            {
              label: "수익률",
              data: charts.returnsComparison.map((item) => item.returnRate * 100),
              borderRadius: 10,
              borderSkipped: false,
              backgroundColor: charts.returnsComparison.map((item) =>
                item.returnRate >= 0 ? alpha(theme.gain, 0.78) : alpha(theme.loss, 0.78)
              ),
              borderColor: charts.returnsComparison.map((item) => (item.returnRate >= 0 ? theme.gain : theme.loss)),
              borderWidth: 1.5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: "y",
          scales: {
            x: {
              grid: {
                color: theme.grid,
              },
              ticks: {
                color: theme.muted,
                font: {
                  family: theme.mono,
                },
                callback(value) {
                  return `${value}%`;
                },
              },
            },
            y: {
              grid: {
                display: false,
              },
              ticks: {
                color: theme.text,
                font: {
                  family: theme.sans,
                  weight: "700",
                },
              },
            },
          },
          plugins: {
            ...commonPlugins,
            legend: {
              display: false,
            },
            tooltip: {
              ...commonPlugins.tooltip,
              callbacks: {
                label(context) {
                  return `수익률: ${Number(context.raw).toFixed(2)}%`;
                },
              },
            },
          },
        },
      })
    );
  }

  if (realizedCanvas && !hasRealized) {
    renderChartUnavailable("#realized-chart", "차트 데이터 없음");
  } else if (realizedCanvas) {
    chartRegistry.push(
      new Chart(realizedCanvas, {
        data: {
          labels: charts.realizedHistory.map((item) => item.date),
          datasets: [
            {
              type: "bar",
              label: "일자별 실현손익",
              data: charts.realizedHistory.map((item) => item.dailyPnl),
              backgroundColor: charts.realizedHistory.map((item) =>
                item.dailyPnl >= 0 ? alpha(theme.gain, 0.6) : alpha(theme.loss, 0.2)
              ),
              borderColor: charts.realizedHistory.map((item) => (item.dailyPnl >= 0 ? theme.gain : alpha(theme.loss, 0.4))),
              borderWidth: 1.2,
              borderRadius: 8,
              borderSkipped: false,
              yAxisID: "y",
            },
            {
              type: "line",
              label: "누적 실현손익",
              data: charts.realizedHistory.map((item) => item.cumulativePnl),
              borderColor: theme.accent,
              backgroundColor: alpha(theme.accent, 0.15),
              pointBackgroundColor: theme.accent,
              pointBorderColor: theme.surface,
              pointRadius: 5,
              pointHoverRadius: 6,
              borderWidth: 3,
              tension: 0.3,
              fill: true,
              yAxisID: "y",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: "index",
            intersect: false,
          },
          scales: {
            x: {
              grid: {
                color: alpha(theme.cash, 0.08),
              },
              ticks: {
                color: theme.muted,
                font: {
                  family: theme.mono,
                },
              },
            },
            y: {
              grid: {
                color: theme.grid,
              },
              ticks: {
                color: theme.muted,
                font: {
                  family: theme.mono,
                },
                callback(value) {
                  return `${formatCompactNumber(value)}원`;
                },
              },
            },
          },
          plugins: {
            ...commonPlugins,
            legend: {
              ...commonPlugins.legend,
              position: "top",
            },
            tooltip: {
              ...commonPlugins.tooltip,
              callbacks: {
                label(context) {
                  return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
                },
                afterLabel(context) {
                  const dataIndex = context.dataIndex;
                  const historyItem = charts.realizedHistory[dataIndex];
                  if (!historyItem || !historyItem.profitDetails) {
                    return [];
                  }
                  return historyItem.profitDetails.map((detail) =>
                    `  ${detail.item}: ${formatSignedCurrency(detail.pnl)}${detail.note ? ` (${detail.note})` : ''}`
                  );
                },
              },
            },
          },
        },
      })
    );
  }
}

function renderAssetTable(assetStatus, holdings = []) {
  const body = document.querySelector("#asset-status-body");
  if (!body) {
    return;
  }

  const rows = holdings.length
    ? holdings.map((item) => {
        const principal = (item.quantity || 0) * (item.averagePrice || 0);
        const pnl = (item.valuation || 0) - principal;

        return {
          asset: getDisplayAssetName(item),
          platform: item.platform,
          currentPrice: buildTableQuoteMarkup(item.liveQuote, item),
          valuation: item.valuation || 0,
          principal,
          pnl,
          returnRate: item.returnRate || 0,
        };
      })
    : assetStatus.map((item) => ({
        asset: item.asset || item.assetName || item.category,
        platform: item.platform,
        currentPrice: buildTableFallbackMarkup(),
        valuation: item.valuation || 0,
        principal: item.principal || 0,
        pnl: item.pnl || 0,
        returnRate: item.returnRate || 0,
      }));

  body.innerHTML = rows
    .map((item) =>
      `
        <tr>
          ${tableCell("종목", item.asset)}
          ${tableCell("플랫폼", item.platform)}
          ${tableCell("현재가", item.currentPrice, "align-right numeric-cell")}
          ${tableCell("평가금액", formatCurrency(item.valuation), "align-right numeric-cell")}
          ${tableCell("원금", formatCurrency(item.principal), "align-right numeric-cell")}
          ${tableCell(
            "손익",
            formatSignedCurrency(item.pnl),
            `align-right numeric-cell table-emphasis ${toneClass(item.pnl)}`
          )}
          ${tableCell(
            "수익률",
            formatPercent(item.returnRate),
            `align-right numeric-cell table-emphasis ${toneClass(item.returnRate)}`
          )}
        </tr>
      `
    )
    .join("");
}

function renderHoldings(holdings) {
  const container = document.querySelector("#holdings-grid");
  const activeHoldings = holdings.filter((item) => item.quantity > 0);

  container.innerHTML = activeHoldings
    .map((item) => {
      const quote = item.liveQuote;
      const statusCopy = quote?.isDelayed ? "업데이트 지연" : "실시간";
      return `
        <article class="holding-card">
          <div class="holding-head">
            <div>
              <p class="mini-label">${item.platform}</p>
              <strong class="holding-title">${escapeHtml(getDisplayAssetName(item))}</strong>
            </div>
            <div class="holding-actions">
              <span class="status-tag ${quote?.isDelayed ? "status-tag--warning" : ""}">${statusCopy}</span>
            </div>
          </div>
          <div class="mini-stack">
            <div class="mini-row">
              <span class="mini-label">수량</span>
              <span class="mini-value">${formatNumber(item.quantity)}</span>
            </div>
            <div class="mini-row">
              <span class="mini-label">현재가</span>
              ${buildHoldingQuoteMarkup(quote, item)}
            </div>
            <div class="mini-row">
              <span class="mini-label">평균단가</span>
              <span class="mini-value">${formatCurrency(item.averagePrice)}</span>
            </div>
            <div class="mini-row">
              <span class="mini-label">평가금액</span>
              <span class="mini-value">${formatCurrency(item.valuation)}</span>
            </div>
            <div class="mini-row">
              <span class="mini-label">수익률</span>
              <span class="mini-value ${toneClass(item.returnRate)}">${formatPercent(item.returnRate)}</span>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderRealized(realized, totalProfit) {
  const container = document.querySelector("#realized-list");
  if (!container) {
    return;
  }

  const items = Array.isArray(realized) ? realized : [];

  container.innerHTML = `
    <div class="realized-item">
      <div class="realized-top">
        <div>
          <p class="mini-label">누적 실현손익</p>
          <strong>전체 실현 손익</strong>
        </div>
        <span class="realized-value ${toneClass(totalProfit)}">${formatSignedCurrency(totalProfit)}</span>
      </div>
    </div>
    ${items
      .map(
        (item) => `
          <div class="realized-item">
            <div class="realized-top">
              <div>
                <p class="mini-label">${item.platform} · ${item.date || ""}</p>
                <strong>${item.asset}</strong>
              </div>
              <span class="realized-value ${toneClass(item.pnl)}">${formatSignedCurrency(item.pnl)}</span>
            </div>
            <p class="metric-detail">${formatPercent(item.returnRate)} 수익률${item.note ? ` · ${item.note}` : ""}</p>
          </div>
        `
      )
      .join("")}
  `;

  bindPanelAccordion(document.querySelector("#realized-section"));
}

function renderDefense(context = {}) {
  const container = document.querySelector("#defense-grid");
  const note = document.querySelector("#defense-note");
  if (!container) {
    return;
  }

  const snapshot = buildXrpDefenseSnapshot(context);
  if (note) {
    note.textContent = snapshot.note;
  }

  container.innerHTML = snapshot.items
    .map((item) => {
      const formatted =
        item.type === "percent"
          ? formatPercent(item.value)
          : item.type === "quantity"
            ? `${formatNumber(item.value)} XRP`
            : item.signed
              ? formatSignedCurrency(item.value, item.tone === "neutral")
              : formatCurrency(item.value);
      return `
        <div class="defense-card">
          <p class="mini-label">${escapeHtml(item.label)}</p>
          <strong class="defense-value ${item.tone}">${formatted}</strong>
        </div>
      `;
    })
    .join("");
}

function buildXrpDefenseSnapshot({ metadata = {}, trades = {}, holdings = [], realized = [] } = {}) {
  const startDate = parsePerformanceStartDateValue(metadata?.realizedPerformanceStartDate);
  const startLabel = startDate ? `${startDate.getMonth() + 1}월${startDate.getDate()}일` : "기준일";
  const xrpTrades = (Array.isArray(trades?.crypto) ? trades.crypto : []).filter(
    (trade) => String(trade.asset || "").toUpperCase() === "XRP"
  );
  const earlySellTrades = xrpTrades.filter((trade) => {
    if (trade.side !== "매도" || !startDate) {
      return trade.side === "매도" && !startDate;
    }

    const tradeDate = parseMonthDayToDate(trade.date, startDate.getFullYear());
    return tradeDate ? tradeDate.getTime() < startDate.getTime() : false;
  });
  const rebuyTrades = xrpTrades.filter((trade) => {
    if (trade.side !== "매수") {
      return false;
    }

    if (!startDate) {
      return true;
    }

    const tradeDate = parseMonthDayToDate(trade.date, startDate.getFullYear());
    return tradeDate ? tradeDate.getTime() >= startDate.getTime() : true;
  });
  const xrpRealized = (Array.isArray(realized) ? realized : []).filter((item) => {
    if (String(item.assetName || item.asset || "").toUpperCase() !== "XRP") {
      return false;
    }

    if (!startDate) {
      return true;
    }

    const tradeDate = parseMonthDayToDate(item.date, startDate.getFullYear());
    return tradeDate ? tradeDate.getTime() >= startDate.getTime() : true;
  });

  const earlySellTotals = earlySellTrades.reduce(
    (accumulator, trade) => {
      const quantity = Number(trade.quantity || 0);
      const amount = Number(trade.amount || 0);
      const fee = Number(trade.fee || 0);

      accumulator.sellQuantity += quantity;
      accumulator.sellNet += amount - fee;

      return accumulator;
    },
    {
      sellQuantity: 0,
      sellNet: 0,
    }
  );
  const rebuyTotals = rebuyTrades.reduce(
    (accumulator, trade) => {
      const quantity = Number(trade.quantity || 0);
      const amount = Number(trade.amount || 0);
      const fee = Number(trade.fee || 0);

      accumulator.buyQuantity += quantity;
      accumulator.buyGross += amount + fee;
      return accumulator;
    },
    {
      buyQuantity: 0,
      buyGross: 0,
    }
  );

  const realizedPnl = xrpRealized.reduce((total, item) => total + Number(item.pnl || 0), 0);
  const earlySellAverage = earlySellTotals.sellQuantity > 0 ? earlySellTotals.sellNet / earlySellTotals.sellQuantity : 0;
  const rebuyAverage = rebuyTotals.buyQuantity > 0 ? rebuyTotals.buyGross / rebuyTotals.buyQuantity : 0;
  const favorableBuyPrice = earlySellAverage || rebuyAverage || 0;
  const note = earlySellAverage
    ? `주식 매수 자금 확보용 초반 XRP 매도 평균은 ${formatCurrency(earlySellAverage)}입니다. 이 가격 아래에서 다시 사면 재매수 기준이 유리합니다.`
    : `${startLabel} 이후 XRP 재매수 기준입니다.`;

  return {
    note,
    items: [
      {
        label: "초반 XRP 평균 매도단가",
        value: earlySellAverage,
        type: "currency",
        tone: "neutral",
      },
      {
        label: "이 가격 아래 재매수 시 유리",
        value: favorableBuyPrice,
        type: "currency",
        tone: "neutral",
      },
      {
        label: `${startLabel} 기준 평균 재매수 단가`,
        value: rebuyAverage,
        type: "currency",
        tone: "neutral",
      },
      {
        label: `${startLabel} 기준 XRP 실현손익`,
        value: realizedPnl,
        type: "currency",
        tone: toneClass(realizedPnl),
        signed: true,
      },
    ],
  };
}

function ensureNotesLoaded() {
  if (hasLoadedNotes) {
    return;
  }

  notesState = loadNotesFromStorage();
  hasLoadedNotes = true;
}

function loadNotesFromStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getNotesStorageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return normalizeStoredNotes(parsed);
  } catch (error) {
    console.error(error);
    return [];
  }
}

function normalizeStoredNotes(notes = []) {
  return (Array.isArray(notes) ? notes : [])
    .filter((note) => note && typeof note.id === "string")
    .map((note) => ({
      id: note.id,
      title: String(note.title || "").trim(),
      body: String(note.body || "").trim(),
      createdAt: note.createdAt || new Date().toISOString(),
      updatedAt: note.updatedAt || note.createdAt || new Date().toISOString(),
    }))
    .filter((note) => note.title || note.body)
    .sort((left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime());
}

function persistNotesToStorage(notes) {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  try {
    window.localStorage.setItem(getNotesStorageKey(), JSON.stringify(notes));
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

async function requestNotesMutation(method = "GET", payload = null) {
  if (window.location.protocol === "file:") {
    throw new Error("메모 서버 저장은 배포 사이트 또는 로컬 서버에서만 가능합니다.");
  }

  const response = await fetchWithAccess("./api/notes", {
    method,
    headers: {
      Accept: "application/json",
      ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
    },
    ...(method === "GET" ? {} : { body: JSON.stringify(payload || {}) }),
  });
  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(result?.error || "메모 처리에 실패했습니다.");
  }

  return result;
}

async function hydrateNotesFromServer() {
  if (window.location.protocol === "file:") {
    return;
  }

  try {
    const result = await requestNotesMutation("GET");
    const nextNotes = normalizeStoredNotes(result?.notes);
    notesState = nextNotes;
    hasLoadedNotes = true;
    persistNotesToStorage(nextNotes);
    renderNotes(notesState);
  } catch (error) {
    console.error(error);
  }
}

function renderNotes(notes = notesState) {
  const count = document.querySelector("#notes-count");
  const list = document.querySelector("#notes-list");
  if (!count || !list) {
    return;
  }

  count.textContent = `${formatNumber(notes.length)}개`;
  list.innerHTML = notes.length
    ? notes.map((note) => renderNoteCard(note)).join("")
    : `
        <article class="note-card notes-empty">
          <strong>아직 저장된 메모가 없습니다.</strong>
          <p>매매 아이디어, 손절 기준, 체크 포인트를 짧게 쌓아두세요.</p>
        </article>
      `;
}

function renderNoteCard(note) {
  return `
    <article class="note-card memo-card" data-note-id="${escapeHtml(note.id)}">
      <div class="memo-card-head">
        <div>
          <p class="mini-label">Saved Memo</p>
          <strong class="memo-card-title">${escapeHtml(getNoteTitle(note))}</strong>
        </div>
        <div class="memo-card-actions">
          <button type="button" class="memo-card-edit" data-note-edit="${escapeHtml(note.id)}">수정</button>
          <button type="button" class="memo-card-delete" data-note-delete="${escapeHtml(note.id)}">삭제</button>
        </div>
      </div>
      <p class="memo-card-body">${escapeHtml(note.body || note.title).replaceAll("\n", "<br />")}</p>
      <div class="memo-card-meta">
        <span>${escapeHtml(formatNoteTimestamp(note.updatedAt || note.createdAt))}</span>
        <span>${escapeHtml(getNoteMeta(note))}</span>
      </div>
    </article>
  `;
}

function getNoteTitle(note) {
  const title = String(note.title || "").trim();
  if (title) {
    return title;
  }

  const body = String(note.body || "").trim();
  if (!body) {
    return "메모";
  }

  return body.length > 28 ? `${body.slice(0, 28)}...` : body;
}

function getNoteMeta(note) {
  const length = String(note.body || note.title || "").trim().length;
  return `${formatNumber(length)}자`;
}

function formatNoteTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "방금 저장";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function initNotesBoard() {
  const section = document.querySelector("#notes-section");
  if (!section) {
    return;
  }

  bindNotesSection(section);
}

function setTargetFormStatus(message = "", tone = "neutral") {
  const status = document.querySelector("#target-form-status");
  if (!status) {
    return;
  }

  status.textContent = message;
  status.dataset.tone = tone;
}

async function requestTargetMutation(method, targetData) {
  if (window.location.protocol === "file:") {
    throw new Error("관심종목 저장/삭제는 로컬 서버에서만 가능합니다. `node scripts/dev-server.js` 실행 후 접속하세요.");
  }

  const response = await fetchWithAccess("./api/targets", {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(targetData),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || "관심종목 처리에 실패했습니다.");
  }

  return payload;
}

async function reconcilePortfolioAfterMutation(updatedPortfolio, options = {}) {
  const initialSnapshot = options.resetLiveSnapshot ? null : livePortfolioSnapshot;
  if (options.resetLiveSnapshot) {
    livePortfolioSnapshot = null;
  }

  applyPortfolioData(updatedPortfolio, initialSnapshot, { renderMode: "full" });
  await refreshLivePortfolio();

  let confirmedPortfolio = updatedPortfolio;
  try {
    confirmedPortfolio = await loadPortfolio();
  } catch (error) {
    confirmedPortfolio = updatedPortfolio;
  }

  applyPortfolioData(confirmedPortfolio, livePortfolioSnapshot, { renderMode: "full" });
  return confirmedPortfolio;
}

async function applyTargetMutation(method, targetData, successMessage) {
  const updatedPortfolio = await requestTargetMutation(method, targetData);
  const confirmedPortfolio = await reconcilePortfolioAfterMutation(updatedPortfolio);
  setTargetFormStatus(successMessage, "success");
  return confirmedPortfolio;
}

async function requestTradeMutation(method, payload) {
  if (window.location.protocol === "file:") {
    throw new Error("거래 저장/수정/삭제는 로컬 서버에서만 가능합니다. `node scripts/dev-server.js` 실행 후 접속하세요.");
  }

  const response = await fetchWithAccess("./api/trades", {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error || "거래 처리에 실패했습니다.");
  }

  return result;
}

async function applyTradeMutation(method, payload) {
  const updatedPortfolio = await requestTradeMutation(method, payload);
  return reconcilePortfolioAfterMutation(updatedPortfolio, {
    resetLiveSnapshot: true,
  });
}

function finalizeMobileModalLaunch(sectionId = mobileSectionState.sectionId || "") {
  if (!isMobileSectionMode() || !sectionId) {
    return;
  }

  rememberMobileSectionRestore(sectionId);
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
      help.textContent = "예시: 솔라나(SOL), 도지코인(DOGE), 에이다(ADA)";
      return;
    }

    if (market === "미국주식") {
      assetInput.placeholder = "Apple Inc. (AAPL)";
      help.textContent = "영어 회사명이나 티커를 몇 글자만 입력해도 아래 추천 목록이 뜹니다. 예시: Apple Inc. (AAPL), TSLA, NVDA";
      return;
    }

    assetInput.placeholder = "삼성전자(005930)";
    help.textContent = "예시: 삼성전자(005930), SK하이닉스(000660) · 국내주식 실시간은 다음 단계에서 연결";
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

    const confirmed = window.confirm(`정말 삭제하실건가요?\n\n관심종목에서 제거합니다.\n대상: ${name || symbol}`);
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
      button.disabled = false;
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

function bindNotesSection(section) {
  if (!section || section.dataset.notesBound === "true") {
    return;
  }

  const form = section.querySelector("#notes-form");
  const titleInput = section.querySelector("#note-title");
  const bodyInput = section.querySelector("#note-body");
  const status = section.querySelector("#notes-status");
  const resetButton = section.querySelector("[data-note-reset]");
  const submitButton = form?.querySelector(".btn-primary");
  const formEyebrow = section.querySelector("#notes-form-eyebrow");
  const formTitle = section.querySelector("#notes-form-title");

  const setStatus = (message, tone = "neutral") => {
    if (!status) {
      return;
    }

    status.textContent = message || "";
    status.dataset.tone = tone;
  };

  const setComposerMode = (note = null) => {
    noteEditorState.editingId = note?.id || null;

    if (formEyebrow) {
      formEyebrow.textContent = note ? "Edit Memo" : "Quick Memo";
    }
    if (formTitle) {
      formTitle.textContent = note ? "투자 메모 수정" : "투자 메모 저장";
    }

    if (submitButton) {
      submitButton.textContent = note ? "수정 저장" : "메모 저장";
    }
    if (resetButton) {
      resetButton.textContent = note ? "수정 취소" : "입력 비우기";
    }
    if (titleInput) {
      titleInput.value = note?.title || "";
    }
    if (bodyInput) {
      bodyInput.value = note?.body || "";
    }
  };

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    ensureNotesLoaded();

    const title = String(titleInput?.value || "").trim();
    const body = String(bodyInput?.value || "").trim();
    if (!title && !body) {
      setStatus("제목이나 내용을 하나는 적어주세요.", "error");
      bodyInput?.focus();
      return;
    }

    const isEditing = Boolean(noteEditorState.editingId);
    let nextNotes = [];

    if (window.location.protocol !== "file:") {
      try {
        const result = await requestNotesMutation(isEditing ? "PUT" : "POST", {
          ...(isEditing ? { id: noteEditorState.editingId } : {}),
          title,
          body,
        });
        nextNotes = normalizeStoredNotes(result?.notes);
      } catch (error) {
        setStatus(error.message || "메모 저장에 실패했습니다.", "error");
        return;
      }
    } else {
      const timestamp = new Date().toISOString();
      nextNotes = noteEditorState.editingId
        ? notesState.map((note) =>
            note.id === noteEditorState.editingId
              ? {
                  ...note,
                  title,
                  body,
                  updatedAt: timestamp,
                }
              : note
          )
        : [
            {
              id: `note-${Date.now()}`,
              title,
              body,
              createdAt: timestamp,
              updatedAt: timestamp,
            },
            ...notesState,
          ];
      nextNotes = normalizeStoredNotes(nextNotes);
    }

    persistNotesToStorage(nextNotes);

    notesState = nextNotes;
    renderNotes(notesState);
    setComposerMode();
    setStatus(isEditing ? "메모를 수정했습니다." : "메모를 저장했습니다.", "success");
    titleInput?.focus();
  });

  resetButton?.addEventListener("click", () => {
    const wasEditing = Boolean(noteEditorState.editingId);
    setComposerMode();
    form?.reset();
    setStatus(wasEditing ? "메모 수정을 취소했습니다." : "입력을 비웠습니다.");
    titleInput?.focus();
  });

  section.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-note-edit]");
    if (editButton && section.contains(editButton)) {
      ensureNotesLoaded();
      const note = notesState.find((item) => item.id === editButton.dataset.noteEdit);
      if (!note) {
        setStatus("수정할 메모를 찾지 못했습니다.", "error");
        return;
      }

      setComposerMode(note);
      setStatus("메모를 수정 중입니다.", "success");
      titleInput?.focus();
      return;
    }

    const deleteButton = event.target.closest("[data-note-delete]");
    if (!deleteButton || !section.contains(deleteButton)) {
      return;
    }

    ensureNotesLoaded();
    const noteId = deleteButton.dataset.noteDelete;
    const confirmed = window.confirm("정말 삭제하실건가요?\n\n선택한 메모를 삭제합니다.");
    if (!confirmed) {
      return;
    }
    let nextNotes = [];

    if (window.location.protocol !== "file:") {
      try {
        const result = await requestNotesMutation("DELETE", { id: noteId });
        nextNotes = normalizeStoredNotes(result?.notes);
      } catch (error) {
        setStatus(error.message || "메모 삭제에 실패했습니다.", "error");
        return;
      }
    } else {
      nextNotes = notesState.filter((note) => note.id !== noteId);
    }

    persistNotesToStorage(nextNotes);

    notesState = nextNotes;
    renderNotes(notesState);
    if (noteEditorState.editingId === noteId) {
      setComposerMode();
      form?.reset();
    }
    setStatus("메모를 삭제했습니다.", "success");
  });

  setComposerMode();
  section.dataset.notesBound = "true";
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

function renderTimelineTradeBadges(trade) {
  return `
    <div class="timeline-badges">
      <span class="trade-side ${trade.side === "매수" ? "trade-side-buy" : "trade-side-sell"}">${trade.side}</span>
      ${renderTradeStageBadge(trade.stage)}
    </div>
  `;
}

function formatRealizedTradeDisplay(pnl, returnRate = null) {
  if (!Number.isFinite(Number(pnl))) {
    return "";
  }

  return Number.isFinite(Number(returnRate))
    ? `${formatSignedCurrency(pnl)} (${formatPercent(returnRate)})`
    : formatSignedCurrency(pnl);
}

function buildRealizedTradeKey({ date = "", platform = "", asset = "", symbol = "", quantity = 0 }) {
  return [
    String(date || "").trim(),
    String(platform || "").trim(),
    String(asset || "").trim(),
    String(symbol || "").trim().toUpperCase(),
    normalizeTradeQuantityKey(quantity),
  ].join("|");
}

function buildRealizedTradeLookup(realized = []) {
  return (Array.isArray(realized) ? realized : []).reduce((lookup, entry) => {
    const key = buildRealizedTradeKey({
      date: entry.date,
      platform: entry.platform,
      asset: entry.assetName || entry.asset,
      symbol: entry.symbol,
      quantity: entry.quantity,
    });

    if (!lookup.has(key)) {
      lookup.set(key, []);
    }
    lookup.get(key).push(entry);
    return lookup;
  }, new Map());
}

function enrichTimelineTradeWithRealized(trade, realizedLookup) {
  const parsedNote = parseTradeOutcomeNote(trade.note);
  if (parsedNote) {
    return {
      ...trade,
      realizedPnl: parsedNote.pnl,
      realizedReturnRate: parsedNote.returnRate,
      realizedDisplay: formatRealizedTradeDisplay(parsedNote.pnl, parsedNote.returnRate),
    };
  }

  if (trade.side !== "매도") {
    return {
      ...trade,
      realizedPnl: null,
      realizedReturnRate: null,
      realizedDisplay: "",
    };
  }

  const key = buildRealizedTradeKey({
    date: trade.date,
    platform: trade.market === "암호화폐" ? "업비트" : trade.broker,
    asset: trade.asset,
    symbol: trade.symbol,
    quantity: trade.quantity,
  });
  const matched = realizedLookup.get(key)?.shift() || null;

  return {
    ...trade,
    realizedPnl: matched ? Number(matched.pnl || 0) : null,
    realizedReturnRate: matched ? Number(matched.returnRate || 0) : null,
    realizedDisplay: matched ? formatRealizedTradeDisplay(matched.pnl, matched.returnRate) : "",
  };
}

function normalizeTimelineTrades(trades, basisYear, realized = []) {
  const stockTrades = Array.isArray(trades.stocks) ? trades.stocks : [];
  const cryptoTrades = Array.isArray(trades.crypto) ? trades.crypto : [];
  const realizedLookup = buildRealizedTradeLookup(realized);

  return [
    ...stockTrades.map((trade, sourceIndex) => ({
      ...trade,
      market: trade.market || "국내주식",
      sourceCollection: "stocks",
      sourceIndex,
    })),
    ...cryptoTrades.map((trade, sourceIndex) => ({
      ...trade,
      market: "암호화폐",
      broker: trade.broker || "업비트",
      sourceCollection: "crypto",
      sourceIndex,
    })),
  ]
    .map((trade, index) => {
      const [month, day] = String(trade.date || "")
        .split("/")
        .map((segment) => Number(segment));
      const hasValidDate = Boolean(month && day);

      return {
        ...trade,
        month: month || 1,
        day: day || 1,
        sortValue: hasValidDate ? new Date(basisYear, month - 1, day).getTime() : 0,
        order: index,
      };
    })
    .map((trade) => enrichTimelineTradeWithRealized(trade, realizedLookup))
    .sort((left, right) => right.sortValue - left.sortValue || left.order - right.order);
}

function getTimelineTradeKey(trade) {
  return `${trade.sourceCollection || "unknown"}:${trade.sourceIndex ?? -1}`;
}

function groupTimelineTradesByDate(trades) {
  return trades.reduce((groups, trade) => {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.rawDate === trade.date) {
      lastGroup.trades.push(trade);
      return groups;
    }

    groups.push({
      rawDate: trade.date,
      sortValue: trade.sortValue,
      trades: [trade],
    });
    return groups;
  }, []);
}

function buildRealizedHistoryLookup(realizedHistory = []) {
  return realizedHistory.reduce((lookup, entry) => {
    lookup.set(normalizeMonthDayKey(entry.date), entry);
    return lookup;
  }, new Map());
}

function renderTimelineList(trades, basisYear, realizedHistory = []) {
  const grouped = groupTimelineTradesByDate(trades);
  const realizedLookup = buildRealizedHistoryLookup(realizedHistory);
  if (!grouped.length) {
    return `<div class="timeline-empty">표시할 거래가 없습니다.</div>`;
  }

  return grouped
    .map((group, index) => {
      const totalAmount = group.trades.reduce((total, trade) => total + trade.amount, 0);
      const isOpen = false;
      const panelId = `timeline-panel-${index}`;
      const dayProfit = realizedLookup.get(normalizeMonthDayKey(group.rawDate));
      const dayPnl = dayProfit?.dailyPnl ?? 0;

      return `
        <section class="timeline-group ${isOpen ? "is-open" : ""}">
          <button
            type="button"
            class="timeline-toggle"
            aria-expanded="${isOpen}"
            aria-controls="${panelId}"
          >
            <div class="timeline-date-head">
              <span class="timeline-date-chip">${group.rawDate}</span>
              <div class="timeline-date-copy">
                <strong>${formatTimelineDate(group.rawDate, basisYear)}</strong>
                <p>${buildTimelineSummary(group.trades)}</p>
              </div>
            </div>
            <div class="timeline-header-meta">
              <div class="timeline-stat">
                <span>거래 건수</span>
                <strong>${group.trades.length}건</strong>
              </div>
              <div class="timeline-stat">
                <span>실현 손익</span>
                <strong class="${getSignedPriceToneClass(dayPnl)}">${formatSignedCurrency(dayPnl)}</strong>
              </div>
              <div class="timeline-stat">
                <span>총 거래금액</span>
                <strong>${formatCurrency(totalAmount)}</strong>
              </div>
              <span class="timeline-toggle-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </div>
          </button>
          <div class="timeline-panel" id="${panelId}" aria-hidden="${!isOpen}">
            <div class="timeline-group-list">
              ${group.trades
                .map(
	                  (trade) => `
	                    <article class="timeline-item">
	                      <div class="timeline-top">
	                        <div>
	                          <p class="mini-label timeline-market">${trade.market}${trade.broker ? ` · ${trade.broker}` : ""}</p>
	                          <strong class="timeline-title">${escapeHtml(getDisplayAssetName({ asset: trade.asset }))}</strong>
	                          ${renderTimelineTradeBadges(trade)}
	                        </div>
	                        <div class="timeline-item-actions">
	                          <button
	                            type="button"
	                            class="timeline-action timeline-action--edit"
                            data-trade-edit
                            data-trade-collection="${escapeHtml(trade.sourceCollection || "")}"
                            data-trade-index="${escapeHtml(String(trade.sourceIndex ?? ""))}"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            class="timeline-action timeline-action--delete"
                            data-trade-delete
                            data-trade-collection="${escapeHtml(trade.sourceCollection || "")}"
                            data-trade-index="${escapeHtml(String(trade.sourceIndex ?? ""))}"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                      <p class="timeline-meta">
                        수량 ${formatTradeQuantity(trade.quantity)} / 단가 ${formatCurrency(trade.price)} / 수수료 ${formatCurrency(trade.fee)} / 거래금액 ${formatCurrency(trade.amount)}
                      </p>
                      <strong class="timeline-realized ${trade.side === "매도" && Number.isFinite(Number(trade.realizedPnl)) ? getSignedPriceToneClass(trade.realizedPnl) : "price-move-neutral"}">
                        ${
                          trade.side === "매도" && trade.realizedDisplay
                            ? `실현손익 ${trade.realizedDisplay}`
                            : "실현손익 집계 없음"
                        }
                      </strong>
                      ${
                        getDisplayTradeNote(trade.note)
                          ? `<p class="timeline-note">메모 · ${escapeHtml(getDisplayTradeNote(trade.note))}</p>`
                          : ""
                      }
                    </article>
                  `
                )
                .join("")}
            </div>
          </div>
        </section>
      `;
    })
    .join("");
}

function renderTimeline(trades, basisDateLabel, realizedHistory = [], realizedEntries = []) {
  const basisYear = Number(basisDateLabel) || getCurrentBasisYear();
  const listContainer = document.querySelector("#timeline");
  const normalizedTrades = normalizeTimelineTrades(trades, basisYear, realizedEntries);
  timelineTradeRegistry = normalizedTrades.reduce((registry, trade) => {
    registry.set(getTimelineTradeKey(trade), trade);
    return registry;
  }, new Map());

  listContainer.innerHTML = renderTimelineList(normalizedTrades, basisYear, realizedHistory);

  bindTimelineSection(document.querySelector("#timeline-section"));
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

async function deleteTimelineTrade(trade) {
  if (!trade?.sourceCollection || !Number.isInteger(trade?.sourceIndex)) {
    throw new Error("삭제할 거래 정보를 찾지 못했습니다.");
  }

  await applyTradeMutation("DELETE", {
    collection: trade.sourceCollection,
    index: trade.sourceIndex,
  });
}

function bindTimelineSection(section) {
  if (!section || section.dataset.timelineBound === "true") {
    return;
  }

  section.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-trade-edit]");
    if (editButton && section.contains(editButton)) {
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
      const key = `${deleteButton.dataset.tradeCollection}:${deleteButton.dataset.tradeIndex}`;
      const trade = timelineTradeRegistry.get(key);
      if (!trade) {
        return;
      }

      const confirmed = window.confirm(
        `정말 삭제하실건가요?\n\n거래내역에서 제거합니다.\n대상: ${getDisplayAssetName({
          asset: trade.asset,
          symbol: trade.symbol,
          market: getMarketLabelFromMetaMarket(trade.market),
        })}`
      );
      if (!confirmed) {
        return;
      }

      deleteButton.disabled = true;
      deleteTimelineTrade(trade).catch((error) => {
        console.error(error);
        deleteButton.disabled = false;
        window.alert(error.message || "거래 삭제에 실패했습니다.");
      });
      return;
    }

    const toggle = event.target.closest(".timeline-toggle");
    if (!toggle || !section.contains(toggle)) {
      return;
    }

    const group = toggle.closest(".timeline-group");
    const panel = group?.querySelector(".timeline-panel");
    const willOpen = toggle.getAttribute("aria-expanded") !== "true";
    toggleDisclosure(group, toggle, panel, willOpen);
  });

  section.dataset.timelineBound = "true";
}

function renderChartStats(charts) {
  const bestReturn = Array.isArray(charts.returnsComparison) ? charts.returnsComparison[0] : null;
  setChartStat(
    "#returns-chart-stat",
    "상대 강도",
    bestReturn ? `${bestReturn.label} ${formatPercent(bestReturn.returnRate)}` : "데이터 없음"
  );

  const latestHistory = Array.isArray(charts.realizedHistory)
    ? charts.realizedHistory[charts.realizedHistory.length - 1]
    : null;
  setChartStat(
    "#realized-chart-stat",
    "매도 체결 누적",
    latestHistory ? formatSignedCurrency(latestHistory.cumulativePnl) : formatCurrency(0)
  );
}

function setChartStat(selector, label, value) {
  const element = document.querySelector(selector);
  if (!element) {
    return;
  }
  element.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
}

function destroyCharts() {
  chartRegistry.forEach((chart) => chart.destroy());
  chartRegistry = [];
}

function renderChartUnavailable(selector, message) {
  const canvas = document.querySelector(selector);
  if (!canvas || !canvas.parentElement) {
    return;
  }
  canvas.parentElement.innerHTML = `<div class="chart-empty">${message}</div>`;
}

function readChartTheme() {
  const root = getComputedStyle(document.documentElement);
  return {
    accent: root.getPropertyValue("--accent").trim(),
    cash: root.getPropertyValue("--cash").trim(),
    gain: root.getPropertyValue("--gain").trim(),
    loss: root.getPropertyValue("--loss").trim(),
    priceUp: root.getPropertyValue("--price-up").trim(),
    priceDown: root.getPropertyValue("--price-down").trim(),
    muted: root.getPropertyValue("--muted").trim(),
    mutedStrong: root.getPropertyValue("--muted-strong").trim(),
    text: root.getPropertyValue("--text-strong").trim(),
    lineStrong: root.getPropertyValue("--line-strong").trim(),
    grid: alpha(root.getPropertyValue("--cash").trim(), 0.14),
    surface: alpha(root.getPropertyValue("--bg").trim() || "#040b0b", 0.9),
    sans: root.getPropertyValue("--font-sans").trim(),
    mono: root.getPropertyValue("--font-mono").trim(),
  };
}

async function requestAssetChartSnapshot({ market, symbol, name, range = "1M", granularity = "day" }) {
  const url = new URL("./api/asset-chart", window.location.origin);
  url.searchParams.set("market", market);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("name", name || symbol);
  url.searchParams.set("range", range);
  url.searchParams.set("granularity", granularity);

  const response = await fetchWithAccess(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "차트 데이터를 불러오지 못했습니다.");
  }

  return payload;
}

function destroyAssetChartModalChart() {
  if (assetDetailChart) {
    assetDetailChart.destroy();
    assetDetailChart = null;
  }
}

function ensureAssetChartCanvas() {
  const wrap = document.querySelector("#asset-chart-canvas-wrap");
  if (!wrap) {
    return null;
  }

  wrap.innerHTML = `<canvas id="asset-chart-canvas"></canvas>`;
  return wrap.querySelector("#asset-chart-canvas");
}

function clearAssetChartRefreshTimer() {
  if (assetChartRefreshTimer) {
    window.clearTimeout(assetChartRefreshTimer);
    assetChartRefreshTimer = null;
  }
}

function setAssetChartCanvasMessage(message) {
  const wrap = document.querySelector("#asset-chart-canvas-wrap");
  if (!wrap) {
    return;
  }

  destroyAssetChartModalChart();
  wrap.innerHTML = `<div class="chart-empty">${escapeHtml(message)}</div>`;
}

function formatAssetChartValue(value, market) {
  return market === "us-stock" ? formatUsd(value) : formatCurrency(value);
}

function getAssetChartRefreshIntervalSeconds(market) {
  if (market === "crypto") {
    return Math.max(10, Number(currentPortfolioData?.live?.cryptoRefreshIntervalSeconds || 10));
  }

  return Math.max(60, Number(currentPortfolioData?.live?.marketRefreshIntervalSeconds || 120));
}

function setActiveAssetChartGranularity(granularity = "day") {
  document.querySelectorAll("[data-asset-chart-granularity]").forEach((button) => {
    const isActive = button.dataset.assetChartGranularity === granularity;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function renderAssetChartRangeTabs(granularity = assetChartState.granularity || "day", rangeKey = assetChartState.range || "1M") {
  const ranges = getAssetChartRanges(granularity);
  document.querySelectorAll("[data-asset-chart-range]").forEach((button, index) => {
    const range = ranges[index];
    if (!range) {
      button.hidden = true;
      return;
    }

    button.hidden = false;
    button.dataset.assetChartRange = range.key;
    button.textContent = range.label;
    const isActive = range.key === rangeKey;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function setActiveAssetChartRange(rangeKey = "1M", granularity = assetChartState.granularity || "day") {
  renderAssetChartRangeTabs(granularity, rangeKey);
}

function syncAssetChartRangeVisibility(granularity = "day") {
  const nextGranularity = granularity === "minute" ? "minute" : "day";
  const ranges = getAssetChartRanges(nextGranularity);
  const fallbackRange = getDefaultAssetChartRange(nextGranularity);
  const isSupported = ranges.some((item) => item.key === assetChartState.range);
  const nextRange = isSupported ? assetChartState.range : fallbackRange;

  assetChartState = {
    ...assetChartState,
    granularity: nextGranularity,
    range: nextRange,
  };

  renderAssetChartRangeTabs(nextGranularity, nextRange);
}

function renderAssetChartRefreshHint(snapshot = null) {
  const target = document.querySelector("#asset-chart-refresh");
  if (!target) {
    return;
  }

  const intervalSeconds = getAssetChartRefreshIntervalSeconds(assetChartState.market);
  const updatedAt = snapshot?.summary?.updatedAt ? formatDateTime(snapshot.summary.updatedAt) : "";
  const intervalLabel =
    assetChartState.market === "crypto"
      ? `자동 갱신 ${intervalSeconds}초`
      : `자동 갱신 ${intervalSeconds}초`;

  target.textContent = updatedAt ? `${intervalLabel} · 최근 반영 ${updatedAt}` : `${intervalLabel} · 새 차트 대기 중`;
}

function scheduleAssetChartAutoRefresh() {
  clearAssetChartRefreshTimer();

  const modal = document.querySelector("#asset-chart-modal");
  if (!modal || modal.hidden || !assetChartState.market || !assetChartState.symbol) {
    return;
  }

  const nextDelay = getAssetChartRefreshIntervalSeconds(assetChartState.market) * 1000;
  assetChartRefreshTimer = window.setTimeout(() => {
    if (document.hidden || modal.hidden) {
      scheduleAssetChartAutoRefresh();
      return;
    }

    loadAssetChartModal({ silent: true });
  }, nextDelay);
}

function renderAssetChartStats(snapshot) {
  const stats = document.querySelector("#asset-chart-stats");
  if (!stats) {
    return;
  }

  const market = snapshot?.instrument?.market || "";
  const latest = Number(snapshot?.summary?.latest || 0);
  const changeAmount = Number(snapshot?.summary?.changeAmount || 0);
  const changePercent = Number(snapshot?.summary?.changePercent || 0);
  const updatedAt = snapshot?.summary?.updatedAt ? formatDateTime(snapshot.summary.updatedAt) : "시간 정보 없음";

  stats.innerHTML = `
    <article class="asset-chart-stat">
      <span>현재가</span>
      <strong>${escapeHtml(formatAssetChartValue(latest, market))}</strong>
    </article>
    <article class="asset-chart-stat">
      <span>${escapeHtml(snapshot?.rangeLabel || "기간 변화")}</span>
      <strong class="${getSignedPriceToneClass(changeAmount)}">${escapeHtml(
        `${market === "us-stock" ? formatSignedUsd(changeAmount) : formatSignedCurrency(changeAmount)} · ${formatSignedPercent(changePercent)}`
      )}</strong>
    </article>
    <article class="asset-chart-stat">
      <span>업데이트</span>
      <strong>${escapeHtml(updatedAt)}</strong>
    </article>
  `;
}

function renderAssetChart(snapshot) {
  const title = document.querySelector("#asset-chart-title");
  const summary = document.querySelector("#asset-chart-summary");
  const footnote = document.querySelector("#asset-chart-footnote");
  const points = Array.isArray(snapshot?.points) ? snapshot.points : [];

  if (title) {
    title.textContent = snapshot?.instrument?.name || "종목 차트";
  }
  if (summary) {
    summary.textContent = `${snapshot?.rangeLabel || "최근 흐름"} · ${snapshot?.sourceLabel || "일봉"}`;
  }
  if (footnote) {
    footnote.textContent =
      snapshot?.instrument?.market === "us-stock"
        ? snapshot?.granularity === "minute"
          ? "미국주식 분봉은 선택 기간에 맞는 장중 흐름으로 보여주며, 장중에는 120초 · 장마감에는 900초 주기로 다시 불러옵니다."
          : "미국주식 일봉은 선택한 기간 기준 종가 흐름으로 보여주며, 장중에는 120초 · 장마감에는 900초 주기로 다시 불러옵니다."
        : snapshot?.granularity === "minute"
          ? "암호화폐 분봉은 선택 기간에 맞는 분봉 흐름으로 보여주며, 차트가 열려 있으면 10초마다 다시 불러옵니다."
          : "암호화폐 일봉은 선택한 기간 기준 업비트 일봉 흐름으로 보여주며, 차트가 열려 있으면 10초마다 다시 불러옵니다.";
  }

  renderAssetChartStats(snapshot);
  renderAssetChartRefreshHint(snapshot);

  if (!window.Chart) {
    setAssetChartCanvasMessage("Chart.js 로드 실패");
    return;
  }

  if (!points.length) {
    setAssetChartCanvasMessage("차트 데이터가 없습니다.");
    return;
  }

  destroyAssetChartModalChart();
  const canvas = ensureAssetChartCanvas();
  if (!canvas) {
    return;
  }

  const theme = readChartTheme();
  const market = snapshot?.instrument?.market || "";
  const changeAmount = Number(snapshot?.summary?.changeAmount || 0);
  const lineColor = changeAmount >= 0 ? theme.priceUp : theme.priceDown;

  assetDetailChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: points.map((item) => item.label),
      datasets: [
        {
          label: "종가",
          data: points.map((item) => item.close),
          borderColor: lineColor,
          backgroundColor: alpha(lineColor, 0.12),
          fill: true,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.28,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      scales: {
        x: {
          grid: {
            color: alpha(theme.cash, 0.08),
          },
          ticks: {
            color: theme.muted,
            font: {
              family: theme.mono,
            },
          },
        },
        y: {
          grid: {
            color: theme.grid,
          },
          ticks: {
            color: theme.muted,
            font: {
              family: theme.mono,
            },
            callback(value) {
              return market === "us-stock" ? formatUsd(value) : formatCompactCurrency(value);
            },
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "rgba(5, 12, 12, 0.94)",
          borderColor: theme.lineStrong,
          borderWidth: 1,
          titleColor: theme.text,
          bodyColor: theme.text,
          padding: 14,
          titleFont: {
            family: theme.sans,
            weight: "700",
          },
          bodyFont: {
            family: theme.sans,
          },
          callbacks: {
            label(context) {
              const point = points[context.dataIndex];
              if (!point) {
                return "";
              }

              return [
                `종가: ${formatAssetChartValue(point.close, market)}`,
                `고가: ${formatAssetChartValue(point.high, market)}`,
                `저가: ${formatAssetChartValue(point.low, market)}`,
              ];
            },
          },
        },
      },
    },
  });
}

function closeAssetChartModal() {
  const modal = document.querySelector("#asset-chart-modal");
  if (!modal) {
    return;
  }

  clearAssetChartRefreshTimer();
  destroyAssetChartModalChart();
  modal.hidden = true;
  document.body.classList.remove("asset-chart-open");
}

async function loadAssetChartModal(options = {}) {
  const { silent = false } = options;
  const modal = document.querySelector("#asset-chart-modal");
  const title = document.querySelector("#asset-chart-title");
  const summary = document.querySelector("#asset-chart-summary");
  const stats = document.querySelector("#asset-chart-stats");
  const footnote = document.querySelector("#asset-chart-footnote");
  const market = assetChartState.market;
  const symbol = assetChartState.symbol;
  const name = assetChartState.name;
  const range = assetChartState.range || "1M";
  const granularity = assetChartState.granularity || "day";

  if (!modal || !market || !symbol) {
    return;
  }

  clearAssetChartRefreshTimer();

  if (title) {
    title.textContent = name || symbol || "종목 차트";
  }
  if (summary && !silent) {
    summary.textContent = "최근 흐름을 불러오는 중입니다.";
  }
  if (stats && !silent) {
    stats.innerHTML = "";
  }
  if (footnote && !silent) {
    footnote.textContent = "";
  }
  if (!silent) {
    setAssetChartCanvasMessage("차트 데이터를 불러오는 중입니다.");
  }
  renderAssetChartRefreshHint();

  try {
    const snapshot = await requestAssetChartSnapshot({ market, symbol, name, range, granularity });
    renderAssetChart(snapshot);
    scheduleAssetChartAutoRefresh();
  } catch (error) {
    if (summary) {
      summary.textContent = error.message || "차트 데이터를 불러오지 못했습니다.";
    }
    setAssetChartCanvasMessage(error.message || "차트 데이터를 불러오지 못했습니다.");
    renderAssetChartRefreshHint();
    scheduleAssetChartAutoRefresh();
  }
}

async function openAssetChartModal({ market, symbol, name, range = "1M", granularity = "day" }) {
  const modal = document.querySelector("#asset-chart-modal");
  if (!modal) {
    return;
  }

  clearAssetChartRefreshTimer();
  const nextGranularity = granularity === "minute" ? "minute" : "day";
  const supportedRanges = getAssetChartRanges(nextGranularity);
  const nextRange = supportedRanges.some((item) => item.key === range) ? range : getDefaultAssetChartRange(nextGranularity);
  assetChartState = {
    market,
    symbol,
    name,
    range: nextRange,
    granularity: nextGranularity,
  };

  setActiveAssetChartGranularity(nextGranularity);
  syncAssetChartRangeVisibility(nextGranularity);
  modal.hidden = false;
  document.body.classList.add("asset-chart-open");
  await loadAssetChartModal();
}

function bindPriceStripInteractions() {
  const strip = document.querySelector("#price-strip");
  const modal = document.querySelector("#asset-chart-modal");
  if (strip && strip.dataset.chartBound !== "true") {
    strip.addEventListener("click", (event) => {
      if (Date.now() < interactionLockUntil || document.body.classList.contains("access-locked")) {
        return;
      }

      const trigger = event.target.closest("[data-asset-chart-trigger]");
      if (!trigger || !strip.contains(trigger)) {
        return;
      }

      openAssetChartModal({
        market: trigger.dataset.assetChartMarket || "",
        symbol: trigger.dataset.assetChartSymbol || "",
        name: trigger.dataset.assetChartName || "",
      });
    });
    strip.dataset.chartBound = "true";
  }

  if (modal && modal.dataset.bound !== "true") {
    modal.addEventListener("click", (event) => {
      const granularityButton = event.target.closest("[data-asset-chart-granularity]");
      if (granularityButton && modal.contains(granularityButton)) {
        const nextGranularity = granularityButton.dataset.assetChartGranularity || "day";
        setActiveAssetChartGranularity(nextGranularity);
        syncAssetChartRangeVisibility(nextGranularity);
        loadAssetChartModal();
        return;
      }

      const rangeButton = event.target.closest("[data-asset-chart-range]");
      if (rangeButton && modal.contains(rangeButton)) {
        const nextRange = rangeButton.dataset.assetChartRange || "1M";
        if (assetChartState.range !== nextRange) {
          assetChartState = {
            ...assetChartState,
            range: nextRange,
          };
          setActiveAssetChartRange(nextRange, assetChartState.granularity);
          loadAssetChartModal();
        }
        return;
      }

      if (event.target === modal || event.target.closest("[data-asset-chart-close]")) {
        closeAssetChartModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) {
        closeAssetChartModal();
      }
    });

    modal.dataset.bound = "true";
  }
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
      marketRefreshIntervalSeconds: 120,
      quotes: {},
      fx: {
        usdkrw: null,
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
      marketRefreshIntervalSeconds: 120,
      quotes: {},
      fx: {
        usdkrw: null,
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
    available: Boolean(liveSnapshot.portfolioLive || Object.keys(liveSnapshot.quotes || {}).length),
    updatedAt: liveSnapshot.live?.updatedAt || liveSnapshot.updatedAt || null,
    refreshIntervalSeconds: liveSnapshot.live?.refreshIntervalSeconds || 10,
    cryptoRefreshIntervalSeconds: liveSnapshot.live?.cryptoRefreshIntervalSeconds || 10,
    marketRefreshIntervalSeconds: liveSnapshot.live?.marketRefreshIntervalSeconds || 120,
    quotes: liveSnapshot.quotes || {},
    fx: liveSnapshot.fx || { usdkrw: null },
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
      portfolioLive: null,
      live: {
        updatedAt: null,
        refreshIntervalSeconds: 10,
        cryptoRefreshIntervalSeconds: 10,
        marketRefreshIntervalSeconds: 120,
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
  next.live.marketRefreshIntervalSeconds = next.live.marketRefreshIntervalSeconds || 120;
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
  const cryptoRefresh = live?.cryptoRefreshIntervalSeconds || live?.refreshIntervalSeconds || 10;
  const marketRefresh = live?.marketRefreshIntervalSeconds || 120;
  const marketPhaseCopy = marketRefresh >= 900 ? "현재 장마감 900초 적용" : "현재 장중 120초 적용";
  const refreshCopy = `코인 ${cryptoRefresh}초 · 미국주식 장중 120초 / 장마감 900초 · ${marketPhaseCopy}`;

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
    const fallbackPriceKrw = quantity > 0 ? valuation / quantity : averagePrice;
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
      market: item.market || (item.platform === "업비트" ? "crypto" : "kr-stock"),
      currency: item.currency || (item.market === "us-stock" ? "USD" : "KRW"),
      priceSource: item.priceSource || "",
      quantity,
      averagePrice,
      valuation,
      returnRate: Number(item.returnRate || 0),
      currentPriceKrw,
      currentPriceUsd,
      currentPrice:
        item.currency === "USD" && Number.isFinite(currentPriceUsd) ? currentPriceUsd : currentPriceKrw,
      liveQuote: {
        name: item.name || item.asset,
        symbol: item.symbol || "",
        market: item.market || (item.platform === "업비트" ? "crypto" : "kr-stock"),
        available: currentPriceKrw > 0,
        price: item.currency === "USD" && Number.isFinite(currentPriceUsd) ? currentPriceUsd : currentPriceKrw,
        priceKrw: currentPriceKrw || null,
        priceUsd: Number.isFinite(currentPriceUsd) ? currentPriceUsd : null,
        changePercent: Number.isFinite(Number(item.liveQuote?.changePercent)) ? Number(item.liveQuote.changePercent) : null,
        kimchiPremiumPercent: Number.isFinite(Number(item.liveQuote?.kimchiPremiumPercent))
          ? Number(item.liveQuote.kimchiPremiumPercent)
          : null,
        globalPriceKrw: Number.isFinite(Number(item.liveQuote?.globalPriceKrw)) ? Number(item.liveQuote.globalPriceKrw) : null,
        globalPriceUsd: Number.isFinite(Number(item.liveQuote?.globalPriceUsd)) ? Number(item.liveQuote.globalPriceUsd) : null,
        globalUpdatedAt: item.liveQuote?.globalUpdatedAt || null,
        isMarketOpen: item.liveQuote?.isMarketOpen ?? null,
        isDelayed: item.liveQuote ? Boolean(item.liveQuote.isDelayed) : true,
        updatedAt: item.liveQuote?.updatedAt || null,
        error: item.liveQuote?.error || null,
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
        <span class="targets-item-badge targets-item-badge--${tone}">${escapeHtml(getTargetBadgeLabel(item))}</span>
      </div>
      <div class="targets-item-foot">
        <div class="targets-item-price">
          <strong class="${movementClass}">${escapeHtml(formatTargetPricePrimary(quote, item, fx))}</strong>
          <span class="${movementClass}">${escapeHtml(
            formatQuoteSecondary(quote, item, {
              includeKimchiPremium: item.market === "crypto",
              includeKrwForUsStock: false,
            })
          )}</span>
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

function buildInstrumentMeta(instrument, quote) {
  const scopeCopy = buildMarketLabel(instrument.market);
  const statusCopy = quote?.isDelayed ? "업데이트 지연" : null;

  return [instrument.symbol || scopeCopy, statusCopy || scopeCopy].filter(Boolean).join(" · ");
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

function getTargetBadgeLabel(item) {
  return item.market === "us-stock" ? "USD" : item.market === "crypto" ? "KRW" : "관심";
}

function buildLiveTimestampCopy(live) {
  if (!live?.updatedAt) {
    return "마지막 갱신 대기 중";
  }

  return `마지막 갱신 ${formatDateTime(live.updatedAt)}`;
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
    return "연결 대기";
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
    return [{ text: quote?.error || "실시간 연결 준비 중", tone: "price-move-neutral" }];
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
  if (element) {
    element.textContent = value ?? "";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function tableCell(label, value, className = "") {
  const normalizedClass = className.trim();
  const classAttribute = normalizedClass ? ` class="${normalizedClass}"` : "";
  return `<td data-label="${label}"${classAttribute}>${value}</td>`;
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

function formatRatePercent(value, digits = 3) {
  return `${(Number(value || 0) * 100).toFixed(digits)}%`;
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

function formatCompactNumber(value) {
  return compactNumberFormatter.format(value || 0);
}

function formatCompactCurrency(value) {
  return `${formatCompactNumber(value)}원`;
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
  text("#basis-date", formatCurrentDateLabel(now));
}

function renderRealizedChartNote(metadata = {}) {
  const note = document.querySelector("#realized-chart-note");
  if (!note) {
    return;
  }

  const performanceLabel = formatPerformanceStartLabel(metadata?.realizedPerformanceStartDate);
  note.textContent = performanceLabel
    ? `${performanceLabel} 이후 매도 체결만 누적 실현손익에 반영합니다.`
    : "실시간 가격이 아니라 실제 매도 체결이 생길 때만 바뀝니다.";
}

function scheduleCurrentDateBadgeRefresh() {
  renderCurrentDateBadge();

  if (currentDateBadgeTimer) {
    window.clearTimeout(currentDateBadgeTimer);
  }

  const now = new Date();
  const nextRefreshAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
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
  const match = String(value || "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return formatCurrentMonthDay();
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

// 거래 추가 모달 관리
function initTradeModal() {
  const BROKER_OPTIONS_BY_MARKET = {
    국내주식: ["카카오증권", "미래에셋"],
    미국주식: ["카카오증권", "미래에셋"],
    암호화폐: ["업비트"],
  };
  const ESTIMATED_FEE_RATES = {
    암호화폐: {
      업비트: 0.0005,
    },
    국내주식: {
      카카오증권: 0.00015,
      미래에셋: 0.00014,
    },
    미국주식: {
      카카오증권: 0.001,
      미래에셋: 0.0025,
    },
  };

  const modal = document.querySelector("#trade-modal");
  const openBtn = document.querySelector("#btn-add-trade");
  const form = document.querySelector("#trade-form");
  const modalEyebrow = document.querySelector("#trade-modal-eyebrow");
  const modalTitle = document.querySelector("#trade-modal-title");
  const modalHelper = document.querySelector("#trade-modal-helper");
  const tradeDateInput = document.querySelector("#trade-date");
  const tradeMonthSelect = document.querySelector("#trade-date-month");
  const tradeDaySelect = document.querySelector("#trade-date-day");
  const marketSelect = document.querySelector("#trade-market");
  const assetInput = document.querySelector("#trade-asset");
  const assetSuggestionPanel = document.querySelector("#trade-asset-suggestions");
  const brokerInput = document.querySelector("#trade-broker");
  const brokerGroup = document.querySelector("[data-trade-broker-group]");
  const brokerHelp = document.querySelector("#trade-broker-help");
  const priceLabel = document.querySelector("#trade-price-label");
  const priceHelp = document.querySelector("#trade-price-help");
  const quantityInput = document.querySelector("#trade-quantity");
  const priceInput = document.querySelector("#trade-price");
  const amountInput = document.querySelector("#trade-amount");
  const sideSelect = document.querySelector("#trade-side");
  const stageSelect = document.querySelector("#trade-stage");
  const feeInput = document.querySelector("#trade-fee");
  const summaryBroker = document.querySelector("#trade-summary-broker");
  const summaryAmount = document.querySelector("#trade-summary-amount");
  const summaryFee = document.querySelector("#trade-summary-fee");
  const assetChips = [...document.querySelectorAll("[data-asset-chip]")];
  const status = document.querySelector("#trade-form-status");
  const submitButton = form?.querySelector(".btn-primary");
  const cancelButton = form?.querySelector(".btn-secondary");
  let editingTradeRef = null;

  if (!modal || !openBtn || !form) {
    console.error("거래 추가 모달 요소를 찾을 수 없습니다");
    return;
  }

  const setStatus = (message = "", tone = "neutral") => {
    if (!status) {
      return;
    }

    status.textContent = message;
    status.dataset.tone = tone;
  };

  const setSubmitting = (isSubmitting) => {
    if (submitButton) {
      submitButton.disabled = isSubmitting;
      if (isSubmitting) {
        submitButton.textContent = editingTradeRef ? "수정 중..." : "저장 중...";
      } else {
        submitButton.textContent = editingTradeRef ? "수정 저장" : "저장";
      }
    }
    if (cancelButton) {
      cancelButton.disabled = isSubmitting;
    }
  };

  const setModalMode = (mode = "create") => {
    const isEditing = mode === "edit";
    editingTradeRef = isEditing ? editingTradeRef : null;

    if (modalEyebrow) {
      modalEyebrow.textContent = isEditing ? "Edit Trade" : "Quick Entry";
    }
    if (modalTitle) {
      modalTitle.textContent = isEditing ? "거래 수정" : "거래 추가";
    }
    if (modalHelper) {
      modalHelper.textContent = isEditing
        ? "기존 거래를 수정하면 보유수량과 손익도 함께 다시 계산됩니다."
        : "날짜와 체결값만 넣으면 거래금액은 계산되고, 수수료 기준은 플랫폼에 맞춰 고정됩니다.";
    }
    if (submitButton) {
      submitButton.textContent = isEditing ? "수정 저장" : "저장";
    }
    marketSelect.disabled = isEditing;
  };

  const formatTradeAssetInputValue = (trade) => {
    const suggestion =
      resolveBestAssetAutocomplete(trade.market, trade.symbol || trade.asset) || resolveBestAssetAutocomplete(trade.market, trade.asset);
    if (suggestion) {
      return suggestion.value;
    }

    const marketValue =
      trade.market === "암호화폐" ? "crypto" : trade.market === "미국주식" ? "us-stock" : trade.market === "국내주식" ? "kr-stock" : "";
    return formatAssetInputValue({
      name: trade.asset,
      asset: trade.asset,
      symbol: trade.symbol || "",
      market: marketValue,
    }, trade.market);
  };

  const parseBasisMonthDay = () => {
    return formatCurrentMonthDay();
  };

  const formatEditableNumber = (value, decimals = 8) => {
    if (value == null || Number.isNaN(Number(value))) {
      return "";
    }

    return Number(Number(value).toFixed(decimals)).toString();
  };

  const normalizeTradeAssetName = (value, market) => {
    const raw = String(value || "").trim();
    const upper = raw.toUpperCase();

    if (market === "암호화폐") {
      if (["BTC", "비트코인", "비트코인(BTC)"].includes(raw) || upper === "BTC") {
        return "비트코인";
      }
      if (["ETH", "이더리움", "이더리움(ETH)"].includes(raw) || upper === "ETH") {
        return "ETH";
      }
      if (["XRP", "엑스알피", "엑스알피(XRP)", "엑스알피(리플)", "리플"].includes(raw) || upper === "XRP") {
        return "XRP";
      }
    }

    if (market === "미국주식") {
      if (
        ["PLTR", "팔란티어", "Palantir Technologies", "Palantir Technologies (PLTR)"].includes(raw) ||
        upper === "PLTR"
      ) {
        return "팔란티어";
      }
      if (
        ["CRCL", "써클", "Circle Internet Group", "Circle Internet Group (CRCL)"].includes(raw) ||
        upper === "CRCL"
      ) {
        return "써클";
      }
    }

    if (market === "국내주식" && raw === "에스케이하이닉스") {
      return "SK하이닉스";
    }

    return raw;
  };

  const parseFormattedNumber = (value) => {
    const numeric = Number(String(value || "").replaceAll(",", "").trim());
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const formatGroupedInputValue = (value) => {
    const sanitized = String(value || "")
      .replace(/[^\d.]/g, "")
      .replace(/^(\.)+/, "")
      .replace(/(\..*)\./g, "$1");

    if (!sanitized) {
      return "";
    }

    const [integerPartRaw, decimalPart] = sanitized.split(".");
    const integerPart = integerPartRaw.replace(/^0+(?=\d)/, "") || integerPartRaw || "0";
    const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return decimalPart !== undefined ? `${groupedInteger}.${decimalPart}` : groupedInteger;
  };

  const syncFormattedNumericField = (input) => {
    if (!input) {
      return;
    }

    input.value = formatGroupedInputValue(input.value);
  };
  const autocomplete = setupAssetAutocomplete({
    input: assetInput,
    marketSelect,
    panel: assetSuggestionPanel,
    asyncSource: fetchRemoteAssetSuggestions,
    disabledMarkets: ["미국주식"],
    onSelect: () => {
      syncAssetChipState();
    },
  });

  const renderBrokerOptions = (market, preferredValue = "") => {
    if (!brokerInput) {
      return;
    }

    const options = BROKER_OPTIONS_BY_MARKET[market] || [];
    const isCrypto = market === "암호화폐";
    const resolvedValue = options.includes(preferredValue) ? preferredValue : isCrypto ? "업비트" : "";
    brokerInput.innerHTML = `
      ${isCrypto ? "" : '<option value="">플랫폼 선택</option>'}
      ${options
        .map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`)
        .join("")}
    `;
    brokerInput.value = resolvedValue;
  };

  const populateTradeStageOptions = (selectedValue = "") => {
    if (!stageSelect) {
      return;
    }

    stageSelect.innerHTML = buildTradeStageOptionsMarkup(selectedValue);
  };

  const getActiveBroker = () => {
    return marketSelect.value === "암호화폐" ? "업비트" : String(brokerInput?.value || "").trim();
  };

  const getEstimatedFeeRate = (broker, market) => {
    return ESTIMATED_FEE_RATES?.[market]?.[broker] ?? null;
  };

  const buildFeePolicyCopy = (broker, market, side) => {
    if (!broker || !market) {
      return "플랫폼 선택 필요";
    }

    const brokerageRate = getEstimatedFeeRate(broker, market);
    if (brokerageRate == null) {
      return "기준 없음";
    }

    const feeCopy = `거래수수료 ${formatRatePercent(brokerageRate, 3)}`;
    if (market === "국내주식" && side === "매도") {
      return `${feeCopy} + 거래세 ${formatRatePercent(0.002, 3)}`;
    }

    if (market === "미국주식" && side === "매도") {
      return `${feeCopy} · 현지 fee 별도`;
    }

    return feeCopy;
  };

  const syncTradeSummary = () => {
    if (summaryBroker) {
      summaryBroker.textContent = getActiveBroker() || "입력 필요";
    }
    if (summaryAmount) {
      summaryAmount.textContent = formatCurrency(Number(amountInput.value || 0));
    }
    if (summaryFee) {
      summaryFee.textContent = buildFeePolicyCopy(getActiveBroker(), marketSelect.value, sideSelect.value);
    }
  };

  const syncAssetChipState = () => {
    const market = marketSelect.value;
    const asset = normalizeTradeAssetName(assetInput?.value || "", market).toUpperCase();
    assetChips.forEach((chip) => {
      const chipMarket = chip.dataset.market || "";
      const chipAsset = normalizeTradeAssetName(chip.dataset.asset || chip.dataset.displayAsset || "", chipMarket).toUpperCase();
      chip.hidden = chipMarket !== market;
      chip.classList.toggle("is-active", chipMarket === market && chipAsset === asset);
    });
  };

  const calculateFee = () => {
    const broker = getActiveBroker();
    const market = marketSelect.value;
    const side = sideSelect.value;
    const amount = parseFloat(amountInput.value) || 0;

    if (!broker || !side || !amount) {
      feeInput.value = "0";
      syncTradeSummary();
      return;
    }

    const brokerageRate = getEstimatedFeeRate(broker, market);
    if (brokerageRate == null) {
      feeInput.value = "0";
      syncTradeSummary();
      return;
    }

    let fee = amount * brokerageRate;

    if (market === "국내주식" && side === "매도") {
      fee += amount * 0.002;
    }

    feeInput.value = formatEditableNumber(fee, 8) || "0";
    syncTradeSummary();
  };

  const calculateAmount = () => {
    const quantity = parseFormattedNumber(quantityInput.value);
    const price = parseFormattedNumber(priceInput.value);
    const amount = quantity * price;
    amountInput.value = formatEditableNumber(amount) || "0";
    calculateFee();
  };

  const syncTradeFormMode = () => {
    const market = marketSelect.value || "암호화폐";
    const isCrypto = market === "암호화폐";
    const isUsStock = market === "미국주식";

    marketSelect.value = market;

    if (brokerGroup) {
      brokerGroup.hidden = isCrypto;
    }

    if (brokerInput) {
      const currentBroker = brokerInput.value;
      renderBrokerOptions(market, currentBroker);
      brokerInput.required = !isCrypto;
    }

    if (assetInput) {
      assetInput.placeholder =
        market === "국내주식"
          ? "삼성전자(005930)"
          : market === "미국주식"
            ? "Apple Inc. (AAPL)"
            : "솔라나(SOL)";
    }

    if (priceLabel) {
      priceLabel.textContent = isUsStock ? "단가 (원화 기준)" : "단가 (원)";
    }

    if (priceInput) {
      priceInput.placeholder = "0";
    }

    if (priceHelp) {
      priceHelp.textContent = isUsStock
        ? "미국주식은 영문 회사명 또는 티커로 입력하고, 체결 단가는 원화 기준으로 적습니다."
        : isCrypto
          ? "업비트 체결 단가 기준으로 입력합니다."
          : "체결 단가 기준으로 입력합니다.";
    }

    if (brokerHelp) {
      brokerHelp.textContent = isCrypto
        ? "업비트 거래수수료 0.050% 기준입니다. 출금 수수료는 거래가 아니라 별도라 앱 계산에 포함하지 않습니다."
        : isUsStock
          ? "카카오증권 0.100%, 미래에셋 0.250% 거래수수료 기준입니다. 미국주식 매도 시 현지 유관기관 fee가 추가될 수 있으며 앱 계산에는 아직 포함하지 않습니다."
          : "카카오증권 0.015%, 미래에셋 0.014% 거래수수료 기준입니다. 국내주식 매도 시 거래세 0.200%를 더하고, 유관기관 제비용은 앱 계산에 아직 포함하지 않습니다.";
    }

    syncAssetChipState();
    calculateAmount();
  };

  const populateTradeMonthOptions = (selectedMonth = new Date().getMonth() + 1) => {
    if (!tradeMonthSelect) {
      return;
    }

    tradeMonthSelect.innerHTML = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      return `<option value="${month}" ${month === selectedMonth ? "selected" : ""}>${month}월</option>`;
    }).join("");
  };

  const populateTradeDayOptions = (selectedDay = new Date().getDate()) => {
    if (!tradeDaySelect || !tradeMonthSelect) {
      return;
    }

    const selectedMonth = Number(tradeMonthSelect.value || new Date().getMonth() + 1);
    const daysInMonth = new Date(getCurrentBasisYear(), selectedMonth, 0).getDate();
    const resolvedDay = Math.min(selectedDay, daysInMonth);
    tradeDaySelect.innerHTML = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      return `<option value="${day}" ${day === resolvedDay ? "selected" : ""}>${day}일</option>`;
    }).join("");
  };

  const syncTradeDateField = () => {
    if (!tradeDateInput || !tradeMonthSelect || !tradeDaySelect) {
      return;
    }

    const month = Number(tradeMonthSelect.value || new Date().getMonth() + 1);
    const day = String(Number(tradeDaySelect.value || new Date().getDate())).padStart(2, "0");
    tradeDateInput.value = `${month}/${day}`;
  };

  const setTradeDate = (monthDay = parseBasisMonthDay()) => {
    const [month, day] = String(monthDay || parseBasisMonthDay())
      .split("/")
      .map((segment) => Number(segment));
    const selectedMonth = month || new Date().getMonth() + 1;
    const selectedDay = day || new Date().getDate();
    populateTradeMonthOptions(selectedMonth);
    populateTradeDayOptions(selectedDay);
    syncTradeDateField();
  };

  const resetFormState = () => {
    editingTradeRef = null;
    form.reset();
    quantityInput.value = "0";
    priceInput.value = "0";
    amountInput.value = "0";
    feeInput.value = "0";
    marketSelect.value = "암호화폐";
    sideSelect.value = "매수";
    populateTradeStageOptions();
    setTradeDate(parseBasisMonthDay());
    setModalMode("create");
    syncTradeFormMode();
  };

  const openEditModal = (trade) => {
    editingTradeRef = {
      collection: trade.sourceCollection,
      index: trade.sourceIndex,
    };
    setModalMode("edit");
    form.reset();
    populateTradeStageOptions(trade.stage || "");
    setTradeDate(trade.date || parseBasisMonthDay());
    marketSelect.value = trade.market || "암호화폐";
    sideSelect.value = trade.side || "매수";
    assetInput.value = formatTradeAssetInputValue(trade);
    quantityInput.value = formatGroupedInputValue(trade.quantity);
    priceInput.value = formatGroupedInputValue(trade.price);
    if (brokerInput) {
      brokerInput.value = trade.broker || "";
    }
    if (form.elements.note) {
      form.elements.note.value = trade.note || "";
    }
    syncTradeFormMode();
    calculateAmount();
  };

  // 모달 열기
  const openModal = (trade = null) => {
    setStatus("");
    setSubmitting(false);
    if (trade) {
      openEditModal(trade);
    } else {
      resetFormState();
    }
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("is-open");
    document.body.classList.add("modal-open");
    assetInput?.focus();
  };

  openBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    finalizeMobileModalLaunch("timeline-section");
    openModal();
  });

  // 모달 닫기
  const closeModal = () => {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("is-open");
    document.body.classList.remove("modal-open");
    setStatus("");
    setSubmitting(false);
    resetFormState();
    reopenPendingMobileSection();
  };

  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-trade-modal-close]") || e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });

  quantityInput.addEventListener("input", () => {
    syncFormattedNumericField(quantityInput);
    calculateAmount();
  });
  priceInput.addEventListener("input", () => {
    syncFormattedNumericField(priceInput);
    calculateAmount();
  });
  quantityInput.addEventListener("blur", () => syncFormattedNumericField(quantityInput));
  priceInput.addEventListener("blur", () => syncFormattedNumericField(priceInput));
  tradeMonthSelect?.addEventListener("change", () => {
    populateTradeDayOptions(Number(tradeDaySelect?.value || 1));
    syncTradeDateField();
  });
  tradeDaySelect?.addEventListener("change", syncTradeDateField);
  brokerInput?.addEventListener("change", calculateFee);
  sideSelect.addEventListener("change", calculateFee);
  marketSelect.addEventListener("change", syncTradeFormMode);
  assetInput?.addEventListener("input", syncAssetChipState);
  assetChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      marketSelect.value = chip.dataset.market || "암호화폐";
      assetInput.value = chip.dataset.displayAsset || chip.dataset.asset || "";
      autocomplete.hide();
      syncTradeFormMode();
      calculateAmount();
    });
  });
  resetFormState();

  // 폼 제출
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("");
    autocomplete.syncValue();

    const formData = new FormData(form);
    const tradeData = {
      date: formatDateInputToMonthDay(formData.get("date")),
      market: formData.get("market"),
      broker: getActiveBroker(),
      asset: normalizeTradeAssetName(formData.get("asset"), formData.get("market")),
      side: formData.get("side"),
      stage: formData.get("stage") || "",
      quantity: parseFormattedNumber(formData.get("quantity")),
      price: parseFormattedNumber(formData.get("price")),
      amount: parseFloat(amountInput.value),
      fee: parseFloat(feeInput.value),
      note: formData.get("note") || "",
    };

    try {
      setSubmitting(true);
      if (editingTradeRef) {
        await applyTradeMutation("PUT", {
          collection: editingTradeRef.collection,
          index: editingTradeRef.index,
          trade: tradeData,
        });
      } else {
        await applyTradeMutation("POST", tradeData);
      }
      closeModal();
    } catch (error) {
      console.error(error);
      setStatus(error.message || (editingTradeRef ? "거래 수정에 실패했습니다." : "거래 저장에 실패했습니다."), "error");
      setSubmitting(false);
    }
  });

  tradeModalController = {
    openCreate: () => openModal(),
    openAdd: () => openModal(),
    openEdit: (trade) => openModal(trade),
  };
}
