/* =============================================
   build.js
   Minifies all JS files to protect source code
   Run: node build.js
   ============================================= */

const fs   = require('fs');
const path = require('path');

// Try to use terser if available, otherwise basic minification
let minify;
try {
  const terser = require('terser');
  minify = async (code) => {
    const result = await terser.minify(code, {
      compress: {
        drop_console: true,   // Remove console.log in production
        dead_code: true,
        passes: 2
      },
      mangle: {
        toplevel: false,      // Don't mangle top-level names (breaks app)
        reserved: [           // Protect function names called from HTML
          'selectMode','switchMode','showPage','showHomeScreen',
          'homeGo','navBack','homeBack','homeGoSummary',
          'roundsGoPlayers','roundsGoFixedPairs','roundsGoSummary',
          'stepAction','stepSkip','stepCourtAdj','stepSyncMode','stepCourtsDone',
          'openProfileDrawer','closeProfileDrawer','updateProfileBtn',
          'renderMyCard','renderSummaryFromSession',
          'subPurchase','subRestore','subGate','subInit',
          'showPaywall','hidePaywall','homeSwitchMode',
          'vaultShowTab','toggleClubMgmt',
          'settingsToggleLangPicker','settingsSelectLang',
          'setTheme','setFontSize',
          'newImportShowModal','addPlayersFromInputUI',
          'modifyFixedPair','fpTogglePicker',
          'RefreshRound','toggleRound','toggleRoundSettings',
          'viewerOpen','viewerGoBack','renderDashboard',
          'syncToLocal','viewerJoinClub','clubLoginSwitch',
          'exportBRR2HTML','onHelpTabOpen',
          'ResetAll','resetRounds','showConfirm',
          'adminVerifyPassword','adminCloseModal',
          'getPlayMode','updatePlayerList','updateFixedPairSelectors',
          'settingsShowTab','filterPickerList','switchProfilePlayer'
        ]
      },
      format: {
        comments: false
      }
    });
    return result.code;
  };
  console.log('Using terser for minification');
} catch(e) {
  // Basic minification fallback
  minify = async (code) => {
    return code
      .replace(/\/\*[\s\S]*?\*\//g, '')   // Remove block comments
      .replace(/\/\/[^\n]*/g, '')           // Remove line comments
      .replace(/\n\s*/g, '\n')              // Reduce whitespace
      .replace(/  +/g, ' ');               // Collapse spaces
  };
  console.log('terser not found — using basic minification. Run: npm install');
}

const JS_FILES = [
  'subscription.js',
  'HomeScreen.js',
  'main.js',
  'home.js',
  'settings.js',
  'players.js',
  'rounds.js',
  'games.js',
  'summary.js',
  'dashboard.js',
  'viewer.js',
  'profile.js',
  'supabase.js',
  'importPlayers.js',
  'competitive_algorithm.js',
  'engjap.js',
  'ExportCSS.js',
  'github.js',
  'help.js'
];

async function build() {
  console.log('Building Club Scheduler...\n');

  // Create dist directory
  if (!fs.existsSync('dist')) fs.mkdirSync('dist');

  // Copy all non-JS files
  const allFiles = fs.readdirSync('.');
  for (const file of allFiles) {
    if (file === 'dist' || file === 'node_modules' || file === 'android' || file === 'ios') continue;
    if (file.endsWith('.js') && JS_FILES.includes(file)) continue; // JS handled separately
    if (fs.statSync(file).isFile()) {
      fs.copyFileSync(file, path.join('dist', file));
    }
  }

  // Minify JS files
  let totalSaved = 0;
  for (const file of JS_FILES) {
    if (!fs.existsSync(file)) { console.log(`  SKIP ${file} (not found)`); continue; }
    const original = fs.readFileSync(file, 'utf8');
    try {
      const minified = await minify(original);
      fs.writeFileSync(path.join('dist', file), minified, 'utf8');
      const saved = original.length - minified.length;
      totalSaved += saved;
      console.log(`  ✓ ${file} (${(saved/1024).toFixed(1)}KB saved)`);
    } catch(e) {
      console.log(`  ✗ ${file} — minification failed, copying as-is`);
      fs.copyFileSync(file, path.join('dist', file));
    }
  }

  console.log(`\nBuild complete → /dist`);
  console.log(`Total size saved: ${(totalSaved/1024).toFixed(1)}KB`);
  console.log('\nNext steps:');
  console.log('  npx cap sync');
  console.log('  npx cap open android');
}

build().catch(console.error);
