/* Responsive regression checks. Requires the local preview and Playwright. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.SWARMHARM_PREVIEW_URL||'http://127.0.0.1:8793';
const widths=[320,360,375,390,414,430,520,521,600,700,720,721,760,761,768,800,801,900,901,1024,1050,1051,1120,1121,1279,1280,1440,1920,2560,3840];
(async()=>{
 const browser=await chromium.launch({channel:process.env.SWARMHARM_BROWSER||'msedge',headless:true});
 const errors=[],failed=[];let checks=0;
 function observe(page){page.on('pageerror',e=>errors.push(e.stack));page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)failed.push(r.url())});}
 async function inspect(page,label){
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const data=await page.evaluate(()=>{
   const nav=document.querySelector('.site-header nav');
   const clipped=Array.from(document.querySelectorAll('h1,h2,h3,h4,button,summary,.obs-panel-heading,.record-actor')).filter(e=>{const r=e.getBoundingClientRect();return r.width&&getComputedStyle(e).visibility!=='hidden'&&e.scrollWidth>e.clientWidth+3;}).map(e=>e.className+': '+e.textContent.slice(0,60));
   const svg=Array.from(document.querySelectorAll('.current-scene text')).map(e=>({text:e.textContent,font:parseFloat(getComputedStyle(e).fontSize)*e.getScreenCTM().a,x:e.getBBox().x,right:e.getBBox().x+e.getBBox().width}));
   return {page:document.documentElement.scrollWidth,width:innerWidth,navWidth:nav.clientWidth,navScroll:nav.scrollWidth,clipped,svg};
  });
  assert.ok(data.page<=data.width+1,`${label}: document overflow`);
  assert.ok(data.navScroll<=data.navWidth+1,`${label}: clipped navigation`);
  assert.deepEqual(data.clipped,[],`${label}: truncated controls/text`);
  for(const t of data.svg){assert.ok(t.font>=11,`${label}: ${t.text} at ${t.font}px`);assert.ok(t.x>=-1&&t.right<=481,`${label}: ${t.text} outside diagram`);}
  checks++;
 }
 try{
  const page=await browser.newPage({reducedMotion:'reduce'});observe(page);
  for(const route of ['/','/team/','/call-to-action/']){
   await page.goto(base+route);if(route==='/')await page.waitForSelector('.obs-workbench');await page.evaluate(()=>document.fonts.ready);
   for(const width of widths){
    await page.setViewportSize({width,height:900});
    for(const theme of ['light','dark']){
     if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('[data-theme-toggle]').click();
     await inspect(page,`${route} ${width}px ${theme}`);
    }
   }
   console.log('PASS 30 widths × 2 themes:',route);
  }
  await page.close();
  const devices=[
   {name:'small phone',width:320,height:568,dpr:2,touch:true},
   {name:'phone portrait',width:390,height:844,dpr:3,touch:true},
   {name:'phone landscape',width:844,height:390,dpr:3,touch:true},
   {name:'short landscape',width:568,height:320,dpr:2,touch:true},
   {name:'tablet',width:820,height:1180,dpr:2,touch:true},
   {name:'tablet landscape',width:1180,height:820,dpr:2,touch:true},
   {name:'HD',width:1366,height:768,dpr:1},
   {name:'1080p',width:1920,height:1080,dpr:1},
   {name:'Retina',width:1440,height:900,dpr:2},
   {name:'4K',width:3840,height:2160,dpr:1},
   {name:'200% equivalent CSS viewport',width:960,height:540,dpr:2},
   {name:'400% equivalent CSS viewport',width:480,height:270,dpr:2}
  ];
  for(const d of devices){
   const context=await browser.newContext({viewport:{width:d.width,height:d.height},deviceScaleFactor:d.dpr,hasTouch:!!d.touch,reducedMotion:'reduce'});
   const p=await context.newPage();observe(p);await p.goto(base+'/?case=harm-knowledge-grader&phase=2&event=131');await p.waitForSelector('.obs-workbench');await p.evaluate(()=>document.fonts.ready);
   for(const theme of ['light','dark']){
    if(await p.locator('html').getAttribute('data-theme')!==theme)await p.locator('[data-theme-toggle]').click();
    await p.evaluate(()=>scrollTo(0,0));
    for(const index of [0,1]){
     await p.locator('.nav-findings summary').nth(index).click();
     await p.waitForFunction(()=>document.querySelector('.nav-findings[open] .finding-links')?.style.maxHeight);
     const box=await p.locator('.nav-findings[open] .finding-links').boundingBox();
     assert.ok(box.x>=0&&box.x+box.width<=d.width+1&&box.y+box.height<=d.height+1,d.name+' menu outside viewport');
     await p.keyboard.press('Escape');
    }
    for(const layout of ['spiral','straight','graph']){
     await p.locator(`[data-track-layout="${layout}"]`).click();await inspect(p,`${d.name} ${theme} ${layout}`);
    }
    await p.locator('[data-original="action"]').click();await p.waitForSelector('dialog[open]');
    const dialog=await p.locator('dialog[open]').boundingBox();assert.ok(dialog.x>=0&&dialog.y>=0&&dialog.x+dialog.width<=d.width+1&&dialog.y+dialog.height<=d.height+1,d.name+' dialog bounds');
    await p.locator('dialog[open]').evaluate(e=>e.scrollTop=e.scrollHeight);
    await p.locator('[data-close-record]').click();
    await p.locator('.record-run-disclosure>summary').click();
    await inspect(p,d.name+' expanded records');
    await p.locator('.record-evidence').first().locator('summary').first().click();
    const canvas=await p.locator('.obs-space-canvas').evaluate(e=>({width:e.width,css:e.getBoundingClientRect().width,dpr:devicePixelRatio}));
    assert.ok(Math.abs(canvas.width/canvas.css-Math.min(d.dpr,2))<.04,d.name+' canvas resolution');
   }
   if(d.touch){await p.setViewportSize({width:d.height,height:d.width});await inspect(p,d.name+' rotated');}
   console.log('PASS device:',d.name);await context.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);console.log(`Passed ${checks} layout checks, all menus/dialogs, DPR 1/2/3, rotation and zoom-equivalent viewports.`);
 }finally{await browser.close();}
})();
