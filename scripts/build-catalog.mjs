import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const argumentIndex = process.argv.indexOf('--base-url');
const baseUrlValue = argumentIndex >= 0 ? process.argv[argumentIndex + 1] : undefined;
if (!baseUrlValue) throw new Error('Usage: npm run catalog -- --base-url https://public.example/anatomy/');
const baseUrl = new URL(baseUrlValue.endsWith('/') ? baseUrlValue : `${baseUrlValue}/`);
if (baseUrl.protocol !== 'https:') throw new Error('--base-url must use public HTTPS.');
const release = JSON.parse(await readFile(join(projectRoot, 'artifacts/modular-anatomy/release.json'), 'utf8'));
const catalog = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  packages: [{
    manifest: release.manifest,
    category: 'misc',
    artifact: {
      url: new URL(`modular-anatomy-${release.version}.zip`, baseUrl).href,
      sha256: release.sha256,
      bytes: release.bytes,
    },
  }],
  provenance: { kind: 'custom', url: baseUrl.href },
};
const output = join(projectRoot, 'artifacts/modular-anatomy/catalog.json');
await writeFile(output, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(JSON.stringify({ output, catalog }, null, 2));
