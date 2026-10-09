import type { AnatomyBody } from './contracts.js';

export function partsTable(body: AnatomyBody): HTMLElement {
  const section = document.createElement('section');
  section.append(heading('Body parts'));
  const parts = body.permanent?.parts ?? [];
  const parentNames = new Map(parts.map((part) => [part.part_id, part.name]));
  const index = document.createElement('ul');
  index.className = 'part-index';
  for (const part of parts) {
    const parent = part.parent_id ? ` · parent: ${parentNames.get(part.parent_id) ?? part.parent_id}` : ' · root';
    const item = document.createElement('li');
    item.textContent = `${part.name} (${part.part_id})${parent}`;
    index.append(item);
  }
  section.append(index);
  const effective = new Map((body.effective_parts ?? []).map((part) => [part.part_id, part]));
  const descriptions = new Map(
    (body.effective_parts ? body.effective_descriptions : body.baseline_descriptions)?.map((description) => [description.part_id, description])
      ?? [],
  );
  for (const baseline of parts) {
    const current = effective.get(baseline.part_id);
    const article = document.createElement('article');
    article.className = 'part-card';
    article.append(heading(`${baseline.name} (${baseline.part_id})`));
    const description = descriptions.get(baseline.part_id)!;
    article.append(text(`${body.effective_parts ? 'Current' : 'Baseline'} description: ${description.text}`));
    if (baseline.parent_id) article.append(message(`Attached to: ${parentNames.get(baseline.parent_id) ?? baseline.parent_id}`));
    article.append(attributeGroup('Geometry', [
      ['Length', `${formatNumber(baseline.attributes.geometry.length)} cm`, current ? `${formatNumber(current.attributes.geometry.length)} cm` : null],
      ['Width', `${formatNumber(baseline.attributes.geometry.width)} cm`, current ? `${formatNumber(current.attributes.geometry.width)} cm` : null],
      ['Depth', `${formatNumber(baseline.attributes.geometry.depth)} cm`, current ? `${formatNumber(current.attributes.geometry.depth)} cm` : null],
      ['Shape', baseline.attributes.geometry.shape, current?.attributes.geometry.shape ?? null],
    ]));
    article.append(attributeGroup('Composition', compositionRows(baseline.attributes.composition, current?.attributes.composition)));
    article.append(attributeGroup('Surface and mechanics', [
      ['Stiffness', formatPercent(baseline.attributes.mechanics.stiffness), current ? formatPercent(current.attributes.mechanics.stiffness) : null],
      ['Coverings', baseline.attributes.surface.coverings.join(', ') || 'none', current ? current.attributes.surface.coverings.join(', ') || 'none' : null],
      ['Color', baseline.attributes.surface.color, current?.attributes.surface.color ?? null],
      ['Texture', baseline.attributes.surface.texture, current?.attributes.surface.texture ?? null],
      ['Markings', baseline.attributes.surface.markings.join(', ') || 'none', current ? current.attributes.surface.markings.join(', ') || 'none' : null],
    ]));
    article.append(attributeGroup('Roles', [
      ['Roles', formatList(baseline.roles), current ? formatList(current.roles) : null],
    ]));
    article.append(attributeGroup('Functions', [
      ['Functions', formatList(baseline.attributes.functions), current ? formatList(current.attributes.functions) : null],
    ]));
    section.append(article);
  }
  return section;
}

function attributeGroup(title: string, rows: readonly (readonly [string, string, string | null])[]): HTMLElement {
  const group = document.createElement('div');
  group.className = 'attribute-group';
  group.append(heading(title));
  for (const [label, baseline, effective] of rows) {
    const row = document.createElement('div');
    row.className = 'attribute-row';
    row.append(text(label));
    const values = document.createElement('div');
    values.className = 'attribute-values';
    values.append(text(`Baseline: ${baseline}`));
    values.append(text(effective === null ? 'Effective: not resolved' : `Effective: ${effective}`));
    row.append(values);
    group.append(row);
  }
  return group;
}

function compositionRows(
  baseline: Readonly<Record<string, number>>,
  effective: Readonly<Record<string, number>> | undefined,
): readonly (readonly [string, string, string | null])[] {
  const keys = [...new Set([...Object.keys(baseline), ...Object.keys(effective ?? {})])].sort();
  return keys.map((key) => [humanize(key), formatPercent(baseline[key] ?? 0), effective ? formatPercent(effective[key] ?? 0) : null]);
}

function formatList(values: readonly string[]): string {
  return values.map(humanize).join(', ') || 'none';
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function formatPercent(value: number): string {
  return `${formatNumber(value * 100)}%`;
}

function humanize(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function heading(value: string): HTMLHeadingElement {
  const element = document.createElement('h3');
  element.textContent = value;
  return element;
}

function message(value: string): HTMLParagraphElement {
  return text(value);
}

function text(value: string): HTMLParagraphElement {
  const element = document.createElement('p');
  element.textContent = value;
  return element;
}
