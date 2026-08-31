# What If I Invested

A compound-interest calculator whose headline is the number most calculators leave out:
**how far ahead of your bank account you would have ended up.**

- **Basic mode** — investor.gov-style projection. Set an *estimated interest rate* and an
  *interest-rate variance range*, and the best / average / worst cases are run at
  `rate + range`, `rate`, and `rate - range`. Alongside them sits the same money left in a
  bank account, which for most euro-area current accounts means **0%**.
- **Advanced mode** — build a portfolio of real funds and shares, pick a start date, and see
  what those exact holdings would actually have done from then until today, using the same
  initial-amount and recurring-contribution inputs.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # engine unit tests
npm run build    # production build
```

No API keys and no environment variables — both upstreams are keyless.

## How the numbers are worked out

Everything is simulated on a **monthly grid**, the natural granularity of both contributions
and the ECB rate series. The chosen compound frequency is folded into a per-month growth
factor, `(1 + r/n)^(n/12)`, so a reported year-end value is identical to textbook discrete
compounding at that frequency while the months in between still draw a smooth curve.

Contributions land at the **end** of their period and earn nothing in the month they are paid
in — the ordinary-annuity convention that investor.gov uses. `lib/__tests__/projection.test.ts`
pins this against the closed form.

### Advanced mode mechanics

Buy-and-hold with dollar-cost averaging: the initial amount buys units at the start month's
price, and each contribution buys more at that month's price. Deliberately **not** modelled:

- **No rebalancing.** Weights drift with prices, and the final drift is reported.
- **No currency conversion.** Adding a USD holding to a EUR portfolio is *blocked* rather than
  silently adding euros to dollars. Every holding must share one currency.
- **Dividends are opt-in.** The default is price return; the *Reinvest dividends* switch uses
  Yahoo's adjusted closes instead, which is the fair comparison for a distributing fund.

Two return figures are reported because they answer different questions: the **money-weighted**
(IRR) return is what the saver actually earned given when they paid in, and the **time-weighted**
CAGR is what the holdings themselves did. Max drawdown is measured on a separate €1
buy-and-hold stake, so the deposit schedule doesn't flatter it.

## Data sources

| What | Where | Notes |
|---|---|---|
| Prices | Yahoo Finance `v8/finance/chart` | Keyless, unofficial. Monthly closes + adjusted closes. |
| Ticker search | Yahoo Finance `v1/finance/search` | Keyless, unofficial. |
| Bank rates | [ECB Data Portal](https://data.ecb.europa.eu), series `MIR/M.U2.B.L22.A.R.A.2250.EUR.N` | Euro-area household deposits, new business. Free CSV, ~26 years of monthly history. |

Both block browser CORS and Yahoo rejects requests without a browser `User-Agent`, so all
access goes through the server routes in `app/api/`.

### About the Yahoo rate limit

Yahoo rate-limits an IP hard — a few dozen uncached requests is enough to get `429`s for
several minutes. Three things keep normal use under that ceiling:

1. **Full history is fetched once per symbol** (`period1=0`) and cached for a day. Every start
   date the user then tries is served by slicing that one cache entry.
2. Requests **fail over between Yahoo's two hosts** (`query1`/`query2`) with a short retry.
3. If everything upstream fails, `lib/cache.ts` returns the **last known good answer marked
   stale** rather than an error, and the UI labels it as cached.

If the site ever outgrows this, the upgrade path is a keyed provider (Twelve Data, Tiingo,
EODHD) behind the same `fetchHistory`/`searchSymbols` interface in `lib/yahoo.ts` — nothing
above that layer needs to change.

**Working offline, or while rate-limited:** capture a Yahoo chart response and seed the cache
with it.

```bash
curl -H 'User-Agent: Mozilla/5.0' \
  'https://query2.finance.yahoo.com/v8/finance/chart/VWCE.DE?period1=0&period2=9999999999&interval=1mo' \
  > vwce.json
