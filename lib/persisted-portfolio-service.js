const {
  appendTarget,
  appendTrade,
  buildTradeBook,
  deleteTarget,
  normalizeTradeInput,
  normalizeTradeMutationSelector,
  rebuildPortfolioFromTradeBook,
} = require("../scripts/portfolio-store");
const { loadPersistedPortfolio, savePersistedPortfolio } = require("./server-state-store");

async function getCurrentPortfolio(rootDir = process.cwd(), fallbackPortfolio = null, stateKey = "owner") {
  const portfolio = await loadPersistedPortfolio(rootDir, fallbackPortfolio, stateKey);
  return structuredClone(portfolio);
}

async function createTrade(rootDir = process.cwd(), input = {}, fallbackPortfolio = null, stateKey = "owner") {
  const portfolio = await loadPersistedPortfolio(rootDir, fallbackPortfolio, stateKey);
  const trade = normalizeTradeInput(input, portfolio.metadata?.basisDateLabel);
  const updated = appendTrade(portfolio, trade);
  await savePersistedPortfolio(rootDir, updated, stateKey);
  return updated;
}

async function updateTradeEntry(rootDir = process.cwd(), input = {}, fallbackPortfolio = null, stateKey = "owner") {
  const portfolio = await loadPersistedPortfolio(rootDir, fallbackPortfolio, stateKey);
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
  const rebuilt = rebuildPortfolioFromTradeBook(portfolio, buildTradeBook({ ...portfolio, trades: tradeCollections }));
  await savePersistedPortfolio(rootDir, rebuilt, stateKey);
  return rebuilt;
}

async function deleteTradeEntry(rootDir = process.cwd(), input = {}, fallbackPortfolio = null, stateKey = "owner") {
  const portfolio = await loadPersistedPortfolio(rootDir, fallbackPortfolio, stateKey);
  const selector = normalizeTradeMutationSelector(input);
  const tradeCollections = {
    stocks: [...(Array.isArray(portfolio.trades?.stocks) ? portfolio.trades.stocks : [])],
    crypto: [...(Array.isArray(portfolio.trades?.crypto) ? portfolio.trades.crypto : [])],
  };

  if (!tradeCollections[selector.collection][selector.index]) {
    throw new Error("삭제할 거래를 찾지 못했습니다.");
  }

  tradeCollections[selector.collection].splice(selector.index, 1);
  const rebuilt = rebuildPortfolioFromTradeBook(portfolio, buildTradeBook({ ...portfolio, trades: tradeCollections }));
  await savePersistedPortfolio(rootDir, rebuilt, stateKey);
  return rebuilt;
}

async function createTarget(rootDir = process.cwd(), input = {}, fallbackPortfolio = null, stateKey = "owner") {
  const portfolio = await loadPersistedPortfolio(rootDir, fallbackPortfolio, stateKey);
  const updated = appendTarget(portfolio, input);
  await savePersistedPortfolio(rootDir, updated, stateKey);
  return updated;
}

async function deleteTargetEntry(rootDir = process.cwd(), input = {}, fallbackPortfolio = null, stateKey = "owner") {
  const portfolio = await loadPersistedPortfolio(rootDir, fallbackPortfolio, stateKey);
  const updated = deleteTarget(portfolio, input);
  await savePersistedPortfolio(rootDir, updated, stateKey);
  return updated;
}

module.exports = {
  createTarget,
  createTrade,
  deleteTargetEntry,
  deleteTradeEntry,
  getCurrentPortfolio,
  updateTradeEntry,
};
