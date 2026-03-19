/* =============================================
   HomeScreen.js
   Standalone home screen & session stepper.
   Depends on: schedulerState, allRounds (rounds.js)
               getMyClub, getMyPlayer (supabase.js)
   ============================================= */

/* ── State ── */
var _stepCourtsSet = false;
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
    go: function() { homeGo('playersPage', 'tabBtnPlayers'); }
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

  // Sync flag
  var mainFlag = document.getElementById('currentFlag');
  var homeFlag = document.getElementById('homeFlagDisplay');
  if (mainFlag && homeFlag) homeFlag.textContent = mainFlag.textContent;

  // Status bar
  var isOrganiser = (typeof appMode !== 'undefined') && appMode === 'organiser';
  var statusBar  = document.getElementById('homeStatusBar');
  var statusName = document.getElementById('homeStatusName');
  var statusRole = document.getElementById('homeStatusRole');

  var club   = (typeof getMyClub   === 'function') ? getMyClub()   : null;
  var player = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;
  var isAdmin = (typeof isClubAdmin === 'function') ? isClubAdmin() : false;

  if (club && club.name) {
    statusName.textContent = club.name;
    statusRole.textContent = isAdmin ? 'ADMIN' : (isOrganiser ? 'ORGANISER' : 'VIEWER');
    statusBar.classList.remove('disconnected');
  } else if (player && player.displayName) {
    statusName.textContent = player.displayName;
    statusRole.textContent = isOrganiser ? 'ORGANISER' : 'VIEWER';
    statusBar.classList.remove('disconnected');
  } else {
    statusName.textContent = 'Not connected';
    statusRole.textContent = '';
    statusBar.classList.add('disconnected');
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
  var tabEl = tabId ? document.getElementById(tabId) : null;
  showPage(pageId, tabEl);
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
}

/* ── Step card button tapped ── */
function stepAction() {
  var step = STEP_DEFS[_homeCurrentStep];
  if (_homeCurrentStep === 1) _stepPairsSeen = true;
  step.go();
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

/* ── Summary tile — only active when session has players + rounds ── */
function homeGoSummary() {
  // showPage('summaryPage') already calls report() and renderRounds() internally
  homeGo('summaryPage', 'tabBtnSummary');
}

/* ── Refresh Summary tile dim state ── */
function homeRefreshSummaryTile() {
  var hasData = typeof schedulerState !== 'undefined'
    && schedulerState.allPlayers
    && schedulerState.allPlayers.length > 0
    && Array.isArray(allRounds)
    && allRounds.length > 0;
  document.querySelectorAll('.home-tile-summary').forEach(function(tile) {
    tile.style.opacity       = hasData ? '1' : '0.4';
    tile.style.pointerEvents = hasData ? '' : 'none';
  });
}

/* ── Language picker on home screen ── */
function homeLangToggle() {
  var m = document.getElementById('homeLangMenu');
  if (m) m.classList.toggle('show');
}

function homeLangSelect(lang, flag) {
  var homeFlag = document.getElementById('homeFlagDisplay');
  var mainFlag = document.getElementById('currentFlag');
  if (homeFlag) homeFlag.textContent = flag;
  if (mainFlag) mainFlag.textContent = flag;
  if (typeof setLanguage === 'function') setLanguage(lang);
  var m = document.getElementById('homeLangMenu');
  if (m) m.classList.remove('show');
}
