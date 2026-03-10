/* ============================================================
   PROFILE DRAWER — Player identity, stats, recent sessions
   File: profile.js
   ============================================================ */

const PROFILE_KEY = 'kbrr_my_player';

function getMyPlayer() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || null; }
  catch { return null; }
}

function setMyPlayer(playerObj) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(playerObj));
}

function clearMyPlayer() {
  localStorage.removeItem(PROFILE_KEY);
}

/* ── Tier label from rating ── */
function ratingTierLabel(r) {
  if (r < 2.0) return { label: 'Beginner',     color: '#9e9e9e' };
  if (r < 3.0) return { label: 'Developing',   color: '#4a9eff' };
  if (r < 4.0) return { label: 'Intermediate', color: '#2dce89' };
  if (r < 4.5) return { label: 'Advanced',     color: '#f5a623' };
  return             { label: 'Elite',          color: '#e63757' };
}

/* ── Update header profile button appearance ── */
function updateProfileBtn() {
  const player = getMyPlayer();
  const avatarEl = document.getElementById('profileBtnAvatar');
  const iconEl   = document.getElementById('profileBtnIcon');
  if (!avatarEl || !iconEl) return;

  if (player) {
    avatarEl.src = player.gender === 'Female' ? 'female.png' : 'male.png';
    avatarEl.style.display = 'block';
    iconEl.style.display   = 'none';
  } else {
    avatarEl.style.display = 'none';
    iconEl.style.display   = 'block';
  }
}

/* ── Open drawer ── */
function openProfileDrawer() {
  const overlay = document.getElementById('profileOverlay');
  const drawer  = document.getElementById('profileDrawer');
  overlay.classList.remove('hidden');
  drawer.classList.add('open');

  const player = getMyPlayer();
  if (player) {
    showProfileCard(player);
  } else {
    showProfilePicker();
  }
}

/* ── Close drawer ── */
function closeProfileDrawer() {
  document.getElementById('profileOverlay').classList.add('hidden');
  document.getElementById('profileDrawer').classList.remove('open');
}

/* ── Show player picker — loads from Supabase ── */
let _pickerAllPlayers = []; // cache for search filtering

function showProfilePicker() {
  document.getElementById('profilePicker').style.display = 'block';
  document.getElementById('profileCard').style.display   = 'none';

  const list = document.getElementById('profilePickerList');
  list.innerHTML = '<div class="profile-sessions-loading">Loading players...</div>';

  // Clear search box
  const searchEl = document.getElementById('profileSearch');
  if (searchEl) searchEl.value = '';

  // Load ALL players from server (no club filter)
  sbGet('players', 'order=name.asc&select=id,name,gender').then(players => {
    _pickerAllPlayers = (players || []).map(p => ({
      name:   p.name,
      gender: p.gender || 'Male'
    }));
    renderPickerList(_pickerAllPlayers);
  }).catch(() => {
    // Fallback to session players if offline
    _pickerAllPlayers = (typeof schedulerState !== 'undefined' && schedulerState.allPlayers.length)
      ? schedulerState.allPlayers
      : [];
    renderPickerList(_pickerAllPlayers);
  });
}

function renderPickerList(players) {
  const list = document.getElementById('profilePickerList');
  list.innerHTML = '';

  if (!players.length) {
    list.innerHTML = '<div class="profile-picker-empty">No players found in your club.</div>';
    return;
  }

  players.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'profile-picker-item';
    btn.innerHTML = `
      <img src="${p.gender === 'Female' ? 'female.png' : 'male.png'}" class="profile-picker-avatar">
      <span>${p.name}</span>
    `;
    btn.onclick = () => {
      setMyPlayer({ name: p.name, gender: p.gender || 'Male' });
      updateProfileBtn();
      showProfileCard({ name: p.name, gender: p.gender || 'Male' });
    };
    list.appendChild(btn);
  });
}

function filterPickerList(query) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? _pickerAllPlayers.filter(p => p.name.toLowerCase().includes(q))
    : _pickerAllPlayers;
  renderPickerList(filtered);
}

/* ── Switch player ── */
function switchProfilePlayer() {
  clearMyPlayer();
  updateProfileBtn();
  showProfilePicker();
}

/* ── Get sessions for a player — localStorage first, then Supabase ── */
function getLocalSessions(playerName) {
  try {
    const lsKey = `kbrr_sessions_${playerName.toLowerCase().replace(/\s+/g, '_')}`;
    return JSON.parse(localStorage.getItem(lsKey) || '[]');
  } catch { return []; }
}

function mergeSessions(local, remote) {
  // Merge by date, prefer local (more up to date), deduplicate
  const map = new Map();
  [...remote, ...local].forEach(s => map.set(s.date, s)); // local overwrites remote
  return Array.from(map.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);
}

