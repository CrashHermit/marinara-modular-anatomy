import { readFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  applyStatus,
  changePermanentPart,
  createAnatomy,
  removeStatus,
  resolveAnatomy,
  type Anatomy,
  type AttributeOperation,
  type BodyDataset,
  type BodyPart,
  type GameTime,
  type TemporaryStatus,
} from '../src/index.js';

const dataset = JSON.parse(await readFile(new URL('../../data/humanoid-basic.json', import.meta.url), 'utf8')) as BodyDataset;
const at = (anatomy: Anatomy, part_id: string, now: GameTime): BodyPart =>
  resolveAnatomy(anatomy, now).find((part) => part.part_id === part_id) as BodyPart;
const status = (
  status_id: string,
  part_id: string,
  starts_at: GameTime,
  expires_at: GameTime | null,
  operations: readonly AttributeOperation[],
): TemporaryStatus => ({ status_id, part_id, starts_at, expires_at, operations });
const armFixture = (): Anatomy => createAnatomy(dataset.parts);

const start = { day: 1, hour: 8, minute: 0 };
const active = { day: 1, hour: 9, minute: 0 };
const end = { day: 1, hour: 10, minute: 0 };

test('creation isolates instances and preserves the template', () => {
  const first = changePermanentPart(armFixture(), 'arm.left', [{ field: 'geometry.length', op: 'set', value: 70 }]);
  const second = armFixture();
  assert.equal(at(first, 'arm.left', active).attributes.geometry.length, 70);
  assert.equal(at(second, 'arm.left', active).attributes.geometry.length, 60);
  assert.equal(dataset.parts.find((part) => part.part_id === 'arm.left')?.attributes.geometry.length, 60);
});

test('operations compose in application order and target only one part', () => {
  let anatomy = armFixture();
  anatomy = applyStatus(anatomy, status('relative', 'arm.left', start, end, [
    { field: 'geometry.length', op: 'add', value: 3 },
    { field: 'geometry.length', op: 'subtract', value: 1 },
  ]));
  assert.equal(at(anatomy, 'arm.left', active).attributes.geometry.length, 62);
  assert.equal(at(anatomy, 'arm.right', active).attributes.geometry.length, 60);

  const addThenSet = applyStatus(armFixture(), status('ordered', 'arm.left', start, end, [
    { field: 'geometry.length', op: 'add', value: 3 },
    { field: 'geometry.length', op: 'set', value: 30 },
  ]));
  assert.equal(at(addThenSet, 'arm.left', active).attributes.geometry.length, 30);

  const setThenAdd = applyStatus(armFixture(), status('ordered', 'arm.left', start, end, [
    { field: 'geometry.length', op: 'set', value: 30 },
    { field: 'geometry.length', op: 'add', value: 3 },
  ]));
  assert.equal(at(setThenAdd, 'arm.left', active).attributes.geometry.length, 33);

  const multiply = applyStatus(armFixture(), status('ordered', 'arm.left', start, end, [
    { field: 'geometry.length', op: 'add', value: 3 },
    { field: 'geometry.length', op: 'multiply', value: 2 },
  ]));
  assert.equal(at(multiply, 'arm.left', active).attributes.geometry.length, 126);
});

test('status intervals include the start and exclude the expiration across midnight', () => {
  const anatomy = applyStatus(armFixture(), status('overnight', 'arm.left', { day: 1, hour: 23, minute: 50 }, { day: 2, hour: 0, minute: 10 }, [
    { field: 'geometry.length', op: 'add', value: 3 },
  ]));
  assert.equal(at(anatomy, 'arm.left', { day: 1, hour: 23, minute: 49 }).attributes.geometry.length, 60);
  assert.equal(at(anatomy, 'arm.left', { day: 1, hour: 23, minute: 50 }).attributes.geometry.length, 63);
  assert.equal(at(anatomy, 'arm.left', { day: 2, hour: 0, minute: 9 }).attributes.geometry.length, 63);
  assert.equal(at(anatomy, 'arm.left', { day: 2, hour: 0, minute: 10 }).attributes.geometry.length, 60);
});

