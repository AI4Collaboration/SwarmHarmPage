/* Audit default evidence visibility across every published case. Never submits forms. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.SWARMHARM_PREVIEW_URL||'http://127.0.0.1:8793';
(async()=>{
 const browser=await chromium.launch({channel:process.env.SWARMHARM_BROWSER||'msedge'});
 try{
  const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];let files=0;
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push(r.status()+' '+r.url());});
  async function assertCompact(label){
   assert.equal(await page.locator('pre:visible').count(),0,label+': raw payload visible by default');
   const text=await page.locator('.obs-chat-text,.record-message>p,.record-turn-summary,[data-excerpt]').allTextContents();
   assert.ok(text.every(t=>!/^\s*[\[{]/.test(t)),label+': raw structured preview');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+': horizontal overflow');
  }
  await page.goto(base);await page.waitForSelector('.obs-workbench');
  const cases=await page.evaluate(()=>window.SWARMHARM_CASES.map(c=>({key:c.key,trajectory:c.trajectory})));
  for(const item of cases){
   await page.selectOption('[data-case-select]',item.key);
   await page.waitForFunction(()=>!document.querySelector('.trajectory-viewer').hasAttribute('aria-busy'));
   await page.waitForSelector('.obs-workbench');
   const data=await page.evaluate(async file=>(await fetch(file)).json(),item.trajectory);
   files+=data.messages.length;
   assert.equal(await page.locator('.obs-full-file').count(),data.messages.length);
   assert.equal(await page.locator('.obs-full-file[open]').count(),0);
   await assertCompact(item.key);
   if(data.messages.length){
    const toggle=page.locator('.obs-full-file').first();
    await toggle.locator('summary').click();
    assert.equal(await toggle.locator('pre').isVisible(),true);
    assert.equal(await toggle.locator('pre').textContent(),data.messages[0].body);
    assert.match(await toggle.locator('summary').innerText(),/Hide\s+full/);
    await page.keyboard.press('Enter');
    assert.equal(await toggle.locator('pre').isVisible(),false);
    await page.locator('[data-original-artifact]').first().click();
   }else await page.locator('[data-original="action"]').click();
   await page.waitForSelector('dialog[open]');
   await assertCompact(item.key+' original dialog');
   const raw=page.locator('dialog[open] .record-full-file').first();
   if(await raw.count()){
    await raw.locator('summary').click();assert.equal(await raw.locator('pre').isVisible(),true);
    assert.equal(await raw.locator('pre').textContent(),data.messages[0].body);
   }
   await page.locator('[data-close-record]').click();
   if(data.messages.length){
    await page.locator('[data-original-artifact]').first().click();
    await assertCompact(item.key+' reopened dialog');
    await page.locator('[data-close-record]').click();
   }
   await page.locator('.record-log>summary').click();await page.waitForSelector('.record-event');
   await assertCompact(item.key+' expanded action log');
   await page.locator('.record-run-disclosure>summary').click();
   const event=data.messages.length?data.events.find(e=>e.id===data.messages[0].event):data.events[0];
   const turn=page.locator(`.record-turn[data-agent="${event.actor}"][data-turn="${event.turn}"]`);
   await turn.focus();await assertCompact(item.key+' focused turn');
   console.log('PASS',item.key);
  }
  for(const route of ['/','/team/','/call-to-action/']){
   await page.goto(base+route);if(route==='/')await page.waitForSelector('.obs-workbench');
   for(const width of [390,1440]){
    await page.setViewportSize({width,height:900});
    for(const theme of ['dark','light']){
     if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('[data-theme-toggle]').click();
     await assertCompact(route+' '+width+' '+theme);
    }
   }
  }
  assert.deepEqual(errors,[]);
  console.log(`Passed ${cases.length} cases, ${files} collapsed file bodies, toggle fidelity, keyboard collapse, reopened dialogs, logs, turn previews and 3 pages in both themes at phone/desktop widths.`);
 }finally{await browser.close();}
})();
