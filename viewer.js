/* ============================================================
   VIEWER.JS — All viewer mode logic in one place
   Organiser code is never touched by anything in this file.
   ============================================================ */

/* ── State ── */
var _viewerSessionId   = null;
var _viewerLastUpdated = null;
var _viewerPollTimer   = null;
var _viewerSessionMeta = null; // { started_by, created_at, club_name }

/* ============================================================
   ENTRY POINT — called when viewer taps a live session card
   ============================================================ */
async function viewerOpen(sessionId) {
  try {
    const rows = await sbGet('sessions',
      `id=eq.${sessionId}&select=id,rounds_data,players,started_by,created_at,updated_at,status`
    );
    if (!rows || !rows.length) { alert('Session not found.'); return; }

    const sess = rows[0];
    if (!sess.rounds_data || !sess.rounds_data.length) {
      alert('No rounds data yet — try again in a moment.');
      return;
    }

    _viewerSessionId   = sessionId;
    _viewerLastUpdated = sess.updated_at;
    _viewerSessionMeta = {
      started_by:  sess.started_by,
      created_at:  sess.created_at,
      club_name:   (typeof getMyClub === 'function') ? getMyClub().name : ''
    };

    // Load rounds into global allRounds (read-only use)
    allRounds.splice(0, allRounds.length, ...sess.rounds_data);
    currentRoundIndex = allRounds.length - 1;

    // Show rounds page
    _viewerShowPage();

    // Render everything
    viewerRender(sess.rounds_data);

    // Start live poll
    viewerStartPoll();

  } catch (e) {
    console.warn('viewerOpen error:', e.message);
    alert('Could not load session. Check connection.');
  }
}

