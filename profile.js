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

  // Fetch from Supabase (player_sessions table) + merge with localStorage
  try {
    const localSessions  = getLocalSessions(player.name);
    const remoteSessions = await getPlayerSessions(player.name);
    const merged         = mergeSessions(localSessions, remoteSessions);

    // Also fetch wins/losses totals from players table
    try {
      const rows = await sbGet('players',
        `name=ilike.${encodeURIComponent(player.name)}&select=wins,losses`);
      if (rows && rows.length) {
        document.getElementById('pcWins').textContent   = (rows[0].wins   || 0);
        document.getElementById('pcLosses').textContent = (rows[0].losses || 0);
      }
    } catch (e) { /* silent */ }

    renderSessions(merged, player.name);
  } catch (e) {
    // Full fallback — localStorage only
    const localSessions = getLocalSessions(player.name);
    document.getElementById('pcWins').textContent   = '—';
    document.getElementById('pcLosses').textContent = '—';
    renderSessions(localSessions, player.name);
  }
}

/* ── Render last 3 sessions ── */
function renderSessions(sessions, playerName) {
  const container = document.getElementById('pcSessions');
  container.innerHTML = '';

  // Current session stats from live schedulerState
  const sessionWins   = (typeof schedulerState !== 'undefined')
    ? (schedulerState.winCount?.get(playerName) || 0) : 0;
  const sessionPlayed = (typeof schedulerState !== 'undefined')
    ? (schedulerState.PlayedCount?.get(playerName) || 0) : 0;
  const sessionLosses = Math.max(0, sessionPlayed - sessionWins); // approx

  const hasCurrentSession = sessionPlayed > 0;

  if (!sessions.length && !hasCurrentSession) {
    container.innerHTML = '<div class="profile-sessions-empty">No sessions recorded yet.</div>';
    return;
  }

  // Show current session at top if active
  if (hasCurrentSession) {
    const rating = (typeof getRating === 'function') ? getRating(playerName) : 1.0;
    const tier   = ratingTierLabel(rating);
    const curr   = document.createElement('div');
    curr.className = 'profile-session-row current';
    curr.innerHTML = `
      <span class="session-date">Today (live)</span>
      <div class="session-results">
        ${sessionWins   > 0 ? `<span class="session-badge win">${sessionWins}W</span>`     : ''}
        ${sessionLosses > 0 ? `<span class="session-badge loss">${sessionLosses}L</span>` : ''}
        ${sessionWins === 0 && sessionLosses === 0 ? `<span class="session-badge" style="background:rgba(160,160,192,0.15);color:var(--text-dim)">${sessionPlayed}P</span>` : ''}
      </div>
      <span class="session-rating" style="color:${tier.color}">${rating.toFixed(1)}</span>
    `;
    container.appendChild(curr);
  }

  // Past sessions from Supabase
  sessions.slice(0, 3).forEach(s => {
    const row  = document.createElement('div');
    row.className = 'profile-session-row';
    const tier = ratingTierLabel(s.rating || 1.0);
    row.innerHTML = `
      <span class="session-date">${s.date || '—'}</span>
      <div class="session-results">
        ${s.wins   > 0 ? `<span class="session-badge win">${s.wins}W</span>`   : ''}
        ${s.losses > 0 ? `<span class="session-badge loss">${s.losses}L</span>` : ''}
      </div>
      <span class="session-rating" style="color:${tier.color}">${(s.rating || 1.0).toFixed(1)}</span>
    `;
    container.appendChild(row);
  });
}

/* ── Init on load ── */
document.addEventListener('DOMContentLoaded', () => {
  updateProfileBtn();
});