test('resolution is repeatable and reevaluates earlier or later supplied times', () => {
  const anatomy = applyStatus(armFixture(), status('repeatable', 'arm.left', start, end, [
    { field: 'geometry.length', op: 'add', value: 3 },
  ]));
  assert.equal(at(anatomy, 'arm.left', active).attributes.geometry.length, 63);
  assert.equal(at(anatomy, 'arm.left', active).attributes.geometry.length, 63);
  assert.equal(at(anatomy, 'arm.left', { day: 1, hour: 11, minute: 0 }).attributes.geometry.length, 60);
  assert.equal(at(anatomy, 'arm.left', active).attributes.geometry.length, 63);
});

test('removal and expiration reveal remaining effects and the current baseline', () => {
  let anatomy = armFixture();
  anatomy = applyStatus(anatomy, status('relative', 'arm.left', start, null, [{ field: 'geometry.length', op: 'add', value: 3 }]));
  anatomy = applyStatus(anatomy, status('override', 'arm.left', start, end, [{ field: 'geometry.length', op: 'set', value: 30 }]));
  assert.equal(at(anatomy, 'arm.left', active).attributes.geometry.length, 30);
  assert.equal(at(anatomy, 'arm.left', end).attributes.geometry.length, 63);
  anatomy = removeStatus(anatomy, 'relative');
  assert.equal(at(anatomy, 'arm.left', active).attributes.geometry.length, 30);
  assert.equal(at(anatomy, 'arm.left', end).attributes.geometry.length, 60);
});

test('permanent edits coexist with active relative and absolute effects', () => {
  let anatomy = armFixture();
  anatomy = applyStatus(anatomy, status('relative', 'arm.left', start, null, [{ field: 'geometry.length', op: 'add', value: 3 }]));
  anatomy = applyStatus(anatomy, status('absolute', 'arm.left', start, end, [{ field: 'geometry.length', op: 'set', value: 30 }]));
  anatomy = changePermanentPart(anatomy, 'arm.left', [{ field: 'geometry.length', op: 'set', value: 62 }]);
  assert.equal(at(anatomy, 'arm.left', active).attributes.geometry.length, 30);
  assert.equal(at(anatomy, 'arm.left', end).attributes.geometry.length, 65);
});

test('permanent and temporary operations cover every supported physical attribute', () => {
  let anatomy = armFixture();
  anatomy = changePermanentPart(anatomy, 'arm.left', [
    { field: 'geometry.length', op: 'set', value: 61 },
    { field: 'geometry.width', op: 'add', value: 1 },
    { field: 'geometry.depth', op: 'multiply', value: 1.1 },
    { field: 'geometry.shape', op: 'set', value: 'rounded' },
    { field: 'composition.muscle', op: 'subtract', value: 0.1 },
    { field: 'composition.fat', op: 'add', value: 0.1 },
    { field: 'mechanics.stiffness', op: 'set', value: 0.6 },
    { field: 'surface.coverings', op: 'set', value: ['skin', 'fur'] },
    { field: 'surface.color', op: 'set', value: '#111111' },
    { field: 'surface.texture', op: 'set', value: 'coarse' },
    { field: 'surface.markings', op: 'set', value: ['stripe'] },
    { field: 'functions', op: 'set', value: ['locomotion'] },
  ]);
  const permanent = at(anatomy, 'arm.left', active);
  assert.deepEqual(permanent.attributes.geometry, { length: 61, width: 11, depth: 11, shape: 'rounded' });
  assert.ok(Math.abs(permanent.attributes.composition.muscle! - 0.45) < 1e-12);
  assert.ok(Math.abs(permanent.attributes.composition.fat! - 0.25) < 1e-12);
  assert.equal(permanent.attributes.mechanics.stiffness, 0.6);
  assert.deepEqual(permanent.attributes.surface, { coverings: ['skin', 'fur'], color: '#111111', texture: 'coarse', markings: ['stripe'] });
  assert.deepEqual(permanent.attributes.functions, ['locomotion']);

  anatomy = applyStatus(anatomy, status('overlay', 'arm.left', start, end, [
    { field: 'geometry.length', op: 'add', value: 3 },
    { field: 'geometry.width', op: 'set', value: 20 },
    { field: 'geometry.depth', op: 'subtract', value: 1 },
    { field: 'geometry.shape', op: 'set', value: 'scaled_round' },
    { field: 'composition.muscle', op: 'subtract', value: 0.05 },
    { field: 'composition.fat', op: 'add', value: 0.05 },
    { field: 'mechanics.stiffness', op: 'multiply', value: 1.5 },
    { field: 'surface.coverings', op: 'set', value: ['skin', 'scales'] },
    { field: 'surface.color', op: 'set', value: '#222222' },
    { field: 'surface.texture', op: 'set', value: 'ridged' },
    { field: 'surface.markings', op: 'set', value: ['spot'] },
    { field: 'functions', op: 'set', value: ['manipulation'] },
  ]));
  const effective = at(anatomy, 'arm.left', active);
  assert.equal(effective.attributes.geometry.length, 64);
  assert.equal(effective.attributes.geometry.width, 20);
  assert.equal(effective.attributes.geometry.depth, 10);
  assert.equal(effective.attributes.geometry.shape, 'scaled_round');
  assert.ok(Math.abs(effective.attributes.composition.muscle! - 0.4) < 1e-12);
  assert.ok(Math.abs(effective.attributes.composition.fat! - 0.3) < 1e-12);
  assert.ok(Math.abs(effective.attributes.mechanics.stiffness - 0.9) < 1e-12);
  assert.deepEqual(effective.attributes.surface.coverings, ['skin', 'scales']);
  assert.deepEqual(effective.attributes.functions, ['manipulation']);
  anatomy = applyStatus(anatomy, status('composition-replacement', 'arm.left', { day: 1, hour: 11, minute: 0 }, { day: 1, hour: 12, minute: 0 }, [
    { field: 'composition', op: 'set', value: { muscle: 0.5, fat: 0.4, crystal: 0.1 } },
  ]));
  assert.deepEqual(at(anatomy, 'arm.left', { day: 1, hour: 11, minute: 0 }).attributes.composition, { muscle: 0.5, fat: 0.4, crystal: 0.1 });
  assert.ok(Math.abs(at(anatomy, 'arm.left', end).attributes.composition.muscle! - 0.45) < 1e-12);
  assert.ok(Math.abs(at(anatomy, 'arm.left', end).attributes.composition.fat! - 0.25) < 1e-12);
  assert.equal(dataset.parts.find((part) => part.part_id === 'arm.left')?.attributes.composition.muscle, 0.55);
});

