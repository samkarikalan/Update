/* =============================================
HomeScreen.js
Standalone home screen & session stepper.
Depends on: schedulerState, allRounds (rounds.js)
getMyClub, getMyPlayer (supabase.js)
============================================= */

/* ── State ── */
var _stepCourtsSet = false;
var _navSource = ‘home’; // ‘home’ | ‘rounds’ — tracks where Players/Summary was opened from
var _stepPairsSeen = false;
var _homeCurrentStep = 0;

var STEP_DEFS = [
{
icon: ‘👥’,
get title()     { return t(‘selectPlayersStep’); },
get activeSub() { return t(‘addAtLeast4Step’); },
doneSub: function() {
var n = schedulerState.activeplayers.length;
return n + ’ ’ + t(‘playerSingular’) + ’ ’ + t(‘playersSelected’);
},
isDone: function() { return schedulerState.activeplayers.length >= 4; },
go: function() { homeGo(‘playersPage’, ‘tabBtnPlayers’); }
},
{
icon: ‘🤝’,
get title()     { return t(‘fixedPairsStep’); },
get activeSub() { return t(‘fixedPairsOptional’); },
doneSub: function() {
var n = schedulerState.fixedPairs.length;
return n ? n + ’ ’ + (n !== 1 ? t(‘pairsSet’) : t(‘pairSet’)) : t(‘skippedOptional’);
},
isDone: function() { return _stepPairsSeen; },
go: function() { homeGo(‘fixedPairsPage’, ‘tabBtnFixedPairs’); }
},
{
icon: ‘🏟’,
get title()     { return t(‘courtSettings’); },
get activeSub() { return t(‘setCourtMode’); },
doneSub: function() {
var c = parseInt(document.getElementById(‘num-courts’).textContent) || 1;
var tog = document.getElementById(‘modeToggle’);
var mode = (tog && tog.checked) ? t(‘competitive’) : t(‘randomMode’);
return c + ’ ’ + (c !== 1 ? t(‘courtPlural’) : t(‘courtSingle’)) + ’ · ’ + mode;
},
isDone: function() { return _stepCourtsSet; },
go: function() { homeShowCourtsPanel(); }
},
{
icon: ‘🏸’,
get title()     { return t(‘startRoundsStep’); },
get activeSub() { return t(‘allSetReady’); },
doneSub: function() { return t(‘sessionInProgress’); },
isDone: function() { return Array.isArray(allRounds) && allRounds.length > 0; },
go: function() { homeGo(‘roundsPage’, ‘tabBtnRounds’); }
}
];

/* ── Main entry: show home screen ── */
function showHomeScreen() {
var homeEl = document.getElementById(‘homePageOverlay’);
if (!homeEl) return;

// Add body class so .top-bar hides
document.body.classList.add(‘home-open’);

homeEl.style.display = ‘flex’;

// Restore both top bars when back on home
document.querySelectorAll(’.home-topbar, .top-bar’).forEach(function(b) { b.style.display = ‘’; });

// Mode + status bar
var isOrganiser = (typeof appMode !== ‘undefined’) && appMode === ‘organiser’;
var isVault     = (typeof appMode !== ‘undefined’) && appMode === ‘vault’;
var statusBar  = document.getElementById(‘homeStatusBar’);
var statusName = document.getElementById(‘homeStatusName’);
var club   = (typeof getMyClub   === ‘function’) ? getMyClub()   : null;
var player = (typeof getMyPlayer === ‘function’) ? getMyPlayer() : null;
var isAdmin = (typeof isClubAdmin === ‘function’) ? isClubAdmin() : false;

if (club && club.name) {
var modePrefix = isVault ? ’🔑 ’ : (isAdmin ? ’★ ’ : ‘’);
if (statusName) statusName.textContent = modePrefix + club.name;
if (statusBar)  statusBar.classList.remove(‘disconnected’);
} else if (player && player.displayName) {
if (statusName) statusName.textContent = player.displayName;
if (statusBar)  statusBar.classList.remove(‘disconnected’);
} else {
if (statusName) statusName.textContent = t(‘notConnected’) || ‘Not connected’;
if (statusBar)  statusBar.classList.add(‘disconnected’);
}

// Show correct flow and grids (3 modes: viewer / organiser / vault)
var isVault   = (typeof appMode !== ‘undefined’) && appMode === ‘vault’;
var isViewer  = !isOrganiser && !isVault;

var orgFlow    = document.getElementById(‘homeOrganizerFlow’);
var viewFlow   = document.getElementById(‘homeViewerFlow’);
var orgGrid    = document.getElementById(‘homeOrgGrid’);
var viewerGrid = document.getElementById(‘homeViewerGrid’);
var vaultGrid  = document.getElementById(‘homeVaultGrid’);

if (orgFlow)    orgFlow.style.display    = isOrganiser ? ‘’ : ‘none’;
if (viewFlow)   viewFlow.style.display   = isViewer    ? ‘’ : ‘none’;
if (orgGrid)    orgGrid.style.display    = isOrganiser ? ‘’ : ‘none’;
if (viewerGrid) viewerGrid.style.display = isViewer    ? ‘’ : ‘none’;
if (vaultGrid)  vaultGrid.style.display  = isVault     ? ‘’ : ‘none’;

if (isOrganiser) homeUpdateStepper();
homeRefreshSummaryTile();
homeRefreshTiles();
homeRefreshJoinClubTile();
// Init subscription and show trial banner
if (typeof subInit === ‘function’) subInit();
if (typeof subShowTrialBanner === ‘function’) subShowTrialBanner();
}

