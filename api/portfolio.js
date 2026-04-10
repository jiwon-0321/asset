const path = require("path");

const { sendJson } = require("../lib/api-route-utils");
const { getCurrentPortfolio } = require("../lib/persisted-portfolio-service");
const { resolveAccessProfile } = require("../lib/access-control");
const bundledPortfolioData = require("../data/portfolio.json");

module.exports = async (request, response) => {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method Not Allowed" }, { Allow: "GET" });
    return;
  }

  try {
    const profile = resolveAccessProfile(request.headers["x-access-code"], bundledPortfolioData);
    if (!profile.ok) {
      sendJson(response, 401, { error: "코드가 맞지 않습니다." });
      return;
    }

    const portfolio = await getCurrentPortfolio(path.resolve(__dirname, ".."), profile.seedPortfolio, profile.stateKey);
    sendJson(response, 200, portfolio);
  } catch (error) {
    sendJson(response, 500, { error: error.message || "포트폴리오를 불러오지 못했습니다." });
  }
};
