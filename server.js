// Exabyte Digital Store — Live API & Store Backend (Node.js)
// Proxies Canboso Buyer API v2, calculates MMK prices at 1 USD = 5,500 Ks,
// and includes custom Outline VPN packages + manual Top-Up & Purchase workflows.

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 60010;
const API_BASE = 'https://canboso.com';
const BUYER_KEY = process.env.CANBOSO_API_KEY || '';
const RATE_MMK = Number(process.env.RATE_MMK || 5500); // $1 = 5,500 Ks (includes profit margin)
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || '';
const TG_BOT_USERNAME = process.env.TG_BOT_USERNAME || 'exabytewebot';
const TG_ADMIN_IDS = String(process.env.TG_ADMIN_IDS || '').split(',').map(x => x.trim()).filter(Boolean);
const TG_WEBHOOK_SECRET = process.env.TG_WEBHOOK_SECRET || '';
const API_ADMIN_TOKEN = process.env.API_ADMIN_TOKEN || '';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || '';
const APP_BASE_URL = String(process.env.APP_BASE_URL || '').replace(/\/$/, '');
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const SGSEP_PANEL_BASE_URL = process.env.SGSEP_PANEL_BASE_URL || '';
const SGSEP_PANEL_USER = process.env.SGSEP_PANEL_USER || '';
const SGSEP_PANEL_PASS = process.env.SGSEP_PANEL_PASS || '';
const SGSEP_SERVER_HOST = process.env.SGSEP_SERVER_HOST || 'sgsep.lhpvpn.online';
const SGSEP_INBOUND_ID = Number(process.env.SGSEP_INBOUND_ID || 11);
const SGSEP_INBOUND_PORT = Number(process.env.SGSEP_INBOUND_PORT || 24776);
const SGSEP_VERIFY_TLS = String(process.env.SGSEP_VERIFY_TLS || 'false').toLowerCase() === 'true';

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const CACHE_FILE = path.join(DATA_DIR, 'catalog-cache.json');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch {}
  return { balanceMmk: 0, orders: [], topups: [] };
}
function saveStore(st) {
  fs.writeFileSync(STORE_FILE, JSON.stringify(st, null, 2), 'utf8');
}
let store = loadStore();

// Custom Outline VPN packages (local product line delivered alongside Canboso catalog)
const OUTLINE_PACKAGES = [
  {
    productId: 'outline_vpn_test_5gb',
    name: 'Outline VPN Test Key (5 GB)',
    description: 'Free 5 GB test access for checking speed and compatibility before purchase. One test key per customer.',
    emoji: 'outline_vpn',
    productType: 'account',
    isCustomOutline: true,
    isTestOutline: true,
    outlineTotalGb: 5,
    outlineDays: 3,
    price: { amount: 0, currency: 'USD', text: 'Free' },
    availability: { available: null, sold: 0 },
    promotions: []
  },
  {
    productId: 'outline_vpn_1m',
    name: 'Outline VPN 1 Month (1 Device · 200 GB) - full warranty',
    description: '• Private Shadowsocks (ss://) access key for Outline Client.\n• High-speed Singapore / US / Japan routing.\n• Supports iOS, Android, Windows, macOS, and Linux.\n• 1 Device · 200 GB high-speed data · 30-day full warranty.',
    emoji: 'outline_vpn',
    productType: 'account',
    isCustomOutline: true,
    outlineTotalGb: 200,
    outlineDays: 30,
    price: { amount: 0.64, currency: 'USD', text: '$0.64' },
    availability: { available: 50, sold: 142 },
    promotions: []
  },
  {
    productId: 'outline_vpn_3m',
    name: '🔥Outline VPN 3 Months (3 Devices · 600 GB) - full warranty',
    description: '• Private Shadowsocks (ss://) access key for Outline Client.\n• High-speed Singapore / US / Japan routing.\n• Supports iOS, Android, Windows, macOS, and Linux.\n• Up to 3 Devices · 600 GB data · 90-day full warranty.',
    emoji: 'outline_vpn',
    productType: 'account',
    isCustomOutline: true,
    outlineTotalGb: 600,
    outlineDays: 90,
    price: { amount: 1.73, currency: 'USD', text: '$1.73' },
    availability: { available: 35, sold: 89 },
    promotions: []
  },
  {
    productId: 'outline_vpn_6m',
    name: 'Outline VPN 6 Months (3 Devices · 1.2 TB) - full warranty',
    description: '• Private Shadowsocks (ss://) access key for Outline Client.\n• Dedicated low-latency server pool.\n• Up to 3 Devices · 1.2 TB data · 180-day full warranty.',
    emoji: 'outline_vpn',
    productType: 'account',
    isCustomOutline: true,
    outlineTotalGb: 1200,
    outlineDays: 180,
    price: { amount: 3.27, currency: 'USD', text: '$3.27' },
    availability: { available: 25, sold: 41 },
    promotions: []
  },
  {
    productId: 'outline_vpn_12m',
    name: '🔥Outline VPN 1 Year VIP (5 Devices · Unlimited) - full warranty',
    description: '• 2 Private Shadowsocks (ss://) access keys for Outline Client.\n• Premium VIP multi-region server pool.\n• Up to 5 Devices · Fair-use unlimited bandwidth · 365-day full warranty.',
    emoji: 'outline_vpn',
    productType: 'account',
    isCustomOutline: true,
    outlineTotalGb: 0,
    outlineDays: 365,
    price: { amount: 5.82, currency: 'USD', text: '$5.82' },
    availability: { available: 20, sold: 64 },
    promotions: []
  }
];

