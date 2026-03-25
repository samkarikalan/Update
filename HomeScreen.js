/* =============================================
   HomeScreen.js
   Standalone home screen & session stepper.
   Depends on: schedulerState, allRounds (rounds.js)
               getMyClub, getMyPlayer (supabase.js)
   ============================================= */

/* ── State ── */
var _stepCourtsSet = false;
var _navSource = 'home'; // 'home' | 'rounds' — tracks where Players/Summary was opened from
var _stepPairsSeen = false;
var _homeCurrentStep = 0;

var STEP_DEFS = [
  {
    icon: '👥',
    title: 'Select Players',
    activeSub: 'Add at least 4 players to begin',
    doneSub: function() {
      var n = schedulerState.activeplayers.length;
      return n + ' player' + (n !== 1 ? 's' : '') + ' selected';
    },
    isDone: function() { return schedulerState.activeplayers.length >= 4; },
    go: function() { homeGo('playersPage', 'tabBtnPlayers'); }
  },
  {
    icon: '🤝',
    title: 'Fixed Pairs',
    activeSub: 'Optional — pair players who always play together',
    doneSub: function() {
      var n = schedulerState.fixedPairs.length;
      return n ? n + ' pair' + (n !== 1 ? 's' : '') + ' set' : 'Skipped (optional)';
    },
    isDone: function() { return _stepPairsSeen; },
    go: function() { homeGo('fixedPairsPage', 'tabBtnFixedPairs'); }
  },
  {
    icon: '🏟',
    title: 'Court Settings',
    activeSub: 'Set courts and play mode',
    doneSub: function() {
      var c = parseInt(document.getElementById('num-courts').textContent) || 1;
      var tog = document.getElementById('modeToggle');
      var mode = (tog && tog.checked) ? 'Competitive' : 'Random';
      return c + ' court' + (c !== 1 ? 's' : '') + ' \u00b7 ' + mode;
    },
    isDone: function() { return _stepCourtsSet; },
    go: function() { homeShowCourtsPanel(); }
  },
  {
    icon: '🏸',
    title: 'Start Rounds',
    activeSub: 'All set — ready to play!',
    doneSub: function() { return 'Session in progress'; },
    isDone: function() { return Array.isArray(allRounds) && allRounds.length > 0; },
    go: function() { homeGo('roundsPage', 'tabBtnRounds'); }
  }
];

/* ── Main entry: show home screen ── */
function showHomeScreen() {
  var homeEl = document.getElementById('homePageOverlay');
  if (!homeEl) return;

  // Add body class so .top-bar hides
  document.body.classList.add('home-open');

  homeEl.style.display = 'flex';


  // Mode + status bar
  var isOrganiser = (typeof appMode !== 'undefined') && appMode === 'organiser';
  var isVault     = (typeof appMode !== 'undefined') && appMode === 'vault';
  var statusBar  = document.getElementById('homeStatusBar');
  var statusName = document.getElementById('homeStatusName');
  var club   = (typeof getMyClub   === 'function') ? getMyClub()   : null;
  var player = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;
  var isAdmin = (typeof isClubAdmin === 'function') ? isClubAdmin() : false;

  if (club && club.name) {
    var modePrefix = isVault ? '🔑 ' : (isAdmin ? '★ ' : '');
    if (statusName) statusName.textContent = modePrefix + club.name;
    if (statusBar)  statusBar.classList.remove('disconnected');
  } else if (player && player.displayName) {
    if (statusName) statusName.textContent = player.displayName;
    if (statusBar)  statusBar.classList.remove('disconnected');
  } else {
    if (statusName) statusName.textContent = 'Not connected';
    if (statusBar)  statusBar.classList.add('disconnected');
  }

  // Show correct flow and grids (3 modes: viewer / organiser / vault)
  var isVault   = (typeof appMode !== 'undefined') && appMode === 'vault';
  var isViewer  = !isOrganiser && !isVault;

  var orgFlow    = document.getElementById('homeOrganizerFlow');
  var viewFlow   = document.getElementById('homeViewerFlow');
  var orgGrid    = document.getElementById('homeOrgGrid');
  var viewerGrid = document.getElementById('homeViewerGrid');
  var vaultGrid  = document.getElementById('homeVaultGrid');

  if (orgFlow)    orgFlow.style.display    = isOrganiser ? '' : 'none';
  if (viewFlow)   viewFlow.style.display   = isViewer    ? '' : 'none';
  if (orgGrid)    orgGrid.style.display    = isOrganiser ? '' : 'none';
  if (viewerGrid) viewerGrid.style.display = isViewer    ? '' : 'none';
  if (vaultGrid)  vaultGrid.style.display  = isVault     ? '' : 'none';

  if (isOrganiser) homeUpdateStepper();
  homeRefreshSummaryTile();
  homeRefreshTiles();
  homeRefreshJoinClubTile();
  // Init subscription and show trial banner
  if (typeof subInit === 'function') subInit();
  if (typeof subShowTrialBanner === 'function') subShowTrialBanner();
}

