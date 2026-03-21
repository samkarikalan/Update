/* ============================================================
   IMPORT PLAYERS MODAL
   File: importPlayers.js
   ============================================================ */

/* =========================
   HELPERS
========================= */

// Universal unique-add utility — used for all three lists
function addToListIfNotExists(list, player) {
  const exists = list.findIndex(
    p => p.displayName.trim().toLowerCase() === player.displayName.trim().toLowerCase()
  );
  if (exists >= 0) return false;
  list.push({ ...player });
  return true;
}

function newImportDeduplicate(list) {
  const map = new Map();
  list.forEach(player => {
    const key = player.displayName.trim().toLowerCase();
    map.set(key, player); // keep latest
  });
  return Array.from(map.values());
}

// Shared gender lookup builder
function buildGenderLookup() {
  const lookup = { male: "Male", m: "Male", female: "Female", f: "Female" };
  if (typeof translations !== "undefined") {
    Object.values(translations).forEach(langObj => {
      if (langObj.male)   lookup[langObj.male.toLowerCase()]   = "Male";
      if (langObj.female) lookup[langObj.female.toLowerCase()] = "Female";
    });
  }
  return lookup;
}

// Parse raw textarea text into [{ displayName, gender }]
function parsePlayerLines(text, defaultGender) {
  const genderLookup = buildGenderLookup();
  const players = [];

  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line) continue;

    let gender = defaultGender;

    // Remove leading numbering: "1. John" → "John"
    const numMatch = line.match(/^(\d+\.?\s*)?(.*)$/);
    if (numMatch) line = numMatch[2].trim();

    // "name, gender" format
    if (line.includes(",")) {
      const [name, g] = line.split(",").map(p => p.trim());
      line = name;
      if (g && genderLookup[g.toLowerCase()]) gender = genderLookup[g.toLowerCase()];
    }

    // "name (gender)" format
    const parenMatch = line.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const inside = parenMatch[1].trim().toLowerCase();
      if (genderLookup[inside]) gender = genderLookup[inside];
      line = line.replace(/\([^)]+\)/, "").trim();
    }

    if (!line) continue;
    addToListIfNotExists(players, { displayName: line, gender });
  }

  return players;
}

/* =========================
   STATE
========================= */
const newImportState = {
  historyPlayers:     [],
  favoritePlayers:    [],
  selectedPlayers:    [],
  currentSelectMode:  "history",
  unavailablePlayers: new Set()
};

/* ── Availability helper — used by ALL card renderers ── */
function playerAvailDot(displayName) {
  const busy = (newImportState.unavailablePlayers || new Set())
    .has((displayName || "").trim().toLowerCase());
  return busy
    ? `<span class="avail-dot busy" title="Already playing in another session">🔴</span>`
    : `<span class="avail-dot free" title="Available">🟢</span>`;
}
function playerIsBusy(displayName) {
  return (newImportState.unavailablePlayers || new Set())
    .has((displayName || "").trim().toLowerCase());
}

let newImportModal;
let newImportSelectCards;
let newImportSelectedCards;
let newImportSelectedCount;
let newImportSearch;

/* =========================
   INIT
========================= */
document.addEventListener("DOMContentLoaded", () => {
  newImportModal         = document.getElementById("newImportModal");
  newImportSelectCards   = document.getElementById("newImportSelectCards");
  newImportSelectedCards = document.getElementById("newImportSelectedCards");
  newImportSelectedCount = document.getElementById("newImportSelectedCount");
  newImportSearch        = document.getElementById("newImportSearch");

  newImportLoadHistory();
  newImportLoadFavorites();
  newImportRefreshSelectCards();
  newImportRefreshSelectedCards();

  newImportSelectCards.addEventListener("click", newImportHandleCardClick);
  newImportSearch.addEventListener("input", newImportRefreshSelectCards);

  // Selected cards click handler
  newImportSelectedCards.addEventListener("click", newImportHandleSelectedCardClick);

  // Browse list click handler (delegated on parent since list is re-rendered)
  document.addEventListener("click", function(e) {
    const browseAction = e.target.dataset.browseAction;
    if (!browseAction) return;
    const browsePlayer = e.target.dataset.browsePlayer;
    if (!browsePlayer) return;
    newImportHandleBrowseCardClick(browseAction, browsePlayer);
  });
});

/* =========================
   MODAL OPEN / CLOSE
========================= */
function newImportShowModal() {
  newImportModal.style.display = "flex";
  syncPlayersFromMaster(); // ensure latest ratings before rendering
  newImportLoadHistory();
  newImportLoadFavorites();
  _newImportFilterToClub(); // filter both to current club (async, refreshes cards when done)
  newImportRefreshSelectCards();
  newImportRefreshSelectedCards();
  // Show Replace button only if players already in session
  var replaceBtn = document.getElementById('newImportReplaceBtn');
  if (replaceBtn) {
    var hasPlayers = typeof schedulerState !== 'undefined' &&
      schedulerState.allPlayers && schedulerState.allPlayers.length > 0;
    replaceBtn.style.display = hasPlayers ? '' : 'none';
  }
  // Load availability status in background — refresh cards when done
  if (typeof dbGetUnavailablePlayers === "function") {
    dbGetUnavailablePlayers().then(unavailable => {
      newImportState.unavailablePlayers = unavailable;
      newImportRefreshSelectCards();
    });
  }
}

function newImportHideModal() {
  newImportModal.style.display = "none";
  newImportState.selectedPlayers = [];
}

/* =========================
   TAB SWITCH
========================= */
function newImportShowSelectMode(mode) {
  newImportState.currentSelectMode = mode;

  document.querySelectorAll(".newImport-subtab-btn")
    .forEach(btn => btn.classList.remove("active"));

  document.getElementById(
    "newImport" + mode.charAt(0).toUpperCase() + mode.slice(1) + "Btn"
  )?.classList.add("active");

  const clearHistory   = document.getElementById("newImportClearHistoryBtn");
  const clearFavorites = document.getElementById("newImportClearFavoritesBtn");
  const listContainer  = document.getElementById("newImportSelectCards");
  const addSection     = document.getElementById("newImportAddPlayersSection");
  const searchInput    = document.getElementById("newImportSearch");

  // Always hide vault section (removed from import modal)
  const vaultSection = document.getElementById("newImportVaultSection");
  if (vaultSection) vaultSection.style.display = "none";

  if (mode === "addplayers") {
    listContainer.style.display  = "none";
    addSection.style.display     = "block";
    searchInput.style.display    = "none";
    clearHistory.style.display   = "none";
    clearFavorites.style.display = "none";
    const ta = document.getElementById("players-names");
    if (ta && typeof translations !== "undefined" && translations[currentLang]?.importExample) {
      ta.placeholder = translations[currentLang].importExample;
    }
    return;
  }

  // Leaving addplayers tab — reset star toggle state
  newImportResetFavToggle();

  listContainer.style.display = "flex";
  addSection.style.display    = "none";
  searchInput.style.display   = "block";

  if (mode === "history") {
    clearHistory.style.display   = "block";
    clearFavorites.style.display = "none";
  } else {
    clearHistory.style.display   = "none";
    clearFavorites.style.display = "block";
  }

  newImportRefreshSelectCards();
}

