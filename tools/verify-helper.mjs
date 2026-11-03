import {switchMode} from './workspace.mjs';
// Integration checks for the mobile guide, independent preferences and manual scrolling.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {launchBrowser} from './browser.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),qa=path.join(root,'local/qa/helper'),checks=[],errors=[],requests=[];
await fs.mkdir(qa,{recursive:true});
const browser=await launchBrowser(root),url=pathToFileURL(path.join(root,'ai-navigator.html')).href+'#view=simple';
const open=async(options={})=>{const c=await browser.newContext({offline:true,reducedMotion:'reduce',viewport:{width:390,height:844},...options});const p=await c.newPage();p.on('pageerror',e=>errors.push(String(e)));p.on('request',r=>{if(!r.url().startsWith('file:'))requests.push(r.url());});return {c,p};};
const settle=p=>p.waitForTimeout(100);
async function showGuide(p){await p.waitForFunction(()=>document.querySelector('#mobile-helper').dataset.waiting==='false',{},{timeout:5000});await settle(p);}
try{
 const {c,p}=await open();await p.goto(url);await settle(p);
 assert.equal(await p.locator('#helper-toggle').getAttribute('aria-pressed'),'false');assert(await p.locator('#mobile-helper').isHidden());
 await p.locator('#helper-toggle').click();await settle(p);await p.reload();await settle(p);
 assert.equal(await p.locator('#helper-toggle').getAttribute('aria-pressed'),'true');
 assert.equal(await p.locator('#mobile-helper').getAttribute('data-stage'),'input');
 assert((await p.locator('#helper-message').textContent()).includes('Введите текст'));
 const geometry=()=>p.evaluate(()=>['#simple-query','#simple-title-2','.simple-workspace'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return [r.top,r.height];}));
 const initialGeometry=await geometry();
 const placement=await p.evaluate(()=>{const input=document.querySelector('#simple-query').getBoundingClientRect(),guide=document.querySelector('#mobile-helper').getBoundingClientRect();return {inputTop:input.top,guideBottom:guide.bottom};});assert(placement.guideBottom<=placement.inputTop);assert.equal(await p.locator('.helper-pointer,#mobile-helper-slot').count(),0);assert(await p.locator('#mobile-helper .helper-robot').evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).a<0));
 await p.screenshot({path:path.join(qa,'input-390.png')});
 const dismissSize=await p.locator('#helper-dismiss').boundingBox();assert.equal(dismissSize.width,22);assert.equal(dismissSize.height,22);
 await p.locator('#helper-dismiss').click();assert.equal(await p.locator('#helper-toggle').getAttribute('aria-pressed'),'false');assert(await p.locator('#mobile-helper').isHidden());
 assert.deepEqual(await geometry(),initialGeometry,'floating helper must not reserve space or move the page');
 await p.locator('#theme-toggle').click();await p.locator('[data-simple-access="local"]').click();
 await p.reload();await settle(p);assert(await p.locator('#mobile-helper').isHidden());assert.equal(await p.locator('html').getAttribute('data-theme'),'dark');assert.equal(await p.locator('[data-simple-access="local"]').getAttribute('aria-pressed'),'true');assert.equal(await p.locator('[data-simple-access="free-online"]').getAttribute('aria-pressed'),'true');
 await p.locator('#helper-toggle').click();await settle(p);assert(await p.locator('#mobile-helper').isVisible());assert.equal(await p.locator('#helper-toggle').getAttribute('aria-pressed'),'true');
 checks.push('Hints default off; enabled/disabled choices persist; the small dismiss button syncs the header while theme/access survive reload independently');
 await p.locator('[data-simple-access="local"]').click();await p.locator('#simple-query').fill('Runway');await settle(p);assert.equal(await p.locator('#simple-results [data-simple-tool]').count(),0);assert.equal(await p.locator('#mobile-helper').getAttribute('data-stage'),'refine');assert((await p.locator('#helper-message').textContent()).includes('Дополните описание'));
 await p.waitForTimeout(1200);assert.equal(await p.locator('#mobile-helper').getAttribute('data-stage'),'refine');checks.push('No results retain the guide at the first step and ask for a fuller description');
 await p.locator('#simple-query').fill('план занятия по физике');await settle(p);assert.equal(await p.locator('#mobile-helper').getAttribute('data-stage'),'access');
 await p.locator('[data-simple-access="free-online"]').evaluate(e=>e.scrollIntoView({block:'center'}));await settle(p);await showGuide(p);
 await p.waitForFunction(()=>document.querySelector('#mobile-helper').dataset.stage==='results',{},{timeout:5000});
 await p.locator('#simple-title-3').evaluate(e=>e.scrollIntoView({block:'center'}));await settle(p);await showGuide(p);assert((await p.locator('#helper-message').textContent()).includes('Посмотрите результат'));
 await p.waitForFunction(()=>document.querySelector('#mobile-helper').dataset.stage==='training',{},{timeout:6000});await settle(p);
 await p.evaluate(()=>scrollTo(0,document.querySelector('#simple-learning').getBoundingClientRect().bottom+scrollY+24));await settle(p);
 const manualScroll=await p.evaluate(()=>scrollY);
 assert((await p.locator('#helper-message').textContent()).includes('ИИ-чатами'));assert((await p.locator('#helper-message').textContent()).includes('вверх'));assert.equal(await p.evaluate(()=>scrollY),manualScroll,'guide must wait for manual scrolling');
 await p.locator('#simple-learning button').evaluate(e=>e.scrollIntoView({block:'center'}));await settle(p);await showGuide(p);assert.equal(await p.locator('#mobile-helper').getAttribute('data-waiting'),'false');assert.equal(await p.locator('button[data-workspace="first"]:visible').count(),1);await p.screenshot({path:path.join(qa,'training-390.png')});await p.locator('#simple-learning button').click();assert.equal(await p.locator('body').getAttribute('data-workspace'),'first');assert(await p.locator('#mobile-helper').isHidden());checks.push('Manual scrolling leads through availability, results and a final training offer; the existing single training button opens it explicitly');
 await switchMode(p,'simple');await p.locator('#simple-query').fill('');
 for(const theme of ['light','dark']){if(await p.locator('html').getAttribute('data-theme')!==theme)await p.locator('#theme-toggle').click();for(const width of [390,320]){await p.setViewportSize({width,height:844});for(const scale of [100,120,150,50,75]){for(let i=0;i<5&&await p.locator('#text-size-label').textContent()!==scale+'%';i++)await p.locator('#text-size-toggle').click();await settle(p);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),theme+'/'+width+'/'+scale);const b=await p.locator('#mobile-helper').boundingBox();assert(b&&b.x>=0&&b.x+b.width<=width+1);const buttons=await p.locator('#theme-toggle,#helper-toggle,#text-size-toggle').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().top));assert(Math.max(...buttons)-Math.min(...buttons)<1,'three controls share one row');assert((await p.locator('#text-size-toggle').getAttribute('aria-label')).includes(scale+'%'));if(scale===100)await p.screenshot({path:path.join(qa,`${theme}-${width}.png`)});}}}
 await p.setViewportSize({width:390,height:380});await settle(p);const box=await p.locator('#mobile-helper').boundingBox();assert(box&&box.y>=0&&box.y+box.height<=380+1);
 await p.setViewportSize({width:1920,height:1080});await settle(p);assert(await p.locator('#helper-toggle').isHidden());assert(await p.locator('#mobile-helper').isHidden());assert(await p.locator('#text-size-label').isVisible());checks.push('Both themes, 390/320px, all text scales and a reduced visible height fit; percentages remain accessible and desktop controls are unchanged');await c.close();
 const denied=await open();await denied.c.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('unavailable');}}));await denied.p.goto(url);await settle(denied.p);assert(await denied.p.locator('#mobile-helper').isHidden());await denied.p.locator('#helper-toggle').click();await settle(denied.p);assert(await denied.p.locator('#mobile-helper').isVisible());await denied.p.locator('#helper-toggle').click();assert(await denied.p.locator('#mobile-helper').isHidden());await denied.p.locator('#helper-toggle').click();await denied.p.locator('#simple-query').fill('Runway');await settle(denied.p);assert.equal(await denied.p.locator('#mobile-helper').getAttribute('data-stage'),'refine');await denied.c.close();checks.push('Unavailable storage keeps hints off by default and does not break manual toggles');
 const motion=await open({reducedMotion:'no-preference'});await motion.p.goto(url);await motion.p.locator('#helper-toggle').click();await motion.p.waitForFunction(()=>document.querySelector('#mobile-helper').getAnimations().some(a=>a.playState==='running'));const duration=await motion.p.locator('#mobile-helper').evaluate(e=>e.getAnimations()[0].effect.getTiming().duration);assert.equal(duration,1700);await motion.p.waitForFunction(()=>document.querySelector('#mobile-helper').dataset.moving==='false');await motion.c.close();checks.push('Robot is mirrored without an arrow, floats above input without shifting the page, and moves at half the previous speed (1700ms)');
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);await fs.writeFile(path.join(qa,'report.json'),JSON.stringify({status:'passed',checks,errors,networkRequests:requests.length},null,2));console.log(JSON.stringify({status:'passed',checks:checks.length,networkRequests:requests.length}));
}finally{await browser.close();}
