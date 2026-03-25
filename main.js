/* ══════════════════════════════════════════════
   MODE SYSTEM — Viewer / Organiser
   Stored in sessionStorage (resets on app close)
══════════════════════════════════════════════ */

var appMode = null; // 'viewer' | 'organiser'

function selectMode(mode) {
  appMode = mode;
  sessionStorage.setItem('appMode', mode);
  localStorage.setItem('kbrr_app_mode', mode);
  // Hide mode select overlay
  var overlay = document.getElementById('modeSelectOverlay');
  if (overlay) overlay.style.display = 'none';
  // Apply viewer/organiser body classes
  applyMode(mode);
  // Show home screen (defined in HomeScreen.js)
  showHomeScreen();
}

function applyMode(mode) {
  appMode = mode;

  // Body class for organiser scrollable tabs (kept for any CSS that uses it)
  document.body.classList.toggle('organiser-tabs', mode === 'organiser');
  document.body.classList.toggle('vault-mode',     mode === 'vault');

  // Sync home mode pill buttons (3 modes)
  var hpv  = document.getElementById('homePillViewer');
  var hpo  = document.getElementById('homePillOrganiser');
  var hpvm = document.getElementById('homePillVault');
  if (hpv)  hpv.classList.toggle('active',  mode === 'viewer');
  if (hpo)  hpo.classList.toggle('active',  mode === 'organiser');
  if (hpvm) hpvm.classList.toggle('active', mode === 'vault');

  // Apply viewer restrictions
  if (mode === 'viewer') {
    setViewerMode(true);
  } else {
    if (window._vSessionTabPinned) {
      if (typeof viewerStopPoll === 'function') viewerStopPoll();
      if (typeof _vHidePage     === 'function') _vHidePage();
    }
    setViewerMode(false);
  }
}

function setViewerMode(isViewer) {
  // Use body class — all viewer restrictions handled via CSS + JS checks
  if (isViewer) {
    document.body.classList.add('viewer-mode');
    // Ensure we're on the club tab by default
    // settings no longer has tabs
  } else {
    document.body.classList.remove('viewer-mode');
  }

  // Lock/Unlock toggle button
  const lockBtn = document.getElementById('lockToggleBtn');
  if (lockBtn) {
    lockBtn.style.pointerEvents = isViewer ? 'none' : '';
    lockBtn.style.opacity       = isViewer ? '0.35' : '';
  }

  // New round / control buttons in rounds page
  ['#addRoundBtn', '#removeRoundBtn', '#minRoundsPlus', '#minRoundsMinus'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) { el.style.pointerEvents = isViewer ? 'none' : ''; el.style.opacity = isViewer ? '0.35' : ''; }
  });

  // Import/Add buttons — hide entirely in viewer
  ['#openImportBtn', '.open-import-btn', '#addPlayersTypeBtn', '#addPlayersBrowseBtn'].forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      el.style.display = isViewer ? 'none' : '';
    });
  });
}

function openModeSwitcher() {
  // Remove existing sheet if any
  const existing = document.getElementById('modeSheetOverlay');
  if (existing) { existing.remove(); return; }

  const overlay = document.createElement('div');
  overlay.className = 'mode-sheet-overlay';
  overlay.id = 'modeSheetOverlay';
  overlay.onclick = () => overlay.remove();

  const sheet = document.createElement('div');
  sheet.className = 'mode-switch-sheet';
  sheet.innerHTML = `
    <div class="mode-sheet-handle"></div>
    <div class="mode-sheet-title">Switch Mode</div>
    <div class="mode-sheet-options">
      <button class="mode-sheet-btn viewer ${appMode === 'viewer' ? 'active-viewer' : ''}"
              onclick="switchMode('viewer')">
        <div class="mode-sheet-icon">👁</div>
        <div class="mode-sheet-info">
          <div class="mode-sheet-name">Viewer</div>
          <div class="mode-sheet-desc">Watch live rounds &amp; scores</div>
        </div>
        ${appMode === 'viewer' ? '<span class="mode-sheet-check">✅</span>' : ''}
      </button>
      <button class="mode-sheet-btn organiser ${appMode === 'organiser' ? 'active-organiser' : ''}"
              onclick="switchMode('organiser')">
        <div class="mode-sheet-icon"><img src="win-cup.png" style="width:32px;height:32px;object-fit:contain;filter:drop-shadow(0 1px 4px rgba(0,0,0,0.25))"></div>
        <div class="mode-sheet-info">
          <div class="mode-sheet-name">Round Organiser</div>
          <div class="mode-sheet-desc">Run session, score games, manage players</div>
        </div>
        ${appMode === 'organiser' ? '<span class="mode-sheet-check">✅</span>' : ''}
      </button>
      <button class="mode-sheet-btn vault ${appMode === 'vault' ? 'active-vault' : ''}"
              onclick="requestVaultMode()">
        <div class="mode-sheet-icon" style="background:rgba(245,158,11,0.18)">🔑</div>
        <div class="mode-sheet-info">
          <div class="mode-sheet-name">Vault Manager</div>
          <div class="mode-sheet-desc">Club admin — players, requests, management</div>
        </div>
        ${appMode === 'vault' ? '<span class="mode-sheet-check">✅</span>' : ''}
      </button>
    </div>
  `;
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  // Prevent sheet clicks from closing overlay
  sheet.onclick = e => e.stopPropagation();
}

