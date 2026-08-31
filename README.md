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

No API keys. `npm run build` emits a static site into `out/`.

Set `NEXT_PUBLIC_BASE_PATH=/what-if-i-invested` when building for a GitHub Pages *project* site,
which is served from a subdirectory. Leave it unset for local dev or a custom domain.

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

## Data sources — and why there is no backend

The site is a **fully static export**. There are no API routes and no server: prices and bank
rates are fetched at build time, committed into `public/data/`, and served as plain files
alongside the page. That is what lets GitHub Pages host the whole thing, and it makes the
privacy story simple — a visitor's browser never talks to a data provider.

| What | Where | Refreshed |
|---|---|---|
| Prices | Yahoo Finance `v8/finance/chart` | daily, by GitHub Actions |
| Bank rates | [ECB Data Portal](https://data.ecb.europa.eu), series `MIR/M.U2.B.L22.A.R.A.2250.EUR.N` | daily, same run |

### The published files

```
public/data/
  symbols.json          the searchable universe + each symbol's coverage
  rates.json            ECB euro-area household deposit rates, monthly
  prices/VWCE.DE.json   one file per symbol, monthly close + adjusted close
```

Only the symbols actually in a portfolio are downloaded, so a visit costs the index (a few KB)
plus one small file per holding.

### Why this beats calling Yahoo from the browser

Yahoo rate-limits an IP hard — a few dozen uncached requests is enough to earn `429`s for
several minutes, and it sends no CORS headers, so a browser could not call it directly anyway.
Fetching in CI turns a per-visitor problem into a once-a-day one: **~200 requests total**,
rather than ~200 per visitor. The repo itself becomes the cache — shared by everyone, versioned,
and free. (The ECB, unlike Yahoo, does send `Access-Control-Allow-Origin: *`, so it *could* be
called from the browser; we bake it anyway to keep every request same-origin.)

The trade-off is a **curated universe** instead of every ticker on earth, and prices as fresh as
the last refresh.

### The symbol universe

`data-source/symbol-universe.json` holds ~200 hand-picked funds and shares — world and regional
UCITS ETFs, bond and commodity ETFs, US-listed ETFs, US large caps, and European and Italian
blue chips. To add one, append it and run the refresh workflow. Yahoo is the authority on name,
currency and exchange; the values in that file are only hints used before a symbol is first
fetched.

A symbol Yahoo cannot resolve is **reported and skipped**, not fatal — one dead ticker must not
cost the other 200. If more than 25% of the universe fails, the run aborts and publishes nothing,
on the assumption that it is an upstream outage rather than 50 simultaneously delisted funds.
Symbols that fail keep whatever was last published, so a bad run degrades to stale data, never to
no data.

### Refreshing

```bash
node scripts/fetch-market-data.mjs                          # the whole universe
node scripts/fetch-market-data.mjs --only VWCE.DE,AAPL      # just these
node scripts/fetch-market-data.mjs --delay 3000             # slower, if throttled
```

The script is dependency-free ESM so CI can run it with bare `node` — it cannot break on an
unrelated dependency bump. `.github/workflows/refresh-market-data.yml` runs it daily, commits
`public/data/` if anything changed, and then triggers a redeploy.

### A note on Yahoo's month keys

Monthly bars are stamped at **midnight in the exchange's own timezone**, so a XETRA September bar
is `2019-08-31T22:00Z`. Reading those as UTC files European bars a month early, and
`meta.gmtoffset` doesn't fix it either — it is the offset at fetch time, so it is an hour out for
every bar on the far side of a DST boundary, which is enough to move a month-start bar into the
previous month. `monthKeyInTimeZone()` formats in the named exchange timezone instead;
`scripts/__tests__/market-data.test.mjs` guards it.

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
lib/
  projection.ts         compounding engine (pure)
  backtest.ts           portfolio engine (pure)
  marketData.ts         loads the published JSON; ranks symbol search
  consent.ts            disclaimer + storage-consent store
components/             chart, cards, table, portfolio builder, consent UI
scripts/
  market-data.mjs       Yahoo + ECB fetching and normalisation (build-time only)
  fetch-market-data.mjs CLI that writes public/data/
data-source/
  symbol-universe.json  the curated ~200 symbols
public/data/            the published data, committed and served as-is
```

The engines in `lib/` are pure and have no React or network dependency, which is why they can be
tested directly and why the backtest runs entirely in the browser.

## Deploying to GitHub Pages

`.github/workflows/deploy-pages.yml` builds the export and publishes it. Two things have to be
set up once, by hand:

1. **Settings → Pages → Source: GitHub Actions.**
2. On a **private** repository, Pages needs a plan that includes it (Pro, Team or Enterprise).
   On a free account the repository has to be public instead.

The workflow sets `NEXT_PUBLIC_BASE_PATH` to the repo name, because a project site is served
from `https://<user>.github.io/<repo>/`. On a custom domain, drop that env line and add a
`public/CNAME`.

`refresh-market-data.yml` calls the deploy workflow directly after committing new data — a push
made with `GITHUB_TOKEN` deliberately does not trigger other workflows, so relying on the `push`
trigger would leave fresh data unpublished.

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
