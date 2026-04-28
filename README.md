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

## Publish on Vercel

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

## Redeploy on Render

If the project is already connected to Render through GitHub:

1. Commit the changed files locally.
2. Push the commit to the GitHub branch Render watches, usually `main`.
3. Render should auto-deploy the new commit. If it does not, open the Render service and choose **Manual Deploy** > **Deploy latest commit**.

Recommended Render settings:

- Runtime: `Node`
- Build command: `npm install`
- Start command: `node server.js`
- Instance type: Free is fine for review/prototype use.

## Notes

Yahoo's public quote-summary endpoint currently returns `401` without a signed session, so the prototype uses Yahoo's open chart endpoint for prices and relies on the sheet for EPS. For production, the server should swap in a paid or authenticated fundamentals provider for EPS, revenue growth, analyst estimates, and market data SLAs.
