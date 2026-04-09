# Sniper Capital Board -- Project Plan & Development Roadmap

## 1. Project Status Analysis

### 1.1 Architecture Overview

The project is a personal investment portfolio dashboard called "Sniper Capital Board." It is structured as a single-page application (SPA) with the following architecture:

```
Data Layer:     Excel Workbook --> Python (export_workbook.py) --> portfolio.json
                                                              --> portfolio-data.js (inline)
Server Layer:   dev-server.js (Node.js HTTP)
                ├── Static file serving
                └── POST /api/trades --> portfolio-store.js
Frontend:       index.html + app.js + styles.css (vanilla JS, no framework)
Cloud (unused): Firebase config + upload_to_firestore.py (prepared but not integrated)
```

**Key files and their roles:**
- `/Users/jojiwon/vibecording/new asset/scripts/export_workbook.py` -- Reads Excel workbook and produces `portfolio.json` + `portfolio-data.js`
- `/Users/jojiwon/vibecording/new asset/scripts/portfolio-store.js` -- Server-side trade persistence logic (718 lines). Handles trade validation, holdings recalculation, cash position updates, XRP defense metrics
- `/Users/jojiwon/vibecording/new asset/scripts/dev-server.js` -- Minimal Node.js HTTP server for static files + API endpoints
- `/Users/jojiwon/vibecording/new asset/app.js` -- Frontend rendering engine (1,646 lines). Renders all dashboard sections: metrics, allocation chart, asset table, holdings, realized P&L, defense metrics, timeline (list + calendar), strategy, trade modal
- `/Users/jojiwon/vibecording/new asset/styles.css` -- Complete styling (2,837 lines) with dark theme, responsive breakpoints, animations
- `/Users/jojiwon/vibecording/new asset/index.html` -- HTML shell with accordion sections, trade modal, calendar detail modal

### 1.2 Completed Features

1. **Dashboard Overview** -- 6 metric cards (initial investment, total assets, P&L vs initial, unrealized P&L, cash position, realized P&L)
2. **Asset Allocation** -- SVG donut chart with legend (crypto / domestic stocks / cash)
3. **Platform Status Table** -- Responsive table showing valuation, principal, P&L, return rate per platform
4. **Performance Charts** -- Chart.js bar chart for return comparison + combo bar/line chart for realized P&L history with cumulative line
5. **Holdings Detail** -- Card grid for active positions with quantity, average price, valuation, return rate
6. **Realized P&L List** -- Chronological list of all realized trades with profit/loss amounts
7. **XRP Defense Metrics** -- 6 defense-trading KPIs (final avg price, avg price reduction, defense gain, etc.)
8. **Trade Timeline** -- Dual view (list + calendar) with grouped transactions by date
9. **Calendar View** -- Month-based calendar grid with daily P&L color coding, detail modal on click
10. **Strategy Playbook** -- Phase 1 strategy with entry steps, exit rules, daily checklist
11. **Live Trade Addition** -- Modal form with auto-calculation of amount/fee, server-side persistence via `POST /api/trades`, full portfolio recalculation on trade add
12. **Accordion UI** -- All sections collapse/expand with smooth CSS grid animation
13. **Scroll Reveal** -- IntersectionObserver-based scroll animations with staggered delays
14. **Mobile Responsive** -- 5 breakpoints (1160px, 1040px, 960px, 760px, 560px) with table-to-card transformation
15. **Price Strip** -- Live price display for held assets in hero section

### 1.3 Identified Issues and Incomplete Areas

**Security Issues (Critical):**
- `firebase-config.js` (line 8) contains hardcoded Firebase API key `AIzaSyCl_QUgBnBN2fyAoZaKIhrqm5tHE1rdYwA` in plain text, committed to git despite being in `.gitignore`
- `asset-309ef-firebase-adminsdk-fbsvc-0b0c40090d.json` (Firebase admin SDK key) is in the project root and tracked by git
- `.claude/settings.local.json` contains an older version of `portfolio.json` embedded in a Bash permission rule

**Dead/Broken Code:**
- `app.js.broken` and `index.html.broken` -- leftover broken versions from debugging, serve no purpose
- `firebase-config.js` is imported nowhere and uses ES module `import` syntax incompatible with the current script loading strategy (non-module `<script>` tags)
- `scripts/upload_to_firestore.py` exists but Firebase is not integrated into the dashboard at all
- The `workbook` reference in metadata says `투자현황_4월9일.xlsx` but `export_workbook.py` hardcodes `투자현황_4월7일.xlsx` (line 14), meaning the Python script filename is stale