/* ── Refresh all tile subtitles with live data ── */
async function homeRefreshTiles() {
  var isOrganiser = (typeof appMode !== 'undefined') && appMode === 'organiser';

  // ── Vault ──
  var club   = (typeof getMyClub   === 'function') ? getMyClub()   : null;
  var isAdmin = (typeof isClubAdmin === 'function') ? isClubAdmin() : false;
  var vaultSub = document.getElementById('tileSubVault');
  if (vaultSub) {
    if (club && club.name) {
      vaultSub.textContent = club.name + (isAdmin ? ' · Admin' : ' · User');
    } else {
      vaultSub.textContent = 'Not connected';
    }
  }

  // ── Players ──
  var playersSub = document.getElementById('tileSubPlayers');
  if (playersSub) {
    if (typeof schedulerState !== 'undefined' && schedulerState.allPlayers) {
      var total  = schedulerState.allPlayers.length;
      var active = schedulerState.activeplayers.length;
      playersSub.textContent = total > 0
        ? total + ' players · ' + active + ' active'
        : 'Add · Remove';
    } else {
      playersSub.textContent = 'Add · Remove';
    }
  }

  // ── Fixed Pairs ──
  var pairsSub = document.getElementById('tileSubPairs');
  if (pairsSub) {
    var pairCount = (typeof schedulerState !== 'undefined' && schedulerState.fixedPairs)
      ? schedulerState.fixedPairs.length : 0;
    pairsSub.textContent = pairCount > 0
      ? pairCount + ' pair' + (pairCount !== 1 ? 's' : '') + ' set'
      : 'Optional';
  }

  // ── Settings ──
  var settingsSub = document.getElementById('tileSubSettings');
  var settingsSubV = document.getElementById('tileSubSettingsV');
  var settingsText = '';
  if (settingsSub || settingsSubV) {
    var theme    = localStorage.getItem('app-theme')    || 'dark';
    var fontSize = localStorage.getItem('appFontSize')  || 'medium';
    settingsText = (theme.charAt(0).toUpperCase() + theme.slice(1))
      + ' · ' + (fontSize.charAt(0).toUpperCase() + fontSize.slice(1));
    if (settingsSub)  settingsSub.textContent  = settingsText;
    if (settingsSubV) settingsSubV.textContent = settingsText;
  }

  // ── My Card tile (both grids) ──
  var tileRating  = document.getElementById('homeTileRating');
  var tileName    = document.getElementById('homeTileName');
  var tileAvatar  = document.getElementById('homeTileAvatar');
  var tileIcon    = document.getElementById('homeTileIcon');
  var tileRatingV = document.getElementById('homeTileRatingV');
  var tileNameV   = document.getElementById('homeTileNameV');
  var tileAvatarV = document.getElementById('homeTileAvatarV');
  var tileIconV   = document.getElementById('homeTileIconV');
  var player = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;

  function _setMyCardTile(name, avatar, icon, rating, p) {
    if (!name) return;
    if (p) {
      if (name)   name.textContent = p.name;
      if (avatar) { avatar.src = p.gender === 'Female' ? 'female.png' : 'male.png'; avatar.style.display = 'block'; }
      if (icon)   icon.style.display = 'none';
      if (rating) rating.textContent = 'Loading...';
      try {
        var master = JSON.parse(localStorage.getItem('newImportHistory') || '[]');
        var hp = master.find(function(h) {
          return h.displayName && h.displayName.trim().toLowerCase() === p.name.trim().toLowerCase();
        });
        var clubRating = parseFloat(hp && hp.clubRating) || 1.0;
        if (rating) rating.textContent = 'Club ' + clubRating.toFixed(1);
      } catch(e) {
        if (rating) rating.textContent = 'Tap to view';
      }
    } else {
      if (name)   name.textContent = 'My Card';
      if (avatar) avatar.style.display = 'none';
      if (icon)   { icon.style.display = ''; icon.textContent = '👤'; }
      if (rating) rating.textContent = 'Not selected';
    }
  }
  _setMyCardTile(tileName,  tileAvatar,  tileIcon,  tileRating,  player);
  _setMyCardTile(tileNameV, tileAvatarV, tileIconV, tileRatingV, player);

  // ── Dashboard — async fetch live session count ──
  var dashSub  = document.getElementById('tileSubDashboard');
  var dashSubV = document.getElementById('tileSubDashboardV');
  if (dashSub || dashSubV) {
    if (dashSub)  dashSub.textContent  = 'Loading...';
    if (dashSubV) dashSubV.textContent = 'Loading...';
    try {
      var sessions = (typeof dbGetLiveSessions === 'function') ? await dbGetLiveSessions() : [];
      var count = (sessions || []).length;
      var dashText = count > 0
        ? count + ' live session' + (count !== 1 ? 's' : '')
        : 'No live sessions';
      if (dashSub)  dashSub.textContent  = dashText;
      if (dashSubV) dashSubV.textContent = dashText;
    } catch(e) {
      if (dashSub)  dashSub.textContent  = 'Live sessions';
      if (dashSubV) dashSubV.textContent = 'Live sessions';
    }
  }
}