/* ── Refresh all tile subtitles with live data ── */
async function homeRefreshTiles() {
var isOrganiser = (typeof appMode !== ‘undefined’) && appMode === ‘organiser’;

// ── Vault ──
var club   = (typeof getMyClub   === ‘function’) ? getMyClub()   : null;
var isAdmin = (typeof isClubAdmin === ‘function’) ? isClubAdmin() : false;
var vaultSub = document.getElementById(‘tileSubVault’);
if (vaultSub) {
if (club && club.name) {
vaultSub.textContent = club.name + (isAdmin ? ’ ’ + t(‘adminRole’) : ’ ’ + t(‘userRole’));
} else {
vaultSub.textContent = t(‘notConnected’) || ‘Not connected’;
}
}

// ── Vault — show/hide no-club state vs tiles ──
var vaultNoClub  = document.getElementById(‘vaultNoClubState’);
var vaultTileGrid = document.getElementById(‘vaultTileGrid’);
var vaultStatusTile = document.getElementById(‘vaultClubStatusTile’);

if (club && club.id) {
// Has club — show tiles, hide create form
if (vaultNoClub)    vaultNoClub.style.display    = ‘none’;
if (vaultTileGrid)  vaultTileGrid.style.display  = ‘’;
if (vaultStatusTile) vaultStatusTile.style.display = ‘’;
} else {
// No club — show create form, hide tiles
if (vaultNoClub)    vaultNoClub.style.display    = ‘’;
if (vaultTileGrid)  vaultTileGrid.style.display  = ‘none’;
if (vaultStatusTile) vaultStatusTile.style.display = ‘none’;
}

// ── Vault club status tile ──
var vctName  = document.getElementById(‘vctName’);
var vctBadge = document.getElementById(‘vctBadge’);
var vctDot   = document.getElementById(‘vctDot’);
if (vctName) {
if (club && club.name) {
vctName.textContent = club.name;
if (vctDot) vctDot.style.background = ‘#2dce89’;
if (vctBadge) {
vctBadge.textContent = t(‘adminBadge’) || ‘ADMIN’;
vctBadge.style.background = ‘#2dce89’;
vctBadge.style.color = ‘#000’;
vctBadge.style.display = ‘’;
}
} else {
vctName.textContent = t(‘noClubSelected’);
if (vctBadge) vctBadge.style.display = ‘none’;
if (vctDot) vctDot.style.background = ‘#888’;
}
}

// ── Organiser club tile (home-tile style) ──
var orgVctName  = document.getElementById(‘orgVctName’);
var orgVctBadge = document.getElementById(‘orgVctBadge’);
var orgTileIcon = document.getElementById(‘orgTileIcon’);
if (orgVctName) {
if (club && club.name) {
orgVctName.textContent  = club.name;
if (orgVctBadge) orgVctBadge.textContent = ’✅ ’ + (t(‘connectClub’) || ‘Connected’);
if (orgTileIcon) orgTileIcon.textContent  = ‘🏢’;
} else {
orgVctName.textContent  = t(‘clubLabel’) || ‘Club’;
if (orgVctBadge) orgVctBadge.textContent = t(‘tapConnect’);
if (orgTileIcon) orgTileIcon.textContent  = ‘🏢’;
}
}

// ── Vault gradient tiles — load live stats ──
if (club && club.id) {
homeRefreshVaultTiles(club.id);
}

// ── Players ──
var playersSub = document.getElementById(‘tileSubPlayers’);
if (playersSub) {
if (typeof schedulerState !== ‘undefined’ && schedulerState.allPlayers) {
var total  = schedulerState.allPlayers.length;
var active = schedulerState.activeplayers.length;
playersSub.textContent = total > 0
? total + ’ ’ + t(‘playerPlural’) + ’ · ’ + active + ’ ’ + t(‘playersActive’)
: ‘Add · Remove’;
} else {
playersSub.textContent = t(‘addRemove’);
}
}

// ── Fixed Pairs ──
var pairsSub = document.getElementById(‘tileSubPairs’);
if (pairsSub) {
var pairCount = (typeof schedulerState !== ‘undefined’ && schedulerState.fixedPairs)
? schedulerState.fixedPairs.length : 0;
pairsSub.textContent = pairCount > 0
? pairCount + ’ pair’ + (pairCount !== 1 ? ‘s’ : ‘’) + ’ set’
: t(‘optional’);
}

// ── Settings ──
var settingsSub = document.getElementById(‘tileSubSettings’);
var settingsSubV = document.getElementById(‘tileSubSettingsV’);
var settingsText = ‘’;
if (settingsSub || settingsSubV) {
var theme    = localStorage.getItem(‘app-theme’)    || ‘dark’;
var fontSize = localStorage.getItem(‘appFontSize’)  || ‘medium’;
settingsText = (theme.charAt(0).toUpperCase() + theme.slice(1))
+ ’ · ’ + (fontSize.charAt(0).toUpperCase() + fontSize.slice(1));
if (settingsSub)  settingsSub.textContent  = settingsText;
if (settingsSubV) settingsSubV.textContent = settingsText;
}

// ── My Card tile (both grids) ──
var tileRating  = document.getElementById(‘homeTileRating’);
var tileName    = document.getElementById(‘homeTileName’);
var tileAvatar  = document.getElementById(‘homeTileAvatar’);
var tileIcon    = document.getElementById(‘homeTileIcon’);
var tileRatingV = document.getElementById(‘homeTileRatingV’);
var tileNameV   = document.getElementById(‘homeTileNameV’);
var tileAvatarV = document.getElementById(‘homeTileAvatarV’);
var tileIconV   = document.getElementById(‘homeTileIconV’);
var player = (typeof getMyPlayer === ‘function’) ? getMyPlayer() : null;

function _setMyCardTileBase(name, avatar, icon, rating, p) {
if (!name) return;
if (p) {
if (name)   name.textContent = p.name;
if (avatar) { avatar.src = p.gender === ‘Female’ ? ‘female.png’ : ‘male.png’; avatar.style.display = ‘block’; }
if (icon)   icon.style.display = ‘none’;
if (rating) rating.textContent = t(‘loading’);
} else {
if (name)   name.textContent = t(‘myCard’);
if (avatar) avatar.style.display = ‘none’;
if (icon)   { icon.style.display = ‘’; icon.textContent = ‘👤’; }
if (rating) rating.textContent = t(‘notSelected’);
}
}
_setMyCardTileBase(tileName,  tileAvatar,  tileIcon,  tileRating,  player);
_setMyCardTileBase(tileNameV, tileAvatarV, tileIconV, tileRatingV, player);

// Auto-fetch rating from all memberships (no live session needed)
if (player) {
(async function() {
try {
var user = (typeof authGetUser === ‘function’) ? authGetUser() : null;
var bestRating = null;
var bestClubName = null;
var wins = 0, losses = 0;

    if (user) {
      // Use the ACTIVE club specifically, not the highest-rated one
      var activeClub = (typeof getMyClub === 'function') ? getMyClub() : null;
      var mems = await sbGet('memberships',
        'user_account_id=eq.' + user.id +
        '&select=club_id,club_rating,nickname,player_id').catch(function(){ return []; });

      if (mems && mems.length) {
        // Fetch club names separately
        var clubIds = mems.map(function(m){ return m.club_id; });
        var clubRows = await sbGet('clubs', 'id=in.(' + clubIds.join(',') + ')&select=id,name').catch(function(){ return []; });
        var clubMap = {};
        (clubRows || []).forEach(function(c){ clubMap[c.id] = c.name; });

        // Find the active club's membership first, fall back to highest rating
        var activeMem = activeClub && activeClub.id
          ? mems.find(function(m){ return m.club_id === activeClub.id; })
          : null;
        var bestMem = activeMem || mems.reduce(function(best, m) {
          return (!best || parseFloat(m.club_rating) > parseFloat(best.club_rating)) ? m : best;
        }, null);

        bestRating = parseFloat(bestMem.club_rating) || 1.0;
        bestClubName = clubMap[bestMem.club_id] || null;

        // Wins/losses from the linked player record
        var pid = bestMem.player_id;
        if (pid) {
          var prows = await sbGet('players', 'id=eq.' + pid + '&select=wins,losses').catch(function(){ return []; });
          if (prows && prows[0]) {
            wins   = prows[0].wins   || 0;
            losses = prows[0].losses || 0;
          }
        }
      }
    }

    // Fallback to local cache if Supabase gave nothing
    if (bestRating === null) {
      var master = JSON.parse(localStorage.getItem('newImportHistory') || '[]');
      var hp = master.find(function(h) {
        return h.displayName && h.displayName.trim().toLowerCase() === player.name.trim().toLowerCase();
      });
      bestRating = parseFloat(hp && hp.clubRating) || 1.0;
    }

    var label = bestClubName ? bestClubName + '  ·  ' + bestRating.toFixed(1) : 'Club ' + bestRating.toFixed(1);
    if (wins || losses) label += '  ·  ' + t('winsShort') + ':' + wins + ' ' + t('lossesShort') + ':' + losses;

    if (tileRating)  tileRating.textContent  = label;
    if (tileRatingV) tileRatingV.textContent = label;
  } catch(e) {
    if (tileRating)  tileRating.textContent  = t('loading') || 'Tap to view';
    if (tileRatingV) tileRatingV.textContent = t('loading') || 'Tap to view';
  }
})();

}

// ── Dashboard — async fetch live session count ──
var dashSub  = document.getElementById(‘tileSubDashboard’);
var dashSubV = document.getElementById(‘tileSubDashboardV’);
if (dashSub || dashSubV) {
if (dashSub)  dashSub.textContent  = t(‘loading’);
if (dashSubV) dashSubV.textContent = t(‘loading’);
try {
var sessions = (typeof dbGetLiveSessions === ‘function’) ? await dbGetLiveSessions() : [];
var count = (sessions || []).length;
var dashText = count > 0
? count + ’ ’ + t(‘liveSession’) + (count !== 1 ? ‘s’ : ‘’)
: t(‘noLiveSessions’);
if (dashSub)  dashSub.textContent  = dashText;
if (dashSubV) dashSubV.textContent = dashText;
} catch(e) {
if (dashSub)  dashSub.textContent  = t(‘liveSessions’);
if (dashSubV) dashSubV.textContent = t(‘liveSessions’);
}
}
}

