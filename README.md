# Stock Scorecard Prototype

Local web app prototype for the Google Sheet scorecard.

## What it does

- Imports the `Main Scorecard` sheet from Google Sheets as CSV.
- Normalizes repeated row data into one record per ticker.
- Promotes repeated assumptions, such as AAA bond yield and current bond yield, into the sidebar.
- Refreshes live quote data every 15 minutes in the browser; the Refresh button pulls both the Google Sheet and quote data immediately.
- Pulls current prices from Yahoo Finance's chart endpoint.
- Uses sheet-provided TTM EPS, P/E no-growth, and EPS growth to calculate intrinsic value.
- Supports local add, remove, search, sort, filter, and star actions.
- Separates Buy Shares, Sell Puts, and Buy Calls into status chips.
- Calculates action dollar guidance from configurable 7-day portfolio liquidity.
- Stores a local action log and displays logged exposure as a percentage of liquidity.
- Opens a detailed action-log modal for opened date, expiry, DTE, price, strike, delta, stock price, and notes.
- Provides a global settings modal for the Google Sheet URL, yield overrides, and preferred symbol-link destination.
- Keeps portfolio liquidity in read-only mode until Edit, then applies changes only on Save.
- Adds an Investment Candidates / My Portfolio tab structure.
- Tracks portfolio accounts, manual holdings, and open options from the My Portfolio tab.
- Uses the primary portfolio's brokerage accounts as the source for sidebar Portfolio Liquidity.
- Suppresses new potential actions when the primary portfolio already owns shares or has matching open option exposure.
- Syncs logged option actions into the primary portfolio's Open Options list.
- Saves the workspace through `/api/workspace`, with local JSON fallback and Render PostgreSQL support.
- Shows Harvey-ball category ratings with hover details.
- Shows price hover details such as previous close, day range, 52-week range, exchange, and volume when available.

## Run

```powershell
& 'C:\Users\toddm\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' server.js
```

Then open:

```text
http://localhost:4173
```

## Redeploy on Render

If the Render service is already connected to GitHub, this is the normal update loop:

```powershell
cd "C:\Users\toddm\OneDrive\Documents\New project"
git status
git add README.md package.json server.js api public
git commit -m "Describe the change"
git push origin main
```

Render should auto-deploy the pushed commit. If it does not, open the Render service and choose **Manual Deploy** > **Deploy latest commit**.

Recommended Render settings:

- Runtime: `Node`
- Build command: `npm install`
- Start command: `npm start`
- Instance type: Free is fine for review/prototype use.

## Current Persistence

Portfolio liquidity, the My Portfolio workspace, starred tickers, added tickers, settings, and logs are still mirrored into the browser with `localStorage`, but the Node server now also exposes `/api/workspace`.

When running locally with no database, the server writes the shared demo workspace to `.local-data/workspace.json`. That folder is ignored by Git.

On Render, add a PostgreSQL database and set `DATABASE_URL` on the web service. The app will automatically use a simple `app_state` table to persist the shared demo workspace across deploys and restarts. After Google sign-in is configured, the same table stores one workspace per signed-in Google user. The table is created automatically, and the SQL is also in `db/schema.sql`.

Important: if Google sign-in is not configured, everyone who visits the deployed app shares the same demo workspace. Do not put real private account data into the public Render deployment until OAuth is enabled and you are signed in.

For a real multi-user version, the next architecture step is adding login plus normalized database tables. A good Render-friendly path is:

- Render web service for this Node app.
- Render PostgreSQL for users, portfolios, accounts, holdings, options, settings, and action logs.
- Google OAuth for login.
- A demo mode that seeds local sample data before login, then lets a logged-in user clear or import it.

## Render PostgreSQL Setup

1. In Render, create a PostgreSQL database.
2. Open the web service for this app.
3. Add an environment variable named `DATABASE_URL` with the Internal Database URL from the Render database.
4. Redeploy the web service.

After that, future changes are still the normal loop:

```powershell
git add README.md package.json server.js db public
git commit -m "Describe the change"
git push origin main
```

Render will rebuild with `npm install`, install `pg`, and start with `npm start`.

## Google Sign-In Setup

The app stays in demo mode unless these environment variables are set on Render:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `APP_BASE_URL`, for example `https://your-render-service.onrender.com`

In Google Cloud Console, create an OAuth Client ID for a web application and add this Authorized redirect URI:

```text
https://your-render-service.onrender.com/auth/google/callback
```

For local testing, use:

```text
http://localhost:4173/auth/google/callback
```

Sessions are currently held in server memory, so a Render restart signs users out, but their saved workspace remains in PostgreSQL. The next hardening step is moving sessions into PostgreSQL too.

## Vercel Notes

This repo is ready for a temporary Vercel preview:

1. Push the folder to a GitHub repository.
2. In Vercel, import the repository.
3. Use the default "Other" project settings. There is no build command and no output directory to set.
4. Vercel will serve `public/` as the static app and `api/scorecard.js` / `api/quotes.js` as serverless endpoints.

For a command-line deploy after installing Vercel CLI:

```powershell
vercel
```

Use `vercel --prod` only when you want the production URL instead of a temporary preview URL.

## Notes

Yahoo's public quote-summary endpoint currently returns `401` without a signed session, so the prototype uses Yahoo's open chart endpoint for prices and relies on the sheet for EPS. For production, the server should swap in a paid or authenticated fundamentals provider for EPS, revenue growth, analyst estimates, and market data SLAs.
