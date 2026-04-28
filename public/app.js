const defaultSheetUrl = "https://docs.google.com/spreadsheets/d/1T7EkKbpCWymh5kb2O_lJuuJWQUWrLuiSQaKM1J8mugs/edit?gid=0#gid=0";

const brokers = [
  { id: "fidelity", name: "Fidelity", domain: "fidelity.com" },
  { id: "schwab", name: "Charles Schwab", domain: "schwab.com" },
  { id: "robinhood", name: "Robinhood", domain: "robinhood.com" },
  { id: "moomoo", name: "Moomoo", domain: "moomoo.com" },
  { id: "webull", name: "Webull", domain: "webull.com" },
  { id: "tastytrade", name: "Tastytrade", domain: "tastytrade.com" },
  { id: "ibkr", name: "Interactive Brokers", domain: "interactivebrokers.com" },
  { id: "etrade", name: "E*TRADE", domain: "etrade.com" },
  { id: "other", name: "Other", domain: "" },
];

const defaultPortfolio = {
  editing: false,
  discount: 10,
  accounts: [
    { id: crypto.randomUUID(), broker: "schwab", name: "Primary brokerage", value: 250000 },
    { id: crypto.randomUUID(), broker: "fidelity", name: "Retirement brokerage", value: 150000 },
  ],
};

const etfSymbols = new Set(["VOO", "QQQ", "BLV", "SPY", "IWM", "DIA"]);
const whiteLogoSymbols = new Set([
  "VOO", "META", "NVDA", "HOOD", "MU", "SCHW", "COF", "BACK", "BAC", "SOFI",
  "CELH", "GS", "WFC", "GOOG", "ORCL", "PGR", "AZP", "BABA", "JPN", "NOW",
  "DAL", "QCOM", "FDX", "AMAT", "TSLA", "HD", "PYPL", "SHOP", "WMT", "CRWD", "COST",
]);

const state = {
  rows: [],
  quotes: {},
  removed: new Set(JSON.parse(localStorage.getItem("removedTickers") || "[]")),
  starred: new Set(JSON.parse(localStorage.getItem("starredTickers") || "[]")),
  added: JSON.parse(localStorage.getItem("addedTickers") || "[]"),
  portfolio: normalizePortfolio(JSON.parse(localStorage.getItem("portfolioLiquidity") || "null") || defaultPortfolio),
  portfolioDraft: null,
  settings: JSON.parse(localStorage.getItem("scorecardSettings") || "null") || {
    sheetUrl: defaultSheetUrl,
    aaaYield: "",
    bondYield: "",
    linkProvider: "stockanalysis",
  },
  actionLog: JSON.parse(localStorage.getItem("actionLog") || "[]"),
  activeLogContext: null,
  filter: "all",
  search: "",
  sort: "score",
  starredOnly: false,
  compactRows: JSON.parse(localStorage.getItem("compactRows") || "false"),
  sidebarCollapsed: JSON.parse(localStorage.getItem("sidebarCollapsed") || "false"),
  lastSync: null,
};

const els = {
  appShell: document.querySelector(".app-shell"),
  sidebarToggle: document.querySelector("#sidebarToggle"),
  aaaYield: document.querySelector("#aaaYield"),
  bondYield: document.querySelector("#bondYield"),
  marketNotes: document.querySelector("#marketNotes"),
  totalTickers: document.querySelector("#totalTickers"),
  buyCount: document.querySelector("#buyCount"),
  needsScoringCount: document.querySelector("#needsScoringCount"),
  lastSync: document.querySelector("#lastSync"),
  scoreRows: document.querySelector("#scoreRows"),
  rowTemplate: document.querySelector("#rowTemplate"),
  accountTemplate: document.querySelector("#accountTemplate"),
  searchInput: document.querySelector("#searchInput"),
  searchAddBtn: document.querySelector("#searchAddBtn"),
  densityToggle: document.querySelector("#densityToggle"),
  refreshBtn: document.querySelector("#refreshBtn"),
  addTickerForm: document.querySelector("#addTickerForm"),
  tickerInput: document.querySelector("#tickerInput"),
  starredOnly: document.querySelector("#starredOnly"),
  accountsList: document.querySelector("#accountsList"),
  addAccountBtn: document.querySelector("#addAccountBtn"),
  discountInput: document.querySelector("#discountInput"),
  portfolioView: document.querySelector("#portfolioView"),
  portfolioDialog: document.querySelector("#portfolioDialog"),
  portfolioEditBtn: document.querySelector("#portfolioEditBtn"),
  portfolioSaveBtn: document.querySelector("#portfolioSaveBtn"),
  portfolioCancelBtn: document.querySelector("#portfolioCancelBtn"),
  portfolioGross: document.querySelector("#portfolioGross"),
  portfolioDiscount: document.querySelector("#portfolioDiscount"),
  portfolioLiquidity: document.querySelector("#portfolioLiquidity"),
  actionLog: document.querySelector("#actionLog"),
  clearLogBtn: document.querySelector("#clearLogBtn"),
  actionableCard: document.querySelector("#actionableCard"),
  settingsBtn: document.querySelector("#settingsBtn"),
  settingsDialog: document.querySelector("#settingsDialog"),
  sheetUrlInput: document.querySelector("#sheetUrlInput"),
  aaaOverrideInput: document.querySelector("#aaaOverrideInput"),
  bondOverrideInput: document.querySelector("#bondOverrideInput"),
  linkProviderInput: document.querySelector("#linkProviderInput"),
  saveSettingsBtn: document.querySelector("#saveSettingsBtn"),
  logDialog: document.querySelector("#logDialog"),
  logTitle: document.querySelector("#logTitle"),
  logLogo: document.querySelector("#logLogo"),
  logLogoImg: document.querySelector("#logLogoImg"),
  logSecurityName: document.querySelector("#logSecurityName"),
  logSecurityMeta: document.querySelector("#logSecurityMeta"),
  logActionType: document.querySelector("#logActionType"),
  logTicker: document.querySelector("#logTicker"),
  logPercent: document.querySelector("#logPercent"),
  logAmount: document.querySelector("#logAmount"),
  logDateOpened: document.querySelector("#logDateOpened"),
  logExpiry: document.querySelector("#logExpiry"),
  logDte: document.querySelector("#logDte"),
  logPrice: document.querySelector("#logPrice"),
  logPriceLabel: document.querySelector("#logPriceLabel"),
  logStrike: document.querySelector("#logStrike"),
  logDelta: document.querySelector("#logDelta"),
  logStockPrice: document.querySelector("#logStockPrice"),
  logStrikeVsStock: document.querySelector("#logStrikeVsStock"),
  logNotes: document.querySelector("#logNotes"),
  saveLogBtn: document.querySelector("#saveLogBtn"),
};

