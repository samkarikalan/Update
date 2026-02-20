let roundActive = false;

let currentState = "idle";
const statusEl = document.getElementById("statusDisplay");
const textEl = document.getElementById("btnText");
const btn = document.getElementById("nextBtn");
const icon = btn.querySelector(".icon");
const roundStates = {
  idle: {
    key: "nround",
    icon: "▶",
    class: ""
  },
  active: {
    key: "endrounds",
    icon: "⏹",
    class: "end"
  }
};

function toggleRound() {
  const btn = document.getElementById("nextBtn");
  const textEl = document.getElementById("btnText");
  const icon = btn.querySelector(".icon");
  const playmode = getPlayMode();
  
  if (currentState === "idle") {
    // ---- ENTER ACTIVE (BUSY) MODE ----
    if (interactionLocked ==false) {
      lockBtn.click();
    }
    currentState = "active";

    // Disable everything except #nextBtn and .win-cup
    document.querySelectorAll(
      "button, .player-btn, .mode-card, .lock-icon, .swap-icon, .menu-btn"
    ).forEach(el => {
      if (el.id !== "nextBtn" && !el.classList.contains("win-cup")) {
        // Disable clicks
        el.style.pointerEvents = "none";
        
        // Add disabled styling
        el.classList.add("disabled");    
        
      }
    });   

    document.querySelectorAll(".win-cup").forEach(cup => {
      cup.style.visibility = "visible";
      cup.style.pointerEvents = "auto";
      cup.classList.add("blinking");
      cup.style.visibility = playmode === "competitive" ? "visible" : "hidden";
    });

  } else {
    // ---- RETURN TO IDLE MODE ----   
    if (playmode === "competitive") {     
      const currentRoundGames = allRounds[allRounds.length - 1].games;
      const winnersCount = currentRoundGames.filter(game => game.winner).length;
      
      if (!currentRoundGames.length || winnersCount !== currentRoundGames.length) {
        alert("Please mark winners for all games");
        return; // ❌ stay in active mode
      }

    }
    currentState = "idle";
    nextRound();

    
   // Re-enable everything previously disabled
    document.querySelectorAll(".disabled").forEach(el => {
      // Restore pointer events
      el.style.pointerEvents = "";
    
      // Remove the disabled class
      el.classList.remove("disabled");
    
      // If you had removed inline onclick handlers, you may need to restore them manually
      // For example, for the menu button:
      if (el.classList.contains("menu-btn")) {
        el.onclick = function() {
          showPage('homePage', this);
        };
      }
    });


    // Hide & disable win cups
    document.querySelectorAll(".win-cup").forEach(cup => {
      cup.style.pointerEvents = "none";
      cup.style.visibility = "hidden";
    });
  }

  const state = roundStates[currentState];
  textEl.dataset.i18n = state.key;
  icon.textContent = state.icon;
  btn.classList.toggle("end", state.class === "end");
  setLanguage(currentLang);
}





function setStatus(status) {
  //statusEl.classList.remove("status-ready", "status-progress");

  /*if (status === "Ready") {
    statusEl.dataset.i18n = "statusReady";
    statusEl.classList.add("status-ready");
  } else if (status === "In Progress") {
    statusEl.dataset.i18n = "statusProgress";
    statusEl.classList.add("status-progress");
  } 
*/

  // Re-apply translations so text updates immediately
  setLanguage(currentLang);
}



let isLocked = true;
  const lockIcon = document.getElementById('lockToggleBtn');

  function toggleLock() {
    isLocked = !isLocked;
    lockIcon.src = isLocked ? 'lock.png' : 'unlock.png';
    lockIcon.alt = isLocked ? 'Lock' : 'Unlock';
  }

  lockIcon.addEventListener('click', toggleLock);

function getNextFixedPairGames(schedulerState, fixedPairs, numCourts) {
  const hash = JSON.stringify(fixedPairs);

  // 🔁 Initialize OR reset when queue is empty OR pairs changed
  if (
    !schedulerState.fixedPairGameQueue ||
    schedulerState.fixedPairGameQueue.length === 0 ||
    schedulerState.fixedPairGameQueueHash !== hash
  ) {
    schedulerState.fixedPairGameQueueHash = hash;
    schedulerState.fixedPairGameQueue = [];

    // Generate ALL unique games (pair vs pair)
    for (let i = 0; i < fixedPairs.length; i++) {
      for (let j = i + 1; j < fixedPairs.length; j++) {
        schedulerState.fixedPairGameQueue.push({
          pair1: fixedPairs[i],
          pair2: fixedPairs[j],
        });
      }
    }

    // Optional shuffle (recommended)
    schedulerState.fixedPairGameQueue = shuffle(
      schedulerState.fixedPairGameQueue
    );
  }

  const games = [];
  const usedPairs = new Set();
  const remainingGames = [];

  // 🎯 Select playable games, remove ONLY played ones
  for (const game of schedulerState.fixedPairGameQueue) {
    if (games.length >= numCourts) {
      remainingGames.push(game);
      continue;
    }

    const k1 = game.pair1.join("&");
    const k2 = game.pair2.join("&");

    if (usedPairs.has(k1) || usedPairs.has(k2)) {
      // Not playable this round → keep it
      remainingGames.push(game);
      continue;
    }

    // ✅ Game is played → remove
    playername1 = "";
    playername2 = "";
    games.push({
      court: games.length + 1,
      pair1: [...game.pair1],
      pair2: [...game.pair2],
      winners: [playername1, playername2]
    });

    usedPairs.add(k1);
    usedPairs.add(k2);
  }

  // Update queue with unplayed games only
  schedulerState.fixedPairGameQueue = remainingGames;

  return games;
}


function AischedulerNextRound(schedulerState) {

  const { PlayedCount, activeplayers } = schedulerState;
  const playmode = getPlayMode();
  const page2 = document.getElementById("page2");

  let result;

  // Determine if competitive condition is satisfied
  const canStartCompetitive =
    activeplayers.length > 0 &&
    activeplayers.every(p => (PlayedCount.get(p) || 0) >= 50);

  // --------------------------------------------------
  // RANDOM MODE
  // --------------------------------------------------
  if (playmode === "random" || !canStartCompetitive) {

    // If switching FROM competitive TO random → reset random memory if needed
    if (schedulerState._lastMode === "competitive") {
      // Optional: reset if you want fresh random after comp
      // resetForRandomPhase(schedulerState);
    }

    result = RandomRound(schedulerState);

    page2.classList.remove("competitive-mode");
    page2.classList.add("random-mode");

    schedulerState._lastMode = "random";
  }

  // --------------------------------------------------
  // COMPETITIVE MODE
  // --------------------------------------------------
  else {

    // 🔥 RESET ONLY ONCE when entering competitive
    if (schedulerState._lastMode !== "competitive") {
      resetForCompetitivePhase(schedulerState);
    }

    result = CompetitiveRound(schedulerState);

    page2.classList.remove("random-mode");
    page2.classList.add("competitive-mode");

    schedulerState._lastMode = "competitive";
  }

  return result;
}

function resetForCompetitivePhase(state) {

  // Clear pair uniqueness memory
  state.pairPlayedSet.clear();
  state.playedTogether.clear();
  state.gamesMap.clear();
  state.pairCooldownMap.clear();

  // Reset opponent tracking
  state.opponentMap = new Map();
  for (const p1 of state.activeplayers) {
    const inner = new Map();
    for (const p2 of state.activeplayers) {
      if (p1 !== p2) inner.set(p2, 0);
    }
    state.opponentMap.set(p1, inner);
  }

  // DO NOT TOUCH:
  // winCount
  // rankPoints
  // PlayedCount
  // restCount
  // restQueue
}

function getPlayingAndResting(state) {

  const totalPlayers = state.activeplayers.length;
  const playersPerRound = state.courts * 4;

  let resting = [];
  let playing = [];

  if (totalPlayers > playersPerRound) {
    const needRest = totalPlayers - playersPerRound;
    resting = selectRestPlayers(state, needRest); // your LIFO logic
  }

  const restSet = new Set(resting);
  playing = state.activeplayers.filter(p => !restSet.has(p));

  return { playing, resting };
}

