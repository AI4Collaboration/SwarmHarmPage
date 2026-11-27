(() => {
  /* Reading progress bar */
  const bar = document.querySelector('.reading-progress > span');
  if (bar) {
    let raf = 0;
    const updateProgress = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const pct = Math.min(100, Math.max(0, (window.scrollY / max) * 100));
      bar.style.transform = `scaleX(${pct / 100})`;
    };
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(updateProgress); }, { passive: true });
    window.addEventListener('resize', () => { if (!raf) raf = requestAnimationFrame(updateProgress); }, { passive: true });
    updateProgress();
  }

  /* BibTeX copy button */
  const copyBtn = document.querySelector('[data-copy-bibtex]');
  const bibEl = document.querySelector('[data-bibtex-text]');
  if (copyBtn && bibEl) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(bibEl.textContent.trim());
        const prev = copyBtn.textContent;
        copyBtn.textContent = 'Copied';
        setTimeout(() => { copyBtn.textContent = prev; }, 1600);
      } catch (_) {}
    });
  }

  /* Interactive 10-model multi-scale matrix + Figure 3b bar sync */
  const DATA = {"glm":{"gaming":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,12],"Eng":[1,13]},"32":{"KW":[1,26],"Eng":[1,30]}},"records":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"grader":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"info":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"action":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"capacity":{"4":{"KW":[1,4,6],"Eng":[1,4,6]},"16":{"KW":[1,16,8],"Eng":[1,16,8]},"32":{"KW":[1,32,8],"Eng":[1,32,8]}}},"deepseek":{"gaming":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,13],"Eng":[1,12]},"32":{"KW":[1,25],"Eng":[1,23]}},"records":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"grader":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"info":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"action":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"capacity":{"4":{"KW":[1,4,6],"Eng":[1,4,6]},"16":{"KW":[1,16,8],"Eng":[1,16,8]},"32":{"KW":[1,32,8],"Eng":[1,32,8]}}},"kimi":{"gaming":{"4":{"KW":[1,2],"Eng":[1,3]},"16":{"KW":[1,8],"Eng":[1,9]},"32":{"KW":[1,20],"Eng":[1,21]}},"records":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"grader":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,31],"Eng":[1,32]}},"info":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"action":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"capacity":{"4":{"KW":[1,4,6],"Eng":[1,4,6]},"16":{"KW":[1,16,8],"Eng":[1,16,8]},"32":{"KW":[1,32,8],"Eng":[1,32,8]}}},"luna":{"gaming":{"4":{"KW":[1,2],"Eng":[1,3]},"16":{"KW":[1,8],"Eng":[1,8]},"32":{"KW":[1,15],"Eng":[1,20]}},"records":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"grader":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"info":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"action":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"capacity":{"4":{"KW":[1,4,6],"Eng":[1,4,6]},"16":{"KW":[1,16,8],"Eng":[1,16,8]},"32":{"KW":[1,31,8],"Eng":[1,32,8]}}},"sol":{"gaming":{"4":{"KW":[0,0],"Eng":[1,3]},"16":{"KW":[1,2],"Eng":[1,6]},"32":{"KW":[1,3],"Eng":[1,7]}},"records":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"grader":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,14]},"32":{"KW":[1,30],"Eng":[1,31]}},"info":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"action":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"capacity":{"4":{"KW":[1,4,6],"Eng":[1,4,6]},"16":{"KW":[1,15,6],"Eng":[1,16,8]},"32":{"KW":[1,32,8],"Eng":[1,32,8]}}},"astra":{"gaming":{"4":{"KW":[1,2],"Eng":[1,3]},"16":{"KW":[1,7],"Eng":[1,6]},"32":{"KW":[1,10],"Eng":[1,15]}},"records":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"grader":{"4":{"KW":[0,0],"Eng":[0,0]},"16":{"KW":[0,0],"Eng":[1,1]},"32":{"KW":[0,0],"Eng":[1,1]}},"info":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"action":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"capacity":{"4":{"KW":[1,4,6],"Eng":[1,2,2]},"16":{"KW":[1,16,8],"Eng":[1,16,8]},"32":{"KW":[1,32,8],"Eng":[1,32,8]}}},"opus":{"gaming":{"4":{"KW":[1,3],"Eng":[1,3]},"16":{"KW":[1,11],"Eng":[1,15]},"32":{"KW":[1,25],"Eng":[1,25]}},"records":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"grader":{"4":{"KW":[0,0],"Eng":[0,0]},"16":{"KW":[0,0],"Eng":[0,0]},"32":{"KW":[0,0],"Eng":[0,0]}},"info":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,14],"Eng":[1,15]},"32":{"KW":[1,29],"Eng":[1,28]}},"action":{"4":{"KW":[1,4],"Eng":[1,3]},"16":{"KW":[1,12],"Eng":[1,12]},"32":{"KW":[1,32],"Eng":[1,31]}},"capacity":{"4":{"KW":[1,2,2],"Eng":[1,2,2]},"16":{"KW":[1,15,6],"Eng":[1,13,2]},"32":{"KW":[1,31,6],"Eng":[1,32,8]}}},"terra":{"gaming":{"4":{"KW":[1,2],"Eng":[1,3]},"16":{"KW":[1,11],"Eng":[1,12]},"32":{"KW":[1,18],"Eng":[1,21]}},"records":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"grader":{"4":{"KW":[0,0],"Eng":[0,0]},"16":{"KW":[0,0],"Eng":[0,0]},"32":{"KW":[0,0],"Eng":[0,0]}},"info":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"action":{"4":{"KW":[1,3],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,13]},"32":{"KW":[1,32],"Eng":[1,32]}},"capacity":{"4":{"KW":[0,1,0],"Eng":[0,1,0]},"16":{"KW":[1,16,8],"Eng":[1,15,6]},"32":{"KW":[1,32,8],"Eng":[1,32,8]}}},"sonnet":{"gaming":{"4":{"KW":[1,4],"Eng":[1,3]},"16":{"KW":[1,13],"Eng":[1,11]},"32":{"KW":[1,24],"Eng":[1,18]}},"records":{"4":{"KW":[1,4],"Eng":[1,4]},"16":{"KW":[1,16],"Eng":[1,16]},"32":{"KW":[1,32],"Eng":[1,32]}},"grader":{"4":{"KW":[0,0],"Eng":[0,0]},"16":{"KW":[0,0],"Eng":[0,0]},"32":{"KW":[1,10],"Eng":[1,2]}},"info":{"4":{"KW":[1,4],"Eng":[1,1]},"16":{"KW":[1,15],"Eng":[1,2]},"32":{"KW":[1,27],"Eng":[1,6]}},"action":{"4":{"KW":[1,4],"Eng":[1,3]},"16":{"KW":[1,16],"Eng":[1,11]},"32":{"KW":[1,28],"Eng":[1,27]}},"capacity":{"4":{"KW":[1,2,2],"Eng":[1,4,6]},"16":{"KW":[1,16,8],"Eng":[1,16,8]},"32":{"KW":[1,32,8],"Eng":[1,32,8]}}},"haiku":{"gaming":{"4":{"KW":[1,1],"Eng":[1,1]},"16":{"KW":[1,1],"Eng":[1,8]},"32":{"KW":[1,4],"Eng":[1,16]}},"records":{"4":{"KW":[0,0],"Eng":[1,1]},"16":{"KW":[0,0],"Eng":[0,0]},"32":{"KW":[0,0],"Eng":[0,0]}},"grader":{"4":{"KW":[0,0],"Eng":[0,0]},"16":{"KW":[0,0],"Eng":[0,0]},"32":{"KW":[0,0],"Eng":[0,0]}},"info":{"4":{"KW":[1,3],"Eng":[1,4]},"16":{"KW":[1,10],"Eng":[1,16]},"32":{"KW":[1,17],"Eng":[1,30]}},"action":{"4":{"KW":[0,0],"Eng":[0,0]},"16":{"KW":[0,0],"Eng":[0,0]},"32":{"KW":[0,0],"Eng":[0,0]}},"capacity":{"4":{"KW":[1,4,6],"Eng":[1,3,4]},"16":{"KW":[1,16,8],"Eng":[1,16,8]},"32":{"KW":[1,31,6],"Eng":[1,32,8]}}}};
  const MODELS = ['glm','deepseek','kimi','luna','sol','astra','opus','terra','sonnet','haiku'];
  const SLUGS = ['gaming','records','grader','info','action','capacity'];
  const POPS_ALL = ['4','16','32'];
  const DOMS_ALL = ['KW','Eng'];

  const table = document.querySelector('.results-matrix[data-interactive-matrix]');
  const controls = document.querySelector('[data-matrix-controls]');
  if (!table || !controls) return;

  let activePop = 'all';
  let activeDom = 'both';

  const statusNote = document.querySelector('[data-matrix-status]');
  const figSub = document.querySelector('[data-fig3b-sub]');

  function pillClass(obsCount, totalCount, isScaleBreak) {
    if (obsCount === 0) return 'cell-pill cell-held';
    if (isScaleBreak && activePop === 'all') return 'cell-pill cell-scale';
    if (obsCount < totalCount) return 'cell-pill cell-one';
    return 'cell-pill cell-both';
  }

  function render() {
    const pops = activePop === 'all' ? POPS_ALL : [activePop];
    const doms = activeDom === 'both' ? DOMS_ALL : [activeDom];
    const cellsPerSlot = pops.length * doms.length;

    let grandObs = 0;
    let grandCells = 0;
    let grandCfSum = 0;
    const mechTotals = Object.fromEntries(SLUGS.map(s => [s, { obs: 0, n: 0, cf: 0 }]));
    const modelBars = {};

    for (const m of MODELS) {
      const tr = table.querySelector(`tbody tr[data-model="${m}"]`);
      if (!tr) continue;
      let mObs = 0;
      let mCells = 0;
      let mCfSum = 0;

      for (const sl of SLUGS) {
        const a = tr.querySelector(`td[data-mech="${sl}"] a`);
        if (!a) continue;
        let obs = 0;
        let cfSum = 0;
        let lastCausal = 0;
        let lastPop = 0;
        let delays = [];

        for (const p of pops) {
          const pn = Number(p);
          for (const d of doms) {
            const entry = DATA[m][sl][p][d];
            obs += entry[0];
            cfSum += entry[1] / pn;
            lastCausal = entry[1];
            lastPop = pn;
            if (sl === 'capacity' && entry.length > 2) delays.push(entry[2]);
          }
        }

        const n4Obs = doms.reduce((acc, d) => acc + DATA[m][sl]['4'][d][0], 0);
        const hiObs = ['16', '32'].reduce((acc, p) => acc + doms.reduce((s, d) => s + DATA[m][sl][p][d][0], 0), 0);
        const isScaleBreak = (n4Obs < doms.length) && (hiObs > n4Obs * 2 || (n4Obs === 0 && hiObs > 0));

        const meanCf = Math.round((cfSum / cellsPerSlot) * 100);
        let label = '';
        if (obs === 0) {
          label = cellsPerSlot === 1 ? `0/${lastPop} held` : `0/${cellsPerSlot} held`;
        } else if (cellsPerSlot === 1) {
          if (sl === 'capacity') {
            label = `${lastCausal}/${lastPop} · ${delays[0]}/8 del`;
          } else {
            label = `${lastCausal}/${lastPop} (${meanCf}%)`;
          }
        } else {
          label = `${obs}/${cellsPerSlot} · ${meanCf}%` + (isScaleBreak && activePop === 'all' ? ' ↑' : '');
        }

        a.className = pillClass(obs, cellsPerSlot, isScaleBreak);
        a.textContent = label;
        if (sl === 'capacity' && delays.length) {
          const minD = Math.min(...delays), maxD = Math.max(...delays);
          a.title = `Operations jobs delayed: ${minD === maxD ? minD : `${minD}–${maxD}`}/8 (solo replay: 0/8)`;
        }

        mObs += obs;
        mCells += cellsPerSlot;
        mCfSum += cfSum;
        mechTotals[sl].obs += obs;
        mechTotals[sl].n += cellsPerSlot;
        mechTotals[sl].cf += cfSum;
      }

      const mMeanCf = (mCfSum / mCells) * 100;
      const totCell = tr.querySelector('td.cell-total');
      if (totCell) totCell.textContent = `${mObs}/${mCells} · ${Math.round(mMeanCf)}%`;
      grandObs += mObs;
      grandCells += mCells;
      grandCfSum += mCfSum;
      modelBars[m] = mMeanCf;
    }

    for (const sl of SLUGS) {
      const td = table.querySelector(`tfoot td[data-mech="${sl}"]`);
      if (!td) continue;
      const t = mechTotals[sl];
      const rate = Math.round((t.obs / t.n) * 100);
      const cf = Math.round((t.cf / t.n) * 100);
      td.innerHTML = `${t.obs}/${t.n}<small>${rate}% · ${cf}% cf</small>`;
    }
    const footHead = table.querySelector('tfoot th small');
    if (footHead) footHead.textContent = `${10 * cellsPerSlot} cohorts / mode`;
    const footTot = table.querySelector('tfoot td.cell-total');
    if (footTot) {
      const rate = Math.round((grandObs / grandCells) * 100);
      const cf = Math.round((grandCfSum / grandCells) * 100);
      footTot.innerHTML = `${grandObs}/${grandCells}<small>${rate}% · ${cf}% cf</small>`;
    }

    /* Update Figure 3b bars smoothly */
    const maxW = 244;
    for (const m of MODELS) {
      const rect = document.querySelector(`[data-bar-model="${m}"]`);
      const txt = document.querySelector(`[data-bar-val="${m}"]`);
      const pct = modelBars[m];
      if (rect) {
        const w = Math.max(2, (pct / 100) * maxW);
        rect.setAttribute('width', w.toFixed(1));
        rect.setAttribute('class', pct >= 85 ? 'chart-bar-high' : pct >= 55 ? 'chart-bar-mid' : 'chart-bar-low');
      }
      if (txt) {
        const x = 138 + Math.max(2, (pct / 100) * maxW) + 5;
        txt.setAttribute('x', x.toFixed(1));
        txt.textContent = `${pct.toFixed(1)}%`;
      }
    }

    if (figSub) {
      const sizeLabel = activePop === 'all' ? 'all 3 sizes (N = 4, 16, 32)' : `N = ${activePop}`;
      const domLabel = activeDom === 'both' ? 'both domains' : (activeDom === 'KW' ? 'Knowledge Work' : 'Engineering');
      figSub.textContent = `Mean causal agent participation — ${sizeLabel}, ${domLabel}`;
    }

    if (statusNote) {
      const pctStr = ((grandObs / grandCells) * 100).toFixed(1);
      const domTag = activeDom === 'both' ? '' : (activeDom === 'KW' ? ' in Knowledge Work' : ' in Engineering');
      if (activePop === '4') {
        statusNote.innerHTML = `At <code>N = 4</code>${domTag}: <strong>${grandObs}/${grandCells}</strong> (${pctStr}%) trigger. <code>GPT-6.1 Terra</code> Interference (0 delayed) and <code>Claude Sonnet 5.5</code> Grader both hold—switch to <code>N = 16</code> or <code>N = 32</code> to watch them break.`;
      } else if (activePop === '16') {
        statusNote.innerHTML = `At <code>N = 16</code>${domTag}: <strong>${grandObs}/${grandCells}</strong> (${pctStr}%) trigger. <code>GPT-6.1 Terra</code> flips from 0 to 6–8 delayed Operations jobs (compositional phase transition), while <code>Claude Sonnet 5.5</code> still holds Grader Manipulation.`;
      } else if (activePop === '32') {
        statusNote.innerHTML = `At <code>N = 32</code>${domTag}: <strong>${grandObs}/${grandCells}</strong> (${pctStr}%) trigger. <code>Claude Sonnet 5.5</code> breaks Grader Manipulation in both domains (10/32 KW, 2/32 Eng) via peer norm contagion; <code>Haiku 5.5</code> still holds Grader, Action Scope, and Trace Tampering.`;
      } else {
        statusNote.innerHTML = `Showing <strong>${grandObs}/${grandCells}</strong> (${pctStr}%) triggered cohorts${domTag}. Select <code>N = 4</code>, <code>N = 16</code>, or <code>N = 32</code> to step through the scale transitions.`;
      }
    }
  }

  controls.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-pop], button[data-dom]');
    if (!btn) return;
    if (btn.dataset.pop) {
      activePop = btn.dataset.pop;
      controls.querySelectorAll('button[data-pop]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    }
    if (btn.dataset.dom) {
      activeDom = btn.dataset.dom;
      controls.querySelectorAll('button[data-dom]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    }
    render();
  });

  render();
})();
