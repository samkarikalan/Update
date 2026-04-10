/* ============================================================
   auth.js
   Player authentication system
   - Sign up / Login / Forgot password
   - Mock mode for local testing (no Supabase needed)
   - Switch MOCK_MODE = false when Supabase tables are ready
   ============================================================ */

var AUTH_MOCK_MODE = false; // ← set false when Supabase tables ready

/* ── Current session ── */
var _authUser = null; // { id, userId, nickname, email }

/* ── Mock DB for testing ── */
var _mockUsers = JSON.parse(localStorage.getItem('mock_users') || '[]');
var _mockClubMembers = JSON.parse(localStorage.getItem('mock_club_members') || '[]');

function _saveMockUsers() {
  localStorage.setItem('mock_users', JSON.stringify(_mockUsers));
}
function _saveMockMembers() {
  localStorage.setItem('mock_club_members', JSON.stringify(_mockClubMembers));
}

/* ============================================================
   PUBLIC API
   ============================================================ */

/* ── Get current logged-in user ── */
function authGetUser() {
  if (_authUser) return _authUser;
  var saved = localStorage.getItem('auth_user');
  if (saved) {
    try { _authUser = JSON.parse(saved); } catch(e) {}
  }
  return _authUser;
}

/* ── Is logged in? ── */
function authIsLoggedIn() {
  return !!authGetUser();
}

/* ── Sign up ── */
async function authSignUp(email, password, displayName, gender, recoveryWord) {
  email       = email.trim().toLowerCase();
  displayName = (displayName || '').trim();
  gender      = gender || 'Male';

  if (!email || !email.includes('@'))
    return { error: t('emailInvalid') };
  if (!displayName || displayName.length < 2)
    return { error: t('displayNameMin2') };
  if (!password || password.length < 6)
    return { error: t('passwordMin6') };
  if (!recoveryWord || recoveryWord.trim().length < 3)
    return { error: t('recoveryMin3') };

  // ── Real Supabase ──
  try {
    // Check email exists
    var existing = await sbGet('user_accounts', 'email=eq.' + encodeURIComponent(email) + '&select=id');
    if (existing && existing.length) return { error: t('emailAlreadyReg') };

    var result = await sbPost('user_accounts', {
      user_id:       email,
      nickname:      displayName,
      email:         email,
      password_hash: password,
      recovery_word: (recoveryWord || '').trim().toLowerCase()
    });
    var u = result[0];

    // Also create player row
    await sbPost('players', {
      name:          displayName,
      gender:        gender,
      global_rating: 1.0,
      global_points: 0
    }).catch(() => {});

    var authUser = { id: u.id, email: u.email, nickname: u.nickname, displayName: u.nickname };
    return { user: authUser };
  } catch(e) {
    var msg = e.message || '';
    if (msg.includes('duplicate') || msg.includes('already'))
      return { error: t('emailAlreadyReg') };
    return { error: t('signupFailed') };
  }
}

/* ── Login ── */
async function authLogin(email, password) {
  email = email.trim().toLowerCase();

  if (!email) return { error: t('enterEmail') };
  if (!password) return { error: t('enterPassword') };

  // ── Real Supabase — filter by email + password server-side ──
  try {
    var rows = await sbGet('user_accounts',
      'email=eq.' + encodeURIComponent(email) +
      '&password_hash=eq.' + encodeURIComponent(password) +
      '&select=id,nickname,email');
    if (!rows || !rows.length) {
      // Check if email exists at all for better error message
      var exists = await sbGet('user_accounts', 'email=eq.' + encodeURIComponent(email) + '&select=id').catch(() => []);
      if (!exists || !exists.length) return { error: t('noAccountEmail') };
      return { error: t('wrongPasswordLogin') };
    }
    var u = rows[0];
    var authUser = { id: u.id, email: u.email, nickname: u.nickname, displayName: u.nickname };
    _authUser = authUser;
    localStorage.setItem('auth_user', JSON.stringify(authUser));
    return { user: authUser };
  } catch(e) {
    return { error: e.message || t('loginFailed') };
  }
}

/* ── Reset Password via recovery word ── */
async function authResetPassword(email, recoveryWord, newPassword) {
  email        = email.trim().toLowerCase();
  recoveryWord = recoveryWord.trim().toLowerCase();

  if (!email || !email.includes('@')) return { error: t('enterEmail') };
  if (!recoveryWord) return { error: t('enterRecovery') };
  if (!newPassword || newPassword.length < 6) return { error: t('passwordMin6') };

  try {
    var rows = await sbGet('user_accounts',
      'email=eq.' + encodeURIComponent(email) +
      '&recovery_word=eq.' + encodeURIComponent(recoveryWord) +
      '&select=id');
    if (!rows || !rows.length) return { error: t('emailRecoveryWrong') };

    await sbPatch('user_accounts', 'id=eq.' + rows[0].id, { password_hash: newPassword });
    return { success: true };
  } catch(e) {
    return { error: e.message || t('resetFailed') };
  }
}

