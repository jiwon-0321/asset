---
name: asset-market-close-policy
description: Enforce market-session data policy for holdings and return displays. Use when implementing or debugging US stock quote timing, market-open detection, close-price fallback rules, realtime badge wording, refresh intervals, or user-reported mismatches between displayed returns and previous regular-session close values.
---

# Asset Market Close Policy

Apply these rules whenever quote-to-portfolio mapping can affect user trust.
Prioritize correctness over apparent freshness.

## Policy Rules

### 1. US Equities Session Rule

- Use intraday quotes only during regular session (09:30-16:00 America/New_York).
- Outside regular session, use previous regular-session close as the primary reference.
- Treat weekends and market holidays as closed session.

### 2. Metric Semantics Rule

- Distinguish `전일대비` from `보유수익률`.
- `전일대비`: compare quote to previous close.
- `보유수익률`: compare quote to weighted average buy price.
- Never present one metric as the other.

### 3. Badge and Label Rule

- During regular session: allow `실시간` (or near-realtime) label.
- Outside session: show `장 마감 종가` label.
- If provider is stale/unavailable: show degraded label instead of misleading realtime label.

## Quote Resolution Priority

### Closed Session (US Equities)

Resolve quote in this order:
1. `close`
2. `previous_close`
3. `price` (only as final fallback)

### Open Session (US Equities)

Resolve quote in this order:
1. `price`
2. `close`
3. `previous_close`

## Refresh Cadence Rule

- Use shorter refresh cadence when session is open.
- Use longer refresh cadence when session is closed (e.g., daily refresh class), unless user explicitly asks for post-market tracking.
- Keep cadence decision in API payload so UI and backend stay consistent.

## Null-Safety Rule

- Guard all reads from provider objects and nested quote items.
- Skip malformed entries gracefully and continue rendering other assets.
- Never throw client-crashing errors from one broken quote (`item.market`, `item.price`, etc.).

## Verification Checklist

1. Verify `/api/live-prices` reports session state and cadence as expected.
2. Verify off-hours US stock badge text is `장 마감 종가`.
3. Compare one known symbol against previous close and ensure `전일대비` math is correct.
4. Verify `보유수익률` remains based on user buy price, not previous close.
5. Verify no null-object exception appears when a single quote entry is malformed.

## Primary File Targets

- `/Users/jojiwon/vibecording/asset-main/lib/live-price-service.js`
- `/Users/jojiwon/vibecording/asset-main/app.js`
- `/Users/jojiwon/vibecording/asset-main/lib/server-state-store.js`

Use explicit absolute dates in explanations when users confuse "today/yesterday/closed market" context.