/* =========================
   VALID PLAYER NAME FILTER
   Strips junk from old paste-import leftovers
========================= */
function isValidPlayerName(name) {
  if (!name || typeof name !== "string") return false;
  const n = name.trim();
  if (n.length < 2)   return false;       // too short
  if (n.length > 40)  return false;       // too long (URLs, sentences)
  if (n.startsWith("*")) return false;    // schedule/annotation lines
  if (n.includes("http")) return false;   // URLs
  if (n.includes("www.")) return false;   // URLs
  if (n.includes(".com")) return false;   // URLs
  if (n.includes(".slotbooking")) return false;
  if (/^[\d\s\-:\/]+$/.test(n)) return false;  // pure numbers/dates/times
  return true;
}

/* =========================
   STORAGE — HISTORY
========================= */
function newImportLoadHistory() {
  const raw = JSON.parse(localStorage.getItem("newImportHistory") || "[]");
  newImportState.historyPlayers = raw.filter(p => p && p.displayName);
  // Filter to club members if logged in
  _newImportFilterToClub();
}

// Filter history and favourites to only players in the current club
async function _newImportFilterToClub() {
  const club = (typeof getMyClub === 'function') ? getMyClub() : { id: null };
  if (!club.id) return; // no club — show all history as-is

  try {
    const clubPlayers = await dbGetPlayers();
    if (!clubPlayers || !clubPlayers.length) return;
    const clubNames = new Set(clubPlayers.map(p => p.name.trim().toLowerCase()));

    // Filter history
    newImportState.historyPlayers = newImportState.historyPlayers.filter(
      p => clubNames.has((p.displayName || '').trim().toLowerCase())
    );

    // Filter favourites
    newImportState.favoritePlayers = newImportState.favoritePlayers.filter(
      p => clubNames.has((p.displayName || '').trim().toLowerCase())
    );

    newImportRefreshSelectCards();
  } catch(e) { /* silent — fall back to unfiltered */ }
}

/* =========================
   STORAGE — FAVORITES (individual players)
========================= */
function newImportLoadFavorites() {
  const data = localStorage.getItem("newImportFavorites");
  newImportState.favoritePlayers = data ? newImportDeduplicate(JSON.parse(data)) : [];
  localStorage.setItem("newImportFavorites", JSON.stringify(newImportState.favoritePlayers));
}

function newImportSaveFavorites() {
  localStorage.setItem("newImportFavorites", JSON.stringify(newImportState.favoritePlayers));
}

/* =========================
   STORAGE — FAVORITE SETS
========================= */
function newImportLoadFavoriteSets() {
  try { return JSON.parse(localStorage.getItem("newImportFavoriteSets") || "[]"); }
  catch { return []; }
}

function newImportSaveFavoriteSets(sets) {
  localStorage.setItem("newImportFavoriteSets", JSON.stringify(sets));
}

