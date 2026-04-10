const path = require("path");
const { buildLivePriceSnapshot } = require("../lib/live-price-service");
const bundledPortfolioData = require("../data/portfolio.json");

module.exports = async (request, response) => {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.statusCode = 405;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }

  try {
    const payload = await buildLivePriceSnapshot({
      rootDir: path.resolve(__dirname, ".."),
      portfolioData: bundledPortfolioData,
    });

    response.statusCode = 200;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify(payload));
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: error.message || "실시간 시세를 불러오지 못했습니다." }));
  }
};
