/** Each +25 weight doubles the odds of being drawn; weight 0 is baseline (1x). */
export function weightMultiplier(weight: number): number {
  return Math.pow(2, weight / 25);
}

/**
 * Weighted shuffle (roulette-wheel, without replacement): repeatedly draws from the remaining
 * pool proportional to each item's multiplier. Produces a full permutation biased by weight,
 * so the slideshow can just walk an index through the result — no re-rolling on every advance.
 */
export function weightedShuffle<T>(items: T[], weightOf: (item: T) => number): T[] {
  const pool = items.map((item) => ({ item, multiplier: weightMultiplier(weightOf(item)) }));
  const result: T[] = [];

  while (pool.length > 0) {
    const total = pool.reduce((sum, entry) => sum + entry.multiplier, 0);
    let draw = Math.random() * total;
    let chosenIndex = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      draw -= pool[i].multiplier;
      if (draw <= 0) {
        chosenIndex = i;
        break;
      }
    }
    result.push(pool[chosenIndex].item);
    pool.splice(chosenIndex, 1);
  }

  return result;
}