/* ── Show rounds page cleanly, bypass all organiser guards ── */
function _viewerShowPage() {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');

  // Show rounds page with viewer class
  const roundsPage = document.getElementById('roundsPage');
  if (roundsPage) {
    roundsPage.style.display = 'block';
    roundsPage.classList.add('viewer-page');
  }

  // Activate rounds tab — reset any disabled state from organiser guards
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const roundsBtn = document.getElementById('tabBtnRounds');
  if (roundsBtn) {
    roundsBtn.style.display       = '';
    roundsBtn.style.pointerEvents = 'auto';
    roundsBtn.style.opacity       = '1';
    roundsBtn.removeAttribute('aria-disabled');
    roundsBtn.classList.add('active');
    roundsBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  // Apply viewer-mode class so CSS hides action card, settings panel, etc.
  if (typeof setViewerMode === 'function') setViewerMode(true);

  // Inject viewer sub-tabs if not already present
  _viewerInjectSubTabs();

  if (typeof lastPage !== 'undefined') lastPage = 'dashboardPage';
}

/* ── Inject Summary / Live sub-tabs into roundsPage ── */
function _viewerInjectSubTabs() {
  // Remove existing to avoid duplicates
  const existing = document.getElementById('viewerSubTabs');
  if (existing) existing.remove();

  const titleCard = document.querySelector('#roundsPage .title-card');
  if (!titleCard) return;

  const subTabs = document.createElement('div');
  subTabs.id = 'viewerSubTabs';
  subTabs.className = 'viewer-subtabs';
  subTabs.innerHTML = `
    <button class="viewer-subtab-btn" id="viewerTabLive" onclick="viewerSwitchTab('live')">🏸 Live</button>
    <button class="viewer-subtab-btn" id="viewerTabSummary" onclick="viewerSwitchTab('summary')">📊 Summary</button>
  `;

  // Insert after title-card
  titleCard.insertAdjacentElement('afterend', subTabs);
}

/* ── Switch between Live and Summary sub-tabs ── */
function viewerSwitchTab(tab) {
  const liveBtn    = document.getElementById('viewerTabLive');
  const summaryBtn = document.getElementById('viewerTabSummary');
  const gameResults = document.getElementById('game-results');
  const viewerSummaryDiv = document.getElementById('viewerSummaryContainer');

  if (liveBtn)    liveBtn.classList.toggle('active',    tab === 'live');
  if (summaryBtn) summaryBtn.classList.toggle('active', tab === 'summary');

  if (tab === 'live') {
    if (gameResults)       gameResults.style.display    = '';
    if (viewerSummaryDiv)  viewerSummaryDiv.style.display = 'none';
  } else {
    if (gameResults)       gameResults.style.display    = 'none';
    // Build or show summary container
    let summaryDiv = document.getElementById('viewerSummaryContainer');
    if (!summaryDiv) {
      summaryDiv = document.createElement('div');
      summaryDiv.id = 'viewerSummaryContainer';
      summaryDiv.style.padding = '8px 6px';
      gameResults.insertAdjacentElement('afterend', summaryDiv);
    }
    summaryDiv.style.display = '';
    _viewerRenderSummary(summaryDiv);
  }
}

/* ============================================================
   MAIN RENDER — info bar + leaderboard + rounds
   ============================================================ */
function viewerRender(roundsData) {
  const resultsDiv = document.getElementById('game-results');
  if (!resultsDiv) return;
  resultsDiv.innerHTML = '';
  resultsDiv.classList.add('viewer-rounds');

  // Update title
  const roundTitle = document.getElementById('roundTitle');
  if (roundTitle) {
    const lang = (typeof currentLang !== 'undefined') ? currentLang : 'en';
    const tr   = (typeof translations !== 'undefined') ? translations[lang] : {};
    roundTitle.textContent = (roundsData.length) + ' ' + (tr.rounds || 'Rounds');
  }

  if (!roundsData.length) {
    resultsDiv.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px;">No rounds yet</div>';
    return;
  }

  // 1. Session info bar
  resultsDiv.appendChild(_viewerBuildInfoBar());

  // 2. Leaderboard
  resultsDiv.appendChild(_viewerBuildLeaderboard(roundsData));

  // 3. All rounds — latest first
  for (let i = roundsData.length - 1; i >= 0; i--) {
    resultsDiv.appendChild(_viewerBuildRound(roundsData[i], i, roundsData.length));
  }

  // Default to Live tab active
  const liveBtn = document.getElementById('viewerTabLive');
  const summaryBtn = document.getElementById('viewerTabSummary');
  if (liveBtn)    liveBtn.classList.add('active');
  if (summaryBtn) summaryBtn.classList.remove('active');

  // Hide summary container if switching back from summary
  const summaryDiv = document.getElementById('viewerSummaryContainer');
  if (summaryDiv) summaryDiv.style.display = 'none';
  resultsDiv.style.display = '';
}

/* ============================================================
   INFO BAR — "You are watching" with elapsed time
   ============================================================ */
function _viewerBuildInfoBar() {
  const bar = document.createElement('div');
  bar.className = 'viewer-info-bar';

  const meta = _viewerSessionMeta || {};
  const elapsed = _viewerElapsed(meta.created_at);
  const club    = meta.club_name   || '';
  const starter = meta.started_by  || '';

  bar.innerHTML = `
    <span class="viewer-info-dot"></span>
    <span class="viewer-info-text">
      <strong>${club}</strong>
      ${starter ? ' · ' + starter : ''}
      ${elapsed ? ' · ' + elapsed : ''}
    </span>
  `;
  return bar;
}

function _viewerElapsed(isoStr) {
  if (!isoStr) return '';
  const ms = Date.now() - new Date(isoStr).getTime();
  const m  = Math.floor(ms / 60000);
  if (m < 1)  return 'just started';
  if (m < 60) return m + 'm ago';
  return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
}

/* ============================================================
   LEADERBOARD — live standings from rounds data
   ============================================================ */
function _viewerBuildLeaderboard(roundsData) {
  // Compute wins/losses per player from all scored games
  const stats = new Map(); // name → { wins, played }

  for (const round of roundsData) {
    for (const game of (round.games || [])) {
      const all = [...(game.pair1 || []), ...(game.pair2 || [])];
      all.forEach(name => {
        if (!stats.has(name)) stats.set(name, { wins: 0, played: 0 });
        stats.get(name).played++;
      });
      if (game.winner) {
        const winners = game.winner === 'L' ? (game.pair1 || []) : (game.pair2 || []);
        winners.forEach(name => {
          if (!stats.has(name)) stats.set(name, { wins: 0, played: 0 });
          stats.get(name).wins++;
        });
      }
    }
  }

  // Sort by wins desc, then played desc
  const sorted = [...stats.entries()]
    .map(([name, s]) => ({ name, ...s, losses: s.played - s.wins }))
    .sort((a, b) => b.wins - a.wins || b.played - a.played);

  const container = document.createElement('div');
  container.className = 'viewer-leaderboard';

  const title = document.createElement('div');
  title.className = 'viewer-leaderboard-title';
  title.textContent = '🏆 Standings';
  container.appendChild(title);

  const table = document.createElement('div');
  table.className = 'viewer-leaderboard-table';

  sorted.forEach((p, idx) => {
    const row = document.createElement('div');
    row.className = 'viewer-lb-row' + (idx === 0 && p.wins > 0 ? ' viewer-lb-top' : '');

    const rank = document.createElement('span');
    rank.className = 'viewer-lb-rank';
    rank.textContent = '#' + (idx + 1);

    const name = document.createElement('span');
    name.className = 'viewer-lb-name';
    name.textContent = p.name;

    const wl = document.createElement('span');
    wl.className = 'viewer-lb-wl';
    wl.innerHTML = `<span class="viewer-lb-w">${p.wins}W</span> <span class="viewer-lb-l">${p.losses}L</span>`;

    row.appendChild(rank);
    row.appendChild(name);
    row.appendChild(wl);
    table.appendChild(row);
  });

  container.appendChild(table);
  return container;
}

/* ============================================================
   ROUND BUILDER — one round card, read-only
   Uses exact same CSS classes as organiser for identical look
   ============================================================ */
function _viewerBuildRound(data, index, total) {
  const isLatest = index === total - 1;
  const lang = (typeof currentLang !== 'undefined') ? currentLang : 'en';
  const tr   = (typeof translations !== 'undefined') ? translations[lang] : {};

  const wrapper = document.createElement('div');
  wrapper.className = 'round-wrapper ' + (isLatest ? 'latest-round' : 'played-round');

  // Round header
  const header = document.createElement('div');
  header.className = 'round-header';
  header.textContent = (tr.roundno || 'Round ') + data.round;
  wrapper.appendChild(header);

  // Court cards — same classes as organiser
  (data.games || []).forEach((game, gi) => {
    const courtDiv = document.createElement('div');
    courtDiv.className = 'courtcard court-' + (gi + 1);

    const courtName = document.createElement('div');
    courtName.className = 'courtname';
    courtName.textContent = 'Court ' + (gi + 1);
    courtDiv.appendChild(courtName);

    const teamsDiv = document.createElement('div');
    teamsDiv.className = 'teams';

    ['L', 'R'].forEach((side, si) => {
      const teamDiv = document.createElement('div');
      teamDiv.className = 'team';
      teamDiv.dataset.teamSide = side;
      teamDiv.style.pointerEvents = 'none';

      const players = side === 'L' ? (game.pair1 || []) : (game.pair2 || []);

      // Winner highlight
      if (game.winner === side) {
        teamDiv.classList.add('winner');
        const cup = document.createElement('img');
        cup.src       = 'win-cup.png';
        cup.className = 'win-cup active';
        cup.style.cssText = 'pointer-events:none;visibility:visible;opacity:1;filter:none;';
        teamDiv.appendChild(cup);
      }

      // Player buttons — same class as organiser, read-only
      players.forEach(name => {
        const btn = document.createElement('button');
        btn.className = side === 'L' ? 'Lplayer-btn' : 'Rplayer-btn';
        btn.textContent = name;
        btn.style.pointerEvents = 'none';
        btn.tabIndex = -1;
        teamDiv.appendChild(btn);
      });

      teamsDiv.appendChild(teamDiv);

      // VS divider
      if (si === 0) {
        const vs = document.createElement('div');
        vs.className = 'vs-divider';
        vs.innerHTML = '<div class="vs-line"></div><span>VS</span><div class="vs-line"></div>';
        teamsDiv.appendChild(vs);
      }
    });

    courtDiv.appendChild(teamsDiv);
    wrapper.appendChild(courtDiv);
  });

  // Resting players
  if (data.resting && data.resting.length) {
    const restSection = document.createElement('div');
    restSection.className = 'round-header';
    restSection.style.paddingLeft = '12px';
    const label = document.createElement('div');
    const tr2 = (typeof translations !== 'undefined') ? translations[lang] : {};
    label.textContent = tr2.sittingOut || 'Resting';
    restSection.appendChild(label);

    const restBox = document.createElement('div');
    restBox.className = 'rest-box';
    data.resting.forEach(name => {
      const chip = document.createElement('span');
      chip.className = 'rest-btn';
      chip.textContent = name.split('#')[0];
      chip.style.cssText = 'pointer-events:none;cursor:default;';
      restBox.appendChild(chip);
    });
    restSection.appendChild(restBox);
    wrapper.appendChild(restSection);
  }

  return wrapper;
}


/* ============================================================
   SUMMARY TAB — same output as organiser summary tab
   Built from allRounds data — no schedulerState needed
   ============================================================ */
function _viewerRenderSummary(container) {
  container.innerHTML = '';

  const lang = (typeof currentLang !== 'undefined') ? currentLang : 'en';
  const tr   = (typeof translations !== 'undefined') ? translations[lang] : {};

  // ── Player standings (reuse report-header + player-card CSS) ──
  const stats = new Map(); // name → { wins, played, rest }

  for (const round of (allRounds || [])) {
    // Track resting
    for (const name of (round.resting || [])) {
      const base = name.split('#')[0];
      if (!stats.has(base)) stats.set(base, { wins: 0, played: 0, rest: 0 });
      stats.get(base).rest++;
    }
    for (const game of (round.games || [])) {
      const all = [...(game.pair1 || []), ...(game.pair2 || [])];
      all.forEach(name => {
        if (!stats.has(name)) stats.set(name, { wins: 0, played: 0, rest: 0 });
        stats.get(name).played++;
      });
      if (game.winner) {
        const winners = game.winner === 'L' ? (game.pair1 || []) : (game.pair2 || []);
        winners.forEach(name => {
          if (!stats.has(name)) stats.set(name, { wins: 0, played: 0, rest: 0 });
          stats.get(name).wins++;
        });
      }
    }
  }

  const sorted = [...stats.entries()]
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.wins - a.wins || b.played - a.played);

  // Header row
  const header = document.createElement('div');
  header.className = 'report-header';
  header.innerHTML = `
    <div class="header-strip"></div>
    <div class="header-rank">Rank</div>
    <div class="header-name">Name</div>
    <div class="header-wins">W</div>
    <div class="header-played">P</div>
    <div class="header-rested">R</div>
  `;
  container.appendChild(header);

  // Player cards
  sorted.forEach((p, idx) => {
    const topClass = idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : '';
    const card = document.createElement('div');
    card.className = 'player-card ' + topClass;
    card.style.setProperty('--strip-color', idx === 0 ? '#f5a623' : idx === 1 ? '#9b9b9b' : idx === 2 ? '#cd7f32' : '#9e9e9e');
    card.innerHTML = `
      <div class="rating-strip"></div>
      <div class="rank">#${idx + 1}</div>
      <div class="name">${p.name}</div>
      <div class="stat wins">${p.wins}</div>
      <div class="stat played">${p.played}</div>
      <div class="stat rest">${p.rest}</div>
      <span class="rating-badge"></span>
      <div class="stat-label lbl-wins">W</div>
      <div class="stat-label lbl-played">P</div>
      <div class="stat-label lbl-rest">R</div>
    `;
    container.appendChild(card);
  });

  // ── Round history (reuse export-round CSS from summary.js) ──
  const roundsTitle = document.createElement('div');
  roundsTitle.style.cssText = 'font-size:0.7rem;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin:16px 4px 6px;';
  roundsTitle.textContent = tr.rounds || 'Rounds';
  container.appendChild(roundsTitle);

  (allRounds || []).slice(0, -1).forEach(data => {
    const roundDiv = document.createElement('div');
    roundDiv.className = 'export-round';

    const title = document.createElement('div');
    title.className = 'export-round-title';
    title.textContent = (tr.roundno || 'Round ') + data.round;
    roundDiv.appendChild(title);

    (data.games || []).forEach(game => {
      const match = document.createElement('div');
      match.className = 'export-match';

      const leftTeam = document.createElement('div');
      leftTeam.className = 'export-team';
      leftTeam.innerHTML = (game.pair1 || []).join('<br>');
      if (game.winner === 'L') leftTeam.classList.add('winner');

      const vs = document.createElement('div');
      vs.className = 'export-vs';
      vs.textContent = 'VS';

      const rightTeam = document.createElement('div');
      rightTeam.className = 'export-team';
      rightTeam.innerHTML = (game.pair2 || []).join('<br>');
      if (game.winner === 'R') rightTeam.classList.add('winner');

      match.append(leftTeam, vs, rightTeam);
      roundDiv.appendChild(match);
    });

    const restTitle = document.createElement('div');
    restTitle.className = 'export-rest-title';
    restTitle.textContent = tr.sittingOut || 'Resting';
    roundDiv.appendChild(restTitle);

    const restBox = document.createElement('div');
    restBox.className = 'export-rest-box';
    restBox.textContent = (data.resting || []).map(n => n.split('#')[0]).join(', ') || (tr.none || 'None');
    roundDiv.appendChild(restBox);

    container.appendChild(roundDiv);
  });
}

