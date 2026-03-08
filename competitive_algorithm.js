// ============================================================
//  COMPETITIVE ROUND ALGORITHM
//  competitive_algorithm.js
// ============================================================


// ============================================================
//  SECTION 1 — POINTS & STREAK HELPERS
// ============================================================

function buildPointsAndStreaks(allRounds, activeplayers) {
  const rankPoints = new Map();
  const streakMap  = new Map();
  for (const p of activeplayers) {
    rankPoints.set(p, 100);
    streakMap.set(p, 0);
  }
  for (const round of allRounds) {
    if (!round?.games) continue;
    for (const game of round.games) {
      if (!game.winner || !game.pair1 || !game.pair2) continue;
      const winners = game.winner === 'L' ? game.pair1 : game.pair2;
      const losers  = game.winner === 'L' ? game.pair2 : game.pair1;
      for (const p of winners) applyResult(p, true,  rankPoints, streakMap);
      for (const p of losers)  applyResult(p, false, rankPoints, streakMap);
    }
  }
  return { rankPoints, streakMap };
}

function applyResult(player, isWin, rankPoints, streakMap) {
  const streak = streakMap.get(player) || 0;
  let delta = 0;
  if (isWin) {
    delta = 2;
    if (streak > 0) delta += 1;
    streakMap.set(player, Math.max(streak, 0) + 1);
  } else {
    delta = -2;
    if (streak < 0) delta -= 1;
    streakMap.set(player, Math.min(streak, 0) - 1);
  }
  rankPoints.set(player, (rankPoints.get(player) || 100) + delta);
}


// ============================================================
//  SECTION 2 — TIER HELPERS
// ============================================================

function calculateTiers(activeplayers, rankPoints) {
  const sorted = [...activeplayers].sort(
    (a, b) => (rankPoints.get(b) || 100) - (rankPoints.get(a) || 100)
  );
  const total     = sorted.length;
  const topCut    = Math.ceil(total / 3);
  const bottomCut = Math.floor((total * 2) / 3);
  const tierMap   = new Map();
  sorted.forEach((p, i) => {
    if (i < topCut)         tierMap.set(p, 'strong');
    else if (i < bottomCut) tierMap.set(p, 'inter');
    else                    tierMap.set(p, 'weak');
  });
  return tierMap;
}

function getPlayerTier(player, tierMap) {
  return tierMap.get(player) || 'inter';
}


// ============================================================
//  SECTION 3 — TIER RULE CHECKER
// ============================================================

function getGameTierRule(pair1, pair2, tierMap) {
  const [t1a, t1b] = pair1.map(p => getPlayerTier(p, tierMap));
  const [t2a, t2b] = pair2.map(p => getPlayerTier(p, tierMap));
  const sig1 = [t1a, t1b].sort().join('+');
  const sig2 = [t2a, t2b].sort().join('+');

  const rule1Sigs = ['strong+strong', 'inter+inter', 'weak+weak'];
  if (rule1Sigs.includes(sig1) && sig1 === sig2) return 1;

  const rule2Sigs = ['inter+strong', 'strong+weak', 'inter+weak'];
  if (rule2Sigs.includes(sig1) && sig1 === sig2) return 2;

  const isSwPair = s => s === 'strong+weak' || s === 'weak+strong';
  const isIIPair = s => s === 'inter+inter';
  if ((isSwPair(sig1) && isIIPair(sig2)) || (isIIPair(sig1) && isSwPair(sig2))) return 3;

  return 0;
}


// ============================================================
//  SECTION 4 — FULL SESSION HISTORY (never reset)
// ============================================================

/**
 * Count how many times each pair has played together in COMPETITIVE rounds only.
 * Warmup history is ignored — resets cleanly at start of competitive phase.
 * minRounds is the warmup threshold stored on state.
 */
function buildCompetitivePairHistory(allRounds, minRounds) {
  const pairCount = new Map();
  for (let i = minRounds; i < allRounds.length; i++) {
    const round = allRounds[i];
    if (!round?.games) continue;
    for (const game of round.games) {
      const t1 = game.pair1;
      const t2 = game.pair2;
      if (!t1 || !t2) continue;
      const k1 = createSortedKey(t1[0], t1[1]);
      const k2 = createSortedKey(t2[0], t2[1]);
      pairCount.set(k1, (pairCount.get(k1) || 0) + 1);
      pairCount.set(k2, (pairCount.get(k2) || 0) + 1);
    }
  }
  return pairCount;
}

/**
 * Count opponent history from COMPETITIVE rounds only.
 */
