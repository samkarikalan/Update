/* ============================================================
   ALGORITHM — Balanced Round Scheduler
   Replaces old competitive_algorithm.js

   How it works:
   1. Pair selection  — Fresh pairs first, least-repeated fallback,
                        opponent freshness as tiebreaker.
   2. Court rebalance — From those pairs, find the assignment that
                        minimises total |teamAvg1 - teamAvg2|.
   3. Cycle reset     — When all reachable pairs exhausted, soft-
                        halve counts so least-repeated wins next cycle.

   Both Random and Competitive modes use this same algorithm.
   Competitive mode additionally requires winner marking (games.js).
   ============================================================ */


// ── Helpers ──────────────────────────────────────────────────
function _pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function _teamAvg(pair) {
  const r0 = (typeof getActiveRating === 'function') ? getActiveRating(pair[0]) : 1.0;
  const r1 = (typeof getActiveRating === 'function') ? getActiveRating(pair[1]) : 1.0;
  return (r0 + r1) / 2;
}

function _balDiff(pair1, pair2) {
  return Math.abs(_teamAvg(pair1) - _teamAvg(pair2));
}


// ── STEP 1: Pair selection ────────────────────────────────────
function _selectPairs(playing, numNeeded, pairHistory, oppMap) {
  if (numNeeded <= 0) return [];

  const candidates = [];
  for (let i = 0; i < playing.length; i++) {
    for (let j = i + 1; j < playing.length; j++) {
      const a = playing[i], b = playing[j];
      const k = _pairKey(a, b);
      candidates.push({ a, b, k, count: pairHistory.get(k) || 0 });
    }
  }

  // Sort least-repeated first
  candidates.sort((x, y) => x.count - y.count);

  const used = new Set();
  const selected = [];
  let best = null;
  const MAX_BRANCHES = 15000;
  let branches = 0;

  function dfs(idx, score) {
    if (branches++ > MAX_BRANCHES) return;
    if (selected.length === numNeeded) {
      if (!best || score > best.score)
        best = { score, pairs: selected.slice() };
      return;
    }
    if (candidates.length - idx < numNeeded - selected.length) return;

    for (let i = idx; i < candidates.length; i++) {
      const { a, b, count } = candidates[i];
      if (used.has(a) || used.has(b)) continue;
      used.add(a); used.add(b);
      selected.push([a, b]);

      const freshnessScore = Math.max(0, 100 - count * 20);
      let oppBonus = 0;
      for (const [x, y] of selected.slice(0, -1)) {
        for (const pa of [a, b]) {
          for (const pb of [x, y]) {
            if ((oppMap && oppMap.get(pa)?.get(pb) || 0) === 0) oppBonus += 0.5;
          }
        }
      }

      dfs(i + 1, score + freshnessScore + oppBonus);
      selected.pop();
      used.delete(a);
      used.delete(b);
    }
  }

  dfs(0, 0);
  if (best) return best.pairs;

  // Greedy fallback
  const fallback = [];
  const fbUsed = new Set();
  for (const { a, b } of candidates) {
    if (!fbUsed.has(a) && !fbUsed.has(b)) {
      fallback.push([a, b]);
      fbUsed.add(a); fbUsed.add(b);
      if (fallback.length === numNeeded) break;
    }
  }
  return fallback;
}


// ── STEP 2: Court rebalance ───────────────────────────────────
function _rebalanceCourts(pairs, numCourts) {
  let bestTotal = Infinity;
  let bestGames = null;

  function solve(remaining, games) {
    if (games.length === numCourts) {
      const total = games.reduce((s, g) => s + _balDiff(g[0], g[1]), 0);
      if (total < bestTotal) {
        bestTotal = total;
        bestGames = games.map(g => [...g]);
      }
      return;
    }
    if (remaining.length < 2) return;
    const first = remaining[0];
    const rest = remaining.slice(1);
    for (let i = 0; i < rest.length; i++) {
      games.push([first, rest[i]]);
      solve(rest.filter((_, idx) => idx !== i), games);
      games.pop();
    }
  }

  solve(pairs, []);
  return bestGames;
}


