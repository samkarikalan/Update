function renderRounds() {
  const exportRoot = document.getElementById('export');
  exportRoot.innerHTML = '';
  
  allRounds.slice(0, -1).forEach((data) => {
  //allRounds.forEach((data) => {

    /* ───────── Round Container ───────── */
    const roundDiv = document.createElement('div');
    roundDiv.className = 'export-round';

    /* ───────── Round Title ───────── */
    const title = document.createElement('div');
    title.className = 'export-round-title';
    title.textContent = data.round; // existing variable
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

      match.append(leftTeam, vs, rightTeam);
      roundDiv.appendChild(match);
    });

    /* ───────── Sitting Out Section ───────── */
    const restTitle = document.createElement('div');
    restTitle.className = 'export-rest-title';
    restTitle.textContent = t('sittingOut'); // ✅ translated
    roundDiv.appendChild(restTitle);

    const restBox = document.createElement('div');
    restBox.className = 'export-rest-box';

    if (!data.resting || data.resting.length === 0) {
      restBox.textContent = t('none'); // ✅ translated
    } else {
      restBox.innerHTML = data.resting.join(', ');
    }

    roundDiv.appendChild(restBox);

    exportRoot.appendChild(roundDiv);
  });
}




function isAndroidWebView() {
  return (
    /Android/i.test(navigator.userAgent) &&
    /wv/.test(navigator.userAgent)
  );
}

async function exportBRR2HTML() {
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

Android.saveHtml(html);
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


async function exportBRR2pdf() {
    showPage('page3');
  await new Promise(r => setTimeout(r, 400));

  const page1 = document.getElementById('page3');
  if (!page1 || page1.offsetHeight === 0) {
    alert('page1 not visible');
    return;
  }


  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p', 'px', 'a4');

  // Save original styles
  const originalOverflow = page1.style.overflow;
  const originalHeight = page1.style.height;
  page1.style.overflow = 'visible';
  page1.style.height = 'auto';
  await new Promise(r => setTimeout(r, 100));

  const canvas = await html2canvas(page1, {
    scale: 1,
    useCORS: true,
    backgroundColor: '#ffffff'
  });

  // Restore styles
  page1.style.overflow = originalOverflow;
  page1.style.height = originalHeight;

  const imgData = canvas.toDataURL('image/png');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  // Height of canvas in PDF units
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const ratio = pdfWidth / canvasWidth;
  const pdfCanvasHeight = canvasHeight * ratio;

  let remainingHeight = pdfCanvasHeight;
  let position = 0;

  while (remainingHeight > 0) {
    const pageHeight = Math.min(remainingHeight, pdfHeight);

    pdf.addImage(
      imgData,
      'PNG',
      0,
      position, // vertical position in PDF
      pdfWidth,
      pdfCanvasHeight
    );

    remainingHeight -= pdfHeight;
    if (remainingHeight > 0) pdf.addPage();
    position -= pdfHeight; // shift next page up
  }

  pdf.save('page1_multi.pdf');
}



async function waexportBRR2pdf() {

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p', 'px', 'a4');

  const page1 = document.getElementById('page1');
  const page3 = document.getElementById('page3');

  if (!page1 || !page3) {
    alert('Pages not found');
    return;
  }

  // ---------- PAGE 1 ----------
  page1.scrollIntoView({ behavior: 'auto' });
  await new Promise(r => setTimeout(r, 300)); // wait for paint

  let canvas1 = await html2canvas(page1, {
    scale: 1,
    useCORS: true,
    backgroundColor: '#ffffff'
  });

  let img1 = canvas1.toDataURL('image/png');
  let w = pdf.internal.pageSize.getWidth();
  let h1 = (canvas1.height * w) / canvas1.width;

  pdf.addImage(img1, 'PNG', 0, 0, w, h1);

  // ---------- PAGE 3 ----------
  page3.scrollIntoView({ behavior: 'auto' });
  await new Promise(r => setTimeout(r, 300)); // wait for paint

  let canvas3 = await html2canvas(page3, {
    scale: 1,
    useCORS: true,
    backgroundColor: '#ffffff'
  });

  let img3 = canvas3.toDataURL('image/png');
  let h3 = (canvas3.height * w) / canvas3.width;

  pdf.addPage();
  pdf.addImage(img3, 'PNG', 0, 0, w, h3);

  pdf.save('Page1_Page3.pdf');
}





async function bestexportAllRoundsToPDF() {
  if (!allRounds || allRounds.length === 0) {
    alert('No rounds to export');
    return;
  }

  const originalRoundIndex = currentRoundIndex ?? 0;

  // 🔹 Temporary container for PDF
  const exportContainer = document.createElement('div');
  exportContainer.style.width = '210mm';
  exportContainer.style.background = '#fff';
  document.body.appendChild(exportContainer);

  /* =========================
     1️⃣ PLAYERS PAGE
  ========================= */
  const page1 = document.getElementById('page1');
  if (page1) {
    const clone = page1.cloneNode(true);
    clone.style.display = 'block';
    clone.style.pageBreakAfter = 'always';

    clone.prepend(makeTitle('Players'));
    exportContainer.appendChild(clone);
  }

  /* =========================
     2️⃣ SUMMARY PAGE
  ========================= */
  const page3 = document.getElementById('page3');
  if (page3) {
    const clone = page3.cloneNode(true);
    clone.style.display = 'block';
    clone.style.pageBreakAfter = 'always';

    clone.prepend(makeTitle('Summary'));
    exportContainer.appendChild(clone);
  }

  /* =========================
     3️⃣ ROUNDS (FULL PAGE2)
  ========================= */
  const page2 = document.getElementById('page2');

  for (let i = 0; i < allRounds.length; i++) {
    showRound(i);
    await waitForPaint();

    const roundClone = page2.cloneNode(true);

    // 🔥 Force render hidden page
    roundClone.style.display = 'block';
    roundClone.style.pageBreakAfter = 'always';

    roundClone.prepend(makeTitle(allRounds[i].round));

    exportContainer.appendChild(roundClone);
  }

  /* =========================
     EXPORT
  ========================= */
  await html2pdf().set({
    margin: 1,
    filename: 'Badminton_Schedule.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }).from(exportContainer).save();

  // 🧹 Restore UI
  document.body.removeChild(exportContainer);
  showRound(originalRoundIndex);
}

/* ===== helpers ===== */

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
