// Package only the tested standalone program and a root entry for GitHub Pages.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function preparePages({root = projectRoot, source = path.join(root, 'ai-navigator.html'), out = path.join(root, 'local', 'pages')} = {}) {
  root = path.resolve(root); source = path.resolve(source); out = path.resolve(out);
  if (!source.startsWith(root + path.sep) || !out.startsWith(path.join(root, 'local') + path.sep)) throw new Error('Pages paths must stay inside the project, with output in local/');
  const html = await fs.readFile(source);
  if (!html.includes('id="catalog-data"') || !html.includes('id="asset-provenance"')) throw new Error('Build ai-navigator.html before preparing Pages');
  await fs.mkdir(out, {recursive: true});
  if ((await fs.realpath(out)) !== out || (await fs.realpath(source)) !== source) throw new Error('Pages paths must not be symbolic links');
  const files = ['ai-navigator.html', 'index.html'];
  for (const name of await fs.readdir(out)) if (!files.includes(name)) throw new Error('Unexpected file in Pages output: ' + name);
  for (const name of files) {const stat = await fs.lstat(path.join(out,name)).catch(error=>{if(error.code!=='ENOENT')throw error;return null;});if(stat&&!stat.isFile())throw new Error('Pages output must contain regular files');}
  const redirect = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ИИ-навигатор</title>
  <script>
    const target = new URL('ai-navigator.html', location.href);
    target.search = location.search;
    target.hash = location.hash;
    location.replace(target.href);
  </script>
</head>
<body><p><a href="ai-navigator.html">Открыть ИИ-навигатор</a></p></body>
</html>
`;
  await fs.writeFile(path.join(out,'ai-navigator.html'),html);
  await fs.writeFile(path.join(out,'index.html'),redirect,'utf8');
  return {directory:path.relative(root,out).split(path.sep).join('/'),files};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await preparePages()));