function buildCompetitiveOpponentHistory(allRounds, activeplayers, minRounds) {
  const oppMap = new Map();
  for (const p of activeplayers) {
    const inner = new Map();
    for (const q of activeplayers) { if (p !== q) inner.set(q, 0); }
    oppMap.set(p, inner);
  }
  for (let i = minRounds; i < allRounds.length; i++) {
    const round = allRounds[i];
    if (!round?.games) continue;
    for (const game of round.games) {
      const t1 = game.pair1;
      const t2 = game.pair2;
      if (!t1 || !t2) continue;
      for (const a of t1) {
        for (const b of t2) {
          if (!oppMap.has(a)) oppMap.set(a, new Map());
          if (!oppMap.has(b)) oppMap.set(b, new Map());
          oppMap.get(a).set(b, (oppMap.get(a).get(b) || 0) + 1);
          oppMap.get(b).set(a, (oppMap.get(b).get(a) || 0) + 1);
        }
      }
    }
  }
  return oppMap;
}

// ============================================================
//  SECTION 5 — SCORING
// ============================================================

/**
 * Score one candidate game.
 *
 * Priority (strictly ordered):
 *   1. Freshness tier  — 1000 if BOTH pairs are fresh, 0 if either is repeated
 *      This separates fresh combos from repeated ones absolutely.
 *   2. Tier rule score — +30/20/10/0 (Rule1/Rule2/Rule3/none)
 *      Chosen within the fresh group to maximise tier quality.
 *   3. Opponent freshness — small +/- tiebreaker within same tier rule
 *
 * Result: the solver will always prefer any fresh-pair game over any
 * repeated-pair game, AND within fresh games it picks the best tier match.
 */
function scoreGame(pair1, pair2, tierMap, pairCount, oppMap) {
  const k1 = createSortedKey(pair1[0], pair1[1]);
  const k2 = createSortedKey(pair2[0], pair2[1]);

  const pair1Repeats = pairCount.get(k1) || 0;
  const pair2Repeats = pairCount.get(k2) || 0;

  // Freshness bonus — large enough to always beat tier score differences
  // If either pair is repeated, no freshness bonus (score stays in 0-40 range)
  const freshnessBonus = (pair1Repeats === 0 && pair2Repeats === 0) ? 1000 : 0;

  // Tier score — scaled up so Rule1 vs Rule0 matters within fresh group
  const tierRule  = getGameTierRule(pair1, pair2, tierMap);
  const tierScore = tierRule === 1 ? 30 : tierRule === 2 ? 20 : tierRule === 3 ? 10 : 0;

  // Opponent freshness — small tiebreaker
  let oppScore = 0;
  for (const a of pair1) {
    for (const b of pair2) {
      const times = oppMap.get(a)?.get(b) || 0;
      oppScore += times === 0 ? 0.5 : -(0.1 * times);
    }
  }

  // Soft repeat penalty — only kicks in when all options are repeated
  const repeatPenalty = (pair1Repeats + pair2Repeats) * 5;

  return freshnessBonus + tierScore + oppScore - repeatPenalty;
}


// ============================================================
//  SECTION 6 — BACKTRACKING COURT SOLVER
// ============================================================

function findBestCourtCombination(playing, numCourts, tierMap, pairCount, oppMap) {

  let bestScore = -Infinity;
  let bestGames = null;
  const MAX_ITER = 8000;
  let iterations = 0;

  function solve(remaining, currentGames, currentScore) {
    if (iterations++ > MAX_ITER) return;

    if (currentGames.length === numCourts) {
      if (currentScore > bestScore) {
        bestScore = currentScore;
        bestGames = currentGames.map(g => ({ ...g }));
      }
      return;
    }

    if (remaining.length < 4) return;

    for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        const pair1 = [remaining[i], remaining[j]];
        const rest  = remaining.filter((_, idx) => idx !== i && idx !== j);

        for (let k = 0; k < rest.length; k++) {
          for (let l = k + 1; l < rest.length; l++) {
            const pair2    = [rest[k], rest[l]];
            const nextRest = rest.filter((_, idx) => idx !== k && idx !== l);
            const gs       = scoreGame(pair1, pair2, tierMap, pairCount, oppMap);
            const tr       = getGameTierRule(pair1, pair2, tierMap);

            currentGames.push({ pair1: [...pair1], pair2: [...pair2], tierRule: tr, gameScore: gs });
            solve(nextRest, currentGames, currentScore + gs);
            currentGames.pop();

            if (iterations > MAX_ITER) return;
          }
        }
      }
    }
  }

  solve([...playing], [], 0);
  return bestGames;
}