/* ── Claim Account — player already registered by admin ── */
async function authClaimAccount(clubId, nickname, defaultPassword, email, newPassword, recoveryWord) {
  try {
    // 1. Find membership by club + nickname
    var memberships = await sbGet('memberships',
      'club_id=eq.' + clubId + '&nickname=ilike.' + encodeURIComponent(nickname) + '&select=id,player_id,user_account_id'
    );
    if (!memberships || !memberships.length)
      return { error: t('nicknameNotFound') };

    var membership = memberships[0];

    // 2. Already claimed?
    if (membership.user_account_id)
      return { error: t('alreadyClaimed') };

    // 3. Verify default password on player row
    var players = await sbGet('players',
      'id=eq.' + membership.player_id + '&default_password=eq.' + encodeURIComponent(defaultPassword) + '&select=id'
    );
    if (!players || !players.length)
      return { error: t('defaultPwWrong') };

    // 4. Check email not already used
    var existing = await sbGet('user_accounts', 'email=eq.' + encodeURIComponent(email) + '&select=id');
    if (existing && existing.length)
      return { error: t('emailAlreadyUsed') };

    // 5. Create user_account
    var result = await sbPost('user_accounts', {
      user_id:       email,
      nickname:      nickname,
      email:         email,
      password_hash: newPassword,
      recovery_word: recoveryWord
    });
    var u = result[0];

    // 6. Link THIS membership to user_account
    await sbPatch('memberships', 'id=eq.' + membership.id, { user_account_id: u.id });

    // 7. Also link any other clubs where same nickname is unlinked
    try {
      var otherMemberships = await sbGet('memberships',
        'nickname=ilike.' + encodeURIComponent(nickname) + '&user_account_id=is.null&select=id');
      for (var i = 0; i < (otherMemberships || []).length; i++) {
        await sbPatch('memberships', 'id=eq.' + otherMemberships[i].id, { user_account_id: u.id }).catch(function(){});
      }
    } catch(e) { /* silent */ }

    var authUser = { id: u.id, email: u.email, nickname: u.nickname, displayName: u.nickname };
    _authUser = authUser;
    localStorage.setItem('auth_user', JSON.stringify(authUser));
    return { user: authUser };

  } catch(e) {
    return { error: e.message || t('claimFailed') };
  }
}

/* ── Logout ── */
function authLogout() {
  _authUser = null;
  localStorage.removeItem('auth_user');
  localStorage.removeItem('kbrr_my_club_id');
  localStorage.removeItem('kbrr_my_club_name');
  localStorage.removeItem('kbrr_my_player');
  localStorage.removeItem('kbrr_app_mode');
  if (typeof authShowScreen === 'function') authShowScreen('login');
}

/* ── Forgot password — send OTP ── */
async function authForgotSendOtp(email) {
  email = email.trim().toLowerCase();
  if (!email || !email.includes('@')) return { error: t('emailInvalid') };

  if (AUTH_MOCK_MODE) {
    var user = _mockUsers.find(function(u) { return u.email === email; });
    if (!user) return { error: t('noAccountEmail') };
    var otp = Math.floor(100000 + Math.random() * 900000).toString();
    localStorage.setItem('mock_forgot_otp', JSON.stringify({ email: email, otp: otp, ts: Date.now() }));
    console.log('MOCK OTP for ' + email + ': ' + otp); // shown in console for testing
    return { success: true, message: 'OTP sent (check console for mock OTP)' };
  }

  // Real: call edge function or email service
  return { error: 'Email service not configured yet' };
}

/* ── Forgot password — verify OTP and reset ── */
async function authForgotVerify(email, otp, newPassword) {
  email = email.trim().toLowerCase();
  if (!newPassword || newPassword.length < 6)
    return { error: t('passwordMin6') };

  if (AUTH_MOCK_MODE) {
    var saved = JSON.parse(localStorage.getItem('mock_forgot_otp') || 'null');
    if (!saved || saved.email !== email || saved.otp !== otp)
      return { error: t('invalidOTP') };
    if (Date.now() - saved.ts > 10 * 60 * 1000)
      return { error: t('otpExpired') };

    var user = _mockUsers.find(function(u) { return u.email === email; });
    if (!user) return { error: t('accountNotFound') };
    user.password = newPassword;
    _saveMockUsers();
    localStorage.removeItem('mock_forgot_otp');
    return { success: true };
  }

  return { error: 'Not implemented yet' };
}

