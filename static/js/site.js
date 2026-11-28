(() => {
  const header = document.querySelector('.site-header');
  let headerHeight = null, headerFrame = 0;
  function updateHeaderOffset() {
    headerFrame = 0;
    const height = header && getComputedStyle(header).position === 'sticky'
      ? header.getBoundingClientRect().height : 0;
    if (height === headerHeight) return;
    headerHeight = height;
    document.documentElement.style.setProperty('--header-offset', `${height}px`);
  }
  function scheduleHeaderOffset() {
    if (!headerFrame) headerFrame = requestAnimationFrame(updateHeaderOffset);
  }
  if (header && 'ResizeObserver' in window) new ResizeObserver(scheduleHeaderOffset).observe(header);
  window.addEventListener('resize', scheduleHeaderOffset);
  updateHeaderOffset();

  const navigation = header?.querySelector('nav');
  const sectionLinks = [...(navigation?.querySelectorAll('a[href^="#"]') || [])];
  const sections = sectionLinks.map(link => ({link, element:document.getElementById(link.hash.slice(1))}))
    .filter(item => item.element);
  for (const findingsMenu of navigation?.querySelectorAll('.nav-findings') || []) {
    const closeMenu = () => {
      findingsMenu.open = false;
    };
    const fitMenu = () => {
      if (!findingsMenu.open) return;
      const menu = findingsMenu.querySelector('.finding-links');
      const viewportBottom = window.visualViewport
        ? window.visualViewport.offsetTop + window.visualViewport.height : innerHeight;
      menu.style.maxHeight = Math.max(44, viewportBottom - menu.getBoundingClientRect().top - 12) + 'px';
    };
    findingsMenu.addEventListener('toggle', fitMenu);
    window.addEventListener('resize', fitMenu);
    window.addEventListener('scroll', fitMenu, {passive:true});
    window.visualViewport?.addEventListener('resize', fitMenu);
    document.addEventListener('click', event => {
      if (findingsMenu.open && (event.target.closest('a') || !findingsMenu.contains(event.target))) closeMenu();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && findingsMenu.open) {
        closeMenu();
        findingsMenu.querySelector('summary').focus();
      }
    });
  }

  function selectSection(hash) {
    const target = document.getElementById((hash || '').slice(1));
    const selected = target && (sections.find(item => item.element === target) ||
      sections.findLast(item => item.element.contains(target)) ||
      sections.find(item => target.contains(item.element)));
    sectionLinks.forEach(link => {
      if (link.hash === selected?.link.hash) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  sectionLinks.forEach(link => link.addEventListener('click', () => selectSection(link.hash)));
  window.addEventListener('hashchange', () => selectSection(location.hash));
  selectSection(location.hash);
  let sectionTimer;
  window.addEventListener('scroll', () => {
    clearTimeout(sectionTimer);
    sectionTimer = setTimeout(() => {
      const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || headerHeight || 0;
      const positions = sections.map(({link,element}) => {
        const {top,bottom} = element.getBoundingClientRect();
        const margin = parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
        return {link,top,bottom,start:padding+margin};
      });
      const page = document.scrollingElement, last = positions.at(-1);
      if (page && last?.top < page.clientHeight && page.scrollTop + page.clientHeight >= page.scrollHeight - 2) {
        // On tall screens more than one footer link can land at the end of the page.
        const requested = positions.find(item => item.link.hash === location.hash &&
          item.top >= item.start - 2 && item.top < page.clientHeight);
        selectSection((requested || last).link.hash);
        return;
      }
      const visible = positions.filter(item => item.top <= item.start + 5 && item.bottom > padding);
      // Two findings can share a row. Keep the one the visitor explicitly opened.
      const active = visible.find(item => item.link.hash === location.hash) ||
        visible.sort((a,b) => b.top-a.top)[0];
      selectSection(active?.link.hash);
    }, 100);
  }, {passive:true});

  const formerReplayAnchors = [
    'sample', 'sample-title', 'sample-result', 'sample-steps', 'incident-goal-drift',
    'setup', 'p1-summary-title', 'p2-summary-title', 'threat-models', 'threat-models-title'
  ];

  const findingsRoot = document.getElementById('findings');
  const studyTabs = [...document.querySelectorAll('[data-study-tab]')];
  const studyPanels = [...document.querySelectorAll('[data-study-panel]')];
  function setActiveStudy(study, syncViewer = false) {
    if (!studyTabs.length || !['swarmform', 'swarmharm'].includes(study)) return;
    findingsRoot?.setAttribute('data-active-study', study);
    studyTabs.forEach(tab => {
      const active = tab.dataset.studyTab === study;
      tab.setAttribute('aria-selected', String(active));
    });
    studyPanels.forEach(panel => {
      panel.hidden = panel.dataset.studyPanel !== study;
    });
    if (syncViewer) {
      const targetLink = document.querySelector(study === 'swarmform'
        ? '.featured-pill[data-show-case="form-source-sharing"]'
        : '.featured-pill[data-show-case="harm-knowledge-grader"]');
      targetLink?.click();
    }
  }
  studyTabs.forEach(tab => {
    tab.addEventListener('click', () => setActiveStudy(tab.dataset.studyTab, false));
  });
  function syncStudyForElement(element) {
    const panel = element?.closest?.('[data-study-panel]');
    if (panel) setActiveStudy(panel.dataset.studyPanel, false);
  }
  if (!document.querySelector('.trajectory-viewer') && document.getElementById('findings')) {
    const query = new URLSearchParams(location.search);
    if (query.has('case') || location.hash === '#trajectory' || location.hash === '#swarm-trajectory' || location.hash === '#timeline') {
      location.replace('traces/' + location.search + location.hash);
      return;
    }
  }

  function revealTarget(hash, scroll = false) {
    if (!hash || hash === '#') return;
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    // Preserve shared links when sections are renamed or consolidated.
    const original = id;
    if (id === 'team' || ['contact', 'contact-title', 'stay-updated', 'updates-title'].includes(id)) {
      return;
    }
    if (["research", "rq1", "rq2", "rq3"].includes(id)) id = "tldr";
    if (formerReplayAnchors.includes(id) || id.startsWith('setup-') || id.startsWith('case-')) id = 'trajectory';
    const target = document.getElementById(id);
    if (!target) return;
    syncStudyForElement(target);
    if (target instanceof HTMLDetailsElement) target.open = true;
    let parent = target.parentElement;
    while (parent) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
      parent = parent.parentElement;
    }
    if (id !== original) {
      history.replaceState(null, '', `#${id}`);
      selectSection(`#${id}`);
    }
    // Direct fragment navigation may happen before a closed disclosure opens.
    if (scroll) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  }

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', () => revealTarget(link.hash));
  });
  window.addEventListener('hashchange', () => revealTarget(location.hash, true));
  revealTarget(location.hash, true);

  function syncKimiLogos() {
    const isDark = document.documentElement.dataset.theme === 'dark';
    const rootPrefix = document.body?.dataset?.root || '';
    const target = `${rootPrefix}static/images/models/${isDark ? 'kimi-dark' : 'kimi-light'}.svg?v=1`;
    document.querySelectorAll('[data-kimi-logo]').forEach(img => {
      if (img.getAttribute('src') !== target) img.setAttribute('src', target);
    });
  }
  syncKimiLogos();
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(syncKimiLogos).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

})();