const ratingMeta = [
  { key: "valuation", label: "Valuation", max: 20, note: "Higher means cheaper on fundamentals." },
  { key: "growth", label: "Growth", max: 20, note: "Higher means stronger EPS and revenue growth." },
  { key: "moat", label: "Moat", max: 20, note: "Higher means more durable competitive advantage." },
  { key: "executionRisk", label: "Execution Risk", max: 10, note: "Higher means lower core business risk." },
  { key: "economy", label: "Economy", max: 30, note: "Higher means a stronger macro backdrop." },
];

state.settings = {
  sheetUrl: defaultSheetUrl,
  aaaYield: "",
  bondYield: "",
  linkProvider: "stockanalysis",
  ...state.settings,
};

const fmt = {
  money(value) {
    return value === null || value === undefined || Number.isNaN(value)
      ? "--"
      : value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  },
  price(value) {
    return value === null || value === undefined || Number.isNaN(value)
      ? "--"
      : value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  },
  percent(value) {
    return value === null || value === undefined || Number.isNaN(value) ? "--" : `${Number(value).toFixed(1)}%`;
  },
  number(value, digits = 1) {
    return value === null || value === undefined || Number.isNaN(value) ? "--" : Number(value).toFixed(digits);
  },
  compact(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return "--";
    return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
  },
  dateTime(value) {
    if (!value) return "--";
    return new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  },
};

function persist() {
  localStorage.setItem("removedTickers", JSON.stringify([...state.removed]));
  localStorage.setItem("starredTickers", JSON.stringify([...state.starred]));
  localStorage.setItem("addedTickers", JSON.stringify(state.added));
  localStorage.setItem("portfolioLiquidity", JSON.stringify({ ...state.portfolio, editing: false }));
  localStorage.setItem("scorecardSettings", JSON.stringify(state.settings));
  localStorage.setItem("actionLog", JSON.stringify(state.actionLog));
  localStorage.setItem("compactRows", JSON.stringify(state.compactRows));
  localStorage.setItem("sidebarCollapsed", JSON.stringify(state.sidebarCollapsed));
}

function brokerById(id) {
  return brokers.find((broker) => broker.id === id) || brokers.at(-1);
}

function inferBroker(account = {}) {
  const text = `${account.broker || ""} ${account.name || ""}`.toLowerCase();
  if (text.includes("fidelity") || text.includes("retirement")) return "fidelity";
  if (text.includes("schwab") || text.includes("primary")) return "schwab";
  if (text.includes("robinhood")) return "robinhood";
  if (text.includes("moomoo")) return "moomoo";
  if (text.includes("webull")) return "webull";
  if (text.includes("tasty")) return "tastytrade";
  if (text.includes("interactive") || text.includes("ibkr")) return "ibkr";
  if (text.includes("etrade") || text.includes("e*trade")) return "etrade";
  return "other";
}

function normalizePortfolio(portfolio) {
  const source = portfolio || defaultPortfolio;
  const accounts = Array.isArray(source.accounts) && source.accounts.length ? source.accounts : defaultPortfolio.accounts;
  return {
    editing: false,
    discount: Number(source.discount ?? defaultPortfolio.discount) || 0,
    accounts: accounts.map((account) => {
      const broker = brokers.some((item) => item.id === account.broker) ? account.broker : inferBroker(account);
      return {
        id: account.id || crypto.randomUUID(),
        broker,
        name: account.name || brokerById(broker).name,
        value: Number(account.value) || 0,
      };
    }),
  };
}

function brokerLogoUrl(broker) {
  return broker.domain ? `https://www.google.com/s2/favicons?domain=${broker.domain}&sz=64` : "";
}