/* ── Hide home screen (go to inner page) ── */
function homeHideScreen() {
  var homeEl = document.getElementById('homePageOverlay');
  if (homeEl) homeEl.style.display = 'none';
  document.body.classList.remove('home-open');
}

/* ── Navigate to an inner page ── */
function homeGo(pageId, tabId) {
  if (!pageId) return;
  homeHideScreen();
  _navSource = 'home';
  var tabEl = tabId ? document.getElementById(tabId) : null;
  showPage(pageId, tabEl);
  _updateDynamicBackBtns(pageId);
}

/* ── Return from an inner page (Players/Rounds update stepper) ── */
function homeBack() {
  _stepPairsSeen = _stepPairsSeen || (schedulerState.activeplayers.length >= 4);
  showHomeScreen();
}

/* ── Update stepper UI ── */
function homeUpdateStepper() {
  // Reset courts panel
  var panel = document.getElementById('stepCourtsPanel');
  var card  = document.getElementById('stepCard');
  if (panel) panel.style.display = 'none';
  if (card)  card.style.display  = '';

  // Determine done state for each step
  var done = STEP_DEFS.map(function(s) { return s.isDone(); });

  // Current step = first not done; if all done = last
  var current = done.indexOf(false);
  if (current === -1) current = STEP_DEFS.length - 1;
  _homeCurrentStep = current;

  // Update each dot
  for (var i = 0; i < STEP_DEFS.length; i++) {
    var dot = document.getElementById('stepDot' + i);
    if (!dot) continue;
    dot.classList.remove('s-active', 's-done', 's-locked');
    var sn = dot.querySelector('.sn');

    if (i < current && done[i]) {
      dot.classList.add('s-done');
      if (sn) sn.textContent = '✓';
    } else if (i === current) {
      dot.classList.add('s-active');
      if (sn) sn.textContent = i + 1;
    } else {
      dot.classList.add(done[i] ? 's-done' : 's-locked');
      if (sn) sn.textContent = done[i] ? '✓' : (i + 1);
    }

    // Line after this step
    var line = document.getElementById('stepLine' + i);
    if (line) line.classList.toggle('s-done', i < current && done[i]);
  }

  // Update step card
  var step = STEP_DEFS[current];
  var isDoneCurrent = done[current];

  var icon  = document.getElementById('stepCardIcon');
  var title = document.getElementById('stepCardTitle');
  var sub   = document.getElementById('stepCardSub');
  var btn   = document.getElementById('stepCardBtn');

  if (icon)  icon.textContent  = step.icon;
  if (title) title.textContent = isDoneCurrent && current === STEP_DEFS.length - 1
    ? 'Session Active!' : step.title;
  if (sub)   sub.textContent   = isDoneCurrent ? step.doneSub() : step.activeSub;

  if (btn) {
    btn.classList.toggle('btn-done', isDoneCurrent && current === STEP_DEFS.length - 1);
    if (current === 1 && isDoneCurrent) {
      btn.textContent = 'Done \u2713';
    } else if (current === 2 && !_stepCourtsSet) {
      btn.textContent = 'Set Up \u203a';
    } else {
      btn.textContent = 'Go \u203a';
    }
  }

  // Show Skip only on step 2 (Fixed Pairs) when not yet done
  var skipBtn = document.getElementById('stepSkipBtn');
  if (skipBtn) skipBtn.style.display = (current === 1 && !isDoneCurrent) ? '' : 'none';
}

