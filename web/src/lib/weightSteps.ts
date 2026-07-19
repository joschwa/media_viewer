const MIN_WEIGHT = -100;
const MAX_WEIGHT = 100;

/** Non-linear step: big jumps near baseline, fine control at the extremes. */
export function stepForWeight(currentWeight: number): number {
  const abs = Math.abs(currentWeight);
  if (abs < 10) return 10;
  if (abs < 30) return 5;
  if (abs < 60) return 2;
  return 1;
}

export function bumpWeight(current: number, direction: 1 | -1): number {
  const step = stepForWeight(current);
  return Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, current + direction * step));
}

export function clampWeight(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, Math.round(value)));
}
