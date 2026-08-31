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
| Prices & dividends | [Twelve Data](https://twelvedata.com) (free tier, API key) | daily, by GitHub Actions |
| Bank rates | [ECB Data Portal](https://data.ecb.europa.eu), series `MIR/M.U2.B.L22.A.R.A.2250.EUR.N` | daily, same run |

The refresh needs a `TWELVEDATA_API_KEY` repository secret. Nothing else needs a key, and the
published site needs none at all.

### The published files

```
public/data/
  symbols.json          the searchable universe + each symbol's coverage
  rates.json            ECB euro-area household deposit rates, monthly
  prices/VWCE.DE.json   one file per symbol, monthly close + adjusted close
```

Only the symbols actually in a portfolio are downloaded, so a visit costs the index (a few KB)
plus one small file per holding.

### Why the data is fetched in CI, and why not from Yahoo

Fetching in CI turns a per-visitor problem into a once-a-day one: **~200 requests total**, rather
than ~200 per visitor. The repo itself becomes the cache — shared by everyone, versioned, free.
(The ECB does send `Access-Control-Allow-Origin: *`, so it *could* be called from the browser;
we bake it anyway to keep every request same-origin.)

This started on Yahoo's keyless endpoints and had to move. Yahoo **blanket-blocks datacenter
IPs**: a GitHub runner gets `429` on its very first request, not after a burst, so no amount of
pacing helps. It also sends no CORS headers, so the browser was never an option either. Twelve
Data issues a key and permits automated access, which is the difference that matters.

Two things had to be rebuilt around that move:

- **Adjusted closes.** Twelve Data's prices are split-adjusted but not dividend-adjusted, so
  `buildHistory()` reconstructs the adjusted series from the dividend record — each payout buys
  more shares at that month's close — and rebases it so the newest adjusted close equals the
  newest close. Cross-checked against Yahoo's own adjusted close for AAPL: 25.9279 vs 25.90 at
  2015-01, a 0.1% difference.
- **Minor units.** London quotes in pence, and Twelve Data reports that as `GBp` — not a real ISO
  4217 code, so it throws inside `Intl.NumberFormat`, and taken at face value it would show a UK
  holding at 100x its worth. Prices and dividends are converted to pounds at the door.

The trade-off is a **curated universe** instead of every ticker on earth, and prices as fresh as
the last refresh.

### The symbol universe

`data-source/symbol-universe.json` holds ~200 hand-picked funds and shares — world and regional
UCITS ETFs, bond and commodity ETFs, US-listed ETFs, US large caps, and European and Italian
blue chips.

Each entry carries a `td` block naming the Twelve Data symbol and MIC code, because the two
providers identify a listing differently: Yahoo uses a suffix (`VWCE.DE`), Twelve Data a bare
symbol plus a venue (`VWCE` @ `XETR`). The same fund lists on several exchanges in different
currencies, so `scripts/map-symbols.mjs` matches on venue first and currency second and reports
anything ambiguous rather than guessing — picking the wrong row would silently change a
backtest's currency.

```bash
node scripts/map-symbols.mjs           # dry run, prints what it would resolve
node scripts/map-symbols.mjs --write   # update the universe file
```

That script needs no API key. To add a symbol, append it with a `symbol`, `name`, `type`,
`currency` and `category`, run the mapper, then run the refresh.

A symbol Yahoo cannot resolve is **reported and skipped**, not fatal — one dead ticker must not
cost the other 200. If more than 25% of the universe fails, the run aborts and publishes nothing,
on the assumption that it is an upstream outage rather than 50 simultaneously delisted funds.
Symbols that fail keep whatever was last published, so a bad run degrades to stale data, never to
no data.

### Refreshing

```bash
export TWELVEDATA_API_KEY=...
node scripts/fetch-market-data.mjs                       # the whole universe
node scripts/fetch-market-data.mjs --only VWCE.DE,AAPL   # just these
node scripts/fetch-market-data.mjs --interval 8000       # free tier allows 8 calls/min
node scripts/fetch-market-data.mjs --dividend-age 0      # force a dividend refetch
```

Dividends move quarterly at best, so a published record younger than 7 days is reused rather
than refetched. That keeps a daily run at ~204 calls instead of ~408, comfortably inside the
free tier's 800/day.

The script is dependency-free ESM so CI can run it with bare `node` — it cannot break on an
unrelated dependency bump. `.github/workflows/refresh-market-data.yml` runs it daily, commits
`public/data/` if anything changed, and then triggers a redeploy.

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
  market-data.mjs       Twelve Data + ECB fetching and normalisation (build-time only)
  fetch-market-data.mjs CLI that writes public/data/
  map-symbols.mjs       resolves tickers to Twelve Data symbol + MIC
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
