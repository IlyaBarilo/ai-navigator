// Original build code originally authored for this project. Node.js standard library only.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {releaseVersion} from './release-version.mjs';
import {expandSource} from './source-bundle.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),src=path.join(root,'src');
const read=async f=>(await fs.readFile(path.join(src,f),'utf8')).replace(/^\uFEFF/,'');
const [templateSource,styleSource,applicationSource]=await Promise.all(['template.html','style.css','app.js'].map(name=>expandSource(src,name)));
const template=templateSource.code,baseCss=styleSource.code,js=applicationSource.code;
const [bg,sprite,raw,appearance]=await Promise.all(['background.svg','icons.svg','catalog.json','appearance.css'].map(read));
const tag=process.env.AI_NAVIGATOR_RELEASE_TAG||'',version=releaseVersion(tag);
const brand=await read('brand.svg'),geometry=brand.match(/<g\b[^>]*>([\s\S]*?)<\/g>/)?.[1];
if(!geometry)throw Error('Missing brand geometry');
const completeSprite=sprite.replace('__BRAND_SYMBOL__','<symbol id="icon-mark" viewBox="0 0 24 24"><desc>Фирменный знак проекта; отдельное разрешение по BRANDING.md.</desc>'+geometry+'</symbol>');
const legalFiles=['LICENSE','NOTICE.md','BRANDING.md','EDUCATIONAL-MATERIALS.md'];
const legal=await Promise.all(legalFiles.map(async name=>({name,text:(await fs.readFile(path.join(root,name),'utf8')).replace(/\r\n/g,'\n')})));
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const legalHtml='<section class="legal-notices" aria-labelledby="legal-title"><h3 id="legal-title">Лицензии и название</h3><p>Код и обычные значки — MIT. Учебные примеры, название и фирменная графика требуют отдельного разрешения автора, в том числе для распространения копий с ними.</p>'+legal.map(item=>'<details><summary>'+({'LICENSE':'Полный текст MIT','NOTICE.md':'Область лицензий и состав поставки','BRANDING.md':'Название и фирменная графика','EDUCATIONAL-MATERIALS.md':'Учебные примеры'}[item.name])+'</summary><pre data-legal-document="'+item.name+'">'+escape(item.text)+'</pre></details>').join('')+'</section>';
const releaseInfo=version?'<p id="release-info" class="release-info">Версия <span>'+escape(version)+'</span> · <a href="https://github.com/IlyaBarilo/ai-navigator/releases/tag/'+tag+'" target="_blank" rel="noopener noreferrer">Выпуск</a></p>':'';
const css=baseCss+'\n'+appearance;
const data=JSON.parse(raw),functions=data.tools.flatMap(t=>t.functions);
if(new Set(data.tools.map(x=>x.id)).size!==data.tools.length)throw Error('Duplicate tool');
for(const t of data.tools)if(t.entityType&&!['service','application','agent'].includes(t.entityType))throw Error('Tool cards must describe services, applications or agents, not downloadable models: '+t.id);
for(const t of data.tools)if(t.entityType==='service'&&t.functions.some(f=>f.mode==='local'))throw Error('Put local software in an application card, not model weights under an online service: '+t.id);
if(new Set(functions.map(x=>x.id)).size!==functions.length)throw Error('Duplicate capability');
for(const f of functions){if(!data.categories.some(x=>x.id===f.category)||!['free','limited','paid','local'].includes(f.mode)||!data.regions[f.region])throw Error('Invalid category, group or region '+f.id);for(const k of f.sources)if(!data.sources[k])throw Error('Missing source '+k);}
for(const f of functions){if(f.displayLabel!==undefined&&(typeof f.displayLabel!=='string'||!f.displayLabel.trim()))throw Error('Invalid capability displayLabel '+f.id);if(f.displayIcon!==undefined&&(!/^[a-z0-9-]+$/.test(f.displayIcon)||!completeSprite.includes('<symbol id="icon-'+f.displayIcon+'"')))throw Error('Unknown capability displayIcon '+f.id);}
for(const u of [...data.tools.map(x=>x.url),...functions.map(x=>x.url),...Object.values(data.sources).map(x=>x.url)])if(!/^https:\/\//.test(u))throw Error('Invalid external reference');
const taskIDs=new Set(),promptCodes=new Set();
const taskGroupIDs=new Set(['general','teaching']);
if(data.taskGroups){
 if(!Array.isArray(data.taskGroups))throw Error('Invalid taskGroups');
 taskGroupIDs.clear();for(const g of data.taskGroups){if(!/^[a-z0-9-]+$/.test(g.id)||!g.name||taskGroupIDs.has(g.id))throw Error('Invalid task group');taskGroupIDs.add(g.id);}
}
for(const task of data.tasks||[]){
 if(!/^[a-z0-9-]+$/.test(task.id)||taskIDs.has(task.id)||!task.name||!/^[a-z0-9-]+$/.test(task.icon))throw Error('Invalid task '+task.id);taskIDs.add(task.id);
 if(task.group&&!taskGroupIDs.has(task.group))throw Error('Invalid task group '+task.id);
 for(const c of [...(task.rule?.anyCategories||[]),...(task.rule?.allCategories||[])])if(!data.categories.some(x=>x.id===c))throw Error('Invalid task category '+task.id);
 if(!Array.isArray(task.prompts)||!task.prompts.length)throw Error('Missing examples '+task.id);
 if(task.searchAliases&&(!Array.isArray(task.searchAliases)||task.searchAliases.some(x=>typeof x!=='string')))throw Error('Invalid search aliases '+task.id);
  const examples=new Set();for(const p of task.prompts){if(!/^[a-z0-9-]+$/.test(p.id)||examples.has(p.id)||typeof p.text!=='string'||!p.text.trim())throw Error('Invalid prompt '+task.id);examples.add(p.id);if(!/^P[0-9]{3,}$/.test(p.code)||promptCodes.has(p.code)||!Number.isSafeInteger(p.revision)||p.revision<1)throw Error('Invalid or duplicate prompt code/revision '+task.id+'/'+p.id);promptCodes.add(p.code);}
}
for(const f of functions)for(const key of ['forTasks','excludeTasks'])if(f[key]&&(!Array.isArray(f[key])||f[key].some(id=>!taskIDs.has(id))))throw Error('Invalid capability task scope '+f.id);
if(data.queryExamples){
 if(!Array.isArray(data.queryExamples))throw Error('Invalid thematic query examples');
 const groups=new Set(),examples=new Set();
 for(const g of data.queryExamples){if(!/^[a-z0-9-]+$/.test(g.id)||groups.has(g.id)||typeof g.name!=='string'||!g.name.trim()||!Array.isArray(g.examples)||!g.examples.length)throw Error('Invalid query example group');groups.add(g.id);
  for(const e of g.examples){if(!/^[a-z0-9-]+$/.test(e.id)||examples.has(e.id)||!taskIDs.has(e.taskId)||typeof e.query!=='string'||!e.query.trim()||e.query.length>200)throw Error('Invalid query example '+e.id);examples.add(e.id);}
 }
}
if(data.search){
 if(!Array.isArray(data.search.synonymGroups)||!Array.isArray(data.search.stopWords)||data.search.stopWords.some(x=>typeof x!=='string'))throw Error('Invalid search dictionary');
 for(const g of data.search.synonymGroups)if(typeof g.canonical!=='string'||!g.canonical.trim()||!Array.isArray(g.words)||!Array.isArray(g.prefixes)||[...g.words,...g.prefixes].some(x=>typeof x!=='string'||!x.trim()))throw Error('Invalid synonym group');
}
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const icons=[...completeSprite.matchAll(/<symbol id="([^"]+)"/g)].map(x=>({id:x[1],origin:'original SVG geometry',license:x[1]==='icon-mark'?'separate permission: BRANDING.md':'MIT',thirdPartyAssets:false}));
const provenance={
 purpose:'Inspectable resource origin and hashes; descriptive provenance, not a legal warranty.',
 author:data.author.name,
  visuals:[{id:'mobile-cursor-guide',origin:'original mirrored CSS robot and HTML speech bubble',license:'MIT',thirdPartyAssets:false},{id:'first-request-chat-schematic',origin:'original educational HTML/CSS schematic',thirdPartyAssets:false},{id:'catalog-backdrop',origin:'original procedural SVG background',embeddedAs:'inline SVG',sha256:sha(bg),thirdPartyAssets:false},{id:'project-favicon',origin:'project brand SVG',embeddedAs:'data URI',sha256:sha(brand),license:'separate permission: BRANDING.md',thirdPartyAssets:false},...icons],
 styles:{appearance:'Fixed Contrast Grid with a procedural CSS background',sourceFiles:[...styleSource.sourceFiles,'appearance.css'],origin:'original CSS',thirdPartyFrameworks:[],sha256:sha(css)},
 application:{origin:'original HTML and JavaScript',sourceFiles:applicationSource.sourceFiles,templateFiles:templateSource.sourceFiles,thirdPartyLibraries:[],javascriptSha256:sha(js),templateSha256:sha(template)},
 fonts:{origin:'operating system font stack',embeddedFontFiles:[],redistributedFonts:false},
 data:{origin:'author-selected reference catalog and editorial ratings',names:'Third-party service names identify their respective providers. No vendor logos are included.',sources:'Official source links are preserved per capability.',promptExamples:'Original educational product examples; separate permission: EDUCATIONAL-MATERIALS.md.'},
 rasterImages:[],externalRuntimeResources:[],licenses:legal.map(item=>({file:item.name,sha256:sha(item.text)})),license:'MIT for code and ordinary icons; project name, branding and educational examples require separate permission.',...(version?{release:{tag,version}}:{})
};
const json=(x,space)=>JSON.stringify(x,null,space).replaceAll('<','\\u003c');
let html=template;
for(const [name,value]of Object.entries({CSS:css,SPRITE:completeSprite,BACKGROUND:bg,DATA:json(data,2),PROVENANCE:json(provenance),JS:js,FAVICON:'<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,'+encodeURIComponent(brand)+'">',LEGAL:legalHtml,RELEASE_INFO:releaseInfo}))html=html.replace('__'+name+'__',()=>value);
if(/__(?:CSS|SPRITE|BACKGROUND|DATA|PROVENANCE|JS|FAVICON|LEGAL|RELEASE_INFO|BRAND_SYMBOL)__/.test(html))throw Error('Unresolved template token');
if(/<img\b|<image\b|<script\b[^>]*\bsrc\s*=|<link\b[^>]*rel=["']stylesheet/i.test(html))throw Error('Unexpected asset or external dependency');
if(/@import|url\s*\(/i.test(css))throw Error('External CSS resource');
const output=process.env.AI_NAVIGATOR_BUILD_OUTPUT?path.resolve(root,process.env.AI_NAVIGATOR_BUILD_OUTPUT):path.join(root,'ai-navigator.html');
if(!output.startsWith(root+path.sep))throw Error('Build output must remain inside project');
await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,html,'utf8');
console.log(JSON.stringify({tools:data.tools.length,capabilities:functions.length,bytes:Buffer.byteLength(html),rasterImages:0,thirdPartyLibraries:0,svgIcons:icons.length}));
