/* ============================================================
   SUPABASE SERVICE LAYER
   Replaces supabase.js — same public API, Supabase backend
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
      players = await sbGet("players", `id=in.${inList}&order=name.asc&select=id,name,gender,rating,registered_date,club_ratings`);
    } else {
      players = await sbGet("players", "order=name.asc&select=id,name,gender,rating,registered_date,club_ratings");
    }

    // Normalize to local format
    const normalized = players.map(p => {
      const clubRatings = p.club_ratings || {};
      // club.id from localStorage is always a string — keys written as String(club.id)
      const clubRating = club.id
        ? (parseFloat(clubRatings[String(club.id)]) || 1.0)
        : 1.0;
      return {
        id:           p.id,
        name:         p.name,
        gender:       p.gender,
        rating:       parseFloat(p.rating) || 1.0,
        clubRating,
        club_ratings: clubRatings,
        registeredDate: p.registered_date
      };
    });

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
  const alreadyLinked = await sbGet("club_members", `player_id=eq.${player.id}&club_id=eq.${club.id}`);
  if (!alreadyLinked.length) {
    await sbPost("club_members", {
      player_id: player.id,
      club_id:   club.id
    });
  } else {
    throw new Error("Player already exists in this club.");
  }

  // Invalidate cache + refresh immediately
  localStorage.removeItem(CACHE_PLAYERS);
  localStorage.removeItem(CACHE_TIMESTAMP);
  if (typeof syncToLocal === "function") await syncToLocal();

  return player;
}

/* ============================================================
   OFFLINE SYNC QUEUE
   When DB write fails, push to queue. Flush on next online sync.
   Key: kbrr_sync_queue — array of pending rating updates.
============================================================ */
const SYNC_QUEUE_KEY = "kbrr_sync_queue";

function queuePush(updates) {
  try {
    const q = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || "[]");
    updates.forEach(u => q.push({ ...u, timestamp: Date.now() }));
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(q));
  } catch(e) { console.error("queuePush error", e); }
}

function queueClear() {
  localStorage.removeItem(SYNC_QUEUE_KEY);
}

function queueGet() {
  try {
    return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || "[]");
  } catch(e) { return []; }
}

/* Flush pending queue to Supabase — called at start of every sync */
async function flushSyncQueue() {
  const pending = queueGet();
  if (!pending.length) return;

  const club = getMyClub();
  if (!club.id) return;

  const ratingField = localStorage.getItem("kbrr_rating_field") || "club_ratings";
  const failed = [];

  for (const update of pending) {
    try {
      const rounded = Math.round(update.activeRating * 10) / 10;
      const rows = await sbGet("players",
        `name=ilike.${encodeURIComponent(update.name)}&select=id,wins,losses,club_ratings`
      );
      if (!rows || !rows.length) continue;
      const row   = rows[0];
      const patch = {};

      if (ratingField === "club_ratings") {
        const existing = row.club_ratings || {};
        existing[String(club.id)] = rounded;
        patch.club_ratings = existing;
      } else {
        patch.rating = rounded;
      }

      if (update.wins > 0 || update.losses > 0) {
        patch.wins   = (row.wins   || 0) + (update.wins   || 0);
        patch.losses = (row.losses || 0) + (update.losses || 0);
      }

      if (Object.keys(patch).length) {
        await sbPatch("players", `name=ilike.${encodeURIComponent(update.name)}`, patch);
      }
    } catch(e) {
      failed.push(update); // keep failed items for next retry
    }
  }

  // Replace queue with only failed items
  if (failed.length) {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(failed));
    console.warn(`flushSyncQueue: ${failed.length} item(s) still pending`);
  } else {
    queueClear();
  }
}

