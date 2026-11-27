(() => {
  const root=document.querySelector('.trajectory-viewer'),cases=window.SWARMHARM_CASES;
  if(!root||!cases?.length)return;
  const assetRoot=document.body?.dataset?.root||'';
  const select=root.querySelector('[data-case-select]'),intro=root.querySelector('[data-case-intro]');
  const review=root.querySelector('[data-case-review]'),full=root.querySelector('[data-case-full]');
  const details=root.querySelector('[data-case-details]');
  const cache=new Map();let version=0,dispose=null,request=null;
  const loading=root.querySelector('[data-case-loading]');
  const notice=root.querySelector('[data-case-notice]');
  let renderedSearch,mountedKey;
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const models={
    'gpt-6.1-sol':{name:'GPT-6.1 Sol',src:'static/images/openai.svg?v=2',cls:'model-logo-openai'},
    'gpt-6.1-terra':{name:'GPT-6.1 Terra',src:'static/images/openai.svg?v=2',cls:'model-logo-openai'},
    'gpt-6-astra':{name:'GPT-6 Astra',src:'static/images/openai.svg?v=2',cls:'model-logo-openai'},
    'gpt-6-luna':{name:'GPT-6 Luna',src:'static/images/openai.svg?v=2',cls:'model-logo-openai'},
    'claude-opus-5.5':{name:'Claude Opus 5.5',src:'static/images/models/claude.svg?v=1',cls:''},
    'claude-sonnet-5.5':{name:'Claude Sonnet 5.5',src:'static/images/models/claude.svg?v=1',cls:''},
    'claude-haiku-5.5':{name:'Claude Haiku 5.5',src:'static/images/models/claude.svg?v=1',cls:''},
    'gemini-4-argon':{name:'Gemini 4 Argon',src:'static/images/models/gemini.svg?v=1',cls:''},
    'deepseek-v4.1-flash':{name:'DeepSeek V4.1',src:'static/images/models/deepseek.svg?v=1',cls:''},
    'glm-5.3':{name:'GLM-5.3',src:'static/images/models/zai.svg?v=1',cls:'model-logo-mono'},
    'kimi-k3.1-pro':{name:'Kimi K3.1',src:'static/images/models/kimi-dark.svg?v=1',cls:'model-logo-kimi',kimi:true}
  };
  const MODEL_ORDER=['deepseek-v4.1-flash','glm-5.3','kimi-k3.1-pro','gemini-4-argon','claude-opus-5.5','claude-sonnet-5.5','claude-haiku-5.5','gpt-6.1-sol','gpt-6.1-terra','gpt-6-astra','gpt-6-luna'];
  const THREAT_MODES=[
    {slug:'gaming',level:'Task',title:'Specification Gaming'},
    {slug:'records',level:'Task',title:'Trace Tampering'},
    {slug:'grader',level:'Task',title:'Grader Manipulation'},
    {slug:'information',level:'Environment',title:'Information Scope Violation'},
    {slug:'action',level:'Environment',title:'Action Scope Violation'},
    {slug:'capacity',level:'Environment',title:'Shared-resource Interference'}
  ];
  function threatSlugOf(c){
    if(c.mode!=='SwarmHarm')return '';
    for(const tm of THREAT_MODES){
      if(c.title.startsWith(tm.title))return tm.slug;
    }
    return '';
  }
  // Deduplicate overlapping Sol SwarmHarm runs in the UI list. Prefer a non-held n4-sol-* cell; keep the harm-* case when the matching n4-sol run is boundary-held.
  const n4SolCovered=new Set(cases.filter(c=>c.id.startsWith('n4-sol-')&&!c.title.includes('Boundary held')).map(c=>threatSlugOf(c)+':'+c.domain));
  const uiCases=cases.filter(c=>{
    if(c.mode==='SwarmHarm'&&c.id.startsWith('harm-')&&n4SolCovered.has(threatSlugOf(c)+':'+c.domain))return false;
    return true;
  });
  function modelLogoImg(id){
    const model=models[id];
    if(!model)return '';
    const isDark=document.documentElement.dataset.theme==="dark";const src=model.kimi?`static/images/models/${isDark?"kimi-dark":"kimi-light"}.svg?v=1`:model.src;return `<img class="model-logo ${model.cls}"${model.kimi?" data-kimi-logo":""} src="${assetRoot}${src}" width="15" height="15" alt="">`;
  }
  function modelLabel(id){
    const model=models[id];
    if(!model)return `<span class="model-tag">${escape(id)}</span>`;
    return `<span class="model-tag">${modelLogoImg(id)}${escape(model.name)}</span>`;
  }
  const initParams=new URLSearchParams(location.search);
  let activeStudyFilter=['swarmharm','swarmform'].includes(initParams.get('study'))?initParams.get('study'):'all';
  let activeThreatFilter=THREAT_MODES.some(t=>t.slug===initParams.get('threat'))?initParams.get('threat'):'all';
  let activeModelFilter=models[initParams.get('model')]?initParams.get('model'):'all';
  const threatBar=root.querySelector('[data-traces-threats]');
  const modelBar=root.querySelector('[data-traces-models]');

  function matchesFilters(c){
    if(activeStudyFilter!=='all'&&c.mode.toLowerCase()!==activeStudyFilter)return false;
    if(activeStudyFilter!=='swarmform'&&activeThreatFilter!=='all'){
      if(c.mode!=='SwarmHarm'||threatSlugOf(c)!==activeThreatFilter)return false;
    }
    if(activeModelFilter!=='all'&&c.model!==activeModelFilter)return false;
    return true;
  }
  function syncStudyTabs(){
    root.querySelectorAll('[data-traces-study]').forEach(btn=>{
      const st=btn.dataset.tracesStudy;
      const cnt=st==='all'?uiCases.length:uiCases.filter(c=>c.mode.toLowerCase()===st).length;
      const small=btn.querySelector('small');if(small)small.textContent=`(${cnt})`;
      btn.setAttribute('aria-pressed',String(st===activeStudyFilter));
    });
  }
  function renderThreatBar(){
    if(!threatBar)return;
    if(activeStudyFilter==='swarmform'){threatBar.hidden=true;return;}
    threatBar.hidden=false;
    const harmPool=uiCases.filter(c=>c.mode==='SwarmHarm'&&(activeModelFilter==='all'||c.model===activeModelFilter));
    const counts=new Map();
    harmPool.forEach(c=>{const s=threatSlugOf(c);counts.set(s,(counts.get(s)||0)+1);});
    const chip=tm=>`<button type="button" class="traces-model-chip" data-traces-threat="${tm.slug}" aria-pressed="${activeThreatFilter===tm.slug}">${escape(tm.title)} <small>${counts.get(tm.slug)||0}</small></button>`;
    const taskChips=THREAT_MODES.filter(t=>t.level==='Task').map(chip).join('');
    const envChips=THREAT_MODES.filter(t=>t.level==='Environment').map(chip).join('');
    threatBar.innerHTML=
      `<button type="button" class="traces-model-chip" data-traces-threat="all" aria-pressed="${activeThreatFilter==='all'}">All failure modes <small>${harmPool.length}</small></button>`+
      `<span class="traces-threat-sep" aria-hidden="true"></span>`+
      `<div class="traces-threat-group"><span class="traces-threat-label">Task-level</span>${taskChips}</div>`+
      `<span class="traces-threat-sep" aria-hidden="true"></span>`+
      `<div class="traces-threat-group"><span class="traces-threat-label">Environment-level</span>${envChips}</div>`;
  }
  function renderModelBar(){
    if(!modelBar)return;
    const scoped=uiCases.filter(c=>{
      if(activeStudyFilter!=='all'&&c.mode.toLowerCase()!==activeStudyFilter)return false;
      if(activeStudyFilter!=='swarmform'&&activeThreatFilter!=='all'&&(c.mode!=='SwarmHarm'||threatSlugOf(c)!==activeThreatFilter))return false;
      return true;
    });
    const counts=new Map();
    scoped.forEach(c=>counts.set(c.model,(counts.get(c.model)||0)+1));
    modelBar.innerHTML=`<button type="button" class="traces-model-chip" data-traces-model="all" aria-pressed="${activeModelFilter==='all'}">All models <small>${scoped.length}</small></button>`+
      MODEL_ORDER.filter(m=>counts.has(m)).map(m=>`<button type="button" class="traces-model-chip" data-traces-model="${m}" aria-pressed="${activeModelFilter===m}">${modelLogoImg(m)}${escape(models[m].name)} <small>${counts.get(m)}</small></button>`).join('');
  }
  function sortGroupItems(items){
    const mRank=m=>{const i=MODEL_ORDER.indexOf(m);return i<0?99:i;};
    const dRank=d=>d==='Knowledge Work'?0:1;
    return items.slice().sort((a,b)=>mRank(a.model)-mRank(b.model)||dRank(a.domain)-dRank(b.domain));
  }
  function populateSelect(activeItem){
    const prev=activeItem?.key||select.value;
    select.replaceChildren();
    const pool=uiCases.filter(matchesFilters);
    // Ensure explicitly deep-linked legacy Sol case remains selectable if active
    if(activeItem&&!pool.some(c=>c.key===activeItem.key))pool.unshift(activeItem);
    const groups=[];
    for(const tm of THREAT_MODES){
      const items=sortGroupItems(pool.filter(c=>c.mode==='SwarmHarm'&&threatSlugOf(c)===tm.slug));
      if(items.length)groups.push({label:`${tm.level} · ${tm.title}`,items});
    }
    const formItems=sortGroupItems(pool.filter(c=>c.mode==='SwarmForm'));
    if(formItems.length)groups.push({label:'SwarmForm · Autonomous Channel Discovery',items:formItems});
    for(const g of groups){
      const group=document.createElement('optgroup');group.label=g.label;
      g.items.forEach(c=>{
        const option=document.createElement('option');
        option.value=c.key;
        const mName=models[c.model]?.name||c.modelLabel||c.model;
        option.textContent=c.mode==='SwarmHarm'
          ? `${mName} · ${c.domain}${c.title.includes('Boundary held')?' (Boundary held)':''}`
          : `${mName} · ${c.claim}`;
        group.append(option);
      });
      select.append(group);
    }
    if(prev&&[...select.options].some(o=>o.value===prev))select.value=prev;
  }
  syncStudyTabs();
  renderThreatBar();
  renderModelBar();
  populateSelect();

  function pickFirstMatching(){
    const pool=uiCases.filter(matchesFilters);
    if(!pool.length)return null;
    // Prefer a peer-communication rich run when switching filters
    return pool.find(c=>(c.counts?.allReads||0)>0)||pool[0];
  }
  threatBar?.addEventListener('click',ev=>{
    const btn=ev.target.closest('[data-traces-threat]');
    if(!btn)return;
    const next=btn.dataset.tracesThreat;
    activeThreatFilter=(activeThreatFilter===next&&next!=='all')?'all':next;
    if(activeThreatFilter!=='all'&&activeStudyFilter==='swarmform')activeStudyFilter='swarmharm';
    if(activeModelFilter!=='all'&&!uiCases.some(matchesFilters))activeModelFilter='all';
    syncStudyTabs();renderThreatBar();renderModelBar();populateSelect();
    const cur=cases.find(c=>c.key===mountedKey);
    if(!cur||!matchesFilters(cur)){const pick=pickFirstMatching();if(pick)show(pick.key,{},'#trajectory');}
  });
  modelBar?.addEventListener('click',ev=>{
    const btn=ev.target.closest('[data-traces-model]');
    if(!btn)return;
    const nextModel=btn.dataset.tracesModel;
    activeModelFilter=(activeModelFilter===nextModel&&nextModel!=='all')?'all':nextModel;
    renderThreatBar();renderModelBar();populateSelect();
    const cur=cases.find(c=>c.key===mountedKey);
    if(!cur||!matchesFilters(cur)){const pick=pickFirstMatching();if(pick)show(pick.key,{},'#trajectory');}
  });
  root.querySelectorAll('[data-traces-study]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      activeStudyFilter=btn.dataset.tracesStudy;
      if(activeStudyFilter==='swarmform')activeThreatFilter='all';
      if(activeModelFilter!=='all'&&!uiCases.some(matchesFilters))activeModelFilter='all';
      syncStudyTabs();renderThreatBar();renderModelBar();populateSelect();
      const cur=cases.find(c=>c.key===mountedKey);
      if(!cur||!matchesFilters(cur)){const pick=pickFirstMatching();if(pick)show(pick.key,{},'#trajectory');}
    });
  });
  function outcomeMarkup(item){
    const visual=item.outcomeVisual;
    if(!visual)return `<div class="case-result" data-result="${item.phase===1?'formation':'impact'}"><span class="case-result-label">Outcome</span><p>${escape(item.outcome)}</p></div>`;
    return `<div class="case-result" data-result="${item.phase===1?'formation':'impact'}"><span class="case-result-label">Outcome</span><p>${escape(visual.action)}</p><dl class="case-result-metrics">${visual.metrics.map(m=>`<div data-tone="${escape(m.tone)}"><dt>${escape(m.label)}</dt><dd>${escape(m.value)}</dd></div>`).join('')}</dl>${visual.note?`<small class="case-result-note">${escape(visual.note)}</small>`:''}</div>`;
  }
  function renderSummary(item) {
    root.dataset.caseMode=item.full?'full':'review';full.hidden=!item.full;review.hidden=item.full;
    const agentCount=(item.settings||[]).find(([k])=>k==='Agents')?.[1];intro.innerHTML=`<div class="case-setup-inline">${modelLabel(item.model)}<span class="case-inline-sep">·</span><span class="case-inline-meta">${escape(item.mode)} · ${escape(item.domain)}${agentCount?` · ${escape(agentCount)} agents`:''}</span><span class="case-inline-sep">—</span><span class="case-inline-context">${escape(item.context)}</span></div>`;
    details.innerHTML=item.composition?'':outcomeMarkup(item);
    if(item.composition){
      const p=item.composition;
      details.insertAdjacentHTML('beforeend',`<div class="composition-proof" aria-label="Full-sequence counterfactual replay"><div><small>Each agent alone</small><strong>${escape(p.alone)}</strong><small>${escape(p.aloneDetail)}</small></div><span aria-hidden="true">→</span><div class="combined"><small>The same actions combined</small><strong>${escape(p.combined)}</strong><small>${escape(p.combinedDetail)}</small></div></div>`);
    }
    if(!item.full){
      review.innerHTML=`<h4>Reviewed sequence</h4><p class="case-scope">${escape(item.scope)}</p><p class="case-scope">${escape(item.scope)}</p><p class="case-pending">Full messages and per-turn records are not yet available here.</p>`;
    }
  }
  function positionFromUrl(url) {
    const value = url.searchParams.get('event');
    if (value === 'outcome') return {event:'outcome'};
    const event = Number(value);
    if (!Number.isSafeInteger(event) || event < 1) return {};
    return {event, message:url.searchParams.get('message')};
  }
  function updateAddress(item, position, hash) {
    const url = new URL(location.href);
    url.searchParams.set('case', item.id);
    url.searchParams.set('phase', String(item.phase));
    if (position.event != null) url.searchParams.set('event', String(position.event));
    else url.searchParams.delete('event');
    if (position.message) url.searchParams.set('message', position.message);
    else url.searchParams.delete('message');
    if (['straight','graph'].includes(position.layout)) url.searchParams.set('layout',position.layout);
    else url.searchParams.delete('layout');
    url.hash = hash;
    if (url.href !== location.href) history.replaceState(history.state, '', url);
    renderedSearch = url.search;
    return url.href;
  }
  async function show(id, position = {}, hash = location.hash){
    const layout=new URL(location.href).searchParams.get('layout');
    position={...position,layout:['straight','graph'].includes(layout)?layout:'spiral'};
    const selected=cases.find(c=>c.key===id)||cases.find(c=>c.id===id);
    const retired=Boolean(id&&!selected),defaultCase=pickFirstMatching()||cases.find(c=>c.id==='n4-deepseek-eng-records')||cases[0],item=selected||(retired?cases[0]:defaultCase);
    notice.hidden=!retired;
    if(retired) position={layout:position.layout};
    populateSelect(item);select.value=item.key;const pickerLogo=root.querySelector('[data-picker-logo]');if(pickerLogo)pickerLogo.innerHTML=modelLogoImg(item.model);
    root.querySelectorAll('.featured-pill').forEach(pill=>{
      pill.setAttribute('aria-current',pill.dataset.showCase===item.id?'true':'false');
    });
    const current=++version;
    request?.abort();
    updateAddress(item, position, hash);
    if (dispose && mountedKey===item.key) {
      full.inert=false; loading.textContent=''; root.removeAttribute('aria-busy');
      root.dispatchEvent(new CustomEvent('trajectory-seek',{detail:position}));
      return;
    }
    const hadViewer=Boolean(dispose);
    root.dispatchEvent(new CustomEvent('trajectory-case-change',{detail:item.id}));
    const replace = () => {
      dispose?.(); dispose=null; mountedKey=null; full.inert=false;
      full.replaceChildren(); renderSummary(item);
    };
    if (!item.full) {
      replace(); loading.textContent=''; root.removeAttribute('aria-busy'); return;
    }
    root.setAttribute('aria-busy','true');
    if (dispose) full.inert=true;
    else if (!full.hasChildNodes() && review.hidden) {
      full.innerHTML='<p class="record-loading" role="status">Loading recorded events…</p>';
    }
    try {
      let data=cache.get(item.key);
      if (!data) {
        loading.textContent='Loading…';
        request=new AbortController();
        const response=await fetch(assetRoot+item.trajectory,{signal:request.signal});
        if (!response.ok) throw new Error('Could not load recorded events');
        data=await response.json();
        if (data.id!==item.id||!Array.isArray(data.events)||!Array.isArray(data.messages)||!data.turns) throw new Error('Invalid trajectory');
        cache.set(item.key,data);
      }
      if (current!==version) return;
      replace();
      dispose=window.mountRecordedTimeline(full,data,{
        ...item, position, pinMoment:(moment,hash) => updateAddress(item, moment, hash)
      });
      mountedKey=item.key;
      if (hadViewer && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        full.querySelector('.obs-workbench')?.animate([{opacity:.72},{opacity:1}],{duration:220,easing:'ease-out'});
      }
    } catch (error) {
      if (current!==version||error.name==='AbortError') return;
      replace();
      full.innerHTML='<p class="record-loading" role="status">The trajectory could not be loaded.</p><button type="button" class="record-retry">Try again</button>';
      full.querySelector('button').addEventListener('click',()=>{
        const retry=show(item.key,position);
        if(isReplayAnchor(location.hash))landAfter(retry,location.hash);
      },{once:true});
    } finally {
      if (current===version) { root.removeAttribute('aria-busy'); loading.textContent=''; }
    }
  }
  select.addEventListener('change',()=>show(select.value, {}, '#trajectory'));
  document.querySelectorAll('[data-show-case]').forEach(link=>link.addEventListener('click',async event=>{
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const target = new URL(link.href);
    if (target.href !== location.href) history.pushState(null, '', target);
    const key=link.dataset.showPhase?`${link.dataset.showCase}-phase${link.dataset.showPhase}`:link.dataset.showCase;
    const loading=show(key,positionFromUrl(target)),clickedVersion=version;
    await loading;
    if (clickedVersion !== version || location.hash !== target.hash) return;
    root.querySelector('#trajectory-title').focus({preventScroll:true});
    root.scrollIntoView({block:'start',behavior:'instant'});
  }));
  function showLocation() {
    const url = new URL(location.href), params = url.searchParams;
    // The retired timeline switch never selected a layout for the main graph.
    if (params.get('timeline') === '3d') {
      if (url.hash==='#timeline') url.hash='#swarm-trajectory';
      params.delete('timeline');
      history.replaceState(history.state,'',url);
    }
    return show(params.has('phase') ? `${params.get('case')}-phase${params.get('phase')}` : params.get('case'), positionFromUrl(url));
  }
  function isReplayAnchor(hash) {
    return hash==='#timeline' || hash==='#swarm-trajectory';
  }
  window.addEventListener('popstate', () => {
    if (location.search === renderedSearch) return;
    const render=showLocation();
    if(isReplayAnchor(location.hash))landAfter(render,location.hash);
  });
  function landAfter(render,hash) {
    const landingVersion = version;
    const landing = new AbortController();
    const cancel = () => landing.abort();
    for (const type of ['pointerdown','wheel','touchstart','keydown']) {
      window.addEventListener(type,cancel,{passive:true,once:true,signal:landing.signal});
    }
    render.then(() => requestAnimationFrame(() => {
      if (!landing.signal.aborted && version === landingVersion && location.hash === hash) {
        const target = document.getElementById(hash.slice(1));
        (target || root).scrollIntoView({block:'start',behavior:'instant'});
      }
      cancel();
    }));
  }
  const firstRender = showLocation();
  const initialHash = location.hash;
  const initialTarget = document.getElementById(initialHash.slice(1));
  // The scene and timeline are mounted with the replay, and later sections move when it loads.
  if (isReplayAnchor(initialHash) || (initialTarget && !root.contains(initialTarget) &&
      (root.compareDocumentPosition(initialTarget) & Node.DOCUMENT_POSITION_FOLLOWING))) {
    landAfter(firstRender,initialHash);
  }
})();
