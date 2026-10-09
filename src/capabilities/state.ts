import type { Anatomy, BodyPart, GameTime } from '../model.js';
import { resolveAnatomy } from '../anatomy.js';
import { toGameMinutes } from '../time.js';
import type { CapabilityState, PartCapability } from './model.js';
import { resolveCapabilities } from './resolve.js';

export function createCapabilityState(): CapabilityState {
  return {
    definitions: [],
    materials: [],
    reservoir_quantities: {},
    last_evaluated_at: null,
    installed_bundle_ids: [],
  };
}

export function replaceCapability(state: CapabilityState, definition: PartCapability): CapabilityState {
  const definitions = [...state.definitions];
  const existingIndex = definitions.findIndex((candidate) => candidate.capability_id === definition.capability_id);
  const quantities = { ...state.reservoir_quantities };
  if (existingIndex < 0) {
    definitions.push(structuredClone(definition));
    if (definition.type === 'reservoir') quantities[definition.capability_id] ??= 0;
  } else {
    definitions[existingIndex] = structuredClone(definition);
  }
  return {
    ...state,
    definitions,
    reservoir_quantities: quantities,
  };
}

export function advanceCapabilities(anatomy: Anatomy, state: CapabilityState, now: GameTime): CapabilityState {
  const currentMinutes = toGameMinutes(now);
  if (state.last_evaluated_at === null) {
    return { ...state, reservoir_quantities: { ...state.reservoir_quantities }, last_evaluated_at: structuredClone(now) };
  }
  const previousMinutes = toGameMinutes(state.last_evaluated_at);
  if (currentMinutes === previousMinutes) return state;
  const boundaries = new Set<number>([previousMinutes, currentMinutes]);
  for (const status of anatomy.statuses) {
    const start = toGameMinutes(status.starts_at);
    if (start > previousMinutes && start < currentMinutes) boundaries.add(start);
    if (status.expires_at !== null) {
      const expiry = toGameMinutes(status.expires_at);
      if (expiry > previousMinutes && expiry < currentMinutes) boundaries.add(expiry);
    }
  }
  const orderedBoundaries = [...boundaries].sort((left, right) => left - right);
  const quantities = { ...state.reservoir_quantities };
  for (let index = 0; index < orderedBoundaries.length - 1; index += 1) {
    const segmentStart = orderedBoundaries[index] as number;
    const segmentEnd = orderedBoundaries[index + 1] as number;
    const elapsedMinutes = segmentEnd - segmentStart;
    const parts = resolveAnatomy(anatomy, fromGameMinutes(segmentStart));
    settleSegment(state, parts, quantities, elapsedMinutes);
  }
  return {
    ...state,
    reservoir_quantities: quantities,
    last_evaluated_at: structuredClone(now),
  };
}

function settleSegment(
  state: CapabilityState,
  parts: readonly BodyPart[],
  quantities: Record<string, number>,
  elapsedMinutes: number,
): void {
  const resolved = resolveCapabilities(state.definitions, parts);
  const reservoirs = new Map(resolved.filter((capability) => capability.type === 'reservoir').map((capability) => [capability.capability_id, capability]));
  const rates = new Map<string, number>();
  for (const producer of resolved) {
    if (producer.type !== 'producer') continue;
    rates.set(producer.destination_reservoir_id, (rates.get(producer.destination_reservoir_id) ?? 0) + producer.rate_per_minute);
  }
  for (const [reservoirId, reservoir] of reservoirs) {
    const quantity = quantities[reservoirId] ?? 0;
    const remaining = reservoir.capacity - quantity;
    if (remaining <= 0) continue;
    const produced = (rates.get(reservoirId) ?? 0) * elapsedMinutes;
    quantities[reservoirId] = quantity + Math.min(remaining, produced);
  }
}

function fromGameMinutes(minutes: number): GameTime {
  const dayMinutes = 24 * 60;
  const day = Math.floor(minutes / dayMinutes) + 1;
  const withinDay = minutes % dayMinutes;
  return {
    day,
    hour: Math.floor(withinDay / 60),
    minute: withinDay % 60,
  };
}
