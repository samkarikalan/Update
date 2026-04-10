/* ============================================================
   ALGORITHM -- Original Round Scheduler (restored)
   
   Functions:
   - AischedulerNextRound   : main entry, rest + pair + matchup
   - findDisjointPairs      : DFS pair picker, fresh pairs first
   - reorderFreePlayersByLastRound : spreads last-round players across courts
   - getMatchupScores       : scores court matchups by opponent freshness  
   - shuffle                : random shuffle helper
   - betaAischedulerNextRound / backupAischedulerNextRound : unused fallbacks
   ============================================================ */

// ── Key helper (used by rounds.js updSchedule) ──
function _pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function AischedulerNextRound(schedulerState) {
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
        freshness,         // 0-4
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