function extractActiveFixedPairs(state, playing) {

  const activePairs = [];
  const lockedPlayers = new Set();

  for (const pair of state.fixedPairs || []) {
    const [a, b] = pair;

    if (playing.includes(a) && playing.includes(b)) {
      activePairs.push([a, b]);
      lockedPlayers.add(a);
      lockedPlayers.add(b);
    }
  }

  return { activePairs, lockedPlayers };
}

function groupByTier(state, players) {

  const strong = [];
  const inter = [];
  const weak = [];

  for (const p of players) {
    const rating = state.winCount.get(p) || 0;

    if (rating >= state.strongThreshold) strong.push(p);
    else if (rating >= state.interThreshold) inter.push(p);
    else weak.push(p);
  }

  return { strong, inter, weak };
}

function buildBestTeam(state, pool) {

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {

      const p1 = pool[i];
      const p2 = pool[j];

      const key = createSortedKey(p1, p2);

      if (!state.pairPlayedSet.has(key)) {
        return [p1, p2];
      }
    }
  }

  // fallback if no unique pair
  return [pool[0], pool[1]];
}

function CompetitiveRound(state) {

  const { playing, resting } = getPlayingAndResting(state);

  const games = [];
  const used = new Set();

  // Step 1: Handle fixed pairs
  const { activePairs, lockedPlayers } =
      extractActiveFixedPairs(state, playing);

  // Add locked teams first
  const lockedTeams = [...activePairs];

  // Remove locked players from free pool
  const freePool = playing.filter(p => !lockedPlayers.has(p));

  // Step 2: Resolve locked teams first
  while (lockedTeams.length > 0) {

    const team1 = lockedTeams.shift();

    const opponent = buildBestTeam(state, freePool);

    games.push([team1, opponent]);

    team1.forEach(p => used.add(p));
    opponent.forEach(p => used.add(p));

    removePlayersFromArray(freePool, opponent);
  }

  // Step 3: Pair remaining free pool
  const tierGroups = groupByTier(state, freePool);

  const remaining = [...freePool];

  while (remaining.length >= 4) {

    const team1 = buildBestTeam(state, remaining);
    removePlayersFromArray(remaining, team1);

    const team2 = buildBestTeam(state, remaining);
    removePlayersFromArray(remaining, team2);

    games.push([team1, team2]);
  }

  // Step 4: Update memory
  updateAfterRound(state, games);

  return {
    games,
    resting
  };
}

function updateAfterRound(state, games) {

  for (const [team1, team2] of games) {

    const key1 = createSortedKey(team1[0], team1[1]);
    const key2 = createSortedKey(team2[0], team2[1]);

    state.pairPlayedSet.add(key1);
    state.pairPlayedSet.add(key2);

    // update opponent map
    for (const p1 of team1) {
      for (const p2 of team2) {
        state.opponentMap.get(p1).set(
          p2,
          state.opponentMap.get(p1).get(p2) + 1
        );
        state.opponentMap.get(p2).set(
          p1,
          state.opponentMap.get(p2).get(p1) + 1
        );
      }
    }
  }
}



function RandomRound(schedulerState) {
  const {
    activeplayers,
    numCourts,
    fixedPairs,
    restCount,
    opponentMap,
    lastRound,
  } = schedulerState;

  const totalPlayers = activeplayers.length;
  const numPlayersPerRound = numCourts * 4;
  const numResting = Math.max(totalPlayers - numPlayersPerRound, 0);

  const fixedPairPlayers = new Set(fixedPairs.flat());
  let freePlayers = activeplayers.filter(p => !fixedPairPlayers.has(p));

  let resting = [];
  let playing = [];

  // ================= REST SELECTION (UNCHANGED) =================
  if (fixedPairs.length > 0 && numResting >= 2) {
    let needed = numResting;
    const fixedMap = new Map();
    for (const [a, b] of fixedPairs) {
      fixedMap.set(a, b);
      fixedMap.set(b, a);
    }

    for (const p of schedulerState.restQueue) {
      if (resting.includes(p)) continue;

      const partner = fixedMap.get(p);
      if (partner) {
        if (needed >= 2) {
          resting.push(p, partner);
          needed -= 2;
        }
      } else if (needed > 0) {
        resting.push(p);
        needed -= 1;
      }

      if (needed <= 0) break;
    }

    playing = activeplayers.filter(p => !resting.includes(p));
  } else {
    const sortedPlayers = [...schedulerState.restQueue];
    resting = sortedPlayers.slice(0, numResting);
    playing = activeplayers
      .filter(p => !resting.includes(p))
      .slice(0, numPlayersPerRound);
  }

  // ================= PAIR PREP =================
  const playingSet = new Set(playing);
  let fixedPairsThisRound = [];
  for (const pair of fixedPairs) {
    if (playingSet.has(pair[0]) && playingSet.has(pair[1])) {
      fixedPairsThisRound.push([pair[0], pair[1]]);
    }
  }

  const fixedPairPlayersThisRound = new Set(fixedPairsThisRound.flat());
  let freePlayersThisRound = playing.filter(
    p => !fixedPairPlayersThisRound.has(p)
  );

  freePlayersThisRound = reorderFreePlayersByLastRound(
    freePlayersThisRound,
    lastRound,
    numCourts
  );

  // ================= ALL FIXED DETECTION =================
  const allFixed =
    freePlayersThisRound.length === 0 &&
    fixedPairs.length >= numCourts * 2;

  // ================= ALL FIXED (QUEUE-BASED ROUND ROBIN) =================
  if (allFixed) {
    const games = getNextFixedPairGames(
      schedulerState,
      fixedPairs,
      numCourts
    );

    const playingPlayers = new Set(
      games.flatMap(g => [...g.pair1, ...g.pair2])
    );

    resting = activeplayers.filter(p => !playingPlayers.has(p));
    playing = [...playingPlayers];

    schedulerState.roundIndex =
      (schedulerState.roundIndex || 0) + 1;

    return {
      round: schedulerState.roundIndex,
      resting: resting.map(p => {
        const c = restCount.get(p) || 0;
        return `${p}#${c + 1}`;
      }),
      playing,
      games,
    };
  }

  // ================= ORIGINAL FREE-PAIR LOGIC =================
  const requiredPairsCount = Math.floor(numPlayersPerRound / 2);
  let neededFreePairs =
    requiredPairsCount - fixedPairsThisRound.length;

  let selectedPairs = findDisjointPairs(
    freePlayersThisRound,
    schedulerState.pairPlayedSet,
    neededFreePairs,
    opponentMap
  );

  let finalFreePairs = selectedPairs || [];

  if (finalFreePairs.length < neededFreePairs) {
    const free = freePlayersThisRound.slice();
    const usedPlayers = new Set(finalFreePairs.flat());

    for (let i = 0; i < free.length; i++) {
      const a = free[i];
      if (usedPlayers.has(a)) continue;

      for (let j = i + 1; j < free.length; j++) {
        const b = free[j];
        if (usedPlayers.has(b)) continue;

        finalFreePairs.push([a, b]);
        usedPlayers.add(a);
        usedPlayers.add(b);
        break;
      }

      if (finalFreePairs.length >= neededFreePairs) break;
    }
  }

  let allPairs = fixedPairsThisRound.concat(finalFreePairs);
  allPairs = shuffle(allPairs);

  let matchupScores = getMatchupScores(allPairs, opponentMap);
  const games = [];
  const usedPairs = new Set();

  for (const match of matchupScores) {
    const { pair1, pair2 } = match;
    const p1Key = pair1.join("&");
    const p2Key = pair2.join("&");

    if (usedPairs.has(p1Key) || usedPairs.has(p2Key)) continue;

    games.push({
      court: games.length + 1,
      pair1: [...pair1],
      pair2: [...pair2],
    });

    usedPairs.add(p1Key);
    usedPairs.add(p2Key);

    if (games.length >= numCourts) break;
  }

  const restingWithNumber = resting.map(p => {
    const c = restCount.get(p) || 0;
    return `${p}#${c + 1}`;
  });

  schedulerState.roundIndex =
    (schedulerState.roundIndex || 0) + 1;

  return {
    round: schedulerState.roundIndex,
    resting: restingWithNumber,
    playing,
    games,
  };
}




