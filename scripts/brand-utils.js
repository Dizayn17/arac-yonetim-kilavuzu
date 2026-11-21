'use strict';
// Ortak yardımcılar: marka listesini okur, marka dosyalarını bir klasöre kopyalar.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BRANDS_DIR = path.join(ROOT, 'brands');
const BRAND_FILES = ['brand.js', 'config.js'];

function listBrands() {
  return fs.readdirSync(BRANDS_DIR).filter(d => fs.existsSync(path.join(BRANDS_DIR, d, 'brand.json'))).sort();
}

function readBrand(id) {
  const dir = path.join(BRANDS_DIR, id);
  if (!fs.existsSync(path.join(dir, 'brand.json'))) throw new Error('Bilinmeyen marka: ' + id + ' (mevcut: ' + listBrands().join(', ') + ')');
  return { ...JSON.parse(fs.readFileSync(path.join(dir, 'brand.json'), 'utf8')), dir };
}

// Marka dosyalarını (brand.js, config.js, company-logo.*) hedef klasöre kopyalar
function copyBrandFiles(id, target) {
  const { dir } = readBrand(id);
  for (const f of fs.readdirSync(target)) if (/^company-logo\./.test(f)) fs.rmSync(path.join(target, f));
  for (const f of fs.readdirSync(dir)) {
    if (BRAND_FILES.includes(f) || /^company-logo\./.test(f)) fs.copyFileSync(path.join(dir, f), path.join(target, f));
  }
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

module.exports = { ROOT, listBrands, readBrand, copyBrandFiles, copyDir };
