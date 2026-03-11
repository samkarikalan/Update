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
  // schedulerState starts empty — user imports players fresh each session
  consolidateMasterDB();
  updateRoundsPageAccess();
  updateSummaryPageAccess();
  // Init GitHub admin state (token + club)
  if (typeof githubAdminInit === "function") githubAdminInit();
  // Sync GitHub players into local history (silent, background)
  syncGithubToLocal();
  // Sync all global players into local cache (for offline import)
  if (typeof syncGlobalPlayersCache === "function") syncGlobalPlayersCache();
});

window.addEventListener('beforeunload', () => {
  consolidateMasterDB();   // merge any new players added during session on close
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

/* =========================
   RATING — single source of truth
   localStorage("newImportHistory") is the ONLY store for ratings.
   getRating / setRating are the ONLY way to read or write.
   syncRatings updates every visible badge — called on tab change + after any write.
========================= */

/* ============================================================
   RATING — SINGLE DOOR
   getActiveRating(name)      — only way to READ a rating
   setActiveRating(name, val) — only way to WRITE a rating
   All mode + trusted logic lives here and nowhere else.
   ============================================================ */

function getRatingMode() {
  return localStorage.getItem('kbrr_rating_mode') || 'local';
}

function setRatingMode(mode) {
  localStorage.setItem('kbrr_rating_mode', mode);
  syncRatings();
}

/* READ — returns club rating (local mode) or global rating (global mode) */
function getActiveRating(name) {
  try {
    const key = name.trim().toLowerCase();
    if (getRatingMode() === 'local') {
      // 1. Check allPlayers in-memory first (most current during session)
      const ap = schedulerState.allPlayers.find(p => p.name.trim().toLowerCase() === key);
      if (ap && ap.clubRating !== undefined) return ap.clubRating;
      // 2. Fallback to newImportHistory (last sync)
      const master = JSON.parse(localStorage.getItem("newImportHistory") || "[]");
      const hp = master.find(h => h.displayName.trim().toLowerCase() === key);
      return (hp && hp.clubRating !== undefined) ? hp.clubRating : 1.0;
    } else {
      // Global mode — read from newImportHistory.rating
      const master = JSON.parse(localStorage.getItem("newImportHistory") || "[]");
      const hp = master.find(h => h.displayName.trim().toLowerCase() === key);
      return (hp && hp.rating !== undefined) ? hp.rating : 1.0;
    }
  } catch(e) { return 1.0; }
}

/* WRITE — writes to correct field based on mode */
function setActiveRating(name, rating) {
  try {
    const key     = name.trim().toLowerCase();
    const clamped = Math.min(5.0, Math.max(1.0, Math.round(rating * 10) / 10));

    if (getRatingMode() === 'local') {
      // Write clubRating to allPlayers in-memory
      const ap = schedulerState.allPlayers.find(p => p.name.trim().toLowerCase() === key);
      if (ap) ap.clubRating = clamped;
      // Also persist to newImportHistory
      const master = JSON.parse(localStorage.getItem("newImportHistory") || "[]");
      const hp = master.find(h => h.displayName.trim().toLowerCase() === key);
      if (hp) {
        hp.clubRating = clamped;
        localStorage.setItem("newImportHistory", JSON.stringify(master));
        if (newImportState && newImportState.historyPlayers) {
          const mp = newImportState.historyPlayers.find(h => h.displayName.trim().toLowerCase() === key);
          if (mp) mp.clubRating = clamped;
        }
      }
    } else {
      // Global mode — write rating to newImportHistory
      const master = JSON.parse(localStorage.getItem("newImportHistory") || "[]");
      const hp = master.find(h => h.displayName.trim().toLowerCase() === key);
      if (hp) {
        hp.rating = clamped;
        localStorage.setItem("newImportHistory", JSON.stringify(master));
        if (newImportState && newImportState.historyPlayers) {
          const mp = newImportState.historyPlayers.find(h => h.displayName.trim().toLowerCase() === key);
          if (mp) mp.rating = clamped;
        }
      }
    }
  } catch(e) { console.error("setActiveRating error", e); }
}

/* Legacy aliases — kept for any remaining callers */
function getRating(name)          { return getActiveRating(name); }
function setRating(name, rating)  { setActiveRating(name, rating); }
function getClubRating(name)      { return getActiveRating(name); }
function setClubRating(name, r)   { setActiveRating(name, r); }

function syncRatings() {
  document.querySelectorAll(".rating-badge[data-player]").forEach(badge => {
    const name = badge.getAttribute("data-player");
    if (name) badge.textContent = getActiveRating(name).toFixed(1);
  });
}

// Keep syncPlayersFromMaster as alias for backwards compatibility
function syncPlayersFromMaster() { syncRatings(); }
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
  if (el) el.classList.add('active');

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

  if (pageID === "helpPage") {}

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

/* =========================
   SYNC — Server is master.
   Pull fresh from Supabase → write to local.
   Called on app load, after round, and manually.
   Safe: never overwrites in-session ratings (allPlayers memory).
========================= */
async function syncGithubToLocal() {
  const club = (typeof getMyClub === "function") ? getMyClub() : { id: null };
  const indicator = document.getElementById("sbSyncStatus");
  if (indicator) { indicator.textContent = "🔄 Syncing..."; indicator.style.color = "#aaa"; }

  if (!club.id) {
    if (indicator) { indicator.textContent = "⚠️ No club selected"; indicator.style.color = "#e6a817"; }
    return;
  }

  try {
    // Pull fresh from server
    const players = await dbGetPlayers(true);
    if (!players || !players.length) {
      if (indicator) { indicator.textContent = "⚠️ No players found"; indicator.style.color = "#e6a817"; }
      return;
    }

    const synced = players.map(gp => ({
      displayName: gp.name.trim(),
      gender:      gp.gender || "Male",
      rating:      parseFloat(gp.rating)      || 1.0,
      clubRating:  parseFloat(gp.clubRating)  || 1.0,
      id:          gp.id
    }));

    // Write to local cache — server wins
    localStorage.setItem("newImportHistory", JSON.stringify(synced));

    // Update in-memory state
    if (newImportState) {
      newImportState.historyPlayers = synced;
      if (typeof newImportRefreshSelectCards === "function") newImportRefreshSelectCards();
    }

    // Update allPlayers in-memory club ratings (don't reset active session)
    if (schedulerState && schedulerState.allPlayers) {
      synced.forEach(sp => {
        const ap = schedulerState.allPlayers.find(
          p => p.name.trim().toLowerCase() === sp.displayName.trim().toLowerCase()
        );
        if (ap) ap.clubRating = sp.clubRating;
      });
    }

    syncRatings();

    if (indicator) {
      const count = synced.length;
      indicator.textContent = `✅ ${count} player${count !== 1 ? "s" : ""} synced`;
      indicator.style.color = "#2dce89";
      setTimeout(() => { if (indicator) indicator.textContent = ""; }, 4000);
    }

  } catch (e) {
    console.warn("syncGithubToLocal failed:", e.message);
    if (indicator) { indicator.textContent = "⚠️ Offline — using cache"; indicator.style.color = "#e6a817"; }
  }
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

  // Save session summary if games were played
  if (gamesPlayed && typeof schedulerState !== "undefined") {
    try {
      const today = new Date().toISOString().split("T")[0];

      // Build gender lookup for avatar display
      const genderMap = new Map();
      (schedulerState.allPlayers || []).forEach(p => genderMap.set(p.name, p.gender || "Male"));

      // Build per-player match history from allRounds
      // playerMatches: Map<playerName, [{opponents, opponentGenders, result}]>
      const playerMatches = new Map();

      for (const round of allRounds) {
        const games = round.games || round;
        for (const game of games) {
          if (!game.winner) continue;

          const leftWon  = game.winner === "L";
          const pair1    = game.pair1 || [];
          const pair2    = game.pair2 || [];

          // For each player in pair1
          for (const p of pair1) {
            if (!playerMatches.has(p)) playerMatches.set(p, []);
            playerMatches.get(p).push({
              partner:          pair1.filter(x => x !== p),
              partnerGenders:   pair1.filter(x => x !== p).map(n => genderMap.get(n) || "Male"),
              opponents:        pair2,
              opponentGenders:  pair2.map(n => genderMap.get(n) || "Male"),
              result:           leftWon ? "W" : "L"
            });
          }
          // For each player in pair2
          for (const p of pair2) {
            if (!playerMatches.has(p)) playerMatches.set(p, []);
            playerMatches.get(p).push({
              partner:          pair2.filter(x => x !== p),
              partnerGenders:   pair2.filter(x => x !== p).map(n => genderMap.get(n) || "Male"),
              opponents:        pair1,
              opponentGenders:  pair1.map(n => genderMap.get(n) || "Male"),
              result:           leftWon ? "L" : "W"
            });
          }
        }
      }

      // Save for every player who played
      const players = schedulerState.allPlayers || [];
      for (const p of players) {
        const matches = playerMatches.get(p.name) || [];
        if (!matches.length) continue;

        const wins   = matches.filter(m => m.result === "W").length;
        const losses = matches.filter(m => m.result === "L").length;

        const newEntry = {
          date:    today,
          wins,
          losses,
          rating:  (typeof getActiveRating === "function" ? getActiveRating(p.name) : getRating(p.name)),
          matches  // full match details
        };

        // ── LAYER 1: localStorage ──
        try {
          const lsKey    = `kbrr_sessions_${p.name.toLowerCase().replace(/\s+/g, "_")}`;
          const existing = JSON.parse(localStorage.getItem(lsKey) || "[]");
          const updated  = [newEntry, ...existing].slice(0, 3);
          localStorage.setItem(lsKey, JSON.stringify(updated));
        } catch (e) { /* silent */ }

        // ── LAYER 2: Supabase players.sessions column ──
        try {
          const rows = await sbGet("players", `name=ilike.${encodeURIComponent(p.name)}&select=id,sessions`);
          if (rows && rows.length) {
            const existing = rows[0].sessions || [];
            const updated  = [newEntry, ...existing].slice(0, 3);
            await sbPatch("players", `name=ilike.${encodeURIComponent(p.name)}`, { sessions: updated });
          }
        } catch (e) { /* silent */ }
      }
    } catch (e) { /* silent */ }
  }

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

/* ============================================================
   RATING MODE — global vs local (club)
   kbrr_rating_mode: "global" | "local"
   Handled by single door getActiveRating / setActiveRating above.
   ============================================================ */
