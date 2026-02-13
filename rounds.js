
let allRounds = [];
let lastRound = [];
let currentRoundIndex = 0;
let isOnPage2 = false;
let resetRest = false;


	
let schedulerState = {
    numCourts: 0,
    allPlayers: [],
    activeplayers: [],
    fixedPairs: [],
    PlayedCount: new Map(),
    restCount: new Map(),
    restQueue: new Map(),
    PlayerScoreMap: new Map(),
    playedTogether: new Map(),
    fixedMap: new Map(),
    roundIndex: 0,
    pairPlayedSet: new Set(),
	pairPlayedSet: new Set(),
    gamesMap: new Map(), // 🆕 per-player opponent tracking
	markingWinnerMode: false,
	winCount: new Map(), // 🏆 Track player wins
	pairCooldownMap: new Map(),
};

schedulerState.activeplayers = new Proxy([], {
  get(target, prop) {
    const value = target[prop];

    if (typeof value === 'function') {
      return function (...args) {
        const result = value.apply(target, args);
        updateRoundsPageAccess();
        return result;
      };
    }

    return value;
  }
});



allRounds = new Proxy(allRounds, {
  set(target, prop, value) {
    target[prop] = value;
    updateSummaryPageAccess();
    return true;
  },
  deleteProperty(target, prop) {
    delete target[prop];
    updateSummaryPageAccess();
    return true;
  }
});


let courts = 1;

function updateCourtDisplay() {
  document.getElementById("num-courts").textContent = courts;
  updateCourtButtons(); // update both + and -
  goToRounds(); // auto trigger

  const totalPlayers = schedulerState.activeplayers.length;
  const numPlayersPerRound = courts * 4;
  const numResting = Math.max(totalPlayers - numPlayersPerRound, 0);

  if (numResting >= numPlayersPerRound) {
    resetRest = true;
  } else {
    resetRest = false;
  }
	
}

// PLUS button
document.getElementById("courtPlus").onclick = () => {
  const totalPlayers = schedulerState.activeplayers.length;
  const allowedCourts = Math.floor(totalPlayers / 4);

  if (courts < allowedCourts) {
    courts++;
    updateCourtDisplay();
  }
};

// MINUS button
document.getElementById("courtMinus").onclick = () => {
  if (courts > 1) {
    courts--;
    updateCourtDisplay();
  }
};

// Enable / disable buttons
function updateCourtButtons() {
  const totalPlayers = schedulerState.activeplayers.length;
  const allowedCourts = Math.floor(totalPlayers / 4);

  const plusBtn = document.getElementById("courtPlus");
  const minusBtn = document.getElementById("courtMinus");

  // PLUS disable logic
  if (courts >= allowedCourts) {
    plusBtn.disabled = true;
    plusBtn.classList.add("disabled-btn");
  } else {
    plusBtn.disabled = false;
    plusBtn.classList.remove("disabled-btn");
  }

  // MINUS disable logic
  if (courts <= 1) {
    minusBtn.disabled = true;
    minusBtn.classList.add("disabled-btn");
  } else {
    minusBtn.disabled = false;
    minusBtn.classList.remove("disabled-btn");
  }
}


function goToRounds() {
  const numCourtsInput = parseInt(document.getElementById("num-courts").textContent);
  //const numCourtsInput = parseInt(document.getElementById('num-courts').value);
  const totalPlayers = schedulerState.activeplayers.length;
  if (!totalPlayers) {
    alert('Please add players first!');
    return;
  }

  if (!numCourtsInput) {
    alert('Please enter no of Courts!');
    return;
  }  
  // Auto-calculate courts based on player count ÷ 4
  let autoCourts = Math.floor(totalPlayers / 4);
  if (autoCourts < 1) autoCourts = 1;
  // Use the smaller of user-input or calculated courts
  const numCourts = numCourtsInput
    ? Math.min(numCourtsInput, autoCourts)
    : autoCourts;
  if (!numCourts) {
    alert('Number of courts could not be determined!');
    return;
  }
  if (allRounds.length <= 1) {
    initScheduler(numCourts);
    allRounds = [AischedulerNextRound(schedulerState)];
    currentRoundIndex = 0;
    showRound(0);
  } else {   
      schedulerState.numCourts = numCourts;      
      schedulerState.fixedMap = new Map();
      let highestRestCount = -Infinity;
      updateScheduler();      
      schedulerState.roundIndex = allRounds.length - 1;
      currentRoundIndex = schedulerState.roundIndex;
      const newRound = AischedulerNextRound(schedulerState);
      allRounds[allRounds.length - 1] = newRound;
       showRound(currentRoundIndex);
    }  
  /*
  document.getElementById('page1').style.display = 'none';
  document.getElementById('page2').style.display = 'block';
  isOnPage2 = true;
  */
}

