/* ============================================================
   HOME — Theme, font size, language, reset actions
   File: home.js
   ============================================================ */

let pendingAction = null;

function t(key) {
  return translations[currentLang]?.[key] || key;
}

function showConfirm(messageKey, action) {
  const overlay = document.getElementById("confirmOverlay");
  const title   = document.getElementById("confirmTitle");
  const yesBtn  = document.getElementById("confirmYes");
  const cancelBtn = document.getElementById("confirmCancel");

  title.textContent = t(messageKey);
  yesBtn.textContent = t("yes");
  cancelBtn.textContent = t("cancel");

  pendingAction = action;
  overlay.classList.remove("hidden");

  // ✅ YES button
  yesBtn.onclick = () => {
    pendingAction && pendingAction();
    closeConfirm();
  };

  // ✅ CANCEL button (THIS enables it)
  cancelBtn.onclick = closeConfirm;
}

function closeConfirm() {
  document.getElementById("confirmOverlay").classList.add("hidden");
  pendingAction = null;
}


let currentLang = "en";

/* Language picker in Settings */
function settingsToggleLangPicker() {
  const picker = document.getElementById('settingsLangPicker');
  if (picker) picker.style.display = picker.style.display === 'none' ? '' : 'none';
}

function settingsSelectLang(lang, flag, name) {
  const val = document.getElementById('settingsLangValue');
  if (val) val.textContent = flag + ' ' + name;
  const picker = document.getElementById('settingsLangPicker');
  if (picker) picker.style.display = 'none';
  setLanguage(lang);
}

/* Keep toggleLangMenu as no-op for any remaining refs */
function toggleLangMenu() {}
function _closeLangMenu() {}



const langFlagMap = {
  en: "🇺🇸",
  jp: "🇯🇵",
  zh: "🇨🇳",
  kr: "🇰🇷",
  vi: "🇻🇳"
  
};
/* ===== Theme ===== */

function initLanguage() {
  const savedLang = localStorage.getItem("appLanguage");
  const supportedLangs = ["en", "jp", "kr", "vi", "zh"];
  const langNames = { en: "English", jp: "日本語", kr: "한국어", zh: "中文", vi: "Tiếng Việt" };

  const lang = supportedLangs.includes(savedLang) ? savedLang : (() => {
    const b = navigator.language.toLowerCase();
    if (b.startsWith("ja")) return "jp";
    if (b.startsWith("ko")) return "kr";
    if (b.startsWith("vi")) return "vi";
    if (b.startsWith("zh")) return "zh";
    return "en";
  })();

  // Update settings label
  const flag = langFlagMap[lang] || "🌐";
  const val = document.getElementById("settingsLangValue");
  if (val) val.textContent = flag + " " + (langNames[lang] || lang);

  setLanguage(lang);
}

function initTheme() {
  const saved = localStorage.getItem('app-theme');
  if (saved) {
    applyTheme(saved);
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
}

function initFontSize() {
  const savedSize = localStorage.getItem("appFontSize") || "medium";
  setFontSize(savedSize);
}


function applyTheme(mode) {
  document.body.classList.toggle('app-light', mode === 'light');
  document.body.classList.toggle('app-dark',  mode === 'dark');
  document.getElementById('theme_light')?.classList.toggle('active', mode === 'light');
  document.getElementById('theme_dark')?.classList.toggle('active',  mode === 'dark');
  localStorage.setItem('app-theme', mode);
}

function setTheme(mode) {
  applyTheme(mode);
}

/* ===== Init ===== */
initTheme();



document.addEventListener("DOMContentLoaded", () => {
  initTheme();     // restore theme
  initFontSize();  // restore font size
  initLanguage();  // restore language
});



function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("appLanguage", lang);

  document.querySelectorAll("[id^='lang_']").forEach(btn => {
    btn.classList.remove("active");
  });
  document.getElementById("lang_" + lang)?.classList.add("active");

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = translations[lang][key] || key;
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    el.placeholder = translations[lang][key] || "";
  });
  
   loadHelp(currentHelpSection);
}

function updateRoundTitle(round) {
  const roundTitle = document.getElementById("roundTitle");
  if (!roundTitle) return;

  roundTitle.innerText = `${translations[currentLang].nround} ${round}`;
}

function setFontSize(size) {
  const root = document.documentElement;

  if (size === "small") root.style.setProperty("--base-font-size", "14px");
  if (size === "medium") root.style.setProperty("--base-font-size", "16px");
  if (size === "large") root.style.setProperty("--base-font-size", "19px");

  localStorage.setItem("appFontSize", size); // 👈 SAVE (ADD THIS)

  document.querySelectorAll("#font_small, #font_medium, #font_large").forEach(el => {
    el.classList.remove("active");
  });

  document.getElementById(`font_${size}`)?.classList.add("active");
}


function ResetAll() {
  location.reload(); // This refreshes the entire app clean
  document.getElementById("reset_all").classList.remove("active");
}


