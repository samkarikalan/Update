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
    roundsBtn.style.display      = '';
    roundsBtn.style.pointerEvents = 'auto';
    roundsBtn.style.opacity      = '1';
    roundsBtn.removeAttribute('aria-disabled');
    roundsBtn.classList.add('active');
    roundsBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  // Apply viewer-mode class so CSS hides action card, settings panel, etc.
  if (typeof setViewerMode === 'function') setViewerMode(true);

  if (typeof lastPage !== 'undefined') lastPage = 'dashboardPage';
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
