// Check the distribution contract, version formats, licenses and private-path boundary.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {execFileSync,spawnSync} from 'node:child_process';import {fileURLToPath,pathToFileURL} from 'node:url';import {releaseVersion} from './release-version.mjs';import {checkPublicFiles,isPrivatePath} from './check-public-files.mjs';import {launchBrowser} from './browser.mjs';
import {prepareRelease} from './prepare-release.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),qa=path.join(root,'local','qa','delivery');await fs.mkdir(qa,{recursive:true});
const manifest=JSON.parse(await fs.readFile(path.join(root,'PUBLIC-FILES.json'),'utf8'));
await checkPublicFiles(root);
for(const name of ['AGENTS.md','.gitignore','local/a.json','docs/AGENTS.md','docs/.gitignore','src/local/data.json','Local/a.txt'])assert(isPrivatePath(name),name);
assert(!manifest.files.includes('ai-navigator.html'));assert.equal(manifest.buildOutput,'ai-navigator.html');
const fixture=await fs.mkdtemp(path.join(qa,'boundary-'));
for(const name of ['AGENTS.md','docs/.gitignore','docs/local/notes.md']){await fs.writeFile(path.join(fixture,'PUBLIC-FILES.json'),JSON.stringify({files:[name]}));await assert.rejects(()=>checkPublicFiles(fixture),/Private path/);}
for(const name of ['ai-navigator.html','index.html']){await fs.writeFile(path.join(fixture,'PUBLIC-FILES.json'),JSON.stringify({files:[name]}));await assert.rejects(()=>checkPublicFiles(fixture),/Generated HTML/);}
for(const tag of ['v1','v0.1','v0.1.0','v0.1.2.3'])assert.equal(releaseVersion(tag),tag.slice(1));
for(const tag of ['v1\n','1','v1.2.3.4.5','v1-beta',' v1','v1.','v1;echo'])assert.throws(()=>releaseVersion(tag));
const originals=new Map();for(const name of ['LICENSE','NOTICE.md','BRANDING.md','EDUCATIONAL-MATERIALS.md'])originals.set(name,(await fs.readFile(path.join(root,name),'utf8')).replace(/\r\n/g,'\n'));
const current=await fs.readFile(path.join(root,'ai-navigator.html'),'utf8');
const data=JSON.parse(current.match(/<script[^>]*id="catalog-data"[^>]*>([\s\S]*?)<\/script\s*>/i)[1]);assert.deepEqual(data,JSON.parse(await fs.readFile(path.join(root,'src/catalog.json'),'utf8')));
const browser=await launchBrowser(root);const errors=[],requests=[];
try{
 const context=await browser.newContext({offline:true,viewport:{width:390,height:844}}),p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));p.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 for(const tag of ['', 'v1','v0.1','v0.1.0','v0.1.2.3']){
  const output=path.join(qa,(tag||'plain')+'.html');execFileSync(process.execPath,[path.join(root,'tools/build.mjs')],{cwd:root,env:{...process.env,AI_NAVIGATOR_RELEASE_TAG:tag,AI_NAVIGATOR_BUILD_OUTPUT:output},stdio:'pipe'});
  await p.goto(pathToFileURL(output).href);assert.equal(await p.locator('body').getAttribute('data-workspace'),'steps');
  assert.equal(await p.locator('#release-info').count(),tag?1:0);if(tag)assert.equal(await p.locator('#release-info span').textContent(),tag.slice(1));
  if(tag){const out=path.join(qa,tag+'-assets'),pack=await prepareRelease({root,tag,source:output,out});assert.deepEqual(pack.files,['ai-navigator.html','ai-navigator-'+tag.slice(1)+'.html','SHA256SUMS.txt']);for(const name of pack.files.filter(n=>n.endsWith('.html')))assert.deepEqual(await fs.readFile(path.join(out,name)),await fs.readFile(output));assert.equal((await fs.readFile(path.join(out,'SHA256SUMS.txt'),'utf8')).trim().split('\n').length,2);await assert.rejects(()=>prepareRelease({root,tag:'v9999',source:output,out}),/does not match/);}
  for(const [name,text] of originals)assert.equal(await p.locator(`[data-legal-document="${name}"]`).textContent(),text);
  const favicon=await p.locator('link[rel="icon"]').getAttribute('href');assert(favicon.startsWith('data:image/svg+xml,'));assert(decodeURIComponent(favicon.split(',').slice(1).join(',')).includes('viewBox="0 0 32 32"'));
  assert(await p.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();return image.naturalWidth>0;},favicon));
  await p.locator('#legal-open').click();await p.locator('.legal-notices summary').first().click();assert(await p.locator('[data-legal-document="LICENSE"]').isVisible());assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 const bad=spawnSync(process.execPath,[path.join(root,'tools/build.mjs')],{cwd:root,env:{...process.env,AI_NAVIGATOR_RELEASE_TAG:'v1.2.3.4.5',AI_NAVIGATOR_BUILD_OUTPUT:path.join(qa,'invalid.html')}});assert.notEqual(bad.status,0);
 assert.equal(await fs.stat(path.join(qa,'invalid.html')).then(()=>true,()=>false),false);
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
}finally{await browser.close();}
const anchors=text=>new Set([...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map(m=>m[1].toLowerCase().replace(/[^\p{L}\p{N}_\- ]/gu,'').replace(/ /g,'-')));
for(const name of manifest.files.filter(n=>n.endsWith('.md'))){const text=await fs.readFile(path.join(root,name),'utf8');for(const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){const href=match[1];if(/^(https?:|mailto:)/.test(href))continue;const [file,anchor]=href.split('#');const target=file?path.resolve(root,path.dirname(name),file):path.join(root,name);assert(target.startsWith(root+path.sep));assert(await fs.stat(target).then(()=>true,()=>false),name+' -> '+href);if(anchor&&target.endsWith('.md'))assert(anchors(await fs.readFile(target,'utf8')).has(decodeURIComponent(anchor)),name+' -> '+href);}}
const report={status:'passed',checks:['Private paths rejected, including nested paths','Catalog edits preserved','Offline licenses match source documents','Local version hidden and four release tag forms retained','Invalid tag rejected before output','Embedded SVG favicon decodes without network','Public Markdown links and anchors resolve'],pageErrors:errors,networkRequests:requests.length,htmlSha256:crypto.createHash('sha256').update(current).digest('hex')};
await fs.writeFile(path.join(root,'local/qa/delivery-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'passed',checks:report.checks.length}));
