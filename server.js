const http = require("http");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const PORT = process.env.PORT || 4173;
const DEFAULT_SHEET_ID = "1T7EkKbpCWymh5kb2O_lJuuJWQUWrLuiSQaKM1J8mugs";
const DEFAULT_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${DEFAULT_SHEET_ID}/export?format=csv&gid=0`;
const PUBLIC_DIR = path.join(__dirname, "public");
const LOCAL_DATA_DIR = path.join(__dirname, ".local-data");
const LOCAL_WORKSPACE_FILE = path.join(LOCAL_DATA_DIR, "workspace.json");
const DEMO_USER_ID = "demo";

let cache = {
  sheet: null,
  quotes: new Map(),
};

let pgPool = null;
let pgReady = false;

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(text);
}

async function readJsonBody(req, maxBytes = 1_000_000) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > maxBytes) throw new Error("Request body is too large");
  }
  return body ? JSON.parse(body) : {};
}

function cleanWorkspacePayload(input) {
  const payload = input && typeof input === "object" ? input : {};
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    settings: payload.settings && typeof payload.settings === "object" ? payload.settings : {},
    workspace: payload.workspace && typeof payload.workspace === "object" ? payload.workspace : null,
    portfolioLiquidity: payload.portfolioLiquidity && typeof payload.portfolioLiquidity === "object" ? payload.portfolioLiquidity : null,
    actionLog: Array.isArray(payload.actionLog) ? payload.actionLog : [],
    userPrefs: payload.userPrefs && typeof payload.userPrefs === "object" ? payload.userPrefs : {},
  };
}

function loadPg() {
  if (!process.env.DATABASE_URL) return null;
  if (pgPool) return pgPool;
  try {
    const { Pool } = require("pg");
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
    });
    return pgPool;
  } catch (error) {
    console.warn(`Postgres unavailable, using local JSON persistence: ${error.message}`);
    return null;
  }
}

async function ensurePgSchema(pool) {
  if (pgReady || !pool) return;
  await pool.query(`
    create table if not exists app_state (
      user_id text primary key,
      payload jsonb not null,
      updated_at timestamptz not null default now()
    )
  `);
  pgReady = true;
}

async function readStoredWorkspace(userId = DEMO_USER_ID) {
  const pool = loadPg();
  if (pool) {
    await ensurePgSchema(pool);
    const result = await pool.query("select payload, updated_at from app_state where user_id = $1", [userId]);
    if (!result.rows.length) return { hasData: false, source: "postgres", userId };
    return {
      hasData: true,
      source: "postgres",
      userId,
      updatedAt: result.rows[0].updated_at,
      payload: result.rows[0].payload,
    };
  }

  try {
    const raw = await fsp.readFile(LOCAL_WORKSPACE_FILE, "utf8");
    const payload = JSON.parse(raw);
    return { hasData: true, source: "local-json", userId, updatedAt: payload.savedAt, payload };
  } catch (error) {
    if (error.code === "ENOENT") return { hasData: false, source: "local-json", userId };
    throw error;
  }
}

async function saveStoredWorkspace(payload, userId = DEMO_USER_ID) {
  const cleaned = cleanWorkspacePayload(payload);
  const pool = loadPg();
  if (pool) {
    await ensurePgSchema(pool);
    await pool.query(
      `insert into app_state (user_id, payload, updated_at)
       values ($1, $2, now())
       on conflict (user_id)
       do update set payload = excluded.payload, updated_at = now()`,
      [userId, cleaned],
    );
    return { source: "postgres", userId, payload: cleaned };
  }

  await fsp.mkdir(LOCAL_DATA_DIR, { recursive: true });
  await fsp.writeFile(LOCAL_WORKSPACE_FILE, JSON.stringify(cleaned, null, 2));
  return { source: "local-json", userId, payload: cleaned };
}

async function clearStoredWorkspace() {
  const pool = loadPg();
  if (pool) {
    await ensurePgSchema(pool);
    await pool.query("delete from app_state where user_id = $1", [DEMO_USER_ID]);
    return { source: "postgres" };
  }
  await fsp.rm(LOCAL_WORKSPACE_FILE, { force: true });
  return { source: "local-json" };
}

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
    // Fall through and treat the value as a possible sheet ID.
  }
  if (/^[A-Za-z0-9_-]{20,}$/.test(raw)) {
    return `https://docs.google.com/spreadsheets/d/${raw}/export?format=csv&gid=0`;
  }
  return DEFAULT_SHEET_CSV_URL;
}

