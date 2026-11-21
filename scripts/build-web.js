'use strict';
// Web sürümünü her marka için ayrı klasöre derler: dist-web/<marka>/
// Kök sayfa (dist-web/index.html) şirket seçim ekranıdır.
const fs = require('fs');
const path = require('path');
const { ROOT, listBrands, readBrand, copyBrandFiles, copyDir } = require('./brand-utils');

const OUT = path.join(ROOT, 'dist-web');
fs.rmSync(OUT, { recursive: true, force: true });

const brands = listBrands().map(readBrand);
for (const b of brands) {
  const dst = path.join(OUT, b.id);
  copyDir(path.join(ROOT, 'app'), dst);
  for (const f of ['brand.js', 'config.js']) fs.rmSync(path.join(dst, f), { force: true });
  copyBrandFiles(b.id, dst);
  console.log('✓', b.name, '->', path.relative(ROOT, dst));
}

// Kök: şirket seçimi
fs.copyFileSync(path.join(ROOT, 'app', 'dizayn17-icon.svg'), path.join(OUT, 'dizayn17-icon.svg'));
fs.copyFileSync(path.join(ROOT, 'app', 'dizayn17-logo.png'), path.join(OUT, 'dizayn17-logo.png'));
const cards = brands.map(b => {
  const logo = fs.readdirSync(b.dir).find(f => /^company-logo\./.test(f));
  return `<a class="card" href="${b.id}/"><img src="${b.id}/${logo}" alt="${b.name}"><span>${b.name}</span></a>`;
}).join('\n      ');
fs.writeFileSync(path.join(OUT, 'index.html'), `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Araç Filo Yönetimi</title><link rel="icon" href="dizayn17-icon.svg" type="image/svg+xml">
<style>
  :root{color-scheme:light dark;font-family:Inter,system-ui,"Segoe UI",sans-serif}
  body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;background:#f3f6fb;color:#172b4d;padding:24px}
  @media(prefers-color-scheme:dark){body{background:#0f1420;color:#e6ebf5}.card{background:#171d2b!important;border-color:#283147!important}}
  h1{font-size:24px;margin:0;text-align:center}p{margin:0;color:#75839a;font-size:14px;text-align:center}
  .grid{display:flex;gap:18px;flex-wrap:wrap;justify-content:center}
  .card{display:flex;flex-direction:column;align-items:center;gap:14px;width:250px;padding:28px 20px;background:#fff;border:1px solid #e4eaf3;border-radius:16px;text-decoration:none;color:inherit;font-weight:700;box-shadow:0 6px 24px #19376310;transition:transform .15s}
  .card:hover{transform:translateY(-3px)}.card img{height:46px;max-width:210px;object-fit:contain;border-radius:4px}
  footer img{height:22px;border-radius:3px}
</style></head><body>
  <h1>Araç Filo Yönetimi</h1><p>Devam etmek için şirketinizi seçin.</p>
  <div class="grid">
      ${cards}
  </div>
  <footer><img src="dizayn17-logo.png" alt="Dizayn17"></footer>
</body></html>
`);
console.log('✓ Şirket seçim sayfası -> dist-web/index.html');
