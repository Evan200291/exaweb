# Exabyte Digital Store

A responsive storefront for digital subscriptions, AI tools, VPN access, wallet top-ups, and reseller purchases.

## Run locally

1. Copy `.env.example` to `.env` and add a rotated supplier API key.
2. Export the environment variables for your shell.
3. Run `npm start` and open `http://localhost:60010`.

The checked-in catalog cache keeps browsing available when the supplier API is not configured. Live purchases require `CANBOSO_API_KEY`.

## Checks

Run `npm run check` to validate the frontend and backend JavaScript syntax.
