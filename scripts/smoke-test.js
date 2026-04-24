#!/usr/bin/env node

const assert = require("assert/strict");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const accessHandler = require("../api/access");
const assetSearchHandler = require("../api/asset-search");
const livePricesHandler = require("../api/live-prices");
const portfolioHandler = require("../api/portfolio");
const { buildAssetChartSnapshot } = require("../lib/asset-chart-service");
const { getBundledPortfolioData } = require("../lib/bundled-portfolio");
const { getDefaultVisibleSections } = require("../lib/board-config");
const { getAccessFailureResponse, resolveAccessProfile } = require("../lib/access-control");
const {
  buildLivePriceSnapshot,
  MARKET_CLOSED_REFRESH_INTERVAL_SECONDS,
} = require("../lib/live-price-service");
const { buildLocalPortfolioPath } = require("../lib/storage-manifest");
const {
  createTarget,
  createTrade,
  deleteStrategyBudgetEntry,
  deleteTargetEntry,
  deleteTradeEntry,
  getCurrentPortfolio,
  initializePortfolioEntry,
  upsertStrategyBudgetEntry,
  updateUiPreferencesEntry,
  updateTradeEntry,
} = require("../lib/persisted-portfolio-service");
const {
  getPortfolioRevision,
  getStorageHealth,
  loadPersistedNotes,
  loadPersistedPortfolio,
  savePersistedNotes,
  savePersistedPortfolio,
} = require("../lib/server-state-store");
const { normalizeTradePhotoAssistResult } = require("../lib/trade-photo-assist");
const { buildTradeBook, rebuildPortfolioFromTradeBook } = require("./portfolio-store");
const { buildTradeFeeSummaryText, estimateTradeFee } = require("../lib/trade-fee-policy");

const ROOT = path.resolve(__dirname, "..");
const OWNER_CODE = "smoke-owner-code";
const GUEST_CODE = "smoke-guest-code";
const ONBOARDING_OWNER_CODE = "on42";

process.env.OWNER_ACCESS_CODE = OWNER_CODE;
process.env.GUEST_ACCESS_CODES = GUEST_CODE;
process.env.DISABLE_LOCAL_BLOB_ENV = "1";
process.env.TWELVE_DATA_API_KEY = "smoke-test-key";

function buildJsonRequest(method, body = null, headers = {}) {
  return {
    method,
    headers,
    async *[Symbol.asyncIterator]() {
      if (body != null) {
        yield Buffer.from(JSON.stringify(body));
      }
    },
  };
}

function buildGetRequest(method, url, headers = {}) {
  return {
    method,
    url,
    headers,
    socket: {
      remoteAddress: "127.0.0.1",
    },
  };
}

async function invokeJsonHandler(handler, request) {
  return new Promise((resolve, reject) => {
    const response = {
      statusCode: 200,
      headers: {},
      body: "",
      setHeader(name, value) {
        this.headers[name] = value;
      },
      writeHead(statusCode, headers = {}) {
        this.statusCode = statusCode;
        Object.assign(this.headers, headers);
      },
      end(chunk = "") {
        this.body += chunk;
        try {
          resolve({
            statusCode: this.statusCode,
            headers: this.headers,
            payload: this.body ? JSON.parse(this.body) : null,
          });
        } catch (error) {
          reject(error);
        }
      },
    };

    Promise.resolve(handler(request, response)).catch(reject);
  });
}

function extractBasisMonthDay(basisDateLabel = "") {
  const match = String(basisDateLabel).match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (!match) {
    throw new Error(`기준일 형식을 해석하지 못했습니다: ${basisDateLabel}`);
  }

  return `${Number(match[2])}/${match[3]}`;
}