/* ── Step card button tapped ── */
function stepAction() {
  var step = STEP_DEFS[_homeCurrentStep];
  if (_homeCurrentStep === 1) _stepPairsSeen = true;
  step.go();
}

/* ── Skip Fixed Pairs ── */
function stepSkip() {
  _stepPairsSeen = true;
  homeUpdateStepper();
}

/* ── Courts panel ── */
function homeShowCourtsPanel() {
  var panel = document.getElementById('stepCourtsPanel');
  var card  = document.getElementById('stepCard');
  if (!panel || !card) return;

  // Sync from actual rounds page values
  var mainCourts = document.getElementById('num-courts');
  var stepCourts = document.getElementById('stepNumCourts');
  if (mainCourts && stepCourts) stepCourts.textContent = mainCourts.textContent;

  var mainToggle = document.getElementById('modeToggle');
  var stepToggle = document.getElementById('stepModeToggle');
  if (mainToggle && stepToggle) stepToggle.checked = mainToggle.checked;

  card.style.display  = 'none';
  panel.style.display = '';
}

function stepCourtAdj(delta) {
  var el = document.getElementById('stepNumCourts');
  if (!el) return;
  var max = Math.max(1, Math.floor(schedulerState.activeplayers.length / 4));
  var val = Math.min(max, Math.max(1, (parseInt(el.textContent) || 1) + delta));
  el.textContent = val;
  // Mirror to rounds page counter
  var main = document.getElementById('num-courts');
  if (main) main.textContent = val;
}

function stepSyncMode() {
  var stepToggle = document.getElementById('stepModeToggle');
  var mainToggle = document.getElementById('modeToggle');
  if (stepToggle && mainToggle) {
    mainToggle.checked = stepToggle.checked;
    mainToggle.dispatchEvent(new Event('change'));
  }
}

function stepCourtsDone() {
  _stepCourtsSet = true;
  homeGo('roundsPage', 'tabBtnRounds');
}

/* ── Summary navigation ── */
function homeGoSummary() {
  _navSource = 'home';
  homeGo('summaryPage', 'tabBtnSummary');
}

function roundsGoSummary() {
  _navSource = 'rounds';
  homeHideScreen();
  showPage('summaryPage', null);
  _updateDynamicBackBtns('summaryPage');
}

/* ── Players navigation from Rounds ── */
function roundsGoPlayers() {
  _navSource = 'rounds';
  homeHideScreen();
  showPage('playersPage', null);
  _updateDynamicBackBtns('playersPage');
}

function roundsGoFixedPairs() {
  _navSource = 'rounds';
  homeHideScreen();
  showPage('fixedPairsPage', null);
  _updateDynamicBackBtns('fixedPairsPage');
}

/* ── Update dynamic back button labels ── */
function _updateDynamicBackBtns(pageId) {
  var label = _navSource === 'rounds' ? '‹ Rounds' : '‹ Home';
  var ids = {
    playersPage:    'playersBackBtn',
    summaryPage:    'summaryBackBtn',
    fixedPairsPage: 'fixedPairsBackBtn'
  };
  var btnId = ids[pageId];
  if (btnId) {
    var btn = document.getElementById(btnId);
    if (btn) btn.textContent = label;
  }
}

/* ── Back navigation — goes to correct origin ── */
function navBack() {
  if (_navSource === 'rounds') {
    showPage('roundsPage', null);
  } else {
    showHomeScreen();
  }
}

/* ── Refresh Summary tile — always active since it fetches from Supabase ── */
function homeRefreshSummaryTile() {
  document.querySelectorAll('.home-tile-summary').forEach(function(tile) {
    tile.style.opacity       = '1';
    tile.style.pointerEvents = '';
  });
}

/* Language is now handled in Settings page */
function homeLangToggle() {}
function homeLangSelect() {}

