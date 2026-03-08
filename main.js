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
});

window.addEventListener('beforeunload', () => {
  consolidateMasterDB();   // merge any new players added during session on close
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

function getRating(name) {
  try {
    const master = JSON.parse(localStorage.getItem("newImportHistory") || "[]");
    const hp = master.find(h => h.displayName.trim().toLowerCase() === name.trim().toLowerCase());
    return (hp && hp.rating !== undefined) ? hp.rating : 1.0;
  } catch(e) { return 1.0; }
}

function setRating(name, rating) {
  try {
    const master = JSON.parse(localStorage.getItem("newImportHistory") || "[]");
    const hp = master.find(h => h.displayName.trim().toLowerCase() === name.trim().toLowerCase());
    if (hp) {
      hp.rating = Math.min(5.0, Math.max(1.0, Math.round(rating * 10) / 10));
      localStorage.setItem("newImportHistory", JSON.stringify(master));
      // Also update in-memory historyPlayers so current session stays consistent
      if (newImportState && newImportState.historyPlayers) {
        const mp = newImportState.historyPlayers.find(h => h.displayName.trim().toLowerCase() === name.trim().toLowerCase());
        if (mp) mp.rating = hp.rating;
      }
    }
  } catch(e) { console.error("setRating error", e); }
}

function syncRatings() {
  // Update every rating badge currently in the DOM by player name
  document.querySelectorAll(".rating-badge[data-player]").forEach(badge => {
    const name = badge.getAttribute("data-player");
    if (name) badge.textContent = getRating(name).toFixed(1);
  });
}

// Keep syncPlayersFromMaster as alias for backwards compatibility
function syncPlayersFromMaster() {
  syncRatings();
}


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

	





















  





function toggleGender() {
  const toggle = document.querySelector(".gender-toggle");
  const hiddenInput = document.getElementById("genderValue");

  toggle.classList.toggle("active");

  const isFemale = toggle.classList.contains("active");
  hiddenInput.value = isFemale ? "Female" : "Male";

  console.log("Selected Gender:", hiddenInput.value);
}


// Page initialization
function initPage() {
  document.getElementById("playersPage").style.display = 'block';
  document.getElementById("roundsPage").style.display = 'none';
}

/* =========================
   SYNC GITHUB → LOCAL
   Pulls all players from GitHub and merges into newImportHistory.
   Preserves local ratings. Silent fail if offline.
========================= */
async function syncGithubToLocal() {
  const club = (typeof getMyClub === "function") ? getMyClub() : { id: null };

  // Show syncing indicator if element exists
  const indicator = document.getElementById("sbSyncStatus");
  if (indicator) { indicator.textContent = "🔄 Syncing..."; indicator.style.color = "#aaa"; }

  try {
    const players = await dbGetPlayers(true);

    if (!club.id) {
      // No club selected — clear local history
      if (indicator) { indicator.textContent = "⚠️ No club selected"; indicator.style.color = "#e6a817"; }
      return;
    }

    // Supabase is single source of truth — replace local history completely
    const synced = (players || []).map(gp => ({
      displayName: gp.name.trim(),
      gender:      gp.gender || "Male",
      rating:      parseFloat(gp.rating) || 1.0
    }));

    localStorage.setItem("newImportHistory", JSON.stringify(synced));
    if (newImportState) {
      newImportState.historyPlayers = synced;
      newImportRefreshSelectCards();
    }

    if (indicator) {
      const count = synced.length;
      indicator.textContent = `✅ ${count} player${count !== 1 ? "s" : ""} synced`;
      indicator.style.color = "#2dce89";
      setTimeout(() => { if (indicator) indicator.textContent = ""; }, 4000);
    }

  } catch (e) {
    // Silent fail — offline, keep existing local cache
    if (indicator) { indicator.textContent = "⚠️ Offline — using cache"; indicator.style.color = "#e6a817"; }
  }
}

/* =============================================================
   POWER BUTTON — End Session
============================================================= */
async function endSession() {
  // Check if any games were played this session
  const gamesPlayed = (typeof allRounds !== "undefined") &&
    allRounds.some(round => round.some(game => game.winner));

  const msg = gamesPlayed
    ? "End session?\n\nGame results will be saved before resetting."
    : "End session?\n\nNo games played — nothing will be saved.";

  if (!confirm(msg)) return;

  // Save session summary if games were played
  if (gamesPlayed && typeof schedulerState !== "undefined") {
    try {
      const today = new Date().toISOString().split("T")[0];

      // Collect total wins/losses per player across all rounds
      const totalWins   = new Map();
      const totalLosses = new Map();

      for (const round of allRounds) {
        for (const game of round) {
          if (!game.winner) continue;
          const winners = game.winner === "L" ? game.pair1 : game.pair2;
          const losers  = game.winner === "L" ? game.pair2 : game.pair1;
          winners.forEach(p => totalWins.set(p,   (totalWins.get(p)   || 0) + 1));
          losers.forEach(p  => totalLosses.set(p, (totalLosses.get(p) || 0) + 1));
        }
      }

      // Update sessions JSON for each player
      const players = schedulerState.allPlayers || [];
      for (const p of players) {
        const wins   = totalWins.get(p.name)   || 0;
        const losses = totalLosses.get(p.name) || 0;
        if (wins === 0 && losses === 0) continue;

        try {
          const rows = await sbGet("players", `name=ilike.${encodeURIComponent(p.name)}&select=id,sessions`);
          if (!rows || !rows.length) continue;

          const existing = rows[0].sessions || [];
          const newEntry = { date: today, wins, losses, rating: getRating(p.name) };
          const updated  = [newEntry, ...existing].slice(0, 3); // keep last 3

          await sbPatch("players", `name=ilike.${encodeURIComponent(p.name)}`, { sessions: updated });
        } catch (e) { /* silent */ }
      }
    } catch (e) { /* silent */ }
  }

  // Reset app
  localStorage.removeItem("schedulerState");
  localStorage.removeItem("allRounds");
  localStorage.removeItem("currentRoundIndex");
  location.reload();
}

/* === SETTINGS TAB SWITCHER === */
function settingsShowTab(tab) {
  ["font","theme","reset"].forEach(t => {
    document.getElementById("settingsTab" + t.charAt(0).toUpperCase() + t.slice(1)).style.display = t === tab ? "" : "none";
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
