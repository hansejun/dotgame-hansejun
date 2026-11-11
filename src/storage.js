const scoreKey = 'dotgame.bestScore';

function validScore(score) {
  return Number.isSafeInteger(score) && score >= 0 && score <= 4350;
}

export function createBestScoreStore(getStorage = () => globalThis.localStorage) {
  let best = 0;
  try {
    const stored = getStorage().getItem(scoreKey);
    if (typeof stored === 'string' && /^(0|[1-9][0-9]*)$/.test(stored) && validScore(Number(stored))) {
      best = Number(stored);
    }
  } catch {
    // Storage can be denied; the current tab still keeps its best score.
  }
  return {
    get value() { return best; },
    record(score) {
      if (!validScore(score) || score <= best) return best;
      best = score;
      try {
        getStorage().setItem(scoreKey, String(best));
      } catch {
        // Retain the in-memory record without retrying the same result.
      }
      return best;
    },
  };
}
