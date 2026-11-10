# Exabyte Digital Store — Full Prototype Prompt

Build a responsive, mobile-first web prototype for **Exabyte Digital Store**, a reseller store for digital subscriptions (ChatGPT, Claude API, Canva, Google One, VPNs, etc.) modeled on a Telegram product-category bot. Add **Outline VPN** as a new product with its own packages.

## 1. Tech and constraints
- Plain HTML/CSS/JS (or React + Vite). No heavy UI kits. Mock data only.
- Mobile-first. Test at 360, 390, 768, 1024, 1440 px. No horizontal scroll at any width.
- Touch targets ≥ 44 px. Use `viewport-fit=cover` and `env(safe-area-inset-*)`.
- Never put the Canboso API key in front-end code. Calls go through a backend proxy; the key lives in a server env var (`CANBOSO_API_KEY`). The key shown in chat was exposed and should be rotated.

## 2. Brand and styling
- Logo: Exabyte "E" mark + wordmark "EXABYTE / DIGITAL STORE" (see the 16 colour options sheet). Default: **Navy on White** (header), **White on Navy** (footer/dark banners). Use the mark alone on mobile if space is tight.
- Palette: Navy `#14305f`, Ink `#0b1a30`, Royal `#1f4fd8`, Mist `#eef2f8`, Line `#d9e0ec`.
- Typography: Inter/system sans. Headings bold, navy.
- **No pill shapes.** Buttons, chips, tags, inputs use `border-radius: 4px` max. No `999px` radii.
- **Formless design:** no boxed input forms. Fields are open, flat, underline-only with small uppercase labels; selections use tiles/chips; no card shadows, no heavy borders.
- Professional, flat, high contrast (WCAG AA).

## 3. Navigation & Page Placements (Modeled on bananagameshop.com)
- **Desktop Header:** Sticky frosted glass bar (`height: 60px`) with Exabyte logo on the left, primary links (`Home`, `Products`, `VPN`, `Top Up`, `History` dropdown, `API`), and wallet balance chip on the right.
- **Mobile Navigation:** Top bar with logo + wallet balance + slide-over menu trigger, plus a fixed 5-tab bottom navigation bar (`Home`, `Shop`, elevated center `+ Top Up` action, `History`, `API`).
- **Home Page Hero Row:** 2-column layout on desktop (`1.9fr` 2-slide banner carousel on the left + `1fr` hero callout card with store stats and CTAs on the right). Stacks cleanly on mobile with quick-action buttons below the banner.
- **Sectioned Product Grids:** Vertical accent bar + uppercase title on the left, `See More >` link on the right. Cards use square `1:1` cover art with diagonal stripe texture, faded oversized brand watermark in the corner, `HOT` / `NEW` badges, floating brand logo tile (`40px–46px`) at bottom-left of the cover, product title, green `⚡ Instant` status indicator, and `From X,XXX Ks` starting price.
- **2-Column Product Detail Page:**
  - **Left Column (Sticky):** 16:9 brand cover card, overlapping `64px` logo tile, product title, `Instant Delivery` + `Warranty` badges, description, and bulleted highlights.
  - **Right Column (Numbered Step Cards):**
    - `Step 1: Delivery Details` — open underline-only ("formless") inputs for optional Telegram username / Email.
    - `Step 2: Select Package` — 2-to-3 column selectable package cards with checkmarks, `HOT` tags, package description, and monospace MMK price.
    - **Sticky Payment Summary Bar:** Shows selected package, wallet balance status (or shortfall warning), total price, and `BUY NOW` (or `Top Up` redirect button), triggering a confirmation modal and instant credential/key delivery modal.

## 4. Home page & Banner Safe Zones
1. **Banner carousel with exactly 2 slides** (auto-play 5 s, swipe on touch, arrows on desktop, rectangular dash indicators, pause on hover).
   - Slide 1: Outline VPN promo → CTA "Get Access Key" (`#/p/outline-vpn`).
   - Slide 2: Digital store/top-up promo → CTA "Top Up Wallet" (`#/topup`).

### Banner image specs and safe zones
Deliver **two separate crops per slide** (swap with `<picture>` at `768px`, or place files at `assets/banners/slide1-desktop.webp`, `slide1-mobile.webp`, etc.).

| | Desktop (`>= 768px`) | Mobile (`< 768px`) |
|---|---|---|
| Canvas | `1920 × 1080 px` (16:9) | `1080 × 810 px` (4:3) |
| Safe zone (text, logo, CTA) | Centered `1680 × 880 px` (`120px` left/right, `100px` top/bottom) | Centered `960 × 650 px` (`60px` left/right, `80px` top/bottom) |
| Indicator reserved zone | Bottom-center `400 × 100 px` | Bottom-center `360 × 80 px` |

Rules: keep all copy, logos and CTAs inside the safe zone; backgrounds extend full canvas; subject focal point at x = 75% (desktop) / y = 75% (mobile); text contrast ≥ 4.5:1 over art; no text baked into images if it can be live HTML.
The prototype has a **Safe zones** toggle on the banner (green dashed = safe, red = canvas).

## 5. Products page
- Search field (underline style), grid of categories: 2 cols mobile, 3 tablet, 4 desktop.
- Each tile shows the **brand logo** (use the official logo file at 36 px, square, 4 px radius; tinted-initial fallback). Logos must match the real brand marks; include Outline VPN, NordVPN, ExpressVPN, SurfShark, HMA, Hotspot Shield.
- Selecting a category shows its packages: name, description, price (MMK), **Buy** button, "HOT" tag for featured.
- **Outline VPN packages:** 1 Month (1 key, 1 device, 200 GB), 3 Months (3 devices, 600 GB), 12 Months (2 keys, 5 devices, fair-use unlimited). Delivery: access key (`ss://…`) + download links for Outline Client.
- Buying with insufficient balance redirects to Top Up.

## 6. Top Up page
- Amount (underline field + quick chips 5k/10k/20k/50k, min 1,000 MMK).
- Payment method tiles (KBZPay, WavePay, AYA Pay, Bank) and destination account block.
- **Mandatory payment screenshot upload:** tap/drag area, image only, ≤ 5 MB, preview shown, submit disabled until amount and image exist.
- Submit creates a **Pending** request; admin approves/rejects; on approval the wallet is credited. Show request history with thumbnail, amount, method, status.

## 7. API page
Show reseller endpoints (from the bot):
- `GET /api/v2/telegram-buyer/products` — list products.
- `POST /api/v2/telegram-buyer/purchase` — purchase using wallet balance.
- Note: wallet must be topped up first. Link to Swagger: https://canboso.com/api/swagger.

## 8. Acceptance checklist
- [ ] Banner has 2 slides, swipe works, separate mobile/desktop crops, copy inside safe zones
- [ ] No pill radii anywhere; no boxed forms
- [ ] Logos consistent and legible at 36 px
- [ ] Top-up cannot submit without screenshot
- [ ] Outline VPN present with 3 packages
- [ ] Usable at 360 px with no overflow; bottom tab bar doesn't cover content
- [ ] No API key in client code
