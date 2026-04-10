const path = require("path");

const { readJsonBody, sendJson } = require("../lib/api-route-utils");
const { resolveAccessProfile } = require("../lib/access-control");
const { loadPersistedNotes, savePersistedNotes } = require("../lib/server-state-store");
const bundledPortfolioData = require("../data/portfolio.json");

function normalizeNotePayload(note = {}) {
  return {
    id: String(note.id || "").trim(),
    title: String(note.title || "").trim(),
    body: String(note.body || "").trim(),
    createdAt: note.createdAt || new Date().toISOString(),
    updatedAt: note.updatedAt || note.createdAt || new Date().toISOString(),
  };
}

function sortNotes(notes = []) {
  return [...notes].sort(
    (left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime()
  );
}

module.exports = async (request, response) => {
  if (!["GET", "POST", "PUT", "DELETE"].includes(request.method || "")) {
    sendJson(response, 405, { error: "Method Not Allowed" }, { Allow: "GET,POST,PUT,DELETE" });
    return;
  }

  try {
    const profile = resolveAccessProfile(request.headers["x-access-code"], bundledPortfolioData);
    if (!profile.ok) {
      sendJson(response, 401, { error: "코드가 맞지 않습니다." });
      return;
    }
    if (profile.mode !== "owner" && request.method !== "GET") {
      sendJson(response, 403, { error: "게스트 코드는 저장 기능을 사용할 수 없습니다." });
      return;
    }

    const rootDir = path.resolve(__dirname, "..");
    const notes = profile.mode === "owner" ? await loadPersistedNotes(rootDir, profile.stateKey) : [];

    if (request.method === "GET") {
      sendJson(response, 200, { notes: sortNotes(notes) });
      return;
    }

    const payload = await readJsonBody(request);

    if (request.method === "POST") {
      const note = normalizeNotePayload({
        id: `note-${Date.now()}`,
        title: payload.title,
        body: payload.body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const next = sortNotes([note, ...notes]);
      await savePersistedNotes(rootDir, next, profile.stateKey);
      sendJson(response, 200, { notes: next });
      return;
    }

    if (request.method === "PUT") {
      const noteId = String(payload.id || "").trim();
      if (!noteId) {
        throw new Error("수정할 메모 ID를 찾지 못했습니다.");
      }

      const timestamp = new Date().toISOString();
      const next = sortNotes(
        notes.map((note) =>
          note.id === noteId
            ? normalizeNotePayload({
                ...note,
                title: payload.title,
                body: payload.body,
                createdAt: note.createdAt,
                updatedAt: timestamp,
              })
            : normalizeNotePayload(note)
        )
      );

      await savePersistedNotes(rootDir, next, profile.stateKey);
      sendJson(response, 200, { notes: next });
      return;
    }

    const noteId = String(payload.id || "").trim();
    if (!noteId) {
      throw new Error("삭제할 메모 ID를 찾지 못했습니다.");
    }

    const next = sortNotes(notes.filter((note) => note.id !== noteId).map(normalizeNotePayload));
    await savePersistedNotes(rootDir, next, profile.stateKey);
    sendJson(response, 200, { notes: next });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "메모 처리에 실패했습니다." });
  }
};
