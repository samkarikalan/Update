/* ============================================================
   SUPABASE SERVICE LAYER
   Replaces github.js — same public API, Supabase backend
   ============================================================ */

const SUPABASE_URL = "https://utdpcqolkslzuqgiqmde.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0ZHBjcW9sa3NsenVxZ2lxbWRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NjQ1MTksImV4cCI6MjA4ODQ0MDUxOX0.zcVawfWv1H_Iz2D9Mq_uNzvLG5PcnHZaaVZiI2zLVjM";

const SB_HEADERS = {
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
};

// Cache keys
const CACHE_PLAYERS   = "kbrr_cache_players";
const CACHE_TIMESTAMP = "kbrr_cache_ts";
const CACHE_TTL_MS    = 5 * 60 * 1000; // 5 minutes

/// ============================================================
/// HELPERS
/// ============================================================

function sbUrl(table, query = "") {
  return `${SUPABASE_URL}/rest/v1/${table}${query ? "?" + query : ""}`;
}

async function sbGet(table, query = "") {
  const res = await fetch(sbUrl(table, query), { headers: SB_HEADERS });
  if (!res.ok) throw new Error(`GET ${table} failed: ${res.status}`);
  return res.json();
}

async function sbPost(table, body) {
  const res = await fetch(sbUrl(table), {
    method: "POST",
    headers: SB_HEADERS,
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || `POST ${table} failed`);
  }
  return res.json();
}

async function sbPatch(table, query, body) {
  const res = await fetch(sbUrl(table, query), {
    method: "PATCH",
    headers: SB_HEADERS,
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || `PATCH ${table} failed`);
  }
  return res.json();
}

async function sbDelete(table, query) {
  const res = await fetch(sbUrl(table, query), {
    method: "DELETE",
    headers: SB_HEADERS
  });
  if (!res.ok) throw new Error(`DELETE ${table} failed: ${res.status}`);
}

/// ============================================================
/// CLUB SESSION — which club is active
/// ============================================================

function getMyClub() {
  const id   = localStorage.getItem("kbrr_my_club_id")   || null;
  const name = localStorage.getItem("kbrr_my_club_name") || null;
  return { id, name };
}

function setMyClub(id, name) {
  localStorage.setItem("kbrr_my_club_id",   id);
  localStorage.setItem("kbrr_my_club_name", name);
}

function clearMyClub() {
  localStorage.removeItem("kbrr_my_club_id");
  localStorage.removeItem("kbrr_my_club_name");
}

/// ============================================================
/// PLAYERS API
/// ============================================================

/// Get all players for current club — uses cache if fresh
async function dbGetPlayers(forceFresh = false) {
  const now       = Date.now();
  const lastFetch = parseInt(localStorage.getItem(CACHE_TIMESTAMP) || "0");
  const cached    = localStorage.getItem(CACHE_PLAYERS);
  const club      = getMyClub();

  if (!forceFresh && cached && (now - lastFetch) < CACHE_TTL_MS) {
    return JSON.parse(cached);
  }

  try {
    let players;
    if (club.id) {
      // Get players linked to this club via club_members
      const members = await sbGet("club_members", `club_id=eq.${club.id}&select=player_id`);
      const ids = members.map(m => m.player_id);
      if (!ids.length) return [];
      const inList = `(${ids.map(id => `"${id}"`).join(",")})`;
      players = await sbGet("players", `id=in.${inList}&order=name.asc`);
    } else {
      // No club selected — get all players
      players = await sbGet("players", "order=name.asc");
    }

    // Normalize to local format
    const normalized = players.map(p => ({
      id:           p.id,
      name:         p.name,
      gender:       p.gender,
      rating:       parseFloat(p.rating) || 1.0,
      registeredDate: p.registered_date
    }));

    localStorage.setItem(CACHE_PLAYERS,   JSON.stringify(normalized));
    localStorage.setItem(CACHE_TIMESTAMP, String(Date.now()));
    return normalized;

  } catch (e) {
    console.warn("Supabase offline — using cached players:", e.message);
    return cached ? JSON.parse(cached) : [];
  }
}

/// Add a new player — requires admin session
async function dbAddPlayer(name, gender, _unused) {
  const club = getMyClub();
  if (!club.id) throw new Error("No club selected.");
  // Mode check done at login — trust session

  // Check duplicate
  const existing = await sbGet("players", `name=ilike.${encodeURIComponent(name.trim())}`);
  let player;

  if (existing.length) {
    player = existing[0];
  } else {
    // Create new global player
    const created = await sbPost("players", {
      name:   name.trim(),
      gender: gender,
      rating: 1.0
    });
    player = created[0];
  }

  // Link to club if not already linked
  try {
    await sbPost("club_members", {
      player_id: player.id,
      club_id:   club.id
    });
  } catch (e) {
    // Already linked — ignore
  }

  // Invalidate cache
  localStorage.removeItem(CACHE_PLAYERS);
  localStorage.removeItem(CACHE_TIMESTAMP);

  return player;
}