function resetRounds() {
  // 1️⃣ Clear all previous rounds
  allRounds.length = 0;
  initScheduler(1);  
  clearPreviousRound();
  goToRounds();
  report(); 
  sessionFinished = false;
  document.getElementById("nextBtn").disabled = false;
  // Shuffle state managed by _syncShuffleBtn
  if (typeof _syncShuffleBtn   === 'function') _syncShuffleBtn();
  if (typeof _syncModeBanner   === 'function') _syncModeBanner();

  // Optional: also disable End to prevent double-click
  //document.getElementById("endBtn").disabled = false;
	
  const btn = document.getElementById("reset_rounds_btn");
  if (btn) {
    btn.classList.remove("active");
  }
}

/* =========================
   PLAYER MANAGEMENT (Settings Tab)
========================= */
const ADMIN_DEFAULT_PASSWORD = "1234";
let adminModalMode = "unlock"; // "unlock" | "changepwd"

function adminGetPassword() {
  return localStorage.getItem("adminPassword") || ADMIN_DEFAULT_PASSWORD;
}

// ── Unlock flow ──
// playerMgmtUnlock/Lock no longer needed — Players tab handles this directly

// ── Change password flow ──
function playerMgmtChangePwd() {
  adminModalMode = "changepwd";
  document.getElementById("adminModalTitle").textContent = "🔑 Change Password";
  document.getElementById("adminPasswordConfirmRow").style.display = "block";
  document.getElementById("adminModalError").textContent = "";
  document.getElementById("adminPasswordInput").value = "";
  document.getElementById("adminPasswordConfirm").value = "";
  document.getElementById("adminModal").style.display = "flex";
  setTimeout(() => document.getElementById("adminPasswordInput").focus(), 100);
}

function adminCloseModal() {
  document.getElementById("adminModal").style.display = "none";
}

function adminVerifyPassword() {
  const input = document.getElementById("adminPasswordInput").value;
  const err   = document.getElementById("adminModalError");

  if (adminModalMode === "unlock") {
    if (input === adminGetPassword()) {
      adminCloseModal();
      document.getElementById("playerMgmtLocked").style.display = "none";
      document.getElementById("playerMgmtUnlocked").style.display = "block";
      playerMgmtRenderList();
    } else {
      err.textContent = "Wrong password. Try again.";
      document.getElementById("adminPasswordInput").value = "";
    }

  } else if (adminModalMode === "changepwd") {
    const confirm = document.getElementById("adminPasswordConfirm").value;
    if (input.length < 4) {
      err.textContent = "Password must be at least 4 characters."; return;
    }
    if (input !== confirm) {
      err.textContent = "Passwords do not match."; return;
    }
    localStorage.setItem("adminPassword", input);
    adminCloseModal();
    alert("Password changed successfully.");
  }
}

// ── Player subtabs: All / Playing ──
function playerSubtabShow(tab) {
  document.getElementById('playerSubtabAll').style.display     = tab === 'all'     ? '' : 'none';
  document.getElementById('playerSubtabPlaying').style.display = tab === 'playing' ? '' : 'none';
  document.getElementById('playerSubtabAllBtn').classList.toggle('active',     tab === 'all');
  document.getElementById('playerSubtabPlayingBtn').classList.toggle('active', tab === 'playing');
  if (tab === 'all')     playerMgmtRenderList();
  if (tab === 'playing') playerPlayingRenderList();
}

