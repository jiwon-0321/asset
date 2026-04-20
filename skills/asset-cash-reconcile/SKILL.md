---
name: asset-cash-reconcile
description: Reconcile portfolio cash and total-asset values from user-provided snapshots without full household bookkeeping. Use when users provide current cash/예수금 values, report mismatched total assets, ask where living expenses should be reflected, or need clear rules for manual cash correction and realized-vs-unrealized P/L separation.
---

# Asset Cash Reconcile

Use this skill to keep portfolio figures consistent when cash is corrected manually.
Treat user-provided current cash as the source of truth.

## Core Rules

### 1. Source of Truth Rule

- Use latest user-provided `현금/예수금` snapshot as authoritative cash value.
- Do not reconstruct living expense history if user does not want bookkeeping.
- Assume expenses are already netted into the reported cash snapshot.

### 2. Total Asset Rule

- Recalculate total assets from components after cash correction.
- Avoid separate "expense deduction" logic if corrected cash was already applied.

### 3. Realized P/L Scope Rule

- Include only truly realized trades in realized P/L cards.
- Exclude strategy-internal defensive indicators from realized P/L if they are not actual settled trade profit.
- Keep XRP defensive low-price rebuy cumulative indicator out of realized P/L when it is only a strategy metric.

## Reconciliation Workflow

1. Receive snapshot with timestamp:
   - example fields: `cash`, `deposit`, `totalAsset` (optional), `note`.
2. Parse all numeric values strictly and reject `NaN`.
3. Write corrected cash/deposit to portfolio state.
4. Recalculate totals and derived cards.
5. Return a short diff report:
   - before cash
   - after cash
   - total asset delta
   - unresolved mismatch (if any)

## Safety Checks

- Prevent double counting:
  - Do not apply manual cash correction and synthetic expense deduction together.
- Preserve auditability:
  - Keep last manual cash correction timestamp and memo.
- Handle missing fields safely:
  - If only one of `현금` or `예수금` is provided, update only that field.

## User Communication Pattern

- Explain in plain Korean:
  - `현재 현금값을 기준으로 맞췄고, 생활비는 별도 차감하지 않았습니다.`
- Show one-line rule reminder:
  - `다음에도 현재 현금 스냅샷만 주시면 같은 방식으로 맞춥니다.`

## Primary File Targets

- `lib/persisted-portfolio-service.js`
- `lib/server-state-store.js`
- `app.js`

Ask only one clarification question when a reconciliation is blocked by missing essential numbers.
