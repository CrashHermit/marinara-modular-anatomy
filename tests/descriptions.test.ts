import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  applyStatus,
  describeParts,
  resolveAnatomy,
  type BodyPart,
} from '../src/index.js';

const root: BodyPart = {
  part_id: 'body',
  parent_id: null,
  placement: null,
  name: 'Body',
  attributes: {
    geometry: { length: 100, width: 50, depth: 40, shape: 'root_box' },
    composition: { muscle: 0.5, bone: 0.5 },
    mechanics: { stiffness: 0.5 },
    surface: { coverings: ['skin'], color: '#ffffff', texture: 'smooth_surface', markings: [] },
    functions: [],
  },
};

const parent: BodyPart = {
  part_id: 'parent',
  parent_id: 'body',
  placement: { horizontal: 50, vertical: 50, depth: 50 },
  name: 'Parent',
  attributes: {
    geometry: { length: 60, width: 20, depth: 10, shape: 'parent_box' },
    composition: { muscle: 1 },
    mechanics: { stiffness: 0.25 },
    surface: { coverings: ['skin'], color: '#111111', texture: 'smooth', markings: [] },
    functions: ['hold_item'],
  },
};

const child: BodyPart = {
  part_id: 'child',
  parent_id: 'parent',
  placement: { horizontal: 0, vertical: 100, depth: 50 },
  name: 'Child',
  attributes: {
    geometry: { length: 30, width: 5, depth: 2, shape: 'strange_shape' },
    composition: { bone: 0.2, muscle: 0.55, fat: 0.25 },
    mechanics: { stiffness: 0.75 },
    surface: { coverings: [], color: '#abcdef', texture: 'rough_surface', markings: ['bright_mark'] },
    functions: ['some_function'],
  },
};

const parts = [root, parent, child] as const;
const description = (items: readonly BodyPart[], part_id: string) => describeParts(items).find((item) => item.part_id === part_id)!.text;

test('generated descriptions include structural facts and deterministic labels', () => {
  const rootText = description(parts, 'body');
  const childText = description(parts, 'child');
  assert.match(rootText, /Body \(body\)/);
  assert.match(rootText, /body hierarchy root/);
  assert.doesNotMatch(rootText, /parent-relative/);
  assert.match(childText, /Child \(child\)/);
  assert.match(childText, /Attaches to Parent \(parent\)/);
  assert.match(childText, /horizontal 0% \(left edge\)/);
  assert.match(childText, /vertical 100% \(upper edge\)/);
  assert.match(childText, /depth 50% \(central-depth\)/);
  assert.match(childText, /length 30 cm, width 5 cm, depth 2 cm/);
  assert.match(childText, /shape: strange shape/);
  assert.match(childText, /length 50%, width 25%, depth 20%/);
  assert.match(childText, /bone 20%, fat 25%, muscle 55%/);
  assert.match(childText, /Stiffness: 75%/);
  assert.match(childText, /coverings none/);
  assert.match(childText, /texture rough surface/);
  assert.match(childText, /Functions: some function/);
});

test('description ratios use the supplied parent projection', () => {
  const changedParent = { ...parent, attributes: { ...parent.attributes, geometry: { ...parent.attributes.geometry, length: 120 } } };
  const changedParts = [root, changedParent, child] as const;
  assert.match(description(parts, 'child'), /length 50%/);
  assert.match(description(changedParts, 'child'), /length 25%/);
  assert.match(description(changedParts, 'child'), /length 30 cm/);
});

test('effective descriptions track temporary data and restore at expiry', () => {
  const anatomy = applyStatus({ parts, statuses: [] }, {
    status_id: 'temporary-change',
    part_id: 'child',
    starts_at: { day: 1, hour: 8, minute: 0 },
    expires_at: { day: 1, hour: 10, minute: 0 },
    operations: [
      { field: 'geometry.length', op: 'set', value: 63 },
      { field: 'surface.coverings', op: 'set', value: ['scales'] },
      { field: 'composition', op: 'set', value: { altered_material: 1 } },
      { field: 'functions', op: 'set', value: ['altered_function'] },
    ],
  });
  const active = describeParts(resolveAnatomy(anatomy, { day: 1, hour: 9, minute: 0 }));
  const expired = describeParts(resolveAnatomy(anatomy, { day: 1, hour: 10, minute: 0 }));
  assert.match(active.find((item) => item.part_id === 'child')!.text, /length 63 cm/);
  assert.match(active.find((item) => item.part_id === 'child')!.text, /coverings scales/);
  assert.match(active.find((item) => item.part_id === 'child')!.text, /altered material 100%/);
  assert.match(expired.find((item) => item.part_id === 'child')!.text, /length 30 cm/);
  assert.match(expired.find((item) => item.part_id === 'child')!.text, /coverings none/);
  assert.match(expired.find((item) => item.part_id === 'child')!.text, /bone 20%/);
});

test('position boundaries and fractional formatting are stable', () => {
  const values = [0, 33.333332, 100 / 3, 66.666665, (100 * 2) / 3, 100];
  const expected = ['0', '33.333332', '33.333333', '66.666665', '66.666667', '100'];
  const labels = ['left edge', 'left', 'central', 'central', 'right', 'right edge'];
  for (const [index, value] of values.entries()) {
    const positioned = { ...child, placement: { horizontal: value, vertical: 50, depth: 50 } };
    const text = description([root, parent, positioned], 'child');
    assert.ok(text.includes(`horizontal ${expected[index]}% (${labels[index]}`));
  }
  const fractionalParent = { ...parent, attributes: { ...parent.attributes, geometry: { ...parent.attributes.geometry, length: 3 } } };
  const fractionalChild = { ...child, attributes: { ...child.attributes, geometry: { ...child.attributes.geometry, length: 1 } } };
  assert.match(description([root, fractionalParent, fractionalChild], 'child'), /length 33\.333333%/);
});

test('empty part collections and empty authored lists remain readable', () => {
  assert.deepEqual(describeParts([]), []);
  const text = description([{ ...root, attributes: { ...root.attributes, composition: {}, surface: { ...root.attributes.surface, coverings: [], markings: [] }, functions: [] } }], 'body');
  assert.match(text, /Composition: none/);
  assert.match(text, /coverings none/);
  assert.match(text, /markings none/);
  assert.match(text, /Functions: none/);
});

