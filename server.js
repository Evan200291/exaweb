// Exabyte Digital Store — Live API & Store Backend (Node.js)
// Proxies Canboso Buyer API v2, calculates MMK prices at 1 USD = 5,500 Ks,
// and includes custom Outline VPN packages + manual Top-Up & Purchase workflows.

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

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
const TRANSLATION_CACHE_FILE = path.join(DATA_DIR, 'translation-cache.json');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const IMAGE_CACHE_DIR = path.join(DATA_DIR, 'image-cache');
if (!fs.existsSync(IMAGE_CACHE_DIR)) fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });

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
    name: 'Outline VPN 1 Month · 100 GB - full warranty',
    description: '• Private Shadowsocks (ss://) access key for Outline Client.\n• High-speed Singapore SGSEP server route.\n• Supports iOS, Android, Windows, macOS, and Linux.\n• 100 GB data · 30-day service period · full warranty.',
    emoji: 'outline_vpn',
    productType: 'account',
    isCustomOutline: true,
    outlineTotalGb: 100,
    outlineDays: 30,
    fixedMmk: 5000,
    price: { amount: 0.91, currency: 'USD', text: '5,000 Ks' },
    availability: { available: 50, sold: 142 },
    promotions: []
  },
  {
    productId: 'outline_vpn_2m',
    name: 'Outline VPN 2 Months · 200 GB - full warranty',
    description: '• Private Shadowsocks (ss://) access key for Outline Client.\n• High-speed Singapore SGSEP server route.\n• Supports iOS, Android, Windows, macOS, and Linux.\n• 200 GB data · 60-day service period · full warranty.',
    emoji: 'outline_vpn',
    productType: 'account',
    isCustomOutline: true,
    outlineTotalGb: 200,
    outlineDays: 60,
    fixedMmk: 9500,
    price: { amount: 1.73, currency: 'USD', text: '9,500 Ks' },
    availability: { available: 40, sold: 96 },
    promotions: []
  },
  {
    productId: 'outline_vpn_3m',
    name: 'Outline VPN 3 Months · 300 GB - full warranty',
    description: '• Private Shadowsocks (ss://) access key for Outline Client.\n• High-speed Singapore SGSEP server route.\n• Supports iOS, Android, Windows, macOS, and Linux.\n• 300 GB data · 90-day service period · full warranty.',
    emoji: 'outline_vpn',
    productType: 'account',
    isCustomOutline: true,
    outlineTotalGb: 300,
    outlineDays: 90,
    fixedMmk: 14000,
    price: { amount: 2.55, currency: 'USD', text: '14,000 Ks' },
    availability: { available: 35, sold: 89 },
    promotions: []
  }
];

// Category metadata mapping every Canboso emoji / product family to brand styling & group
const CATEGORY_META = {
  outline_vpn:          { title: 'Outline VPN', group: 'vpn', color: '#0f766e', slug: null, svg: 'outline', hot: true, isNew: true },
  chatgpt:              { title: 'ChatGPT', group: 'ai', color: '#10a37f', slug: null, svg: 'openai', hot: true },
  codex:                { title: 'API CodeX', group: 'ai', color: '#202123', slug: null, svg: 'openai', hot: true },
  claude:               { title: 'API Claude', group: 'ai', color: '#d97757', slug: 'anthropic', hot: true },
  deepseek:             { title: 'Deepseek', group: 'ai', color: '#4d6bfe', slug: 'deepseek' },
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
  canva:                { title: 'Canva', group: 'design', color: '#7d2ae8', slug: 'canva', hot: true },
  capcut:               { title: 'CapCut', group: 'design', color: '#111111', slug: 'capcut', hot: true },
  adobe:                { title: 'Adobe Creative Cloud', group: 'design', color: '#e1251b', slug: 'adobe', hot: true },
  figma:                { title: 'Figma', group: 'design', color: '#f24e1e', slug: 'figma' },
  autodesk:             { title: 'AutoDesk', group: 'design', color: '#0696d7', slug: 'autodesk' },
  alight_motion:        { title: 'Alight Motion', group: 'design', color: '#0f3b3a', slug: 'alightmotion' },
  heygen:               { title: 'HeyGen', group: 'ai', color: '#6366f1', slug: 'heygen' },
  higgfield:            { title: 'Higgsfield', group: 'ai', color: '#a3e635', slug: null, darkText: true },
  kling:                { title: 'Kling AI', group: 'ai', color: '#0284c7', slug: null },
  meitu:                { title: 'Meitu', group: 'design', color: '#ff3355', slug: null },
  wink:                 { title: 'Wink', group: 'design', color: '#ff477e', slug: null },
  xingtu:               { title: 'Xingtu', group: 'design', color: '#65a30d', slug: null },
  beautycam:            { title: 'BeautyCam', group: 'design', color: '#ec4899', slug: null },
  gmail:                { title: 'Gmail', group: 'work', color: '#ea4335', slug: 'gmail' },
  microsoft_office_365: { title: 'Microsoft Office 365', group: 'work', color: '#d83b01', slug: 'microsoft365' },
  windows:              { title: 'Windows & Office Keys', group: 'work', color: '#0078d4', slug: 'windows11' },
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
  hma_vpn:              { title: 'HMA VPN', group: 'vpn', color: '#ffd400', slug: 'hidemyass', darkText: true },
  express:              { title: 'ExpressVPN', group: 'vpn', color: '#da3940', slug: 'expressvpn', hot: true },
  surfshark:            { title: 'Surfshark VPN', group: 'vpn', color: '#178a9e', slug: 'surfshark' },
  hotspot_shield:       { title: 'Hotspot Shield', group: 'vpn', color: '#1f8ef1', slug: 'hotspotshield' },
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
  const text = `${p.name || ''} ${p.description || ''}`.toLowerCase();
  const requiresIp = p.emoji === 'deepseek' || text.includes('ip registration') || text.includes('ip must be provided') || text.includes('registered ip');
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
    requiresIp,
    requiresAccounts: !!((req.customerAccounts || pt === 'upgrade_account') && !requiresIp),
    requiresSlotMonths: !!(req.slotMonths || p.productId === 'slot_chatgpt_business'),
    allowedMonths: req.allowedMonths || (p.productId === 'slot_chatgpt_business' ? [1, 3, 6, 12] : null),
    quantityFixed: req.quantityFixed || (pt === 'slot' ? 1 : null)
  };
}