node scripts/seed-cache.mjs VWCE.DE vwce.json
```

## Disclaimer and consent

Two separate decisions, deliberately **not** bundled into one "I agree" — they have different
legal bases, and bundled consent is not valid consent.

1. **Educational-use disclaimer** (`components/DisclaimerModal.tsx`) — shown on first visit and
   *not* dismissible: no backdrop click, no Escape, no close button. It has to be acknowledged.
   Afterwards it is re-openable from the footer, where it *is* dismissible.
2. **Storage consent** (`components/CookieBanner.tsx`) — appears only once the disclaimer is
   acknowledged, so the visitor never faces two overlays at once. *Reject all* is the same size
   and weight as *Accept all*, the analytics category ships switched **off**, and consent can be
   changed or withdrawn at any time from "Storage preferences" in the footer.

Both answers are stored in `localStorage`, versioned, so materially changing the disclaimer text
or the category list re-prompts everyone:

| Key | Holds |
|---|---|
| `whatifiinvested.disclaimer` | `{ version, acknowledgedAt }` |
| `whatifiinvested.consent` | `{ version, decidedAt, categories: { necessary, analytics } }` |

`lib/consent.ts` exposes this as a **`useSyncExternalStore` store** rather than reading storage
in an effect. That gets hydration right by construction — the server renders the `ready: false`
snapshot, so no banner can flash in before the stored answer is known — and it keeps two open
tabs in step, since a decision in one fires `storage` in the other. Every access is wrapped:
Safari private mode and browsers set to block site data *throw* rather than returning null, and
the correct failure mode is to ask again, never to assume an answer.

### Wiring up analytics later

Nothing on the site loads analytics today, and the copy in the panel says so. The gate already
exists — read it before loading any non-essential script:

```tsx
const { allows } = useConsent()
if (allows('analytics')) {
  // load the tag here, and only here
}
```

Rejection is stored as a real decision (`analytics: false`), not as an absent record, so a
refusal is remembered rather than re-asked on every visit.

## Layout

```
app/
  page.tsx              Basic mode
  advanced/page.tsx     Portfolio backtest
  api/{search,history,rates}/route.ts
lib/
  projection.ts         compounding engine (pure)
  backtest.ts           portfolio engine (pure)
  yahoo.ts              price/search client
  ecb.ts                deposit-rate client
  cache.ts              read-through cache with stale fallback
  consent.ts            disclaimer + storage-consent store
components/             chart, cards, table, portfolio builder, consent UI
scripts/seed-cache.mjs  prime the price cache from a saved response
```

The engines in `lib/` are pure and have no React or network dependency, which is why they can
be tested directly and why the backtest runs client-side.

### A note on Yahoo's month keys

Monthly bars are stamped at **midnight in the exchange's own timezone**, so a XETRA September
bar is `2019-08-31T22:00Z`. Reading those as UTC files European bars a month early, and
`meta.gmtoffset` doesn't fix it either — it is the offset at fetch time, so it is an hour out
for every bar on the far side of a DST boundary, which is enough to move a month-start bar
into the previous month. `monthKeyInTimeZone()` formats in the named exchange timezone
instead; `lib/__tests__/yahoo.test.ts` guards it.

## Chart design

The chart treats **investing as one entity** — a worst-to-best band with the average as its
solid line — and **the bank as a second entity**, with money paid in as a neutral dashed
reference. That is why there are two hues rather than four competing ones, and why the gap
between blue and orange is the thing your eye lands on. Both the light and dark palettes were
run through the data-viz palette validator and pass every check (lightness band, chroma floor,
colour-blind separation, normal-vision floor, and contrast against their surface).

## Caveats

This is an educational tool and does not give financial advice. Figures are before tax,
inflation, fees and spreads. Basic mode is an illustration, not a forecast. Past performance in
Advanced mode does not predict future returns.
