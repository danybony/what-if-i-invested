import type { Dictionary } from './en'

/**
 * Italian. Typed as `Dictionary`, so a key added to `en.ts` and not translated
 * here fails the build rather than silently falling back to English.
 *
 * Terminology follows what Italian retail investors actually read: PAC-style
 * "versamento" for a recurring contribution, "capitalizzazione" for compounding,
 * "rendimento" for return.
 */
export const it: Dictionary = {
  meta: {
    title: 'E se avessi investito',
    description:
      'Scopri cosa avrebbe fatto l’interesse composto con i tuoi soldi — e quanto ti avrebbe lasciato davanti al conto in banca.',
  },

  nav: {
    brand: 'E se avessi investito',
    basic: 'Base',
    advanced: 'Avanzata',
    language: 'Lingua',
  },

  frequency: {
    contribution: {
      monthly: 'Mensile',
      quarterly: 'Trimestrale',
      annually: 'Annuale',
    },
    every: {
      monthly: 'ogni mese',
      quarterly: 'ogni trimestre',
      annually: 'ogni anno',
    },
    compound: {
      daily: 'Giornaliera',
      monthly: 'Mensile',
      quarterly: 'Trimestrale',
      semiannually: 'Semestrale',
      annually: 'Annuale',
    },
    compounded: {
      daily: 'giornaliera',
      monthly: 'mensile',
      quarterly: 'trimestrale',
      semiannually: 'semestrale',
      annually: 'annuale',
    },
  },

  presets: {
    'global-equity': {
      label: 'ETF azionario globale',
      note: 'Un fondo che replica il mercato mondiale, come un MSCI World o un FTSE All-World.',
    },
    sp500: {
      label: 'S&P 500',
      note: 'Grandi società americane: rendimento storico più alto, oscillazioni più ampie.',
    },
    balanced: {
      label: 'Portafoglio 60 / 40',
      note: 'Sessanta per cento azioni, quaranta per cento obbligazioni.',
    },
    bonds: {
      label: 'Titoli di Stato',
      note: 'Debito pubblico di emittenti con rating elevato.',
    },
    'money-market': {
      label: 'Fondo monetario',
      note: 'Strumenti liquidi a breve termine che seguono i tassi di riferimento.',
    },
  },

  home: {
    ifLead: 'Se',
    yearsAgo: 'anni fa avessi iniziato a investire',
    onTopOf: ', oltre a un capitale iniziale di',
    todayYouWould: ', oggi avresti',
    moreThanBank: 'in più rispetto a lasciarli in banca.',
    assumingBefore: 'Ipotizzando un rendimento del',
    assumingAfter: (compounded: string) =>
      `l’anno con capitalizzazione ${compounded}, contro una banca che non paga nulla. Ogni cifra qui è una stima, non una previsione.`,
    seeHow: 'Scopri come si calcola',
    aria: {
      years: 'Numero di anni',
      contribution: 'Versamento ricorrente',
      initial: 'Capitale iniziale',
      rate: 'Rendimento annuo stimato',
    },
  },

  basic: {
    title: 'E se invece li avessi investiti?',
    intro:
      'L’interesse composto da una parte, il tuo conto in banca dall’altra. Il numero che conta è la distanza tra i due.',
    yourMoney: 'I tuoi soldi',
    initial: 'Capitale iniziale',
    contribution: 'Versamento',
    howOften: 'Ogni quanto',
    lengthOfTime: 'Durata',
    lengthHint: 'I versamenti sono aggiunti alla fine di ogni periodo.',
    years: 'anni',
    currency: 'Valuta',
    expectedReturn: 'Rendimento atteso',
    expectedReturnHint: 'Parti da una classe di prodotti, poi ritocca l’uno o l’altro numero.',
    rate: 'Rendimento stimato',
    variance: 'Intervallo di variazione',
    bandNote: (best: string, worst: string) =>
      `Lo scenario migliore e quello peggiore sono calcolati al ${best} e al ${worst}.`,
    noBandNote:
      'Imposta un intervallo di variazione per vedere lo scenario migliore e quello peggiore.',
    compoundFrequency: 'Capitalizzazione',
    bankTitle: 'Se li lasciassi in banca',
    bankHint:
      'La linea di confronto. Quasi nessun conto corrente dell’area euro paga qualcosa.',
    savingsRate: 'Tasso di interessi del conto',
    useEcbRate: (rate: string) => `Usa il tasso sui depositi dell’area euro (${rate})`,
    investedAt: (rate: string) => `Investiti al ${rate}`,
    inTheBankAt: (rate: string) => `In banca al ${rate}`,
    inTheBank: 'In banca',
    invested: 'Investiti',
    zeroRateNote:
      'Con un tasso dello 0% la linea della banca è semplicemente il denaro versato: ogni euro di differenza è interesse composto che non hai ottenuto.',
    yearByYear: 'Anno per anno',
    aria: {
      initial: 'Capitale iniziale',
      contribution: 'Versamento ricorrente',
      contributionFrequency: 'Frequenza dei versamenti',
      years: 'Durata in anni',
      currency: 'Valuta',
      rate: 'Rendimento stimato',
      variance: 'Intervallo di variazione del rendimento',
      compoundFrequency: 'Frequenza di capitalizzazione',
      bankRate: 'Tasso di interessi del conto in banca',
    },
  },

  advanced: {
    title: 'E se li avessi comprati davvero?',
    intro:
      'Costruisci un portafoglio di fondi e azioni reali, scegli una data di partenza e guarda cosa avrebbero fatto quei titoli con i tuoi soldi — a confronto con gli stessi soldi lasciati in banca.',
    portfolioTitle: 'Il tuo portafoglio',
    portfolioHint: 'I pesi devono sommare a 100%.',
    yourMoney: 'I tuoi soldi',
    startingFrom: 'A partire da',
    reinvest: 'Reinvesti i dividendi',
    reinvestHint:
      'Disattivo considera solo il prezzo. Attivo usa i prezzi rettificati, quindi le cedole vengono reinvestite: il confronto corretto per un fondo a distribuzione.',
    reinvestUnavailable: (symbols: string) =>
      `Per ${symbols} non sono pubblicati dati sui dividendi, quindi per questo portafoglio si può mostrare solo il rendimento di prezzo.`,
    historicalRates: 'Usa i tassi BCE storici reali',
    historicalRatesHint:
      'Applica il tasso sui depositi delle famiglie dell’area euro mese per mese.',
    historicalRatesUnavailable: 'I tassi BCE non sono disponibili al momento.',
    emptyTitle: 'Aggiungi un titolo per avviare il backtest',
    emptyHintBefore: 'Prova',
    emptyHintWorld: 'per un fondo globale,',
    emptyHintMilan: 'su Borsa Italiana, oppure una singola azione come',
    portfolioToday: 'Il tuo portafoglio oggi',
    inTheBankAtEcb: 'In banca ai tassi BCE',
    inTheBankAt: (rate: string) => `In banca al ${rate}`,
    inTheBank: 'In banca',
    portfolio: 'Portafoglio',
    clamped: (symbol: string, firstMonth: string, requested: string) =>
      `${symbol} ha prezzi solo da ${firstMonth}, quindi il backtest parte da lì invece che da ${requested}.`,
    yourReturn: 'Il tuo rendimento annuo',
    yourReturnNote: 'Pesato per il denaro, quindi tiene conto di quando hai versato.',
    holdingsReturn: 'Il rendimento dei titoli',
    holdingsReturnNote: 'Annualizzato, senza considerare i tempi dei versamenti.',
    worstFall: 'Perdita massima subita',
    worstFallNote: 'Il calo più profondo dal massimo al minimo che avresti attraversato.',
    whereMoneyEnded: 'Dove sono finiti i soldi',
    unitsLine: (units: string, weight: string) => `${units} quote · ${weight} del portafoglio`,
    driftNote: (currency: string) =>
      `I pesi si spostano al muoversi dei prezzi: non c’è ribilanciamento né conversione valutaria, quindi ogni titolo è quotato in ${currency}.`,
    yearByYear: (from: string, to: string) => `Anno per anno — da ${from} a ${to}`,
    aria: {
      startMonth: 'Mese di partenza',
    },
  },

  portfolio: {
    empty:
      'Aggiungi i fondi o le azioni che avresti comprato. Devono essere tutti quotati nella stessa valuta: la conversione tra valute non è simulata.',
    missingLead: 'Non trovi quello che cerchi?',
    missingLink: 'Chiedi di aggiungerlo',
    historyFrom: (month: string) => `Storico da ${month}`,
    weightAria: (symbol: string) => `Peso di ${symbol}`,
    removeAria: (symbol: string) => `Rimuovi ${symbol}`,
    loading: 'carico lo storico dei prezzi…',
    total: 'Totale',
    needs100: ' — deve essere 100%',
    splitEvenly: 'Dividi equamente',
  },

  search: {
    placeholder: 'Cerca un’azione o un ETF — es. VWCE.DE, Apple, S&P 500',
    loading: 'Carico i titoli…',
    noMatch: (query: string) =>
      `Nessun risultato per “${query}”. Il sito include una selezione dei fondi e delle azioni più diffusi, non tutti i titoli esistenti.`,
  },

  delta: {
    headline: 'Quanto guadagna investire, in più rispetto alla banca',
    rangeBefore: 'Tra',
    rangeMiddle: 'e',
    rangeAfter: 'nei diversi scenari.',
    paidInBefore: 'In entrambi i casi avresti versato',
    paidInAfter: '.',
    multipleBefore: 'Cioè',
    multipleAfter: 'quello che ti avrebbe lasciato la banca.',
    moreThanPaidIn: (percent: string) => `${percent} in più di quanto hai versato`,
    moneyPaidIn: 'Denaro versato',
  },

  chart: {
    rangeOfOutcomes: 'Intervallo degli scenari',
    bestCase: 'Scenario migliore',
    worstCase: 'Scenario peggiore',
    moneyPaidIn: 'Denaro versato',
    aheadOfBank: 'In più rispetto alla banca',
    summary: (invested: string, bank: string) =>
      `${invested} investiti contro ${bank} in banca`,
  },

  table: {
    year: 'Anno',
    date: 'Data',
    start: 'Inizio',
    today: 'Oggi',
    yearN: (n: string) => `Anno ${n}`,
    paidIn: 'Versato',
    worst: 'Peggiore',
    best: 'Migliore',
    difference: 'Differenza',
  },

  errors: {
    'no-holdings': () => 'Aggiungi almeno un titolo.',
    weights: (total: string) => `I pesi sommano a ${total} — devono arrivare a 100%.`,
    'mixed-currency': (currency: string, symbol: string, other: string) =>
      `Questo portafoglio è in ${currency}, ma ${symbol} è quotato in ${other}. La conversione valutaria non è simulata, quindi tutti i titoli devono essere nella stessa valuta.`,
    'no-overlap': (symbol: string) => `Nessuno storico prezzi disponibile per ${symbol}.`,
    'too-short': (from: string) =>
      `Questi titoli hanno meno di un mese di storico in comune (da ${from}).`,
    symbols: 'L’elenco di fondi e azioni non è ancora stato pubblicato.',
    history: (symbol: string) => `Per ${symbol} non è ancora stato pubblicato uno storico prezzi.`,
    rates: 'I tassi bancari non sono ancora stati pubblicati.',
    marketData: 'I dati di mercato non sono disponibili al momento.',
  },

  disclaimerModal: {
    title: 'Solo a scopo didattico',
    leadStrong:
      'Questo sito ha finalità puramente didattiche. Non fornisce consulenza finanziaria.',
    lead: 'Nulla di quanto trovi qui è un invito a comprare, vendere o detenere un investimento.',
    estimates:
      'Ogni cifra è una stima, calcolata con i migliori dati a nostra disposizione, e differirà dai risultati reali.',
    speakToSomeone:
      'Prima di qualsiasi decisione di investimento, rivolgiti a un professionista abilitato nel tuo Paese.',
    moreInfo: 'Maggiori informazioni',
    understand: 'Ho capito',
  },

  disclaimerPage: {
    metaTitle: 'Avvertenze — E se avessi investito',
    metaDescription:
      'Perché ogni cifra su questo sito è una stima, cosa non è compreso nei numeri e come vanno letti.',
    title: 'Avvertenze',
    educationalTitle: 'Uso didattico, non consulenza finanziaria',
    educationalBody:
      'Questo sito è uno strumento didattico. Nulla di quanto contiene è una raccomandazione personalizzata a comprare, vendere o detenere un investimento, e nulla tiene conto della tua situazione, dei tuoi obiettivi, della tua posizione fiscale o della tua tolleranza al rischio. Non siamo abilitati a fornirti consulenza e non intendiamo farlo.',
    educationalAdvice:
      'Prima di qualsiasi decisione di investimento, rivolgiti a un professionista abilitato nel tuo Paese.',
    estimatesTitle: 'Ogni numero qui è una stima',
    estimatesIntro:
      'I risultati sono calcolati con i migliori dati a nostra disposizione e differiranno da quanto avresti visto davvero. Tra i motivi:',
    estimatesPoints: [
      'I prezzi sono chiusure mensili da un’unica fonte gratuita, aggiornate a rotazione: il mese più recente può essere indietro di alcuni giorni e può ancora cambiare.',
      'Quando un fondo non è disponibile sulla sua borsa di riferimento, si usa una quotazione equivalente su un’altra piazza nella stessa valuta. È lo stesso strumento, quotato in modo leggermente diverso.',
      'Alcuni titoli mostrano al momento solo il rendimento di prezzo, senza reinvestimento dei dividendi. Il costruttore di portafoglio lo segnala quando accade.',
      'Tutti i valori sono al lordo di imposte, inflazione, commissioni, spread e conversione valutaria, che possono cambiare il risultato in modo sostanziale.',
      'Il portafoglio è simulato come acquisto e detenzione senza ribilanciamento, e tutti i titoli devono avere la stessa valuta, perché non viene applicata alcuna conversione di cambio.',
    ],
    projectionsTitle: 'Le proiezioni sono ipotesi, non previsioni',
    projectionsBody:
      'Nella modalità base il rendimento è un numero che scegli tu. I valori preimpostati sono medie storiche di lungo periodo arrotondate, offerte come punto di partenza: non sono previsioni e nessun rendimento è garantito.',
    projectionsStrong: 'I rendimenti passati non predicono quelli futuri.',
    projectionsSmooth:
      'I rendimenti reali non arrivano in rate annuali uguali. Una curva regolare è utile per capire come si comporta l’interesse composto nel tempo, ma non è l’aspetto che ha davvero il saldo di un conto lungo il percorso.',
    dataTitle: 'Da dove arrivano i dati',
    dataBody:
      'I prezzi di azioni e fondi provengono da Alpha Vantage come chiusure mensili rettificate. I tassi bancari provengono dall’ECB Data Portal (depositi delle famiglie dell’area euro). Entrambi sono distribuiti come file statici insieme al sito e aggiornati periodicamente, quindi nulla di ciò che fai qui viene inviato a un fornitore di dati.',
    closing:
      'Considera quello che vedi qui come un’illustrazione di come funziona l’interesse composto, non come un resoconto di ciò che i tuoi soldi hanno fatto o faranno.',
    back: '← Torna al calcolatore',
  },

  consent: {
    barTitle: 'I tuoi dati su questo sito',
    barBody:
      'Salviamo una piccola registrazione nel tuo browser per ricordare questa scelta e il fatto che hai letto le avvertenze. Questo è necessario perché il sito funzioni. Tutto il resto è facoltativo e resta disattivato finché non lo attivi tu.',
    barQuiet:
      'Nulla di ciò che inserisci nel calcolatore lascia il tuo dispositivo: ogni cifra è calcolata nel tuo browser. Non c’è pubblicità né profilazione, e nulla viene venduto.',
    manage: 'Gestisci',
    rejectAll: 'Rifiuta tutto',
    acceptAll: 'Accetta tutto',
    regionAria: 'Consenso su archiviazione e cookie',
    settingsTitle: 'Preferenze di archiviazione',
    settingsBody:
      'Questo sito usa l’archiviazione del browser anziché i cookie lato server, che la normativa sulla privacy tratta allo stesso modo. Ecco tutto ciò che può salvare.',
    necessaryLabel: 'Strettamente necessari — sempre attivi',
    necessaryHint:
      'Tre registrazioni: che hai letto le avvertenze, la scelta che fai qui e la lingua, se ne selezioni una. Senza di esse ti verrebbe chiesto di nuovo a ogni pagina. Non contengono alcun identificativo e non lasciano mai il tuo browser.',
    analyticsLabel: 'Statistiche — facoltative, usano Google Analytics',
    analyticsHint:
      'Google Analytics, che conta le visite alle pagine per capire quali parti del sito vengono usate. Lo script non viene caricato affatto se non lo attivi, e i segnali pubblicitari e di profilazione sono disattivati. Se lo disattivi si ferma e i suoi cookie vengono eliminati. Quello che digiti nel calcolatore non viene mai inviato.',
    settingsFootnoteBefore:
      'Questo è un sito statico senza backend. I prezzi e i tassi BCE sono pubblicati come file insieme alla pagina e aggiornati periodicamente, quindi il tuo browser non contatta mai un fornitore di prezzi o tassi e nessun nostro server registra cosa consulti: ogni calcolo avviene sul tuo dispositivo. Puoi modificare o revocare questa scelta in qualsiasi momento da',
    settingsFootnoteLink: '“Preferenze di archiviazione”',
    settingsFootnoteAfter: 'nel piè di pagina.',
    withdraw: 'Revoca e chiedimelo di nuovo',
    save: 'Salva le scelte',
  },

  footer: {
    notAdviceStrong: 'Strumento didattico — non è consulenza finanziaria.',
    notAdvice:
      'Ogni cifra è una stima e differirà dai risultati reali. I rendimenti passati non predicono quelli futuri.',
    sources: 'Prezzi: Alpha Vantage. Tassi bancari: ECB Data Portal.',
    disclaimer: 'Avvertenze',
    storagePreferences: 'Preferenze di archiviazione',
  },
}