function goBack() {
  updatePlayerList();
  document.getElementById('page1').style.display = 'block';
  document.getElementById('page2').style.display = 'none';
  isOnPage2 = false;
  const btn = document.getElementById('goToRoundsBtn');
  btn.disabled = false;
}

function nextRound() {
  
  if (currentRoundIndex + 1 < allRounds.length) {
    currentRoundIndex++;
    showRound(currentRoundIndex);
  } else {
    updSchedule(allRounds.length - 1, schedulerState); // pass schedulerState
    const newRound = AischedulerNextRound(schedulerState); // do NOT wrap in []
    allRounds.push(newRound);
    currentRoundIndex = allRounds.length - 1;
    showRound(currentRoundIndex);
  }
  updateSummaryPageAccess()
}
function endRounds() {  
	sessionFinished = true;
	updSchedule(allRounds.length - 1, schedulerState); // pass schedulerState
    const newRound = AischedulerNextRound(schedulerState); // do NOT wrap in []
    allRounds.push(newRound);
    currentRoundIndex = allRounds.length - 2;
    showRound(currentRoundIndex);
	
	// pass schedulerState              
	// Disable Next & Refresh
  document.getElementById("nextBtn").disabled = true;
  document.getElementById("roundShufle").disabled = true;

  // Optional: also disable End to prevent double-click
  document.getElementById("endBtn").disabled = true;
	updateSummaryPageAccess();
	showPage('page3');

	
}
function prevRound() {
  if (currentRoundIndex > 0) {
    currentRoundIndex--;
    showRound(currentRoundIndex);
  }
}

function initScheduler(numCourts) {
  schedulerState.numCourts = numCourts;  
  schedulerState.restCount = new Map(schedulerState.activeplayers.map(p => [p, 0]));
 //schedulerState.restQueue = new Map(schedulerState.activeplayers.map(p => [p, 0]));
    
  schedulerState.PlayedCount = new Map(schedulerState.activeplayers.map(p => [p, 0]));
  schedulerState.PlayerScoreMap = new Map(schedulerState.activeplayers.map(p => [p, 0]));
  schedulerState.playedTogether = new Map();
  schedulerState.fixedMap = new Map();
  schedulerState.pairPlayedSet = new Set();
  schedulerState.gamesMap = new Set();
  schedulerState.roundIndex = 0;
  // 🆕 Initialize opponentMap — nested map for opponent counts
  schedulerState.opponentMap = new Map();
  for (const p1 of schedulerState.activeplayers) {
    const innerMap = new Map();
    for (const p2 of schedulerState.activeplayers) {
      if (p1 !== p2) innerMap.set(p2, 0); // start all counts at 0
    }
    schedulerState.opponentMap.set(p1, innerMap);
  }
  // Map each fixed pair for quick lookup
  schedulerState.fixedPairs.forEach(([a, b]) => {
    schedulerState.fixedMap.set(a, b);
    schedulerState.fixedMap.set(b, a);
  });
    schedulerState.restQueue = createRestQueue();
	 // ✅ Competitive ranking points
  schedulerState.rankPoints = new Map(
    schedulerState.activeplayers.map(p => [p, 0])
  );
    
}


function updateScheduler() {
   schedulerState.opponentMap = new Map();
  for (const p1 of schedulerState.activeplayers) {
    const innerMap = new Map();
    for (const p2 of schedulerState.activeplayers) {
      if (p1 !== p2) innerMap.set(p2, 0); // start all counts at 0
    }
    schedulerState.opponentMap.set(p1, innerMap);
  }
    schedulerState.restQueue = rebuildRestQueue(
    schedulerState.restQueue );  // initial queue
    
}

