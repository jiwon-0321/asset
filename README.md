# Asset Board

Mobile-first portfolio board for trade tracking, notes, watchlists, strategy state, and live market data.

This public repository contains application code and public-safe sample assets only.

## Quick Start

1. Clone the repo and install dependencies.

```bash
git clone <repo-url>
cd asset
npm install
```

2. Copy the example environment file.

```bash
cp .env.example .env.local
```

3. Set at least one access code in `.env.local`.

```env
OWNER_ACCESS_CODE=change-this-code
```

4. Start the local server.

```bash
npm run dev
```

5. Open [http://127.0.0.1:4173](http://127.0.0.1:4173).

## Local Environment Notes

- Default storage is local because `.env.example` sets `STORAGE_PROVIDER=local`.
- Firebase is optional for local use. You only need the Firebase env vars if you want to connect your own Firestore runtime.
- `OWNER_ACCESS_CODE_PROFILES` and `GUEST_ACCESS_CODES` are optional.

## Market Data Providers

- Crypto quotes: Upbit public API
- U.S. stock quotes: Twelve Data via `TWELVE_DATA_API_KEY`
- Korea stock quotes: KIS via `KIS_APP_KEY` and `KIS_APP_SECRET`

## Current KIS Note

- Korea stock support is wired for KIS, but local execution can still have missing or degraded KR stock data if KIS API registration or keys are not ready yet.
- The app can still run without KIS, but Korea stock live prices may not load correctly in that case.

## Optional Check

```bash
npm run smoke
```
