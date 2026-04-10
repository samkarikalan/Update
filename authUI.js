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
    'claim':    'authClaim',
    'joinClub': 'authJoinClub'
  };
  var el = document.getElementById(screenMap[screen]);
  if (el) el.style.display = 'flex';

  // Load clubs for claim dropdown
  if (screen === 'claim') authLoadClaimClubs();

  // Clear errors
  ['loginError','signupError','forgotError','forgotError2','claimError','joinClubError'].forEach(function(id) {
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
    btn.textContent = t('pleaseWait');
  } else {
    btn.textContent = btn._origText || btn.textContent;
  }
}

/* ── Do Login ── */
async function authDoLogin() {
  var email    = (document.getElementById('loginEmail')?.value || '').trim();
  var password = (document.getElementById('loginPassword')?.value || '');

  authSetLoading('#authLogin .auth-btn-primary', true);
  var result = await authLogin(email, password);
  authSetLoading('#authLogin .auth-btn-primary', false);

  if (result.error) {
    authShowError('loginError', result.error);
    return;
  }

  // Login success -- update profile button then check club
  if (typeof updateProfileBtn === 'function') updateProfileBtn();
  authAfterLogin(result.user);
}

/* ── Do Sign Up ── */
var _pendingSignup = null;

async function authDoSignup() {
  var email        = (document.getElementById('signupEmail')?.value || '').trim();
  var displayName  = (document.getElementById('signupDisplayName')?.value || '').trim();
  var gender       = (document.getElementById('signupGender')?.value || 'Male');
  var password     = (document.getElementById('signupPassword')?.value || '');
  var confirm      = (document.getElementById('signupConfirm')?.value || '');
  var recoveryWord = (document.getElementById('signupRecoveryWord')?.value || '').trim();

  if (!email) { authShowError('signupError', t('emailRequired')); return; }
  if (password !== confirm) { authShowError('signupError', t('passwordsNotMatch')); return; }

  // Send OTP first
  authSetLoading('#authSignup .auth-btn-primary', true);
  var otpResult = await authSendOtp(email);
  authSetLoading('#authSignup .auth-btn-primary', false);

  if (otpResult.error) { authShowError('signupError', '❌ ' + otpResult.error); return; }

  _pendingSignup = { email, displayName, gender, password, recoveryWord };
  authShowOtpScreen(email, 'signup');
}

async function authCompleteSignup(otp) {
  if (!_pendingSignup) return;
  var { email, displayName, gender, password, recoveryWord } = _pendingSignup;

  var btn = document.getElementById('authOtpSubmitBtn');
  if (btn) btn.disabled = true;
  var verifyResult = await authVerifyOtp(email, otp);
  if (btn) btn.disabled = false;

  if (verifyResult.error) { authShowError('authOtpError', '❌ ' + verifyResult.error); return; }

  var result = await authSignUp(email, password, displayName, gender, recoveryWord);
  if (result.error) { authShowError('authOtpError', result.error); return; }

  var loginResult = await authLogin(email, password);
  if (loginResult.error) { authShowScreen('login'); return; }

  _pendingSignup = null;
  authHideOtpScreen();
  authAfterLogin(loginResult.user);
}

