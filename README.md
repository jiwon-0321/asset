# Asset Board

Mobile-first portfolio board for trade tracking, watchlists, notes, strategy state, and live market data.

This public repository contains application code plus public-safe sample fixtures only. Real runtime portfolio data, notes, access codes, and deployment secrets are intended to live outside GitHub.

## What This App Does

- Tracks current holdings, cash, realized profit, and total assets
- Stores watchlists, trade timeline entries, and notes
- Supports a first-time onboarding flow for new users
- Shows live market data for crypto, US stocks, and KR stocks

## Quick Start

1. Clone the repo and install dependencies.
2. Copy `.env.example` to `.env.local`.
3. Start with the blank onboarding board.
4. Run the dev server.

```bash
git clone <repo-url>
cd asset-main
npm install
cp .env.example .env.local
npm run dev
```

Then open [http://127.0.0.1:4173](http://127.0.0.1:4173).

## Repo vs Runtime Data

Team rule of thumb:

- GitHub keeps the app shell, API routes, business logic, and public-safe sample fixtures
- Firebase keeps real runtime data such as live portfolio state, trades, notes, and user-specific saved state

Files in `data/` such as `data/portfolio-sample.json` and `data/portfolio.friend-*.json` are sample or guide fixtures for fallback, onboarding, and UI checks. They are not the live owner timeline.

## Recommended `.env.local`

For a first-time user or a fresh clone, this is the recommended sample-only starting point:

```env
OWNER_ACCESS_CODE=change-this-code
BOARD_VARIANT=blank-family
OWNER_STATE_KEY=my-local-board
STORAGE_PROVIDER=local
```

What each value means:

- `OWNER_ACCESS_CODE`: the code entered on the access screen
- `BOARD_VARIANT=blank-family`: enables the onboarding-first board with the guide and initial asset setup
- `OWNER_STATE_KEY`: isolates saved local state for this board
- `STORAGE_PROVIDER=local`: saves temporary local test data into ignored files inside `data/`

With `STORAGE_PROVIDER=local`, the app writes local state files such as:

- `data/portfolio.local.json` for the default owner state
- `data/portfolio.<stateKey>.json` for custom owner state keys
- `data/notes.json` or `data/notes.<stateKey>.json` for notes

These local runtime files are ignored by Git and are meant for clone-and-run testing, not for shared production data.

## First-Time Onboarding

With `BOARD_VARIANT=blank-family`, the intended onboarding flow is:

1. Enter the owner access code
2. Read the guide section
3. Enter starting cash and current holdings
4. Open watchlist, allocation, holdings, and trade timeline as needed

The guide is opened by default for this board variant, and only the most important sections are shown first.

Initial setup is intended for current holdings plus starting cash. After the first save, later updates should use the normal trade and cash editing flows.

## Market Data Providers

Current market data setup:

- Crypto: `Upbit`
- US stocks: `Twelve Data`
- KR stocks: `KIS`

Current fallback behavior:

- If `TWELVE_DATA_API_KEY` is missing, US stock quotes can fall back to delayed Yahoo Finance data
- If `KIS_APP_KEY` and `KIS_APP_SECRET` are missing, KR live quotes can be unavailable even though the rest of the app still works
- Crypto pricing does not need a separate API key in the default setup

So a fresh local clone can still run without every API configured, but the live quote coverage will be reduced.

## Environment Variables

Core local variables:

```env
OWNER_ACCESS_CODE=change-this-code
BOARD_VARIANT=blank-family
OWNER_STATE_KEY=my-local-board
STORAGE_PROVIDER=local
```

Optional live-data variables:

```env
TWELVE_DATA_API_KEY=
KIS_APP_KEY=
KIS_APP_SECRET=
```

Optional guest access:

```env
GUEST_ACCESS_CODES=1111,2222
```

Advanced multi-owner setup in one runtime:

```env
OWNER_ACCESS_CODE=main-owner-code
OWNER_ACCESS_CODE_PROFILES=[{"code":"friend-1","stateKey":"friend-1","variant":"blank-family"},{"code":"friend-2","stateKey":"friend-2","variant":"blank-family"}]
```

Notes:

- `OWNER_ACCESS_CODE_PROFILES` is optional
- each profile gets its own `stateKey`
- `variant` can be `blank-family` or `personal`
- if you only want one local board, you usually do not need profiles

## Storage Options

Default recommendation for quick local development:

```env
STORAGE_PROVIDER=local
```

Preferred setup for real shared data or production-like persistence:

```env
FIREBASE_SERVICE_ACCOUNT_JSON=
FIRESTORE_PORTFOLIO_DOC_PATH=
FIRESTORE_NOTES_DOC_PATH=
FIRESTORE_PORTFOLIO_COLLECTION_PATH=
FIRESTORE_NOTES_COLLECTION_PATH=
```

For a normal clone-and-run workflow, local storage is enough.

For the team workflow, the intended split is:

- GitHub: code and public-safe sample fixtures
- Firebase: real user/runtime data

## Validation

Useful checks before sharing or deploying:

```bash
npm run smoke
```

The smoke test covers access control, storage behavior, onboarding-related board behavior, and key API flows.