/* =========================
   RENDER — SELECT CARDS
========================= */
function newImportRefreshSelectCards() {
  if (newImportState.currentSelectMode === "addplayers") return;

  newImportSelectCards.innerHTML = "";

  // ── Favorite Sets (top of favorites tab only) ──
  if (newImportState.currentSelectMode === "favorites") {
    const sets = newImportLoadFavoriteSets();
    sets.forEach(set => {
      const safeName = set.name.replace(/'/g, "\\'");
      const setCard  = document.createElement("div");
      setCard.className    = "newImport-set-card";
      setCard.dataset.open = "false";

      setCard.innerHTML = `
        <div class="newImport-set-header">
          <div class="newImport-set-info">
            <span class="newImport-set-icon">★</span>
            <span class="newImport-set-name">${set.name}</span>
            <span class="newImport-set-count">${set.players.length} players</span>
            <span class="newImport-set-chevron">▶</span>
          </div>
          <div class="newImport-set-actions">
            <button class="newImport-set-addall-btn" data-setname="${safeName}">+ All</button>
            <button class="newImport-set-delete-btn" data-setname="${safeName}">×</button>
          </div>
        </div>
        <div class="newImport-set-players" style="display:none">
          ${set.players.map(p => {
            const busy = playerIsBusy(p.displayName);
            return `
            <div class="newImport-set-player-row${busy ? ' player-busy' : ''}">
              <img src="${p.gender === 'Male' ? 'male.png' : 'female.png'}"
                class="newImport-set-player-img"
                style="${busy ? 'opacity:0.4' : ''}; cursor:default">
              <span class="newImport-set-player-name" style="${busy ? 'opacity:0.5' : ''}">${p.displayName}</span>
              ${playerAvailDot(p.displayName)}
              <span class="rating-badge" style="font-size:0.68rem;padding:2px 5px;" data-player="${p.displayName}">${getActiveRating(p.displayName).toFixed(1)}</span>
              <button class="newImport-set-player-remove-btn"
                data-setname="${safeName}"
                data-name="${p.displayName.replace(/"/g, '&quot;')}">×</button>
              <button class="newImport-set-player-add-btn ${busy ? 'disabled-btn' : ''}"
                data-name="${p.displayName.replace(/"/g, '&quot;')}"
                data-gender="${p.gender}"
                ${busy ? "disabled title='Already playing in another session'" : ""}>+</button>
            </div>`;
          }).join("")}
          <div class="newImport-set-addplayer-row" style="position:relative">
            <input type="text"
              class="newImport-set-addplayer-input"
              data-setname="${safeName}"
              autocomplete="off"
              placeholder="Search to add player...">
            <div class="newImport-set-addplayer-dropdown" data-setname="${safeName}" style="display:none"></div>
          </div>
        </div>
      `;

      newImportSelectCards.appendChild(setCard);
    });
  }

  // ── Individual players (history / favorites) ──
  const source =
    newImportState.currentSelectMode === "favorites"
      ? [...newImportState.favoritePlayers]
      : [...newImportState.historyPlayers];

  source.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" })
  );

  const search = newImportSearch.value.toLowerCase();

  // Get unavailable players from cache (populated on modal open)
  const unavailable = newImportState.unavailablePlayers || new Set();

  source
    .filter(p => p.displayName.toLowerCase().includes(search))
    .forEach(p => {
      const nameNorm  = p.displayName.trim().toLowerCase();
      const added     = newImportState.selectedPlayers.some(sp => sp.displayName.trim().toLowerCase() === nameNorm);
      const fav       = newImportState.currentSelectMode === "favorites"
        ? true
        : newImportState.favoritePlayers.some(fp => fp.displayName.trim().toLowerCase() === nameNorm);
      const busy      = unavailable.has(nameNorm);
      // Grey out players already in the current session player list
      const inSession = typeof schedulerState !== 'undefined' && schedulerState.allPlayers &&
        schedulerState.allPlayers.some(sp => sp.name.trim().toLowerCase() === nameNorm);

      const card = document.createElement("div");
      card.className = "newImport-player-card" + (busy ? " player-busy" : "") + (added ? " player-added" : "") + (inSession ? " player-in-session" : "");
      const rating1 = getActiveRating(p.displayName).toFixed(1);
      const statusDot = busy
        ? `<span class="avail-dot busy" title="Already playing in another session">🔴</span>`
        : `<span class="avail-dot free" title="Available">🟢</span>`;

      card.innerHTML = `
        <div class="newImport-player-top">
          <img src="${p.gender === "Male" ? "male.png" : "female.png"}"
               style="${(busy || inSession) ? "opacity:0.4" : ""}; cursor:default">
          <div class="newImport-player-name" style="${(busy || inSession) ? "opacity:0.5" : ""}">${p.displayName}${inSession ? ' <span style="font-size:0.7rem;color:var(--muted);">✓ added</span>' : ''}</div>
          ${statusDot}
        </div>
        <div class="newImport-player-actions">
          <span class="rating-badge" data-player="${p.displayName}" style="${(busy || inSession) ? "opacity:0.4" : ""}">${rating1}</span>
          <button class="circle-btn favorite ${fav ? 'active-favorite' : ''}"
            data-action="favorite" data-player="${p.displayName}">
            ${fav ? "★" : "☆"}
          </button>
          <button class="circle-btn delete" data-action="delete" data-player="${p.displayName}">×</button>
          <button class="circle-btn add ${added ? 'active-added' : ''} ${(busy || inSession) ? 'disabled-btn' : ''}"
            data-action="${(busy || inSession) ? '' : 'add'}" data-player="${p.displayName}"
            ${(busy || inSession) ? "disabled title='Already in session'" : ""}>
            ${added ? "−" : "+"}
          </button>
        </div>
      `;
      newImportSelectCards.appendChild(card);
    });
}

/* =========================
   SET CARD CLICK HANDLER
   Handles expand, +All, ×delete, +player
   All via event delegation on newImportSelectCards
========================= */
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("newImportSelectCards");
  container?.addEventListener("click",   newImportHandleSetClick);
  container?.addEventListener("keydown", newImportHandleSetClick);
  container?.addEventListener("input",   newImportHandleSetClick);
});

function newImportHandleSetClick(e) {

  // ── Expand / collapse set ──
  const setInfo = e.target.closest(".newImport-set-info");
  if (setInfo) {
    const setCard  = setInfo.closest(".newImport-set-card");
    const players  = setCard.querySelector(".newImport-set-players");
    const chevron  = setCard.querySelector(".newImport-set-chevron");
    const isOpen   = setCard.dataset.open === "true";
    setCard.dataset.open    = isOpen ? "false" : "true";
    players.style.display   = isOpen ? "none" : "block";
    chevron.textContent     = isOpen ? "▶" : "▼";
    return;
  }

  // ── + All button ──
  if (e.target.matches(".newImport-set-addall-btn")) {
    const setName = e.target.dataset.setname;
    newImportLoadSetToSelected(setName);
    return;
  }

  // ── × Delete set ──
  if (e.target.matches(".newImport-set-delete-btn")) {
    const setName = e.target.dataset.setname;
    newImportDeleteFavoriteSet(setName);
    return;
  }

  // ── Gender toggle for set player ──
  if (e.target.matches(".newImport-set-player-img")) {
    const setName  = e.target.dataset.setname;
    const name     = e.target.dataset.name;
    const sets     = newImportLoadFavoriteSets();
    const set      = sets.find(s => s.name === setName);
    if (!set) return;
    const player   = set.players.find(p => p.displayName === name);
    if (!player) return;
    player.gender  = player.gender === "Male" ? "Female" : "Male";
    newImportSaveFavoriteSets(sets);
    // Update img src immediately without full refresh
    e.target.src           = player.gender === "Male" ? "male.png" : "female.png";
    e.target.dataset.gender = player.gender;
    return;
  }

  // ── + Add new player to set from inline input ──
  // ── Search dropdown for add-to-set input ──
  if (e.target.matches(".newImport-set-addplayer-input") && e.type === "input") {
    const input   = e.target;
    const setName = input.dataset.setname;
    const query   = input.value.trim().toLowerCase();
    const dropdown = input.closest(".newImport-set-addplayer-row")
                        ?.querySelector(".newImport-set-addplayer-dropdown");
    if (!dropdown) return;

    if (!query) { dropdown.style.display = "none"; dropdown.innerHTML = ""; return; }

    const sets = newImportLoadFavoriteSets();
    const set  = sets.find(s => s.name === setName);
    const registered = newImportState.historyPlayers || [];
    const alreadyIn  = new Set((set?.players || []).map(p => p.displayName.trim().toLowerCase()));

    const matches = registered.filter(p =>
      p.displayName.toLowerCase().includes(query) &&
      !alreadyIn.has(p.displayName.trim().toLowerCase())
    ).slice(0, 8);

    if (!matches.length) {
      dropdown.innerHTML = "<div class='set-add-dropdown-empty'>No registered players found</div>";
      dropdown.style.display = "block";
      return;
    }

    dropdown.innerHTML = matches.map(p => `
      <div class="set-add-dropdown-item"
           data-setname="${setName.replace(/"/g, '&quot;')}"
           data-name="${p.displayName.replace(/"/g, '&quot;')}"
           data-gender="${p.gender || 'Male'}">
        <img src="${p.gender === 'Female' ? 'female.png' : 'male.png'}" class="gender-icon" style="width:16px;height:16px">
        ${p.displayName}
      </div>
    `).join("");
    dropdown.style.display = "block";
    return;
  }

  // ── Select from dropdown ──
  if (e.target.closest(".set-add-dropdown-item")) {
    const item    = e.target.closest(".set-add-dropdown-item");
    const setName = item.dataset.setname;
    const name    = item.dataset.name;
    const gender  = item.dataset.gender;

    const sets = newImportLoadFavoriteSets();
    const set  = sets.find(s => s.name === setName);
    if (!set) return;

    if (!set.players.some(p => p.displayName.trim().toLowerCase() === name.trim().toLowerCase())) {
      set.players.push({ displayName: name, gender: gender || "Male" });
      newImportSaveFavoriteSets(sets);
    }

    // Clear input + close dropdown
    const row = item.closest(".newImport-set-addplayer-row");
    if (row) {
      const inp = row.querySelector(".newImport-set-addplayer-input");
      const dd  = row.querySelector(".newImport-set-addplayer-dropdown");
      if (inp) inp.value = "";
      if (dd)  { dd.style.display = "none"; dd.innerHTML = ""; }
    }
    newImportRefreshSelectCards();
    return;
  }

  // ── Click outside closes dropdown ──
  if (!e.target.closest(".newImport-set-addplayer-row")) {
    document.querySelectorAll(".newImport-set-addplayer-dropdown").forEach(dd => {
      dd.style.display = "none"; dd.innerHTML = "";
    });
  }

  // ── × Remove single player from set ──
  if (e.target.matches(".newImport-set-player-remove-btn")) {
    const setName     = e.target.dataset.setname;
    const displayName = e.target.dataset.name;
    const sets        = newImportLoadFavoriteSets();
    const set         = sets.find(s => s.name === setName);
    if (set) {
      set.players = set.players.filter(p => p.displayName !== displayName);
      newImportSaveFavoriteSets(sets);
      newImportRefreshSelectCards();
    }
    return;
  }

  // ── + Add single player from set ──
  if (e.target.matches(".newImport-set-player-add-btn")) {
    const displayName = e.target.dataset.name;
    const gender      = e.target.dataset.gender;
    addToListIfNotExists(newImportState.selectedPlayers, { displayName, gender });
    // Visual feedback
    e.target.textContent = "✓";
    e.target.disabled    = true;
    newImportRefreshSelectedCards();
    return;
  }
}

