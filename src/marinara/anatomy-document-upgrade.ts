import type { AnatomyDocumentData } from './contracts.js';
import type { BodyDataset } from '../index.js';

export function upgradeAnatomyDocumentData(
  data: AnatomyDocumentData,
  dataset: BodyDataset,
): AnatomyDocumentData {
  const authoredRoles = data.template_id === dataset.template_id
    ? new Map(dataset.parts.map((part) => [part.part_id, part.roles]))
    : new Map<string, readonly string[]>();
  let changed = false;
  const parts = data.anatomy.parts.map((part) => {
    if (part.roles !== undefined) return part;
    changed = true;
    return {
      ...part,
      roles: authoredRoles.get(part.part_id) ?? [],
    };
  });
  return changed
    ? { ...data, anatomy: { ...data.anatomy, parts } }
    : data;
}