// ==============================
// Generate next round (no global updates)
// ==============================
function betaAischedulerNextRound(schedulerState) {
  const {
    activeplayers,
    numCourts,
    fixedPairs,
    restCount,
    opponentMap,
    pairPlayedSet
  } = schedulerState;

  const totalPlayers = activeplayers.length;
  const playersPerRound = numCourts * 4;
  const numResting = Math.max(totalPlayers - playersPerRound, 0);

  /* ==========================
     1️⃣ RESTING / PLAYING
  ========================== */

  let resting = [];
  let playing = [];

  if (numResting > 0) {
    resting = schedulerState.restQueue.slice(0, numResting);
    playing = activeplayers.filter(p => !resting.includes(p));
  } else {
    playing = activeplayers.slice(0, playersPerRound);
  }

  /* ==========================
     2️⃣ FIXED PAIRS
  ========================== */

  const playingSet = new Set(playing);
  const fixedPairsThisRound = fixedPairs.filter(
    ([a, b]) => playingSet.has(a) && playingSet.has(b)
  );

  const fixedPlayers = new Set(fixedPairsThisRound.flat());
  let freePlayers = playing.filter(p => !fixedPlayers.has(p));

  const requiredPairs = playersPerRound / 2;
  const neededFreePairs = requiredPairs - fixedPairsThisRound.length;

  /* ==========================
     3️⃣ BEST FREE PAIRS
  ========================== */

  let freePairs =
    findDisjointPairs(
      freePlayers,
      pairPlayedSet,
      neededFreePairs,
      opponentMap
    ) || [];

  // fallback safety
  if (freePairs.length < neededFreePairs) {
    const used = new Set(freePairs.flat());
    for (let i = 0; i < freePlayers.length; i++) {
      for (let j = i + 1; j < freePlayers.length; j++) {
        const a = freePlayers[i], b = freePlayers[j];
        if (used.has(a) || used.has(b)) continue;
        freePairs.push([a, b]);
        used.add(a); used.add(b);
        if (freePairs.length === neededFreePairs) break;
      }
      if (freePairs.length === neededFreePairs) break;
    }
  }

  const allPairs = [...fixedPairsThisRound, ...freePairs];

  /* ==========================
     4️⃣ BEST COURT MATCHUPS
  ========================== */

  const matchupScores = getMatchupScores(allPairs, opponentMap);

  const games = [];
  const usedPairs = new Set();

  for (const m of matchupScores) {
    const k1 = m.pair1.join("&");
    const k2 = m.pair2.join("&");
    if (usedPairs.has(k1) || usedPairs.has(k2)) continue;

    games.push({
      court: games.length + 1,
      pair1: [...m.pair1],
      pair2: [...m.pair2]
    });

    usedPairs.add(k1);
    usedPairs.add(k2);

    if (games.length === numCourts) break;
  }

  /* ==========================
     5️⃣ REST DISPLAY
  ========================== */

  const restingWithCount = resting.map(p => {
    const cnt = restCount.get(p) || 0;
    return `${p}#${cnt + 1}`;
  });

  schedulerState.roundIndex = (schedulerState.roundIndex || 0) + 1;

  return {
    round: schedulerState.roundIndex,
    resting: restingWithCount,
    playing,
    games
  };
}



function backupAischedulerNextRound(schedulerState) {
  const {
    activeplayers,
    numCourts,
    fixedPairs,
    restCount,
    opponentMap,
  } = schedulerState;

  const totalPlayers = activeplayers.length;
  const numPlayersPerRound = numCourts * 4;
  const numResting = Math.max(totalPlayers - numPlayersPerRound, 0);

  // Separate fixed pairs and free players
  const fixedPairPlayers = new Set(fixedPairs.flat());
let freePlayers = activeplayers.filter(p => !fixedPairPlayers.has(p));

// ... top of function (resting and playing already declared as let)
let resting = [];
let playing = [];

// 1. Select resting and playing players
if (fixedPairs.length > 0 && numResting >= 2) {

  let needed = numResting;
  const fixedMap = new Map();
    for (const [a, b] of fixedPairs) {
      fixedMap.set(a, b);
      fixedMap.set(b, a); // Must include reverse
    }

  // Use only restQueue order
 for (const p of schedulerState.restQueue) {
  if (resting.includes(p)) continue;

  const partner = fixedMap.get(p);

  if (partner) {
    // Fixed pair rule -> only rest together
    if (needed >= 2) {
      resting.push(p, partner);
      needed -= 2;
    }
    // If not enough slots -> skip both completely
  } else {
    // Only rest free players
    if (needed > 0) {
      resting.push(p);
      needed -= 1;
    }
  }

  if (needed <= 0) break;
}



  // Playing = everyone else (NO redeclaration)
  playing = activeplayers.filter(p => !resting.includes(p));

} else {

      // Use restQueue order directly (no sorting)
    const sortedPlayers = [...schedulerState.restQueue];
    
    // Assign resting players
    resting = sortedPlayers.slice(0, numResting);
    
    // Assign playing players
    playing = activeplayers
      .filter(p => !resting.includes(p))
      .slice(0, numPlayersPerRound);
}


  // 2️⃣ Prepare pairs
  const playingSet = new Set(playing);
  let fixedPairsThisRound = [];
  for (const pair of fixedPairs) {
    if (playingSet.has(pair[0]) && playingSet.has(pair[1])) {
      fixedPairsThisRound.push([pair[0], pair[1]]);
    }
  }

  const fixedPairPlayersThisRound = new Set(fixedPairsThisRound.flat());
  let freePlayersThisRound = playing.filter(p => !fixedPairPlayersThisRound.has(p));
  freePlayersThisRound = reorderFreePlayersByLastRound(
  freePlayersThisRound,
  lastRound,
  numCourts
);
  const requiredPairsCount = Math.floor(numPlayersPerRound / 2);
  let neededFreePairs = requiredPairsCount - fixedPairsThisRound.length;
  //freePlayersThisRound = reorder1324(freePlayersThisRound);
  let selectedPairs = findDisjointPairs(freePlayersThisRound, schedulerState.pairPlayedSet, neededFreePairs, opponentMap);

  let finalFreePairs = selectedPairs || [];

  // Fallback pairing for leftovers
  if (finalFreePairs.length < neededFreePairs) {
    const free = freePlayersThisRound.slice();
    const usedPlayers = new Set(finalFreePairs.flat());
    for (let i = 0; i < free.length; i++) {
      const a = free[i];
      if (usedPlayers.has(a)) continue;
      for (let j = i + 1; j < free.length; j++) {
        const b = free[j];
        if (usedPlayers.has(b)) continue;
        finalFreePairs.push([a, b]);
        usedPlayers.add(a);
        usedPlayers.add(b);
        break;
      }
      if (finalFreePairs.length >= neededFreePairs) break;
    }
  }

  // 3️⃣ Combine all pairs and shuffle
  let allPairs = fixedPairsThisRound.concat(finalFreePairs);
  allPairs = shuffle(allPairs);

  // 4️⃣ Create games (courts) using matchupScores (no updates here)
  let matchupScores = getMatchupScores(allPairs, opponentMap);
  const games = [];
  const usedPairs = new Set();
  for (const match of matchupScores) {
    const { pair1, pair2 } = match;
    const p1Key = pair1.join("&");
    const p2Key = pair2.join("&");
    if (usedPairs.has(p1Key) || usedPairs.has(p2Key)) continue;
    games.push({ court: games.length + 1, pair1: [...pair1], pair2: [...pair2] });
    usedPairs.add(p1Key);
    usedPairs.add(p2Key);
    if (games.length >= numCourts) break;
  }

  // 5️⃣ Prepare resting display with +1 for current round
  const restingWithNumber = resting.map(p => {
    const currentRest = restCount.get(p) || 0;
    return `${p}#${currentRest + 1}`;
  });

 schedulerState.roundIndex = (schedulerState.roundIndex || 0) + 1;

return {
    round: schedulerState.roundIndex,
    resting: restingWithNumber,
    playing,
    games,
  };

  
}


