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

function toggleLangMenu() {
  const menu = document.getElementById('langMenu');
  menu.style.display = menu.style.display === 'block' ? 'none' : 'block';  
}

document.querySelectorAll('.lang-menu div').forEach(item => {
  item.addEventListener('click', () => {
    document.getElementById('currentFlag').textContent = item.dataset.flag;
    setLanguage(item.dataset.lang);
    document.getElementById('langMenu').style.display = 'none';
  });
});



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
const supportedLangs = ["en", "jp", "kr", "vi"];
 // 2. update flag
  document.getElementById("currentFlag").textContent =
    langFlagMap[savedLang] || "🌐";
  
if (supportedLangs.includes(savedLang)) {
setLanguage(savedLang);
//updateHelpLanguage(savedLang);
} else {
const browserLang = navigator.language.toLowerCase();
if (browserLang.startsWith("ja")) {
setLanguage("jp");
//updateHelpLanguage("jp");
} else if (browserLang.startsWith("ko")) {
setLanguage("kr");
//updateHelpLanguage("kr");
} else if (browserLang.startsWith("vi")) {
setLanguage("vi");
//updateHelpLanguage("vi");
} else {
setLanguage("en");
//updateHelpLanguage("en");
}
}
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

  if (size === "small") root.style.setProperty("--base-font-size", "12px");
  if (size === "medium") root.style.setProperty("--base-font-size", "14px");
  if (size === "large") root.style.setProperty("--base-font-size", "17px");

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
  document.getElementById("roundShufle").disabled = false;

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

