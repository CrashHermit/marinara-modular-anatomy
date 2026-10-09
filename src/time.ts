import type { GameTime } from './model.js';

export function toGameMinutes(time: GameTime): number {
  return (time.day - 1) * 24 * 60 + time.hour * 60 + time.minute;
}
