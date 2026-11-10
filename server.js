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
    productId: 'outline_vpn_1m',
    name: 'Outline VPN 1 Month (1 Device · 200 GB) - full warranty',
    description: '• Private Shadowsocks (ss://) access key for Outline Client.\n• High-speed Singapore / US / Japan routing.\n• Supports iOS, Android, Windows, macOS, and Linux.\n• 1 Device · 200 GB high-speed data · 30-day full warranty.',
    emoji: 'outline_vpn',
    productType: 'account',
    isCustomOutline: true,
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

    catMap.get(key).packages.push({
      productId: p.productId,
      name: p.name,
      description: p.description || '',
      productType: p.productType || 'account',
      isCustomOutline: !!p.isCustomOutline,
      usd,
      usdText: p.price?.text || `$${usd.toFixed(2)}`,
      mmk,
      mmkText: `${mmk.toLocaleString('en-US')} Ks`,
      image,
      promotions: p.promotions || [],
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
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = u.pathname;

  // --- API ROUTES ---
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
      orders: store.orders,
      topups: store.topups,
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

      const item = {
        id: 'TP' + Date.now().toString(36).toUpperCase(),
        amountMmk,
        method,
        txRef,
        screenshot,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      store.topups.unshift(item);
      saveStore(store);
      return sendJson(res, 200, { success: true, topup: item, balanceMmk: store.balanceMmk });
    } catch (e) {
      return sendJson(res, 400, { success: false, message: e.message });
    }
  }

  if (pathname === '/api/topup/approve' && req.method === 'POST') {
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

      // Case 1: Custom Outline VPN package -> fulfill locally with generated ss:// key
      if (pkg.isCustomOutline) {
        const keys = [];
        for (let i = 0; i < quantity; i++) {
          const secret = crypto.randomBytes(12).toString('hex');
          const b64 = Buffer.from(`chacha20-ietf-poly1305:${secret}`).toString('base64');
          const port = 20000 + Math.floor(Math.random() * 9000);
          keys.push(`ss://${b64}@sg-${(i % 4) + 1}.exabyte.store:${port}/?outline=1#Exabyte-${encodeURIComponent(pkg.name.split('(')[0].trim())}`);
        }
        store.balanceMmk -= totalMmk;
        const order = {
          orderCode: 'EX-' + Date.now().toString(36).toUpperCase(),
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
          accounts: keys.map(k => ({ user: k, password: '', otherInfo: 'Outline Client ss:// access key' })),
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
