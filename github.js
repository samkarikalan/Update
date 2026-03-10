/// ============================================================
/// github.js — GitHub API service for KariBRR global DB
/// Repo: samkarikalan/sportsclub-db
/// Files: players.json, clubs.json
/// ============================================================

const GITHUB_OWNER = "samkarikalan";
const GITHUB_REPO  = "sportsclub-db";
const GITHUB_API   = "https://api.github.com";

/// ── Local cache keys ─────────────────────────────────────────
const CACHE_PLAYERS   = "kbrr_cached_players";
const CACHE_CLUBS     = "kbrr_cached_clubs";
const CACHE_TIMESTAMP = "kbrr_cache_time";
const CACHE_TTL_MS    = 5 * 60 * 1000; // 5 minutes

/// ── Token (set by admin in Settings) ─────────────────────────
function getGithubToken() {
  return localStorage.getItem("kbrr_admin_token") || null;
}

function setGithubToken(token) {
  localStorage.setItem("kbrr_admin_token", token.trim());
}

function clearGithubToken() {
  localStorage.removeItem("kbrr_admin_token");
}

function hasGithubToken() {
  const t = getGithubToken();
  return t && t.length > 0;
}

/// ── Build headers ─────────────────────────────────────────────
function buildHeaders(requireWrite = false) {
  const headers = {
    "Accept": "application/vnd.github+json",
    "Content-Type": "application/json"
  };
  const token = getGithubToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else if (requireWrite) {
    throw new Error("Admin token required for this action.");
  }
  return headers;
}

/// ── Read a file from GitHub ───────────────────────────────────
/// Returns { data: parsedJSON, sha: fileSHA }
async function githubReadFile(filename) {
  const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filename}`;
  const res = await fetch(url, { headers: buildHeaders() });

  if (!res.ok) {
    throw new Error(`Failed to read ${filename}: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  // UTF-8 safe decode — works for any language/script
  const b64     = json.content.replace(/\n/g, "");
  const binary  = atob(b64);
  const bytes   = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const content = new TextDecoder("utf-8").decode(bytes);
  const data = JSON.parse(content);
  return { data, sha: json.sha };
}

/// ── Write a file to GitHub ────────────────────────────────────
/// Requires admin token. sha is needed to update existing file.
async function githubWriteFile(filename, data, sha, message) {
  const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filename}`;
  // UTF-8 safe encode — loop method works for any language/script
  const jsonStr  = JSON.stringify(data, null, 2);
  const encoded  = new TextEncoder().encode(jsonStr);
  let binary = "";
  for (let i = 0; i < encoded.length; i++) binary += String.fromCharCode(encoded[i]);
  const content  = btoa(binary);

  const body = {
    message: message || `Update ${filename}`,
    content,
    sha
  };

  const res = await fetch(url, {
    method: "PUT",
    headers: buildHeaders(true),
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Failed to write ${filename}: ${err.message}`);
  }

  return await res.json();
}

/// ============================================================
/// PLAYERS API
/// ============================================================

/// Read all players — uses cache if fresh
async function dbGetPlayers(forceFresh = false) {
  const now = Date.now();
  const lastFetch = parseInt(localStorage.getItem(CACHE_TIMESTAMP) || "0");
  const cached = localStorage.getItem(CACHE_PLAYERS);

  if (!forceFresh && cached && (now - lastFetch) < CACHE_TTL_MS) {
    return JSON.parse(cached);
  }

  try {
    const { data } = await githubReadFile("players.json");
    localStorage.setItem(CACHE_PLAYERS, JSON.stringify(data));
    localStorage.setItem(CACHE_TIMESTAMP, String(Date.now()));
    return data;
  } catch (e) {
    console.warn("GitHub offline — using cached players:", e.message);
    return cached ? JSON.parse(cached) : [];
  }
}

/// Add a new player — requires admin token
/// Uniqueness: name + homeClub
async function dbAddPlayer(name, gender, homeClub) {
  if (!hasGithubToken()) throw new Error("Admin token required to add players.");

  const { data: players, sha } = await githubReadFile("players.json");

  // Check duplicate: same name + same homeClub
  const exists = players.find(
    p => p.name.toLowerCase() === name.toLowerCase() && p.homeClub === homeClub
  );
  if (exists) return exists; // already registered — no error

  const newPlayer = {
    id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    gender,
    homeClub,
    rating: 1.0,
    registeredDate: new Date().toISOString().split("T")[0]
  };

  players.push(newPlayer);
  await githubWriteFile("players.json", players, sha, `Add player: ${name}`);

  // Invalidate cache
  localStorage.setItem(CACHE_PLAYERS, JSON.stringify(players));
  localStorage.setItem(CACHE_TIMESTAMP, String(Date.now()));

  return newPlayer;
}