/* =========================
   CARD ACTIONS (history / favorites individual players)
========================= */
function newImportHandleCardClick(e) {
  const action = e.target.dataset.action;
  if (!action) return;

  const playerName = e.target.dataset.player;
  if (!playerName) return;

  const source =
    newImportState.currentSelectMode === "favorites"
      ? newImportState.favoritePlayers
      : newImportState.historyPlayers;

  const playerNameNorm = playerName.trim().toLowerCase();
  const player = source.find(p => p.displayName.trim().toLowerCase() === playerNameNorm);
  if (!player) return;

  // ADD / REMOVE SELECTED (toggle)
  if (action === "add") {
    const si = newImportState.selectedPlayers.findIndex(p => p.displayName.trim().toLowerCase() === playerNameNorm);
    if (si >= 0) {
      newImportState.selectedPlayers.splice(si, 1);
    } else {
      addToListIfNotExists(newImportState.selectedPlayers, player);
    }
    newImportRefreshSelectedCards();
    newImportRefreshSelectCards();
    return;
  }

  // TOGGLE GENDER — disabled, edits only in Vault Modify
  if (action === "gender") { return; }

  // TOGGLE FAVORITE
  if (action === "favorite") {
    const i = newImportState.favoritePlayers.findIndex(p => p.displayName.trim().toLowerCase() === player.displayName.trim().toLowerCase());
    if (i >= 0) {
      newImportState.favoritePlayers.splice(i, 1);
    } else {
      addToListIfNotExists(newImportState.favoritePlayers, player);
    }
    newImportSaveFavorites();
    newImportRefreshSelectCards();
    return;
  }

  // DELETE
  if (action === "delete") {
    const removeIndex = source.findIndex(p => p.displayName === playerName);
    if (removeIndex >= 0) source.splice(removeIndex, 1);
    if (newImportState.currentSelectMode === "history") {
      localStorage.setItem("newImportHistory", JSON.stringify(newImportState.historyPlayers));
    } else {
      localStorage.setItem("newImportFavorites", JSON.stringify(newImportState.favoritePlayers));
    }
    newImportRefreshSelectCards();
  }
}

function newImportHandleSelectedCardClick(e) {
  const action = e.target.dataset.action;
  if (!action) return;

  const playerName = e.target.dataset.player;

  // TOGGLE FAVORITE from selected list
  if (action === "favorite" && playerName) {
    const player = newImportState.selectedPlayers.find(p => p.displayName.trim().toLowerCase() === playerName.trim().toLowerCase());
    if (!player) return;
    const i = newImportState.favoritePlayers.findIndex(p => p.displayName.trim().toLowerCase() === playerName.trim().toLowerCase());
    if (i >= 0) newImportState.favoritePlayers.splice(i, 1);
    else addToListIfNotExists(newImportState.favoritePlayers, player);
    newImportSaveFavorites();
    newImportRefreshSelectedCards();
    newImportRefreshSelectCards();
    return;
  }

  // DELETE from selected (×) or REMOVE from selected (−)
  if ((action === "delete-selected" || action === "remove-selected")) {
    const idx = parseInt(e.target.dataset.index);
    if (!isNaN(idx)) {
      newImportState.selectedPlayers.splice(idx, 1);
      newImportRefreshSelectedCards();
      newImportRefreshSelectCards();
    }
    return;
  }
}