// ── Render master player list ──
async function playerMgmtRenderList() {
  const container = document.getElementById("playerMgmtList");
  container.innerHTML = "<p style='color:#aaa;font-size:0.85rem'>Loading...</p>";

  // Always use syncGithubToLocal as single source of truth — never fetch directly
  if (!newImportState.historyPlayers || !newImportState.historyPlayers.length) {
    await syncGithubToLocal();
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

  const admin = (typeof isAdminMode === "function") && isAdminMode();

  // Show toolbar only in admin mode
  const toolbar = document.getElementById("playerMgmtToolbar");
  if (toolbar) toolbar.style.display = admin ? "flex" : "none";

  sorted.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "player-mgmt-row";
    const safeName = p.displayName.replace(/'/g, "\'");
    if (admin) {
      row.innerHTML = `
        <img src="${p.gender === 'Female' ? 'female.png' : 'male.png'}"
             class="player-mgmt-avatar"
             onclick="playerMgmtToggleGender('${safeName}')"
             title="Tap to toggle gender">
        <span class="player-mgmt-name player-mgmt-name-link" onclick="showPlayerStats('${safeName}')">${p.displayName}</span>
        <input type="number" class="rating-edit-input"
          value="${(typeof getActiveRating === "function" ? getActiveRating(p.displayName) : getRating(p.displayName)).toFixed(1)}"
          min="1.0" max="5.0" step="0.1"
          onchange="playerMgmtSaveRating('${safeName}', this.value)">
        <button class="player-mgmt-del-btn"
          onclick="playerMgmtDelete('${safeName}')">🗑</button>
      `;
    } else {
      row.innerHTML = `
        <img src="${p.gender === 'Female' ? 'female.png' : 'male.png'}"
             class="player-mgmt-avatar" style="cursor:default">
        <span class="player-mgmt-name player-mgmt-name-link" onclick="showPlayerStats('${safeName}')">${p.displayName}</span>
        <span class="rating-badge" style="font-size:0.8rem;padding:2px 7px">${(typeof getActiveRating === "function" ? getActiveRating(p.displayName) : getRating(p.displayName)).toFixed(1)}</span>
      `;
    }
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

function githubAdminInit() {
  sbLoadClubs();
  sbRenderClubStatus();
  updateRegisterTabVisibility();
  sbShowClubTab("join");
}

function sbShowClubTab(tab) {
  ["join","create","players"].forEach(t => {
    const content = document.getElementById("clubTab" + t.charAt(0).toUpperCase() + t.slice(1));
    const btn     = document.getElementById("clubTab" + t.charAt(0).toUpperCase() + t.slice(1) + "Btn");
    if (content) content.style.display = t === tab ? "block" : "none";
    if (btn) btn.classList.toggle("active", t === tab);
  });
  if (tab === "players") playerMgmtRenderList();
  if (tab === "create") sbPopulateDeleteDropdown();
}

async function sbLoadClubs() {
  try {
    const clubs = await dbGetClubs();
    const select = document.getElementById("sbClubSelect");
    if (!select) return;
    select.innerHTML = '<option value="">— Select club —</option>';
    clubs.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      select.appendChild(opt);
    });
  } catch (e) {
    console.warn("Could not load clubs:", e.message);
  }
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
}

async function sbConfirmJoin() {
  const select   = document.getElementById("sbClubSelect");
  const pwInput  = document.getElementById("sbPasswordInput");
  if (!select || !select.value) { sbFeedback("Please select a club.", "red"); return; }
  const password = pwInput?.value.trim();
  if (!password) { sbFeedback("Enter password.", "red"); return; }

  try {
    // Fetch club including trusted flag
    const clubs = await sbGet("clubs", `id=eq.${select.value}&select=id,name,select_password,admin_password,trusted`);
    if (!clubs.length) throw new Error("Club not found.");
    const club = clubs[0];

    let mode = null;
    if (password === club.admin_password)       mode = "admin";
    else if (password === club.select_password) mode = "user";
    else throw new Error("Wrong password.");

    // Save club + mode + trusted flag
    setMyClub(club.id, club.name);
    localStorage.setItem("kbrr_club_mode",    mode);
    localStorage.setItem("kbrr_club_trusted", club.trusted ? "true" : "false");

    // Default rating mode to "local" always — trusted clubs can switch to global
    localStorage.setItem("kbrr_rating_mode", "local");

    pwInput.value = "";
    sbRenderClubStatus();
    sbRenderRatingMode(club.trusted === true);
    sbFeedback(`✅ Joined as ${mode === "admin" ? "Admin 🔑" : "User 👤"}`, "green");
    syncGithubToLocal();
    updateRegisterTabVisibility();
  } catch (e) {
    sbFeedback("❌ " + e.message, "red");
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
  if (typeof syncGithubToLocal === "function") syncGithubToLocal();
}

function sbClearClub() {
  clearMyClub();
  localStorage.removeItem("kbrr_club_mode");
  localStorage.removeItem("kbrr_club_trusted");
  localStorage.removeItem("kbrr_rating_mode");
  document.getElementById("sbRatingModeWrap") && (document.getElementById("sbRatingModeWrap").style.display = "none");
  sbRenderClubStatus();
  sbFeedback("Club cleared.", "gray");
  updateRegisterTabVisibility();
}

async function sbDeleteClub() {
  const select  = document.getElementById("sbDeleteClubSelect");
  const pwInput = document.getElementById("sbDeleteAdminPw");
  const clubId  = select?.value;
  const pw      = pwInput?.value.trim();

  if (!clubId)  { sbFeedback("Select a club to delete.", "red"); return; }
  if (!pw)      { sbFeedback("Enter admin password.", "red"); return; }

  // Verify admin password against selected club
  const clubName = select.options[select.selectedIndex]?.text || "";
  try {
    const clubs = await sbGet("clubs", `id=eq.${clubId}&select=id,name,admin_password`);
    if (!clubs || !clubs.length) { sbFeedback("Club not found.", "red"); return; }
    if (clubs[0].admin_password !== pw) { sbFeedback("Wrong admin password.", "red"); return; }
  } catch (e) {
    sbFeedback("Verification failed.", "red"); return;
  }

  const confirmed = confirm(`Delete club "${clubName}"?\nThis will remove all members and cannot be undone.`);
  if (!confirmed) return;

  try {
    await dbDeleteClub(clubId);
    // If deleted club was active, clear session
    const myClub = getMyClub();
    if (myClub.id === clubId) sbClearClub();
    if (select)  select.value  = "";
    if (pwInput) pwInput.value = "";
    await sbLoadClubs();
    await sbPopulateDeleteDropdown();
    sbFeedback(`Club "${clubName}" deleted.`, "red");
  } catch (e) {
    sbFeedback("Delete failed: " + (e.message || e), "red");
  }
}

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

async function sbCreateClub() {
  const name    = document.getElementById("sbNewClubName")?.value.trim();
  const selPw   = document.getElementById("sbNewClubSelectPw")?.value.trim();
  const adminPw = document.getElementById("sbNewClubAdminPw")?.value.trim();

  if (!name)    { sbFeedback("Enter club name.", "red"); return; }
  if (!selPw)   { sbFeedback("Enter club password.", "red"); return; }
  if (!adminPw) { sbFeedback("Enter admin password.", "red"); return; }

  try {
    const club = await dbAddClub(name, selPw, adminPw);
    setMyClub(club.id, club.name);
    document.getElementById("sbNewClubName").value    = "";
    document.getElementById("sbNewClubSelectPw").value  = "";
    document.getElementById("sbNewClubAdminPw").value = "";
    sbRenderClubStatus();
    await sbLoadClubs();
    sbFeedback(`✅ Club "${name}" created!`, "green");
  } catch (e) {
    sbFeedback("❌ " + e.message, "red");
  }
}

function sbFeedback(msg, color) {
  const el = document.getElementById("sbClubFeedback");
  if (!el) return;
  el.textContent = msg;
  el.style.color = color === "green" ? "#2dce89" : color === "red" ? "#e63757" : "#888";
}

function updateRegisterTabVisibility() {
  const tab = document.getElementById("newImportRegisterBtn");
  if (!tab) return;
  tab.style.display = isAdminMode() ? "inline-block" : "none";
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
      `name=ilike.${encodeURIComponent(name)}&select=name,gender,rating,wins,losses,sessions`
    );
    if (!rows || !rows.length) {
      content.innerHTML = "<div class='stats-loading'>Player not found.</div>";
      return;
    }
    const p        = rows[0];
    const gender   = p.gender || "Male";
    const rating   = parseFloat(p.rating || 1.0).toFixed(1);
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
