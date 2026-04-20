(function initAssetNotesBoard(global) {
  function createNotesHelpers(deps = {}) {
    const {
      getNotesStorageKey,
      setNotesBoardStatus,
      canManagePortfolioMutations,
      escapeHtml,
      formatNumber,
      showAppConfirm,
      runSerializedNotesMutation,
      clearPendingMutationsByKind,
      scheduleServerStateSync,
      fetchWithAccessTimeout,
      createMutationRequestError,
      isServerMutationErrorRetryable,
      MUTATION_REQUEST_TIMEOUT_MS,
      isEmptyBoardVariant,
      getNotesState,
      setNotesState,
    } = deps;

    let hasLoadedNotes = false;
    let editingId = null;

    function setStatus(message = "", tone = "neutral") {
      setNotesBoardStatus(message, tone);
    }

    function normalizeStoredNotes(notes = []) {
      return (Array.isArray(notes) ? notes : [])
        .map((note) => ({
          id: String(note?.id || "").trim(),
          title: String(note?.title || "").trim(),
          body: String(note?.body || "").trim(),
          createdAt: String(note?.createdAt || "").trim(),
          updatedAt: String(note?.updatedAt || note?.createdAt || "").trim(),
        }))
        .filter((note) => note.id && (note.title || note.body))
        .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""), "ko"));
    }

    function loadNotesFromStorage() {
      if (typeof global === "undefined" || !global.localStorage) {
        return [];
      }

      try {
        const raw = global.localStorage.getItem(getNotesStorageKey());
        const parsed = raw ? JSON.parse(raw) : [];
        return normalizeStoredNotes(parsed);
      } catch (error) {
        console.error(error);
        return [];
      }
    }

    function persistNotesToStorage(notes) {
      if (typeof global === "undefined" || !global.localStorage) {
        return false;
      }

      try {
        global.localStorage.setItem(getNotesStorageKey(), JSON.stringify(notes));
        return true;
      } catch (error) {
        console.error(error);
        return false;
      }
    }

    function ensureNotesLoaded() {
      if (hasLoadedNotes) {
        return;
      }

      setNotesState(loadNotesFromStorage());
      hasLoadedNotes = true;
    }

    async function requestNotesMutation(method = "GET", payload = null, options = {}) {
      if (global.location.protocol === "file:") {
        throw new Error("메모 서버 저장은 배포 사이트 또는 로컬 서버에서만 가능합니다.");
      }

      const mutationId = String(options.mutationId || "").trim();
      const requestTimeoutMs = method === "GET" ? 6500 : MUTATION_REQUEST_TIMEOUT_MS;
      let response = null;

      try {
        response = await fetchWithAccessTimeout(
          "./api/notes",
          {
            method,
            headers: {
              Accept: "application/json",
              ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
              ...(mutationId && method !== "GET" ? { "X-Mutation-Id": mutationId } : {}),
            },
            ...(method === "GET" ? {} : { body: JSON.stringify(payload || {}) }),
          },
          requestTimeoutMs
        );
      } catch (error) {
        throw createMutationRequestError("메모 저장 연결이 일시적으로 끊겼습니다.", {
          retryable: method !== "GET",
        });
      }

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const errorMessage = result?.error || "메모 처리에 실패했습니다.";
        throw createMutationRequestError(errorMessage, {
          status: response.status,
          retryable: method !== "GET" && isServerMutationErrorRetryable(response.status, errorMessage),
        });
      }

      return result;
    }

    function renderNoteCard(note) {
      const canManage = canManagePortfolioMutations();
      return `
        <article class="note-card memo-card" data-note-id="${escapeHtml(note.id)}">
          <div class="memo-card-head">
            <div>
              <p class="mini-label">Saved Memo</p>
              <strong class="memo-card-title">${escapeHtml(getNoteTitle(note))}</strong>
            </div>
            ${
              canManage
                ? `
                  <div class="memo-card-actions">
                    <button type="button" class="memo-card-edit" data-note-edit="${escapeHtml(note.id)}">수정</button>
                    <button type="button" class="memo-card-delete" data-note-delete="${escapeHtml(note.id)}">삭제</button>
                  </div>
                `
                : ""
            }
          </div>
          <p class="memo-card-body">${escapeHtml(note.body || note.title).replaceAll("\n", "<br />")}</p>
          <div class="memo-card-meta">
            <span>${escapeHtml(formatNoteTimestamp(note.updatedAt || note.createdAt))}</span>
            <span>${escapeHtml(getNoteMeta(note))}</span>
          </div>
        </article>
      `;
    }

    function renderNotes(notes = getNotesState()) {
      const count = global.document.querySelector("#notes-count");
      const list = global.document.querySelector("#notes-list");
      if (!count || !list) {
        return;
      }

      count.textContent = `${formatNumber(notes.length)}개`;
      list.innerHTML = notes.length
        ? notes.map((note) => renderNoteCard(note)).join("")
        : `
            <article class="note-card notes-empty">
              <strong>${escapeHtml(isEmptyBoardVariant() ? "아직 메모가 없습니다." : "아직 저장된 메모가 없습니다.")}</strong>
              <p>${escapeHtml(
                isEmptyBoardVariant()
                  ? "매매 기준, 확인할 포인트, 나중에 다시 보고 싶은 생각을 짧게 남겨두세요."
                  : "매매 아이디어, 손절 기준, 체크 포인트를 짧게 쌓아두세요."
              )}</p>
            </article>
          `;
    }

    function getNoteTitle(note) {
      const title = String(note?.title || "").trim();
      if (title) {
        return title;
      }

      const body = String(note?.body || "").trim();
      if (!body) {
        return "메모";
      }

      return body.length > 28 ? `${body.slice(0, 28)}...` : body;
    }

    function getNoteMeta(note) {
      const length = String(note?.body || note?.title || "").trim().length;
      return `${formatNumber(length)}자`;
    }

    function formatNoteTimestamp(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return "방금 저장";
      }

      return new Intl.DateTimeFormat("ko-KR", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date);
    }

    function applyNotesServerResult(result = null) {
      const nextNotes = normalizeStoredNotes(result?.notes);
      setNotesState(nextNotes);
      hasLoadedNotes = true;
      persistNotesToStorage(nextNotes);
      renderNotes(nextNotes);
      return nextNotes;
    }

    async function hydrateNotesFromServer() {
      if (global.location.protocol === "file:") {
        return;
      }

      try {
        const result = await requestNotesMutation("GET");
        return applyNotesServerResult(result);
      } catch (error) {
        console.error(error);
        return getNotesState();
      }
    }

    function initNotesBoard() {
      const section = global.document.querySelector("#notes-section");
      if (!section) {
        return;
      }

      bindNotesSection(section);
    }

    function bindNotesSection(section) {
      if (!section || section.dataset.notesBound === "true") {
        return;
      }

      clearPendingMutationsByKind("note");

      const form = section.querySelector("#notes-form");
      const titleInput = section.querySelector("#note-title");
      const bodyInput = section.querySelector("#note-body");
      const resetButton = section.querySelector("[data-note-reset]");
      const submitButton = form?.querySelector(".btn-primary");
      const formEyebrow = section.querySelector("#notes-form-eyebrow");
      const formTitle = section.querySelector("#notes-form-title");
      let notesHydrationTimer = null;
      let isSubmittingNote = false;

      const scheduleNotesServerHydration = (delayMs = 180) => {
        if (global.location.protocol === "file:") {
          return;
        }

        if (notesHydrationTimer) {
          global.clearTimeout(notesHydrationTimer);
        }

        notesHydrationTimer = global.setTimeout(() => {
          notesHydrationTimer = null;
          scheduleServerStateSync(0, {
            includePortfolio: false,
            includeNotes: true,
          });
        }, delayMs);
      };

      const buildOptimisticNotes = (method, payload = {}) => {
        const timestamp = new Date().toISOString();
        const currentNotes = getNotesState();

        if (method === "POST") {
          return normalizeStoredNotes([
            {
              id: payload.id || `note-${Date.now()}`,
              title: payload.title,
              body: payload.body,
              createdAt: timestamp,
              updatedAt: timestamp,
            },
            ...currentNotes,
          ]);
        }

        if (method === "PUT") {
          return normalizeStoredNotes(
            currentNotes.map((note) =>
              note.id === payload.id
                ? {
                    ...note,
                    title: payload.title,
                    body: payload.body,
                    updatedAt: timestamp,
                  }
                : note
            )
          );
        }

        return normalizeStoredNotes(currentNotes.filter((note) => note.id !== payload.id));
      };

      const syncComposerControls = () => {
        const isEditing = Boolean(editingId);
        const canManage = canManagePortfolioMutations();

        if (submitButton) {
          submitButton.disabled = isSubmittingNote || !canManage;
          submitButton.textContent = isSubmittingNote ? (isEditing ? "수정 중..." : "저장 중...") : isEditing ? "수정 저장" : "메모 저장";
        }
        if (resetButton) {
          resetButton.disabled = isSubmittingNote || !canManage;
          resetButton.textContent = isEditing ? "수정 취소" : "입력 비우기";
        }
        if (titleInput) {
          titleInput.disabled = isSubmittingNote || !canManage;
        }
        if (bodyInput) {
          bodyInput.disabled = isSubmittingNote || !canManage;
        }
      };

      const setComposerMode = (note = null) => {
        editingId = note?.id || null;

        if (formEyebrow) {
          formEyebrow.textContent = note ? "Edit Memo" : "Quick Memo";
        }
        if (formTitle) {
          formTitle.textContent = note ? "투자 메모 수정" : "투자 메모 저장";
        }
        if (titleInput) {
          titleInput.value = note?.title || "";
        }
        if (bodyInput) {
          bodyInput.value = note?.body || "";
        }

        syncComposerControls();
      };

      form?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (isSubmittingNote) {
          return;
        }
        if (!canManagePortfolioMutations()) {
          setStatus("메모 저장은 owner 모드에서만 사용할 수 있습니다.", "error");
          return;
        }

        ensureNotesLoaded();
        const title = String(titleInput?.value || "").trim();
        const body = String(bodyInput?.value || "").trim();
        if (!title && !body) {
          setStatus("제목이나 내용을 하나는 적어주세요.", "error");
          bodyInput?.focus();
          return;
        }

        const isEditing = Boolean(editingId);
        const method = isEditing ? "PUT" : "POST";
        const notePayload = {
          ...(isEditing ? { id: editingId } : { id: `note-${Date.now()}` }),
          title,
          body,
        };
        let nextNotes = [];
        isSubmittingNote = true;
        syncComposerControls();

        try {
          if (global.location.protocol !== "file:") {
            try {
              const result = await runSerializedNotesMutation(() => requestNotesMutation(method, notePayload));
              nextNotes = normalizeStoredNotes(result?.notes);
              scheduleNotesServerHydration();
            } catch (error) {
              setStatus(error.message || "메모 저장에 실패했습니다. 연결 후 다시 시도해주세요.", "error");
              return;
            }
          } else {
            nextNotes = buildOptimisticNotes(method, notePayload);
          }

          persistNotesToStorage(nextNotes);
          setNotesState(nextNotes);
          renderNotes(nextNotes);
          setComposerMode();
          setStatus(isEditing ? "메모를 수정했습니다." : "메모를 저장했습니다.", "success");
          titleInput?.focus();
        } finally {
          isSubmittingNote = false;
          syncComposerControls();
        }
      });

      resetButton?.addEventListener("click", () => {
        const wasEditing = Boolean(editingId);
        setComposerMode();
        form?.reset();
        setStatus(wasEditing ? "메모 수정을 취소했습니다." : "입력을 비웠습니다.");
        titleInput?.focus();
      });

      section.addEventListener("click", async (event) => {
        const editButton = event.target.closest("[data-note-edit]");
        if (editButton && section.contains(editButton)) {
          if (!canManagePortfolioMutations()) {
            setStatus("메모 수정은 owner 모드에서만 사용할 수 있습니다.", "error");
            return;
          }
          ensureNotesLoaded();
          const note = getNotesState().find((item) => item.id === editButton.dataset.noteEdit);
          if (!note) {
            setStatus("수정할 메모를 찾지 못했습니다.", "error");
            return;
          }

          setComposerMode(note);
          setStatus("메모를 수정 중입니다.", "success");
          titleInput?.focus();
          return;
        }

        const deleteButton = event.target.closest("[data-note-delete]");
        if (!deleteButton || !section.contains(deleteButton)) {
          return;
        }
        if (!canManagePortfolioMutations()) {
          setStatus("메모 삭제는 owner 모드에서만 사용할 수 있습니다.", "error");
          return;
        }

        ensureNotesLoaded();
        const noteId = deleteButton.dataset.noteDelete;
        const confirmed = await showAppConfirm({
          eyebrow: "Memo Delete",
          title: "메모를 삭제할까요?",
          message: "선택한 메모를 보드에서 제거합니다.",
          confirmText: "삭제",
          cancelText: "취소",
          tone: "danger",
        });
        if (!confirmed) {
          return;
        }

        let nextNotes = [];
        if (global.location.protocol !== "file:") {
          try {
            const result = await runSerializedNotesMutation(() => requestNotesMutation("DELETE", { id: noteId }));
            nextNotes = normalizeStoredNotes(result?.notes);
            scheduleNotesServerHydration();
          } catch (error) {
            setStatus(error.message || "메모 삭제에 실패했습니다. 연결 후 다시 시도해주세요.", "error");
            return;
          }
        } else {
          nextNotes = buildOptimisticNotes("DELETE", { id: noteId });
        }

        persistNotesToStorage(nextNotes);
        setNotesState(nextNotes);
        renderNotes(nextNotes);
        if (editingId === noteId) {
          setComposerMode();
          form?.reset();
        }
        setStatus("메모를 삭제했습니다.", "success");
      });

      setComposerMode();
      section.dataset.notesBound = "true";
    }

    return Object.freeze({
      applyNotesServerResult,
      ensureNotesLoaded,
      normalizeStoredNotes,
      persistNotesToStorage,
      requestNotesMutation,
      hydrateNotesFromServer,
      renderNotes,
      initNotesBoard,
      bindNotesSection,
    });
  }

  global.AssetNotesBoard = Object.freeze({
    createNotesHelpers,
  });
})(window);