/* ================================
   🔁 1-3-2-4 QUEUE REORDER (GUARDED)
================================ */
function reorder1324(queue, roundIndex = 0) {
  const total = queue.length;

  if (total < 4 || total % 2 !== 0) {
    return queue.slice();
  }

  // 1️⃣ split into pairs
  const pairs = [];
  for (let i = 0; i < total; i += 2) {
    pairs.push([queue[i], queue[i + 1]]);
  }

  const pCount = pairs.length;

  // 2️⃣ 4 or 6 pairs (8 / 12 players)
  if (pCount === 4 || pCount === 6) {
    const size = Math.floor(pCount / 4);

    const g1 = pairs.slice(0, size);
    const g2 = pairs.slice(size, size * 2);
    const g3 = pairs.slice(size * 2, size * 3);
    const g4 = pairs.slice(size * 3);

    // deterministic rotations (no randomness)
    const patterns = [
      [g1, g4, g2, g3], // 1-4-2-3
      [g2, g1, g4, g3], // rotate
      [g3, g2, g1, g4], // rotate
    ];

    const pattern = patterns[roundIndex % patterns.length];
    return pattern.flat().flat();
  }

  // 3️⃣ 8+ pairs (16+ players)
  if (pCount >= 8) {
    const size = Math.floor(pCount / 8);
    const groups = [];

    for (let i = 0; i < 8; i++) {
      groups.push(pairs.slice(i * size, (i + 1) * size));
    }

    const patterns = [
      [0, 2, 4, 6, 1, 3, 5, 7],
      [1, 3, 5, 7, 2, 4, 6, 0],
      [2, 4, 6, 0, 3, 5, 7, 1],
      [3, 5, 7, 1, 4, 6, 0, 2],
    ];

    const order = patterns[roundIndex % patterns.length];
    return order.flatMap(i => groups[i]).flat();
  }

  // 4️⃣ fallback → rotate pairs by roundIndex
  const offset = roundIndex % pCount;
  return [...pairs.slice(offset), ...pairs.slice(0, offset)].flat();
}
function old2reorder1324(queue) {
  const total = queue.length;

  // 🔹 Case: 8 or 12 players → divide by 4
  if (total === 8 || total === 12) {
    const size = Math.floor(total / 4);

    const g1 = queue.slice(0, size);
    const g2 = queue.slice(size, size * 2);
    const g3 = queue.slice(size * 2, size * 3);
    const g4 = queue.slice(size * 3);

    // 1,4,2,3
    return [...g1, ...g4, ...g2, ...g3];
  }

  // 🔹 Case: 16 or more players → divide by 8
  if (total >= 16) {
    const size = Math.floor(total / 8);
    const groups = [];

    for (let i = 0; i < 8; i++) {
      groups.push(queue.slice(i * size, (i + 1) * size));
    }

    // 1,3,5,7,2,4,6,8
    return [
      ...groups[0],
      ...groups[2],
      ...groups[4],
      ...groups[6],
      ...groups[1],
      ...groups[3],
      ...groups[5],
      ...groups[7],
    ];
  }

  // 🔹 Default → no change
  return queue.slice();
}

function oldreorder1324(queue) {
  const total = queue.length;
  const quarter = Math.floor(total / 4);

  const q1 = queue.slice(0, quarter);
  const q2 = queue.slice(quarter, quarter * 2);
  const q3 = queue.slice(quarter * 2, quarter * 3);
  const q4 = queue.slice(quarter * 3);

  return [...q1, ...q3, ...q2, ...q4];
}

// 🔍 check if ALL pairs exhausted
function allPairsExhausted(queue, pairPlayedSet) {
  for (let i = 0; i < queue.length; i++) {
    for (let j = i + 1; j < queue.length; j++) {
      const key = [queue[i], queue[j]].sort().join("&");
      if (!pairPlayedSet.has(key)) return false;
    }
  }
  return true;
}



