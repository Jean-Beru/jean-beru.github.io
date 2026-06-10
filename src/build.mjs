import { readFile, writeFile, copyFile, mkdir, readdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const exists = (p) => access(p).then(() => true, () => false);

const root = dirname(fileURLToPath(import.meta.url));
const publicDir = join(root, '..', 'public');

const escape = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function loadTalks() {
  const entries = await readdir(publicDir, { withFileTypes: true });
  const talks = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const { default: data } = await import(pathToFileURL(join(publicDir, entry.name, 'index.mjs')).href);
      const hasImage = await exists(join(publicDir, entry.name, 'index.png'));
      talks.push({ ...data, slug: entry.name, hasImage });
    } catch (err) {
      console.log(`Skipping ${entry.name}: ${err.message}`);
    }
  }

  return talks.sort((a, b) => b.slug.localeCompare(a.slug));
}

const talks = await loadTalks();

const talksHtml = talks
  .map((t) => {
    const img = t.hasImage
      ? `<a class="card-img-link" href="./${escape(t.slug)}/"><img class="card-img" src="./${escape(t.slug)}/index.png" alt="" loading="lazy" /></a>`
      : '';
    // description is trusted authored HTML (allows <br />), intentionally not escaped
    const desc = t.description ? `<p class="card-desc">${t.description}</p>` : '';
    const event = t.event
      ? t.eventUrl
        ? `<a class="card-event" href="${escape(t.eventUrl)}" target="_blank" rel="noopener">${escape(t.event)}</a>`
        : `<span class="card-event">${escape(t.event)}</span>`
      : '';
    return `
      <li class="card">${img}
        <div class="card-body">
          <a class="card-title" href="./${escape(t.slug)}/">${escape(t.title)}</a>${desc}${event}
        </div>
      </li>`;
  })
  .join('');

const template = await readFile(join(root, 'template.html'), 'utf8');
const html = template.replace('{{TALKS}}', () => talksHtml);

await mkdir(join(publicDir, 'assets'), { recursive: true });
await writeFile(join(publicDir, 'index.html'), html);
await copyFile(join(root, '..', 'assets', 'header.png'), join(publicDir, 'assets', 'header.png'));

console.log(`Generated ${join(publicDir, 'index.html')} with ${talks.length} talk(s)`);
