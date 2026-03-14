/* ══════════════════════════════════════════════
   MODE SYSTEM — Viewer / Organiser
   Stored in sessionStorage (resets on app close)
══════════════════════════════════════════════ */

var appMode = null; // 'viewer' | 'organiser'

function selectMode(mode) {
  appMode = mode;
  sessionStorage.setItem('appMode', mode);
  // Hide overlay
  const overlay = document.getElementById('modeSelectOverlay');
  if (overlay) overlay.style.display = 'none';
  // Show badge
  const badgeEl = document.getElementById('modeBadgeBtn');
  if (badgeEl) badgeEl.style.display = '';
  // Apply mode
  applyMode(mode);
  // Now check profile
  const player = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;
  if (!player) {
    if (typeof openProfileDrawer === 'function') openProfileDrawer();
  }
}

function applyMode(mode) {
  appMode = mode;

  // Toggle scrollable tabs body class
  document.body.classList.toggle('organiser-tabs', mode === 'organiser');

  // Update badge
  const badge = document.getElementById('modeBadgeBtn');
  const badgeLabel = document.getElementById('modeBadgeLabel');
  if (badge) badge.className = 'mode-badge-btn ' + (mode === 'viewer' ? 'viewer-mode' : 'organiser-mode');
  if (badgeLabel) badgeLabel.textContent = mode === 'viewer' ? 'Viewer' : 'Organiser';

  // Update Settings mode switch card
  const cardViewer    = document.getElementById('modeCardViewer');
  const cardOrganiser = document.getElementById('modeCardOrganiser');
  if (cardViewer)    cardViewer.classList.toggle('active',    mode === 'viewer');
  if (cardOrganiser) cardOrganiser.classList.toggle('active', mode === 'organiser');

  // Tab visibility rules
  // Viewer:    Settings · Dashboard · Help
  // Organiser: Settings · Players · Rounds · Summary · Dashboard · Help
  const tabRules = {
    tabBtnPlayers:   { viewer: false, organiser: true },
    tabBtnRounds:    { viewer: false, organiser: true },
    tabBtnSummary:   { viewer: false, organiser: true },
    tabBtnDashboard: { viewer: true,  organiser: true },
  };
  Object.entries(tabRules).forEach(([id, rules]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = rules[mode] ? '' : 'none';
  });

  // If viewer is on a hidden page → redirect to Dashboard
  if (mode === 'viewer') {
    const hiddenPages = ['playersPage', 'roundsPage', 'summaryPage'];
    const onHiddenPage = hiddenPages.some(pid => {
      const p = document.getElementById(pid);
      return p && p.style.display !== 'none';
    });
    if (onHiddenPage) {
      showPage('dashboardPage', document.getElementById('tabBtnDashboard'));
    }
    setViewerMode(true);
  } else {
    setViewerMode(false);
  }
}