/* ============================================================
   dbSyncRatings — ONLY write gate for ratings.
   Reads kbrr_rating_field — writes to one column only.
   On failure — pushes to offline queue for retry.
============================================================ */
async function dbSyncRatings(updatedRatings) {
  const club = getMyClub();
  if (!club.id) return;

  // kbrr_rating_field set at login — "club_ratings" or "rating"
  const ratingField = localStorage.getItem("kbrr_rating_field") || "club_ratings";
  const failed = [];

  for (const update of updatedRatings) {
    try {
      const rounded = Math.round(update.activeRating * 10) / 10;

      const rows = await sbGet("players",
        `name=ilike.${encodeURIComponent(update.name)}&select=id,wins,losses,club_ratings`
      );
      if (!rows || !rows.length) continue;
      const row   = rows[0];
      const patch = {};

      if (ratingField === "club_ratings") {
        const existing = row.club_ratings || {};
        existing[String(club.id)] = rounded;
        patch.club_ratings = existing;
      } else {
        patch.rating = rounded;
      }

      if (update.wins > 0 || update.losses > 0) {
        patch.wins   = (row.wins   || 0) + (update.wins   || 0);
        patch.losses = (row.losses || 0) + (update.losses || 0);
      }

      if (Object.keys(patch).length) {
        await sbPatch("players", `name=ilike.${encodeURIComponent(update.name)}`, patch);
      }
    } catch(e) {
      console.warn("dbSyncRatings offline for", update.name, "— queued");
      failed.push(update);
    }
  }

  if (failed.length) queuePush(failed);

  localStorage.removeItem(CACHE_PLAYERS);
  localStorage.removeItem(CACHE_TIMESTAMP);
}