/* ══════════════════════════════════════════════
   JOIN CLUB PAGE — Viewer mode tile & full page
   ══════════════════════════════════════════════ */

/* Called every time home screen opens — show/hide tile, refresh status */
function homeRefreshJoinClubTile() {
  var sub = document.getElementById('tileSubJoinClub');
  if (!sub) return;

  var club = (typeof getMyClub === 'function') ? getMyClub() : null;
  if (club && club.id && club.name) {
    sub.textContent = '✅ ' + club.name;
    return;
  }
  var pending = localStorage.getItem('kbrr_pending_club_name');
  if (pending) {
    sub.textContent = '⏳ Pending: ' + pending;
    return;
  }
  sub.textContent = 'Find & request';
}

/* ── Join Club Page — initialise when page opens ── */
async function joinClubPageOpen() {
  // Reset search
  var searchInput = document.getElementById('joinClubPageSearch');
  if (searchInput) searchInput.value = '';
  var results = document.getElementById('joinClubPageResults');
  if (results) { results.style.display = 'none'; results.innerHTML = ''; }
  var errEl = document.getElementById('joinClubPageError');
  if (errEl) errEl.style.display = 'none';
  var fbEl = document.getElementById('joinClubPageFeedback');
  if (fbEl) fbEl.style.display = 'none';

  var statusCard = document.getElementById('joinClubStatusCard');
  var searchSection = document.getElementById('joinClubSearchSection');

  // Already a member? — verify player row still exists in DB
  var club = (typeof getMyClub === 'function') ? getMyClub() : null;
  if (club && club.id && club.name) {
    try {
      var user = (typeof authGetUser === 'function') ? authGetUser() : null;
      if (user) {
        var playerCheck = await sbGet('players',
          'club_id=eq.' + club.id + '&user_account_id=eq.' + user.id + '&select=nickname');
        if (!playerCheck || !playerCheck.length) {
          // Player was removed from club — clear local state
          if (typeof clearMyClub === 'function') clearMyClub();
          else { localStorage.removeItem('kbrr_my_club_id'); localStorage.removeItem('kbrr_my_club_name'); }
          club = null;
        }
      }
    } catch(e) { /* offline — trust cached state */ }
  }
  if (club && club.id && club.name) {
    _joinClubShowStatus('joined', club.name);
    if (statusCard) statusCard.style.display = '';
    if (searchSection) searchSection.style.display = 'none';
    return;
  }

  // Pending request?
  var pendingName = localStorage.getItem('kbrr_pending_club_name');
  var pendingId   = localStorage.getItem('kbrr_pending_club_id');
  if (pendingId && pendingName) {
    // Re-check from server in case it was approved
    try {
      var user = (typeof authGetUser === 'function') ? authGetUser() : null;
      if (user) {
        var rows = await sbGet('club_join_requests',
          'club_id=eq.' + pendingId + '&user_account_id=eq.' + user.id + '&select=status');
        if (rows && rows.length) {
          if (rows[0].status === 'accepted') {
            // Verify player row still exists (not left/deleted)
            var playerCheck = await sbGet('players',
              'club_id=eq.' + pendingId + '&user_account_id=eq.' + user.id + '&select=id');
            if (!playerCheck || !playerCheck.length) {
              // Player row gone — treat as not a member
              localStorage.removeItem('kbrr_pending_club_id');
              localStorage.removeItem('kbrr_pending_club_name');
              // Fall through to search
            } else {
              setMyClub(pendingId, pendingName);
              localStorage.removeItem('kbrr_pending_club_id');
              localStorage.removeItem('kbrr_pending_club_name');
              _joinClubShowStatus('joined', pendingName);
              if (statusCard) statusCard.style.display = '';
              if (searchSection) searchSection.style.display = 'none';
              homeRefreshJoinClubTile();
              return;
            }
          } else if (rows[0].status === 'rejected') {
            localStorage.removeItem('kbrr_pending_club_id');
            localStorage.removeItem('kbrr_pending_club_name');
            // Fall through to search
          } else {
            _joinClubShowStatus('pending', pendingName);
            if (statusCard) statusCard.style.display = '';
            if (searchSection) searchSection.style.display = 'none';
            return;
          }
        }
      }
    } catch(e) {
      // Offline — show cached pending state
      _joinClubShowStatus('pending', pendingName);
      if (statusCard) statusCard.style.display = '';
      if (searchSection) searchSection.style.display = 'none';
      return;
    }
  }

  // No club — show search
  if (statusCard) statusCard.style.display = 'none';
  if (searchSection) searchSection.style.display = '';
}