**Data Integrity:**
- `data/portfolio.json.backup` is untracked, indicating manual backup was needed at some point. No automated backup mechanism exists
- The dev-server writes directly to `portfolio.json` on every trade add -- no versioning, no undo capability
- `portfolio-data.js` and `portfolio.json` can drift apart if only one is updated

**Code Quality:**
- `app.js` is a monolithic 1,646-line file with no module separation. All rendering, event binding, formatting, and state management live in one file
- No test suite exists for `portfolio-store.js` despite it containing complex financial calculations
- No `package.json` -- no dependency management, no scripts, no linting configuration
- No TypeScript, no JSDoc annotations -- all data structures are implicit
- CSS is a single 2,837-line file with no custom properties for spacing/sizing (only colors)

**Missing Functionality:**
- No authentication or access control -- anyone on the network can add trades
- No trade deletion or editing -- once added, trades cannot be corrected
- No real-time price fetching -- prices are manually entered or static from Excel
- No data export feature (CSV, PDF report)
- No multi-year support -- all dates assume a single year
- No error boundary or graceful degradation if Chart.js fails to load

---

## 2. Short-term Goals (1-2 Weeks)

### 2.1 [P0] Security Remediation
**Objective:** Remove all credentials from the repository and prevent future credential leaks.

**Implementation steps:**
1. Remove `asset-309ef-firebase-adminsdk-fbsvc-0b0c40090d.json` from the repository using `git rm`
2. Remove `firebase-config.js` from the repository (it is not used)
3. Add these patterns to `.gitignore` (some already there but files were committed before):
   - `asset-*-firebase-adminsdk-*.json`
   - `firebase-config.js`
4. Rotate the Firebase API key through the Firebase Console since it has been exposed in git history
5. Clean `.claude/settings.local.json` to remove the embedded JSON data blob from the permissions array
6. Consider using `git filter-repo` or BFG Repo Cleaner to purge sensitive data from git history if this repo is ever made public

**Files to modify:**
- `/Users/jojiwon/vibecording/new asset/.gitignore` -- Verify patterns
- Delete `/Users/jojiwon/vibecording/new asset/firebase-config.js`
- Delete `/Users/jojiwon/vibecording/new asset/asset-309ef-firebase-adminsdk-fbsvc-0b0c40090d.json`

### 2.2 [P0] Clean Up Dead Code
**Objective:** Remove artifacts that cause confusion and increase maintenance burden.

**Implementation steps:**
1. Delete `app.js.broken` and `index.html.broken`
2. Fix `export_workbook.py` line 14 to match the current workbook filename or make it configurable via command-line argument
3. Either remove the Firebase upload script or document it clearly as "future work"

**Files to modify:**
- Delete `/Users/jojiwon/vibecording/new asset/app.js.broken`
- Delete `/Users/jojiwon/vibecording/new asset/index.html.broken`
- `/Users/jojiwon/vibecording/new asset/scripts/export_workbook.py` -- Update `WORKBOOK_FILENAME` or accept CLI arg

### 2.3 [P1] Add package.json and Project Tooling
**Objective:** Establish proper project infrastructure.

**Implementation steps:**
1. Create `package.json` with project metadata, `scripts` for `dev`, `export`, `lint`
2. Add `"type": "commonjs"` (since dev-server.js uses `require`)
3. Define scripts:
   - `"dev": "node scripts/dev-server.js"`
   - `"export": "python3 scripts/export_workbook.py"`
4. Optionally add ESLint + Prettier for code consistency
5. Update `README.md` with proper setup instructions (prerequisites: Node.js, Python 3, openpyxl)

**New file:** `package.json` in project root

### 2.4 [P1] Trade Edit and Delete Functionality
**Objective:** Allow correction of erroneously added trades.

**Implementation steps:**
1. In `portfolio-store.js`, add `deleteTrade(rootDir, tradeIndex, tradeType)` function that:
   - Loads portfolio
   - Removes the trade at the specified index from `trades.stocks` or `trades.crypto`
   - Replays all remaining trades from scratch against the initial Excel-exported state to recalculate holdings, realized P&L, etc.
   - Saves the updated portfolio
2. In `dev-server.js`, add `DELETE /api/trades/:type/:index` endpoint
3. In `app.js`, add a delete button to each trade item in the timeline with a confirmation dialog
4. In `styles.css`, add styles for the delete button and confirmation overlay

**Files to modify:**
- `/Users/jojiwon/vibecording/new asset/scripts/portfolio-store.js` -- Add `deleteTrade`, `editTrade`
- `/Users/jojiwon/vibecording/new asset/scripts/dev-server.js` -- Add DELETE and PUT routes
- `/Users/jojiwon/vibecording/new asset/app.js` -- Add delete/edit UI in timeline items
- `/Users/jojiwon/vibecording/new asset/styles.css` -- Styles for new UI elements

