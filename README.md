# Asset Board

Mobile-first portfolio board for trade tracking, notes, watchlists, strategy state, and live market data.

This public repository contains application code and public-safe sample assets only.

## Quick Start

1. Clone the repo and install dependencies.

```bash
git clone <repo-url>
cd asset-main
npm install
```

2. Copy the example environment file.

```bash
cp .env.example .env.local
```

3. Set your local board values in `.env.local`.

```env
OWNER_ACCESS_CODE=change-this-code
BOARD_VARIANT=blank-family
OWNER_STATE_KEY=my-local-board
TWELVE_DATA_API_KEY=
KIS_APP_KEY=
KIS_APP_SECRET=
```

4. Start the local server.

```bash
npm run dev
```

5. Open [http://127.0.0.1:4173](http://127.0.0.1:4173).

## First-Time Onboarding

- Enter the same value you set in `OWNER_ACCESS_CODE` on the first access screen.
- `BOARD_VARIANT=blank-family` is the recommended friend-start mode. It opens the guide menu and the initial asset setup flow.
- If you remove `BOARD_VARIANT` or set a different value, the app falls back to the sample/personal board instead of the blank onboarding flow.
- Initial setup is designed for current holdings plus starting cash. After the first save, use the normal trade and cash editing flows for later updates.

## Local Environment Notes

- Default storage is local because `.env.example` sets `STORAGE_PROVIDER=local`.
- Firebase is optional for local use. You only need the Firebase env vars if you want to connect your own Firestore runtime.
- `OWNER_STATE_KEY` is optional, but it helps if you want a separate local board state.
- `OWNER_ACCESS_CODE_PROFILES` and `GUEST_ACCESS_CODES` are optional.

## Market Data Providers

- Crypto quotes: Upbit public API
- U.S. stock quotes: Twelve Data via `TWELVE_DATA_API_KEY`
- Korea stock quotes: KIS via `KIS_APP_KEY` and `KIS_APP_SECRET`
- The board still runs without market data keys, but live quotes can be missing by market depending on which keys are unset.

## Current KIS Note

- Korea stock support is wired for KIS, but local execution can still have missing or degraded KR stock data if KIS API registration or keys are not ready yet.
- The app can still run without KIS, but Korea stock live prices may not load correctly in that case.

## Optional Check

```bash
npm run smoke
```