test('JSON round trips preserve ordered statuses and effective output', () => {
  let anatomy = armFixture();
  anatomy = applyStatus(anatomy, status('first', 'arm.left', start, end, [{ field: 'geometry.length', op: 'add', value: 3 }]));
  anatomy = applyStatus(anatomy, status('second', 'arm.left', start, end, [{ field: 'geometry.length', op: 'multiply', value: 2 }]));
  const parsed = JSON.parse(JSON.stringify(anatomy)) as Anatomy;
  assert.deepEqual(parsed, anatomy);
  assert.deepEqual(resolveAnatomy(parsed, active), resolveAnatomy(anatomy, active));
});

test('returned projections and copied statuses do not alias source data', () => {
  let anatomy = armFixture();
  const sourceStatus = status('copy', 'arm.left', start, end, [
    { field: 'surface.coverings', op: 'set', value: ['skin', 'scales'] },
    { field: 'surface.markings', op: 'set', value: ['dot'] },
    { field: 'composition', op: 'set', value: { bone: 0.2, muscle: 0.55, fat: 0.15, other_soft_tissue: 0.1 } },
  ]);
  anatomy = applyStatus(anatomy, sourceStatus);
  const projectedArm = resolveAnatomy(anatomy, active).find((part) => part.part_id === 'arm.left') as unknown as {
    attributes: {
      surface: { coverings: string[]; markings: string[] };
      composition: Record<string, number>;
    };
  };
  projectedArm.attributes.surface.coverings.push('fur');
  projectedArm.attributes.surface.markings.push('stripe');
  projectedArm.attributes.composition.muscle = 0.1;
  assert.deepEqual(at(anatomy, 'arm.left', active).attributes.surface.coverings, ['skin', 'scales']);
  assert.deepEqual(at(anatomy, 'arm.left', active).attributes.surface.markings, ['dot']);
  assert.equal(at(anatomy, 'arm.left', active).attributes.composition.muscle, 0.55);
  (sourceStatus.operations[0]?.value as string[]).push('fur');
  assert.deepEqual((anatomy.statuses[0]?.operations[0]?.value as readonly string[]), ['skin', 'scales']);
});