/* ── Join club by invite code ── */
async function authJoinClub(inviteCode) {
  var user = authGetUser();
  if (!user) return { error: t('pleaseLoginFirst') };

  inviteCode = inviteCode.trim().toUpperCase();
  if (!inviteCode) return { error: 'Please enter an invite code' };

  if (AUTH_MOCK_MODE) {
    // Find club with this invite code from existing clubs
    var clubs = JSON.parse(localStorage.getItem('mock_clubs') || '[]');
    var club = clubs.find(function(c) { return c.inviteCode === inviteCode; });
    if (!club) return { error: t('invalidInviteCode') };

    // Check already member
    var already = _mockClubMembers.find(function(m) {
      return m.clubId === club.id && m.userId === user.id;
    });
    if (already) {
      // Already member — just set as active club
      setMyClub(club.id, club.name);
      return { success: true, club: club };
    }

    _mockClubMembers.push({ clubId: club.id, userId: user.id, joinedAt: new Date().toISOString() });
    _saveMockMembers();
    setMyClub(club.id, club.name);
    return { success: true, club: club };
  }

  // ── Real Supabase ──
  try {
    var clubRows = await sbGet('clubs', 'invite_code=eq.' + encodeURIComponent(inviteCode) + '&select=id,name');
    if (!clubRows || !clubRows.length) return { error: 'Invalid invite code.' };
    var club = clubRows[0];

    // Club membership is tracked via players.club_id — no separate club_members insert needed
    setMyClub(club.id, club.name);
    return { success: true, club: { id: club.id, name: club.name } };
  } catch(e) {
    return { error: e.message || t('failedToJoinClub') };
  }
}

/* ── Auto-join from deep link invite code ── */
function authHandleInviteLink() {
  // Check URL for invite code: ?invite=XXXXX or #invite=XXXXX
  var params = new URLSearchParams(window.location.search);
  var code = params.get('invite') || params.get('code');
  if (code) {
    localStorage.setItem('pending_invite_code', code.trim().toUpperCase());
  }
}

/* ── Get pending invite code ── */
function authGetPendingInvite() {
  return localStorage.getItem('pending_invite_code') || null;
}

/* ── Clear pending invite ── */
function authClearPendingInvite() {
  localStorage.removeItem('pending_invite_code');
}

/* ── Search clubs by name ── */
async function authSearchClubs(query) {
  query = query.trim();
  if (!query || query.length < 2) return { clubs: [] };

  try {
    var rows = await sbGet('clubs',
      'name=ilike.' + encodeURIComponent('%' + query + '%') + '&select=id,name&limit=10');
    return { clubs: rows || [] };
  } catch(e) {
    return { error: e.message || t('searchFailed2') };
  }
}

/* ── Request to join a club ── */
async function authRequestJoin(clubId, chosenNickname) {
  var user = authGetUser();
  if (!user) return { error: t('pleaseLoginFirst') };

  // Use chosen nickname or fall back to account nickname
  var nickname = (chosenNickname || user.nickname || '').trim();
  if (!nickname) return { error: t('provideNickname') };

  try {
    // Check if already a member (by user_account_id)
    var members = await sbGet('memberships',
      'club_id=eq.' + clubId + '&user_account_id=eq.' + user.id + '&select=player_id');
    if (members && members.length) {
      var club = await sbGet('clubs', 'id=eq.' + clubId + '&select=id,name');
      if (club && club.length) setMyClub(club[0].id, club[0].name);
      return { alreadyMember: true };
    }

    // Check if already requested
    var existing = await sbGet('club_join_requests',
      'club_id=eq.' + clubId + '&user_account_id=eq.' + user.id);
    if (existing && existing.length) {
      var req = existing[0];
      if (req.status === 'pending') return { pending: true, nickname: req.nickname };
      if (req.status === 'rejected') return { error: 'Your request was rejected by the admin.' };
      // Previously rejected — allow re-request with new nickname, delete old row
      await sbDelete('club_join_requests', 'club_id=eq.' + clubId + '&user_account_id=eq.' + user.id);
    }

    // Check nickname conflict in this club
    var conflict = await sbGet('memberships',
      'club_id=eq.' + clubId + '&nickname=ilike.' + encodeURIComponent(nickname) + '&select=id,player_id,user_account_id');
    if (conflict && conflict.length) {
      var cm = conflict[0];
      // If unclaimed — ask for default password to verify identity
      if (!cm.user_account_id) {
        return { needsPassword: true, conflictNickname: nickname, membershipId: cm.id, playerId: cm.player_id };
      }
      // Claimed by THIS user — auto-join
      if (String(cm.user_account_id) === String(user.id)) {
        var clubInfo2 = await sbGet('clubs', 'id=eq.' + clubId + '&select=id,name').catch(function(){ return []; });
        var cname2 = (clubInfo2 && clubInfo2.length) ? clubInfo2[0].name : '';
        if (typeof setMyClub === 'function') setMyClub(clubId, cname2);
        return { alreadyMember: true };
      }
      // Claimed by someone else — truly taken
      return { nicknameConflict: true, conflictNickname: nickname };
    }

    // Create request with chosen nickname
    await sbPost('club_join_requests', {
      club_id:         clubId,
      user_account_id: user.id,
      nickname:        nickname,
      status:          'pending'
    });
    return { success: true, nickname: nickname };
  } catch(e) {
    return { error: e.message || t('failedSendRequest') };
  }
}

