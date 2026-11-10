/* Exabyte Digital Store — Live Web Client
   Fetches live products & package details from /api/catalog (Canboso API v2 + Outline VPN),
   calculates prices at $1 = 5,500 Ks, distinguishes Instant vs Slot/Upgrade fulfillment,
   and processes live purchases & screenshot-verified wallet top-ups. */

const GROUPS = { vpn: 'VPN', ai: 'AI Tools', design: 'Design & Video', stream: 'Streaming', work: 'Productivity', learn: 'Learning' };
const METHODS = [
  ['KBZPay', '#0b4ea2', 'KBZ', '09 123 456 789'],
  ['WavePay', '#ffcc00', 'W', '09 987 654 321'],
  ['AYA Pay', '#c8102e', 'AYA', '09 222 333 444'],
  ['CB Pay', '#00539b', 'CB', '0001 2345 6789 0001']
];

const OUTLINE_SVG = '<svg viewBox="0 0 24 24" style="stroke:none"><path fill="#fff" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4.2a5.8 5.8 0 1 1 0 11.6 5.8 5.8 0 0 1 0-11.6z"/><circle cx="12" cy="12" r="2.6" fill="#fff"/></svg>';
const OPENAI_SVG = '<svg viewBox="0 0 24 24" style="stroke:none"><path fill="#fff" d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6.07 6.07 0 0 0 4.98 4.18a5.98 5.98 0 0 0-4 2.9 6.05 6.05 0 0 0 .74 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.52 2.9A5.98 5.98 0 0 0 13.26 24a6.06 6.06 0 0 0 5.77-4.21 5.99 5.99 0 0 0 4-2.9 6.06 6.06 0 0 0-.75-7.07zm-9.02 12.61a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.8.8 0 0 0 .39-.68v-6.74l2.02 1.17c.02.01.03.03.03.05v5.58a4.5 4.5 0 0 1-4.48 4.5zm-9.66-4.13a4.47 4.47 0 0 1-.54-3.01l.14.09 4.78 2.76a.77.77 0 0 0 .78 0l5.84-3.37v2.33a.08.08 0 0 1-.03.06l-4.83 2.79a4.5 4.5 0 0 1-6.14-1.65zM2.34 7.9a4.49 4.49 0 0 1 2.37-1.97V11.6a.77.77 0 0 0 .39.68l5.81 3.35-2.02 1.17a.08.08 0 0 1-.07 0l-4.83-2.79A4.5 4.5 0 0 1 2.34 7.9zm16.6 3.86-5.84-3.38 2.02-1.16a.08.08 0 0 1 .07 0l4.83 2.79a4.49 4.49 0 0 1-.68 8.1v-5.67a.79.79 0 0 0-.4-.68zm2.01-3.02-.14-.09-4.77-2.78a.78.78 0 0 0-.79 0L9.41 9.23V6.9a.07.07 0 0 1 .03-.06l4.83-2.79a4.5 4.5 0 0 1 6.68 4.66zM8.31 12.86l-2.02-1.16a.08.08 0 0 1-.03-.06V6.07a4.5 4.5 0 0 1 7.38-3.45l-.14.08-4.78 2.76a.8.8 0 0 0-.39.68zm1.1-2.37 2.6-1.5 2.6 1.5v3l-2.6 1.5-2.6-1.5z"/></svg>';

const STATE = {
  loaded: false,
  rateMmk: 5500,
  source: 'live',
  fetchedAt: null,
  totalProducts: 0,
  categories: [],
  bal: 0,
  buys: [],
  tops: [],
  supplierWallet: null
};
let LANG = localStorage.getItem('exa_lang') === 'mm' ? 'mm' : 'en';
let AUTH = { user: null, google: false, telegram: false };

const COPY = {
  en: {
    home: 'Home', products: 'Products', topup: 'Top Up', signIn: 'Sign in', popular: 'Popular Categories', seeMore: 'See More',
    selectPackage: 'Select Package', orderInput: 'Order Input', packageDetails: 'Package Description & Warranty Policy',
    price: 'Price', stock: 'Stock', sold: 'Sold', type: 'Type', instant: 'Instant', packages: 'packages', free: 'Free',
    history: 'History', purchaseHistory: 'Product Purchases', topupHistory: 'Top Up Requests', menu: 'Menu', allProducts: 'All Products', aiTools: 'AI Tools',
    topupWallet: 'Top Up Wallet', resellerApi: 'Reseller API', store: 'Store', account: 'Account', streaming: 'Streaming', telegramSupport: 'Telegram support',
    weAccept: 'We accept', bank: 'Bank', shop: 'Shop', categories: 'Categories', support: 'Support', quantity: 'Quantity', fulfillment: 'Fulfillment',
    walletBalance: 'Wallet Balance', totalPayment: 'Total Payment', required: 'Required', optional: 'Optional', pending: 'Pending review', approved: 'Approved', rejected: 'Rejected',
    footerIntro: 'Premium apps, AI tools and VPN access. Top up once, buy anytime. Delivered in minutes.'
  },
  mm: {
    home: 'ပင်မ', products: 'ကုန်ပစ္စည်းများ', topup: 'ငွေဖြည့်ရန်', signIn: 'အကောင့်ဝင်ရန်', popular: 'လူကြိုက်များသော အမျိုးအစားများ', seeMore: 'နောက်ထပ်ကြည့်ရန်',
    selectPackage: 'ပက်ကေ့ချ်ရွေးပါ', orderInput: 'မှာယူရန်အချက်အလက်', packageDetails: 'ပက်ကေ့ချ်အသေးစိတ်နှင့် အာမခံစည်းမျဉ်း',
    price: 'စျေးနှုန်း', stock: 'လက်ကျန်', sold: 'ရောင်းပြီး', type: 'အမျိုးအစား', instant: 'ချက်ချင်းရမည်', packages: 'ပက်ကေ့ချ်', free: 'အခမဲ့',
    history: 'မှတ်တမ်း', purchaseHistory: 'ဝယ်ယူမှုမှတ်တမ်း', topupHistory: 'ငွေဖြည့်တောင်းဆိုမှုများ', menu: 'မီနူး', allProducts: 'ကုန်ပစ္စည်းအားလုံး', aiTools: 'AI ကိရိယာများ',
    topupWallet: 'Wallet ငွေဖြည့်ရန်', resellerApi: 'ပြန်လည်ရောင်းချသူ API', store: 'စတိုး', account: 'အကောင့်', streaming: 'ရုပ်သံနှင့်တေးဂီတ', telegramSupport: 'Telegram အကူအညီ',
    weAccept: 'လက်ခံသောငွေပေးချေမှု', bank: 'ဘဏ်', shop: 'စျေးဝယ်', categories: 'အမျိုးအစားများ', support: 'အကူအညီ', quantity: 'အရေအတွက်', fulfillment: 'ပို့ဆောင်ပုံ',
    walletBalance: 'Wallet လက်ကျန်', totalPayment: 'စုစုပေါင်းပေးချေမှု', required: 'မဖြစ်မနေ', optional: 'မလိုအပ်လျှင် မထည့်နိုင်', pending: 'အတည်ပြုရန်စောင့်နေ', approved: 'အတည်ပြုပြီး', rejected: 'ပယ်ချပြီး',
    footerIntro: 'Premium app များ၊ AI tool များနှင့် VPN ဝန်ဆောင်မှုများကို Wallet ငွေဖြည့်ပြီး အချိန်မရွေး ဝယ်ယူနိုင်ပါသည်။'
  }
};
const t = key => (COPY[LANG] && COPY[LANG][key]) || COPY.en[key] || key;
const bi = (en, mm) => LANG === 'mm' ? mm : en;
const pkgName = p => LANG === 'mm' && p.nameMm ? p.nameMm : p.name;
const pkgDescription = p => LANG === 'mm' && p.descriptionMm ? p.descriptionMm : p.description;
const pkgDeliveryLabel = p => LANG === 'mm' && p.deliveryLabelMm ? p.deliveryLabelMm : p.deliveryLabel;
const pkgDeliveryHint = p => LANG === 'mm' && p.deliveryHintMm ? p.deliveryHintMm : p.deliveryHint;
const groupLabel = key => LANG === 'mm' ? ({ all: 'အားလုံး', vpn: 'VPN နှင့်လုံခြုံရေး', ai: 'AI ကိရိယာများ', design: 'ဒီဇိုင်းနှင့်ဗီဒီယို', stream: 'ရုပ်သံနှင့်တေးဂီတ', work: 'လုပ်ငန်းသုံး', learn: 'လေ့လာရေး' }[key] || GROUPS[key]) : (key === 'all' ? 'All' : GROUPS[key]);
const productTypeLabel = type => LANG === 'mm' ? ({ account: 'ချက်ချင်းရအကောင့်', slot: 'ဖိတ်ကြား Slot', upgrade_account: 'အကောင့်အဆင့်မြှင့်' }[type] || type) : type;

