const quoteCache = new Map();

function stringCell(cell) {
  return String(cell || "").trim();
}

function toTicker(symbol) {
  return stringCell(symbol).toUpperCase().replace(".", "-");
}

async function fetchQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m`;
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 stock-scorecard-prototype" },
  });
  if (!response.ok) return null;
  const payload = await response.json();
  const chart = payload.chart?.result?.[0];
  const meta = chart?.meta || {};
  const previousClose = meta.previousClose ?? meta.chartPreviousClose ?? null;
  const price = meta.regularMarketPrice ?? null;
  return {
    symbol,
    name: meta.longName || meta.shortName || symbol,
    price,
    previousClose,
    changePercent: price && previousClose ? ((price - previousClose) / previousClose) * 100 : null,
    dayHigh: meta.regularMarketDayHigh ?? null,
    dayLow: meta.regularMarketDayLow ?? null,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
    volume: meta.regularMarketVolume ?? null,
    exchange: meta.fullExchangeName || meta.exchangeName || null,
    instrumentType: meta.instrumentType || null,
    epsTtm: null,
    marketCap: null,
    source: "Yahoo Finance chart endpoint",
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = async function handler(req, res) {
  try {
    const symbols = String(req.query.symbols || "")
      .split(",")
      .map(toTicker)
      .filter(Boolean);
    const clean = [...new Set(symbols)];
    const quotes = {};
    const missing = clean.filter((symbol) => {
      const entry = quoteCache.get(symbol);
      if (entry && Date.now() - entry.fetchedAt < 2 * 60 * 1000) {
        quotes[symbol] = entry.data;
        return false;
      }
      return true;
    });

    await Promise.all(missing.map(async (symbol) => {
      const data = await fetchQuote(symbol);
      if (data) {
        quoteCache.set(symbol, { fetchedAt: Date.now(), data });
        quotes[symbol] = data;
      }
    }));

    for (const symbol of clean) {
      if (!quotes[symbol]) {
        quotes[symbol] = {
          symbol,
          price: null,
          previousClose: null,
          changePercent: null,
          dayHigh: null,
          dayLow: null,
          fiftyTwoWeekHigh: null,
          fiftyTwoWeekLow: null,
          volume: null,
          exchange: null,
          instrumentType: null,
          epsTtm: null,
          source: "Unavailable",
          fetchedAt: new Date().toISOString(),
        };
      }
    }

    res.setHeader("cache-control", "no-store");
    return res.status(200).json({ updatedAt: new Date().toISOString(), quotes });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
