/**
 * The source of truth for every user-facing string, and for the shape every
 * other language has to fill. `it.ts` is typed as `Dictionary`, so a key added
 * here is a compile error there until it is translated.
 *
 * Entries that interpolate are functions rather than templates with
 * placeholders: word order differs between languages, and a function lets each
 * one put the values where its own grammar wants them.
 */
export const en = {
  meta: {
    title: 'What If I Invested',
    description:
      'See what compound interest would have done with your money — and how far ahead of your bank account it would have left you.',
  },

  nav: {
    brand: 'What If I Invested',
    basic: 'Basic',
    advanced: 'Advanced',
    language: 'Language',
  },

  frequency: {
    contribution: {
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      annually: 'Annually',
    },
    /** "€200 each month" — the adverbial form, for running text. */
    every: {
      monthly: 'each month',
      quarterly: 'each quarter',
      annually: 'each year',
    },
    compound: {
      daily: 'Daily',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      semiannually: 'Semi-annually',
      annually: 'Annually',
    },
    /** "compounded quarterly" — the adverbial form. */
    compounded: {
      daily: 'daily',
      monthly: 'monthly',
      quarterly: 'quarterly',
      semiannually: 'semi-annually',
      annually: 'annually',
    },
  },

  presets: {
    'global-equity': {
      label: 'Global equity ETF',
      note: 'A world tracker such as an MSCI World or FTSE All-World fund.',
    },
    sp500: {
      label: 'S&P 500',
      note: 'US large caps — higher long-run return, wider swings.',
    },
    balanced: {
      label: '60 / 40 portfolio',
      note: 'Sixty percent shares, forty percent bonds.',
    },
    bonds: {
      label: 'Government bonds',
      note: 'Investment-grade government debt.',
    },
    'money-market': {
      label: 'Money market fund',
      note: 'Short-term cash-like instruments that track policy rates.',
    },
  },

  home: {
    ifLead: 'If',
    yearsAgo: 'years ago you had started investing',
    onTopOf: ', on top of an initial',
    todayYouWould: ', today you would have',
    moreThanBank: 'more than if you had left it in the bank.',
    assumingBefore: 'Assuming a return of',
    assumingAfter: (compounded: string) =>
      `a year compounded ${compounded}, against a bank paying nothing. Every figure here is an estimate, not a forecast.`,
    seeHow: 'See how it’s calculated',
    aria: {
      years: 'Number of years',
      contribution: 'Recurring contribution',
      initial: 'Initial investment',
      rate: 'Estimated annual return',
    },
  },

  basic: {
    title: 'What if you invested it instead?',
    intro:
      'Compound interest on one side, your bank account on the other. The number that matters is the space between them.',
    yourMoney: 'Your money',
    initial: 'Initial investment',
    contribution: 'Contribution',
    howOften: 'How often',
    lengthOfTime: 'Length of time',
    lengthHint: 'Contributions are added at the end of each period.',
    years: 'yrs',
    currency: 'Currency',
    expectedReturn: 'Expected return',
    expectedReturnHint: 'Start from an asset class, then adjust either number.',
    rate: 'Estimated interest rate',
    variance: 'Variance range',
    bandNote: (best: string, worst: string) =>
      `Best and worst cases are run at ${best} and ${worst}.`,
    noBandNote: 'Set a variance range to see a best and worst case.',
    compoundFrequency: 'Compound frequency',
    bankTitle: 'If you left it in the bank',
    bankHint: 'The comparison line. Most euro-area current accounts pay nothing at all.',
    savingsRate: 'Savings rate',
    useEcbRate: (rate: string) => `Use the current euro-area deposit rate (${rate})`,
    investedAt: (rate: string) => `Invested at ${rate}`,
    inTheBankAt: (rate: string) => `In the bank at ${rate}`,
    inTheBank: 'In the bank',
    invested: 'Invested',
    zeroRateNote:
      'With a 0% savings rate the bank line is simply the money you paid in — every euro of the difference is compounding you did not get.',
    yearByYear: 'Year by year',
    aria: {
      initial: 'Initial investment',
      contribution: 'Recurring contribution',
      contributionFrequency: 'Contribution frequency',
      years: 'Length of time in years',
      currency: 'Currency',
      rate: 'Estimated interest rate',
      variance: 'Interest rate variance range',
      compoundFrequency: 'Compound frequency',
      bankRate: 'Bank savings rate',
    },
  },

  advanced: {
    title: 'What if you had actually bought it?',
    intro:
      'Build a portfolio of real funds and shares, pick a start date, and see what those exact holdings would have done with your money — against the same money left in the bank.',
    portfolioTitle: 'Your portfolio',
    portfolioHint: 'Weights must add up to 100%.',
    yourMoney: 'Your money',
    startingFrom: 'Starting from',
    reinvest: 'Reinvest dividends',
    reinvestHint:
      'Off means price return only. On uses adjusted closes, so payouts are bought back in — the fair comparison for a distributing fund.',
    reinvestUnavailable: (symbols: string) =>
      `No dividend data is published for ${symbols}, so only price return can be shown for this portfolio.`,
    historicalRates: 'Use real historical ECB rates',
    historicalRatesHint:
      'Applies the euro-area household deposit rate for each month of the backtest.',
    historicalRatesUnavailable: 'ECB rates are unavailable right now.',
    emptyTitle: 'Add a holding to run the backtest',
    emptyHintBefore: 'Try',
    emptyHintWorld: 'for a world tracker,',
    emptyHintMilan: 'on Borsa Italiana, or a single share like',
    portfolioToday: 'Your portfolio today',
    inTheBankAtEcb: 'In the bank at ECB rates',
    inTheBankAt: (rate: string) => `In the bank at ${rate}`,
    inTheBank: 'In the bank',
    portfolio: 'Portfolio',
    clamped: (symbol: string, firstMonth: string, requested: string) =>
      `${symbol} only has prices from ${firstMonth}, so the backtest starts there rather than ${requested}.`,
    yourReturn: 'Your annual return',
    yourReturnNote: 'Money-weighted, so it accounts for when you paid in.',
    holdingsReturn: 'The holdings’ own return',
    holdingsReturnNote: 'Annualised, ignoring contribution timing.',
    worstFall: 'Worst fall along the way',
    worstFallNote: 'Deepest peak-to-trough drop you would have sat through.',
    whereMoneyEnded: 'Where the money ended up',
    unitsLine: (units: string, weight: string) => `${units} units · ${weight} of the portfolio`,
    driftNote: (currency: string) =>
      `Weights drift as prices move — there is no rebalancing, and no currency conversion, so every holding trades in ${currency}.`,
    yearByYear: (from: string, to: string) => `Year by year — ${from} to ${to}`,
    aria: {
      startMonth: 'Start month',
    },
  },

  portfolio: {
    empty:
      'Add the funds or shares you would have bought. Everything must trade in the same currency — conversion between currencies isn’t modelled.',
    historyFrom: (month: string) => `History from ${month}`,
    weightAria: (symbol: string) => `Weight for ${symbol}`,
    removeAria: (symbol: string) => `Remove ${symbol}`,
    loading: 'loading price history…',
    total: 'Total',
    needs100: ' — needs to be 100%',
    splitEvenly: 'Split evenly',
  },

  search: {
    placeholder: 'Search a stock or ETF — e.g. VWCE.DE, Apple, S&P 500',
    loading: 'Loading symbols…',
    noMatch: (query: string) =>
      `Nothing matches “${query}”. The site carries a curated list of popular funds and shares rather than every ticker.`,
  },

  delta: {
    headline: 'What investing leaves you with, over and above the bank',
    rangeBefore: 'Between',
    rangeMiddle: 'and',
    rangeAfter: 'across the range of outcomes.',
    paidInBefore: 'You would have put in',
    /** Leading space included: each language owns its own spacing here. */
    paidInAfter: ' either way.',
    multipleBefore: 'That is',
    multipleAfter: 'what the bank would have left you.',
    moreThanPaidIn: (percent: string) => `${percent} more than you paid in`,
    moneyPaidIn: 'Money paid in',
  },

  chart: {
    rangeOfOutcomes: 'Range of outcomes',
    bestCase: 'Best case',
    worstCase: 'Worst case',
    moneyPaidIn: 'Money paid in',
    aheadOfBank: 'Ahead of the bank',
    summary: (invested: string, bank: string) =>
      `${invested} invested vs ${bank} in the bank`,
  },

  table: {
    year: 'Year',
    date: 'Date',
    start: 'Start',
    today: 'Today',
    yearN: (n: string) => `Year ${n}`,
    paidIn: 'Paid in',
    worst: 'Worst',
    best: 'Best',
    difference: 'Difference',
  },

  errors: {
    'no-holdings': () => 'Add at least one holding.',
    weights: (total: string) => `Weights add up to ${total} — they need to total 100%.`,
    'mixed-currency': (currency: string, symbol: string, other: string) =>
      `This portfolio is in ${currency} — ${symbol} trades in ${other}. Currency conversion isn’t modelled, so every holding has to share one currency.`,
    'no-overlap': (symbol: string) => `No price history available for ${symbol}.`,
    'too-short': (from: string) =>
      `There is less than a month of overlapping history for these holdings (from ${from}).`,
    symbols: 'The list of funds and shares has not been published yet.',
    history: (symbol: string) => `No price history has been published for ${symbol} yet.`,
    rates: 'Bank rates have not been published yet.',
    marketData: 'Market data is unavailable right now.',
  },

  disclaimerModal: {
    title: 'Educational use only',
    leadStrong: 'This site is for educational purposes only. It does not give financial advice.',
    lead: 'Nothing here is a recommendation to buy, sell or hold any investment.',
    estimates:
      'Every figure is an estimate, worked out from the best data available to us, and will differ from real-world results.',
    speakToSomeone:
      'Before making any investment decision, speak to someone licensed to advise you in your own country.',
    moreInfo: 'More info',
    understand: 'I understand',
  },

  disclaimerPage: {
    metaTitle: 'Disclaimer — What If I Invested',
    metaDescription:
      'Why every figure on this site is an estimate, what the numbers leave out, and what they should and should not be used for.',
    title: 'Disclaimer',
    educationalTitle: 'Educational use, not financial advice',
    educationalBody:
      'This site is an educational tool. Nothing on it is a personal recommendation to buy, sell or hold any investment, and nothing on it takes account of your circumstances, goals, tax position or tolerance for risk. We are not licensed to advise you and we are not trying to.',
    educationalAdvice:
      'Before making any investment decision, speak to someone licensed to advise you in your own country.',
    estimatesTitle: 'Every number here is an estimate',
    estimatesIntro:
      'Results are worked out from the best data available to us, and will differ from what you would actually have seen. Among the reasons:',
    estimatesPoints: [
      'Prices are monthly closing values from a single free data source, refreshed on a rotation, so the most recent month can be several days behind and may still move.',
      'Where a fund is not carried on its home exchange, an equivalent listing elsewhere in the same currency is used. It is the same instrument, quoted slightly differently.',
      'Some holdings currently show price return only, without dividends reinvested. The portfolio builder says so when it applies.',
      'Everything is shown before tax, inflation, fees, spreads and currency conversion, any of which can change the outcome substantially.',
      'A portfolio is modelled as buy-and-hold with no rebalancing, and all holdings must share one currency, because no exchange-rate conversion is applied.',
    ],
    projectionsTitle: 'Projections are assumptions, not forecasts',
    projectionsBody:
      'In Basic mode the rate of return is a number you choose. The presets are rounded long-run historical averages offered as a starting point; they are not predictions, and no rate of return is guaranteed.',
    projectionsStrong: 'Past performance does not predict future results.',
    projectionsSmooth:
      'Real returns do not arrive in equal yearly instalments. A smooth curve is a useful way to see how compounding behaves over time; it is not what a real account balance looks like along the way.',
    dataTitle: 'Where the data comes from',
    dataBody:
      'Share and fund prices come from Alpha Vantage as monthly adjusted closes. Bank rates come from the ECB Data Portal (euro-area household deposits). Both ship as static files with the site and are refreshed on a schedule, so nothing you do here is sent to a data provider.',
    closing:
      'Treat what you see here as an illustration of how compounding behaves, not as a statement of what your money did or will do.',
    back: '← Back to the calculator',
  },

  consent: {
    barTitle: 'Your data on this site',
    barBody:
      'We store a small record in your browser to remember this choice and that you have seen the disclaimer. That much is needed for the site to work. Anything beyond it is optional and stays off unless you turn it on.',
    barQuiet:
      'Nothing you type into the calculator leaves your device — every figure is worked out in your browser. There is no advertising and no profiling, and nothing is sold.',
    manage: 'Manage',
    rejectAll: 'Reject all',
    acceptAll: 'Accept all',
    regionAria: 'Storage and cookie consent',
    settingsTitle: 'Storage preferences',
    settingsBody:
      'This site uses browser storage rather than server-side cookies, which privacy law treats the same way. Here is everything it can store.',
    necessaryLabel: 'Strictly necessary — always on',
    necessaryHint:
      'Three records: that you acknowledged the disclaimer, the choice you make here, and your language if you pick one. Without them you would be asked again on every page. They hold no identifier and never leave your browser.',
    analyticsLabel: 'Analytics — optional, uses Google Analytics',
    analyticsHint:
      'Google Analytics, which counts page views so we can see which parts of the site get used. The script is not loaded at all unless you switch this on, and advertising and profiling signals are turned off. Switch it back off and it stops and its cookies are deleted. What you type into the calculator is never sent.',
    settingsFootnoteBefore:
      'This is a static site with no backend. Prices and ECB interest rates are published as files alongside the page and refreshed on a schedule, so your browser never contacts a price or rate provider, and no server of ours logs what you look up — every calculation runs on your own machine. You can change or withdraw this at any time from',
    settingsFootnoteLink: '“Storage preferences”',
    settingsFootnoteAfter: 'in the footer.',
    withdraw: 'Withdraw and ask again',
    save: 'Save choices',
  },

  footer: {
    notAdviceStrong: 'Educational tool — not financial advice.',
    notAdvice:
      'Every figure is an estimate and will differ from real-world results. Past performance does not predict future results.',
    sources: 'Prices: Alpha Vantage. Bank rates: ECB Data Portal.',
    disclaimer: 'Disclaimer',
    storagePreferences: 'Storage preferences',
  },
}

/**
 * Widened deliberately: with `as const` every string would be its own literal
 * type and no translation could differ from the English it is replacing.
 */
export type Dictionary = typeof en