### 2.5 [P1] Automated Data Backup
**Objective:** Prevent data loss from accidental overwrites.

**Implementation steps:**
1. In `portfolio-store.js` `savePortfolio()` function (line 693), before writing the new file:
   - Copy current `portfolio.json` to `data/backups/portfolio-{timestamp}.json`
   - Keep only the last 10 backups (delete older ones)
2. Add `data/backups/` to `.gitignore`

**Files to modify:**
- `/Users/jojiwon/vibecording/new asset/scripts/portfolio-store.js` -- Modify `savePortfolio()`
- `/Users/jojiwon/vibecording/new asset/.gitignore` -- Add `data/backups/`

---

## 3. Mid-term Goals (1 Month)

### 3.1 [P1] Modularize Frontend Code
**Objective:** Break the monolithic `app.js` into maintainable modules.

**Implementation plan:**
```
app/
  main.js              -- Entry point, data loading, initialization
  formatters.js        -- Currency, percent, number formatting functions (lines 1366-1422)
  render-metrics.js    -- renderMetricCards, renderPriceStrip
  render-allocation.js -- renderAllocation (donut chart)
  render-charts.js     -- renderCharts, readChartTheme, destroyCharts
  render-table.js      -- renderAssetTable
  render-holdings.js   -- renderHoldings
  render-realized.js   -- renderRealized
  render-defense.js    -- renderDefense
  render-timeline.js   -- All timeline/calendar functions (lines 671-1255)
  render-strategy.js   -- renderStrategy
  trade-modal.js       -- initTradeModal and all modal logic (lines 1424-1645)
  accordion.js         -- bindPanelAccordion, toggleDisclosure
  motion.js            -- initializeMotion (scroll reveal)
```

Since no build tool exists, use `<script type="module">` with ES module imports. Alternatively, introduce a simple bundler like esbuild.

**Files to modify:**
- `/Users/jojiwon/vibecording/new asset/app.js` -- Split into modules
- `/Users/jojiwon/vibecording/new asset/index.html` -- Update script tags

### 3.2 [P2] Real-time Price Integration
**Objective:** Fetch live prices instead of relying on static Excel data.

**Implementation steps:**
1. Create `scripts/price-fetcher.js` that fetches prices from public APIs:
   - Korean stocks: Use KRX or Naver Finance API
   - Crypto (XRP, ETH): Use Upbit public API (`https://api.upbit.com/v1/ticker?markets=KRW-XRP,KRW-ETH`)
2. Add a `GET /api/prices` endpoint in `dev-server.js` that calls these APIs
3. In the frontend, poll `/api/prices` every 60 seconds and update:
   - Price strip in hero section
   - Holdings valuations
   - Summary metrics
4. Add visual indicators (arrows, color flash) when prices change

**New files:**
- `scripts/price-fetcher.js`

**Files to modify:**
- `/Users/jojiwon/vibecording/new asset/scripts/dev-server.js` -- Add price endpoint
- `/Users/jojiwon/vibecording/new asset/app.js` -- Add polling and live update logic

### 3.3 [P2] Data Export Features
**Objective:** Enable users to export portfolio data for external analysis.

**Implementation steps:**
1. Add "Export CSV" button to the timeline section header
2. Implement client-side CSV generation from trade data
3. Add "Export Summary PDF" using `html2canvas` + `jsPDF` or a server-side approach
4. Add download triggers using Blob + URL.createObjectURL

**Files to modify:**
- `/Users/jojiwon/vibecording/new asset/app.js` -- Export logic
- `/Users/jojiwon/vibecording/new asset/index.html` -- Export buttons
- `/Users/jojiwon/vibecording/new asset/styles.css` -- Button styles

### 3.4 [P2] Test Suite for Portfolio Store
**Objective:** Ensure financial calculation correctness with automated tests.

**Implementation steps:**
1. Add `vitest` or `jest` as a dev dependency
2. Create `tests/portfolio-store.test.js` covering:
   - `normalizeTradeInput` -- Validation edge cases
   - `applyTradeToHoldings` -- Buy/sell with average price recalculation
   - `applyTradeToCashPositions` -- Cash balance updates
   - `rebuildSummary` -- Totals and ratios
   - `buildChartData` -- Chart data generation
   - `updateXrpDefense` -- XRP defense metric calculations
3. Create `tests/fixtures/` with sample portfolio data for deterministic testing

**New files:**
- `tests/portfolio-store.test.js`
- `tests/fixtures/sample-portfolio.json`
- `package.json` -- Add test script and vitest dependency

### 3.5 [P2] Improved Error Handling
**Objective:** Prevent silent failures and provide user-friendly error messages.