function portfolioTotals(portfolio = state.portfolio) {
  const gross = portfolio.accounts.reduce((sum, account) => sum + (Number(account.value) || 0), 0);
  const discount = gross * ((Number(portfolio.discount) || 0) / 100);
  return { gross, discount, liquidity: gross - discount };
}

function actionStatus(raw) {
  const lower = String(raw || "").toLowerCase();
  if (lower.startsWith("yes")) return "yes";
  if (lower.includes("radar")) return "radar";
  return "no";
}

function isActionable(row) {
  return [row.buyShares, row.sellPuts, row.buyCalls].some((value) => actionStatus(value) === "yes");
}

function scoreClass(score) {
  if (score === null || score === undefined) return "low";
  if (score >= 75) return "high";
  if (score >= 60) return "mid";
  return "low";
}

function logoSymbol(symbol) {
  return symbol.slice(0, 2).replace(".", "");
}

function companyLogo(symbol) {
  const yahooSymbol = symbol.toUpperCase().replace(".", "-");
  return `https://financialmodelingprep.com/image-stock/${encodeURIComponent(yahooSymbol)}.png`;
}

function cleanTicker(value) {
  return String(value || "").trim().toUpperCase().replace("-", ".");
}

function tickerExists(symbol) {
  return mergedRows().some((row) => row.symbol === symbol);
}

async function addTicker(symbol) {
  const clean = cleanTicker(symbol);
  if (!/^[A-Z][A-Z0-9.]{0,7}$/.test(clean)) return;
  state.removed.delete(clean);
  if (!state.added.includes(clean) && !state.rows.some((row) => row.symbol === clean)) state.added.push(clean);
  persist();
  await refreshQuotes();
  renderRows();
}

function externalLinks(row) {
  const symbol = row.quoteSymbol || row.symbol.replace(".", "-");
  const stockAnalysisPath = isEtf(row) ? "etf" : "stocks";
  return [
    `StockAnalysis: https://stockanalysis.com/${stockAnalysisPath}/${symbol.toLowerCase().replace("-", ".")}/`,
    `TradingView: https://www.tradingview.com/symbols/${symbol}/`,
    `Barchart: https://www.barchart.com/stocks/quotes/${symbol}`,
  ].join("\n");
}

function isEtf(row) {
  return row.quote?.instrumentType === "ETF" || etfSymbols.has(row.symbol);
}

function symbolUrl(row) {
  const symbol = row.quoteSymbol || row.symbol.replace(".", "-");
  const stockAnalysisSymbol = symbol.toLowerCase().replace("-", ".");
  if (state.settings.linkProvider === "tradingview") return `https://www.tradingview.com/symbols/${symbol}/`;
  if (state.settings.linkProvider === "barchart") return `https://www.barchart.com/stocks/quotes/${symbol}`;
  return `https://stockanalysis.com/${isEtf(row) ? "etf" : "stocks"}/${stockAnalysisSymbol}/`;
}

function parseSheetDate(value) {
  const match = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  return new Date(year, Number(match[1]) - 1, Number(match[2]));
}

function daysAgoText(value) {
  const date = parseSheetDate(value);
  if (!date) return "";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today - date) / 86400000);
  if (diff === 0) return "today";
  if (diff === 1) return "1 day ago";
  if (diff > 1) return `${diff} days ago`;
  return "future date";
}

function parseAction(raw, type, liquidity) {
  const text = String(raw || "").trim();
  const lower = text.toLowerCase();
  const percent = Number((text.match(/(\d+(?:\.\d+)?)\s*%/) || [])[1]);
  const years = Number((text.match(/(\d+(?:\.\d+)?)\s*yr/) || [])[1]);
  const below = Number((text.match(/(\d+(?:\.\d+)?)\s*%\s*below/i) || [])[1]);
  const above = Number((text.match(/(\d+(?:\.\d+)?)\s*%\s*above/i) || [])[1]);
  const status = lower.startsWith("yes") ? "yes" : lower.includes("radar") ? "radar" : "no";
  const amount = status === "yes" && Number.isFinite(percent) ? liquidity * (percent / 100) : null;
  const labels = { shares: "Buy shares", puts: "Sell puts", calls: "Buy calls" };
  return { type, label: labels[type], text: text || "no", status, percent, years, below, above, amount };
}

function mergedRows() {
  const sheetRows = state.rows.filter((row) => !state.removed.has(row.symbol));
  const existing = new Set(sheetRows.map((row) => row.symbol));
  const addedRows = state.added
    .filter((symbol) => !state.removed.has(symbol) && !existing.has(symbol))
    .map((symbol) => ({
      id: symbol,
      symbol,
      quoteSymbol: symbol.replace(".", "-"),
      percentOfIv: null,
      valuation: null,
      growth: null,
      moat: null,
      executionRisk: null,
      economy: null,
      score: null,
      buyShares: "Needs scoring",
      sellPuts: "Needs scoring",
      buyCalls: "Needs scoring",
      dateUpdated: "",
      epsTtm: null,
      peNoGrowth: 7,
      epsGrowth: 0,
      intrinsicValue: null,
      currentPrice: null,
      source: "Added locally",
    }));

  return [...sheetRows, ...addedRows].map((row) => {
    const quote = state.quotes[row.quoteSymbol] || {};
    const eps = quote.epsTtm ?? row.epsTtm;
    const price = quote.price ?? row.currentPrice;
    const intrinsic = eps !== null && eps !== undefined && row.peNoGrowth !== null && row.epsGrowth !== null
      ? eps * (row.peNoGrowth + row.epsGrowth)
      : row.intrinsicValue;
    return {
      ...row,
      epsTtm: eps,
      currentPrice: price,
      intrinsicValue: intrinsic,
      percentOfIv: price && intrinsic ? (price / intrinsic) * 100 : row.percentOfIv,
      quote,
    };
  });
}

