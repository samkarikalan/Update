/* ============================================================
   report.js -- Club Monthly Report Generator
   Reads from: players (via memberships), sessions array
   Exports to: kariscs/SCS_Report on GitHub Pages
   ============================================================ */

const REPORT_GITHUB_OWNER = 'kariscs';
const REPORT_GITHUB_REPO  = 'SCS_Report';
const REPORT_GITHUB_API   = 'https://api.github.com';
const REPORT_PAGE_URL     = 'https://kariscs.github.io/SCS_Report/';

/* ── Get current month string e.g. "2026-04" ── */
function reportCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function reportMonthLabel() {
  const d = new Date();
  return d.toLocaleString('default', { month: 'long', year: 'numeric' });
}

/* ── Fetch all player data for report ── */
async function reportFetchData() {
  const club = (typeof getMyClub === 'function') ? getMyClub() : null;
  if (!club || !club.id) throw new Error('No club selected');

  const month = reportCurrentMonth();

  // 1. Get all completed sessions for this club this month -- same as dashboard
  const allSessions = await sbGet('sessions',
    `club_id=eq.${club.id}&status=eq.completed&select=id,date,players,rounds_data,shuttle_data`
  );
  const monthSessions = (allSessions || []).filter(s => s.date && s.date.startsWith(month));

  // 2. Get memberships for current rating/points
  const memberships = await sbGet('memberships',
    `club_id=eq.${club.id}&select=id,nickname,club_rating,club_points`
  );
  if (!memberships || !memberships.length) throw new Error('No players found');

  // 3. Build per-player stats from sessions table
  const statsMap = {};

  for (const sess of monthSessions) {
    const sessPlayers  = sess.players || [];
    const costPerPlayer = sess.shuttle_data ? (parseFloat(sess.shuttle_data.cost_per_player) || 0) : 0;
    const roundsData   = sess.rounds_data || [];

    // Count wins/losses from rounds_data
    const winsMap = {}, lossesMap = {};
    for (const round of roundsData) {
      for (const game of (round.games || [])) {
        if (!game.winner) continue;
        const winners = game.winner === 'L' ? (game.pair1 || []) : (game.pair2 || []);
        const losers  = game.winner === 'L' ? (game.pair2 || []) : (game.pair1 || []);
        winners.forEach(n => { winsMap[n]   = (winsMap[n]   || 0) + 1; });
        losers.forEach(n  => { lossesMap[n] = (lossesMap[n] || 0) + 1; });
      }
    }

    // Each player in this session gets +1 session
    for (const p of sessPlayers) {
      const name = (p.name || p.player_name || '').trim();
      if (!name) continue;
      if (!statsMap[name]) statsMap[name] = { wins: 0, losses: 0, cost: 0, sessions: 0 };
      statsMap[name].sessions += 1;
      statsMap[name].wins     += winsMap[name]   || 0;
      statsMap[name].losses   += lossesMap[name] || 0;
      statsMap[name].cost     += costPerPlayer;
    }
  }

  // 4. Merge with membership ratings/points
  const players = memberships.map(m => {
    const name  = m.nickname || '';
    const st    = statsMap[name] || { wins: 0, losses: 0, cost: 0, sessions: 0 };
    const games = st.wins + st.losses;
    return {
      name,
      rating:     parseFloat(m.club_rating) || 1.0,
      points:     Math.round((parseFloat(m.club_points) || 0) * 10) / 10,
      monthWins:  st.wins,
      monthLosses:st.losses,
      monthGames: games,
      monthCost:  Math.round(st.cost),
      sessCount:  st.sessions,
      winRate:    games > 0 ? Math.round((st.wins / games) * 100) : 0,
    };
  }).filter(p => p.sessCount > 0 || p.rating > 1.0)
    .sort((a, b) => b.rating - a.rating);

  return { club, players, month, monthLabel: reportMonthLabel() };
}

