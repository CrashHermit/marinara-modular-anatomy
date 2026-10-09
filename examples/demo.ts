import { readFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';
import {
  applyStatus,
  changePermanentPart,
  createAnatomyFromTemplate,
  describeParts,
  resolveAnatomy,
  type Anatomy,
  type AnatomyTemplate,
  type GameTime,
  type TemporaryStatus,
} from '../src/index.js';

const datasetUrl = new URL('../../data/humanoid-basic.json', import.meta.url);
const dataset = JSON.parse(await readFile(datasetUrl, 'utf8')) as AnatomyTemplate;
const start: GameTime = { day: 1, hour: 8, minute: 0 };
const activeTime: GameTime = { day: 1, hour: 9, minute: 0 };
const end: GameTime = { day: 1, hour: 10, minute: 0 };

const growth: TemporaryStatus = {
  status_id: 'growth',
  part_id: 'arm.left',
  starts_at: start,
  expires_at: end,
  operations: [{ field: 'geometry.length', op: 'add', value: 3 }],
};
const scales: TemporaryStatus = {
  status_id: 'scales',
  part_id: 'arm.left',
  starts_at: start,
  expires_at: end,
  operations: [
    { field: 'surface.coverings', op: 'set', value: ['skin', 'scales'] },
    { field: 'mechanics.stiffness', op: 'set', value: 0.8 },
  ],
};

function arm(anatomy: Anatomy, now: GameTime) {
  return resolveAnatomy(anatomy, now).find((part) => part.part_id === 'arm.left');
}

function armDescription(anatomy: Anatomy, now: GameTime): string {
  return describeParts(resolveAnatomy(anatomy, now))
    .find((description) => description.part_id === 'arm.left')!.text;
}

let anatomy = createAnatomyFromTemplate(dataset);
anatomy = applyStatus(anatomy, growth);
anatomy = applyStatus(anatomy, scales);
const activeArm = arm(anatomy, activeTime)!;
const activeDescription = armDescription(anatomy, activeTime);
assert.equal(activeArm.attributes.geometry.length, 63);
assert.deepEqual(activeArm.attributes.surface.coverings, ['skin', 'scales']);
assert.equal(activeArm.attributes.mechanics.stiffness, 0.8);
assert.match(activeDescription, /length 63 cm/);
assert.match(activeDescription, /horizontal 0% \(left edge\)/);
assert.match(activeDescription, /vertical 90% \(upper\)/);
assert.equal(anatomy.parts.find((part) => part.part_id === 'arm.left')?.attributes.geometry.length, 60);
console.log(JSON.stringify({ stage: 'active', length: activeArm.attributes.geometry.length, coverings: activeArm.attributes.surface.coverings, stiffness: activeArm.attributes.mechanics.stiffness, description: activeDescription, permanent_length: 60 }, null, 2));

anatomy = changePermanentPart(anatomy, 'arm.left', [{ field: 'geometry.length', op: 'set', value: 62 }]);
const editedArm = arm(anatomy, activeTime)!;
const editedDescription = armDescription(anatomy, activeTime);
assert.equal(editedArm.attributes.geometry.length, 65);
assert.match(editedDescription, /length 65 cm/);
console.log(JSON.stringify({ stage: 'active_after_permanent_edit', length: editedArm.attributes.geometry.length, description: editedDescription, permanent_length: anatomy.parts.find((part) => part.part_id === 'arm.left')?.attributes.geometry.length }, null, 2));

const expiredArm = arm(anatomy, end)!;
const expiredDescription = armDescription(anatomy, end);
assert.equal(expiredArm.attributes.geometry.length, 62);
assert.deepEqual(expiredArm.attributes.surface.coverings, ['skin']);
assert.equal(expiredArm.attributes.mechanics.stiffness, 0.5);
assert.match(expiredDescription, /length 62 cm/);
assert.match(expiredDescription, /coverings skin/);
console.log(JSON.stringify({ stage: 'expired', length: expiredArm.attributes.geometry.length, coverings: expiredArm.attributes.surface.coverings, stiffness: expiredArm.attributes.mechanics.stiffness, description: expiredDescription }, null, 2));

const roundTripped = JSON.parse(JSON.stringify(anatomy)) as Anatomy;
const roundTrippedArm = arm(roundTripped, end);
assert.deepEqual(roundTrippedArm, expiredArm);
console.log(JSON.stringify({ stage: 'json_roundtrip', same_as_expired: true }, null, 2));
console.log('demo assertions passed');