/* ---------------- Helpers ---------------- */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const fmt = n => Number(n || 0).toLocaleString('en-US');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const linkify = s => esc(s).replace(/https?:\/\/[^\s<>"']+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);

const ICON = {
  bolt: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4z"/></svg>',
  wallet: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  bag: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>'
};

function iconImg(cat, colorHex) {
  if (cat.logoPath) return `<img class="brand-art" src="${esc(cat.logoPath)}" alt="" loading="lazy">`;
  const artwork = cat.image || cat.coverImage;
  if (artwork) return `<img class="package-art" src="${esc(artwork)}" alt="" loading="lazy" onerror="this.remove()">`;
  if (cat.svg === 'outline') return OUTLINE_SVG;
  if (cat.svg === 'openai') return OPENAI_SVG;
  if (cat.slug) {
    const col = colorHex || (cat.darkText ? '111111' : 'ffffff');
    return `<img src="https://cdn.simpleicons.org/${cat.slug}/${col}" alt="" loading="lazy" onerror="this.remove()">`;
  }
  return '';
}
const logo = (cat, cls = '') => `<span class="logo ${cat.darkText ? 'dk' : ''} ${cls}" style="--c:${cat.color}">${iconImg(cat)}<b>${esc(cat.name[0])}</b></span>`;
const packageLogo = (cat, pkg, cls = '') => logo({ ...cat, image: pkg && pkg.image && /product-default-images/i.test(pkg.image) ? pkg.image : null }, cls);
const centerMark = cat => `<span class="big">${iconImg(cat, 'ffffff')}<b>${esc(cat.name[0])}</b></span>`;

function setWalletUI(amount) {
  STATE.bal = Number(amount || 0);
  const el = document.getElementById('bal');
  if (el) el.textContent = fmt(STATE.bal);
}

function toast(m) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = m;
  document.body.append(t);
  setTimeout(() => t.remove(), 2800);
}

function modal(html, cls = '') {
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="mp ${cls}" role="dialog" aria-modal="true" tabindex="-1">${html}</div>`;
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-x]')) m.remove(); });
  document.body.append(m);
  m.querySelector('.mp').focus();
  return m;
}

function applyLanguageChrome() {
  document.documentElement.lang = LANG === 'mm' ? 'my' : 'en';
  $$('[data-lang]').forEach(b => {
    const active = b.dataset.lang === LANG;
    b.classList.toggle('on', active);
    b.setAttribute('aria-pressed', String(active));
  });
  $$('[data-i18n]').forEach(el => { const value = t(el.dataset.i18n); if (value) el.textContent = value; });
  const authLabel = AUTH.user ? (AUTH.user.name || 'Account') : t('signIn');
  const authBtn = $('#authBtn'); if (authBtn) authBtn.textContent = authLabel;
  const mobileAuth = $('#mAuthBtn'); if (mobileAuth) mobileAuth.textContent = AUTH.user ? authLabel : (LANG === 'mm' ? 'Telegram သို့မဟုတ် Google ဖြင့် ဝင်ရန်' : 'Sign in with Telegram or Google');
}

async function loadIdentity() {
  try {
    const [config, me] = await Promise.all([
      fetch('/api/auth/config').then(r => r.json()),
      fetch('/api/auth/me').then(r => r.json())
    ]);
    AUTH = { ...config, user: me.user || null };
  } catch {}
  applyLanguageChrome();
}

function showAuth() {
  if (AUTH.user) {
    return modal(`<h3>${esc(AUTH.user.name || bi('Your account','သင့်အကောင့်'))}</h3><p>${AUTH.user.provider === 'telegram' ? 'Telegram' : 'Google'} ${bi('account connected.','အကောင့် ချိတ်ဆက်ပြီးပါပြီ။')}</p><div class="macts"><button class="btn" data-x>${bi('Close','ပိတ်ရန်')}</button><a class="btn pri" href="/auth/logout">${bi('Sign out','အကောင့်ထွက်ရန်')}</a></div>`, 'c');
  }
  const unavailable = LANG === 'mm' ? 'ဆာဗာတွင် သတ်မှတ်ချက်မပြည့်စုံသေးပါ' : 'Not configured on this server yet';
  modal(`<h3>${LANG === 'mm' ? 'Exabyte အကောင့်သို့ ဝင်ရန်' : 'Sign in to Exabyte'}</h3><p>${LANG === 'mm' ? 'မှာယူမှုနှင့် ငွေဖြည့်မှတ်တမ်းများကို လုံခြုံစွာ သိမ်းရန် အကောင့်ဝင်ပါ။' : 'Sign in to securely keep your purchases and top-up history.'}</p>
    <div class="authchoices">
      ${AUTH.telegram ? '<a class="btn lg tg" href="/auth/telegram">Continue with Telegram</a>' : `<button class="btn lg" disabled>Telegram — ${unavailable}</button>`}
      ${AUTH.google ? '<a class="btn lg google" href="/auth/google">Continue with Google</a>' : `<button class="btn lg" disabled>Google — ${unavailable}</button>`}
    </div><p class="authnote">${LANG === 'mm' ? 'အကောင့်ဝင်ခြင်းဆိုင်ရာ လျှို့ဝှက်အချက်အလက်များကို browser code ထဲတွင် မသိမ်းပါ။' : 'Authentication secrets stay on the server and are never included in browser code.'}</p>`, 'c');
}

/* ---------------- API Data Sync ---------------- */
async function loadBackendData(forceCatalog = false) {
  const [catRes, stRes] = await Promise.all([
    fetch(`/api/catalog${forceCatalog ? '?refresh=1' : ''}`).then(r => r.json()),
    fetch('/api/state').then(r => r.json())
  ]);
  if (catRes && catRes.success) {
    STATE.rateMmk = catRes.rateMmk || 5500;
    STATE.source = catRes.source;
    STATE.fetchedAt = catRes.fetchedAt;
    STATE.totalProducts = catRes.totalProducts;
    STATE.categories = catRes.categories || [];
  }
  if (stRes && stRes.success) {
    setWalletUI(stRes.balanceMmk);
    STATE.buys = stRes.orders || [];
    STATE.tops = stRes.topups || [];
  }
  STATE.loaded = true;
}

let translationRequestId = 0;
async function loadFullPackageTranslation(pkg) {
  if (LANG !== 'mm' || !pkg || !pkg.productId) return;
  const requestId = ++translationRequestId;
  const descEl = $('#pkgdetail .pd-desc');
  if (descEl) {
    descEl.classList.add('translation-loading');
    descEl.textContent = 'ရောင်းသူ API မှ ပက်ကေ့ချ်ဖော်ပြချက်အပြည့်အစုံကို မြန်မာဘာသာသို့ ပြန်ဆိုနေပါသည်…';
  }
  try {
    const response = await fetch(`/api/translate/mm?productId=${encodeURIComponent(pkg.productId)}`);
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Translation failed');
    if (requestId !== translationRequestId || LANG !== 'mm' || !curCat || curCat.packages[selIdx]?.productId !== pkg.productId) return;
    pkg.fullDescriptionMm = data.descriptionMm;
    const currentDesc = $('#pkgdetail .pd-desc');
    if (currentDesc) {
      currentDesc.classList.remove('translation-loading');
      currentDesc.innerHTML = linkify(data.descriptionMm || pkg.descriptionMm || 'ဖော်ပြချက်မရှိပါ။');
    }
  } catch (error) {
    if (requestId !== translationRequestId) return;
    const currentDesc = $('#pkgdetail .pd-desc');
    if (currentDesc) {
      currentDesc.classList.remove('translation-loading');
      currentDesc.textContent = 'မြန်မာဘာသာပြန်ဆိုမှုကို ယခုမရရှိနိုင်သေးပါ။ ခဏအကြာ ပြန်လည်ကြိုးစားပါ။';
    }
    console.warn('Full package translation failed:', error);
  }
}

/* ---------------- Banner (2 slides + safe zones) ---------------- */
const SLIDES = [
  { href: '#/p/outline-vpn', alt: 'Outline VPN — private access without borders', d: 'assets/banners/outline-desktop.svg', m: 'assets/banners/outline-mobile.svg' },
  { href: '#/products?g=ai', alt: 'Premium AI tools and productivity packages', d: 'assets/banners/apps-desktop.svg', m: 'assets/banners/apps-mobile.svg' }
];
const T = (x, y, s, w, f, txt, extra = '') => `<text x="${x}" y="${y}" font-family="Inter,Segoe UI,sans-serif" font-size="${s}" font-weight="${w}" fill="${f}" ${extra}>${txt}</text>`;
const bgDefs = (id, a, b, gx, gy, glow) => `<defs><linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><radialGradient id="${id}g" cx="${gx}" cy="${gy}" r=".55"><stop offset="0" stop-color="${glow}" stop-opacity=".55"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient><pattern id="${id}p" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M60 0H0V60" fill="none" stroke="#fff" stroke-opacity=".045"/></pattern></defs>`;
const bg = id => `<rect width="100%" height="100%" fill="url(#${id}b)"/><rect width="100%" height="100%" fill="url(#${id}p)"/><rect width="100%" height="100%" fill="url(#${id}g)"/>`;
const ring = (cx, cy, R) => `<g transform="translate(${cx} ${cy})"><circle r="${R * 1.55}" fill="none" stroke="#5eead4" stroke-opacity=".12" stroke-width="2"/><circle r="${R * 1.25}" fill="none" stroke="#5eead4" stroke-opacity=".22" stroke-width="2" stroke-dasharray="6 10"/><circle r="${R}" fill="none" stroke="#fff" stroke-width="${R * .3}"/><circle r="${R * .3}" fill="#fff"/></g>`;
const tiles = (x0, y0, cols, rows, sz, gap) => {
  const L = [[null, '#10a37f'], ['netflix', '#e50914'], ['spotify', '#1db954'], ['anthropic', '#d97757'], ['youtube', '#ff0000'], ['nordvpn', '#4687ff'], ['google', '#1a73e8'], ['duolingo', '#58cc02'], ['expressvpn', '#da3940'], ['grammarly', '#15c39a'], ['zoom', '#0b5cff'], ['telegram', '#2aabee']];
  let o = ''; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const [s, col] = L[(r * cols + c) % L.length], x = x0 + c * (sz + gap), y = y0 + r * (sz + gap) + (c % 2 ? sz * .35 : 0);
    o += `<rect x="${x}" y="${y}" width="${sz}" height="${sz}" rx="${sz * .2}" fill="${col}"/>` + (s ? `<image href="https://cdn.simpleicons.org/${s}/ffffff" x="${x + sz * .25}" y="${y + sz * .25}" width="${sz * .5}" height="${sz * .5}"/>` : `<g transform="translate(${x + sz * .22} ${y + sz * .22}) scale(${sz * .56 / 24})">${OPENAI_SVG.replace(/<svg[^>]*>|<\/svg>/g, '')}</g>`);
  } return o;
};
function art(i, mobile) {
  const W = mobile ? 1080 : 1920, H = mobile ? 810 : 1080, id = `s${i}${mobile ? 'm' : 'd'}`;
  let body;
  if (i === 0) body = mobile
    ? bgDefs(id, '#04121a', '#0b3b3a', .8, .7, '#14b8a6') + bg(id) + ring(860, 560, 145) +
      T(90, 190, 26, 800, '#5eead4', 'OUTLINE VPN', 'letter-spacing="7"') + T(90, 290, 84, 900, '#fff', 'Private. Fast.') + T(90, 380, 84, 900, '#fff', 'Borderless.') +
      T(90, 450, 30, 500, '#c4d0e6', 'Access keys from 3,550 Ks') + `<rect x="90" y="500" width="360" height="84" rx="8" fill="#14b8a6"/>` + T(270, 553, 28, 800, '#042a26', 'GET ACCESS KEY', 'text-anchor="middle"')
    : bgDefs(id, '#04121a', '#0b3b3a', .75, .5, '#14b8a6') + bg(id) + ring(1440, 540, 250) +
      T(200, 400, 30, 800, '#5eead4', 'OUTLINE VPN', 'letter-spacing="8"') + T(200, 510, 104, 900, '#fff', 'Private. Fast.') + T(200, 620, 104, 900, '#fff', 'Borderless.') +
      T(200, 700, 36, 500, '#c4d0e6', 'Instant ss:// access keys · from 3,550 Ks') + `<rect x="200" y="760" width="400" height="88" rx="8" fill="#14b8a6"/>` + T(400, 816, 30, 800, '#042a26', 'GET ACCESS KEY', 'text-anchor="middle"');
  else body = mobile
    ? bgDefs(id, '#07102a', '#1a3fae', .85, .4, '#5c8cff') + bg(id) + tiles(770, 170, 2, 3, 105, 22) +
      T(90, 190, 26, 800, '#9fc0ff', 'LIVE API STORE', 'letter-spacing="7"') + T(90, 290, 84, 900, '#fff', 'Top up once.') + T(90, 380, 84, 900, '#fff', 'Buy anytime.') +
      T(90, 450, 30, 500, '#c4d0e6', 'ChatGPT · Claude · Canva · VPN') + `<rect x="90" y="500" width="360" height="84" rx="8" fill="#fff"/>` + T(270, 553, 28, 800, '#0b1a30', 'TOP UP WALLET', 'text-anchor="middle"')
    : bgDefs(id, '#07102a', '#1a3fae', .75, .45, '#5c8cff') + bg(id) + tiles(1080, 250, 4, 3, 150, 28) +
      T(200, 400, 30, 800, '#9fc0ff', 'LIVE API STORE', 'letter-spacing="8"') + T(200, 510, 104, 900, '#fff', 'Top up once.') + T(200, 620, 104, 900, '#fff', 'Buy anytime.') +
      T(200, 700, 36, 500, '#c4d0e6', '180+ live packages · Instant & Official Slot/Upgrade') + `<rect x="200" y="760" width="400" height="88" rx="8" fill="#fff"/>` + T(400, 816, 30, 800, '#0b1a30', 'TOP UP WALLET', 'text-anchor="middle"');
  return `<svg class="${mobile ? 'art-m' : 'art-d'}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" style="stroke:none" aria-hidden="true">${body}</svg>`;
}
const bannerHTML = () => `<section class="banner" id="banner" aria-roledescription="carousel" aria-label="Featured">
  <div class="track">${SLIDES.map((s, i) => `<a class="slide ${i ? '' : 'on'}" href="${s.href}" aria-label="${esc(s.alt)}">
    <picture><source media="(min-width:768px)" srcset="${s.d}"><img src="${s.m}" alt="${esc(s.alt)}"></picture></a>`).join('')}</div>
  <button class="barrow l" data-d="-1" aria-label="Previous slide">${ICON.left}</button><button class="barrow r" data-d="1" aria-label="Next slide">${ICON.arrow}</button>
  <div class="dots" role="tablist">${SLIDES.map((_, i) => `<button data-i="${i}" class="${i ? '' : 'on'}" aria-label="Slide ${i + 1}"></button>`).join('')}</div></section>`;
let bIdx = 0, bTimer;
function goSlide(i) {
  bIdx = (i + SLIDES.length) % SLIDES.length;
  $$('.slide').forEach((s, k) => s.classList.toggle('on', k === bIdx));
  $$('.dots button').forEach((d, k) => d.classList.toggle('on', k === bIdx));
}
function initBanner() {
  const b = $('#banner'); if (!b) return;
  const start = () => { clearInterval(bTimer); bTimer = setInterval(() => goSlide(bIdx + 1), 5000); };
  b.addEventListener('click', e => { const t = e.target.closest('[data-d],[data-i]'); if (!t) return; e.preventDefault(); goSlide(t.dataset.i != null ? +t.dataset.i : bIdx + +t.dataset.d); start(); });
  let x0 = null;
  b.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  b.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) { goSlide(bIdx + (dx < 0 ? 1 : -1)); start(); } x0 = null; });
  b.addEventListener('mouseenter', () => clearInterval(bTimer)); b.addEventListener('mouseleave', start);
  const lbl = () => $$('.safe .lbl').forEach(l => l.textContent = matchMedia('(min-width:768px)').matches ? 'DESKTOP 1920×1080 · SAFE 1680×880' : 'MOBILE 1080×810 · SAFE 960×650');
  const szt = $('#szt'); if (szt) szt.onclick = () => { b.classList.toggle('sz'); lbl(); };
  start();
}