/* ── Hide home screen (go to inner page) ── */
function homeHideScreen() {
var homeEl = document.getElementById(‘homePageOverlay’);
if (homeEl) homeEl.style.display = ‘none’;
document.body.classList.remove(‘home-open’);
}

/* ── Navigate to an inner page ── */
function homeGo(pageId, tabId) {
if (!pageId) return;
homeHideScreen();
_navSource = ‘home’;
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
var panel = document.getElementById(‘stepCourtsPanel’);
var card  = document.getElementById(‘stepCard’);
if (panel) panel.style.display = ‘none’;
if (card)  card.style.display  = ‘’;

// Determine done state for each step
var done = STEP_DEFS.map(function(s) { return s.isDone(); });

// Current step = first not done; if all done = last
var current = done.indexOf(false);
if (current === -1) current = STEP_DEFS.length - 1;
_homeCurrentStep = current;

// Update each dot
for (var i = 0; i < STEP_DEFS.length; i++) {
var dot = document.getElementById(‘stepDot’ + i);
if (!dot) continue;
dot.classList.remove(‘s-active’, ‘s-done’, ‘s-locked’);
var sn = dot.querySelector(’.sn’);

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

var icon  = document.getElementById(‘stepCardIcon’);
var title = document.getElementById(‘stepCardTitle’);
var sub   = document.getElementById(‘stepCardSub’);
var btn   = document.getElementById(‘stepCardBtn’);

if (icon)  icon.textContent  = step.icon;
if (title) title.textContent = isDoneCurrent && current === STEP_DEFS.length - 1
? t(‘sessionActive’) : step.title;
if (sub)   sub.textContent   = isDoneCurrent ? step.doneSub() : step.activeSub;

if (btn) {
btn.classList.toggle(‘btn-done’, isDoneCurrent && current === STEP_DEFS.length - 1);
if (current === 1 && isDoneCurrent) {
btn.textContent = t(‘doneBtn’);
} else if (current === 2 && !_stepCourtsSet) {
btn.textContent = t(‘setUpBtn’);
} else {
btn.textContent = t(‘goBtn’);
}
}

// Show Skip only on step 2 (Fixed Pairs) when not yet done
var skipBtn = document.getElementById(‘stepSkipBtn’);
if (skipBtn) skipBtn.style.display = (current === 1 && !isDoneCurrent) ? ‘’ : ‘none’;
}

/* ── Step card button tapped ── */
function stepAction() {
var step = STEP_DEFS[_homeCurrentStep];
if (_homeCurrentStep === 1) _stepPairsSeen = true;
// Reset sessionFinished so Go works after a previous session ended
if (typeof sessionFinished !== ‘undefined’) sessionFinished = false;
step.go();
}

/* ── Skip Fixed Pairs ── */
function stepSkip() {
_stepPairsSeen = true;
homeUpdateStepper();
}

/* ── Courts panel ── */
function homeShowCourtsPanel() {
var panel = document.getElementById(‘stepCourtsPanel’);
var card  = document.getElementById(‘stepCard’);
if (!panel || !card) return;

// Sync from actual rounds page values
var mainCourts = document.getElementById(‘num-courts’);
var stepCourts = document.getElementById(‘stepNumCourts’);
if (mainCourts && stepCourts) stepCourts.textContent = mainCourts.textContent;

var mainToggle = document.getElementById(‘modeToggle’);
var stepToggle = document.getElementById(‘stepModeToggle’);
if (mainToggle && stepToggle) stepToggle.checked = mainToggle.checked;

card.style.display  = ‘none’;
panel.style.display = ‘’;
}

function stepCourtAdj(delta) {
var el = document.getElementById(‘stepNumCourts’);
if (!el) return;
var max = Math.max(1, Math.floor(schedulerState.activeplayers.length / 4));
var val = Math.min(max, Math.max(1, (parseInt(el.textContent) || 1) + delta));
el.textContent = val;
// Mirror to rounds page counter
var main = document.getElementById(‘num-courts’);
if (main) main.textContent = val;
}

function stepSyncMode() {
var stepToggle = document.getElementById(‘stepModeToggle’);
var mainToggle = document.getElementById(‘modeToggle’);
if (stepToggle && mainToggle) {
mainToggle.checked = stepToggle.checked;
mainToggle.dispatchEvent(new Event(‘change’));
}
}

function stepCourtsDone() {
_stepCourtsSet = true;
homeGo(‘roundsPage’, ‘tabBtnRounds’);
}

/* ── Summary navigation ── */
function homeGoSummary() {
_navSource = ‘home’;
homeGo(‘summaryPage’, ‘tabBtnSummary’);
}

function roundsGoSummary() {
_navSource = ‘rounds’;
homeHideScreen();
showPage(‘summaryPage’, null);
_updateDynamicBackBtns(‘summaryPage’);
}

/* ── Players navigation from Rounds ── */
function roundsGoPlayers() {
_navSource = ‘rounds’;
homeHideScreen();
showPage(‘playersPage’, null);
_updateDynamicBackBtns(‘playersPage’);
}

function roundsGoFixedPairs() {
_navSource = ‘rounds’;
homeHideScreen();
showPage(‘fixedPairsPage’, null);
_updateDynamicBackBtns(‘fixedPairsPage’);
}

/* ── Update dynamic back button labels ── */
function _updateDynamicBackBtns(pageId) {
var label = _navSource === ‘rounds’ ? ‘‹ Rounds’ : ‘‹ Home’;
var ids = {
playersPage:    ‘playersBackBtn’,
summaryPage:    ‘summaryBackBtn’,
fixedPairsPage: ‘fixedPairsBackBtn’
};
var btnId = ids[pageId];
if (btnId) {
var btn = document.getElementById(btnId);
if (btn) btn.textContent = label;
}
}

/* ── Back navigation — goes to correct origin ── */
function navBack() {
if (_navSource === ‘rounds’) {
showPage(‘roundsPage’, null);
} else {
showHomeScreen();
}
}

/* ── Refresh Summary tile — always active since it fetches from Supabase ── */
function homeRefreshSummaryTile() {
document.querySelectorAll(’.home-tile-summary’).forEach(function(tile) {
tile.style.opacity       = ‘1’;
tile.style.pointerEvents = ‘’;
});
}

/* Language is now handled in Settings page */
function homeLangToggle() {}
function homeLangSelect() {}

/* ══════════════════════════════════════════════
JOIN CLUB PAGE — Viewer mode tile & full page
══════════════════════════════════════════════ */

/* Called every time home screen opens — show/hide tile, refresh status */
async function vclSetActiveClub(clubId, clubName) {
if (typeof setMyClub === ‘function’) setMyClub(clubId, clubName);
localStorage.setItem(‘kbrr_club_mode’, ‘user’);
// Sync players from the newly active club
if (typeof syncToLocal === ‘function’) syncToLocal();
// Refresh join club tile first to re-render active highlight immediately
await homeRefreshJoinClubTile();
// Then refresh full home screen — updates My Card rating to active club
if (typeof homeRefreshScreen === ‘function’) await homeRefreshScreen();
// Also update profile button in top bar
if (typeof updateProfileBtn === ‘function’) updateProfileBtn();
}

async function homeRefreshJoinClubTile() {
var sub     = document.getElementById(‘tileSubJoinClub’);
var listEl  = document.getElementById(‘vcl-list-inner’);
if (!sub) return;

var user = (typeof authGetUser === ‘function’) ? authGetUser() : null;
if (user) {
try {
var memberships = await sbGet(‘memberships’,
‘user_account_id=eq.’ + user.id + ‘&select=club_id,nickname’);
var pending = await sbGet(‘club_join_requests’,
‘user_account_id=eq.’ + user.id + ‘&status=eq.pending&select=club_id’).catch(function(){ return []; });
var pendingIds = (pending || []).map(function(p){ return p.club_id; });

  var allIds = [...new Set([
    ...(memberships||[]).map(function(m){ return m.club_id; }),
    ...pendingIds
  ])];

  if (allIds.length) {
    var clubRows = await sbGet('clubs', 'id=in.(' + allIds.join(',') + ')&select=id,name').catch(function(){ return []; });
    var clubMap = {};
    clubRows.forEach(function(c){ clubMap[c.id] = c.name; });

    // Subtitle: count summary
    var memCount = (memberships||[]).length;
    var pendCount = pendingIds.filter(function(id){ return !(memberships||[]).find(function(m){ return m.club_id===id; }); }).length;
    if (memCount > 0) {
      sub.textContent = memCount + ' ' + (memCount === 1 ? t('club') : t('clubs')) + (pendCount > 0 ? ' · ' + pendCount + ' ' + t('pending') : '');
    } else if (pendCount > 0) {
      sub.textContent = pendCount + ' ' + t('pending');
    }

    // Inline list (max 10)
    if (listEl) {
      var activeClubId = (typeof getMyClub === 'function') ? (getMyClub().id || null) : null;
      var items = [];
      (memberships||[]).slice(0,10).forEach(function(m) {
        items.push({ id: m.club_id, name: clubMap[m.club_id]||m.club_id, nick: m.nickname, pending: false });
      });
      pendingIds.filter(function(id){ return !(memberships||[]).find(function(m){ return m.club_id===id; }); })
        .slice(0, 10 - items.length).forEach(function(id) {
          items.push({ id: id, name: clubMap[id]||id, nick: null, pending: true });
        });

      if (items.length > 0) {
        listEl.innerHTML = items.map(function(item) {
          var isActive = item.id === activeClubId;
          var activeClass = isActive ? ' vcl-row-active' : '';
          var clickHandler = item.pending ? '' : ' onclick="vclSetActiveClub(\'' + item.id + '\',\'' + item.name.replace(/'/g,"\\\'" ) + '\')"';
          return '<div class="vcl-row' + activeClass + '"' + clickHandler + '>' +
            '<span class="vcl-dot">' + (item.pending ? '⏳' : (isActive ? '✅' : '🏸')) + '</span>' +
            '<div class="vcl-row-info">' +
              '<span class="vcl-row-name">' + item.name + '</span>' +
              (item.nick ? '<span class="vcl-row-nick">' + t('asNick') + ' ' + item.nick + '</span>' : '') +
            '</div>' +
            (item.pending
              ? '<span class="vcl-badge vcl-badge-pending">' + t('badgePending') + '</span>'
              : (isActive
                ? '<span class="vcl-badge vcl-badge-active">' + t('badgeActive') + '</span>'
                : '<span class="vcl-badge vcl-badge-member">' + t('badgeMember') + '</span>')) +
          '</div>';
        }).join('');
      } else {
        listEl.innerHTML = '';
      }
    }
    return;
  }
} catch(e) { /* offline — fall through */ }

}

// Fallback
if (listEl) listEl.innerHTML = ‘’;
var club = (typeof getMyClub === ‘function’) ? getMyClub() : null;
if (club && club.id && club.name) { sub.textContent = ’✅ ’ + club.name; return; }
var pending = localStorage.getItem(‘kbrr_pending_club_name’);
if (pending) { sub.textContent = t(‘pendingPrefix’) + pending; return; }
sub.textContent = t(‘findRequest’);
}

/* ── Join Club Page — initialise when page opens ── */
async function joinClubPageOpen() {
// Reset search + feedback
var searchInput = document.getElementById(‘joinClubPageSearch’);
if (searchInput) searchInput.value = ‘’;
var results = document.getElementById(‘joinClubPageResults’);
if (results) { results.style.display = ‘none’; results.innerHTML = ‘’; }
var errEl = document.getElementById(‘joinClubPageError’);
if (errEl) errEl.style.display = ‘none’;
var fbEl = document.getElementById(‘joinClubPageFeedback’);
if (fbEl) fbEl.style.display = ‘none’;
var nickEl = document.getElementById(‘joinClubNicknameSection’);
if (nickEl) nickEl.style.display = ‘none’;

// Load all my clubs
await _renderMyClubsList();
}

async function _renderMyClubsList() {
var inner = document.getElementById(‘myClubsListInner’);
if (!inner) return;
inner.innerHTML = ‘<div class="jc-empty">Loading…</div>’;

var user = (typeof authGetUser === ‘function’) ? authGetUser() : null;
if (!user) {
inner.innerHTML = ‘<div class="jc-empty">’ + t(‘loginToSeeClubs’) + ‘</div>’;
return;
}

try {
// Get all memberships for this user
var memberships = await sbGet(‘memberships’,
‘user_account_id=eq.’ + user.id + ‘&select=club_id,nickname’);

// Also check pending requests
var pending = await sbGet('club_join_requests',
  'user_account_id=eq.' + user.id + '&status=eq.pending&select=club_id').catch(function(){ return []; });
var pendingIds = (pending || []).map(function(p){ return p.club_id; });

if ((!memberships || !memberships.length) && !pendingIds.length) {
  inner.innerHTML = '<div class="jc-empty">' + t('noClubsYetSearch') + '</div>';
  return;
}

// Fetch club names
var allIds = [...new Set([
  ...(memberships||[]).map(function(m){ return m.club_id; }),
  ...pendingIds
])];
var clubs = allIds.length
  ? await sbGet('clubs', 'id=in.(' + allIds.join(',') + ')&select=id,name').catch(function(){ return []; })
  : [];
var clubMap = {};
clubs.forEach(function(c){ clubMap[c.id] = c.name; });

var html = '';

// Member clubs
(memberships || []).forEach(function(m) {
  var cname = clubMap[m.club_id] || m.club_id;
  html += '<div class="jc-club-row">' +
    '<div class="jc-club-icon">🏸</div>' +
    '<div class="jc-club-info">' +
      '<div class="jc-club-name">' + cname + '</div>' +
      '<div class="jc-club-nick">' + t('asNick') + ' ' + m.nickname + '</div>' +
    '</div>' +
    '<span class="jc-club-badge">' + t('badgeMember') + '</span>' +
  '</div>';
});

// Pending clubs
pendingIds.forEach(function(cid) {
  if ((memberships||[]).find(function(m){ return m.club_id === cid; })) return; // already shown
  var cname = clubMap[cid] || cid;
  html += '<div class="jc-club-row">' +
    '<div class="jc-club-icon">⏳</div>' +
    '<div class="jc-club-info">' +
      '<div class="jc-club-name">' + cname + '</div>' +
      '<div class="jc-club-nick">' + t('requestPendingText') + '</div>' +
    '</div>' +
    '<span class="jc-club-pending">' + t('badgePending') + '</span>' +
  '</div>';
});

inner.innerHTML = html || '<div class="jc-empty">' + t('noClubsYet') + '</div>';

} catch(e) {
inner.innerHTML = ‘<div class="jc-empty">’ + t(‘couldNotLoadClubs’) + ‘</div>’;
}
}

function _joinClubShowStatus(state, clubName) {
var icon  = document.getElementById(‘joinClubStatusIcon’);
var title = document.getElementById(‘joinClubStatusTitle’);
var msg   = document.getElementById(‘joinClubStatusMsg’);
var leave = document.getElementById(‘joinClubLeaveBtn’);
var card  = document.getElementById(‘joinClubStatusCard’);

if (state === ‘joined’) {
if (icon)  icon.textContent  = ‘✅’;
if (title) title.textContent = t(‘joined’) + ‘: ’ + clubName;
if (msg)   msg.textContent   = t(‘memberMsg’) || ‘You are a member of this club.’;
if (leave) leave.style.display = ‘’;
if (card)  card.style.borderColor = ‘#2dce89’;
} else if (state === ‘pending’) {
if (icon)  icon.textContent  = ‘⏳’;
if (title) title.textContent = t(‘requestPending’);
if (msg)   msg.textContent   = t(‘yourRequestToJoin’) + ’ “’ + clubName + ’” ’ + t(‘awaitingApproval’);
if (leave) leave.style.display = ‘’;
if (card)  card.style.borderColor = ‘#e6a817’;
}
}

/* ── Search clubs as user types ── */
var _joinClubSearchTimer = null;
function joinClubPageSearchUI(query) {
clearTimeout(_joinClubSearchTimer);
var errEl = document.getElementById(‘joinClubPageError’);
if (errEl) errEl.style.display = ‘none’;
var fbEl = document.getElementById(‘joinClubPageFeedback’);
if (fbEl) fbEl.style.display = ‘none’;

if (!query || query.trim().length < 2) {
var r = document.getElementById(‘joinClubPageResults’);
if (r) { r.style.display = ‘none’; r.innerHTML = ‘’; }
return;
}
_joinClubSearchTimer = setTimeout(function() { _joinClubDoSearch(query); }, 350);
}

async function _joinClubDoSearch(query) {
var resultsEl = document.getElementById(‘joinClubPageResults’);
var errEl     = document.getElementById(‘joinClubPageError’);
if (!resultsEl) return;

resultsEl.innerHTML = ‘<div style="padding:12px;text-align:center;color:var(--muted);font-size:0.85rem;">’ + t(‘searching’) + ‘</div>’;
resultsEl.style.display = ‘’;

var result = (typeof authSearchClubs === ‘function’) ? await authSearchClubs(query) : { clubs: [] };

if (result.error) {
resultsEl.style.display = ‘none’;
if (errEl) { errEl.textContent = result.error; errEl.style.display = ‘’; }
return;
}

var clubs = result.clubs || [];
if (!clubs.length) {
resultsEl.innerHTML = ‘<div style="padding:14px;text-align:center;color:var(--muted);font-size:0.85rem;">’ + t(‘noClubsFoundFor’) + ’ “’ + query + ‘”</div>’;
return;
}

resultsEl.innerHTML = clubs.map(function(c) {
return ‘<div onclick=“joinClubPageRequest('’ + c.id + ‘','’ + c.name.replace(/’/g, “\’”) + ‘')” class=“jc-club-row” style=“cursor:pointer;justify-content:space-between;”>’ +
‘<div><div class="jc-club-name">’ + c.name + ‘</div></div>’ +
‘<span style="color:var(--accent,#6c63ff);font-size:0.82rem;font-weight:600;">’ + t(‘requestToJoin’) + ‘</span>’ +
‘</div>’;
}).join(’’);
}

/* ── Stores clubId/Name while user picks a new nickname ── */
var _pendingJoinClubId       = null;
var _pendingJoinClubName     = null;
var _pendingJoinNickname     = null;

async function joinClubPageRequest(clubId, clubName, customNickname) {
var fbEl      = document.getElementById(‘joinClubPageFeedback’);
var fbIcon    = document.getElementById(‘joinClubPageFeedbackIcon’);
var fbTitle   = document.getElementById(‘joinClubPageFeedbackTitle’);
var fbMsg     = document.getElementById(‘joinClubPageFeedbackMsg’);
var resultsEl = document.getElementById(‘joinClubPageResults’);
var errEl     = document.getElementById(‘joinClubPageError’);
var nickEl    = document.getElementById(‘joinClubNicknameSection’);

if (errEl) errEl.style.display = ‘none’;
if (nickEl) nickEl.style.display = ‘none’;
var pwSectionReset = document.getElementById(‘joinClubPasswordSection’);
if (pwSectionReset) pwSectionReset.style.display = ‘none’;

// Show loading
if (fbEl) {
if (fbIcon)  fbIcon.textContent  = ‘⏳’;
if (fbTitle) fbTitle.textContent = t(‘checking’);
if (fbMsg)   fbMsg.textContent   = ‘’;
fbEl.style.display = ‘’;
}
if (resultsEl) resultsEl.style.display = ‘none’;

var result = (typeof authRequestJoin === ‘function’)
? await authRequestJoin(clubId, customNickname)
: { error: t(‘notAvailable’) };

if (result.alreadyMember) {
_joinClubShowStatus(‘joined’, clubName);
document.getElementById(‘joinClubStatusCard’).style.display = ‘’;
document.getElementById(‘joinClubSearchSection’).style.display = ‘none’;
if (fbEl) fbEl.style.display = ‘none’;
homeRefreshJoinClubTile();
return;
}

if (result.autoLinked) {
if (typeof setMyClub === ‘function’) setMyClub(result.clubId, result.clubName);
if (typeof setMyPlayer === ‘function’) setMyPlayer({ name: result.nickname, gender: ‘Male’ });
if (fbEl) {
if (fbIcon)  fbIcon.textContent  = ‘✅’;
if (fbTitle) fbTitle.textContent = t(‘joined’) + ’ ’ + result.clubName;
if (fbMsg)   fbMsg.textContent   = t(‘welcomeBack’) + ’, ’ + result.nickname + ‘!’;
fbEl.style.display = ‘’;
}
homeRefreshJoinClubTile();
_renderMyClubsList();
return;
}

if (result.needsPassword) {
// Unclaimed player found — ask for default password to verify identity
if (fbEl) fbEl.style.display = ‘none’;
_pendingJoinClubId   = clubId;
_pendingJoinClubName = clubName;
_pendingJoinNickname = result.conflictNickname;
var pwSection = document.getElementById(‘joinClubPasswordSection’);
var pwMsg     = document.getElementById(‘joinClubPasswordMsg’);
var pwInput   = document.getElementById(‘joinClubPasswordInput’);
if (nickEl) nickEl.style.display = ‘none’;
if (pwMsg) pwMsg.textContent = ‘”’ + result.conflictNickname + ’” ’ + (t(‘foundInClub’) || ‘found in’) + ’ ’ + clubName + ’. ’ + (t(‘enterDefaultPwClaim’) || ‘Enter your default password to join:’);
if (pwInput) pwInput.value = ‘’;
if (pwSection) pwSection.style.display = ‘’;
return;
}

if (result.nicknameConflict) {
// Nickname truly taken by someone else — ask for different nickname
if (fbEl) fbEl.style.display = ‘none’;
_pendingJoinClubId   = clubId;
_pendingJoinClubName = clubName;
var pwSection2 = document.getElementById(‘joinClubPasswordSection’);
if (pwSection2) pwSection2.style.display = ‘none’;
if (nickEl) {
var msgEl  = document.getElementById(‘joinClubNicknameMsg’);
var inputEl = document.getElementById(‘joinClubNicknameInput’);
if (msgEl)  msgEl.textContent = ‘”’ + result.conflictNickname + ’” ’ + t(‘alreadyTaken’) + ’ ’ + clubName + ’. ’ + t(‘chooseDifferentNickname’) + ‘:’;
if (inputEl) inputEl.value = ‘’;
nickEl.style.display = ‘’;
}
return;
}

if (result.pending || result.success) {
localStorage.setItem(‘kbrr_pending_club_id’,   clubId);
localStorage.setItem(‘kbrr_pending_club_name’, clubName);
if (fbIcon)  fbIcon.textContent  = ‘⏳’;
if (fbTitle) fbTitle.textContent = t(‘requestSentTitle’);
if (fbMsg)   fbMsg.textContent   = t(‘waitingAdminApproval’);
homeRefreshJoinClubTile();
return;
}

if (result.error) {
if (fbEl) fbEl.style.display = ‘none’;
if (resultsEl) resultsEl.style.display = ‘’;
if (errEl) { errEl.textContent = result.error; errEl.style.display = ‘’; }
}
}

/* ── Called when user submits their chosen nickname ── */
function joinClubSubmitNickname() {
var inputEl = document.getElementById(‘joinClubNicknameInput’);
var nickname = inputEl ? inputEl.value.trim() : ‘’;
if (!nickname) {
var errEl = document.getElementById(‘joinClubPageError’);
if (errEl) { errEl.textContent = t(‘nicknameNotFound’) || ‘Please enter a nickname.’; errEl.style.display = ‘’; }
return;
}
joinClubPageRequest(_pendingJoinClubId, _pendingJoinClubName, nickname);
}

/* ── Called when user submits default password to claim their player ── */
async function joinClubSubmitPassword() {
var pwInput = document.getElementById(‘joinClubPasswordInput’);
var errEl   = document.getElementById(‘joinClubPageError’);
var password = pwInput ? pwInput.value.trim() : ‘’;

if (!password) {
if (errEl) { errEl.textContent = t(‘enterPasswordHint’); errEl.style.display = ‘’; }
return;
}

var fbEl    = document.getElementById(‘joinClubPageFeedback’);
var fbIcon  = document.getElementById(‘joinClubPageFeedbackIcon’);
var fbTitle = document.getElementById(‘joinClubPageFeedbackTitle’);
var fbMsg   = document.getElementById(‘joinClubPageFeedbackMsg’);
var pwSection = document.getElementById(‘joinClubPasswordSection’);

if (fbIcon)  fbIcon.textContent  = ‘⏳’;
if (fbTitle) fbTitle.textContent = t(‘checking’);
if (fbMsg)   fbMsg.textContent   = ‘’;
if (fbEl)    fbEl.style.display  = ‘’;
if (pwSection) pwSection.style.display = ‘none’;

var result = (typeof authClaimAndJoin === ‘function’)
? await authClaimAndJoin(_pendingJoinClubId, _pendingJoinNickname, password)
: { error: t(‘notAvailable’) };

if (result.success) {
if (typeof setMyClub === ‘function’) setMyClub(result.clubId, result.clubName);
if (typeof setMyPlayer === ‘function’) setMyPlayer({ name: result.nickname, gender: ‘Male’ });
if (fbIcon)  fbIcon.textContent  = ‘✅’;
if (fbTitle) fbTitle.textContent = t(‘joined’) + ’ ’ + result.clubName;
if (fbMsg)   fbMsg.textContent   = t(‘welcomeBack’) + ’, ’ + result.nickname + ‘!’;
homeRefreshJoinClubTile();
_renderMyClubsList();
return;
}

// Error — show password section again
if (pwSection) pwSection.style.display = ‘’;
if (fbEl) fbEl.style.display = ‘none’;
if (errEl) { errEl.textContent = result.error; errEl.style.display = ‘’; }
}

/* ── Leave club ── */
async function joinClubLeave() {
if (!confirm(t(‘leaveClubConfirm’))) return;

var pendingClubId = localStorage.getItem(‘kbrr_pending_club_id’);
var myClub = (typeof getMyClub === ‘function’) ? getMyClub() : null;
var clubId = (myClub && myClub.id) || pendingClubId;
var user   = (typeof authGetUser === ‘function’) ? authGetUser() : null;

// Delete from DB: player row and join request
if (clubId && user) {
try {
// Delete player row for this user in this club
await sbDelete(‘memberships’, ‘club_id=eq.’ + clubId + ‘&user_account_id=eq.’ + user.id);
} catch(e) { /* silent */ }
try {
// Delete join request so it doesn’t restore on next login
await sbDelete(‘club_join_requests’, ‘club_id=eq.’ + clubId + ‘&user_account_id=eq.’ + user.id);
} catch(e) { /* silent */ }
}

// Clear localStorage
localStorage.removeItem(‘kbrr_pending_club_id’);
localStorage.removeItem(‘kbrr_pending_club_name’);
localStorage.removeItem(‘kbrr_cache_players’);
localStorage.removeItem(‘kbrr_cache_ts’);
if (typeof clearMyClub === ‘function’) clearMyClub();
else {
localStorage.removeItem(‘kbrr_my_club_id’);
localStorage.removeItem(‘kbrr_my_club_name’);
}

// Reset page view
document.getElementById(‘joinClubStatusCard’).style.display = ‘none’;
document.getElementById(‘joinClubSearchSection’).style.display = ‘’;
homeRefreshJoinClubTile();
}

/* ── Load live stats into vault gradient tiles ── */
async function homeRefreshVaultTiles(clubId) {
try {
// Playing count
var playing = await sbGet(‘memberships’, ‘club_id=eq.’ + clubId + ‘&is_playing=eq.true&select=id’).catch(() => []);
var playingCount = (playing || []).length;
var vtBadgePlaying = document.getElementById(‘vtBadgePlaying’);
if (vtBadgePlaying) vtBadgePlaying.style.display = playingCount > 0 ? ‘’ : ‘none’;
var tileSubPlaying = document.getElementById(‘tileSubPlaying’);
if (tileSubPlaying) tileSubPlaying.textContent = playingCount + ’ ’ + t(‘playersActive’);

// Total players (register + modify share same count)
var members = await sbGet('memberships', 'club_id=eq.' + clubId + '&select=id').catch(() => []);
var memberCount = (members || []).length;
var vtRegister = document.getElementById('vtStatRegister');
if (vtRegister) vtRegister.textContent = memberCount;
var vtModify = document.getElementById('vtStatModify');
if (vtModify) vtModify.textContent = memberCount;

// Pending requests
var requests = await sbGet('club_join_requests', 'club_id=eq.' + clubId + '&status=eq.pending&select=id').catch(() => []);
var reqCount = (requests || []).length;
var vtRequests = document.getElementById('vtStatRequests');
if (vtRequests) vtRequests.textContent = reqCount;
var vtBadgeReq = document.getElementById('vtBadgeRequests');
if (vtBadgeReq) vtBadgeReq.style.display = reqCount > 0 ? '' : 'none';

} catch(e) { /* silent */ }
}

/* ── Quick Create Club from Vault home (first time user) ── */
async function vaultQuickCreateClub() {
var name    = (document.getElementById(‘vaultQuickClubName’)?.value || ‘’).trim();
var memberPw = (document.getElementById(‘vaultQuickMemberPw’)?.value || ‘’).trim();
var adminPw  = (document.getElementById(‘vaultQuickAdminPw’)?.value || ‘’).trim();
var fb = document.getElementById(‘vaultQuickFeedback’);
var setFb = function(msg, ok) {
if (fb) { fb.textContent = msg; fb.style.color = ok ? ‘var(–green,#2dce89)’ : ‘var(–red,#e63757)’; }
};

if (!name)    { setFb(t(‘enterClubName’), false); return; }
if (!memberPw) { setFb(t(‘enterMemberPw’), false); return; }
if (!adminPw)  { setFb(t(‘enterAdminPw’), false); return; }
if (memberPw === adminPw) { setFb(t(‘memberAdminDiff’), false); return; }

setFb(t(‘creatingClub’), true);
try {
var club = await dbAddClub(name, memberPw, adminPw);
if (typeof setMyClub  === ‘function’) setMyClub(club.id, club.name);
localStorage.setItem(‘kbrr_club_mode’, ‘admin’);
setFb(‘✅ ’ + club.name + ’ created!’, true);
// Clear fields
document.getElementById(‘vaultQuickClubName’).value  = ‘’;
document.getElementById(‘vaultQuickMemberPw’).value  = ‘’;
document.getElementById(‘vaultQuickAdminPw’).value   = ‘’;
// Refresh home to show vault tiles
// Set vault mode so pill shows correctly
if (typeof appMode !== ‘undefined’) appMode = ‘vault’;
sessionStorage.setItem(‘appMode’, ‘vault’);
localStorage.setItem(‘kbrr_app_mode’, ‘vault’);
if (typeof updateModePill === ‘function’) updateModePill(‘vault’);
setTimeout(function() { homeRefreshTiles(); showHomeScreen(); }, 600);
} catch(e) {
setFb(’❌ ’ + e.message, false);
}
}

/* ── Vault — Leave/Logout Club ── */
function vaultLogoutClub() {
if (!confirm(t(‘leaveVaultConfirm’))) return;
if (typeof sbClearClub === ‘function’) sbClearClub();
// Go to mode selector front page
var overlay = document.getElementById(‘modeSelectOverlay’);
if (overlay) {
if (typeof mlSyncLangDisplay === ‘function’) mlSyncLangDisplay();
overlay.style.display = ‘flex’;
}
}

/* ── Club Management — show panel by tile tap ── */
function clubMgmtShowPanel(panel) {
[‘connect’,‘create’,‘delete’].forEach(function(p) {
var el = document.getElementById(‘clubMgmt’ + p.charAt(0).toUpperCase() + p.slice(1) + ‘Panel’);
if (el) el.style.display = p === panel ? ‘’ : ‘none’;
});
// Load clubs for connect panel
if (panel === ‘connect’ && typeof viewerLoadClubs === ‘function’) viewerLoadClubs();
// Load clubs for delete panel
if (panel === ‘delete’ && typeof sbPopulateDeleteDropdown === ‘function’) sbPopulateDeleteDropdown();
}
