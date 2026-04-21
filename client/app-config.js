(function initAssetBoardConfig() {
  const tradeFeePolicy = window.AssetTradeFeePolicy;

  if (!tradeFeePolicy) {
    throw new Error("AssetTradeFeePolicy is missing. Load lib/trade-fee-policy.js before client/app-config.js.");
  }

  const { INITIAL_SETUP_BROKER_OPTIONS } = tradeFeePolicy;

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
  const PENDING_MUTATIONS_STORAGE_KEY = "sniper-capital-pending-mutations-v1";
  const ACCESS_SESSION_STORAGE_KEY = "sniper-capital-access-session-v1";
  const PORTFOLIO_STORAGE_KEY = "sniper-capital-portfolio-v1";
  const ACCESS_SESSION_TTL_MS = 3 * 60 * 60 * 1000;
  const PORTFOLIO_CACHE_TTL_MS = 48 * 60 * 60 * 1000;
  const PENDING_MUTATION_RETRY_INTERVAL_MS = 15000;
  const SERVER_STATE_SYNC_INTERVAL_MS = 20000;
  const UI_PREFERENCES_SAVE_DEBOUNCE_MS = 220;
  const PULL_REFRESH_TRIGGER_PX = 72;
  const PULL_REFRESH_MAX_SHIFT_PX = 92;
  const LIVE_REFRESH_WATCHDOG_INTERVAL_MS = 3000;
  const LIVE_REFRESH_STALL_MIN_MS = 14000;
  const US_STOCK_TAX_ALLOWANCE = 2_500_000;
  const US_STOCK_TAX_RATE = 0.22;
  const EMPTY_BOARD_VARIANT = "blank-family";
  const SETTINGS_SECTION_ID = "settings-section";

  const DEFAULT_LIVE_PRICE_PREFERENCES = Object.freeze({
    showGlobalIndices: true,
  });

  const BOARD_DEFAULT_CONFIG = Object.freeze({
    variant: "personal",
    heroEyebrow: "Personal Portfolio Board",
    heroTitle: "Sniper Capital Board",
    browserTitle: "Sniper Capital Board",
  });

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

  const INITIAL_SETUP_MARKET_OPTIONS = Object.freeze([
    { value: "암호화폐", label: "암호화폐" },
    { value: "미국주식", label: "미국주식" },
    { value: "국내주식", label: "국내주식" },
  ]);

  const ASSET_CHART_RANGES = Object.freeze({
    day: Object.freeze([
      { key: "1W", label: "1주" },
      { key: "1M", label: "1개월" },
      { key: "1Y", label: "1년" },
    ]),
  });

  function getAssetChartRanges(granularity = "day") {
    return ASSET_CHART_RANGES.day;
  }

  function getDefaultAssetChartRange(granularity = "day") {
    return getAssetChartRanges(granularity)[0]?.key || "1M";
  }

  const MOBILE_SECTION_SHORTCUTS = Object.freeze([
    { id: "guide-section", eyebrow: "Guide", title: "안내", icon: "ⓘ", summary: "처음 사용할 순서를 빠르게 확인" },
    { id: "targets-section", eyebrow: "Watchlist", title: "관심종목", icon: "◎", summary: "지금 보는 후보 종목" },
    { id: "portfolio-overview-section", eyebrow: "Portfolio Mix", title: "자산 분포", icon: "◔", summary: "비중과 현금 흐름" },
    { id: "timeline-section", eyebrow: "Trade Log", title: "거래 타임라인", icon: "↗", summary: "매수·매도 기록 확인" },
    { id: "notes-section", eyebrow: "Memo Board", title: "메모", icon: "✎", summary: "투자 아이디어 정리" },
    { id: "holdings-section", eyebrow: "Positions", title: "보유 종목", icon: "◫", summary: "현재 보유 상세 보기" },
    { id: "strategy-state-section", eyebrow: "Strategy State", title: "전략 상태", icon: "◈", summary: "진입 비중과 현재 단계 관리" },
    { id: "performance-section", eyebrow: "Realized PnL", title: "실현손익 추이", icon: "∿", summary: "누적 손익 흐름 확인" },
    { id: "insights-section", eyebrow: "Defense", title: "암호화폐 방어지표", icon: "◇", summary: "암호화폐 방어 매매 기준 점검" },
    { id: "strategy-section", eyebrow: "Playbook", title: "플레이 전략", icon: "▣", summary: "매매 원칙 다시 보기" },
    { id: SETTINGS_SECTION_ID, eyebrow: "Settings", title: "세팅", icon: "⚙", summary: "보여줄 메뉴만 골라 쓰기" },
  ]);

  const LIVE_PRICE_TOGGLE_OPTIONS = Object.freeze([]);
  const MAX_TRADE_QUICK_ASSETS = 24;

  const EMPTY_BOARD_SHORTCUT_SUMMARIES = Object.freeze({
    "guide-section": "처음 사용하는 순서를 한 번에 확인합니다.",
    "targets-section": "후보 종목을 먼저 정리합니다.",
    "portfolio-overview-section": "거래가 쌓이면 자산 현황이 자동 계산됩니다.",
    "timeline-section": "매수와 매도 내역을 날짜별로 기록합니다.",
    "notes-section": "기준과 메모를 간단히 남겨둘 수 있습니다.",
    "holdings-section": "저장한 거래를 기준으로 보유 종목이 정리됩니다.",
    "strategy-state-section": "진입 단계와 비중을 따로 관리할 수 있습니다.",
    "performance-section": "실현손익 흐름을 날짜별로 확인합니다.",
    "insights-section": "특정 종목의 방어 지표를 따로 살펴봅니다.",
    [SETTINGS_SECTION_ID]: "필요한 메뉴만 남겨서 보드를 정리합니다.",
  });

  const MOBILE_DEFERRED_SECTION_DELAYS = Object.freeze({
    "strategy-state-section": 70,
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

  const STRATEGY_BUY_STAGE_TARGET_RATIOS = Object.freeze({
    관망: 0,
    정찰병: 0.1,
    "1차 진입": 0.3,
    "2차 진입": 0.4,
    "3차 진입": 0.5,
  });

  const STRATEGY_SELL_STAGE_SUMMARIES = Object.freeze({
    "1단계 익절": "평단가 +5% / 전체 보유량 기준 30% 매도",
    "2단계 익절": "평단가 +10% / 누적 60% 매도 / 남은 물량 × 0.43",
    "3단계 추적": "잔여 40% 트레일링 / 상승 시 스탑 상향, 하락 시 기존 스탑 유지",
    "가격 손절": "평단가 -5% 기준 전량 정리",
    "시간 손절": "10거래일 횡보 시 전량 정리",
  });

  function normalizeTradeStrategyStage(value = "") {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isBuyStrategyStage(stage = "") {
    return Object.prototype.hasOwnProperty.call(STRATEGY_BUY_STAGE_TARGET_RATIOS, normalizeTradeStrategyStage(stage));
  }

  function isSellStrategyStage(stage = "") {
    return Object.prototype.hasOwnProperty.call(STRATEGY_SELL_STAGE_SUMMARIES, normalizeTradeStrategyStage(stage));
  }

  function resolveStrategyBudgetRatio(stage = "") {
    return Number(STRATEGY_BUY_STAGE_TARGET_RATIOS[normalizeTradeStrategyStage(stage)] || 0);
  }

  function resolveStrategyStageSummary(stage = "") {
    const normalized = normalizeTradeStrategyStage(stage);
    if (normalized === "정찰병") {
      return "필요시 전체 보유량 기준 10% 탐색 진입";
    }
    if (isBuyStrategyStage(normalized)) {
      const ratio = resolveStrategyBudgetRatio(normalized);
      return ratio > 0 ? `전체 보유량 기준 ${Math.round(ratio * 100)}% 목표` : "현재는 관망 단계";
    }
    return STRATEGY_SELL_STAGE_SUMMARIES[normalized] || "";
  }

  function resolveTradeStrategyTone(stage = "") {
    const normalized = normalizeTradeStrategyStage(stage);
    return TRADE_STRATEGY_STAGE_OPTIONS.find((item) => item.value === normalized)?.tone || "neutral";
  }

  const METRIC_CARD_TONES = Object.freeze(["neutral", "gain", "loss"]);

  window.AssetBoardConfig = Object.freeze({
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
    ASSET_CHART_RANGES,
    getAssetChartRanges,
    getDefaultAssetChartRange,
    MOBILE_SECTION_SHORTCUTS,
    LIVE_PRICE_TOGGLE_OPTIONS,
    MAX_TRADE_QUICK_ASSETS,
    EMPTY_BOARD_SHORTCUT_SUMMARIES,
    MOBILE_DEFERRED_SECTION_DELAYS,
    TRADE_STRATEGY_STAGE_OPTIONS,
    STRATEGY_BUY_STAGE_TARGET_RATIOS,
    STRATEGY_SELL_STAGE_SUMMARIES,
    normalizeTradeStrategyStage,
    isBuyStrategyStage,
    isSellStrategyStage,
    resolveStrategyBudgetRatio,
    resolveStrategyStageSummary,
    resolveTradeStrategyTone,
    METRIC_CARD_TONES,
  });
})();