function newImportHandleBrowseCardClick(action, playerName) {
  const player = _browseAllPlayers.find(p =>
    (p.displayName || p.name || "").toLowerCase() === playerName.toLowerCase()
  );
  if (!player) return;
  const displayName = player.displayName || player.name || "";

  if (action === "add") {
    const si = newImportState.selectedPlayers.findIndex(p => (p.displayName || "").toLowerCase() === displayName.toLowerCase());
    if (si >= 0) newImportState.selectedPlayers.splice(si, 1);
    else addToListIfNotExists(newImportState.selectedPlayers, player);
    newImportRefreshSelectedCards();
    addPlayersBrowseFilter();
    return;
  }

  if (action === "favorite") {
    const i = newImportState.favoritePlayers.findIndex(p => p.displayName.trim().toLowerCase() === displayName.toLowerCase());
    if (i >= 0) newImportState.favoritePlayers.splice(i, 1);
    else addToListIfNotExists(newImportState.favoritePlayers, player);
    newImportSaveFavorites();
    addPlayersBrowseFilter();
    return;
  }

  if (action === "delete") {
    // Remove from browse list cache and re-render
    const bi = _browseAllPlayers.findIndex(p => (p.displayName || p.name || "").toLowerCase() === displayName.toLowerCase());
    if (bi >= 0) _browseAllPlayers.splice(bi, 1);
    addPlayersBrowseFilter();
    return;
  }
}

/* =========================
   SELECTED LIST
========================= */
function newImportRefreshSelectedCards() {
  newImportSelectedCards.innerHTML = "";
  newImportSelectedCount.textContent = newImportState.selectedPlayers.length;

  newImportState.selectedPlayers.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "newImport-player-card";
    const rating2 = getActiveRating(p.displayName).toFixed(1);
    const fav2 = newImportState.favoritePlayers.some(fp => fp.displayName.trim().toLowerCase() === p.displayName.trim().toLowerCase());
    const busy2 = playerIsBusy(p.displayName);
    card.innerHTML = `
      <div class="newImport-player-top">
        <img src="${p.gender === "Male" ? "male.png" : "female.png"}"
             style="${busy2 ? "opacity:0.4" : ""}; cursor:default">
        <div class="newImport-player-name" style="${busy2 ? "opacity:0.5" : ""}">${p.displayName}</div>
        ${playerAvailDot(p.displayName)}
      </div>
      <div class="newImport-player-actions">
        <span class="rating-badge" data-player="${p.displayName}">${rating2}</span>
        <button class="circle-btn favorite ${fav2 ? 'active-favorite' : ''}"
          data-action="favorite" data-player="${p.displayName}">
          ${fav2 ? "★" : "☆"}
        </button>
        <button class="circle-btn delete" data-action="delete-selected" data-index="${i}">×</button>
        <button class="circle-btn add active-added" data-action="remove-selected" data-index="${i}">−</button>
      </div>
    `;
    newImportSelectedCards.appendChild(card);
  });
}

function newImportRemoveSelected(i) {
  newImportState.selectedPlayers.splice(i, 1);
  newImportRefreshSelectedCards();
  newImportRefreshSelectCards();
}

function newImportClearSelected() {
  newImportState.selectedPlayers = [];
  newImportRefreshSelectedCards();
  newImportRefreshSelectCards();
}

/* =========================
   CLEAR LISTS
========================= */
function newImportClearHistory() {
  if (!confirm("Clear history?")) return;
  newImportState.historyPlayers = [];
  localStorage.setItem("newImportHistory", "[]");
  newImportRefreshSelectCards();
}

function newImportClearFavorites() {
  if (!confirm("Clear favorites?")) return;
  newImportState.favoritePlayers = [];
  localStorage.setItem("newImportFavorites", "[]");
  newImportRefreshSelectCards();
}

/* =========================
   FAVORITE SETS — SAVE INPUT TOGGLE
========================= */
function newImportResetFavToggle() {
  const row  = document.getElementById("newImportFavoriteSetRow");
  const icon = document.getElementById("addPlayerFavToggle");
  if (row)  row.style.display  = "none";
  if (icon) {
    icon.textContent = "☆";
    icon.style.color = "rgba(255,255,255,0.5)";
  }
  newImportState.addToFavOnAdd = false;
}

function newImportToggleAddFav() {
  const row  = document.getElementById("newImportFavoriteSetRow");
  const icon = document.getElementById("addPlayerFavToggle");
  if (!row || !icon) return;

  const isOpen = row.style.display !== "none";

  if (isOpen) {
    // Close — turn star off
    row.style.display            = "none";
    icon.textContent             = "☆";
    icon.style.color             = "rgba(255,255,255,0.5)";
    newImportState.addToFavOnAdd = false;
  } else {
    // Open — turn star on
    row.style.display            = "block";
    icon.textContent             = "★";
    icon.style.color             = "var(--amber)";
    newImportState.addToFavOnAdd = true;
    document.getElementById("newImportSetName")?.focus();
  }
}

function newImportSaveFavoriteSet() {
  const setNameInput = document.getElementById("newImportSetName");
  const setName      = setNameInput.value.trim();
  if (!setName) { setNameInput.focus(); return; }

  const textarea = document.getElementById("players-names");
  const text     = textarea?.value.trim();
  if (!text) { alert("No players in the text area"); return; }

  const defaultGender = document.getElementById("player-gender")?.value || "Male";
  const players = parsePlayerLines(text, defaultGender);
  if (!players.length) { alert("No valid player names found"); return; }

  const sets = newImportLoadFavoriteSets();
  const existingIdx = sets.findIndex(
    s => s.name.trim().toLowerCase() === setName.toLowerCase()
  );
  if (existingIdx >= 0) {
    // Same name exists — ask user to confirm overwrite or pick a new name
    const overwrite = confirm(`A set named "${sets[existingIdx].name}" already exists.\nOverwrite it?`);
    if (!overwrite) {
      setNameInput.focus();
      setNameInput.select();
      return;
    }
    sets[existingIdx].players = players;
  } else {
    sets.push({ name: setName, players });
  }
  newImportSaveFavoriteSets(sets);

  setNameInput.value = "";
  newImportResetFavToggle();
  newImportShowSelectMode("favorites");
}

function newImportDeleteFavoriteSet(setName) {
  if (!confirm(`Delete set "${setName}"?`)) return;
  const sets = newImportLoadFavoriteSets().filter(s => s.name !== setName);
  newImportSaveFavoriteSets(sets);
  newImportRefreshSelectCards();
}

function newImportLoadSetToSelected(setName) {
  const sets = newImportLoadFavoriteSets();
  const set  = sets.find(s => s.name === setName);
  if (!set) return;

  const registered = newImportState.historyPlayers || [];
  const registeredKeys = new Set(registered.map(p => p.displayName.trim().toLowerCase()));

  set.players.forEach(p => {
    const key = (p.displayName || p.name || "").trim().toLowerCase();
    if (registeredKeys.has(key)) {
      // Use the registered version (correct name/gender/rating from Supabase)
      const reg = registered.find(r => r.displayName.trim().toLowerCase() === key);
      addToListIfNotExists(newImportState.selectedPlayers, reg || p);
    }
    // Silently skip unregistered players from sets
  });

  newImportRefreshSelectedCards();
  newImportRefreshSelectCards();
}

