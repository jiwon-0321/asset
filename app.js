const currencyFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 2,
});

const compactNumberFormatter = new Intl.NumberFormat("ko-KR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const colors = ["#17F9A6", "#5EC8FF", "#FFB84D", "#FF6B87"];
let chartRegistry = [];
let calendarDetailStore = new Map();
let timelineCalendarState = {
  trades: [],
  basisYear: new Date().getFullYear(),
  selectedMonthKey: null,
  realizedHistory: [],
};

document.addEventListener("DOMContentLoaded", () => {
  loadPortfolio()
    .then((data) => renderDashboard(data))
    .catch((error) => {
      console.error(error);
      document.body.innerHTML = `
        <main style="padding: 32px; font-family: 'Avenir Next', sans-serif;">
          <h1>데이터를 불러오지 못했습니다.</h1>
          <p><code>python3 scripts/export_workbook.py</code> 실행 후 다시 확인하세요.</p>
        </main>
      `;
    });
});

async function loadPortfolio() {
  if (window.__PORTFOLIO_DATA__) {
    return window.__PORTFOLIO_DATA__;
  }

  const response = await fetch("./data/portfolio.json");
  if (!response.ok) {
    throw new Error(`Failed to load portfolio.json: ${response.status}`);
  }

  return response.json();
}

function renderDashboard(data) {
  const { metadata, summary, assetStatus, cashPositions, holdings, realized, strategy, trades, analytics, charts } =
    data;

  text("#page-title", metadata.mantra);
  text("#hero-summary", "");
  text("#basis-date", `기준일 · ${metadata.basisDateLabel}`);
  text("#workbook-name", `소스 파일 · ${metadata.workbook}`);

  renderPriceStrip(analytics.prices, holdings);
  renderMetricCards(summary);
  renderCharts(charts);
  renderAllocation(summary, assetStatus, cashPositions);
  renderAssetTable(assetStatus);
  renderHoldings(holdings);
  renderRealized(realized, summary.realizedProfitTotal);
  renderDefense(analytics.xrpDefense);
  renderTimeline(trades, metadata.basisDateLabel, charts.realizedHistory);
  renderStrategy(strategy);
  bindAllPanelAccordions();
  initializeMotion();
}

function renderPriceStrip(prices, holdings = []) {
  const container = document.querySelector("#price-strip");
  const holdingQuantity = (matcher) =>
    holdings.reduce((total, item) => {
      const asset = item.asset || "";
      if (!matcher(asset)) {
        return total;
      }
      return total + (item.quantity || 0);
    }, 0);

  const priceItems = [
    {
      label: "삼성전자",
      value: prices.samsungElectronics,
      quantity: holdingQuantity((asset) => asset.includes("삼성전자")),
    },
    {
      label: "SK하이닉스",
      value: prices.skHynix,
      quantity: holdingQuantity((asset) => asset.includes("SK하이닉스")),
    },
    {
      label: "XRP",
      value: prices.xrp,
      quantity: holdingQuantity((asset) => asset.startsWith("XRP")),
    },
    {
      label: "ETH",
      value: prices.eth,
      quantity: holdingQuantity((asset) => asset.startsWith("ETH")),
    },
  ].filter((item) => item.quantity > 0);

  container.innerHTML = priceItems
    .map(
      ({ label, value }) => `
        <div class="price-pill">
          <span class="price-name">${label}</span>
          <strong class="price-value">${formatCurrency(value)}</strong>
        </div>
      `
    )
    .join("");
}

function renderMetricCards(summary) {
  const initialInvestment = summary.initialInvestment || 0;
  const initialInvestmentPnl = (summary.totalAssets || 0) - initialInvestment;

  const metrics = [
    {
      label: "초기 투자금",
      value: formatCurrency(initialInvestment),
      detail: "업비트 매매일지 F4 기준 시작 자금",
      tone: "neutral",
    },
    {
      label: "총 자산",
      value: formatCurrency(summary.totalAssets),
      detail: "엑셀 총괄현황 기준 전체 평가액",
      tone: "neutral",
    },
    {
      label: "초기 투자금 대비 손익",
      value: formatSignedCurrency(initialInvestmentPnl),
      detail: "총 자산 - 초기 투자금",
      tone: toneClass(initialInvestmentPnl),
    },
    {
      label: "평가 손익",
      value: formatSignedCurrency(summary.portfolioPnl),
      detail: `현재 투자원금 대비 ${formatPercent(summary.portfolioReturnRate)}`,
      tone: toneClass(summary.portfolioPnl),
    },
    {
      label: "현금 보유",
      value: formatCurrency(summary.cashTotal),
      detail: "예수금 + 페이머니 + 업비트 KRW",
      tone: "neutral",
    },
    {
      label: "실현 손익",
      value: formatSignedCurrency(summary.realizedProfitTotal),
      detail: `유동성 비중 ${formatPercent(summary.liquidityRatio)}`,
      tone: toneClass(summary.realizedProfitTotal),
    },
  ];

  const template = document.querySelector("#metric-card-template");
  const grid = document.querySelector("#metric-grid");
  grid.innerHTML = "";

  metrics.forEach((metric) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.classList.add(`metric-card--${metric.tone}`);
    node.querySelector(".metric-label").textContent = metric.label;
    node.querySelector(".metric-value").textContent = metric.value;
    node.querySelector(".metric-value").classList.add(metric.tone);
    node.querySelector(".metric-detail").textContent = metric.detail;
    grid.appendChild(node);
  });
}

