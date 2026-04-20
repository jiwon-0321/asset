const {
  attachStrategyBaselineToTrade,
  appendTarget,
  appendTrade,
  applyInitialPortfolioSetup,
  buildTradeBook,
  deleteStrategyBudget,
  deleteTarget,
  hasPortfolioContent,
  upsertManualCashAdjustment,
  normalizeTradeInput,
  normalizeTradeMutationSelector,
  rebuildPortfolioFromTradeBook,
  upsertStrategyBudget,
} = require("../scripts/portfolio-store");
const { normalizeUiPreferences, resolveBoardVariant } = require("./board-config");
const { getPortfolioBlobMeta, getPortfolioRevision, loadPersistedPortfolio, savePersistedPortfolio } = require("./server-state-store");

const portfolioMutationQueues = new Map();

function withNormalizedUiPreferences(portfolio = null) {
  const next = structuredClone(portfolio || {});
  next.uiPreferences = normalizeUiPreferences(next.uiPreferences, resolveBoardVariant());
  return next;
}

function hasMutationReceipt(portfolio = null, mutationId = "") {
  const normalizedId = String(mutationId || "").trim();
  return Boolean(normalizedId) && Array.isArray(portfolio?.metadata?.recentMutationIds) && portfolio.metadata.recentMutationIds.includes(normalizedId);
}

function runSerializedPortfolioMutation(stateKey, task) {
  const queueKey = String(stateKey || "owner");
  const previous = portfolioMutationQueues.get(queueKey) || Promise.resolve();
  const next = previous.catch(() => {}).then(task);

  portfolioMutationQueues.set(queueKey, next);
  return next.finally(() => {
    if (portfolioMutationQueues.get(queueKey) === next) {
      portfolioMutationQueues.delete(queueKey);
    }
  });
}

async function mutatePortfolio(rootDir, fallbackPortfolio, stateKey, mutate, options = {}) {
  const mutationId = String(options?.mutationId || "").trim();
  return runSerializedPortfolioMutation(stateKey, async () => {
    const portfolio = withNormalizedUiPreferences(await loadPersistedPortfolio(rootDir, fallbackPortfolio, stateKey));
    if (mutationId && hasMutationReceipt(portfolio, mutationId)) {
      return structuredClone(portfolio);
    }

    const blobMeta = getPortfolioBlobMeta(portfolio);
    const updated = await mutate(structuredClone(portfolio));
    return savePersistedPortfolio(rootDir, updated, stateKey, {
      expectedRevision: getPortfolioRevision(portfolio),
      expectedEtag: blobMeta?.etag || "",
      mutationId,
    });
  });
}

async function getCurrentPortfolio(rootDir = process.cwd(), fallbackPortfolio = null, stateKey = "owner") {
  const portfolio = withNormalizedUiPreferences(await loadPersistedPortfolio(rootDir, fallbackPortfolio, stateKey));
  return structuredClone(portfolio);
}

async function createTrade(rootDir = process.cwd(), input = {}, fallbackPortfolio = null, stateKey = "owner", options = {}) {
  return mutatePortfolio(rootDir, fallbackPortfolio, stateKey, async (portfolio) => {
    const trade = attachStrategyBaselineToTrade(
      portfolio,
      normalizeTradeInput(input, portfolio.metadata?.basisDateLabel)
    );
    return appendTrade(portfolio, trade);
  }, options);
}

async function updateTradeEntry(rootDir = process.cwd(), input = {}, fallbackPortfolio = null, stateKey = "owner", options = {}) {
  return mutatePortfolio(rootDir, fallbackPortfolio, stateKey, async (portfolio) => {
    const tradeCollections = {
      stocks: [...(Array.isArray(portfolio.trades?.stocks) ? portfolio.trades.stocks : [])],
      crypto: [...(Array.isArray(portfolio.trades?.crypto) ? portfolio.trades.crypto : [])],
    };
    const collection = String(input.collection || "").trim();
    const selector = normalizeTradeMutationSelector(input, tradeCollections[collection], {
      missingMessage: "수정할 거래를 찾지 못했습니다.",
      ambiguousMessage: "수정할 거래가 여러 개라 다시 불러온 뒤 다시 시도해주세요.",
    });
    const tradeIndex = selector.index;
    const originalTrade = tradeCollections[selector.collection][tradeIndex];

    if (!originalTrade) {
      throw new Error("수정할 거래를 찾지 못했습니다.");
    }

    const market = originalTrade.market || (selector.collection === "crypto" ? "암호화폐" : "국내주식");
    const tradePatch = input.trade || {};
    const hasPatchedAmount = Object.prototype.hasOwnProperty.call(tradePatch, "amount");
    const hasPatchedFee = Object.prototype.hasOwnProperty.call(tradePatch, "fee");
    const updatedTrade = normalizeTradeInput(
      {
        ...originalTrade,
        ...tradePatch,
        market,
        amount: hasPatchedAmount ? tradePatch.amount : originalTrade.amount,
        fee: hasPatchedFee ? tradePatch.fee : originalTrade.fee,
      },
      portfolio.metadata?.basisDateLabel,
      { allowPastDate: true, autoTimestamp: false, touchUpdatedAt: true }
    );
    const tradeWithStrategyBaseline = attachStrategyBaselineToTrade(portfolio, updatedTrade, originalTrade);

    tradeCollections[selector.collection][tradeIndex] = tradeWithStrategyBaseline;
    return rebuildPortfolioFromTradeBook(portfolio, buildTradeBook({ ...portfolio, trades: tradeCollections }));
  }, options);
}

