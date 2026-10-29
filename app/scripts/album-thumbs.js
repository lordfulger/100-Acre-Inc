// Makes the small album pictures (assets/album/<id>.png, 240×288) from the full
// card pictures in assets/portraits/cards/. Only makes ones that are missing,
// unless you name cards: `node scripts/album-thumbs.js sticks drip`.
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const W = 240;
const H = 288;
const cards = path.join(__dirname, '..', 'assets', 'portraits', 'cards');
const album = path.join(__dirname, '..', 'assets', 'album');

/** Shrinks by averaging every source pixel that falls inside each new pixel. */
function shrink(src) {
  const out = new PNG({ width: W, height: H });
  const sx = src.width / W;
  const sy = src.height / H;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const acc = [0, 0, 0, 0];
      let n = 0;
      for (let yy = Math.floor(y * sy); yy < Math.min(src.height, Math.ceil((y + 1) * sy)); yy++) {
        for (let xx = Math.floor(x * sx); xx < Math.min(src.width, Math.ceil((x + 1) * sx)); xx++) {
          const i = (yy * src.width + xx) * 4;
          for (let c = 0; c < 4; c++) acc[c] += src.data[i + c];
          n++;
        }
      }
      const o = (y * W + x) * 4;
      for (let c = 0; c < 4; c++) out.data[o + c] = Math.round(acc[c] / n);
    }
  }
  return out;
}

const named = process.argv.slice(2);
const ids = named.length ? named : fs.readdirSync(cards).filter((f) => f.endsWith('.png')).map((f) => path.parse(f).name)
  .filter((id) => !fs.existsSync(path.join(album, `${id}.png`)));
for (const id of ids) {
  const src = PNG.sync.read(fs.readFileSync(path.join(cards, `${id}.png`)));
  fs.writeFileSync(path.join(album, `${id}.png`), PNG.sync.write(shrink(src)));
  console.log(`album/${id}.png`);
}
if (!ids.length) console.log('Album pictures: all there already.');