/* =========================
   ADD PLAYER (from Add Players tab)
========================= */
function addPlayer() {
  const textarea = document.getElementById("players-names");
  if (!textarea) return;
  const text = textarea.value.trim();
  if (!text) return;

  const defaultGender    = document.getElementById("player-gender")?.value || "Male";
  const extractedPlayers = parsePlayerLines(text, defaultGender);
  if (!extractedPlayers.length) return;

  // Check local history first
  const registered    = newImportState.historyPlayers || [];
  const registeredMap = new Map(registered.map(p => [p.displayName.trim().toLowerCase(), p]));

  const foundLocally  = [];
  const notFoundNames = []; // names not in local history

  extractedPlayers.forEach(player => {
    const key = player.displayName.trim().toLowerCase();
    const reg = registeredMap.get(key);
    if (reg) {
      foundLocally.push(reg);
    } else {
      notFoundNames.push(player);
    }
  });

  // For names not in local history, check global players cache
  // Cache is synced on app load and after every round
  // A player can't be deleted — if they exist anywhere they're valid
  let fromSupabase = [];
  if (notFoundNames.length) {
    const cached = typeof getGlobalPlayersCache === "function" ? getGlobalPlayersCache() : [];
    const globalMap = new Map(cached.map(p => [p.displayName.trim().toLowerCase(), p]));
    notFoundNames.forEach(player => {
      const key = player.displayName.trim().toLowerCase();
      const found = globalMap.get(key);
      if (found) fromSupabase.push(found);
    });
  }

  // Combine local + supabase found players
  const allFound = [...foundLocally, ...fromSupabase];
  const skipped  = notFoundNames
    .filter(p => !fromSupabase.some(s => s.displayName.trim().toLowerCase() === p.displayName.trim().toLowerCase()))
    .map(p => p.displayName);

  allFound.forEach(reg => {
    addToListIfNotExists(newImportState.selectedPlayers, reg);
    if (newImportState.addToFavOnAdd) {
      addToListIfNotExists(newImportState.favoritePlayers, reg);
    }
  });

  if (newImportState.addToFavOnAdd) {
    newImportSaveFavorites();
  }

  newImportRefreshSelectedCards();
  newImportRefreshSelectCards();

  textarea.value        = "";
  textarea.style.height = "";
  textarea.focus();

  // Clear any previous feedback
  const feedback = document.getElementById("addPlayerFeedback");
  if (feedback) feedback.style.display = "none";

  // Show feedback only for truly unregistered players
  if (skipped.length) {
    if (feedback) {
      window._lastSkippedPlayers = skipped;
      feedback.innerHTML = `
        <span>⚠️ Not registered: <strong>${skipped.join(", ")}</strong></span>
        <button class="add-player-register-btn" onclick="addPlayerSendToRegister(window._lastSkippedPlayers)">
          Register them →
        </button>
      `;
      feedback.style.display = "flex";
      feedback.style.alignItems = "center";
      feedback.style.gap = "8px";
      feedback.style.flexWrap = "wrap";
    }
  }
}

