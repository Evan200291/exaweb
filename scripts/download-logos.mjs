import fs from 'node:fs/promises';
import path from 'node:path';

const logos = {
  chatgpt: 'openai', codex: 'openai', claude: 'anthropic', deepseek: 'deepseek', grok: 'x',
  antigravity: 'google', google_one: 'google', google: 'google', perplexity: 'perplexity',
  lovable: 'lovable', jetbrains: 'jetbrains', zed: 'zedindustries', github: 'github',
  canva: 'canva', capcut: 'capcut', adobe: 'adobe', figma: 'figma', autodesk: 'autodesk',
  alight_motion: 'alightmotion', heygen: 'heygen', kling: 'klingai', meitu: 'meitu',
  gmail: 'gmail', microsoft_office_365: 'microsoft', windows: 'windows11',
  grammarly: 'grammarly', ilovepdf: 'ilovepdf', proton: 'proton', zoom: 'zoom',
  apple: 'applemusic', youtube: 'youtube', netflix: 'netflix', spotify: 'spotify',
  galaxy_play: 'samsung', amazon_prime: 'amazonprime', locket: 'locket', duolingo: 'duolingo',
  quizlet: 'quizlet', scribd: 'scribd', nordvpn: 'nordvpn', hma_vpn: 'hidemyass',
  express: 'expressvpn', surfshark: 'surfshark', hotspot_shield: 'hotspotshield',
  crunchyroll: 'crunchyroll'
};

const fallbacks = {
  muse_ai: ['https://muse.ai/favicon.ico', 'ico'],
  kiro: ['https://kiro.dev/favicon.ico', 'ico'],
  genspark: ['https://www.genspark.ai/favicon.ico', 'ico'],
  higgfield: ['https://higgsfield.ai/favicon.ico', 'ico'],
  xingtu: ['https://www.xingtu.cn/favicon.ico', 'ico'],
  beautycam: ['https://www.beautycam.com/_next/static/media/logo.64fac3ff.png', 'png'],
  vieon: ['https://vieon.vn/favicon.ico', 'ico'],
  fpt_play: ['https://fptplay.vn/favicon.ico', 'ico'],
  lovable: ['https://lovable.dev/favicon.ico', 'ico'],
  capcut: ['https://sf16-web-tos-buz.capcutstatic.com/obj/capcut-web-buz-sg/common/images/lv_web-2.ico', 'ico'],
  alight_motion: ['https://alightmotion.com/alight-logo-minified.svg', 'svg'],
  heygen: ['https://www.heygen.com/favicon.ico', 'ico'],
  kling: ['https://klingai.com/favicon.ico', 'ico'],
  meitu: ['https://www.meituxiuxiu.com/favicon.ico', 'ico'],
  locket: ['https://www.locket.camera/favicon.ico', 'ico'],
  hma_vpn: ['https://www.hidemyass.com/favicon.ico', 'ico'],
  hotspot_shield: ['https://www.hotspotshield.com/favicon.ico', 'ico'],
  wink: ['https://wink.cn/_next/static/media/wink-logo-quare.1_ykc88tt4q99.jpg?dpl=5e6042476969f4b50bab3cfeb9c14130f94b65b1', 'jpg']
};

const output = path.resolve('assets/logos');
await fs.mkdir(output, { recursive: true });
const results = [];
for (const [key, slug] of Object.entries(logos)) {
  const url = `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${slug}.svg`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(String(response.status));
    const svg = await response.text();
    if (!/^<svg[\s>]/i.test(svg.trim())) throw new Error('not-svg');
    await fs.writeFile(path.join(output, `${key}.svg`), svg, 'utf8');
    results.push(`OK   ${key} <- ${slug}`);
  } catch (error) {
    results.push(`MISS ${key} <- ${slug} (${error.message})`);
  }
}
for (const [key, [url, extension]] of Object.entries(fallbacks)) {
  if (results.some(line => line.startsWith(`OK   ${key} `))) continue;
  try {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) throw new Error(String(response.status));
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 100) throw new Error('empty-file');
    await fs.writeFile(path.join(output, `${key}.${extension}`), bytes);
    results.push(`OK   ${key} <- ${new URL(url).hostname}`);
  } catch (error) {
    results.push(`MISS ${key} <- ${url} (${error.message})`);
  }
}
console.log(results.join('\n'));
