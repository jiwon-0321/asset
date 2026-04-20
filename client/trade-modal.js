(function registerTradeModal(global) {
  function initTradeModal() {
    const modal = document.querySelector("#trade-modal");
    const modalDialog = modal?.querySelector(".trade-modal-dialog");
    const openBtn = document.querySelector("#btn-add-trade");
    const form = document.querySelector("#trade-form");
    const modalEyebrow = document.querySelector("#trade-modal-eyebrow");
    const modalTitle = document.querySelector("#trade-modal-title");
    const modalHelper = document.querySelector("#trade-modal-helper");
    const tradeDateInput = document.querySelector("#trade-date");
    const tradeMonthSelect = document.querySelector("#trade-date-month");
    const tradeDaySelect = document.querySelector("#trade-date-day");
    const marketSelect = document.querySelector("#trade-market");
    const assetInput = document.querySelector("#trade-asset");
    const assetHelp = document.querySelector("#trade-asset-help");
    const assetSuggestionPanel = document.querySelector("#trade-asset-suggestions");
    const photoAssistTrigger = document.querySelector("#trade-photo-assist-trigger");
    const photoAssistInput = document.querySelector("#trade-photo-assist-input");
    const photoAssistStatus = document.querySelector("#trade-photo-assist-status");
    const photoAssistMeta = document.querySelector("#trade-photo-assist-meta");
    const photoAssistCandidates = document.querySelector("#trade-photo-assist-candidates");
    const watchTargetAddButton = document.querySelector("#trade-watch-target-add");
    const quickTargetAddButton = document.querySelector("#trade-quick-target-add");
    const quickTargetStatus = document.querySelector("#trade-quick-target-status");
    const quickTargetList = document.querySelector("#trade-quick-target-list");
    const brokerInput = document.querySelector("#trade-broker");
    const brokerGroup = document.querySelector("[data-trade-broker-group]");
    const brokerHelp = document.querySelector("#trade-broker-help");
    const priceLabel = document.querySelector("#trade-price-label");
    const priceHelp = document.querySelector("#trade-price-help");
    const quantityInput = document.querySelector("#trade-quantity");
    const priceInput = document.querySelector("#trade-price");
    const amountInput = document.querySelector("#trade-amount");
    const sideSelect = document.querySelector("#trade-side");
    const stageSelect = document.querySelector("#trade-stage");
    const feeInput = document.querySelector("#trade-fee");
    const feeOverrideToggle = document.querySelector("#trade-fee-override");
    const feeManualGroup = document.querySelector("#trade-fee-manual-group");
    const feeManualInput = document.querySelector("#trade-fee-manual");
    const summaryBroker = document.querySelector("#trade-summary-broker");
    const summaryAmount = document.querySelector("#trade-summary-amount");
    const summaryFee = document.querySelector("#trade-summary-fee");
    const submitButton = form?.querySelector(".btn-primary");
    const cancelButton = form?.querySelector(".btn-secondary");
    let editingTradeRef = null;
    let isSubmitting = false;
    let isPhotoAssistSubmitting = false;
    let photoAssistCandidateOptions = [];
    let selectedPhotoAssistCandidateIndex = -1;

    if (!modal || !openBtn || !form) {
      console.error("거래 추가 모달 요소를 찾을 수 없습니다");
      return;
    }

    const PHOTO_ASSIST_FIELD_LABELS = {
      date: "날짜",
      market: "시장",
      broker: "플랫폼",
      asset: "자산",
      symbol: "티커",
      side: "매수/매도",
      quantity: "수량",
      price: "단가",
      amount: "거래금액",
      fee: "수수료",
    };
    const PHOTO_ASSIST_LIMITS = Object.freeze({
      maxImageCount: 4,
      maxImageBytes: 2 * 1024 * 1024,
      preferredImageBytes: 1536 * 1024,
      minImageBytes: 512 * 1024,
      maxTotalImageBytes: 2560 * 1024,
      maxRequestBytes: 3840 * 1024,
      maxDimension: 2048,
      minLongEdge: 1280,
      outputMimeType: "image/jpeg",
    });
    const PHOTO_ASSIST_COMPRESSION_QUALITIES = [0.92, 0.86, 0.8, 0.74, 0.68];
    const PHOTO_ASSIST_SCALE_STEPS = [1, 0.92, 0.84, 0.76, 0.68];

    const buildTradeMutationMatch = (trade = {}) => {
      const match = {};
      const createdAt = String(trade.createdAt || trade.addedAt || "").trim();
      const date = String(trade.date || "").trim();
      const market = String(trade.market || "").trim();
      const broker = String(trade.broker || "").trim();
      const asset = String(trade.asset || "").trim();
      const symbol = String(trade.symbol || "").trim().toUpperCase();
      const side = String(trade.side || "").trim();
      const quantity = Number(trade.quantity);
      const price = Number(trade.price);

      if (createdAt) {
        match.createdAt = createdAt;
      }
      if (date) {
        match.date = date;
      }
      if (market) {
        match.market = market;
      }
      if (broker) {
        match.broker = broker;
      }
      if (asset) {
        match.asset = asset;
      }
      if (symbol) {
        match.symbol = symbol;
      }
      if (side) {
        match.side = side;
      }
      if (Number.isFinite(quantity)) {
        match.quantity = quantity;
      }
      if (Number.isFinite(price)) {
        match.price = price;
      }

      return Object.keys(match).length ? match : null;
    };

    const setStatus = (message = "", tone = "neutral") => {
      setTradeFormStatus(message, tone);
    };

    const setQuickTargetStatus = (message = "", tone = "neutral") => {
      if (!quickTargetStatus) {
        return;
      }
      quickTargetStatus.textContent = message;
      quickTargetStatus.dataset.tone = tone;
    };

    const setPhotoAssistStatus = (message = "", tone = "neutral") => {
      if (!photoAssistStatus) {
        return;
      }
      photoAssistStatus.textContent = message;
      photoAssistStatus.dataset.tone = tone;
    };

    const buildPhotoAssistCandidateChips = (result = {}) => {
      const chips = [];
      const missingLabels = (Array.isArray(result?.missingFields) ? result.missingFields : [])
        .map((field) => PHOTO_ASSIST_FIELD_LABELS[field] || field)
        .filter(Boolean);
      if (missingLabels.length) {
        chips.push(`빠진 항목 ${missingLabels.join(", ")}`);
      }

      const overallConfidence = Number(result?.confidence?.overall);
      if (Number.isFinite(overallConfidence)) {
        chips.push(`신뢰도 ${Math.round(overallConfidence * 100)}%`);
      }

      (Array.isArray(result?.warnings) ? result.warnings : [])
        .map((warning) => String(warning || "").trim())
        .filter(Boolean)
        .forEach((warning) => chips.push(warning));

      return chips;
    };

    const renderPhotoAssistMeta = (result = null) => {
      if (!photoAssistMeta) {
        return;
      }

      const chips = [];
      const candidateCount = Array.isArray(result?.candidates) ? result.candidates.length : 0;
      if (candidateCount > 1) {
        chips.push(`후보 ${candidateCount}개`);
      }
      const activeResult = result?.draft ? result : candidateCount === 1 ? result?.candidates?.[0] : null;
      chips.push(...buildPhotoAssistCandidateChips(activeResult));

      if (!chips.length) {
        setInnerHtmlIfChanged(photoAssistMeta, "");
        photoAssistMeta.hidden = true;
        return;
      }

      setInnerHtmlIfChanged(
        photoAssistMeta,
        chips.map((copy) => `<span class="trade-photo-assist-chip">${escapeHtml(copy)}</span>`).join("")
      );
      photoAssistMeta.hidden = false;
    };

    const renderPhotoAssistCandidates = (result = null) => {
      if (!photoAssistCandidates) {
        return;
      }

      const candidates = Array.isArray(result?.candidates) ? result.candidates.filter(Boolean) : [];
      photoAssistCandidateOptions = candidates;
      selectedPhotoAssistCandidateIndex = Number.isInteger(result?.selectedCandidateIndex) ? result.selectedCandidateIndex : -1;

      if (candidates.length <= 1) {
        setInnerHtmlIfChanged(photoAssistCandidates, "");
        photoAssistCandidates.hidden = true;
        return;
      }

      const markup = candidates
        .map((candidate, index) => {
          const chips = buildPhotoAssistCandidateChips(candidate)
            .slice(0, 3)
            .map((chip) => `<span class="trade-photo-assist-chip">${escapeHtml(chip)}</span>`)
            .join("");
          const classes = ["trade-photo-assist-candidate"];
          if (index === selectedPhotoAssistCandidateIndex) {
            classes.push("is-selected");
          }

          return `
            <button type="button" class="${classes.join(" ")}" data-photo-assist-candidate="${index}">
              <p class="trade-photo-assist-candidate-title">${escapeHtml(candidate?.label || `후보 ${index + 1}`)}</p>
              <p class="trade-photo-assist-candidate-summary">${escapeHtml(candidate?.summary || "이 후보를 폼에 적용")}</p>
              ${chips ? `<div class="trade-photo-assist-candidate-chips">${chips}</div>` : ""}
            </button>
          `;
        })
        .join("");

      setInnerHtmlIfChanged(photoAssistCandidates, markup);
      photoAssistCandidates.hidden = false;
    };

    const resetPhotoAssistState = () => {
      if (photoAssistInput) {
        photoAssistInput.value = "";
      }
      photoAssistCandidateOptions = [];
      selectedPhotoAssistCandidateIndex = -1;
      setPhotoAssistStatus("");
      renderPhotoAssistMeta();
      renderPhotoAssistCandidates();
    };

    const syncBusyState = () => {
      const canManage = activeAccessMode === "owner" && window.location.protocol !== "file:";
      if (openBtn) {
        openBtn.disabled = !canManage;
      }
      if (submitButton) {
        submitButton.disabled = isSubmitting || isPhotoAssistSubmitting || !canManage;
        if (isSubmitting) {
          submitButton.textContent = editingTradeRef ? "수정 중..." : "저장 중...";
        } else if (isPhotoAssistSubmitting) {
          submitButton.textContent = "사진 해석 중...";
        } else {
          submitButton.textContent = editingTradeRef ? "수정 저장" : "저장";
        }
      }
      if (cancelButton) {
        cancelButton.disabled = isSubmitting || isPhotoAssistSubmitting;
      }
      if (watchTargetAddButton) {
        watchTargetAddButton.disabled = isSubmitting || isPhotoAssistSubmitting || !canManage;
      }
      if (quickTargetAddButton) {
        quickTargetAddButton.disabled = isSubmitting || isPhotoAssistSubmitting || !canManage;
      }
      if (photoAssistTrigger) {
        photoAssistTrigger.disabled =
          isSubmitting || isPhotoAssistSubmitting || Boolean(editingTradeRef) || activeAccessMode !== "owner" || window.location.protocol === "file:";
        photoAssistTrigger.textContent = isPhotoAssistSubmitting ? "사진 해석 중..." : "사진으로 채우기";
      }
      if (photoAssistInput) {
        photoAssistInput.disabled =
          isSubmitting || isPhotoAssistSubmitting || Boolean(editingTradeRef) || activeAccessMode !== "owner" || window.location.protocol === "file:";
      }
      if (feeOverrideToggle) {
        feeOverrideToggle.disabled = isSubmitting || isPhotoAssistSubmitting;
      }
      if (feeManualInput) {
        feeManualInput.disabled = isSubmitting || isPhotoAssistSubmitting || !feeOverrideToggle?.checked;
      }
    };

    const setSubmitting = (nextSubmitting) => {
      isSubmitting = Boolean(nextSubmitting);
      syncBusyState();
    };

    const setPhotoAssistSubmitting = (nextSubmitting) => {
      isPhotoAssistSubmitting = Boolean(nextSubmitting);
      syncBusyState();
    };

    const setModalMode = (mode = "create") => {
      const isEditing = mode === "edit";
      editingTradeRef = isEditing ? editingTradeRef : null;

      if (modalEyebrow) {
        modalEyebrow.textContent = isEditing ? "Edit Trade" : "Quick Entry";
      }
      if (modalTitle) {
        modalTitle.textContent = isEditing ? "거래 수정" : "거래 추가";
      }
      if (modalHelper) {
        modalHelper.textContent = isEditing
          ? "기존 거래를 수정하면 보유수량과 손익도 함께 다시 계산됩니다."
          : "날짜와 체결값만 넣으면 거래금액은 계산되고, 수수료 기준은 플랫폼에 맞춰 고정됩니다.";
      }
      if (submitButton) {
        submitButton.textContent = isEditing ? "수정 저장" : "저장";
      }
      marketSelect.disabled = isEditing;
      syncBusyState();
    };

    const formatTradeAssetInputValue = (trade) => {
      const suggestion =
        resolveBestAssetAutocomplete(trade.market, trade.symbol || trade.asset) ||
        resolveBestAssetAutocomplete(trade.market, trade.asset);
      if (suggestion) {
        return suggestion.value;
      }

      const marketValue =
        trade.market === "암호화폐"
          ? "crypto"
          : trade.market === "미국주식"
            ? "us-stock"
            : trade.market === "국내주식"
              ? "kr-stock"
              : "";
      return formatAssetInputValue(
        {
          name: trade.asset,
          asset: trade.asset,
          symbol: trade.symbol || "",
          market: marketValue,
        },
        trade.market
      );
    };

    const parseBasisMonthDay = () => {
      return formatCurrentMonthDay();
    };

    const formatEditableNumber = (value, decimals = 8) => {
      if (value == null || Number.isNaN(Number(value))) {
        return "";
      }

      return Number(Number(value).toFixed(decimals)).toString();
    };

    const normalizeTradeAssetName = (value, market) => {
      const raw = stripAssetInputTickerSuffix(value, market);
      const upper = raw.toUpperCase();

      if (market === "암호화폐") {
        if (["BTC", "비트코인", "비트코인(BTC)"].includes(raw) || upper === "BTC") {
          return "비트코인";
        }
        if (["ETH", "이더리움", "이더리움(ETH)"].includes(raw) || upper === "ETH") {
          return "ETH";
        }
        if (["XRP", "엑스알피", "엑스알피(XRP)", "엑스알피(리플)", "리플"].includes(raw) || upper === "XRP") {
          return "XRP";
        }
      }

      if (market === "미국주식") {
        if (
          ["PLTR", "팔란티어", "Palantir Technologies", "Palantir Technologies (PLTR)"].includes(raw) ||
          upper === "PLTR"
        ) {
          return "팔란티어";
        }
        if (
          ["CRCL", "써클", "Circle Internet Group", "Circle Internet Group (CRCL)"].includes(raw) ||
          upper === "CRCL"
        ) {
          return "써클";
        }
      }

      if (market === "국내주식" && raw === "에스케이하이닉스") {
        return "SK하이닉스";
      }

      return raw;
    };

    const normalizeTradeSymbol = (value, market) => {
      const raw = String(value || "").trim();
      const upper = raw.toUpperCase();
      if (!upper) {
        return "";
      }

      if (market === "미국주식") {
        return /^[A-Z.\-]{1,15}$/.test(upper) ? upper : "";
      }

      if (market === "국내주식") {
        return /^[0-9]{6}$/.test(raw) ? raw : "";
      }

      if (market === "암호화폐") {
        const ticker = upper.replace(/^KRW-/, "");
        return /^[A-Z0-9]{2,15}$/.test(ticker) ? `KRW-${ticker}` : "";
      }

      return "";
    };

    const resolveTradeAssetPayload = (value, market) => {
      const raw = String(value || "").trim();
      const suggestion = resolveBestAssetAutocomplete(market, raw);
      const normalizedAsset = normalizeTradeAssetName(suggestion?.value || raw, market);

      if (!raw) {
        return {
          asset: normalizedAsset,
          symbol: "",
        };
      }

      const suggestedSymbol = normalizeTradeSymbol(suggestion?.symbol || "", market);
      if (suggestion && suggestedSymbol) {
        return {
          asset: normalizedAsset,
          symbol: suggestedSymbol,
        };
      }

      const matched = raw.match(/^(.+?)\s*\(([^()]+)\)\s*$/);
      const explicitSymbol = normalizeTradeSymbol(matched ? matched[2] : raw, market);
      if (explicitSymbol) {
        return {
          asset: normalizedAsset,
          symbol: explicitSymbol,
        };
      }

      if (
        editingTradeRef &&
        editingTradeRef.market === market &&
        normalizeAutocompleteToken(normalizedAsset) === normalizeAutocompleteToken(editingTradeRef.asset || "")
      ) {
        return {
          asset: normalizedAsset,
          symbol: normalizeTradeSymbol(editingTradeRef.symbol || "", market),
        };
      }

      return {
        asset: normalizedAsset,
        symbol: "",
      };
    };

    const mapMarketLabelToMetaMarket = (marketLabel = "") => {
      if (marketLabel === "암호화폐") {
        return "crypto";
      }
      if (marketLabel === "미국주식") {
        return "us-stock";
      }
      if (marketLabel === "국내주식") {
        return "kr-stock";
      }
      return "";
    };

    const formatQuickSelectionLabel = (item = {}) => {
      return formatAssetInputValue(
        {
          market: mapMarketLabelToMetaMarket(item.market),
          name: item.asset,
          asset: item.asset,
          symbol: item.symbol,
        },
        item.market
      );
    };

    const autocomplete = setupAssetAutocomplete({
      input: assetInput,
      marketSelect,
      panel: assetSuggestionPanel,
      asyncSource: fetchRemoteAssetSuggestions,
    });

    const resolveAssetActionPayload = () => {
      autocomplete.syncValue();
      const market = String(marketSelect.value || "").trim();
      const assetRaw = String(assetInput?.value || "").trim();
      if (!market || !assetRaw) {
        setQuickTargetStatus("자산을 먼저 입력하세요.", "error");
        assetInput?.focus();
        return null;
      }

      const resolvedAsset = resolveTradeAssetPayload(assetRaw, market);
      const targetAssetLabel =
        resolvedAsset.symbol && market !== "암호화폐"
          ? `${resolvedAsset.asset} (${resolvedAsset.symbol})`
          : resolvedAsset.asset;
      if (!targetAssetLabel) {
        setQuickTargetStatus("자산 정보를 다시 확인해주세요.", "error");
        return null;
      }

      return {
        market,
        resolvedAsset,
        targetAssetLabel,
      };
    };

    const renderQuickSelectionList = () => {
      if (!quickTargetList) {
        return;
      }

      const market = String(marketSelect.value || "").trim();
      const quickAssets = getTradeQuickAssets().filter((item) => item.market === market);
      if (!quickAssets.length) {
        setInnerHtmlIfChanged(quickTargetList, '<p class="trade-quick-empty">아직 비어 있습니다.</p>');
        return;
      }

      setInnerHtmlIfChanged(
        quickTargetList,
        quickAssets
          .map((item, index) => {
            return `<button type="button" class="trade-quick-chip" data-trade-quick-pick="${index}">${escapeHtml(formatQuickSelectionLabel(item))}</button>`;
          })
          .join("")
      );
    };

    const parseFormattedNumber = (value) => {
      const numeric = Number(String(value || "").replaceAll(",", "").trim());
      return Number.isFinite(numeric) ? numeric : 0;
    };

    const formatGroupedInputValue = (value) => {
      const sanitized = String(value || "")
        .replace(/[^\d.]/g, "")
        .replace(/^(\.)+/, "")
        .replace(/(\..*)\./g, "$1");

      if (!sanitized) {
        return "";
      }

      const [integerPartRaw, decimalPart] = sanitized.split(".");
      const integerPart = integerPartRaw.replace(/^0+(?=\d)/, "") || integerPartRaw || "0";
      const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return decimalPart !== undefined ? `${groupedInteger}.${decimalPart}` : groupedInteger;
    };

    const syncFormattedNumericField = (input) => {
      if (!input) {
        return;
      }

      input.value = formatGroupedInputValue(input.value);
    };

    const formatTradePhotoAssistAssetValue = (draft = {}) => {
      return formatAssetInputValue(
        {
          market: mapMarketLabelToMetaMarket(draft.market),
          name: draft.asset,
          asset: draft.asset,
          symbol: draft.symbol || "",
        },
        draft.market
      );
    };

    const formatPhotoAssistSize = (bytes = 0) => {
      const megaBytes = Number(bytes || 0) / (1024 * 1024);
      return `${megaBytes.toFixed(1)}MB`;
    };

    const readBlobAsDataUrl = (blob) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("이미지 파일을 읽지 못했습니다."));
        reader.readAsDataURL(blob);
      });

    const loadImageFromFile = (file) =>
      new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();
        const cleanup = () => {
          URL.revokeObjectURL(objectUrl);
        };

        image.onload = () => {
          cleanup();
          resolve(image);
        };
        image.onerror = () => {
          cleanup();
          reject(new Error("이미지 파일을 읽지 못했습니다."));
        };
        image.src = objectUrl;
      });

    const canvasToBlob = (canvas, mimeType, quality) =>
      new Promise((resolve, reject) => {
        if (typeof canvas.toBlob !== "function") {
          reject(new Error("이 브라우저에서는 사진 압축을 지원하지 않습니다."));
          return;
        }

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("이미지 압축에 실패했습니다."));
              return;
            }
            resolve(blob);
          },
          mimeType,
          quality
        );
      });

    const buildPhotoAssistFileName = (fileName = "", mimeType = PHOTO_ASSIST_LIMITS.outputMimeType) => {
      const trimmed = String(fileName || "").trim();
      const baseName = trimmed.replace(/\.[^.]+$/u, "") || "trade-photo";
      const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
      return `${baseName}.${extension}`;
    };

    const estimatePhotoAssistPayloadBytes = (payload) => {
      return new Blob([JSON.stringify(payload)]).size;
    };

    const finalizeNormalizedTradePhotoAssistImage = async (blob, fileName) => {
      return {
        byteLength: blob.size,
        imageDataUrl: await readBlobAsDataUrl(blob),
        imageMimeType: PHOTO_ASSIST_LIMITS.outputMimeType,
        imageName: buildPhotoAssistFileName(fileName, PHOTO_ASSIST_LIMITS.outputMimeType),
      };
    };

    const normalizeTradePhotoAssistFile = async (file, options = {}) => {
      const image = await loadImageFromFile(file);
      const sourceWidth = Math.max(1, Number(image.naturalWidth || image.width || 1));
      const sourceHeight = Math.max(1, Number(image.naturalHeight || image.height || 1));
      const longestEdge = Math.max(sourceWidth, sourceHeight);
      const baseScale = Math.min(1, PHOTO_ASSIST_LIMITS.maxDimension / longestEdge);
      const targetBytes = Math.max(
        PHOTO_ASSIST_LIMITS.minImageBytes,
        Math.min(
          PHOTO_ASSIST_LIMITS.maxImageBytes,
          Number(options.targetBytes || PHOTO_ASSIST_LIMITS.preferredImageBytes)
        )
      );
      let firstCandidateWithinMax = null;

      for (const scaleStep of PHOTO_ASSIST_SCALE_STEPS) {
        const appliedScale = Math.min(1, baseScale * scaleStep);
        const nextWidth = Math.max(1, Math.round(sourceWidth * appliedScale));
        const nextHeight = Math.max(1, Math.round(sourceHeight * appliedScale));
        const nextLongestEdge = Math.max(nextWidth, nextHeight);

        if (nextLongestEdge < PHOTO_ASSIST_LIMITS.minLongEdge && firstCandidateWithinMax) {
          break;
        }

        const canvas = document.createElement("canvas");
        canvas.width = nextWidth;
        canvas.height = nextHeight;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) {
          throw new Error("이미지 준비에 실패했습니다.");
        }

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, nextWidth, nextHeight);
        context.imageSmoothingEnabled = true;
        if ("imageSmoothingQuality" in context) {
          context.imageSmoothingQuality = "high";
        }
        context.drawImage(image, 0, 0, nextWidth, nextHeight);

        for (const quality of PHOTO_ASSIST_COMPRESSION_QUALITIES) {
          const blob = await canvasToBlob(canvas, PHOTO_ASSIST_LIMITS.outputMimeType, quality);
          const candidate = {
            blob,
            byteLength: blob.size,
          };

          if (!firstCandidateWithinMax && candidate.byteLength <= PHOTO_ASSIST_LIMITS.maxImageBytes) {
            firstCandidateWithinMax = candidate;
          }

          if (candidate.byteLength <= targetBytes) {
            return finalizeNormalizedTradePhotoAssistImage(candidate.blob, file.name);
          }
        }
      }

      if (firstCandidateWithinMax) {
        return finalizeNormalizedTradePhotoAssistImage(firstCandidateWithinMax.blob, file.name);
      }

      throw new Error(
        `${file.name || "선택한 사진"}이 너무 큽니다. 더 짧게 캡처하거나 일부를 잘라서 다시 시도해주세요.`
      );
    };

    const renderBrokerOptions = (market, preferredValue = "") => {
      if (!brokerInput) {
        return;
      }

      const options = BROKER_OPTIONS_BY_MARKET[market] || [];
      const isCrypto = market === "암호화폐";
      const resolvedValue = options.includes(preferredValue) ? preferredValue : isCrypto ? "업비트" : "";
      brokerInput.innerHTML = `
      ${isCrypto ? "" : '<option value="">플랫폼 선택</option>'}
      ${options
        .map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`)
        .join("")}
    `;
      brokerInput.value = resolvedValue;
    };

    const populateTradeStageOptions = (selectedValue = "") => {
      if (!stageSelect) {
        return;
      }

      stageSelect.innerHTML = buildTradeStageOptionsMarkup(selectedValue);
    };

    const getActiveBroker = () => {
      return marketSelect.value === "암호화폐" ? "업비트" : String(brokerInput?.value || "").trim();
    };

    const isManualFeeOverrideEnabled = () => Boolean(feeOverrideToggle?.checked);

    const getManualFeeValue = () => parseFormattedNumber(feeManualInput?.value || 0);

    const setResolvedFeeValue = (value = 0) => {
      feeInput.value = formatEditableNumber(Number(value || 0), 8) || "0";
      syncTradeSummary();
    };

    const syncManualFeeGroupState = () => {
      if (feeManualGroup) {
        feeManualGroup.hidden = !isManualFeeOverrideEnabled();
      }
      if (feeManualInput) {
        feeManualInput.disabled = !isManualFeeOverrideEnabled() || Boolean(submitButton?.disabled);
      }
    };

    const buildFeePolicyCopy = (broker, market, side) => {
      if (isManualFeeOverrideEnabled()) {
        const manualFee = getManualFeeValue();
        return manualFee > 0 ? `직접 입력 ${formatCurrency(manualFee)}` : "직접 입력";
      }
      return buildTradeFeeSummaryText({ broker, market, side });
    };

    const syncTradeSummary = () => {
      if (summaryBroker) {
        summaryBroker.textContent = getActiveBroker() || "입력 필요";
      }
      if (summaryAmount) {
        summaryAmount.textContent = formatCurrency(Number(amountInput.value || 0));
      }
      if (summaryFee) {
        summaryFee.textContent = buildFeePolicyCopy(getActiveBroker(), marketSelect.value, sideSelect.value);
      }
    };

    const calculateFee = () => {
      const broker = getActiveBroker();
      const market = marketSelect.value;
      const side = sideSelect.value;
      const amount = parseFloat(amountInput.value) || 0;
      const quantity = parseFormattedNumber(quantityInput?.value);

      syncManualFeeGroupState();

      if (isManualFeeOverrideEnabled()) {
        setResolvedFeeValue(getManualFeeValue());
        return;
      }

      if (!broker || !side || !amount) {
        setResolvedFeeValue(0);
        return;
      }

      const feeEstimate = estimateTradeFee({
        broker,
        market,
        side,
        amount,
        quantity,
      });

      if (!feeEstimate || !Number.isFinite(Number(feeEstimate.totalFee))) {
        setResolvedFeeValue(0);
        return;
      }

      setResolvedFeeValue(Number(feeEstimate.totalFee || 0));
    };

    const calculateAmount = () => {
      const quantity = parseFormattedNumber(quantityInput.value);
      const price = parseFormattedNumber(priceInput.value);
      const amount = quantity * price;
      amountInput.value = formatEditableNumber(amount) || "0";
      calculateFee();
    };

    const syncTradeFormMode = () => {
      const market = marketSelect.value || "암호화폐";
      const isCrypto = market === "암호화폐";
      const isUsStock = market === "미국주식";

      marketSelect.value = market;

      if (brokerGroup) {
        brokerGroup.hidden = isCrypto;
      }

      if (brokerInput) {
        const currentBroker = brokerInput.value;
        renderBrokerOptions(market, currentBroker);
        brokerInput.required = !isCrypto;
      }

      if (assetInput) {
        assetInput.placeholder =
          market === "국내주식"
            ? "삼성전자(005930)"
            : market === "미국주식"
              ? "Apple Inc. (AAPL)"
              : "솔라나(SOL)";
      }

      if (assetHelp) {
        assetHelp.hidden = !isUsStock;
        assetHelp.textContent = isUsStock ? "미국주식은 영문 회사명 또는 티커로 입력" : "";
      }

      if (priceLabel) {
        priceLabel.textContent = isUsStock ? "단가 (원화 기준)" : "단가 (원)";
      }

      if (priceInput) {
        priceInput.placeholder = "0";
      }

      if (priceHelp) {
        priceHelp.textContent = isCrypto ? "업비트 체결 단가 기준으로 입력합니다." : "체결 단가 기준으로 입력합니다.";
      }

      if (brokerHelp) {
        brokerHelp.textContent = buildMarketTradeFeeHelpText(market);
      }

      calculateAmount();
      renderQuickSelectionList();
    };

    const populateTradeMonthOptions = (selectedMonth = new Date().getMonth() + 1) => {
      if (!tradeMonthSelect) {
        return;
      }

      tradeMonthSelect.innerHTML = Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        return `<option value="${month}" ${month === selectedMonth ? "selected" : ""}>${month}월</option>`;
      }).join("");
    };

    const populateTradeDayOptions = (selectedDay = new Date().getDate()) => {
      if (!tradeDaySelect || !tradeMonthSelect) {
        return;
      }

      const selectedMonth = Number(tradeMonthSelect.value || new Date().getMonth() + 1);
      const daysInMonth = new Date(getCurrentBasisYear(), selectedMonth, 0).getDate();
      const resolvedDay = Math.min(selectedDay, daysInMonth);
      tradeDaySelect.innerHTML = Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        return `<option value="${day}" ${day === resolvedDay ? "selected" : ""}>${day}일</option>`;
      }).join("");
    };

    const syncTradeDateField = () => {
      if (!tradeDateInput || !tradeMonthSelect || !tradeDaySelect) {
        return "";
      }

      const month = Number(tradeMonthSelect.value || new Date().getMonth() + 1);
      const day = String(Number(tradeDaySelect.value || new Date().getDate())).padStart(2, "0");
      const normalized = `${month}/${day}`;
      tradeDateInput.value = normalized;
      return normalized;
    };

    const setTradeDate = (monthDay = parseBasisMonthDay()) => {
      const [month, day] = String(monthDay || parseBasisMonthDay())
        .split("/")
        .map((segment) => Number(segment));
      const selectedMonth = month || new Date().getMonth() + 1;
      const selectedDay = day || new Date().getDate();
      populateTradeMonthOptions(selectedMonth);
      populateTradeDayOptions(selectedDay);
      syncTradeDateField();
    };

    const applyTradePhotoAssistDraft = (result = {}) => {
      const draft = result?.draft && typeof result.draft === "object" ? result.draft : {};
      const nextMarket = String(draft.market || marketSelect.value || "").trim();

      if (draft.date) {
        setTradeDate(draft.date);
      }

      if (draft.side) {
        sideSelect.value = draft.side;
      }

      if (nextMarket) {
        marketSelect.value = nextMarket;
        syncTradeFormMode();
      }

      if (draft.broker && brokerInput) {
        brokerInput.value = draft.broker;
      }

      if (draft.asset && assetInput) {
        assetInput.value = formatTradePhotoAssistAssetValue({
          market: nextMarket,
          asset: draft.asset,
          symbol: draft.symbol || "",
        });
        autocomplete.syncValue();
      }

      if (draft.quantity != null && quantityInput) {
        quantityInput.value = formatGroupedInputValue(draft.quantity);
      }

      if (draft.price != null && priceInput) {
        priceInput.value = formatGroupedInputValue(draft.price);
      }

      if (draft.note && form.elements.note && !String(form.elements.note.value || "").trim()) {
        form.elements.note.value = draft.note;
      }

      if (draft.quantity != null || draft.price != null) {
        calculateAmount();
      } else if (draft.amount != null) {
        amountInput.value = formatEditableNumber(Number(draft.amount || 0)) || "0";
        calculateFee();
      }

      if (draft.fee != null) {
        if (feeOverrideToggle) {
          feeOverrideToggle.checked = true;
        }
        if (feeManualInput) {
          feeManualInput.value = formatGroupedInputValue(draft.fee);
        }
        syncManualFeeGroupState();
        setResolvedFeeValue(Number(draft.fee || 0));
      } else {
        if (feeOverrideToggle) {
          feeOverrideToggle.checked = false;
        }
        syncManualFeeGroupState();
        calculateFee();
      }

      syncTradeSummary();
    };

    const applySelectedPhotoAssistCandidate = (indexValue) => {
      const targetIndex = Number(indexValue);
      if (!Number.isInteger(targetIndex) || targetIndex < 0) {
        return;
      }

      const candidate = photoAssistCandidateOptions[targetIndex];
      if (!candidate) {
        return;
      }

      applyTradePhotoAssistDraft(candidate);
      selectedPhotoAssistCandidateIndex = targetIndex;
      renderPhotoAssistCandidates({
        candidates: photoAssistCandidateOptions,
        selectedCandidateIndex: targetIndex,
      });
      renderPhotoAssistMeta(candidate);

      const hasMissingFields = Array.isArray(candidate?.missingFields) && candidate.missingFields.length > 0;
      const hasWarnings = Array.isArray(candidate?.warnings) && candidate.warnings.length > 0;
      setPhotoAssistStatus(
        hasMissingFields || hasWarnings
          ? "선택한 후보를 폼에 채웠습니다. 비어 있거나 애매한 항목만 확인한 뒤 저장하세요."
          : "선택한 후보를 폼에 채웠습니다. 값만 확인한 뒤 저장하세요.",
        hasMissingFields || hasWarnings ? "warning" : "success"
      );
    };

    const requestTradePhotoAssistDraft = async (files = []) => {
      const selectedFiles = Array.isArray(files) ? files.filter(Boolean) : [];
      if (!selectedFiles.length) {
        return null;
      }

      if (activeAccessMode !== "owner" || window.location.protocol === "file:") {
        throw new Error("사진 초안은 owner 모드에서만 사용할 수 있습니다.");
      }

      if (selectedFiles.length > PHOTO_ASSIST_LIMITS.maxImageCount) {
        throw new Error(`사진은 최대 ${PHOTO_ASSIST_LIMITS.maxImageCount}장까지 함께 읽을 수 있습니다.`);
      }

      selectedFiles.forEach((file) => {
        if (!String(file.type || "").startsWith("image/")) {
          throw new Error("이미지 파일만 업로드할 수 있습니다.");
        }
        if (file.size > 20 * 1024 * 1024) {
          throw new Error("원본 사진이 너무 큽니다. 20MB 이하 이미지로 다시 시도해주세요.");
        }
      });

      const perImageTargetBytes = Math.max(
        PHOTO_ASSIST_LIMITS.minImageBytes,
        Math.floor(PHOTO_ASSIST_LIMITS.maxTotalImageBytes / selectedFiles.length)
      );
      const normalizedImages = await Promise.all(
        selectedFiles.map((file) =>
          normalizeTradePhotoAssistFile(file, {
            targetBytes: Math.min(PHOTO_ASSIST_LIMITS.preferredImageBytes, perImageTargetBytes),
          })
        )
      );
      const totalImageBytes = normalizedImages.reduce((sum, image) => sum + Number(image.byteLength || 0), 0);
      if (totalImageBytes > PHOTO_ASSIST_LIMITS.maxTotalImageBytes) {
        throw new Error(
          `선택한 사진 합계가 너무 큽니다. 전송용 합계는 ${formatPhotoAssistSize(PHOTO_ASSIST_LIMITS.maxTotalImageBytes)} 이하만 지원합니다. 긴 스크린샷은 잘라서 다시 시도해주세요.`
        );
      }

      const payload = {
        images: normalizedImages.map((image) => ({
          imageDataUrl: image.imageDataUrl,
          imageMimeType: image.imageMimeType,
          imageName: image.imageName,
        })),
        marketHint: marketSelect.value,
        brokerHint: getActiveBroker(),
        locale: "ko-KR",
      };
      const requestBytes = estimatePhotoAssistPayloadBytes(payload);
      if (requestBytes > PHOTO_ASSIST_LIMITS.maxRequestBytes) {
        throw new Error(
          `사진 전송 용량이 너무 큽니다. 전송 본문은 ${formatPhotoAssistSize(PHOTO_ASSIST_LIMITS.maxRequestBytes)} 이하만 지원합니다. 사진 수를 줄이거나 일부를 잘라서 다시 시도해주세요.`
        );
      }
      let response;

      try {
        response = await fetchWithAccessTimeout(
          "./api/trade-photo-assist",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
          20000
        );
      } catch (error) {
        throw new Error("사진 초안 요청이 잠시 끊겼습니다. 다시 시도해주세요.");
      }

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || "사진 초안을 만들지 못했습니다.");
      }

      return result;
    };

    const resetFormState = () => {
      editingTradeRef = null;
      form.reset();
      resetPhotoAssistState();
      quantityInput.value = "0";
      priceInput.value = "0";
      amountInput.value = "0";
      feeInput.value = "0";
      if (feeOverrideToggle) {
        feeOverrideToggle.checked = false;
      }
      if (feeManualInput) {
        feeManualInput.value = "0";
      }
      marketSelect.value = "암호화폐";
      sideSelect.value = "매수";
      populateTradeStageOptions();
      setTradeDate(parseBasisMonthDay());
      setModalMode("create");
      setQuickTargetStatus("");
      syncTradeFormMode();
    };

    const openEditModal = (trade) => {
      editingTradeRef = {
        collection: trade.sourceCollection,
        index: trade.sourceIndex,
        match: buildTradeMutationMatch(trade),
        market: trade.market || "",
        asset: trade.asset || "",
        symbol: trade.symbol || "",
      };
      setModalMode("edit");
      form.reset();
      resetPhotoAssistState();
      populateTradeStageOptions(trade.stage || "");
      setTradeDate(trade.date || parseBasisMonthDay());
      marketSelect.value = trade.market || "암호화폐";
      sideSelect.value = trade.side || "매수";
      assetInput.value = formatTradeAssetInputValue(trade);
      quantityInput.value = formatGroupedInputValue(trade.quantity);
      priceInput.value = formatGroupedInputValue(trade.price);
      if (brokerInput) {
        brokerInput.value = trade.broker || "";
      }
      if (feeManualInput) {
        feeManualInput.value = formatEditableNumber(Number(trade.fee || 0), 8) || "0";
      }
      if (form.elements.note) {
        form.elements.note.value = trade.note || "";
      }
      syncTradeFormMode();
      const estimatedFee = estimateTradeFee({
        broker: trade.broker || getActiveBroker(),
        market: trade.market || marketSelect.value,
        side: trade.side || sideSelect.value,
        amount: Number(trade.amount || 0),
        quantity: Number(trade.quantity || 0),
      });
      if (feeOverrideToggle) {
        feeOverrideToggle.checked = Math.abs(Number(trade.fee || 0) - Number(estimatedFee?.totalFee || 0)) > 0.000001;
      }
      calculateAmount();
    };

    const openModal = (trade = null) => {
      setStatus("");
      setSubmitting(false);
      setPhotoAssistSubmitting(false);
      if (trade) {
        openEditModal(trade);
      } else {
        resetFormState();
      }
      modal.hidden = false;
      modal.setAttribute("aria-hidden", "false");
      modal.classList.add("is-open");
      document.body.classList.add("modal-open");
      modalDialog?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      window.requestAnimationFrame(() => {
        modalDialog?.scrollTo({ top: 0, left: 0, behavior: "auto" });
        if (!isMobileSectionMode()) {
          assetInput?.focus({ preventScroll: true });
        }
      });
    };

    const addAssetToWatchTarget = async () => {
      if (!watchTargetAddButton) {
        return;
      }

      const actionPayload = resolveAssetActionPayload();
      if (!actionPayload) {
        return;
      }

      try {
        watchTargetAddButton.disabled = true;
        setQuickTargetStatus("관심목록 추가 중...", "neutral");
        await applyTargetMutation(
          "POST",
          {
            market: actionPayload.market,
            asset: actionPayload.targetAssetLabel,
          },
          "관심종목을 저장했습니다. 실시간 추적도 같이 시작합니다."
        );
        setQuickTargetStatus("관심목록에 추가했습니다.", "success");
      } catch (error) {
        console.error(error);
        setQuickTargetStatus(error.message || "관심목록 추가에 실패했습니다.", "error");
      } finally {
        watchTargetAddButton.disabled = false;
      }
    };

    const addAssetToQuickTarget = async () => {
      if (!quickTargetAddButton) {
        return;
      }

      const actionPayload = resolveAssetActionPayload();
      if (!actionPayload) {
        return;
      }

      const nextItem = {
        market: actionPayload.market,
        asset: actionPayload.resolvedAsset.asset,
        symbol: actionPayload.resolvedAsset.symbol,
        updatedAt: new Date().toISOString(),
      };
      const currentItems = getTradeQuickAssets();
      const nextItemKey = buildTradeQuickAssetStateKey(nextItem);
      const alreadyExists = currentItems.some((item) => buildTradeQuickAssetStateKey(item) === nextItemKey);
      if (alreadyExists) {
        setQuickTargetStatus("이미 빠른선택에 있습니다.", "neutral");
        return;
      }
      const nextItems = normalizeTradeQuickAssetsState([...currentItems, nextItem]);

      try {
        quickTargetAddButton.disabled = true;
        setQuickTargetStatus("빠른선택 저장 중...", "neutral");
        queueUiPreferencesMutation(
          {
            ...currentUiPreferences,
            tradeQuickAssets: nextItems,
          },
          "빠른선택을 저장했습니다.",
          {
            rerenderSettings: false,
          }
        );
        renderQuickSelectionList();
        setQuickTargetStatus("빠른선택에 추가했습니다.", "success");
      } catch (error) {
        console.error(error);
        setQuickTargetStatus(error.message || "빠른선택 추가에 실패했습니다.", "error");
      } finally {
        quickTargetAddButton.disabled = false;
      }
    };

    const applyQuickSelectionAsset = (indexValue) => {
      const targetIndex = Number(indexValue);
      if (!Number.isInteger(targetIndex) || targetIndex < 0) {
        return;
      }

      const market = String(marketSelect.value || "").trim();
      const marketItems = getTradeQuickAssets().filter((item) => item.market === market);
      const selectedItem = marketItems[targetIndex];
      if (!selectedItem) {
        return;
      }

      assetInput.value = formatQuickSelectionLabel(selectedItem);
      autocomplete.syncValue();
      setQuickTargetStatus("빠른선택에서 자산을 불러왔습니다.", "success");
    };

    const handleTradePhotoAssistSelection = async () => {
      const files = Array.from(photoAssistInput?.files || []).filter(Boolean);
      if (!files.length) {
        return;
      }

      try {
        setStatus("");
        setPhotoAssistSubmitting(true);
        setPhotoAssistStatus(`사진 ${files.length}장에서 거래 초안을 읽는 중입니다...`, "neutral");
        renderPhotoAssistMeta();
        renderPhotoAssistCandidates();
        const result = await requestTradePhotoAssistDraft(files);
        const candidates = Array.isArray(result?.candidates) ? result.candidates.filter(Boolean) : [];

        if (candidates.length > 1) {
          renderPhotoAssistCandidates({
            candidates,
            selectedCandidateIndex: -1,
          });
          renderPhotoAssistMeta({
            candidates,
          });
          setPhotoAssistStatus("해석 후보를 찾았습니다. 가장 맞는 거래를 눌러 폼에 채우세요.", "warning");
        } else {
          const resolvedResult = candidates[0] || result;
          applyTradePhotoAssistDraft(resolvedResult);

          const hasMissingFields = Array.isArray(resolvedResult?.missingFields) && resolvedResult.missingFields.length > 0;
          const hasWarnings = Array.isArray(resolvedResult?.warnings) && resolvedResult.warnings.length > 0;
          setPhotoAssistStatus(
            hasMissingFields || hasWarnings
              ? "사진 초안을 채웠습니다. 비어 있거나 애매한 항목만 확인한 뒤 저장하세요."
              : "사진 초안을 폼에 채웠습니다. 값만 확인한 뒤 저장하세요.",
            hasMissingFields || hasWarnings ? "warning" : "success"
          );
          renderPhotoAssistMeta(resolvedResult);
          renderPhotoAssistCandidates({
            candidates,
            selectedCandidateIndex: 0,
          });
        }
      } catch (error) {
        console.error(error);
        setPhotoAssistStatus(error.message || "사진 초안을 만들지 못했습니다.", "error");
        renderPhotoAssistMeta();
        renderPhotoAssistCandidates();
      } finally {
        if (photoAssistInput) {
          photoAssistInput.value = "";
        }
        setPhotoAssistSubmitting(false);
      }
    };

    openBtn.addEventListener("click", (event) => {
      if (activeAccessMode !== "owner" || window.location.protocol === "file:") {
        event.preventDefault();
        setStatus("거래 추가는 owner 모드에서만 사용할 수 있습니다.", "error");
        return;
      }
      event.stopPropagation();
      finalizeMobileModalLaunch("timeline-section");
      openModal();
    });

    const closeModal = () => {
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
      modal.classList.remove("is-open");
      document.body.classList.remove("modal-open");
      setStatus("");
      setQuickTargetStatus("");
      setSubmitting(false);
      setPhotoAssistSubmitting(false);
      resetFormState();
      reopenPendingMobileSection();
    };

    modal.addEventListener("click", (event) => {
      if (event.target.closest("[data-trade-modal-close]") || event.target === modal) {
        closeModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) {
        closeModal();
      }
    });

    quantityInput.addEventListener("input", () => {
      syncFormattedNumericField(quantityInput);
      calculateAmount();
    });
    priceInput.addEventListener("input", () => {
      syncFormattedNumericField(priceInput);
      calculateAmount();
    });
    quantityInput.addEventListener("blur", () => syncFormattedNumericField(quantityInput));
    priceInput.addEventListener("blur", () => syncFormattedNumericField(priceInput));
    feeManualInput?.addEventListener("input", () => {
      syncFormattedNumericField(feeManualInput);
      calculateFee();
    });
    feeManualInput?.addEventListener("blur", () => syncFormattedNumericField(feeManualInput));
    feeOverrideToggle?.addEventListener("change", () => {
      syncManualFeeGroupState();
      calculateFee();
      if (feeOverrideToggle.checked) {
        feeManualInput?.focus({ preventScroll: true });
      }
    });
    tradeMonthSelect?.addEventListener("change", () => {
      populateTradeDayOptions(Number(tradeDaySelect?.value || 1));
      syncTradeDateField();
    });
    tradeDaySelect?.addEventListener("change", syncTradeDateField);
    brokerInput?.addEventListener("change", calculateFee);
    sideSelect.addEventListener("change", calculateFee);
    marketSelect.addEventListener("change", syncTradeFormMode);
    assetInput?.addEventListener("input", () => setQuickTargetStatus(""));
    photoAssistTrigger?.addEventListener("click", () => {
      setStatus("");
      setPhotoAssistStatus("");
      renderPhotoAssistMeta();
      renderPhotoAssistCandidates();
      photoAssistInput?.click();
    });
    photoAssistInput?.addEventListener("change", () => {
      void handleTradePhotoAssistSelection();
    });
    photoAssistCandidates?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-photo-assist-candidate]");
      if (!button || !photoAssistCandidates.contains(button)) {
        return;
      }
      applySelectedPhotoAssistCandidate(button.dataset.photoAssistCandidate);
    });
    watchTargetAddButton?.addEventListener("click", addAssetToWatchTarget);
    quickTargetAddButton?.addEventListener("click", addAssetToQuickTarget);
    quickTargetList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-trade-quick-pick]");
      if (!button || !quickTargetList.contains(button)) {
        return;
      }
      applyQuickSelectionAsset(button.dataset.tradeQuickPick);
    });
    resetFormState();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setStatus("");
      autocomplete.syncValue();
      const normalizedDate = syncTradeDateField() || String(tradeDateInput?.value || "").trim();

      const formData = new FormData(form);
      const marketValue = String(formData.get("market") || editingTradeRef?.market || marketSelect?.value || "").trim();
      const resolvedTradeAsset = resolveTradeAssetPayload(formData.get("asset"), marketValue);
      const tradeData = {
        date: formatDateInputToMonthDay(normalizedDate),
        market: marketValue,
        broker: getActiveBroker(),
        asset: resolvedTradeAsset.asset,
        symbol: resolvedTradeAsset.symbol,
        side: formData.get("side"),
        stage: formData.get("stage") || "",
        quantity: parseFormattedNumber(formData.get("quantity")),
        price: parseFormattedNumber(formData.get("price")),
        amount: parseFloat(amountInput.value),
        fee: parseFloat(feeInput.value),
        note: formData.get("note") || "",
      };

      try {
        setSubmitting(true);
        if (editingTradeRef) {
          await applyTradeMutation("PUT", {
            collection: editingTradeRef.collection,
            index: editingTradeRef.index,
            ...(editingTradeRef.match ? { match: editingTradeRef.match } : {}),
            trade: tradeData,
          });
        } else {
          await applyTradeMutation("POST", tradeData);
        }
        closeModal();
      } catch (error) {
        console.error(error);
        setStatus(error.message || (editingTradeRef ? "거래 수정에 실패했습니다." : "거래 저장에 실패했습니다."), "error");
        setSubmitting(false);
      }
    });

    tradeModalController = {
      openCreate: () => openModal(),
      openAdd: () => openModal(),
      openEdit: (trade) => openModal(trade),
    };
    syncBusyState();
  }

  global.AssetInitTradeModal = initTradeModal;
})(window);