/* ---------------- Card & Section Components ---------------- */
function deliveryStatusPill(cat) {
  if (!cat.anyInStock) return `<span class="inst out">${ICON.clock}${LANG === 'mm' ? 'လက်ကျန်မရှိ' : 'Out of Stock'}</span>`;
  if (cat.hasInstant && cat.hasManual) return `<span class="inst">${ICON.bolt}${LANG === 'mm' ? 'ချက်ချင်း / လူကိုယ်တိုင်' : 'Instant &amp; Manual'}</span>`;
  if (cat.hasInstant) return `<span class="inst">${ICON.bolt}${t('instant')}</span>`;
  return `<span class="inst man">${ICON.clock}${LANG === 'mm' ? 'Slot / အဆင့်မြှင့်' : 'Slot / Upgrade'}</span>`;
}

const cardHTML = cat => `<a class="card" href="#/p/${cat.id}" style="--c:${cat.color}">
  <div class="media">${centerMark(cat)}${cat.hot ? `<span class="tag">${bi('HOT','လူကြိုက်')}</span>` : ''}${cat.isNew ? `<span class="tag new" style="${cat.hot ? 'left:auto;right:8px' : ''}">${bi('NEW','အသစ်')}</span>` : (!cat.anyInStock ? `<span class="tag out" style="${cat.hot ? 'left:auto;right:8px' : ''}">${bi('SOLD OUT','ကုန်သွားပြီ')}</span>` : '')}${logo(cat)}</div>
  <div class="ct"><h4>${esc(cat.name)}</h4>${deliveryStatusPill(cat)}<span class="from">${LANG === 'mm' ? 'စတင်စျေး' : 'From'} <b>${cat.minMmk ? fmt(cat.minMmk) + ' Ks' : t('free')}</b> · ${cat.packages.length} ${t('packages')}</span></div></a>`;

const section = (title, list, href) => `<section class="sec"><div class="sh"><span class="st">${title}</span><a class="more" href="${href}">${t('seeMore')} ${ICON.arrow}</a></div><div class="grid">${list.map(cardHTML).join('')}</div></section>`;

