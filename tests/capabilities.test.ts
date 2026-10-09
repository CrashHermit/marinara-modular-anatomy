import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  advanceCapabilities,
  applyStatus,
  createAnatomy,
  createCapabilityState,
  installCapabilityBundle,
  resolveCapabilities,
  resolveSensor,
  type Anatomy,
  type BodyPart,
  type CapabilityBundle,
  type PartCapability,
} from '../src/index.js';
import bundleJson from '../data/capability-demo.json' with { type: 'json' };

const part = (part_id: string, length = 4): BodyPart => ({
  part_id,
  parent_id: null,
  placement: null,
  name: part_id,
  attributes: {
    geometry: { length, width: 3, depth: 2, shape: 'test' },
    composition: { other_soft_tissue: 1 },
    mechanics: { stiffness: 0.5 },
    surface: { coverings: ['tissue'], color: '#000000', texture: 'smooth', markings: [] },
    functions: [],
  },
});

const reservoir = (id = 'reservoir', part_id = 'organ'): PartCapability => ({
  capability_id: id,
  part_id,
  name: id,
  type: 'reservoir',
  properties: { volume_factor: 0.5, material_id: 'fluid', capacity_units_per_cm3: 0.5 },
});

const producer = (id = 'producer', part_id = 'organ', destination_reservoir_id = 'reservoir'): PartCapability => ({
  capability_id: id,
  part_id,
  name: id,
  type: 'producer',
  properties: { volume_factor: 0.5, material_id: 'fluid', destination_reservoir_id, rate_units_per_cm3_per_minute: 0.001 },
});

const stateWith = (definitions: readonly PartCapability[]) => ({
  ...createCapabilityState(),
  definitions,
  materials: [{ material_id: 'fluid', name: 'Fluid', unit: 'ml' }],
});

const at = (day: number, hour: number, minute: number) => ({ day, hour, minute });
const quantity = (state: ReturnType<typeof createCapabilityState>, id = 'reservoir') => state.reservoir_quantities[id] ?? 0;

function doubleLengthStatus(starts_at = at(1, 8, 30), expires_at = at(1, 9, 30)) {
  return {
    status_id: 'double-length',
    part_id: 'organ',
    starts_at,
    expires_at,
    operations: [{ field: 'geometry.length' as const, op: 'multiply' as const, value: 2 }],
  };
}

test('capability derivation supports multiple components and geometry-derived values', () => {
  const definitions = [
    { capability_id: 'hand.manipulator', part_id: 'hand', name: 'Hand', type: 'manipulator' as const, properties: { volume_factor: 1, precision: 0.8, reach_per_cm: 1, grip_units_per_cm3: 0.001 } },
    reservoir('organ.reservoir'),
    producer('organ.producer', 'organ', 'organ.reservoir'),
  ];
  const resolved = resolveCapabilities(definitions, [part('hand'), part('organ')]);
  assert.equal(resolved[0]?.type, 'manipulator');
  assert.equal((resolved[0] as { volume_cm3: number }).volume_cm3, 24);
  assert.equal((resolved[0] as { reach_cm: number }).reach_cm, 4);
  assert.equal((resolved[0] as { grip_units: number }).grip_units, 0.024);
  assert.equal((resolved[1] as { type: string; capacity: number }).capacity, 6);
  assert.equal((resolved[2] as { type: string; rate_per_minute: number }).rate_per_minute, 0.012);
});

test('sensor capabilities map physical inputs to explicit semantic outputs', () => {
  const definition = {
    capability_id: 'organ.sensor',
    part_id: 'organ',
    name: 'Sensation',
    type: 'sensor' as const,
    properties: {
      inputs: [
        { channel: 'pressure', sensitivity: 0.8 },
        { channel: 'friction', sensitivity: 0.6 },
      ],
      outputs: [
        { channel: 'pleasure', gain: 0.9, input_channels: ['pressure', 'friction'] },
        { channel: 'pain', gain: 0.2, input_channels: ['pressure'] },
      ],
    },
  };
  const resolved = resolveCapabilities([definition], [part('organ')])[0];
  assert.equal(resolved?.type, 'sensor');
  assert.deepEqual(resolveSensor(definition, { pressure: 0.5, friction: 0.25 }), {
    inputs: { pressure: 0.5, friction: 0.25 },
    outputs: { pleasure: 0.49500000000000005, pain: 0.08000000000000002 },
  });
});

test('production anchors at first time and settles geometry status intervals exactly', () => {
  const anatomy = createAnatomy([part('organ')]);
  const baseState = stateWith([reservoir(), producer()]);
  const anchored = advanceCapabilities(anatomy, baseState, at(1, 8, 0));
  const settled = advanceCapabilities(applyStatus(anatomy, doubleLengthStatus()), anchored, at(1, 10, 0));
  assert.equal(quantity(anchored), 0);
  assert.ok(Math.abs(quantity(settled) - 2.16) < 1e-12);
  assert.deepEqual(advanceCapabilities(anatomy, settled, at(1, 10, 0)), settled);
});

test('single and incremental advances produce the same quantity across midnight', () => {
  const anatomy = createAnatomy([part('organ')]);
  const baseState = stateWith([reservoir(), producer()]);
  const start = advanceCapabilities(anatomy, baseState, at(1, 23, 50));
  const single = advanceCapabilities(anatomy, start, at(2, 0, 20));
  const split = advanceCapabilities(anatomy, start, at(1, 23, 55));
  const incremental = advanceCapabilities(anatomy, split, at(2, 0, 20));
  assert.ok(Math.abs(quantity(single) - 0.36) < 1e-12);
  assert.equal(quantity(single), quantity(incremental));
});

test('full reservoirs stop production and capacity shrink preserves contents', () => {
  const anatomy = createAnatomy([part('organ')]);
  const state = stateWith([reservoir(), producer()]);
  const anchored = advanceCapabilities(anatomy, state, at(1, 8, 0));
  const full = advanceCapabilities(anatomy, anchored, at(1, 20, 0));
  assert.equal(quantity(full), 6);
  const shrunken = advanceCapabilities(applyStatus(anatomy, {
    status_id: 'shrink',
    part_id: 'organ',
    starts_at: at(1, 20, 0),
    expires_at: null,
    operations: [{ field: 'geometry.length', op: 'set' as const, value: 1 }],
  }), full, at(1, 21, 0));
  assert.equal(quantity(shrunken), 6);
});

test('bundle installation is additive and idempotent', () => {
  const anatomy: Anatomy = {
    parts: [part('existing')],
    statuses: [],
  };
  const state = createCapabilityState();
  const bundle = bundleJson as CapabilityBundle;
  const installed = installCapabilityBundle(anatomy, state, bundle);
  assert.deepEqual(installed.anatomy.parts.map((candidate) => candidate.part_id), ['existing', 'organ.demo']);
  assert.deepEqual(installed.capabilities.installed_bundle_ids, ['basic-capabilities-demo']);
  assert.equal(installed.capabilities.reservoir_quantities['organ.demo.reservoir'], 0);
  const repeated = installCapabilityBundle(installed.anatomy, installed.capabilities, bundle);
  assert.deepEqual(repeated, installed);
});
