#!/usr/bin/env node

const assert = require("assert/strict");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const accessHandler = require("../api/access");
const assetSearchHandler = require("../api/asset-search");
const portfolioHandler = require("../api/portfolio");
const { getAccessFailureResponse, resolveAccessProfile } = require("../lib/access-control");
const {
  createTarget,
  createTrade,
  deleteTargetEntry,
  deleteTradeEntry,
  getCurrentPortfolio,
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

const ROOT = path.resolve(__dirname, "..");
const OWNER_CODE = "0321";

process.env.OWNER_ACCESS_CODE = OWNER_CODE;
process.env.DISABLE_LOCAL_BLOB_ENV = "1";

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
  await fs.copyFile(path.join(ROOT, "data", "portfolio.json"), path.join(dataDir, "portfolio.json"));
  await fs.writeFile(path.join(dataDir, "notes.json"), "[]\n", "utf8");
  return tempRoot;
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

async function run() {
  const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;

  try {
    const accessProfile = resolveAccessProfile(OWNER_CODE, require("../data/portfolio.json"));
    assert.equal(accessProfile.ok, true, "owner access profile should resolve");

    const missingConfigFailure = getAccessFailureResponse({ reason: "owner_code_missing" });
    assert.equal(missingConfigFailure.statusCode, 503, "missing owner code should map to 503");

    const accessResponse = await invokeJsonHandler(accessHandler, buildJsonRequest("POST", { code: OWNER_CODE }));
    assert.equal(accessResponse.statusCode, 200, "access api should accept owner code");
    assert.equal(accessResponse.payload?.mode, "owner");

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

    console.log("smoke-test: ok");
  } finally {
    if (originalBlobToken) {
      process.env.BLOB_READ_WRITE_TOKEN = originalBlobToken;
    } else {
      delete process.env.BLOB_READ_WRITE_TOKEN;
    }
  }
}

run().catch((error) => {
  console.error("smoke-test: failed");
  console.error(error);
  process.exit(1);
});
