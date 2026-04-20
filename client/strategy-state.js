(function initAssetStrategyState() {
  function createStrategyStateHelpers(deps = {}) {
    const {
      TRADE_STRATEGY_STAGE_OPTIONS,
      getCurrentBasisYear,
      parseTradeDate,
      resolveStrategyMarketKey,
      normalizeTradeStrategyStage,
      buildStrategyEntityKey,
      isBuyStrategyStage,
      isSellStrategyStage,
      getStrategyBudgetEntry,
      resolveStrategyBudgetRatio,
      resolveStrategyStageSummary,
      getDisplayAssetName,
      getMarketLabelFromMetaMarket,
      getTimelineTradeKey,
      renderTradeStageBadge,
      escapeHtml,
      formatNumber,
      formatCurrency,
      formatSignedCurrency,
      formatPercent,
      toneClass,
    } = deps;

    function collectStrategyTradeEntries(trades = {}, basisYear = getCurrentBasisYear()) {
      const sourceEntries = [
        ...(Array.isArray(trades?.stocks) ? trades.stocks : []).map((trade, sourceIndex) => ({
          ...trade,
          sourceCollection: "stocks",
          sourceIndex,
        })),
        ...(Array.isArray(trades?.crypto) ? trades.crypto : []).map((trade, sourceIndex) => ({
          ...trade,
          sourceCollection: "crypto",
          sourceIndex,
        })),
      ]
        .map((trade) => {
          const market = resolveStrategyMarketKey(trade.market || (trade.sourceCollection === "crypto" ? "crypto" : "kr-stock"));
          const stage = normalizeTradeStrategyStage(trade.stage);
          return {
            ...trade,
            market,
            stage,
            strategyKey: buildStrategyEntityKey({
              market,
              symbol: trade.symbol || "",
              asset: trade.asset || "",
            }),
            sortValue: parseTradeDate(trade.date, basisYear),
          };
        })
        .filter((trade) => trade.stage);

      sourceEntries.sort((left, right) => {
        if (right.sortValue !== left.sortValue) {
          return right.sortValue - left.sortValue;
        }
        if (left.sourceCollection !== right.sourceCollection) {
          return left.sourceCollection.localeCompare(right.sourceCollection, "ko");
        }
        return Number(right.sourceIndex || 0) - Number(left.sourceIndex || 0);
      });

      return sourceEntries;
    }

    function buildStrategyTradeEntries(trades = {}, basisYear = getCurrentBasisYear()) {
      const latestByKey = new Map();
      collectStrategyTradeEntries(trades, basisYear).forEach((trade) => {
        if (!latestByKey.has(trade.strategyKey)) {
          latestByKey.set(trade.strategyKey, trade);
        }
      });
      return latestByKey;
    }

    function buildStrategyTradeHistoryByKey(trades = {}, basisYear = getCurrentBasisYear()) {
      const historyByKey = new Map();
      collectStrategyTradeEntries(trades, basisYear).forEach((trade) => {
        const current = historyByKey.get(trade.strategyKey) || [];
        current.push(trade);
        historyByKey.set(trade.strategyKey, current);
      });
      return historyByKey;
    }

    function resolveStrategyBaselineQuantityValue(value = null) {
      const quantity = Number(value);
      return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
    }

    function resolveStrategySellBaselineQuantity(trade, tradeHistory = [], currentQuantity = 0) {
      const directBaseline = resolveStrategyBaselineQuantityValue(trade?.strategyBaselineQuantity);
      if (directBaseline > 0) {
        return directBaseline;
      }

      const historicalBaseline = tradeHistory
        .map((item) => resolveStrategyBaselineQuantityValue(item?.strategyBaselineQuantity))
        .find((value) => value > 0);
      if (historicalBaseline > 0) {
        return historicalBaseline;
      }

      const safeCurrentQuantity = Math.max(Number(currentQuantity || 0), 0);
      const cumulativeSoldQuantity = tradeHistory.reduce((total, item) => {
        if (!isSellStrategyStage(item?.stage) || String(item?.side || "").trim() !== "매도") {
          return total;
        }
        return total + Math.max(Number(item?.quantity || 0), 0);
      }, 0);
      if (cumulativeSoldQuantity > 0) {
        return safeCurrentQuantity + cumulativeSoldQuantity;
      }

      return safeCurrentQuantity > 0 ? safeCurrentQuantity : 0;
    }

    function resolveStrategyDisplayStage(stage = "", soldRatio = 0) {
      const normalizedStage = normalizeTradeStrategyStage(stage);
      if (normalizedStage === "1단계 익절" && soldRatio >= 0.28) {
        return "2단계 익절";
      }
      if (normalizedStage === "2단계 익절" && soldRatio >= 0.58) {
        return "3단계 추적";
      }
      return normalizedStage;
    }

    function buildStrategyDisplayHolding(holding = null, trade = null) {
      const market = resolveStrategyMarketKey(holding?.market || trade?.market || "");
      const symbol = holding?.symbol || trade?.symbol || "";
      const asset = holding?.asset || holding?.name || trade?.asset || "";

      return {
        ...(holding || {}),
        market,
        symbol,
        asset,
        name: holding?.name || asset || symbol,
        quantity: Number(holding?.quantity || 0),
        averagePrice: Number(holding?.averagePrice || 0),
        valuation: Number(holding?.valuation || 0),
        pnl: Number.isFinite(Number(holding?.pnl)) ? Number(holding.pnl) : null,
        returnRate: Number.isFinite(Number(holding?.returnRate)) ? Number(holding.returnRate) : null,
        liveQuote: holding?.liveQuote || null,
      };
    }

    function buildStrategyStatusEntry({ holding = null, trade, tradeHistory = [], strategyBudgets = {} } = {}) {
      if (!trade) {
        return null;
      }

      const displayHolding = buildStrategyDisplayHolding(holding, trade);
      const market = resolveStrategyMarketKey(displayHolding.market || trade.market || "");
      const assetName = displayHolding.asset || trade.asset || "";
      const symbol = displayHolding.symbol || trade.symbol || "";
      const strategyKey = buildStrategyEntityKey({
        market,
        symbol,
        asset: assetName,
      });
      const budgetEntry = getStrategyBudgetEntry(strategyBudgets, {
        market,
        symbol,
        asset: assetName,
      });
      const quantity = Number(displayHolding.quantity || 0);
      const investedAmount = quantity * Number(displayHolding.averagePrice || 0);
      const valuation = Number(displayHolding.valuation || 0);
      const pnl = Number.isFinite(displayHolding.pnl) ? displayHolding.pnl : valuation - investedAmount;
      const fallbackReturnRate = investedAmount > 0 ? pnl / investedAmount : 0;
      const returnRate = Number.isFinite(displayHolding.returnRate) ? displayHolding.returnRate : fallbackReturnRate;
      const isSellMode = isSellStrategyStage(trade.stage);
      const strategyBudget = Number(budgetEntry?.budget || 0);
      const targetRatio = resolveStrategyBudgetRatio(trade.stage);
      const targetAmount = strategyBudget > 0 && targetRatio > 0 ? strategyBudget * targetRatio : 0;
      const completionRate = targetAmount > 0 ? investedAmount / targetAmount : null;
      const remainingAmount = targetAmount > 0 ? Math.max(targetAmount - investedAmount, 0) : null;
      const sellBaselineQuantity = isSellMode ? resolveStrategySellBaselineQuantity(trade, tradeHistory, quantity) : 0;
      const sellRemainingRatio =
        isSellMode && sellBaselineQuantity > 0 ? Math.max(0, Math.min(quantity / sellBaselineQuantity, 1)) : 0;
      const soldQuantity = isSellMode && sellBaselineQuantity > 0 ? Math.max(sellBaselineQuantity - quantity, 0) : 0;
      const soldRatio = isSellMode && sellBaselineQuantity > 0 ? Math.max(0, Math.min(soldQuantity / sellBaselineQuantity, 1)) : 0;
      const displayStage = isSellMode ? resolveStrategyDisplayStage(trade.stage, soldRatio) : trade.stage;

      return {
        key: strategyKey,
        tradeKey: getTimelineTradeKey(trade),
        trade,
        holding: displayHolding,
        budgetEntry,
        displayName: getDisplayAssetName(displayHolding),
        marketLabel: getMarketLabelFromMetaMarket(market),
        stage: displayStage,
        mode: isSellMode ? "sell" : "buy",
        summary: resolveStrategyStageSummary(displayStage),
        investedAmount,
        strategyBudget,
        targetAmount,
        completionRate,
        remainingAmount,
        valuation,
        pnl,
        returnRate,
        hasLiveQuote: Boolean(displayHolding.liveQuote?.available),
        quantity,
        sellBaselineQuantity,
        sellRemainingRatio,
        soldQuantity,
        soldRatio,
        isClosedPosition: isSellMode && quantity <= 0,
      };
    }

    function buildStrategyStatusGroups({ holdings = [], trades = {}, strategyBudgets = {}, basisYear = getCurrentBasisYear() } = {}) {
      const latestTradeByKey = buildStrategyTradeEntries(trades, basisYear);
      const tradeHistoryByKey = buildStrategyTradeHistoryByKey(trades, basisYear);
      const holdingsByKey = new Map(
        holdings
          .filter((item) => Number(item.quantity || 0) > 0)
          .map((holding) => {
            const market = resolveStrategyMarketKey(holding.market || "");
            const key = buildStrategyEntityKey({
              market,
              symbol: holding.symbol || "",
              asset: holding.asset || holding.name || "",
            });
            return [key, holding];
          })
      );
      const candidateKeys = new Set();

      holdingsByKey.forEach((holding, key) => {
        const trade = latestTradeByKey.get(key);
        if (trade && (isBuyStrategyStage(trade.stage) || isSellStrategyStage(trade.stage))) {
          candidateKeys.add(key);
        }
      });

      latestTradeByKey.forEach((trade, key) => {
        if (isSellStrategyStage(trade.stage)) {
          candidateKeys.add(key);
        }
      });

      const entries = [...candidateKeys]
        .map((key) => {
          const trade = latestTradeByKey.get(key);
          if (!trade || (!isBuyStrategyStage(trade.stage) && !isSellStrategyStage(trade.stage))) {
            return null;
          }

          const holding = holdingsByKey.get(key) || null;
          if (isBuyStrategyStage(trade.stage) && !holding) {
            return null;
          }

          return buildStrategyStatusEntry({
            holding,
            trade,
            tradeHistory: tradeHistoryByKey.get(key) || [],
            strategyBudgets,
          });
        })
        .filter(Boolean)
        .sort((left, right) => {
          if (right.trade.sortValue !== left.trade.sortValue) {
            return right.trade.sortValue - left.trade.sortValue;
          }
          return left.displayName.localeCompare(right.displayName, "ko");
        });

      return {
        entries,
        totalEntries: entries.length,
      };
    }

    function renderStrategyMetric(label, value, tone = "neutral") {
      return `
        <div class="strategy-state-metric strategy-state-metric--${tone}">
          <span>${escapeHtml(label)}</span>
          <strong>${value}</strong>
        </div>
      `;
    }

    function resolveStrategyModeBadgeLabel(entry) {
      if (entry.stage === "관망") {
        return "";
      }

      if (entry.mode === "buy") {
        return "매수 진행";
      }

      if (entry.stage === "1단계 익절" || entry.stage === "2단계 익절") {
        return "익절 대기";
      }

      if (entry.stage === "3단계 추적") {
        return "트레일링 진행";
      }

      return "손절 대기";
    }

    function renderStrategyStageSwitcher(entry, options = {}) {
      if (options.canManage !== true) {
        return "";
      }

      const groupedOptions = [
        {
          label: "매수 단계",
          items: TRADE_STRATEGY_STAGE_OPTIONS.filter(
            (item) => isBuyStrategyStage(item.value) && item.value !== "관망"
          ),
        },
        {
          label: "매도 단계",
          items: TRADE_STRATEGY_STAGE_OPTIONS.filter((item) => isSellStrategyStage(item.value)),
        },
      ];

      return `
        <div class="strategy-stage-switcher">
          ${groupedOptions
            .map(
              (group) => `
                <div class="strategy-stage-group">
                  <span class="strategy-stage-group-label">${escapeHtml(group.label)}</span>
                  <div class="strategy-stage-group-buttons">
                    ${group.items
                      .map((item) => {
                        const isActive = item.value === entry.stage;
                        const tone = item.value === entry.stage ? " strategy-stage-chip--active" : "";
                        return `
                          <button
                            type="button"
                            class="strategy-stage-chip strategy-stage-chip--${escapeHtml(item.tone || "neutral")}${tone}"
                            data-strategy-stage-set="${escapeHtml(item.value)}"
                            data-strategy-trade-key="${escapeHtml(entry.tradeKey)}"
                            aria-pressed="${isActive ? "true" : "false"}"
                          >${escapeHtml(item.label)}</button>
                        `;
                      })
                      .join("")}
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      `;
    }

    function renderStrategyProgress(entry) {
      if (entry.mode === "buy") {
        if (!(entry.strategyBudget > 0 && entry.targetAmount > 0)) {
          return "";
        }

        const progressRate = Math.max(0, Math.min(entry.completionRate || 0, 1));
        return `
          <div class="strategy-progress">
            <div class="strategy-progress-head">
              <span>매수 목표 진행도</span>
              <strong>${formatPercent(progressRate)}</strong>
            </div>
            <p class="strategy-progress-caption">${formatCurrency(entry.investedAmount)} / ${formatCurrency(entry.targetAmount)}</p>
            <div class="strategy-progress-track" aria-hidden="true">
              <span class="strategy-progress-fill" style="width:${(progressRate * 100).toFixed(1)}%"></span>
            </div>
          </div>
        `;
      }

      const remainingRate = Math.max(0, Math.min(entry.sellRemainingRatio || 0, 1));
      const progressLabel = entry.sellBaselineQuantity > 0 ? `${formatPercent(remainingRate)} 남음` : "기준 수량 대기";
      const caption = entry.sellBaselineQuantity > 0
        ? `${formatNumber(entry.quantity)} / ${formatNumber(entry.sellBaselineQuantity)} 보유`
        : entry.isClosedPosition
          ? "전량 정리 완료"
          : "매도 시작 수량이 아직 없습니다.";

      return `
        <div class="strategy-progress strategy-progress--sell">
          <div class="strategy-progress-head">
            <span>남은 포지션</span>
            <strong>${progressLabel}</strong>
          </div>
          <p class="strategy-progress-caption">${caption}</p>
          <div class="strategy-progress-track" aria-hidden="true">
            <span class="strategy-progress-fill" style="width:${(remainingRate * 100).toFixed(1)}%"></span>
          </div>
        </div>
      `;
    }

    function renderStrategyStateCard(entry, options = {}) {
      const canManage = options.canManage === true;
      const isEditingBudget = canManage && options.strategyBudgetEditorKey === entry.key;
      const isBuyMode = entry.mode === "buy";
      const hasBudget = isBuyMode && entry.strategyBudget > 0;
      const renderStrategyBudgetForm = options.renderStrategyBudgetForm;
      const livePnlValue = entry.hasLiveQuote ? formatSignedCurrency(entry.pnl) : "실시간 대기";
      const liveReturnValue = entry.hasLiveQuote ? formatPercent(entry.returnRate) : "실시간 대기";
      const livePnlTone = entry.hasLiveQuote ? toneClass(entry.pnl) : "warning";
      const liveReturnTone = entry.hasLiveQuote ? toneClass(entry.returnRate) : "warning";
      const stageBadgeMarkup = entry.stage === "관망" ? "" : renderTradeStageBadge(entry.stage);
      const modeBadgeLabel = resolveStrategyModeBadgeLabel(entry);
      const budgetControlMarkup =
        canManage && hasBudget && !isEditingBudget
          ? `<button type="button" class="status-tag status-tag--action" data-strategy-budget-edit="${escapeHtml(entry.key)}">자금 수정</button>`
          : `<span class="status-tag ${hasBudget ? "" : "status-tag--warning"}">${hasBudget ? "전략 자금 연결됨" : "전략 자금 미설정"}</span>`;
      const metricsMarkup = isBuyMode
        ? `
          ${renderStrategyMetric("전략 자금", hasBudget ? formatCurrency(entry.strategyBudget) : "미설정", hasBudget ? "neutral" : "warning")}
          ${renderStrategyMetric("현재 단계 목표금액", hasBudget && entry.targetAmount > 0 ? formatCurrency(entry.targetAmount) : "계산 대기")}
          ${renderStrategyMetric("현재 집행금액", formatCurrency(entry.investedAmount))}
          ${renderStrategyMetric("남은 진입 가능금액", entry.remainingAmount != null ? formatCurrency(entry.remainingAmount) : "계산 대기")}
          ${renderStrategyMetric("현재 보유 수량", formatNumber(entry.quantity))}
          ${renderStrategyMetric("실시간 손익", livePnlValue, livePnlTone)}
          ${renderStrategyMetric("실시간 수익률", liveReturnValue, liveReturnTone)}
        `
        : `
          ${renderStrategyMetric("매도 시작 수량", entry.sellBaselineQuantity > 0 ? formatNumber(entry.sellBaselineQuantity) : "기준 대기")}
          ${renderStrategyMetric("현재 보유 수량", formatNumber(entry.quantity))}
          ${renderStrategyMetric("정리된 수량", entry.sellBaselineQuantity > 0 ? formatNumber(entry.soldQuantity) : "계산 대기")}
          ${renderStrategyMetric("현재 상태", entry.isClosedPosition ? "전량 정리됨" : "보유 중")}
          ${renderStrategyMetric("실시간 손익", entry.isClosedPosition ? "정리 완료" : livePnlValue, entry.isClosedPosition ? "neutral" : livePnlTone)}
          ${renderStrategyMetric("실시간 수익률", entry.isClosedPosition ? "정리 완료" : liveReturnValue, entry.isClosedPosition ? "neutral" : liveReturnTone)}
        `;

      return `
        <article
          class="strategy-state-card strategy-state-card--${escapeHtml(entry.mode)} panel"
          data-strategy-card-open="${escapeHtml(entry.tradeKey)}"
        >
          <div class="strategy-state-head">
            <div>
              <p class="mini-label">${escapeHtml(entry.marketLabel)}</p>
              <strong class="holding-title">${escapeHtml(entry.displayName)}</strong>
              <div class="timeline-badges">
                ${stageBadgeMarkup}
                ${modeBadgeLabel ? `<span class="status-tag">${escapeHtml(modeBadgeLabel)}</span>` : ""}
                <span class="status-tag status-tag--summary">${escapeHtml(entry.summary)}</span>
              </div>
            </div>
            <div class="strategy-state-actions">
              ${isBuyMode ? budgetControlMarkup : ""}
              ${
                canManage
                  ? `<button type="button" class="status-tag status-tag--action status-tag--danger" data-strategy-trade-delete="${escapeHtml(entry.tradeKey)}">전략 제거</button>`
                  : ""
              }
            </div>
          </div>
          ${canManage && isBuyMode && (!hasBudget || isEditingBudget) ? renderStrategyBudgetForm(entry, { editing: isEditingBudget }) : ""}
          <div class="strategy-state-metrics">
            ${metricsMarkup}
          </div>
          ${renderStrategyProgress(entry)}
          ${renderStrategyStageSwitcher(entry, options)}
          ${entry.trade.note ? `<p class="timeline-note">${escapeHtml(entry.trade.note)}</p>` : ""}
        </article>
      `;
    }

    return Object.freeze({
      buildStrategyStatusGroups,
      renderStrategyStateCard,
      resolveStrategyBaselineQuantityValue,
    });
  }

  window.AssetStrategyState = Object.freeze({
    createStrategyStateHelpers,
  });
})();