/// Update ratings for multiple players after a session
/// No token required — game results are objective
async function dbSyncRatings(updatedRatings) {
  // updatedRatings = [{ name, homeClub, rating }, ...]
  let { data: players, sha } = await githubReadFile("players.json");

  let changed = false;
  for (const update of updatedRatings) {
    const idx = players.findIndex(
      p => p.name === update.name && p.homeClub === update.homeClub
    );
    if (idx !== -1 && players[idx].rating !== update.rating) {
      players[idx].rating = Math.round(update.rating * 10) / 10;
      changed = true;
    }
  }

  if (!changed) return;

  await githubWriteFile("players.json", players, sha, "Sync ratings after session");

  // Update cache
  localStorage.setItem(CACHE_PLAYERS, JSON.stringify(players));
  localStorage.setItem(CACHE_TIMESTAMP, String(Date.now()));
}

/// Edit player name or gender — requires admin token
async function dbEditPlayer(playerId, updates) {
  if (!hasGithubToken()) throw new Error("Admin token required to edit players.");

  const { data: players, sha } = await githubReadFile("players.json");

  const idx = players.findIndex(p => p.id === playerId);
  if (idx === -1) throw new Error("Player not found.");

  if (updates.name)   players[idx].name   = updates.name.trim();
  if (updates.gender) players[idx].gender = updates.gender;

  await githubWriteFile("players.json", players, sha, `Edit player: ${players[idx].name}`);

  localStorage.setItem(CACHE_PLAYERS, JSON.stringify(players));
  localStorage.setItem(CACHE_TIMESTAMP, String(Date.now()));
}

/// Override rating manually — requires admin token
async function dbOverrideRating(playerId, newRating) {
  if (!hasGithubToken()) throw new Error("Admin token required to override ratings.");

  const { data: players, sha } = await githubReadFile("players.json");

  const idx = players.findIndex(p => p.id === playerId);
  if (idx === -1) throw new Error("Player not found.");

  players[idx].rating = Math.round(newRating * 10) / 10;

  await githubWriteFile("players.json", players, sha, `Override rating: ${players[idx].name}`);

  localStorage.setItem(CACHE_PLAYERS, JSON.stringify(players));
  localStorage.setItem(CACHE_TIMESTAMP, String(Date.now()));
}

/// Delete a player — requires admin token + must be home club
async function dbDeletePlayer(playerId, requestingClub) {
  if (!hasGithubToken()) throw new Error("Admin token required to delete players.");

  const { data: players, sha } = await githubReadFile("players.json");

  const idx = players.findIndex(p => p.id === playerId);
  if (idx === -1) throw new Error("Player not found.");

  if (players[idx].homeClub !== requestingClub) {
    throw new Error("You can only delete players registered at your club.");
  }

  const name = players[idx].name;
  players.splice(idx, 1);

  await githubWriteFile("players.json", players, sha, `Delete player: ${name}`);

  localStorage.setItem(CACHE_PLAYERS, JSON.stringify(players));
  localStorage.setItem(CACHE_TIMESTAMP, String(Date.now()));
}

/// ============================================================
/// CLUBS API
/// ============================================================

/// Read all clubs
async function dbGetClubs() {
  const cached = localStorage.getItem(CACHE_CLUBS);
  try {
    const { data } = await githubReadFile("clubs.json");
    localStorage.setItem(CACHE_CLUBS, JSON.stringify(data));
    return data;
  } catch (e) {
    console.warn("GitHub offline — using cached clubs:", e.message);
    return cached ? JSON.parse(cached) : [];
  }
}

/// Register a new club — requires admin token
async function dbAddClub(clubName) {
  if (!hasGithubToken()) throw new Error("Admin token required to register a club.");

  const { data: clubs, sha } = await githubReadFile("clubs.json");

  const exists = clubs.find(c => c.name.toLowerCase() === clubName.toLowerCase());
  if (exists) throw new Error(`Club "${clubName}" already exists.`);

  const newClub = {
    id: `club-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: clubName.trim(),
    registeredDate: new Date().toISOString().split("T")[0]
  };

  clubs.push(newClub);
  await githubWriteFile("clubs.json", clubs, sha, `Register club: ${clubName}`);

  localStorage.setItem(CACHE_CLUBS, JSON.stringify(clubs));
  return newClub;
}

/// ============================================================
/// CONNECTIVITY CHECK
/// ============================================================

async function dbIsOnline() {
  try {
    const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;
    const res = await fetch(url, { headers: buildHeaders() });
    return res.ok;
  } catch {
    return false;
  }
}

/// ============================================================
/// SYNC SESSION RATINGS TO GITHUB — called after every round
/// ============================================================

async function githubSyncAfterRound() {
  try {
    const myClub = localStorage.getItem("kbrr_my_club_name") || "";
    const updatedRatings = schedulerState.allPlayers.map(p => ({
      name: p.name,
      homeClub: p.homeClub || myClub,
      rating: (typeof getActiveRating === "function" ? getActiveRating(p.name) : getRating(p.name))
    }));
    await dbSyncRatings(updatedRatings);
  } catch (e) {
    // Silent fail — never interrupt the game
  }
}
