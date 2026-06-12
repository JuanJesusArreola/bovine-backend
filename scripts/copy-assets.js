const fs = require('fs');
const path = require('path');

const assets = [
  {
    from: path.join(__dirname, '..', 'src', 'templates'),
    to: path.join(__dirname, '..', 'dist', 'templates'),
  },
];

for (const asset of assets) {
  if (!fs.existsSync(asset.from)) {
    continue;
  }

  fs.cpSync(asset.from, asset.to, { recursive: true });
  console.log(`Copied assets: ${path.relative(process.cwd(), asset.from)} -> ${path.relative(process.cwd(), asset.to)}`);
}