async function playerPlayingRenderList() {
  const container = document.getElementById('playerPlayingList');
  container.innerHTML = '<p style="color:#aaa;font-size:0.85rem">Loading...</p>';
  const admin = isAdminMode();

  try {
    const club = (typeof getMyClub === 'function') ? getMyClub() : { id: null };

    let rows;
    if (club.id) {
      // Get only players belonging to this club
      const members = await sbGet('club_members', `club_id=eq.${club.id}&select=player_id`);
      if (!members || !members.length) {
        container.innerHTML = '<p class="player-mgmt-empty">No players currently locked.</p>';
        return;
      }
      const idList = '(' + members.map(m => m.player_id).join(',') + ')';
      rows = await sbGet('players',
        `id=in.${idList}&is_playing=eq.true&select=name,gender,session_id,session_started_at&order=name.asc`
      );
    } else {
      // No club logged in — show nothing
      container.innerHTML = '<p class="player-mgmt-empty">Join a club to view playing players.</p>';
      return;
    }

    if (!rows || !rows.length) {
      container.innerHTML = '<p class="player-mgmt-empty">No players currently locked.</p>';
      return;
    }

    container.innerHTML = '';

    // Release All button — admin only
    if (admin) {
      const bar = document.createElement('div');
      bar.style.cssText = 'padding:8px 0 12px;';
      const releaseAllBtn = document.createElement('button');
      releaseAllBtn.className = 'player-mgmt-add-btn';
      releaseAllBtn.style.background = '#e63757';
      releaseAllBtn.textContent = '🔓 Release All (' + rows.length + ')';
      releaseAllBtn.onclick = playerPlayingReleaseAll;
      bar.appendChild(releaseAllBtn);
      container.appendChild(bar);
    }

    rows.forEach(function(p) {
      const row = document.createElement('div');
      row.className = 'player-mgmt-row';
      const started = p.session_started_at
        ? new Date(p.session_started_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
        : '—';

      const img = document.createElement('img');
      img.src = p.gender === 'Female' ? 'female.png' : 'male.png';
      img.className = 'player-mgmt-avatar';
      img.style.cursor = 'default';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'player-mgmt-name';
      nameSpan.textContent = p.name;

      const timeSpan = document.createElement('span');
      timeSpan.style.cssText = 'font-size:0.75rem;color:var(--muted);margin-right:8px';
      timeSpan.textContent = 'since ' + started;

      row.appendChild(img);
      row.appendChild(nameSpan);
      row.appendChild(timeSpan);

      if (admin) {
        const btn = document.createElement('button');
        btn.className = 'player-mgmt-del-btn';
        btn.style.cssText = 'background:#e63757;color:#fff;border:none;border-radius:20px;padding:4px 10px;font-size:0.8rem';
        btn.textContent = '🔓';
        btn.onclick = function() { playerPlayingRelease(p.name); };
        row.appendChild(btn);
      }

      container.appendChild(row);
    });

  } catch(e) {
    container.innerHTML = '<p class="player-mgmt-empty">Failed to load. Check connection.</p>';
    console.error('playerPlayingRenderList error:', e);
  }
}

async function playerPlayingRelease(name) {
  if (!confirm('Release "' + name + '" from active session?')) return;
  try {
    await sbPatch('players', 'name=ilike.' + encodeURIComponent(name), {
      is_playing: false, session_id: null, session_started_at: null
    });
    playerPlayingRenderList();
  } catch(e) { alert('Failed to release: ' + e.message); }
}

async function playerPlayingReleaseAll() {
  if (!confirm('Release ALL locked players?')) return;
  try {
    const club = (typeof getMyClub === 'function') ? getMyClub() : { id: null };
    if (!club.id) { alert('No club logged in.'); return; }
    const members = await sbGet('club_members', `club_id=eq.${club.id}&select=player_id`);
    if (!members || !members.length) return;
    const idList = '(' + members.map(m => m.player_id).join(',') + ')';
    await sbPatch('players', `id=in.${idList}&is_playing=eq.true`, {
      is_playing: false, session_id: null, session_started_at: null
    });
    playerPlayingRenderList();
  } catch(e) { alert('Failed: ' + e.message); }
}

// ── Render master player list ──
async function playerMgmtRenderList() {
  const container = document.getElementById("playerMgmtList");
  container.innerHTML = "<p style='color:#aaa;font-size:0.85rem'>Loading...</p>";

  // Always use syncToLocal as single source of truth — never fetch directly
  if (!newImportState.historyPlayers || !newImportState.historyPlayers.length) {
    await syncToLocal();
  }
  let players = newImportState.historyPlayers || [];

  container.innerHTML = "";

  if (players.length === 0) {
    container.innerHTML = '<p class="player-mgmt-empty">No players in database yet.</p>';
    return;
  }

  const sorted = [...players].sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

  // Toolbar hidden — all edits are in the Players tab
  const toolbar = document.getElementById("playerMgmtToolbar");
  if (toolbar) toolbar.style.display = "none";

  sorted.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "player-mgmt-row";
    const safeName = p.displayName.replace(/'/g, "\'");
    const rating = (typeof getActiveRating === "function" ? getActiveRating(p.displayName) : getRating(p.displayName)).toFixed(1);
    // Settings is read-only — all edits happen in the Players tab
    row.innerHTML = `
      <img src="${p.gender === 'Female' ? 'female.png' : 'male.png'}"
           class="player-mgmt-avatar" style="cursor:default">
      <span class="player-mgmt-name player-mgmt-name-link" onclick="showPlayerStats('${safeName}')">${p.displayName}</span>
      <span class="rating-badge" style="font-size:0.8rem;padding:2px 7px">${rating}</span>
    `;
    container.appendChild(row);
  });
}

// ── Save rating to master DB ──
function playerMgmtSaveRating(displayName, value) {
  const rating = parseFloat(value);
  if (isNaN(rating)) return;
  setRating(displayName, rating);  // single write gateway
  syncRatings();                   // refresh all visible badges
  updatePlayerList();
}

// ── Toggle gender ──
async function playerMgmtToggleGender(displayName) {
  const key = displayName.trim().toLowerCase();
  const hp  = newImportState.historyPlayers.find(p => p.displayName.trim().toLowerCase() === key);
  if (!hp) return;
  hp.gender = hp.gender === "Female" ? "Male" : "Female";
  localStorage.setItem("newImportHistory", JSON.stringify(newImportState.historyPlayers));
  // Sync gender to Supabase
  try {
    await sbPatch("players", `name=ilike.${encodeURIComponent(displayName.trim())}`, { gender: hp.gender });
  } catch(e) { /* silent */ }
  syncPlayersFromMaster();
  updatePlayerList();
  playerMgmtRenderList();
}