/* ---------------- Views ---------------- */
function vHome() {
  const cats = STATE.categories;
  const pickIds = ['outline-vpn', 'chatgpt', 'claude', 'canva', 'google-one', 'netflix', 'capcut', 'codex', 'spotify', 'youtube'];
  const featured = pickIds.map(id => cats.find(c => c.id === id)).filter(Boolean);
  return `<div class="home">
  <section class="hero-row">${bannerHTML()}
    <aside class="hero">
      <div><span class="eyebrow"><i></i> ${LANG === 'mm' ? 'မြန်မာ့ဒစ်ဂျစ်တယ်ဈေးကွက်' : "Myanmar's digital marketplace"}</span><h1>${LANG === 'mm' ? 'ဒစ်ဂျစ်တယ်လိုအပ်ချက်တိုင်း' : 'Everything digital.'}<br><em>${LANG === 'mm' ? 'သင်လိုချိန်မှာ အဆင်သင့်' : 'Ready when you are.'}</em></h1><p>${LANG === 'mm' ? 'Premium app များ၊ AI tool များနှင့် လုံခြုံသော VPN များကို MMK စျေးနှုန်းဖြင့် ဝယ်ယူနိုင်ပါသည်။' : 'Premium apps, AI tools and secure VPN access with transparent MMK pricing and human support.'}</p></div>
      <div class="hstats"><div><b>${STATE.totalProducts}</b><span>${t('packages')}</span></div><div><b>${cats.length}</b><span>${t('categories')}</span></div><div><b>24/7</b><span>${t('support')}</span></div></div>
      <div class="acts2"><a class="btn pri lg" href="#/products">${ICON.bag} ${LANG === 'mm' ? 'အားလုံးကြည့်ရန်' : 'Browse All'} (${STATE.totalProducts})</a><a class="btn lg" href="#/topup">${ICON.wallet} ${LANG === 'mm' ? 'Wallet ငွေဖြည့်ရန်' : 'Top Up Wallet'}</a></div>
    </aside>
  </section>
  <div class="mhero"><a class="btn pri" href="#/products">${ICON.bag} ${LANG === 'mm' ? 'ကြည့်ရန်' : 'Browse'} (${STATE.totalProducts})</a><a class="btn" href="#/topup">${ICON.wallet} ${t('topup')}</a></div>
  ${section(t('popular'), featured, '#/products')}
  ${section(groupLabel('vpn'), cats.filter(p => p.group === 'vpn'), '#/products?g=vpn')}
  ${section(groupLabel('ai'), cats.filter(p => p.group === 'ai'), '#/products?g=ai')}
  ${section(groupLabel('design'), cats.filter(p => p.group === 'design'), '#/products?g=design')}
  ${section(groupLabel('stream'), cats.filter(p => p.group === 'stream'), '#/products?g=stream')}
  <section class="sec"><div class="trust">
    <div><i>${ICON.bolt}</i><span><b>${bi('Instant & Manual','ချက်ချင်း / လူကိုယ်တိုင်')}</b><span>${bi('Live stock & fulfillment type per package','ပက်ကေ့ချ်တိုင်း၏ လက်ကျန်နှင့် ပို့ဆောင်ပုံကို တိုက်ရိုက်ပြသသည်')}</span></span></div>
    <div><i>${ICON.shield}</i><span><b>${bi('Full Package Details','ပက်ကေ့ချ်အသေးစိတ်အပြည့်')}</b><span>${bi('Exact rules & warranty per package','ပက်ကေ့ချ်တစ်ခုချင်း၏ စည်းမျဉ်းနှင့် အာမခံ')}</span></span></div>
    <div><i>${ICON.wallet}</i><span><b>${bi('Local MMK Payments','MMK ဖြင့်ငွေပေးချေမှု')}</b><span>KBZPay, WavePay, AYA &amp; CB Pay</span></span></div>
    <div><i>${ICON.chat}</i><span><b>${bi('Telegram Support','Telegram အကူအညီ')}</b><span>${bi('24/7 order & warranty help','အော်ဒါနှင့် အာမခံအတွက် ၂၄/၇ အကူအညီ')}</span></span></div>
  </div></section></div>`;
}

let catFilter = 'all', q = '';
function vProducts(params) {
  if (params.get('g')) catFilter = params.get('g');
  return `<div class="ph"><div class="crumb"><a href="#/">${t('home')}</a> / ${t('products')}</div><h1>${LANG === 'mm' ? 'ကုန်ပစ္စည်းအားလုံး' : 'All Products'} (${STATE.categories.length} · ${STATE.totalProducts})</h1><p>${LANG === 'mm' ? 'ပက်ကေ့ချ်၊ လက်ကျန်၊ အာမခံနှင့် အသေးစိတ်အချက်အလက်များကို ကြည့်ရန် အမျိုးအစားတစ်ခုရွေးပါ။' : 'Select any category to view its packages, stock, warranty, and full description.'}</p></div>
  <section class="sec" style="margin-top:12px"><div class="fbar">
    <div class="tabs">${Object.keys({ all: 'All', ...GROUPS }).map(k => `<button data-tab="${k}" class="${k === catFilter ? 'on' : ''}">${groupLabel(k)}</button>`).join('')}</div>
    <label class="search">${ICON.search}<input id="q" type="search" placeholder="${bi('Search categories or packages...','အမျိုးအစား သို့မဟုတ် ပက်ကေ့ချ်ရှာရန်...')}" value="${esc(q)}"></label>
  </div><div class="grid wide" id="cards"></div></section>`;
}
function drawCards() {
  const term = q.trim().toLowerCase();
  const list = STATE.categories.filter(c => {
    if (catFilter !== 'all' && c.group !== catFilter) return false;
    if (!term) return true;
    return c.name.toLowerCase().includes(term) || c.packages.some(p => p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term));
  });
  const el = $('#cards');
  if (el) el.innerHTML = list.length ? list.map(cardHTML).join('') : '<p class="empty" style="grid-column:1/-1">No matching products found.</p>';
}

let curCat = null, selIdx = 0, curQty = 1;
function vProduct(id, params) {
  const cat = STATE.categories.find(x => x.id === id);
  if (!cat) return vNotFound();
  curCat = cat;
  const firstInStock = cat.packages.findIndex(x => x.inStock);
  selIdx = params.has('pk') ? +params.get('pk') : (firstInStock >= 0 ? firstInStock : 0);
  curQty = 1;

  return `<div class="pp" style="--c:${cat.color}">
  <aside class="info">
    <div class="cover">${centerMark(cat)}</div>
    <div class="ibody">${logo(cat)}<h1>${esc(cat.name)}</h1>
      <div class="badges" id="pbadges"></div>
      <ul class="feat" id="pmeta"></ul>
    </div>
  </aside>
  <div class="steps">
    <section class="scard">
      <div class="shd"><span class="num">1</span><h2>${t('selectPackage')}</h2><small>${cat.packages.length} ${t('packages')}</small></div>
      <div class="pkgs" id="pkgs">${cat.packages.map((k, i) => {
        const stkText = k.available === null ? '📦 ∞' : (k.available > 0 ? `📦 ${k.available}` : '❌ 0');
        return `<button class="pkg ${i === selIdx ? 'on' : ''} ${!k.inStock ? 'out' : ''}" data-pk="${i}">
          ${packageLogo(cat, k)}
          <b>${esc(pkgName(k))}</b>
          <div class="meta">
            <span class="pill ${k.isInstant ? '' : 'man'}">${k.isInstant ? `⚡ ${t('instant')}` : (k.productType === 'slot' ? `📩 ${bi('Slot Invite','Slot ဖိတ်ကြားမှု')}` : `🛠️ ${bi('Upgrade','အဆင့်မြှင့်')}`)}</span>
            <span class="pill ${k.inStock ? 'stk' : 'out'}">${stkText}</span>
          </div>
          <span class="pr">${k.mmk ? `${fmt(k.mmk)} <span>Ks</span>` : t('free')}</span>
        </button>`;
      }).join('')}</div>
    </section>
    <section class="pdetail" id="pkgdetail"></section>
    <section class="scard">
      <div class="shd"><span class="num">2</span><h2 id="step2title">${t('orderInput')}</h2><small id="step2req"></small></div>
      <div id="reqfields"></div>
    </section>
    <section class="paybar stick" id="paybar"></section>
  </div></div>
  ${section(LANG === 'mm' ? 'ဆက်စပ်အမျိုးအစားများ' : 'Related Categories', STATE.categories.filter(x => x.group === cat.group && x.id !== cat.id).slice(0, 5), '#/products?g=' + cat.group)}`;
}

function getParsedLines(id) {
  const el = $(id);
  if (!el) return [];
  return el.value.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean);
}