async function makeTempRoot() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "asset-smoke-"));
  const dataDir = path.join(tempRoot, "data");
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(
    path.join(tempRoot, buildLocalPortfolioPath("owner")),
    `${JSON.stringify(getBundledPortfolioData(), null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(path.join(dataDir, "notes.json"), "[]\n", "utf8");
  return tempRoot;
}

async function assertModuleExports(filePath, exportedNames = []) {
  const source = await fs.readFile(filePath, "utf8");
  for (const name of exportedNames) {
    assert.match(
      source,
      new RegExp(`\\b${name}\\s*,`, "m"),
      `${path.basename(filePath)} should export ${name}`
    );
  }
}

function assertTradePhotoAssistNormalization() {
  const legacyResult = normalizeTradePhotoAssistResult(
    {
      draft: {
        date: "4/18",
        market: "암호화폐",
        broker: "업비트",
        asset: "XRP",
        side: "매수",
        quantity: 309,
        price: 2122,
      },
      confidence: { overall: 0.91 },
      warnings: ["legacy warning"],
    },
    { basisLabel: "2026.04.18 기준", marketHint: "암호화폐", brokerHint: "업비트" }
  );
  assert.equal(legacyResult.candidates.length, 1, "legacy photo-assist result should normalize to one candidate");
  assert.equal(legacyResult.label.includes("XRP"), true, "legacy photo-assist candidate label should include the asset");

  const candidateResult = normalizeTradePhotoAssistResult(
    {
      selectedIndex: 1,
      candidates: [
        {
          label: "4/18 · XRP · 매수 · 309",
          summary: "최상단 체결 후보",
          draft: {
            date: "4/18",
            market: "암호화폐",
            broker: "업비트",
            asset: "XRP",
            side: "매수",
            quantity: 309,
            price: 2122,
          },
          confidence: { overall: 0.83 },
        },
        {
          label: "4/18 · XRP · 매수 · 155",
          summary: "두 번째 후보",
          draft: {
            date: "4/18",
            market: "암호화폐",
            broker: "업비트",
            asset: "XRP",
            side: "매수",
            quantity: 155,
            price: 2118,
          },
          confidence: { overall: 0.79 },
        },
      ],
    },
    { basisLabel: "2026.04.18 기준", marketHint: "암호화폐", brokerHint: "업비트" }
  );
  assert.equal(candidateResult.candidates.length, 2, "candidate photo-assist result should preserve multiple candidates");
  assert.equal(candidateResult.selectedCandidateIndex, 1, "selected candidate index should respect the payload");
  assert.equal(candidateResult.draft.quantity, 155, "selected candidate should become the primary draft");
}

function findAvailableTargetAsset(portfolio) {
  const existing = new Set(
    (portfolio.targets?.groups || []).flatMap((group) =>
      (group.items || []).flatMap((item) => [String(item.symbol || "").trim().toUpperCase(), String(item.name || "").trim()])
    )
  );
  const candidates = [
    { market: "미국주식", asset: "SNOW" },
    { market: "미국주식", asset: "PLTR" },
    { market: "국내주식", asset: "카카오뱅크(323410)" },
    { market: "암호화폐", asset: "도지코인(DOGE)" },
  ];

  const found = candidates.find((candidate) => !existing.has(candidate.asset.toUpperCase()) && !existing.has(candidate.asset));
  if (!found) {
    throw new Error("추가 가능한 테스트용 관심종목 후보를 찾지 못했습니다.");
  }
  return found;
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

  return match;
}

function buildJsonResponse(payload, statusCode = 200) {
  return {
    ok: statusCode >= 200 && statusCode < 300,
    status: statusCode,
    async json() {
      return payload;
    },
  };
}

function buildLivePriceFetchMock(overrides = {}) {
  const baseTimestamp = 1775827800;

  return async (input) => {
    const url = new URL(String(input));

    if (url.hostname === "api.upbit.com") {
      const markets = String(url.searchParams.get("markets") || "")
        .split(",")
        .filter(Boolean);
      return buildJsonResponse(
        markets.map((market, index) => ({
          market,
          trade_price: 2000 + index * 10,
          signed_change_rate: 0.01,
        }))
      );
    }

    if (url.hostname === "api.coingecko.com") {
      const ids = String(url.searchParams.get("ids") || "")
        .split(",")
        .filter(Boolean);
      const payload = ids.reduce((result, id, index) => {
        result[id] = {
          usd: 1.5 + index,
          krw: 2200 + index * 100,
          last_updated_at: baseTimestamp,
        };
        return result;
      }, {});
      return buildJsonResponse(payload);
    }

    if (url.hostname === "api.twelvedata.com" && url.pathname === "/currency_conversion") {
      return buildJsonResponse({
        rate: "1486.02073",
      });
    }

    if (url.hostname === "api.twelvedata.com" && url.pathname === "/quote") {
      const symbol = String(url.searchParams.get("symbol") || "").trim().toUpperCase();
      if (symbol === String(overrides.failSymbol || "").trim().toUpperCase()) {
        return buildJsonResponse({ status: "error", message: `${symbol} failed` }, 500);
      }

      const closeBySymbol = {
        ORCL: "138.089996",
        AAPL: "260.48001",
        CRCL: "88.040001",
        PLTR: "128.059998",
      };

      return buildJsonResponse({
        symbol,
        close: closeBySymbol[symbol] || "100.5",
        percent_change: "0.5",
        is_market_open: false,
      });
    }

    if (url.hostname === "api.twelvedata.com" && url.pathname === "/time_series") {
      const baseDate = "2026-04-11";
      return buildJsonResponse({
        status: "ok",
        values: [
          { datetime: `${baseDate} 09:00:00`, open: "100", high: "101", low: "99", close: "100.5", volume: "1000" },
          { datetime: `${baseDate} 10:00:00`, open: "100.5", high: "102", low: "100", close: "101.8", volume: "1400" },
        ],
      });
    }

    if (url.hostname === "openapi.koreainvestment.com" && url.pathname === "/oauth2/tokenP") {
      return buildJsonResponse({
        access_token: "smoke-kis-token",
        access_token_token_expired: "2099-12-31 23:59:59",
        expires_in: 7776000,
        token_type: "Bearer",
      });
    }

    if (
      url.hostname === "openapi.koreainvestment.com" &&
      url.pathname === "/uapi/domestic-stock/v1/quotations/inquire-price"
    ) {
      const symbol = String(url.searchParams.get("FID_INPUT_ISCD") || "").trim().toUpperCase();
      if (symbol === String(overrides.failSymbol || "").trim().toUpperCase()) {
        return buildJsonResponse({
          rt_cd: "1",
          msg1: `${symbol} failed`,
        });
      }

      const payloadBySymbol = {
        "005930": {
          stck_prpr: "70200",
          prdy_ctrt: "1.25",
          stck_bsop_date: "20260420",
          stck_cntg_hour: "101500",
          stck_sdpr: "69300",
        },
      };
      return buildJsonResponse({
        rt_cd: "0",
        msg1: "정상처리되었습니다.",
        output: payloadBySymbol[symbol] || {
          stck_prpr: "85000",
          prdy_ctrt: "0.50",
          stck_bsop_date: "20260420",
          stck_cntg_hour: "101500",
          stck_sdpr: "84500",
        },
      });
    }

    if (url.hostname === "query1.finance.yahoo.com" && url.pathname.startsWith("/v8/finance/chart/")) {
      const symbol = decodeURIComponent(url.pathname.split("/").pop() || "").trim().toUpperCase();
      const baseBySymbol = {
        "KRW=X": 1485.27,
        "^KS11": 2745.18,
        "^KQ11": 915.42,
        "^IXIC": 18435.21,
        "^GSPC": 6031.11,
        "^DJI": 40122.33,
      };
      const price = baseBySymbol[symbol] || 100;
      const previousClose = price * 0.995;
      return buildJsonResponse({
        chart: {
          result: [
            {
              meta: {
                regularMarketPrice: price,
                previousClose,
                chartPreviousClose: previousClose,
                regularMarketTime: baseTimestamp,
                currentTradingPeriod: {
                  regular: {
                    start: baseTimestamp - 3600,
                    end: baseTimestamp + 3600,
                  },
                },
              },
              timestamp: [baseTimestamp - 86400, baseTimestamp],
              indicators: {
                quote: [
                  {
                    open: [previousClose * 0.998, previousClose],
                    high: [previousClose * 1.004, price * 1.003],
                    low: [previousClose * 0.994, price * 0.997],
                    close: [previousClose, price],
                    volume: [1000, 1200],
                  },
                ],
              },
            },
          ],
          error: null,
        },
      });
    }

    throw new Error(`Unhandled live price url: ${url.toString()}`);
  };
}

async function run() {
  const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const originalTwelveDataKey = process.env.TWELVE_DATA_API_KEY;
  const originalKisAppKey = process.env.KIS_APP_KEY;
  const originalKisAppSecret = process.env.KIS_APP_SECRET;
  const originalStorageProvider = process.env.STORAGE_PROVIDER;
  const originalBoardVariant = process.env.BOARD_VARIANT;
  const originalOwnerStateKey = process.env.OWNER_STATE_KEY;
  const originalOwnerAccessCodeProfiles = process.env.OWNER_ACCESS_CODE_PROFILES;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  process.env.STORAGE_PROVIDER = "local";
  process.env.BOARD_VARIANT = "personal";
  process.env.OWNER_STATE_KEY = "owner";
  delete process.env.OWNER_ACCESS_CODE_PROFILES;
  process.env.KIS_APP_KEY = "smoke-kis-app-key";
  process.env.KIS_APP_SECRET = "smoke-kis-app-secret";

  try {
    await assertModuleExports(path.join(ROOT, "client/timeline-panel.js"), [
      "buildRealizedTradeKey",
      "normalizeTimelineTrades",
    ]);
    assertTradePhotoAssistNormalization();

    const krSellFee = estimateTradeFee({
      broker: "카카오증권",
      market: "국내주식",
      side: "매도",
      amount: 10_690_700,
    });
    assert.equal(krSellFee.totalFee, 20739.958, "domestic stock sells should include the 0.014% brokerage and 0.180% tax estimate");

    const usSellFee = estimateTradeFee({
      broker: "카카오증권",
      market: "미국주식",
      side: "매도",
      amount: 1_500_000,
    });
    assert.equal(usSellFee.totalFee, 1500, "US stock sells should still include brokerage in the automatic estimate");
    assert.deepEqual(usSellFee.excludedComponents, ["SEC fee", "FINRA TAF"], "US stock sells should flag excluded regulatory fees");
    assert.equal(
      buildTradeFeeSummaryText({
        broker: "카카오증권",
        market: "미국주식",
        side: "매도",
      }),
      "거래수수료 0.1% · SEC fee, FINRA TAF 별도",
      "US stock sell summary should call out excluded regulatory fees"
    );

    const bundledPortfolioData = getBundledPortfolioData();
    const accessProfile = resolveAccessProfile(OWNER_CODE, bundledPortfolioData);
    assert.equal(accessProfile.ok, true, "owner access profile should resolve");
    assert.equal(accessProfile.stateKey, "owner", "personal owner should keep default owner state key");
    assert.equal(
      livePricesHandler.resolveLivePriceSeedPortfolio(accessProfile),
      null,
      "owner live prices should load persisted runtime state instead of bundled seed data"
    );
    const guestAccessProfile = resolveAccessProfile(GUEST_CODE, bundledPortfolioData);
    assert.equal(guestAccessProfile.ok, true, "guest access profile should resolve");
    assert.equal(
      livePricesHandler.resolveLivePriceSeedPortfolio(guestAccessProfile),
      guestAccessProfile.seedPortfolio,
      "guest live prices should keep using the seeded guest portfolio"
    );
    process.env.BOARD_VARIANT = "blank-family";
    process.env.OWNER_STATE_KEY = "family-owner";
    const onboardingOwnerLiveProfile = resolveAccessProfile(OWNER_CODE, bundledPortfolioData);
    assert.equal(onboardingOwnerLiveProfile.ok, true, "blank-family owner access profile should resolve");
    assert.equal(
      livePricesHandler.resolveLivePriceSeedPortfolio(onboardingOwnerLiveProfile),
      onboardingOwnerLiveProfile.seedPortfolio,
      "blank-family owner live prices should use the seeded portfolio when the namespaced state is still empty"
    );
    process.env.BOARD_VARIANT = "personal";
    process.env.OWNER_STATE_KEY = "owner";

    const missingConfigFailure = getAccessFailureResponse({ reason: "owner_code_missing" });
    assert.equal(missingConfigFailure.statusCode, 503, "missing owner code should map to 503");

    const accessConfigResponse = await invokeJsonHandler(accessHandler, buildGetRequest("GET", "/api/access"));
    assert.equal(accessConfigResponse.statusCode, 200, "access api config should load");
    assert.equal(accessConfigResponse.payload?.board?.variant, "personal", "access GET should expose the active board variant");

    const accessResponse = await invokeJsonHandler(accessHandler, buildJsonRequest("POST", { code: OWNER_CODE }));
    assert.equal(accessResponse.statusCode, 200, "access api should accept owner code");
    assert.equal(accessResponse.payload?.mode, "owner");
    assert.equal(accessResponse.payload?.board?.variant, "personal", "access POST should expose the active board variant");

    process.env.OWNER_ACCESS_CODE_PROFILES = JSON.stringify([
      {
        code: ONBOARDING_OWNER_CODE,
        stateKey: "friend-onboarding",
        variant: "blank-family",
      },
    ]);
    const onboardingProfile = resolveAccessProfile(ONBOARDING_OWNER_CODE, bundledPortfolioData);
    assert.equal(onboardingProfile.ok, true, "configured onboarding owner profile should resolve");
    assert.equal(onboardingProfile.stateKey, "friend-onboarding", "configured onboarding profile should honor its state key");
    assert.equal(onboardingProfile.board?.variant, "blank-family", "configured onboarding profile should expose blank-family");
    const multiOwnerAccessConfigResponse = await invokeJsonHandler(accessHandler, buildGetRequest("GET", "/api/access"));
    assert.equal(multiOwnerAccessConfigResponse.statusCode, 200, "access api config should still load with multiple owner profiles");
    assert.equal(
      multiOwnerAccessConfigResponse.payload?.ownerCodeLength,
      0,
      "multiple owner code lengths should disable single-length auto submit"
    );
    assert.deepEqual(
      multiOwnerAccessConfigResponse.payload?.ownerCodeLengths,
      [ONBOARDING_OWNER_CODE.length, OWNER_CODE.length].sort((left, right) => left - right),
      "access GET should expose every configured owner code length"
    );
    const onboardingAccessResponse = await invokeJsonHandler(accessHandler, buildJsonRequest("POST", { code: ONBOARDING_OWNER_CODE }));
    assert.equal(onboardingAccessResponse.statusCode, 200, "access api should accept onboarding owner codes");
    assert.equal(onboardingAccessResponse.payload?.mode, "owner");
    assert.equal(onboardingAccessResponse.payload?.board?.variant, "blank-family", "onboarding owner should open blank-family board");

    process.env.BOARD_VARIANT = "blank-family";
    process.env.OWNER_STATE_KEY = "family-owner";
    const blankProfile = resolveAccessProfile(OWNER_CODE, bundledPortfolioData);
    assert.equal(blankProfile.stateKey, "family-owner", "blank-family owner should honor OWNER_STATE_KEY");
    assert.equal(blankProfile.seedPortfolio?.metadata?.mantra, "", "blank-family seed should clear the personal mantra");
    assert.deepEqual(
      blankProfile.seedPortfolio?.uiPreferences?.visibleSections,
      getDefaultVisibleSections("blank-family"),
      "blank-family seed should start from the core visible sections"
    );
    const blankTempRoot = await makeTempRoot();
    const blankInitialPortfolio = await getCurrentPortfolio(blankTempRoot, blankProfile.seedPortfolio, "family-owner");
    const blankLiveFetchMock = buildLivePriceFetchMock();
    const blankLiveSnapshot = await buildLivePriceSnapshot({
      rootDir: blankTempRoot,
      portfolioData: blankInitialPortfolio,
      stateKey: "family-owner",
      forceRefresh: true,
      fetchImpl: async (input) => {
        const url = new URL(String(input));
        assert.notEqual(url.hostname, "api.upbit.com", "blank-family live prices should not request Upbit with no crypto instruments");
        return blankLiveFetchMock(input);
      },
    });
    assert.equal(
      blankLiveSnapshot.live?.status?.level,
      "success",
      "blank-family live prices should stay successful before any tracked assets exist"
    );
    assert.deepEqual(blankLiveSnapshot.live?.errors, [], "blank-family live prices should not surface empty crypto errors");
    const blankGuidePreferencesPortfolio = await updateUiPreferencesEntry(
      blankTempRoot,
      {
        visibleSections: ["guide-section", ...getDefaultVisibleSections("blank-family")],
      },
      blankProfile.seedPortfolio,
      "family-owner"
    );
    assert.equal(
      blankGuidePreferencesPortfolio.uiPreferences?.visibleSections?.includes("guide-section"),
      true,
      "blank-family ui preferences should allow the guide section"
    );
    process.env.BOARD_VARIANT = "personal";
    process.env.OWNER_STATE_KEY = "owner";
    const personalGuidePreferencesPortfolio = await updateUiPreferencesEntry(
      blankTempRoot,
      {
        visibleSections: ["guide-section", "notes-section", "holdings-section"],
      },
      bundledPortfolioData,
      "owner"
    );
    assert.deepEqual(
      personalGuidePreferencesPortfolio.uiPreferences?.visibleSections,
      ["notes-section", "holdings-section"],
      "personal ui preferences should strip the guide section even if stale data requests it"
    );
    process.env.BOARD_VARIANT = "blank-family";
    process.env.OWNER_STATE_KEY = "family-owner";
    const blankBasisDate = extractBasisMonthDay(blankInitialPortfolio.metadata?.basisDateLabel);
    const blankCreatedTradePortfolio = await createTrade(
      blankTempRoot,
      {
        market: "미국주식",
        broker: "카카오증권",
        date: blankBasisDate,
        asset: "Apple Inc. (AAPL)",
        side: "매수",
        quantity: 1,
        price: 100,
        fee: 0,
        note: "blank-smoke",
      },
      blankProfile.seedPortfolio,
      "family-owner"
    );
    const blankRevertedTradePortfolio = await deleteTradeEntry(
      blankTempRoot,
      {
        collection: "stocks",
        index: 0,
      },
      blankProfile.seedPortfolio,
      "family-owner"
    );
    assert.equal(
      blankRevertedTradePortfolio.metadata?.basisDateLabel,
      blankInitialPortfolio.metadata?.basisDateLabel,
      "blank-family trade removal should preserve the original basis date label when the board becomes empty again"
    );
    const initializedBlankPortfolio = await initializePortfolioEntry(
      blankTempRoot,
      {
        cashAmount: 500000,
        holdings: [
          {
            market: "미국주식",
            broker: "카카오증권",
            asset: "Apple Inc. (AAPL)",
            quantity: 2,
            averagePrice: 150000,
          },
        ],
      },
      blankProfile.seedPortfolio,
      "family-owner"
    );
    assert.equal(
      initializedBlankPortfolio.summary?.initialInvestment,
      800000,
      "blank-family initial setup should seed the starting asset amount"
    );
    assert.equal(
      initializedBlankPortfolio.holdings?.length,
      1,
      "blank-family initial setup should seed holdings"
    );
    assert.equal(
      initializedBlankPortfolio.cashPositions?.[0]?.amount,
      500000,
      "blank-family initial setup should seed cash positions"
    );
    process.env.BOARD_VARIANT = "personal";
    process.env.OWNER_STATE_KEY = "owner";

    const portfolioResponse = await invokeJsonHandler(
      portfolioHandler,
      buildGetRequest("GET", "/api/portfolio", { "x-access-code": OWNER_CODE })
    );
    assert.equal(portfolioResponse.statusCode, 200, "portfolio api should load");
    assert.ok(Array.isArray(portfolioResponse.payload?.holdings), "portfolio payload should include holdings");

    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      async json() {
        return [
          {
            market: "KRW-BTC",
            korean_name: "비트코인",
            english_name: "Bitcoin",
          },
        ];
      },
    });
    const assetSearchResponse = await invokeJsonHandler(
      assetSearchHandler,
      buildGetRequest("GET", "/api/asset-search?market=%EC%95%94%ED%98%B8%ED%99%94%ED%8F%90&query=%EB%B9%84%ED%8A%B8", {
        host: "localhost",
        "x-access-code": OWNER_CODE,
      })
    );
    global.fetch = originalFetch;
    assert.equal(assetSearchResponse.statusCode, 200, "asset search api should load");
    assert.ok(Array.isArray(assetSearchResponse.payload?.suggestions), "asset search should return suggestions");

    const tempRoot = await makeTempRoot();
    const initialPortfolio = await getCurrentPortfolio(tempRoot, null, "owner");
    const basisDate = extractBasisMonthDay(initialPortfolio.metadata?.basisDateLabel);
    const initialRevision = getPortfolioRevision(initialPortfolio);
    const initialStockTradeCount = initialPortfolio.trades?.stocks?.length || 0;

    const createdTradePortfolio = await createTrade(
      tempRoot,
      {
        market: "국내주식",
        broker: "미래에셋",
        date: basisDate,
        asset: "카카오뱅크(323410)",
        side: "매수",
        stage: "1차 진입",
        quantity: 1,
        price: 10000,
        fee: 0,
        note: "smoke-create",
      },
      null,
      "owner"
    );
    assert.equal((createdTradePortfolio.trades?.stocks?.length || 0), initialStockTradeCount + 1, "createTrade should append trade");
    assert.ok(getPortfolioRevision(createdTradePortfolio) > initialRevision, "createTrade should bump revision");

    const createdTradeIndex = createdTradePortfolio.trades.stocks.length - 1;
    assert.equal(createdTradePortfolio.trades.stocks[createdTradeIndex]?.stage, "1차 진입", "createTrade should persist strategy stage");
    const updatedTradePortfolio = await updateTradeEntry(
      tempRoot,
      {
        collection: "stocks",
        index: createdTradeIndex,
        trade: {
          stage: "2차 진입",
          note: "smoke-updated",
        },
      },
      null,
      "owner"
    );
    assert.equal(updatedTradePortfolio.trades.stocks[createdTradeIndex].note, "smoke-updated", "updateTradeEntry should persist edits");
    assert.equal(updatedTradePortfolio.trades.stocks[createdTradeIndex].stage, "2차 진입", "updateTradeEntry should persist strategy stage");
    assert.equal(updatedTradePortfolio.trades.stocks[createdTradeIndex].fee, 0, "note-only update should preserve the original fee");
    const sellStageTradePortfolio = await updateTradeEntry(
      tempRoot,
      {
        collection: "stocks",
        index: createdTradeIndex,
        trade: {
          stage: "1단계 익절",
        },
      },
      null,
      "owner"
    );
    const sellStageHolding = (sellStageTradePortfolio.holdings || []).find(
      (item) => item.symbol === "323410" || item.asset === "카카오뱅크"
    );
    assert.equal(sellStageTradePortfolio.trades.stocks[createdTradeIndex].stage, "1단계 익절", "sell-stage update should persist strategy stage");
    assert.equal(
      sellStageTradePortfolio.trades.stocks[createdTradeIndex].strategyBaselineQuantity,
      Number(sellStageHolding?.quantity || 0),
      "sell-stage update should capture the starting position quantity"
    );

    const revertedTradePortfolio = await deleteTradeEntry(
      tempRoot,
      {
        collection: "stocks",
        index: createdTradeIndex,
      },
      null,
      "owner"
    );
    assert.equal((revertedTradePortfolio.trades?.stocks?.length || 0), initialStockTradeCount, "deleteTradeEntry should remove trade");

    const selectorShiftPortfolioA = await createTrade(
      tempRoot,
      {
        market: "국내주식",
        broker: "미래에셋",
        date: basisDate,
        asset: "카카오뱅크(323410)",
        side: "매수",
        quantity: 1,
        price: 10100,
        fee: 0,
        note: "selector-shift-a",
      },
      null,
      "owner"
    );
    const selectorShiftPortfolioB = await createTrade(
      tempRoot,
      {
        market: "국내주식",
        broker: "미래에셋",
        date: basisDate,
        asset: "카카오뱅크(323410)",
        side: "매수",
        quantity: 1,
        price: 10200,
        fee: 0,
        note: "selector-shift-b",
      },
      null,
      "owner"
    );
    const selectorTradeAIndex = selectorShiftPortfolioB.trades.stocks.findIndex((trade) => trade.note === "selector-shift-a");
    const selectorTradeBIndex = selectorShiftPortfolioB.trades.stocks.findIndex((trade) => trade.note === "selector-shift-b");
    const selectorTradeB = selectorShiftPortfolioB.trades.stocks[selectorTradeBIndex];
    assert.ok(selectorTradeAIndex >= 0 && selectorTradeBIndex >= 0, "selector regression trades should exist");

    await deleteTradeEntry(
      tempRoot,
      {
        collection: "stocks",
        index: selectorTradeAIndex,
      },
      null,
      "owner"
    );

    const selectorUpdatedPortfolio = await updateTradeEntry(
      tempRoot,
      {
        collection: "stocks",
        index: selectorTradeBIndex,
        match: buildTradeMutationMatch(selectorTradeB),
        trade: {
          note: "selector-shift-b-updated",
        },
      },
      null,
      "owner"
    );
    const shiftedUpdatedTrade = selectorUpdatedPortfolio.trades.stocks.find((trade) => trade.note === "selector-shift-b-updated");
    assert.ok(shiftedUpdatedTrade, "stale index update should still find the matched trade");
    assert.equal(shiftedUpdatedTrade.fee, 0, "stale selector update should not recompute the original fee");

    const selectorDeletedPortfolio = await deleteTradeEntry(
      tempRoot,
      {
        collection: "stocks",
        index: selectorTradeBIndex,
        match: buildTradeMutationMatch(selectorTradeB),
      },
      null,
      "owner"
    );
    assert.equal(
      selectorDeletedPortfolio.trades.stocks.some((trade) => String(trade.note || "").startsWith("selector-shift-b")),
      false,
      "stale index delete should remove the originally matched trade"
    );
    assert.equal(
      selectorDeletedPortfolio.trades.stocks.some((trade) => trade.note === "selector-shift-a"),
      false,
      "selector regression setup trade A should remain deleted"
    );

    const rebuildRegressionPortfolio = {
      metadata: {
        basisDateLabel: "2026.04.18 기준",
        realizedPerformanceStartDate: "2026-04-01",
      },
      summary: {
        initialInvestment: 0,
      },
      assetStatus: [],
      cashPositions: [],
      holdings: [],
      realized: [
        {
          market: "암호화폐",
          platform: "업비트",
          asset: "ETH(ETH) 0.5개 매도",
          assetName: "ETH(ETH)",
          symbol: "KRW-ETH",
          quantity: 0.5,
          pnl: 123302.5,
          returnRate: 0.075376684746,
          date: "4/14",
        },
      ],
      trades: {
        stocks: [],
        crypto: [
          {
            date: "4/14",
            market: "암호화폐",
            broker: "업비트",
            asset: "ETH",
            symbol: "KRW-ETH",
            side: "매도",
            quantity: 0.5,
            price: 3520000,
            amount: 1760000,
            fee: 880,
          },
        ],
      },
      charts: {},
      analytics: {
        prices: {
          eth: 3520000,
        },
        xrpDefense: null,
      },
      targets: { groups: [] },
      strategyBudgets: { items: [] },
      uiPreferences: {},
    };
    const rebuiltRegressionPortfolio = rebuildPortfolioFromTradeBook(
      rebuildRegressionPortfolio,
      buildTradeBook(rebuildRegressionPortfolio)
    );
    assert.equal(
      rebuiltRegressionPortfolio.realized?.[0]?.assetName,
      "ETH",
      "trade rebuild should preserve realized sells even when legacy asset labels include repeated tickers"
    );

    const dedupeMutationId = "trade-dedupe-smoke";
    const dedupedTradeInput = {
      market: "국내주식",
      broker: "미래에셋",
      date: basisDate,
      asset: "카카오뱅크(323410)",
      side: "매수",
      stage: "1차 진입",
      quantity: 2,
      price: 10000,
      fee: 0,
      note: "smoke-dedupe",
    };
    const dedupeTradePortfolio = await createTrade(tempRoot, dedupedTradeInput, null, "owner", {
      mutationId: dedupeMutationId,
    });
    const duplicateTradePortfolio = await createTrade(tempRoot, dedupedTradeInput, null, "owner", {
      mutationId: dedupeMutationId,
    });
    assert.equal(
      duplicateTradePortfolio.trades?.stocks?.length,
      dedupeTradePortfolio.trades?.stocks?.length,
      "duplicate mutationId should not append the same trade twice"
    );

    const targetCandidate = findAvailableTargetAsset(initialPortfolio);
    const createdTargetPortfolio = await createTarget(tempRoot, targetCandidate, null, "owner");
    const createdTargetGroup = (createdTargetPortfolio.targets?.groups || []).find((group) =>
      (group.items || []).some((item) => String(item.name || item.symbol || "").includes(targetCandidate.asset.replace(/\(.+?\)/, "")))
    );
    assert.ok(createdTargetGroup, "createTarget should add item into target groups");

    const addedTargetItem = (createdTargetGroup.items || []).find((item) =>
      [String(item.symbol || "").toUpperCase(), String(item.name || "")]
        .filter(Boolean)
        .some((value) =>
          [targetCandidate.asset.toUpperCase(), targetCandidate.asset.replace(/\(.+?\)/, ""), targetCandidate.asset]
            .filter(Boolean)
            .some((candidate) => value.includes(candidate.toUpperCase ? candidate.toUpperCase() : candidate))
        )
    );
    assert.ok(addedTargetItem, "createTarget should return the inserted item");

    const deletedTargetPortfolio = await deleteTargetEntry(
      tempRoot,
      {
        market: targetCandidate.market,
        symbol: addedTargetItem.symbol,
        name: addedTargetItem.name,
      },
      null,
      "owner"
    );
    const targetStillExists = (deletedTargetPortfolio.targets?.groups || []).some((group) =>
      (group.items || []).some((item) => item.symbol === addedTargetItem.symbol || item.name === addedTargetItem.name)
    );
    assert.equal(targetStillExists, false, "deleteTargetEntry should remove target");

    const upsertedStrategyBudgetPortfolio = await upsertStrategyBudgetEntry(
      tempRoot,
      {
        market: "암호화폐",
        asset: "XRP",
        symbol: "KRW-XRP",
        budget: 1500000,
      },
      null,
      "owner"
    );
    assert.equal(
      upsertedStrategyBudgetPortfolio.strategyBudgets?.items?.[0]?.budget,
      1500000,
      "upsertStrategyBudgetEntry should persist the budget"
    );

    const deletedStrategyBudgetPortfolio = await deleteStrategyBudgetEntry(
      tempRoot,
      {
        market: "crypto",
        symbol: "KRW-XRP",
      },
      null,
      "owner"
    );
    assert.equal(
      deletedStrategyBudgetPortfolio.strategyBudgets?.items?.length || 0,
      0,
      "deleteStrategyBudgetEntry should remove the budget"
    );

    const staleBase = await loadPersistedPortfolio(tempRoot, null, "owner");
    const nextPortfolio = structuredClone(staleBase);
    nextPortfolio.metadata = {
      ...(nextPortfolio.metadata || {}),
      workbook: "first-save",
    };
    const savedPortfolio = await savePersistedPortfolio(tempRoot, nextPortfolio, "owner", {
      expectedRevision: getPortfolioRevision(staleBase),
    });
    assert.equal(savedPortfolio.metadata.workbook, "first-save", "first save should persist");

    const staleConflictPortfolio = structuredClone(staleBase);
    staleConflictPortfolio.metadata = {
      ...(staleConflictPortfolio.metadata || {}),
      workbook: "stale-save",
    };

    await assert.rejects(
      () =>
        savePersistedPortfolio(tempRoot, staleConflictPortfolio, "owner", {
          expectedRevision: getPortfolioRevision(staleBase),
        }),
      /다른 변경이 먼저 저장되었습니다/,
      "stale revision should be rejected"
    );

    const noteMutationId = "note-dedupe-smoke";
    const savedNotes = await savePersistedNotes(
      tempRoot,
      [
        {
          id: "note-smoke-1",
          title: "smoke",
          body: "first",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      "owner",
      { mutationId: noteMutationId }
    );
    const duplicateNotes = await savePersistedNotes(
      tempRoot,
      [
        ...savedNotes,
        {
          id: "note-smoke-2",
          title: "duplicate",
          body: "should skip",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      "owner",
      { mutationId: noteMutationId }
    );
    assert.equal(duplicateNotes.length, 1, "duplicate note mutationId should reuse the existing saved state");
    const loadedNotes = await loadPersistedNotes(tempRoot, "owner");
    assert.equal(loadedNotes.length, 1, "notes store should keep the deduped note set");

    const storageHealth = await getStorageHealth(tempRoot, "owner");
    assert.equal(storageHealth.provider, "local", "temp smoke root should default to local storage");
    assert.ok(Number(storageHealth.revision) >= 1, "storage health should expose a revision");

    const namespacedStateKey = "family-smoke";
    const updatedUiPreferencesPortfolio = await updateUiPreferencesEntry(
      tempRoot,
      {
        visibleSections: ["notes-section", "holdings-section"],
        livePrice: {
          showGlobalIndices: false,
        },
        hiddenHoldings: [
          {
            market: "미국주식",
            asset: "Apple Inc. (AAPL)",
            symbol: "AAPL",
          },
        ],
      },
      initialPortfolio,
      namespacedStateKey
    );
    assert.deepEqual(
      updatedUiPreferencesPortfolio.uiPreferences?.visibleSections,
      ["notes-section", "holdings-section"],
      "ui preferences mutation should persist the selected section ids"
    );
    assert.equal(
      updatedUiPreferencesPortfolio.uiPreferences?.livePrice?.showGlobalIndices,
      false,
      "ui preferences mutation should persist live price visibility toggles"
    );
    assert.equal(
      updatedUiPreferencesPortfolio.uiPreferences?.hiddenHoldings?.[0]?.symbol,
      "AAPL",
      "ui preferences mutation should persist hidden holding items"
    );
    const reloadedUiPreferencesPortfolio = await getCurrentPortfolio(tempRoot, null, namespacedStateKey);
    assert.deepEqual(
      reloadedUiPreferencesPortfolio.uiPreferences?.visibleSections,
      ["notes-section", "holdings-section"],
      "namespaced local portfolio should reload the saved ui preferences"
    );
    assert.equal(
      reloadedUiPreferencesPortfolio.uiPreferences?.livePrice?.showGlobalIndices,
      false,
      "reloaded namespaced ui preferences should keep live price toggles"
    );
    assert.equal(
      reloadedUiPreferencesPortfolio.uiPreferences?.hiddenHoldings?.[0]?.symbol,
      "AAPL",
      "reloaded namespaced ui preferences should keep hidden holding items"
    );
    const ownerPortfolioAfterNamespacedSave = await getCurrentPortfolio(tempRoot, null, "owner");
    assert.notDeepEqual(
      ownerPortfolioAfterNamespacedSave.uiPreferences?.visibleSections,
      reloadedUiPreferencesPortfolio.uiPreferences?.visibleSections,
      "owner data should stay separate from a namespaced owner state"
    );

    const originalDateNow = Date.now;
    try {
      const baseNow = 1_775_851_000_000;
      Date.now = () => baseNow;
      const failedMarketSnapshot = await buildLivePriceSnapshot({
        rootDir: tempRoot,
        fetchImpl: buildLivePriceFetchMock({ failSymbol: "CRCL" }),
        forceRefresh: true,
      });
      assert.equal(
        failedMarketSnapshot.quotes["써클"]?.available,
        false,
        "failed market quote should surface as unavailable"
      );
      const recoveredMarketSnapshot = await buildLivePriceSnapshot({
        rootDir: tempRoot,
        fetchImpl: buildLivePriceFetchMock(),
      });
      assert.equal(
        recoveredMarketSnapshot.quotes["써클"]?.available,
        true,
        "market quote cache should retry after an unavailable response instead of freezing it"
      );
      const firstLiveSnapshot = await buildLivePriceSnapshot({
        rootDir: tempRoot,
        fetchImpl: buildLivePriceFetchMock(),
      });
      assert.equal(
        firstLiveSnapshot.quotes["Palantir Technologies Inc."].available,
        true,
        "initial live snapshot should populate PLTR"
      );
      assert.equal(
        firstLiveSnapshot.quotes["삼성전자"]?.available,
        true,
        "initial live snapshot should populate Samsung Electronics"
      );
      assert.equal(firstLiveSnapshot.indices?.korea?.length, 0, "korean major indices should stay hidden in the strip");
      assert.equal(firstLiveSnapshot.indices?.us?.length, 0, "live snapshot should omit US major indices");
      assert.ok(Number(firstLiveSnapshot.fx?.usdkrw) > 0, "live snapshot should include a USD/KRW rate");
      const firstLiveHolding = firstLiveSnapshot.portfolioLive?.holdings?.[0] || null;
      assert.ok(
        Number.isFinite(firstLiveHolding?.pnl),
        "live snapshot holdings should include pnl values"
      );
      const majorIndexChartSnapshot = await buildAssetChartSnapshot({
        rootDir: tempRoot,
        market: "major-index",
        symbol: "IXIC",
        name: "NASDAQ",
        range: "1M",
        granularity: "day",
        fetchImpl: buildLivePriceFetchMock(),
      });
      assert.equal(
        majorIndexChartSnapshot.sourceLabel,
        "Twelve Data 지수 일봉",
        "major index chart should use Twelve Data"
      );
      assert.ok(
        Array.isArray(majorIndexChartSnapshot.points) && majorIndexChartSnapshot.points.length > 0,
        "major index chart should return chart points"
      );
      const fxChartSnapshot = await buildAssetChartSnapshot({
        rootDir: tempRoot,
        market: "fx",
        symbol: "KRW=X",
        name: "USD/KRW",
        range: "1M",
        granularity: "day",
        fetchImpl: buildLivePriceFetchMock(),
      });
      assert.equal(
        fxChartSnapshot.sourceLabel,
        "Twelve Data 환율 일봉",
        "fx chart should use Twelve Data"
      );
      assert.ok(
        Array.isArray(fxChartSnapshot.points) && fxChartSnapshot.points.length > 0,
        "fx chart should return chart points"
      );

      Date.now = () => baseNow + (MARKET_CLOSED_REFRESH_INTERVAL_SECONDS + 5) * 1000;
      const retryLiveSnapshot = await buildLivePriceSnapshot({
        rootDir: tempRoot,
        fetchImpl: buildLivePriceFetchMock({ failSymbol: "PLTR" }),
        forceRefresh: true,
      });
      assert.equal(
        retryLiveSnapshot.quotes["Palantir Technologies Inc."].available,
        true,
        "cached successful PLTR quote should be reused outside US market hours"
      );
      assert.equal(
        retryLiveSnapshot.quotes["Palantir Technologies Inc."].isDelayed,
        false,
        "off-hours requests should keep the last cached PLTR quote without forcing a delayed refresh"
      );
    } finally {
      Date.now = originalDateNow;
    }

    console.log("smoke-test: ok");
  } finally {
    if (originalBlobToken) {
      process.env.BLOB_READ_WRITE_TOKEN = originalBlobToken;
    } else {
      delete process.env.BLOB_READ_WRITE_TOKEN;
    }

    if (originalTwelveDataKey) {
      process.env.TWELVE_DATA_API_KEY = originalTwelveDataKey;
    } else {
      delete process.env.TWELVE_DATA_API_KEY;
    }

    if (originalKisAppKey) {
      process.env.KIS_APP_KEY = originalKisAppKey;
    } else {
      delete process.env.KIS_APP_KEY;
    }

    if (originalKisAppSecret) {
      process.env.KIS_APP_SECRET = originalKisAppSecret;
    } else {
      delete process.env.KIS_APP_SECRET;
    }

    if (originalStorageProvider) {
      process.env.STORAGE_PROVIDER = originalStorageProvider;
    } else {
      delete process.env.STORAGE_PROVIDER;
    }

    if (originalBoardVariant) {
      process.env.BOARD_VARIANT = originalBoardVariant;
    } else {
      delete process.env.BOARD_VARIANT;
    }

    if (originalOwnerStateKey) {
      process.env.OWNER_STATE_KEY = originalOwnerStateKey;
    } else {
      delete process.env.OWNER_STATE_KEY;
    }

    if (originalOwnerAccessCodeProfiles) {
      process.env.OWNER_ACCESS_CODE_PROFILES = originalOwnerAccessCodeProfiles;
    } else {
      delete process.env.OWNER_ACCESS_CODE_PROFILES;
    }
  }
}

run().catch((error) => {
  console.error("smoke-test: failed");
  console.error(error);
  process.exit(1);
});
