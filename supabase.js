/* ============================================================
   SUPABASE SERVICE LAYER
   Replaces supabase.js — same public API, Supabase backend
   ============================================================ */

const SUPABASE_URL = "https://plakuxwfrkswoqdigzng.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWt1eHdmcmtzd29xZGlnem5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNDY0NjIsImV4cCI6MjA4OTcyMjQ2Mn0.AJ0vC8bSGBsDNv1VvIUab7K4OEX7YeCxn595CA5mOfE";

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

async function sbUpsert(table, body, onConflict) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`;
  const res = await fetch(url, {
    method:  "POST",
    headers: { ...SB_HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal" },
    body:    JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `UPSERT ${table} failed: ${res.status}`);
  }
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

  // Invalidate cache if club has changed
  const cachedClubId = localStorage.getItem("kbrr_cache_club_id");
  const currentClubId = club.id ? String(club.id) : "none";
  if (cachedClubId !== currentClubId) {
    localStorage.removeItem(CACHE_PLAYERS);
    localStorage.removeItem(CACHE_TIMESTAMP);
    localStorage.setItem("kbrr_cache_club_id", currentClubId);
  }

  if (!forceFresh && cached && cachedClubId === currentClubId && (now - lastFetch) < CACHE_TTL_MS) {
    return JSON.parse(cached);
  }

  try {
    let players;
    if (club.id) {
      players = await sbGet("players", `club_id=eq.${club.id}&order=nickname.asc&select=id,nickname,gender,rating,club_rating,wins,losses,sessions,user_account_id`);
    } else {
      players = await sbGet("players", "order=nickname.asc&select=id,nickname,gender,rating,club_rating,wins,losses,sessions,user_account_id");
    }

    // Normalize to local format
    const normalized = players.map(p => {
      return {
        id:          p.id,
        name:        p.nickname,
        gender:      p.gender,
        rating:      parseFloat(p.rating)      || 1.0,
        clubRating:  parseFloat(p.club_rating) || 1.0,
        wins:        p.wins   || 0,
        losses:      p.losses || 0,
        userAccountId: p.user_account_id
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

  // Check duplicate nickname in this club
  const existing = await sbGet("players",
    `club_id=eq.${club.id}&nickname=ilike.${encodeURIComponent(name.trim())}&select=id`);
  if (existing.length) throw new Error("Player already exists in this club.");

  // Create player directly with club_id
  const created = await sbPost("players", {
    club_id:     club.id,
    nickname:    name.trim(),
    gender:      gender,
    rating:      1.0,
    club_rating: 1.0
  });
  const player = created[0];

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

  const ratingField = localStorage.getItem("kbrr_rating_field") || "club_rating";
  const failed = [];

  for (const update of pending) {
    try {
      const rounded = Math.round(update.activeRating * 10) / 10;
      const rows = await sbGet("players",
        `club_id=eq.${club.id}&nickname=ilike.${encodeURIComponent(update.name)}&select=id,wins,losses,club_rating`
      );
      if (!rows || !rows.length) continue;
      const row   = rows[0];
      const patch = {};

      // Always write to club_rating (float) — this is the actual column
      patch.club_rating = rounded;

      if (update.wins > 0 || update.losses > 0) {
        patch.wins   = (row.wins   || 0) + (update.wins   || 0);
        patch.losses = (row.losses || 0) + (update.losses || 0);
      }

      if (Object.keys(patch).length) {
        await sbPatch("players", `club_id=eq.${club.id}&nickname=ilike.${encodeURIComponent(update.name)}`, patch);
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
  const ratingField = localStorage.getItem("kbrr_rating_field") || "club_rating";
  const failed = [];

  for (const update of updatedRatings) {
    try {
      const rounded = Math.round(update.activeRating * 10) / 10;

      const rows = await sbGet("players",
        `club_id=eq.${club.id}&nickname=ilike.${encodeURIComponent(update.name)}&select=id,wins,losses,club_rating`
      );
      if (!rows || !rows.length) continue;
      const row   = rows[0];
      const patch = {};

      // Always write to club_rating (float) — this is the actual column
      patch.club_rating = rounded;

      if (update.wins > 0 || update.losses > 0) {
        patch.wins   = (row.wins   || 0) + (update.wins   || 0);
        patch.losses = (row.losses || 0) + (update.losses || 0);
      }

      if (Object.keys(patch).length) {
        await sbPatch("players", `club_id=eq.${club.id}&nickname=ilike.${encodeURIComponent(update.name)}`, patch);
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
  const ratingField = localStorage.getItem("kbrr_rating_field") || "club_rating";
  const patch       = {};

  // Write to club_rating (float) — actual column in players table
  patch.club_rating = rounded;

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

  // Delete player row directly (club_id is on the player row)
  await sbDelete("players", `id=eq.${playerId}&club_id=eq.${club.id}`);
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
    return await sbGet("clubs", "select=id,name&order=name.asc");
  } catch (e) {
    return [];
  }
}

/// Create a new club
async function dbAddClub(clubName, selectPassword, adminPassword, registrationEmail) {
  if (!clubName.trim()) throw new Error('Club name required.');
  if (!selectPassword)  throw new Error('Select password required.');
  if (!adminPassword)   throw new Error('Admin password required.');

  const payload = {
    name:            clubName.trim(),
    select_password: selectPassword,
    admin_password:  adminPassword
  };
  if (registrationEmail) payload.registration_email = registrationEmail.trim().toLowerCase();

  const created = await sbPost('clubs', payload);
  return created[0];
}

/* ── OTP via Supabase Auth ── */
async function dbSendOtp(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
    body: JSON.stringify({
      email:       email.trim().toLowerCase(),
      create_user: true,
      options: { shouldCreateUser: true }
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.msg || err.message || 'Failed to send OTP');
  }
  return true;
}

async function dbVerifyOtp(email, token) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
    body: JSON.stringify({ email: email.trim().toLowerCase(), token: token.trim(), type: 'email' })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.msg || err.message || 'Invalid or expired OTP');
  }
  return true;
}

/* ── Get club registration email (masked for display) ── */
async function dbGetClubRegEmail(clubId) {
  const rows = await sbGet('clubs', `id=eq.${clubId}&select=registration_email`);
  if (!rows || !rows.length) throw new Error('Club not found.');
  return rows[0].registration_email || null;
}

function maskEmail(email) {
  if (!email) return '';
  const [user, domain] = email.split('@');
  const masked = user[0] + '***' + (user.length > 1 ? user.slice(-1) : '');
  return masked + '@' + domain;
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

    // STEP 2 — Write live session to Supabase live_sessions table
    await syncLiveSession(playedNames);

    // Pull fresh — syncToLocal will also flush any queued items
    await syncToLocal();

  } catch (e) {
    console.error("syncAfterRound error:", e.message);
  }
}

async function syncSessionAfterRound(playedNames) {
  // Session data saved on End Session only
}

/// ============================================================
/// LIVE SESSIONS
/// Temporary per-round session data stored in live_sessions table.
/// Flushed to players.sessions on End Session or after 1hr idle.
/// Visible to all club members in real time via profile card.
/// ============================================================

async function syncLiveSession(playedNames) {
  try {
    const club = getMyClub();
    if (!club.id) return;

    const today     = new Date().toISOString().split("T")[0];
    const players   = schedulerState.allPlayers || [];
    const genderMap = new Map();
    players.forEach(p => genderMap.set(p.name, p.gender || "Male"));

    // Build per-player match history from ALL rounds this session
    const playerMatches = new Map();
    for (const round of (allRounds || [])) {
      const games = round.games || round;
      for (const game of (games || [])) {
        if (!game.winner) continue;
        const leftWon = game.winner === "L";
        const pair1   = game.pair1 || [];
        const pair2   = game.pair2 || [];
        for (const p of pair1) {
          if (!playerMatches.has(p)) playerMatches.set(p, []);
          playerMatches.get(p).push({
            partner:         pair1.filter(x => x !== p),
            partnerGenders:  pair1.filter(x => x !== p).map(n => genderMap.get(n) || "Male"),
            opponents:       pair2,
            opponentGenders: pair2.map(n => genderMap.get(n) || "Male"),
            result:          leftWon ? "W" : "L"
          });
        }
        for (const p of pair2) {
          if (!playerMatches.has(p)) playerMatches.set(p, []);
          playerMatches.get(p).push({
            partner:         pair2.filter(x => x !== p),
            partnerGenders:  pair2.filter(x => x !== p).map(n => genderMap.get(n) || "Male"),
            opponents:       pair1,
            opponentGenders: pair1.map(n => genderMap.get(n) || "Male"),
            result:          leftWon ? "L" : "W"
          });
        }
      }
    }

    // started_by — same for all rows, resolve once outside the map
    const myPlayer  = (typeof getMyPlayer === "function") ? getMyPlayer() : null;
    const startedBy = myPlayer ? myPlayer.name : null;

    // Upsert all played players in parallel
    const upserts = players
      .filter(p => playedNames.has(p.name) && (playerMatches.get(p.name) || []).length)
      .map(p => {
        const matches = playerMatches.get(p.name);
        const wins    = matches.filter(m => m.result === "W").length;
        const losses  = matches.filter(m => m.result === "L").length;

        const row = {
          player_name: p.name,
          club_id:     club.id,
          date:        today,
          wins,
          losses,
          rating:      getActiveRating(p.name),
          matches,
          started_by:  startedBy,
          updated_at:  new Date().toISOString()
        };
        return sbUpsert("live_sessions", row, "player_name,club_id,date").catch(() => {});
      });

    await Promise.all(upserts);
  } catch (e) {
    console.warn("syncLiveSession error:", e.message);
  }
}


/// ============================================================
/// SESSIONS TABLE — stores last 3 sessions per club
/// status: 'live' while session active, 'completed' on end
/// rounds_data: full allRounds snapshot, updated on every change
/// players: summary of who played + wins/losses (populated on complete)
/// ============================================================

// Session ID for this organiser's current session — stored in sessionStorage
function getMySessionId() {
  return sessionStorage.getItem('kbrr_session_db_id') || null;
}
function setMySessionId(id) {
  if (id) sessionStorage.setItem('kbrr_session_db_id', id);
  else sessionStorage.removeItem('kbrr_session_db_id');
}

// Called once when organiser starts session (first round created)
// Multiple live sessions allowed per club — one per hall/organiser
async function dbStartSession() {
  try {
    const club      = getMyClub();
    if (!club.id) return;
    const myPlayer  = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;
    const startedBy = myPlayer ? myPlayer.name : null;
    const today     = new Date().toISOString().split('T')[0];

    // Insert new live session — no uniqueness constraint, multiple allowed
    const created = await sbPost('sessions', {
      club_id:     club.id,
      date:        today,
      started_by:  startedBy,
      status:      'live',
      rounds_data: [],
      players:     [],
      updated_at:  new Date().toISOString()
    });

    // Store this session's DB id so we can update/complete exactly this row
    const sessionDbId = created && created[0] ? created[0].id : null;
    setMySessionId(sessionDbId);
  } catch (e) {
    console.warn('dbStartSession error:', e.message);
  }
}

// Called on every round create + every winner mark
// Updates only THIS organiser's session row by id
async function dbSyncRoundsData() {
  try {
    const sessionDbId = getMySessionId();
    if (!sessionDbId) return;

    const roundsData = (allRounds || []).map(r => ({
      round:   r.round,
      resting: r.resting || [],
      games:   (r.games || []).map(g => ({
        pair1:  g.pair1,
        pair2:  g.pair2,
        winner: g.winner || null,
        court:  g.court  || null
      }))
    }));

    await sbPatch('sessions',
      `id=eq.${sessionDbId}`,
      { rounds_data: roundsData, updated_at: new Date().toISOString() }
    );
  } catch (e) {
    console.warn('dbSyncRoundsData error:', e.message);
  }
}

// Called on End Session — mark this session completed, keep last 3 per club
async function dbCompleteSession() {
  try {
    const sessionDbId = getMySessionId();
    const club        = getMyClub();
    if (!sessionDbId || !club.id) return;

    // Build player summary
    const players = (schedulerState.allPlayers || []).map(p => ({
      name:   p.name,
      wins:   schedulerState.winCount    ? (schedulerState.winCount.get(p.name)   || 0) : 0,
      losses: schedulerState.PlayedCount
        ? Math.max(0, (schedulerState.PlayedCount.get(p.name) || 0) -
            (schedulerState.winCount ? (schedulerState.winCount.get(p.name) || 0) : 0))
        : 0
    }));

    // Mark this session completed
    await sbPatch('sessions', `id=eq.${sessionDbId}`, {
      status:     'completed',
      players,
      updated_at: new Date().toISOString()
    });

    // Keep only last 3 completed sessions per club — delete older ones
    const all = await sbGet('sessions',
      `club_id=eq.${club.id}&status=eq.completed&order=updated_at.desc&select=id`
    );
    if (all && all.length > 3) {
      const toDelete = all.slice(3).map(s => s.id);
      for (const id of toDelete) {
        await sbDelete('sessions', `id=eq.${id}`).catch(() => {});
      }
    }

    setMySessionId(null);
  } catch (e) {
    console.warn('dbCompleteSession error:', e.message);
  }
}

// Auto-cleanup stale live sessions — mark completed if older than 3 hours
async function dbCleanupStaleSessions() {
  try {
    const club = getMyClub();
    if (!club.id) return;
    const rows = await sbGet('sessions',
      `club_id=eq.${club.id}&status=eq.live&select=id,created_at`
    );
    if (!rows || !rows.length) return;
    const threeHoursAgo = Date.now() - (3 * 60 * 60 * 1000);
    for (const sess of rows) {
      const age = new Date(sess.created_at).getTime();
      if (age < threeHoursAgo) {
        await sbPatch('sessions', `id=eq.${sess.id}`, {
          status:     'completed',
          updated_at: new Date().toISOString()
        }).catch(() => {});
      }
    }
  } catch (e) { /* silent */ }
}

/* Force complete any session by ID — for ending stale/other-device sessions */
async function dbForceCompleteSession(sessionId) {
  try {
    await sbPatch('sessions', `id=eq.${sessionId}`, {
      status:     'completed',
      updated_at: new Date().toISOString()
    });
    // Keep only last 3 completed per club
    const club = getMyClub();
    if (club.id) {
      const all = await sbGet('sessions',
        `club_id=eq.${club.id}&status=eq.completed&order=updated_at.desc&select=id`
      );
      if (all && all.length > 3) {
        const toDelete = all.slice(3).map(s => s.id);
        for (const id of toDelete) {
          await sbDelete('sessions', `id=eq.${id}`).catch(() => {});
        }
      }
    }
  } catch (e) {
    console.warn('dbForceCompleteSession error:', e.message);
  }
}

// Fetch ALL live sessions for this club (multiple halls)
/* ── Get all club IDs a player belongs to ── */
async function dbGetPlayerClubs(playerName) {
  try {
    if (!playerName) return [];
    // Players table has club_id directly — get all clubs this nickname appears in
    const rows = await sbGet('players',
      `nickname=ilike.${encodeURIComponent(playerName)}&select=club_id`
    );
    return (rows || []).map(r => r.club_id).filter(Boolean);
  } catch (e) {
    return [];
  }
}

async function dbGetLiveSessions() {
  try {
    const isViewer = (typeof appMode !== 'undefined') && appMode === 'viewer';

    if (isViewer) {
      // Viewer — show sessions from all clubs the player belongs to
      const myPlayer = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;
      if (!myPlayer) return [];
      const clubIds = await dbGetPlayerClubs(myPlayer.name);
      if (!clubIds.length) return [];
      const inList = '(' + clubIds.join(',') + ')';
      const rows = await sbGet('sessions',
        `club_id=in.${inList}&status=eq.live&order=created_at.asc&select=id,rounds_data,started_by,updated_at,club_id`
      );
      return rows || [];
    } else {
      // Organiser — show sessions for their selected club
      const club = getMyClub();
      if (!club.id) return [];
      const rows = await sbGet('sessions',
        `club_id=eq.${club.id}&status=eq.live&order=created_at.asc&select=id,rounds_data,started_by,updated_at`
      );
      return rows || [];
    }
  } catch (e) {
    return [];
  }
}

// Fetch last 3 completed sessions for dashboard
async function dbGetPastSessions() {
  try {
    const isViewer = (typeof appMode !== 'undefined') && appMode === 'viewer';

    if (isViewer) {
      const myPlayer = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;
      if (!myPlayer) return [];
      const clubIds = await dbGetPlayerClubs(myPlayer.name);
      if (!clubIds.length) return [];
      const inList = '(' + clubIds.join(',') + ')';
      const rows = await sbGet('sessions',
        `club_id=in.${inList}&status=eq.completed&order=updated_at.desc&limit=5&select=id,date,started_by,players,rounds_data,updated_at,club_id`
      );
      return rows || [];
    } else {
      const club = getMyClub();
      if (!club.id) return [];
      const rows = await sbGet('sessions',
        `club_id=eq.${club.id}&status=eq.completed&order=updated_at.desc&limit=3&select=id,date,started_by,players,rounds_data,updated_at`
      );
      return rows || [];
    }
  } catch (e) {
    return [];
  }
}

// ============================================================
// SAVE ROUNDS TO DB — called on every round create + winner mark
// Syncs full allRounds snapshot to sessions table for viewer rendering
// ============================================================
async function saveRoundsToDb() {
  await dbSyncRoundsData();
}

// Flush live_sessions → players.sessions for all players in this club, then delete
async function flushLiveSession() {
  try {
    const club = getMyClub();
    if (!club.id) return;

    const today = new Date().toISOString().split("T")[0];
    const rows  = await sbGet("live_sessions",
      `club_id=eq.${club.id}&date=eq.${today}`);
    if (!rows || !rows.length) return;

    // Write all players in parallel — no sequential awaits
    const writes = rows
      .filter(row => row.player_name !== '__rounds__')  // skip sentinel row
      .map(async row => {
      const matches = typeof row.matches === "string"
        ? JSON.parse(row.matches) : (row.matches || []);
      if (!matches.length) return;

      // Write to players.sessions — merge with existing today entry if present
      try {
        const playerRows = await sbGet("players",
          `club_id=eq.${club.id}&nickname=ilike.${encodeURIComponent(row.player_name)}&select=id,sessions`);
        if (playerRows && playerRows.length) {
          const existing   = playerRows[0].sessions || [];
          const todayEntry = existing.find(s => s.date === today);
          const otherDays  = existing.filter(s => s.date !== today);

          // Merge matches — append new ones, avoiding exact duplicates
          const prevMatches = todayEntry ? (todayEntry.matches || []) : [];
          const allMatches  = [...prevMatches, ...matches];
          const mergedWins   = allMatches.filter(m => m.result === "W").length;
          const mergedLosses = allMatches.filter(m => m.result === "L").length;

          const entry = {
            date:    row.date,
            wins:    mergedWins,
            losses:  mergedLosses,
            rating:  parseFloat(row.rating) || 1.0,  // latest rating
            matches: allMatches
          };

          const updated = [entry, ...otherDays].slice(0, 3);
          await sbPatch("players",
            `club_id=eq.${club.id}&nickname=ilike.${encodeURIComponent(row.player_name)}`, { sessions: updated });

          // Mirror to localStorage
          try {
            const lsKey = `kbrr_sessions_${row.player_name.toLowerCase().replace(/\s+/g, "_")}`;
            const lsExisting  = JSON.parse(localStorage.getItem(lsKey) || "[]");
            const lsOtherDays = lsExisting.filter(s => s.date !== today);
            localStorage.setItem(lsKey, JSON.stringify([entry, ...lsOtherDays].slice(0, 3)));
          } catch(e) {}
        }
      } catch(e) { /* continue */ }
    });

    // Wait for all writes with a 10s timeout — never hang End Session
    await Promise.race([
      Promise.allSettled(writes),
      new Promise(resolve => setTimeout(resolve, 10000))
    ]);

    // Delete live rows regardless of write success
    await sbDelete("live_sessions", `club_id=eq.${club.id}&date=eq.${today}`);

  } catch (e) {
    console.warn("flushLiveSession error:", e.message);
  }
}

// Delete stale live_sessions rows older than today for this club
async function cleanupLiveSessions() {
  try {
    const club  = getMyClub();
    if (!club.id) return;
    const today = new Date().toISOString().split("T")[0];
    await sbDelete("live_sessions", `club_id=eq.${club.id}&date=lt.${today}`);
  } catch (e) {
    console.warn("cleanupLiveSessions error:", e.message);
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
    const club = getMyClub();
    if (!club.id) return;
    const raw = await sbGet("players", `club_id=eq.${club.id}&order=nickname.asc&select=nickname,gender,rating,club_rating`);
    const players = raw.map(p => ({
      displayName: p.nickname,
      gender:      p.gender || "Male",
      rating:      parseFloat(p.rating)      || 1.0,
      clubRating:  parseFloat(p.club_rating) || 1.0
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
  // Delete all players in this club first, then the club
  await sbDelete("players", `club_id=eq.${clubId}`);
  await sbDelete("clubs",   `id=eq.${clubId}`);
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
      await sbPatch("players", `club_id=eq.${club.id}&nickname=ilike.${encodeURIComponent(name)}`, {
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
      await sbPatch("players", `club_id=eq.${club.id}&nickname=ilike.${encodeURIComponent(name)}`, {
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
      `is_playing=eq.true&session_id=neq.${SESSION_ID}&session_started_at=gte.${cutoff}&select=nickname,session_id`
    );
    return new Set((rows || []).map(r => r.nickname.trim().toLowerCase()));
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
