/* =============================================
   subscription.js
   Trial tracking + subscription gate
   Free trial: 60 days from first install
   Product: club_pro_yearly (¥500/year)
   ============================================= */

var TRIAL_DAYS    = 60;
var PRODUCT_ID    = 'club_pro_yearly';
var _subStatus    = null; // null | 'trial' | 'active' | 'expired'

/* ── Init on app load ── */
function subInit() {
  var firstInstall = localStorage.getItem('sub_first_install');
  if (!firstInstall) {
    firstInstall = Date.now().toString();
    localStorage.setItem('sub_first_install', firstInstall);
  }
  _subStatus = _computeStatus();
  console.log('Subscription status:', _subStatus);
}

/* ── Compute current status ── */
function _computeStatus() {
  // Check if manually marked as subscribed (after Play Billing confirms)
  var subscribed = localStorage.getItem('sub_active');
  if (subscribed === 'true') return 'active';

  // Check trial
  var firstInstall = parseInt(localStorage.getItem('sub_first_install') || '0');
  var daysSince    = (Date.now() - firstInstall) / (1000 * 60 * 60 * 24);

  if (daysSince <= TRIAL_DAYS) return 'trial';
  return 'expired';
}

/* ── Public: is user allowed full access? ── */
function subHasAccess() {
  if (!_subStatus) subInit();
  return _subStatus === 'trial' || _subStatus === 'active';
}

/* ── Public: days remaining in trial ── */
function subTrialDaysLeft() {
  var firstInstall = parseInt(localStorage.getItem('sub_first_install') || '0');
  var daysSince    = (Date.now() - firstInstall) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(TRIAL_DAYS - daysSince));
}

/* ── Public: show paywall if no access ── */
function subGate(onAllowed) {
  if (!_subStatus) subInit();
  if (subHasAccess()) {
    if (typeof onAllowed === 'function') onAllowed();
  } else {
    showPaywall();
  }
}

/* ── Show paywall screen ── */
function showPaywall() {
  var overlay = document.getElementById('paywallOverlay');
  if (overlay) overlay.style.display = 'flex';
}

/* ── Hide paywall ── */
function hidePaywall() {
  var overlay = document.getElementById('paywallOverlay');
  if (overlay) overlay.style.display = 'none';
}

/* ── Trigger Play Billing purchase ── */
function subPurchase() {
  // Use Capacitor Play Billing plugin
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Billing) {
    window.Capacitor.Plugins.Billing.purchase({ productId: PRODUCT_ID })
      .then(function(result) {
        if (result && result.purchaseState === 1) {
          // Purchase successful
          localStorage.setItem('sub_active', 'true');
          _subStatus = 'active';
          hidePaywall();
          showToastMsg('✅ Subscribed! Welcome to Pro.');
        }
      })
      .catch(function(err) {
        console.warn('Purchase failed:', err);
        showToastMsg('Purchase cancelled.');
      });
  } else {
    // Fallback for web testing
    console.log('Billing not available — web mode');
    showToastMsg('Billing only available in the app.');
  }
}

/* ── Restore previous purchase ── */
function subRestore() {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Billing) {
    window.Capacitor.Plugins.Billing.restorePurchases()
      .then(function(result) {
        var purchases = result.purchases || [];
        var active = purchases.find(function(p) {
          return p.productId === PRODUCT_ID && p.purchaseState === 1;
        });
        if (active) {
          localStorage.setItem('sub_active', 'true');
          _subStatus = 'active';
          hidePaywall();
          showToastMsg('✅ Purchase restored!');
        } else {
          showToastMsg('No active subscription found.');
        }
      })
      .catch(function(err) {
        showToastMsg('Could not restore purchases.');
      });
  }
}

/* ── Show trial banner on home if trial active ── */
function subShowTrialBanner() {
  if (!_subStatus) subInit();
  var banner = document.getElementById('trialBanner');
  if (!banner) return;

  if (_subStatus === 'trial') {
    var days = subTrialDaysLeft();
    banner.style.display = '';
    banner.textContent   = days > 7
      ? '🎉 Free trial — ' + days + ' days remaining'
      : '⚠️ Trial ends in ' + days + ' day' + (days !== 1 ? 's' : '') + ' — Subscribe to continue';
    banner.className = days > 7 ? 'trial-banner' : 'trial-banner trial-banner-warn';
  } else if (_subStatus === 'expired') {
    banner.style.display = '';
    banner.textContent   = '🔒 Trial ended — Subscribe to continue';
    banner.className     = 'trial-banner trial-banner-expired';
  } else {
    banner.style.display = 'none';
  }
}

/* ── Simple toast helper ── */
function showToastMsg(msg) {
  if (typeof showToast === 'function') { showToast(msg); return; }
  var t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:20px;font-size:0.85rem;z-index:9999;';
  document.body.appendChild(t);
  setTimeout(function() { t.remove(); }, 3000);
}