function _joinClubShowStatus(state, clubName) {
  var icon  = document.getElementById('joinClubStatusIcon');
  var title = document.getElementById('joinClubStatusTitle');
  var msg   = document.getElementById('joinClubStatusMsg');
  var leave = document.getElementById('joinClubLeaveBtn');
  var card  = document.getElementById('joinClubStatusCard');

  if (state === 'joined') {
    if (icon)  icon.textContent  = '✅';
    if (title) title.textContent = 'Joined: ' + clubName;
    if (msg)   msg.textContent   = 'You are a member of this club. Switch to Organiser mode to manage sessions.';
    if (leave) leave.style.display = '';
    if (card)  card.style.borderColor = '#2dce89';
  } else if (state === 'pending') {
    if (icon)  icon.textContent  = '⏳';
    if (title) title.textContent = 'Request Pending';
    if (msg)   msg.textContent   = 'Your request to join "' + clubName + '" is awaiting admin approval. Check back soon.';
    if (leave) leave.style.display = '';
    if (card)  card.style.borderColor = '#e6a817';
  }
}

/* ── Search clubs as user types ── */
var _joinClubSearchTimer = null;
function joinClubPageSearchUI(query) {
  clearTimeout(_joinClubSearchTimer);
  var errEl = document.getElementById('joinClubPageError');
  if (errEl) errEl.style.display = 'none';
  var fbEl = document.getElementById('joinClubPageFeedback');
  if (fbEl) fbEl.style.display = 'none';

  if (!query || query.trim().length < 2) {
    var r = document.getElementById('joinClubPageResults');
    if (r) { r.style.display = 'none'; r.innerHTML = ''; }
    return;
  }
  _joinClubSearchTimer = setTimeout(function() { _joinClubDoSearch(query); }, 350);
}

