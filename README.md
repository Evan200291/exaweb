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

## Enable Google sign-in

1. Deploy the store on an HTTPS domain.
2. In Google Cloud Console, configure the OAuth consent screen.
3. Create an OAuth client with application type **Web application**.
4. Add this exact authorized redirect URI: `https://YOUR_DOMAIN/auth/google/callback`.
5. Configure `APP_BASE_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in the server environment.
6. Restart the server and check `/api/auth/config`; `google` should be `true`.

For local testing, Google permits a localhost redirect such as `http://localhost:60010/auth/google/callback`. The redirect URI must exactly match the value registered with Google.

## Enable Telegram sign-in

1. Use a dedicated Telegram bot with the store name and logo.
2. In `@BotFather`, select the bot's **Login Widget** settings and add the production origin and callback URL. For the classic widget, `/setdomain` must match the website domain.
3. Configure `APP_BASE_URL`, `SESSION_SECRET`, `TG_BOT_TOKEN`, and `TG_BOT_USERNAME` in the server environment.
4. Restart the server and check `/api/auth/config`; `telegram` should be `true`.

Telegram payment review additionally needs `TG_ADMIN_IDS` and `TG_WEBHOOK_SECRET`. Register `https://YOUR_DOMAIN/api/tg/webhook` as the bot webhook using the same secret token. Login credentials and webhook secrets must remain server-side.

## Checks

Run `npm run check` to validate the frontend and backend JavaScript syntax.