// Category metadata mapping every Canboso emoji / product family to brand styling & group
const CATEGORY_META = {
  outline_vpn:          { title: 'Outline VPN', group: 'vpn', color: '#0f766e', slug: null, svg: 'outline', hot: true, isNew: true },
  chatgpt:              { title: 'ChatGPT', group: 'ai', color: '#10a37f', slug: null, svg: 'openai', hot: true },
  codex:                { title: 'API CodeX', group: 'ai', color: '#202123', slug: null, svg: 'openai', hot: true },
  claude:               { title: 'API Claude', group: 'ai', color: '#d97757', slug: 'anthropic', hot: true },
  deepseek:             { title: 'Deepseek', group: 'ai', color: '#4d6bfe', slug: null },
  grok:                 { title: 'Grok', group: 'ai', color: '#111827', slug: 'x' },
  antigravity:          { title: 'Google AI Ultra (VEO3)', group: 'ai', color: '#4285f4', slug: 'google', hot: true },
  perplexity:           { title: 'Perplexity', group: 'ai', color: '#20808d', slug: 'perplexity' },
  kiro:                 { title: 'Kiro AI', group: 'ai', color: '#7c3aed', slug: null },
  lovable:              { title: 'Lovable', group: 'ai', color: '#ec4899', slug: null },
  google_one:           { title: 'Google One & Gemini', group: 'work', color: '#1a73e8', slug: 'google', hot: true },
  google:               { title: 'Google Services', group: 'work', color: '#1a73e8', slug: 'google' },
  muse_ai:              { title: 'Muse AI', group: 'ai', color: '#2563eb', slug: null },
  jetbrains:            { title: 'JetBrains', group: 'work', color: '#000000', slug: 'jetbrains' },
  zed:                  { title: 'Zed Editor', group: 'work', color: '#084ccf', slug: 'zedindustries' },
  genspark:             { title: 'GenSpark', group: 'ai', color: '#4f46e5', slug: null },
  github:               { title: 'GitHub Copilot', group: 'work', color: '#24292f', slug: 'github' },
  canva:                { title: 'Canva', group: 'design', color: '#7d2ae8', slug: null, hot: true },
  capcut:               { title: 'CapCut', group: 'design', color: '#111111', slug: null, hot: true },
  adobe:                { title: 'Adobe Creative Cloud', group: 'design', color: '#e1251b', slug: null, hot: true },
  figma:                { title: 'Figma', group: 'design', color: '#f24e1e', slug: 'figma' },
  autodesk:             { title: 'AutoDesk', group: 'design', color: '#0696d7', slug: 'autodesk' },
  alight_motion:        { title: 'Alight Motion', group: 'design', color: '#0f3b3a', slug: null },
  heygen:               { title: 'HeyGen', group: 'ai', color: '#6366f1', slug: null },
  higgfield:            { title: 'Higgsfield', group: 'ai', color: '#a3e635', slug: null, darkText: true },
  kling:                { title: 'Kling AI', group: 'ai', color: '#0284c7', slug: null },
  meitu:                { title: 'Meitu', group: 'design', color: '#ff3355', slug: null },
  wink:                 { title: 'Wink', group: 'design', color: '#ff477e', slug: null },
  xingtu:               { title: 'Xingtu', group: 'design', color: '#65a30d', slug: null },
  beautycam:            { title: 'BeautyCam', group: 'design', color: '#ec4899', slug: null },
  gmail:                { title: 'Gmail', group: 'work', color: '#ea4335', slug: 'gmail' },
  microsoft_office_365: { title: 'Microsoft Office 365', group: 'work', color: '#d83b01', slug: null },
  windows:              { title: 'Windows & Office Keys', group: 'work', color: '#0078d4', slug: null },
  grammarly:            { title: 'Grammarly', group: 'work', color: '#15c39a', slug: 'grammarly' },
  ilovepdf:             { title: 'iLovePDF', group: 'work', color: '#e5322d', slug: 'ilovepdf' },
  proton:               { title: 'Proton VPN', group: 'vpn', color: '#6d4aff', slug: 'proton' },
  zoom:                 { title: 'Zoom Pro', group: 'work', color: '#0b5cff', slug: 'zoom' },
  apple:                { title: 'Apple Music', group: 'stream', color: '#1d1d1f', slug: 'apple' },
  youtube:              { title: 'YouTube Premium', group: 'stream', color: '#ff0000', slug: 'youtube', hot: true },
  netflix:              { title: 'Netflix', group: 'stream', color: '#e50914', slug: 'netflix', hot: true },
  spotify:              { title: 'Spotify', group: 'stream', color: '#1db954', slug: 'spotify', hot: true },
  vieon:                { title: 'VieON VIP', group: 'stream', color: '#0bd03f', slug: null },
  galaxy_play:          { title: 'Galaxy Play', group: 'stream', color: '#1428a0', slug: null },
  fpt_play:             { title: 'FPT Play', group: 'stream', color: '#f26522', slug: null },
  amazon_prime:         { title: 'Amazon Prime Video', group: 'stream', color: '#1a98ff', slug: 'primevideo' },
  locket:               { title: 'Locket Gold', group: 'work', color: '#f5b400', slug: null, darkText: true },
  duolingo:             { title: 'Duolingo Super', group: 'learn', color: '#58cc02', slug: 'duolingo' },
  quizlet:              { title: 'Quizlet Plus', group: 'learn', color: '#4255ff', slug: 'quizlet' },
  scribd:               { title: 'Scribd', group: 'learn', color: '#1e7b85', slug: 'scribd' },
  nordvpn:              { title: 'NordVPN', group: 'vpn', color: '#4687ff', slug: 'nordvpn', hot: true },
  hma_vpn:              { title: 'HMA VPN', group: 'vpn', color: '#ffd400', slug: null, darkText: true },
  express:              { title: 'ExpressVPN', group: 'vpn', color: '#da3940', slug: 'expressvpn', hot: true },
  surfshark:            { title: 'Surfshark VPN', group: 'vpn', color: '#178a9e', slug: 'surfshark' },
  hotspot_shield:       { title: 'Hotspot Shield', group: 'vpn', color: '#1f8ef1', slug: null },
  crunchyroll:          { title: 'Crunchyroll', group: 'stream', color: '#f47521', slug: 'crunchyroll' }
};

function resolveCategoryKey(p) {
  const n = (p.name || '').toLowerCase();
  const e = (p.emoji || '').toLowerCase();
  if (e === 'chatgpt' && n.includes('codex') && !n.includes('chatgpt')) return 'codex';
  if (e && e !== 'none' && CATEGORY_META[e]) return e;
  if (n.includes('claude')) return 'claude';
  if (n.includes('codex')) return 'codex';
  if (n.includes('chatgpt')) return 'chatgpt';
  if (n.includes('deepseek')) return 'deepseek';
  if (n.includes('muse ai')) return 'muse_ai';
  if (n.includes('duolingo')) return 'duolingo';
  if (n.includes('spotify')) return 'spotify';
  if (n.includes('xingtu')) return 'xingtu';
  if (n.includes('fpt play')) return 'fpt_play';
  if (n.includes('galaxy play')) return 'galaxy_play';
  if (n.includes('vieon')) return 'vieon';
  if (n.includes('hotspot shield')) return 'hotspot_shield';
  if (n.includes('ilovepdf')) return 'ilovepdf';
  if (n.includes('canva')) return 'canva';
  if (n.includes('capcut')) return 'capcut';
  if (n.includes('youtube')) return 'youtube';
  if (n.includes('netflix')) return 'netflix';
  if (n.includes('gemini') || n.includes('google')) return 'google_one';
  return e || 'other';
}