function updSchedule(roundIndex, schedulerState) {
  //AUTO_SAVE();
	const data = allRounds[roundIndex];
  if (!data) return;

  const { games, resting } = data;
  const {
    restCount,
    PlayedCount,
    PlayerScoreMap,
    opponentMap,
    pairPlayedSet,
	gamesMap,
    playedTogether, // <<-- Missing in your version
  } = schedulerState;

  // 1️⃣ Update rest count
  for (const p of resting) {
    const playerName = p.split('#')[0];
    restCount.set(playerName, (restCount.get(playerName) || 0) + 1);
  }
   
// Helper → base name
const base = p => p.split('#')[0];

// 1️⃣ COPY restQueue first (so we don't modify during loop)
let newQueue = schedulerState.restQueue.slice();

// 2️⃣ FULL REMOVE: strip any players whose base name matches resting
for (const r of resting) {
  const b = base(r);
  newQueue = newQueue.filter(q => base(q) !== b);
}

// Replace restQueue after ALL removals done
schedulerState.restQueue = newQueue;

// 3️⃣ FULL ADD: now add base names of ALL resting at once
for (const r of resting) {
  schedulerState.restQueue.push(base(r));
}    

  // 2️⃣ Update PlayedCount
  lastRound.length = 0; // 🔥 reset global array (keeps reference)

for (const game of games) {
  const allPlayers = [...game.pair1, ...game.pair2];

  lastRound.push(...allPlayers);

  for (const p of allPlayers) {
    PlayedCount.set(p, (PlayedCount.get(p) || 0) + 1);
  }
}

  // 3️⃣ Update opponentMap & PlayerScoreMap
  for (const game of games) {
    const { pair1, pair2 } = game;

    // Ensure maps exist (prevents null errors)
    for (const a of [...pair1, ...pair2]) {
      if (!opponentMap.has(a)) opponentMap.set(a, new Map());
    }

    // Opponent tracking
    for (const a of pair1) {
      for (const b of pair2) {
        opponentMap.get(a).set(b, (opponentMap.get(a).get(b) || 0) + 1);
        opponentMap.get(b).set(a, (opponentMap.get(b).get(a) || 0) + 1);
      }
    }

    // Score calculation (new opponents bonus)
    for (const group of [pair1, pair2]) {
      for (const player of group) {
        let newOpponents = 0;
        const rivals = group === pair1 ? pair2 : pair1;

        for (const r of rivals) {
          if (opponentMap.get(player).get(r) === 1) newOpponents++;
        }

        const score = newOpponents === 2 ? 2 : newOpponents === 1 ? 1 : 0;
        PlayerScoreMap.set(player, (PlayerScoreMap.get(player) || 0) + score);
      }
    }
  }

  // 4️⃣ Track pairs played together (with round info)
  for (const game of games) {
    for (const pr of [game.pair1, game.pair2]) {
      const key = pr.slice().sort().join("&");
      pairPlayedSet.add(key);
      playedTogether.set(key, roundIndex); // <<-- IMPORTANT FIX
    }
  }

    // 4️⃣ Track pairs played together (with round info)
  for (const game of games) {
  const p1 = game.pair1.slice().sort().join("&");
  const p2 = game.pair2.slice().sort().join("&");

  // ensure A&B:C&D === C&D:A&B
  const gameKey = [p1, p2].sort().join(":");

  gamesMap.add(gameKey);
}

/// 7️⃣ 🏆 Update COMPETITIVE RANK POINTS (+2 / -2)
if (getPlayMode() === "competitive") {
  for (const game of games) {
    if (!game.winner) continue;

    const winners = game.winner === 'L' ? game.pair1 : game.pair2;
    const losers  = game.winner === 'L' ? game.pair2 : game.pair1;

    for (const p of winners) {
      schedulerState.rankPoints.set(
        p,
        (schedulerState.rankPoints.get(p) || 0) + 2
      );
	  schedulerState.winCount.set(
	    p,
	    (schedulerState.winCount.get(p) || 0) + 1
	  );	
    }

    for (const p of losers) {
      schedulerState.rankPoints.set(
        p,
        (schedulerState.rankPoints.get(p) || 0) - 2
      );
    }
  }
}

// after tracking pairs & games
checkAndResetPairCycle(schedulerState, games, roundIndex);
	// ✅ EXECUTE ONLY WHEN BOTH CONDITIONS ARE TRUE
if ( resetRest === true &&
  allPairsExhausted(schedulerState.restQueue, pairPlayedSet)
) {
  schedulerState.restQueue = reorder1324(schedulerState.restQueue);

  // optional: prevent repeated execution
  //schedulerState.resetRest = false;
}
}

function createRestQueue() {
  // Simply return active players in their current order
  return [...schedulerState.activeplayers];
}

function rebuildRestQueue(restQueue) {
  const newQueue = [];
  const active = schedulerState.activeplayers;

  // 1. Add active players based on the order in old restQueue
  for (const p of restQueue) {
    if (active.includes(p)) {
      newQueue.push(p);
    }
  }

  // 2. Add any newly active players not found in old restQueue
  for (const p of active) {
    if (!newQueue.includes(p)) {
      newQueue.push(p);
    }
  }

  return newQueue;
}




  

function RefreshRound() {
    schedulerState.roundIndex = allRounds.length - 1;
    currentRoundIndex = schedulerState.roundIndex;
    const newRound = AischedulerNextRound(schedulerState);
    allRounds[allRounds.length - 1] = newRound;
    showRound(currentRoundIndex);
}