function renderAllocation(summary, assetStatus, cashPositions) {
  const allocation = [
    {
      label: "암호화폐",
      value: assetStatus
        .filter((item) => item.category === "암호화폐")
        .reduce((total, item) => total + item.valuation, 0),
    },
    {
      label: "국내주식",
      value: assetStatus
        .filter((item) => item.category === "국내주식")
        .reduce((total, item) => total + item.valuation, 0),
    },
    {
      label: "현금성 자산",
      value: cashPositions.reduce((total, item) => total + item.amount, 0),
    },
  ].filter((item) => item.value > 0);

  const total = summary.totalAssets || 1;
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = allocation
    .map((item, index) => {
      const length = (item.value / total) * circumference;
      const segment = `
        <circle
          cx="60"
          cy="60"
          r="${radius}"
          fill="none"
          stroke="${colors[index % colors.length]}"
          stroke-width="14"
          stroke-linecap="round"
          stroke-dasharray="${length} ${circumference - length}"
          stroke-dashoffset="${-offset}"
        ></circle>
      `;
      offset += length;
      return segment;
    })
    .join("");

  document.querySelector("#allocation-visual").innerHTML = `
    <div class="donut-chart">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="${radius}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="14"></circle>
        ${segments}
      </svg>
      <div class="donut-center">
        <span>총 자산</span>
        <strong>${formatCurrency(summary.totalAssets)}</strong>
      </div>
    </div>
  `;

  document.querySelector("#allocation-legend").innerHTML = allocation
    .map(
      (item, index) => `
        <div class="legend-item">
          <span class="legend-swatch" style="background:${colors[index % colors.length]}"></span>
          <div>
            <p class="legend-label">${item.label}</p>
            <strong>${formatPercent(item.value / total)}</strong>
          </div>
          <span class="legend-value">${formatCurrency(item.value)}</span>
        </div>
      `
    )
    .join("");
}

