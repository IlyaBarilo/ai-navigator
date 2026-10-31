// Build-time includes. Source parts share the entry's scope; no runtime loader is shipped.
import fs from 'node:fs/promises';
import path from 'node:path';

export async function expandSource(sourceRoot, entry) {
  const sourceFiles = [], seen = new Set();
  async function read(name) {
    if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*\.(?:js|css|html)$/.test(name)) {
      throw new Error('Invalid source include: ' + name);
    }
    if (seen.has(name)) throw new Error('Repeated or cyclic source include: ' + name);
    seen.add(name);
    sourceFiles.push(name);
    const file = path.join(sourceRoot, name);
    const real = await fs.realpath(file);
    if (!real.startsWith(await fs.realpath(sourceRoot) + path.sep)) {
      throw new Error('Source include outside source directory: ' + name);
    }
    const text = (await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, '');
    const lines = [];
    for (const line of text.split('\n')) {
      const match = line.match(/^\s*(?:\/\/|\/\*|<!--) @include ([a-z0-9/.-]+)(?: \*\/| -->)?\s*$/);
      if (match) {
        if (path.extname(match[1]) !== path.extname(name)) throw new Error('Source include type mismatch');
        lines.push(await read(match[1]));
      } else {
        if (/^\s*(?:\/\/|\/\*|<!--) @include\b/.test(line)) throw new Error('Malformed source include');
        lines.push(line);
      }
    }
    return lines.join('\n');
  }
  const code = await read(entry);
  return { code, sourceFiles };
}