// ── Delete from master DB ──
async function playerMgmtDelete(displayName) {
  if (!confirm(`Remove "${displayName}" from this club?`)) return;
  const key = displayName.trim().toLowerCase();

  // Remove from Supabase club_members
  try {
    const players = await sbGet("players", `name=ilike.${encodeURIComponent(displayName.trim())}&select=id`);
    if (players.length) {
      const club = getMyClub();
      await sbDelete("club_members", `player_id=eq.${players[0].id}&club_id=eq.${club.id}`);
    }
  } catch(e) { /* silent */ }

  // Remove from local cache
  newImportState.historyPlayers = newImportState.historyPlayers.filter(
    p => p.displayName.trim().toLowerCase() !== key
  );
  localStorage.setItem("newImportHistory", JSON.stringify(newImportState.historyPlayers));
  playerMgmtRenderList();
}

// ── Add new player ──
function playerMgmtAddNew() {
  const name = prompt("Enter player name:");
  if (!name || !name.trim()) return;
  const trimmed = name.trim();
  const key = trimmed.toLowerCase();
  if (newImportState.historyPlayers.some(p => p.displayName.trim().toLowerCase() === key)) {
    alert("Player already exists."); return;
  }
  newImportState.historyPlayers.unshift({ displayName: trimmed, gender: "Male", rating: 1.0, clubRating: 1.0, activeRating: 1.0 });
  localStorage.setItem("newImportHistory", JSON.stringify(newImportState.historyPlayers));
  playerMgmtRenderList();
}

/* =============================================================
   GITHUB ADMIN — Token + Club Management
   Added: step82
============================================================= */

// ── Token UI ──────────────────────────────────────────────────

// ── Club Admin (Supabase) ────────────────────────────────────

function clubAdminInit() {
  sbRenderClubStatus();
  updateRegisterTabVisibility();
}



function sbShowClubTab(tab) {
  ["join","create","players"].forEach(t => {
    const content = document.getElementById("clubTab" + t.charAt(0).toUpperCase() + t.slice(1));
    const btn     = document.getElementById("clubTab" + t.charAt(0).toUpperCase() + t.slice(1) + "Btn");
    if (content) content.style.display = t === tab ? "block" : "none";
    if (btn) btn.classList.toggle("active", t === tab);
  });
  if (tab === "players") { playerSubtabShow('all'); }
  if (tab === "create") sbPopulateDeleteDropdown();
}







function sbRenderClubStatus() {
  const club  = getMyClub();
  const mode  = getClubMode();
  const el    = document.getElementById("sbClubStatus");
  const badge = document.getElementById("sbModeBadge");

  if (el) el.textContent = club.name ? club.name : "No club selected";

  if (badge) {
    if (mode === "admin") {
      badge.textContent = "🔑 Admin";
      badge.style.background = "#2dce89";
      badge.style.color = "#fff";
      badge.style.display = "inline-block";
    } else if (mode === "user") {
      badge.textContent = "👤 User";
      badge.style.background = "#5e72e4";
      badge.style.color = "#fff";
      badge.style.display = "inline-block";
    } else {
      badge.style.display = "none";
    }
  }

  // Restore rating mode UI if already logged in
  if (club.id) {
    const isTrusted = localStorage.getItem("kbrr_club_trusted") === "true";
    const ratingMode = localStorage.getItem("kbrr_rating_mode") || "local";
    const wrap = document.getElementById("sbRatingModeWrap");
    if (wrap) {
      wrap.style.display = isTrusted ? "block" : "none";
      document.getElementById("sbRatingGlobal")?.classList.toggle("active", ratingMode === "global");
      document.getElementById("sbRatingLocal")?.classList.toggle("active",  ratingMode === "local");
    }
  }

  // Also sync Vault status strip
  vaultSyncStatus();
}

