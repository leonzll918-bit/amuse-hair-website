import { cp, mkdir, readdir, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = resolve(root, 'dist');
const websitePaths = ['index.html', 'styles.css', 'script.js', 'amuse-logo.svg',
  'sitemap.xml', 'about', 'contact', 'gallery', 'review', 'services', 'zh'];

// Only website assets enter the deployment. Never copy repository/server files.
// Remove stale files individually inside this fixed build directory.
async function removeStaleFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await removeStaleFiles(path);
    else await unlink(path);
  }
}

await mkdir(destination, { recursive: true });
await removeStaleFiles(destination);
for (const path of websitePaths) {
  const target = join(destination, path);
  await mkdir(dirname(target), { recursive: true });
  await cp(join(root, path), target, { recursive: true,
    filter: source => !source.split(/[\\/]/).at(-1).startsWith('.') });
}
console.log('Prepared website-only assets in dist/');
