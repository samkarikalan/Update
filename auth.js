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
async function authSignUp(userId, nickname, email, password) {
  userId   = userId.trim().toLowerCase();
  nickname = nickname.trim();
  email    = email.trim().toLowerCase();

  // Validate
  if (!userId || userId.length < 3)
    return { error: 'User ID must be at least 3 characters' };
  if (!/^[a-z0-9_]+$/.test(userId))
    return { error: 'User ID can only contain letters, numbers and underscore' };
  if (!nickname || nickname.length < 2)
    return { error: 'Nickname must be at least 2 characters' };
  if (!email || !email.includes('@'))
    return { error: 'Please enter a valid email' };
  if (!password || password.length < 6)
    return { error: 'Password must be at least 6 characters' };

  if (AUTH_MOCK_MODE) {
    // Check duplicate userId
    if (_mockUsers.find(function(u) { return u.userId === userId; }))
      return { error: 'User ID already taken. Try another.' };
    // Check duplicate email
    if (_mockUsers.find(function(u) { return u.email === email; }))
      return { error: 'Email already registered.' };

    var user = {
      id:       'mock_' + Date.now(),
      userId:   userId,
      nickname: nickname,
      email:    email,
      password: password, // plain text for mock only
      createdAt: new Date().toISOString()
    };
    _mockUsers.push(user);
    _saveMockUsers();
    return { user: { id: user.id, userId: user.userId, nickname: user.nickname, email: user.email } };
  }

  // ── Real Supabase ──
  try {
    // Check userId exists
    var existing = await sbGet('user_accounts', 'user_id=eq.' + encodeURIComponent(userId) + '&select=id');
    if (existing && existing.length) return { error: 'User ID already taken. Try another.' };

    var result = await sbPost('user_accounts', {
      user_id:       userId,
      nickname:      nickname,
      email:         email,
      password_hash: password // TODO: hash in production
    });
    var u = result[0];
    return { user: { id: u.id, userId: u.user_id, nickname: u.nickname, email: u.email } };
  } catch(e) {
    var msg = e.message || '';
    if (msg.includes('user_accounts_email_key') || msg.includes('duplicate') && msg.includes('email'))
      return { error: 'This email is already registered. Please use a different email.' };
    if (msg.includes('user_accounts_user_id_key') || msg.includes('duplicate') && msg.includes('user_id'))
      return { error: 'User ID already taken. Please choose another.' };
    if (msg.includes('duplicate key') || msg.includes('unique constraint'))
      return { error: 'Account already exists. Please try a different User ID or email.' };
    return { error: 'Sign up failed. Please try again.' };
  }
}

/* ── Login ── */
async function authLogin(userId, password) {
  userId = userId.trim().toLowerCase();

  if (!userId) return { error: 'Please enter your User ID' };
  if (!password) return { error: 'Please enter your password' };

  if (AUTH_MOCK_MODE) {
    var user = _mockUsers.find(function(u) {
      return u.userId === userId && u.password === password;
    });
    if (!user) return { error: 'Invalid User ID or password' };
    var authUser = { id: user.id, userId: user.userId, nickname: user.nickname, email: user.email };
    _authUser = authUser;
    localStorage.setItem('auth_user', JSON.stringify(authUser));
    return { user: authUser };
  }

  // ── Real Supabase ──
  try {
    var rows = await sbGet('user_accounts',
      'user_id=eq.' + encodeURIComponent(userId) +
      '&password_hash=eq.' + encodeURIComponent(password) +
      '&select=id,user_id,nickname,email');
    if (!rows || !rows.length) return { error: 'Invalid User ID or password' };
    var u = rows[0];
    var authUser = { id: u.id, userId: u.user_id, nickname: u.nickname, email: u.email };
    _authUser = authUser;
    localStorage.setItem('auth_user', JSON.stringify(authUser));
    return { user: authUser };
  } catch(e) {
    return { error: e.message || 'Login failed. Please try again.' };
  }
}