async function deleteTradeEntry(rootDir = process.cwd(), input = {}, fallbackPortfolio = null, stateKey = "owner", options = {}) {
  return mutatePortfolio(rootDir, fallbackPortfolio, stateKey, async (portfolio) => {
    const tradeCollections = {
      stocks: [...(Array.isArray(portfolio.trades?.stocks) ? portfolio.trades.stocks : [])],
      crypto: [...(Array.isArray(portfolio.trades?.crypto) ? portfolio.trades.crypto : [])],
    };
    const collection = String(input.collection || "").trim();
    const selector = normalizeTradeMutationSelector(input, tradeCollections[collection], {
      missingMessage: "삭제할 거래를 찾지 못했습니다.",
      ambiguousMessage: "삭제할 거래가 여러 개라 다시 불러온 뒤 다시 시도해주세요.",
    });
    const tradeIndex = selector.index;

    if (!tradeCollections[selector.collection][tradeIndex]) {
      throw new Error("삭제할 거래를 찾지 못했습니다.");
    }

    tradeCollections[selector.collection].splice(tradeIndex, 1);
    return rebuildPortfolioFromTradeBook(portfolio, buildTradeBook({ ...portfolio, trades: tradeCollections }));
  }, options);
}

async function createTarget(rootDir = process.cwd(), input = {}, fallbackPortfolio = null, stateKey = "owner", options = {}) {
  return mutatePortfolio(rootDir, fallbackPortfolio, stateKey, async (portfolio) => appendTarget(portfolio, input), options);
}

async function deleteTargetEntry(rootDir = process.cwd(), input = {}, fallbackPortfolio = null, stateKey = "owner", options = {}) {
  return mutatePortfolio(rootDir, fallbackPortfolio, stateKey, async (portfolio) => deleteTarget(portfolio, input), options);
}

async function upsertStrategyBudgetEntry(rootDir = process.cwd(), input = {}, fallbackPortfolio = null, stateKey = "owner", options = {}) {
  return mutatePortfolio(rootDir, fallbackPortfolio, stateKey, async (portfolio) => upsertStrategyBudget(portfolio, input), options);
}

async function deleteStrategyBudgetEntry(rootDir = process.cwd(), input = {}, fallbackPortfolio = null, stateKey = "owner", options = {}) {
  return mutatePortfolio(rootDir, fallbackPortfolio, stateKey, async (portfolio) => deleteStrategyBudget(portfolio, input), options);
}

async function updateUiPreferencesEntry(rootDir = process.cwd(), input = {}, fallbackPortfolio = null, stateKey = "owner", options = {}) {
  return mutatePortfolio(rootDir, fallbackPortfolio, stateKey, async (portfolio) => {
    const next = structuredClone(portfolio);
    next.uiPreferences = normalizeUiPreferences(
      {
        ...input,
        updatedAt: new Date().toISOString(),
      },
      resolveBoardVariant()
    );
    return next;
  }, options);
}

async function updateCashPositionEntry(rootDir = process.cwd(), input = {}, fallbackPortfolio = null, stateKey = "owner", options = {}) {
  return mutatePortfolio(
    rootDir,
    fallbackPortfolio,
    stateKey,
    async (portfolio) => upsertManualCashAdjustment(portfolio, input),
    options
  );
}

async function initializePortfolioEntry(rootDir = process.cwd(), input = {}, fallbackPortfolio = null, stateKey = "owner", options = {}) {
  return mutatePortfolio(rootDir, fallbackPortfolio, stateKey, async (portfolio) => {
    if (resolveBoardVariant() !== "blank-family") {
      throw new Error("초기 자산 설정은 빈 보드 배포에서만 사용할 수 있습니다.");
    }
    if (hasPortfolioContent(portfolio)) {
      throw new Error("이미 데이터가 있어 초기 자산 설정을 다시 적용할 수 없습니다.");
    }
    return applyInitialPortfolioSetup(portfolio, input);
  }, options);
}

module.exports = {
  createTarget,
  createTrade,
  deleteStrategyBudgetEntry,
  deleteTargetEntry,
  deleteTradeEntry,
  getCurrentPortfolio,
  initializePortfolioEntry,
  upsertStrategyBudgetEntry,
  updateCashPositionEntry,
  updateUiPreferencesEntry,
  updateTradeEntry,
};
