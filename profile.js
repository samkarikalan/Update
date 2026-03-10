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

/* ── End Session from profile drawer ── */
async function profileEndSession() {
  const btn     = document.getElementById('profileEndBtn');
  const btnText = document.getElementById('profileEndBtnText');

  // Show busy state — drawer stays open
  btn.disabled      = true;
  btnText.textContent = 'Saving...';
  btn.style.opacity = '0.7';

  try {
    await endSession(true); // pass flag to skip drawer close logic
  } catch(e) {
    // endSession reloads page on success, so if we get here something went wrong
    btn.disabled        = false;
    btnText.textContent = 'End Session';
    btn.style.opacity   = '1';
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

  // Rating + tier — both global and club
  const globalRating = (typeof getRating      === 'function') ? getRating(player.name)      : 1.0;
  const clubRating   = (typeof getClubRating  === 'function') ? getClubRating(player.name)  : 1.0;
  const activeRating = (typeof getActiveRating === 'function') ? getActiveRating(player.name) : globalRating;
  const tier         = ratingTierLabel(activeRating);

  document.getElementById('pcRating').textContent     = globalRating.toFixed(1);
  document.getElementById('pcClubRating').textContent = clubRating.toFixed(1);
  document.getElementById('pcTier').textContent       = tier.label;
  document.getElementById('pcTier').style.background  = tier.color + '22';
  document.getElementById('pcTier').style.color       = tier.color;

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

/* ── Helper: get gender of a player ── */
function getPlayerGender(name) {
  if (typeof schedulerState !== 'undefined' && schedulerState.allPlayers) {
    const p = schedulerState.allPlayers.find(
      p => p.name.toLowerCase() === name.toLowerCase()
    );
    if (p) return p.gender || 'Male';
  }
  return 'Male';
}

/* ── Render PDF-style match rows ── */
function renderMatchRow(m) {
  const isWin          = m.result === 'W';
  const partner        = m.partner        || [];
  const partnerGenders = m.partnerGenders || partner.map(() => 'Male');
  const opponents      = m.opponents      || [];
  const oppGenders     = m.opponentGenders || opponents.map(() => 'Male');

  const makeChip = (name, gender) =>
    `<div class="match-player-chip">
      <img src="${gender === 'Female' ? 'female.png' : 'male.png'}" class="match-avatar">
      <span class="match-player-name">${name}</span>
    </div>`;

  const myPair  = [makeChip('Me', 'Me'), ...partner.map((n, i) => makeChip(n, partnerGenders[i]))].join('');
  const oppPair = opponents.map((n, i) => makeChip(n, oppGenders[i])).join('');

  return `
    <div class="match-row ${isWin ? 'win' : 'loss'}">
      <div class="match-pair">${myPair}</div>
      <div class="match-vs-col">
        <span class="match-vs">vs</span>
        <span class="match-result-pill ${isWin ? 'win' : 'loss'}">${isWin ? 'WIN' : 'LOSS'}</span>
      </div>
      <div class="match-pair">${oppPair}</div>
    </div>`;
}

/* ── Render sessions with PDF-style match history ── */
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
        const opponents = inPair1 ? pair2 : pair1;
        const partner   = inPair1 ? pair1.filter(p => p.toLowerCase() !== playerName.toLowerCase())
                                  : pair2.filter(p => p.toLowerCase() !== playerName.toLowerCase());
        liveMatches.push({
          partner,
          partnerGenders:  partner.map(n => getPlayerGender(n)),
          opponents,
          opponentGenders: opponents.map(n => getPlayerGender(n)),
          result: (inPair1 && leftWon) || (inPair2 && !leftWon) ? 'W' : 'L'
        });
      }
    }
  }

  const hasLive = liveMatches.length > 0;
  const hasPast = sessions.length > 0;

  if (!hasLive && !hasPast) {
    container.innerHTML = '<div class="profile-sessions-empty">No sessions recorded yet.</div>';
    return;
  }

  // ── Current session ──
  if (hasLive) {
    const liveWins   = liveMatches.filter(m => m.result === 'W').length;
    const liveLosses = liveMatches.filter(m => m.result === 'L').length;
    const rating     = (typeof getRating === 'function') ? getRating(playerName) : 1.0;
    const tier       = ratingTierLabel(rating);

    const block = document.createElement('div');
    block.className = 'session-block';
    block.innerHTML = `
      <div class="session-block-header">
        <div class="session-header-left">
          <span class="session-block-date">Today</span>
          <span class="session-block-rating" style="color:${tier.color}">${rating.toFixed(1)}</span>
        </div>
        <div class="session-header-badges">
          ${liveWins   > 0 ? `<span class="session-badge win">${liveWins}W</span>`   : ''}
          ${liveLosses > 0 ? `<span class="session-badge loss">${liveLosses}L</span>` : ''}
          <span class="session-live-dot">LIVE</span>
        </div>
      </div>
      <div class="session-matches">
        ${liveMatches.map(renderMatchRow).join('<div class="match-divider"></div>')}
      </div>`;
    container.appendChild(block);
  }

  // ── Past sessions ──
  sessions.slice(0, 3).forEach((s, idx) => {
    const tier    = ratingTierLabel(s.rating || 1.0);
    const matches = s.matches || [];

    const block = document.createElement('div');
    block.className = 'session-block past';
    block.innerHTML = `
      <div class="session-block-header" onclick="toggleSessionMatches(this)">
        <div class="session-header-left">
          <span class="session-block-date">${s.date || '—'}</span>
          <span class="session-block-rating" style="color:${tier.color}">${(s.rating || 1.0).toFixed(1)}</span>
        </div>
        <div class="session-header-badges">
          ${s.wins   > 0 ? `<span class="session-badge win">${s.wins}W</span>`   : ''}
          ${s.losses > 0 ? `<span class="session-badge loss">${s.losses}L</span>` : ''}
          ${matches.length ? `<span class="session-chevron">›</span>` : `<span class="session-chevron">›</span>`}
        </div>
      </div>
      ${matches.length ? `
      <div class="session-matches collapsed">
        ${matches.map(renderMatchRow).join('<div class="match-divider"></div>')}
      </div>` : `
      <div class="session-matches collapsed">
        <div class="session-no-matches">Match details available from next session onwards</div>
      </div>`}`;
    container.appendChild(block);
  });
}

function toggleSessionMatches(header) {
  const matchList = header.nextElementSibling;
  if (!matchList) return;
  const isOpen = matchList.classList.toggle('collapsed');
  const chevron = header.querySelector('.session-chevron');
  if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(90deg)';
}

/* ── Init on load ── */
document.addEventListener('DOMContentLoaded', () => {
  updateProfileBtn();
});
