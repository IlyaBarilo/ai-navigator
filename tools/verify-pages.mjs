// Exercise the real Pages package over HTTP under a repository subpath.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {preparePages} from './prepare-pages.mjs';
import {launchBrowser} from './browser.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const qa=path.join(root,'local','qa','pages');
await fs.mkdir(qa,{recursive:true});
const out=path.join(qa,'site');
await preparePages({root,out});
assert.deepEqual((await fs.readdir(out)).sort(),['ai-navigator.html','index.html']);
assert.deepEqual(await fs.readFile(path.join(out,'ai-navigator.html')),await fs.readFile(path.join(root,'ai-navigator.html')));
assert(!await fs.stat(path.join(root,'index.html')).then(()=>true,()=>false),'The project output must be ai-navigator.html');
const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const name=pathname==='/ai-navigator/'||pathname==='/ai-navigator/index.html'?'index.html':pathname==='/ai-navigator/ai-navigator.html'?'ai-navigator.html':null;
  if(!name){res.writeHead(404);res.end();return;}
  try{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(await fs.readFile(path.join(out,name)));}catch{res.writeHead(500);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port,base=origin+'/ai-navigator/';
let browser;const errors=[],requests=[],cases=[];
try{
  browser=await launchBrowser(root);
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));p.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  const query='?source=pages&check=%D1%82%D0%B5%D1%81%D1%82';
  for(const [entry,hash,mode]of [['','','simple'],['index.html','#view=catalog&types=music','catalog'],['','#first-request','first'],['','#view=simple&q='+encodeURIComponent('план занятия по физике'),'simple'],['ai-navigator.html','#view=expert','catalog']]){
    await p.goto(base+entry+query+hash);
    await p.waitForURL(url=>url.pathname==='/ai-navigator/ai-navigator.html');
    assert.equal(new URL(p.url()).search,query);assert.equal(new URL(p.url()).hash,hash);
    assert.equal(await p.locator('body').getAttribute('data-workspace'),mode);
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    cases.push({entry:entry||'/',hash,mode});
  }
  for(const [entry,search,hash,mode]of [['','?view=first','','first'],['ai-navigator.html','?view=first','','first'],['','?view=first','#view=expert','catalog'],['','?view=first','#view=simple','simple'],['','?view=unknown','','simple']]){
    await p.goto(base+entry+search+hash);
    await p.waitForURL(url=>url.pathname.endsWith('/ai-navigator.html'));
    assert.equal(new URL(p.url()).search,search);
    assert.equal(await p.locator('body').getAttribute('data-workspace'),mode);
    cases.push({entry:entry||'/',search,hash,mode});
  }
  const offline=await browser.newContext({offline:true}),local=await offline.newPage();
  local.on('pageerror',e=>errors.push(String(e)));
  await local.goto(pathToFileURL(path.join(root,'ai-navigator.html')).href+'?view=first');
  assert.equal(await local.locator('body').getAttribute('data-workspace'),'first');
  assert(await local.locator('[data-first-step="1"]').isVisible());
  await offline.close();
  await p.goto(base+'#view=simple&q='+encodeURIComponent('план занятия по физике'));
  await p.waitForURL(url=>url.pathname.endsWith('/ai-navigator.html'));
  assert((await p.locator('[data-simple-tool]').count())>0);
  await p.screenshot({path:path.join(qa,'mobile.png')});
  await p.locator('#theme-toggle').click();
  await p.locator('#legal-open').click();
  await p.locator('.legal-notices summary').first().click();
  assert(await p.locator('[data-legal-document="LICENSE"]').isVisible());
  await p.locator('#legal-dialog').press('Escape');
  assert(await p.locator('#legal-open').evaluate(e=>document.activeElement===e));
  await p.setViewportSize({width:1920,height:1080});
  await p.screenshot({path:path.join(qa,'desktop-dark.png')});
  const noJs=await browser.newContext({javaScriptEnabled:false}),fallback=await noJs.newPage();
  await fallback.goto(base);assert.equal(await fallback.locator('a').getAttribute('href'),'ai-navigator.html');
  assert.deepEqual(errors,[]);
  assert(requests.every(url=>{const u=new URL(url);return u.origin===origin&&['/ai-navigator/','/ai-navigator/index.html','/ai-navigator/ai-navigator.html'].includes(u.pathname);}),JSON.stringify(requests));
}finally{
  await browser?.close();await new Promise(resolve=>server.close(resolve));
}
const report={status:'passed',checks:['Pages contains exactly the named standalone HTML and root redirect','Pages program is byte-identical to the local build','Root and explicit entry preserve query and hash under a repository subpath','Simple, expert and training links select their intended modes','No runtime asset or external network requests','Named entry, mobile layout, offline license UI and fallback link work'],cases,pageErrors:errors};
await fs.writeFile(path.join(root,'local/qa/pages-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,checks:report.checks.length}));
