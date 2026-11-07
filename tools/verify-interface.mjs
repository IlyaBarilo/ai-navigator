import {switchMode} from './workspace.mjs';
// Focused integration checks for the author-selected appearance and live counter.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {launchBrowser} from './browser.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),qa=path.join(root,'local','qa'),file=path.join(root,'ai-navigator.html'),checks=[];
const sha=x=>crypto.createHash('sha256').update(x).digest('hex'),rgb=x=>'rgb('+x.slice(1).match(/../g).map(n=>parseInt(n,16)).join(', ')+')';
const skin={light:{bg:'#f5f7fc',accent:'#3e57a5'},dark:{bg:'#171c30',accent:'#b5c2ff'}},html=await fs.readFile(file,'utf8');
assert(!html.includes('id="design-preview-panel"')&&!html.includes('id="design-style"'));
await fs.mkdir(qa,{recursive:true});
const b=await launchBrowser(root),errors=[],requests=[];
try{const c=await b.newContext({offline:true,viewport:{width:1289,height:1050}}),p=await c.newPage();p.on('pageerror',e=>errors.push(String(e)));p.on('request',r=>requests.push(r.url()));await p.goto(pathToFileURL(file).href+'#view=simple');
const d=JSON.parse(await p.locator('#catalog-data').textContent());assert.equal(d.author.name,'Барило И.И.');assert.equal(await p.locator('.author-name').textContent(),'Барило И.И.');assert(!(await p.locator('body').innerText()).includes('Барило Илья Иванович'));assert(await p.locator('#mode-toggle').evaluate(e=>e.closest('.workspace-nav').previousElementSibling.id==='text-size-toggle'&&document.getElementById('theme-toggle').nextElementSibling.id==='helper-toggle'&&document.getElementById('helper-toggle').nextElementSibling.id==='text-size-toggle'));assert.equal(await p.locator('.workspace-nav button').count(),1);assert(await p.locator('#simple-learning button').isHidden());
checks.push('Fixed appearance has no design switcher; short author and approved navigation are present');
assert.equal(await p.locator('#simple-total-tools').textContent(),'42');assert(!(await p.locator('#simple-matching-tools').isVisible()));
for(const query of ['план занятия по физике','изображение','никогоненайти12345']){await p.locator('#simple-query').fill(query);assert.equal(await p.locator('#simple-matching-tools').textContent(),(await p.locator('[data-simple-tool]').count())+' из ');assert.equal(await p.locator('#simple-total-tools').textContent(),'42');}
await p.locator('#simple-query').fill('изображение');await p.locator('[data-simple-access="local"]').click();assert.equal(await p.locator('#simple-matching-tools').textContent(),(await p.locator('[data-simple-tool]').count())+' из ');await p.locator('#simple-rf').click();assert.equal(await p.locator('#simple-matching-tools').textContent(),(await p.locator('[data-simple-tool]').count())+' из ');await p.locator('[data-simple-access="all"]').click();await p.locator('[data-simple-access="free-online"]').click();await p.locator('#simple-rf').click();
checks.push('Counter shows total before input, live matching count including zero, and follows access/RF changes');
await switchMode(p,'catalog');await p.locator('.all-groups').click();
for(const id of ['suno','udio','google-cloud-tts','krea','qwen-coder','gamma','kimi','leonardo']){await p.locator('#search').fill(id);assert.equal(await p.locator('.tool-card').count(),1,id);assert.equal(await p.locator('.tool-card .availability-unknown').count(),0,id);assert(d.tools.find(t=>t.id===id).functions.every(f=>f.region==='available'));}
for(const id of ['runway','luma','computer']){await p.locator('#search').fill(id);assert.equal(await p.locator('.tool-card').count(),0,id);await p.locator('#rf-filter').click();assert.equal(await p.locator('.tool-card').count(),1,id);await p.locator('#rf-filter').click();assert(d.tools.find(t=>t.id===id).functions.every(f=>f.region==='blocked'));}
assert(d.tools.find(t=>t.id==='flow-music').functions.every(f=>f.region==='check'));assert(!d.tools.some(t=>t.id==='google-flow'));
checks.push('Author-confirmed access is applied to nine services; deferred Google Flow and Flow Music remain untouched');
await p.goto(pathToFileURL(file).href+'#view=catalog&groups=&rf=0');
const presentationRows=await p.locator('.tool-card').evaluateAll(cards=>cards.map(card=>({id:card.dataset.tool,rows:[...card.querySelectorAll('.capability')].map(row=>({id:row.dataset.function,label:row.querySelector('.cap-label').firstChild.textContent,variant:row.querySelector('.cap-label small').textContent,icon:row.querySelector('svg use').getAttribute('href')}))})));
assert.equal(presentationRows.length,d.tools.length);
for(const card of presentationRows){assert.equal(card.rows.length,d.tools.find(t=>t.id===card.id).functions.length,card.id);assert.equal(new Set(card.rows.map(row=>row.label+' / '+row.variant)).size,card.rows.length,'Ambiguous capability labels: '+card.id);}
const distinctLabels={'alice-code':['Код','#icon-code'],'claude-code':['Claude Code','#icon-code'],'claude-cowork':['Cowork','#icon-agents'],'qwen-research':['Исследования','#icon-agents'],'qwen-code':['Qwen Code','#icon-code']};
for(const [id,[label,icon]]of Object.entries(distinctLabels)){const row=presentationRows.flatMap(card=>card.rows).find(row=>row.id===id);assert.equal(row.label,label,id);assert.equal(row.icon,icon,id);}
for(const id of ['alice','claude','qwen']){await p.locator('#search').fill(id==='alice'?'Алиса':id);await p.locator('.tool-card .details-button').click();const headings=await p.locator('.capability-detail h3').allTextContents();assert.equal(new Set(headings).size,headings.length,id+' detail headings');await p.keyboard.press('Escape');}
await p.locator('#search').fill('кейс');assert.equal(await p.locator('[data-tool="alice"] .extra-capability[data-function="alice-code"] use').getAttribute('href'),'#icon-code');assert((await p.locator('[data-tool="alice"] .extra-capability[data-function="alice-code"]').getAttribute('title')).startsWith('Код · Онлайн'));
checks.push('All 136 capabilities remain distinct; code labels/icons and Claude/Qwen variants agree in cards, compact extras and details');
await p.locator('#search').fill('deepseek');await p.locator('.tool-card .details-button').click();assert.equal(await p.locator('.reliability-tag,.detail-reliability,.simple-reliability').count(),0);await p.keyboard.press('Escape');await switchMode(p,'simple');await p.locator('#simple-query').fill('план занятия по физике');await p.locator('#simple-learning button').click();assert(await p.locator('#first-request').isVisible());await switchMode(p,'simple');assert.equal(await p.locator('#simple-query').inputValue(),'план занятия по физике');
checks.push('Reliability fields are absent from UI; tutorial entry and return preserve the query');
for(const mode of ['light','dark']){if(await p.locator('html').getAttribute('data-theme')!==mode)await p.locator('#theme-toggle').click();await p.waitForFunction(expected=>getComputedStyle(document.body).backgroundColor===expected.bg&&getComputedStyle(document.querySelector('[data-simple-access="free-online"]')).backgroundColor===expected.accent,{bg:rgb(skin[mode].bg),accent:rgb(skin[mode].accent)});assert.equal(await p.locator('[data-simple-access="free-online"]').evaluate(e=>getComputedStyle(e).backgroundColor),rgb(skin[mode].accent));const radius=await p.locator('.simple-tool-row').first().evaluate(e=>getComputedStyle(e).borderRadius);assert.equal(radius,'4px');const headings=await p.evaluate(()=>[1,2,3].map(n=>{const c=getComputedStyle(document.getElementById('simple-title-'+n));return [c.fontSize,c.fontWeight,c.letterSpacing,c.lineHeight];}));assert.deepEqual(headings[0],headings[1]);assert.deepEqual(headings[0],headings[2]);
for(const width of [1289,1024,390,320]){await p.setViewportSize({width,height:1050});for(const scale of [100,120,150,50,75]){for(let n=0;n<5&&await p.locator('#text-size-label').textContent()!==scale+'%';n++)await p.locator('#text-size-toggle').click();assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),mode+'/'+width+'/'+scale);assert(await p.locator('#simple-total-tools').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>parseFloat(getComputedStyle(document.getElementById('simple-matching-tools')).fontSize)));if(width<=600){const h=await p.evaluate(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}};return {brand:box('.brand'),author:box('.author'),controls:box('.display-controls'),theme:box('#theme-toggle'),size:box('#text-size-toggle'),nav:box('.workspace-nav'),edge:document.querySelector('.masthead').getBoundingClientRect().right-parseFloat(getComputedStyle(document.querySelector('.masthead')).paddingRight)}});assert(Math.abs(h.author.left-h.brand.left)<1&&h.author.top>=h.brand.bottom-1,'author under brand on the left');assert(Math.abs(h.controls.right-h.edge)<1,'controls align right');assert(h.theme.top<=h.size.top&&h.size.bottom<=h.nav.top,'theme and scale precede navigation');} if(scale===100&&(width===1289||width===390))await p.screenshot({path:path.join(qa,'selected-'+mode+'-'+width+'.png'),animations:'disabled'});}}
}
checks.push('Selected palette, live counts and all text scales fit; mobile author is below the name on the left, controls align right with theme/scale first');
const independent=await b.newContext({offline:true}),returnPage=await independent.newPage();
returnPage.on('pageerror',e=>errors.push(String(e)));returnPage.on('request',r=>requests.push(r.url()));
await returnPage.goto(pathToFileURL(file).href+'#view=catalog&q='+encodeURIComponent('музыка')+'&quality=5&difficulty=2');
const expertState=await returnPage.evaluate(()=>localStorage.getItem('barilo.ai-catalog.preferences.v1'));
for(const source of ['simple','steps','first']){
  await switchMode(returnPage,source==='first'?'simple':source);
  await returnPage.locator('#simple-query').fill('план занятия');
  if(source==='first')await returnPage.locator('#simple-learning button').click();
  // Inactive form values must not become the source of truth on returning to Expert.
  await returnPage.locator('#search').evaluate(e=>e.value='');
  await switchMode(returnPage,'catalog');
  assert.equal(await returnPage.locator('#search').inputValue(),'музыка',source);
  assert.equal(await returnPage.locator('#quality-value').textContent(),'5/5');
  assert.equal(await returnPage.locator('#difficulty-value').textContent(),'2/5');
  assert.equal(await returnPage.evaluate(()=>localStorage.getItem('barilo.ai-catalog.preferences.v1')),expertState);
}
await switchMode(returnPage,'simple');await returnPage.reload();await switchMode(returnPage,'catalog');
assert.equal(await returnPage.locator('#search').inputValue(),'музыка');
assert.equal(await returnPage.evaluate(()=>localStorage.getItem('barilo.ai-catalog.preferences.v1')),expertState);
await independent.close();
checks.push('Returning from Simple, Steps or learning redraws Expert controls from its independent selection, including after reload');
const formatContext=await b.newContext({offline:true,viewport:{width:390,height:844}}),formatPage=await formatContext.newPage();
formatPage.on('pageerror',e=>errors.push(String(e)));formatPage.on('request',r=>requests.push(r.url()));
for(const mode of ['catalog','simple','steps']){
 const selector=mode==='catalog'?'.tool-card':'[data-simple-tool]',key=mode==='catalog'?'tool':'simpleTool';
 const find=async(query,extra='')=>{
   await formatPage.goto(pathToFileURL(file).href+'#view='+mode+(mode==='steps'?'&step=3':'')+'&q='+encodeURIComponent(query)+(mode==='catalog'?'&groups=&rf=0':'&access=all&rf=0')+extra);
   return formatPage.locator(selector).evaluateAll((es,k)=>es.map(e=>e.dataset[k]),key);
 };
 const broad=await find('презентация');assert.equal(broad.length,d.tools.filter(t=>t.functions.some(f=>f.category==='slides')).length);
 const pptx=await find('презентация PPTX');assert(pptx.includes('gamma')&&pptx.includes('slidesgo')&&pptx.includes('kimi')&&pptx.includes('marp')&&pptx.includes('notebook'));assert(!pptx.includes('alice')&&!pptx.includes('qwen')&&!pptx.includes('gigachat'));
 const editable=await find('редактируемая презентация PPTX');assert(editable.includes('gamma')&&editable.includes('kimi'));assert(!editable.includes('marp')&&!editable.includes('notebook')&&!editable.includes('codex'));
 assert.deepEqual(new Set(await find('презентация HTML')),new Set(['alice','qwen','marp']));
 const pdf=await find('презентация PDF');assert(pdf.includes('alice')&&pdf.includes('gamma')&&pdf.includes('beautiful'));assert(!pdf.includes('qwen')&&!pdf.includes('slidesgo'));
 assert.equal((await find('презентация из PDF')).length,broad.length,'Input PDF is not an output-format constraint');
 const both=await find('презентация PPTX PDF');assert(both.includes('gamma')&&!both.includes('slidesgo')&&!both.includes('alice'));
 assert.equal((await find('Алиса презентация PPTX')).length,0);
 assert((await formatPage.locator(mode==='catalog'?'#empty-message':'#simple-empty').textContent()).includes('формат'));
 await find('презентация PDF готовый файл');assert.equal(await formatPage.locator(selector+(mode==='catalog'?'[data-tool="alice"]':'[data-simple-tool="alice"]')).count(),0,'Browser print is not direct download');
 await find('презентация PPTX');assert((await formatPage.locator(selector).first().locator('.delivery-result').textContent()).includes('PPTX'));assert(await formatPage.locator(selector).first().locator('.delivery-requirements').isVisible());
}
await formatPage.goto(pathToFileURL(file).href+'#view=steps&q='+encodeURIComponent('Алиса презентация PPTX'));
assert.equal(await formatPage.locator('#guided-query-found').textContent(),'0');assert(await formatPage.locator('#guided-next').isDisabled());assert((await formatPage.locator('#guided-input-hint').textContent()).includes('формат'));
await formatPage.goto(pathToFileURL(file).href+'#view=simple&q='+encodeURIComponent('презентация PDF'));
await formatPage.locator('[data-simple-tool="alice"] [data-simple-details]').click();assert((await formatPage.locator('[data-detail-function="alice-slides"] .delivery-result').textContent()).includes('печать'));await formatPage.keyboard.press('Escape');
await formatContext.close();
checks.push('Presentation formats, editability and delivery methods match the same capability in all three modes; input PDF stays separate, unknown exports are excluded and zero blocks Next');
const educationContext=await b.newContext({offline:true,viewport:{width:390,height:844}}),educationPage=await educationContext.newPage();
educationPage.on('pageerror',e=>errors.push(String(e)));educationPage.on('request',r=>requests.push(r.url()));
for(const mode of ['catalog','simple','steps']){
 const selector=mode==='catalog'?'.tool-card':'[data-simple-tool]',attribute=mode==='catalog'?'data-tool':'data-simple-tool',prefix=pathToFileURL(file).href+'#view='+mode+(mode==='steps'?'&step=3':'');
 const find=async(query)=>{await educationPage.goto(prefix+'&q='+encodeURIComponent(query));return educationPage.locator(selector).evaluateAll((es,attr)=>es.map(e=>e.getAttribute(attr)),attribute);};
 assert((await find('план урока по информатике')).includes('yandex-uchebnik'),mode);
 assert((await find('учебная схема')).includes('napkin'),mode);
 const napkin=educationPage.locator(selector+'['+attribute+'="napkin"]');assert.equal(await napkin.locator('.mini-rating').count(),0);assert.equal(await napkin.locator('.quality-unrated').count(),1);assert((await napkin.textContent()).includes('компьютер'));
 assert.equal(await napkin.locator('.availability-unknown').count(),1);
 for(const query of ['презентация','изменить фото','написать код']){const found=await find(query);assert(!found.includes('napkin')&&!found.includes('yandex-uchebnik'),mode+'/'+query);}
 assert.deepEqual(await find('Напкин'),['napkin']);assert.deepEqual(await find('Яндекс Учебник'),['yandex-uchebnik']);
 const yandex=educationPage.locator(selector+'['+attribute+'="yandex-uchebnik"]');assert.equal(await yandex.locator('.mini-rating').count(),0);assert.equal(await yandex.locator('.availability-unknown').count(),0);
 await yandex.locator(mode==='catalog'?'[data-details]':'[data-simple-details]').click();assert.equal(await educationPage.locator('#details-dialog .rating-box strong').textContent(),'Качество не оценено');assert((await educationPage.locator('#details-dialog .detail-difficulty').textContent()).includes('1/5'));await educationPage.keyboard.press('Escape');
}
for(const name of ['Napkin','Яндекс Учебник']){
 await educationPage.goto(pathToFileURL(file).href+'#view=catalog&q='+encodeURIComponent(name));assert.equal(await educationPage.locator('.tool-card').count(),1);
 await educationPage.locator('[data-quality="1"]').click();assert.equal(await educationPage.locator('.tool-card').count(),0);await educationPage.locator('[data-quality="0"]').click();assert.equal(await educationPage.locator('.tool-card').count(),1);
 await educationPage.locator('[data-difficulty="1"]').click();assert.equal(await educationPage.locator('.tool-card').count(),name==='Napkin'?0:1);await educationPage.locator('[data-difficulty="2"]').click();assert.equal(await educationPage.locator('.tool-card').count(),1);
}
await educationPage.goto(pathToFileURL(file).href+'#view=catalog&groups=&rf=0&sort=quality');const sorted=await educationPage.locator('.tool-card').evaluateAll(es=>es.map(e=>e.dataset.tool));assert.deepEqual(new Set(sorted.slice(-4)),new Set(['napkin','yandex-uchebnik','diffit','twee']));
await educationPage.goto(pathToFileURL(file).href+'#view=steps&q=Napkin');assert.equal(await educationPage.locator('#guided-query-found').textContent(),'1');assert(await educationPage.locator('#guided-next').isEnabled());await educationPage.locator('#guided-next').click();assert.equal(await educationPage.locator('#guided-query-found').textContent(),'1');await educationPage.locator('#guided-next').click();assert.equal(await educationPage.locator('[data-simple-tool="napkin"]').count(),1);
await educationContext.close();
checks.push('Teacher assistant and diagram editor match only documented tasks in all modes; unassessed quality has no stars, positive quality thresholds exclude it, difficulty and counts remain independent');
const languageContext=await b.newContext({offline:true,viewport:{width:390,height:844}});
await languageContext.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copiedLanguagePrompt=text;}}}));
const languagePage=await languageContext.newPage();languagePage.on('pageerror',e=>errors.push(String(e)));languagePage.on('request',r=>requests.push(r.url()));
for(const mode of ['catalog','simple','steps']){
 const selector=mode==='catalog'?'.tool-card':'[data-simple-tool]',attribute=mode==='catalog'?'data-tool':'data-simple-tool';
 const find=async(query,all=false)=>{await languagePage.goto(pathToFileURL(file).href+'#view='+mode+(mode==='steps'?'&step=3':'')+'&q='+encodeURIComponent(query)+(mode==='catalog'?'&groups='+(all?'':'online-free'):'&access='+(all?'all':'free-online')));return languagePage.locator(selector).evaluateAll((es,a)=>es.map(e=>e.getAttribute(a)),attribute);};
 for(const [name,id,number]of [['Diffit','diffit','24'],['Twee','twee','25']]){
  assert.deepEqual(await find(name),[id]);const row=languagePage.locator(selector+'['+attribute+'="'+id+'"]');assert.equal(await row.locator('.mini-rating').count(),0);assert.equal(await row.locator('.availability-unknown').count(),1);
  if(mode!=='catalog'&&await languagePage.locator('#prompt-toggle').getAttribute('aria-expanded')!=='true')await languagePage.locator('#prompt-toggle').click();assert.equal(await languagePage.locator('#prompt-number').textContent(),'Пример: '+number);
  const original=await languagePage.locator('[data-task-prompt]:visible textarea').inputValue();await languagePage.locator('[data-task-prompt]:visible [data-copy-prompt]').click();assert.equal(await languagePage.evaluate(()=>window.__copiedLanguagePrompt),original);
 }
 assert((await find('адаптировать учебный текст по биологии')).includes('diffit'));assert((await find('рабочий лист по английскому')).includes('twee'));
 for(const query of ['тест по физике','рабочий лист по математике','закон Архимеда','Twee тест по физике'])assert(!(await find(query,true)).includes('twee'),mode+'/'+query);
 for(const query of ['презентация','написать код','схема']){const ids=await find(query,true);assert(!ids.includes('diffit')&&!ids.includes('twee'));}
 assert.equal((await find('Twee тест по английскому')).length,0,'Trial cannot borrow a Pro capability');assert.deepEqual(await find('Twee тест по английскому',true),['twee']);
 const pro=languagePage.locator(selector+'['+attribute+'="twee"]');assert.equal(await pro.locator('.online-paid').count(),1);
 await pro.locator(mode==='catalog'?'.details-button':'[data-simple-details]').click();assert.equal(await languagePage.locator('[data-detail-function="twee-pro"] .rating-box strong').textContent(),'Качество не оценено');assert((await languagePage.locator('[data-detail-function="twee-pro"] .detail-difficulty').textContent()).includes('2/5'));await languagePage.keyboard.press('Escape');
 await find('рабочий лист по английскому');if(mode!=='catalog'&&await languagePage.locator('#prompt-toggle').getAttribute('aria-expanded')!=='true')await languagePage.locator('#prompt-toggle').click();while(await languagePage.locator('#prompt-previous').isEnabled())await languagePage.locator('#prompt-previous').click();const textarea=languagePage.locator('[data-task-prompt]:visible textarea');const draft='Мой материал для языкового занятия';await textarea.fill(draft);await languagePage.locator('#prompt-next').click();assert.equal(await languagePage.locator('#prompt-number').textContent(),'Пример: 25');await languagePage.locator('#prompt-previous').click();assert.equal(await languagePage.locator('[data-task-prompt]:visible textarea').inputValue(),draft);
}
await languagePage.goto(pathToFileURL(file).href+'#view=steps&q='+encodeURIComponent('Twee тест по английскому'));assert.equal(await languagePage.locator('#guided-query-found').textContent(),'0');assert(await languagePage.locator('#guided-next').isDisabled());assert(await languagePage.locator('#guided-change-access').isVisible());await languagePage.locator('#guided-change-access').click();await languagePage.locator('[data-simple-access="all"]').click();assert.equal(await languagePage.locator('#guided-query-found').textContent(),'1');await languagePage.locator('#guided-next').click();assert.equal(await languagePage.locator('[data-simple-tool="twee"] .online-paid').count(),1);
await languageContext.close();
checks.push('Diffit and Twee preserve subject scope and independent Trial/Pro access in all modes; P024/P025 copy, page and keep drafts without altering existing examples, and zero counts block Next');
const reopenContext=await b.newContext({offline:true}),reopenPage=await reopenContext.newPage();reopenPage.on('pageerror',e=>errors.push(String(e)));reopenPage.on('request',r=>requests.push(r.url()));
const storeSimple=()=>reopenPage.evaluate(()=>localStorage.setItem('barilo.ai-catalog.simple.v1',JSON.stringify({q:'код',access:['free-online','local'],rfOnly:false})));
const bareEntry=()=>reopenPage.evaluate(()=>new Promise(resolve=>{addEventListener('hashchange',()=>resolve(),{once:true});location.hash='';}));
const assertRestored=async()=>{assert.equal(await reopenPage.locator('body').getAttribute('data-workspace'),'steps');assert.equal(await reopenPage.locator('body').getAttribute('data-guided-step'),'1');assert.equal(await reopenPage.locator('#simple-query').inputValue(),'код');for(const access of ['free-online','local'])assert.equal(await reopenPage.locator('[data-simple-access="'+access+'"]').getAttribute('aria-pressed'),'true');assert.equal(await reopenPage.locator('#simple-rf').getAttribute('aria-pressed'),'false');};
await reopenPage.goto(pathToFileURL(file).href);await storeSimple();await switchMode(reopenPage,'catalog');await bareEntry();await assertRestored();
await reopenPage.locator('#guided-next').click();await reopenPage.locator('#guided-next').click();assert.equal(await reopenPage.locator('body').getAttribute('data-guided-step'),'3');await bareEntry();await assertRestored();
await reopenPage.evaluate(()=>localStorage.removeItem('barilo.ai-catalog.simple.v1'));await reopenPage.reload();assert.equal(await reopenPage.locator('#simple-query').inputValue(),'');await storeSimple();await reopenPage.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await assertRestored();
await reopenPage.goto(pathToFileURL(file).href+'#view=steps&step=2&q='+encodeURIComponent('песня')+'&access=all&rf=1');await reopenPage.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));assert.equal(await reopenPage.locator('#simple-query').inputValue(),'песня');assert.equal(await reopenPage.locator('body').getAttribute('data-guided-step'),'2');assert.equal(await reopenPage.locator('[data-simple-access="all"]').getAttribute('aria-pressed'),'true');assert.equal(await reopenPage.locator('#simple-rf').getAttribute('aria-pressed'),'true');
await reopenPage.goto(pathToFileURL(file).href);await assertRestored();await reopenPage.evaluate(()=>{Storage.prototype.getItem=()=>{throw Error('Storage unavailable');};});await switchMode(reopenPage,'catalog');await bareEntry();await assertRestored();await reopenContext.close();
checks.push('Bare navigation restores the latest saved description/access on screen one; cached pages refresh the form, explicit step links retain priority and storage denial preserves the current selection');
assert.deepEqual(errors,[]);assert(requests.every(u=>u.startsWith('file:')));const report={status:'passed',checks,tools:d.tools.length,capabilities:d.tools.reduce((n,t)=>n+t.functions.length,0),pageErrors:errors,networkRequests:requests.filter(u=>!u.startsWith('file:')).length,htmlSha256:sha(await fs.readFile(file)),visualReview:'pending'};await fs.writeFile(path.join(qa,'selected-appearance-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:checks.length,status:'passed',networkRequests:report.networkRequests}));}finally{await b.close();}