function reorderFreePlayersByLastRound(
  freePlayersThisRound,
  lastRound,
  numCourts
) {
  if (numCourts <= 0 || freePlayersThisRound.length === 0) {
    return [...freePlayersThisRound];
  }

  const total = freePlayersThisRound.length;

  // per-court capacity
  const base = Math.floor(total / numCourts);
  const remainder = total % numCourts;

  // court capacities
  const capacities = Array.from(
    { length: numCourts },
    (_, i) => base + (i < remainder ? 1 : 0)
  );

  // split by last round
  const lastRoundSet = new Set(lastRound);
  const nonPlayed = [];
  const played = [];

  for (const p of freePlayersThisRound) {
    (lastRoundSet.has(p) ? played : nonPlayed).push(p);
  }

  // simulate court fill
  const courts = Array.from({ length: numCourts }, () => []);
  let c = 0;

  const distribute = (list) => {
    for (const p of list) {
      while (courts[c].length >= capacities[c]) {
        c = (c + 1) % numCourts;
      }
      courts[c].push(p);
      c = (c + 1) % numCourts;
    }
  };

  distribute(nonPlayed);
  distribute(played);

  // flatten to single ordered array
  return courts.flat();
}
// ==============================



function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
function findDisjointPairs(playing, usedPairsSet, requiredPairsCount, opponentMap) {
  const allPairs = [];
  const unusedPairs = [];
  const usedPairs = [];

  // Build all pairs and classify (new vs old)
  for (let i = 0; i < playing.length; i++) {
    for (let j = i + 1; j < playing.length; j++) {
      const a = playing[i], b = playing[j];
      const key = [a, b].slice().sort().join("&");
      const isNew = !usedPairsSet || !usedPairsSet.has(key);

      const pairObj = { a, b, key, isNew };
      allPairs.push(pairObj);

      if (isNew) unusedPairs.push(pairObj);
      else usedPairs.push(pairObj);
    }
  }

  // ------------------------------
  //  Opponent Freshness Score
  // ------------------------------
  function calculateOpponentFreshnessScore(currentPair, selectedPairs, opponentMap) {
    let totalScore = 0;
    const [a, b] = currentPair;

    for (const [x, y] of selectedPairs) {
      const pair1 = [x, y];
      const pair2 = [a, b];

      for (const bPlayer of pair2) {
        let newOpp = 0;
        for (const aPlayer of pair1) {
          // Your exact logic:
          if ((opponentMap.get(bPlayer)?.get(aPlayer) || 0) === 1) {
            newOpp += 1;
          }
        }
        // Your exact scoring:
        totalScore += (newOpp === 2) ? 2 : (newOpp === 1 ? 1 : 0);
      }
    }
    return totalScore;
  }

  // ------------------------------
  //  DFS Backtracking With Scoring
  // ------------------------------
function pickBestFromCandidates(candidates) {
  const usedPlayers = new Set();
  const selected = [];
  let best = null;
  const MAX_BRANCHES = 15000; // limit search
  let branches = 0;

  function dfs(startIndex, baseScore) {
    // stop explosion
    if (branches++ > MAX_BRANCHES) return;

    if (selected.length === requiredPairsCount) {
      if (!best || baseScore > best.score) {
        best = { score: baseScore, pairs: selected.slice() };
      }
      return;
    }

    // Remaining candidates insufficient → prune
    const remainingSlots = requiredPairsCount - selected.length;
    if (candidates.length - startIndex < remainingSlots) return;

    for (let i = startIndex; i < candidates.length; i++) {
      const { a, b, isNew } = candidates[i];
      if (usedPlayers.has(a) || usedPlayers.has(b)) continue;

      usedPlayers.add(a);
      usedPlayers.add(b);
      selected.push([a, b]);

      // opponent freshness score
      const oppScore = calculateOpponentFreshnessScore(
        [a, b],
        selected.slice(0, -1),
        opponentMap
      );

      // new-pair strong priority
      const newPairScore = isNew ? 100 : 0;

      dfs(i + 1, baseScore + newPairScore + oppScore);

      selected.pop();
      usedPlayers.delete(a);
      usedPlayers.delete(b);
    }
  }

  dfs(0, 0);
  return best ? best.pairs : null;
}

  // -----------------------------------
  // 1) Try unused (new) pairs only
  // -----------------------------------
  if (unusedPairs.length >= requiredPairsCount) {
    const best = pickBestFromCandidates(unusedPairs);
    if (best) return best;
  }

  // -----------------------------------
  // 2) Try unused + used
  // -----------------------------------
  const combined = [...unusedPairs, ...usedPairs];
  if (combined.length >= requiredPairsCount) {
    const best = pickBestFromCandidates(combined);
    if (best) return best;
  }

  // -----------------------------------
  // 3) Try all pairs as last fallback
  // -----------------------------------
  if (allPairs.length >= requiredPairsCount) {
    const best = pickBestFromCandidates(allPairs);
    if (best) return best;
  }

  return [];
}




function getMatchupScores(allPairs, opponentMap) {
  const matchupScores = [];
  for (let i = 0; i < allPairs.length; i++) {
    for (let j = i + 1; j < allPairs.length; j++) {
      const [a1, a2] = allPairs[i];
      const [b1, b2] = allPairs[j];
      // --- Count past encounters for each of the 4 possible sub-matchups ---
      const ab11 = opponentMap.get(a1)?.get(b1) || 0;
      const ab12 = opponentMap.get(a1)?.get(b2) || 0;
      const ab21 = opponentMap.get(a2)?.get(b1) || 0;
      const ab22 = opponentMap.get(a2)?.get(b2) || 0;
      // --- Total previous encounters (lower = better) ---
      const totalScore = ab11 + ab12 + ab21 + ab22;
      // --- Freshness: number of unseen sub-matchups (4 = completely new) ---
      const freshness =
        (ab11 === 0 ? 1 : 0) +
        (ab12 === 0 ? 1 : 0) +
        (ab21 === 0 ? 1 : 0) +
        (ab22 === 0 ? 1 : 0);
      // --- Store individual player freshness for tie-breaker ---
      const opponentFreshness = {
        a1: (ab11 === 0 ? 1 : 0) + (ab12 === 0 ? 1 : 0),
        a2: (ab21 === 0 ? 1 : 0) + (ab22 === 0 ? 1 : 0),
        b1: (ab11 === 0 ? 1 : 0) + (ab21 === 0 ? 1 : 0),
        b2: (ab12 === 0 ? 1 : 0) + (ab22 === 0 ? 1 : 0),
      };
      matchupScores.push({
        pair1: allPairs[i],
        pair2: allPairs[j],
        freshness,         // 0–4
        totalScore,        // numeric repetition penalty
        opponentFreshness, // for tie-breaking only
      });
    }
  }
  // --- Sort by freshness DESC, then totalScore ASC, then opponent freshness DESC ---
  matchupScores.sort((a, b) => {
    if (b.freshness !== a.freshness) return b.freshness - a.freshness;
    if (a.totalScore !== b.totalScore) return a.totalScore - b.totalScore;
    // Tie-breaker: sum of all 4 individual opponent freshness values
    const aSum = a.opponentFreshness.a1 + a.opponentFreshness.a2 + a.opponentFreshness.b1 + a.opponentFreshness.b2;
    const bSum = b.opponentFreshness.a1 + b.opponentFreshness.a2 + b.opponentFreshness.b1 + b.opponentFreshness.b2;
    return bSum - aSum; // prefer higher sum of unseen opponents
  });
  return matchupScores;
}


