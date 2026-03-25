/* ============================================================
   PROFILE DRAWER — Player identity, stats, recent sessions
   File: profile.js
   ============================================================ */

const PROFILE_KEY = 'kbrr_my_player';
let _profileSwitching = false; // true while user is mid-switch
let _previousPlayer   = null;  // saved before switch so cancel can restore

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
  if (r < 2.0) return { label: 'Rookie',       color: '#9e9e9e' };
  if (r < 3.0) return { label: 'Club',          color: '#4a9eff' };
  if (r < 4.0) return { label: 'Competitive',   color: '#2dce89' };
  if (r < 4.5) return { label: 'Advanced',      color: '#f5a623' };
  return             { label: 'Elite',           color: '#e63757' };
}

/* ── Update header profile button appearance ── */
async function updateProfileBtn() {
  const player = getMyPlayer();
  const src = player ? (player.gender === 'Female' ? 'female.png' : 'male.png') : null;

  // Update profile buttons (main top bar + home overlay)
  [
    { avatar: 'profileBtnAvatar',  icon: 'profileBtnIcon'  },
    { avatar: 'homeProfileAvatar', icon: 'homeProfileIcon' },
  ].forEach(function(ids) {
    const avatarEl = document.getElementById(ids.avatar);
    const iconEl   = document.getElementById(ids.icon);
    if (!avatarEl || !iconEl) return;
    if (player) {
      avatarEl.src           = src;
      avatarEl.style.display = 'block';
      iconEl.style.display   = 'none';
    } else {
      avatarEl.style.display = 'none';
      iconEl.style.display   = 'block';
    }
  });

  // Update home profile tile
  const tileAvatar = document.getElementById('homeTileAvatar');
  const tileIcon   = document.getElementById('homeTileIcon');
  const tileName   = document.getElementById('homeTileName');
  const tileRating = document.getElementById('homeTileRating');

  if (!player) {
    if (tileAvatar) tileAvatar.style.display = 'none';
    if (tileIcon)   { tileIcon.style.display = ''; tileIcon.textContent = '👤'; }
    if (tileName)   tileName.textContent = 'My Profile';
    if (tileRating) tileRating.textContent = 'Not selected';
    return;
  }

  if (tileAvatar) { tileAvatar.src = src; tileAvatar.style.display = 'block'; }
  if (tileIcon)   tileIcon.style.display = 'none';
  if (tileName)   tileName.textContent = player.name;
  if (tileRating) tileRating.textContent = 'Loading...';

  try {
    const master = JSON.parse(localStorage.getItem('newImportHistory') || '[]');
    const hp = master.find(function(h) {
      return h.displayName && h.displayName.trim().toLowerCase() === player.name.trim().toLowerCase();
    });
    const clubRating = parseFloat(hp && hp.clubRating) || 1.0;

    const club  = (typeof getMyClub === 'function') ? getMyClub() : { id: null };
    const today = new Date().toISOString().split('T')[0];
    let wins = 0, losses = 0, hasSession = false;

    if (club.id) {
      const liveRows = await sbGet('live_sessions',
        'player_name=ilike.' + encodeURIComponent(player.name) + '&club_id=eq.' + club.id + '&date=eq.' + today);
      if (liveRows && liveRows.length) {
        const matches = typeof liveRows[0].matches === 'string'
          ? JSON.parse(liveRows[0].matches) : (liveRows[0].matches || []);
        wins   = matches.filter(function(m) { return m.result === 'W'; }).length;
        losses = matches.filter(function(m) { return m.result === 'L'; }).length;
        hasSession = matches.length > 0;
      }
    }

    if (tileRating) {
      tileRating.textContent = hasSession
        ? 'Club ' + clubRating.toFixed(1) + '  ·  W:' + wins + ' L:' + losses
        : 'Club ' + clubRating.toFixed(1);
    }
  } catch(e) {
    const master = JSON.parse(localStorage.getItem('newImportHistory') || '[]');
    const hp = master.find(function(h) {
      return h.displayName && h.displayName.trim().toLowerCase() === player.name.trim().toLowerCase();
    });
    const clubRating = parseFloat(hp && hp.clubRating) || 1.0;
    if (tileRating) tileRating.textContent = 'Club ' + clubRating.toFixed(1);
  }
}



