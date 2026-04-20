(function initAssetMetricCards(global) {
  function createMetricCardHelpers(deps = {}) {
    const {
      METRIC_CARD_TONES,
      isEmptyBoardVariant,
      formatPerformanceStartLabel,
      formatCurrency,
      formatSignedCurrency,
      toneClass,
      estimateUsStockTax,
      setTextContentIfChanged,
      onCashMetricAction,
    } = deps;

    function buildCashMetricDetail(summary, data = {}) {
      const baseDetail = isEmptyBoardVariant() ? "예수금과 현금 합계" : "주식예수금 + 현금 + 업비트 KRW";
      const manualAdjustment = data?.metadata?.manualCashAdjustment;
      const delta = Number(manualAdjustment?.delta || 0);

      if (!manualAdjustment?.active || !Number.isFinite(delta) || delta === 0) {
        return baseDetail;
      }

      return `${baseDetail} · 수동 조정 ${formatSignedCurrency(delta)}`;
    }

    function syncMetricCardAction(node, metric = {}) {
      if (!node) {
        return;
      }

      const actionButton = node.querySelector(".metric-card-action");
      const actionKey = String(metric.actionKey || "").trim();
      const actionText = String(metric.actionText || "").trim();
      const actionVisualText = String(metric.actionVisualText || actionText).trim();
      const actionLabel = String(metric.actionLabel || actionText).trim();
      const hideActionButton = metric.hideActionButton === true;
      const isActionable = Boolean(actionKey && (hideActionButton || (actionButton && actionText)));

      node.classList.toggle("metric-card--editable", isActionable);
      node.classList.toggle("metric-card--action-hidden", isActionable && hideActionButton);
      if (!actionButton) {
        if (!isActionable) {
          delete node.dataset.metricAction;
          return;
        }
        node.dataset.metricAction = actionKey;
        return;
      }

      if (!isActionable) {
        actionButton.hidden = true;
        actionButton.textContent = "";
        actionButton.removeAttribute("data-metric-action");
        actionButton.removeAttribute("aria-label");
        delete node.dataset.metricAction;
        return;
      }

      if (hideActionButton) {
        actionButton.hidden = true;
        actionButton.textContent = "";
        actionButton.removeAttribute("data-metric-action");
        actionButton.removeAttribute("aria-label");
        node.dataset.metricAction = actionKey;
        return;
      }

      actionButton.hidden = false;
      actionButton.textContent = actionVisualText;
      actionButton.dataset.metricAction = actionKey;
      actionButton.setAttribute("aria-label", `${metric.label || "지표"} ${actionLabel}`);
      node.dataset.metricAction = actionKey;
    }

    function buildMetricCardModels(summary, realized = [], metadata = {}, data = {}, options = {}) {
      const initialInvestment = summary.initialInvestment || 0;
      const initialInvestmentPnl = (summary.totalAssets || 0) - initialInvestment;
      const usStockTaxEstimate = estimateUsStockTax(realized);
      const realizedBasisDetail = isEmptyBoardVariant()
        ? "누적 매도 기록 기준"
        : formatPerformanceStartLabel(metadata?.realizedPerformanceStartDate)
          ? `${formatPerformanceStartLabel(metadata.realizedPerformanceStartDate)} 이후 매도 기준`
          : `유동성 비중 ${options.formatPercent(summary.liquidityRatio)}`;

      return [
        {
          key: "initial-investment",
          label: isEmptyBoardVariant() ? "시작 기준 금액" : "초기 투자금",
          value: formatCurrency(initialInvestment),
          detail: isEmptyBoardVariant() ? "시작 현금 + 보유 종목 합계" : "업비트 기준 시작 자금",
          tone: "neutral",
        },
        {
          key: "total-assets",
          label: "총 자산",
          value: formatCurrency(summary.totalAssets),
          detail: "전체 평가액",
          tone: "neutral",
        },
        {
          key: "initial-pnl",
          label: isEmptyBoardVariant() ? "시작 기준 대비 손익" : "초기 투자금 대비 손익",
          value: formatSignedCurrency(initialInvestmentPnl),
          detail: isEmptyBoardVariant() ? "총 자산 - 시작 기준 금액" : "총 자산 - 초기 투자금",
          tone: toneClass(initialInvestmentPnl),
        },
        {
          key: "cash-total",
          label: "현금 보유",
          value: formatCurrency(summary.cashTotal),
          detail: buildCashMetricDetail(summary, data),
          tone: "neutral",
          actionKey: options.isCashMetricEditable ? "edit-cash-total" : "",
          actionText: options.isCashMetricEditable ? "수정" : "",
          actionVisualText: options.isCashMetricEditable ? "수정" : "",
          actionLabel: options.isCashMetricEditable ? "수정" : "",
          hideActionButton: options.isCashMetricEditable,
        },
        {
          key: "realized-profit",
          label: "실현 손익",
          value: formatSignedCurrency(summary.realizedProfitTotal),
          detail: realizedBasisDetail,
          tone: toneClass(summary.realizedProfitTotal),
        },
        {
          key: "us-stock-tax",
          label: "해외주식 세금 추정",
          value: formatCurrency(usStockTaxEstimate.taxEstimate),
          detail: usStockTaxEstimate.detail,
          tone: usStockTaxEstimate.taxEstimate > 0 ? "loss" : "neutral",
        },
      ];
    }

    function buildMetricCardsSignature(metrics = []) {
      return metrics
        .map((metric) => {
          const classes = Array.isArray(metric.classes) ? metric.classes : [];
          return `${metric.key}::${metric.label}::${metric.value}::${metric.detail}::${metric.tone}::${metric.actionKey || ""}::${metric.actionText || ""}::${metric.actionVisualText || ""}::${metric.actionLabel || ""}::${metric.hideActionButton ? "1" : "0"}::${classes.join(",")}`;
        })
        .join("||");
    }

    function applyMetricCardTone(cardNode, valueNode, tone = "neutral") {
      METRIC_CARD_TONES.forEach((toneName) => {
        cardNode.classList.remove(`metric-card--${toneName}`);
        valueNode.classList.remove(toneName);
      });

      cardNode.classList.add(`metric-card--${tone}`);
      valueNode.classList.add(tone);
    }

    function renderMetricCards(summary, realized = [], metadata = {}, data = {}, options = {}) {
      const metrics = buildMetricCardModels(summary, realized, metadata, data, options);

      const template = global.document.querySelector("#metric-card-template");
      const grid = global.document.querySelector("#metric-grid");
      if (!template || !grid) {
        return;
      }

      const signature = buildMetricCardsSignature(metrics);
      if (grid.dataset.renderSignature === signature) {
        return;
      }

      grid.dataset.renderSignature = signature;
      grid.innerHTML = "";

      metrics.forEach((metric) => {
        const node = template.content.firstElementChild.cloneNode(true);
        const metricClasses = Array.isArray(metric.classes) ? metric.classes : [];
        node.dataset.metricKey = metric.key;
        node.dataset.metricClasses = metricClasses.join(" ");
        metricClasses.forEach((className) => node.classList.add(className));
        node.querySelector(".metric-label").textContent = metric.label;
        const valueNode = node.querySelector(".metric-value");
        valueNode.textContent = metric.value;
        applyMetricCardTone(node, valueNode, metric.tone);
        node.querySelector(".metric-detail").textContent = metric.detail;
        syncMetricCardAction(node, metric);
        grid.appendChild(node);
      });
    }

    function patchMetricCardsForLiveRefresh(summary, realized = [], metadata = {}, data = {}, options = {}) {
      const grid = global.document.querySelector("#metric-grid");
      if (!grid) {
        return;
      }

      const metrics = buildMetricCardModels(summary, realized, metadata, data, options);
      const cards = Array.from(grid.querySelectorAll(".metric-card"));
      if (cards.length !== metrics.length) {
        renderMetricCards(summary, realized, metadata, data, options);
        return;
      }

      const signature = buildMetricCardsSignature(metrics);
      if (grid.dataset.renderSignature === signature) {
        return;
      }

      const hasMismatchedStructure = metrics.some((metric, index) => cards[index]?.dataset.metricKey !== metric.key);
      if (hasMismatchedStructure) {
        renderMetricCards(summary, realized, metadata, data, options);
        return;
      }

      metrics.forEach((metric, index) => {
        const cardNode = cards[index];
        if (!cardNode) {
          return;
        }

        const metricClasses = Array.isArray(metric.classes) ? metric.classes : [];
        const prevMetricClasses = String(cardNode.dataset.metricClasses || "")
          .split(" ")
          .map((token) => token.trim())
          .filter(Boolean);
        prevMetricClasses.forEach((className) => cardNode.classList.remove(className));
        metricClasses.forEach((className) => cardNode.classList.add(className));
        cardNode.dataset.metricClasses = metricClasses.join(" ");

        const labelNode = cardNode.querySelector(".metric-label");
        const valueNode = cardNode.querySelector(".metric-value");
        const detailNode = cardNode.querySelector(".metric-detail");
        if (!labelNode || !valueNode || !detailNode) {
          return;
        }

        setTextContentIfChanged(labelNode, metric.label);
        setTextContentIfChanged(valueNode, metric.value);
        setTextContentIfChanged(detailNode, metric.detail);
        applyMetricCardTone(cardNode, valueNode, metric.tone);
        syncMetricCardAction(cardNode, metric);
      });

      grid.dataset.renderSignature = signature;
    }

    function initMetricCardActions() {
      const grid = global.document.querySelector("#metric-grid");
      if (!grid || grid.dataset.metricActionsBound === "true") {
        return;
      }

      grid.addEventListener("click", (event) => {
        const button = event.target.closest(".metric-card-action");
        const card = event.target.closest(".metric-card");
        if (!button && (!card || !grid.contains(card))) {
          return;
        }

        const actionKey = String((button?.dataset.metricAction || card?.dataset.metricAction || "")).trim();
        if (actionKey !== "edit-cash-total") {
          return;
        }

        event.preventDefault();
        onCashMetricAction?.(button || card);
      });

      grid.dataset.metricActionsBound = "true";
    }

    return {
      renderMetricCards,
      patchMetricCardsForLiveRefresh,
      initMetricCardActions,
    };
  }

  global.AssetMetricCards = {
    createMetricCardHelpers,
  };
})(window);
