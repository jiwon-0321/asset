const {
  appendTarget,
  appendTrade,
  buildTradeBook,
  deleteTarget,
  normalizeTradeInput,
  normalizeTradeMutationSelector,
  rebuildPortfolioFromTradeBook,
} = require("../scripts/portfolio-store");
const { getPortfolioBlobMeta, getPortfolioRevision, loadPersistedPortfolio, savePersistedPortfolio } = require("./server-state-store");

const portfolioMutationQueues = new Map();

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

async function mutatePortfolio(rootDir, fallbackPortfolio, stateKey, mutate) {
  return runSerializedPortfolioMutation(stateKey, async () => {
    const portfolio = await loadPersistedPortfolio(rootDir, fallbackPortfolio, stateKey);
    const blobMeta = getPortfolioBlobMeta(portfolio);
    const updated = await mutate(structuredClone(portfolio));
    return savePersistedPortfolio(rootDir, updated, stateKey, {
      expectedRevision: getPortfolioRevision(portfolio),
      expectedEtag: blobMeta?.etag || "",
    });
  });
}

async function getCurrentPortfolio(rootDir = process.cwd(), fallbackPortfolio = null, stateKey = "owner") {
  const portfolio = await loadPersistedPortfolio(rootDir, fallbackPortfolio, stateKey);
  return structuredClone(portfolio);
}

async function createTrade(rootDir = process.cwd(), input = {}, fallbackPortfolio = null, stateKey = "owner") {
  return mutatePortfolio(rootDir, fallbackPortfolio, stateKey, async (portfolio) => {
    const trade = normalizeTradeInput(input, portfolio.metadata?.basisDateLabel);
    return appendTrade(portfolio, trade);
  });
}

async function updateTradeEntry(rootDir = process.cwd(), input = {}, fallbackPortfolio = null, stateKey = "owner") {
  return mutatePortfolio(rootDir, fallbackPortfolio, stateKey, async (portfolio) => {
    const selector = normalizeTradeMutationSelector(input);
    const tradeCollections = {
      stocks: [...(Array.isArray(portfolio.trades?.stocks) ? portfolio.trades.stocks : [])],
      crypto: [...(Array.isArray(portfolio.trades?.crypto) ? portfolio.trades.crypto : [])],
    };
    const originalTrade = tradeCollections[selector.collection][selector.index];

    if (!originalTrade) {
      throw new Error("수정할 거래를 찾지 못했습니다.");
    }

    const market = originalTrade.market || (selector.collection === "crypto" ? "암호화폐" : "국내주식");
    const tradePatch = input.trade || {};
    const updatedTrade = normalizeTradeInput(
      {
        ...originalTrade,
        ...tradePatch,
        market,
        amount: tradePatch.amount,
        fee: tradePatch.fee,
      },
      portfolio.metadata?.basisDateLabel,
      { allowPastDate: true }
    );

    tradeCollections[selector.collection][selector.index] = updatedTrade;
    return rebuildPortfolioFromTradeBook(portfolio, buildTradeBook({ ...portfolio, trades: tradeCollections }));
  });
}

async function deleteTradeEntry(rootDir = process.cwd(), input = {}, fallbackPortfolio = null, stateKey = "owner") {
  return mutatePortfolio(rootDir, fallbackPortfolio, stateKey, async (portfolio) => {
    const selector = normalizeTradeMutationSelector(input);
    const tradeCollections = {
      stocks: [...(Array.isArray(portfolio.trades?.stocks) ? portfolio.trades.stocks : [])],
      crypto: [...(Array.isArray(portfolio.trades?.crypto) ? portfolio.trades.crypto : [])],
    };

    if (!tradeCollections[selector.collection][selector.index]) {
      throw new Error("삭제할 거래를 찾지 못했습니다.");
    }

    tradeCollections[selector.collection].splice(selector.index, 1);
    return rebuildPortfolioFromTradeBook(portfolio, buildTradeBook({ ...portfolio, trades: tradeCollections }));
  });
}

async function createTarget(rootDir = process.cwd(), input = {}, fallbackPortfolio = null, stateKey = "owner") {
  return mutatePortfolio(rootDir, fallbackPortfolio, stateKey, async (portfolio) => appendTarget(portfolio, input));
}

async function deleteTargetEntry(rootDir = process.cwd(), input = {}, fallbackPortfolio = null, stateKey = "owner") {
  return mutatePortfolio(rootDir, fallbackPortfolio, stateKey, async (portfolio) => deleteTarget(portfolio, input));
}

module.exports = {
  createTarget,
  createTrade,
  deleteTargetEntry,
  deleteTradeEntry,
  getCurrentPortfolio,
  updateTradeEntry,
};
