---
name: asset-incident-response
description: Stabilize and recover the Asset portfolio web service during incidents. Use when users report data load failures, null-object crashes, missing quotes, wrong return calculations, storage/provider mismatches, Vercel deployment regressions, or intermittent outages that must be triaged and fixed quickly with minimal blast radius.
---

# Asset Incident Response

Execute this playbook to diagnose and recover production incidents safely.
Keep user communication short, factual, and timestamped.

## Hard Guardrails

- Reproduce first, then patch. Do not guess root cause from screenshots alone.
- Use the smallest safe change that removes crash risk and preserves existing behavior.
- Prefer fail-soft behavior for UI rendering and API parsing.
- Never remove existing user data or run destructive commands.
- Always verify both local and production endpoints after a fix.

## Incident Workflow

### 1. Capture Symptom Snapshot

- Record exact timestamp, visible error text, failing page, and whether issue is global or account-specific.
- Save one screenshot and one API error sample when available.

### 2. Check Health Endpoints in Order

- Check `/api/storage-health` to confirm selected provider, config, and fetch/persist status.
- Check `/api/portfolio` for schema integrity and missing required fields.
- Check `/api/live-prices` for quote nulls, stale data, and provider errors.

### 3. Classify Failure Type

- Classify as one of: `data-shape`, `provider-config`, `external-quote`, `cache/version`, `deploy-regression`.
- Treat `null is not an object` class issues as highest urgency because they hard-stop rendering.

### 4. Apply Targeted Fix

- Add null guards on every uncertain API field read.
- Use fallback ordering for quote fields instead of hard dependence on one field.
- Preserve last known good values when external providers fail.
- Keep status label explicit (`실시간`, `장 마감 종가`, `지연 데이터`, `오류`) to avoid silent misinformation.

### 5. Verify End-to-End

- Run local smoke checks that cover portfolio and live quote endpoints.
- Verify production endpoint behavior with authentication header.
- Confirm that app version cache-bust is updated when client-side script changed.

### 6. Communicate and Prevent Recurrence

- Provide root cause, user impact window, exact fix, and what guard was added.
- Add one permanent regression check when the same class of issue has repeated.

## File Targets for This Repository

- `/Users/jojiwon/vibecording/asset-main/lib/server-state-store.js`
- `/Users/jojiwon/vibecording/asset-main/lib/live-price-service.js`
- `/Users/jojiwon/vibecording/asset-main/lib/persisted-portfolio-service.js`
- `/Users/jojiwon/vibecording/asset-main/app.js`

## Incident Output Format

- `문제:` 사용자에게 보인 현상 1줄
- `원인:` 기술적 원인 1~2줄
- `수정:` 코드/배포 조치 1~3줄
- `검증:` 로컬 + 프로덕션 확인 결과
- `재발방지:` 추가한 가드 1~2줄

Use concise Korean when user tone is urgent, and keep responsibility language clear.
