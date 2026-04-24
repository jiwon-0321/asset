---
name: asset-verify-implementation
description: Run a focused verification pass for asset after implementation work. Use after meaningful changes to app.js, client files, styles, api routes, lib services, persistence, or before shipping.
---

# Asset Verify Implementation

Use this skill for a compact, project-aware verification pass on `asset`.

## Goal

Confirm that recent Asset changes are safe to ship by:

1. identifying the changed scope
2. loading only the relevant Asset skills
3. checking the affected flow end-to-end
4. reporting concrete findings or coverage gaps

## When To Use

- After implementing a feature or bug fix in `asset`
- Before committing or deploying a risky change
- During review of changes touching UI, storage, quotes, portfolio math, or session logic

## Workflow

### 1. Capture the scope

- Inspect `git status --short`, `git diff --name-only`, and `git diff --stat`.
- Group changed files into one or more domains:
  - `incident`: API shape, provider or storage failures, null guards, cache or deploy regressions
  - `frontend`: `app.js`, `client/*.js`, `styles/*.css`, `index.html`, mobile UI, modal flows, photo-assist UI
  - `market-close`: session detection, close-price fallback, realtime labels, U.S. stock timing
  - `cash-reconcile`: cash balance, total asset drift, realized vs unrealized separation
  - `docs-handoff`: local planning notes, local handoff notes, and active docs

### 2. Load only the relevant Asset skills

- If the change matches `incident`, read `skills/asset-incident-response/SKILL.md`.
- If the change matches `market-close`, read `skills/asset-market-close-policy/SKILL.md`.
- If the change matches `cash-reconcile`, read `skills/asset-cash-reconcile/SKILL.md`.
- If the change is `frontend` or `docs-handoff` and there is no dedicated downstream skill, continue with the built-in checks below and report a `GAP` only if the workflow is repeatedly under-covered.

### 3. Run targeted checks

- Reproduce the affected flow locally first.
- Prefer narrow checks over broad test runs.
- Verify only the touched UI, endpoint, or calculation path.
- If a loaded Asset skill is stricter, follow that workflow.

Baseline checks by domain:

- `incident`: check `/api/storage-health`, `/api/portfolio`, and `/api/live-prices` locally first; verify deployed endpoints too if provider or endpoint behavior changed and a deployed environment exists.
- `frontend`: run `node --check` on touched JS files, run `npm run smoke` when relevant, and do one browser load or targeted UI pass for the changed surface.
- `docs-handoff`: confirm the local plan, local latest handoff, the current daily summary, and active docs are aligned with the current shipped state and next step.

### 4. Classify the result

- `PASS`: no issue found in the checked scope
- `FAIL`: a concrete bug, regression risk, or missing guard was found
- `GAP`: the change is real, but no existing Asset skill covers it well enough

### 5. Respond

- If the user asked for implementation help, fix `FAIL` items and re-check.
- If the user asked for review only, report findings first and do not silently edit code.
- If you hit a `GAP`, recommend creating or updating a dedicated Asset skill.

## Asset Skill Map

| Domain | Trigger examples | Skill |
|------|------|------|
| Incident response | API parsing, provider mismatch, stale payloads, null crashes, deploy regressions | `asset-incident-response` |
| Frontend | mobile UI, client split, CSS refactor, modal behavior, photo-assist UI | built-in checks in this skill |
| Market close policy | U.S. equities close logic, realtime labels, quote freshness, session timing | `asset-market-close-policy` |
| Cash reconcile | cash balance, total asset mismatch, realized P/L separation | `asset-cash-reconcile` |
| Docs handoff | local planning notes, local handoff notes, active implementation notes | built-in checks in this skill |

## Output Format

- `Scope:` checked files and flow
- `Skills Used:` Asset skills actually read
- `Result:` PASS / FAIL / GAP
- `Findings:` short file-based issues or `none`
- `Next:` fix, re-check, or create/update a skill

## Guardrails

- Ask the user before making broad changes that touch many files or significantly reshape the project.
- Prefer modular code changes instead of placing too much new logic in one file.
- If the request is ambiguous, restate your understanding first and wait for confirmation before acting.
- Do not claim full-project verification when only one domain was checked.
- Do not invent coverage from a skill that was not actually read.
- If browser verification or deployed-endpoint checks were skipped, say so plainly.
- Prefer one clear gap note over false confidence.
- Keep the report short.
