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

/* ── Show player picker ── */
function showProfilePicker() {
  document.getElementById('profilePicker').style.display = 'block';
  document.getElementById('profileCard').style.display   = 'none';

  const list = document.getElementById('profilePickerList');
  list.innerHTML = '';

  // Use active players if session started, else all players
  const players = (typeof schedulerState !== 'undefined' && schedulerState.allPlayers.length)
    ? schedulerState.allPlayers
    : [];

  if (!players.length) {
    list.innerHTML = '<div class="profile-picker-empty">No players found.<br>Add players first.</div>';
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

/* ── Switch player ── */
function switchProfilePlayer() {
  clearMyPlayer();
  updateProfileBtn();
  showProfilePicker();
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

  // Current session wins from schedulerState
  const sessionWins = (typeof schedulerState !== 'undefined')
    ? (schedulerState.winCount?.get(player.name) || 0)
    : 0;

  // Reset while loading
  document.getElementById('pcWins').textContent    = '…';
  document.getElementById('pcLosses').textContent  = '…';
  document.getElementById('pcSessions').innerHTML  =
    '<div class="profile-sessions-loading">Loading...</div>';

  // Fetch from Supabase
  try {
    const rows = await sbGet('players',
      `name=ilike.${encodeURIComponent(player.name)}&select=wins,losses,sessions`);

    if (rows && rows.length) {
      const data = rows[0];
      document.getElementById('pcWins').textContent   = (data.wins   || 0);
      document.getElementById('pcLosses').textContent = (data.losses || 0);
      renderSessions(data.sessions || [], sessionWins);
    } else {
      document.getElementById('pcWins').textContent   = sessionWins;
      document.getElementById('pcLosses').textContent = '—';
      renderSessions([], sessionWins);
    }
  } catch (e) {
    document.getElementById('pcWins').textContent   = sessionWins;
    document.getElementById('pcLosses').textContent = '—';
    renderSessions([], sessionWins);
  }
}

/* ── Render last 3 sessions ── */
function renderSessions(sessions, sessionWins) {
  const container = document.getElementById('pcSessions');
  container.innerHTML = '';

  if (!sessions.length && sessionWins === 0) {
    container.innerHTML = '<div class="profile-sessions-empty">No sessions recorded yet.</div>';
    return;
  }

  // Show current session at top if active
  if (sessionWins > 0) {
    const curr = document.createElement('div');
    curr.className = 'profile-session-row current';
    curr.innerHTML = `
      <span class="session-date">Today</span>
      <span class="session-badge win">${sessionWins}W</span>
      <span class="session-rating" style="color:${ratingTierLabel(
        typeof getRating === 'function'
          ? getRating(document.getElementById('pcName').textContent)
          : 1.0
      ).color}">${
        typeof getRating === 'function'
          ? getRating(document.getElementById('pcName').textContent).toFixed(1)
          : '—'
      }</span>
    `;
    container.appendChild(curr);
  }

  sessions.slice(0, 3).forEach(s => {
    const row = document.createElement('div');
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