async function _joinClubDoSearch(query) {
  var resultsEl = document.getElementById('joinClubPageResults');
  var errEl     = document.getElementById('joinClubPageError');
  if (!resultsEl) return;

  resultsEl.innerHTML = '<div style="padding:12px;text-align:center;color:var(--muted);font-size:0.85rem;">Searching...</div>';
  resultsEl.style.display = '';

  var result = (typeof authSearchClubs === 'function') ? await authSearchClubs(query) : { clubs: [] };

  if (result.error) {
    resultsEl.style.display = 'none';
    if (errEl) { errEl.textContent = result.error; errEl.style.display = ''; }
    return;
  }

  var clubs = result.clubs || [];
  if (!clubs.length) {
    resultsEl.innerHTML = '<div style="padding:14px;text-align:center;color:var(--muted);font-size:0.85rem;">No clubs found for "' + query + '"</div>';
    return;
  }

  resultsEl.innerHTML = clubs.map(function(c) {
    return '<div onclick="joinClubPageRequest(\'' + c.id + '\',\'' + c.name.replace(/'/g, "\\'") + '\')" style="padding:14px 16px;cursor:pointer;border-bottom:1px solid var(--border,#333);display:flex;align-items:center;justify-content:space-between;background:var(--card-bg,#1e1e2e);border-radius:12px;margin-bottom:6px;">' +
      '<div><div style="font-weight:600;color:var(--text);">' + c.name + '</div></div>' +
      '<span style="color:var(--accent,#6c63ff);font-size:0.82rem;font-weight:600;">Request ›</span>' +
    '</div>';
  }).join('');
}

/* ── Stores clubId/Name while user picks a new nickname ── */
var _pendingJoinClubId   = null;
var _pendingJoinClubName = null;

async function joinClubPageRequest(clubId, clubName, customNickname) {
  var fbEl      = document.getElementById('joinClubPageFeedback');
  var fbIcon    = document.getElementById('joinClubPageFeedbackIcon');
  var fbTitle   = document.getElementById('joinClubPageFeedbackTitle');
  var fbMsg     = document.getElementById('joinClubPageFeedbackMsg');
  var resultsEl = document.getElementById('joinClubPageResults');
  var errEl     = document.getElementById('joinClubPageError');
  var nickEl    = document.getElementById('joinClubNicknameSection');

  if (errEl) errEl.style.display = 'none';
  if (nickEl) nickEl.style.display = 'none';

  // Show loading
  if (fbEl) {
    if (fbIcon)  fbIcon.textContent  = '⏳';
    if (fbTitle) fbTitle.textContent = 'Checking...';
    if (fbMsg)   fbMsg.textContent   = '';
    fbEl.style.display = '';
  }
  if (resultsEl) resultsEl.style.display = 'none';

  var result = (typeof authRequestJoin === 'function')
    ? await authRequestJoin(clubId, customNickname)
    : { error: 'Not available' };

  if (result.alreadyMember) {
    _joinClubShowStatus('joined', clubName);
    document.getElementById('joinClubStatusCard').style.display = '';
    document.getElementById('joinClubSearchSection').style.display = 'none';
    if (fbEl) fbEl.style.display = 'none';
    homeRefreshJoinClubTile();
    return;
  }

  if (result.nicknameConflict) {
    // Nickname taken — ask user to pick a different one
    if (fbEl) fbEl.style.display = 'none';
    _pendingJoinClubId   = clubId;
    _pendingJoinClubName = clubName;
    if (nickEl) {
      var msgEl  = document.getElementById('joinClubNicknameMsg');
      var inputEl = document.getElementById('joinClubNicknameInput');
      if (msgEl)  msgEl.textContent = '"' + result.conflictNickname + '" is already taken in ' + clubName + '. Choose a different nickname for this club:';
      if (inputEl) inputEl.value = '';
      nickEl.style.display = '';
    }
    return;
  }

  if (result.pending || result.success) {
    localStorage.setItem('kbrr_pending_club_id',   clubId);
    localStorage.setItem('kbrr_pending_club_name', clubName);
    if (fbIcon)  fbIcon.textContent  = '⏳';
    if (fbTitle) fbTitle.textContent = 'Request Sent!';
    if (fbMsg)   fbMsg.textContent   = 'Waiting for admin approval for "' + clubName + '". Check back here to see when you\'re approved.';
    homeRefreshJoinClubTile();
    return;
  }

  if (result.error) {
    if (fbEl) fbEl.style.display = 'none';
    if (resultsEl) resultsEl.style.display = '';
    if (errEl) { errEl.textContent = result.error; errEl.style.display = ''; }
  }
}

/* ── Called when user submits their chosen nickname ── */
function joinClubSubmitNickname() {
  var inputEl = document.getElementById('joinClubNicknameInput');
  var nickname = inputEl ? inputEl.value.trim() : '';
  if (!nickname) {
    var errEl = document.getElementById('joinClubPageError');
    if (errEl) { errEl.textContent = 'Please enter a nickname.'; errEl.style.display = ''; }
    return;
  }
  joinClubPageRequest(_pendingJoinClubId, _pendingJoinClubName, nickname);
}

/* ── Leave club ── */
async function joinClubLeave() {
  if (!confirm('Leave this club?')) return;

  var pendingClubId = localStorage.getItem('kbrr_pending_club_id');
  var myClub = (typeof getMyClub === 'function') ? getMyClub() : null;
  var clubId = (myClub && myClub.id) || pendingClubId;
  var user   = (typeof authGetUser === 'function') ? authGetUser() : null;

  // Delete from DB: player row and join request
  if (clubId && user) {
    try {
      // Delete player row for this user in this club
      await sbDelete('players', 'club_id=eq.' + clubId + '&user_account_id=eq.' + user.id);
    } catch(e) { /* silent */ }
    try {
      // Delete join request so it doesn't restore on next login
      await sbDelete('club_join_requests', 'club_id=eq.' + clubId + '&user_account_id=eq.' + user.id);
    } catch(e) { /* silent */ }
  }

  // Clear localStorage
  localStorage.removeItem('kbrr_pending_club_id');
  localStorage.removeItem('kbrr_pending_club_name');
  localStorage.removeItem('kbrr_cache_players');
  localStorage.removeItem('kbrr_cache_ts');
  if (typeof clearMyClub === 'function') clearMyClub();
  else {
    localStorage.removeItem('kbrr_my_club_id');
    localStorage.removeItem('kbrr_my_club_name');
  }

  // Reset page view
  document.getElementById('joinClubStatusCard').style.display = 'none';
  document.getElementById('joinClubSearchSection').style.display = '';
  homeRefreshJoinClubTile();
}