/* ── Claim existing player record by verifying default password ── */
async function authClaimAndJoin(clubId, nickname, defaultPassword) {
  var user = authGetUser();
  if (!user) return { error: t('pleaseLoginFirst') };

  try {
    // Find membership
    var memberships = await sbGet('memberships',
      'club_id=eq.' + clubId + '&nickname=ilike.' + encodeURIComponent(nickname) + '&select=id,player_id,user_account_id'
    );
    if (!memberships || !memberships.length)
      return { error: t('nicknameNotFound') };

    var membership = memberships[0];

    // Already claimed by someone else?
    if (membership.user_account_id && membership.user_account_id !== user.id)
      return { error: t('alreadyClaimed') };

    // Verify default password on player row
    var players = await sbGet('players',
      'id=eq.' + membership.player_id + '&default_password=eq.' + encodeURIComponent(defaultPassword) + '&select=id'
    );
    if (!players || !players.length)
      return { error: t('defaultPwWrong') };

    // Link membership to logged-in user
    await sbPatch('memberships', 'id=eq.' + membership.id, { user_account_id: user.id });

    // Also link any other clubs with same unclaimed nickname
    var others = await sbGet('memberships',
      'nickname=ilike.' + encodeURIComponent(nickname) + '&user_account_id=is.null&select=id'
    ).catch(function(){ return []; });
    for (var i = 0; i < others.length; i++) {
      await sbPatch('memberships', 'id=eq.' + others[i].id, { user_account_id: user.id }).catch(function(){});
    }

    // Update players table
    await sbPatch('players',
      'club_id=eq.' + clubId + '&name=ilike.' + encodeURIComponent(nickname),
      { user_account_id: user.id }
    ).catch(function(){});

    // Get club name
    var clubInfo = await sbGet('clubs', 'id=eq.' + clubId + '&select=id,name').catch(function(){ return []; });
    var cname = (clubInfo && clubInfo.length) ? clubInfo[0].name : '';
    return { success: true, clubId: clubId, clubName: cname, nickname: nickname };

  } catch(e) {
    return { error: e.message || t('claimFailed') };
  }
}

/* ── Get pending join requests for a club (admin) ── */
async function authGetJoinRequests(clubId) {
  try {
    var requests = await sbGet('club_join_requests',
      'club_id=eq.' + clubId + '&status=eq.pending&select=id,user_account_id,requested_at');

    // Get user details for each request
    var result = [];
    for (var i = 0; i < requests.length; i++) {
      var req = requests[i];
      try {
        var users = await sbGet('user_accounts',
          'id=eq.' + req.user_account_id + '&select=id,nickname,email');
        if (users && users.length) {
          result.push({
            requestId:     req.id,
            requestedAt:   req.requested_at,
            userAccountId: req.user_account_id,
            nickname:      users[0].nickname,
            email:         users[0].email
          });
        }
      } catch(e) {}
    }
    return { requests: result };
  } catch(e) {
    return { error: e.message || t('failedLoadRequests2') };
  }
}