/// Sync ratings after each round — no password needed (game results are objective)
async function dbSyncRatings(updatedRatings) {
  for (const update of updatedRatings) {
    try {
      // Build patch payload — always update rating
      const patch = { rating: Math.round(update.rating * 10) / 10 };

      // Increment wins/losses using Supabase RPC if player had games this round
      if (update.wins > 0 || update.losses > 0) {
        // Fetch current wins/losses first then increment
        const rows = await sbGet("players", `name=ilike.${encodeURIComponent(update.name)}&select=id,wins,losses`);
        if (rows && rows.length) {
          patch.wins   = (rows[0].wins   || 0) + (update.wins   || 0);
          patch.losses = (rows[0].losses || 0) + (update.losses || 0);
        }
      }

      await sbPatch(
        "players",
        `name=ilike.${encodeURIComponent(update.name)}`,
        patch
      );
    } catch (e) {
      // Silent fail per player
    }
  }
  // Invalidate cache
  localStorage.removeItem(CACHE_PLAYERS);
  localStorage.removeItem(CACHE_TIMESTAMP);
}

/// Edit player — requires club admin password
async function dbEditPlayer(playerId, updates, clubAdminPassword) {
  const club = getMyClub();
  if (!club.id) throw new Error("No club selected.");

  const clubs = await sbGet("clubs", `id=eq.${club.id}&select=admin_password`);
  if (!clubs.length || clubs[0].admin_password !== clubAdminPassword)
    throw new Error("Wrong admin password.");

  await sbPatch("players", `id=eq.${playerId}`, updates);
  localStorage.removeItem(CACHE_PLAYERS);
  localStorage.removeItem(CACHE_TIMESTAMP);
}

/// Delete player from club — requires club admin password
async function dbDeletePlayer(playerId, clubAdminPassword) {
  const club = getMyClub();
  if (!club.id) throw new Error("No club selected.");

  const clubs = await sbGet("clubs", `id=eq.${club.id}&select=admin_password`);
  if (!clubs.length || clubs[0].admin_password !== clubAdminPassword)
    throw new Error("Wrong admin password.");

  // Remove from club only (keep global player record)
  await sbDelete("club_members", `player_id=eq.${playerId}&club_id=eq.${club.id}`);
  localStorage.removeItem(CACHE_PLAYERS);
  localStorage.removeItem(CACHE_TIMESTAMP);
}

/// ============================================================
/// CLUBS API
/// ============================================================

/// Get all clubs
async function dbGetClubs() {
  try {
    return await sbGet("clubs", "select=id,name,registered_date&order=name.asc");
  } catch (e) {
    return [];
  }
}

/// Create a new club
async function dbAddClub(clubName, selectPassword, adminPassword) {
  if (!clubName.trim()) throw new Error("Club name required.");
  if (!selectPassword)  throw new Error("Select password required.");
  if (!adminPassword)   throw new Error("Admin password required.");

  const created = await sbPost("clubs", {
    name:            clubName.trim(),
    select_password: selectPassword,
    admin_password:  adminPassword
  });
  return created[0];
}

/// Verify club select password — returns club if correct
async function dbVerifyClubAccess(clubId, selectPassword) {
  const clubs = await sbGet("clubs", `id=eq.${clubId}&select=id,name,select_password`);
  if (!clubs.length) throw new Error("Club not found.");
  if (clubs[0].select_password !== selectPassword) throw new Error("Wrong club password.");
  return clubs[0];
}

/// ============================================================
/// SYNC AFTER ROUND
/// ============================================================

async function githubSyncAfterRound(roundWins, roundLosses) {
  try {
    const updatedRatings = schedulerState.allPlayers.map(p => ({
      name:   p.name,
      rating: getRating(p.name),
      wins:   (roundWins   && roundWins.get(p.name))   || 0,
      losses: (roundLosses && roundLosses.get(p.name)) || 0
    }));
    await dbSyncRatings(updatedRatings);
  } catch (e) {
    // Silent fail
  }
}

/// ============================================================
/// CONNECTIVITY CHECK
/// ============================================================

async function dbIsOnline() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/clubs?limit=1`, {
      headers: SB_HEADERS
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function dbDeleteClub(clubId) {
  // Delete all club_members first
  await sbDelete("club_members", `club_id=eq.${clubId}`);
  // Then delete the club
  await sbDelete("clubs", `id=eq.${clubId}`);
}
