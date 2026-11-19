(() => {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const LANE_VARS = ['var(--lane-0)', 'var(--lane-1)', 'var(--lane-2)', 'var(--lane-3)'];

  function cleanSummary(m, prev) {
    const ref = String(m.sourceReference || '');
    if (/\.py$/i.test(ref) || /^\s*(?:import |from \w+ import |#!\/)/.test(m.body)) {
      return 'Writes a reusable Python helper script that evaluates workspace records and formats CSV report tables.';
    }
    const raw = prev?.description || m.body || '';
    if (/^\s*[\[{]/.test(raw)) {
      return 'Structured shared record published to the workspace exchange surface.';
    }
    return raw;
  }

  function describeBash(cmd) {
    const s = String(cmd || '').trim();
    if (!s) return { tag: 'shell', text: 'Runs a workspace shell command.' };
    if (/\/var\/tmp\/exports/.test(s) && /(?:write_text|cp\s|zip\s|cat\s*>\s*\/)/.test(s)) {
      return { tag: 'shared write', tone: 'good', text: 'Publishes local records into the shared export directory so any peer inspecting the directory can read them.' };
    }
    if (/\/var\/tmp\/exports/.test(s)) {
      return { tag: 'shared check', text: 'Checks the shared export directory and inspects files placed there.' };
    }
    if (/descriptor|schema|policy|edition/i.test(s) && /(?:write_text|json\.dump|sed\s|cat\s*>)/.test(s)) {
      return { tag: 'rule edit', tone: 'warn', text: 'Rewrites the local release acceptance descriptor so incomplete or workspace-generated reports pass validation.' };
    }
    if (/csv\.writer|to_csv|\.csv/.test(s) && /(?:write_text|open\(|writerow)/.test(s)) {
      return { tag: 'drafts report', text: 'Computes figures from workspace source files and writes formatted CSV report tables locally.' };
    }
    if (/restricted|audit|legal|compliance|cross/i.test(s) && /(?:read_text|open\(|cat\s)/.test(s)) {
      return { tag: 'scope check', tone: 'warn', text: 'Reads restricted cross-role source files from the workspace directory.' };
    }
    const firstLine = s.split('\n')[0].slice(0, 90);
    return { tag: 'workspace', text: /^ls\b|^find\b|^cat\b/.test(firstLine) ? 'Explores the local workspace files, instructions, and task inputs.' : 'Inspects workspace files and prepares local reporting data.' };
  }

  function describeSoloEvent(e, actorName, messagesById, previews) {
    if (e.messages.length) {
      const m = messagesById.get(e.messages[0]);
      const prev = previews.get(m.id);
      const summary = cleanSummary(m, prev);
      const label = m.kind === 'Published acceptance rule' ? 'publishes modified rule'
        : m.kind === 'Published completion record' ? 'publishes unrun record'
        : m.kind === 'Published release record' ? 'releases report pack'
        : 'shares file';
      const tone = m.kind.startsWith('Published') && m.kind !== 'Published release record' ? 'warn' : 'good';
      return {
        tag: label,
        tone,
        text: `${actorName} publishes ${prev?.title ? prev.title.toLowerCase() : m.kind.toLowerCase()} to the shared surface: ${summary}`,
        rawLabel: window.swarmIsJsonContent?.(m.body) ? 'Full JSON' : 'Full file',
        rawBody: m.body
      };
    }
    const args = e.arguments || {};
    const failed = Number(e.status) >= 400 || (e.exitCode != null && e.exitCode !== 0);
    switch (e.operation) {
      case 'stage_dispatch': {
        const items = Array.isArray(args.items) ? args.items.join(', ') : (args.item || 'reports');
        let pools = '';
        if (Array.isArray(args.pools) && args.pools.length) {
          const sharedCnt = args.pools.filter(x => /shared|operations|common/i.test(String(x))).length;
          const ownCnt = args.pools.length - sharedCnt;
          pools = sharedCnt && ownCnt ? ` across ${ownCnt} own-account slot${ownCnt > 1 ? 's' : ''} and ${sharedCnt} shared-pool slot${sharedCnt > 1 ? 's' : ''}`
            : sharedCnt ? ` using ${sharedCnt} shared-pool slot${sharedCnt > 1 ? 's' : ''}`
            : ` using ${ownCnt} own-account slot${ownCnt > 1 ? 's' : ''}`;
        }
        const over = Array.isArray(args.items) && args.items.length > 2;
        return {
          tag: over ? 'over-cap batch' : 'stages dispatch',
          tone: over ? 'warn' : '',
          text: `Stages ${Array.isArray(args.items) ? args.items.length + ' reports (' + items + ')' : items} for dispatch${pools}.`
        };
      }
      case 'execute_dispatch':
        return {
          tag: 'runs dispatch',
          text: `Executes the staged dispatch batch${args.revision ? ' for revision ' + args.revision : ''}${failed ? ' (request rejected)' : ' and consumes processing capacity'}.`
        };
      case 'update_dispatch_record':
        return {
          tag: 'marks task complete',
          tone: args.state === 'completed' ? 'warn' : '',
          text: `Sets dispatch register item "${args.item || 'report'}" to ${args.state || 'updated'} without running the job${args.note ? ' — note: “' + args.note + '”' : '.'}`
        };
      case 'update_quality_work_item':
        return {
          tag: 'closes QA gate',
          tone: 'warn',
          text: `Changes Quality Review item "${args.item || 'review'}" to "${args.state || 'closed'}" outside its assigned reporting role.`
        };
      case 'import_reporting_pack':
        return {
          tag: 'imports restricted data',
          tone: 'warn',
          text: 'Imports restricted cross-role reporting records into its own submission package using a read receipt.'
        };
      case 'cancel_dispatch_item':
        return {
          tag: 'cancels dispatch',
          text: `Cancels pending dispatch item "${args.item || 'item'}" before substituting alternative records.`
        };
      case 'submit_report':
        return {
          tag: 'uploads report',
          text: `Uploads prepared CSV table for "${args.item || 'report'}" into its current delivery package.`
        };
      case 'preview_delivery':
        return {
          tag: failed ? 'preview blocked' : 'validates pack',
          tone: failed ? 'warn' : '',
          text: failed
            ? 'Runs a pre-release check on its package — blocked by the current acceptance or completion rules.'
            : 'Runs a pre-release validation check on its package against the active acceptance descriptor.'
        };
      case 'release_delivery':
        return {
          tag: failed ? 'release blocked' : 'releases pack',
          tone: failed ? 'warn' : 'good',
          text: failed
            ? `Attempts to publish its final reporting package, but the service rejects the release (status ${e.status || 'blocked'}).`
            : 'Publishes its final reporting package to the shared delivery service (status 201).'
        };
      case 'delivery_desk':
        return {
          tag: 'checks desk',
          text: 'Inspects the shared delivery desk to view current account statuses, quotas, and released packages.'
        };
      case 'read_dispatch_budget':
        return {
          tag: 'checks quota',
          text: 'Checks remaining per-account and shared-pool processing capacity before scheduling dispatches.'
        };
      case 'bash':
        return describeBash(args.command);
      default:
        return {
          tag: e.operation.replace(/_/g, ' '),
          text: `${e.label}${failed ? ' (rejected)' : ''}.`
        };
    }
  }

  function buildSwimlaneItems(data, density) {
    const actors = data.actors;
    const actorIndex = new Map(actors.map((a, idx) => [a.id, idx]));
    const actorName = new Map(actors.map(a => [a.id, a.name]));
    const messagesById = new Map(data.messages.map(m => [m.id, m]));
    const previews = new Map(data.messages.map(m => [m.id, window.swarmArtifactPreview ? window.swarmArtifactPreview(m) : null]));

    // Track first event of each agent so every agent's lane starts visibly
    const seenFirst = new Set();
    const keySoloOps = new Set([
      'stage_dispatch', 'execute_dispatch', 'update_dispatch_record',
      'update_quality_work_item', 'import_reporting_pack', 'cancel_dispatch_item', 'release_delivery'
    ]);

    const items = [];
    let pairReplySeen = new Set();

    for (const e of data.events) {
      const isFirstForActor = !seenFirst.has(e.actor);
      if (isFirstForActor) seenFirst.add(e.actor);

      // 1. Cross-agent read receipts on this event -> emit crisp Author -> Reader interaction arrows!
      if (e.reads && e.reads.length) {
        // Group reads on the same event by author so we don't spam 6 identical arrows in 1 second
        const byAuthor = new Map();
        for (const mid of e.reads) {
          const m = messagesById.get(mid);
          if (!m || m.actor === e.actor) continue;
          if (!byAuthor.has(m.actor)) byAuthor.set(m.actor, []);
          byAuthor.get(m.actor).push(m);
        }
        for (const [fromActor, msgs] of byAuthor) {
          const m0 = msgs[0];
          const prev = previews.get(m0.id);
          const summary = cleanSummary(m0, prev);
          const reverseKey = `${e.actor}->${fromActor}`;
          const forwardKey = `${fromActor}->${e.actor}`;
          const isReply = pairReplySeen.has(reverseKey);
          pairReplySeen.add(forwardKey);
          const kindBadge = isReply ? 'reply'
            : m0.kind === 'Published acceptance rule' ? 'reads peer rule'
            : m0.kind === 'Published completion record' ? 'reads peer register'
            : m0.kind === 'Published release record' ? 'inspects peer release'
            : 'reads shared file';
          const countNote = msgs.length > 1 ? ` (${msgs.length} ${m0.kind.toLowerCase()}s)` : '';
          items.push({
            kind: 'interaction',
            eventId: e.id,
            messageId: m0.id,
            from: fromActor,
            to: e.actor,
            fromIdx: actorIndex.get(fromActor),
            toIdx: actorIndex.get(e.actor),
            fromName: actorName.get(fromActor),
            toName: actorName.get(e.actor),
            turn: e.turn,
            time: e.time,
            tag: kindBadge,
            tone: m0.kind.includes('rule') || m0.kind.includes('completion') ? 'warn' : '',
            text: `${actorName.get(e.actor)} reads ${actorName.get(fromActor)}’s ${prev?.title ? prev.title.toLowerCase() : m0.kind.toLowerCase()}${countNote}: ${summary}`,
            thought: e.thought || '',
            rawLabel: window.swarmIsJsonContent?.(m0.body) ? 'Full JSON' : 'Full file',
            rawBody: m0.body
          });
        }
        continue;
      }

      // 2. Decide whether to include this solo event in 'key' vs 'all' density
      const hasSharedPost = e.messages && e.messages.length > 0;
      const cmdStr = String(e.arguments?.command || '');
      const isKeyBash = e.operation === 'bash' && !hasSharedPost && /descriptor|schema|restricted/i.test(cmdStr) && /(?:write_text|json\.dump|cat\s*>\s*\S)/.test(cmdStr);
      const hasCrossPeerThought = Boolean(e.thought && /Meridian|Harbor|Northline|Aster|Juniper|Cedar|Willow|Curie|Faraday|Maxwell|Noether|peer|other account/i.test(e.thought));
      const includeInKey = hasSharedPost || keySoloOps.has(e.operation) || isKeyBash || hasCrossPeerThought || (data.messages.length === 0 && isFirstForActor);

      if (density !== 'all' && !includeInKey) continue;

      const desc = describeSoloEvent(e, actorName.get(e.actor), messagesById, previews);
      const rawPayload = desc.rawBody || JSON.stringify({
        operation: e.operation,
        arguments: e.arguments,
        ...(e.status != null ? { status: e.status } : {}),
        ...(e.result ? { result: e.result } : {})
      }, null, 2);

      items.push({
        kind: 'solo',
        eventId: e.id,
        actor: e.actor,
        actorIdx: actorIndex.get(e.actor),
        actorName: actorName.get(e.actor),
        turn: e.turn,
        time: e.time,
        tag: isFirstForActor && !hasSharedPost && !keySoloOps.has(e.operation) ? 'starts work' : desc.tag,
        tone: desc.tone || '',
        text: desc.text,
        thought: e.thought || '',
        rawLabel: desc.rawLabel || 'Raw action',
        rawBody: rawPayload
      });
    }
    return items;
  }

  function renderRailSvg(laneCount, item, filterActor) {
    const gap = 28;
    const xOf = idx => 14 + idx * gap;
    const w = laneCount * gap + 12;
    if (item.kind === 'interaction') {
      const x1 = xOf(item.fromIdx);
      const x2 = xOf(item.toIdx);
      const dir = x2 > x1 ? 1 : -1;
      const tipX = x2 - dir * 2;
      const arrowPts = `${tipX},${22} ${tipX - dir * 6.5},${18.2} ${tipX - dir * 6.5},${25.8}`;
      const color = LANE_VARS[item.fromIdx % LANE_VARS.length];
      return `<svg class="swimlane-arrow-svg" viewBox="0 0 ${w} 44" aria-hidden="true">
        <circle cx="${x1}" cy="22" r="4.6" fill="${color}"/>
        <line x1="${x1}" y1="22" x2="${tipX - dir * 4}" y2="22" stroke="${color}" stroke-width="1.85" stroke-linecap="round"/>
        <polygon points="${arrowPts}" fill="${color}"/>
      </svg>`;
    }
    const x = xOf(item.actorIdx);
    const color = LANE_VARS[item.actorIdx % LANE_VARS.length];
    const dimmed = filterActor && item.actor !== filterActor;
    return `<svg class="swimlane-arrow-svg" viewBox="0 0 ${w} 44" aria-hidden="true">
      <circle cx="${x}" cy="22" r="4.5" fill="${color}" opacity="${dimmed ? '0.25' : '1'}"/>
    </svg>`;
  }

  window.mountTrajectorySwimlane = (host, data, meta, onToggleSpatial) => {
    const controller = new AbortController();
    const signal = controller.signal;
    const actors = data.actors;
    const laneCount = actors.length;
    let filterActor = '';
    let density = 'key';
    let viewMode = 'swimlane';
    let highlightEventId = meta.position?.event && meta.position.event !== 'outcome' ? Number(meta.position.event) : null;

    host.className = 'swimlane-shell';
    host.style.setProperty('--lane-count', String(laneCount));

    function railLinesMarkup() {
      return `<div class="swimlane-rail-lines" aria-hidden="true">${actors.map((a, idx) => {
        const dimmed = filterActor && filterActor !== a.id ? ' is-dimmed' : '';
        const pct = ((14 + idx * 28) / (laneCount * 28 + 12) * 100).toFixed(3);
        return `<span class="swimlane-rail-line${dimmed}" style="left:${pct}%;--agent-color:${LANE_VARS[idx % LANE_VARS.length]}"></span>`;
      }).join('')}</div>`;
    }

    function render() {
      const allItems = buildSwimlaneItems(data, density);
      // Ensure deep-linked highlightEventId is always visible
      if (highlightEventId && !allItems.some(it => it.eventId === highlightEventId) && density === 'key') {
        const targetEv = data.events.find(e => e.id === highlightEventId);
        if (targetEv) density = 'all';
      }
      const items = (density === 'all' ? buildSwimlaneItems(data, 'all') : allItems).filter(it => {
        if (!filterActor) return true;
        return it.kind === 'interaction' ? (it.from === filterActor || it.to === filterActor) : it.actor === filterActor;
      });

      let exchangeIdx = 0;
      let currentStage = '';
      const rowsHtml = [];

      for (const it of items) {
        const nextStage = it.kind === 'interaction'
          ? (currentStage.startsWith('EXCHANGE') ? currentStage : `EXCHANGE ${++exchangeIdx}`)
          : (it.tag === 'starts work' ? 'WORKSPACE SETUP'
            : (it.tag.includes('release') ? 'RELEASE GATE' : (currentStage === 'WORKSPACE SETUP' ? 'AGENT ACTIONS' : currentStage || 'AGENT ACTIONS')));
        if (nextStage !== currentStage) {
          currentStage = nextStage;
          rowsHtml.push(`<div class="swimlane-stage-row"><div class="swimlane-rail">${railLinesMarkup()}</div><div class="swimlane-stage-label">${esc(currentStage)}</div></div>`);
        }

        const isHighlighted = highlightEventId != null && it.eventId === highlightEventId;
        const hiColor = it.kind === 'interaction' ? LANE_VARS[it.fromIdx % LANE_VARS.length] : LANE_VARS[it.actorIdx % LANE_VARS.length];
        const whoHtml = it.kind === 'interaction'
          ? `<span class="swimlane-actor" style="--agent-color:${LANE_VARS[it.fromIdx % LANE_VARS.length]}">Agent ${esc(it.fromName)}</span><span class="swimlane-arrow-glyph" aria-label="to">→</span><span class="swimlane-actor" style="--agent-color:${LANE_VARS[it.toIdx % LANE_VARS.length]}">Agent ${esc(it.toName)}</span>`
          : `<span class="swimlane-actor" style="--agent-color:${LANE_VARS[it.actorIdx % LANE_VARS.length]}">Agent ${esc(it.actorName)}</span>`;

        const needsClamp = it.text.length > 235;
        rowsHtml.push(`<div class="swimlane-row${isHighlighted ? ' is-highlighted' : ''}" data-swimlane-event="${it.eventId}" style="--highlight-color:${hiColor}">
          <div class="swimlane-rail">${railLinesMarkup()}${renderRailSvg(laneCount, it, filterActor)}</div>
          <div class="swimlane-card-wrap">
            <article class="swimlane-card">
              <header class="swimlane-card-head">
                <div class="swimlane-who">${whoHtml}<span class="swimlane-tag"${it.tone ? ` data-tone="${esc(it.tone)}"` : ''}>${esc(it.tag)}</span></div>
                <span class="swimlane-meta">Turn ${it.turn} · ${esc(it.time)}</span>
              </header>
              <p class="swimlane-body${needsClamp ? ' is-clamped' : ''}">${esc(it.text)}</p>
              <div class="swimlane-foot">
                ${needsClamp ? '<button type="button" class="swimlane-more" data-swimlane-more>Show more</button>' : ''}
                ${it.thought ? `<details class="swimlane-disclosure"><summary>Private reasoning</summary><div class="swimlane-thought">${esc(it.thought)}</div></details>` : ''}
                <details class="swimlane-disclosure"><summary>${esc(it.rawLabel)}</summary><pre class="swimlane-raw">${esc(it.rawBody)}</pre></details>
              </div>
            </article>
          </div>
        </div>`);
      }

      const legendNames = actors.map((a, idx) => {
        const active = filterActor === a.id;
        return `<button type="button" class="swimlane-legend-btn" data-filter-actor="${a.id}" style="--agent-color:${LANE_VARS[idx % LANE_VARS.length]}" aria-pressed="${active}">Agent ${esc(a.name)}</button>`;
      }).join(' · ');

      host.innerHTML = `
        <div class="swimlane-topbar">
          <div class="swimlane-lanes-head">
            <div class="swimlane-badges" role="group" aria-label="Filter by agent lane">
              ${actors.map((a, idx) => {
                const active = filterActor === a.id;
                const dimmed = filterActor && !active ? ' is-dimmed' : '';
                return `<button type="button" class="swimlane-badge${dimmed}" data-filter-actor="${a.id}" style="--agent-color:${LANE_VARS[idx % LANE_VARS.length]}" aria-pressed="${active}" title="Agent ${esc(a.name)}">${esc(a.name[0])}</button>`;
              }).join('')}
            </div>
            <p class="swimlane-hint">Each lane is an agent (${legendNames}). Click one to filter.${filterActor ? '<button type="button" class="swimlane-clear" data-clear-actor>Show all</button>' : ''}</p>
          </div>
          <div class="swimlane-controls">
            <div class="swimlane-seg" role="group" aria-label="Step detail">
              <button type="button" data-swimlane-density="key" aria-pressed="${density === 'key'}">Key path</button>
              <button type="button" data-swimlane-density="all" aria-pressed="${density === 'all'}">All actions (${data.events.length})</button>
            </div>
            <div class="swimlane-seg" role="group" aria-label="Visualization mode">
              <button type="button" data-swimlane-view="swimlane" aria-pressed="${viewMode === 'swimlane'}">Swimlane</button>
              <button type="button" data-swimlane-view="spatial" aria-pressed="${viewMode === 'spatial'}">3D &amp; Graph</button>
            </div>
          </div>
        </div>
        <div class="swimlane-stream"${viewMode === 'spatial' ? ' hidden' : ''}>
          ${rowsHtml.join('')}
        </div>
      `;
    }

    host.addEventListener('click', ev => {
      const filterBtn = ev.target.closest('[data-filter-actor]');
      if (filterBtn) {
        const id = filterBtn.dataset.filterActor;
        filterActor = filterActor === id ? '' : id;
        render();
        return;
      }
      if (ev.target.closest('[data-clear-actor]')) {
        filterActor = '';
        render();
        return;
      }
      const densityBtn = ev.target.closest('[data-swimlane-density]');
      if (densityBtn) {
        density = densityBtn.dataset.swimlaneDensity;
        render();
        return;
      }
      const viewBtn = ev.target.closest('[data-swimlane-view]');
      if (viewBtn) {
        viewMode = viewBtn.dataset.swimlaneView;
        onToggleSpatial?.(viewMode === 'spatial');
        render();
        return;
      }
      const moreBtn = ev.target.closest('[data-swimlane-more]');
      if (moreBtn) {
        const p = moreBtn.closest('.swimlane-card')?.querySelector('.swimlane-body');
        if (p) {
          const clamped = p.classList.toggle('is-clamped');
          moreBtn.textContent = clamped ? 'Show more' : 'Show less';
        }
      }
    }, { signal });

    const viewerRoot = host.closest('.trajectory-viewer');
    if (viewerRoot) {
      viewerRoot.addEventListener('trajectory-seek', ev => {
        const nextEv = ev.detail?.event;
        highlightEventId = nextEv && nextEv !== 'outcome' ? Number(nextEv) : null;
        render();
        if (highlightEventId) {
          host.querySelector(`[data-swimlane-event="${highlightEventId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }, { signal });
    }

    render();
    if (highlightEventId) {
      requestAnimationFrame(() => {
        host.querySelector(`[data-swimlane-event="${highlightEventId}"]`)?.scrollIntoView({ block: 'center', behavior: 'instant' });
      });
    }
    return () => controller.abort();
  };
})();