/* ── Accept join request (admin) ── */
async function authAcceptRequest(requestId, clubId, userAccountId, nickname, gender) {
  try {
    // Update request status
    await sbPatch('club_join_requests', 'id=eq.' + requestId, {
      status:      'accepted',
      reviewed_at: new Date().toISOString()
    });

    // Find existing membership by club + nickname and link user_account
    var memberships = await sbGet('memberships',
      'club_id=eq.' + clubId + '&nickname=ilike.' + encodeURIComponent(nickname) + '&select=id,player_id'
    ).catch(() => []);

    if (memberships && memberships.length) {
      // Link existing membership to user account
      await sbPatch('memberships', 'id=eq.' + memberships[0].id, { user_account_id: userAccountId });
      // Also update players table — mark as registered
      await sbPatch('players',
        'club_id=eq.' + clubId + '&name=ilike.' + encodeURIComponent(nickname),
        { user_account_id: userAccountId }
      ).catch(function(){});
    } else {
      // Create player + membership (player not pre-registered)
      var created = await sbPost('players', {
        name:            nickname,
        gender:          gender || 'Male',
        club_id:         clubId,
        global_rating:   1.0,
        global_points:   0,
        user_account_id: userAccountId
      });
      await sbPost('memberships', {
        player_id:       created[0].id,
        club_id:         clubId,
        nickname:        nickname,
        club_rating:     1.0,
        club_points:     0,
        user_account_id: userAccountId
      });
    }

    return { success: true };
  } catch(e) {
    return { error: e.message || t('failedAcceptRequest') };
  }
}

/* ── Reject join request (admin) ── */
async function authRejectRequest(requestId) {
  try {
    await sbPatch('club_join_requests', 'id=eq.' + requestId, {
      status:      'rejected',
      reviewed_at: new Date().toISOString()
    });
    return { success: true };
  } catch(e) {
    return { error: e.message || t('failedRejectRequest') };
  }
}

/* ── Check my request status ── */
async function authCheckRequestStatus(clubId) {
  var user = authGetUser();
  if (!user) return { status: 'none' };

  try {
    var rows = await sbGet('club_join_requests',
      'club_id=eq.' + clubId + '&user_account_id=eq.' + user.id + '&select=status');
    if (!rows || !rows.length) return { status: 'none' };
    return { status: rows[0].status };
  } catch(e) {
    return { status: 'none' };
  }
}

// Check for invite link on load
authHandleInviteLink();

/* ============================================================
   OTP VERIFICATION — via Supabase Edge Functions + Resend
   ============================================================ */

const EDGE_BASE    = 'https://hplkoxdorbfjhwbvqatn.supabase.co/functions/v1';
const EDGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbGtveGRvcmJmamh3YnZxYXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTcyOTgsImV4cCI6MjA5MDE5MzI5OH0.G-04VeYkUGMF93qw61ryTaQ0Q7xK3dOAHLDvG6l31vc';

/* Send OTP to email */
async function authSendOtp(email) {
  try {
    const res = await fetch(EDGE_BASE + '/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + EDGE_ANON_KEY,
        'apikey': EDGE_ANON_KEY
      },
      body: JSON.stringify({ email: email.toLowerCase().trim() })
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || 'Failed to send OTP' };
    return { success: true };
  } catch(e) {
    return { error: 'Network error: ' + e.message };
  }
}

/* Verify OTP entered by user */
async function authVerifyOtp(email, otp) {
  try {
    const res = await fetch(EDGE_BASE + '/verify-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + EDGE_ANON_KEY,
        'apikey': EDGE_ANON_KEY
      },
      body: JSON.stringify({ email: email.toLowerCase().trim(), otp: otp.trim() })
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || t('invalidOTP') };
    return { success: true };
  } catch(e) {
    return { error: 'Network error: ' + e.message };
  }
}

/* ── Silent background sync — link players rows on every login ──
   Finds all memberships for this user → finds matching players rows
   where user_account_id is null → patches them
   Runs silently on every login so existing members get linked too */
async function authSyncPlayerLinks(user) {
  try {
    if (!user || !user.id) return;

    // Get all memberships for this user
    var memberships = await sbGet('memberships',
      'user_account_id=eq.' + user.id + '&select=club_id,nickname'
    ).catch(function(){ return []; });

    if (!memberships || !memberships.length) return;

    // For each membership — find unlinked player row with matching name
    for (var i = 0; i < memberships.length; i++) {
      var m = memberships[i];
      if (!m.club_id || !m.nickname) continue;

      await sbPatch(
        'players',
        'club_id=eq.' + m.club_id +
        '&name=ilike.' + encodeURIComponent(m.nickname) +
        '&user_account_id=is.null',
        { user_account_id: user.id }
      ).catch(function(){});
    }
  } catch(e) {
    // Silent — never block login
  }
}