/* =========================
   SEND SKIPPED TO REGISTER TAB
========================= */
function addPlayerSendToRegister(names) {
  // Hide feedback
  const feedback = document.getElementById("addPlayerFeedback");
  if (feedback) feedback.style.display = "none";

  // Check if admin mode
  if (typeof isAdminMode === "function" && !isAdminMode()) {
    alert("Admin mode required to register players. Please join your club as admin in Settings.");
    return;
  }

  // Force-show Register tab button before switching (it may be hidden)
  // (Vault tab removed from import modal — register now handled via Vault page)

  // Switch to addplayers tab as fallback
  const addBtn = document.getElementById("newImportAddplayersBtn");
  if (addBtn) addBtn.style.display = "inline-block";
  document.querySelectorAll(".newImport-subtab-btn").forEach(b => b.classList.remove("active"));
  if (addBtn) addBtn.classList.add("active");
  newImportState.currentSelectMode = "addplayers";
  ["newImportSelectCards","newImportAddPlayersSection","newImportSearch",
   "newImportClearHistoryBtn","newImportClearFavoritesBtn"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  // Render register tab UI keeping existing staging
  newImportRenderRegister(true);

  // Pre-fill staging list with skipped names
  names.forEach(name => {
    if (!_regStagingList.find(s => s.name.toLowerCase() === name.toLowerCase())) {
      _regStagingList.push({
        id:     Date.now() + Math.random(),
        name:   name.trim(),
        gender: "Male",
        rating: 1.0,
        status: "pending"
      });
    }
  });

  regRenderStaging();
}

/* =========================
   FINAL IMPORT — OK button
========================= */
function newImportAddPlayers() {
  if (!newImportState.selectedPlayers.length) { alert("No players selected"); return; }
  addPlayersFromInputUI();
}

/* =============================================================
   REGISTER TAB — Supabase DB player registration
   Added: step82
============================================================= */

// ── Staging list for bulk registration ───────────────────────
let _regStagingList = []; // [{ id, name, gender, rating }]

function newImportRenderRegister(keepStaging = false) {
  const listContainer = document.getElementById("newImportSelectCards");
  const club = (typeof getMyClub === "function") ? getMyClub() : { name: null };

  listContainer.style.display = "block";
  if (!keepStaging) _regStagingList = [];

  listContainer.innerHTML = `
    <div class="register-form">
      <div class="register-club-label">
        ${club.name
          ? `🏸 Registering for: <strong>${club.name}</strong>`
          : `⚠️ No club selected. Go to Settings → Club Admin first.`}
      </div>
      ${club.name ? `
      <div class="register-field">
        <label class="register-label">Paste names (one per line)</label>
        <textarea id="regNamesArea"
                  class="register-textarea"
                  rows="4"
                  placeholder="Raja&#10;Kari, Female&#10;Venkat"></textarea>
      </div>
      <div class="register-gender-row" style="margin-bottom:10px">
        <span class="register-label" style="margin:0 8px 0 0">Default gender:</span>
        <button id="regDefaultMale"   class="register-gender-img-btn active"
                onclick="regSetDefaultGender('Male')">
          <img src="male.png" class="reg-gender-img"><span>Male</span>
        </button>
        <button id="regDefaultFemale" class="register-gender-img-btn"
                onclick="regSetDefaultGender('Female')">
          <img src="female.png" class="reg-gender-img"><span>Female</span>
        </button>
      </div>
      <button class="register-add-btn" onclick="regAddToStaging()">Add to List</button>
      <div id="regStagingContainer" class="reg-staging-container"></div>
      <div id="registerFeedback" class="register-feedback"></div>
      <button class="register-save-btn" id="regRegisterAllBtn"
              onclick="regRegisterAll()" style="display:none">
        ✅ Register All
      </button>
      ` : ""}
    </div>
  `;
  window._regDefaultGender = "Male";
}

function regSetDefaultGender(gender) {
  window._regDefaultGender = gender;
  document.getElementById("regDefaultMale")  ?.classList.toggle("active", gender === "Male");
  document.getElementById("regDefaultFemale")?.classList.toggle("active", gender === "Female");
}

function regAddToStaging() {
  const area = document.getElementById("regNamesArea");
  if (!area || !area.value.trim()) return;

  const parsed = parsePlayerLines(area.value, window._regDefaultGender || "Male");
  if (!parsed.length) return;

  parsed.forEach(p => {
    // Avoid staging duplicates by name
    if (!_regStagingList.find(s => s.name.toLowerCase() === p.displayName.toLowerCase())) {
      _regStagingList.push({
        id:     Date.now() + Math.random(),
        name:   p.displayName,
        gender: p.gender,
        rating: 1.0,
        status: "pending" // pending | success | duplicate | error
      });
    }
  });

  area.value = "";
  regRenderStaging();
}

function regRenderStaging() {
  const container = document.getElementById("regStagingContainer");
  const registerBtn = document.getElementById("regRegisterAllBtn");
  const feedback = document.getElementById("registerFeedback");
  if (!container) return;

  if (_regStagingList.length === 0) {
    container.innerHTML = "";
    if (registerBtn) registerBtn.style.display = "none";
    return;
  }

  if (registerBtn) registerBtn.style.display = "block";
  if (feedback) feedback.textContent = "";

  // Use newImport-cards-container layout same as favorites tab
  container.className = "newImport-cards-container reg-staging-container";
  container.innerHTML = _regStagingList.map((p, i) => {
    const done      = p.status === "success";
    const statusBadge =
      p.status === "success"   ? `<span class="reg-status-badge reg-ok">✅</span>` :
      p.status === "duplicate" ? `<span class="reg-status-badge reg-dup">⚠️ Duplicate</span>` :
      p.status === "error"     ? `<span class="reg-status-badge reg-err">❌ Error</span>` : "";

    const cardClass = done ? "newImport-player-card reg-card-done" : "newImport-player-card";
    const genderImg = p.gender === "Female" ? "female.png" : "male.png";
    const busyNote  = (!done && playerIsBusy(p.name))
      ? `<span class="avail-dot busy" title="Currently playing in another session">🔴</span>`
      : "";

    return `
      <div class="${cardClass}" id="regCard-${i}">
        <div class="newImport-player-top">
          <img src="${genderImg}"
               ${!done ? `onclick="regToggleGender(${i})" title="Tap to toggle gender" style="cursor:pointer"` : ""}
               >
          <div class="newImport-player-name">
            ${done
              ? `<span>${p.name}</span>`
              : `<input class="reg-name-inline" type="text"
                        value="${p.name}"
                        onchange="regUpdateName(${i}, this.value)">`
            }
          </div>
          ${busyNote}
        </div>
        <div class="newImport-player-actions">
          <input class="reg-rating-badge-input" type="number"
                 value="${p.rating}" min="1.0" max="5.0" step="0.1"
                 title="Starting rating"
                 onchange="regUpdateRating(${i}, this.value)"
                 ${done ? "disabled" : ""}>
          ${statusBadge}
          ${!done
            ? `<button class="circle-btn delete" onclick="regDeleteStaging(${i})" title="Remove">×</button>`
            : ""}
        </div>
      </div>`;
  }).join("");
}

function regToggleGender(i) {
  if (!_regStagingList[i]) return;
  _regStagingList[i].gender = _regStagingList[i].gender === "Male" ? "Female" : "Male";
  regRenderStaging();
}

function regUpdateName(i, val) {
  if (!_regStagingList[i]) return;
  _regStagingList[i].name = val.trim();
}

function regUpdateRating(i, val) {
  if (!_regStagingList[i]) return;
  const r = parseFloat(val);
  _regStagingList[i].rating = isNaN(r) ? 0 : Math.min(5, Math.max(0, r));
}

function regDeleteStaging(i) {
  _regStagingList.splice(i, 1);
  regRenderStaging();
}

async function regRegisterAll() {
  const club = (typeof getMyClub === "function") ? getMyClub() : { id: null };
  const feedback = document.getElementById("registerFeedback");
  const btn = document.getElementById("regRegisterAllBtn");
  if (!club.id) {
    if (feedback) { feedback.textContent = "⚠️ No club selected."; feedback.className = "register-feedback error"; }
    return;
  }

  if (typeof isAdminMode === "function" && !isAdminMode()) {
    if (feedback) { feedback.textContent = "⚠️ Admin mode required."; feedback.className = "register-feedback error"; }
    return;
  }

  // Use a placeholder — actual auth done at club join time
  const adminPassword = "__session_admin__";

  const pending = _regStagingList.filter(p => p.status === "pending" || p.status === "error" || p.status === "duplicate");
  if (!pending.length) return;

  btn.disabled = true;
  if (feedback) { feedback.textContent = "Registering..."; feedback.className = "register-feedback"; }

  let successCount = 0;
  let failCount    = 0;

  for (let i = 0; i < _regStagingList.length; i++) {
    const p = _regStagingList[i];
    if (p.status === "success") continue;

    try {
      const newPlayer = await dbAddPlayer(p.name, p.gender, adminPassword);
      if (p.rating > 0) {
        await dbOverrideRating(newPlayer.id, p.rating);
      }
      _regStagingList[i].status = "success";
      successCount++;
    } catch (e) {
      const msg = e.message || "";
      _regStagingList[i].status = msg.includes("already exists") ? "duplicate" : "error";
      failCount++;
    }

    // Re-render after each to show live progress
    regRenderStaging();
  }

  btn.disabled = false;

  // Summary feedback
  const parts = [];
  if (successCount) parts.push(`✅ ${successCount} registered`);
  if (failCount)    parts.push(`⚠️ ${failCount} skipped`);
  if (feedback) {
    feedback.textContent = parts.join("  ");
    feedback.className = failCount ? "register-feedback error" : "register-feedback success";
  }

  // Silently add successfully registered players to selected list
  if (successCount) {
    _regStagingList
      .filter(p => p.status === "success")
      .forEach(p => addToListIfNotExists(newImportState.selectedPlayers, { displayName: p.name, gender: p.gender, rating: p.rating || 1.0 }));
    newImportRefreshSelectedCards();
  }
}

/* =============================================================
   ADD PLAYERS — BROWSE TAB
============================================================= */

let _browseAllPlayers = []; // cached list for current scope

function addPlayersShowTab(tab) {
  const typeBtn    = document.getElementById("addPlayersTypeBtn");
  const browseBtn  = document.getElementById("addPlayersBrowseBtn");
  const typePanel  = document.getElementById("addPlayersTypePanel");
  const browsePanel = document.getElementById("addPlayersBrowsePanel");
  if (!typePanel || !browsePanel) return;

  if (tab === "browse") {
    typeBtn?.classList.remove("active");
    browseBtn?.classList.add("active");
    typePanel.style.display   = "none";
    browsePanel.style.display = "block";
    addPlayersBrowseLoad();
  } else {
    browseBtn?.classList.remove("active");
    typeBtn?.classList.add("active");
    browsePanel.style.display = "none";
    typePanel.style.display   = "block";
  }
}

async function addPlayersBrowseLoad() {
  const scope     = document.getElementById("addPlayersBrowseScope")?.value || "club";
  const listEl    = document.getElementById("addPlayersBrowseList");
  if (!listEl) return;

  listEl.innerHTML = "<div style='padding:10px;color:var(--muted)'>Loading...</div>";

  try {
    let players = [];
    if (scope === "club") {
      // Fetch club members directly from DB — always fresh to avoid stale cache
      const clubPlayers = await dbGetPlayers(true);
      players = (clubPlayers || []).map(p => ({
        displayName: p.name,
        gender:      p.gender || "Male",
        rating:      parseFloat(p.rating) || 1.0
      }));
    } else {
      // Fetch ALL players globally (bypass club filter)
      const raw = await sbGet("players", "order=name.asc");
      players = raw.map(p => ({
        displayName: p.name,
        gender:      p.gender || "Male",
        rating:      parseFloat(p.rating) || 1.0
      }));
    }
    _browseAllPlayers = players;
    // Refresh availability before rendering
    if (typeof dbGetUnavailablePlayers === "function") {
      dbGetUnavailablePlayers().then(unavailable => {
        newImportState.unavailablePlayers = unavailable;
        addPlayersBrowseRender(_browseAllPlayers);
      });
    } else {
      addPlayersBrowseRender(_browseAllPlayers);
    }
  } catch (e) {
    listEl.innerHTML = "<div style='padding:10px;color:red'>Failed to load players.</div>";
  }
}

function addPlayersBrowseFilter() {
  const q = (document.getElementById("addPlayersBrowseSearch")?.value || "").toLowerCase();
  const filtered = _browseAllPlayers.filter(p =>
    (p.displayName || p.name || "").toLowerCase().includes(q)
  );
  addPlayersBrowseRender(filtered);
}

function addPlayersBrowseRender(players) {
  const listEl = document.getElementById("addPlayersBrowseList");
  if (!listEl) return;

  if (!players.length) {
    listEl.innerHTML = "<div style='padding:10px;color:var(--muted)'>No players found.</div>";
    return;
  }

  const selectedNames = new Set(
    (newImportState.selectedPlayers || []).map(p => (p.displayName || p.name || "").toLowerCase())
  );

  listEl.className = "newImport-cards-container";
  listEl.innerHTML = players.map(p => {
    const name       = p.displayName || p.name || "";
    const gender     = p.gender || "Male";
    const genderImg  = gender === "Female" ? "female.png" : "male.png";
    const isSelected = selectedNames.has(name.toLowerCase());
    const fav        = (newImportState.favoritePlayers || []).some(fp => fp.displayName.trim().toLowerCase() === name.toLowerCase());
    const rating     = getActiveRating(name).toFixed(1);
    const nameSafe   = name.replace(/'/g, "\\'");
    const busy       = playerIsBusy(name);
    return `
      <div class="newImport-player-card${busy ? ' player-busy' : ''}${isSelected ? ' player-added' : ''}">
        <div class="newImport-player-top">
          <img src="${genderImg}" data-browse-action="${busy ? '' : 'gender'}" data-browse-player="${nameSafe}"
               style="${busy ? 'opacity:0.4' : ''}">
          <div class="newImport-player-name" style="${busy ? 'opacity:0.5' : ''}">${name}</div>
          ${playerAvailDot(name)}
        </div>
        <div class="newImport-player-actions">
          <span class="rating-badge">${rating}</span>
          <button class="circle-btn favorite ${fav ? 'active-favorite' : ''}"
            data-browse-action="favorite" data-browse-player="${nameSafe}">
            ${fav ? "★" : "☆"}
          </button>
          <button class="circle-btn add ${isSelected ? 'active-added' : ''} ${busy ? 'disabled-btn' : ''}"
            data-browse-action="${busy ? '' : 'add'}" data-browse-player="${nameSafe}"
            ${busy ? "disabled title='Already playing in another session'" : ""}>
            ${isSelected ? "−" : "+"}
          </button>
        </div>
      </div>`;
  }).join("");
}

function addPlayersBrowseToggle(name) {
  const player = _browseAllPlayers.find(p =>
    (p.displayName || p.name || "").toLowerCase() === name.toLowerCase()
  );
  if (!player) return;

  const displayName = player.displayName || player.name || "";
  const idx = newImportState.selectedPlayers.findIndex(
    p => (p.displayName || p.name || "").toLowerCase() === displayName.toLowerCase()
  );

  if (idx >= 0) {
    // Remove from selected
    newImportState.selectedPlayers.splice(idx, 1);
  } else {
    // Add to selected
    addToListIfNotExists(newImportState.selectedPlayers, player);
  }

  newImportRefreshSelectedCards();
  // Re-render browse list to update +/- buttons
  addPlayersBrowseFilter();
}
