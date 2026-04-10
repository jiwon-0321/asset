const path = require("path");
const { searchAssets } = require("../lib/asset-search-service");

module.exports = async (request, response) => {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.statusCode = 405;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }

  try {
    const baseUrl = `http://${request.headers.host || "localhost"}`;
    const url = new URL(request.url || "/api/asset-search", baseUrl);
    const market = url.searchParams.get("market") || "";
    const query = url.searchParams.get("query") || "";
    const suggestions = await searchAssets({
      rootDir: path.resolve(__dirname, ".."),
      market,
      query,
    });

    response.statusCode = 200;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ suggestions }));
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: error.message || "자산 검색에 실패했습니다." }));
  }
};