function switchMode(mode) {
  const overlay = document.getElementById('modeSheetOverlay');
  if (overlay) overlay.remove();

  // Viewer needs no club
  if (mode === 'viewer') {
    appMode = mode;
    sessionStorage.setItem('appMode', mode);
    localStorage.setItem('kbrr_app_mode', mode);
    applyMode(mode);
    if (typeof showHomeScreen === 'function') showHomeScreen();
    return;
  }

  // Organiser / Vault — check club first
  var club = (typeof getMyClub === 'function') ? getMyClub() : null;
  if (!club || !club.id) {
    _showClubSetupSheet(mode);
    return;
  }

  // Vault — also needs admin auth
  if (mode === 'vault') {
    requestVaultMode();
    return;
  }

  appMode = mode;
  sessionStorage.setItem('appMode', mode);
  localStorage.setItem('kbrr_app_mode', mode);
  applyMode(mode);
  if (typeof showHomeScreen === 'function') showHomeScreen();
}

function initModeOnLoad() {
  // Keep home hidden
  var homeEl = document.getElementById('homePageOverlay');
  if (homeEl) homeEl.style.display = 'none';
  // Run smart startup flow
  initAppFlow();
}

async function initAppFlow() {
  // ── Step 1: Check auth ──
  if (typeof authIsLoggedIn === 'function' && !authIsLoggedIn()) {
    authShowScreen('welcome');
    return;
  }

  // ── Step 2: Show mode select if no saved mode ──
  var savedMode = localStorage.getItem('kbrr_app_mode') || sessionStorage.getItem('appMode') || '';
  if (!savedMode) {
    // First launch — show mode select screen
    var overlay = document.getElementById('modeSelectOverlay');
    if (overlay) overlay.style.display = 'flex';
    return;
  }

  // Vault requires admin auth, downgrade if needed
  if (savedMode === 'vault' && localStorage.getItem('kbrr_club_mode') !== 'admin') {
    savedMode = 'viewer';
  }

  // ── Step 3: Check club for organiser/vault ──
  var club = (typeof getMyClub === 'function') ? getMyClub() : { id: null };

  if (!club || !club.id) {
    if (savedMode === 'viewer') {
      selectMode('viewer');
      return;
    }
    // Organiser or vault without club — show club setup
    _showClubSetupSheet(savedMode);
    return;
  }

  // ── Step 4: Check players (organiser only) ──
  if (savedMode === 'organiser') {
    try {
      var players = await dbGetPlayers(true);
      if (!players || players.length === 0) {
        showOnboardingOverlay('noPlayers');
        return;
      }
    } catch(e) {}
  }

  // ── All good — show home ──
  selectMode(savedMode);
}

function showOnboardingOverlay(reason) {
  var overlay = document.getElementById('onboardingOverlay');
  var title   = document.getElementById('onboardingTitle');
  var msg     = document.getElementById('onboardingMsg');
  var btn     = document.getElementById('onboardingBtn');
  if (!overlay) return;

  var goToVault = function() {
    overlay.style.display = 'none';
    // Hide home overlay if visible
    var homeEl = document.getElementById('homePageOverlay');
    if (homeEl) homeEl.style.display = 'none';
    // Hide mode select if visible
    var modeEl = document.getElementById('modeSelectOverlay');
    if (modeEl) modeEl.style.display = 'none';
    // Show vault page
    showPage('vaultPage', null);
  };

  if (reason === 'notLoggedIn') {
    if (title) title.textContent = 'Welcome to Sports Club Scheduler';
    if (msg)   msg.textContent   = 'Connect to your club to get started.';
    if (btn)   { btn.textContent = 'Connect to Club'; btn.onclick = goToVault; }
  } else if (reason === 'noPlayers') {
    if (title) title.textContent = 'No players found';
    if (msg)   msg.textContent   = 'Your club has no players yet. Add players in the Vault to get started.';
    if (btn)   { btn.textContent = 'Go to Vault'; btn.onclick = goToVault; }
  }
  overlay.style.display = 'flex';
}

/* ============================================================
   MAIN — Navigation, tab access, scheduler init, round progression
   File: main.js
   ============================================================ */

let sessionFinished = false;
let lastPage = null;



function isPageVisible(pageId) {
  const el = document.getElementById(pageId);
  return el && el.style.display !== 'none';
}








