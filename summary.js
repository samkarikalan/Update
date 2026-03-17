/* ============================================================
   SUMMARY TAB — Round report and HTML export
   File: summary.js
   ============================================================ */

function renderRounds() {
  const exportRoot = document.getElementById('export');
  exportRoot.innerHTML = '';

  const lang = (typeof currentLang !== 'undefined') ? currentLang : 'en';
  const tr   = (typeof translations !== 'undefined') ? (translations[lang] || {}) : {};

  const rounds = (typeof allRounds !== 'undefined' ? allRounds : (window.allRounds || []));

  // Show all rounds except the current pending one (last entry has no winners yet)
  const completedRounds = rounds.slice(0, -1);
  if (!completedRounds.length) return;

  // Section title
  const title = document.createElement('div');
  title.className = 'round-header';
  title.style.margin = '16px 4px 6px';
  title.textContent = tr.rounds || 'Rounds';
  exportRoot.appendChild(title);

  // Render newest first
  for (let i = completedRounds.length - 1; i >= 0; i--) {
    exportRoot.appendChild(_buildSummaryRound(completedRounds[i], tr));
  }
}

function _buildSummaryRound(data, tr) {
  if (!data) return document.createElement('div');

  const wrapper = document.createElement('div');
  wrapper.className = 'round-wrapper viewer-rounds';

  const header = document.createElement('div');
  header.className = 'round-header';
  header.textContent = (tr.roundno || 'Round ') + data.round;
  wrapper.appendChild(header);

  (data.games || []).forEach((game, gi) => {
    const courtDiv = document.createElement('div');
    courtDiv.className = 'courtcard court-' + (gi + 1);

    const courtName = document.createElement('div');
    courtName.className = 'courtname';
    courtName.textContent = 'Court ' + (gi + 1);
    courtDiv.appendChild(courtName);

    const teamsDiv = document.createElement('div');
    teamsDiv.className = 'teams';

    ['L', 'R'].forEach((side, si) => {
      const teamDiv = document.createElement('div');
      teamDiv.className = 'team';
      teamDiv.style.pointerEvents = 'none';

      if (game.winner === side) {
        teamDiv.classList.add('winner');
        const cup = document.createElement('img');
        cup.src = 'win-cup.png';
        cup.className = 'win-cup active';
        cup.style.cssText = 'pointer-events:none;visibility:visible;opacity:1;filter:none;';
        teamDiv.appendChild(cup);
      }

      const players = side === 'L' ? (game.pair1 || []) : (game.pair2 || []);
      players.forEach(name => {
        const btn = document.createElement('button');
        btn.className = side === 'L' ? 'Lplayer-btn' : 'Rplayer-btn';
        btn.textContent = name;
        btn.style.pointerEvents = 'none';
        btn.tabIndex = -1;
        teamDiv.appendChild(btn);
      });

      teamsDiv.appendChild(teamDiv);

      if (si === 0) {
        const vs = document.createElement('div');
        vs.className = 'vs-divider';
        vs.innerHTML = '<div class="vs-line"></div><span>VS</span><div class="vs-line"></div>';
        teamsDiv.appendChild(vs);
      }
    });

    courtDiv.appendChild(teamsDiv);
    wrapper.appendChild(courtDiv);
  });

  if (data.resting && data.resting.length) {
    const restRow = document.createElement('div');
    restRow.className = 'round-header';
    restRow.style.paddingLeft = '12px';
    restRow.textContent = tr.sittingOut || 'Resting';
    const restBox = document.createElement('div');
    restBox.className = 'rest-box';
    data.resting.forEach(name => {
      const chip = document.createElement('span');
      chip.className = 'rest-btn';
      chip.textContent = name.split('#')[0];
      chip.style.cssText = 'pointer-events:none;cursor:default;';
      restBox.appendChild(chip);
    });
    restRow.appendChild(restBox);
    wrapper.appendChild(restRow);
  }

  return wrapper;
}

// ExportCSS.js

async function createSummaryCSS() {
  return `
/* Summary */
.report-header,
.player-card {
  display: grid;
  grid-template-columns: 50px 1fr minmax(60px, auto) minmax(60px, auto) minmax(60px, auto);
  align-items: center;
  gap: 10px;
}

/* Header styling */
.report-header {
  margin: 5px 0;
  background: #800080;
  font-weight: bold;
  color: #fff;
  padding: 6px;
  border-radius: 6px;
  margin-bottom: 1px;
  position: sticky;
  z-index: 10;
}

/* Player card styling */
.player-card {
  background: #296472;
  color: #fff;
  padding: 2px;
  margin: 5px 0;
  border-radius: 1.1rem;
  border: 1px solid #555;
  box-shadow: 0 0 4px rgba(0,0,0,0.4);
}

/* Rank styling */
.player-card .rank {
  text-align: center;
  font-size: 1.1rem;
  font-weight: bold;
}

/* Name column */
.player-card .name {
  font-size: 1.1rem;
  padding-left: 6px;
}


.export-round {
  margin: 15px 3px 3px;
  border: 3px solid #800080;
}

.export-round-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  border-bottom: 1px solid #000;
  padding-bottom: 4px;
  text-align: center;
}

.export-match {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 5px;
}

.export-team {
  position: relative;           /* allow positioning of trophy */
  padding: 10px 25px 10px 10px; /* top/right/bottom/left; right space for trophy */
  display: flex;                /* use flex for centering and spacing */
  flex-direction: column;       /* stack players vertically */
  align-items: center;          /* center horizontally */
  justify-content: center;      /* center vertically */
  border: 2px solid #333;    /* boundary */
  border-radius: 8px;           /* optional rounded corners */
  width: 37%;             /* ensures all boxes roughly same size */
  background-color:none;    /* optional light background */
  text-align: center;           /* center text inside */
}

/* Trophy on the right for winning team */
.export-team::after {
  content: '🏆';
  position: absolute;
  right: 5px;                   /* stick to right edge */
  top: 50%;                     /* vertically center */
  transform: translateY(-50%);
  display: none;                 /* hidden by default */
}

.export-team.winner::after {
  display: inline-block;
}



.export-vs {
  width: 10%;
  text-align: center;
  font-weight: 600;
}

/* Sitting out */
.export-rest-title {
  margin: 5px;
  font-weight: 600;
}

.export-rest-box {
  margin: 5px;
  font-size: 13px;
}

`;
}

async function exportBRR2HTML() {
  const SUMMARY_CSS = await createSummaryCSS();
  showPage('summaryPage');
  await new Promise(r => setTimeout(r, 300));

  const page = document.getElementById('summaryPage');
  if (!page) return alert("Export page not found");

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BRR Export</title>
<style>
${SUMMARY_CSS}
</style>
</head>
<body>
${page.outerHTML}
</body>
</html>
`;

  // ✅ Android WebView
  if (window.Android && typeof Android.saveHtml === "function") {
    Android.saveHtml(html);
  }

  // ✅ iOS WebView (if you implemented message handler)
  else if (window.webkit && window.webkit.messageHandlers?.saveHtml) {
    window.webkit.messageHandlers.saveHtml.postMessage(html);
  }

  // ✅ Normal browser fallback (download file)
  else {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "BRR_Export.html";
    a.click();

    URL.revokeObjectURL(url);
  }
}
