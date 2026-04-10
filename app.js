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

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NOTES_STORAGE_KEY = "sniper-capital-notes-v1";
const US_STOCK_TAX_ALLOWANCE = 2_500_000;
const US_STOCK_TAX_RATE = 0.22;
const colors = ["#17F9A6", "#5EC8FF", "#FFB84D", "#FF6B87"];
let chartRegistry = [];
let calendarDetailStore = new Map();
let currentPortfolioData = null;
let basePortfolioData = null;
let livePortfolioSnapshot = null;
let liveRefreshTimer = null;
let currentDateBadgeTimer = null;
let notesState = [];
let hasLoadedNotes = false;
let timelineCalendarState = {
  trades: [],
  basisYear: new Date().getFullYear(),
  selectedMonthKey: null,
  realizedHistory: [],
};

document.addEventListener("DOMContentLoaded", () => {
  scheduleCurrentDateBadgeRefresh();
  ensureNotesLoaded();
  initNotesBoard();
  loadPortfolio()
    .then(async (data) => {
      applyPortfolioData(data, livePortfolioSnapshot, { renderMode: "full" });
      initTradeModal();
      await refreshLivePortfolio();
      scheduleLivePortfolioRefresh();
    })
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

function applyPortfolioData(data, liveSnapshot = livePortfolioSnapshot, options = {}) {
  basePortfolioData = data;
  window.__PORTFOLIO_DATA__ = data;

  const renderable = buildRenderablePortfolio(data, liveSnapshot);
  currentPortfolioData = renderable;
  renderDashboard(renderable, options);
}

function buildRenderablePortfolio(data, liveSnapshot = null) {
  const next = structuredClone(data);
  next.holdings = normalizeHoldingsForDisplay(next.holdings || []);
  next.targets = normalizeTargetsForDisplay(next.targets || {});
  next.live = buildLiveState(liveSnapshot);

  if (!liveSnapshot?.portfolioLive) {
    return next;
  }

  next.summary = liveSnapshot.portfolioLive.summary || next.summary;
  next.assetStatus = liveSnapshot.portfolioLive.assetStatus || next.assetStatus;
  next.holdings = normalizeHoldingsForDisplay(liveSnapshot.portfolioLive.holdings || next.holdings);
  next.charts = liveSnapshot.portfolioLive.charts || next.charts;
  next.analytics = {
    ...(next.analytics || {}),
    ...(liveSnapshot.portfolioLive.analytics || {}),
  };
  next.targets = normalizeTargetsForDisplay(liveSnapshot.portfolioLive.targets || next.targets);

  return next;
}

async function refreshLivePortfolio() {
  if (window.location.protocol === "file:") {
    return null;
  }

  try {
    const response = await fetch("./api/live-prices", {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || "실시간 가격을 불러오지 못했습니다.");
    }

    livePortfolioSnapshot = payload;
    if (basePortfolioData) {
      applyPortfolioData(basePortfolioData, livePortfolioSnapshot, { renderMode: "live" });
    }
    return payload;
  } catch (error) {
    console.error(error);
    livePortfolioSnapshot = decorateFailedLiveSnapshot(livePortfolioSnapshot, error.message);
    if (basePortfolioData) {
      applyPortfolioData(basePortfolioData, livePortfolioSnapshot, { renderMode: "live" });
    }
    return null;
  }
}

function scheduleLivePortfolioRefresh() {
  if (window.location.protocol === "file:") {
    return;
  }

  if (liveRefreshTimer) {
    window.clearInterval(liveRefreshTimer);
  }

  const refreshIntervalMs = Math.max(5_000, Number(currentPortfolioData?.live?.refreshIntervalSeconds || 10) * 1000);
  liveRefreshTimer = window.setInterval(() => {
    if (document.hidden) {
      return;
    }
    refreshLivePortfolio();
  }, refreshIntervalMs);
}

function renderDashboard(data, options = {}) {
  const isLiveRefresh = options.renderMode === "live";
  const {
    metadata,
    summary,
    assetStatus,
    cashPositions,
    holdings,
    targets,
    realized,
    strategy,
    trades,
    analytics,
    charts,
    live,
  } = data;

  text("#page-title", metadata.mantra);
  text("#hero-summary", buildHeroSummary(live));
  renderCurrentDateBadge();

  renderPriceStrip(live?.quotes || {}, holdings, targets);
  renderMetricCards(summary, realized);
  renderTargets(targets, live);
  renderAllocation(summary, assetStatus, cashPositions);
  renderAssetTable(assetStatus, holdings);
  renderHoldings(holdings);
  renderDefense(analytics.xrpDefense);

  if (isLiveRefresh) {
    return;
  }

  renderCharts(charts);
  renderRealized(realized, summary.realizedProfitTotal);
  renderTimeline(trades, getCurrentBasisYear(), charts.realizedHistory);
  renderNotes(notesState);
  renderStrategy(strategy);
  bindAllPanelAccordions();
  bindNotesSection(document.querySelector("#notes-section"));
  initializeMotion();
}

function getDisplayAssetName(item = {}) {
  const symbol = String(item.symbol || "").trim().toUpperCase();
  const rawName = String(item.name || item.asset || "").trim();
  const normalizedName = rawName.toUpperCase();

  if (symbol === "KRW-BTC" || normalizedName === "BTC" || rawName === "비트코인" || rawName === "비트코인(BTC)") {
    return "비트코인(BTC)";
  }

  if (symbol === "KRW-ETH" || normalizedName === "ETH" || rawName === "이더리움" || rawName === "이더리움(ETH)") {
    return "이더리움(ETH)";
  }

  if (symbol === "KRW-XRP" || normalizedName === "XRP" || rawName === "엑스알피" || rawName === "엑스알피(XRP)") {
    return "엑스알피(XRP)";
  }

  return rawName;
}

function renderPriceStrip(quotes = {}, holdings = [], targets = {}) {
  const container = document.querySelector("#price-strip");
  if (!container) {
    return;
  }

  const instruments = collectTrackedQuoteItems(holdings, targets);
  if (!instruments.length) {
    container.innerHTML = `
      <div class="price-pill price-pill--empty">
        <div class="price-copy">
          <span class="price-name">실시간 가격</span>
          <span class="price-meta">추적 종목이 아직 없습니다.</span>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = instruments
    .map((instrument) => {
      const quote = instrument.liveQuote || quotes[instrument.name] || null;
      const tone = normalizeTargetTone(instrument.market);
      const quoteStateClass = quote?.available ? "" : " price-pill--inactive";
      const staleClass = quote?.isDelayed ? " price-pill--stale" : "";
      const movementClass = getQuoteToneClass(quote);

      return `
        <div class="price-pill price-pill--${tone}${quoteStateClass}${staleClass}">
          <div class="price-copy">
            <span class="price-name">${escapeHtml(getDisplayAssetName(instrument))}</span>
            <span class="price-meta">${escapeHtml(buildInstrumentMeta(instrument, quote))}</span>
          </div>
          <div class="price-value-wrap">
            <strong class="price-value ${movementClass}">${escapeHtml(formatQuotePrimary(quote, instrument))}</strong>
            <span class="price-secondary ${movementClass}">${escapeHtml(
              formatQuoteSecondary(quote, instrument, { includeKimchiPremium: true })
            )}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderMetricCards(summary, realized = []) {
  const initialInvestment = summary.initialInvestment || 0;
  const initialInvestmentPnl = (summary.totalAssets || 0) - initialInvestment;
  const usStockTaxEstimate = estimateUsStockTax(realized);

  const metrics = [
    {
      label: "초기 투자금",
      value: formatCurrency(initialInvestment),
      detail: "업비트 기준 시작 자금",
      tone: "neutral",
    },
    {
      label: "총 자산",
      value: formatCurrency(summary.totalAssets),
      detail: "전체 평가액",
      tone: "neutral",
    },
    {
      label: "초기 투자금 대비 손익",
      value: formatSignedCurrency(initialInvestmentPnl),
      detail: "총 자산 - 초기 투자금",
      tone: toneClass(initialInvestmentPnl),
    },
    {
      label: "현금 보유",
      value: formatCurrency(summary.cashTotal),
      detail: "주식예수금 + 현금 + 업비트 KRW",
      tone: "neutral",
    },
    {
      label: "실현 손익",
      value: formatSignedCurrency(summary.realizedProfitTotal),
      detail: `유동성 비중 ${formatPercent(summary.liquidityRatio)}`,
      tone: toneClass(summary.realizedProfitTotal),
    },
    {
      label: "해외주식 세금 추정",
      value: formatCurrency(usStockTaxEstimate.taxEstimate),
      detail: usStockTaxEstimate.detail,
      tone: usStockTaxEstimate.taxEstimate > 0 ? "loss" : "neutral",
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

function resolveRealizedMarket(item = {}) {
  const rawMarket = String(item.market || "").trim();
  if (rawMarket === "us-stock" || rawMarket === "미국주식") {
    return "us-stock";
  }
  if (rawMarket === "kr-stock" || rawMarket === "국내주식") {
    return "kr-stock";
  }
  if (rawMarket === "crypto" || rawMarket === "암호화폐") {
    return "crypto";
  }

  const haystack = [item.assetName, item.asset, item.symbol]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  if (["PLTR", "팔란티어", "CRCL", "써클"].some((keyword) => haystack.includes(String(keyword).toUpperCase()))) {
    return "us-stock";
  }
  if (["삼성전자", "SK하이닉스", "에스케이하이닉스"].some((keyword) => haystack.includes(keyword.toUpperCase()))) {
    return "kr-stock";
  }
  if (["BTC", "비트코인", "ETH", "이더리움", "XRP", "엑스알피"].some((keyword) => haystack.includes(keyword.toUpperCase()))) {
    return "crypto";
  }

  return "";
}

function estimateUsStockTax(realized = [], referenceDate = new Date()) {
  const currentYear = getCurrentBasisYear(referenceDate);
  const usStockRealized = realized.filter((item) => resolveRealizedMarket(item) === "us-stock");

  if (!usStockRealized.length) {
    return {
      taxEstimate: 0,
      detail: `${currentYear}년 미국주식 매도 발생 시 자동 계산`,
    };
  }

  const realizedPnl = usStockRealized.reduce((total, item) => total + Number(item.pnl || 0), 0);
  if (realizedPnl <= 0) {
    return {
      taxEstimate: 0,
      detail: `실현손익 ${formatSignedCurrency(realizedPnl)} · 참고용`,
    };
  }

  const remainingDeduction = Math.max(US_STOCK_TAX_ALLOWANCE - realizedPnl, 0);
  const taxableGain = Math.max(realizedPnl - US_STOCK_TAX_ALLOWANCE, 0);
  const taxEstimate = taxableGain > 0 ? taxableGain * US_STOCK_TAX_RATE : 0;

  if (taxEstimate > 0) {
    return {
      taxEstimate,
      detail: `과세대상 ${formatCurrency(taxableGain)} · 22% 기준`,
    };
  }

  return {
    taxEstimate: 0,
    detail: `실현손익 ${formatSignedCurrency(realizedPnl)} · 공제 잔여 ${formatCurrency(remainingDeduction)}`,
  };
}

function renderTargets(targets, live) {
  const hero = document.querySelector("#targets-hero");
  const grid = document.querySelector("#targets-grid");
  if (!hero || !grid) {
    return;
  }

  const groups = Array.isArray(targets?.groups) ? targets.groups : [];
  const totalCount = groups.reduce((total, group) => {
    const items = Array.isArray(group?.items) ? group.items.filter(Boolean) : [];
    return total + items.length;
  }, 0);

  hero.innerHTML = `
    <div class="targets-hero-top">
      <div>
        <p class="eyebrow">${escapeHtml(targets?.eyebrow || "Target Board")}</p>
        <h3 class="targets-hero-title">${escapeHtml(targets?.title || "지금 노리는 종목")}</h3>
      </div>
      <div class="targets-counter">
        <span>총 후보</span>
        <strong>${formatNumber(totalCount)}</strong>
      </div>
    </div>
    <p class="targets-hero-summary">${escapeHtml(
      targets?.summary || "매수 버튼보다 먼저 보는 후보군입니다."
    )}</p>
    <div class="targets-live-row">
      <span class="targets-live-badge targets-live-badge--${escapeHtml(live?.status?.level || "neutral")}">${escapeHtml(
        live?.status?.message || "실시간 연결 준비 중"
      )}</span>
      <span class="targets-live-meta">${escapeHtml(buildLiveTimestampCopy(live))}</span>
    </div>
    <div class="targets-strip">
      ${groups
        .map((group) => {
          const items = Array.isArray(group?.items) ? group.items.filter(Boolean) : [];
          const tone = normalizeTargetTone(group?.tone);
          return `
            <div class="targets-strip-item targets-strip-item--${tone}">
              <span>${escapeHtml(group?.title || "목표")}</span>
              <strong>${items.length ? `${formatNumber(items.length)}종목` : "대기중"}</strong>
            </div>
          `;
        })
        .join("")}
    </div>
    ${
      totalCount
        ? `
          <div class="targets-pill-row">
            ${groups
              .flatMap((group) => {
                const tone = normalizeTargetTone(group?.tone);
                const items = Array.isArray(group?.items) ? group.items.filter(Boolean) : [];
                return items.map((item) => {
                  const assetItem = typeof item === "string" ? { name: item } : item;
                  return `<span class="targets-pill targets-pill--${tone}">${escapeHtml(getDisplayAssetName(assetItem))}</span>`;
                });
              })
              .join("")}
          </div>
        `
        : `
          <div class="targets-empty">
            <strong>아직 없음</strong>
            <p>후보 종목이 정리되면 이 보드부터 채워집니다.</p>
          </div>
        `
    }
  `;

  grid.innerHTML = groups.map((group) => renderTargetGroupCard(group, live)).join("");
}

function renderTargetGroupCard(group = {}, live = null) {
  const items = Array.isArray(group.items) ? group.items.filter(Boolean) : [];
  const tone = normalizeTargetTone(group.tone);

  return `
    <article class="panel targets-market-card targets-market-card--${tone}">
      <div class="targets-market-top">
        <div>
          <p class="targets-market-label">${escapeHtml(group.label || group.title || "Target Group")}</p>
          <h3 class="targets-market-title">${escapeHtml(group.title || "목표 종목")}</h3>
        </div>
        <span class="targets-market-count">${items.length ? `${formatNumber(items.length)}종목` : "비어 있음"}</span>
      </div>
      ${group.summary ? `<p class="targets-market-summary">${escapeHtml(group.summary)}</p>` : ""}
      ${
        items.length
          ? `
            <ul class="targets-list">
              ${items.map((item) => renderTargetListItem(item, tone, live)).join("")}
            </ul>
          `
          : `
            <div class="targets-empty">
              <strong>${escapeHtml(group.emptyTitle || "아직 없음")}</strong>
              <p>${escapeHtml(group.emptyDescription || "새 후보가 생기면 여기에 추가합니다.")}</p>
            </div>
          `
      }
    </article>
  `;
}

function normalizeTargetTone(value) {
  if (value === "us-stock") {
    return "global";
  }
  if (value === "kr-stock") {
    return "domestic";
  }
  if (value === "crypto" || value === "global" || value === "domestic") {
    return value;
  }
  return "neutral";
}

function renderAllocation(summary, assetStatus, cashPositions) {
  const isCryptoAsset = (item) => item.category === "암호화폐" || item.platform === "업비트";

  const allocation = [
    {
      label: "암호화폐",
      value: assetStatus
        .filter(isCryptoAsset)
        .reduce((total, item) => total + item.valuation, 0),
    },
    {
      label: "해외주식",
      value: assetStatus
        .filter((item) => item.category === "해외주식")
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
  const returnsCanvas = document.querySelector("#returns-chart");
  const realizedCanvas = document.querySelector("#realized-chart");

  if (!charts) {
    if (returnsCanvas) {
      renderChartUnavailable("#returns-chart", "차트 데이터 없음");
    }
    if (realizedCanvas) {
      renderChartUnavailable("#realized-chart", "차트 데이터 없음");
    }
    return;
  }

  renderChartStats(charts);
  destroyCharts();

  if (!window.Chart) {
    if (returnsCanvas) {
      renderChartUnavailable("#returns-chart", "Chart.js 로드 실패");
    }
    if (realizedCanvas) {
      renderChartUnavailable("#realized-chart", "Chart.js 로드 실패");
    }
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

  if (returnsCanvas && !hasReturns) {
    renderChartUnavailable("#returns-chart", "차트 데이터 없음");
  } else if (returnsCanvas) {
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

  if (realizedCanvas && !hasRealized) {
    renderChartUnavailable("#realized-chart", "차트 데이터 없음");
  } else if (realizedCanvas) {
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
                item.dailyPnl >= 0 ? alpha(theme.gain, 0.6) : alpha(theme.loss, 0.2)
              ),
              borderColor: charts.realizedHistory.map((item) => (item.dailyPnl >= 0 ? theme.gain : alpha(theme.loss, 0.4))),
              borderWidth: 1.2,
              borderRadius: 8,
              borderSkipped: false,
              yAxisID: "y",
            },
            {
              type: "line",
              label: "누적 실현손익",
              data: charts.realizedHistory.map((item) => item.cumulativePnl),
              borderColor: theme.accent,
              backgroundColor: alpha(theme.accent, 0.15),
              pointBackgroundColor: theme.accent,
              pointBorderColor: theme.surface,
              pointRadius: 5,
              pointHoverRadius: 6,
              borderWidth: 3,
              tension: 0.3,
              fill: true,
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

function renderAssetTable(assetStatus, holdings = []) {
  const body = document.querySelector("#asset-status-body");
  if (!body) {
    return;
  }

  const rows = holdings.length
    ? holdings.map((item) => {
        const principal = (item.quantity || 0) * (item.averagePrice || 0);
        const pnl = (item.valuation || 0) - principal;

        return {
          asset: getDisplayAssetName(item),
          platform: item.platform,
          currentPrice: buildTableQuoteMarkup(item.liveQuote, item),
          valuation: item.valuation || 0,
          principal,
          pnl,
          returnRate: item.returnRate || 0,
        };
      })
    : assetStatus.map((item) => ({
        asset: item.asset || item.assetName || item.category,
        platform: item.platform,
        currentPrice: buildTableFallbackMarkup(),
        valuation: item.valuation || 0,
        principal: item.principal || 0,
        pnl: item.pnl || 0,
        returnRate: item.returnRate || 0,
      }));

  body.innerHTML = rows
    .map((item) =>
      `
        <tr>
          ${tableCell("종목", item.asset)}
          ${tableCell("플랫폼", item.platform)}
          ${tableCell("현재가", item.currentPrice, "align-right numeric-cell")}
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
      const quote = item.liveQuote;
      const statusCopy = quote?.isDelayed ? "업데이트 지연" : "실시간";
      return `
        <article class="holding-card">
          <div class="holding-head">
            <div>
              <p class="mini-label">${item.platform}</p>
              <strong class="holding-title">${escapeHtml(getDisplayAssetName(item))}</strong>
            </div>
            <span class="status-tag ${quote?.isDelayed ? "status-tag--warning" : ""}">${statusCopy}</span>
          </div>
          <div class="mini-stack">
            <div class="mini-row">
              <span class="mini-label">수량</span>
              <span class="mini-value">${formatNumber(item.quantity)}</span>
            </div>
            <div class="mini-row">
              <span class="mini-label">현재가</span>
              ${buildHoldingQuoteMarkup(quote, item)}
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
  if (!container) {
    return;
  }

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

function ensureNotesLoaded() {
  if (hasLoadedNotes) {
    return;
  }

  notesState = loadNotesFromStorage();
  hasLoadedNotes = true;
}

function loadNotesFromStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(NOTES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((note) => note && typeof note.id === "string")
      .map((note) => ({
        id: note.id,
        title: String(note.title || "").trim(),
        body: String(note.body || "").trim(),
        createdAt: note.createdAt || new Date().toISOString(),
      }))
      .filter((note) => note.title || note.body)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  } catch (error) {
    console.error(error);
    return [];
  }
}

function persistNotesToStorage(notes) {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  try {
    window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

function renderNotes(notes = notesState) {
  const count = document.querySelector("#notes-count");
  const list = document.querySelector("#notes-list");
  if (!count || !list) {
    return;
  }

  count.textContent = `${formatNumber(notes.length)}개`;
  list.innerHTML = notes.length
    ? notes.map((note) => renderNoteCard(note)).join("")
    : `
        <article class="note-card notes-empty">
          <strong>아직 저장된 메모가 없습니다.</strong>
          <p>매매 아이디어, 손절 기준, 체크 포인트를 짧게 쌓아두세요.</p>
        </article>
      `;
}

function renderNoteCard(note) {
  return `
    <article class="note-card memo-card" data-note-id="${escapeHtml(note.id)}">
      <div class="memo-card-head">
        <div>
          <p class="mini-label">Saved Memo</p>
          <strong class="memo-card-title">${escapeHtml(getNoteTitle(note))}</strong>
        </div>
        <button type="button" class="memo-card-delete" data-note-delete="${escapeHtml(note.id)}">삭제</button>
      </div>
      <p class="memo-card-body">${escapeHtml(note.body || note.title).replaceAll("\n", "<br />")}</p>
      <div class="memo-card-meta">
        <span>${escapeHtml(formatNoteTimestamp(note.createdAt))}</span>
        <span>${escapeHtml(getNoteMeta(note))}</span>
      </div>
    </article>
  `;
}

function getNoteTitle(note) {
  const title = String(note.title || "").trim();
  if (title) {
    return title;
  }

  const body = String(note.body || "").trim();
  if (!body) {
    return "메모";
  }

  return body.length > 28 ? `${body.slice(0, 28)}...` : body;
}

function getNoteMeta(note) {
  const length = String(note.body || note.title || "").trim().length;
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

function initNotesBoard() {
  const section = document.querySelector("#notes-section");
  if (!section) {
    return;
  }

  bindNotesSection(section);
}

function bindNotesSection(section) {
  if (!section || section.dataset.notesBound === "true") {
    return;
  }

  const form = section.querySelector("#notes-form");
  const titleInput = section.querySelector("#note-title");
  const bodyInput = section.querySelector("#note-body");
  const status = section.querySelector("#notes-status");
  const resetButton = section.querySelector("[data-note-reset]");

  const setStatus = (message, tone = "neutral") => {
    if (!status) {
      return;
    }

    status.textContent = message || "";
    status.dataset.tone = tone;
  };

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    ensureNotesLoaded();

    const title = String(titleInput?.value || "").trim();
    const body = String(bodyInput?.value || "").trim();
    if (!title && !body) {
      setStatus("제목이나 내용을 하나는 적어주세요.", "error");
      bodyInput?.focus();
      return;
    }

    const nextNote = {
      id: `note-${Date.now()}`,
      title,
      body,
      createdAt: new Date().toISOString(),
    };

    const nextNotes = [nextNote, ...notesState];
    if (!persistNotesToStorage(nextNotes)) {
      setStatus("메모 저장에 실패했습니다. 브라우저 저장 공간을 확인해주세요.", "error");
      return;
    }

    notesState = nextNotes;
    renderNotes(notesState);
    form.reset();
    setStatus("메모를 저장했습니다.", "success");
    titleInput?.focus();
  });

  resetButton?.addEventListener("click", () => {
    form?.reset();
    setStatus("입력을 비웠습니다.");
    titleInput?.focus();
  });

  section.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-note-delete]");
    if (!deleteButton || !section.contains(deleteButton)) {
      return;
    }

    ensureNotesLoaded();
    const noteId = deleteButton.dataset.noteDelete;
    const nextNotes = notesState.filter((note) => note.id !== noteId);
    if (!persistNotesToStorage(nextNotes)) {
      setStatus("메모 삭제에 실패했습니다.", "error");
      return;
    }

    notesState = nextNotes;
    renderNotes(notesState);
    setStatus("메모를 삭제했습니다.", "success");
  });

  section.dataset.notesBound = "true";
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
    // 거래 추가 버튼 클릭은 무시
    if (event.target.closest(".btn-add-trade")) {
      return;
    }

    const trigger = event.target.closest(".section-toggle");
    if (!trigger || !panel.contains(trigger)) {
      return;
    }

    const body = panel.querySelector(".panel-collapse");
    const willOpen = trigger.getAttribute("aria-expanded") !== "true";
    toggleDisclosure(panel, trigger, body, willOpen);

    if (willOpen && panel.id === "timeline-section") {
      window.requestAnimationFrame(() => {
        panel.scrollIntoView({
          block: "start",
          behavior: "smooth",
        });
      });
    }
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
    ...stockTrades.map((trade) => ({ ...trade, market: trade.market || "국내주식" })),
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
                <strong class="${getSignedPriceToneClass(dayPnl)}">${formatSignedCurrency(dayPnl)}</strong>
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
                          <strong class="timeline-title">${escapeHtml(getDisplayAssetName({ asset: trade.asset }))}</strong>
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
  const monthPnl = Array.from({ length: daysInMonth }, (_, dayIndex) => {
    const dateKey = buildMonthDayKey(selectedMonth.month, dayIndex + 1);
    return realizedLookup.get(dateKey)?.dailyPnl ?? 0;
  }).reduce((sum, value) => sum + value, 0);
  const monthPnlTone = getSignedPriceToneClass(monthPnl);

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
        <strong class="${monthPnlTone}">총 ${monthTrades.length}건 · 월 누적 실현손익 ${formatSignedCurrency(monthPnl)}</strong>
      </div>
    </div>
    <article class="calendar-month">
      <header class="calendar-month-header">
        <div>
          <p class="mini-label">Calendar View</p>
          <strong>${formatCalendarMonthLabel(selectedMonth.year, selectedMonth.month)}</strong>
        </div>
        <div class="calendar-month-summary">
          <span>선택 월 누적 실현손익</span>
          <strong class="${monthPnlTone}">${formatSignedCurrency(monthPnl)}</strong>
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
            const dayPnlTone = getSignedPriceToneClass(dayPnl);
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
                          <span>${escapeHtml(getDisplayAssetName({ asset: trade.asset }))}</span>
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
  const basisYear = Number(basisDateLabel) || getCurrentBasisYear();
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
  const container = document.querySelector("#strategy-playbook");
  if (!container || !strategy) {
    return;
  }

  container.innerHTML = `
    <article class="panel strategy-hero-card">
      <div class="strategy-hero-top">
        <div>
          <p class="eyebrow">Revised Playbook</p>
          <h3 class="strategy-hero-title">${escapeHtml(strategy.title)}</h3>
        </div>
        <span class="strategy-version">${escapeHtml(strategy.version)}</span>
      </div>
      <p class="strategy-hero-summary">${escapeHtml(strategy.summary)}</p>
      <p class="strategy-hero-emphasis">${escapeHtml(strategy.mindset)}</p>
      <ul class="strategy-highlights">
        ${strategy.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </article>

    <div class="strategy-layout">
      <article class="panel strategy-block strategy-block--selection">
        <div class="strategy-block-head">
          <span class="strategy-section-index">${escapeHtml(strategy.selection.section)}</span>
          <div>
            <p class="eyebrow">Watchlist Filter</p>
            <h3>${escapeHtml(strategy.selection.title)}</h3>
          </div>
        </div>
        <p class="strategy-block-copy">${escapeHtml(strategy.selection.subtitle)}</p>
        <div class="strategy-subgrid">
          <section class="strategy-mini-card">
            <p class="strategy-mini-label">${escapeHtml(strategy.selection.primaryLabel)}</p>
            ${renderStrategyBulletList(strategy.selection.criteria)}
          </section>
          <section class="strategy-mini-card strategy-mini-card--warn">
            <p class="strategy-mini-label">${escapeHtml(strategy.selection.cautionLabel)}</p>
            ${renderStrategyBulletList(strategy.selection.caution)}
          </section>
        </div>
      </article>

      <article class="panel strategy-block strategy-block--entry">
        <div class="strategy-block-head">
          <span class="strategy-section-index">${escapeHtml(strategy.entry.section)}</span>
          <div>
            <p class="eyebrow">Sizing Ladder</p>
            <h3>${escapeHtml(strategy.entry.title)}</h3>
          </div>
        </div>
        <p class="strategy-block-copy">${escapeHtml(strategy.entry.intro)}</p>
        <div class="strategy-step-grid">
          ${strategy.entry.steps.map(renderEntryStepCard).join("")}
        </div>
        <div class="strategy-reserve-card">
          <div>
            <p class="strategy-mini-label">${escapeHtml(strategy.entry.reserve.label)}</p>
            <strong class="strategy-reserve-title">${escapeHtml(strategy.entry.reserve.summary)}</strong>
          </div>
          ${renderStrategyBulletList(strategy.entry.reserve.details, "strategy-bullet-list strategy-bullet-list--compact")}
        </div>
        <section class="strategy-callout">
          <p class="strategy-mini-label">핵심 변경 포인트</p>
          ${renderStrategyBulletList(strategy.entry.keyPoints, "strategy-bullet-list strategy-bullet-list--compact")}
        </section>
      </article>

      <article class="panel strategy-block strategy-block--exit">
        <div class="strategy-block-head">
          <span class="strategy-section-index">${escapeHtml(strategy.exit.section)}</span>
          <div>
            <p class="eyebrow">Profit Taking</p>
            <h3>${escapeHtml(strategy.exit.title)}</h3>
          </div>
        </div>
        <p class="strategy-block-copy">${escapeHtml(strategy.exit.intro)}</p>
        <div class="strategy-step-grid strategy-step-grid--exit">
          ${strategy.exit.steps.map(renderExitStepCard).join("")}
        </div>
        <section class="strategy-callout strategy-callout--subtle">
          <p class="strategy-mini-label">트레일링 운용 메모</p>
          ${renderStrategyBulletList(strategy.exit.trailingNotes, "strategy-bullet-list strategy-bullet-list--compact")}
        </section>
      </article>

      <article class="panel strategy-block strategy-block--stops">
        <div class="strategy-block-head">
          <span class="strategy-section-index">${escapeHtml(strategy.stops.section)}</span>
          <div>
            <p class="eyebrow">Risk Control</p>
            <h3>${escapeHtml(strategy.stops.title)}</h3>
          </div>
        </div>
        <div class="strategy-subgrid strategy-subgrid--stops">
          <section class="strategy-mini-card">
            <p class="strategy-mini-label">${escapeHtml(strategy.stops.priceStop.label)}</p>
            <strong class="strategy-rule-title">${escapeHtml(strategy.stops.priceStop.rule)}</strong>
            ${renderStrategyBulletList(strategy.stops.priceStop.details, "strategy-bullet-list strategy-bullet-list--compact")}
          </section>
          <section class="strategy-mini-card">
            <p class="strategy-mini-label">${escapeHtml(strategy.stops.timeStop.label)}</p>
            <strong class="strategy-rule-title">${escapeHtml(strategy.stops.timeStop.rule)}</strong>
            ${renderStrategyBulletList(strategy.stops.timeStop.details, "strategy-bullet-list strategy-bullet-list--compact")}
          </section>
        </div>
      </article>
    </div>
  `;
}

function renderEntryStepCard(step) {
  return `
    <article class="strategy-step-card">
      <div class="strategy-step-head">
        <strong>${escapeHtml(step.stage)}</strong>
        <span class="strategy-step-chip">${escapeHtml(step.allocation)}</span>
      </div>
      <p class="strategy-step-summary">${escapeHtml(step.summary)}</p>
      ${renderStrategyBulletList(step.conditions, "strategy-bullet-list strategy-bullet-list--compact")}
    </article>
  `;
}

function renderExitStepCard(step) {
  return `
    <article class="strategy-step-card strategy-step-card--exit">
      <div class="strategy-step-head">
        <strong>${escapeHtml(step.stage)}</strong>
        <span class="strategy-step-chip">${escapeHtml(step.trigger)}</span>
      </div>
      <p class="strategy-step-summary">${escapeHtml(step.action)}</p>
      <p class="strategy-step-note">${escapeHtml(step.note)}</p>
    </article>
  `;
}

function renderStrategyBulletList(items = [], className = "strategy-bullet-list") {
  return `
    <ul class="${className}">
      ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
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
              <strong>${escapeHtml(getDisplayAssetName({ asset: trade.asset }))}</strong>
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
              <strong class="calendar-pnl-value ${trade.note.includes("+") ? "price-move-up" : trade.note.includes("-") ? "price-move-down" : "price-move-neutral"}">${trade.note}</strong>
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

function buildLiveState(liveSnapshot) {
  if (window.location.protocol === "file:") {
    return {
      available: false,
      updatedAt: null,
      refreshIntervalSeconds: 10,
      cryptoRefreshIntervalSeconds: 10,
      marketRefreshIntervalSeconds: 180,
      quotes: {},
      fx: {
        usdkrw: null,
      },
      status: {
        level: "neutral",
        message: "로컬 파일 모드 · 실시간 시세 비활성화",
      },
      errors: [],
      warnings: [],
    };
  }

  if (!liveSnapshot) {
    return {
      available: false,
      updatedAt: null,
      refreshIntervalSeconds: 10,
      cryptoRefreshIntervalSeconds: 10,
      marketRefreshIntervalSeconds: 180,
      quotes: {},
      fx: {
        usdkrw: null,
      },
      status: {
        level: "neutral",
        message: "실시간 가격 연결 준비 중",
      },
      errors: [],
      warnings: [],
    };
  }

  return {
    available: Boolean(liveSnapshot.portfolioLive || Object.keys(liveSnapshot.quotes || {}).length),
    updatedAt: liveSnapshot.live?.updatedAt || liveSnapshot.updatedAt || null,
    refreshIntervalSeconds: liveSnapshot.live?.refreshIntervalSeconds || 10,
    cryptoRefreshIntervalSeconds: liveSnapshot.live?.cryptoRefreshIntervalSeconds || 10,
    marketRefreshIntervalSeconds: liveSnapshot.live?.marketRefreshIntervalSeconds || 180,
    quotes: liveSnapshot.quotes || {},
    fx: liveSnapshot.fx || { usdkrw: null },
    status: liveSnapshot.live?.status || {
      level: "neutral",
      message: "실시간 가격 연결 준비 중",
    },
    errors: Array.isArray(liveSnapshot.live?.errors) ? liveSnapshot.live.errors : [],
    warnings: Array.isArray(liveSnapshot.live?.warnings) ? liveSnapshot.live.warnings : [],
  };
}

function decorateFailedLiveSnapshot(liveSnapshot, errorMessage = "") {
  const fallbackMessage = errorMessage || "실시간 가격 연결이 지연되고 있습니다.";
  if (!liveSnapshot) {
    return {
      updatedAt: null,
      quotes: {},
      fx: {
        usdkrw: null,
        source: "fallback",
        updatedAt: null,
        isDelayed: true,
      },
      portfolioLive: null,
      live: {
        updatedAt: null,
        refreshIntervalSeconds: 10,
        cryptoRefreshIntervalSeconds: 10,
        marketRefreshIntervalSeconds: 180,
        status: {
          level: "warning",
          message: fallbackMessage,
        },
        errors: [fallbackMessage],
        warnings: [],
      },
    };
  }

  const next = structuredClone(liveSnapshot);
  next.live = next.live || {};
  next.live.status = {
    level: "warning",
    message: next.portfolioLive ? "일부 종목 업데이트 지연 · 마지막 값 유지 중" : fallbackMessage,
  };
  next.live.errors = [...new Set([...(next.live.errors || []), fallbackMessage])];
  next.live.refreshIntervalSeconds = next.live.refreshIntervalSeconds || 10;
  next.live.cryptoRefreshIntervalSeconds = next.live.cryptoRefreshIntervalSeconds || 10;
  next.live.marketRefreshIntervalSeconds = next.live.marketRefreshIntervalSeconds || 180;
  next.quotes = Object.fromEntries(
    Object.entries(next.quotes || {}).map(([key, quote]) => [
      key,
      {
        ...quote,
        isDelayed: true,
      },
    ])
  );
  if (next.fx) {
    next.fx = {
      ...next.fx,
      isDelayed: true,
    };
  }
  return next;
}

function buildHeroSummary(live) {
  const cryptoRefresh = live?.cryptoRefreshIntervalSeconds || live?.refreshIntervalSeconds || 10;
  const marketRefresh = live?.marketRefreshIntervalSeconds || 180;
  const refreshCopy = `코인 ${cryptoRefresh}초 · 미국주식 ${marketRefresh}초 주기`;

  if (window.location.protocol === "file:") {
    return `실시간 가격은 서버 모드에서만 동작합니다. \`node scripts/dev-server.js\` 로 실행하면 ${refreshCopy}로 갱신됩니다.`;
  }

  const statusMessage = live?.status?.message || "실시간 가격 연결 준비 중";
  const timestamp = buildLiveTimestampCopy(live);
  return `${statusMessage} · ${timestamp} · ${refreshCopy}`;
}

function normalizeHoldingsForDisplay(holdings = []) {
  return holdings.map((item) => {
    const quantity = Number(item.quantity || 0);
    const valuation = Number(item.valuation || 0);
    const averagePrice = Number(item.averagePrice || 0);
    const fallbackPriceKrw = quantity > 0 ? valuation / quantity : averagePrice;
    const currentPriceKrw = Number.isFinite(Number(item.currentPriceKrw))
      ? Number(item.currentPriceKrw)
      : Number.isFinite(Number(item.liveQuote?.priceKrw))
        ? Number(item.liveQuote.priceKrw)
        : fallbackPriceKrw;
    const currentPriceUsd = Number.isFinite(Number(item.currentPriceUsd))
      ? Number(item.currentPriceUsd)
      : Number.isFinite(Number(item.liveQuote?.priceUsd))
        ? Number(item.liveQuote.priceUsd)
        : null;

    return {
      ...item,
      name: item.name || item.asset,
      symbol: item.symbol || "",
      market: item.market || (item.platform === "업비트" ? "crypto" : "kr-stock"),
      currency: item.currency || (item.market === "us-stock" ? "USD" : "KRW"),
      priceSource: item.priceSource || "",
      quantity,
      averagePrice,
      valuation,
      returnRate: Number(item.returnRate || 0),
      currentPriceKrw,
      currentPriceUsd,
      currentPrice:
        item.currency === "USD" && Number.isFinite(currentPriceUsd) ? currentPriceUsd : currentPriceKrw,
      liveQuote: {
        name: item.name || item.asset,
        symbol: item.symbol || "",
        market: item.market || (item.platform === "업비트" ? "crypto" : "kr-stock"),
        available: currentPriceKrw > 0,
        price: item.currency === "USD" && Number.isFinite(currentPriceUsd) ? currentPriceUsd : currentPriceKrw,
        priceKrw: currentPriceKrw || null,
        priceUsd: Number.isFinite(currentPriceUsd) ? currentPriceUsd : null,
        changePercent: Number.isFinite(Number(item.liveQuote?.changePercent)) ? Number(item.liveQuote.changePercent) : null,
        kimchiPremiumPercent: Number.isFinite(Number(item.liveQuote?.kimchiPremiumPercent))
          ? Number(item.liveQuote.kimchiPremiumPercent)
          : null,
        globalPriceKrw: Number.isFinite(Number(item.liveQuote?.globalPriceKrw)) ? Number(item.liveQuote.globalPriceKrw) : null,
        globalPriceUsd: Number.isFinite(Number(item.liveQuote?.globalPriceUsd)) ? Number(item.liveQuote.globalPriceUsd) : null,
        globalUpdatedAt: item.liveQuote?.globalUpdatedAt || null,
        isMarketOpen: item.liveQuote?.isMarketOpen ?? null,
        isDelayed: item.liveQuote ? Boolean(item.liveQuote.isDelayed) : true,
        updatedAt: item.liveQuote?.updatedAt || null,
        error: item.liveQuote?.error || null,
      },
    };
  });
}

function normalizeTargetsForDisplay(targets = {}) {
  const groups = Array.isArray(targets.groups) ? targets.groups : [];
  return {
    ...targets,
    groups: groups.map((group) => {
      const normalizedItems = (Array.isArray(group.items) ? group.items : []).map((item) => {
        const base = typeof item === "string" ? { name: item } : item;
        const market = base.market || "";
        const currency = base.currency || (market === "us-stock" ? "USD" : "KRW");
        return {
          ...base,
          name: base.name || "",
          symbol: base.symbol || "",
          market,
          currency,
          priceSource: base.priceSource || "",
          liveQuote: base.liveQuote || null,
        };
      });

      return {
        ...group,
        tone: normalizeTargetTone(group.tone || normalizedItems[0]?.market),
        items: normalizedItems,
      };
    }),
  };
}

function renderTargetListItem(item = {}, tone = "neutral") {
  const quote = item.liveQuote || null;
  const movementClass = getQuoteToneClass(quote);
  return `
    <li class="targets-list-item">
      <div class="targets-item-head">
        <div>
          <span class="targets-item-name">${escapeHtml(getDisplayAssetName(item))}</span>
          <span class="targets-item-note">${escapeHtml(buildTargetMeta(item))}</span>
        </div>
        <span class="targets-item-badge targets-item-badge--${tone}">${escapeHtml(getTargetBadgeLabel(item))}</span>
      </div>
      <div class="targets-item-price">
        <strong class="${movementClass}">${escapeHtml(formatQuotePrimary(quote, item))}</strong>
        <span class="${movementClass}">${escapeHtml(formatQuoteSecondary(quote, item))}</span>
      </div>
    </li>
  `;
}

function collectTrackedQuoteItems(holdings = [], targets = {}) {
  const registry = new Map();
  const priorityRank = {
    "KRW-BTC": 0,
    비트코인: 0,
    BTC: 0,
    "KRW-ETH": 1,
    ETH: 1,
    "KRW-XRP": 2,
    XRP: 2,
  };
  const scopeRank = {
    holding: 0,
    target: 1,
  };
  const marketRank = {
    crypto: 0,
    "us-stock": 1,
    "kr-stock": 2,
  };

  holdings.forEach((item) => {
    const key = item.symbol || item.name || item.asset;
    registry.set(key, {
      scope: "holding",
      name: item.name || item.asset,
      symbol: item.symbol || "",
      market: item.market || "",
      quantity: Number(item.quantity || 0),
      liveQuote: item.liveQuote || null,
    });
  });

  (targets.groups || []).forEach((group) => {
    (group.items || []).forEach((item) => {
      const key = item.symbol || item.name;
      if (!registry.has(key)) {
        registry.set(key, {
          scope: "target",
          name: item.name,
          symbol: item.symbol || "",
          market: item.market || "",
          quantity: 0,
          liveQuote: item.liveQuote || null,
        });
      }
    });
  });

  return [...registry.values()].sort((left, right) => {
    const leftPriority = priorityRank[left.symbol] ?? priorityRank[left.name] ?? 99;
    const rightPriority = priorityRank[right.symbol] ?? priorityRank[right.name] ?? 99;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const leftScope = scopeRank[left.scope] ?? 99;
    const rightScope = scopeRank[right.scope] ?? 99;
    if (leftScope !== rightScope) {
      return leftScope - rightScope;
    }

    const leftMarket = marketRank[left.market] ?? 99;
    const rightMarket = marketRank[right.market] ?? 99;
    if (leftMarket !== rightMarket) {
      return leftMarket - rightMarket;
    }

    return String(left.name).localeCompare(String(right.name), "ko-KR");
  });
}

function buildInstrumentMeta(instrument, quote) {
  const scopeCopy =
    instrument.scope === "holding"
      ? `보유 ${formatNumber(instrument.quantity || 0)}`
      : buildMarketLabel(instrument.market);
  const statusCopy = quote?.isDelayed ? "업데이트 지연" : null;

  return [instrument.symbol || scopeCopy, statusCopy || scopeCopy].filter(Boolean).join(" · ");
}

function buildTargetMeta(item) {
  return [item.symbol, buildMarketLabel(item.market)].filter(Boolean).join(" · ") || "실시간 연결 준비 중";
}

function getTargetBadgeLabel(item) {
  return item.market === "us-stock" ? "USD" : item.market === "crypto" ? "KRW" : "관심";
}

function buildLiveTimestampCopy(live) {
  if (!live?.updatedAt) {
    return "마지막 갱신 대기 중";
  }

  return `마지막 갱신 ${formatDateTime(live.updatedAt)}`;
}

function buildHoldingQuoteMarkup(quote, item) {
  const movementClass = getQuoteToneClass(quote);
  return `
    <span class="mini-value-stack">
      <strong class="mini-value ${movementClass}">${escapeHtml(formatQuotePrimary(quote, item))}</strong>
      <span class="mini-subvalue ${movementClass}">${escapeHtml(formatQuoteSecondary(quote, item))}</span>
    </span>
  `;
}

function buildTableQuoteMarkup(quote, item) {
  const movementClass = getQuoteToneClass(quote);
  return `
    <div class="table-price-stack">
      <strong class="table-price-primary ${movementClass}">${escapeHtml(formatQuotePrimary(quote, item))}</strong>
      <span class="table-price-secondary ${movementClass}">${escapeHtml(formatQuoteSecondary(quote, item))}</span>
    </div>
  `;
}

function buildTableFallbackMarkup() {
  return `
    <div class="table-price-stack">
      <strong class="table-price-primary">-</strong>
      <span class="table-price-secondary">실시간 대상 아님</span>
    </div>
  `;
}

function buildMarketLabel(market) {
  if (market === "crypto") {
    return "암호화폐";
  }
  if (market === "us-stock") {
    return "해외주식";
  }
  if (market === "kr-stock") {
    return "국내주식";
  }
  return "관심 종목";
}

function getQuoteToneClass(quote) {
  if (!quote?.available || !Number.isFinite(Number(quote.changePercent))) {
    return "price-move-neutral";
  }

  if (Number(quote.changePercent) > 0) {
    return "price-move-up";
  }

  if (Number(quote.changePercent) < 0) {
    return "price-move-down";
  }

  return "price-move-neutral";
}

function formatQuotePrimary(quote, instrument = {}) {
  if (!quote?.available) {
    return "연결 대기";
  }

  if (instrument.market === "us-stock" && Number.isFinite(Number(quote.priceUsd))) {
    return formatUsd(Number(quote.priceUsd));
  }

  if (Number.isFinite(Number(quote.priceKrw))) {
    return formatCurrency(Number(quote.priceKrw));
  }

  if (Number.isFinite(Number(quote.price))) {
    return instrument.currency === "USD" ? formatUsd(Number(quote.price)) : formatCurrency(Number(quote.price));
  }

  return "가격 없음";
}

function formatQuoteSecondary(quote, instrument = {}, options = {}) {
  if (!quote?.available) {
    return quote?.error || "실시간 연결 준비 중";
  }

  const parts = [];
  const includeKimchiPremium = Boolean(options.includeKimchiPremium && instrument.market === "crypto");

  if (instrument.market === "us-stock" && Number.isFinite(Number(quote.priceKrw))) {
    parts.push(`원화 ${formatCurrency(Number(quote.priceKrw))}`);
  }

  if (Number.isFinite(Number(quote.changePercent))) {
    parts.push(formatSignedPercent(Number(quote.changePercent)));
  }

  if (includeKimchiPremium && Number.isFinite(Number(quote.kimchiPremiumPercent))) {
    parts.push(`김프 ${formatSignedPercent(Number(quote.kimchiPremiumPercent))}`);
  }

  if (!parts.length && instrument.scope === "holding") {
    parts.push(`보유 ${formatNumber(instrument.quantity || 0)}`);
  }

  if (!parts.length) {
    parts.push(quote.isDelayed ? "업데이트 지연" : buildMarketLabel(instrument.market));
  }

  return parts.join(" · ");
}

function text(selector, value) {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = value ?? "";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function tableCell(label, value, className = "") {
  const normalizedClass = className.trim();
  const classAttribute = normalizedClass ? ` class="${normalizedClass}"` : "";
  return `<td data-label="${label}"${classAttribute}>${value}</td>`;
}

function formatCurrency(value) {
  return currencyFormatter.format(value || 0);
}

function formatUsd(value) {
  return usdFormatter.format(value || 0);
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

function formatSignedPercent(value) {
  const numeric = Number(value || 0);
  if (numeric > 0) {
    return `+${formatPercent(numeric)}`;
  }
  return formatPercent(numeric);
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

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "시간 정보 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function renderCurrentDateBadge(now = new Date()) {
  text("#basis-date", formatCurrentDateLabel(now));
}

function scheduleCurrentDateBadgeRefresh() {
  renderCurrentDateBadge();

  if (currentDateBadgeTimer) {
    window.clearTimeout(currentDateBadgeTimer);
  }

  const now = new Date();
  const nextRefreshAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  currentDateBadgeTimer = window.setTimeout(scheduleCurrentDateBadgeRefresh, nextRefreshAt.getTime() - now.getTime());
}

function formatCurrentDateLabel(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function formatCurrentMonthDay(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getMonth() + 1}/${String(date.getDate()).padStart(2, "0")}`;
}

function getCurrentBasisYear(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
}

function getSignedPriceToneClass(value) {
  const numeric = Number(value || 0);
  if (numeric > 0) {
    return "price-move-up";
  }
  if (numeric < 0) {
    return "price-move-down";
  }
  return "price-move-neutral";
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

// 거래 추가 모달 관리
function initTradeModal() {
  const BROKER_OPTIONS_BY_MARKET = {
    국내주식: ["카카오증권", "미래에셋"],
    미국주식: ["카카오증권", "미래에셋"],
    암호화폐: ["업비트"],
  };
  const ESTIMATED_FEE_RATES = {
    암호화폐: {
      업비트: 0.0005,
    },
    국내주식: {
      카카오증권: 0.00015,
      미래에셋: 0.00014,
    },
    미국주식: {
      카카오증권: 0.001,
      미래에셋: 0.0025,
    },
  };

  const modal = document.querySelector("#trade-modal");
  const openBtn = document.querySelector("#btn-add-trade");
  const form = document.querySelector("#trade-form");
  const tradeDateInput = document.querySelector("#trade-date");
  const marketSelect = document.querySelector("#trade-market");
  const assetInput = document.querySelector("#trade-asset");
  const brokerInput = document.querySelector("#trade-broker");
  const brokerGroup = document.querySelector("[data-trade-broker-group]");
  const brokerHelp = document.querySelector("#trade-broker-help");
  const priceLabel = document.querySelector("#trade-price-label");
  const priceHelp = document.querySelector("#trade-price-help");
  const quantityInput = document.querySelector("#trade-quantity");
  const priceInput = document.querySelector("#trade-price");
  const amountInput = document.querySelector("#trade-amount");
  const sideSelect = document.querySelector("#trade-side");
  const feeInput = document.querySelector("#trade-fee");
  const summaryBroker = document.querySelector("#trade-summary-broker");
  const summaryAmount = document.querySelector("#trade-summary-amount");
  const summaryFee = document.querySelector("#trade-summary-fee");
  const assetChips = [...document.querySelectorAll("[data-asset-chip]")];
  const status = document.querySelector("#trade-form-status");
  const submitButton = form?.querySelector(".btn-primary");
  const cancelButton = form?.querySelector(".btn-secondary");

  if (!modal || !openBtn || !form) {
    console.error("거래 추가 모달 요소를 찾을 수 없습니다");
    return;
  }

  const setStatus = (message = "", tone = "neutral") => {
    if (!status) {
      return;
    }

    status.textContent = message;
    status.dataset.tone = tone;
  };

  const setSubmitting = (isSubmitting) => {
    if (submitButton) {
      submitButton.disabled = isSubmitting;
      submitButton.textContent = isSubmitting ? "저장 중..." : "저장";
    }
    if (cancelButton) {
      cancelButton.disabled = isSubmitting;
    }
  };

  const parseBasisMonthDay = () => {
    return formatCurrentMonthDay();
  };

  const formatEditableNumber = (value, decimals = 8) => {
    if (!value) {
      return "";
    }

    return Number(value.toFixed(decimals)).toString();
  };

  const normalizeTradeAssetName = (value, market) => {
    const raw = String(value || "").trim();
    const upper = raw.toUpperCase();

    if (market === "암호화폐") {
      if (["BTC", "비트코인", "비트코인(BTC)"].includes(raw) || upper === "BTC") {
        return "비트코인";
      }
      if (["ETH", "이더리움", "이더리움(ETH)"].includes(raw) || upper === "ETH") {
        return "ETH";
      }
      if (["XRP", "엑스알피", "엑스알피(XRP)"].includes(raw) || upper === "XRP") {
        return "XRP";
      }
    }

    if (market === "미국주식") {
      if (["PLTR", "팔란티어"].includes(raw) || upper === "PLTR") {
        return "팔란티어";
      }
      if (["CRCL", "써클"].includes(raw) || upper === "CRCL") {
        return "써클";
      }
    }

    if (market === "국내주식" && raw === "에스케이하이닉스") {
      return "SK하이닉스";
    }

    return raw;
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

  const getActiveBroker = () => {
    return marketSelect.value === "암호화폐" ? "업비트" : String(brokerInput?.value || "").trim();
  };

  const getEstimatedFeeRate = (broker, market) => {
    return ESTIMATED_FEE_RATES?.[market]?.[broker] ?? null;
  };

  const syncTradeSummary = () => {
    if (summaryBroker) {
      summaryBroker.textContent = getActiveBroker() || "입력 필요";
    }
    if (summaryAmount) {
      summaryAmount.textContent = amountInput.value ? formatCurrency(Number(amountInput.value)) : "자동 계산";
    }
    if (summaryFee) {
      summaryFee.textContent = feeInput.value ? formatCurrency(Number(feeInput.value)) : "자동 계산";
    }
  };

  const syncAssetChipState = () => {
    const market = marketSelect.value;
    const asset = normalizeTradeAssetName(assetInput?.value || "", market).toUpperCase();
    assetChips.forEach((chip) => {
      const chipMarket = chip.dataset.market || "";
      const chipAsset = normalizeTradeAssetName(chip.dataset.asset || chip.dataset.displayAsset || "", chipMarket).toUpperCase();
      chip.hidden = chipMarket !== market;
      chip.classList.toggle("is-active", chipMarket === market && chipAsset === asset);
    });
  };

  const calculateFee = () => {
    const broker = getActiveBroker();
    const market = marketSelect.value;
    const side = sideSelect.value;
    const amount = parseFloat(amountInput.value) || 0;

    if (!broker || !side || !amount) {
      feeInput.value = "";
      syncTradeSummary();
      return;
    }

    const brokerageRate = getEstimatedFeeRate(broker, market);
    if (brokerageRate == null) {
      feeInput.value = "";
      syncTradeSummary();
      return;
    }

    let fee = amount * brokerageRate;

    if (market === "국내주식" && side === "매도") {
      fee += amount * 0.002;
    }

    feeInput.value = fee ? formatEditableNumber(fee, 8) : "";
    syncTradeSummary();
  };

  const calculateAmount = () => {
    const quantity = parseFormattedNumber(quantityInput.value);
    const price = parseFormattedNumber(priceInput.value);
    const amount = quantity * price;
    amountInput.value = amount ? formatEditableNumber(amount) : "";
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
          ? "삼성전자 / SK하이닉스"
          : market === "미국주식"
            ? "팔란티어 / 써클 / 애플"
            : "비트코인 / 이더리움 / 엑스알피";
    }

    if (priceLabel) {
      priceLabel.textContent = isUsStock ? "단가 (원화 기준)" : "단가 (원)";
    }

    if (priceInput) {
      priceInput.placeholder = isUsStock ? "35,000" : isCrypto ? "2,000" : "1,001,000";
    }

    if (priceHelp) {
      priceHelp.textContent = isUsStock
        ? "미국주식은 원화 환산 체결단가 기준으로 입력합니다."
        : isCrypto
          ? "업비트 체결 단가 기준으로 입력합니다."
          : "체결 단가 기준으로 입력합니다.";
    }

    if (brokerHelp) {
      brokerHelp.textContent = isUsStock
        ? "카카오증권 0.10%, 미래에셋 0.25% 기준으로 계산하며 미국 현지 제비용은 별도입니다."
        : "카카오증권 0.015%, 미래에셋 0.014% 기준이며 국내주식 매도 시 세금 0.20%를 더합니다.";
    }

    syncAssetChipState();
    calculateAmount();
  };

  const resetFormState = () => {
    form.reset();
    amountInput.value = "";
    feeInput.value = "";
    marketSelect.value = "암호화폐";
    sideSelect.value = "매수";
    tradeDateInput.value = parseBasisMonthDay();
    syncTradeFormMode();
  };

  // 모달 열기
  const openModal = () => {
    setStatus("");
    setSubmitting(false);
    resetFormState();
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("is-open");
    document.body.classList.add("modal-open");
    assetInput?.focus();
  };

  openBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openModal();
  });

  // 모달 닫기
  const closeModal = () => {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("is-open");
    document.body.classList.remove("modal-open");
    setStatus("");
    setSubmitting(false);
    resetFormState();
  };

  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-trade-modal-close]") || e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });

  const persistTrade = async (tradeData) => {
    if (window.location.protocol === "file:") {
      throw new Error("거래 저장은 로컬 서버에서만 가능합니다. `node scripts/dev-server.js` 실행 후 접속하세요.");
    }

    const response = await fetch("./api/trades", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tradeData),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || "거래 저장에 실패했습니다.");
    }

    return payload;
  };

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
  brokerInput?.addEventListener("change", calculateFee);
  sideSelect.addEventListener("change", calculateFee);
  marketSelect.addEventListener("change", syncTradeFormMode);
  assetInput?.addEventListener("input", syncAssetChipState);
  assetChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      marketSelect.value = chip.dataset.market || "암호화폐";
      assetInput.value = chip.dataset.displayAsset || chip.dataset.asset || "";
      syncTradeFormMode();
      calculateAmount();
    });
  });
  resetFormState();

  // 폼 제출
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("");

    const formData = new FormData(form);
    const tradeData = {
      date: formData.get("date"),
      market: formData.get("market"),
      broker: getActiveBroker(),
      asset: normalizeTradeAssetName(formData.get("asset"), formData.get("market")),
      side: formData.get("side"),
      quantity: parseFormattedNumber(formData.get("quantity")),
      price: parseFormattedNumber(formData.get("price")),
      amount: parseFloat(amountInput.value),
      fee: parseFloat(feeInput.value),
      note: formData.get("note") || "",
    };

    try {
      setSubmitting(true);
      const updatedPortfolio = await persistTrade(tradeData);
      livePortfolioSnapshot = null;
      applyPortfolioData(updatedPortfolio, null, { renderMode: "full" });
      closeModal();
      await refreshLivePortfolio();
    } catch (error) {
      console.error(error);
      setStatus(error.message || "거래 저장에 실패했습니다.", "error");
      setSubmitting(false);
    }
  });
}
