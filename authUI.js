/* ============================================================
   authUI.js
   UI functions for auth screens
   ============================================================ */

/* ── Show auth overlay and a specific screen ── */
function authShowScreen(screen) {
  var overlay = document.getElementById('authOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';

  // Hide all screens
  ['authWelcome','authLogin','authSignup','authForgot','authJoinClub'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Hide home + mode select
  var homeEl = document.getElementById('homePageOverlay');
  if (homeEl) homeEl.style.display = 'none';
  var modeEl = document.getElementById('modeSelectOverlay');
  if (modeEl) modeEl.style.display = 'none';

  // Show requested screen
  var screenMap = {
    'welcome':  'authWelcome',
    'login':    'authLogin',
    'signup':   'authSignup',
    'forgot':   'authForgot',
    'joinClub': 'authJoinClub'
  };
  var el = document.getElementById(screenMap[screen]);
  if (el) el.style.display = 'flex';

  // Clear errors
  ['loginError','signupError','forgotError','forgotError2','joinClubError'].forEach(function(id) {
    var err = document.getElementById(id);
    if (err) { err.style.display = 'none'; err.textContent = ''; }
  });
}

/* ── Hide auth overlay ── */
function authHideOverlay() {
  var overlay = document.getElementById('authOverlay');
  if (overlay) overlay.style.display = 'none';
}

/* ── Show error ── */
function authShowError(id, msg) {
  var el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

/* ── Show loading state on button ── */
function authSetLoading(btnSelector, loading) {
  var btn = document.querySelector(btnSelector);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn._origText = btn.textContent;
    btn.textContent = 'Please wait...';
  } else {
    btn.textContent = btn._origText || btn.textContent;
  }
}

/* ── Do Login ── */
async function authDoLogin() {
  var userId   = (document.getElementById('loginUserId')?.value || '').trim();
  var password = (document.getElementById('loginPassword')?.value || '');

  authSetLoading('#authLogin .auth-btn-primary', true);
  var result = await authLogin(userId, password);
  authSetLoading('#authLogin .auth-btn-primary', false);

  if (result.error) {
    authShowError('loginError', result.error);
    return;
  }

  // Login success — update profile button then check club
  if (typeof updateProfileBtn === 'function') updateProfileBtn();
  authAfterLogin(result.user);
}

/* ── Do Sign Up ── */
async function authDoSignup() {
  var userId   = (document.getElementById('signupUserId')?.value || '').trim();
  var nickname = (document.getElementById('signupNickname')?.value || '').trim();
  var email    = (document.getElementById('signupEmail')?.value || '').trim();
  var password = (document.getElementById('signupPassword')?.value || '');
  var confirm  = (document.getElementById('signupConfirm')?.value || '');

  if (password !== confirm) {
    authShowError('signupError', 'Passwords do not match');
    return;
  }

  authSetLoading('#authSignup .auth-btn-primary', true);
  var result = await authSignUp(userId, nickname, email, password);
  authSetLoading('#authSignup .auth-btn-primary', false);

  if (result.error) {
    authShowError('signupError', result.error);
    return;
  }

  // Auto login after signup
  var loginResult = await authLogin(userId, password);
  if (loginResult.error) {
    authShowError('signupError', 'Account created! Please login.');
    authShowScreen('login');
    return;
  }

  authAfterLogin(loginResult.user);
}

/* ── After successful login — check club ── */
async function authAfterLogin(user) {
  // Set player nickname for profile
  if (typeof setMyPlayer === 'function' && user.nickname) {
    setMyPlayer({ name: user.nickname, gender: 'Male' });
  }
  if (typeof updateProfileBtn === 'function') updateProfileBtn();

  // Check for pending invite
  var pending = (typeof authGetPendingInvite === 'function') ? authGetPendingInvite() : null;
  if (pending) {
    var joinInput = document.getElementById('joinClubCode');
    if (joinInput) joinInput.value = pending;
    authShowScreen('joinClub');
    return;
  }

  // Check if already in a club — verify player row still exists in DB
  var club = (typeof getMyClub === 'function') ? getMyClub() : { id: null };
  if (club && club.id) {
    try {
      var playerCheck = await sbGet('players',
        'club_id=eq.' + club.id + '&user_account_id=eq.' + user.id + '&select=nickname');
      if (!playerCheck || !playerCheck.length) {
        // Player was removed — clear club from localStorage
        if (typeof clearMyClub === 'function') clearMyClub();
        else { localStorage.removeItem('kbrr_my_club_id'); localStorage.removeItem('kbrr_my_club_name'); }
        club = { id: null };
      }
    } catch(e) { /* offline — trust cached state */ }
  }
  if (club && club.id) {
    // Already in club — go to app
    authHideOverlay();
    selectMode(sessionStorage.getItem('appMode') || 'viewer');
    return;
  }

  // No club — show join screen
  authShowScreen('joinClub');
}

/* ── Do Forgot Password — Send OTP ── */
async function authDoForgotSend() {
  var email = (document.getElementById('forgotEmail')?.value || '').trim();

  authSetLoading('#forgotStep1 .auth-btn-primary', true);
  var result = await authForgotSendOtp(email);
  authSetLoading('#forgotStep1 .auth-btn-primary', false);

  if (result.error) {
    authShowError('forgotError', result.error);
    return;
  }

  // Show OTP step
  var step1 = document.getElementById('forgotStep1');
  var step2 = document.getElementById('forgotStep2');
  if (step1) step1.style.display = 'none';
  if (step2) step2.style.display = 'block';

  if (AUTH_MOCK_MODE) {
    authShowError('forgotError2', '⚠️ Mock mode: check browser console for OTP');
  }
}

/* ── Do Forgot Password — Verify OTP ── */
async function authDoForgotVerify() {
  var email  = (document.getElementById('forgotEmail')?.value || '').trim();
  var otp    = (document.getElementById('forgotOtp')?.value || '').trim();
  var newPw  = (document.getElementById('forgotNewPw')?.value || '');

  authSetLoading('#forgotStep2 .auth-btn-primary', true);
  var result = await authForgotVerify(email, otp, newPw);
  authSetLoading('#forgotStep2 .auth-btn-primary', false);

  if (result.error) {
    authShowError('forgotError2', result.error);
    return;
  }

  // Success — go to login
  alert('Password reset successfully! Please login.');
  authShowScreen('login');
}

/* ── Do Join Club ── */
async function authDoJoinClub() {
  var code = (document.getElementById('joinClubCode')?.value || '').trim().toUpperCase();

  authSetLoading('#authJoinClub .auth-btn-primary', true);
  var result = await authJoinClub(code);
  authSetLoading('#authJoinClub .auth-btn-primary', false);

  if (result.error) {
    authShowError('joinClubError', result.error);
    return;
  }

  // Clear pending invite
  if (typeof authClearPendingInvite === 'function') authClearPendingInvite();

  // Success — go to app
  authHideOverlay();
  if (typeof updateProfileBtn === 'function') updateProfileBtn();
  selectMode(sessionStorage.getItem('appMode') || 'viewer');
}

/* ── Skip join club ── */
function authSkipJoin() {
  authHideOverlay();
  selectMode(sessionStorage.getItem('appMode') || 'viewer');
}

/* ── Logout ── */
function authDoLogout() {
  if (typeof authLogout === 'function') authLogout();
  // Reset app state
  if (typeof ResetAll === 'function') ResetAll();
  authShowScreen('welcome');
}

/* ── Club search UI ── */
var _searchTimeout = null;
function authSearchClubsUI(query) {
  clearTimeout(_searchTimeout);
  var resultsEl = document.getElementById('joinClubResults');
  var errorEl   = document.getElementById('joinClubError');
  var pendingEl = document.getElementById('joinClubPending');
  if (errorEl)   { errorEl.style.display = 'none'; }
  if (pendingEl) { pendingEl.style.display = 'none'; }

  if (!query || query.trim().length < 2) {
    if (resultsEl) resultsEl.style.display = 'none';
    return;
  }

  if (resultsEl) {
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = '<div class="auth-club-loading">Searching...</div>';
  }

  _searchTimeout = setTimeout(async function() {
    var result = await authSearchClubs(query);
    if (result.error) {
      if (resultsEl) resultsEl.innerHTML = '<div class="auth-club-empty">Search failed. Try again.</div>';
      return;
    }
    if (!result.clubs || !result.clubs.length) {
      if (resultsEl) resultsEl.innerHTML = '<div class="auth-club-empty">No clubs found. Check the name.</div>';
      return;
    }
    if (resultsEl) {
      resultsEl.innerHTML = result.clubs.map(function(club) {
        return '<div class="auth-club-item" onclick="authDoRequestJoin(\'' + club.id + '\',\'' + club.name.replace(/'/g, "\\'") + '\')">' +
          '<div class="auth-club-item-name">🏢 ' + club.name + '</div>' +
          '<div class="auth-club-item-btn">Request to Join ›</div>' +
          '</div>';
      }).join('');
    }
  }, 400);
}

/* ── Request to join a club ── */
async function authDoRequestJoin(clubId, clubName) {
  var resultsEl = document.getElementById('joinClubResults');
  var errorEl   = document.getElementById('joinClubError');
  var pendingEl = document.getElementById('joinClubPending');

  if (errorEl) { errorEl.style.display = 'none'; }
  if (resultsEl) resultsEl.innerHTML = '<div class="auth-club-loading">Sending request...</div>';

  var result = await authRequestJoin(clubId);

  if (result.error) {
    if (resultsEl) resultsEl.style.display = 'none';
    if (errorEl) { errorEl.textContent = result.error; errorEl.style.display = 'block'; }
    return;
  }

  if (result.alreadyMember) {
    // Already member — go straight to app
    authHideOverlay();
    selectMode(sessionStorage.getItem('appMode') || 'viewer');
    return;
  }

  // Show pending state
  if (resultsEl) resultsEl.style.display = 'none';
  if (pendingEl) pendingEl.style.display = 'flex';

  // Store pending club info
  localStorage.setItem('pending_club_id', clubId);
  localStorage.setItem('pending_club_name', clubName);
}

/* ── Load join requests for admin (Vault Requests tab) ── */
async function vaultLoadRequests() {
  var club = (typeof getMyClub === 'function') ? getMyClub() : { id: null };
  var listEl = document.getElementById('vaultRequestsList');
  if (!listEl) return;

  if (!club || !club.id) {
    listEl.innerHTML = '<div class="profile-sessions-empty">Connect to a club first.</div>';
    return;
  }

  listEl.innerHTML = '<div class="profile-sessions-loading">Loading...</div>';
  var result = await authGetJoinRequests(club.id);

  if (result.error) {
    listEl.innerHTML = '<div class="profile-sessions-empty">Failed to load requests.</div>';
    return;
  }

  if (!result.requests || !result.requests.length) {
    listEl.innerHTML = '<div class="profile-sessions-empty">No pending requests.</div>';
    return;
  }

  listEl.innerHTML = result.requests.map(function(req) {
    return '<div class="vault-request-card">' +
      '<div class="vault-request-info">' +
        '<div class="vault-request-name">' + req.nickname + '</div>' +
        '<div class="vault-request-id">@' + req.userId + '</div>' +
      '</div>' +
      '<div class="vault-request-actions">' +
        '<button class="vault-request-accept" onclick="vaultAcceptRequest(\'' + req.requestId + '\',\'' + req.userAccountId + '\',\'' + req.nickname.replace(/'/g, "\\'") + '\')">✓ Accept</button>' +
        '<button class="vault-request-reject" onclick="vaultRejectRequest(\'' + req.requestId + '\')">✗ Reject</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

/* ── Accept request ── */
async function vaultAcceptRequest(requestId, userAccountId, nickname) {
  var club = (typeof getMyClub === 'function') ? getMyClub() : { id: null };
  if (!club || !club.id) return;

  var result = await authAcceptRequest(requestId, club.id, userAccountId, nickname, 'Male');
  if (result.error) {
    alert('Failed: ' + result.error);
    return;
  }
  // Refresh list
  // Invalidate player cache and resync so organiser sees the new player immediately
  localStorage.removeItem('kbrr_cache_players');
  localStorage.removeItem('kbrr_cache_ts');
  if (typeof syncToLocal === 'function') await syncToLocal();
  vaultLoadRequests();
  // Refresh players tile on home
  if (typeof homeRefreshTiles === 'function') homeRefreshTiles();
}

/* ── Reject request ── */
async function vaultRejectRequest(requestId) {
  var result = await authRejectRequest(requestId);
  if (result.error) {
    alert('Failed: ' + result.error);
    return;
  }
  vaultLoadRequests();
}
