import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  changePermanentPart,
  createAnatomyFromTemplate,
  type AnatomyTemplate,
} from '../src/index.js';
import datasetJson from '../data/humanoid-basic.json' with { type: 'json' };

const template = datasetJson as AnatomyTemplate;

test('template initialization creates independent anatomy instances', () => {
  const first = createAnatomyFromTemplate(template);
  const second = createAnatomyFromTemplate(template);
  const changed = changePermanentPart(first, 'arm.left', [
    { field: 'geometry.length', op: 'set', value: 72 },
    { field: 'placement', op: 'set', value: { horizontal: 20, vertical: 80, depth: 50 } },
    { field: 'surface.coverings', op: 'set', value: ['scales'] },
    { field: 'composition', op: 'set', value: { altered_material: 1 } },
  ]);
  const original = first.parts.find((part) => part.part_id === 'arm.left')!;
  const untouched = second.parts.find((part) => part.part_id === 'arm.left')!;
  assert.equal(changed.statuses.length, 0);
  assert.equal(original.attributes.geometry.length, 60);
  assert.equal(original.placement?.horizontal, 0);
  assert.deepEqual(original.attributes.surface.coverings, ['skin']);
  assert.equal(untouched.attributes.geometry.length, 60);
  assert.equal(untouched.placement?.horizontal, 0);
  assert.deepEqual(untouched.attributes.composition, template.parts.find((part) => part.part_id === 'arm.left')!.attributes.composition);
  assert.equal(template.parts.find((part) => part.part_id === 'arm.left')!.placement?.horizontal, 0);

  const roundTripped = JSON.parse(JSON.stringify(template)) as AnatomyTemplate;
  const roundTrippedAnatomy = createAnatomyFromTemplate(roundTripped);
  assert.deepEqual(roundTrippedAnatomy.parts, roundTripped.parts);
  assert.deepEqual(roundTrippedAnatomy.statuses, []);
});