/* =========================
 
DISPLAY & UI FUNCTIONS
 
========================= */
// Main round display

function clearPreviousRound() {
  const resultsDiv = document.getElementById('game-results');

  // Remove all child nodes (old rounds)
  while (resultsDiv.firstChild) {
    resultsDiv.removeChild(resultsDiv.firstChild);
  }

  // Remove any lingering selection highlights
  window.selectedPlayer = null;
  window.selectedTeam = null;
  document.querySelectorAll('.selected, .selected-team, .swapping').forEach(el => {
    el.classList.remove('selected', 'selected-team', 'swapping');
  });
  const roundTitle = document.getElementById("roundTitle");
  roundTitle.className = "roundTitle";
  roundTitle.innerText = "R";
}



// Show a round
function showRound(index) {
  clearPreviousRound();
  const resultsDiv = document.getElementById('game-results');
  resultsDiv.innerHTML = '';

  const data = allRounds[index];
  if (!data) return;

  // ✅ Update round title
  const roundTitle = document.getElementById("roundTitle");
  roundTitle.className = "roundTitle";
  roundTitle.innerText = translations[currentLang].roundno + " " + data.round;

  // ✅ Create sections safely
  let restDiv = null;
  if (data.resting && data.resting.length !== 0) {
    restDiv = renderRestingPlayers(data, index);
  }

  const gamesDiv = renderGames(data, index);

  // ✅ Wrap everything
  const wrapper = document.createElement('div');
  wrapper.className = 'round-wrapper';

  // 🔒 Apply lock state globally
  if (interactionLocked) {
    wrapper.classList.add('locked');
  }

  // ✅ Append conditionally
  if (restDiv) {
    wrapper.append(gamesDiv, restDiv);
  } else {
    wrapper.append(gamesDiv);
  }

  resultsDiv.append(wrapper);
}


function goodshowRound(index) {
  clearPreviousRound();
  const resultsDiv = document.getElementById('game-results');
  resultsDiv.innerHTML = '';
  const data = allRounds[index];
  if (!data) return;
  // ✅ Update round title
  const roundTitle = document.getElementById("roundTitle");
  roundTitle.className = "roundTitle";
  roundTitle.innerText = translations[currentLang].roundno + " " + data.round;
  // ✅ Create sections safely
  let restDiv = null;
  if (data.resting && data.resting.length !== 0) {
    restDiv = renderRestingPlayers(data, index);
  }
  const gamesDiv = renderGames(data, index);
  // ✅ Wrap everything in a container to distinguish latest vs played
  const wrapper = document.createElement('div');
  const isLatest = index === allRounds.length - 1;
  wrapper.className = isLatest ? 'latest-round' : 'played-round';
  // ✅ Append conditionally
  if (restDiv) {
    wrapper.append(gamesDiv,restDiv);
  } else {
    wrapper.append(gamesDiv);
  }
  resultsDiv.append(wrapper);
  // ✅ Navigation buttons
  //document.getElementById('prevBtn').disabled = index === 0;
  //document.getElementById('nextBtn').disabled = false;
}


// Resting players display
function t(key) {
  return translations[currentLang]?.[key] || key;
}


function chkrenderRestingPlayers(data, index) {
  const restDiv = document.createElement('div');
  restDiv.className = 'round-header';
  restDiv.style.paddingLeft = "12px";

  const title = document.createElement('div');
  title.dataset.i18n = 'sittingOut';
  title.textContent = t('sittingOut');
  restDiv.appendChild(title);

  const restBox = document.createElement('div');
  restBox.className = 'rest-box';

  if (!data.resting || data.resting.length === 0) {
    const span = document.createElement('span');
    span.dataset.i18n = 'none';
    span.textContent = t('none');
    restBox.appendChild(span);
  } else {
    data.resting.forEach(restName => {
      const baseName = restName.split('#')[0];

      const playerObj = schedulerState.allPlayers.find(
        p => p.name === baseName
      );

      if (playerObj) {
        restBox.appendChild(
          makeRestButton(
            { ...playerObj, displayName: restName },
            data,
            index
          )
        );
      }
    });
  }

  restDiv.appendChild(restBox);
  return restDiv;
}

function renderGames(data, roundIndex) {
  const wrapper = document.createElement('div');
  const playmode = getPlayMode();

  data.games.forEach((game, gameIndex) => {
    const courtDiv = document.createElement('div');
    courtDiv.className = 'courtcard';

    const courtName = document.createElement('div');
    courtName.classList.add('courtname');
    courtName.textContent = `Court ${gameIndex + 1}`;

    const teamsDiv = document.createElement('div');
    teamsDiv.className = 'teams';

    const makeTeamDiv = (teamSide) => {
      const teamDiv = document.createElement('div');
      teamDiv.className = 'team';
      teamDiv.dataset.teamSide = teamSide;
      teamDiv.dataset.gameIndex = gameIndex;

      // 🔁 Swap icon
      const swapIcon = document.createElement('div');
      swapIcon.className = 'swap-icon';
      swapIcon.innerHTML = '🔁';
      teamDiv.appendChild(swapIcon);

      // 👥 Players
      const teamPairs = teamSide === 'L' ? game.pair1 : game.pair2;
      teamPairs.forEach((p, i) => {
        teamDiv.appendChild(
          makePlayerButton(p, teamSide, gameIndex, i, data, roundIndex)
        );
      });

      // 🏆 Win cup (created hidden)
      const winCup = document.createElement('img');
      winCup.src = 'win-cup.png';
      winCup.className = 'win-cup blinking';
      winCup.title = 'Mark winner';
      winCup.style.visibility = 'hidden';
      winCup.style.pointerEvents = 'none';

      // Restore winner state
      if (game.winner === teamSide) {
        winCup.classList.add('active');
        winCup.classList.remove('blinking');
      }

      // 🏆 Winner toggle logic (minimal, correct)
      const toggleWinner = (e) => {
        if (currentState === "idle") return;
        e.stopPropagation();
        e.preventDefault();

        const allCups = teamDiv.parentElement.querySelectorAll('.win-cup');
        const allSwapIcons = teamDiv.parentElement.querySelectorAll('.swap-icon');
        const isActive = winCup.classList.contains('active');

        if (!isActive) {
          // 👉 Mark this team
          allCups.forEach(cup => {
            cup.classList.remove('active', 'blinking');
            cup.style.visibility = 'hidden';
            cup.style.pointerEvents = 'none';
          });
          
          winCup.classList.add('active');
          winCup.classList.remove('blinking');
          winCup.style.visibility = 'visible';
          winCup.style.pointerEvents = 'auto';

          allSwapIcons.forEach(icon => {
            icon.style.visibility = 'hidden';
            icon.style.pointerEvents = 'none';
          });

          game.winner = teamSide;
          game.winners = teamPairs.slice();
        } else {
          // 👉 Unmark → show BOTH cups again
          allCups.forEach(cup => {
            cup.classList.remove('active');
            cup.classList.add('blinking');
            cup.style.visibility = 'visible';
            cup.style.pointerEvents = 'auto';
          });

          allSwapIcons.forEach(icon => {
            icon.style.visibility = 'visible';
            icon.style.pointerEvents = 'auto';
          });

          game.winner = undefined;
          game.winners = [];
        }
      };

      // Attach to BOTH team and cup
      winCup.addEventListener('click', toggleWinner);
      teamDiv.addEventListener('click', toggleWinner);

      teamDiv.appendChild(winCup);

      // 🔁 Swap logic (unchanged)
      const isLatestRound = roundIndex === allRounds.length - 1;
      if (isLatestRound) {
        swapIcon.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();

          if (game.winner) return; // Busy → no swap

          if (window.selectedTeam) {
            const src = window.selectedTeam;
            if (src.gameIndex !== gameIndex) {
              handleTeamSwapAcrossCourts(
                src,
                { teamSide, gameIndex },
                data,
                roundIndex
              );
            }
            window.selectedTeam = null;
            document.querySelectorAll('.selected-team').forEach(b => b.classList.remove('selected-team'));
          } else {
            window.selectedTeam = { teamSide, gameIndex };
            teamDiv.classList.add('selected-team');
          }
        });
      }

      return teamDiv;
    };

    const teamLeft = makeTeamDiv('L');
    const teamRight = makeTeamDiv('R');

    const vs = document.createElement('span');
    vs.className = 'vs';
    vs.innerText = '  ';

    teamsDiv.append(teamLeft, vs, teamRight);
    courtDiv.append(courtName, teamsDiv);
    wrapper.appendChild(courtDiv);
  });

  return wrapper;
}


