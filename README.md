# Exabyte Digital Store

A responsive storefront for digital subscriptions, AI tools, VPN access, wallet top-ups, and reseller purchases.

## Run locally

1. Copy `.env.example` to `.env` and add a rotated supplier API key.
2. Export the environment variables for your shell.
3. Run `npm start` and open `http://localhost:60010`.

The checked-in catalog cache keeps browsing available when the supplier API is not configured. Live purchases require `CANBOSO_API_KEY`.

## Integrations

- EN/MM language switching uses the bundled Myanmar font in `assets/fonts`.
- Package details returned by the supplier catalog include a Burmese explanation generated from the package type, duration, delivery method, data allowance, and warranty metadata.
- Telegram and Google sign-in activate only when their server-side environment variables are configured.
- Payment screenshots are deduplicated and forwarded to the configured Telegram admin bot for approval. Browser users cannot approve their own top-ups.
- The free 5 GB Outline test key and paid Outline keys are provisioned only through the configured isolated 3X-UI inbound. The server never returns a fake key when the panel is unavailable.

Copy `.env.example` to `.env`, supply the deployment secrets, and register the Telegram webhook at `/api/tg/webhook`. Never commit `.env`.

## Checks

Run `npm run check` to validate the frontend and backend JavaScript syntax.