function filteredRows() {
  const needle = state.search.trim().toLowerCase();
  return mergedRows()
    .filter((row) => !state.starredOnly || state.starred.has(row.symbol))
    .filter((row) => {
      if (!needle) return true;
      return [row.symbol, row.quote?.name, row.buyShares, row.sellPuts, row.buyCalls].join(" ").toLowerCase().includes(needle);
    })
    .filter((row) => {
      if (state.filter === "actionable") return isActionable(row);
      if (state.filter === "radar") return /radar/i.test(`${row.buyShares} ${row.sellPuts} ${row.buyCalls}`);
      if (state.filter === "needs-scoring") return row.score === null || row.score === undefined;
      return true;
    })
    .sort((a, b) => {
      if (state.sort === "symbol") return a.symbol.localeCompare(b.symbol);
      if (state.sort === "percentOfIv") return (a.percentOfIv ?? 9999) - (b.percentOfIv ?? 9999);
      if (state.sort === "updated") return String(b.dateUpdated).localeCompare(String(a.dateUpdated));
      return (b.score ?? -1) - (a.score ?? -1);
    });
}

function renderSummary(rows) {
  els.totalTickers.textContent = rows.length;
  els.buyCount.textContent = rows.filter(isActionable).length;
  els.needsScoringCount.textContent = rows.filter((row) => row.score === null || row.score === undefined).length;
  els.lastSync.textContent = fmt.dateTime(state.lastSync);
}

function renderPortfolio() {
  state.portfolio = normalizePortfolio(state.portfolio);
  const totals = portfolioTotals();
  els.portfolioGross.textContent = fmt.money(totals.gross);
  els.portfolioDiscount.textContent = `${fmt.money(totals.discount)} (${fmt.percent(state.portfolio.discount)})`;
  els.portfolioLiquidity.textContent = fmt.money(totals.liquidity);
  els.portfolioEditBtn.textContent = "Edit";
  els.portfolioEditBtn.disabled = false;
  renderPortfolioView();
}

function renderPortfolioView() {
  els.portfolioView.replaceChildren();
  for (const account of state.portfolio.accounts) {
    const broker = brokerById(account.broker);
    const item = document.createElement("div");
    item.className = "portfolio-account";
    item.innerHTML = `
      <span class="broker-logo">${brokerLogoUrl(broker) ? `<img alt="" src="${brokerLogoUrl(broker)}">` : broker.name.slice(0, 2)}</span>
      <span>${account.name || broker.name}</span>
      <strong>${fmt.money(Number(account.value) || 0)}</strong>
    `;
    els.portfolioView.append(item);
  }
}

function renderPortfolioEditor() {
  const draft = state.portfolioDraft;
  if (!draft) return;
  els.discountInput.value = draft.discount;
  els.accountsList.replaceChildren();
  for (const account of draft.accounts) {
    const fragment = els.accountTemplate.content.cloneNode(true);
    const brokerSelect = fragment.querySelector(".account-broker");
    const logo = fragment.querySelector(".broker-logo");
    const name = fragment.querySelector(".account-name");
    const value = fragment.querySelector(".account-value");
    const remove = fragment.querySelector(".account-remove");

    for (const broker of brokers) {
      const option = document.createElement("option");
      option.value = broker.id;
      option.textContent = broker.name;
      brokerSelect.append(option);
    }
    brokerSelect.value = account.broker || "other";
    name.value = account.name || "";
    value.value = account.value || 0;

    const syncLogo = () => {
      const broker = brokerById(brokerSelect.value);
      logo.innerHTML = brokerLogoUrl(broker) ? `<img alt="" src="${brokerLogoUrl(broker)}">` : broker.name.slice(0, 2);
    };
    syncLogo();
    brokerSelect.addEventListener("change", () => {
      account.broker = brokerSelect.value;
      syncLogo();
    });
    name.addEventListener("input", () => { account.name = name.value; });
    value.addEventListener("input", () => { account.value = Number(value.value) || 0; });
    remove.addEventListener("click", () => {
      draft.accounts = draft.accounts.filter((item) => item.id !== account.id);
      renderPortfolioEditor();
    });
    els.accountsList.append(fragment);
  }
}