function renderGames2(data, index) {
  const wrapper = document.createElement('div');
  const playmode = getPlayMode(); // "competitive" or "random"

  data.games.forEach((game, gameIndex) => {
    const courtDiv = document.createElement('div');
    courtDiv.className = 'courtcard';

    const courtName = document.createElement('div');
    courtName.classList.add('courtname');
    courtName.textContent = `Court ${gameIndex + 1}`;

    const teamsDiv = document.createElement('div');
    teamsDiv.className = 'teams';

    const makeTeamDiv = (teamSide) => {
      const teamDiv = document.createElement('div');
      teamDiv.className = 'team';
      teamDiv.dataset.teamSide = teamSide;
      teamDiv.dataset.gameIndex = gameIndex;

      // 🔁 Swap icon
      const swapIcon = document.createElement('div');
      swapIcon.className = 'swap-icon';
      swapIcon.innerHTML = '🔁';
      teamDiv.appendChild(swapIcon);

      // 👥 Players
      const teamPairs = teamSide === 'L' ? game.pair1 : game.pair2;
      teamPairs.forEach((p, i) => {
        teamDiv.appendChild(
          makePlayerButton(p, teamSide, gameIndex, i, data, index)
        );
      });

      // 🏆 Win cup
      const winCup = document.createElement('img');
      winCup.src = 'win-cup.png';
      winCup.className = 'win-cup blinking';
      winCup.title = 'Mark winner';

      // Start hidden
      winCup.style.visibility = 'hidden';
      winCup.style.pointerEvents = 'none';

      // Restore state
      if (game.winner === teamSide) {
        winCup.classList.add('active');
        winCup.classList.remove('blinking');
        winCup.style.visibility = 'visible';
        winCup.style.pointerEvents = 'auto';
      }

      // 🏆 Win-cup logic (competitive mode only)
      if (playmode === 'competitive') {
        winCup.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();

          const allCups = teamDiv.parentElement.querySelectorAll('.win-cup');
          const allSwapIcons = teamDiv.parentElement.querySelectorAll('.swap-icon');
          const isActive = winCup.classList.contains('active');

          if (!isActive) {
            // ---- ACTIVATE THIS TEAM ----
            allCups.forEach(cup => {
              cup.classList.remove('active', 'blinking');
              cup.style.visibility = 'hidden';
              cup.style.pointerEvents = 'none';
            });

            winCup.classList.add('active');
            winCup.style.visibility = 'visible';
            winCup.style.pointerEvents = 'auto';

            // Disable swaps while busy
            allSwapIcons.forEach(icon => {
              icon.style.visibility = 'hidden';
              icon.style.pointerEvents = 'none';
            });

            game.winner = teamSide;
            game.winners = teamPairs.slice();
          } else {
            // ---- RESET TO IDLE ----
            allCups.forEach(cup => {
              cup.classList.remove('active');
              cup.classList.add('blinking');
              cup.style.visibility = 'hidden';
              cup.style.pointerEvents = 'none';
            });

            // Re-enable swaps
            allSwapIcons.forEach(icon => {
              icon.style.visibility = 'visible';
              icon.style.pointerEvents = 'auto';
            });

            game.winner = undefined;
            game.winners = [];
          }
        });
      }

      teamDiv.appendChild(winCup);

      // 🔁 Swap logic (EXACTLY like renderGamesold)
      const isLatestRound = index === allRounds.length - 1;
      if (isLatestRound) {
        swapIcon.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();

          if (game.winner) return; // Busy → no swap

          if (window.selectedTeam) {
            const src = window.selectedTeam;

            if (src.gameIndex !== gameIndex) {
              handleTeamSwapAcrossCourts(
                src,
                { teamSide, gameIndex },
                data,
                index
              );
            }

            window.selectedTeam = null;
            document
              .querySelectorAll('.selected-team')
              .forEach(b => b.classList.remove('selected-team'));

          } else {
            window.selectedTeam = { teamSide, gameIndex };
            teamDiv.classList.add('selected-team');
          }
        });
      }

      return teamDiv;
    };

    const teamLeft = makeTeamDiv('L');
    const teamRight = makeTeamDiv('R');

    const vs = document.createElement('span');
    vs.className = 'vs';
    vs.innerText = '  ';

    teamsDiv.append(teamLeft, vs, teamRight);
    courtDiv.append(courtName, teamsDiv);
    wrapper.appendChild(courtDiv);

    // Restore visibility if winner exists
    if (playmode === 'competitive' && game.winner) {
      teamsDiv.querySelectorAll('.win-cup').forEach(cup => {
        if (!cup.classList.contains('active')) {
          cup.style.visibility = 'hidden';
          cup.style.pointerEvents = 'none';
        }
      });
      teamsDiv.querySelectorAll('.swap-icon').forEach(icon => {
        icon.style.visibility = 'hidden';
        icon.style.pointerEvents = 'none';
      });
    }
  });

  return wrapper;
}





function updateWinCupVisibility() {
  const playmode = getPlayMode();
  document.querySelectorAll('.win-cup').forEach(cup => {
    cup.style.display = playmode === "competitive" ? "" : "none";
  });
}


function renderRestingPlayers(data, index) {
  const restDiv = document.createElement('div');
  restDiv.className = 'round-header';
  restDiv.style.paddingLeft = "12px";

  //const title = document.createElement('div');
  //title.setAttribute("data-i18n", "sittingOut");
  //restDiv.appendChild(title);
  const title = document.createElement('div');
title.dataset.i18n = 'sittingOut';
title.textContent = t('sittingOut');
restDiv.appendChild(title);
  const restBox = document.createElement('div');
  restBox.className = 'rest-box';

  if (!data.resting || data.resting.length === 0) {
    const span = document.createElement('span');
    span.innerText = 'None';
    restBox.appendChild(span);
  } else {
    data.resting.forEach(restName => {
      // 🔑 Extract real player name (before #)
      const baseName = restName.split('#')[0];

      const playerObj = schedulerState.allPlayers.find(
        p => p.name === baseName
      );

      if (playerObj) {
        restBox.appendChild(
          makeRestButton(
            { ...playerObj, displayName: restName }, // keep #count
            data,
            index
          )
        );
      }
    });
  }

  restDiv.appendChild(restBox);
  return restDiv;
}




function getGenderByName(playerName) {
  const p = schedulerState.allPlayers.find(pl => pl.name === playerName);
  return p ? p.gender : null; // "Male" | "Female"
}

function getTeamTypeFromPairs(playerNames) {
  let hasMale = false;
  let hasFemale = false;

  for (const name of playerNames) {
    const gender = getGenderByName(name);

    if (gender === "Male") hasMale = true;
    if (gender === "Female") hasFemale = true;
  }

  if (hasMale && hasFemale) return "mixed";
  if (hasMale) return "men";
  if (hasFemale) return "women";

  return "unknown";
}