function translatePackageNameMm(name) {
  return String(name || 'Digital package')
    .replace(/full warranty/ig, 'အာမခံအပြည့်')
    .replace(/no warranty/ig, 'အာမခံမပါ')
    .replace(/(\d+)\s*-?\s*hours?\s*warranty/ig, '$1 နာရီ အာမခံ')
    .replace(/(\d+)\s*h\s*warranty/ig, '$1 နာရီ အာမခံ')
    .replace(/(\d+)\s*days?\s*warranty/ig, '$1 ရက် အာမခံ')
    .replace(/(\d+)\s*months?\s*warranty/ig, '$1 လ အာမခံ')
    .replace(/(\d+)\s*years?\s*warranty/ig, '$1 နှစ် အာမခံ')
    .replace(/(\d+)\s*years?/ig, '$1 နှစ်')
    .replace(/(\d+)\s*months?/ig, '$1 လ')
    .replace(/(\d+)\s*days?/ig, '$1 ရက်');
}

// Translate the seller's own description line-by-line. Numbers, product names,
// links and policy limits stay attached to their original API sentence instead
// of being replaced by a generic storefront summary.
function translateSellerLineMm(input) {
  const original = String(input || '').trim();
  if (!original) return '';
  if (/^[━─═_\-\s]+$/.test(original)) return original;
  if (/^https?:\/\//i.test(original) || /^🔗\s*https?:\/\//i.test(original)) return original;

  let text = original;
  const rules = [
    [/MUSE AI\s*([\d,]+)\s*BILLION TOKENS\s*[–-]\s*1 MONTH\s*\|\s*no warranty/gi, 'MUSE AI Token $1 ဘီလီယံ – 1 လ | အာမခံမပါ'],
    [/NOTES? BEFORE USE|NOTE BEFORE USING/gi, 'အသုံးမပြုမီ သတိပြုရန်'],
    [/LOGIN INSTRUCTIONS/gi, 'အကောင့်ဝင်ရောက်အသုံးပြုပုံ'],
    [/Log in (?:with|using) a clean IP\.?/gi, 'သန့်ရှင်းသော IP ဖြင့် အကောင့်ဝင်ပါ။'],
    [/Do not change account information after purchase and do not link Facebook\.?/gi, 'ဝယ်ယူပြီးနောက် အကောင့်အချက်အလက်များကို မပြောင်းပါနှင့်၊ Facebook နှင့်လည်း မချိတ်ပါနှင့်။'],
    [/If you have any questions, please message the shop before taking any action with the account\.?/gi, 'မေးမြန်းလိုသည်များရှိပါက အကောင့်နှင့်ပတ်သက်သော လုပ်ဆောင်ချက်တစ်ခုခု မပြုလုပ်မီ ဆိုင်သို့ အရင်စာပို့မေးမြန်းပါ။'],
    [/Warranty (?:only covers|covers) login for (?:only )?1 hour\. Once you have successfully logged into the account, the warranty ends\.?/gi, 'အကောင့်ဝင်ရောက်မှုအတွက် 1 နာရီသာ အာမခံပါသည်။ အကောင့်ထဲသို့ အောင်မြင်စွာဝင်ရောက်ပြီးသည်နှင့် အာမခံကာလ ပြီးဆုံးပါသည်။'],
    [/Step 1:\s*Enter the account email into Muse AI\.?/gi, 'အဆင့် 1 - အကောင့် Email ကို Muse AI တွင် ထည့်ပါ။'],
    [/Step 2:\s*Access one of the two websites below to get the verification code:?/gi, 'အဆင့် 2 - အတည်ပြုကုဒ်ရယူရန် အောက်ပါ website နှစ်ခုအနက် တစ်ခုသို့ ဝင်ပါ။'],
    [/Step 3:\s*Enter the email on the website to check the verification code\.?/gi, 'အဆင့် 3 - အတည်ပြုကုဒ်ကို စစ်ဆေးရန် website တွင် Email ကို ထည့်ပါ။'],
    [/Step 4:\s*Get the verification code and enter it into Muse AI to complete the login\.?/gi, 'အဆင့် 4 - အတည်ပြုကုဒ်ကို ရယူပြီး Muse AI တွင် ထည့်ကာ အကောင့်ဝင်ခြင်းကို အပြီးသတ်ပါ။'],
    [/Example email:\s*/gi, 'ဥပမာ Email - '],
    [/(?:Email Generator|Generator Email):\s*/gi, 'Email အတည်ပြုကုဒ်ရယူရန် - '],
    [/LuuVan:\s*/gi, 'LuuVan မှ ရယူရန် - '],
    [/PLEASE READ THE WARRANTY TERMS CAREFULLY BEFORE PURCHASING!?/gi, 'မဝယ်ယူမီ အာမခံစည်းမျဉ်းများကို သေချာဖတ်ပါ။'],
    [/PRODUCT INFORMATION|PACKAGE INFORMATION|INFORMATION/gi, 'ပက်ကေ့ချ်အချက်အလက်'],
    [/IMPORTANT NOTES?|NOTES?/gi, 'အရေးကြီးမှတ်ချက်'],
    [/WARRANTY\s*&\s*TERMS|WARRANTY POLICY/gi, 'အာမခံစည်းမျဉ်း'],
    [/FULL WARRANTY/gi, 'အာမခံအပြည့်'],
    [/NO WARRANTY/gi, 'အာမခံမပါ'],
    [/WARRANTY/gi, 'အာမခံ'],
    [/ACTIVATION GUIDE|ACTIVATION PROCESS/gi, 'အသုံးပြုရန် လုပ်ဆောင်ပုံ'],
    [/UPGRADE PROCESS|UPGRADE PROCEDURE|\bPROCESS\b/gi, 'အဆင့်မြှင့်တင်ပုံ'],
    [/BENEFITS|HIGHLIGHTED BENEFITS/gi, 'ရရှိမည့်အကျိုးကျေးဇူးများ'],
    [/SPECIAL/gi, 'အထူးအစီအစဉ်'],
    [/Duration:\s*(\d+)\s*months?/gi, 'အသုံးပြုနိုင်သည့်ကာလ - $1 လ'],
    [/Usage period:\s*(\d+)[- ]month(?:s)?(?: trial)?/gi, 'အသုံးပြုနိုင်သည့်ကာလ - $1 လ'],
    [/valid for\s*(\d+)(?:-(\d+))?\s*days?/gi, (_, a, b) => `အသုံးပြုနိုင်သည့်ကာလ ${a}${b ? ` မှ ${b}` : ''} ရက် ဖြစ်သည်`],
    [/(\d+)[- ]day package warranty/gi, '$1 ရက် အာမခံပါသည်'],
    [/(\d+)[- ]day warranty/gi, '$1 ရက် အာမခံပါသည်'],
    [/(\d+)[- ]hour warranty/gi, '$1 နာရီ အာမခံပါသည်'],
    [/(\d+)[- ]month warranty/gi, '$1 လ အာမခံပါသည်'],
    [/(\d+)\s*months?\s*warranty/gi, '$1 လ အာမခံပါသည်'],
    [/Warranty:\s*(\d+)\s*months?/gi, 'အာမခံကာလ - $1 လ'],
    [/Account format:\s*/gi, 'အကောင့်ပုံစံ - '],
    [/Format:\s*/gi, 'ပေးပို့မည့်ပုံစံ - '],
    [/Customer provides:\s*/gi, 'ဝယ်သူပေးရမည့်အချက်အလက် - '],
    [/After ordering, send Email to the Bot for the system to automatically upgrade\.?/gi, 'အော်ဒါတင်ပြီးနောက် စနစ်မှ အလိုအလျောက်အဆင့်မြှင့်ပေးရန် Email ကို Bot သို့ ပို့ပါ။'],
    [/Order confirmed\s*→\s*check Email to confirm joining the Family\.?/gi, 'အော်ဒါအတည်ပြုပြီးပါက Family ဝင်ရောက်မှုကို အတည်ပြုရန် Email စစ်ပါ။'],
    [/Processing time is only about\s*(\d+)\s*seconds?\.?/gi, 'လုပ်ဆောင်ချိန် $1 စက္ကန့်ခန့်သာ ကြာပါသည်။'],
    [/Done super fast within\s*(\d+)\s*seconds?\.?/gi, '$1 စက္ကန့်အတွင်း လုပ်ဆောင်ပေးပါသည်။'],
    [/(\d+)\s*slots? to join Google AI Family\.?/gi, 'Google AI Family သို့ ဝင်ရောက်ရန် Slot $1 ခု ရရှိပါမည်။'],
    [/Fixed Farm account, stable usage\.?/gi, 'တည်ငြိမ်စွာအသုံးပြုနိုင်သည့် Fixed Farm အကောင့် ဖြစ်သည်။'],
    [/GOOGLE AI FAMILY\s*[–-]\s*(\d+) SLOT\s*\|\s*FIXED FARM/gi, 'GOOGLE AI FAMILY – SLOT $1 ခု | တည်ငြိမ်သော FARM'],
    [/Do not leave the family group on your own\. Leaving the group\s*=\s*အာမခံမပါ\.?/gi, 'Family Group မှ မိမိဘာသာ မထွက်ပါနှင့်။ ထွက်ပါက အာမခံပျက်ပါမည်။'],
    [/The shop only supports changing Email and re-adding if not joined within\s*(\d+)H after purchase to avoid Limit\/Dead Family errors\.?/gi, 'ဝယ်ယူပြီး $1 နာရီအတွင်း Family မဝင်ရသေးပါက Limit/Dead Family ပြဿနာအတွက် Email ပြောင်းပြီး ပြန်ထည့်ပေးခြင်းကိုသာ ဆိုင်မှ ကူညီပေးပါမည်။'],
    [/Each member can only change Email once to limit invitation restrictions\.?/gi, 'ဖိတ်ခေါ်မှုကန့်သတ်ချက် မဖြစ်စေရန် member တစ်ဦးလျှင် Email တစ်ကြိမ်သာ ပြောင်းနိုင်ပါသည်။'],
    [/After\s*(\d+)H, if support is needed\s*→\s*extra\s*(\d+)% of (?:the )?order value\.?/gi, '$1 နာရီကျော်ပြီးနောက် အကူအညီလိုပါက အော်ဒါတန်ဖိုး၏ $2% ထပ်မံပေးရပါမည်။'],
    [/Account does not support email or password change\.?/gi, 'Email သို့မဟုတ် Password ပြောင်းခြင်း မပြုလုပ်နိုင်ပါ။'],
    [/Supports login on\s*(\d+)[–-](\d+)\s*devices\.?/gi, 'စက် $1 လုံးမှ $2 လုံးအထိ ဝင်ရောက်အသုံးပြုနိုင်ပါသည်။'],
    [/Login limited to\s*(\d+)[–-](\d+)\s*devices,? multiple device logins restricted\.?/gi, 'စက် $1 လုံးမှ $2 လုံးအထိသာ အသုံးပြုရန်နှင့် စက်များစွာဖြင့် ဝင်ရောက်ခြင်းကို ကန့်သတ်ထားပါသည်။'],
    [/Can receive up to\s*([\d,]+)\s*AI Credits?/gi, 'AI Credit $1 အထိ ရနိုင်ပါသည်'],
    [/Random AI credits?\.?/gi, 'AI Credit ပမာဏကို ကျပန်းရရှိပါမည်။'],
    [/Share with up to\s*(\d+)\s*people/gi, 'လူ $1 ဦးအထိ မျှဝေသုံးနိုင်ပါသည်'],
    [/Can add up to\s*(\d+)\s*members?/gi, 'Member $1 ဦးအထိ ထည့်နိုင်ပါသည်'],
    [/No credit card (?:or payment method )?required\.?/gi, 'Credit Card သို့မဟုတ် ငွေပေးချေနည်း မလိုအပ်ပါ။'],
    [/Requires? a payment card or e-wallet for verification\.?/gi, 'အတည်ပြုရန် Payment Card သို့မဟုတ် e-wallet လိုအပ်ပါသည်။'],
    [/After successful upgrade, check the package and change the password\.?/gi, 'အဆင့်မြှင့်တင်ပြီးပါက ပက်ကေ့ချ်ကို စစ်ဆေးပြီး Password ပြောင်းပါ။'],
    [/Admin logs in, (?:performs|completes) (?:the )?upgrade and payment\.?/gi, 'Admin က အကောင့်ဝင်ပြီး Upgrade နှင့် ငွေပေးချေမှုကို ဆောင်ရွက်ပေးပါမည်။'],
    [/Please check the account immediately after receiving it\.?/gi, 'အကောင့်ရရှိသည်နှင့် ချက်ချင်းစစ်ဆေးပါ။'],
    [/Please read the description and warranty conditions carefully before purchasing!?/gi, 'မဝယ်ယူမီ ဖော်ပြချက်နှင့် အာမခံစည်းမျဉ်းများကို သေချာဖတ်ပါ။'],
    [/no warranty for logging in too frequently/gi, 'မကြာခဏဝင်ရောက်ခြင်းကြောင့် ဖြစ်သောပြဿနာများအတွက် အာမခံမပါ'],
    [/No warranty in any case of excessive login, regardless of usage purpose\.?/gi, 'မည်သည့်ရည်ရွယ်ချက်ဖြင့်ဖြစ်စေ အလွန်အကျွံဝင်ရောက်အသုံးပြုခြင်းကြောင့် ဖြစ်သောပြဿနာများကို အာမခံမပေးပါ။'],
    [/Email \| Password/gi, 'Email | Password'],
    [/Email \| Pass/gi, 'Email | Password'],
    [/Mail \| Pass/gi, 'Email | Password']
  ];
  for (const [pattern, replacement] of rules) text = text.replace(pattern, replacement);

  const words = [
    [/Direct upgrade/gi, 'တိုက်ရိုက် Upgrade'], [/official Gmail account/gi, 'မူရင်း Gmail အကောင့်'],
    [/activation link/gi, 'အသုံးပြုရန် link'], [/storage/gi, 'သိုလှောင်မှုပမာဏ'],
    [/according to (?:the )?shop(?:'s|’s)? conditions/gi, 'ဆိုင်၏စည်းမျဉ်းများအတိုင်း'],
    [/recommended/gi, 'အကြံပြုထားသည်'], [/do not use/gi, 'မသုံးပါနှင့်'],
    [/customer/gi, 'ဝယ်သူ'], [/account/gi, 'အကောင့်'], [/package/gi, 'ပက်ကေ့ချ်'],
    [/month/gi, 'လ'], [/days?/gi, 'ရက်'], [/hours?/gi, 'နာရီ']
  ];
  for (const [pattern, replacement] of words) text = text.replace(pattern, replacement);
  return text;
}

function translatePackageMm(p, delivery) {
  const rawName = String(p.name || 'Digital package');
  const rawDescription = String(p.description || '').trim();
  const source = `${rawName}\n${rawDescription}`;
  if (rawDescription) {
    const translatedSource = rawDescription
      .split(/\r?\n/)
      .map(line => translateSellerLineMm(line))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');
    const liveDeliveryMm = delivery.isInstant
      ? 'ရောင်းသူ API တွင် လက်ကျန်ရှိပါက ငွေပေးချေပြီးနောက် အကောင့်အချက်အလက်ကို ချက်ချင်းပို့ပေးပါမည်။'
      : p.productType === 'slot'
        ? 'ဝယ်သူ၏ Email လိုအပ်ပြီး ရောင်းသူက invitation ပို့ပေးမည့် Slot ပက်ကေ့ချ် ဖြစ်သည်။'
        : 'ဝယ်သူ၏အကောင့်အချက်အလက်ကို အသုံးပြုပြီး ရောင်းသူက အဆင့်မြှင့်တင်ပေးမည့် ပက်ကေ့ချ် ဖြစ်သည်။';
    return {
      nameMm: translatePackageNameMm(rawName),
      descriptionMm: translatedSource,
      deliveryLabelMm: delivery.isInstant ? 'ချက်ချင်းပို့ပေးမည်' : p.productType === 'slot' ? 'Slot ဖိတ်ခေါ်မှု' : 'အကောင့်အဆင့်မြှင့်ခြင်း',
      deliveryHintMm: liveDeliveryMm
    };
  }
  const duration = source.match(/(\d+)\s*(hour|hours|h|day|days|month|months|year|years|week|weeks)/i);
  const durationMm = duration
    ? `${duration[1]} ${/^(?:hour|hours|h)$/i.test(duration[2]) ? 'နာရီ' : /day/i.test(duration[2]) ? 'ရက်' : /week/i.test(duration[2]) ? 'ပတ်' : /year/i.test(duration[2]) ? 'နှစ်' : 'လ'}`
    : '';
  const typeMm = p.productType === 'slot'
    ? 'အီးမေးလ်မှတစ်ဆင့် မိသားစု/Slot အဖွဲ့ဝင်အဖြစ် ဖိတ်ကြားပေးမည့် ပက်ကေ့ချ်'
    : p.productType === 'upgrade_account'
      ? 'သင့်အကောင့်ကို အဆင့်မြှင့်ပေးမည့် ပက်ကေ့ချ်'
      : 'ဝယ်ယူပြီးနောက် အကောင့်အချက်အလက်ကို အလိုအလျောက်ရရှိမည့် ပက်ကေ့ချ်';
  const deliveryMm = delivery.isInstant
    ? 'ငွေပေးချေမှုအောင်မြင်ပြီးသည်နှင့် ချက်ချင်းပို့ပေးပါမည်။'
    : p.productType === 'slot'
      ? 'ဝယ်ယူရန် သင့်အီးမေးလ်လိုအပ်ပြီး ဖိတ်စာကို အီးမေးလ်သို့ ပို့ပေးပါမည်။'
      : 'သင့်အကောင့်အချက်အလက်ပေးရန်လိုအပ်ပြီး အက်ဒမင်က အဆင့်မြှင့်ပြီးပါက အတည်ပြုပေးပါမည်။';
  const info = [];
  const warnings = [];
  const activation = [];
  const warranty = [];

  if (durationMm) info.push(`• အသုံးပြုနိုင်သည့်ကာလ — ${durationMm}`);
  info.push(`• ${typeMm} ဖြစ်သည်။`);
  info.push(`• ${deliveryMm}`);
  if (/unlimited/i.test(source)) info.push('• Fair-use မူဝါဒအရ အကန့်အသတ်မဲ့ အသုံးပြုနိုင်သည်။');
  const storage = source.match(/([\d,.]+)\s*(GB|TB)\b/i);
  if (storage) info.push(`• Storage/ဒေတာပမာဏ ${storage[1]} ${storage[2].toUpperCase()} ပါဝင်သည်။`);
  const devices = source.match(/(?:up to\s*)?(\d+)\s*devices?/i);
  if (devices) info.push(`• စက် ${devices[1]} လုံးအထိ အသုံးပြုနိုင်သည်။`);
  const members = source.match(/(?:up to\s*)?(\d+)\s*(?:people|members|accounts)/i);
  if (members) info.push(`• မိသားစုအဖွဲ့ဝင်/အကောင့် ${members[1]} ခုအထိ မျှဝေအသုံးပြုနိုင်သည်။`);
  const credits = source.match(/([\d,]+)\s*(?:AI|Flow)?\s*(?:credits|points)/i);
  if (credits) info.push(`• AI/Flow Credit ${credits[1]} ပါဝင်သည်။`);
  if (/YouTube Premium/i.test(source)) info.push('• YouTube Premium အကျိုးခံစားခွင့် ပါဝင်သည်။');
  if (/Google (?:Drive|Photos|One)|Gmail/i.test(source)) info.push('• Google Drive၊ Google Photos၊ Gmail သို့မဟုတ် Google One ဝန်ဆောင်မှုနှင့် တွဲဖက်အသုံးပြုနိုင်သည်။');
  if (/Antigravity/i.test(source)) info.push('• Google Antigravity ကို ပံ့ပိုးသည်။');
  if (/official (?:activation )?link|redeem link/i.test(source)) info.push('• Google ၏ တရားဝင် activation link ဖြင့် ဖွင့်သုံးရမည်။');

  if (/send Email to (?:the )?Bot|requires? (?:your )?email|provide (?:the )?email/i.test(source)) activation.push('• မှာယူပြီးနောက် အသုံးပြုမည့် Email ကို မှန်ကန်စွာပေးရန်လိုသည်။');
  if (/Email\s*\|\s*Pass(?:word)?\s*\|\s*2FA|Mail\s*\|\s*Pass(?:word)?\s*\|\s*2FA/i.test(source)) activation.push('• အဆင့်မြှင့်ရန် Email | Password | 2FA အချက်အလက်ကို အက်ဒမင်ထံ ပေးရမည်။');
  if (/payment card|credit card|e-wallet|valid card/i.test(source)) activation.push('• Activation အတည်ပြုရန် ဘဏ်ကတ် သို့မဟုတ် e-wallet လိုအပ်နိုင်သည်။');
  if (/check Email to confirm|confirm joining/i.test(source)) activation.push('• အော်ဒါအတည်ပြုပြီးနောက် Email ထဲရှိ ဖိတ်ကြားချက်ကို လက်ခံအတည်ပြုရမည်။');
  if (/change the password/i.test(source)) activation.push('• အဆင့်မြှင့်ပြီးသည်နှင့် လုံခြုံရေးအတွက် Password ပြောင်းပါ။');
  if (/cancel auto-renewal/i.test(source)) activation.push('• မလိုအပ်သော အပိုငွေမဖြတ်စေရန် activation ပြီးနောက် auto-renewal ကို ပိတ်နိုင်သည်။');

  if (/do not leave the family group|leaving the group\s*=\s*no warranty/i.test(source)) warnings.push('• Family Group မှ မိမိဘာသာ မထွက်ရပါ။ ထွက်သွားပါက အာမခံပျက်ပါမည်။');
  const readdHours = source.match(/changing Email and re-adding[\s\S]{0,80}?within\s*(\d+)H/i);
  if (readdHours) warnings.push(`• ဝယ်ယူပြီး ${readdHours[1]} နာရီအတွင်း Family Group မဝင်နိုင်သေးပါကသာ Email ပြောင်း၍ ပြန်ဖိတ်ပေးနိုင်သည်။`);
  if (/Each member can only change Email once/i.test(source)) warnings.push('• ဖိတ်ကြားမှုကန့်သတ်ချက်ကြောင့် အဖွဲ့ဝင်တစ်ဦးလျှင် Email တစ်ကြိမ်သာ ပြောင်းနိုင်သည်။');
  const supportFee = source.match(/After\s*(\d+)H[\s\S]{0,80}?extra\s*(\d+)%/i);
  if (supportFee) warnings.push(`• ${supportFee[1]} နာရီကျော်ပြီးနောက် အကူအညီလိုပါက အော်ဒါတန်ဖိုး၏ ${supportFee[2]}% ထပ်မံပေးရမည်။`);
  if (/each link can only be activated once/i.test(source)) warnings.push('• Activation link တစ်ခုကို တစ်ကြိမ်သာ အသုံးပြုနိုင်ပြီး အသုံးပြုသည့် Gmail နှင့် အမြဲချိတ်ဆက်သွားမည်။');
  if (/not eligible|eligib/i.test(source) && /Gmail/i.test(source)) warnings.push('• Gmail အကောင့်အချို့သည် offer ရယူခွင့်မရှိနိုင်သောကြောင့် မဝယ်ယူမီ စစ်ဆေးပါ။');
  if (/no refund|not eligible for (?:exchange|refund)|no refunds/i.test(source)) warnings.push('• ဖော်ပြထားသော စည်းမျဉ်းများနှင့်မကိုက်ညီပါက ငွေပြန်အမ်းခြင်း သို့မဟုတ် လဲလှယ်ခြင်း မပြုနိုင်ပါ။');
  if (/do not use (?:a )?new Gmail|long-standing Gmail|old Gmail/i.test(source)) warnings.push('• Checkpoint မဖြစ်စေရန် အသုံးပြုထားကြာပြီဖြစ်သော Gmail ကို သုံးရန် အကြံပြုသည်။');
  if (/incorrectly|customer-caused errors|shop is not responsible|not responsible/i.test(source)) warnings.push('• Customer ဘက်မှ အချက်အလက်မှားခြင်း သို့မဟုတ် စည်းမျဉ်းမလိုက်နာခြင်းကြောင့် ဖြစ်သည့်ပြဿနာများကို ဆိုင်ဘက်မှ တာဝန်မယူပါ။');

  const warrantyText = source.match(/(?:warranty(?:\s*&\s*terms)?\s*[:|-]?\s*|)(\d+)\s*(hour|hours|h|day|days|month|months|year|years)\s*(?:link\s*)?warranty/i);
  if (/full warranty/i.test(rawName)) warranty.push('• ဝယ်ယူထားသည့် ပက်ကေ့ချ်ကာလအတွင်း အာမခံအပြည့် ပါဝင်သည်။');
  else if (/\bno warranty\b/i.test(rawName)) warranty.push('• ဤပက်ကေ့ချ်တွင် အာမခံမပါဝင်ပါ။');
  else if (warrantyText) {
    const unit = /^(?:hour|hours|h)$/i.test(warrantyText[2]) ? 'နာရီ' : /day/i.test(warrantyText[2]) ? 'ရက်' : /year/i.test(warrantyText[2]) ? 'နှစ်' : 'လ';
    warranty.push(`• အာမခံကာလ — ${warrantyText[1]} ${unit}`);
  } else if (/warranty/i.test(source)) warranty.push('• API တွင် ဖော်ပြထားသော အာမခံစည်းမျဉ်းအတိုင်း ဝန်ဆောင်မှုပေးသည်။');
  else warranty.push('• အာမခံမဖော်ပြထားသောကြောင့် မဝယ်ယူမီ အက်ဒမင်ထံ အတည်ပြုပါ။');
  if (/link warranty/i.test(source)) warranty.push('• Activation link ကို လက်ခံရရှိချိန်တွင် အသုံးမပြုရသေးကြောင်း ဆိုင်က အာမခံသည်။');

  const sections = [
    `📦 ပက်ကေ့ချ်အချက်အလက်\n${info.join('\n')}`,
    activation.length ? `🔑 အသုံးပြုရန်/Activation လုပ်ရန်\n${activation.join('\n')}` : '',
    warnings.length ? `⚠️ သတိပြုရန်\n${warnings.join('\n')}` : '',
    `🛡️ အာမခံစည်းမျဉ်း\n${warranty.join('\n')}`
  ].filter(Boolean);
  let nameMm = rawName
    .replace(/full warranty/ig, 'အာမခံအပြည့်')
    .replace(/no warranty/ig, 'အာမခံမရှိ')
    .replace(/24\s*h(?:our)?\s*warranty/ig, '၂၄ နာရီအာမခံ')
    .replace(/(\d+)\s*months?\s*warranty/ig, '$1 လ အာမခံ')
    .replace(/(\d+)\s*years?/ig, '$1 နှစ်')
    .replace(/(\d+)\s*months?/ig, '$1 လ')
    .replace(/(\d+)\s*days?/ig, '$1 ရက်');
  return {
    nameMm,
    descriptionMm: sections.join('\n\n'),
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
let catalogFetchPromise = null;
const CACHE_TTL_MS = 10 * 1000; // One shared seller refresh every 10 seconds (well below 30 req/60s).

// Seed the in-memory catalog from the checked-in cache so startup is instant.
try {
  if (fs.existsSync(CACHE_FILE)) {
    memoryCatalog = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8').replace(/^\uFEFF/, ''));
  }
} catch {}

async function getRawCatalog(force = false) {
  const now = Date.now();
  if (!BUYER_KEY && memoryCatalog) {
    return { catalog: memoryCatalog, source: 'snapshot', fetchedAt: null };
  }
  if (!force && memoryCatalog && (now - lastFetchMs < CACHE_TTL_MS)) {
    return { catalog: memoryCatalog, source: 'cache', fetchedAt: new Date(lastFetchMs).toISOString() };
  }
  if (catalogFetchPromise) return catalogFetchPromise;
  catalogFetchPromise = (async () => {
    try {
      const res = await canbosoRequest('GET', '/api/v2/telegram-buyer/products');
      if (res.status === 200 && res.data && res.data.success && Array.isArray(res.data.products)) {
        memoryCatalog = res.data;
        lastFetchMs = Date.now();
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
  })();
  try { return await catalogFetchPromise; }
  finally { catalogFetchPromise = null; }
}

let mmTranslationCache = {};
try {
  if (fs.existsSync(TRANSLATION_CACHE_FILE)) {
    mmTranslationCache = JSON.parse(fs.readFileSync(TRANSLATION_CACHE_FILE, 'utf8').replace(/^\uFEFF/, ''));
  }
} catch {}

const activeTranslations = new Map();

function translateChunkToMyanmar(chunk) {
  return new Promise((resolve, reject) => {
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.search = new URLSearchParams({ client: 'gtx', sl: 'en', tl: 'my', dt: 't', q: chunk }).toString();
    const request = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 ExabyteStore/1.0' }, timeout: 12000 }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', part => body += part);
      response.on('end', () => {
        if (response.statusCode !== 200) return reject(new Error(`Translation service returned ${response.statusCode}`));
        try {
          const parsed = JSON.parse(body);
          const translated = Array.isArray(parsed[0]) ? parsed[0].map(part => part && part[0] ? part[0] : '').join('') : '';
          if (!translated) throw new Error('Translation service returned an empty result');
          resolve(translated);
        } catch (error) { reject(error); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('Translation service timed out')));
    request.on('error', reject);
  });
}

function splitTranslationChunks(text, limit = 1500) {
  const chunks = [];
  let current = '';
  for (const line of String(text || '').split(/\r?\n/)) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > limit && current) {
      chunks.push(current);
      current = line;
    } else current = next;
  }
  if (current) chunks.push(current);
  return chunks;
}

async function getFullMyanmarTranslation(productId) {
  const rawProduct = [...OUTLINE_PACKAGES, ...((memoryCatalog && memoryCatalog.products) || [])]
    .find(product => String(product.productId) === String(productId));
  if (!rawProduct) throw new Error('Product was not found in the seller catalog');
  const source = String(rawProduct.description || '').trim();
  if (!source) return { productId, descriptionMm: '', cached: true };
  const sourceHash = crypto.createHash('sha256').update(`v2\0${source}`).digest('hex');
  const cached = mmTranslationCache[productId];
  if (cached && cached.sourceHash === sourceHash && cached.descriptionMm) {
    return { productId, descriptionMm: cached.descriptionMm, cached: true };
  }
  if (activeTranslations.has(productId)) return activeTranslations.get(productId);

  const translationTask = (async () => {
    const protectedValues = [];
    const protectedSource = source.replace(/https?:\/\/[^\s]+|\b(?:Email|Password|Pass|2FA|IP|QR|Facebook|Gmail|Telegram|Bot|API|JSON|OTP)\b/gi, value => {
      const token = `ZXQURL${protectedValues.length}ZXQ`;
      protectedValues.push(value);
      return token;
    });
    const translatedParts = [];
    for (const chunk of splitTranslationChunks(protectedSource)) translatedParts.push(await translateChunkToMyanmar(chunk));
    let descriptionMm = translatedParts.join('\n');
    protectedValues.forEach((value, index) => {
      descriptionMm = descriptionMm.replace(new RegExp(`ZXQURL${index}ZXQ`, 'gi'), value);
    });
    mmTranslationCache[productId] = { sourceHash, descriptionMm, translatedAt: new Date().toISOString() };
    fs.writeFileSync(TRANSLATION_CACHE_FILE, JSON.stringify(mmTranslationCache, null, 2), 'utf8');
    return { productId, descriptionMm, cached: false };
  })();
  activeTranslations.set(productId, translationTask);
  try { return await translationTask; }
  finally { activeTranslations.delete(productId); }
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
      const logoExtension = ['svg', 'png', 'ico', 'webp', 'jpg'].find(extension => fs.existsSync(path.join(__dirname, 'assets', 'logos', `${key}.${extension}`)));
      catMap.set(key, {
        id: key.replace(/_/g, '-'),
        key,
        name: meta.title,
        group: meta.group,
        color: meta.color,
        slug: meta.slug || null,
        svg: meta.svg || null,
        darkText: !!meta.darkText,
        logoPath: logoExtension ? `assets/logos/${key}.${logoExtension}` : null,
        hot: !!meta.hot,
        isNew: !!meta.isNew,
        packages: []
      });
    }
    const deliv = classifyDelivery(p);
    const usd = Number(p.price?.amount || 0);
    const mmk = Number.isFinite(Number(p.fixedMmk)) ? Number(p.fixedMmk) : usdToMmk(usd);
    const sourceImage = p.image ? (p.image.startsWith('http') ? p.image : API_BASE + p.image) : null;
    // Seller-hosted images are routed through a same-origin cache so repeated mobile
    // views avoid another slow upstream image request.
    const image = sourceImage ? `/api/image?url=${encodeURIComponent(sourceImage)}` : null;
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
    const coverPkg = cat.packages.find(x => x.image && /product-default-images/i.test(x.image));
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

function compactStructuredCatalog(data) {
  return {
    ...data,
    categories: data.categories.map(category => ({
      ...category,
      packages: category.packages.map(packageItem => {
        const {
          description, descriptionMm, promotions,
          deliveryLabel, deliveryLabelMm, deliveryHint, deliveryHintMm,
          ...compact
        } = packageItem;
        return compact;
      })
    }))
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

function sendCompressedJson(req, res, status, obj, cacheControl = 'no-store') {
  const source = Buffer.from(JSON.stringify(obj));
  const accepted = String(req.headers['accept-encoding'] || '');
  let body = source;
  let encoding = '';
  if (source.length > 1024 && /\bbr\b/.test(accepted)) {
    body = zlib.brotliCompressSync(source, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } });
    encoding = 'br';
  } else if (source.length > 1024 && /\bgzip\b/.test(accepted)) {
    body = zlib.gzipSync(source, { level: 6 });
    encoding = 'gzip';
  }
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cacheControl,
    'Content-Length': body.length,
    'Vary': 'Accept-Encoding'
  };
  if (encoding) headers['Content-Encoding'] = encoding;
  res.writeHead(status, headers);
  res.end(body);
}

async function serveCachedSellerImage(res, requestedUrl) {
  let remote;
  try { remote = new URL(requestedUrl); } catch { return sendJson(res, 400, { success: false, message: 'Invalid image URL' }); }
  // Catalog artwork is supplier content only; never turn this route into an open proxy.
  if (remote.protocol !== 'https:' || !/(^|\.)canboso\.com$/i.test(remote.hostname)) {
    return sendJson(res, 403, { success: false, message: 'Image host is not allowed' });
  }
  const key = crypto.createHash('sha256').update(remote.toString()).digest('hex');
  const file = path.join(IMAGE_CACHE_DIR, `${key}.bin`);
  const metaFile = path.join(IMAGE_CACHE_DIR, `${key}.json`);
  const respond = (type, bytes) => {
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=2592000, immutable',
      'Content-Length': bytes.length
    });
    res.end(bytes);
  };
  try {
    if (fs.existsSync(file) && fs.existsSync(metaFile)) {
      const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
      return respond(meta.type || 'image/jpeg', fs.readFileSync(file));
    }
    const upstream = await fetch(remote, { headers: { 'User-Agent': 'ExabyteStore image cache/1.0' }, signal: AbortSignal.timeout(15000) });
    const type = String(upstream.headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (!upstream.ok || !type.startsWith('image/')) throw new Error(`Supplier image returned ${upstream.status}`);
    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error('Supplier image is invalid or too large');
    fs.writeFileSync(file, bytes);
    fs.writeFileSync(metaFile, JSON.stringify({ type, source: remote.toString(), cachedAt: new Date().toISOString() }));
    return respond(type, bytes);
  } catch (error) {
    console.warn(`Seller image cache failed: ${error.message}`);
    return sendJson(res, 502, { success: false, message: 'Seller image is temporarily unavailable' });
  }
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
  if (pathname === '/api/v1/products' && req.method === 'GET') {
    if (!isAdminRequest(req)) return sendJson(res, 401, { success: false, message: 'Bearer API token required' });
    try {
      const raw = await getRawCatalog(u.searchParams.get('refresh') === '1');
      return sendJson(res, 200, buildStructuredCatalog(raw.catalog.products || [], raw));
    } catch (error) {
      return sendJson(res, 503, { success: false, message: error.message });
    }
  }
  if (pathname === '/api/v1/balance' && req.method === 'GET') {
    if (!isAdminRequest(req)) return sendJson(res, 401, { success: false, message: 'Bearer API token required' });
    return sendJson(res, 200, { success: true, balanceMmk: store.balanceMmk, currency: 'MMK' });
  }
  if (pathname === '/api/v1/orders' && req.method === 'GET') {
    if (!isAdminRequest(req)) return sendJson(res, 401, { success: false, message: 'Bearer API token required' });
    const orderCode = String(u.searchParams.get('orderCode') || '').trim();
    const orders = orderCode ? store.orders.filter(order => order.orderCode === orderCode) : store.orders.slice(0, 100);
    return sendJson(res, 200, { success: true, orders });
  }
  if (pathname === '/api/bootstrap' && req.method === 'GET') {
    try {
      const force = u.searchParams.get('refresh') === '1';
      const raw = await getRawCatalog(force);
      const catalog = compactStructuredCatalog(buildStructuredCatalog(raw.catalog.products || [], raw));
      const state = {
        success: true,
        rateMmk: RATE_MMK,
        balanceMmk: store.balanceMmk,
        orders: store.orders.map(({ accounts, customerAccounts, customerEmail, ...order }) => order),
        topups: store.topups.map(({ screenshot, screenshotHash, ...topup }) => topup)
      };
      const auth = {
        google: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI && SESSION_SECRET),
        telegram: !!(TG_BOT_TOKEN && TG_BOT_USERNAME && APP_BASE_URL && SESSION_SECRET),
        telegramBot: TG_BOT_USERNAME,
        user: currentUser(req)
      };
      return sendCompressedJson(req, res, 200, { success: true, catalog, state, auth }, 'private, max-age=5, stale-while-revalidate=15');
    } catch (error) {
      return sendCompressedJson(req, res, 503, { success: false, message: error.message });
    }
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

  if (pathname === '/api/product-detail' && req.method === 'GET') {
    try {
      const productId = String(u.searchParams.get('productId') || '').trim();
      if (!productId) return sendJson(res, 400, { success: false, message: 'productId is required' });
      const raw = await getRawCatalog(false);
      const structured = buildStructuredCatalog(raw.catalog.products || [], raw);
      let product = null;
      for (const category of structured.categories) {
        product = category.packages.find(item => String(item.productId) === productId);
        if (product) break;
      }
      if (!product) return sendJson(res, 404, { success: false, message: 'Product was not found' });
      return sendCompressedJson(req, res, 200, { success: true, product }, 'private, max-age=30, stale-while-revalidate=60');
    } catch (error) {
      return sendJson(res, 503, { success: false, message: error.message });
    }
  }

  if (pathname === '/api/translate/mm' && req.method === 'GET') {
    try {
      const productId = String(u.searchParams.get('productId') || '').trim();
      if (!productId) return sendJson(res, 400, { success: false, message: 'productId is required' });
      const translated = await getFullMyanmarTranslation(productId);
      return sendJson(res, 200, { success: true, ...translated });
    } catch (error) {
      // Keep package details available even if the external translation
      // endpoint is rate-limited or blocked by the deployment network.
      const productId = String(u.searchParams.get('productId') || '').trim();
      const rawProduct = [...OUTLINE_PACKAGES, ...((memoryCatalog && memoryCatalog.products) || [])]
        .find(product => String(product.productId) === productId);
      if (!rawProduct) return sendJson(res, 404, { success: false, message: 'Product was not found in the seller catalog' });
      const fallback = translatePackageMm(rawProduct, classifyDelivery(rawProduct));
      console.warn(`Myanmar translation fallback for ${productId}: ${error.message}`);
      return sendJson(res, 200, { success: true, productId, descriptionMm: fallback.descriptionMm || rawProduct.description || '', cached: false, fallback: true });
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

  if ((pathname === '/api/purchase' || pathname === '/api/v1/purchase') && req.method === 'POST') {
    if (pathname === '/api/v1/purchase' && !isAdminRequest(req)) return sendJson(res, 401, { success: false, message: 'Bearer API token required' });
    try {
      const body = await readBody(req);
      const productId = String(body.productId || '').trim();
      const quantity = Math.max(1, Math.min(20, parseInt(body.quantity || 1, 10)));
      const customerEmail = String(body.customerEmail || '').trim();
      const customerIp = String(body.customerIp || '').trim();
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
      if (pkg.requiresIp && !/^[0-9a-fA-F:.]{3,64}$/.test(customerIp)) {
        return sendJson(res, 400, { success: false, message: 'A valid IPv4 or IPv6 address is required for this API package.' });
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
          customerIp: customerIp || null,
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
        if (pkg.requiresIp) apiPayload.customer_ip = customerIp;
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
          customerIp: customerIp || null,
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
          customerIp: customerIp || null,
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

  if (pathname === '/api/image' && req.method === 'GET') {
    return serveCachedSellerImage(res, u.searchParams.get('url') || '');
  }

  // --- STATIC FILES ---
  let relPath = (pathname === '/' || pathname === '/300userscontract19') ? '/index.html' : pathname;
  relPath = path.normalize(relPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, relPath);
  if (filePath.startsWith(__dirname) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const longLivedAsset = ['.css', '.js', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.ttf'].includes(ext);
    const compressible = ['.html', '.css', '.js', '.json', '.svg'].includes(ext);
    const accepted = String(req.headers['accept-encoding'] || '');
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': longLivedAsset ? 'public, max-age=2592000, immutable' : 'no-cache',
      'Vary': 'Accept-Encoding'
    };
    let stream = fs.createReadStream(filePath);
    if (compressible && /\bbr\b/.test(accepted)) {
      headers['Content-Encoding'] = 'br';
      stream = stream.pipe(zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } }));
    } else if (compressible && /\bgzip\b/.test(accepted)) {
      headers['Content-Encoding'] = 'gzip';
      stream = stream.pipe(zlib.createGzip({ level: 6 }));
    }
    res.writeHead(200, headers);
    stream.pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Exabyte Digital Store server running at http://localhost:${PORT} (1 USD = ${RATE_MMK} Ks)`);
  if (BUYER_KEY) {
    getRawCatalog(true).catch(err => console.warn('Initial seller sync failed:', err.message));
    setInterval(() => getRawCatalog(false).catch(err => console.warn('Seller sync failed:', err.message)), CACHE_TTL_MS);
  } else {
    console.warn('CANBOSO_API_KEY is not configured; serving the checked-in catalog snapshot.');
  }
});