/// Override rating — writes to correct field based on kbrr_rating_field
async function dbOverrideRating(playerId, newRating) {
  const club        = getMyClub();
  const rounded     = Math.round(newRating * 10) / 10;
  const ratingField = localStorage.getItem("kbrr_rating_field") || "club_ratings";
  const patch       = {};

  if (ratingField === "club_ratings" && club.id) {
    const rows = await sbGet("players", `id=eq.${playerId}&select=club_ratings`);
    const existing = (rows && rows[0] && rows[0].club_ratings) || {};
    existing[String(club.id)] = rounded;
    patch.club_ratings = existing;
  } else {
    patch.rating = rounded;
  }

  await sbPatch("players", `id=eq.${playerId}`, patch);
  localStorage.removeItem(CACHE_PLAYERS);
  localStorage.removeItem(CACHE_TIMESTAMP);
  // Refresh immediately so all displays show new value
  if (typeof syncToLocal === "function") await syncToLocal();
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
  if (typeof syncToLocal === "function") await syncToLocal();
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

async function syncAfterRound(roundWins, roundLosses) {
  try {
    // STEP 1 — Push: send updated ratings + wins/losses to Supabase
    const playedNames = new Set([...roundWins.keys(), ...roundLosses.keys()]);
    const updatedRatings = schedulerState.allPlayers
      .filter(p => playedNames.has(p.name))
      .map(p => ({
        name:         p.name,
        activeRating: getActiveRating(p.name),  // single door — mode-blind
        wins:         (roundWins   && roundWins.get(p.name))   || 0,
        losses:       (roundLosses && roundLosses.get(p.name)) || 0
      }));

    await dbSyncRatings(updatedRatings);

    // STEP 2 — Sync running session totals after every round
    await syncSessionAfterRound(playedNames);

    // Pull fresh — syncToLocal will also flush any queued items
    await syncToLocal();

  } catch (e) {
    console.error("syncAfterRound error:", e.message);
  }
}

async function syncSessionAfterRound(playedNames) {
  try {
    const today   = new Date().toISOString().split("T")[0];
    const players = schedulerState.allPlayers || [];

    for (const p of players) {
      if (!playedNames.has(p.name)) continue;

      // Accumulate wins/losses from allRounds so far this session
      let totalWins = 0, totalLosses = 0;
      for (const round of (allRounds || [])) {
        const games = round.games || round;
        for (const game of (games || [])) {
          if (!game.winner) continue;
          const inLeft  = (game.pair1 || []).includes(p.name);
          const inRight = (game.pair2 || []).includes(p.name);
          if (!inLeft && !inRight) continue;
          const won = (game.winner === "L" && inLeft) || (game.winner === "R" && inRight);
          if (won) totalWins++; else totalLosses++;
        }
      }

      const entry = {
        date:   today,
        wins:   totalWins,
        losses: totalLosses,
        rating: getActiveRating(p.name)
      };

      // Upsert to player_sessions (today's row)
      if (typeof savePlayerSession === "function") {
        savePlayerSession(p.name, entry).catch(() => {});
      }
    }
  } catch (e) {
    console.warn("syncSessionAfterRound error:", e.message);
  }
}

/// ============================================================
/// GLOBAL PLAYERS CACHE
/// Stores all global players in localStorage so imports work
/// offline and without repeated Supabase calls.
/// Refreshed on app load and after every round.
/// ============================================================

const CACHE_GLOBAL_PLAYERS = "kbrr_cache_global_players";

async function syncGlobalPlayersCache() {
  try {
    const raw = await sbGet("players", "order=name.asc");
    const players = raw.map(p => ({
      displayName: p.name,
      gender:      p.gender || "Male",
      rating:      parseFloat(p.rating) || 1.0
    }));
    localStorage.setItem(CACHE_GLOBAL_PLAYERS, JSON.stringify(players));
  } catch (e) {
    // Silent fail — cache stays as-is if offline
  }
}

function getGlobalPlayersCache() {
  try {
    const raw = localStorage.getItem(CACHE_GLOBAL_PLAYERS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
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

/// ============================================================
/// SESSION SLOT TRACKING — Update 3
/// Marks players as is_playing when they join a session.
/// Released on session end or after SESSION_TIMEOUT_HOURS.
/// ============================================================

const SESSION_ID         = `session_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
const SESSION_TIMEOUT_MS = 6 * 60 * 60 * 1000; // 6 hours auto-release

/// Mark a list of players as playing in this session
async function dbClaimSessionSlots(playerNames) {
  const club = getMyClub();
  if (!club.id) return;
  const now = new Date().toISOString();
  for (const name of playerNames) {
    try {
      await sbPatch("players", `name=ilike.${encodeURIComponent(name)}`, {
        is_playing:          true,
        session_id:          SESSION_ID,
        session_started_at:  now
      });
    } catch(e) { /* silent per player */ }
  }
  localStorage.removeItem(CACHE_PLAYERS);
  localStorage.removeItem(CACHE_TIMESTAMP);
}

/// Release session slots for a list of players
async function dbReleaseSessionSlots(playerNames) {
  for (const name of playerNames) {
    try {
      await sbPatch("players", `name=ilike.${encodeURIComponent(name)}`, {
        is_playing:         false,
        session_id:         null,
        session_started_at: null
      });
    } catch(e) { /* silent per player */ }
  }
  localStorage.removeItem(CACHE_PLAYERS);
  localStorage.removeItem(CACHE_TIMESTAMP);
}

/// Release only slots owned by this session (safe cleanup on unload)
async function dbReleaseMySession() {
  try {
    await sbPatch("players", `session_id=eq.${SESSION_ID}`, {
      is_playing:         false,
      session_id:         null,
      session_started_at: null
    });
  } catch(e) { /* silent */ }
}

/// Check which players are currently available (not playing elsewhere)
/// Returns a Set of names that are unavailable (playing in another session)
async function dbGetUnavailablePlayers() {
  try {
    const cutoff = new Date(Date.now() - SESSION_TIMEOUT_MS).toISOString();
    // Players marked as playing, not in our session, and not timed out
    const rows = await sbGet("players",
      `is_playing=eq.true&session_id=neq.${SESSION_ID}&session_started_at=gte.${cutoff}&select=name,session_id`
    );
    return new Set((rows || []).map(r => r.name.trim().toLowerCase()));
  } catch(e) {
    return new Set(); // fail open — don't block if offline
  }
}

/// ============================================================
/// PLAYER SESSIONS — stored in player_sessions table
/// Table: player_sessions (player_name text, date text, wins int, losses int, rating float)
/// ============================================================

async function savePlayerSession(playerName, entry) {
  // Upsert by player_name + date (same day = overwrite)
  // First check if row exists for this player+date
  const existing = await sbGet(
    "player_sessions",
    `player_name=ilike.${encodeURIComponent(playerName)}&date=eq.${entry.date}&select=id`
  );

  if (existing && existing.length) {
    // Update existing row
    await sbPatch(
      "player_sessions",
      `player_name=ilike.${encodeURIComponent(playerName)}&date=eq.${entry.date}`,
      { wins: entry.wins, losses: entry.losses, rating: entry.rating }
    );
  } else {
    // Insert new row
    await sbPost("player_sessions", {
      player_name: playerName,
      date:        entry.date,
      wins:        entry.wins,
      losses:      entry.losses,
      rating:      entry.rating
    });
  }
}

async function getPlayerSessions(playerName) {
  try {
    const rows = await sbGet(
      "player_sessions",
      `player_name=ilike.${encodeURIComponent(playerName)}&order=date.desc&limit=10`
    );
    return rows || [];
  } catch (e) {
    return [];
  }
}