function makeRestButton(player, data, index) {
  const btn = document.createElement('button');
  btn.className = 'rest-btn';

  // ───────── GENDER ICON (IMAGE-BASED) ─────────
  if (IS_MIXED_SESSION && player?.gender) {
    const genderIcon = document.createElement('img');
    genderIcon.className = 'gender-icon';

    genderIcon.src =
      player.gender === 'Female'
        ? 'female.png'
        : 'male.png';

    genderIcon.alt = player.gender;
    btn.appendChild(genderIcon);
  }

  // ───────── LABEL ─────────
  const label = player.displayName || player.name;
  const textNode = document.createElement('span');
  textNode.innerText = label;
  btn.appendChild(textNode);

  /* ───────── COLOR LOGIC ───────── */

  const restMatch = label.match(/#(\d+)/);
  const restCount = restMatch ? parseInt(restMatch[1], 10) : 0;

  if (IS_MIXED_SESSION && player?.gender) {
    // Gender-based hue + rest-based lightness
    const hue = player.gender === "Male" ? 200 : 330;
    const lightness = Math.min(90, 65 + restCount * 5);

    btn.style.backgroundColor = `hsl(${hue}, 70%, ${lightness}%)`;
    btn.style.color = "#000";
  } else {
    // Original rest-count coloring
    if (restMatch) {
      const hue = (restCount * 40) % 360;
      btn.style.backgroundColor = `hsl(${hue}, 60%, 85%)`;
    } else {
      btn.style.backgroundColor = '#eee';
    }
    btn.style.color = "#000";
  }

  /* ─────────────────────────────── */

  const isLatestRound = index === allRounds.length - 1;
  if (!isLatestRound) return btn;

  const handleTap = (e) => {
    e.preventDefault();

    if (window.selectedPlayer) {
      const src = window.selectedPlayer;
      if (src.from === 'team') {
        handleDropRestToTeam(
          e,
          src.teamSide,
          src.gameIndex,
          src.playerIndex,
          data,
          index,
          label
        );
      }
      window.selectedPlayer = null;
      document
        .querySelectorAll('.selected')
        .forEach(b => b.classList.remove('selected'));
    } else {
      window.selectedPlayer = { playerName: label, from: 'rest' };
      btn.classList.add('selected');
    }
  };

  btn.addEventListener('click', handleTap);
  btn.addEventListener('touchstart', handleTap);

  return btn;
}

function makePlayerButton(name, teamSide, gameIndex, playerIndex, data, index) {
  const btn = document.createElement('button');

  // Get player object
  const baseName = name.split('#')[0];
  const player = schedulerState.allPlayers.find(p => p.name === baseName);

  btn.className = teamSide === 'L'
    ? 'Lplayer-btn'
    : 'Rplayer-btn';

  /* ───────── GENDER EMOJI (LEFT) ───────── */
  if (IS_MIXED_SESSION && player?.gender) {
  const genderIcon = document.createElement('img');
  genderIcon.className = 'gender-icon';

  genderIcon.src =
  player.gender === 'Female'
    ? 'female.png'
    : 'male.png';

  genderIcon.alt = player.gender;
  btn.prepend(genderIcon);
}

  /* ───────── PLAYER NAME (TRUNCATED) ───────── */
  const nameSpan = document.createElement('span');
  nameSpan.className = 'player-name';
  nameSpan.textContent = name;
  nameSpan.title = name; // full name on long-press / hover

  btn.appendChild(nameSpan);

  /* ───────────────────────────────────── */

  const isLatestRound = index === allRounds.length - 1;
  if (!isLatestRound) return btn;

  const handleTap = (e) => {
    e.preventDefault();

    if (window.selectedPlayer) {
      const src = window.selectedPlayer;

      if (src.from === 'rest') {
        handleDropRestToTeam(
          e,
          teamSide,
          gameIndex,
          playerIndex,
          data,
          index,
          src.playerName
        );
      } else {
        handleDropBetweenTeams(
          e,
          teamSide,
          gameIndex,
          playerIndex,
          data,
          index,
          src
        );
      }

      window.selectedPlayer = null;
      document
        .querySelectorAll('.selected')
        .forEach(b => b.classList.remove('selected'));
    } else {
      window.selectedPlayer = {
        playerName: name,
        teamSide,
        gameIndex,
        playerIndex,
        from: 'team'
      };
      btn.classList.add('selected');
    }
  };

  btn.addEventListener('click', handleTap);
  btn.addEventListener('touchstart', handleTap);

  return btn;
}


function xxxmakePlayerButton(name, teamSide, gameIndex, playerIndex, data, index) {
  const btn = document.createElement('button');

  // Determine if gender icons should be shown
  const showGender = IS_MIXED_SESSION;

  // Get player object
  const baseName = name.split('#')[0];
  const player = schedulerState.allPlayers.find(p => p.name === baseName);
  
  btn.textContent = name;
  btn.className = teamSide === 'L' ? 'Lplayer-btn' : 'Rplayer-btn';
  

  /* ───────── COLOR OVERRIDE ───────── */
if (IS_MIXED_SESSION && player?.gender) {
  const genderBtn = document.createElement('span');
  genderBtn.className =
    'gender-btn ' +
    (player.gender === 'Female' ? 'female' : 'male');

  genderBtn.textContent =
   //player.gender === 'Female' ? '👩' : '👨';
   player.gender === 'Female' ? "🙎‍♀️" : "👨‍💼" ;
    
  btn.prepend(genderBtn);
}

  /* ───────────────────────────────── */

  const isLatestRound = index === allRounds.length - 1;
  if (!isLatestRound) return btn;

  const handleTap = (e) => {
    e.preventDefault();

    if (window.selectedPlayer) {
      const src = window.selectedPlayer;

      if (src.from === 'rest') {
        handleDropRestToTeam(
          e,
          teamSide,
          gameIndex,
          playerIndex,
          data,
          index,
          src.playerName
        );
      } else {
        handleDropBetweenTeams(
          e,
          teamSide,
          gameIndex,
          playerIndex,
          data,
          index,
          src
        );
      }

      window.selectedPlayer = null;
      document.querySelectorAll('.selected')
        .forEach(b => b.classList.remove('selected'));
    } else {
      window.selectedPlayer = {
        playerName: name,
        teamSide,
        gameIndex,
        playerIndex,
        from: 'team'
      };
      btn.classList.add('selected');
    }
  };

  btn.addEventListener('click', handleTap);
  btn.addEventListener('touchstart', handleTap);

  return btn;
}




function xxxmakeRestButton(player, data, index) {
  const btn = document.createElement('button');

  let genderIcon = "";
  if (IS_MIXED_SESSION) {
    genderIcon =
      player.gender === "Male" ? "👨‍💼 " :
      player.gender === "Female" ?"🙎‍♀️ "  :
      "";
  }

  const label = player.displayName || player.name;
  btn.innerText = `${genderIcon}${label}`;
  btn.className = 'rest-btn';

  /* ───────── COLOR LOGIC ───────── */

  const restMatch = label.match(/#(\d+)/);
  const restCount = restMatch ? parseInt(restMatch[1], 10) : 0;

  if (IS_MIXED_SESSION && genderIcon) {
    // 🎨 Gender base hue + rest-based lightness
    const hue = player.gender === "Male" ? 200 : 330;
    const lightness = Math.min(90, 65 + restCount * 5); // lighter with rest

    btn.style.backgroundColor = `hsl(${hue}, 70%, ${lightness}%)`;
    btn.style.color = "#000";
  } else {
    // ♻️ Original rest-count rainbow
    if (restMatch) {
      const hue = (restCount * 40) % 360;
      btn.style.backgroundColor = `hsl(${hue}, 60%, 85%)`;
    } else {
      btn.style.backgroundColor = '#eee';
    }
    btn.style.color = "#000";
  }

  /* ─────────────────────────────── */

  const isLatestRound = index === allRounds.length - 1;
  if (!isLatestRound) return btn;

  const handleTap = (e) => {
    e.preventDefault();

    if (window.selectedPlayer) {
      const src = window.selectedPlayer;
      if (src.from === 'team') {
        handleDropRestToTeam(
          e,
          src.teamSide,
          src.gameIndex,
          src.playerIndex,
          data,
          index,
          label
        );
      }
      window.selectedPlayer = null;
      document.querySelectorAll('.selected')
        .forEach(b => b.classList.remove('selected'));
    } else {
      window.selectedPlayer = { playerName: label, from: 'rest' };
      btn.classList.add('selected');
    }
  };

  btn.addEventListener('click', handleTap);
  btn.addEventListener('touchstart', handleTap);

  return btn;
}


function makeTeamButton(label, teamSide, gameIndex, data, index) {
  const btn = document.createElement('button');
  btn.className = 'team-btn';
  btn.innerText = label; // Visible label stays simple (Team L / Team R)
  // Store internal unique info in dataset
  btn.dataset.gameIndex = gameIndex;
  btn.dataset.teamSide = teamSide;
  const isLatestRound = index === allRounds.length - 1;
  if (!isLatestRound) return btn;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (window.selectedTeam) {
      const src = window.selectedTeam;
      if (src.gameIndex !== gameIndex) {
        handleTeamSwapAcrossCourts(src, { teamSide, gameIndex }, data, index);
      }
      window.selectedTeam = null;
      document.querySelectorAll('.selected-team').forEach(b => b.classList.remove('selected-team'));
    } else {
      // Store internal info for selection
      window.selectedTeam = { teamSide, gameIndex };
      btn.classList.add('selected-team');
    }
  });
  return btn;
}