/* ── Vault tab functions ── */
function vaultShowTab(tab, btn) {
  document.querySelectorAll('.vault-inner-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.vault-inner-tab, .vault-tab').forEach(b => b.classList.remove('active'));
  const content = document.getElementById('vaultTab' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (content) content.classList.add('active');
  if (btn) btn.classList.add('active');
  if (tab === 'players')  playerPlayingRenderList();
  if (tab === 'register') vaultRenderRegister();
  if (tab === 'modify')   vaultRenderModify();
}

/* ── Vault Modify tab — admin-only player edits ── */
async function vaultRenderModify() {
  const container = document.getElementById('vaultModifyList');
  if (!container) return;

  if (!(typeof isAdminMode === 'function' && isAdminMode())) {
    container.innerHTML = '<p class="player-mgmt-empty">🔒 Admin access required.</p>';
    return;
  }

  const club = (typeof getMyClub === 'function') ? getMyClub() : { id: null };
  if (!club.id) {
    container.innerHTML = '<p class="player-mgmt-empty">Join a club to manage players.</p>';
    return;
  }

  container.innerHTML = '<p style="color:#aaa;font-size:0.85rem">Loading...</p>';

  try {
    const clubPlayers = await dbGetPlayers(true); // force fresh from DB
    const players = (clubPlayers || []).map(p => ({
      displayName: p.name,
      gender: p.gender || 'Male',
      rating: parseFloat(p.rating) || 1.0
    })).sort((a, b) => a.displayName.localeCompare(b.displayName));

    if (!players.length) {
      container.innerHTML = '<p class="player-mgmt-empty">No players in club yet.</p>';
      return;
    }

    container.innerHTML = '';
    players.forEach(p => {
      const row = document.createElement('div');
      row.className = 'player-mgmt-row';
      const safeName = p.displayName.replace(/'/g, "\\'");
      const genderImg = p.gender === 'Female' ? 'female.png' : 'male.png';
      const currentRating = (typeof getActiveRating === 'function' ? getActiveRating(p.displayName) : getRating(p.displayName)).toFixed(1);
      row.innerHTML = `
        <img src="${genderImg}" class="player-mgmt-avatar vault-gender-toggle"
             onclick="vaultToggleGender('${safeName}', this)"
             title="Tap to toggle gender">
        <span class="player-mgmt-name vault-name-edit"
              onclick="vaultEditName('${safeName}')"
              title="Tap to edit name">${p.displayName}</span>
        <input type="number" class="rating-edit-input vault-rating-input"
               value="${currentRating}" min="1.0" max="5.0" step="0.1"
               onchange="vaultSaveRating('${safeName}', this.value)"
               title="Edit rating">
        <button class="player-mgmt-del-btn"
                onclick="vaultDeletePlayer('${safeName}')">🗑</button>
      `;
      container.appendChild(row);
    });
  } catch(e) {
    container.innerHTML = '<p class="player-mgmt-empty">Failed to load players.</p>';
  }
}

function vaultSaveRating(displayName, value) {
  const rating = parseFloat(value);
  if (isNaN(rating) || rating < 1.0 || rating > 5.0) return;
  if (typeof setRating === 'function') setRating(displayName, rating);
  if (typeof syncRatings === 'function') syncRatings();
  if (typeof updatePlayerList === 'function') updatePlayerList();
}

async function vaultEditName(displayName) {
  const newName = prompt('Edit player name:', displayName);
  if (!newName || !newName.trim() || newName.trim() === displayName) return;
  const trimmed = newName.trim();
  const dup = (newImportState.historyPlayers || []).some(
    p => p.displayName.trim().toLowerCase() === trimmed.toLowerCase() &&
         p.displayName.trim().toLowerCase() !== displayName.trim().toLowerCase()
  );
  if (dup) { alert('Name already exists!'); return; }
  try {
    await sbPatch('players', `name=ilike.${encodeURIComponent(displayName.trim())}`, { name: trimmed });
    const hp = (newImportState.historyPlayers || []).find(
      p => p.displayName.trim().toLowerCase() === displayName.trim().toLowerCase()
    );
    if (hp) hp.displayName = trimmed;
    localStorage.setItem('newImportHistory', JSON.stringify(newImportState.historyPlayers));
    syncPlayersFromMaster();
    updatePlayerList();
    vaultRenderModify();
  } catch(e) { alert('Failed to save. Check connection.'); }
}

async function vaultToggleGender(displayName, imgEl) {
  const hp = (newImportState.historyPlayers || []).find(
    p => p.displayName.trim().toLowerCase() === displayName.trim().toLowerCase()
  );
  if (!hp) return;
  hp.gender = hp.gender === 'Female' ? 'Male' : 'Female';
  imgEl.src = hp.gender === 'Female' ? 'female.png' : 'male.png';
  localStorage.setItem('newImportHistory', JSON.stringify(newImportState.historyPlayers));
  try {
    await sbPatch('players', `name=ilike.${encodeURIComponent(displayName.trim())}`, { gender: hp.gender });
    syncPlayersFromMaster();
    updatePlayerList();
  } catch(e) { /* silent — local already updated */ }
}

async function vaultDeletePlayer(displayName) {
  if (!confirm(`Remove "${displayName}" from this club?`)) return;
  try {
    const players = await sbGet('players', `name=ilike.${encodeURIComponent(displayName.trim())}&select=id`);
    if (players.length) {
      const club = getMyClub();
      await sbDelete('club_members', `player_id=eq.${players[0].id}&club_id=eq.${club.id}`);
    }
  } catch(e) { /* silent */ }
  newImportState.historyPlayers = (newImportState.historyPlayers || []).filter(
    p => p.displayName.trim().toLowerCase() !== displayName.trim().toLowerCase()
  );
  localStorage.setItem('newImportHistory', JSON.stringify(newImportState.historyPlayers));
  syncPlayersFromMaster();
  updatePlayerList();
  vaultRenderModify();
}

// ── Club Management — OTP-based create/delete ──

var _clubCreateEmail = ''; // store email during OTP flow
var _clubDeleteEmail = ''; // store registration email during delete OTP flow
var _clubDeleteId    = ''; // store selected club id during delete OTP flow

function toggleClubMgmt(forceOpen) {
  const panel = document.getElementById('clubMgmtPanel');
  const arrow = document.getElementById('clubMgmtArrow');
  const open  = forceOpen === true ? true : panel.style.display === 'none';
  panel.style.display = open ? 'block' : 'none';
  arrow.textContent   = open ? '▼' : '▶';
  if (open) sbPopulateDeleteDropdown();
}

/* ── CREATE CLUB — Step 1: Send OTP ── */
async function clubCreateSendOtp() {
  const name    = document.getElementById('sbNewClubName')?.value.trim();
  const email   = document.getElementById('sbNewClubEmail')?.value.trim();
  const selPw   = document.getElementById('sbNewClubSelectPw')?.value.trim();
  const adminPw = document.getElementById('sbNewClubAdminPw')?.value.trim();
  const fb      = document.getElementById('clubCreateFeedback');

  const setFb = (msg, ok) => { if (fb) { fb.textContent = msg; fb.style.color = ok ? '#2dce89' : '#e63757'; } };

  if (!name)    { setFb('Enter club name.', false); return; }
  if (!email || !email.includes('@')) { setFb('Enter a valid email.', false); return; }
  if (!selPw)   { setFb('Enter user password.', false); return; }
  if (!adminPw) { setFb('Enter admin password.', false); return; }

  setFb('Sending OTP...', true);
  try {
    await dbSendOtp(email);
    _clubCreateEmail = email;
    document.getElementById('clubCreateEmailMasked').textContent = maskEmail(email);
    document.getElementById('clubCreateStep1').style.display = 'none';
    document.getElementById('clubCreateStep2').style.display = '';
    document.getElementById('sbNewClubOtp').value = '';
    document.getElementById('sbNewClubOtp').focus();
    setFb('OTP sent! Check your email.', true);
  } catch (e) { setFb('❌ ' + e.message, false); }
}

async function clubCreateResend() {
  if (!_clubCreateEmail) return;
  try {
    await dbSendOtp(_clubCreateEmail);
    document.getElementById('clubCreateFeedback').textContent = 'OTP resent.';
    document.getElementById('clubCreateFeedback').style.color = '#2dce89';
  } catch (e) {}
}

/* ── CREATE CLUB — Step 2: Verify OTP & Create ── */
async function clubCreateVerify() {
  const otp     = document.getElementById('sbNewClubOtp')?.value.trim();
  const name    = document.getElementById('sbNewClubName')?.value.trim();
  const selPw   = document.getElementById('sbNewClubSelectPw')?.value.trim();
  const adminPw = document.getElementById('sbNewClubAdminPw')?.value.trim();
  const fb      = document.getElementById('clubCreateFeedback');
  const setFb   = (msg, ok) => { if (fb) { fb.textContent = msg; fb.style.color = ok ? '#2dce89' : '#e63757'; } };

  if (!otp || otp.length < 8) { setFb('Enter the 8-digit OTP.', false); return; }
  setFb('Verifying...', true);
  try {
    await dbVerifyOtp(_clubCreateEmail, otp);
    // OTP verified — create the club
    const club = await dbAddClub(name, selPw, adminPw, _clubCreateEmail);
    setMyClub(club.id, club.name);
    localStorage.setItem('kbrr_club_mode',    'admin');
    localStorage.setItem('kbrr_rating_field', 'club_ratings');
    // Reset form
    ['sbNewClubName','sbNewClubEmail','sbNewClubSelectPw','sbNewClubAdminPw','sbNewClubOtp'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('clubCreateStep1').style.display = '';
    document.getElementById('clubCreateStep2').style.display = 'none';
    _clubCreateEmail = '';
    setFb('✅ Club "' + club.name + '" created! You are now Admin.', true);
    sbRenderClubStatus();
    vaultSyncStatus();
    if (typeof clubLoginRefresh === 'function') clubLoginRefresh();
    await syncToLocal();
  } catch (e) { setFb('❌ ' + e.message, false); }
}

/* ── DELETE CLUB — Step 1: Send OTP ── */
async function clubDeleteSendOtp() {
  const select = document.getElementById('sbDeleteClubSelect');
  const fb     = document.getElementById('clubDeleteFeedback');
  const setFb  = (msg, ok) => { if (fb) { fb.textContent = msg; fb.style.color = ok ? '#2dce89' : '#e63757'; } };

  if (!select || !select.value) { setFb('Select a club to delete.', false); return; }

  setFb('Fetching club details...', true);
  try {
    const regEmail = await dbGetClubRegEmail(select.value);
    if (!regEmail) { setFb('This club has no registration email. Cannot delete via OTP.', false); return; }
    await dbSendOtp(regEmail);
    _clubDeleteEmail = regEmail;
    _clubDeleteId    = select.value;
    document.getElementById('clubDeleteEmailMasked').textContent = maskEmail(regEmail);
    document.getElementById('clubDeleteStep1').style.display = 'none';
    document.getElementById('clubDeleteStep2').style.display = '';
    document.getElementById('sbDeleteOtp').value = '';
    document.getElementById('sbDeleteOtp').focus();
    setFb('OTP sent to club registration email.', true);
  } catch (e) { setFb('❌ ' + e.message, false); }
}

async function clubDeleteResend() {
  if (!_clubDeleteEmail) return;
  try {
    await dbSendOtp(_clubDeleteEmail);
    document.getElementById('clubDeleteFeedback').textContent = 'OTP resent.';
    document.getElementById('clubDeleteFeedback').style.color = '#2dce89';
  } catch (e) {}
}

/* ── DELETE CLUB — Step 2: Verify OTP & Delete ── */
async function clubDeleteVerify() {
  const otp   = document.getElementById('sbDeleteOtp')?.value.trim();
  const fb    = document.getElementById('clubDeleteFeedback');
  const setFb = (msg, ok) => { if (fb) { fb.textContent = msg; fb.style.color = ok ? '#2dce89' : '#e63757'; } };

  if (!otp || otp.length < 8) { setFb('Enter the 8-digit OTP.', false); return; }
  setFb('Verifying...', true);
  try {
    await dbVerifyOtp(_clubDeleteEmail, otp);
    const clubName = document.getElementById('sbDeleteClubSelect')?.options[document.getElementById('sbDeleteClubSelect').selectedIndex]?.text || '';
    await dbDeleteClub(_clubDeleteId);
    // If deleted club was active, clear session
    const myClub = getMyClub();
    if (myClub.id === _clubDeleteId) sbClearClub();
    // Reset
    document.getElementById('sbDeleteClubSelect').value = '';
    document.getElementById('clubDeleteStep1').style.display = '';
    document.getElementById('clubDeleteStep2').style.display = 'none';
    document.getElementById('sbDeleteOtp').value = '';
    _clubDeleteEmail = '';
    _clubDeleteId    = '';
    await sbPopulateDeleteDropdown();
    setFb('✅ Club "' + clubName + '" deleted.', true);
  } catch (e) { setFb('❌ ' + e.message, false); }
}

function vaultRenderRegister() {
  const container = document.getElementById('vaultRegisterContainer');
  if (!container) return;
  const club = (typeof getMyClub === 'function') ? getMyClub() : { name: null };
  if (typeof newImportRenderRegister === 'function') {
    // Temporarily swap the render target so register renders into vault container
    const original = document.getElementById('newImportSelectCards');
    if (original) original.id = '_newImportSelectCards_hidden';
    container.id = 'newImportSelectCards';
    newImportRenderRegister();
    container.id = 'vaultRegisterContainer';
    if (original) original.id = 'newImportSelectCards';
  }
}

function vaultSyncStatus() {
  const club = (typeof getMyClub === 'function') ? getMyClub() : { id: null, name: null };
  const mode = (typeof getClubMode === 'function') ? getClubMode() : null;

  const dot   = document.getElementById('vaultStatusDot');
  const name  = document.getElementById('vaultStatusName');
  const role  = document.getElementById('vaultStatusRole');
  const strip = document.getElementById('vaultStatusStrip');

  if (!name) return; // vault section not yet in DOM

  if (club.name) {
    if (name)  name.textContent  = club.name;
    if (dot)   { dot.style.background = '#2dce89'; dot.style.boxShadow = '0 0 0 3px rgba(45,206,137,0.2)'; }
    if (strip) strip.style.borderColor = 'rgba(45,206,137,0.2)';
    if (role) {
      role.style.display = 'inline-block';
      if (mode === 'admin') { role.textContent = 'ADMIN'; role.style.background = '#2dce89'; role.style.color = '#000'; }
      else                  { role.textContent = 'USER';  role.style.background = 'var(--accent)'; role.style.color = '#fff'; }
    }
    // Modify tab — admin only
    const modifyBtn = document.getElementById('vaultTabModifyBtn');
    if (modifyBtn) modifyBtn.style.display = mode === 'admin' ? '' : 'none';
  } else {
    if (name)  name.textContent  = 'No club selected';
    if (dot)   { dot.style.background = 'var(--muted)'; dot.style.boxShadow = 'none'; }
    if (role)  role.style.display = 'none';
  }



}








function sbRenderRatingMode(isTrusted) {
  // global mode blocked until fully tested — hide UI always
  const wrap = document.getElementById("sbRatingModeWrap");
  if (wrap) wrap.style.display = "none";
  localStorage.setItem("kbrr_rating_mode", "local");
}

function sbSetRatingMode(mode) {
  localStorage.setItem("kbrr_rating_mode", mode);
  document.getElementById("sbRatingGlobal")?.classList.toggle("active", mode === "global");
  document.getElementById("sbRatingLocal")?.classList.toggle("active",  mode === "local");
  // Re-sync so activeRating is recomputed from the correct field for the new mode
  if (typeof syncToLocal === "function") syncToLocal();
}

function sbClearClub() {
  clearMyClub();
  localStorage.removeItem('kbrr_club_mode');
  localStorage.removeItem('kbrr_club_trusted');
  localStorage.removeItem('kbrr_rating_mode');
  localStorage.removeItem('kbrr_rating_field');
  localStorage.removeItem('kbrr_rating_field');

  // Clear all player data on logout
  localStorage.removeItem('newImportHistory');
  localStorage.removeItem('schedulerPlayers');
  if (typeof newImportState !== 'undefined' && newImportState) {
    newImportState.historyPlayers = [];
    newImportState.selectedPlayers = [];
  }
  if (typeof schedulerState !== 'undefined' && schedulerState) {
    schedulerState.allPlayers    = [];
    schedulerState.activeplayers = [];
  }

  document.getElementById('sbRatingModeWrap') && (document.getElementById('sbRatingModeWrap').style.display = 'none');
  sbRenderClubStatus();
  vaultSyncStatus();
  if (typeof clubLoginRefresh === 'function') clubLoginRefresh();
  updateRegisterTabVisibility();
}

// sbDeleteClub replaced by clubDeleteSendOtp/clubDeleteVerify (OTP flow)

async function sbPopulateDeleteDropdown() {
  const select = document.getElementById("sbDeleteClubSelect");
  if (!select) return;
  try {
    const clubs = await dbGetClubs();
    select.innerHTML = '<option value="">— Select club to delete —</option>';
    clubs.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      select.appendChild(opt);
    });
  } catch (e) { /* silent */ }
}

function getClubMode() {
  return localStorage.getItem("kbrr_club_mode") || null; // "admin" | "user" | null
}

function isAdminMode() {
  return getClubMode() === "admin";
}

// sbCreateClub replaced by clubCreateSendOtp/clubCreateVerify (OTP flow)

function sbFeedback(msg, color) {
  const el = document.getElementById("sbClubFeedback");
  if (!el) return;
  el.textContent = msg;
  el.style.color = color === "green" ? "#2dce89" : color === "red" ? "#e63757" : "#888";
}

function updateRegisterTabVisibility() {
  // Vault tab moved to top nav — no longer in import modal, nothing to update here
}

/* =============================================================
   PLAYER STATS MODAL
============================================================= */
async function showPlayerStats(name) {
  const modal    = document.getElementById("playerStatsModal");
  const content  = document.getElementById("playerStatsContent");
  if (!modal || !content) return;

  content.innerHTML = "<div class='stats-loading'>Loading...</div>";
  modal.style.display = "flex";

  try {
    const rows = await sbGet(
      "players",
      `name=ilike.${encodeURIComponent(name)}&select=name,gender,wins,losses,sessions`
    );
    if (!rows || !rows.length) {
      content.innerHTML = "<div class='stats-loading'>Player not found.</div>";
      return;
    }
    const p      = rows[0];
    const gender = p.gender || "Male";
    // Single gate — sync first, then read activeRating
    await syncToLocal();
    const rating = getActiveRating(name).toFixed(1);
    const wins     = p.wins   || 0;
    const losses   = p.losses || 0;
    const sessions = Array.isArray(p.sessions) ? p.sessions : [];
    const genderImg = gender === "Female" ? "female.png" : "male.png";
    const total    = wins + losses;
    const winPct   = total > 0 ? Math.round((wins / total) * 100) : 0;

    const sessionRows = sessions.length
      ? sessions.map(s => `
          <tr>
            <td>${s.date || "—"}</td>
            <td>${s.wins || 0}</td>
            <td>${s.losses || 0}</td>
            <td>${parseFloat(s.rating || 0).toFixed(1)}</td>
          </tr>`).join("")
      : `<tr><td colspan="4" style="text-align:center;color:var(--muted)">No sessions yet</td></tr>`;

    content.innerHTML = `
      <div class="stats-header">
        <img src="${genderImg}" class="stats-avatar">
        <div class="stats-name">${p.name}</div>
        <div class="stats-gender">${gender}</div>
      </div>
      <div class="stats-row">
        <div class="stats-box">
          <div class="stats-box-value">${rating}</div>
          <div class="stats-box-label">Rating</div>
        </div>
        <div class="stats-box">
          <div class="stats-box-value">${wins}</div>
          <div class="stats-box-label">Wins</div>
        </div>
        <div class="stats-box">
          <div class="stats-box-value">${losses}</div>
          <div class="stats-box-label">Losses</div>
        </div>
        <div class="stats-box">
          <div class="stats-box-value">${winPct}%</div>
          <div class="stats-box-label">Win %</div>
        </div>
      </div>
      <div class="stats-section-title">Recent Sessions</div>
      <table class="stats-table">
        <thead>
          <tr><th>Date</th><th>W</th><th>L</th><th>Rating</th></tr>
        </thead>
        <tbody>${sessionRows}</tbody>
      </table>
    `;
  } catch (e) {
    content.innerHTML = "<div class='stats-loading'>Failed to load stats.</div>";
  }
}

function closePlayerStats() {
  const modal = document.getElementById("playerStatsModal");
  if (modal) modal.style.display = "none";
}
