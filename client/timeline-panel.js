(function initAssetTimelinePanel(global) {
  function createTimelineHelpers(deps = {}) {
    const {
      escapeHtml,
      formatNumber,
      formatCurrency,
      formatSignedCurrency,
      formatPercent,
      formatSignedPercent,
      formatDateTime,
      getSignedPriceToneClass,
      renderTradeStageBadge,
      getDisplayAssetName,
      getDisplayTradeNote,
      formatTradeQuantity,
      normalizeTradeQuantityKey,
      normalizeTimelineMoney,
      isXrpTradeLike,
      isEmptyBoardVariant,
      buildXrpRecentBuyPoolAnalytics,
      computeXrpDefenseOverrideOutcome,
      formatXrpDefenseGapLabel,
      parseTradeOutcomeNote,
      buildXrpDefenseSnapshot,
      getCurrentBasisYear,
      getCurrentContext,
      setTimelineTradeRegistry,
      canManagePortfolioMutations,
      bindTimelineSection,
    } = deps;

    function buildTimelineDefenseBadgeState(trade, xrpDefenseReferencePrice = 0) {
      const isSellTrade = String(trade?.side || "") === "매도";
      const isCryptoTrade = String(trade?.market || "") === "암호화폐";
      if (!isSellTrade || !isCryptoTrade || !isXrpTradeLike(trade)) {
        return null;
      }

      const referencePrice = normalizeTimelineMoney(trade?.xrpDefenseReferencePrice || xrpDefenseReferencePrice);
      const recentBuyAverage = normalizeTimelineMoney(Number(trade?.xrpDefenseRecentBuyAverage || 0));
      const referenceQuantity = normalizeTimelineMoney(Number(trade?.xrpDefenseRecentBuyQuantity || 0));
      const applicableQuantity = normalizeTimelineMoney(Number(trade?.xrpDefenseApplicableQuantity || 0));
      const standardQuantity = normalizeTimelineMoney(Number(trade?.xrpDefenseStandardQuantity || 0));
      const standardAveragePrice = normalizeTimelineMoney(Number(trade?.xrpDefenseStandardAveragePrice || 0));
      const gapRate = Number.isFinite(Number(trade?.xrpDefenseGapRate)) ? Number(trade.xrpDefenseGapRate) : 0;
      const gapLabel = formatXrpDefenseGapLabel(gapRate);
      if (!(referencePrice > 0)) {
        return {
          mode: "info",
          label: "기준가 계산 대기",
          title: "최근 매수 10건 평균 기준가를 아직 계산하지 못했습니다.",
          referencePrice: 0,
        };
      }

      return {
        mode: "info",
        label: gapRate > 0 ? `괴리율 ${gapLabel}` : "방어 기준",
        title:
          referenceQuantity > 0
            ? `${formatNumber(referenceQuantity)} XRP · 평균 ${formatCurrency(recentBuyAverage)} · 실제 괴리율 ${gapLabel} · 기준가 ${formatCurrency(referencePrice)} · 방어손익은 최신 방어 매수부터 차감${
                applicableQuantity > 0 ? ` · 방어 적용 ${formatNumber(applicableQuantity)} XRP` : ""
              }${
                standardQuantity > 0 && standardAveragePrice > 0
                  ? ` · 일반 적용 ${formatNumber(standardQuantity)} XRP (${formatCurrency(standardAveragePrice)})`
                  : ""
              }`
            : `기준가 ${formatCurrency(referencePrice)}`,
        referencePrice,
      };
    }

    function renderTimelineDefenseBadge(trade, xrpDefenseReferencePrice = 0) {
      const badge = buildTimelineDefenseBadgeState(trade, xrpDefenseReferencePrice);
      if (!badge) {
        return "";
      }

      const className =
        badge.referencePrice > 0
          ? "timeline-defense-badge timeline-defense-badge--info"
          : "timeline-defense-badge timeline-defense-badge--disabled";

      return `<span class="${className}" title="${escapeHtml(badge.title)}">${escapeHtml(badge.label)}</span>`;
    }

    function renderTimelineTradeBadges(trade, options = {}) {
      return `
        <div class="timeline-badges">
          <span class="trade-side ${trade.side === "매수" ? "trade-side-buy" : "trade-side-sell"}">${trade.side}</span>
          ${renderTradeStageBadge(trade.stage)}
          ${renderTimelineDefenseBadge(trade, Number(options?.xrpDefenseReferencePrice || 0))}
        </div>
      `;
    }

    function formatRealizedTradeDisplay(pnl, returnRate = null) {
      if (!Number.isFinite(Number(pnl))) {
        return "";
      }

      return Number.isFinite(Number(returnRate))
        ? `${formatSignedCurrency(pnl)} (${formatPercent(returnRate)})`
        : formatSignedCurrency(pnl);
    }

    function buildTimelineDefenseCalculationLines(trade = {}) {
      if (
        trade.side !== "매도" ||
        !isXrpTradeLike(trade) ||
        !Number.isFinite(Number(trade.defenseRealizedPnl)) ||
        !(Number(trade.xrpDefenseReferencePrice || 0) > 0)
      ) {
        return [];
      }

      const recentBuyAverage = normalizeTimelineMoney(Number(trade.xrpDefenseRecentBuyAverage || 0));
      const gapRate = Number.isFinite(Number(trade.xrpDefenseGapRate)) ? Number(trade.xrpDefenseGapRate) : null;
      const quantity = Number(trade.quantity || 0);
      const sellPrice = normalizeTimelineMoney(Number(trade.price || 0));
      const defenseOutcome = computeXrpDefenseOverrideOutcome(trade, {
        referencePrice: Number(trade.xrpDefenseReferencePrice || 0),
        applicableQuantity: Number(trade.xrpDefenseApplicableQuantity || 0),
        standardAveragePrice: Number(trade.xrpDefenseStandardAveragePrice || 0),
        defenseLotItems: trade.xrpDefenseLotItems,
      });
      if (!defenseOutcome) {
        return [];
      }

      const lines = [];
      if (recentBuyAverage > 0 && gapRate != null) {
        const quantitySummary =
          defenseOutcome.standardQuantity > 0
            ? `방어 ${formatTradeQuantity(defenseOutcome.defenseQuantity)} · 일반 ${formatTradeQuantity(defenseOutcome.standardQuantity)}`
            : `방어 ${formatTradeQuantity(defenseOutcome.defenseQuantity || quantity)}`;
        lines.push(`괴리율 ${formatSignedPercent(gapRate)} · 최근매수평균 ${formatCurrency(recentBuyAverage)} · ${quantitySummary}`);
      }
      if (defenseOutcome.defenseLotItems.length > 0) {
        lines.push(
          `차감 기준: ${defenseOutcome.defenseLotItems
            .map((item) => {
              const datePrefix = item.dateLabel ? `${item.dateLabel} ` : "";
              return `${datePrefix}${formatTradeQuantity(item.quantity)}`;
            })
            .join(" · ")}`
        );
      }
      lines.push(
        `순매도 ${formatCurrency(defenseOutcome.netAmount)} · 기준금액 ${formatCurrency(defenseOutcome.basisAmount)} · 방어손익 ${formatSignedCurrency(Number(trade.defenseRealizedPnl || 0))}${
          Number.isFinite(Number(trade.defenseRealizedReturnRate))
            ? ` (${formatPercent(Number(trade.defenseRealizedReturnRate))})`
            : ""
        }`
      );
      return lines;
    }

    function buildRealizedTradeKey({ date = "", platform = "", asset = "", symbol = "", quantity = 0 }) {
      return [
        String(date || "").trim(),
        String(platform || "").trim(),
        String(asset || "").trim(),
        String(symbol || "").trim().toUpperCase(),
        normalizeTradeQuantityKey(quantity),
      ].join("|");
    }

    function buildRealizedTradeLookup(realized = []) {
      return (Array.isArray(realized) ? realized : []).reduce((lookup, entry) => {
        const key = buildRealizedTradeKey({
          date: entry.date,
          platform: entry.platform,
          asset: entry.assetName || entry.asset,
          symbol: entry.symbol,
          quantity: entry.quantity,
        });

        if (!lookup.has(key)) {
          lookup.set(key, []);
        }
        lookup.get(key).push(entry);
        return lookup;
      }, new Map());
    }

    function enrichTimelineTradeWithRealized(trade, realizedLookup) {
      const defenseOutcome =
        trade.side === "매도" && isXrpTradeLike(trade) && Number(trade?.xrpDefenseReferencePrice || 0) > 0
          ? computeXrpDefenseOverrideOutcome(trade, {
              referencePrice: Number(trade.xrpDefenseReferencePrice || 0),
              applicableQuantity: Number(trade.xrpDefenseApplicableQuantity || 0),
              standardAveragePrice: Number(trade.xrpDefenseStandardAveragePrice || 0),
              defenseLotItems: trade.xrpDefenseLotItems,
            })
          : null;
      const parsedNote = parseTradeOutcomeNote(trade.note);
      if (parsedNote) {
        return {
          ...trade,
          realizedPnl: parsedNote.pnl,
          realizedReturnRate: parsedNote.returnRate,
          realizedDisplay: formatRealizedTradeDisplay(parsedNote.pnl, parsedNote.returnRate),
          defenseRealizedPnl: defenseOutcome ? defenseOutcome.pnl : null,
          defenseRealizedReturnRate: defenseOutcome ? defenseOutcome.returnRate : null,
          defenseRealizedDisplay: defenseOutcome ? formatRealizedTradeDisplay(defenseOutcome.pnl, defenseOutcome.returnRate) : "",
        };
      }

      if (trade.side !== "매도") {
        return {
          ...trade,
          realizedPnl: null,
          realizedReturnRate: null,
          realizedDisplay: "",
          defenseRealizedPnl: null,
          defenseRealizedReturnRate: null,
          defenseRealizedDisplay: "",
        };
      }

      const key = buildRealizedTradeKey({
        date: trade.date,
        platform: trade.market === "암호화폐" ? "업비트" : trade.broker,
        asset: trade.asset,
        symbol: trade.symbol,
        quantity: trade.quantity,
      });
      const matched = realizedLookup.get(key)?.shift() || null;

      return {
        ...trade,
        realizedPnl: matched ? Number(matched.pnl || 0) : null,
        realizedReturnRate: matched ? Number(matched.returnRate || 0) : null,
        realizedDisplay: matched ? formatRealizedTradeDisplay(matched.pnl, matched.returnRate) : "",
        defenseRealizedPnl: defenseOutcome ? defenseOutcome.pnl : null,
        defenseRealizedReturnRate: defenseOutcome ? defenseOutcome.returnRate : null,
        defenseRealizedDisplay: defenseOutcome ? formatRealizedTradeDisplay(defenseOutcome.pnl, defenseOutcome.returnRate) : "",
      };
    }

    function parseTradeRecordedAt(trade = {}) {
      const timestamp = String(trade.createdAt || trade.addedAt || trade.updatedAt || "").trim();
      if (!timestamp) {
        return null;
      }

      const date = new Date(timestamp);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatTradeRecordedAt(trade = {}) {
      const recordedAt = parseTradeRecordedAt(trade);
      if (!recordedAt) {
        return "";
      }

      return formatDateTime(recordedAt.toISOString());
    }

    function getTimelineTradeKey(trade) {
      return `${trade.sourceCollection || "unknown"}:${trade.sourceIndex ?? -1}`;
    }

    function normalizeTimelineTrades(trades, basisYear, realized = []) {
      const stockTrades = Array.isArray(trades.stocks) ? trades.stocks : [];
      const cryptoTrades = Array.isArray(trades.crypto) ? trades.crypto : [];
      const realizedLookup = buildRealizedTradeLookup(realized);
      const normalizedCryptoTrades = cryptoTrades.map((trade, sourceIndex) => ({
        ...trade,
        market: "암호화폐",
        broker: trade.broker || "업비트",
        sourceCollection: "crypto",
        sourceIndex,
      }));
      const xrpPoolAnalytics = buildXrpRecentBuyPoolAnalytics(normalizedCryptoTrades, {
        keyFn: (trade) => getTimelineTradeKey(trade),
      });

      return [
        ...stockTrades.map((trade, sourceIndex) => ({
          ...trade,
          market: trade.market || "국내주식",
          sourceCollection: "stocks",
          sourceIndex,
        })),
        ...normalizedCryptoTrades,
      ]
        .map((trade, index) => {
          const [month, day] = String(trade.date || "")
            .split("/")
            .map((segment) => Number(segment));
          const hasValidDate = Boolean(month && day);
          const recordedAt = parseTradeRecordedAt(trade);
          const xrpSellContext = xrpPoolAnalytics.sellContextByKey.get(getTimelineTradeKey(trade)) || null;

          return {
            ...trade,
            month: month || 1,
            day: day || 1,
            sortValue: hasValidDate ? new Date(basisYear, month - 1, day).getTime() : 0,
            recordedAtLabel: recordedAt ? formatDateTime(recordedAt.toISOString()) : "",
            recordedSortValue: recordedAt ? recordedAt.getTime() : 0,
            xrpDefenseReferencePrice: xrpSellContext ? Number(xrpSellContext.referencePrice || 0) : 0,
            xrpDefenseRecentBuyAverage: xrpSellContext ? Number(xrpSellContext.recentBuyAverage || 0) : 0,
            xrpDefenseRecentBuyCount: xrpSellContext ? Number(xrpSellContext.buyCount || 0) : 0,
            xrpDefenseRecentBuyQuantity: xrpSellContext ? Number(xrpSellContext.buyQuantity || 0) : 0,
            xrpDefenseApplicableQuantity: xrpSellContext ? Number(xrpSellContext.applicableQuantity || 0) : 0,
            xrpDefenseStandardQuantity: xrpSellContext ? Number(xrpSellContext.standardQuantity || 0) : 0,
            xrpDefenseStandardAveragePrice: xrpSellContext ? Number(xrpSellContext.standardAveragePrice || 0) : 0,
            xrpDefenseGapRate: xrpSellContext ? Number(xrpSellContext.gapRate || 0) : 0,
            xrpDefenseLotBasisAmount: xrpSellContext ? Number(xrpSellContext.defenseBasisAmount || 0) : 0,
            xrpDefenseEffectiveAveragePrice: xrpSellContext ? Number(xrpSellContext.effectiveDefenseAveragePrice || 0) : 0,
            xrpDefenseLotItems: xrpSellContext && Array.isArray(xrpSellContext.defenseLotItems)
              ? xrpSellContext.defenseLotItems.map((item) => ({ ...item }))
              : [],
            order: index,
          };
        })
        .map((trade) => enrichTimelineTradeWithRealized(trade, realizedLookup))
        .sort(
          (left, right) =>
            right.sortValue - left.sortValue ||
            right.recordedSortValue - left.recordedSortValue ||
            left.order - right.order
        );
    }

    function groupTimelineTradesByDate(trades) {
      return trades.reduce((groups, trade) => {
        const lastGroup = groups[groups.length - 1];
        if (lastGroup && lastGroup.rawDate === trade.date) {
          lastGroup.trades.push(trade);
          return groups;
        }

        groups.push({
          rawDate: trade.date,
          sortValue: trade.sortValue,
          trades: [trade],
        });
        return groups;
      }, []);
    }

    function groupTimelineDateGroupsByMonth(dateGroups = []) {
      return dateGroups.reduce((months, group) => {
        const groupMonth = Number(group?.trades?.[0]?.month || 0);
        const month = Number.isFinite(groupMonth) && groupMonth > 0 ? groupMonth : 0;
        const lastMonth = months[months.length - 1];
        if (lastMonth && lastMonth.month === month) {
          lastMonth.groups.push(group);
          return months;
        }

        months.push({
          month,
          groups: [group],
        });
        return months;
      }, []);
    }

    function formatTimelineDate(value, year) {
      if (typeof value !== "string") {
        return "";
      }
      const [month, day] = value.split("/").map((segment) => Number(segment));
      if (!month || !day) {
        return value;
      }
      return `${year}년 ${month}월 ${day}일`;
    }

    function buildTimelineSummary(trades) {
      const buyCount = trades.filter((trade) => trade.side === "매수").length;
      const sellCount = trades.length - buyCount;
      return `매수 ${buyCount}건 · 매도 ${sellCount}건`;
    }

    function buildMonthDayKey(month, day) {
      const normalizedMonth = Number(month);
      const normalizedDay = Number(day);
      if (!normalizedMonth || !normalizedDay) {
        return "";
      }
      return `${normalizedMonth}/${String(normalizedDay).padStart(2, "0")}`;
    }

    function normalizeMonthDayKey(value) {
      if (typeof value !== "string") {
        return "";
      }
      const [month, day] = value.split("/").map((segment) => Number(segment));
      return buildMonthDayKey(month, day);
    }

    function formatTimelineMonthLabel(month, year) {
      const normalizedMonth = Number(month);
      if (!normalizedMonth) {
        return `${year}년 날짜 미확인`;
      }
      return `${year}년 ${normalizedMonth}월`;
    }

    function buildTimelineMonthSummary(dateGroups = []) {
      const trades = dateGroups.reduce((accumulator, group) => {
        if (Array.isArray(group?.trades)) {
          accumulator.push(...group.trades);
        }
        return accumulator;
      }, []);
      return buildTimelineSummary(trades);
    }

    function renderTimelineDateGroup(group, basisYear, realizedLookup, panelId, isOpen = false, options = {}) {
      const totalAmount = group.trades.reduce((total, trade) => total + trade.amount, 0);
      const dayProfit = realizedLookup.get(normalizeMonthDayKey(group.rawDate));
      const hasDayPnl = dayProfit && Number.isFinite(Number(dayProfit.dailyPnl));
      const dayPnl = hasDayPnl ? Number(dayProfit.dailyPnl) : 0;
      const canManage = options.canManage === true;

      return `
        <section class="timeline-group ${isOpen ? "is-open" : ""}">
          <button
            type="button"
            class="timeline-toggle"
            aria-expanded="${isOpen}"
            aria-controls="${panelId}"
          >
            <div class="timeline-date-head">
              <span class="timeline-date-chip">${group.rawDate}</span>
              <div class="timeline-date-copy">
                <strong>${formatTimelineDate(group.rawDate, basisYear)}</strong>
                <p>${buildTimelineSummary(group.trades)}</p>
              </div>
            </div>
            <div class="timeline-header-meta">
              <div class="timeline-stat">
                <span>거래 건수</span>
                <strong>${group.trades.length}건</strong>
              </div>
              ${
                hasDayPnl
                  ? `
                    <div class="timeline-stat">
                      <span>실현 손익</span>
                      <strong class="${getSignedPriceToneClass(dayPnl)}">${formatSignedCurrency(dayPnl)}</strong>
                    </div>
                  `
                  : ""
              }
              <div class="timeline-stat">
                <span>총 거래금액</span>
                <strong>${formatCurrency(totalAmount)}</strong>
              </div>
              <span class="timeline-toggle-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </div>
          </button>
          <div class="timeline-panel" id="${panelId}" aria-hidden="${!isOpen}">
            <div class="timeline-group-list">
              ${group.trades
                .map((trade) => {
                  const hasTradeRealized = trade.side === "매도" && Number.isFinite(Number(trade.realizedPnl));
                  const realizedValue = trade.realizedDisplay || formatSignedCurrency(Number(trade.realizedPnl || 0));
                  const hasDefenseRealized =
                    trade.side === "매도" && isXrpTradeLike(trade) && Number.isFinite(Number(trade.defenseRealizedPnl));
                  const defenseRealizedValue =
                    trade.defenseRealizedDisplay || formatSignedCurrency(Number(trade.defenseRealizedPnl || 0));
                  const defenseCalculationLines = hasDefenseRealized ? buildTimelineDefenseCalculationLines(trade) : [];
                  const recordedAtLabel = trade.recordedAtLabel || formatTradeRecordedAt(trade);
                  const actionMarkup = canManage
                    ? `
                        <div class="timeline-item-actions">
                          <button
                            type="button"
                            class="timeline-action timeline-action--edit"
                            data-trade-edit
                            data-trade-collection="${escapeHtml(trade.sourceCollection || "")}"
                            data-trade-index="${escapeHtml(String(trade.sourceIndex ?? ""))}"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            class="timeline-action timeline-action--delete"
                            data-trade-delete
                            data-trade-collection="${escapeHtml(trade.sourceCollection || "")}"
                            data-trade-index="${escapeHtml(String(trade.sourceIndex ?? ""))}"
                          >
                            삭제
                          </button>
                        </div>
                      `
                    : "";
                  return `
                    <article class="timeline-item">
                      <div class="timeline-top">
                        <div>
                          <p class="mini-label timeline-market">${trade.market}${trade.broker ? ` · ${trade.broker}` : ""}</p>
                          <strong class="timeline-title">${escapeHtml(getDisplayAssetName({ asset: trade.asset }))}</strong>
                          ${renderTimelineTradeBadges(trade, options)}
                        </div>
                        ${actionMarkup}
                      </div>
                      <p class="timeline-meta">
                        <span class="timeline-meta-row">수량 ${formatTradeQuantity(trade.quantity)} · 단가 ${formatCurrency(trade.price)}</span>
                        <span class="timeline-meta-row">수수료 ${formatCurrency(trade.fee)} · <span class="timeline-meta-amount">거래금액 ${formatCurrency(trade.amount)}</span></span>
                        ${recordedAtLabel ? `<span class="timeline-meta-row">추가 시각 ${escapeHtml(recordedAtLabel)}</span>` : ""}
                      </p>
                      ${
                        hasDefenseRealized
                          ? `<strong class="timeline-realized ${getSignedPriceToneClass(trade.defenseRealizedPnl)}">방어손익 ${defenseRealizedValue}</strong>`
                          : hasTradeRealized
                            ? `<strong class="timeline-realized ${getSignedPriceToneClass(trade.realizedPnl)}">실현손익 ${realizedValue}</strong>`
                            : ""
                      }
                      ${
                        defenseCalculationLines.length
                          ? `<div class="timeline-defense-formula">${defenseCalculationLines
                              .map((line) => `<span class="timeline-defense-formula-line">${escapeHtml(line)}</span>`)
                              .join("")}</div>`
                          : ""
                      }
                      ${
                        getDisplayTradeNote(trade.note)
                          ? `<p class="timeline-note">메모 · ${escapeHtml(getDisplayTradeNote(trade.note))}</p>`
                          : ""
                      }
                    </article>
                  `;
                })
                .join("")}
            </div>
          </div>
        </section>
      `;
    }

    function buildRealizedHistoryLookup(realizedHistory = []) {
      return realizedHistory.reduce((lookup, entry) => {
        lookup.set(normalizeMonthDayKey(entry.date), entry);
        return lookup;
      }, new Map());
    }

    function renderTimelineList(trades, basisYear, realizedHistory = [], options = {}) {
      const grouped = groupTimelineTradesByDate(trades);
      const monthGroups = groupTimelineDateGroupsByMonth(grouped);
      const realizedLookup = buildRealizedHistoryLookup(realizedHistory);
      if (!grouped.length) {
        return `<div class="timeline-empty">${escapeHtml(
          isEmptyBoardVariant()
            ? "아직 저장된 거래가 없습니다. 매수나 매도 기록을 추가하면 날짜별로 정리됩니다."
            : "표시할 거래가 없습니다."
        )}</div>`;
      }

      return monthGroups
        .map((monthGroup, monthIndex) => {
          const monthPanelId = `timeline-month-panel-${monthIndex}`;
          const isMonthOpen = monthIndex === 0;
          return `
            <section class="timeline-month-block ${isMonthOpen ? "is-open" : ""}">
              <button
                type="button"
                class="timeline-month-toggle"
                aria-expanded="${isMonthOpen}"
                aria-controls="${monthPanelId}"
              >
                <div class="timeline-month-copy">
                  <span class="timeline-month-chip">${monthGroup.month ? `${monthGroup.month}월` : "미정"}</span>
                  <strong>${formatTimelineMonthLabel(monthGroup.month, basisYear)}</strong>
                </div>
                <div class="timeline-month-meta">
                  <p>${buildTimelineMonthSummary(monthGroup.groups)}</p>
                  <span class="timeline-month-toggle-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </div>
              </button>
              <div class="timeline-month-panel" id="${monthPanelId}" aria-hidden="${!isMonthOpen}">
                <div class="timeline-month-groups">
                  ${monthGroup.groups
                    .map((group, dayIndex) => {
                      const panelId = `timeline-panel-${monthIndex}-${dayIndex}`;
                      return renderTimelineDateGroup(group, basisYear, realizedLookup, panelId, dayIndex === 0, options);
                    })
                    .join("")}
                </div>
              </div>
            </section>
          `;
        })
        .join("");
    }

    function resolveXrpDefenseRecentTenBuyAverage(context = getCurrentContext?.() || {}) {
      const source = context || {};
      const snapshot = buildXrpDefenseSnapshot({
        metadata: source.metadata || {},
        trades: source.trades || {},
        holdings: source.holdings || [],
        analytics: source.analytics || {},
      });
      const value = Number(snapshot?.reference?.recentTenBuyAverage || 0);
      return value > 0 ? value : 0;
    }

    function renderTimeline(trades, basisDateLabel, realizedHistory = [], realizedEntries = [], options = {}) {
      const basisYear = Number(basisDateLabel) || getCurrentBasisYear();
      const listContainer = global.document.querySelector("#timeline");
      if (!listContainer) {
        return;
      }
      const xrpDefenseReferencePrice =
        Number(options?.xrpDefenseReferencePrice) > 0
          ? Number(options.xrpDefenseReferencePrice)
          : resolveXrpDefenseRecentTenBuyAverage(getCurrentContext?.() || {});
      const normalizedTrades = normalizeTimelineTrades(trades, basisYear, realizedEntries);
      setTimelineTradeRegistry(
        normalizedTrades.reduce((registry, trade) => {
          registry.set(getTimelineTradeKey(trade), trade);
          return registry;
        }, new Map())
      );

      listContainer.innerHTML = renderTimelineList(normalizedTrades, basisYear, realizedHistory, {
        canManage: canManagePortfolioMutations(),
        xrpDefenseReferencePrice,
      });

      bindTimelineSection(global.document.querySelector("#timeline-section"));
    }

    return Object.freeze({
      buildRealizedTradeKey,
      getTimelineTradeKey,
      normalizeTimelineTrades,
      resolveXrpDefenseRecentTenBuyAverage,
      renderTimeline,
    });
  }

  global.AssetTimelinePanel = Object.freeze({
    createTimelineHelpers,
  });
})(window);
