function renderRounds() {
  const exportRoot = document.getElementById('export');
  exportRoot.innerHTML = '';

  allRounds.slice(0, -1).forEach((data) => {
    /* ───────── Round Container ───────── */
    const roundDiv = document.createElement('div');
    roundDiv.className = 'export-round';

    /* ───────── Round Title ───────── */
    const title = document.createElement('div');
    title.className = 'export-round-title';
    title.textContent = data.round;
    roundDiv.appendChild(title);

    /* ───────── Matches ───────── */
    data.games.forEach(game => {
      const match = document.createElement('div');
      match.className = 'export-match';

      const leftTeam = document.createElement('div');
      leftTeam.className = 'export-team';
      leftTeam.innerHTML = game.pair1.join('<br>');

      const vs = document.createElement('div');
      vs.className = 'export-vs';
      vs.textContent = 'VS';

      const rightTeam = document.createElement('div');
      rightTeam.className = 'export-team';
      rightTeam.innerHTML = game.pair2.join('<br>');

      // ✅ Add 🏆 to the winning team
      if (game.winners && Array.isArray(game.winners)) {
        const leftWins = game.pair1.filter(p => game.winners.includes(p)).length;
        const rightWins = game.pair2.filter(p => game.winners.includes(p)).length;

       if (leftWins > rightWins) {
          leftTeam.classList.add('winner');
        } else if (rightWins > leftWins) {
          rightTeam.classList.add('winner');
        } else if (leftWins > 0 && leftWins === rightWins) {
          leftTeam.classList.add('winner');
          rightTeam.classList.add('winner');
        }
      }

      match.append(leftTeam, vs, rightTeam);
      roundDiv.appendChild(match);
    });

    /* ───────── Sitting Out Section ───────── */
    const restTitle = document.createElement('div');
    restTitle.className = 'export-rest-title';
    restTitle.textContent = t('sittingOut'); 
    roundDiv.appendChild(restTitle);

    const restBox = document.createElement('div');
    restBox.className = 'export-rest-box';

    if (!data.resting || data.resting.length === 0) {
      restBox.textContent = t('none'); 
    } else {
      restBox.innerHTML = data.resting.join(', ');
    }

    roundDiv.appendChild(restBox);

    exportRoot.appendChild(roundDiv);
  });
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
  showPage('page3');
  await new Promise(r => setTimeout(r, 300));

  const page = document.getElementById('page3');
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