document.addEventListener('DOMContentLoaded', () => {
  // Show mode select overlay first
  initModeOnLoad();

  // schedulerState starts empty — user imports players fresh each session
  consolidateMasterDB();
  updateRoundsPageAccess();
  updateSummaryPageAccess();
  // Init Supabase admin state (token + club)
  if (typeof clubAdminInit === "function") clubAdminInit();
  // Sync Supabase players into local history (silent, background)
  syncToLocal();
  // Sync all global players into local cache (for offline import)
  if (typeof syncGlobalPlayersCache === "function") syncGlobalPlayersCache();
  // Clean up stale live_sessions from previous days
  if (typeof cleanupLiveSessions === "function") cleanupLiveSessions();

  // ── Profile gate handled by selectMode() after mode is chosen ──

  // Auto end session if no round activity for 1 hour
  const AUTO_END_MS = 60 * 60 * 1000; // 1 hour
  setInterval(async () => {
    // Only trigger if there are active rounds with scored games
    const hasGames = typeof allRounds !== "undefined" &&
      allRounds.some(r => (r.games || r).some(g => g.winner));
    if (!hasGames) return;

    // Check last round update time from live_sessions
    try {
      const club = (typeof getMyClub === "function") ? getMyClub() : { id: null };
      if (!club.id) return;
      const today = new Date().toISOString().split("T")[0];
      const rows  = await sbGet("live_sessions",
        `club_id=eq.${club.id}&date=eq.${today}&order=updated_at.desc&limit=1`);
      if (!rows || !rows.length) return;

      const lastUpdate = new Date(rows[0].updated_at).getTime();
      if (Date.now() - lastUpdate < AUTO_END_MS) return;

      // 1hr idle — silently end session
      console.log("Auto-ending session after 1hr idle");
      if (typeof dbCompleteSession === "function") await dbCompleteSession();
      if (typeof flushLiveSession === "function") await flushLiveSession();
      if (typeof dbReleaseMySession === "function") await dbReleaseMySession();
      localStorage.removeItem("schedulerState");
      localStorage.removeItem("allRounds");
      localStorage.removeItem("currentRoundIndex");
      location.reload();
    } catch(e) { /* silent */ }
  }, 5 * 60 * 1000); // check every 5 minutes
});

window.addEventListener('beforeunload', () => {
  consolidateMasterDB();   // merge any new players added during session on close
  if (typeof dbCompleteSession === "function") dbCompleteSession();
  if (typeof dbReleaseMySession === "function") dbReleaseMySession();
});

/* =========================
   CONSOLIDATE MASTER DB
   Merges players from ALL sources into newImportHistory.
   Safe — never overwrites existing ratings, only adds missing players.
   Called on app open and close.
========================= */
function consolidateMasterDB() {
  try {
    const master   = JSON.parse(localStorage.getItem("newImportHistory")      || "[]");
    const favs     = JSON.parse(localStorage.getItem("newImportFavorites")     || "[]");
    const sets     = JSON.parse(localStorage.getItem("newImportFavoriteSets")  || "[]");
    const session  = JSON.parse(localStorage.getItem("schedulerPlayers")       || "[]");

    // Build lookup of existing master players (preserve their ratings)
    const masterMap = new Map();
    master.forEach(p => {
      if (p && p.displayName)
        masterMap.set(p.displayName.trim().toLowerCase(), p);
    });

    // Collect players from favorites and session only — NOT from sets
    // Sets are separate and should not pollute history
    const allSources = [
      ...favs,
      ...session.map(p => ({ displayName: p.name, gender: p.gender })),
    ];

    // Add missing players — never overwrite existing
    allSources.forEach(p => {
      if (!p || !p.displayName) return;
      const key = p.displayName.trim().toLowerCase();
      if (!masterMap.has(key)) {
        masterMap.set(key, {
          displayName: p.displayName.trim(),
          gender: p.gender || "Male",
          rating: 1.0   // default for new players only
        });
      }
    });

    const merged = Array.from(masterMap.values());
    localStorage.setItem("newImportHistory", JSON.stringify(merged));

    // Update in-memory historyPlayers if available
    if (newImportState) newImportState.historyPlayers = merged;
  } catch(e) {
    console.error("consolidateMasterDB error", e);
  }
}

/* ============================================================
   RATING — SINGLE DOOR
   
   Rule: activeRating is computed ONCE at sync time in syncToLocal.
   Everything else reads newImportHistory[].activeRating — mode-blind.

   getActiveRating(name)     — only READ path
   setActiveRating(name,val) — only WRITE path (in-memory + localStorage)
   syncRatings()             — refreshes all visible badges
   
   Mode logic lives ONLY in syncToLocal (read) and dbSyncRatings (write).
   ============================================================ */

function getRatingMode() {
  return 'local'; // global mode blocked until fully tested
}

function setRatingMode(mode) {
  localStorage.setItem('kbrr_rating_mode', mode);
  syncRatings();
}

/* READ — just reads activeRating, no mode logic here */
function getActiveRating(name) {
  try {
    const key = name.trim().toLowerCase();
    // 1. Check allPlayers in-memory first (most current during active session)
    const ap = schedulerState.allPlayers.find(p => p.name.trim().toLowerCase() === key);
    if (ap && ap.activeRating !== undefined) return ap.activeRating;
    // 2. Fallback to newImportHistory
    const master = JSON.parse(localStorage.getItem("newImportHistory") || "[]");
    const hp = master.find(h => h.displayName.trim().toLowerCase() === key);
    return (hp && hp.activeRating !== undefined) ? hp.activeRating : 1.0;
  } catch(e) { return 1.0; }
}

/* WRITE — updates in-memory and localStorage, mode-blind */
function setActiveRating(name, val) {
  try {
    const key     = name.trim().toLowerCase();
    const clamped = Math.min(5.0, Math.max(1.0, Math.round(val * 10) / 10));

    // Update allPlayers in-memory
    const ap = schedulerState.allPlayers.find(p => p.name.trim().toLowerCase() === key);
    if (ap) ap.activeRating = clamped;

    // Persist to newImportHistory
    const master = JSON.parse(localStorage.getItem("newImportHistory") || "[]");
    const hp = master.find(h => h.displayName.trim().toLowerCase() === key);
    if (hp) {
      hp.activeRating = clamped;
      localStorage.setItem("newImportHistory", JSON.stringify(master));
      // Keep in-memory historyPlayers in sync too
      if (newImportState && newImportState.historyPlayers) {
        const mp = newImportState.historyPlayers.find(h => h.displayName.trim().toLowerCase() === key);
        if (mp) mp.activeRating = clamped;
      }
    }
  } catch(e) { console.error("setActiveRating error", e); }
}