/* ── After successful login -- check club ── */
async function authAfterLogin(user) {
  // Set player nickname for profile
  if (typeof setMyPlayer === 'function' && user.nickname) {
    setMyPlayer({ name: user.nickname, gender: 'Male' });
  }
  if (typeof updateProfileBtn === 'function') updateProfileBtn();

  // Silent background sync -- link players rows where nickname matches but user_account_id is null
  authSyncPlayerLinks(user).catch(function(){});

  // Check for pending invite
  var pending = (typeof authGetPendingInvite === 'function') ? authGetPendingInvite() : null;
  if (pending) {
    var joinInput = document.getElementById('joinClubCode');
    if (joinInput) joinInput.value = pending;
    authShowScreen('joinClub');
    return;
  }

  // Auto-find all clubs via memberships linked to this user_account
  try {
    var linkedMemberships = await sbGet('memberships',
      'user_account_id=eq.' + user.id + '&select=club_id,nickname');

    if (linkedMemberships && linkedMemberships.length) {
      // Fetch club names separately
      var clubIds = linkedMemberships.map(function(m) { return m.club_id; });
      var clubs = [];
      try {
        clubs = await sbGet('clubs', 'id=in.(' + clubIds.join(',') + ')&select=id,name');
      } catch(e) {}
      var clubMap = {};
      clubs.forEach(function(c) { clubMap[c.id] = c.name; });

      // Enrich memberships with club names
      linkedMemberships = linkedMemberships.map(function(m) {
        return { club_id: m.club_id, nickname: m.nickname, club_name: clubMap[m.club_id] || '' };
      });

      if (linkedMemberships.length === 1) {
        var m = linkedMemberships[0];
        if (typeof setMyClub === 'function') setMyClub(m.club_id, m.club_name);
        if (typeof setMyPlayer === 'function') setMyPlayer({ name: m.nickname, gender: 'Male' });
        authHideOverlay();
        if (typeof selectMode === 'function') selectMode(sessionStorage.getItem('appMode') || 'viewer');
        return;
      } else {
        authShowClubPicker(linkedMemberships, user);
        return;
      }
    }
  } catch(e) { /* offline -- fall through to cached club */ }

  // Check cached club
  var club = (typeof getMyClub === 'function') ? getMyClub() : { id: null };
  if (club && club.id) {
    authHideOverlay();
    if (typeof selectMode === 'function') selectMode(sessionStorage.getItem('appMode') || 'viewer');
    return;
  }

  // No club found -- show join screen
  authShowScreen('joinClub');
}