function updateSelectedPackageDetails() {
  if (!curCat) return;
  const k = curCat.packages[selIdx];
  if (!k) return;

  const stockLabel = k.available === null ? bi('∞ accounts','အကောင့် အကန့်အသတ်မရှိ') : `${k.available} ${bi('accounts','အကောင့်')}`;
  const maxStock = k.isTestOutline ? 1 : (typeof k.available === 'number' && k.available > 0 ? k.available : 50);
  if (curQty > maxStock) curQty = Math.max(1, maxStock);

  // Left sidebar summary
  const badgesEl = $('#pbadges');
  if (badgesEl) {
    badgesEl.innerHTML = `
      <span class="badge ${k.isInstant ? '' : 'w'}">${k.isInstant ? ICON.bolt : ICON.clock} ${esc(pkgDeliveryLabel(k))}</span>
      <span class="badge b">${ICON.shield} ${esc(productTypeLabel(k.productType))}</span>`;
  }
  const metaEl = $('#pmeta');
  if (metaEl) {
    metaEl.innerHTML = `
      <li><b>${LANG === 'mm' ? 'ရွေးထားသည်' : 'Selected'}:</b> ${esc(pkgName(k))}</li>
      <li><b>${t('price')}:</b> ${k.mmk ? fmt(k.mmk) + ' Ks' : t('free')}</li>
      <li><b>${t('stock')}:</b> ${esc(stockLabel)} · <b>${t('sold')}:</b> ${fmt(k.sold)}</li>
      <li><b>${LANG === 'mm' ? 'ပို့ဆောင်မှု' : 'Fulfillment'}:</b> ${esc(pkgDeliveryHint(k))}</li>`;
  }

  // Full Package Details Card (matches exact Telegram bot output per package)
  const pdEl = $('#pkgdetail');
  if (pdEl) {
    const promos = (k.promotions || []).map(pr => `🎁 Promotion: Buy ${pr.minQty} get ${pr.bonusQty ? `${pr.bonusQty} bonus` : `${pr.percent}% off`}`).join(' · ');
    pdEl.innerHTML = `
      <div class="pd-head">
        ${packageLogo(curCat, k)}
        <div>
          <h3>${esc(pkgName(k))}</h3>
          <span class="inst ${k.isInstant ? '' : 'man'}">${k.isInstant ? ICON.bolt : ICON.clock} ${esc(pkgDeliveryLabel(k))}</span>
        </div>
      </div>
      <div class="pd-stats">
        <div class="pd-stat"><small>${t('price')}</small><b>${k.mmk ? fmt(k.mmk) + ' Ks' : t('free')}</b></div>
        <div class="pd-stat"><small>${t('stock')}</small><b>${esc(stockLabel)}</b></div>
        <div class="pd-stat"><small>${t('sold')}</small><b>${fmt(k.sold)}</b></div>
        <div class="pd-stat"><small>${t('type')}</small><b>${esc(productTypeLabel(k.productType))}</b></div>
      </div>
      ${promos ? `<div class="pd-promo">${esc(promos)}</div>` : ''}
      <div class="pd-desc-lbl">${t('packageDetails')}</div>
      <div class="pd-desc ${LANG === 'mm' ? 'mm-copy' : ''}">${LANG === 'mm' ? esc(k.fullDescriptionMm || 'ရောင်းသူ API မှ ပက်ကေ့ချ်ဖော်ပြချက်အပြည့်အစုံကို မြန်မာဘာသာသို့ ပြန်ဆိုနေပါသည်…') : linkify(pkgDescription(k) || `${pkgName(k)}\n\n${pkgDeliveryHint(k)}`)}</div>
      ${LANG === 'mm' ? `<div class="lang-note">ရောင်းသူ API ၏ မူရင်းဖော်ပြချက်ကို အပြည့်အစုံ မြန်မာဘာသာပြန်ဆိုပြီး URL၊ နံပါတ်နှင့် အာမခံကာလများကို မပြောင်းလဲဘဲ ထိန်းသိမ်းထားပါသည်။</div>` : ''}`;
    if (LANG === 'mm' && !k.fullDescriptionMm) loadFullPackageTranslation(k);
  }

  // Step 2: Dynamic Order Input (matches exact Telegram bot prompt per package type)
  const titleEl = $('#step2title');
  const reqNote = $('#step2req');
  const rf = $('#reqfields');
  if (!rf) return;

  if (k.requiresEmail) {
    // Slot product: "📧 Please enter email(s) to receive slot (one email per line). 💡 Quantity will be auto-calculated based on the number of emails you enter."
    if (titleEl) titleEl.textContent = bi('Enter Email(s) to Receive Slot','Slot လက်ခံရန် Email ထည့်ပါ');
    if (reqNote) reqNote.textContent = bi('Required · Auto-calculates quantity','မဖြစ်မနေ · အရေအတွက်အလိုအလျောက်တွက်မည်');
    const monthsSelect = (k.requiresSlotMonths && Array.isArray(k.allowedMonths))
      ? `<div style="margin-bottom:14px"><label class="fld"><span>${bi('Slot Duration (Months)','Slot အသုံးပြုမည့်ကာလ (လ)')} *</span><select id="f_months" style="width:100%;background:transparent;border:0;border-bottom:1px solid var(--bd2);padding:10px 0;font-size:15px;color:#fff">${k.allowedMonths.map(m => `<option value="${m}" style="background:var(--bg1)">${m} ${bi(m > 1 ? 'Months' : 'Month','လ')}</option>`).join('')}</select></label></div>`
      : '';
    rf.innerHTML = `${monthsSelect}
      <label class="fld">
        <span>📧 ${bi('Please enter email(s) to receive slot (one email per line)','Slot လက်ခံမည့် Email များကို တစ်ကြောင်းလျှင် တစ်ခုစီထည့်ပါ')} *</span>
        <textarea id="f_emails" rows="3" placeholder="user1@gmail.com&#10;user2@gmail.com"></textarea>
      </label>
      <p class="help" style="margin-top:8px">💡 ${bi('Quantity is calculated from the number of emails','ထည့်ထားသော Email အရေအတွက်အတိုင်း Slot အရေအတွက်ကို အလိုအလျောက်တွက်ပေးမည်')} (<b id="em_count">1</b>)</p>`;
    const ta = $('#f_emails');
    if (ta) {
      ta.oninput = () => {
        const list = getParsedLines('#f_emails');
        curQty = Math.max(1, Math.min(maxStock, list.length || 1));
        const ec = $('#em_count'); if (ec) ec.textContent = curQty;
        drawPay();
      };
    }
  } else if (k.requiresAccounts) {
    // Upgrade Account product: enter account(s) one per line
    if (titleEl) titleEl.textContent = bi('Enter Account(s) to Upgrade','အဆင့်မြှင့်မည့် အကောင့်များထည့်ပါ');
    if (reqNote) reqNote.textContent = bi('Required · 1 account per line','မဖြစ်မနေ · တစ်ကြောင်းလျှင် အကောင့်တစ်ခု');
    rf.innerHTML = `
      <label class="fld">
        <span>🛠️ ${bi('Enter account details for upgrade (one per line — Email or Email | Password)','အဆင့်မြှင့်မည့်အကောင့်ကို တစ်ကြောင်းလျှင် တစ်ခုစီထည့်ပါ — Email သို့မဟုတ် Email | Password')} *</span>
        <textarea id="f_accounts" rows="3" placeholder="account1@gmail.com&#10;account2@gmail.com"></textarea>
      </label>
      <p class="help" style="margin-top:8px">💡 ${bi('Quantity is calculated from the number of accounts','ထည့်ထားသောအကောင့်အရေအတွက်အတိုင်း အရေအတွက်ကို အလိုအလျောက်တွက်ပေးမည်')} (<b id="ac_count">1</b>)</p>`;
    const ta = $('#f_accounts');
    if (ta) {
      ta.oninput = () => {
        const list = getParsedLines('#f_accounts');
        curQty = Math.max(1, Math.min(maxStock, list.length || 1));
        const ac = $('#ac_count'); if (ac) ac.textContent = curQty;
        drawPay();
      };
    }
  } else {
    // Instant Account product: "✏️ Enter quantity to buy (1-N):"
    if (titleEl) titleEl.textContent = bi(`Enter Quantity to Buy (1–${maxStock})`,`ဝယ်ယူမည့်အရေအတွက်ထည့်ပါ (၁–${maxStock})`);
    if (reqNote) reqNote.textContent = bi('Instant Delivery','ချက်ချင်းပို့ပေးမည်');
    rf.innerHTML = `<div class="fields two">
      <div class="fld"><span>✏️ ${bi(`Quantity to buy (1–${maxStock})`,`ဝယ်ယူမည့်အရေအတွက် (၁–${maxStock})`)}</span>
        <div class="qrow"><button type="button" class="qbtn" data-q="-1">−</button><input id="f_qty" class="qin" type="number" min="1" max="${maxStock}" value="${curQty}"><button type="button" class="qbtn" data-q="1">+</button></div>
      </div>
      <label class="fld"><span>${bi('Telegram / Email (Optional backup)','Telegram / Email (အရန်ဆက်သွယ်ရန်)')}</span><input id="f_email" type="text" placeholder="@username or email" autocomplete="off"></label>
    </div>
    <p class="help" style="margin-top:8px">⚡ ${bi('Account credentials / JSON keys are delivered immediately and saved in History.','အကောင့်အချက်အလက် / JSON key များကို ချက်ချင်းပြသပြီး မှတ်တမ်းတွင် သိမ်းထားမည်။')}</p>`;
    const qin = $('#f_qty');
    if (qin) {
      qin.oninput = () => {
        curQty = Math.max(1, Math.min(maxStock, parseInt(qin.value || 1, 10)));
        drawPay();
      };
    }
  }

  drawPay();
}

function drawPay() {
  if (!curCat) return;
  const k = curCat.packages[selIdx];
  const total = k.mmk * curQty;
  const short = total - STATE.bal;
  const pb = $('#paybar');
  if (!pb) return;

  let actionBtn = '';
  if (!k.inStock) {
    actionBtn = `<button class="btn lg block" disabled>${bi('OUT OF STOCK','လက်ကျန်မရှိ')}</button>`;
  } else if (short > 0) {
    actionBtn = `<a class="btn pri lg block" href="#/topup?need=${short}">${ICON.wallet} ${bi('Top Up','ငွေဖြည့်ရန်')} (+${fmt(short)} Ks)</a>`;
  } else {
    actionBtn = `<button class="btn pri lg block" data-act="confirm">${k.isTestOutline ? (LANG === 'mm' ? '5 GB စမ်းသပ် Key ရယူရန်' : 'GET 5 GB TEST KEY') : (LANG === 'mm' ? 'ယခုဝယ်ယူရန်' : 'BUY NOW')}</button>`;
  }

  pb.innerHTML = `<div><h3>${LANG === 'mm' ? 'ရွေးထားသည်' : 'Selected'} (${esc(pkgDeliveryLabel(k))})</h3>
    <div class="sel">${esc(pkgName(k))} × ${curQty}
      <small>${!k.inStock ? `<span class="warn">${bi('Out of stock','လက်ကျန်မရှိ')}</span>` : (short > 0 ? `<span class="warn">${bi('Wallet short by','Wallet လိုငွေ')} ${fmt(short)} Ks (${t('walletBalance')}: ${fmt(STATE.bal)} Ks)</span>` : `${t('walletBalance')}: ${fmt(STATE.bal)} Ks`)}</small>
    </div></div>
    <div class="tot"><span>${LANG === 'mm' ? 'စုစုပေါင်း' : 'Total Payment'}</span><b>${total ? fmt(total) + ' Ks' : t('free')}</b></div>
    ${actionBtn}`;
}