// ============================================================
//  SECTION 7 — REST SELECTION (avoids repeat rest pairs)
// ============================================================

function chooseRestingPlayers(state) {
  const totalPlayers    = state.activeplayers.length;
  const playersPerRound = state.courts * 4;
  const needRest        = totalPlayers - playersPerRound;

  if (needRest <= 0) {
    return { playing: [...state.activeplayers], resting: [] };
  }

  // Rest queue is FIXED — never rotated, same order every round (managed by RandomRound/rounds.js)
  const resting = state.restQueue.slice(0, needRest);
  const restSet = new Set(resting);

  return {
    playing: state.activeplayers.filter(p => !restSet.has(p)),
    resting
  };
}


// ============================================================
//  SECTION 8 — WARM UP CHECK
// ============================================================

function isWarmupComplete(state) {
  const minRounds = state.minRounds || 3;
  return allRounds.length >= minRounds;
}


// ============================================================
//  SECTION 9 — MAIN CompetitiveRound
// ============================================================

function CompetitiveRound(state) {

  const { activeplayers, courts } = state;

  // 1. Rebuild points + streaks from ALL rounds
  const { rankPoints, streakMap } = buildPointsAndStreaks(allRounds, activeplayers);
  state.rankPoints = rankPoints;
  state.streakMap  = streakMap;

  // 2. Recalculate tiers
  const tierMap = calculateTiers(activeplayers, rankPoints);
  state.tierMap = tierMap;

  // 3. Build competitive-only history (resets at warmup boundary)
  const minRounds = state.minRounds || 3;
  const pairCount = buildCompetitivePairHistory(allRounds, minRounds);
  const oppMap    = buildCompetitiveOpponentHistory(allRounds, activeplayers, minRounds);

  // 4. Choose resting players (avoids repeat rest pairs)
  const { playing, resting } = chooseRestingPlayers(state);

  // 5. Find best court combination
  const bestGames = findBestCourtCombination(playing, courts, tierMap, pairCount, oppMap);

  // 6. Build final games
  let finalGames;

  if (bestGames && bestGames.length === courts) {
    finalGames = bestGames.map((g, c) => ({
      court:     c + 1,
      pair1:     g.pair1,
      pair2:     g.pair2,
      courtRule: g.tierRule,
      isRandom:  false
    }));
  } else {
    // Fallback to random scoped to playing players
    const tempState = { ...state, activeplayers: playing, courts };
    const rr = RandomRound(tempState);
    finalGames = (rr.games || []).map((g, c) => ({
      court:     c + 1,
      pair1:     g.pair1,
      pair2:     g.pair2,
      courtRule: 0,
      isRandom:  true
    }));
  }

  // 7. Update state pair/opponent memory
  updateAfterRound(state, finalGames.map(g => [g.pair1, g.pair2]));
  state.roundIndex = (state.roundIndex || 0) + 1;

  return { round: state.roundIndex, games: finalGames, resting, tierMap };
}


// ============================================================
//  SECTION 10 — PARENT FUNCTION
// ============================================================

function AischedulerNextRound(schedulerState) {

  const playmode   = getPlayMode();
  const page2      = document.getElementById('roundsPage');
  const warmupDone = isWarmupComplete(schedulerState);

  let result;

  if (playmode === 'random' || !warmupDone) {
    result = RandomRound(schedulerState);
    page2.classList.remove('competitive-mode');
    page2.classList.add('random-mode');
    schedulerState._lastMode = 'random';
  } else {
    result = CompetitiveRound(schedulerState);
    page2.classList.remove('random-mode');
    page2.classList.add('competitive-mode');
    schedulerState._lastMode = 'competitive';
  }

  return result;
}


// ============================================================
//  SECTION 11 — POINTS UPDATE (UI display between rounds)
// ============================================================

function updatePointsAfterRound(state) {
  const latestRound = allRounds[allRounds.length - 1];
  if (!latestRound?.games) return;
  for (const game of latestRound.games) {
    if (!game.winner || !game.pair1 || !game.pair2) continue;
    const winners = game.winner === 'L' ? game.pair1 : game.pair2;
    const losers  = game.winner === 'L' ? game.pair2 : game.pair1;
    for (const p of winners) applyResult(p, true,  state.rankPoints, state.streakMap);
    for (const p of losers)  applyResult(p, false, state.rankPoints, state.streakMap);
  }
}


// ============================================================
//  HELPER — createSortedKey
// ============================================================

function createSortedKey(a, b) {
  return [a, b].sort().join('|');
}