function authShowClubPicker(memberships, user) {
  // Show a simple sheet to pick which club to enter
  var overlay = document.getElementById('authOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';

  // Hide all screens
  ['authWelcome','authLogin','authSignup','authForgot','authJoinClub','authClaim'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Build club picker screen
  var picker = document.getElementById('authClubPicker');
  if (!picker) {
    picker = document.createElement('div');
    picker.id = 'authClubPicker';
    picker.className = 'auth-screen';
    overlay.appendChild(picker);
  }
  picker.style.display = '';
  picker.innerHTML = '<div class="auth-title">' + t('selectClubTitle') + '</div>' +
    '<div class="auth-sub">' + t('youMemberMultipleClubs') + '</div>' +
    memberships.map(function(m) {
      var cid   = m.club_id;
      var cname = m.club_name || cid;
      var nick  = m.nickname;
      return '<button class="auth-club-pick-btn" onclick="authPickClub(\''+cid+'\',\''+cname+'\',\''+nick+'\')">'+
        '<strong>'+cname+'</strong><span>'+nick+'</span></button>';
    }).join('');
}

async function authPickClub(clubId, clubName, nickname) {
  if (typeof setMyClub   === 'function') setMyClub(clubId, clubName);
  if (typeof setMyPlayer === 'function') setMyPlayer({ name: nickname, gender: 'Male' });
  authHideOverlay();
  if (typeof selectMode === 'function') selectMode(sessionStorage.getItem('appMode') || 'viewer');
}

/* ── Do Forgot Password -- recovery keyword ── */
async function authDoForgotReset() {
  var email        = (document.getElementById('forgotEmail')?.value || '').trim();
  var recoveryWord = (document.getElementById('forgotRecoveryWord')?.value || '').trim();
  var newPw        = (document.getElementById('forgotNewPw')?.value || '');
  var confirmPw    = (document.getElementById('forgotConfirmPw')?.value || '');

  if (newPw !== confirmPw) {
    authShowError('forgotError', t('passwordsNotMatch'));
    return;
  }

  authSetLoading('#authForgot .auth-btn-primary', true);
  var result = await authResetPassword(email, recoveryWord, newPw);
  authSetLoading('#authForgot .auth-btn-primary', false);

  if (result.error) {
    authShowError('forgotError', result.error);
    return;
  }

  authShowError('forgotError', t('passwordReset'));
  document.getElementById('forgotError').style.color = 'var(--green, #2dce89)';
  setTimeout(function() { authShowScreen('login'); }, 1500);
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

  // Success -- go to app
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
    resultsEl.innerHTML = '<div class="auth-club-loading">' + t('searching') + '</div>';
  }

  _searchTimeout = setTimeout(async function() {
    var result = await authSearchClubs(query);
    if (result.error) {
      if (resultsEl) resultsEl.innerHTML = '<div class="auth-club-empty">' + t('searchFailed') + '</div>';
      return;
    }
    if (!result.clubs || !result.clubs.length) {
      if (resultsEl) resultsEl.innerHTML = '<div class="auth-club-empty">' + t('noClubsFound') + '</div>';
      return;
    }
    if (resultsEl) {
      resultsEl.innerHTML = result.clubs.map(function(club) {
        return '<div class="auth-club-item" onclick="authDoRequestJoin(\'' + club.id + '\',\'' + club.name.replace(/'/g, "\\'") + '\')">' +
          '<div class="auth-club-item-name">🏢 ' + club.name + '</div>' +
          '<div class="auth-club-item-btn">' + t('requestToJoin') + '</div>' +
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
  if (resultsEl) resultsEl.innerHTML = '<div class="auth-club-loading">' + t('sendingRequest') + '</div>';

  var result = await authRequestJoin(clubId);

  if (result.error) {
    if (resultsEl) resultsEl.style.display = 'none';
    if (errorEl) { errorEl.textContent = result.error; errorEl.style.display = 'block'; }
    return;
  }

  if (result.alreadyMember) {
    // Already member -- go straight to app
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
    listEl.innerHTML = '<div class="profile-sessions-empty">' + t('connectClubFirst') + '</div>';
    return;
  }

  listEl.innerHTML = '<div class="profile-sessions-loading">Loading...</div>';
  var result = await authGetJoinRequests(club.id);

  if (result.error) {
    listEl.innerHTML = '<div class="profile-sessions-empty">' + t('failedLoadRequests') + '</div>';
    return;
  }

  if (!result.requests || !result.requests.length) {
    listEl.innerHTML = '<div class="profile-sessions-empty">' + t('noPendingRequests') + '</div>';
    return;
  }

  listEl.innerHTML = result.requests.map(function(req) {
    return '<div class="vault-request-card">' +
      '<div class="vault-request-info">' +
        '<div class="vault-request-name">' + req.nickname + '</div>' +
        '<div class="vault-request-id">' + req.email + '</div>' +
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

/* ── OTP Screen ── */
var _otpContext = null; // 'signup' | 'claim'

function authShowOtpScreen(email, context) {
  _otpContext = context;
  var overlay = document.getElementById('authOverlay');
  if (overlay) overlay.style.display = 'flex';

  // Hide all screens
  ['authWelcome','authLogin','authSignup','authForgot','authJoinClub','authClaim','authClubPicker'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Build or show OTP screen
  var otpScreen = document.getElementById('authOtpScreen');
  if (!otpScreen) {
    otpScreen = document.createElement('div');
    otpScreen.id = 'authOtpScreen';
    otpScreen.className = 'auth-screen';
    document.getElementById('authOverlay').appendChild(otpScreen);
  }
  otpScreen.style.display = '';
  otpScreen.innerHTML =
    '<div class="auth-title">' + t('verifyEmailTitle') + '</div>' +
    '<div class="auth-sub" style="margin-bottom:16px">Enter the 6-digit code sent to<br><strong>' + email + '</strong></div>' +
    '<input id="authOtpInput" class="auth-input" type="text" inputmode="numeric" maxlength="6" placeholder="000000" style="letter-spacing:8px;font-size:1.2rem;text-align:center;">' +
    '<div id="authOtpError" class="auth-error" style="display:none"></div>' +
    '<button id="authOtpSubmitBtn" class="auth-btn auth-btn-primary" onclick="authSubmitOtp()" style="margin-top:12px;">' + t('verifyBtn') + '</button>' +
    '<button class="auth-btn auth-btn-secondary" onclick="authResendOtp(\'' + email + '\')" style="margin-top:8px;">' + t('resendCode') + '</button>';

  setTimeout(function() {
    var inp = document.getElementById('authOtpInput');
    if (inp) inp.focus();
  }, 100);
}

function authHideOtpScreen() {
  var otpScreen = document.getElementById('authOtpScreen');
  if (otpScreen) otpScreen.style.display = 'none';
}

async function authSubmitOtp() {
  var otp = (document.getElementById('authOtpInput')?.value || '').trim();
  if (otp.length !== 6) { authShowError('authOtpError', t('enterSixDigitHint')); return; }
  if (_otpContext === 'signup') await authCompleteSignup(otp);
  if (_otpContext === 'claim')  await authCompleteClaim(otp);
}

async function authResendOtp(email) {
  var result = await authSendOtp(email);
  if (result.error) {
    authShowError('authOtpError', result.error);
  } else {
    authShowError('authOtpError', t('codeResent'));
    document.getElementById('authOtpError').style.color = 'var(--green,#2dce89)';
    document.getElementById('authOtpError').style.display = '';
  }
}

function authShowError(id, msg) {
  var el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = ''; }
}

/* ── Claim Account with OTP verification ── */
var _pendingClaim = null;

async function authDoClaimAccount() {
  var clubId       = (document.getElementById('claimClubSelect')?.value || '').trim();
  var nickname     = (document.getElementById('claimNickname')?.value || '').trim();
  var defaultPw    = (document.getElementById('claimDefaultPassword')?.value || '').trim();
  var email        = (document.getElementById('claimEmail')?.value || '').trim();
  var newPassword  = (document.getElementById('claimPassword')?.value || '');
  var confirmPw    = (document.getElementById('claimConfirm')?.value || '');
  var recoveryWord = (document.getElementById('claimRecoveryWord')?.value || '').trim();
  var errEl        = document.getElementById('claimError');

  var setErr = function(msg) { if (errEl) { errEl.textContent = msg; errEl.style.display = ''; } };

  if (!clubId)      { setErr(t('selectYourClub')); return; }
  if (!nickname)    { setErr(t('enterYourNickname')); return; }
  if (!defaultPw)   { setErr(t('enterDefaultPassword')); return; }
  if (!email)       { setErr('Enter your email'); return; }
  if (newPassword.length < 6) { setErr('Password must be at least 6 characters'); return; }
  if (newPassword !== confirmPw) { setErr(t('passwordsNotMatch')); return; }

  // Send OTP to verify email
  setErr(t('sendingVerification'));
  errEl.style.color = 'var(--accent,#6c63ff)';
  var otpResult = await authSendOtp(email);
  if (otpResult.error) { errEl.style.color = ''; setErr(otpResult.error); return; }

  // Store claim data and show OTP screen
  _pendingClaim = { clubId, nickname, defaultPw, email, newPassword, recoveryWord };
  authShowOtpScreen(email, 'claim');
}

async function authCompleteClaim(otp) {
  if (!_pendingClaim) return;
  var { clubId, nickname, defaultPw, email, newPassword, recoveryWord } = _pendingClaim;

  var verifyResult = await authVerifyOtp(email, otp);
  if (verifyResult.error) { authShowError('authOtpError', verifyResult.error); return; }

  // OTP verified -- complete claim
  var result = await authClaimAccount(clubId, nickname, defaultPw, email, newPassword, recoveryWord);
  if (result.error) { authShowError('authOtpError', result.error); return; }

  _pendingClaim = null;
  authHideOtpScreen();
  authAfterLogin(result.user);
}