function confirmBuy() {
  const k = curCat.packages[selIdx];
  const slotMonths = $('#f_months') ? +$('#f_months').value : undefined;
  let emailVal = ($('#f_email')?.value || '').trim();
  let emailList = [];
  let accList = [];

  if (k.requiresEmail) {
    emailList = getParsedLines('#f_emails');
    const invalid = emailList.find(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (!emailList.length || invalid) {
      $('#f_emails')?.focus();
      return toast(invalid ? `${bi('Invalid email','Email မမှန်ပါ')}: ${invalid}` : bi('Please enter at least one valid email to receive the slot.','Slot လက်ခံရန် မှန်ကန်သော Email အနည်းဆုံးတစ်ခု ထည့်ပါ။'));
    }
    curQty = emailList.length;
    emailVal = emailList[0];
  } else if (k.requiresAccounts) {
    accList = getParsedLines('#f_accounts');
    if (!accList.length) {
      $('#f_accounts')?.focus();
      return toast(bi('Please enter your account identifier(s) to upgrade.','အဆင့်မြှင့်မည့် အကောင့်အချက်အလက်ကို ထည့်ပါ။'));
    }
    curQty = accList.length;
  }

  const total = k.mmk * curQty;
  const m = modal(`<h3>${k.isTestOutline ? (LANG === 'mm' ? 'စမ်းသပ် Key ရယူရန်' : 'Get your test key') : (LANG === 'mm' ? 'ဝယ်ယူမှုအတည်ပြုရန်' : 'Confirm Purchase')}</h3><p>${esc(pkgDeliveryHint(k))}</p>
    <div class="msum">
      <div class="mrow"><span>${t('packages')}</span><b>${esc(pkgName(k))}</b></div>
      <div class="mrow"><span>${LANG === 'mm' ? 'ပို့ဆောင်မှု' : 'Fulfillment'}</span><b>${esc(pkgDeliveryLabel(k))}</b></div>
      <div class="mrow"><span>${t('quantity')}</span><b>${curQty}</b></div>
      ${emailList.length ? `<div class="mrow"><span>${bi('Slot Email(s)','Slot Email များ')}</span><b>${esc(emailList.join(', '))}</b></div>` : ''}
      ${accList.length ? `<div class="mrow"><span>${bi('Upgrade Account(s)','အဆင့်မြှင့်မည့်အကောင့်များ')}</span><b>${esc(accList.join(', '))}</b></div>` : ''}
      <div class="mrow"><span>${bi('Balance After','ဝယ်ပြီးနောက်လက်ကျန်')}</span><b>${fmt(STATE.bal - total)} Ks</b></div>
      <div class="mrow t"><span>${LANG === 'mm' ? 'စုစုပေါင်း' : 'Total Payment'}</span><b>${total ? fmt(total) + ' Ks' : t('free')}</b></div>
    </div>
    <div class="macts"><button class="btn lg" data-x>${bi('Cancel','မလုပ်တော့ပါ')}</button><button class="btn pri lg" id="ok">${bi('Confirm & Pay','အတည်ပြုပြီး ပေးချေမည်')}</button></div>`);
  m.querySelector('#ok').onclick = () => {
    m.remove();
    doBuy({
      productId: k.productId,
      quantity: curQty,
      customerEmail: emailVal,
      customerEmails: emailList,
      customerAccounts: accList,
      slotMonths
    });
  };
}

async function doBuy(payload) {
  try {
    const res = await fetch('/api/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, allowSandboxFallback: true })
    }).then(r => r.json());

    if (!res.success) return toast(res.message || 'Purchase failed');
    setWalletUI(res.balanceMmk);
    STATE.buys.unshift(res.order);
    drawPay();
    showOrder(res.order, true);
  } catch (e) {
    toast('Network error while processing purchase');
  }
}

function formatOrderCredentials(o) {
  if (Array.isArray(o.accounts) && o.accounts.length) {
    return o.accounts.map((a, idx) => {
      const lines = [];
      if (o.accounts.length > 1) lines.push(`--- ${bi('Account','အကောင့်')} #${idx + 1} ---`);
      if (a.user) lines.push(a.password ? `${bi('User','အသုံးပြုသူ')}: ${a.user}` : a.user);
      if (a.password) lines.push(`${bi('Password','စကားဝှက်')}: ${a.password}`);
      if (a.verifyEmail) lines.push(`${bi('Verify Email','အတည်ပြု Email')}: ${a.verifyEmail}`);
      if (a.expiryText) lines.push(`${bi('Expiry','သက်တမ်းကုန်ချိန်')}: ${a.expiryText}`);
      if (a.otherInfo) lines.push(`${bi('Info','အချက်အလက်')}: ${a.otherInfo}`);
      return lines.join('\n');
    }).join('\n\n');
  }
  if (o.deliveryMode === 'slot') {
    return `${bi('Status','အခြေအနေ')}: ${o.fulfillmentStatus || 'waiting_seller'}\n${bi('Slot Invitation Email','Slot ဖိတ်ကြားမည့် Email')}: ${o.customerEmail || bi('Submitted','ပို့ပြီး')}\n${bi('Note: Admin will send the invitation link to your email shortly.','မှတ်ချက် — အက်ဒမင်က ဖိတ်ကြား link ကို သင့် Email သို့ မကြာမီပို့ပေးပါမည်။')}`;
  }
  if (o.deliveryMode === 'upgrade') {
    return `${bi('Status','အခြေအနေ')}: ${o.fulfillmentStatus || 'waiting_seller'}\n${bi('Upgrade Account(s)','အဆင့်မြှင့်မည့်အကောင့်များ')}: ${(o.customerAccounts || []).join(', ')}\n${bi('Note: Supplier has received your order and is upgrading your account.','မှတ်ချက် — ရောင်းချသူက အော်ဒါလက်ခံရရှိပြီး အကောင့်ကို အဆင့်မြှင့်နေပါသည်။')}`;
  }
  return o.code || bi('Order recorded.','အော်ဒါမှတ်တမ်းတင်ပြီးပါပြီ။');
}

function showOrder(o, fresh) {
  if (!o) return;
  const credText = formatOrderCredentials(o);
  modal(`${fresh ? `<div class="okic">${ICON.check}</div><h3>${o.status === 'completed' ? bi('Purchase Completed','ဝယ်ယူမှုအောင်မြင်ပါသည်') : bi('Order Submitted','အော်ဒါပို့ပြီးပါပြီ')}</h3>` : `<h3>${esc(o.productName || o.n)}</h3>`}
    <p>${esc(o.productName || o.n)} · ${t('quantity')} ${o.quantity || 1} · <b>${fmt(o.totalMmk || o.p)} Ks</b></p>
    <div class="oid">${bi('Order Code','အော်ဒါကုဒ်')}: ${esc(o.orderCode || o.id)} · ${bi('Status','အခြေအနေ')}: ${esc((o.status || 'completed').toUpperCase())}</div>
    <div class="cred" id="cred">${esc(credText)}</div>
    ${o.categoryId === 'outline-vpn' ? `<p style="font-size:12px;color:var(--t2)">${bi('Install Outline Client → tap "+" → paste your ss:// access key above.','Outline Client ကိုသွင်းပါ → "+" ကိုနှိပ်ပါ → အပေါ်ရှိ ss:// access key ကို ထည့်ပါ။')}</p>` : ''}
    <div class="macts"><button class="btn lg" data-copy="${esc(credText)}">${bi('Copy Details','အသေးစိတ်ကူးယူရန်')}</button><a class="btn pri lg" href="#/orders?t=buy" data-x>${bi('View in History','မှတ်တမ်းတွင်ကြည့်ရန်')}</a></div>`, 'c');
}