function report() {
  const container = document.getElementById("reportContainer");
  container.innerHTML = "";

  const playMode = getPlayMode(); // "competitive" | "random"

  /* ===== HEADER ===== */
  const header = document.createElement("div");
  header.className = "report-header";
  header.innerHTML = `
    <div class="header-rank" data-i18n="rank">Rank</div>
    <div class="header-name" data-i18n="name">Name</div>
    <div class="header-wins" data-i18n="wins">Wins</div>
    <div class="header-played" data-i18n="played">Played</div>
    <div class="header-rested" data-i18n="rested">Rested</div>
  `;
  container.appendChild(header);

  /* ===== SORT LOGIC ===== */
  let sortedPlayers = [...schedulerState.allPlayers];

  if (playMode === "competitive") {
    // 🔥 PURE WINS LADDER
    sortedPlayers.sort((a, b) => {
      const wA = schedulerState.winCount.get(a.name) || 0;
      const wB = schedulerState.winCount.get(b.name) || 0;
      return wB - wA;
    });
  } else {
    // 🎲 EXISTING FAIRNESS MODE
    sortedPlayers.sort((a, b) => {
      const playedA = schedulerState.PlayedCount.get(a.name) || 0;
      const playedB = schedulerState.PlayedCount.get(b.name) || 0;
      if (playedB !== playedA) return playedB - playedA;

      const restA = schedulerState.restCount.get(a.name) || 0;
      const restB = schedulerState.restCount.get(b.name) || 0;
      return restB - restA;
    });
  }

  /* ===== RENDER ===== */
  sortedPlayers.forEach((p, index) => {
    const wins = schedulerState.winCount.get(p.name) || 0;
    const played = schedulerState.PlayedCount.get(p.name) || 0;
    const rest = schedulerState.restCount.get(p.name) || 0;

    const card = document.createElement("div");
    card.className = "player-card";
    card.innerHTML = `
      <div class="rank">#${index + 1}</div>
      <div class="name">${p.name}</div>
      <div class="stat wins">${wins}</div>
      <div class="stat played">${played}</div>
      <div class="stat rest">${rest}</div>
    `;
    container.appendChild(card);
  });

  setLanguage(currentLang);
}

function workedreport() {
  const container = document.getElementById("reportContainer");
  container.innerHTML = ""; // Clear old cards

  // ⭐ Add title header row
  const header = document.createElement("div");
  header.className = "report-header";
  header.innerHTML = `
    <div class="header-rank" data-i18n="rank">Rank</div>
    <div class="header-name" data-i18n="name">Name</div>
    <div class="header-played" data-i18n="played">Played</div>
    <div class="header-rested" data-i18n="rested">Rested</div>
  `;
  container.appendChild(header);

  // Sort & add players
  const sortedPlayers = [...schedulerState.allPlayers].sort((a, b) => {
    const playedA = schedulerState.PlayedCount.get(a.name) || 0;
    const playedB = schedulerState.PlayedCount.get(b.name) || 0;
    return playedB - playedA;
  });

  sortedPlayers.forEach((p, index) => {
    const played = schedulerState.PlayedCount.get(p.name) || 0;
    const rest = schedulerState.restCount.get(p.name) || 0;

    const card = document.createElement("div");
    card.className = "player-card";
    card.innerHTML = `
      <div class="rank">#${index + 1}</div>
      <div class="name">${p.name.replace(/^\d+\.?\s*/, "")}</div>
      <div class="stat played" style="border-color:${getPlayedColor(played)}">${played}</div>
      <div class="stat rest" style="border-color:${getRestColor(rest)}">${rest}</div>
    `;
    container.appendChild(card);
  });

  // ⭐ Important: Apply translation to new elements
  setLanguage(currentLang);
}


function checkAndResetPairCycle(schedulerState, games, roundIndex) {
  const {
    activeplayers,
    pairPlayedSet,
    playedTogether,
    gamesMap,
    opponentMap
  } = schedulerState;

  // --- exhaustion check (INCLUDING latest round) ---
  const bases = activeplayers.map(p => p.split('#')[0]);
  const totalPossiblePairs =
    (bases.length * (bases.length - 1)) / 2;

  if (pairPlayedSet.size < totalPossiblePairs) return false;

  // --- snapshot latest round ---
  const latestPairs = [];
  const latestGames = [];

  for (const game of games) {
    const p1 = game.pair1.slice().sort().join("&");
    const p2 = game.pair2.slice().sort().join("&");

    latestPairs.push(p1, p2);
    latestGames.push([p1, p2].sort().join(":"));
  }

  // --- reset pairing-related state ---
  pairPlayedSet.clear();
  playedTogether.clear();
  gamesMap.clear();
  opponentMap.clear();

  // --- restore ONLY latest round ---
  for (const key of latestPairs) {
    pairPlayedSet.add(key);
    playedTogether.set(key, roundIndex);
  }

  for (const gk of latestGames) {
    gamesMap.add(gk);
  }

  return true; // cycle reset happened
}






 
