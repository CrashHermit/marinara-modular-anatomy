import {
  applyStatus,
  changePermanentPart,
} from './anatomy.js';
import type {
  Anatomy,
  AttributeOperation,
  GameTime,
  TemporaryStatus,
} from './model.js';
import { toGameMinutes } from './time.js';

type PermanentEffectLifetime = {
  readonly kind: 'permanent';
};

type TemporaryEffectLifetime = {
  readonly kind: 'temporary';
  readonly duration_minutes: number;
};

export interface AnatomyEffectBase {
  readonly effect_id: string;
  readonly name: string;
  readonly description: string;
  readonly eligible_part_ids: readonly string[];
  readonly operations: readonly AttributeOperation[];
}

export interface PermanentAnatomyEffectDefinition extends AnatomyEffectBase {
  readonly lifetime: PermanentEffectLifetime;
}

export interface TemporaryAnatomyEffectDefinition extends AnatomyEffectBase {
  readonly lifetime: TemporaryEffectLifetime;
}

export type AnatomyEffectDefinition =
  | PermanentAnatomyEffectDefinition
  | TemporaryAnatomyEffectDefinition;

export interface TemporaryEffectApplicationContext {
  readonly kind: 'temporary';
  readonly now: GameTime;
  readonly status_id: string;
}

export function applyAnatomyEffect(
  anatomy: Anatomy,
  definition: PermanentAnatomyEffectDefinition,
  part_id: string,
): Anatomy;
export function applyAnatomyEffect(
  anatomy: Anatomy,
  definition: TemporaryAnatomyEffectDefinition,
  part_id: string,
  context: TemporaryEffectApplicationContext,
): Anatomy;
export function applyAnatomyEffect(
  anatomy: Anatomy,
  definition: AnatomyEffectDefinition,
  part_id: string,
  context?: TemporaryEffectApplicationContext,
): Anatomy {
  if (definition.lifetime.kind === 'permanent') {
    return changePermanentPart(anatomy, part_id, definition.operations);
  }

  const status: TemporaryStatus = {
    status_id: context!.status_id,
    part_id,
    starts_at: context!.now,
    expires_at: addGameMinutes(context!.now, definition.lifetime.duration_minutes),
    operations: definition.operations,
  };
  return applyStatus(anatomy, status);
}

function addGameMinutes(now: GameTime, duration_minutes: number): GameTime {
  const total = toGameMinutes(now) + duration_minutes;
  const day = Math.floor(total / 1440) + 1;
  const day_minutes = total % 1440;
  return {
    day,
    hour: Math.floor(day_minutes / 60),
    minute: day_minutes % 60,
  };
}
