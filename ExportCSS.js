const SUMMARY_CSS = `
/* ===============================
   ROUND EXPORT – SUMMARY CSS
   Used only for HTML export
================================ */

#export {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  color: #222;
  background: #ffffff;
  max-width: 900px;
  margin: 0 auto;
  padding: 12px;
  box-sizing: border-box;
}

#export * {
  box-sizing: border-box;
}

/* ===== ROUND CONTAINER ===== */
.export-round {
  margin-bottom: 18px;
  padding: 12px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #d1d5db;
}

/* ===== ROUND TITLE ===== */
.export-round-title {
  display: inline-flex;
  width: fit-content;
  margin: 0 auto 10px;
  padding: 6px 16px;
  font-size: 15px;
  font-weight: 700;
  background: #dce2a3;
  border-radius: 10px;
  color: #1f2937;
}

/* ===============================
   SUMMARY
================================ */

.report-header,
.player-card {
  display: grid;
  grid-template-columns:
    50px
    1fr
    minmax(60px, auto)   /* wins (NEW) */
    minmax(60px, auto)   /* played */
    minmax(60px, auto);  /* rested */
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

/* Rank */
.player-card .rank {
  text-align: center;
  font-size: 1.1rem;
  font-weight: bold;
}

/* Name */
.player-card .name {
  font-size: 1.1rem;
  padding-left: 6px;
}

/* ===== MATCH ROW ===== */
.export-match {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  margin: 8px 0;
  padding: 10px;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

/* ===== TEAM ===== */
.export-team {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  text-align: center;
  word-break: break-word;
}

/* ===== VS ===== */
.export-vs {
  font-size: 12px;
  font-weight: 700;
  color: #6b7280;
  padding: 0 6px;
}

/* ===== REST TITLE ===== */
.export-rest-title {
  margin-top: 10px;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 700;
  color: #374151;
}

/* ===== REST BOX ===== */
.export-rest-box {
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.4;
  background: #f1f5f9;
  border-radius: 10px;
  border: 1px dashed #cbd5e1;
  color: #1f2937;
}

/* ===== PRINT SAFETY ===== */
@media print {
  body {
    background: #ffffff;
  }

  .export-round {
    page-break-inside: avoid;
  }
}
`;