**Implementation steps:**
1. In `app.js`, wrap `loadPortfolio()` with retry logic (currently shows a blank error page)
2. Add toast notification system for trade add success/failure instead of console errors
3. In `dev-server.js`, add request logging and structured error responses
4. In `portfolio-store.js`, add validation for portfolio data schema before saving

---

## 4. Long-term Goals (3+ Months)

### 4.1 [P2] Firebase Integration for Cloud Sync
**Objective:** Enable cross-device access and cloud backup.

**Implementation plan:**
1. Decide between:
   - Option A: Keep the local dev-server + JSON approach as primary, add Firebase as sync layer
   - Option B: Migrate entirely to Firebase (Firestore) as the data backend
2. Implement Firebase Authentication (Google sign-in) for access control
3. Migrate the existing `upload_to_firestore.py` approach to a bidirectional sync:
   - On trade add: Write to both local JSON and Firestore
   - On page load: Fetch from Firestore if local is stale
4. Deploy the frontend to Firebase Hosting

**Files to modify:**
- `/Users/jojiwon/vibecording/new asset/firebase-config.js` -- Rebuild with proper environment variable handling
- `/Users/jojiwon/vibecording/new asset/scripts/upload_to_firestore.py` -- Expand to bidirectional sync
- `/Users/jojiwon/vibecording/new asset/app.js` -- Add Firebase SDK initialization

### 4.2 [P3] Multi-period Analysis
**Objective:** Support historical comparison across weeks and months.

**Implementation steps:**
1. Store daily portfolio snapshots in `data/snapshots/{date}.json`
2. Create a "Performance Over Time" chart showing total asset value trajectory
3. Add period selector (1W, 1M, 3M, YTD) for all charts
4. Calculate period-specific metrics (Sharpe ratio, max drawdown, win rate)

### 4.3 [P3] Alert System
**Objective:** Notify when strategy exit conditions are met.

**Implementation steps:**
1. Define alert rules based on strategy playbook (e.g., XRP hits +3% from average price)
2. Check alerts on each price update
3. Display alert banners on the dashboard
4. Optionally integrate web push notifications or Telegram bot

### 4.4 [P3] PWA (Progressive Web App)
**Objective:** Enable mobile app-like experience.

**Implementation steps:**
1. Add `manifest.json` with app name, icons, theme color
2. Create a Service Worker for offline caching of the dashboard
3. Pre-cache Chart.js, fonts, and static assets
4. Add "Add to Home Screen" prompt

### 4.5 [P3] Strategy Phase 2 Support
**Objective:** Extend the strategy system beyond Phase 1.

**Implementation steps:**
1. Add strategy phase selector in the strategy section
2. Support multiple strategy sheets in the Excel workbook
3. Track which strategy phase is active and show relevant rules
4. Add strategy performance metrics (actual trades vs planned triggers)

---

## 5. Priority Matrix Summary

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| P0 | Security remediation | 1-2 hours | Critical |
| P0 | Clean up dead code | 30 minutes | High |
| P1 | Add package.json + tooling | 1-2 hours | High |
| P1 | Trade edit/delete | 1-2 days | High |
| P1 | Automated data backup | 2-3 hours | High |
| P1 | Modularize frontend | 2-3 days | Medium |
| P2 | Real-time price integration | 2-3 days | High |
| P2 | Data export (CSV/PDF) | 1-2 days | Medium |
| P2 | Test suite | 2-3 days | High |
| P2 | Improved error handling | 1 day | Medium |
| P2 | Firebase cloud sync | 1-2 weeks | Medium |
| P3 | Multi-period analysis | 1-2 weeks | Medium |
| P3 | Alert system | 1 week | Medium |
| P3 | PWA conversion | 2-3 days | Low |
| P3 | Strategy Phase 2 | 1 week | Low |

---

## Critical Files for Implementation
- `/Users/jojiwon/vibecording/new asset/app.js` - Core frontend rendering engine (1,646 lines), needs modularization, trade edit/delete UI, live price updates, export features
- `/Users/jojiwon/vibecording/new asset/scripts/portfolio-store.js` - Server-side trade logic (718 lines), needs trade delete/edit, backup mechanism, and test coverage
- `/Users/jojiwon/vibecording/new asset/scripts/dev-server.js` - HTTP server (145 lines), needs new API endpoints (DELETE, PUT trades, GET prices)
- `/Users/jojiwon/vibecording/new asset/index.html` - HTML shell (563 lines), needs new UI elements for trade actions, export buttons, and module script migration
- `/Users/jojiwon/vibecording/new asset/scripts/export_workbook.py` - Excel parser (583 lines), needs filename fix and potential CLI argument support
