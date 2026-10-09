import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { upgradeAnatomyDocumentData } from '../src/marinara/anatomy-document-upgrade.js';
import type { AnatomyDocumentData } from '../src/marinara/contracts.js';
import type { BodyDataset } from '../src/index.js';
import datasetJson from '../data/humanoid-basic.json' with { type: 'json' };

const dataset = datasetJson as BodyDataset;

test('legacy anatomy documents receive authored roles without changing stored values', () => {
  const source = {
    game_id: 'game-1',
    subject: { kind: 'persona' as const, id: 'persona-1' },
    template_id: dataset.template_id,
    anatomy: {
      parts: dataset.parts.map(({ roles: _roles, ...part }) => part),
      statuses: [],
    },
  } as unknown as AnatomyDocumentData;
  const upgraded = upgradeAnatomyDocumentData(source, dataset);
  assert.deepEqual(upgraded.anatomy.parts.map((part) => part.roles), dataset.parts.map((part) => part.roles));
  assert.deepEqual(upgraded.anatomy.parts.map((part) => part.attributes), dataset.parts.map((part) => part.attributes));
  assert.deepEqual(upgraded.anatomy.statuses, source.anatomy.statuses);
  assert.deepEqual(source.anatomy.parts[0]?.roles, undefined);
});

test('legacy anatomy documents with another template receive empty roles', () => {
  const source = {
    game_id: 'game-1',
    subject: { kind: 'character' as const, id: 'character-1' },
    template_id: 'other-template',
    anatomy: {
      parts: dataset.parts.slice(0, 1).map(({ roles: _roles, ...part }) => part),
      statuses: [],
    },
  } as unknown as AnatomyDocumentData;
  const upgraded = upgradeAnatomyDocumentData(source, dataset);
  assert.deepEqual(upgraded.anatomy.parts[0]?.roles, []);
});
