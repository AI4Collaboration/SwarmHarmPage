/* Run against the local preview with Playwright available. Never submits forms. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.SWARMHARM_PREVIEW_URL||'http://127.0.0.1:8793';
(async()=>{
  const browser=await chromium.launch({channel:process.env.SWARMHARM_BROWSER||'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const errors=[],failed=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.url().startsWith(base)&&response.status()>=400)failed.push(response.url());});
    await page.goto(base);await page.waitForSelector('.obs-workbench');
    const cases=await page.evaluate(()=>window.SWARMHARM_CASES.map(c=>c.key));
    for(const key of cases){
      await page.selectOption('[data-case-select]',key);
      await page.waitForFunction(()=>!document.querySelector('.trajectory-viewer').hasAttribute('aria-busy'));
      await page.waitForSelector('.obs-workbench');
      for(const layout of ['straight','graph','spiral']){
        await page.locator(`[data-track-layout="${layout}"]`).click();
        assert.equal(await page.locator('.obs-spatial').getAttribute('data-layout'),layout);
      }
      const agent=page.locator('[data-strip-actor]').first();
      await agent.click();assert.equal(await agent.getAttribute('aria-pressed'),'true');await agent.click();
      await page.locator('[data-original="action"]').click();await page.waitForSelector('dialog[open]');
      await page.locator('[data-close-record]').click();
      await page.locator('[data-outcome]').click();
      assert.equal(new URL(page.url()).searchParams.get('event'),'outcome');
      assert.equal(await page.locator('[data-inspector-outcome]').isVisible(),true);
    }
    for(const width of [360,390,768,1024,1440]){
      await page.setViewportSize({width,height:1000});
      for(const route of ['/','/team/','/call-to-action/']){
        await page.goto(base+route);if(route==='/')await page.waitForSelector('.obs-workbench');
        for(const theme of ['light','dark']){
          if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('[data-theme-toggle]').click();
          assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
          assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${route} at ${width}px, ${theme}`);
        }
      }
    }
    await page.goto(base+'/?case=r136&phase=1&event=999#trajectory');
    await page.waitForSelector('.obs-workbench');
    assert.equal(await page.locator('[data-case-notice]').isVisible(),true);
    assert.equal(new URL(page.url()).searchParams.get('case'),'form-source-sharing');
    assert.notEqual(new URL(page.url()).searchParams.get('event'),'999');
    for(const id of ['finding-1-3','finding-2-3','finding-2-1','finding-2-2']){
      await page.locator(`#${id} a.finding-trace`).click();
      await page.waitForFunction(()=>!document.querySelector('.trajectory-viewer').hasAttribute('aria-busy'));
      await page.waitForSelector('.obs-workbench');
    }
    await page.setViewportSize({width:390,height:844});await page.goto(base);
    await page.locator('.experiment-nav:nth-child(2) summary').click();
    assert.ok(await page.locator('.experiment-nav:nth-child(2) .finding-links').isVisible());
    await page.locator('.experiment-nav:nth-child(2) .compact-shortcuts a').first().click();
    assert.equal(await page.locator('.experiment-nav:nth-child(2) details').getAttribute('open'),null);
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
    console.log('Passed: 13 cases, 3 layouts, outcomes, agent focus, source records, 30 responsive/theme combinations, finding links, retired links and mobile navigation.');
  }finally{await browser.close();}
})();
