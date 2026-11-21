'use strict';
// Kullanım: node scripts/apply-brand.js <marka>
// app/ klasörüne seçilen markanın logo ve Supabase ayarlarını yerleştirir
// (masaüstü derlemesi ve yerelde deneme için). Ör: node scripts/apply-brand.js dardanel
const path = require('path');
const { ROOT, readBrand, copyBrandFiles, listBrands } = require('./brand-utils');
const id = process.argv[2];
if (!id) { console.error('Marka belirtin: ' + listBrands().join(' | ')); process.exit(1); }
const b = readBrand(id);
copyBrandFiles(id, path.join(ROOT, 'app'));
console.log('app/ klasörü "' + b.name + '" markasına ayarlandı.');