/* ── Open drawer ── */
async function openProfileDrawer() {
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
  const player = getMyPlayer();
  if (!player) {
    if (_profileSwitching && _previousPlayer) {
      // Cancel switch — restore previous player and close
      _profileSwitching = false;
      setMyPlayer(_previousPlayer);
      updateProfileBtn();
      _previousPlayer = null;
    } else {
      // No profile at all — block closing
      return;
    }
  }
  document.getElementById('profileOverlay').classList.add('hidden');
  document.getElementById('profileDrawer').classList.remove('open');
}

/* ── Show player picker — loads from Supabase ── */
let _pickerAllPlayers = []; // cache for search filtering

function showProfilePicker() {
  document.getElementById('profilePicker').style.display    = 'block';
  document.getElementById('profileCard').style.display      = 'none';
  document.getElementById('pickerListView').style.display   = 'block';
  document.getElementById('pinScreenView').style.display    = 'none';

  const list = document.getElementById('profilePickerList');
  list.innerHTML = '<div class="profile-sessions-loading">Loading players...</div>';

  // Clear search box
  const searchEl = document.getElementById('profileSearch');
  if (searchEl) searchEl.value = '';

  // Load ALL players from server (no club filter)
  sbGet('players', `club_id=eq.${(getMyClub&&getMyClub()||{}).id||''}&order=nickname.asc&select=id,nickname,gender,rating,club_rating,pin,recovery_word`).then(players => {
    _pickerAllPlayers = (players || []).map(p => ({
      name:          p.nickname,
      gender:        p.gender || 'Male',
      rating:        p.rating || 1.0,
      club_rating:   parseFloat(p.club_rating) || 1.0,
      pin:           p.pin || null,
      recovery_word: p.recovery_word || null
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
    btn.onclick = () => profileSelectPlayer(p);
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

/* ── PIN FLOW ── */

// Entry point when player name tapped
function profileSelectPlayer(p) {
  if (!p.pin) {
    // No PIN yet — show setup screen
    showPinSetup(p);
  } else {
    // PIN exists — show login screen
    showPinLogin(p);
  }
}

// Render a PIN screen inside the picker area
function _showPinScreen(html) {
  document.getElementById('pickerListView').style.display  = 'none';
  const pinView = document.getElementById('pinScreenView');
  pinView.style.display = 'block';
  pinView.innerHTML = `
    <div class="profile-drawer-header">
      <span class="profile-drawer-title">Who are you?</span>
      <button class="profile-drawer-close" onclick="showProfilePicker()">✕</button>
    </div>
    <div class="pin-screen">${html}</div>`;
}

// ── Setup: first time — set PIN + recovery word ──
function showPinSetup(p) {
  _showPinScreen(`
    <div class="pin-name">${p.name}</div>
    <p class="pin-hint">First time? Set a 4-digit PIN and a recovery word.</p>
    <input id="pinSetupPin" type="password" inputmode="numeric" maxlength="4"
      class="pin-input" placeholder="Set PIN (4 digits)">
    <input id="pinSetupConfirm" type="password" inputmode="numeric" maxlength="4"
      class="pin-input" placeholder="Confirm PIN">
    <input id="pinSetupRecovery" type="text" class="pin-input"
      placeholder="Recovery word (secret)">
    <div id="pinSetupError" class="pin-error"></div>
    <button class="pin-btn" onclick="confirmPinSetup('${p.name.replace(/'/g,"\\'")}')">Save & Continue</button>
  `);
}

async function confirmPinSetup(name) {
  const pin     = document.getElementById('pinSetupPin').value.trim();
  const confirm = document.getElementById('pinSetupConfirm').value.trim();
  const recovery = document.getElementById('pinSetupRecovery').value.trim().toLowerCase();
  const err     = document.getElementById('pinSetupError');

  if (!/^\d{4}$/.test(pin))       { err.textContent = 'PIN must be exactly 4 digits.'; return; }
  if (pin !== confirm)             { err.textContent = 'PINs do not match.'; return; }
  if (recovery.length < 3)        { err.textContent = 'Recovery word too short.'; return; }

  err.textContent = '⏳ Saving...';
  try {
    await sbPatch('players', `club_id=eq.${(getMyClub&&getMyClub()||{}).id||''}&nickname=ilike.${encodeURIComponent(name)}`, {
      pin, recovery_word: recovery
    });
    const p = _pickerAllPlayers.find(x => x.name === name);
    if (p) { p.pin = pin; p.recovery_word = recovery; }
    err.textContent = '';
    _completeProfileSelection(name);
  } catch(e) {
    err.textContent = 'Failed to save. Try again.';
  }
}

// ── Login: enter PIN ──
function showPinLogin(p) {
  _showPinScreen(`
    <div class="pin-name">${p.name}</div>
    <p class="pin-hint">Enter your PIN to continue.</p>
    <input id="pinLoginPin" type="password" inputmode="numeric" maxlength="4"
      class="pin-input" placeholder="Enter PIN">
    <div id="pinLoginError" class="pin-error"></div>
    <button class="pin-btn" onclick="confirmPinLogin('${p.name.replace(/'/g,"\\'")}')">Continue</button>
    <button class="pin-btn-secondary" onclick="showPinRecovery('${p.name.replace(/'/g,"\\'")}')">Forgot PIN?</button>
  `);
  // Allow Enter key
  setTimeout(() => {
    const el = document.getElementById('pinLoginPin');
    if (el) el.addEventListener('keydown', e => {
      if (e.key === 'Enter') confirmPinLogin(p.name);
    });
  }, 50);
}

function confirmPinLogin(name) {
  const entered = document.getElementById('pinLoginPin').value.trim();
  const err     = document.getElementById('pinLoginError');
  const p       = _pickerAllPlayers.find(x => x.name === name);
  if (!p) { err.textContent = 'Player not found.'; return; }
  if (entered !== p.pin) { err.textContent = '❌ Wrong PIN. Try again.'; return; }
  _completeProfileSelection(name);
}

// ── Recovery: enter recovery word → reset PIN ──
function showPinRecovery(name) {
  _showPinScreen(`
    <div class="pin-name">${name}</div>
    <p class="pin-hint">Enter your recovery word to reset your PIN.</p>
    <input id="pinRecoveryWord" type="text" class="pin-input" placeholder="Recovery word">
    <input id="pinRecoveryNew" type="password" inputmode="numeric" maxlength="4"
      class="pin-input" placeholder="New PIN (4 digits)">
    <input id="pinRecoveryConfirm" type="password" inputmode="numeric" maxlength="4"
      class="pin-input" placeholder="Confirm new PIN">
    <div id="pinRecoveryError" class="pin-error"></div>
    <button class="pin-btn" onclick="confirmPinRecovery('${name.replace(/'/g,"\\'")}')">Reset PIN</button>
    <button class="pin-btn-secondary" onclick="showProfilePicker()">Back</button>
  `);
}

async function confirmPinRecovery(name) {
  const word    = document.getElementById('pinRecoveryWord').value.trim().toLowerCase();
  const newPin  = document.getElementById('pinRecoveryNew').value.trim();
  const confirm = document.getElementById('pinRecoveryConfirm').value.trim();
  const err     = document.getElementById('pinRecoveryError');
  const p       = _pickerAllPlayers.find(x => x.name === name);

  if (!p) { err.textContent = 'Player not found.'; return; }
  if (word !== (p.recovery_word || '').toLowerCase()) {
    err.textContent = '❌ Wrong recovery word.'; return;
  }
  if (!/^\d{4}$/.test(newPin))    { err.textContent = 'PIN must be 4 digits.'; return; }
  if (newPin !== confirm)          { err.textContent = 'PINs do not match.'; return; }

  err.textContent = '⏳ Saving...';
  try {
    await sbPatch('players', `club_id=eq.${(getMyClub&&getMyClub()||{}).id||''}&nickname=ilike.${encodeURIComponent(name)}`, { pin: newPin });
    p.pin = newPin;
    err.textContent = '';
    _completeProfileSelection(name);
  } catch(e) {
    err.textContent = 'Failed to save. Try again.';
  }
}

// ── Final step: set profile and open card ──
function _completeProfileSelection(name) {
  _profileSwitching = false;
  _previousPlayer   = null;
  const p = _pickerAllPlayers.find(x => x.name === name);
  const player = { name, gender: (p && p.gender) || 'Male' };
  setMyPlayer(player);
  updateProfileBtn();
  showProfileCard(player);
}

/* ── Switch player ── */
function switchProfilePlayer() {
  _previousPlayer   = getMyPlayer(); // save so cancel can restore
  _profileSwitching = true;
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

  // Single gate — sync first, then read both raw values from cache
  await syncToLocal();
  const master       = JSON.parse(localStorage.getItem('newImportHistory') || '[]');
  const hp           = master.find(h => h.displayName.trim().toLowerCase() === player.name.trim().toLowerCase());
  const globalRating = parseFloat(hp && hp.rating)      || 1.0;  // players.rating — only updated in global mode
  const clubRating   = parseFloat(hp && hp.clubRating)  || 1.0;  // club_ratings[clubId] — only updated in local mode
  const activeRating = parseFloat(hp && hp.activeRating)|| 1.0;  // what session uses
  const tier         = ratingTierLabel(activeRating);

  document.getElementById('pcRating').textContent     = globalRating.toFixed(1);
  document.getElementById('pcClubRating').textContent = clubRating.toFixed(1);
  document.getElementById('pcTier').textContent       = tier.label;
  document.getElementById('pcTier').style.background  = tier.color + '22';
  document.getElementById('pcTier').style.color       = tier.color;

  // Fetch wins/losses only
  document.getElementById('pcWins').textContent   = '…';
  document.getElementById('pcLosses').textContent = '…';
  try {
    const playerRows = await sbGet('players',
      `club_id=eq.${(getMyClub&&getMyClub()||{}).id||''}&nickname=ilike.${encodeURIComponent(player.name)}&select=wins,losses`);
    if (playerRows && playerRows.length) {
      document.getElementById('pcWins').textContent   = (playerRows[0].wins   || 0);
      document.getElementById('pcLosses').textContent = (playerRows[0].losses || 0);
    } else {
      document.getElementById('pcWins').textContent   = '—';
      document.getElementById('pcLosses').textContent = '—';
    }
  } catch(e) {
    document.getElementById('pcWins').textContent   = '—';
    document.getElementById('pcLosses').textContent = '—';
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
function renderMatchRow(m, playerName) {
  const isWin          = m.result === 'W';
  const partner        = m.partner        || [];
  const partnerGenders = m.partnerGenders || partner.map(() => 'Male');
  const opponents      = m.opponents      || [];
  const oppGenders     = m.opponentGenders || opponents.map(() => 'Male');
  const myGender       = m.myGender || 'Male';
  const date           = m.date || '';

  const makePlayer = (name, gender) =>
    `<div class="mc-match-player">
      <img src="${gender === 'Female' ? 'female.png' : 'male.png'}" class="mc-match-avatar">
      <span class="mc-match-name">${name}</span>
    </div>`;

  const myTeam  = [makePlayer(playerName, myGender), ...partner.map((n, i) => makePlayer(n, partnerGenders[i]))].join('');
  const oppTeam = opponents.map((n, i) => makePlayer(n, oppGenders[i])).join('');

  return `
    <div class="mc-match-card ${isWin ? 'mc-win' : 'mc-loss'}">
      <div class="mc-match-team mc-match-top">
        <div class="mc-match-players">${myTeam}</div>
        ${isWin ? '<div class="mc-match-cup">🏆</div>' : ''}
      </div>
      <div class="mc-match-divider">
        <div class="mc-match-divider-line"></div>
        <span class="mc-match-result-badge ${isWin ? 'mc-badge-win' : 'mc-badge-loss'}">${isWin ? 'WIN' : 'LOSS'}</span>
        <div class="mc-match-divider-line"></div>
      </div>
      <div class="mc-match-team mc-match-bottom">
        <div class="mc-match-players">${oppTeam}</div>
        ${!isWin ? '<div class="mc-match-cup">🏆</div>' : ''}
      </div>
      ${date ? `<div class="mc-match-date">${date}</div>` : ''}
    </div>`;
}

/* ── My Card Page ── */
async function renderMyCard() {
  const player = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;

  const emptyEl   = document.getElementById('myCardEmpty');
  const contentEl = document.getElementById('myCardContent');

  if (!player) {
    if (emptyEl)   emptyEl.style.display   = '';
    if (contentEl) contentEl.style.display = 'none';
    return;
  }

  if (emptyEl)   emptyEl.style.display   = 'none';
  if (contentEl) contentEl.style.display = '';

  // Avatar + Name
  const avatar = document.getElementById('mcAvatar');
  if (avatar) avatar.src = player.gender === 'Female' ? 'female.png' : 'male.png';
  const nameEl = document.getElementById('mcName');
  if (nameEl) nameEl.textContent = player.name;

  // Ratings from local cache
  await syncToLocal();
  const master       = JSON.parse(localStorage.getItem('newImportHistory') || '[]');
  const hp           = master.find(h => h.displayName && h.displayName.trim().toLowerCase() === player.name.trim().toLowerCase());
  const globalRating = parseFloat(hp && hp.rating)       || 1.0;
  const clubRating   = parseFloat(hp && hp.clubRating)   || 1.0;
  const activeRating = parseFloat(hp && hp.activeRating) || 1.0;
  const tier         = ratingTierLabel(activeRating);

  const grEl = document.getElementById('mcGlobalRating');
  const crEl = document.getElementById('mcClubRating');
  const tierEl = document.getElementById('mcTier');
  if (grEl)   grEl.textContent  = globalRating.toFixed(1);
  if (crEl)   crEl.textContent  = clubRating.toFixed(1);
  if (tierEl) { tierEl.textContent = tier.label; tierEl.style.background = tier.color + '22'; tierEl.style.color = tier.color; }

  // Wins / Losses + Sessions from DB
  const winsEl   = document.getElementById('mcWins');
  const lossesEl = document.getElementById('mcLosses');
  const sessEl   = document.getElementById('mcSessions');
  if (winsEl)   winsEl.textContent   = '…';
  if (lossesEl) lossesEl.textContent = '…';
  if (sessEl)   sessEl.innerHTML     = '<div class="profile-sessions-loading">Loading...</div>';

  try {
    const club  = (typeof getMyClub === 'function') ? getMyClub() : { id: null };
    const today = new Date().toISOString().split('T')[0];

    const [playerRows, liveRows] = await Promise.all([
      sbGet('players', `club_id=eq.${(getMyClub&&getMyClub()||{}).id||''}&nickname=ilike.${encodeURIComponent(player.name)}&select=wins,losses,sessions`),
      club.id
        ? sbGet('live_sessions',
            `player_name=ilike.${encodeURIComponent(player.name)}&club_id=eq.${club.id}&date=eq.${today}`)
        : Promise.resolve([])
    ]);

    const lsKey         = `kbrr_sessions_${player.name.toLowerCase().replace(/\s+/g, '_')}`;
    const localSessions = JSON.parse(localStorage.getItem(lsKey) || '[]');
    const liveRow       = liveRows && liveRows.length ? liveRows[0] : null;
    const liveMatches   = liveRow
      ? (typeof liveRow.matches === 'string' ? JSON.parse(liveRow.matches) : (liveRow.matches || []))
      : null;

    let sessions = localSessions;
    if (playerRows && playerRows.length) {
      const data = playerRows[0];
      sessions   = mergeSessions(localSessions, data.sessions || []);
      if (winsEl)   winsEl.textContent   = (data.wins   || 0);
      if (lossesEl) lossesEl.textContent = (data.losses || 0);
    } else {
      if (winsEl)   winsEl.textContent   = '—';
      if (lossesEl) lossesEl.textContent = '—';
    }

    // Render sessions into mcSessions using a temp swap
    if (sessEl) {
      const prev = sessEl.id;
      sessEl.id  = 'pcSessions';
      renderSessions(sessions, player.name, liveMatches);
      sessEl.id  = prev;
    }

  } catch(e) {
    if (winsEl)   winsEl.textContent   = '—';
    if (lossesEl) lossesEl.textContent = '—';
    if (sessEl)   sessEl.innerHTML     = '<div class="profile-sessions-empty">Could not load sessions.</div>';
  }
}

/* ── Render sessions with PDF-style match history ── */
function renderSessions(sessions, playerName, liveMatches) {
  const container = document.getElementById('pcSessions');
  container.innerHTML = '';

  // liveMatches comes from live_sessions DB (any device) or allRounds (local fallback)
  if (!liveMatches && typeof allRounds !== 'undefined' && allRounds.length) {
    liveMatches = [];
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

  const hasLive = Array.isArray(liveMatches) && liveMatches.length > 0;
  const hasPast = sessions.length > 0;

  if (!hasLive && !hasPast) {
    container.innerHTML = '<div class="profile-sessions-empty">No sessions recorded yet.</div>';
    return;
  }

  // ── Current session ──
  if (hasLive) {
    const liveWins   = liveMatches.filter(m => m.result === 'W').length;
    const liveLosses = liveMatches.filter(m => m.result === 'L').length;
    const rating     = (typeof getActiveRating === 'function') ? getActiveRating(playerName) : getRating(playerName);
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
        ${liveMatches.map(m => renderMatchRow(m, playerName)).join('<div class="match-divider"></div>')}
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
        ${matches.map(m => renderMatchRow(m, playerName)).join('<div class="match-divider"></div>')}
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