/* ---------------- Top Up View ---------------- */
function vTopup(params) {
  const need = +params.get('need') || 0, pre = need ? Math.max(1000, Math.ceil(need / 500) * 500) : '';
  return `<div class="ph"><div class="crumb"><a href="#/">${t('home')}</a> / ${t('topup')}</div><h1>${t('topupWallet')}</h1><p>${bi('Transfer the exact MMK amount, upload your payment screenshot, and get credited.','သတ်မှတ်ထားသော MMK ပမာဏအတိအကျ လွှဲပြီး ငွေလွှဲ screenshot တင်ပါ။ အက်ဒမင်အတည်ပြုပြီးပါက Wallet ထဲသို့ ငွေဝင်ပါမည်။')}</p></div>
  <div class="pp" style="grid-template-columns:minmax(0,1fr)">
  <div class="steps" style="max-width:860px;width:100%;margin:0 auto">
    <section class="scard"><div class="shd"><span class="num">1</span><h2>${bi('Enter Amount','ငွေပမာဏထည့်ပါ')}</h2><small>${bi('Min','အနည်းဆုံး')} 1,000 Ks</small></div>
      <label class="fld big"><span>${bi('Amount','ငွေပမာဏ')} (Ks)</span><input id="amt" type="number" inputmode="numeric" min="1000" step="500" placeholder="0" value="${pre}"></label>
      <div class="amts">${[5000, 10000, 20000, 50000].map(v => `<button data-amt="${v}">${fmt(v)} Ks</button>`).join('')}</div></section>
    <section class="scard"><div class="shd"><span class="num">2</span><h2>${bi('Payment Method','ငွေပေးချေနည်း')}</h2></div>
      <div class="methods">${METHODS.map(([n, c, a], i) => `<button class="mth ${i ? '' : 'on'}" data-m="${i}"><span class="mi" style="background:${c};${c === '#ffcc00' ? 'color:#111' : ''}">${a}</span>${n}</button>`).join('')}</div></section>
    <section class="scard"><div class="shd"><span class="num">3</span><h2>${bi('Transfer To','လွှဲရမည့်အကောင့်')}</h2></div>
      <div class="acct" id="acct"></div></section>
    <section class="scard"><div class="shd"><span class="num">4</span><h2>${bi('Upload Payment Screenshot','ငွေလွှဲ Screenshot တင်ပါ')}</h2><small>${t('required')}</small></div>
      <label class="drop" id="drop"><input type="file" id="file" accept="image/png,image/jpeg,image/webp"><span><span class="ui">${ICON.up}</span><b>${bi('Tap to upload or drag & drop','တင်ရန်နှိပ်ပါ သို့မဟုတ် ဖိုင်ကိုဆွဲထည့်ပါ')}</b><small>PNG, JPG or WEBP · ${bi('max','အများဆုံး')} 5 MB</small></span></label>
      <ul class="rules"><li>${bi('Transaction ID, amount and date must be clearly visible.','Transaction ID၊ ငွေပမာဏနှင့် ရက်စွဲကို ရှင်းလင်းစွာ မြင်ရမည်။')}</li><li>${bi('Amount must match your transfer. Edited screenshots are rejected.','ထည့်ထားသောပမာဏနှင့် ငွေလွှဲပမာဏ တူရမည်။ ပြင်ဆင်ထားသော screenshot များကို လက်မခံပါ။')}</li></ul></section>
    <section class="paybar stick"><div><h3>${bi('Top Up Summary','ငွေဖြည့်အကျဉ်းချုပ်')}</h3><div class="sel" id="tsum">${bi('Enter amount','ငွေပမာဏထည့်ပါ')}<small>${bi('Screenshot required','Screenshot မဖြစ်မနေလိုသည်')}</small></div></div>
      <div class="tot"><span>${bi('Amount','ငွေပမာဏ')}</span><b id="tamt">0 Ks</b></div><button class="btn pri lg block" id="send" disabled>${bi('SUBMIT TOP UP','ငွေဖြည့်တောင်းဆိုမည်')}</button></section>
  </div></div>`;
}
function initTopup() {
  let img = '', mi = 0;
  const acct = () => { const [n, , , no] = METHODS[mi]; $('#acct').innerHTML = `<div><small>${n}</small><b>${no}</b><span>Exabyte Digital Store</span></div><button class="cpy" data-copy="${no.replace(/\s/g, '')}">${bi('Copy','ကူးယူရန်')}</button>`; };
  const chk = () => {
    const a = +$('#amt').value || 0; $('#tamt').textContent = fmt(a) + ' Ks';
    $$('[data-amt]').forEach(b => b.classList.toggle('on', +b.dataset.amt === a));
    $('#tsum').innerHTML = `${a >= 1000 ? fmt(a) + ' Ks · ' + METHODS[mi][0] : bi('Enter amount (min 1,000)','ငွေပမာဏထည့်ပါ (အနည်းဆုံး ၁,၀၀၀)')}<small>${img ? `<span style="color:#4ade80">${bi('Screenshot attached','Screenshot တင်ပြီး')}</span>` : `<span class="warn">${bi('Screenshot required','Screenshot မဖြစ်မနေလိုသည်')}</span>`}</small>`;
    $('#send').disabled = !(a >= 1000 && img);
  };
  const load = f => {
    if (!f || !f.type.startsWith('image/')) return toast(bi('Please choose an image','ပုံဖိုင်ရွေးပါ။'));
    if (f.size > 5e6) return toast(bi('File too large (max 5 MB)','ဖိုင်အရွယ်အစားကြီးလွန်းသည် (အများဆုံး 5 MB)'));
    const r = new FileReader();
    r.onload = () => {
      const im = new Image(); im.onload = () => {
        const sc = Math.min(1, 900 / Math.max(im.width, im.height)), cv = document.createElement('canvas');
        cv.width = im.width * sc; cv.height = im.height * sc; cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        img = cv.toDataURL('image/jpeg', .75);
        const d = $('#drop'); d.classList.add('has');
        d.innerHTML = `<input type="file" id="file" accept="image/png,image/jpeg,image/webp"><img src="${img}" alt="${bi('Payment screenshot preview','ငွေလွှဲ screenshot နမူနာ')}"><span class="chg">${bi('Change','ပြောင်းရန်')}</span>`;
        $('#file').onchange = e => load(e.target.files[0]); chk();
      }; im.src = r.result;
    }; r.readAsDataURL(f);
  };
  $('#amt').oninput = chk;
  $$('[data-amt]').forEach(b => b.onclick = () => { $('#amt').value = b.dataset.amt; chk(); });
  $$('[data-m]').forEach(b => b.onclick = () => { mi = +b.dataset.m; $$('[data-m]').forEach(x => x.classList.toggle('on', x === b)); acct(); chk(); });
  $('#file').onchange = e => load(e.target.files[0]);
  const d = $('#drop');
  ['dragenter', 'dragover'].forEach(ev => d.addEventListener(ev, e => { e.preventDefault(); d.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => d.addEventListener(ev, e => { e.preventDefault(); d.classList.remove('drag'); }));
  d.addEventListener('drop', e => load(e.dataTransfer.files[0]));
  $('#send').onclick = async () => {
    $('#send').disabled = true;
    try {
      const res = await fetch('/api/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountMmk: +$('#amt').value, method: METHODS[mi][0], screenshot: img })
      }).then(r => r.json());
      if (!res.success) { $('#send').disabled = false; return toast(res.message || 'Failed'); }
      STATE.tops.unshift(res.topup);
      modal(`<div class="okic">${ICON.check}</div><h3>${LANG === 'mm' ? 'ငွေဖြည့်တောင်းဆိုမှု ပို့ပြီးပါပြီ' : 'Top Up Submitted'}</h3><p>${LANG === 'mm' ? 'ငွေလွှဲ screenshot ကို Telegram admin bot သို့ ပို့ထားပြီး အက်ဒမင်အတည်ပြုချက်ကို စောင့်နေပါသည်။' : 'Your payment screenshot was sent to the Telegram admin review bot. Your wallet will update after approval.'}</p><div class="oid">Request ID: ${res.topup.id}</div>
        <div class="macts"><a class="btn lg" href="#/orders?t=top" data-x>${bi('View Requests','တောင်းဆိုမှုကြည့်ရန်')}</a><a class="btn pri lg" href="#/products" data-x>${bi('Browse Store','စတိုးကြည့်ရန်')}</a></div>`, 'c');
      location.hash = '#/orders?t=top';
    } catch {
      $('#send').disabled = false;
      toast(bi('Network error submitting top up','ငွေဖြည့်တောင်းဆိုရာတွင် ကွန်ရက်ပြဿနာဖြစ်နေသည်။'));
    }
  };
  acct(); chk();
}

/* ---------------- History View ---------------- */
function vOrders(params) {
  const t = params.get('t') || 'buy';
  const buys = STATE.buys.length ? STATE.buys.map(o => {
    const c = STATE.categories.find(x => x.id === o.categoryId) || STATE.categories[0] || { color: '#2f6bff', name: 'E' };
    const code = o.orderCode || o.id;
    return `<div class="hr">${logo(c)}<div class="ht"><b>${esc(o.productName || o.n)} (×${o.quantity || 1})</b><small>${esc(code)} · ${esc(new Date(o.createdAt || o.d).toLocaleString())} · ${esc((o.status || 'completed').toUpperCase())}</small></div><div class="ha"><b>-${fmt(o.totalMmk || o.p)} Ks</b><button class="lk" data-order="${esc(code)}">${bi('View details','အသေးစိတ်ကြည့်ရန်')}</button></div></div>`;
  }).join('') : `<p class="empty">${bi('No purchases yet.','ဝယ်ယူမှုမရှိသေးပါ။')} <a class="lk" href="#/products">${bi('Browse products','ကုန်ပစ္စည်းများကြည့်ရန်')}</a></p>`;

  const tops = STATE.tops.length ? STATE.tops.map(x => {
    const ok = x.status === 'approved' || x.ok;
    return `<div class="hr"><span class="thumb topup-thumb">${ICON.wallet}</span><div class="ht"><b>${esc(x.method || x.m)} ${COPY[LANG].topup}</b><small>${esc(x.id)} · ${esc(new Date(x.createdAt || x.d).toLocaleString())}</small></div><div class="ha"><b>+${fmt(x.amountMmk || x.amt)} Ks</b><span class="stt ${ok ? 'ok' : ''}">${ok ? COPY[LANG].approved : (x.status === 'rejected' ? COPY[LANG].rejected : COPY[LANG].pending)}</span></div></div>`;
  }).join('') : `<p class="empty">${bi('No top up requests yet.','ငွေဖြည့်တောင်းဆိုမှု မရှိသေးပါ။')} <a class="lk" href="#/topup">${bi('Top up now','ယခုငွေဖြည့်ရန်')}</a></p>`;

  return `<div class="ph"><div class="crumb"><a href="#/">${COPY[LANG].home}</a> / ${COPY[LANG].history}</div><h1>${bi('Order & Top Up History','အော်ဒါနှင့် ငွေဖြည့်မှတ်တမ်း')}</h1><p>${bi('View delivered accounts, slot invitations, and top-up requests.','ပို့ဆောင်ပြီးသော အကောင့်များ၊ Slot ဖိတ်ကြားမှုများနှင့် ငွေဖြည့်တောင်းဆိုမှုများကို ကြည့်နိုင်သည်။')}</p></div>
  <section class="sec" style="margin-top:12px"><div class="fbar"><div class="tabs"><button data-ot="buy" class="${t === 'buy' ? 'on' : ''}">${COPY[LANG].purchaseHistory} (${STATE.buys.length})</button><button data-ot="top" class="${t === 'top' ? 'on' : ''}">${COPY[LANG].topupHistory} (${STATE.tops.length})</button></div></div>
  <div class="hl">${t === 'buy' ? buys : tops}</div></section>`;
}

/* ---------------- API Status & Documentation View ---------------- */
function vApi() {
  return `<div class="ph"><div class="crumb"><a href="#/">${t('home')}</a> / API</div><h1>${bi('Live API Integration & Reseller Docs','တိုက်ရိုက် API ချိတ်ဆက်မှုနှင့် ပြန်လည်ရောင်းချသူလမ်းညွှန်')}</h1><p>${bi('Connected to the live Canboso Buyer API v2 catalog.','Canboso Buyer API v2 ၏ တိုက်ရိုက် Catalog နှင့် ချိတ်ဆက်ထားပါသည်။')}</p></div>
  <div class="pp" style="grid-template-columns:minmax(0,1fr)"><div class="steps" style="max-width:860px;width:100%;margin:0 auto">
  <section class="scard"><div class="shd"><span class="num">1</span><h2>${bi('Live Catalog Status','တိုက်ရိုက် Catalog အခြေအနေ')}</h2><button class="btn" id="refreshCat" style="margin-left:auto;height:34px;padding:0 12px;font-size:12px">${bi('Sync Now','ယခုပြန်လည်ရယူရန်')}</button></div>
    <div class="msum" style="margin:0">
      <div class="mrow"><span>${bi('Catalog Source','Catalog ရင်းမြစ်')}</span><b>${esc(STATE.source.toUpperCase())} (${STATE.totalProducts} ${t('packages')} · ${STATE.categories.length} ${t('categories')})</b></div>
      <div class="mrow"><span>${bi('Fulfillment Types','ပို့ဆောင်မှုပုံစံများ')}</span><b>${bi('account (Instant) · slot (Email Invite) · upgrade_account (Manual Upgrade)','အကောင့် (ချက်ချင်း) · Slot (Email ဖိတ်ကြားမှု) · အကောင့်အဆင့်မြှင့် (လူကိုယ်တိုင်)')}</b></div>
      <div class="mrow"><span>${bi('Last Synced','နောက်ဆုံးရယူချိန်')}</span><b>${esc(STATE.fetchedAt ? new Date(STATE.fetchedAt).toLocaleString() : bi('Just now','ယခု'))}</b></div>
    </div></section>
  <section class="scard"><div class="ep"><span class="mt">GET</span><b>/api/catalog</b></div><p class="help" style="margin:0 0 10px">Fetches live Canboso /api/v2/telegram-buyer/products + Outline VPN packages, applies the configured MMK pricing, and classifies instant vs manual slot/upgrade requirements.</p><div class="code">GET http://localhost:60010/api/catalog</div></section>
  <section class="scard"><div class="ep"><span class="mt post">POST</span><b>/api/purchase</b></div><p class="help" style="margin:0 0 10px">Purchases a package using wallet balance and forwards to POST https://canboso.com/api/v2/telegram-buyer/purchase with Idempotency-Key.</p><div class="code">POST http://localhost:60010/api/purchase\nContent-Type: application/json\n\n{\n  "productId": "6a57762993139fafaedf1672",\n  "quantity": 1,\n  "customerEmail": "buyer@example.com"\n}</div></section>
  </div></div>`;
}
const vNotFound = () => `<div class="ph"><h1>Page not found</h1><p><a class="lk" href="#/">Back to home</a></p></div>`;

/* ---------------- Router ---------------- */
async function render(resetScroll = true) {
  const v = $('#view');
  if (!STATE.loaded) {
    v.innerHTML = `<div class="ph"><h1>Loading store catalog...</h1><p>Fetching live products and packages...</p></div>`;
    try { await loadBackendData(false); } catch (e) { v.innerHTML = `<div class="ph"><h1>Error loading catalog</h1><p>${esc(e.message)}</p></div>`; return; }
  }
  const [path, qs = ''] = location.hash.slice(1).split('?'), params = new URLSearchParams(qs), seg = (path || '/').split('/').filter(Boolean);
  const r = seg[0] || 'home';
  clearInterval(bTimer); closeMenu();
  const navKey = r === 'products' && params.get('g') === 'vpn' ? 'vpn' : r === 'p' ? 'products' : r;
  $$('[data-r]').forEach(a => a.classList.toggle('on', a.dataset.r === navKey));

  if (r === 'home') { v.innerHTML = vHome(); initBanner(); }
  else if (r === 'products') { v.innerHTML = vProducts(params); drawCards(); $('#q').oninput = e => { q = e.target.value; drawCards(); }; }
  else if (r === 'p') { v.innerHTML = vProduct(seg[1], params); if (curCat && curCat.id === seg[1]) updateSelectedPackageDetails(); }
  else if (r === 'topup') { v.innerHTML = vTopup(params); initTopup(); }
  else if (r === 'orders') v.innerHTML = vOrders(params);
  else if (r === 'api') {
    v.innerHTML = vApi();
    const btn = $('#refreshCat');
    if (btn) btn.onclick = async () => { btn.textContent = 'Syncing...'; await loadBackendData(true); toast('Catalog synced from Canboso API'); render(); };
  }
  else v.innerHTML = vNotFound();
  if (resetScroll !== false) scrollTo(0, 0);
}

let liveSyncing = false;
async function syncLiveSellerData() {
  if (liveSyncing || document.hidden || !STATE.loaded) return;
  liveSyncing = true;
  const y = scrollY;
  const selectedProductId = curCat && curCat.packages[selIdx] ? curCat.packages[selIdx].productId : null;
  try {
    await loadBackendData(false);
    const route = (location.hash.slice(1).split('?')[0] || '/').split('/').filter(Boolean);
    if (route[0] === 'p' && route[1]) {
      const freshCategory = STATE.categories.find(c => c.id === route[1]);
      if (freshCategory) {
        curCat = freshCategory;
        const freshIndex = freshCategory.packages.findIndex(p => p.productId === selectedProductId);
        if (freshIndex >= 0) selIdx = freshIndex;
        updateSelectedPackageDetails();
      }
    } else if (!document.querySelector('input:focus,textarea:focus,select:focus')) {
      await render(false);
    }
    scrollTo({ top: y, left: 0, behavior: 'instant' });
  } catch (error) {
    console.warn('Live seller sync failed:', error);
  } finally {
    liveSyncing = false;
  }
}

/* ---------------- Global Events ---------------- */
const menu = $('#mmenu'), burger = $('#burger');
function closeMenu() { menu.hidden = true; burger.setAttribute('aria-expanded', 'false'); }
burger.onclick = () => { menu.hidden = false; burger.setAttribute('aria-expanded', 'true'); };
$('#authBtn').onclick = showAuth;
$('#mAuthBtn').onclick = showAuth;
$$('[data-lang]').forEach(button => button.onclick = () => {
  const y = scrollY;
  LANG = button.dataset.lang;
  localStorage.setItem('exa_lang', LANG);
  applyLanguageChrome();
  render(false).then(() => scrollTo({ top: y, left: 0, behavior: 'instant' }));
});
menu.addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenu(); $$('.modal').forEach(m => m.remove()); } });