/* ── Show profile card ── */
async function showProfileCard(player) {
  document.getElementById('profilePicker').style.display = 'none';
  document.getElementById('profileCard').style.display   = 'block';

  // Avatar
  document.getElementById('pcAvatar').src =
    player.gender === 'Female' ? 'female.png' : 'male.png';

  // Name
  document.getElementById('pcName').textContent = player.name;

  // Rating + tier
  const rating = (typeof getRating === 'function') ? getRating(player.name) : 1.0;
  const tier   = ratingTierLabel(rating);
  document.getElementById('pcRating').textContent    = rating.toFixed(1);
  document.getElementById('pcRating').style.color    = tier.color;
  document.getElementById('pcTier').textContent      = tier.label;
  document.getElementById('pcTier').style.background = tier.color + '22';
  document.getElementById('pcTier').style.color      = tier.color;

  // Current session stats now computed inside renderSessions
  document.getElementById('pcWins').textContent    = '…';
  document.getElementById('pcLosses').textContent  = '…';
  document.getElementById('pcSessions').innerHTML  =
    '<div class="profile-sessions-loading">Loading...</div>';

  // Fetch from Supabase players.sessions column + merge with localStorage
  try {
    const rows = await sbGet('players',
      `name=ilike.${encodeURIComponent(player.name)}&select=wins,losses,sessions`);

    const lsKey       = `kbrr_sessions_${player.name.toLowerCase().replace(/\s+/g, '_')}`;
    const localSessions = JSON.parse(localStorage.getItem(lsKey) || '[]');

    if (rows && rows.length) {
      const data           = rows[0];
      const remoteSessions = data.sessions || [];
      const merged         = mergeSessions(localSessions, remoteSessions);
      document.getElementById('pcWins').textContent   = (data.wins   || 0);
      document.getElementById('pcLosses').textContent = (data.losses || 0);
      renderSessions(merged, player.name);
    } else {
      document.getElementById('pcWins').textContent   = '—';
      document.getElementById('pcLosses').textContent = '—';
      renderSessions(localSessions, player.name);
    }
  } catch (e) {
    const lsKey         = `kbrr_sessions_${player.name.toLowerCase().replace(/\s+/g, '_')}`;
    const localSessions = JSON.parse(localStorage.getItem(lsKey) || '[]');
    document.getElementById('pcWins').textContent   = '—';
    document.getElementById('pcLosses').textContent = '—';
    renderSessions(localSessions, player.name);
  }
}

/* ── Render sessions with individual match history ── */
function renderSessions(sessions, playerName) {
  const container = document.getElementById('pcSessions');
  container.innerHTML = '';

  // ── Live current session from allRounds ──
  let liveMatches = [];
  if (typeof allRounds !== 'undefined' && allRounds.length) {
    for (const round of allRounds) {
      const games = round.games || round;
      for (const game of games) {
        if (!game.winner) continue;
        const pair1   = game.pair1 || [];
        const pair2   = game.pair2 || [];
        const leftWon = game.winner === 'L';
        const inPair1 = pair1.some(p => p.toLowerCase() === playerName.toLowerCase());
        const inPair2 = pair2.some(p => p.toLowerCase() === playerName.toLowerCase());
        if (!inPair1 && !inPair2) continue;
        liveMatches.push({
          opponents: inPair1 ? pair2 : pair1,
          result:    (inPair1 && leftWon) || (inPair2 && !leftWon) ? 'W' : 'L'
        });
      }
    }
  }

  const hasLive     = liveMatches.length > 0;
  const hasPast     = sessions.length > 0;

  if (!hasLive && !hasPast) {
    container.innerHTML = '<div class="profile-sessions-empty">No sessions recorded yet.</div>';
    return;
  }

  // ── Current session block ──
  if (hasLive) {
    const liveWins   = liveMatches.filter(m => m.result === 'W').length;
    const liveLosses = liveMatches.filter(m => m.result === 'L').length;
    const rating     = (typeof getRating === 'function') ? getRating(playerName) : 1.0;
    const tier       = ratingTierLabel(rating);

    const block = document.createElement('div');
    block.className = 'profile-session-block current';
    block.innerHTML = `
      <div class="session-block-header">
        <span class="session-block-date">Today (live)</span>
        <span class="session-block-summary">
          ${liveWins   > 0 ? `<span class="session-badge win">${liveWins}W</span>`   : ''}
          ${liveLosses > 0 ? `<span class="session-badge loss">${liveLosses}L</span>` : ''}
        </span>
        <span class="session-block-rating" style="color:${tier.color}">${rating.toFixed(1)}</span>
      </div>
      <div class="session-match-list">
        ${liveMatches.map(m => `
          <div class="session-match-row">
            <span class="match-result-badge ${m.result === 'W' ? 'win' : 'loss'}">${m.result}</span>
            <span class="match-opponents">vs ${m.opponents.join(' & ')}</span>
          </div>`).join('')}
      </div>`;
    container.appendChild(block);
  }

  // ── Past sessions ──
  sessions.slice(0, 3).forEach(s => {
    const tier    = ratingTierLabel(s.rating || 1.0);
    const matches = s.matches || [];

    const block = document.createElement('div');
    block.className = 'profile-session-block';
    block.innerHTML = `
      <div class="session-block-header">
        <span class="session-block-date">${s.date || '—'}</span>
        <span class="session-block-summary">
          ${s.wins   > 0 ? `<span class="session-badge win">${s.wins}W</span>`   : ''}
          ${s.losses > 0 ? `<span class="session-badge loss">${s.losses}L</span>` : ''}
        </span>
        <span class="session-block-rating" style="color:${tier.color}">${(s.rating || 1.0).toFixed(1)}</span>
      </div>
      ${matches.length ? `
      <div class="session-match-list">
        ${matches.map(m => `
          <div class="session-match-row">
            <span class="match-result-badge ${m.result === 'W' ? 'win' : 'loss'}">${m.result}</span>
            <span class="match-opponents">vs ${m.opponents.join(' & ')}</span>
          </div>`).join('')}
      </div>` : ''}`;
    container.appendChild(block);
  });
}

/* ── Init on load ── */
document.addEventListener('DOMContentLoaded', () => {
  updateProfileBtn();
});
