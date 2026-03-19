/* ============================================================
   DASHBOARD — Live & past sessions for the club
   File: dashboard.js
   ============================================================ */

var _dashboardTimer     = null;
var _dashboardPollTimer = null;
var _dashboardLiveIds   = []; // track current live session IDs

/* ── Dashboard polling — detects session status changes ── */
function dashboardStartPoll() {
  dashboardStopPoll();
  _dashboardPollTimer = setInterval(async () => {
    // Only poll if dashboard is visible
    const dashPage = document.getElementById('dashboardPage');
    if (!dashPage || dashPage.style.display === 'none') {
      dashboardStopPoll(); return;
    }
    try {
      const isViewer = (typeof appMode !== 'undefined') && appMode === 'viewer';
      let currentLiveIds = [];

      if (isViewer) {
        const myPlayer = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;
        if (!myPlayer) return;
        const clubIds = await dbGetPlayerClubs(myPlayer.name);
        if (!clubIds.length) return;
        const inList = '(' + clubIds.join(',') + ')';
        const rows = await sbGet('sessions',
          `club_id=in.${inList}&status=eq.live&select=id`
        );
        currentLiveIds = (rows || []).map(r => r.id);
      } else {
        const club = (typeof getMyClub === 'function') ? getMyClub() : null;
        if (!club || !club.id) return;
        const rows = await sbGet('sessions',
          `club_id=eq.${club.id}&status=eq.live&select=id`
        );
        currentLiveIds = (rows || []).map(r => r.id);
      }

      // Re-render if live sessions changed
      const prev = _dashboardLiveIds.slice().sort().join(',');
      const curr = currentLiveIds.slice().sort().join(',');
      if (prev !== curr) {
        _dashboardLiveIds = currentLiveIds;
        if (typeof renderDashboard === 'function') renderDashboard();
      }
    } catch (e) { /* silent */ }
  }, 5000);
}

function dashboardStopPoll() {
  if (_dashboardPollTimer) { clearInterval(_dashboardPollTimer); _dashboardPollTimer = null; }
}

/* ── Called when Dashboard tab opens ── */
async function renderDashboard() {
  if (typeof viewerStopPoll === 'function') viewerStopPoll(); // stop any active poll
  dashboardStopPoll(); // stop dashboard poll when leaving
  const container = document.getElementById('dashboardContainer');
  if (!container) return;

  const isViewer = (typeof appMode !== 'undefined') && appMode === 'viewer';
  const myPlayer = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;
  const club     = (typeof getMyClub === 'function') ? getMyClub() : null;

  // Viewer needs a profile; organiser needs a club
  if (isViewer && !myPlayer) {
    container.innerHTML = `
      <div class="dash-empty">
        <div class="dash-empty-icon">👤</div>
        <p>Set up your profile first.</p>
        <p style="font-size:0.78rem;color:var(--text-dim);margin-top:4px">Tap the profile icon to select your name.</p>
      </div>`;
    return;
  }
  if (!isViewer && (!club || !club.id)) {
    container.innerHTML = `
      <div class="dash-empty">
        <div class="dash-empty-icon">🏟️</div>
        <p>No club selected.</p>
        <p style="font-size:0.78rem;color:var(--text-dim);margin-top:4px">Go to Club tab to join a club.</p>
      </div>`;
    return;
  }

  container.innerHTML = '<div class="dashboard-loading"><div class="help-spinner"></div></div>';

  try {
    // Cleanup stale sessions first (crashed apps leave ghost live sessions)
    if (typeof dbCleanupStaleSessions === 'function') await dbCleanupStaleSessions();

    // Fetch all live sessions (one per hall)
    const liveSessions = await dbGetLiveSessions();

    // Fetch last 3 completed sessions
    const pastSessions = await dbGetPastSessions();

    container.innerHTML = '';

    // For viewer — enrich sessions with club names
    if (isViewer && (liveSessions.length || pastSessions.length)) {
      try {
        const allClubIds = [...new Set([
          ...liveSessions.map(s => s.club_id),
          ...pastSessions.map(s => s.club_id)
        ].filter(Boolean))];
        if (allClubIds.length) {
          const clubs = await Promise.all(
            allClubIds.map(id => sbGet('clubs', `id=eq.${id}&select=id,name`).catch(() => []))
          );
          const clubMap = {};
          clubs.flat().forEach(c => { if (c) clubMap[c.id] = c.name; });
          liveSessions.forEach(s => { s.club_name = clubMap[s.club_id] || s.club_id; });
          pastSessions.forEach(s => { s.club_name = clubMap[s.club_id] || s.club_id; });
        }
      } catch (e) { /* silent */ }
    }

    // ── Live Section ──
    const liveSection = document.createElement('div');
    liveSection.className = 'dash-section';
    liveSection.innerHTML = `<div class="dash-section-title"><span class="dash-live-dot"></span> Live Now</div>`;

    if (liveSessions.length) {
      liveSessions.forEach(sess => {
        const players     = _extractPlayersFromRounds(sess.rounds_data || []);
        const totalRounds = (sess.rounds_data || []).length;
        const cardClubName = isViewer ? (sess.club_name || sess.club_id || '') : (club ? club.name : '');
        const card = _buildSessionCard({
          clubName:   cardClubName,
          starter:    sess.started_by,
          players,
          totalRounds,
          isLive:     true,
          sessionId:  sess.id,
          updatedAt:  sess.updated_at
        });
        liveSection.appendChild(card);
      });
    } else {
      liveSection.innerHTML += `<div class="dash-empty-inline">No active sessions right now</div>`;
    }
    container.appendChild(liveSection);

    // ── Past Sessions ──
    const pastSection = document.createElement('div');
    pastSection.className = 'dash-section';
    pastSection.innerHTML = `<div class="dash-section-title">📅 Recent Sessions</div>`;

    if (pastSessions.length) {
      pastSessions.forEach(sess => {
        const pastClubName = isViewer ? (sess.club_name || sess.club_id || '') : (club ? club.name : '');
        const card = _buildSessionCard({
          clubName:    pastClubName,
          starter:     sess.started_by,
          players:     sess.players || [],
          totalRounds: (sess.rounds_data || []).length || null,
          isLive:      false,
          sessionId:   sess.id,
          date:        sess.date,
          updatedAt:   sess.updated_at
        });
        pastSection.appendChild(card);
      });
    } else {
      pastSection.innerHTML += `<div class="dash-empty-inline">No recent sessions found</div>`;
    }
    container.appendChild(pastSection);

    // Start polling for live session changes
    dashboardStartPoll();

  } catch(e) {
    container.innerHTML = `
      <div class="dash-empty">
        <div class="dash-empty-icon">📡</div>
        <p>Could not load sessions.</p>
        <p style="font-size:0.78rem;color:var(--text-dim);margin-top:4px">Check your connection.</p>
        <button class="help-retry-btn" onclick="renderDashboard()" style="margin-top:12px">↺ Retry</button>
      </div>`;
  }
}