function renderCharts(charts) {
  if (!charts) {
    renderChartUnavailable("#returns-chart", "차트 데이터 없음");
    renderChartUnavailable("#realized-chart", "차트 데이터 없음");
    return;
  }

  renderChartStats(charts);
  destroyCharts();

  if (!window.Chart) {
    renderChartUnavailable("#returns-chart", "Chart.js 로드 실패");
    renderChartUnavailable("#realized-chart", "Chart.js 로드 실패");
    return;
  }

  const hasReturns = Array.isArray(charts.returnsComparison) && charts.returnsComparison.length > 0;
  const hasRealized = Array.isArray(charts.realizedHistory) && charts.realizedHistory.length > 0;

  const theme = readChartTheme();
  const commonPlugins = {
    legend: {
      labels: {
        color: theme.mutedStrong,
        usePointStyle: true,
        pointStyle: "circle",
        padding: 16,
        boxWidth: 10,
        font: {
          family: theme.mono,
          size: 11,
          weight: "700",
        },
      },
    },
    tooltip: {
      backgroundColor: "rgba(5, 12, 12, 0.94)",
      borderColor: theme.lineStrong,
      borderWidth: 1,
      titleColor: theme.text,
      bodyColor: theme.text,
      padding: 14,
      titleFont: {
        family: theme.sans,
        weight: "700",
      },
      bodyFont: {
        family: theme.sans,
      },
      callbacks: {
        label(context) {
          const datasetLabel = context.dataset.label ? `${context.dataset.label}: ` : "";
          if (typeof context.raw === "number") {
            return `${datasetLabel}${formatCurrency(context.raw)}`;
          }
          return `${datasetLabel}${context.formattedValue}`;
        },
      },
    },
  };

  if (!hasReturns) {
    renderChartUnavailable("#returns-chart", "차트 데이터 없음");
  } else {
    const returnsCanvas = document.querySelector("#returns-chart");
    chartRegistry.push(
      new Chart(returnsCanvas, {
        type: "bar",
        data: {
          labels: charts.returnsComparison.map((item) => item.label),
          datasets: [
            {
              label: "수익률",
              data: charts.returnsComparison.map((item) => item.returnRate * 100),
              borderRadius: 10,
              borderSkipped: false,
              backgroundColor: charts.returnsComparison.map((item) =>
                item.returnRate >= 0 ? alpha(theme.gain, 0.78) : alpha(theme.loss, 0.78)
              ),
              borderColor: charts.returnsComparison.map((item) => (item.returnRate >= 0 ? theme.gain : theme.loss)),
              borderWidth: 1.5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: "y",
          scales: {
            x: {
              grid: {
                color: theme.grid,
              },
              ticks: {
                color: theme.muted,
                font: {
                  family: theme.mono,
                },
                callback(value) {
                  return `${value}%`;
                },
              },
            },
            y: {
              grid: {
                display: false,
              },
              ticks: {
                color: theme.text,
                font: {
                  family: theme.sans,
                  weight: "700",
                },
              },
            },
          },
          plugins: {
            ...commonPlugins,
            legend: {
              display: false,
            },
            tooltip: {
              ...commonPlugins.tooltip,
              callbacks: {
                label(context) {
                  return `수익률: ${Number(context.raw).toFixed(2)}%`;
                },
              },
            },
          },
        },
      })
    );
  }

  if (!hasRealized) {
    renderChartUnavailable("#realized-chart", "차트 데이터 없음");
  } else {
    const realizedCanvas = document.querySelector("#realized-chart");
    chartRegistry.push(
      new Chart(realizedCanvas, {
        data: {
          labels: charts.realizedHistory.map((item) => item.date),
          datasets: [
            {
              type: "bar",
              label: "일자별 실현손익",
              data: charts.realizedHistory.map((item) => item.dailyPnl),
              backgroundColor: charts.realizedHistory.map((item) =>
                item.dailyPnl >= 0 ? alpha(theme.cash, 0.46) : alpha(theme.loss, 0.48)
              ),
              borderColor: charts.realizedHistory.map((item) => (item.dailyPnl >= 0 ? theme.cash : theme.loss)),
              borderWidth: 1.4,
              borderRadius: 10,
              borderSkipped: false,
              yAxisID: "y",
            },
            {
              type: "line",
              label: "누적 실현손익",
              data: charts.realizedHistory.map((item) => item.cumulativePnl),
              borderColor: theme.accent,
              backgroundColor: alpha(theme.accent, 0.22),
              pointBackgroundColor: theme.accent,
              pointBorderColor: theme.surface,
              pointRadius: 4,
              pointHoverRadius: 5,
              borderWidth: 2.5,
              tension: 0.34,
              fill: false,
              yAxisID: "y",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: "index",
            intersect: false,
          },
          scales: {
            x: {
              grid: {
                color: alpha(theme.cash, 0.08),
              },
              ticks: {
                color: theme.muted,
                font: {
                  family: theme.mono,
                },
              },
            },
            y: {
              grid: {
                color: theme.grid,
              },
              ticks: {
                color: theme.muted,
                font: {
                  family: theme.mono,
                },
                callback(value) {
                  return `${formatCompactNumber(value)}원`;
                },
              },
            },
          },
          plugins: {
            ...commonPlugins,
            legend: {
              ...commonPlugins.legend,
              position: "top",
            },
            tooltip: {
              ...commonPlugins.tooltip,
              callbacks: {
                label(context) {
                  return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
                },
                afterLabel(context) {
                  const dataIndex = context.dataIndex;
                  const historyItem = charts.realizedHistory[dataIndex];
                  if (!historyItem || !historyItem.profitDetails) {
                    return [];
                  }
                  return historyItem.profitDetails.map((detail) =>
                    `  ${detail.item}: ${formatSignedCurrency(detail.pnl)}${detail.note ? ` (${detail.note})` : ''}`
                  );
                },
              },
            },
          },
        },
      })
    );
  }
}

function renderAssetTable(assetStatus) {
  const body = document.querySelector("#asset-status-body");
  body.innerHTML = assetStatus
    .map((item) =>
      `
        <tr>
          ${tableCell("구분", item.category)}
          ${tableCell("플랫폼", item.platform)}
          ${tableCell("평가금액", formatCurrency(item.valuation), "align-right numeric-cell")}
          ${tableCell("원금", formatCurrency(item.principal), "align-right numeric-cell")}
          ${tableCell(
            "손익",
            formatSignedCurrency(item.pnl),
            `align-right numeric-cell table-emphasis ${toneClass(item.pnl)}`
          )}
          ${tableCell(
            "수익률",
            formatPercent(item.returnRate),
            `align-right numeric-cell table-emphasis ${toneClass(item.returnRate)}`
          )}
        </tr>
      `
    )
    .join("");
}

function renderHoldings(holdings) {
  const container = document.querySelector("#holdings-grid");
  const activeHoldings = holdings.filter((item) => item.quantity > 0);

  container.innerHTML = activeHoldings
    .map((item) => {
      return `
        <article class="holding-card">
          <div class="holding-head">
            <div>
              <p class="mini-label">${item.platform}</p>
              <strong class="holding-title">${item.asset}</strong>
            </div>
            <span class="status-tag">보유 중</span>
          </div>
          <div class="mini-stack">
            <div class="mini-row">
              <span class="mini-label">수량</span>
              <span class="mini-value">${formatNumber(item.quantity)}</span>
            </div>
            <div class="mini-row">
              <span class="mini-label">평균단가</span>
              <span class="mini-value">${formatCurrency(item.averagePrice)}</span>
            </div>
            <div class="mini-row">
              <span class="mini-label">평가금액</span>
              <span class="mini-value">${formatCurrency(item.valuation)}</span>
            </div>
            <div class="mini-row">
              <span class="mini-label">수익률</span>
              <span class="mini-value ${toneClass(item.returnRate)}">${formatPercent(item.returnRate)}</span>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderRealized(realized, totalProfit) {
  const container = document.querySelector("#realized-list");
  const items = Array.isArray(realized) ? realized : [];

  container.innerHTML = `
    <div class="realized-item">
      <div class="realized-top">
        <div>
          <p class="mini-label">누적 실현손익</p>
          <strong>전체 실현 손익</strong>
        </div>
        <span class="realized-value ${toneClass(totalProfit)}">${formatSignedCurrency(totalProfit)}</span>
      </div>
    </div>
    ${items
      .map(
        (item) => `
          <div class="realized-item">
            <div class="realized-top">
              <div>
                <p class="mini-label">${item.platform} · ${item.date || ""}</p>
                <strong>${item.asset}</strong>
              </div>
              <span class="realized-value ${toneClass(item.pnl)}">${formatSignedCurrency(item.pnl)}</span>
            </div>
            <p class="metric-detail">${formatPercent(item.returnRate)} 수익률${item.note ? ` · ${item.note}` : ""}</p>
          </div>
        `
      )
      .join("")}
  `;

  bindPanelAccordion(document.querySelector("#realized-section"));
}

function renderDefense(defense) {
  const items = [
    ["최종 평단가", defense.finalAveragePrice, "currency", "neutral"],
    ["평단가 인하액", defense.averageCutAmount, "currency", "gain"],
    ["평단가 인하율", defense.averageCutRate, "percent", "gain"],
    ["방어 이익", defense.defenseGain, "currency", toneClass(defense.defenseGain)],
    ["회계상 실현손익", defense.realizedPnl, "currency", toneClass(defense.realizedPnl)],
    ["손익분기 목표 매수단가", defense.breakevenTargetBuyPrice, "currency", "neutral"],
  ];

  document.querySelector("#defense-grid").innerHTML = items
    .map(([label, value, type, tone]) => {
      const formatted =
        type === "percent" ? formatPercent(value) : formatSignedCurrency(value, tone === "neutral");
      return `
        <div class="defense-card">
          <p class="mini-label">${label}</p>
          <strong class="defense-value ${tone}">${formatted}</strong>
        </div>
      `;
    })
    .join("");
}

function toggleDisclosure(root, trigger, panel, willOpen) {
  if (!root || !trigger || !panel) {
    return;
  }

  root.classList.toggle("is-open", willOpen);
  trigger.setAttribute("aria-expanded", String(willOpen));
  panel.classList.toggle("is-open", willOpen);
  panel.setAttribute("aria-hidden", String(!willOpen));
}

function bindPanelAccordion(panel) {
  if (!panel || panel.dataset.accordionBound === "true") {
    return;
  }

  panel.addEventListener("click", (event) => {
    const trigger = event.target.closest(".section-toggle");
    if (!trigger || !panel.contains(trigger)) {
      return;
    }

    const body = panel.querySelector(".panel-collapse");
    const willOpen = trigger.getAttribute("aria-expanded") !== "true";
    toggleDisclosure(panel, trigger, body, willOpen);
  });

  panel.dataset.accordionBound = "true";
}

function bindAllPanelAccordions() {
  document.querySelectorAll(".panel-accordion").forEach((panel) => {
    bindPanelAccordion(panel);
  });
}

function normalizeTimelineTrades(trades, basisYear) {
  const stockTrades = Array.isArray(trades.stocks) ? trades.stocks : [];
  const cryptoTrades = Array.isArray(trades.crypto) ? trades.crypto : [];

  return [
    ...stockTrades.map((trade) => ({ ...trade, market: "국내주식" })),
    ...cryptoTrades.map((trade) => ({ ...trade, market: "암호화폐", broker: trade.broker || "업비트" })),
  ]
    .map((trade, index) => {
      const [month, day] = String(trade.date || "")
        .split("/")
        .map((segment) => Number(segment));
      const hasValidDate = Boolean(month && day);

      return {
        ...trade,
        month: month || 1,
        day: day || 1,
        sortValue: hasValidDate ? new Date(basisYear, month - 1, day).getTime() : 0,
        order: index,
      };
    })
    .sort((left, right) => right.sortValue - left.sortValue || left.order - right.order);
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

function groupTimelineTradesByMonth(trades) {
  const months = new Map();

  trades.forEach((trade) => {
    const tradeDate = trade.sortValue ? new Date(trade.sortValue) : new Date();
    const year = tradeDate.getFullYear();
    const monthKey = buildCalendarMonthKey(year, trade.month);
    if (!months.has(monthKey)) {
      months.set(monthKey, {
        key: monthKey,
        month: trade.month,
        year,
        trades: [],
      });
    }
    months.get(monthKey).trades.push(trade);
  });

  return [...months.values()].sort((left, right) => right.year - left.year || right.month - left.month);
}

function buildRealizedHistoryLookup(realizedHistory = []) {
  return realizedHistory.reduce((lookup, entry) => {
    lookup.set(normalizeMonthDayKey(entry.date), entry);
    return lookup;
  }, new Map());
}

function renderTimelineList(trades, basisYear, realizedHistory = []) {
  const grouped = groupTimelineTradesByDate(trades);
  const realizedLookup = buildRealizedHistoryLookup(realizedHistory);
  if (!grouped.length) {
    return `<div class="timeline-empty">표시할 거래가 없습니다.</div>`;
  }

  return grouped
    .map((group, index) => {
      const totalAmount = group.trades.reduce((total, trade) => total + trade.amount, 0);
      const isOpen = false;
      const panelId = `timeline-panel-${index}`;
      const dayProfit = realizedLookup.get(normalizeMonthDayKey(group.rawDate));
      const dayPnl = dayProfit?.dailyPnl ?? 0;

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
              <div class="timeline-stat">
                <span>실현 손익</span>
                <strong class="${toneClass(dayPnl)}">${formatSignedCurrency(dayPnl)}</strong>
              </div>
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
                .map(
                  (trade) => `
                    <article class="timeline-item">
                      <div class="timeline-top">
                        <div>
                          <p class="mini-label timeline-market">${trade.market}${trade.broker ? ` · ${trade.broker}` : ""}</p>
                          <strong class="timeline-title">${trade.asset}</strong>
                        </div>
                        <span class="trade-side ${trade.side === "매수" ? "trade-side-buy" : "trade-side-sell"}">${trade.side}</span>
                      </div>
                      <p class="timeline-meta">
                        수량 ${formatNumber(trade.quantity)} / 단가 ${formatCurrency(trade.price)} / 수수료 ${formatCurrency(trade.fee)}
                      </p>
                      <strong class="timeline-amount ${trade.side === "매수" ? "loss" : "gain"}">${formatCurrency(trade.amount)}</strong>
                    </article>
                  `
                )
                .join("")}
            </div>
          </div>
        </section>
      `;
    })
    .join("");
}

function renderTimelineCalendar(trades, basisYear, realizedHistory = []) {
  const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];
  const months = groupTimelineTradesByMonth(trades);
  const realizedLookup = buildRealizedHistoryLookup(realizedHistory);
  calendarDetailStore = new Map();

  if (!months.length) {
    return `<div class="timeline-empty">표시할 거래가 없습니다.</div>`;
  }

  if (!months.some((month) => month.key === timelineCalendarState.selectedMonthKey)) {
    timelineCalendarState.selectedMonthKey = months[0].key;
  }

  const selectedMonth = months.find((month) => month.key === timelineCalendarState.selectedMonthKey) || months[0];
  const monthTrades = [...selectedMonth.trades].sort((left, right) => left.day - right.day || left.order - right.order);
  const tradesByDay = monthTrades.reduce((map, trade) => {
    const key = String(trade.day);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(trade);
    return map;
  }, new Map());
  const daysInMonth = new Date(selectedMonth.year, selectedMonth.month, 0).getDate();
  const firstDayOffset = new Date(selectedMonth.year, selectedMonth.month - 1, 1).getDay();
  const totalAmount = monthTrades.reduce((sum, trade) => sum + trade.amount, 0);
  const activeDays = tradesByDay.size;

  return `
    <div class="calendar-toolbar">
      <label class="calendar-month-picker" for="timeline-calendar-month">
        <span class="calendar-picker-label">월 선택</span>
        <div class="calendar-select-wrap">
          <select id="timeline-calendar-month" class="calendar-select">
            ${months
              .map(
                (month) => `
                  <option value="${month.key}" ${month.key === selectedMonth.key ? "selected" : ""}>
                    ${formatCalendarMonthLabel(month.year, month.month)}
                  </option>
                `
              )
              .join("")}
          </select>
          <span class="calendar-select-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </div>
      </label>
      <div class="calendar-toolbar-meta">
        <span>거래일 ${activeDays}일</span>
        <strong>총 ${monthTrades.length}건 · ${formatCurrency(totalAmount)}</strong>
      </div>
    </div>
    <article class="calendar-month">
      <header class="calendar-month-header">
        <div>
          <p class="mini-label">Calendar View</p>
          <strong>${formatCalendarMonthLabel(selectedMonth.year, selectedMonth.month)}</strong>
        </div>
        <div class="calendar-month-summary">
          <span>선택 월 합계</span>
          <strong>${formatCurrency(totalAmount)}</strong>
        </div>
      </header>
      <div class="calendar-grid-shell">
        <div class="calendar-grid">
          ${weekdayLabels.map((label) => `<div class="calendar-weekday">${label}</div>`).join("")}
          ${Array.from({ length: firstDayOffset }, () => `<div class="calendar-day calendar-day--blank" aria-hidden="true"></div>`).join("")}
          ${Array.from({ length: daysInMonth }, (_, dayIndex) => {
            const day = dayIndex + 1;
            const dayTrades = tradesByDay.get(String(day)) || [];
            const dayAmount = dayTrades.reduce((sum, trade) => sum + trade.amount, 0);
            const buyCount = dayTrades.filter((trade) => trade.side === "매수").length;
            const sellCount = dayTrades.length - buyCount;
            const detailKey = buildCalendarDetailKey(selectedMonth.year, selectedMonth.month, day);
            const dateKey = buildMonthDayKey(selectedMonth.month, day);
            const dayProfit = realizedLookup.get(dateKey);
            const dayPnl = dayProfit?.dailyPnl ?? 0;
            const dayPnlTone = toneClass(dayPnl);
            const hasDirectionalPnl = dayPnl !== 0;

            if (dayTrades.length) {
              calendarDetailStore.set(detailKey, {
                dateLabel: formatTimelineDate(`${selectedMonth.month}/${day}`, selectedMonth.year),
                trades: dayTrades,
                totalAmount: dayAmount,
                buyCount,
                sellCount,
                dayPnl,
              });
            }

            if (!dayTrades.length) {
              return `
                <article class="calendar-day">
                  <div class="calendar-day-top">
                    <span class="calendar-day-number">${day}</span>
                  </div>
                  <div class="calendar-day-idle">거래 없음</div>
                </article>
              `;
            }

            return `
              <button
                type="button"
                class="calendar-day calendar-day--interactive has-trades ${hasDirectionalPnl ? (dayPnl > 0 ? "has-profit" : "has-loss") : ""}"
                data-detail-key="${detailKey}"
                aria-haspopup="dialog"
                aria-label="${formatTimelineDate(`${selectedMonth.month}/${day}`, selectedMonth.year)} 거래 ${dayTrades.length}건 보기"
              >
                <div class="calendar-day-top">
                  <span class="calendar-day-number">${day}</span>
                  <span class="calendar-day-count">${dayTrades.length}건</span>
                </div>
                <strong class="calendar-day-total ${dayPnlTone}">
                  <span class="calendar-total-full">${formatSignedCurrency(dayPnl)}</span>
                  <span class="calendar-total-compact">${dayPnl > 0 ? "+" : ""}${formatCompactCurrency(Math.abs(dayPnl))}</span>
                </strong>
                <p class="calendar-day-summary">매수 ${buyCount}건 · 매도 ${sellCount}건</p>
                <div class="calendar-day-items">
                  ${dayTrades
                    .slice(0, 2)
                    .map(
                      (trade) => `
                        <div class="calendar-trade ${trade.side === "매수" ? "loss" : "gain"}">
                          <span>${trade.asset}</span>
                          <strong>${trade.side}</strong>
                        </div>
                      `
                    )
                    .join("")}
                  ${
                    dayTrades.length > 2
                      ? `<span class="calendar-more">+${dayTrades.length - 2}건 더</span>`
                      : `<span class="calendar-more">상세 보기</span>`
                  }
                </div>
              </button>
            `;
          }).join("")}
        </div>
      </div>
    </article>
  `;
}

function renderTimeline(trades, basisDateLabel, realizedHistory = []) {
  const basisYear = Number((basisDateLabel || "").slice(0, 4)) || new Date().getFullYear();
  const listContainer = document.querySelector("#timeline");
  const calendarContainer = document.querySelector("#timeline-calendar");
  const normalizedTrades = normalizeTimelineTrades(trades, basisYear);
  timelineCalendarState = {
    ...timelineCalendarState,
    trades: normalizedTrades,
    basisYear,
    realizedHistory,
  };

  listContainer.innerHTML = renderTimelineList(normalizedTrades, basisYear, realizedHistory);
  calendarContainer.innerHTML = renderTimelineCalendar(normalizedTrades, basisYear, realizedHistory);

  bindTimelineSection(document.querySelector("#timeline-section"));
  bindCalendarDetailModal(document.querySelector("#calendar-detail-modal"));
  bindPanelAccordion(document.querySelector("#timeline-section .panel"));
}

function renderStrategy(strategy) {
  text("#entry-principle", strategy.entryPrinciple);
  text("#exit-principle", strategy.exitPrinciple);
  text("#checklist-title", strategy.checklistTitle);
  text("#checklist-window", strategy.checklistWindow);

  document.querySelector("#entry-steps").innerHTML = strategy.entrySteps
    .map(
      (step) => `
        <div class="rule-card">
          <strong>${step.label}</strong>
          <div class="rule-meta">비중: ${step.allocation}</div>
          <div class="rule-meta">조건: ${step.trigger}</div>
          <div class="rule-meta">분배: ${step.splitGuide}</div>
        </div>
      `
    )
    .join("");

  document.querySelector("#entry-notes").innerHTML = strategy.entryNotes
    .filter(Boolean)
    .map(
      (note) => `
        <div class="note-card">
          <strong>운용 메모</strong>
          ${note}
        </div>
      `
    )
    .join("");

  document.querySelector("#exit-rules").innerHTML = strategy.exitRules
    .map(
      (rule) => `
        <div class="rule-card">
          <strong>${rule.label}</strong>
          <div class="rule-meta">기준: ${rule.trigger}</div>
          <div class="rule-meta">액션: ${rule.action}</div>
          <div class="rule-meta">비고: ${rule.note}</div>
        </div>
      `
    )
    .join("");

  document.querySelector("#checklist").innerHTML = strategy.checklist.map((item) => `<li>${item}</li>`).join("");
}

function parseTradeDate(value, year) {
  if (typeof value !== "string") {
    return 0;
  }
  const [month, day] = value.split("/").map((segment) => Number(segment));
  if (!month || !day) {
    return 0;
  }
  return new Date(year, month - 1, day).getTime();
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

function buildCalendarMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
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

function buildCalendarDetailKey(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatCalendarMonthLabel(year, month) {
  return `${year}년 ${month}월`;
}

function openCalendarDetailModal(detailKey) {
  const detail = calendarDetailStore.get(detailKey);
  const modal = document.querySelector("#calendar-detail-modal");
  if (!detail || !modal) {
    return;
  }

  const summary = `총 ${detail.trades.length}건 · 매수 ${detail.buyCount}건 · 매도 ${detail.sellCount}건 · 실현 손익 ${formatSignedCurrency(detail.dayPnl ?? 0)} · 총 거래금액 ${formatCurrency(detail.totalAmount)}`;

  text("#calendar-detail-title", detail.dateLabel);
  text("#calendar-detail-summary", summary);
  document.querySelector("#calendar-detail-list").innerHTML = detail.trades
    .map(
      (trade) => `
        <article class="calendar-modal-item">
          <div class="calendar-modal-item-top">
            <div>
              <p class="mini-label">${trade.market}${trade.broker ? ` · ${trade.broker}` : ""}</p>
              <strong>${trade.asset}</strong>
            </div>
            <span class="trade-side ${trade.side === "매수" ? "trade-side-buy" : "trade-side-sell"}">${trade.side}</span>
          </div>
          <div class="calendar-modal-metrics">
            <div class="calendar-modal-metric">
              <span>수량</span>
              <strong>${formatNumber(trade.quantity)}</strong>
            </div>
            <div class="calendar-modal-metric">
              <span>단가</span>
              <strong>${formatCurrency(trade.price)}</strong>
            </div>
            <div class="calendar-modal-metric">
              <span>거래금액</span>
              <strong class="${trade.side === "매수" ? "loss" : "gain"}">${formatCurrency(trade.amount)}</strong>
            </div>
            <div class="calendar-modal-metric">
              <span>수수료</span>
              <strong>${formatCurrency(trade.fee)}</strong>
            </div>
            ${trade.note && trade.side === "매도" ? `
            <div class="calendar-modal-metric calendar-modal-pnl">
              <span>실현손익</span>
              <strong class="calendar-pnl-value ${trade.note.includes("+") ? "gain" : trade.note.includes("-") ? "loss" : "neutral"}">${trade.note}</strong>
            </div>
            ` : ""}
          </div>
        </article>
      `
    )
    .join("");

  modal.hidden = false;
  modal.classList.add("is-open");
  document.body.classList.add("modal-open");
  modal.querySelector(".calendar-modal-close")?.focus();
}

function closeCalendarDetailModal() {
  const modal = document.querySelector("#calendar-detail-modal");
  if (!modal || modal.hidden) {
    return;
  }

  modal.hidden = true;
  modal.classList.remove("is-open");
  document.body.classList.remove("modal-open");
}

function bindCalendarDetailModal(modal) {
  if (!modal || modal.dataset.modalBound === "true") {
    return;
  }

  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-calendar-modal-close]")) {
      closeCalendarDetailModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCalendarDetailModal();
    }
  });

  modal.dataset.modalBound = "true";
}