// ── STEP 3: Cycle reset ───────────────────────────────────────
function _checkCycleReset(pairHistory, reachablePairs) {
  if (!reachablePairs || reachablePairs.size === 0) return false;
  const allUsed = [...reachablePairs].every(k => (pairHistory.get(k) || 0) > 0);
  if (allUsed) {
    for (const k of reachablePairs) {
      pairHistory.set(k, Math.floor((pairHistory.get(k) || 0) / 2));
    }
    return true;
  }
  return false;
}


// ── MAIN: AischedulerNextRound ────────────────────────────────
function AischedulerNextRound(state) {
  const { activeplayers, numCourts, fixedPairs, restCount } = state;
  const totalPlayers    = activeplayers.length;
  const playersPerRound = numCourts * 4;
  const numResting      = Math.max(totalPlayers - playersPerRound, 0);

  // ── Rest selection ──
  let resting = [];
  let playing = [];

  if (fixedPairs && fixedPairs.length > 0 && numResting >= 2) {
    let needed = numResting;
    const fixedMap = new Map();
    for (const [a, b] of fixedPairs) { fixedMap.set(a, b); fixedMap.set(b, a); }
    for (const p of state.restQueue) {
      if (resting.includes(p)) continue;
      const partner = fixedMap.get(p);
      if (partner) {
        if (needed >= 2) { resting.push(p, partner); needed -= 2; }
      } else if (needed > 0) {
        resting.push(p); needed -= 1;
      }
      if (needed <= 0) break;
    }
    playing = activeplayers.filter(p => !resting.includes(p));
  } else {
    resting = state.restQueue.slice(0, numResting);
    playing = activeplayers
      .filter(p => !resting.includes(p))
      .slice(0, playersPerRound);
  }

  // ── Update reachable pairs ──
  if (!state.reachablePairs) state.reachablePairs = new Set();
  for (let i = 0; i < playing.length; i++)
    for (let j = i + 1; j < playing.length; j++)
      state.reachablePairs.add(_pairKey(playing[i], playing[j]));

  // ── Cycle reset check ──
  _checkCycleReset(state.pairHistory, state.reachablePairs);

  // ── Fixed pairs this round ──
  const playingSet = new Set(playing);
  const fixedPairsThisRound = (fixedPairs || []).filter(
    ([a, b]) => playingSet.has(a) && playingSet.has(b)
  );
  const fixedPlayers    = new Set(fixedPairsThisRound.flat());
  const freePlayers     = playing.filter(p => !fixedPlayers.has(p));
  const freePairsNeeded = (numCourts * 2) - fixedPairsThisRound.length;

  // ── Step 1: Select pairs ──
  const freePairs = _selectPairs(
    freePlayers,
    freePairsNeeded,
    state.pairHistory,
    state.opponentMap
  );

  const allPairs = [...fixedPairsThisRound, ...freePairs];

  // ── Step 2: Rebalance courts ──
  const rebalanced = _rebalanceCourts(allPairs, numCourts);

  // ── Build games ──
  let finalGames;
  if (rebalanced && rebalanced.length === numCourts) {
    finalGames = rebalanced.map((g, c) => ({
      court: c + 1,
      pair1: g[0],
      pair2: g[1],
    }));
  } else {
    // Sequential fallback
    finalGames = [];
    for (let i = 0; i + 1 < allPairs.length && finalGames.length < numCourts; i += 2) {
      finalGames.push({ court: finalGames.length + 1, pair1: allPairs[i], pair2: allPairs[i + 1] });
    }
  }

  // ── Resting display ──
  const restingWithCount = resting.map(p => `${p}#${(restCount.get(p) || 0) + 1}`);

  state.roundIndex = (state.roundIndex || 0) + 1;

  return {
    round:   state.roundIndex,
    resting: restingWithCount,
    playing,
    games:   finalGames,
  };
}


// ── Compatibility shim ────────────────────────────────────────
function createSortedKey(a, b) { return _pairKey(a, b); }


// ── Points helpers (used by toggleRound after each round) ──────

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
