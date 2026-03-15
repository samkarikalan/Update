/* ============================================================
   DASHBOARD — Live & past sessions for the club
   File: dashboard.js
   ============================================================ */

var _dashboardTimer    = null;
var _viewerPollTimer   = null;
var _viewerLastUpdated = null;  // track last updated_at seen by viewer

/* ── Called when Dashboard tab opens ── */
async function renderDashboard() {
  _stopViewerPoll(); // stop any active poll when returning to dashboard
  const container = document.getElementById('dashboardContainer');
  if (!container) return;

  const club = (typeof getMyClub === 'function') ? getMyClub() : null;
  if (!club || !club.id) {
    container.innerHTML = `
      <div class="dash-empty">
        <div class="dash-empty-icon">🏟️</div>
        <p>No club selected.</p>
        <p style="font-size:0.78rem;color:var(--text-dim);margin-top:4px">Go to Settings to join a club.</p>
      </div>`;
    return;
  }

  container.innerHTML = '<div class="dashboard-loading"><div class="help-spinner"></div></div>';

  try {
    // Fetch all live sessions (one per hall)
    const liveSessions = await dbGetLiveSessions();

    // Fetch last 3 completed sessions
    const pastSessions = await dbGetPastSessions();

    container.innerHTML = '';

    // ── Live Section ──
    const liveSection = document.createElement('div');
    liveSection.className = 'dash-section';
    liveSection.innerHTML = `<div class="dash-section-title"><span class="dash-live-dot"></span> Live Now</div>`;

    if (liveSessions.length) {
      liveSessions.forEach(sess => {
        const players     = _extractPlayersFromRounds(sess.rounds_data || []);
        const totalRounds = (sess.rounds_data || []).length;
        const card = _buildSessionCard({
          clubName:   club.name,
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
        const card = _buildSessionCard({
          clubName:   club.name,
          starter:    sess.started_by,
          players:    sess.players || [],
          totalRounds: null,
          isLive:     false,
          sessionId:  sess.id,
          date:       sess.date,
          updatedAt:  sess.updated_at
        });
        pastSection.appendChild(card);
      });
    } else {
      pastSection.innerHTML += `<div class="dash-empty-inline">No recent sessions found</div>`;
    }
    container.appendChild(pastSection);

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

  // Tap → open rounds view
  if (isLive) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => _openSessionRounds(sessionId));
  }

  return card;
}

/* ── Open rounds tab and render all rounds from DB ── */
async function _openSessionRounds(sessionId) {
  // Fetch rounds data from DB
  let fetchedRounds = null;
  let updatedAt = null;
  try {
    const rows = await sbGet('sessions',
      `id=eq.${sessionId}&select=rounds_data,updated_at`
    );
    if (!rows || !rows.length || !rows[0].rounds_data || !rows[0].rounds_data.length) {
      alert('No rounds data available yet.');
      return;
    }
    fetchedRounds = rows[0].rounds_data;
    updatedAt = rows[0].updated_at;
  } catch (e) {
    console.warn('_openSessionRounds fetch error:', e.message);
    return;
  }

  // Load into global allRounds
  allRounds.splice(0, allRounds.length, ...fetchedRounds);
  currentRoundIndex = allRounds.length - 1;
  _viewerLastUpdated = updatedAt;

  // Show rounds page — bypass player count guard
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.getElementById('roundsPage').style.display = 'block';

  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const roundsBtn = document.getElementById('tabBtnRounds');
  if (roundsBtn) {
    roundsBtn.style.display = '';
    roundsBtn.style.pointerEvents = 'auto';
    roundsBtn.style.opacity = '1';
    roundsBtn.removeAttribute('aria-disabled');
    roundsBtn.classList.add('active');
    roundsBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  // Move shared player slot to rounds anchor
  const slot   = document.getElementById('sharedPlayerSlot');
  const anchor = document.getElementById('roundsSlotAnchor');
  if (slot && anchor) { anchor.appendChild(slot); slot.style.display = 'block'; }

  if (appMode === 'viewer') {
    // Apply viewer mode properly so all CSS rules and restrictions take effect
    if (typeof setViewerMode === 'function') setViewerMode(true);
    // Render all rounds read-only
    if (typeof showAllRounds === 'function') showAllRounds();
    // Start polling for live updates
    _startViewerPoll(sessionId);
  } else {
    // Organiser — show current round normally
    if (typeof showRound === 'function') showRound(currentRoundIndex);
  }

  lastPage = 'dashboardPage';
}

/* ── Viewer polling — re-renders when organiser updates rounds ── */
function _startViewerPoll(sessionId) {
  _stopViewerPoll(); // clear any existing poll
  _viewerPollTimer = setInterval(async () => {
    try {
      // Only poll if still on rounds page
      const roundsPage = document.getElementById('roundsPage');
      if (!roundsPage || roundsPage.style.display === 'none') {
        _stopViewerPoll();
        return;
      }

      const rows = await sbGet('sessions',
        `id=eq.${sessionId}&select=rounds_data,updated_at,status`
      );
      if (!rows || !rows.length) { _stopViewerPoll(); return; }

      const row = rows[0];

      // Stop polling if session ended
      if (row.status === 'completed') {
        _stopViewerPoll();
        if (typeof showAllRounds === 'function') showAllRounds();
        return;
      }

      // Only re-render if data has changed
      if (row.updated_at === _viewerLastUpdated) return;
      _viewerLastUpdated = row.updated_at;

      // Reload allRounds — splice to avoid multiple Proxy triggers
      const fetched = row.rounds_data || [];
      allRounds.splice(0, allRounds.length, ...fetched);
      currentRoundIndex = allRounds.length - 1;
      if (typeof showAllRounds === 'function') showAllRounds();

    } catch (e) { /* silent — keep polling */ }
  }, 5000); // poll every 5 seconds
}

function _stopViewerPoll() {
  if (_viewerPollTimer) { clearInterval(_viewerPollTimer); _viewerPollTimer = null; }
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