/* ── Extract unique players from rounds_data ── */
function _extractPlayersFromRounds(roundsData) {
  const seen = new Set();
  const players = [];
  for (const round of (roundsData || [])) {
    for (const game of (round.games || [])) {
      for (const p of [...(game.pair1 || []), ...(game.pair2 || [])]) {
        if (!seen.has(p)) { seen.add(p); players.push({ name: p }); }
      }
    }
  }
  return players;
}

/* ── Build a session card ── */
function _buildSessionCard({ clubName, starter, players, totalRounds, isLive, sessionId, date, updatedAt }) {
  const card = document.createElement('div');
  card.className = 'dash-session-card' + (isLive ? ' live' : '');

  const myPlayer = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;
  const myName   = myPlayer ? myPlayer.name.toLowerCase() : '';
  const dateLabel = isLive ? 'Today' : _formatDate(date || updatedAt);
  // Show club name on card (useful when viewer sees multiple clubs)
  const displayClub = clubName || '';

  // Top row
  const top = document.createElement('div');
  top.className = 'dash-card-top';
  top.innerHTML = `
    <div class="dash-card-club">${clubName || 'Club'}</div>
    ${isLive
      ? `<div class="dash-live-badge"><div class="dash-live-dot-sm"></div>LIVE</div>`
      : `<div class="dash-past-badge">${dateLabel}</div>`}
  `;
  card.appendChild(top);

  // Meta row
  const meta = document.createElement('div');
  meta.className = 'dash-card-meta';
  meta.innerHTML = `
    <span>👥 ${players.length} players</span>
    ${totalRounds ? `<span>🔄 ${totalRounds} rounds</span>` : ''}
    ${starter ? `<span>▶ ${starter}</span>` : ''}
  `;
  card.appendChild(meta);

  // Player chips
  const chips = document.createElement('div');
  chips.className = 'dash-card-chips';
  const show = players.slice(0, 5);
  const rest = players.length - show.length;
  show.forEach(p => {
    const chip = document.createElement('div');
    const name = p.name || p.player_name || '';
    const isMe = name.toLowerCase() === myName;
    chip.className = 'dash-chip' + (isMe ? ' me' : '');
    chip.textContent = name + (isMe ? ' ★' : '');
    chips.appendChild(chip);
  });
  if (rest > 0) {
    const more = document.createElement('div');
    more.className = 'dash-chip';
    more.textContent = `+${rest}`;
    chips.appendChild(more);
  }
  card.appendChild(chips);

  // Tap → open rounds view (both live and past)
  if (sessionId) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => _openSessionRounds(sessionId));
  }



  return card;
}

/* ── Open rounds view — navigates to viewerPage ── */
function _openSessionRounds(sessionId) {
  if (typeof viewerOpen === 'function') viewerOpen(sessionId);
}

/* ── Format date ── */
function _formatDate(dateStr) {
  if (!dateStr) return '';
  const d     = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  const today = new Date();
  const diff  = Math.floor((today - d) / (1000*60*60*24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7)  return `${diff} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