document.addEventListener('click', async e => {
  const tab = e.target.closest('[data-tab]');
  if (tab) { catFilter = tab.dataset.tab; $$('[data-tab]').forEach(b => b.classList.toggle('on', b === tab)); drawCards(); return; }

  const ot = e.target.closest('[data-ot]');
  if (ot) { location.hash = '#/orders?t=' + ot.dataset.ot; return; }

  const pk = e.target.closest('[data-pk]');
  if (pk) {
    selIdx = +pk.dataset.pk;
    $$('[data-pk]').forEach(b => b.classList.toggle('on', b === pk));
    updateSelectedPackageDetails();
    return;
  }

  const qb = e.target.closest('[data-q]');
  if (qb && curCat) {
    const k = curCat.packages[selIdx];
    const maxQ = typeof k.available === 'number' && k.available > 0 ? k.available : 50;
    curQty = Math.max(1, Math.min(maxQ, curQty + (+qb.dataset.q)));
    const qin = $('#f_qty'); if (qin) qin.value = curQty;
    drawPay();
    return;
  }

  if (e.target.closest('[data-act="confirm"]')) return confirmBuy();

  const od = e.target.closest('[data-order]');
  if (od) {
    const code = od.dataset.order;
    return showOrder(STATE.buys.find(o => (o.orderCode || o.id) === code));
  }

  const cp = e.target.closest('[data-copy]');
  if (cp) { navigator.clipboard?.writeText(cp.dataset.copy).then(() => toast(bi('Copied to clipboard','Clipboard သို့ ကူးယူပြီး')), () => toast(bi('Copy failed','ကူးယူမရပါ'))); }
});

addEventListener('hashchange', render);
applyLanguageChrome();
loadIdentity();
render();
setInterval(syncLiveSellerData, 10_000);