function renderActionLog() {
  const liquidity = portfolioTotals().liquidity;
  const committed = state.actionLog.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const ratio = liquidity ? (committed / liquidity) * 100 : 0;
  els.actionLog.replaceChildren();

  const summary = document.createElement("div");
  summary.className = "log-summary";
  summary.innerHTML = `<span>Logged exposure</span><strong>${fmt.money(committed)}</strong><small>${fmt.percent(ratio)} of liquidity</small>`;
  els.actionLog.append(summary);

  if (!state.actionLog.length) {
    const empty = document.createElement("p");
    empty.className = "empty-log";
    empty.textContent = "No actions logged yet.";
    els.actionLog.append(empty);
    return;
  }

  for (const item of state.actionLog.slice(0, 8)) {
    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.innerHTML = `<strong>${item.symbol}</strong><span>${item.label}</span><small>${fmt.money(item.amount)} opened ${item.dateOpened || "--"}</small>`;
    els.actionLog.append(entry);
  }
}

function renderHarvey(container, row) {
  container.replaceChildren();
  for (const meta of ratingMeta) {
    const value = row[meta.key];
    const ratio = value === null || value === undefined ? 0 : Math.max(0, Math.min(1, value / meta.max));
    const ball = document.createElement("span");
    ball.className = "harvey-ball";
    ball.style.setProperty("--fill", `${ratio * 100}%`);
    ball.title = `${meta.label}: ${value ?? "--"} / ${meta.max}. ${meta.note}`;
    container.append(ball);
  }
}

function actionTooltip(action, row) {
  if (action.status === "yes" && action.type === "shares") {
    return `${action.label}: YES. Up to ${fmt.percent(action.percent)} of 7-day liquidity, about ${fmt.money(action.amount)} for ${row.symbol}.`;
  }
  if (action.status === "yes" && action.type === "puts") {
    return `${action.label}: YES. Use up to ${fmt.percent(action.percent)} of account value, target ${action.years || "--"} years out and around ${fmt.percent(action.below)} below current price.`;
  }
  if (action.status === "yes" && action.type === "calls") {
    return `${action.label}: YES. Use up to ${fmt.percent(action.percent)} of account value, target ${action.years || "--"} years out and around ${fmt.percent(action.above)} above current price.`;
  }
  if (action.status === "radar") return `${action.label}: on radar, but not an active yes.`;
  return `${action.label}: no active action.`;
}

function logsFor(row, action) {
  return state.actionLog.filter((item) => item.symbol === row.symbol && item.actionType === action.type);
}

function actionsForRow(row) {
  const liquidity = portfolioTotals().liquidity;
  return [
    parseAction(row.buyShares, "shares", liquidity),
    parseAction(row.sellPuts, "puts", liquidity),
    parseAction(row.buyCalls, "calls", liquidity),
  ];
}

function renderPotentialActions(container, row) {
  const actions = actionsForRow(row);
  container.replaceChildren();

  for (const action of actions) {
    const logged = logsFor(row, action);
    const chip = document.createElement("div");
    chip.className = `action-chip ${action.status} ${logged.length ? "logged" : ""}`;
    chip.title = `${actionTooltip(action, row)}${logged.length ? `\nLogged: ${logged.length} action(s), ${fmt.money(logged.reduce((sum, item) => sum + Number(item.amount || 0), 0))}` : ""}`;
    const detail = action.status === "yes" && action.amount
      ? fmt.money(action.amount)
      : action.status === "radar"
        ? "Radar"
        : "No";
    chip.innerHTML = `<span class="status-dot"></span><span>${action.label}</span><strong>${detail}</strong>`;
    if (logged.length) {
      const badge = document.createElement("span");
      badge.className = "logged-badge";
      badge.textContent = `${logged.length} logged`;
      chip.append(badge);
    }
    if (action.status === "yes") {
      const log = document.createElement("button");
      log.type = "button";
      log.className = "log-button";
      log.textContent = "Log";
      log.title = `Log ${action.label} for ${row.symbol}`;
      log.addEventListener("click", () => openLogDialog(row, action));
      chip.append(log);
    }
    container.append(chip);
  }
}

function priceTooltip(row, includeName = true) {
  const q = row.quote || {};
  return [
    includeName ? q.name || row.symbol : null,
    q.exchange ? `Exchange: ${q.exchange}` : null,
    `Previous close: ${fmt.price(q.previousClose)}`,
    `Day range: ${fmt.price(q.dayLow)} - ${fmt.price(q.dayHigh)}`,
    `52-week range: ${fmt.price(q.fiftyTwoWeekLow)} - ${fmt.price(q.fiftyTwoWeekHigh)}`,
    `Volume: ${fmt.compact(q.volume)}`,
    q.changePercent !== null && q.changePercent !== undefined ? `Today: ${fmt.percent(q.changePercent)}` : null,
  ].filter(Boolean).join("\n");
}