/* ── Logout ── */
function authLogout() {
  _authUser = null;
  localStorage.removeItem('auth_user');
  localStorage.removeItem('kbrr_my_club_id');
  localStorage.removeItem('kbrr_my_club_name');
  localStorage.removeItem('kbrr_my_player');
}

/* ── Forgot password — send OTP ── */
async function authForgotSendOtp(email) {
  email = email.trim().toLowerCase();
  if (!email || !email.includes('@')) return { error: 'Please enter a valid email' };

  if (AUTH_MOCK_MODE) {
    var user = _mockUsers.find(function(u) { return u.email === email; });
    if (!user) return { error: 'No account found with this email' };
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
    return { error: 'Password must be at least 6 characters' };

  if (AUTH_MOCK_MODE) {
    var saved = JSON.parse(localStorage.getItem('mock_forgot_otp') || 'null');
    if (!saved || saved.email !== email || saved.otp !== otp)
      return { error: 'Invalid OTP' };
    if (Date.now() - saved.ts > 10 * 60 * 1000)
      return { error: 'OTP expired. Please request a new one.' };

    var user = _mockUsers.find(function(u) { return u.email === email; });
    if (!user) return { error: 'Account not found' };
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
  if (!user) return { error: 'Please login first' };

  inviteCode = inviteCode.trim().toUpperCase();
  if (!inviteCode) return { error: 'Please enter an invite code' };

  if (AUTH_MOCK_MODE) {
    // Find club with this invite code from existing clubs
    var clubs = JSON.parse(localStorage.getItem('mock_clubs') || '[]');
    var club = clubs.find(function(c) { return c.inviteCode === inviteCode; });
    if (!club) return { error: 'Invalid invite code. Check with your organiser.' };

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
    return { error: e.message || 'Failed to join club.' };
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
    return { error: e.message || 'Search failed' };
  }
}

/* ── Request to join a club ── */
async function authRequestJoin(clubId, chosenNickname) {
  var user = authGetUser();
  if (!user) return { error: 'Please login first' };

  // Use chosen nickname or fall back to account nickname
  var nickname = (chosenNickname || user.nickname || '').trim();
  if (!nickname) return { error: 'Please provide a nickname.' };

  try {
    // Check if already a member (by user_account_id)
    var members = await sbGet('players',
      'club_id=eq.' + clubId + '&user_account_id=eq.' + user.id + '&select=id');
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
    var conflict = await sbGet('players',
      'club_id=eq.' + clubId + '&nickname=ilike.' + encodeURIComponent(nickname) + '&select=id');
    if (conflict && conflict.length) {
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
    return { error: e.message || 'Failed to send request' };
  }
}

/* ── Get pending join requests for a club (admin) ── */
async function authGetJoinRequests(clubId) {
  try {
    var requests = await sbGet('club_join_requests',
      'club_id=eq.' + clubId + '&status=eq.pending&select=id,user_account_id,nickname,requested_at');

    // Get user details for each request
    var result = [];
    for (var i = 0; i < requests.length; i++) {
      var req = requests[i];
      try {
        var users = await sbGet('user_accounts',
          'id=eq.' + req.user_account_id + '&select=id,user_id,nickname,email');
        if (users && users.length) {
          result.push({
            requestId:     req.id,
            requestedAt:   req.requested_at,
            userAccountId: req.user_account_id,
            userId:        users[0].user_id,
            nickname:      req.nickname || users[0].nickname,  // use chosen nickname first
            email:         users[0].email
          });
        }
      } catch(e) {}
    }
    return { requests: result };
  } catch(e) {
    return { error: e.message || 'Failed to load requests' };
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

    // Create player row with club_id and user_account_id
    await sbPost('players', {
      club_id:         clubId,
      user_account_id: userAccountId,
      nickname:        nickname,
      gender:          gender || 'Male',
      rating:          1.0,
      club_rating:     1.0,
      wins:            0,
      losses:          0
    });

    return { success: true };
  } catch(e) {
    return { error: e.message || 'Failed to accept request' };
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
    return { error: e.message || 'Failed to reject request' };
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