/* ============================================================
   POLLING — re-renders only when updated_at changes
   ============================================================ */
function viewerStartPoll() {
  viewerStopPoll();
  _viewerPollTimer = setInterval(async () => {
    try {
      const roundsPage = document.getElementById('roundsPage');
      if (!roundsPage || roundsPage.style.display === 'none') {
        viewerStopPoll(); return;
      }

      const rows = await sbGet('sessions',
        `id=eq.${_viewerSessionId}&select=rounds_data,started_by,created_at,updated_at,status`
      );
      if (!rows || !rows.length) { viewerStopPoll(); return; }

      const sess = rows[0];

      // No change — skip render
      if (sess.updated_at === _viewerLastUpdated) return;
      _viewerLastUpdated = sess.updated_at;

      // Update meta in case started_by changed
      _viewerSessionMeta = {
        started_by: sess.started_by,
        created_at: sess.created_at,
        club_name:  (typeof getMyClub === 'function') ? getMyClub().name : ''
      };

      // Reload allRounds
      const fetched = sess.rounds_data || [];
      allRounds.splice(0, allRounds.length, ...fetched);
      currentRoundIndex = allRounds.length - 1;

      // Re-render with flash animation on latest round
      viewerRender(fetched);
      _viewerFlashLatest();

      // If summary tab is active, refresh it too
      const summaryDiv = document.getElementById('viewerSummaryContainer');
      if (summaryDiv && summaryDiv.style.display !== 'none') {
        _viewerRenderSummary(summaryDiv);
      }

      // Stop if session ended
      if (sess.status === 'completed') viewerStopPoll();

    } catch (e) { /* silent — keep polling */ }
  }, 5000);
}