function renderRows() {
  const rows = filteredRows();
  const allRows = mergedRows();
  renderSummary(allRows);
  renderSearchSuggestion(allRows);
  els.scoreRows.replaceChildren();

  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 10;
    td.className = "empty";
    td.textContent = "No tickers match the current view.";
    tr.append(td);
    els.scoreRows.append(tr);
    return;
  }

  for (const row of rows) {
    const fragment = els.rowTemplate.content.cloneNode(true);
    const tr = fragment.querySelector("tr");
    const star = fragment.querySelector(".star-btn");
    const remove = fragment.querySelector(".remove-btn");
    const score = fragment.querySelector(".score-pill");
    const iv = fragment.querySelector(".iv-percent");
    const price = fragment.querySelector(".price");
    const logo = fragment.querySelector(".ticker-logo");
    const logoImg = fragment.querySelector(".ticker-logo-img");
    const symbol = fragment.querySelector(".symbol");

    tr.classList.toggle("potential-buy-row", isActionable(row));
    symbol.textContent = row.symbol;
    symbol.href = symbolUrl(row);
    symbol.title = `${row.quote?.name || row.symbol}\n${priceTooltip(row, false)}\n${externalLinks(row)}`;
    const ago = daysAgoText(row.dateUpdated);
    fragment.querySelector(".updated").textContent = row.dateUpdated ? `Updated ${row.dateUpdated}${ago ? ` (${ago})` : ""}` : row.source;

    logo.dataset.fallback = logoSymbol(row.symbol);
    logo.classList.toggle("white-logo", whiteLogoSymbols.has(row.symbol));
    logoImg.alt = row.quote?.name || row.symbol;
    logoImg.src = companyLogo(row.symbol);
    logoImg.addEventListener("error", () => {
      logoImg.remove();
      logo.textContent = logo.dataset.fallback;
    }, { once: true });

    score.textContent = row.score ?? "New";
    score.className = `score-pill ${scoreClass(row.score)}`;
    score.title = row.score === null || row.score === undefined ? "Needs scoring" : `Overall score: ${row.score} / 100`;

    iv.textContent = fmt.percent(row.percentOfIv);
    iv.className = `iv-percent ${row.percentOfIv <= 100 ? "cheap" : "rich"}`;
    iv.title = "% of intrinsic value. Lower generally means cheaper relative to the sheet's intrinsic value estimate.";

    price.textContent = fmt.price(row.currentPrice);
    price.title = priceTooltip(row);
    fragment.querySelector(".intrinsic").textContent = fmt.price(row.intrinsicValue);
    fragment.querySelector(".eps").textContent = fmt.number(row.epsTtm, 2);
    renderHarvey(fragment.querySelector(".harvey-set"), row);
    renderPotentialActions(fragment.querySelector(".potential-actions"), row);

    star.classList.toggle("active", state.starred.has(row.symbol));
    star.title = state.starred.has(row.symbol) ? "Unstar ticker" : "Star ticker";
    star.addEventListener("click", () => {
      if (state.starred.has(row.symbol)) state.starred.delete(row.symbol);
      else state.starred.add(row.symbol);
      persist();
      renderRows();
    });
    remove.addEventListener("click", () => {
      state.removed.add(row.symbol);
      state.added = state.added.filter((item) => item !== row.symbol);
      persist();
      renderRows();
    });

    tr.dataset.symbol = row.symbol;
    els.scoreRows.append(fragment);
  }
}

function renderSearchSuggestion(rows = mergedRows()) {
  const symbol = cleanTicker(state.search);
  const canAdd = /^[A-Z][A-Z0-9.]{0,7}$/.test(symbol) && !rows.some((row) => row.symbol === symbol);
  els.searchAddBtn.hidden = !canAdd;
  els.searchAddBtn.textContent = canAdd ? `Add ${symbol}` : "";
  els.searchAddBtn.title = canAdd ? `Add ${symbol} to the watchlist` : "";
}

