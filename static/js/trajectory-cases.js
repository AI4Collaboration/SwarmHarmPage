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
    'kimi-k3.1-pro':{name:'Kimi K3.1',src:'static/images/models/kimi.svg?v=1',cls:''}
  };
  const MODEL_ORDER=['gpt-6.1-sol','gpt-6.1-terra','gpt-6-astra','gpt-6-luna','claude-opus-5.5','claude-sonnet-5.5','claude-haiku-5.5','gemini-4-argon','deepseek-v4.1-flash','glm-5.3','kimi-k3.1-pro'];
  function modelLogoImg(id){
    const model=models[id];
    if(!model)return '';
    return `<img class="model-logo ${model.cls}" src="${assetRoot}${model.src}" width="15" height="15" alt="">`;
  }
  function modelLabel(id){
    const model=models[id];
    if(!model)return `<span class="model-tag">${escape(id)}</span>`;
    return `<span class="model-tag">${modelLogoImg(id)}${escape(model.name)}</span>`;
  }
  const icons={
    Agents:'<circle cx="8" cy="7" r="2.5"/><circle cx="24" cy="7" r="2.5"/><circle cx="8" cy="23" r="2.5"/><circle cx="24" cy="23" r="2.5"/><path d="M3 15v-2a5 5 0 0 1 10 0v2m6 0v-2a5 5 0 0 1 10 0v2M3 31v-2a5 5 0 0 1 10 0v2m6 0v-2a5 5 0 0 1 10 0v2"/>',
    Harness:'<rect x="3" y="5" width="26" height="22" rx="4"/><path d="m8 12 4 4-4 4m9 0h7"/>',
    Feedback:'<rect x="3" y="5" width="26" height="20" rx="4"/><path d="m9 25-3 5v-5m3-13h14M9 18h9"/>'
  };
  // The page omits goal and reasoning settings from both the summary and the evidence panel.
  const visibleSettings = rows => (rows || []).filter(([key]) => !/^(?:goal|reasoning)\b/i.test(key));
  function settingsMarkup(item){
    const settings = visibleSettings(item.settings);
    if (!settings.length) return '';
    const fields = settings.map(([key, value]) => {
      return `<div class="case-setting" data-setting="${escape(key.toLowerCase())}" data-value="${escape(value.toLowerCase())}">
        <span class="case-setting-icon" aria-hidden="true"><svg viewBox="0 0 32 34">${icons[key] || icons.Feedback}</svg></span>
        <dt>${escape(key)}</dt><dd>${escape(value)}</dd>
      </div>`;
    });
    return `<dl class="case-settings" style="--settings-count:${settings.length}" aria-label="Recorded experiment settings">${fields.join('')}</dl>`;
  }
  function outcomeMarkup(item){
    const visual=item.outcomeVisual;
    if(!visual)return `<div class="case-result" data-result="${item.phase===1?'formation':'impact'}"><span class="case-result-label">Outcome</span><p>${escape(item.outcome)}</p></div>`;
    return `<div class="case-result" data-result="${item.phase===1?'formation':'impact'}"><span class="case-result-label">Outcome</span><p>${escape(visual.action)}</p><dl class="case-result-metrics">${visual.metrics.map(m=>`<div data-tone="${escape(m.tone)}"><dt>${escape(m.label)}</dt><dd>${escape(m.value)}</dd></div>`).join('')}</dl>${visual.note?`<small class="case-result-note">${escape(visual.note)}</small>`:''}</div>`;
  }
  let activeStudyFilter='all', activeModelFilter='all';
  const modelBar=root.querySelector('[data-traces-models]');
  function matchesFilters(c){
    if(activeStudyFilter!=='all'&&c.mode.toLowerCase()!==activeStudyFilter)return false;
    if(activeModelFilter!=='all'&&c.model!==activeModelFilter)return false;
    return true;
  }
  function renderModelBar(){
    if(!modelBar)return;
    const studyScoped=cases.filter(c=>activeStudyFilter==='all'||c.mode.toLowerCase()===activeStudyFilter);
    const counts=new Map();
    studyScoped.forEach(c=>counts.set(c.model,(counts.get(c.model)||0)+1));
    modelBar.innerHTML=`<button type="button" class="traces-model-chip" data-traces-model="all" aria-pressed="${activeModelFilter==='all'}">All models <small>${studyScoped.length}</small></button>`+
      MODEL_ORDER.filter(m=>counts.has(m)).map(m=>`<button type="button" class="traces-model-chip" data-traces-model="${m}" aria-pressed="${activeModelFilter===m}">${modelLogoImg(m)}${escape(models[m].name)} <small>${counts.get(m)}</small></button>`).join('');
  }
  function populateSelect(){
    const prev=select.value;
    select.replaceChildren();
    const groups=[
      {label:'SwarmHarm · 11-model N=4 benchmark',items:cases.filter(c=>c.mode==='SwarmHarm'&&c.id.startsWith('n4-')&&matchesFilters(c))},
      {label:'SwarmHarm · Core GPT-6.1 Sol threat models',items:cases.filter(c=>c.mode==='SwarmHarm'&&!c.id.startsWith('n4-')&&matchesFilters(c))},
      {label:'SwarmForm · Channel discovery',items:cases.filter(c=>c.mode==='SwarmForm'&&matchesFilters(c))}
    ];
    for(const g of groups){
      if(!g.items.length)continue;
      const group=document.createElement('optgroup');group.label=g.label;
      g.items.forEach(c=>{
        const option=document.createElement('option');
        option.value=c.key;
        const mName=models[c.model]?.name||c.modelLabel||c.model;
        option.textContent=`${c.claim} · ${c.domain} (${mName})`;
        group.append(option);
      });
      select.append(group);
    }
    if(prev&&[...select.options].some(o=>o.value===prev))select.value=prev;
  }
  renderModelBar();
  populateSelect();
  modelBar?.addEventListener('click',ev=>{
    const btn=ev.target.closest('[data-traces-model]');
    if(!btn)return;
    const nextModel=btn.dataset.tracesModel;
    activeModelFilter=(activeModelFilter===nextModel&&nextModel!=='all')?'all':nextModel;
    renderModelBar();
    populateSelect();
    const currentCase=cases.find(c=>c.key===mountedKey);
    if(currentCase&&!matchesFilters(currentCase)){
      const firstMatch=cases.find(matchesFilters);
      if(firstMatch)show(firstMatch.key,{},'#trajectory');
    }
  });
  root.querySelectorAll('[data-traces-study]').forEach(btn=>{
    const st=btn.dataset.tracesStudy;
    const cnt=st==='all'?cases.length:cases.filter(c=>c.mode.toLowerCase()===st).length;
    const small=btn.querySelector('small');if(small)small.textContent=`(${cnt})`;
    btn.addEventListener('click',()=>{
      activeStudyFilter=st;
      if(activeModelFilter!=='all'&&!cases.some(c=>(st==='all'||c.mode.toLowerCase()===st)&&c.model===activeModelFilter)){
        activeModelFilter='all';
      }
      root.querySelectorAll('[data-traces-study]').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
      renderModelBar();
      populateSelect();
      root.querySelectorAll('.featured-pill').forEach(pill=>{
        const pillCase=cases.find(c=>c.id===pill.dataset.showCase);
        pill.hidden=Boolean(st!=='all'&&pillCase&&pillCase.mode.toLowerCase()!==st);
      });
      const currentCase=cases.find(c=>c.key===mountedKey);
      if(currentCase&&!matchesFilters(currentCase)){
        const firstMatch=cases.find(c=>matchesFilters(c)&&(c.id.startsWith('n4-')||st==='swarmform'))||cases.find(matchesFilters);
        if(firstMatch)show(firstMatch.key,{},'#trajectory');
      }
    });
  });
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
    const retired=Boolean(id&&!selected),defaultCase=cases.find(c=>c.id==='n4-deepseek-eng-records')||cases[0],item=selected||(retired?cases[0]:defaultCase);
    notice.hidden=!retired;
    if(retired) position={layout:position.layout};
    select.value=item.key;
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
