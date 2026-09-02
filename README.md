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

Two optional build-time variables:

| Variable | Effect when unset |
|---|---|
| `NEXT_PUBLIC_BASE_PATH` | Site is served from the root. Set it to `/what-if-i-invested` for a GitHub Pages *project* site, which lives in a subdirectory. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | No analytics at all — the component renders nothing, so local and forked builds never reach the property. CI supplies it from the `GA_MEASUREMENT_ID` repository *variable* (not a secret: the ID is in every page's source by design). |

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
| Prices (adjusted) | [Alpha Vantage](https://www.alphavantage.co) free tier | rotation, ~10 days |
| Bank rates | [ECB Data Portal](https://data.ecb.europa.eu), series `MIR/M.U2.B.L22.A.R.A.2250.EUR.N` | daily |

The refresh needs an `ALPHAVANTAGE_API_KEY` repository secret. The published site needs no key at
all — it only ever reads static files.

**Staleness barely matters here.** A symbol's *entire* history is fetched and committed the first
time it is seen, so the rotation only ever ages the current month. Never-fetched symbols sort as
infinitely stale and go to the front of the queue, and a failed fetch keeps the last published
file — so history is never lost once acquired.

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

This took three attempts, and the dead ends are worth recording so nobody repeats them.

**Yahoo** blanket-blocks datacenter IPs — a GitHub runner gets `429` on its very first request,
not after a burst, so no amount of pacing helps. It also sends no CORS headers, so the browser was
never an option either.

**Twelve Data's free tier is US-only**, and its `/dividends` endpoint is paid-only on top of that.
Two traps there: its symbol *search* happily lists European venues you cannot then fetch, and its
`demo` key serves endpoints a real free key refuses. US-only plus no dividends would have meant
price return instead of total return for most of the universe — over thirty years that is not a
detail.

**Alpha Vantage** carries the venues this site needs and its `TIME_SERIES_MONTHLY_ADJUSTED` is
free and returns adjusted closes outright, so total return is correct everywhere. Its ceiling is
about 25 calls a day, which is why the refresh rotates instead of fetching the whole universe.

Two things still had to be handled:

- **Minor units.** London quotes in pence, which Alpha Vantage reports as `GBX`. That is not a
  real ISO 4217 code, so it throws inside `Intl.NumberFormat`, and taken at face value it would
  show a UK holding at 100x its worth. Converted to pounds at the door.
- **No Borsa Italiana.** Milan-listed symbols are mapped to their XETRA, Frankfurt or Amsterdam
  listing in the same currency — the same instruments, quoted on a different venue. Italian names
  are all cross-listed on XETRA in EUR (Enel is `ENL.DEX`, UniCredit `CRIN.DEX`), so nothing is
  lost but the venue.

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
node scripts/map-alphavantage.mjs --write     # resolve non-US tickers; resumable
```

US listings need no lookup — Alpha Vantage uses the bare ticker, which is what the universe
already stores. Everything else does, and because the daily quota is far smaller than the universe
the mapper is **resumable**: it skips anything already mapped and stops at `--limit`, so it runs
across several days, which is what the workflow does until nothing is left to resolve.

To add a symbol, append it with a `symbol`, `name`, `type`, `currency` and `category`, run the
mapper if it is not US-listed, then run the refresh.

Because the universe is curated rather than exhaustive, the portfolio builder carries a link to a
[Google Form](https://forms.gle/Xy49vCSJKT2zX1UcA) for requesting one that is missing — a ticker
that is not there is a fixable gap, and with no backend a form off-site is the only way to hear
about it. Requests arrive in that form's responses, and land here as an edit to the universe.

A symbol Yahoo cannot resolve is **reported and skipped**, not fatal — one dead ticker must not
cost the other 200. If more than 25% of the universe fails, the run aborts and publishes nothing,
on the assumption that it is an upstream outage rather than 50 simultaneously delisted funds.
Symbols that fail keep whatever was last published, so a bad run degrades to stale data, never to
no data.

### Refreshing

```bash
export ALPHAVANTAGE_API_KEY=...
node scripts/fetch-market-data.mjs                       # the neediest symbols, up to the budget
node scripts/fetch-market-data.mjs --only VWCE.DE,AAPL   # just these
node scripts/fetch-market-data.mjs --budget 20           # how many symbols this run
```

Each run takes the symbols that need it most rather than the next ones alphabetically: anything
never fetched first, then anything still carrying price-return-only data from an earlier provider,
then the stalest. No cursor file, and a symbol that fails simply stays at the front of the queue.

The script is dependency-free ESM so CI can run it with bare `node` — it cannot break on an
unrelated dependency bump. `.github/workflows/refresh-market-data.yml` runs it daily, commits
`public/data/` if anything changed, and then triggers a redeploy.

## Disclaimer and consent

Two separate decisions, deliberately **not** bundled into one "I agree" — they have different
legal bases, and bundled consent is not valid consent.

1. **Educational-use disclaimer** (`components/DisclaimerModal.tsx`) — shown on first visit and
   *not* dismissible: no backdrop click, no Escape, no close button. It has to be acknowledged.
   It carries only the three points that need agreeing to; the detail lives on `/disclaimer`,
   linked from the dialog ("More info", in a new tab) and from the footer. The dialog suppresses
   itself on that page, or the link would open onto a copy of the dialog it came from.
2. **Storage consent** (`components/CookieBanner.tsx`) — appears only once the disclaimer is
   acknowledged, so the visitor never faces two overlays at once. *Reject all* is the same size
   and weight as *Accept all*, the analytics category ships switched **off**, and consent can be
   changed or withdrawn at any time from "Storage preferences" in the footer.

Both answers are stored in `localStorage`, versioned, so materially changing the disclaimer text
or what the categories actually do re-prompts everyone. Analytics arriving took the consent
record to v2: until then the category loaded nothing, so an earlier *accept* was agreement to
something materially smaller.

| Key | Holds |
|---|---|
| `whatifiinvested.disclaimer` | `{ version, acknowledgedAt }` |
| `whatifiinvested.consent` | `{ version, decidedAt, categories: { necessary, analytics } }` |
| `whatifiinvested.locale` | `'en'` or `'it'`, written only on an explicit choice |

The language key is strictly necessary and needs no consent: it records a preference the visitor
set themselves and nothing else. Auto-detection writes nothing at all.

`lib/consent.ts` exposes this as a **`useSyncExternalStore` store** rather than reading storage
in an effect. That gets hydration right by construction — the server renders the `ready: false`
snapshot, so no banner can flash in before the stored answer is known — and it keeps two open
tabs in step, since a decision in one fires `storage` in the other. Every access is wrapped:
Safari private mode and browsers set to block site data *throw* rather than returning null, and
the correct failure mode is to ask again, never to assume an answer.

### Analytics

Google Analytics (`components/Analytics.tsx`), and **nothing until it is asked for**. The panel
promises that non-essential scripts do not run unless switched on, so the tag is not
configured-and-denied via Consent Mode — the script is never added to the page at all while
consent is absent. That is stricter, and it is the only reading of the promise the panel makes.

- `send_page_view: false`, with a `page_view` fired per route change instead. Client-side
  navigation would otherwise report one pageview for a whole session.
- `allow_google_signals` and `allow_ad_personalization_signals` are **off**, which is what makes
  the panel's "no advertising and no profiling" true rather than aspirational.
- Withdrawal actually stops it: `ga-disable-<ID>`, a denied `analytics_storage` update, and its
  cookies deleted across both the host and the registrable domain.

Rejection is stored as a real decision (`analytics: false`), not as an absent record, so a
refusal is remembered rather than re-asked on every visit.

The gate is the same one any future script should read:

```tsx
const { allows } = useConsent()
if (allows('analytics')) {
  // load the tag here, and only here
}
```

## Language

English and Italian, chosen from `navigator.languages` and overridable from the header toggle.
There is no server to read `Accept-Language`, so detection happens in the browser: the
prerendered HTML is always English and `LocaleProvider` hands React a fixed `'en'` server
snapshot — the one React also uses while hydrating — so the first render agrees with the HTML it
is hydrating, and the swap into Italian happens straight after.

`lib/i18n/en.ts` is the source of truth and `it.ts` is typed as `Dictionary`, so **a key added in
English fails the build until it is translated**. Interpolating entries are functions rather than
templates with placeholders, because word order is not a constant across languages. A test walks
every leaf, calling the functions with placeholder arguments, and fails on anything left in
English.

Numbers follow the display language rather than the currency: an Italian reader gets `72.910 €`
and `8,0%` where an English one gets `€72,910` and `8.0%`.

Consequence worth knowing: search engines only ever see the English text, since there is one set
of URLs and the Italian arrives after hydration. Italian URLs under `/it/` would fix that and are
additive from here.

## Sharing a link

The address bar is the save button. Every edit rewrites the query string, so the URL on screen is
always the one worth copying, and opening it puts the calculator back where it was:

```
/basic/?initial=5000&years=30&rate=9&currency=USD
/advanced/?holdings=VWCE.DE:60,AAPL:40&add=500&from=2016-01
```

Only fields that differ from the defaults are written — the common case is two or three changed
numbers, and a link spelling out every field would be long for no gain. Each page writes only
what it shows, so a Basic link is never padded with a portfolio the recipient cannot see. Rates
travel as the percentages the inputs display (`rate=9`), and `lib/shareUrl.ts` clamps everything
it reads back to the same limits the inputs impose, so a mangled URL loses the field it mangled
rather than rendering a nonsense projection.

Prices are far too big for a URL, so an Advanced link carries tickers and weights and the history
is fetched again on arrival; a symbol that has since left the universe is dropped rather than
failing the whole link.

The URL cannot be read while rendering — the prerendered HTML is built from the defaults, and a
first client render that disagreed with it would break hydration — so the link reaches React as
an external store with the defaults as its server snapshot, the same bargain
[Language](#language) strikes. Writes use `history.replaceState`: a shareable link is worth
having, a history entry per keystroke is not. Nothing is written to browser storage, which would
drag the consent banner into it.

## Layout

```
app/
  page.tsx              the opening question
  basic/page.tsx        Basic mode
  advanced/page.tsx     Portfolio backtest
lib/
  projection.ts         compounding engine (pure)
  backtest.ts           portfolio engine (pure)
  shareUrl.ts           the inputs, to and from the query string
  marketData.ts         loads the published JSON; ranks symbol search
  consent.ts            disclaimer + storage-consent store
components/             chart, cards, table, portfolio builder, consent UI
scripts/
  market-data.mjs       Alpha Vantage + ECB fetching and normalisation (build-time only)
  fetch-market-data.mjs CLI that writes public/data/
  map-alphavantage.mjs  resolves non-US tickers to Alpha Vantage symbols
data-source/
  symbol-universe.json  the curated ~200 symbols
public/data/            the published data, committed and served as-is
```

The engines in `lib/` are pure and have no React or network dependency, which is why they can be
tested directly and why the backtest runs entirely in the browser.

## Deploying to GitHub Pages

`.github/workflows/deploy-pages.yml` builds the export and publishes it, on every push to `main`
and after each data refresh.

The site has its **own custom domain**, `whatifiinvested.it`, set by `public/CNAME`. That matters
for how it is served: the account's user site uses `www.danielebonaldo.com`, so project sites
would normally be served from `www.danielebonaldo.com/<repo>/`. A project repo with its own CNAME
overrides that and is served from its domain root instead — which is why this build sets no
`NEXT_PUBLIC_BASE_PATH`, while other repos on the account are unaffected and keep their subpaths.

Keeping the CNAME in `public/` rather than only in repo settings is deliberate: with
Actions-based deployment the artifact is the source of truth, so a domain configured only in
settings can be dropped on redeploy.

DNS for the apex domain points at GitHub's Pages addresses:

| Record | Name | Value |
|---|---|---|
| A | `@` | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |
| CNAME | `www` | `danybony.github.io` |

GitHub redirects `www` to the apex automatically once the custom domain is set.

To deploy a fork without a domain, drop `public/CNAME` and set
`NEXT_PUBLIC_BASE_PATH=/<repo-name>` in the build step — the config still supports the subpath
case.

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