async function refreshQuotes() {
  const symbols = mergedRows().map((row) => row.quoteSymbol || row.symbol).filter(Boolean);
  if (!symbols.length) return;
  const response = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols.join(","))}`);
  if (!response.ok) throw new Error("Quote refresh failed");
  const payload = await response.json();
  state.quotes = payload.quotes || {};
  state.lastSync = payload.updatedAt;
}

async function autoRefreshMarketData() {
  await refreshQuotes();
  renderRows();
}

function marketState(note) {
  const lower = String(note.note || "").toLowerCase();
  if (lower.includes("over")) return { icon: "↑", className: "over", label: "Overvalued" };
  if (lower.includes("under")) return { icon: "↓", className: "under", label: "Undervalued" };
  return { icon: "=", className: "fair", label: "At value" };
}

function renderMarketNotes(notes) {
  const labels = ["S&P 500", "Nasdaq 100"];
  const table = document.createElement("table");
  table.className = "market-table";
  for (const [index, note] of notes.entries()) {
    const stateInfo = marketState(note);
    const label = labels[index] || "Market";
    const value = String(note.note || "").match(/(\d+(?:\.\d+)?)\s*%/)?.[1];
    const signedValue = value ? `${stateInfo.className === "over" ? "+" : stateInfo.className === "under" ? "-" : ""}${value}%` : "--";
    const row = document.createElement("tr");
    row.className = stateInfo.className;
    row.title = `${label} is ${note.note || stateInfo.label} as of ${note.date || "the sheet date"}.`;
    row.innerHTML = `<td><span>${stateInfo.icon}</span><b>${label}</b></td><td class="market-value">${signedValue}</td><td class="market-date">${note.date}</td>`;
    table.append(row);
  }
  els.marketNotes.replaceChildren(table);
}

function applyGlobalOverrides(assumptions) {
  const aaa = state.settings.aaaYield !== "" ? Number(state.settings.aaaYield) : assumptions?.avgYieldAaaBonds;
  const bond = state.settings.bondYield !== "" ? Number(state.settings.bondYield) : assumptions?.currentBondYield;
  els.aaaYield.textContent = fmt.percent(aaa);
  els.bondYield.textContent = fmt.percent(bond);
}

async function loadScorecard(force = false) {
  els.refreshBtn.disabled = true;
  els.refreshBtn.textContent = "Refreshing";
  const params = new URLSearchParams();
  if (force) params.set("force", "1");
  if (state.settings.sheetUrl) params.set("sheet", state.settings.sheetUrl);
  const response = await fetch(`/api/scorecard?${params.toString()}`);
  if (!response.ok) throw new Error("Scorecard load failed");
  const payload = await response.json();
  state.rows = payload.rows || [];
  state.lastSync = payload.updatedAt;
  applyGlobalOverrides(payload.assumptions);
  renderMarketNotes(payload.assumptions?.marketNotes || []);
  await refreshQuotes();
  renderRows();
  els.refreshBtn.disabled = false;
  els.refreshBtn.textContent = "Refresh";
}

function openLogDialog(row, action) {
  state.activeLogContext = { row, action };
  const today = new Date().toISOString().slice(0, 10);
  els.logTitle.textContent = `Log ${action.label}`;
  els.logLogo.dataset.fallback = logoSymbol(row.symbol);
  els.logLogo.textContent = "";
  els.logLogoImg.src = companyLogo(row.symbol);
  els.logLogoImg.alt = row.quote?.name || row.symbol;
  els.logLogo.append(els.logLogoImg);
  els.logLogoImg.addEventListener("error", () => {
    els.logLogoImg.remove();
    els.logLogo.textContent = els.logLogo.dataset.fallback;
  }, { once: true });
  els.logSecurityName.textContent = `${row.symbol} ${row.quote?.name ? `- ${row.quote.name}` : ""}`;
  els.logSecurityMeta.textContent = `${fmt.price(row.currentPrice)} current price`;
  els.logActionType.replaceChildren();
  for (const item of actionsForRow(row)) {
    const option = document.createElement("option");
    option.value = item.type;
    option.textContent = item.label;
    els.logActionType.append(option);
  }
  els.logActionType.value = action.type;
  els.logTicker.value = row.symbol;
  els.logPercent.value = Number.isFinite(action.percent) ? action.percent : "";
  els.logAmount.value = action.amount ? Math.round(action.amount) : "";
  els.logDateOpened.value = today;
  els.logExpiry.value = "";
  els.logDte.value = "";
  els.logPrice.value = "";
  els.logStrike.value = "";
  els.logDelta.value = "";
  els.logStockPrice.value = row.currentPrice ? row.currentPrice.toFixed(2) : "";
  els.logStrikeVsStock.value = "";
  els.logNotes.value = "";
  syncLogFields(action.type);
  els.logDialog.showModal();
}

function syncLogFields(type = els.logActionType.value) {
  const showOptions = type !== "shares";
  document.querySelectorAll(".option-field").forEach((field) => {
    field.hidden = !showOptions;
  });
  const label = type === "shares" ? "Share price" : "Option price";
  els.logPriceLabel.textContent = label;
  const context = state.activeLogContext;
  if (context) {
    const action = actionsForRow(context.row).find((item) => item.type === type) || context.action;
    state.activeLogContext.action = action;
    els.logTitle.textContent = `Log ${action.label}`;
    if (!els.logPercent.value && Number.isFinite(action.percent)) els.logPercent.value = action.percent;
    if (!els.logAmount.value && action.amount) els.logAmount.value = Math.round(action.amount);
  }
}

function updateStrikeVsStock() {
  const strike = Number(els.logStrike.value);
  const stock = Number(els.logStockPrice.value);
  els.logStrikeVsStock.value = strike && stock ? fmt.percent(((strike - stock) / stock) * 100) : "";
}

function updateDte() {
  if (!els.logDateOpened.value || !els.logExpiry.value) return;
  const opened = new Date(els.logDateOpened.value);
  const expiry = new Date(els.logExpiry.value);
  const diff = Math.round((expiry - opened) / 86400000);
  els.logDte.value = Number.isFinite(diff) && diff >= 0 ? diff : "";
}

function saveLog() {
  const context = state.activeLogContext;
  if (!context) return;
  const selectedAction = actionsForRow(context.row).find((item) => item.type === els.logActionType.value) || context.action;
  state.actionLog.unshift({
    id: crypto.randomUUID(),
    symbol: context.row.symbol,
    label: selectedAction.label,
    actionType: selectedAction.type,
    percent: Number(els.logPercent.value) || 0,
    amount: Number(els.logAmount.value) || 0,
    dateOpened: els.logDateOpened.value,
    expiry: els.logExpiry.value,
    dte: Number(els.logDte.value) || null,
    price: Number(els.logPrice.value) || null,
    strike: Number(els.logStrike.value) || null,
    delta: Number(els.logDelta.value) || null,
    stockPrice: Number(els.logStockPrice.value) || null,
    strikeVsStock: els.logStrikeVsStock.value,
    notes: els.logNotes.value,
    createdAt: new Date().toISOString(),
  });
  persist();
  renderActionLog();
  renderRows();
  els.logDialog.close();
}

function setFilter(filter) {
  state.filter = filter;
  document.querySelectorAll(".segmented button").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === filter);
  });
  renderRows();
}

document.querySelectorAll(".segmented button").forEach((button) => {
  button.addEventListener("click", () => setFilter(button.dataset.filter));
});

document.querySelectorAll(".sort-header").forEach((button) => {
  button.addEventListener("click", () => {
    state.sort = button.dataset.sort;
    renderRows();
  });
});

els.actionableCard.addEventListener("click", () => setFilter("actionable"));
els.actionableCard.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") setFilter("actionable");
});

function applyLayoutState() {
  document.body.classList.toggle("compact-rows", state.compactRows);
  els.densityToggle.classList.toggle("active", state.compactRows);
  els.densityToggle.setAttribute("aria-pressed", String(state.compactRows));
  els.densityToggle.textContent = state.compactRows ? "Expanded rows" : "Compact rows";
  els.appShell.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
  els.sidebarToggle.title = state.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar";
  els.sidebarToggle.setAttribute("aria-label", els.sidebarToggle.title);
}

els.densityToggle.addEventListener("click", () => {
  state.compactRows = !state.compactRows;
  persist();
  applyLayoutState();
});

els.sidebarToggle.addEventListener("click", () => {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  persist();
  applyLayoutState();
});

els.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderRows();
});

els.searchAddBtn.addEventListener("click", async () => {
  const symbol = cleanTicker(state.search);
  await addTicker(symbol);
  state.search = "";
  els.searchInput.value = "";
  renderRows();
});

els.starredOnly.addEventListener("change", (event) => {
  state.starredOnly = event.target.checked;
  renderRows();
});

els.refreshBtn.addEventListener("click", () => loadScorecard(true).catch(showError));

els.addTickerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await addTicker(els.tickerInput.value);
  els.tickerInput.value = "";
});

els.portfolioEditBtn.addEventListener("click", () => {
  state.portfolioDraft = structuredClone(normalizePortfolio(state.portfolio));
  renderPortfolioEditor();
  els.portfolioDialog.showModal();
});

els.portfolioCancelBtn.addEventListener("click", () => {
  state.portfolioDraft = null;
});

els.portfolioSaveBtn.addEventListener("click", () => {
  state.portfolio = normalizePortfolio(state.portfolioDraft);
  state.portfolioDraft = null;
  persist();
  renderPortfolio();
  renderActionLog();
  renderRows();
  els.portfolioDialog.close();
});

els.addAccountBtn.addEventListener("click", () => {
  state.portfolioDraft.accounts.push({ id: crypto.randomUUID(), broker: "schwab", name: "Brokerage account", value: 0 });
  renderPortfolioEditor();
});

els.discountInput.addEventListener("input", () => {
  if (state.portfolioDraft) state.portfolioDraft.discount = Number(els.discountInput.value) || 0;
});

els.clearLogBtn.addEventListener("click", () => {
  state.actionLog = [];
  persist();
  renderActionLog();
  renderRows();
});

els.settingsBtn.addEventListener("click", () => {
  els.sheetUrlInput.value = state.settings.sheetUrl || defaultSheetUrl;
  els.aaaOverrideInput.value = state.settings.aaaYield;
  els.bondOverrideInput.value = state.settings.bondYield;
  els.linkProviderInput.value = state.settings.linkProvider || "stockanalysis";
  els.settingsDialog.showModal();
});

els.saveSettingsBtn.addEventListener("click", () => {
  state.settings.sheetUrl = els.sheetUrlInput.value.trim() || defaultSheetUrl;
  state.settings.aaaYield = els.aaaOverrideInput.value.trim();
  state.settings.bondYield = els.bondOverrideInput.value.trim();
  state.settings.linkProvider = els.linkProviderInput.value || "stockanalysis";
  persist();
  els.settingsDialog.close();
  loadScorecard(true).catch(showError);
});

[els.logStrike, els.logStockPrice].forEach((input) => input.addEventListener("input", updateStrikeVsStock));
[els.logDateOpened, els.logExpiry].forEach((input) => input.addEventListener("input", updateDte));
els.logPercent.addEventListener("input", () => {
  const liquidity = portfolioTotals().liquidity;
  els.logAmount.value = Math.round(liquidity * ((Number(els.logPercent.value) || 0) / 100));
});
els.logAmount.addEventListener("input", () => {
  const liquidity = portfolioTotals().liquidity;
  els.logPercent.value = liquidity ? fmt.number((Number(els.logAmount.value) / liquidity) * 100, 2) : "";
});
els.logActionType.addEventListener("change", () => syncLogFields());
els.saveLogBtn.addEventListener("click", saveLog);

function showError(error) {
  console.error(error);
  els.scoreRows.innerHTML = `<tr><td class="empty" colspan="10">${error.message}</td></tr>`;
  els.refreshBtn.disabled = false;
  els.refreshBtn.textContent = "Refresh";
}

renderPortfolio();
renderActionLog();
applyLayoutState();
loadScorecard().catch(showError);
setInterval(() => autoRefreshMarketData().catch(showError), 15 * 60 * 1000);