function normalizeRows(rows) {
  const scoreRows = [];
  const assumptions = {
    avgYieldAaaBonds: null,
    currentBondYield: null,
    marketNotes: [],
  };

  for (const row of rows) {
    const symbol = stringCell(row[0]);
    const score = numberFromCell(row[7]);
    if (/^[A-Z][A-Z0-9.]{0,7}$/.test(symbol) && score !== null) {
      const eps = numberFromCell(row[15]);
      const peNoGrowth = numberFromCell(row[16]);
      const epsGrowth = numberFromCell(row[17]);
      const intrinsicValue = numberFromCell(row[21]) ?? (
        eps !== null && peNoGrowth !== null && epsGrowth !== null
          ? eps * (peNoGrowth + epsGrowth)
          : null
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
      assumptions.marketNotes.push({
        date: first.replace("AS OF:", "").trim(),
        note: stringCell(row[2]),
      });
    }
  }

  return {
    updatedAt: new Date().toISOString(),
    assumptions,
    rows: scoreRows,
  };
}

async function getSheet(force = false, sheetSource = "") {
  const ttlMs = 10 * 60 * 1000;
  const sourceUrl = sheetCsvUrl(sheetSource);
  if (!force && cache.sheet && cache.sheet.sourceUrl === sourceUrl && Date.now() - cache.sheet.fetchedAt < ttlMs) {
    return cache.sheet.data;
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Sheet fetch failed: ${response.status}`);
  const csv = await response.text();
  const data = normalizeRows(parseCsv(csv));
  cache.sheet = { fetchedAt: Date.now(), sourceUrl, data };
  return data;
}

async function getQuotes(symbols) {
  const clean = [...new Set(symbols.map(toTicker).filter(Boolean))];
  const result = {};
  const missing = clean.filter((symbol) => {
    const entry = cache.quotes.get(symbol);
    if (entry && Date.now() - entry.fetchedAt < 2 * 60 * 1000) {
      result[symbol] = entry.data;
      return false;
    }
    return true;
  });

  if (missing.length) {
    await Promise.all(missing.map(async (symbol) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m`;
      const response = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 stock-scorecard-prototype" },
      });
      if (!response.ok) return;
      const payload = await response.json();
      const chart = payload.chart?.result?.[0];
      const meta = chart?.meta || {};
      const previousClose = meta.previousClose ?? meta.chartPreviousClose ?? null;
      const price = meta.regularMarketPrice ?? null;
      const data = {
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
      cache.quotes.set(symbol, { fetchedAt: Date.now(), data });
      result[symbol] = data;
    }));
  }

  for (const symbol of clean) {
    if (!result[symbol]) {
      result[symbol] = {
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

  return result;
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const safePath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR)) return sendText(res, 403, "Forbidden");

  fs.readFile(filePath, (error, content) => {
    if (error) return sendText(res, 404, "Not found");
    const ext = path.extname(filePath);
    const type = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
    }[ext] || "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === "/api/me") {
      return sendJson(res, 200, {
        user: { id: DEMO_USER_ID, name: "Demo User" },
        auth: { provider: "demo", signedIn: false },
        mode: "demo",
        note: "Authentication is not enabled yet. Public deployments share this demo workspace.",
      });
    }
    if (url.pathname === "/api/workspace" && req.method === "GET") {
      return sendJson(res, 200, await readStoredWorkspace());
    }
    if (url.pathname === "/api/workspace" && (req.method === "PUT" || req.method === "POST")) {
      const saved = await saveStoredWorkspace(await readJsonBody(req));
      return sendJson(res, 200, {
        ok: true,
        source: saved.source,
        userId: saved.userId,
        updatedAt: saved.payload.savedAt,
      });
    }
    if (url.pathname === "/api/workspace/reset-demo" && req.method === "POST") {
      const result = await clearStoredWorkspace();
      return sendJson(res, 200, { ok: true, source: result.source });
    }
    if (url.pathname === "/api/scorecard") {
      const data = await getSheet(url.searchParams.get("force") === "1", url.searchParams.get("sheet") || "");
      return sendJson(res, 200, data);
    }
    if (url.pathname === "/api/quotes") {
      const symbols = (url.searchParams.get("symbols") || "").split(",");
      const quotes = await getQuotes(symbols);
      return sendJson(res, 200, { updatedAt: new Date().toISOString(), quotes });
    }
    return serveStatic(req, res);
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Stock Scorecard prototype running at http://localhost:${PORT}`);
});
