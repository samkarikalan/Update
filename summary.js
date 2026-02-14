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



function isWebView() {
  const ua = navigator.userAgent || navigator.vendor || window.opera;

  // iOS WebView (no "Safari" in UA)
  const iOSWebView =
    /iPhone|iPad|iPod/i.test(ua) &&
    !/Safari/i.test(ua);

  // Android WebView
  const androidWebView =
    /Android/i.test(ua) &&
    (/wv/.test(ua) || !/Chrome/i.test(ua));

  return iOSWebView || androidWebView;
}



async function exportBRR2HTMLbk() {
  showPage('page3');
  await new Promise(r => setTimeout(r, 300));

  const page = document.getElementById('page3');
  if (!page) return alert("Export page not found");

  let css = '';
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        css += rule.cssText + '\n';
      }
    } catch {}
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BRR Export</title>
<style>${css}</style>
</head>
<body>
${page.outerHTML}
</body>
</html>
`;

  Android.saveHtml(html);
}




function makeTitle(text) {
  const h = document.createElement('h2');
  h.innerText = text;
  h.style.textAlign = 'center';
  h.style.marginBottom = '10px';
  return h;
}

function waitForPaint() {
  return new Promise(resolve => setTimeout(resolve, 150));
}
function saveSchedule() {
  // Placeholder – implement later
  console.log('Save schedule clicked');

  // Future ideas:
  // localStorage.setItem('savedSchedule', JSON.stringify(allRounds));
  // export JSON
  // cloud sync

  alert('Save feature coming soon');
}