/* Legacy aliases — safe to leave, all point to same door */
function getRating(name)         { return getActiveRating(name); }
function setRating(name, rating) { setActiveRating(name, rating); }
function getClubRating(name)     { return getActiveRating(name); }
function setClubRating(name, r)  { setActiveRating(name, r); }

function syncRatings() {
  document.querySelectorAll(".rating-badge[data-player]").forEach(badge => {
    const name = badge.getAttribute("data-player");
    if (name) badge.textContent = getActiveRating(name).toFixed(1);
  });
}

function syncPlayersFromMaster() { syncRatings(); }


function updateRoundsPageAccess() {
  const block = schedulerState.activeplayers.length < 4;
  const roundsTab = document.getElementById('tabBtnRounds');

  if (!roundsTab) return;

  roundsTab.style.pointerEvents = block ? 'none' : 'auto';
  roundsTab.style.opacity = block ? '0.4' : '1';
  roundsTab.setAttribute('aria-disabled', block);

  if (block && isPageVisible('roundsPage')) {
    showPage('playersPage', null);
  }
}


function updateSummaryPageAccess() {
  const hasRounds = Array.isArray(allRounds) && allRounds.length > 0;
  const summaryTab = document.getElementById('tabBtnSummary');
  const block = !hasRounds;

  if (!summaryTab) return;

  summaryTab.style.pointerEvents = block ? 'none' : 'auto';
  summaryTab.style.opacity = block ? '0.4' : '1';
  summaryTab.setAttribute('aria-disabled', block);

  if (block && isPageVisible('summaryPage')) {
    showPage('playersPage', null);
  }
}

function showPage(pageID, el) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');

  // Show selected page
  document.getElementById(pageID).style.display = 'block';

  // Update active tab styling
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  if (el) {
    el.classList.add('active');
    // Scroll active tab into view smoothly
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  // Restore Session tab if a session is currently pinned open
  if (window._vSessionTabPinned) {
    const vBtn = document.getElementById('tabBtnViewer');
    if (vBtn) vBtn.style.display = '';
  }

  // Sync all rating badges on the newly visible page
  syncRatings();

  // Players page — update list on open
  if (pageID === 'playersPage') {
    if (typeof updatePlayerList === 'function') updatePlayerList();
  }

  // Fixed Pairs page — refresh selectors on open
  if (pageID === 'fixedPairsPage') {
    if (typeof updateFixedPairSelectors === 'function') updateFixedPairSelectors();
    if (typeof renderFixedPairs === 'function') renderFixedPairs();
  }

  // ➜ Additional action when roundsPage is opened
  if (pageID === "roundsPage") {
    if (sessionFinished) {
      console.warn("Rounds already finished");
      return;
    }
    updateMixedSessionFlag();
    if (allRounds.length <= 1) {
      resetRounds();
    } else {
      if (lastPage === "playersPage") {
        goToRounds();
      }
    }
  }

  if (pageID === "summaryPage") {
    if (typeof renderSummaryFromSession === 'function') renderSummaryFromSession();
  }

  if (pageID === "myCardPage") {
    if (typeof renderMyCard === 'function') renderMyCard();
  }

  if (pageID === "joinClubPage") {
    if (typeof joinClubPageOpen === 'function') joinClubPageOpen();
  }

  if (pageID === "helpPage") {
    if (typeof onHelpTabOpen === "function") onHelpTabOpen();
  }

  if (pageID === "dashboardPage") {
    if (typeof renderDashboard === "function") renderDashboard();
  } else {
    // Stop dashboard poll when navigating away
    if (typeof dashboardStopPoll === 'function') dashboardStopPoll();
  }

  if (pageID === "vaultPage") {
    if (typeof clubLoginRefresh === 'function') clubLoginRefresh();
    if (typeof viewerLoadClubs === 'function') viewerLoadClubs();
    if (typeof sbPopulateDeleteDropdown === 'function') sbPopulateDeleteDropdown();
  }

  if (pageID === "vaultPlayingPage") {
    if (typeof playerPlayingRenderList === 'function') playerPlayingRenderList();
  }

  if (pageID === "vaultRegisterPage") {
    if (typeof vaultRenderRegister === 'function') vaultRenderRegister();
  }

  if (pageID === "vaultModifyPage") {
    if (typeof vaultRenderModify === 'function') vaultRenderModify();
  }

  if (pageID === "vaultRequestsPage") {
    if (typeof vaultLoadRequests === 'function') vaultLoadRequests();
  }

  if (pageID === "vaultClubMgmtPage") {
    if (typeof clubLoginRefresh === 'function') clubLoginRefresh();
    if (typeof viewerLoadClubs === 'function') viewerLoadClubs();
    if (typeof sbPopulateDeleteDropdown === 'function') sbPopulateDeleteDropdown();
  }

  // Update last visited page
  lastPage = pageID;
}

let IS_MIXED_SESSION = false;

