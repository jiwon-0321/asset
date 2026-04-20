const { getBundledPortfolioData } = require("../lib/bundled-portfolio");
const { readJsonBody, sendJson } = require("../lib/api-route-utils");
const {
  getAccessFailureResponse,
  getResolvedBoardConfig,
  resolveAccessProfile,
  resolveOwnerAccessCodeLengths,
} = require("../lib/access-control");

module.exports = async (request, response) => {
  if (request.method === "GET") {
    const ownerCodeLengths = resolveOwnerAccessCodeLengths();
    sendJson(response, 200, {
      ok: true,
      ownerCodeLength: ownerCodeLengths.length === 1 ? ownerCodeLengths[0] : 0,
      ownerCodeLengths,
      board: getResolvedBoardConfig(),
    });
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method Not Allowed" }, { Allow: "GET, POST" });
    return;
  }

  try {
    const payload = await readJsonBody(request);
    const profile = resolveAccessProfile(payload.code, getBundledPortfolioData());

    if (!profile.ok) {
      const failure = getAccessFailureResponse(profile);
      sendJson(response, failure.statusCode, failure.payload);
      return;
    }

    sendJson(response, 200, {
      ok: true,
      mode: profile.mode,
      board: profile.board || getResolvedBoardConfig(),
    });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "접속 확인에 실패했습니다." });
  }
};
