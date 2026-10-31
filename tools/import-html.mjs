// Original helper originally authored for this project. Imports only JSON; HTML scripts are never executed.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const input=path.resolve(process.argv[2]||path.join(root,'ai-navigator.html'));
const html=await fs.readFile(input,'utf8');
const match=html.match(/<script(?=[^>]*\bid=["']catalog-data["'])[^>]*>([\s\S]*?)<\/script\s*>/i);
if(!match)throw Error('Не найден блок catalog-data.');
const d=JSON.parse(match[1]);
if(!Array.isArray(d.tools)||!Array.isArray(d.categories)||!Array.isArray(d.groups)||!d.sources)throw Error('Неверная структура справочника.');
const ids=new Set(),functions=new Set();
for(const t of d.tools){
 if(!t.id||ids.has(t.id)||!t.name||!Array.isArray(t.functions))throw Error('Проверьте id, name и functions инструмента.');ids.add(t.id);
 for(const f of t.functions){if(!f.id||functions.has(f.id)||!d.categories.some(x=>x.id===f.category)||!['free','limited','paid','local'].includes(f.mode))throw Error('Проверьте id, category и mode возможности.');functions.add(f.id);}
}
const output=path.join(root,'src/catalog.json');
await fs.writeFile(output,JSON.stringify(d,null,2)+'\n','utf8');
console.log('Ручные изменения импортированы в src/catalog.json: '+ids.size+' инструментов, '+functions.size+' возможностей.');
