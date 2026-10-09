import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  applyAnatomyEffect,
  changePermanentPart,
  createAnatomy,
  resolveAnatomy,
  type Anatomy,
  type AnatomyEffectDefinition,
  type AnatomyTemplate,
  type BodyPart,
  type GameTime,
  type PermanentAnatomyEffectDefinition,
  type TemporaryAnatomyEffectDefinition,
} from '../src/index.js';
import datasetJson from '../data/humanoid-basic.json' with { type: 'json' };

const dataset = datasetJson as AnatomyTemplate;
const at = (anatomy: Anatomy, part_id: string, now: GameTime): BodyPart =>
  resolveAnatomy(anatomy, now).find((part) => part.part_id === part_id) as BodyPart;
const temporary = (
  effect_id: string,
  operations: AnatomyEffectDefinition['operations'],
  duration_minutes = 120,
): TemporaryAnatomyEffectDefinition => ({
  effect_id,
  name: effect_id,
  description: effect_id,
  eligible_part_ids: ['arm.left', 'arm.right'],
  operations,
  lifetime: { kind: 'temporary', duration_minutes },
});

const permanent = (
  effect_id: string,
  operations: AnatomyEffectDefinition['operations'],
): PermanentAnatomyEffectDefinition => ({
  effect_id,
  name: effect_id,
  description: effect_id,
  eligible_part_ids: ['arm.left', 'arm.right'],
  operations,
  lifetime: { kind: 'permanent' },
});

test('effects resolve at inclusive start and exclusive expiry, including day rollover', () => {
  const anatomy = applyAnatomyEffect(
    createAnatomy(dataset.parts),
    temporary('overnight-growth', [{ field: 'geometry.length', op: 'add', value: 3 }], 20),
    'arm.left',
    { kind: 'temporary', now: { day: 1, hour: 23, minute: 50 }, status_id: 'overnight-growth-1' },
  );
  assert.equal(at(anatomy, 'arm.left', { day: 1, hour: 23, minute: 50 }).attributes.geometry.length, 63);
  assert.equal(at(anatomy, 'arm.left', { day: 2, hour: 0, minute: 9 }).attributes.geometry.length, 63);
  assert.equal(at(anatomy, 'arm.left', { day: 2, hour: 0, minute: 10 }).attributes.geometry.length, 60);
});

test('permanent edits change the baseline beneath an active effect', () => {
  let anatomy = applyAnatomyEffect(
    createAnatomy(dataset.parts),
    temporary('growth', [{ field: 'geometry.length', op: 'add', value: 3 }]),
    'arm.left',
    { kind: 'temporary', now: { day: 1, hour: 8, minute: 0 }, status_id: 'growth-1' },
  );
  anatomy = applyAnatomyEffect(
    anatomy,
    permanent('composition', [
      { field: 'composition.muscle', op: 'set', value: 0.45 },
      { field: 'composition.fat', op: 'set', value: 0.25 },
    ]),
    'arm.left',
  );
  assert.equal(at(anatomy, 'arm.left', { day: 1, hour: 9, minute: 59 }).attributes.geometry.length, 63);
  assert.equal(at(anatomy, 'arm.left', { day: 1, hour: 10, minute: 0 }).attributes.geometry.length, 60);
  assert.equal(at(anatomy, 'arm.left', { day: 1, hour: 10, minute: 0 }).attributes.composition.muscle, 0.45);
});

test('overlapping effects apply in authored insertion order', () => {
  let anatomy = createAnatomy(dataset.parts);
  anatomy = applyAnatomyEffect(
    anatomy,
    temporary('first', [{ field: 'geometry.length', op: 'add', value: 3 }]),
    'arm.left',
    { kind: 'temporary', now: { day: 1, hour: 8, minute: 0 }, status_id: 'first-1' },
  );
  anatomy = applyAnatomyEffect(
    anatomy,
    temporary('second', [{ field: 'geometry.length', op: 'multiply', value: 2 }]),
    'arm.left',
    { kind: 'temporary', now: { day: 1, hour: 8, minute: 0 }, status_id: 'second-1' },
  );
  assert.equal(at(anatomy, 'arm.left', { day: 1, hour: 9, minute: 0 }).attributes.geometry.length, 126);
});

test('composition recipes preserve unrelated authored components', () => {
  const anatomy = applyAnatomyEffect(
    createAnatomy(dataset.parts),
    permanent('composition', [
      { field: 'composition.muscle', op: 'set', value: 0.45 },
      { field: 'composition.fat', op: 'set', value: 0.25 },
    ]),
    'arm.left',
  );
  assert.deepEqual(at(anatomy, 'arm.left', { day: 1, hour: 8, minute: 0 }).attributes.composition, {
    bone: 0.2,
    muscle: 0.45,
    fat: 0.25,
    other_soft_tissue: 0.1,
  });
});

test('different targets and returned anatomy values remain isolated', () => {
  const original = createAnatomy(dataset.parts);
  const changed = applyAnatomyEffect(
    original,
    permanent('width', [{ field: 'geometry.width', op: 'set', value: 20 }]),
    'arm.left',
  );
  const changedPart = at(changed, 'arm.left', { day: 1, hour: 8, minute: 0 }) as { attributes: { geometry: { width: number } } };
  changedPart.attributes.geometry.width = 99;
  assert.equal(at(original, 'arm.left', { day: 1, hour: 8, minute: 0 }).attributes.geometry.width, 10);
  assert.equal(at(changed, 'arm.right', { day: 1, hour: 8, minute: 0 }).attributes.geometry.width, 10);

  const edited = changePermanentPart(original, 'arm.right', [{ field: 'geometry.width', op: 'set', value: 18 }]);
  assert.equal(at(original, 'arm.right', { day: 1, hour: 8, minute: 0 }).attributes.geometry.width, 10);
  assert.equal(at(edited, 'arm.right', { day: 1, hour: 8, minute: 0 }).attributes.geometry.width, 18);
});
