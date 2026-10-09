import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { build } from 'esbuild';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'));
const engineRoot = resolve(projectRoot, process.env.MARINARA_ENGINE_PATH ?? '../../games/Marinara-Engine');
const enginePackage = JSON.parse(await readFile(join(engineRoot, 'package.json'), 'utf8'));
const engineCommit = execFileSync('git', ['-C', engineRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const version = packageJson.version;
const staging = join(projectRoot, '.package-build', 'modular-anatomy');
const artifacts = join(projectRoot, 'artifacts', 'modular-anatomy');

await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
await mkdir(artifacts, { recursive: true });

await build({
  absWorkingDir: projectRoot,
  entryPoints: ['src/marinara/server.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  outfile: join(staging, 'server.mjs'),
  minify: false,
  sourcemap: false,
});
await build({
  absWorkingDir: projectRoot,
  entryPoints: ['src/marinara/client.ts'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2023',
  outfile: join(staging, 'client.js'),
  minify: false,
  sourcemap: false,
});
await writeFile(join(staging, 'agents.json'), await readFile(join(projectRoot, 'packages/modular-anatomy/agents.json')));

const fileNames = ['server.mjs', 'client.js', 'agents.json'];
const files = [];
for (const fileName of fileNames) {
  const bytes = await readFile(join(staging, fileName));
  files.push({ path: fileName, sha256: sha256(bytes), bytes: bytes.byteLength });
}
const manifest = {
  schemaVersion: 2,
  id: 'modular-anatomy',
  name: 'Modular Anatomy',
  version,
  description: 'Deterministic persistent anatomy state and authored physical effects for active Marinara Games.',
  capabilityApi: { major: 1, minor: 66 },
  builtAgainst: { engineVersion: enginePackage.version, engineCommit },
  engine: { min: '2.5.0', maxExclusive: '2.6.0' },
  kind: ['agent'],
  entrypoints: { server: 'server.mjs', client: 'client.js', agents: 'agents.json' },
  contributions: { agentDetail: { agentIds: ['modular-anatomy'] } },
  files,
  permissions: ['agent-runtime', 'chat-read', 'storage', 'tools', 'prompt-context', 'routes', 'ui'],
  restartRequired: true,
};
await writeFile(join(staging, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const archivePath = join(artifacts, `modular-anatomy-${version}.zip`);
const zip = new AdmZip();
zip.addFile('manifest.json', await readFile(join(staging, 'manifest.json')));
for (const fileName of fileNames) zip.addFile(fileName, await readFile(join(staging, fileName)));
zip.writeZip(archivePath);
const archiveBytes = await readFile(archivePath);
const release = {
  id: manifest.id,
  version,
  archive: archivePath,
  sha256: sha256(archiveBytes),
  bytes: archiveBytes.byteLength,
  manifest,
};
await writeFile(join(artifacts, 'release.json'), `${JSON.stringify(release, null, 2)}\n`);
console.log(JSON.stringify(release, null, 2));

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
