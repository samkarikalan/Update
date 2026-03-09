// ============================================================
//  competitive_algorithm.js  —  Rating-Balanced Round
//
//  Strategy:
//    1. Sort active players by rating (high to low)
//    2. Snake-pair top half with bottom half so each pair
//       has one stronger + one weaker player
//    3. Match pairs into courts by similar combined rating
//       so each court has two evenly matched teams
//    4. Run 500 random attempts, pick best by:
//         - fewest pair repeats  (penalty 1000 per repeat)
//         - smallest team rating difference  (balance)
//    5. Pair history read from ALL rounds (no reset)
// ============================================================


// ---- Utility -----------------------------------------------

function rbr_sortedKey(a, b) {
  return a < b ? a + '&' + b : b + '&' + a;
}

function rbr_buildPairHistory(rounds) {
  const hist = new Map();
  for (const round of rounds) {
    if (!round || !round.games) continue;
    for (const game of round.games) {
      const t1 = game.pair1;
      const t2 = game.pair2;
      if (!t1 || !t2) continue;
      const k1 = rbr_sortedKey(t1[0], t1[1]);
      const k2 = rbr_sortedKey(t2[0], t2[1]);
      hist.set(k1, (hist.get(k1) || 0) + 1);
      hist.set(k2, (hist.get(k2) || 0) + 1);
    }
  }
  return hist;
}

function rbr_shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}


// ---- Rest selection ----------------------------------------

function rbr_chooseResting(state) {
  const total    = state.activeplayers.length;
  const perRound = (state.numCourts || state.courts || 3) * 4;
  const need     = total - perRound;

  if (need <= 0) {
    return { playing: [...state.activeplayers], resting: [] };
  }

  if (!state.restQueue || state.restQueue.length !== total) {
    state.restQueue = [...state.activeplayers];
  }

  const resting = state.restQueue.slice(0, need);
  const playing = state.activeplayers.filter(p => !resting.includes(p));
  state.restQueue = [...state.restQueue.slice(need), ...state.restQueue.slice(0, need)];

  return { playing, resting };
}


// ---- Scoring -----------------------------------------------

function rbr_scoreGames(games, ratings, pairHist) {
  let score = 0;
  for (const g of games) {
    const k1 = rbr_sortedKey(g.pair1[0], g.pair1[1]);
    const k2 = rbr_sortedKey(g.pair2[0], g.pair2[1]);
    score += (pairHist.get(k1) || 0) * 1000;
    score += (pairHist.get(k2) || 0) * 1000;
    const r1 = (ratings[g.pair1[0]] || 2) + (ratings[g.pair1[1]] || 2);
    const r2 = (ratings[g.pair2[0]] || 2) + (ratings[g.pair2[1]] || 2);
    score += Math.abs(r1 - r2);
  }
  return score;
}


// ---- Candidate generator -----------------------------------

function rbr_generateCandidate(playing, ratings, courts) {
  const n      = playing.length;
  const sorted = [...playing].sort((a, b) => (ratings[b] || 2) - (ratings[a] || 2));

  // Small perturbation for variety
  for (let i = 0; i < n - 1; i++) {
    if (Math.random() < 0.25) {
      const tmp = sorted[i]; sorted[i] = sorted[i + 1]; sorted[i + 1] = tmp;
    }
  }

  // Snake-pair top half with shuffled bottom half
  const top = sorted.slice(0, n / 2);
  const bot = rbr_shuffle(sorted.slice(n / 2));
  const pairs = top.map((p, i) => [p, bot[i]]);

  // Sort pairs by combined rating desc, then match adjacent into courts
  pairs.sort((a, b) =>
    ((ratings[b[0]] || 2) + (ratings[b[1]] || 2)) -
    ((ratings[a[0]] || 2) + (ratings[a[1]] || 2))
  );

  const games = [];
  for (let c = 0; c < courts; c++) {
    games.push({
      court: c + 1,
      pair1: [...pairs[c * 2]],
      pair2: [...pairs[c * 2 + 1]],
    });
  }
  return games;
}


// ---- Best game finder --------------------------------------

function rbr_findBestGames(playing, ratings, courts, pairHist) {
  let bestGames = null;
  let bestScore = Infinity;

  for (let i = 0; i < 500; i++) {
    const candidate = rbr_generateCandidate(playing, ratings, courts);
    const score     = rbr_scoreGames(candidate, ratings, pairHist);
    if (score < bestScore) {
      bestScore = score;
      bestGames = candidate;
    }
    if (bestScore < 1.0) break;
  }

  return bestGames;
}


// ---- Rating map --------------------------------------------

function rbr_getRatings(state) {
  const ratings = {};
  const src = state.playerRatings || state.historyPlayers || [];
  for (const p of src) {
    const name   = typeof p === 'string' ? p : (p.name || p.displayName || '');
    const rating = parseFloat(p.rating) || 2.0;
    if (name) ratings[name] = rating;
  }
  for (const p of (state.activeplayers || [])) {
    if (!ratings[p]) ratings[p] = 2.0;
  }
  return ratings;
}


// ---- Rest count for display --------------------------------

function rbr_getRestCounts(rounds) {
  const counts = {};
  for (const round of rounds) {
    if (!round || !round.resting) continue;
    for (const entry of round.resting) {
      const name = typeof entry === 'string' ? entry.split('#')[0] : String(entry);
      counts[name] = (counts[name] || 0) + 1;
    }
  }
  return counts;
}


// ---- Main entry point --------------------------------------

function CompetitiveRound(schedulerState) {

  const courts               = schedulerState.numCourts || schedulerState.courts || 3;
  const { playing, resting } = rbr_chooseResting(schedulerState);
  const ratings              = rbr_getRatings(schedulerState);
  const pairHist             = rbr_buildPairHistory(allRounds);
  const games                = rbr_findBestGames(playing, ratings, courts, pairHist);

  const prevCounts  = rbr_getRestCounts(allRounds);
  const restingList = resting.map(p => `${p}#${(prevCounts[p] || 0) + 1}`);

  schedulerState.roundIndex = (schedulerState.roundIndex || 0) + 1;

  return {
    round:   schedulerState.roundIndex,
    games,
    resting: restingList,
  };
}