/* ── Build HTML string ── */
function reportBuildHTML({ club, players, monthLabel }) {
  const maxRating  = Math.max(...players.map(p => p.rating), 5);
  const maxSess    = Math.max(...players.map(p => p.sessCount), 1);
  const maxCost    = Math.max(...players.map(p => p.monthCost), 1);
  const maxPts     = Math.max(...players.map(p => p.points), 1);

  const totalCost  = players.reduce((a, p) => a + p.monthCost, 0);
  const avgRating  = players.length ? (players.reduce((a,p) => a+p.rating,0)/players.length).toFixed(1) : '--';
  const avgSess    = players.length ? (players.reduce((a,p) => a+p.sessCount,0)/players.length).toFixed(1) : '--';
  const topRating  = players.length ? players[0].rating.toFixed(1) : '--';
  const mostActive = players.length ? [...players].sort((a,b)=>b.sessCount-a.sessCount)[0] : null;
  const topPts     = players.length ? [...players].sort((a,b)=>b.points-a.points)[0] : null;

  function rank(i) {
    if (i===0) return '🥇'; if (i===1) return '🥈'; if (i===2) return '🥉';
    return `<span style="opacity:0.4;font-size:0.65rem;">${i+1}</span>`;
  }

  function pct(val, max) { return Math.round((val/max)*100); }

  function playerRows(sortKey, maxVal, valFn, displayFn) {
    return [...players]
      .sort((a,b) => b[sortKey]-a[sortKey])
      .map((p,i) => `
        <div class="w-row">
          <div class="r-rank">${rank(i)}</div>
          <div class="r-name">${p.name}</div>
          <div class="r-track"><div class="r-fill" style="width:${pct(valFn(p),maxVal)}%;"></div></div>
          <div class="r-val">${displayFn(p)}</div>
        </div>`).join('');
  }

  function axisLabels(vals) {
    return vals.map(v=>`<span>${v}</span>`).join('');
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${club.name} -- ${monthLabel} Report</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500;600&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'DM Sans',sans-serif;background:#0a0a12;color:#fff;padding:16px;max-width:420px;margin:0 auto;min-height:100vh;}
.widget{border-radius:26px;overflow:hidden;margin-bottom:14px;position:relative;}
.w-header{padding:20px 20px 16px;position:relative;}
.w-club{font-size:0.68rem;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;opacity:0.7;margin-bottom:2px;}
.w-title{font-size:1.6rem;font-weight:700;letter-spacing:-0.5px;line-height:1.1;}
.w-icon{position:absolute;right:20px;top:18px;font-size:2.4rem;opacity:0.25;}
.w-meta{display:flex;gap:14px;margin-top:6px;flex-wrap:wrap;}
.w-meta-item{font-size:0.72rem;opacity:0.65;}
.w-meta-item strong{font-size:0.82rem;opacity:1;font-weight:600;margin-right:2px;}
.w-divider{height:1px;background:rgba(255,255,255,0.12);margin:0 20px;}
.w-rows{padding:8px 0 4px;}
.w-row{display:flex;align-items:center;padding:8px 20px;gap:10px;}
.r-rank{font-size:0.75rem;width:22px;flex-shrink:0;text-align:center;}
.r-name{font-size:0.8rem;font-weight:600;width:82px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.r-track{flex:1;height:5px;background:rgba(255,255,255,0.12);border-radius:10px;overflow:hidden;position:relative;}
.r-fill{height:100%;border-radius:10px;position:absolute;left:0;top:0;}
.r-val{font-family:'DM Mono',monospace;font-size:0.72rem;font-weight:600;width:52px;text-align:right;flex-shrink:0;}
.w-axis{display:flex;justify-content:space-between;padding:4px 20px 14px;}
.w-axis span{font-size:0.55rem;opacity:0.3;font-family:'DM Mono',monospace;}
/* W1 Rating - Purple */
.w1{background:linear-gradient(145deg,#1a1040,#2d1b6e,#1e1060);border:1px solid rgba(160,120,255,0.25);box-shadow:0 8px 32px rgba(108,60,255,0.3);}
.w1 .r-fill{background:linear-gradient(90deg,#a78bfa,#c4b5fd);}
.w1 .r-val{color:#c4b5fd;}
.w1 .w-meta-item strong{color:#a78bfa;}
/* W2 Sessions - Teal */
.w2{background:linear-gradient(145deg,#0a2a2a,#0d4040,#0a3030);border:1px solid rgba(45,206,137,0.25);box-shadow:0 8px 32px rgba(20,180,140,0.25);}
.w2 .r-fill{background:linear-gradient(90deg,#2dce89,#7ef0c0);}
.w2 .r-val{color:#7ef0c0;}
.w2 .w-meta-item strong{color:#2dce89;}
/* W3 Cost - Gold */
.w3{background:linear-gradient(145deg,#1e1400,#3d2800,#2a1c00);border:1px solid rgba(245,200,66,0.25);box-shadow:0 8px 32px rgba(245,180,40,0.2);}
.w3 .r-fill{background:linear-gradient(90deg,#f5c842,#ffe599);}
.w3 .r-val{color:#ffe599;}
.w3 .w-meta-item strong{color:#f5c842;}
/* W4 Points - Coral */
.w4{background:linear-gradient(145deg,#1e0814,#3d1028,#2a0c1e);border:1px solid rgba(232,93,117,0.25);box-shadow:0 8px 32px rgba(232,93,117,0.2);}
.w4 .g-row{display:flex;align-items:center;padding:7px 20px;gap:10px;}
.w4 .g-name{font-size:0.8rem;font-weight:600;width:82px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.w4 .g-track{flex:1;height:22px;background:rgba(255,255,255,0.07);border-radius:8px;overflow:hidden;}
.w4 .g-fill{height:100%;border-radius:8px;display:flex;align-items:center;padding-left:8px;font-size:0.62rem;font-weight:700;color:rgba(255,255,255,0.9);}
.w4 .g-num{font-family:'DM Mono',monospace;font-size:0.72rem;font-weight:600;width:38px;text-align:right;flex-shrink:0;color:#f9a8b8;}
.footer{text-align:center;font-size:0.6rem;color:rgba(255,255,255,0.18);padding:8px 0 12px;letter-spacing:0.5px;}
</style>
</head>
<body>

<!-- WIDGET 1 -- RATING -->
<div class="widget w1">
  <div class="w-header">
    <div class="w-club">${club.name} · ${monthLabel}</div>
    <div class="w-title">Rating</div>
    <div class="w-icon">⭐</div>
    <div class="w-meta">
      <div class="w-meta-item">Top <strong>${topRating}</strong></div>
      <div class="w-meta-item">Avg <strong>${avgRating}</strong></div>
      <div class="w-meta-item">Scale <strong>0 - 5</strong></div>
    </div>
  </div>
  <div class="w-divider"></div>
  <div class="w-rows">
    ${playerRows('rating', 5, p=>p.rating, p=>p.rating.toFixed(1))}
  </div>
  <div class="w-axis">${axisLabels(['0','1','2','3','4','5'])}</div>
</div>

<!-- WIDGET 2 -- SESSIONS -->
<div class="widget w2">
  <div class="w-header">
    <div class="w-club">${club.name} · ${monthLabel}</div>
    <div class="w-title">Sessions</div>
    <div class="w-icon">🎮</div>
    <div class="w-meta">
      <div class="w-meta-item">Most <strong>${mostActive ? mostActive.sessCount : '--'}</strong></div>
      <div class="w-meta-item">Avg <strong>${avgSess}</strong></div>
    </div>
  </div>
  <div class="w-divider"></div>
  <div class="w-rows">
    ${playerRows('sessCount', maxSess, p=>p.sessCount, p=>p.sessCount)}
  </div>
  <div class="w-axis">${axisLabels(['0','','','','',maxSess])}</div>
</div>

<!-- WIDGET 3 -- COST -->
<div class="widget w3">
  <div class="w-header">
    <div class="w-club">${club.name} · ${monthLabel}</div>
    <div class="w-title">Cost</div>
    <div class="w-icon">💴</div>
    <div class="w-meta">
      <div class="w-meta-item">Total <strong>¥${totalCost.toLocaleString()}</strong></div>
      <div class="w-meta-item">Max <strong>¥${maxCost.toLocaleString()}</strong></div>
    </div>
  </div>
  <div class="w-divider"></div>
  <div class="w-rows">
    ${playerRows('monthCost', maxCost, p=>p.monthCost, p=>'¥'+p.monthCost.toLocaleString())}
  </div>
  <div class="w-axis">${axisLabels(['¥0','','','','','¥'+maxCost.toLocaleString()])}</div>
</div>

<!-- WIDGET 4 -- POINTS -->
<div class="widget w4">
  <div class="w-header">
    <div class="w-club">${club.name} · ${monthLabel}</div>
    <div class="w-title">Points</div>
    <div class="w-icon">🏆</div>
    <div class="w-meta">
      <div class="w-meta-item">Top <strong>${topPts ? topPts.points : '--'} pts</strong></div>
    </div>
  </div>
  <div class="w-divider"></div>
  <div class="w-rows">
    ${[...players].sort((a,b)=>b.points-a.points).map((p,i)=>`
      <div class="g-row">
        <div class="g-name">${p.name}</div>
        <div class="g-track">
          <div class="g-fill" style="width:${pct(p.points,maxPts)}%;background:linear-gradient(90deg,#e85d75,#f9a8b8);">${p.points.toFixed(1)}</div>
        </div>
        <div class="g-num">${p.points.toFixed(1)}</div>
      </div>`).join('')}
  </div>
  <div class="w-axis">${axisLabels(['0','','','','',maxPts])}</div>
</div>

<div class="footer">Generated by KariBRR · ${monthLabel}</div>
</body>
</html>`;
}

/* ── Write HTML to GitHub Pages repo ── */
async function reportExportToGitHub(htmlContent, clubSlug, monthStr) {
  const filename = `${clubSlug}_${monthStr}.html`;
  const apiUrl   = `${REPORT_GITHUB_API}/repos/${REPORT_GITHUB_OWNER}/${REPORT_GITHUB_REPO}/contents/${filename}`;

  const token = (typeof getGithubToken === 'function') ? getGithubToken() : localStorage.getItem('kbrr_admin_token');

  // Check if file exists to get SHA
  let sha = null;
  try {
    const checkHeaders = { 'Accept': 'application/vnd.github+json' };
    if (token) checkHeaders['Authorization'] = `token ${token}`;
    const check = await fetch(apiUrl, { headers: checkHeaders });
    if (check.ok) { const j = await check.json(); sha = j.sha; }
  } catch(e) { /* new file */ }

  // Encode HTML as base64 (UTF-8 safe)
  const encoded = btoa(unescape(encodeURIComponent(htmlContent)));

  const body = {
    message: `Report: ${clubSlug} ${monthStr}`,
    content: encoded,
    ...(sha ? { sha } : {})
  };

  const putHeaders = { 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' };
  if (token) putHeaders['Authorization'] = `token ${token}`;

  const res = await fetch(apiUrl, {
    method: 'PUT',
    headers: putHeaders,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Export failed');
  }

  return `${REPORT_PAGE_URL}${filename}`;
}

/* ── Main entry: generate + export ── */
async function reportGenerate() {
  const statusEl = document.getElementById('reportStatus');
  const btnEl    = document.getElementById('reportGenerateBtn');
  const linkEl   = document.getElementById('reportLink');

  function setStatus(msg, color) {
    if (statusEl) { statusEl.textContent = msg; statusEl.style.color = color || 'var(--muted)'; }
  }

  if (btnEl) btnEl.disabled = true;
  if (linkEl) linkEl.style.display = 'none';
  setStatus(t('loading') + '...');

  try {
    // 1. Fetch data
    setStatus('📊 ' + (t('loading') || 'Loading data...'));
    const data = await reportFetchData();

    // 2. Build HTML
    setStatus('🎨 Building report...');
    const html = reportBuildHTML(data);

    // 3. Export to GitHub
    setStatus('☁️ Uploading...');
    const clubSlug = data.club.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g,'');
    const url = await reportExportToGitHub(html, clubSlug, data.month);

    // 4. Show link
    setStatus('✅ Report published!', '#2dce89');
    if (linkEl) {
      linkEl.href = url;
      linkEl.textContent = url;
      linkEl.style.display = '';
    }
    if (btnEl) btnEl.disabled = false;

  } catch(e) {
    setStatus('❌ ' + e.message, '#e63757');
    if (btnEl) btnEl.disabled = false;
  }
}