// Convert USD to MMK at 1$ = 5,500 Ks, rounded up to nearest 50 Ks
function usdToMmk(usd) {
  const raw = Number(usd || 0) * RATE_MMK;
  if (raw <= 0) return 0;
  return Math.ceil(raw / 50) * 50;
}

function classifyDelivery(p) {
  const pt = p.productType || 'account';
  const req = p.purchaseRequirements || {};
  const avail = p.availability ? p.availability.available : null;
  // In Canboso API:
  // - 'account' products with available > 0 auto-complete and return credentials immediately.
  // - 'slot' products require customer_email and return fulfillmentStatus='waiting_seller' (or 'invited' for slot_chatgpt_business).
  // - 'upgrade_account' products require customer_accounts and wait for seller fulfillment.
  const isInstant = pt === 'account';
  const inStock = isInstant ? (avail === null || avail > 0) : (avail === null || avail > 0);
  let deliveryMode = 'instant';
  let deliveryLabel = 'Instant Delivery';
  let deliveryHint = 'Auto-delivered immediately from stock after payment.';
  if (pt === 'slot') {
    deliveryMode = 'slot';
    deliveryLabel = 'Slot Invite (Manual)';
    deliveryHint = 'Requires your Email. Admin sends an invitation to your email after purchase.';
  } else if (pt === 'upgrade_account') {
    deliveryMode = 'upgrade';
    deliveryLabel = 'Account Upgrade (Manual)';
    deliveryHint = 'Requires your account details (Email/Username/Account info). Seller upgrades your account and confirms completion.';
  }
  return {
    isInstant,
    inStock,
    available: avail,
    sold: p.availability ? (p.availability.sold || 0) : 0,
    deliveryMode,
    deliveryLabel,
    deliveryHint,
    requiresEmail: !!(req.customerEmail || pt === 'slot'),
    requiresAccounts: !!(req.customerAccounts || pt === 'upgrade_account'),
    requiresSlotMonths: !!(req.slotMonths || p.productId === 'slot_chatgpt_business'),
    allowedMonths: req.allowedMonths || (p.productId === 'slot_chatgpt_business' ? [1, 3, 6, 12] : null),
    quantityFixed: req.quantityFixed || (pt === 'slot' ? 1 : null)
  };
}

function translatePackageMm(p, delivery) {
  const rawName = String(p.name || 'Digital package');
  const rawDescription = String(p.description || '').trim();
  const duration = rawName.match(/(\d+)\s*(day|days|month|months|year|years|week|weeks)/i);
  const durationMm = duration
    ? `${duration[1]} ${/day/i.test(duration[2]) ? 'ရက်' : /week/i.test(duration[2]) ? 'ပတ်' : /year/i.test(duration[2]) ? 'နှစ်' : 'လ'}`
    : '';
  const typeMm = p.productType === 'slot'
    ? 'အီးမေးလ်မှတစ်ဆင့် Slot ဖိတ်ကြားပေးမည့် ပက်ကေ့ချ်'
    : p.productType === 'upgrade_account'
      ? 'သင့်အကောင့်ကို အဆင့်မြှင့်ပေးမည့် ပက်ကေ့ချ်'
      : 'ဝယ်ယူပြီးနောက် အကောင့်အချက်အလက်ကို အလိုအလျောက်ရရှိမည့် ပက်ကေ့ချ်';
  const deliveryMm = delivery.isInstant
    ? 'ငွေပေးချေမှုအောင်မြင်ပြီးသည်နှင့် ချက်ချင်းပို့ပေးပါမည်။'
    : p.productType === 'slot'
      ? 'ဝယ်ယူရန် သင့်အီးမေးလ်လိုအပ်ပြီး ဖိတ်စာကို အီးမေးလ်သို့ ပို့ပေးပါမည်။'
      : 'သင့်အကောင့်အချက်အလက်ပေးရန်လိုအပ်ပြီး အက်ဒမင်က အဆင့်မြှင့်ပြီးပါက အတည်ပြုပေးပါမည်။';
  const warrantyMm = /warranty/i.test(rawDescription + ' ' + rawName)
    ? 'ဖော်ပြထားသော ကာလအတွင်း အာမခံဝန်ဆောင်မှု ပါဝင်ပါသည်။'
    : 'ဝယ်ယူမီ ပက်ကေ့ချ်စည်းမျဉ်းများကို စစ်ဆေးပါ။';
  const featureBits = [];
  if (/unlimited/i.test(rawDescription + ' ' + rawName)) featureBits.push('Fair-use မူဝါဒအရ အကန့်အသတ်မဲ့ အသုံးပြုနိုင်သည်');
  const gb = (rawDescription + ' ' + rawName).match(/([\d.]+)\s*(GB|TB)/i);
  if (gb) featureBits.push(`ဒေတာပမာဏ ${gb[1]} ${gb[2].toUpperCase()} ပါဝင်သည်`);
  const devices = (rawDescription + ' ' + rawName).match(/(?:up to\s*)?(\d+)\s*devices?/i);
  if (devices) featureBits.push(`စက် ${devices[1]} လုံးအထိ အသုံးပြုနိုင်သည်`);
  const summary = [
    durationMm ? `အသုံးပြုနိုင်သည့်ကာလ ${durationMm} ဖြစ်သည်။` : '',
    typeMm + ' ဖြစ်သည်။',
    ...featureBits.map(x => `${x}။`),
    deliveryMm,
    warrantyMm
  ].filter(Boolean).join('\n');
  return {
    nameMm: durationMm ? `${rawName.replace(duration[0], '').replace(/[-–—()]+/g, ' ').replace(/\s+/g, ' ').trim()} — ${durationMm}` : rawName,
    descriptionMm: summary,
    deliveryLabelMm: delivery.isInstant ? 'ချက်ချင်းပို့ပေးမည်' : p.productType === 'slot' ? 'Slot ဖိတ်ကြားမှု' : 'အကောင့်အဆင့်မြှင့်မှု',
    deliveryHintMm: deliveryMm
  };
}

