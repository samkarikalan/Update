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
  var statusBar  = document.getElementById('homeStatusBar');
  var statusName = document.getElementById('homeStatusName');
  var club   = (typeof getMyClub   === 'function') ? getMyClub()   : null;
  var player = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;
  var isAdmin = (typeof isClubAdmin === 'function') ? isClubAdmin() : false;

  if (club && club.name) {
    if (statusName) statusName.textContent = (isAdmin ? '★ ' : '') + club.name;
    if (statusBar)  statusBar.classList.remove('disconnected');
  } else if (player && player.displayName) {
    if (statusName) statusName.textContent = player.displayName;
    if (statusBar)  statusBar.classList.remove('disconnected');
  } else {
    if (statusName) statusName.textContent = 'Not connected';
    if (statusBar)  statusBar.classList.add('disconnected');
  }

  // Show correct flow
  var orgFlow  = document.getElementById('homeOrganizerFlow');
  var viewFlow = document.getElementById('homeViewerFlow');
  if (orgFlow)  orgFlow.style.display  = isOrganiser ? '' : 'none';
  if (viewFlow) viewFlow.style.display = isOrganiser ? 'none' : '';

  // Viewer: hide Vault tile
  document.querySelectorAll('.home-tile-org').forEach(function(t) {
    t.style.display = isOrganiser ? '' : 'none';
  });

  if (isOrganiser) homeUpdateStepper();
  homeRefreshSummaryTile();
  homeRefreshTiles();
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
  if (settingsSub) {
    var theme    = localStorage.getItem('app-theme')    || 'dark';
    var fontSize = localStorage.getItem('appFontSize')  || 'medium';
    settingsSub.textContent = (theme.charAt(0).toUpperCase() + theme.slice(1))
      + ' · ' + (fontSize.charAt(0).toUpperCase() + fontSize.slice(1));
  }

  // ── My Card tile ──
  var tileRating = document.getElementById('homeTileRating');
  var tileName   = document.getElementById('homeTileName');
  var tileAvatar = document.getElementById('homeTileAvatar');
  var tileIcon   = document.getElementById('homeTileIcon');
  var player = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;
  if (player) {
    if (tileName)   tileName.textContent = player.name;
    if (tileAvatar) { tileAvatar.src = player.gender === 'Female' ? 'female.png' : 'male.png'; tileAvatar.style.display = 'block'; }
    if (tileIcon)   tileIcon.style.display = 'none';
    if (tileRating) tileRating.textContent = 'Loading...';
    // Async: fetch club rating
    try {
      var master = JSON.parse(localStorage.getItem('newImportHistory') || '[]');
      var hp = master.find(function(h) {
        return h.displayName && h.displayName.trim().toLowerCase() === player.name.trim().toLowerCase();
      });
      var clubRating = parseFloat(hp && hp.clubRating) || 1.0;
      if (tileRating) tileRating.textContent = 'Club ' + clubRating.toFixed(1);
    } catch(e) {
      if (tileRating) tileRating.textContent = 'Tap to view';
    }
  } else {
    if (tileName)   tileName.textContent = 'My Card';
    if (tileAvatar) tileAvatar.style.display = 'none';
    if (tileIcon)   { tileIcon.style.display = ''; tileIcon.textContent = '👤'; }
    if (tileRating) tileRating.textContent = 'Not selected';
  }

  // ── Dashboard — async fetch live session count ──
  var dashSub = document.getElementById('tileSubDashboard');
  if (dashSub) {
    dashSub.textContent = 'Loading...';
    try {
      var sessions = (typeof dbGetLiveSessions === 'function') ? await dbGetLiveSessions() : [];
      var count = (sessions || []).length;
      dashSub.textContent = count > 0
        ? count + ' live session' + (count !== 1 ? 's' : '')
        : 'No live sessions';
    } catch(e) {
      dashSub.textContent = 'Live sessions';
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
