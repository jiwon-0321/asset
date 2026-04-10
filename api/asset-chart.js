const path = require("path");
const { resolveAccessProfile } = require("../lib/access-control");
const { buildAssetChartSnapshot } = require("../lib/asset-chart-service");
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
    const profile = resolveAccessProfile(request.headers["x-access-code"], bundledPortfolioData);
    if (!profile.ok) {
      response.statusCode = 401;
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ error: "코드가 맞지 않습니다." }));
      return;
    }

    const baseUrl = `http://${request.headers.host || "localhost"}`;
    const url = new URL(request.url || "/api/asset-chart", baseUrl);
    const market = url.searchParams.get("market") || "";
    const symbol = url.searchParams.get("symbol") || "";
    const name = url.searchParams.get("name") || symbol;
    const range = url.searchParams.get("range") || "1M";
    const granularity = url.searchParams.get("granularity") || "day";

    const payload = await buildAssetChartSnapshot({
      rootDir: path.resolve(__dirname, ".."),
      market,
      symbol,
      name,
      range,
      granularity,
    });

    response.statusCode = 200;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify(payload));
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: error.message || "차트 데이터를 불러오지 못했습니다." }));
  }
};