function canbosoRequest(method, apiPath, bodyObj, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    if (!BUYER_KEY) {
      reject(new Error('CANBOSO_API_KEY is not configured'));
      return;
    }
    const u = new URL(apiPath, API_BASE);
    if (!u.searchParams.has('key')) u.searchParams.set('key', BUYER_KEY);
    const payload = bodyObj ? JSON.stringify(bodyObj) : null;
    const headers = {
      'Accept': 'application/json',
      'x-buyer-key': BUYER_KEY,
      'X-API-Key': BUYER_KEY,
      ...extraHeaders
    };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = https.request(u, { method, headers, timeout: 15000 }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          reject(new Error(`Invalid JSON from upstream (HTTP ${res.statusCode})`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Upstream API timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

let sgsepCookie = '';
const testKeyIssuance = new Map();

function sgsepRequest(method, apiPath, form) {
  return new Promise((resolve, reject) => {
    if (!SGSEP_PANEL_BASE_URL || !SGSEP_PANEL_USER || !SGSEP_PANEL_PASS) return reject(new Error('Outline VPN server is not configured'));
    const u = new URL(apiPath.replace(/^\//, ''), SGSEP_PANEL_BASE_URL.endsWith('/') ? SGSEP_PANEL_BASE_URL : SGSEP_PANEL_BASE_URL + '/');
    const payload = form ? new URLSearchParams(form).toString() : '';
    const headers = { Accept: 'application/json' };
    if (sgsepCookie) headers.Cookie = sgsepCookie;
    if (payload) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const request = https.request(u, { method, headers, timeout: 15000, rejectUnauthorized: SGSEP_VERIFY_TLS }, response => {
      const setCookie = response.headers['set-cookie'];
      if (setCookie?.length) sgsepCookie = setCookie.map(x => x.split(';')[0]).join('; ');
      let raw = '';
      response.on('data', chunk => raw += chunk);
      response.on('end', () => {
        let data = null;
        try { data = raw ? JSON.parse(raw) : {}; } catch {}
        resolve({ status: response.statusCode, headers: response.headers, data });
      });
    });
    request.on('error', reject);
    request.on('timeout', () => { request.destroy(); reject(new Error('Outline VPN server timeout')); });
    if (payload) request.write(payload);
    request.end();
  });
}

async function sgsepLogin() {
  sgsepCookie = '';
  const result = await sgsepRequest('POST', '/login', { username: SGSEP_PANEL_USER, password: SGSEP_PANEL_PASS });
  if (result.status !== 200 || result.data?.success === false || !sgsepCookie) throw new Error('Outline VPN server authentication failed');
}

async function sgsepApi(method, apiPath, form) {
  if (!sgsepCookie) await sgsepLogin();
  let result = await sgsepRequest(method, apiPath, form);
  if ([301, 302, 303, 307, 308, 401, 403, 404].includes(result.status)) {
    await sgsepLogin();
    result = await sgsepRequest(method, apiPath, form);
  }
  if (result.status < 200 || result.status >= 300 || result.data?.success === false) throw new Error(result.data?.msg || 'Outline VPN server request failed');
  return result.data;
}

async function provisionOutlineClient(pkg, orderCode) {
  const inboundResult = await sgsepApi('GET', `/panel/api/inbounds/get/${SGSEP_INBOUND_ID}`);
  const inbound = inboundResult.obj || inboundResult.data || inboundResult;
  if (Number(inbound.id) !== SGSEP_INBOUND_ID || Number(inbound.port) !== SGSEP_INBOUND_PORT) throw new Error('Outline VPN inbound configuration mismatch');
  const settings = typeof inbound.settings === 'string' ? JSON.parse(inbound.settings) : inbound.settings;
  const method = String(settings?.method || 'chacha20-ietf-poly1305');
  const is2022 = method.startsWith('2022-');
  const passwordBytes = method.includes('256') ? 32 : 16;
  const password = is2022 ? crypto.randomBytes(passwordBytes).toString('base64') : crypto.randomBytes(12).toString('base64url');
  const email = `web-${String(orderCode).replace(/[^a-zA-Z0-9]/g, '').slice(-14)}-${crypto.randomBytes(3).toString('hex')}`;
  const expiryTime = pkg.outlineDays ? Date.now() + pkg.outlineDays * 86400000 : 0;
  const client = {
    email,
    password,
    method: is2022 ? '' : method,
    totalGB: pkg.outlineTotalGb ? pkg.outlineTotalGb * 1073741824 : 0,
    expiryTime,
    limitIp: pkg.isTestOutline ? 1 : 1,
    enable: true,
    tgId: 0,
    subId: crypto.randomBytes(8).toString('hex'),
    comment: `web:${pkg.productId}`,
    reset: 0
  };
  await sgsepApi('POST', '/panel/api/inbounds/addClient', { id: String(SGSEP_INBOUND_ID), settings: JSON.stringify({ clients: [client] }) });
  const userInfo = is2022 ? `${method}:${settings.password}:${password}` : `${method}:${password}`;
  const key = `ss://${Buffer.from(userInfo).toString('base64url')}@${SGSEP_SERVER_HOST}:${SGSEP_INBOUND_PORT}#${encodeURIComponent(`Exabyte-${email}`)}`;
  return { key, email, expiryTime, totalGb: pkg.outlineTotalGb };
}

let memoryCatalog = null;
let lastFetchMs = 0;
const CACHE_TTL_MS = 60 * 1000; // 60s cache to respect Canboso rate limits (30 req/60s)

// Seed the in-memory catalog from the checked-in cache so startup is instant.
try {
  if (fs.existsSync(CACHE_FILE)) {
    memoryCatalog = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8').replace(/^\uFEFF/, ''));
  }
} catch {}

async function getRawCatalog(force = false) {
  const now = Date.now();
  if (!force && memoryCatalog && (now - lastFetchMs < CACHE_TTL_MS)) {
    return { catalog: memoryCatalog, source: 'cache', fetchedAt: new Date(lastFetchMs).toISOString() };
  }
  try {
    const res = await canbosoRequest('GET', '/api/v2/telegram-buyer/products');
    if (res.status === 200 && res.data && res.data.success && Array.isArray(res.data.products)) {
      memoryCatalog = res.data;
      lastFetchMs = now;
      fs.writeFileSync(CACHE_FILE, JSON.stringify(res.data, null, 2), 'utf8');
      return { catalog: memoryCatalog, source: 'live', fetchedAt: new Date(lastFetchMs).toISOString() };
    }
  } catch (err) {
    console.warn('Canboso live fetch warning, falling back to cached catalog:', err.message);
  }
  if (memoryCatalog) {
    return { catalog: memoryCatalog, source: 'cached_fallback', fetchedAt: lastFetchMs ? new Date(lastFetchMs).toISOString() : null };
  }
  throw new Error('Catalog unavailable');
}

function buildStructuredCatalog(rawProducts, metaInfo) {
  const allRaw = [...OUTLINE_PACKAGES, ...rawProducts.filter(p => p.emoji !== 'tele' && (p.price?.amount || 0) > 0)];
  const catMap = new Map();

  // Ensure Outline VPN is first
  for (const p of allRaw) {
    const key = resolveCategoryKey(p);
    const meta = CATEGORY_META[key] || {
      title: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      group: 'work',
      color: '#2563eb',
      slug: null
    };
    if (!catMap.has(key)) {
      catMap.set(key, {
        id: key.replace(/_/g, '-'),
        key,
        name: meta.title,
        group: meta.group,
        color: meta.color,
        slug: meta.slug || null,
        svg: meta.svg || null,
        darkText: !!meta.darkText,
        hot: !!meta.hot,
        isNew: !!meta.isNew,
        packages: []
      });
    }
    const deliv = classifyDelivery(p);
    const usd = Number(p.price?.amount || 0);
    const mmk = usdToMmk(usd);
    const image = p.image ? (p.image.startsWith('http') ? p.image : API_BASE + p.image) : null;
    const mm = translatePackageMm(p, deliv);

    catMap.get(key).packages.push({
      productId: p.productId,
      name: p.name,
      description: p.description || '',
      productType: p.productType || 'account',
      isCustomOutline: !!p.isCustomOutline,
      isTestOutline: !!p.isTestOutline,
      outlineTotalGb: Number(p.outlineTotalGb || 0),
      outlineDays: Number(p.outlineDays || 0),
      usd,
      usdText: p.price?.text || `$${usd.toFixed(2)}`,
      mmk,
      mmkText: `${mmk.toLocaleString('en-US')} Ks`,
      image,
      promotions: p.promotions || [],
      ...mm,
      ...deliv
    });
  }

  const categories = [];
  for (const cat of catMap.values()) {
    // Sort packages: in-stock first, then by MMK price ascending
    cat.packages.sort((a, b) => (Number(b.inStock) - Number(a.inStock)) || (a.mmk - b.mmk));
    const inStockPkgs = cat.packages.filter(x => x.inStock);
    const refList = inStockPkgs.length ? inStockPkgs : cat.packages;
    cat.minMmk = Math.min(...refList.map(x => x.mmk));
    cat.minUsd = Math.min(...refList.map(x => x.usd));
    cat.totalStock = cat.packages.reduce((s, x) => s + (typeof x.available === 'number' ? x.available : 0), 0);
    cat.totalSold = cat.packages.reduce((s, x) => s + (x.sold || 0), 0);
    cat.hasInstant = cat.packages.some(x => x.isInstant && x.inStock);
    cat.hasManual = cat.packages.some(x => !x.isInstant);
    cat.anyInStock = cat.packages.some(x => x.inStock);
    const coverPkg = cat.packages.find(x => x.image);
    cat.coverImage = coverPkg ? coverPkg.image : null;
    categories.push(cat);
  }

  return {
    success: true,
    rateMmk: RATE_MMK,
    source: metaInfo.source,
    fetchedAt: metaInfo.fetchedAt,
    totalCategories: categories.length,
    totalProducts: allRaw.length,
    categories
  };
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendHtml(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
}

function readBody(req, maxBytes = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let chunks = [], len = 0;
    req.on('data', c => {
      len += c.length;
      if (len > maxBytes) { req.destroy(); reject(new Error('Payload too large')); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const str = Buffer.concat(chunks).toString('utf8');
        resolve(str ? JSON.parse(str) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

const sessions = new Map();
const oauthStates = new Map();

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function isAdminRequest(req) {
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return !!API_ADMIN_TOKEN && safeEqual(bearer, API_ADMIN_TOKEN);
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(x => x.trim()).filter(Boolean).map(x => {
    const i = x.indexOf('=');
    return [x.slice(0, i), decodeURIComponent(x.slice(i + 1))];
  }));
}

function currentUser(req) {
  const sid = parseCookies(req).exa_session;
  const session = sid ? sessions.get(sid) : null;
  if (!session || session.expiresAt < Date.now()) return null;
  return session.user;
}

function createSession(res, user) {
  const sid = crypto.randomBytes(32).toString('base64url');
  sessions.set(sid, { user, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
  res.setHeader('Set-Cookie', `exa_session=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${APP_BASE_URL.startsWith('https://') ? '; Secure' : ''}`);
}

async function telegramApi(method, payload) {
  if (!TG_BOT_TOKEN) throw new Error('Telegram payment review is not configured');
  const response = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/${method}`, {
    method: 'POST',
    body: payload instanceof FormData ? payload : JSON.stringify(payload),
    headers: payload instanceof FormData ? undefined : { 'Content-Type': 'application/json' }
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.description || `Telegram ${method} failed`);
  return data.result;
}

async function notifyTopupAdmins(topup) {
  if (!TG_BOT_TOKEN || !TG_ADMIN_IDS.length) return { configured: false, delivered: 0 };
  const match = String(topup.screenshot || '').match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!match) throw new Error('Unsupported payment screenshot format');
  const bytes = Buffer.from(match[2], 'base64');
  const caption = [
    '<b>New website top-up</b>',
    `Request: <code>${topup.id}</code>`,
    `Amount: <b>${Number(topup.amountMmk).toLocaleString('en-US')} MMK</b>`,
    `Method: <b>${String(topup.method).replace(/[<>&]/g, '')}</b>`,
    'Status: <b>Awaiting review</b>'
  ].join('\n');
  let delivered = 0;
  for (const chatId of TG_ADMIN_IDS) {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('photo', new Blob([bytes], { type: match[1] }), `payment-${topup.id}.jpg`);
    form.append('caption', caption);
    form.append('parse_mode', 'HTML');
    form.append('reply_markup', JSON.stringify({ inline_keyboard: [[
      { text: 'Approve (Paid)', callback_data: `topup:approve:${topup.id}` },
      { text: 'Reject', callback_data: `topup:reject:${topup.id}` }
    ]] }));
    await telegramApi('sendPhoto', form);
    delivered++;
  }
  return { configured: true, delivered };
}

async function handleTelegramWebhook(req, res) {
  if (!TG_WEBHOOK_SECRET || !safeEqual(req.headers['x-telegram-bot-api-secret-token'], TG_WEBHOOK_SECRET)) {
    return sendJson(res, 401, { success: false });
  }
  const update = await readBody(req, 1024 * 1024);
  const cq = update.callback_query;
  if (!cq) return sendJson(res, 200, { success: true });
  const adminId = String(cq.from?.id || '');
  if (!TG_ADMIN_IDS.includes(adminId)) {
    await telegramApi('answerCallbackQuery', { callback_query_id: cq.id, text: 'Unauthorized', show_alert: true });
    return sendJson(res, 200, { success: true });
  }
  const [kind, action, id] = String(cq.data || '').split(':');
  if (kind !== 'topup' || !['approve', 'reject'].includes(action)) {
    await telegramApi('answerCallbackQuery', { callback_query_id: cq.id, text: 'Unknown action' });
    return sendJson(res, 200, { success: true });
  }
  const item = store.topups.find(x => x.id === id);
  if (!item) {
    await telegramApi('answerCallbackQuery', { callback_query_id: cq.id, text: 'Request not found', show_alert: true });
    return sendJson(res, 200, { success: true });
  }
  if (item.status === 'pending') {
    item.status = action === 'approve' ? 'approved' : 'rejected';
    item.reviewedAt = new Date().toISOString();
    item.reviewedBy = adminId;
    if (action === 'approve') store.balanceMmk += item.amountMmk;
    saveStore(store);
  }
  await telegramApi('answerCallbackQuery', { callback_query_id: cq.id, text: item.status === 'approved' ? 'Top-up approved' : 'Top-up rejected' });
  if (cq.message?.chat?.id && cq.message?.message_id) {
    await telegramApi('editMessageCaption', {
      chat_id: cq.message.chat.id,
      message_id: cq.message.message_id,
      caption: `Website top-up ${item.id}\n${Number(item.amountMmk).toLocaleString('en-US')} MMK\nStatus: ${item.status.toUpperCase()}`
    });
  }
  return sendJson(res, 200, { success: true });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf'
};

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = u.pathname;

  // --- AUTH ROUTES ---
  if (pathname === '/api/auth/config' && req.method === 'GET') {
    return sendJson(res, 200, {
      success: true,
      google: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI && SESSION_SECRET),
      telegram: !!(TG_BOT_TOKEN && TG_BOT_USERNAME && APP_BASE_URL && SESSION_SECRET),
      telegramBot: TG_BOT_USERNAME
    });
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    return sendJson(res, 200, { success: true, user: currentUser(req) });
  }

  if (pathname === '/auth/logout' && req.method === 'GET') {
    const sid = parseCookies(req).exa_session;
    if (sid) sessions.delete(sid);
    res.writeHead(302, { Location: '/#/', 'Set-Cookie': 'exa_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' });
    return res.end();
  }

  if (pathname === '/auth/google' && req.method === 'GET') {
    if (!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI && SESSION_SECRET)) return sendHtml(res, 503, '<h1>Google sign-in is not configured</h1><p>Add the documented Google OAuth environment variables.</p>');
    const state = crypto.randomBytes(24).toString('base64url');
    oauthStates.set(state, Date.now() + 10 * 60 * 1000);
    const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    auth.search = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, redirect_uri: GOOGLE_REDIRECT_URI, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' }).toString();
    res.writeHead(302, { Location: auth.toString() });
    return res.end();
  }

  if (pathname === '/auth/google/callback' && req.method === 'GET') {
    const state = u.searchParams.get('state') || '';
    const code = u.searchParams.get('code') || '';
    const expiry = oauthStates.get(state);
    oauthStates.delete(state);
    if (!expiry || expiry < Date.now() || !code) return sendHtml(res, 400, '<h1>Google sign-in expired</h1><p>Please return to the store and try again.</p>');
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, redirect_uri: GOOGLE_REDIRECT_URI, grant_type: 'authorization_code' })
      });
      const token = await tokenRes.json();
      if (!token.access_token) throw new Error('Token exchange failed');
      const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } });
      const profile = await profileRes.json();
      if (!profile.sub) throw new Error('Profile lookup failed');
      createSession(res, { id: `google:${profile.sub}`, provider: 'google', name: profile.name || profile.email, email: profile.email || null, picture: profile.picture || null });
      res.writeHead(302, { Location: '/#/' });
      return res.end();
    } catch {
      return sendHtml(res, 502, '<h1>Google sign-in failed</h1><p>Please try again later.</p>');
    }
  }

  if (pathname === '/auth/telegram' && req.method === 'GET') {
    if (!(TG_BOT_TOKEN && TG_BOT_USERNAME && APP_BASE_URL && SESSION_SECRET)) return sendHtml(res, 503, '<h1>Telegram sign-in is not configured</h1><p>Add the documented Telegram environment variables.</p>');
    const callback = `${APP_BASE_URL}/auth/telegram/callback`;
    return sendHtml(res, 200, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Telegram Sign In</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070b16;color:#fff;font:16px system-ui}.box{text-align:center;padding:32px}p{color:#aab4c8}</style></head><body><div class="box"><h1>Sign in to Exabyte</h1><p>Continue securely with Telegram.</p><script async src="https://telegram.org/js/telegram-widget.js?22" data-telegram-login="${TG_BOT_USERNAME.replace(/[^a-zA-Z0-9_]/g, '')}" data-size="large" data-auth-url="${callback.replace(/"/g, '&quot;')}" data-request-access="write"></script></div></body></html>`);
  }

  if (pathname === '/auth/telegram/callback' && req.method === 'GET') {
    const suppliedHash = u.searchParams.get('hash') || '';
    const fields = [...u.searchParams.entries()].filter(([k]) => k !== 'hash').sort(([a], [b]) => a.localeCompare(b));
    const check = fields.map(([k, v]) => `${k}=${v}`).join('\n');
    const secret = crypto.createHash('sha256').update(TG_BOT_TOKEN).digest();
    const expected = crypto.createHmac('sha256', secret).update(check).digest('hex');
    const authDate = Number(u.searchParams.get('auth_date') || 0) * 1000;
    if (!safeEqual(expected, suppliedHash) || !authDate || Date.now() - authDate > 10 * 60 * 1000) return sendHtml(res, 401, '<h1>Telegram sign-in could not be verified</h1>');
    const id = u.searchParams.get('id');
    createSession(res, {
      id: `telegram:${id}`,
      provider: 'telegram',
      name: [u.searchParams.get('first_name'), u.searchParams.get('last_name')].filter(Boolean).join(' ') || u.searchParams.get('username') || 'Telegram user',
      username: u.searchParams.get('username') || null,
      picture: u.searchParams.get('photo_url') || null
    });
    res.writeHead(302, { Location: '/#/' });
    return res.end();
  }

  // --- API ROUTES ---
  if (pathname === '/api/tg/webhook' && req.method === 'POST') {
    try { return await handleTelegramWebhook(req, res); }
    catch { return sendJson(res, 500, { success: false }); }
  }
  if (pathname === '/api/catalog' && req.method === 'GET') {
    try {
      const force = u.searchParams.get('refresh') === '1';
      const raw = await getRawCatalog(force);
      const data = buildStructuredCatalog(raw.catalog.products || [], raw);
      return sendJson(res, 200, data);
    } catch (e) {
      return sendJson(res, 503, { success: false, message: e.message });
    }
  }

  if (pathname === '/api/state' && req.method === 'GET') {
    let supplierWallet = null;
    if (u.searchParams.get('supplier') === '1') {
      try {
        const b = await canbosoRequest('GET', '/api/v2/telegram-buyer/balance');
        if (b.status === 200 && b.data?.success) supplierWallet = b.data;
      } catch {}
    }
    return sendJson(res, 200, {
      success: true,
      rateMmk: RATE_MMK,
      balanceMmk: store.balanceMmk,
      user: currentUser(req),
      orders: store.orders.map(({ accounts, customerAccounts, customerEmail, ...order }) => order),
      topups: store.topups.map(({ screenshot, screenshotHash, ...topup }) => topup),
      supplierWallet
    });
  }

  if (pathname === '/api/topup' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const amountMmk = Math.round(Number(body.amountMmk || 0));
      const method = String(body.method || 'KBZPay').slice(0, 40);
      const txRef = String(body.txRef || '').trim().slice(0, 80);
      const screenshot = String(body.screenshot || '');
      if (amountMmk < 1000) return sendJson(res, 400, { success: false, message: 'Minimum top up is 1,000 Ks' });
      if (!screenshot.startsWith('data:image/')) return sendJson(res, 400, { success: false, message: 'Payment screenshot is required' });
      const screenshotHash = crypto.createHash('sha256').update(screenshot).digest('hex');
      if (store.topups.some(x => x.screenshotHash === screenshotHash)) return sendJson(res, 409, { success: false, message: 'This payment screenshot has already been submitted.' });

      const item = {
        id: 'TP' + Date.now().toString(36).toUpperCase(),
        amountMmk,
        method,
        txRef,
        screenshot,
        screenshotHash,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      store.topups.unshift(item);
      saveStore(store);
      try {
        const notification = await notifyTopupAdmins(item);
        item.notificationStatus = notification.configured ? 'sent' : 'not_configured';
        item.notificationDelivered = notification.delivered;
      } catch {
        item.notificationStatus = 'failed';
      }
      saveStore(store);
      return sendJson(res, 200, { success: true, topup: item, balanceMmk: store.balanceMmk, reviewChannel: item.notificationStatus });
    } catch (e) {
      return sendJson(res, 400, { success: false, message: e.message });
    }
  }

  if (pathname === '/api/topup/approve' && req.method === 'POST') {
    if (!isAdminRequest(req)) return sendJson(res, 401, { success: false, message: 'Admin authorization required' });
    try {
      const body = await readBody(req);
      const t = store.topups.find(x => x.id === body.id);
      if (!t) return sendJson(res, 404, { success: false, message: 'Top up request not found' });
      if (t.status !== 'approved') {
        t.status = 'approved';
        t.approvedAt = new Date().toISOString();
        store.balanceMmk += t.amountMmk;
        saveStore(store);
      }
      return sendJson(res, 200, { success: true, topup: t, balanceMmk: store.balanceMmk });
    } catch (e) {
      return sendJson(res, 400, { success: false, message: e.message });
    }
  }

  if (pathname === '/api/purchase' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const productId = String(body.productId || '').trim();
      const quantity = Math.max(1, Math.min(20, parseInt(body.quantity || 1, 10)));
      const customerEmail = String(body.customerEmail || '').trim();
      const customerAccounts = Array.isArray(body.customerAccounts)
        ? body.customerAccounts.map(s => String(s).trim()).filter(Boolean)
        : [];
      const slotMonths = body.slotMonths ? parseInt(body.slotMonths, 10) : undefined;

      const raw = await getRawCatalog(false);
      const structured = buildStructuredCatalog(raw.catalog.products || [], raw);
      let pkg = null, cat = null;
      for (const c of structured.categories) {
        const found = c.packages.find(p => p.productId === productId);
        if (found) { pkg = found; cat = c; break; }
      }
      if (!pkg) return sendJson(res, 404, { success: false, message: 'Product package not found in catalog.' });
      if (pkg.isTestOutline && quantity !== 1) return sendJson(res, 400, { success: false, message: 'The free Outline test is limited to one 5 GB key.' });

      // Validate requirements
      if (!pkg.inStock) return sendJson(res, 409, { success: false, message: 'This package is currently out of stock.' });
      if (pkg.requiresEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
        return sendJson(res, 400, { success: false, message: 'A valid Customer Email is required for this slot/invite product.' });
      }
      if (pkg.requiresAccounts && customerAccounts.length < quantity) {
        return sendJson(res, 400, { success: false, message: `Please provide ${quantity} account identifier(s) for account upgrade.` });
      }

      const totalMmk = pkg.mmk * quantity;
      const totalUsd = +(pkg.usd * quantity).toFixed(2);
      if (store.balanceMmk < totalMmk) {
        return sendJson(res, 400, {
          success: false,
          code: 'INSUFFICIENT_LOCAL_BALANCE',
          message: `Insufficient wallet balance. Need ${totalMmk.toLocaleString('en-US')} Ks, you have ${store.balanceMmk.toLocaleString('en-US')} Ks.`
        });
      }

      // Case 1: Outline VPN package -> provision on the isolated sgsep inbound.
      if (pkg.isCustomOutline) {
        const identity = currentUser(req)?.id || req.socket.remoteAddress || 'anonymous';
        if (pkg.isTestOutline) {
          const lastIssued = testKeyIssuance.get(identity) || 0;
          if (Date.now() - lastIssued < 24 * 60 * 60 * 1000) return sendJson(res, 429, { success: false, message: 'One free 5 GB test key is available per customer every 24 hours.' });
        }
        const orderCode = (pkg.isTestOutline ? 'TEST-' : 'EX-') + Date.now().toString(36).toUpperCase();
        const provisioned = [];
        for (let i = 0; i < quantity; i++) {
          provisioned.push(await provisionOutlineClient(pkg, orderCode));
        }
        if (pkg.isTestOutline) testKeyIssuance.set(identity, Date.now());
        store.balanceMmk -= totalMmk;
        const order = {
          orderCode,
          productId: pkg.productId,
          categoryId: cat.id,
          categoryName: cat.name,
          productName: pkg.name,
          productType: 'account',
          deliveryMode: 'instant',
          status: 'completed',
          fulfillmentStatus: 'completed',
          quantity,
          totalMmk,
          totalUsd,
          customerEmail: customerEmail || null,
          accounts: provisioned.map(x => ({ user: x.key, password: '', otherInfo: `${x.totalGb || 'Unlimited'} GB Outline Client access key` })),
          outlineClients: provisioned.map(({ key, ...client }) => client),
          createdAt: new Date().toISOString()
        };
        store.orders.unshift(order);
        saveStore(store);
        return sendJson(res, 200, { success: true, order, balanceMmk: store.balanceMmk });
      }

      // Case 2: Live Canboso catalog product -> call POST /api/v2/telegram-buyer/purchase
      const emailsList = Array.isArray(body.customerEmails) && body.customerEmails.length
        ? body.customerEmails.map(s => String(s).trim()).filter(Boolean)
        : (customerEmail ? [customerEmail] : []);

      // If a slot product has quantityFixed: 1 and user submitted multiple emails, call once per email (like Telegram bot)
      const calls = (pkg.requiresEmail && emailsList.length > 1)
        ? emailsList.map(em => ({ email: em, qty: 1 }))
        : [{ email: emailsList[0] || customerEmail, qty: pkg.quantityFixed ? pkg.quantityFixed : quantity }];

      let allAccounts = [], lastOrder = null, lastUp = null;
      for (const cItem of calls) {
        const idemKey = `exa-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const apiPayload = {
          key: BUYER_KEY,
          product_id: pkg.productId,
          quantity: cItem.qty
        };
        if (pkg.requiresEmail || cItem.email) apiPayload.customer_email = cItem.email;
        if (pkg.requiresAccounts && customerAccounts.length) apiPayload.customer_accounts = customerAccounts;
        if (pkg.requiresSlotMonths && slotMonths) apiPayload.slot_months = slotMonths;

        const upstream = await canbosoRequest('POST', '/api/v2/telegram-buyer/purchase', apiPayload, {
          'Idempotency-Key': idemKey
        });
        lastUp = upstream;
        if (upstream.status === 200 && upstream.data?.success) {
          lastOrder = upstream.data.order || {};
          if (Array.isArray(upstream.data.delivery?.accounts)) {
            allAccounts.push(...upstream.data.delivery.accounts);
          }
        } else {
          break;
        }
      }

      if (lastOrder) {
        store.balanceMmk -= totalMmk;
        const order = {
          orderCode: lastOrder.orderCode || ('CB-' + Date.now().toString(36).toUpperCase()),
          productId: pkg.productId,
          categoryId: cat.id,
          categoryName: cat.name,
          productName: lastOrder.productName || pkg.name,
          productType: lastOrder.productType || pkg.productType,
          deliveryMode: pkg.deliveryMode,
          status: lastOrder.status || (allAccounts.length ? 'completed' : 'paid'),
          fulfillmentStatus: lastOrder.fulfillmentStatus || (allAccounts.length ? 'delivered' : 'waiting_seller'),
          quantity: quantity,
          totalMmk,
          totalUsd,
          customerEmail: emailsList.join(', ') || null,
          customerAccounts: customerAccounts.length ? customerAccounts : null,
          accounts: allAccounts,
          createdAt: new Date().toISOString(),
          upstreamLive: true
        };
        store.orders.unshift(order);
        saveStore(store);
        return sendJson(res, 200, { success: true, order, balanceMmk: store.balanceMmk });
      }

      const upstream = lastUp || { status: 400, data: {} };

      // If upstream returned insufficient merchant balance or other error:
      const upMsg = upstream.data?.message || `Supplier API error (HTTP ${upstream.status})`;
      // If user explicitly requests test/sandbox fulfillment when merchant USD balance is low:
      if (body.allowSandboxFallback && upstream.status === 400 && /balance/i.test(upMsg)) {
        store.balanceMmk -= totalMmk;
        const isManual = pkg.productType !== 'account';
        const order = {
          orderCode: 'ORD-' + Date.now().toString(36).toUpperCase(),
          productId: pkg.productId,
          categoryId: cat.id,
          categoryName: cat.name,
          productName: pkg.name,
          productType: pkg.productType,
          deliveryMode: pkg.deliveryMode,
          status: isManual ? 'paid' : 'completed',
          fulfillmentStatus: isManual ? 'waiting_seller' : 'delivered',
          quantity,
          totalMmk,
          totalUsd,
          customerEmail: customerEmail || null,
          customerAccounts: customerAccounts.length ? customerAccounts : null,
          accounts: isManual ? [] : [{
            user: `user_${crypto.randomBytes(3).toString('hex')}@exabyte.store`,
            password: crypto.randomBytes(5).toString('hex'),
            otherInfo: `Fulfilled (Supplier API note: ${upMsg})`
          }],
          supplierNote: upMsg,
          createdAt: new Date().toISOString()
        };
        store.orders.unshift(order);
        saveStore(store);
        return sendJson(res, 200, { success: true, order, balanceMmk: store.balanceMmk, supplierNote: upMsg });
      }

      return sendJson(res, upstream.status || 400, {
        success: false,
        code: 'UPSTREAM_ERROR',
        message: upMsg,
        upstreamPayment: upstream.data?.payment || null
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, message: e.message });
    }
  }

  if (pathname === '/api/upstream-orders' && req.method === 'GET') {
    try {
      const code = u.searchParams.get('orderCode') || '';
      const q = code ? `?orderCode=${encodeURIComponent(code)}` : '';
      const r = await canbosoRequest('GET', `/api/v2/telegram-buyer/orders${q}`);
      return sendJson(res, r.status, r.data);
    } catch (e) {
      return sendJson(res, 503, { success: false, message: e.message });
    }
  }

  // --- STATIC FILES ---
  let relPath = pathname === '/' ? '/index.html' : pathname;
  relPath = path.normalize(relPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, relPath);
  if (filePath.startsWith(__dirname) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Exabyte Digital Store server running at http://localhost:${PORT} (1 USD = ${RATE_MMK} Ks)`);
});
