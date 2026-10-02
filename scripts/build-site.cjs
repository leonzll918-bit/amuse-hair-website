const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
// Explicit public asset list: add new website files here when introducing them.
const files = [
  'index.html', 'amuse-logo.svg', 'styles.css', 'script.js', 'sitemap.xml',
  'about/index.html', 'contact/index.html',
  'gallery/index.html', 'gallery/gallery.js',
  'services/index.html', 'services/hair-colour/index.html',
  'services/hair-colour/hair-colour.css',
  'zh/index.html', 'zh/about/index.html', 'zh/contact/index.html',
  'zh/gallery/index.html', 'zh/services/index.html',
  'zh/services/hair-colour/index.html',
];

// Validate before writing. Never follow symlinks into development resources.
function assertRegularTree(target) {
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink()) throw new Error(`Symlink is not allowed: ${target}`);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target)) assertRegularTree(path.join(target, entry));
  } else if (!stat.isFile()) {
    throw new Error(`Not a regular file: ${target}`);
  }
}
for (const file of files) {
  const source = path.join(root, file);
  for (let current = source; current !== root; current = path.dirname(current)) {
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Symlink is not allowed: ${current}`);
  }
  if (!fs.statSync(source).isFile()) throw new Error(`Missing public file: ${file}`);
}
if (fs.existsSync(output)) {
  assertRegularTree(output);
  if (fs.realpathSync(output) !== output) throw new Error('Output must be the repository dist directory');
  fs.rmSync(output, { recursive: true });
}
fs.mkdirSync(output);
for (const file of files) {
  const target = path.join(output, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, file), target);
}
console.log(`Assembled ${files.length} public files in dist/`);