function updateMixedSessionFlag() {
  let hasMale = false;
  let hasFemale = false;

  for (const p of schedulerState.allPlayers) {
    if (p.gender === "Male") hasMale = true;
    if (p.gender === "Female") hasFemale = true;
    if (hasMale && hasFemale) break;
  }

  IS_MIXED_SESSION = hasMale && hasFemale;
}

	





















  








// Page initialization
function initPage() {
  document.getElementById("playersPage").style.display = 'block';
  document.getElementById("roundsPage").style.display = 'none';
}

/* ============================================================
   SYNC — Server is master.
   THIS is the only place mode logic runs for READING.
   Pulls from Supabase → picks correct field based on mode → 
   writes as activeRating → everything else is mode-blind.
============================================================ */
async function syncToLocal() {
  const club = (typeof getMyClub === "function") ? getMyClub() : { id: null };
  setSyncIndicator("🔄 Syncing...", "#aaa");

  if (!club.id) {
    setSyncIndicator("⚠️ No club selected", "#e6a817");
    return;
  }

  try {
    // Flush any offline-queued writes first
    if (typeof flushSyncQueue === "function") await flushSyncQueue();

    const players = await dbGetPlayers(true);
    if (!players || !players.length) {
      setSyncIndicator("⚠️ No players found", "#e6a817");
      return;
    }

    // Always use clubRating (club_rating column) as the active rating
    const synced = players.map(gp => {
      const activeRating = parseFloat(gp.clubRating) || parseFloat(gp.rating) || 1.0;
      return {
        displayName:  gp.name.trim(),
        gender:       gp.gender || "Male",
        rating:       parseFloat(gp.rating)     || 1.0,
        clubRating:   parseFloat(gp.clubRating) || 1.0,
        activeRating,
        id:           gp.id
      };
    });

    // Server wins — write to local cache
    localStorage.setItem("newImportHistory", JSON.stringify(synced));

    // Update in-memory state
    if (newImportState) {
      newImportState.historyPlayers = synced;
      if (typeof newImportRefreshSelectCards === "function") newImportRefreshSelectCards();
    }

    // Update allPlayers in-memory activeRating (safe — doesn't reset active session games)
    if (schedulerState && schedulerState.allPlayers) {
      synced.forEach(sp => {
        const ap = schedulerState.allPlayers.find(
          p => p.name.trim().toLowerCase() === sp.displayName.trim().toLowerCase()
        );
        if (ap) ap.activeRating = sp.activeRating;
      });
    }

    syncRatings();

    const count = synced.length;
    const msg   = `✅ ${count} player${count !== 1 ? "s" : ""} synced · ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
    localStorage.setItem("kbrr_last_sync", JSON.stringify({ msg, color: "#2dce89" }));
    setSyncIndicator(msg, "#2dce89");

  } catch (e) {
    console.warn("syncToLocal failed:", e.message);
    const msg = "⚠️ Offline — using cache";
    localStorage.setItem("kbrr_last_sync", JSON.stringify({ msg, color: "#e6a817" }));
    setSyncIndicator(msg, "#e6a817");
  }
}

function setSyncIndicator(msg, color) {
  const indicator = document.getElementById("sbSyncStatus");
  if (indicator) { indicator.textContent = msg; indicator.style.color = color; }
}

function restoreSyncIndicator() {
  try {
    const saved = localStorage.getItem("kbrr_last_sync");
    if (saved) {
      const { msg, color } = JSON.parse(saved);
      setSyncIndicator(msg, color);
    }
  } catch(e) {}
}



/* =============================================================
   VAULT MODE — Admin password gate
============================================================= */
function requestVaultMode() {
  const overlay = document.getElementById('modeSheetOverlay');
  if (overlay) overlay.remove();

  if (appMode === 'vault') { switchMode('vault'); return; }

  // Check club first
  var club = (typeof getMyClub === 'function') ? getMyClub() : null;
  if (!club || !club.id) {
    _showClubSetupSheet('vault');
    return;
  }

  // Already authenticated as admin this session
  if (localStorage.getItem('kbrr_club_mode') === 'admin') {
    appMode = 'vault';
    sessionStorage.setItem('appMode', 'vault');
    localStorage.setItem('kbrr_app_mode', 'vault');
    applyMode('vault');
    if (typeof showHomeScreen === 'function') showHomeScreen();
    return;
  }
  _showVaultPasswordPrompt();
}

/* =============================================================
   CLUB SETUP SHEET — shown when entering Organiser or Vault without a club
   Provides: Join existing club | Create new club
============================================================= */
var _clubSetupTargetMode = null; // mode to enter after club is set up
var _clubSetupCreateEmail = '';  // email during create-club OTP flow

function _showClubSetupSheet(targetMode) {
  _clubSetupTargetMode = targetMode;
  const existing = document.getElementById('clubSetupSheetOverlay');
  if (existing) existing.remove();

  const modeLabel = targetMode === 'vault' ? '🔑 Vault Manager' : '🏆 Round Organiser';

  const overlay = document.createElement('div');
  overlay.id = 'clubSetupSheetOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px)';
  overlay.innerHTML = `
    <div class="club-setup-sheet" id="clubSetupSheet">
      <div class="mode-sheet-handle"></div>
      <div class="mode-sheet-title">${modeLabel}</div>
      <p style="font-size:0.84rem;color:var(--text-dim);margin-bottom:16px;line-height:1.5">
        You need to be connected to a club. Join an existing club or create a new one.
      </p>

      <!-- TAB SWITCHER -->
      <div class="club-setup-tabs" id="clubSetupTabs">
        <button class="club-setup-tab active" id="clubSetupTabJoin" onclick="_clubSetupShowTab('join')">Join Club</button>
        <button class="club-setup-tab" id="clubSetupTabCreate" onclick="_clubSetupShowTab('create')">Create Club</button>
      </div>

      <!-- JOIN PANEL -->
      <div id="clubSetupPanelJoin" style="margin-top:14px">
        <select id="csJoinClubSelect" class="auth-input" style="margin-bottom:10px">
          <option value="">— Loading clubs… —</option>
        </select>
        <input type="password" id="csJoinPassword" class="auth-input" placeholder="Club password" style="margin-bottom:10px">
        <div id="csJoinFeedback" style="font-size:0.82rem;color:var(--red);min-height:18px;margin-bottom:10px"></div>
        <div style="display:flex;gap:10px">
          <button class="admin-modal-cancel" style="flex:1" onclick="document.getElementById('clubSetupSheetOverlay').remove()">Cancel</button>
          <button class="admin-modal-ok" style="flex:1" onclick="_clubSetupJoin()">Join</button>
        </div>
      </div>

      <!-- CREATE PANEL -->
      <div id="clubSetupPanelCreate" style="display:none;margin-top:14px">
        <div id="clubSetupCreateStep1">
          <input type="text"     id="csCreateName"    class="auth-input" placeholder="Club name"       style="margin-bottom:8px">
          <input type="email"    id="csCreateEmail"   class="auth-input" placeholder="Your email (OTP)" style="margin-bottom:8px">
          <input type="password" id="csCreateUserPw"  class="auth-input" placeholder="User password"   style="margin-bottom:8px">
          <input type="password" id="csCreateAdminPw" class="auth-input" placeholder="Admin password"  style="margin-bottom:10px">
          <div id="csCreateFeedback" style="font-size:0.82rem;color:var(--red);min-height:18px;margin-bottom:10px"></div>
          <div style="display:flex;gap:10px">
            <button class="admin-modal-cancel" style="flex:1" onclick="document.getElementById('clubSetupSheetOverlay').remove()">Cancel</button>
            <button class="admin-modal-ok" style="flex:1" onclick="_clubSetupCreateSendOtp()">📧 Send OTP</button>
          </div>
        </div>
        <div id="clubSetupCreateStep2" style="display:none">
          <p style="font-size:0.82rem;color:var(--text-dim);margin-bottom:10px">
            OTP sent to <strong id="csCreateEmailMasked"></strong>
            · <button class="link-btn" onclick="_clubSetupCreateResend()">Resend</button>
          </p>
          <input type="text" id="csCreateOtp" class="auth-input" placeholder="Enter 8-digit OTP" maxlength="8"
                 onkeydown="if(event.key==='Enter')_clubSetupCreateVerify()" style="margin-bottom:10px">
          <div id="csCreateFeedback2" style="font-size:0.82rem;color:var(--red);min-height:18px;margin-bottom:10px"></div>
          <div style="display:flex;gap:10px">
            <button class="admin-modal-cancel" style="flex:1" onclick="_clubSetupShowTab('create')">Back</button>
            <button class="admin-modal-ok" style="flex:1" onclick="_clubSetupCreateVerify()">Create Club</button>
          </div>
        </div>
      </div>
    </div>
  `;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  document.getElementById('clubSetupSheet').addEventListener('click', e => e.stopPropagation());

  // Load clubs for join dropdown
  _clubSetupLoadClubs();
}

function _clubSetupShowTab(tab) {
  document.getElementById('clubSetupTabJoin').classList.toggle('active', tab === 'join');
  document.getElementById('clubSetupTabCreate').classList.toggle('active', tab === 'create');
  document.getElementById('clubSetupPanelJoin').style.display   = tab === 'join'   ? '' : 'none';
  document.getElementById('clubSetupPanelCreate').style.display = tab === 'create' ? '' : 'none';
  // Reset create steps
  if (tab === 'create') {
    document.getElementById('clubSetupCreateStep1').style.display = '';
    document.getElementById('clubSetupCreateStep2').style.display = 'none';
    _clubSetupCreateEmail = '';
  }
}

async function _clubSetupLoadClubs() {
  const select = document.getElementById('csJoinClubSelect');
  if (!select) return;
  try {
    const clubs = await sbGet('clubs', 'select=id,name&order=name.asc');
    select.innerHTML = '<option value="">— Select club —</option>';
    clubs.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.name;
      select.appendChild(opt);
    });
  } catch(e) {
    select.innerHTML = '<option value="">— Could not load clubs —</option>';
  }
}

async function _clubSetupJoin() {
  const select = document.getElementById('csJoinClubSelect');
  const pwInput = document.getElementById('csJoinPassword');
  const fb = document.getElementById('csJoinFeedback');
  const setFb = (msg, ok) => { if (fb) { fb.textContent = msg; fb.style.color = ok ? '#2dce89' : '#e63757'; } };

  if (!select || !select.value) { setFb('Please select a club.', false); return; }
  const pw = pwInput ? pwInput.value.trim() : '';
  if (!pw) { setFb('Enter the club password.', false); return; }

  setFb('Checking…', true);
  try {
    const isVault = _clubSetupTargetMode === 'vault';
    const fields = isVault ? 'id,name,select_password,admin_password' : 'id,name,select_password,admin_password';
    const clubs = await sbGet('clubs', `id=eq.${select.value}&select=${fields}`);
    if (!clubs.length) throw new Error('Club not found.');

    let role = 'user';
    if (pw === clubs[0].admin_password) {
      role = 'admin';
    } else if (pw !== clubs[0].select_password) {
      throw new Error('Wrong password.');
    }

    if (typeof setMyClub === 'function') setMyClub(clubs[0].id, clubs[0].name);
    localStorage.setItem('kbrr_club_mode', role);
    localStorage.setItem('kbrr_rating_field', 'club_rating');
    if (pwInput) pwInput.value = '';

    setFb(role === 'admin' ? '✅ Joined as Admin' : '✅ Joined successfully', true);

    // Small delay so user sees success, then enter the mode
    setTimeout(() => {
      const ov = document.getElementById('clubSetupSheetOverlay');
      if (ov) ov.remove();
      if (typeof clubLoginRefresh === 'function') clubLoginRefresh();
      if (typeof syncToLocal === 'function') syncToLocal();

      const mode = _clubSetupTargetMode;
      if (mode === 'vault') {
        // Vault: if admin just joined as admin, go straight in; else ask for admin pw
        if (role === 'admin') {
          appMode = 'vault';
          sessionStorage.setItem('appMode', 'vault');
          localStorage.setItem('kbrr_app_mode', 'vault');
          applyMode('vault');
          if (typeof showHomeScreen === 'function') showHomeScreen();
        } else {
          _showVaultPasswordPrompt();
        }
      } else {
        appMode = mode;
        sessionStorage.setItem('appMode', mode);
        localStorage.setItem('kbrr_app_mode', mode);
        applyMode(mode);
        if (typeof showHomeScreen === 'function') showHomeScreen();
      }
    }, 700);
  } catch(e) { setFb('❌ ' + e.message, false); }
}

async function _clubSetupCreateSendOtp() {
  const name    = document.getElementById('csCreateName')?.value.trim();
  const email   = document.getElementById('csCreateEmail')?.value.trim();
  const userPw  = document.getElementById('csCreateUserPw')?.value.trim();
  const adminPw = document.getElementById('csCreateAdminPw')?.value.trim();
  const fb      = document.getElementById('csCreateFeedback');
  const setFb   = (msg, ok) => { if (fb) { fb.textContent = msg; fb.style.color = ok ? '#2dce89' : '#e63757'; } };

  if (!name)    { setFb('Enter club name.', false); return; }
  if (!email || !email.includes('@')) { setFb('Enter a valid email.', false); return; }
  if (!userPw)  { setFb('Enter user password.', false); return; }
  if (!adminPw) { setFb('Enter admin password.', false); return; }

  setFb('Sending OTP…', true);
  try {
    // Store form values so they survive the step switch
    document.getElementById('csCreateName')._savedVal    = name;
    document.getElementById('csCreateUserPw')._savedVal  = userPw;
    document.getElementById('csCreateAdminPw')._savedVal = adminPw;

    await dbSendOtp(email);
    _clubSetupCreateEmail = email;

    const masked = document.getElementById('csCreateEmailMasked');
    if (masked) masked.textContent = maskEmail ? maskEmail(email) : email.replace(/(.{2}).+(@.+)/, '$1…$2');

    document.getElementById('clubSetupCreateStep1').style.display = 'none';
    document.getElementById('clubSetupCreateStep2').style.display = '';
    document.getElementById('csCreateOtp').value = '';
    document.getElementById('csCreateOtp').focus();
    setFb('OTP sent! Check your email.', true);
  } catch(e) { setFb('❌ ' + e.message, false); }
}

async function _clubSetupCreateResend() {
  if (!_clubSetupCreateEmail) return;
  try {
    await dbSendOtp(_clubSetupCreateEmail);
    const fb2 = document.getElementById('csCreateFeedback2');
    if (fb2) { fb2.textContent = 'OTP resent.'; fb2.style.color = '#2dce89'; }
  } catch(e) {}
}

async function _clubSetupCreateVerify() {
  const otp     = document.getElementById('csCreateOtp')?.value.trim();
  const name    = document.getElementById('csCreateName')?._savedVal    || document.getElementById('csCreateName')?.value.trim();
  const userPw  = document.getElementById('csCreateUserPw')?._savedVal  || document.getElementById('csCreateUserPw')?.value.trim();
  const adminPw = document.getElementById('csCreateAdminPw')?._savedVal || document.getElementById('csCreateAdminPw')?.value.trim();
  const fb      = document.getElementById('csCreateFeedback2');
  const setFb   = (msg, ok) => { if (fb) { fb.textContent = msg; fb.style.color = ok ? '#2dce89' : '#e63757'; } };

  if (!otp || otp.length < 8) { setFb('Enter the 8-digit OTP.', false); return; }
  setFb('Creating club…', true);
  try {
    await dbVerifyOtp(_clubSetupCreateEmail, otp);
    const club = await dbAddClub(name, userPw, adminPw, _clubSetupCreateEmail);
    if (typeof setMyClub === 'function') setMyClub(club.id, club.name);
    localStorage.setItem('kbrr_club_mode', 'admin');
    localStorage.setItem('kbrr_rating_field', 'club_rating');
    setFb(`✅ Club "${club.name}" created! You are now Admin.`, true);
    _clubSetupCreateEmail = '';

    setTimeout(() => {
      const ov = document.getElementById('clubSetupSheetOverlay');
      if (ov) ov.remove();
      if (typeof clubLoginRefresh === 'function') clubLoginRefresh();
      if (typeof syncToLocal === 'function') syncToLocal();

      const mode = _clubSetupTargetMode;
      // Creator is always admin — go straight into requested mode
      appMode = mode;
      sessionStorage.setItem('appMode', mode);
      localStorage.setItem('kbrr_app_mode', mode);
      applyMode(mode);
      if (typeof showHomeScreen === 'function') showHomeScreen();
    }, 1000);
  } catch(e) { setFb('❌ ' + e.message, false); }
}

function _showVaultPasswordPrompt() {
  const existing = document.getElementById('vaultPromptOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'vaultPromptOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px)';
  overlay.innerHTML = `
    <div class="vault-pw-sheet" id="vaultPwSheet">
      <div class="mode-sheet-handle"></div>
      <div class="mode-sheet-title">🔑 Vault Manager</div>
      <p style="font-size:0.84rem;color:var(--text-dim);margin-bottom:16px;line-height:1.5">
        Enter the club admin password to access Vault Manager.
      </p>
      <input type="password" id="vaultPwInput" class="admin-password-input"
             placeholder="Admin password"
             onkeydown="if(event.key==='Enter')verifyVaultPassword()"
             style="margin-bottom:12px;width:100%">
      <div id="vaultPwError" style="font-size:0.82rem;color:var(--red);min-height:18px;margin-bottom:12px"></div>
      <div style="display:flex;gap:10px">
        <button class="admin-modal-cancel" style="flex:1"
                onclick="document.getElementById('vaultPromptOverlay').remove()">Cancel</button>
        <button class="admin-modal-ok" style="flex:1"
                onclick="verifyVaultPassword()">Enter Vault</button>
      </div>
    </div>
  `;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  document.getElementById('vaultPwSheet').addEventListener('click', e => e.stopPropagation());
  setTimeout(() => document.getElementById('vaultPwInput')?.focus(), 100);
}

async function verifyVaultPassword() {
  const input = document.getElementById('vaultPwInput');
  const errEl = document.getElementById('vaultPwError');
  const pw    = (input ? input.value : '').trim();
  if (!pw) { if (errEl) errEl.textContent = 'Enter the admin password'; return; }

  const club = (typeof getMyClub === 'function') ? getMyClub() : null;
  if (!club || !club.id) { if (errEl) errEl.textContent = 'No club selected'; return; }

  if (errEl) errEl.textContent = 'Checking...';
  try {
    const rows = await sbGet('clubs', `id=eq.${club.id}&select=admin_password`);
    if (!rows || !rows.length || rows[0].admin_password !== pw) {
      if (errEl) errEl.textContent = 'Wrong admin password';
      if (input) input.value = '';
      return;
    }
    localStorage.setItem('kbrr_club_mode', 'admin');
    const ov = document.getElementById('vaultPromptOverlay');
    if (ov) ov.remove();
    switchMode('vault');
  } catch(e) {
    if (errEl) errEl.textContent = 'Error: ' + e.message;
  }
}

/* =============================================================
   POWER BUTTON — End Session
============================================================= */
async function endSession(fromProfile = false) {
  if (!confirm('End session?')) return;

  // Mark session completed in sessions table
  if (typeof dbCompleteSession === 'function') await dbCompleteSession();

  // Flush live_sessions → players.sessions, then delete temp rows
  if (typeof flushLiveSession === 'function') await flushLiveSession();

  // Release session slots
  if (typeof dbReleaseMySession === 'function') await dbReleaseMySession();

  // Clear local session state — no reload
  localStorage.removeItem('schedulerState');
  localStorage.removeItem('allRounds');
  localStorage.removeItem('currentRoundIndex');
  sessionStorage.removeItem('kbrr_session_db_id');

  // Reset in-memory state
  if (typeof allRounds !== 'undefined') allRounds.length = 0;
  if (typeof schedulerState !== 'undefined') {
    schedulerState.activeplayers = [];
    schedulerState.allPlayers    = [];
    if (schedulerState.winCount)    schedulerState.winCount.clear();
    if (schedulerState.PlayedCount) schedulerState.PlayedCount.clear();
    if (schedulerState.restCount)   schedulerState.restCount.clear();
  }

  // Stay on dashboard and refresh it
  if (typeof showPage === 'function') {
    showPage('dashboardPage', document.getElementById('tabBtnDashboard'));
  }
}

/* === SETTINGS TAB SWITCHER === */
function settingsShowTab(tab) {
  ["club","general"].forEach(t => {
    const el = document.getElementById("settingsTab" + t.charAt(0).toUpperCase() + t.slice(1));
    if (el) el.style.display = t === tab ? "" : "none";
    const btn = document.getElementById("settingsTab" + t.charAt(0).toUpperCase() + t.slice(1) + "Btn");
    if (btn) btn.classList.toggle("active", t === tab);
  });
}

// Close fixed pair picker on outside click
document.addEventListener("click", function(e) {
  if (typeof fpOpenPicker !== "undefined" && fpOpenPicker !== null) {
    if (!e.target.closest(".fp-picker-field") && !e.target.closest(".fp-dropdown")) {
      fpClosePicker(fpOpenPicker);
    }
  }
});

