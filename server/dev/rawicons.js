const fs = require('fs');
const path = require('path');

function rawicons(fileName) {
  const src = fileName && fileName.src;
  if (!src) return '';
  const dir = path.resolve(process.cwd(), 'app/api/icons');
  const target = path.resolve(dir, src);
  if (!target.startsWith(`${dir}${path.sep}`) || !fs.existsSync(target) || !fs.statSync(target).isFile()) return '';
  const content = fs.readFileSync(target, 'utf8');
  return content.toString();
}

module.exports = rawicons;
