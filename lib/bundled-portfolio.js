const path = require("path");

const BUNDLED_PORTFOLIO_RELATIVE_PATH = path.join("data", "portfolio-sample.json");

function getBundledPortfolioData() {
  return require(path.join("..", BUNDLED_PORTFOLIO_RELATIVE_PATH));
}

function getBundledPortfolioRelativePath() {
  return BUNDLED_PORTFOLIO_RELATIVE_PATH;
}

module.exports = {
  getBundledPortfolioData,
  getBundledPortfolioRelativePath,
};