function handleDropRestToTeam(
  e, teamSide, gameIndex, playerIndex, data, roundIndex, movingPlayer = null
) {
  const drop = !movingPlayer && e.dataTransfer
    ? JSON.parse(e.dataTransfer.getData('text/plain'))
    : { type: 'rest', player: movingPlayer };

  if (drop.type !== 'rest' || !drop.player) return;

  const teamKey = teamSide === 'L' ? 'pair1' : 'pair2';

  const newPlayer = drop.player.replace(/#\d+$/, '');
  const oldPlayer = data.games[gameIndex][teamKey][playerIndex];

  // Remove the new player from data.resting
  data.resting = data.resting.filter(p => !p.startsWith(newPlayer));

  // Insert new player into team
  data.games[gameIndex][teamKey][playerIndex] = newPlayer;

  // ---------------------------------------------
  // 🔥 schedulerState.restCount is READ-ONLY
  // ---------------------------------------------
  const { restCount } = schedulerState;

  if (oldPlayer && oldPlayer !== '(Empty)') {

    // Read only value
    const stored = restCount.get(oldPlayer) || 0;

    // UI number = scheduler stored + 1
    const nextNum = stored + 1;

    // Add to data.resting
    data.resting.push(`${oldPlayer}#${nextNum}`);
  }

  showRound(roundIndex);
}

function handleDropBetweenTeams(e, teamSide, gameIndex, playerIndex, data, index, src) {
  // src contains info about the player you selected first
  const { teamSide: fromTeamSide, gameIndex: fromGameIndex, playerIndex: fromPlayerIndex, playerName: player } = src;
  if (!player || player === '(Empty)') return;
  const fromTeamKey = fromTeamSide === 'L' ? 'pair1' : 'pair2';
  const toTeamKey = teamSide === 'L' ? 'pair1' : 'pair2';
  const fromTeam = data.games[fromGameIndex][fromTeamKey];
  const toTeam = data.games[gameIndex][toTeamKey];
  // No need to strip #index anymore
  const movedPlayer = player;
  const targetPlayer = toTeam[playerIndex];
  // ✅ Swap players
  toTeam[playerIndex] = movedPlayer;
  fromTeam[fromPlayerIndex] = targetPlayer && targetPlayer !== '(Empty)' ? targetPlayer : '(Empty)';
  showRound(index);
}

// Add a global flag to prevent concurrent swaps
let swapInProgress = false;
const swapQueue = [];

function handleTeamSwapAcrossCourts(src, target, data, index) {
  if (!src || !target) return;
  if (src.gameIndex === target.gameIndex && src.teamSide === target.teamSide) return;

  // Queue the swap if another is in progress
  if (swapInProgress) {
    swapQueue.push({ src, target, data, index });
    return;
  }

  swapInProgress = true;

  const srcKey = src.teamSide === 'L' ? 'pair1' : 'pair2';
  const targetKey = target.teamSide === 'L' ? 'pair1' : 'pair2';

  // Fetch teams immediately before swapping
  const srcTeam = data.games[src.gameIndex][srcKey];
  const targetTeam = data.games[target.gameIndex][targetKey];

  // Animation highlight
  const srcDiv = document.querySelector(`.team[data-game-index="${src.gameIndex}"][data-team-side="${src.teamSide}"]`);
  const targetDiv = document.querySelector(`.team[data-game-index="${target.gameIndex}"][data-team-side="${target.teamSide}"]`);
  [srcDiv, targetDiv].forEach(div => {
    div.classList.add('swapping');
    setTimeout(() => div.classList.remove('swapping'), 600);
  });

  setTimeout(() => {
    // Swap teams safely using temporary variable
    const temp = data.games[src.gameIndex][srcKey];
    data.games[src.gameIndex][srcKey] = data.games[target.gameIndex][targetKey];
    data.games[target.gameIndex][targetKey] = temp;

    // Refresh the round
    showRound(index);

    swapInProgress = false;

    // Process next swap in queue if any
    if (swapQueue.length > 0) {
      const nextSwap = swapQueue.shift();
      handleTeamSwapAcrossCourts(nextSwap.src, nextSwap.target, nextSwap.data, nextSwap.index);
    }
  }, 300);
}


/* =========================
 
MOBILE BEHAVIOR
 
========================= */
function enableTouchDrag(el) {
  let offsetX = 0, offsetY = 0;
  let clone = null;
  let isDragging = false;
  const startDrag = (x, y) => {
    const rect = el.getBoundingClientRect();
    offsetX = x - rect.left;
    offsetY = y - rect.top;
    clone = el.cloneNode(true);
    clone.style.position = 'fixed';
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.opacity = '0.7';
    clone.style.zIndex = 9999;
    clone.classList.add('dragging');
    document.body.appendChild(clone);
    isDragging = true;
  };
  const moveDrag = (x, y) => {
    if (!clone) return;
    clone.style.left = `${x - offsetX}px`;
    clone.style.top = `${y - offsetY}px`;
  };
  const endDrag = () => {
    if (clone) {
      clone.remove();
      clone = null;
    }
    isDragging = false;
  };
  // --- Touch Events ---
  el.addEventListener('touchstart', e => {
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY);
    e.preventDefault();
  });
  el.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const touch = e.touches[0];
    moveDrag(touch.clientX, touch.clientY);
  });
  el.addEventListener('touchend', endDrag);
  // --- Mouse Events ---
  el.addEventListener('mousedown', e => {
    startDrag(e.clientX, e.clientY);
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (isDragging) moveDrag(e.clientX, e.clientY);
  });
  document.addEventListener('mouseup', endDrag);
}


let interactionLocked = true;

// Apply initial state
document.body.classList.add('locked');

const lockBtn = document.getElementById('lockToggleBtn');

lockBtn.addEventListener('click', () => {
  interactionLocked = !interactionLocked;

  // Toggle body class
  document.body.classList.toggle('locked', interactionLocked);

  // Update icon text
  //lockBtn.textContent = interactionLocked ? '🔒' : '🔓';
});









function getPlayMode() {
  return document.getElementById("modeToggle").checked
    ? "competitive"
    : "random";
}

const modeToggle = document.getElementById("modeToggle");
const modeLabel  = document.getElementById("modeLabel");

// Restore saved mode
modeToggle.checked = localStorage.getItem("playMode") === "competitive";
updateModeLabel();

modeToggle.addEventListener("change", () => {
  localStorage.setItem("playMode", getPlayMode());
  updateModeLabel();
  //updateWinCupVisibility(); // <-- update cups visibility when mode changes
});




function updateModeLabel() {
  modeLabel.textContent =
    getPlayMode() === "competitive"
      ? "🏆"
      : "🎲";
}


