# Trade Photo Assist

## Status

Shipped on `main`.

## Current Behavior

- Owner-only draft helper inside the existing trade modal
- Accepts `1-4` images in one request
- Returns a draft only; never saves a trade during parsing
- Applies the parsed draft back into the editable modal fields
- Keeps the normal `/api/trades` save path unchanged

## Verified Case

- Real Upbit multi-image capture
- Parsed the latest visible buy row into a draft
- Confirmed warning chips, status text, and draft-fill behavior end to end

## Current Limits

- Multi-row screenshots still resolve to one best trade candidate, not a full batch import
- Tight crops around the intended trade row are more reliable than long transaction lists
- The user still needs to review broker, fee, and any ambiguous date or amount field before saving

## Key Files

- `client/trade-modal.js`
- `lib/trade-photo-assist.js`
- `api/trades.js`
- `index.html`
- `styles/sections.css`
- `styles/responsive.css`

## Follow-Up Only If Needed

- Re-test with a new real broker capture when parser behavior changes
- Improve row targeting only if repeated screenshots keep selecting the wrong trade
