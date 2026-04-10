# KariBRR / CLUB Scheduler — Session Journal
**Last updated:** March 31, 2026
**Current build:** App_Settings.zip (sw v62)
**Source:** `/home/claude/Working/Update-main/`

---

## Current App State

### Stack
- Vanilla HTML/JS/CSS
- Supabase (`hplkoxdorbfjhwbvqatn.supabase.co`)
- Capacitor Android
- Play Store: `com.samkarikalan.badmintonscheduler`
- Keystore: `~/KBRR/Final/clubscheduler.jks`, alias `clubscheduler`

### DB Schema (confirmed current)
```
players:            id, name, gender, global_rating, global_points, wins, losses, sessions(jsonb), default_password
memberships:        id, player_id, club_id, nickname, club_rating, club_points, is_playing, user_account_id
clubs:              id, name, select_password, admin_password
user_accounts:      id, user_id, nickname, email, password_hash, recovery_word
sessions:           id, club_id, date, started_by, status, rounds_data, players, updated_at, shuttle_data
matches:            id, session_id, club_id, round_number, pair1_player1/2, pair2_player1/2, winner_pair, rating_delta, points_delta, played_at
club_join_requests: id, club_id, user_account_id, nickname, status, requested_at, reviewed_at
```
All tables: RLS `allow_all` policy.

---

## Completed This Session (March 31, 2026)

### Club & Auth Fixes
- Auto-link memberships on claim — links ALL clubs with same nickname
- Join Club page rebuilt — shows all linked clubs + search below
- My Clubs tile shows `Test · test3` (dot separated)
- Nickname conflict on Join → auto-link if membership has null user_account_id
- `authAfterLogin` — queries memberships by `user_account_id` → auto-selects club or shows picker
- Vault register — checks `user_accounts` by nickname → auto-links `user_account_id` on registration

### Algorithm Restored (IMPORTANT)
- Restored original algorithm from uploaded `APP-main.zip`
- `competitive_algorithm.js` completely replaced with old `games.js` functions
- Key functions restored:
  - `AischedulerNextRound` — original version
  - `reorderFreePlayersByLastRound` — spreads last-round players across different courts
  - `findDisjointPairs` — DFS, fresh pairs first + opponent freshness bonus
  - `getMatchupScores` — scores court matchups by unseen opponent face-offs
  - `_pairKey` — helper kept for rounds.js compatibility
- `createRestQueue` — restored to raw input order (no rating sort)
- **Verified:** 5-6 rounds tested, zero court group repeats in both Random and Competitive modes

### Home Screen & Settings
- Mode tab bar removed from home screen
- Free trial banner moved to Settings page
- Settings page reordered:
  1. Subscription (trial status + current mode merged)
  2. Language
  3. Appearance (Theme + Font Size + Tile Style + Live Preview — all merged)
  4. Reset
- **Tile Style system:**
  - 3 styles: Flat / Glow / Color
  - Live preview inside Settings — updates instantly on tap
  - Body classes: `tile-style-glow`, `tile-style-color`
  - Saved to `localStorage('kbrr_tile_style')`
  - Covers home tiles + vault tiles app-wide
  - Tested: 31/31 checks passed

---

## Pending Items

### High Priority
1. **Server-side architecture (banking model)**
   - Move pairing algorithm to Supabase Edge Functions
   - Move all DB access server-side
   - Client only calls API endpoints — never touches Supabase directly
   - Protects IP from LLM-assisted copying
   - Priority order:
     - Phase 1: Move `AischedulerNextRound` + rating logic to Edge Function
     - Phase 2: Move all `sbGet/sbPost/sbPatch` server-side
     - Phase 3: Auth via Edge Functions
   - **This is needed before PWA/iPhone release**

2. **PWA for iPhone**
   - Cannot release until server-side architecture done
   - Risk: full source code exposed in browser
   - JS obfuscation as temporary measure if needed urgently

### Medium Priority
3. **Round red border false positive bug**
   - Waiting for reproduction steps from user

4. **Vault registration — email field**
   - Admin should be able to enter player email at registration
   - Auto-links `user_account_id` immediately via email lookup
   - More reliable than nickname matching

5. **Match history end-to-end verification**
   - `players.sessions` period stats not fully verified after complete session

### Low Priority / Style
6. **Tile style coverage**
   - Glow/Color styles cover home + vault tiles
   - Could extend to: dashboard cards, match cards, profile cards
   - CSS already structured for easy extension

---

## Architecture Decision — Server Side

### The Problem
LLMs make source code copying trivial. PWA exposes everything.

### The Solution
Supabase Edge Functions as API layer:

```
App (client)              Edge Function (server)      Supabase DB
────────────              ──────────────────────      ───────────
POST /next-round    →     AischedulerNextRound   →    reads players
                   ←      returns games          ←    
POST /end-round     →     syncAfterRound         →    writes ratings
                   ←      confirmation           ←
POST /auth/login    →     verify + link clubs    →    user_accounts
                   ←      token + clubs          ←
```

### What stays client-side
- UI rendering
- Page navigation  
- Form inputs
- API calls only

### What moves server-side
- `AischedulerNextRound` + all algorithm files
- `syncAfterRound` + `dbSyncRatings`
- All `sbGet/sbPost/sbPatch/sbDelete` calls
- Supabase URL + service key
- Auth logic

---

## Key Files
```
competitive_algorithm.js  — pairing algorithm (RESTORED, protect this)
rounds.js                 — round state management
games.js                  — game rendering + UI
supabase.js               — DB helper functions
auth.js                   — claim/login/join logic
authUI.js                 — auth screens + auto-login
HomeScreen.js             — home screen + my clubs tile
settings.js               — theme/font/style functions
main.js                   — setTileStyle/loadHomeStyle/updateModePill
BRRStyle1.css             — tile style system CSS
HomeStyle-new.css         — home layout CSS
KariBRRApp.html           — full app HTML
sw.js                     — service worker (current: v62)
```

---

## Process Notes
- Always show mockup/sample before implementing UI changes
- Confirm bugs before fixing
- Implement exactly what is agreed — nothing more
- Always test after implementing (node --check + logic simulation)
- Check DB queries against schema before packaging
- Never use Supabase foreign key join syntax `table(col)` — fetch separately