function rerenderTimelineCalendarView() {
  const calendarContainer = document.querySelector("#timeline-calendar");
  if (!calendarContainer) {
    return;
  }

  calendarContainer.innerHTML = renderTimelineCalendar(
    timelineCalendarState.trades,
    timelineCalendarState.basisYear,
    timelineCalendarState.realizedHistory
  );
}

function activateTimelineView(section, viewName) {
  if (!section) {
    return;
  }

  section.querySelectorAll(".view-tab").forEach((button) => {
    const isActive = button.dataset.viewTarget === viewName;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });

  section.querySelectorAll(".timeline-view").forEach((panel) => {
    const isActive = panel.dataset.view === viewName;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
}

function bindTimelineSection(section) {
  if (!section || section.dataset.timelineBound === "true") {
    return;
  }

  section.addEventListener("change", (event) => {
    const monthSelect = event.target.closest("#timeline-calendar-month");
    if (!monthSelect || !section.contains(monthSelect)) {
      return;
    }

    timelineCalendarState.selectedMonthKey = monthSelect.value;
    rerenderTimelineCalendarView();
  });

  section.addEventListener("click", (event) => {
    const tab = event.target.closest(".view-tab");
    if (tab && section.contains(tab)) {
      activateTimelineView(section, tab.dataset.viewTarget || "list");
      return;
    }

    const calendarDay = event.target.closest(".calendar-day--interactive");
    if (calendarDay && section.contains(calendarDay)) {
      openCalendarDetailModal(calendarDay.dataset.detailKey);
      return;
    }

    const toggle = event.target.closest(".timeline-toggle");
    if (!toggle || !section.contains(toggle)) {
      return;
    }

    const group = toggle.closest(".timeline-group");
    const panel = group?.querySelector(".timeline-panel");
    const willOpen = toggle.getAttribute("aria-expanded") !== "true";
    toggleDisclosure(group, toggle, panel, willOpen);
  });

  section.dataset.timelineBound = "true";
}

function renderChartStats(charts) {
  const bestReturn = Array.isArray(charts.returnsComparison) ? charts.returnsComparison[0] : null;
  setChartStat(
    "#returns-chart-stat",
    "상대 강도",
    bestReturn ? `${bestReturn.label} ${formatPercent(bestReturn.returnRate)}` : "데이터 없음"
  );

  const latestHistory = Array.isArray(charts.realizedHistory)
    ? charts.realizedHistory[charts.realizedHistory.length - 1]
    : null;
  setChartStat(
    "#realized-chart-stat",
    "누적 실현손익",
    latestHistory ? formatSignedCurrency(latestHistory.cumulativePnl) : formatCurrency(0)
  );
}

function setChartStat(selector, label, value) {
  const element = document.querySelector(selector);
  if (!element) {
    return;
  }
  element.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
}

function destroyCharts() {
  chartRegistry.forEach((chart) => chart.destroy());
  chartRegistry = [];
}

function renderChartUnavailable(selector, message) {
  const canvas = document.querySelector(selector);
  if (!canvas || !canvas.parentElement) {
    return;
  }
  canvas.parentElement.innerHTML = `<div class="chart-empty">${message}</div>`;
}

function readChartTheme() {
  const root = getComputedStyle(document.documentElement);
  return {
    accent: root.getPropertyValue("--accent").trim(),
    cash: root.getPropertyValue("--cash").trim(),
    gain: root.getPropertyValue("--gain").trim(),
    loss: root.getPropertyValue("--loss").trim(),
    muted: root.getPropertyValue("--muted").trim(),
    mutedStrong: root.getPropertyValue("--muted-strong").trim(),
    text: root.getPropertyValue("--text-strong").trim(),
    lineStrong: root.getPropertyValue("--line-strong").trim(),
    grid: alpha(root.getPropertyValue("--cash").trim(), 0.14),
    surface: alpha(root.getPropertyValue("--bg").trim() || "#040b0b", 0.9),
    sans: root.getPropertyValue("--font-sans").trim(),
    mono: root.getPropertyValue("--font-mono").trim(),
  };
}

function initializeMotion() {
  const nodes = [
    ...document.querySelectorAll(".reveal"),
    ...document.querySelectorAll(
      ".metric-card, .panel, .chart-card, .holding-card, .legend-item, .realized-item, .defense-card, .timeline-group, .calendar-month, .rule-card, .note-card"
    ),
  ];

  const uniqueNodes = [...new Set(nodes)];
  uniqueNodes.forEach((node, index) => {
    node.classList.add("scroll-reveal");
    node.style.setProperty("--reveal-delay", `${Math.min(index % 8, 7) * 60}ms`);
  });

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    uniqueNodes.forEach((node) => node.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.18,
      rootMargin: "0px 0px -8% 0px",
    }
  );

  uniqueNodes.forEach((node) => observer.observe(node));
}

function text(selector, value) {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = value ?? "";
  }
}

function tableCell(label, value, className = "") {
  const normalizedClass = className.trim();
  const classAttribute = normalizedClass ? ` class="${normalizedClass}"` : "";
  return `<td data-label="${label}"${classAttribute}>${value}</td>`;
}

function formatCurrency(value) {
  return currencyFormatter.format(value || 0);
}

function formatSignedCurrency(value, forceNeutral = false) {
  const amount = value || 0;
  if (forceNeutral) {
    return formatCurrency(amount);
  }
  if (amount > 0) {
    return `+${formatCurrency(amount)}`;
  }
  return formatCurrency(amount);
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatNumber(value) {
  return numberFormatter.format(value || 0);
}

function formatCompactNumber(value) {
  return compactNumberFormatter.format(value || 0);
}

function formatCompactCurrency(value) {
  return `${formatCompactNumber(value)}원`;
}

function toneClass(value) {
  if (value > 0) {
    return "gain";
  }
  if (value < 0) {
    return "loss";
  }
  return "neutral";
}

function alpha(hex, opacity) {
  const normalized = hex.replace("#", "").trim();
  const fullHex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  const bigint = Number.parseInt(fullHex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
