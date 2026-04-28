const DEFAULT_SHEET_ID = "1T7EkKbpCWymh5kb2O_lJuuJWQUWrLuiSQaKM1J8mugs";
const DEFAULT_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${DEFAULT_SHEET_ID}/export?format=csv&gid=0`;

let cache = null;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function numberFromCell(cell) {
  if (cell === undefined || cell === null || cell === "") return null;
  const parsed = Number(String(cell).replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function stringCell(cell) {
  return String(cell || "").trim();
}

function toTicker(symbol) {
  return stringCell(symbol).toUpperCase().replace(".", "-");
}

function sheetCsvUrl(input) {
  const raw = stringCell(input);
  if (!raw) return DEFAULT_SHEET_CSV_URL;
  try {
    const url = new URL(raw);
    const id = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/)?.[1];
    const gid = url.searchParams.get("gid") || new URLSearchParams(url.hash.replace(/^#/, "")).get("gid") || "0";
    if (id) return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${encodeURIComponent(gid)}`;
  } catch (_) {
    // Treat invalid URLs as possible sheet IDs below.
  }
  if (/^[A-Za-z0-9_-]{20,}$/.test(raw)) {
    return `https://docs.google.com/spreadsheets/d/${raw}/export?format=csv&gid=0`;
  }
  return DEFAULT_SHEET_CSV_URL;
}

function normalizeRows(rows) {
  const scoreRows = [];
  const assumptions = { avgYieldAaaBonds: null, currentBondYield: null, marketNotes: [] };

  for (const row of rows) {
    const symbol = stringCell(row[0]);
    const score = numberFromCell(row[7]);
    if (/^[A-Z][A-Z0-9.]{0,7}$/.test(symbol) && score !== null) {
      const eps = numberFromCell(row[15]);
      const peNoGrowth = numberFromCell(row[16]);
      const epsGrowth = numberFromCell(row[17]);
      const intrinsicValue = numberFromCell(row[21]) ?? (
        eps !== null && peNoGrowth !== null && epsGrowth !== null ? eps * (peNoGrowth + epsGrowth) : null
      );
      const currentPrice = numberFromCell(row[22]);
      if (assumptions.avgYieldAaaBonds === null) assumptions.avgYieldAaaBonds = numberFromCell(row[19]);
      if (assumptions.currentBondYield === null) assumptions.currentBondYield = numberFromCell(row[20]);

      scoreRows.push({
        id: symbol,
        symbol,
        quoteSymbol: toTicker(symbol),
        percentOfIv: numberFromCell(row[1]),
        valuation: numberFromCell(row[2]),
        growth: numberFromCell(row[3]),
        moat: numberFromCell(row[4]),
        executionRisk: numberFromCell(row[5]),
        economy: numberFromCell(row[6]),
        score,
        buyShares: stringCell(row[9]),
        sellPuts: stringCell(row[10]),
        buyCalls: stringCell(row[11]),
        dateUpdated: stringCell(row[13]),
        epsTtm: eps,
        peNoGrowth,
        epsGrowth,
        oneG: numberFromCell(row[18]),
        avgYieldAaaBonds: numberFromCell(row[19]),
        currentBondYield: numberFromCell(row[20]),
        intrinsicValue,
        currentPrice,
        source: "Google Sheet",
      });
    }

    const first = stringCell(row[0]);
    if (first.startsWith("AS OF:")) {
      assumptions.marketNotes.push({ date: first.replace("AS OF:", "").trim(), note: stringCell(row[2]) });
    }
  }
  return { updatedAt: new Date().toISOString(), assumptions, rows: scoreRows };
}

module.exports = async function handler(req, res) {
  try {
    const sourceUrl = sheetCsvUrl(req.query.sheet || "");
    const force = req.query.force === "1";
    if (!force && cache && cache.sourceUrl === sourceUrl && Date.now() - cache.fetchedAt < 10 * 60 * 1000) {
      res.setHeader("cache-control", "no-store");
      return res.status(200).json(cache.data);
    }
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error(`Sheet fetch failed: ${response.status}`);
    const data = normalizeRows(parseCsv(await response.text()));
    cache = { sourceUrl, fetchedAt: Date.now(), data };
    res.setHeader("cache-control", "no-store");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