function setViewerMode(isViewer) {
  // Use body class — all viewer restrictions handled via CSS + JS checks
  if (isViewer) {
    document.body.classList.add('viewer-mode');
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
  const isViewer = appMode === 'viewer';
  sheet.innerHTML = `
    <div class="mode-sheet-handle"></div>
    <div class="mode-sheet-title">Switch Mode</div>
    <div class="mode-sheet-options">
      <button class="mode-sheet-btn viewer ${isViewer ? 'active-viewer' : ''}"
              onclick="switchMode('viewer')">
        <div class="mode-sheet-icon">👁</div>
        <div class="mode-sheet-info">
          <div class="mode-sheet-name">Viewer</div>
          <div class="mode-sheet-desc">Watch live rounds &amp; scores</div>
        </div>
        ${isViewer ? '<span class="mode-sheet-check">✅</span>' : ''}
      </button>
      <button class="mode-sheet-btn organiser ${!isViewer ? 'active-organiser' : ''}"
              onclick="switchMode('organiser')">
        <div class="mode-sheet-icon">⚙️</div>
        <div class="mode-sheet-info">
          <div class="mode-sheet-name">Organiser</div>
          <div class="mode-sheet-desc">Run session, score games, manage players</div>
        </div>
        ${!isViewer ? '<span class="mode-sheet-check">✅</span>' : ''}
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
  applyMode(mode);
  sessionStorage.setItem('appMode', mode);
}

function initModeOnLoad() {
  const overlay = document.getElementById('modeSelectOverlay');
  if (overlay) overlay.style.display = 'flex';
  // Hide badge and mode-dependent tabs until mode is selected
  const badge = document.getElementById('modeBadgeBtn');
  if (badge) badge.style.display = 'none';
  ['tabBtnPlayers','tabBtnRounds','tabBtnSummary','tabBtnDashboard'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
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
  const tabs = document.querySelectorAll('.tab-btn');
  const roundsTab = tabs[2]; // ← was 1, now 2 (Settings added at 0)

  if (!roundsTab) return;

  roundsTab.style.pointerEvents = block ? 'none' : 'auto';
  roundsTab.style.opacity = block ? '0.4' : '1';
  roundsTab.setAttribute('aria-disabled', block);

  if (block && isPageVisible('roundsPage')) {
    showPage('playersPage', tabs[1]);
  }
}


function updateSummaryPageAccess() {
  const hasRounds = Array.isArray(allRounds) && allRounds.length > 0;
  const tabs = document.querySelectorAll('.tab-btn');
  const summaryTab = tabs[3]; // ← was 2, now 3

  const block = !hasRounds;

  if (!summaryTab) return;

  summaryTab.style.pointerEvents = block ? 'none' : 'auto';
  summaryTab.style.opacity = block ? '0.4' : '1';
  summaryTab.setAttribute('aria-disabled', block);

  if (block && isPageVisible('summaryPage')) {
    showPage('playersPage', tabs[1]);
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

  // Sync all rating badges on the newly visible page
  syncRatings();

  // ── Move shared player slot to the active page ──
  const slot = document.getElementById('sharedPlayerSlot');
  if (pageID === 'playersPage') {
    const anchor = document.getElementById('playersSlotAnchor');
    if (slot && anchor) { anchor.appendChild(slot); slot.style.display = 'block'; }
  } else if (pageID === 'roundsPage') {
    const anchor = document.getElementById('roundsSlotAnchor');
    if (slot && anchor) { anchor.appendChild(slot); slot.style.display = 'block'; }
  } else {
    // Hide slot when on any other page (settings, summary, help)
    if (slot) slot.style.display = 'none';
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
    report();
    renderRounds();
  }

  if (pageID === "helpPage") {
    if (typeof onHelpTabOpen === "function") onHelpTabOpen();
  }

  if (pageID === "dashboardPage") {
    if (typeof renderDashboard === "function") renderDashboard();
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

    // kbrr_rating_field set at login — single decision point for READ
    const ratingField = localStorage.getItem("kbrr_rating_field") || "club_ratings";
    const synced = players.map(gp => {
      const activeRating = ratingField === "club_ratings"
        ? (parseFloat(gp.clubRating) || 1.0)
        : (parseFloat(gp.rating)     || 1.0);
      return {
        displayName:  gp.name.trim(),
        gender:       gp.gender || "Male",
        rating:       parseFloat(gp.rating)     || 1.0,  // raw global — for profile display only
        clubRating:   parseFloat(gp.clubRating) || 1.0,  // raw club   — for profile display only
        activeRating,                                     // what everything else reads
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
   POWER BUTTON — End Session
============================================================= */
async function endSession(fromProfile = false) {
  // Check if any games were played this session
  const gamesPlayed = (typeof allRounds !== "undefined") &&
    allRounds.some(round => (round.games || round).some(game => game.winner));

  const msg = gamesPlayed
    ? "End session?\n\nGame results will be saved before resetting."
    : "End session?\n\nNo games played — nothing will be saved.";

  if (!confirm(msg)) return;

  // Session data flushed via flushLiveSession() below (written to live_sessions after each round)

  // Mark session completed in sessions table + keep last 3
  if (typeof dbCompleteSession === "function") await dbCompleteSession();

  // Flush live_sessions → players.sessions, then delete temp rows
  if (typeof flushLiveSession === "function") await flushLiveSession();

  // Release session slots before reset
  if (typeof dbReleaseMySession === "function") await dbReleaseMySession();

  // Reset app
  localStorage.removeItem("schedulerState");
  localStorage.removeItem("allRounds");
  localStorage.removeItem("currentRoundIndex");
  location.reload();
}

/* === SETTINGS TAB SWITCHER === */
function settingsShowTab(tab) {
  ["font","theme","reset"].forEach(t => {
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