function viewerStopPoll() {
  if (_viewerPollTimer) { clearInterval(_viewerPollTimer); _viewerPollTimer = null; }
}

/* ── Flash animation on latest round when data updates ── */
function _viewerFlashLatest() {
  const latest = document.querySelector('.viewer-rounds .latest-round');
  if (!latest) return;
  latest.classList.remove('viewer-flash');
  // Force reflow then add class
  void latest.offsetWidth;
  latest.classList.add('viewer-flash');
  setTimeout(() => latest.classList.remove('viewer-flash'), 1000);
}

/* ============================================================
   CLUB LOGIN — for viewer settings page
   ============================================================ */
async function viewerLoadClubs() {
  try {
    const clubs = await dbGetClubs();
    const select = document.getElementById('sbClubSelectViewer');
    if (!select) return;
    select.innerHTML = '<option value="">— Select club —</option>';
    clubs.forEach(c => {
      const opt = document.createElement('option');
      opt.value       = c.id;
      opt.textContent = c.name;
      select.appendChild(opt);
    });
    // Pre-select current club
    const current = (typeof getMyClub === 'function') ? getMyClub() : null;
    if (current && current.id) select.value = current.id;
  } catch (e) {
    console.warn('viewerLoadClubs error:', e.message);
  }
}

async function viewerJoinClub() {
  const select   = document.getElementById('sbClubSelectViewer');
  const pwInput  = document.getElementById('sbPasswordInputViewer');
  const feedback = document.getElementById('sbClubFeedbackViewer');
  const status   = document.getElementById('sbClubStatusViewer');

  const setFb = (msg, ok) => {
    if (!feedback) return;
    feedback.textContent = msg;
    feedback.style.color = ok ? 'var(--green, #2dce89)' : 'var(--red, #e63757)';
  };

  if (!select || !select.value) { setFb('Please select a club.', false); return; }
  const pw = pwInput ? pwInput.value.trim() : '';
  if (!pw) { setFb('Enter password.', false); return; }

  try {
    const clubs = await sbGet('clubs', `id=eq.${select.value}&select=id,name,select_password`);
    if (!clubs.length) throw new Error('Club not found.');
    const club = clubs[0];

    if (pw !== club.select_password) throw new Error('Wrong password.');

    if (typeof setMyClub === 'function') setMyClub(club.id, club.name);
    localStorage.setItem('kbrr_club_mode',    'user');
    localStorage.setItem('kbrr_rating_field', 'club_ratings');
    localStorage.setItem('kbrr_rating_mode',  'local');

    if (pwInput) pwInput.value = '';
    if (status)  status.textContent = '✅ ' + club.name;
    setFb('Joined successfully', true);

    if (typeof syncToLocal === 'function') syncToLocal();
  } catch (e) {
    setFb('❌ ' + e.message, false);
  }
}
