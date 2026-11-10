'use strict';

/**
 * Downloads the restaurant cover photos used by the demo into
 * public/img/restaurants/ and writes attribution to docs/image-credits.md.
 *
 * Source: Wikimedia Commons (freely licensed; see the credits file).
 * Usage: node scripts/fetch-food-images.js
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'public', 'img', 'restaurants');
const CREDITS_FILE = path.join(__dirname, '..', 'docs', 'image-credits.md');
const USER_AGENT = 'FoodExpressDemo/1.0 (BCA group assignment; contact: demo@example.com)';

const PICKS = [
  { slug: 'spice-route', restaurant: 'Spice Route', cuisine: 'North Indian', file: 'Chicken makhani.jpg' },
  { slug: 'dosa-junction', restaurant: 'Dosa Junction', cuisine: 'South Indian', file: 'Masala Dosa in Banana Leaf with Chutney.jpg' },
  { slug: 'wok-and-roll', restaurant: 'Wok & Roll', cuisine: 'Chinese', file: 'Char Kway Teow in Hong Kong.jpg' },
  { slug: 'bella-napoli', restaurant: 'Bella Napoli', cuisine: 'Italian', file: 'Margherita Originale.JPG' },
  { slug: 'biryani-bazaar', restaurant: 'Biryani Bazaar', cuisine: 'Biryani', file: 'Chicken Hyderabadi Biryani.JPG' },
  { slug: 'green-bowl', restaurant: 'Green Bowl', cuisine: 'Healthy', file: 'Quinoa Salad (5045982815).jpg' },
  { slug: 'burger-barn', restaurant: 'Burger Barn', cuisine: 'Fast Food', file: 'Cheeseburger and fries 2.jpg' },
  { slug: 'sweet-tooth', restaurant: 'Sweet Tooth', cuisine: 'Desserts', file: 'Piece of chocolate cake on a white plate decorated with chocolate sauce.jpg' }
];

function stripHtml(value) {
  return String(value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(CREDITS_FILE), { recursive: true });

  const credits = [
    '# Food photo credits',
    '',
    'The restaurant cover photos in `public/img/restaurants/` were downloaded from',
    '[Wikimedia Commons](https://commons.wikimedia.org/) for this educational demo.',
    'Each image remains under the licence chosen by its author.',
    ''
  ];

  for (const pick of PICKS) {
    const api = 'https://commons.wikimedia.org/w/api.php?action=query&format=json' +
      '&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1200' +
      '&titles=' + encodeURIComponent('File:' + pick.file);

    const metaRes = await fetch(api, { headers: { 'User-Agent': USER_AGENT } });
    if (!metaRes.ok) throw new Error(`Commons API failed (${metaRes.status}) for ${pick.file}`);

    const json = await metaRes.json();
    const page = Object.values(json.query.pages)[0];
    if (!page || !page.imageinfo) throw new Error(`No image info for ${pick.file}`);

    const info = page.imageinfo[0];
    const imageRes = await fetch(info.thumburl || info.url, { headers: { 'User-Agent': USER_AGENT } });
    if (!imageRes.ok) throw new Error(`Download failed (${imageRes.status}) for ${pick.file}`);

    const buffer = Buffer.from(await imageRes.arrayBuffer());
    fs.writeFileSync(path.join(OUT_DIR, pick.slug + '.jpg'), buffer);

    const meta = info.extmetadata || {};
    credits.push(
      `## ${pick.restaurant} — ${pick.cuisine}`,
      '',
      `- File: [${pick.file}](${info.descriptionurl})`,
      `- Author: ${stripHtml(meta.Artist && meta.Artist.value) || 'See file page'}`,
      `- Licence: ${stripHtml(meta.LicenseShortName && meta.LicenseShortName.value) || 'See file page'}`,
      `- Local copy: \`public/img/restaurants/${pick.slug}.jpg\``,
      ''
    );

    console.log(`✓ ${pick.slug}.jpg (${(buffer.length / 1024).toFixed(0)} KB) ← ${pick.file}`);
  }

  fs.writeFileSync(CREDITS_FILE, credits.join('\n'));
  console.log('\nCredits written to docs/image-credits.md');
}

main().catch((err) => {
  console.error('Image download failed:', err.message);
  process.exit(1);
});
