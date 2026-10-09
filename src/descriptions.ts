import type { BodyPart } from './model.js';

export interface PartDescription {
  readonly part_id: string;
  readonly parent_id: string | null;
  readonly text: string;
}

const THIRD = 100 / 3;
const TWO_THIRDS = (100 * 2) / 3;

function formatNumber(value: number): string {
  return value.toFixed(6).replace(/\.?(0+)$/, '');
}

function humanize(value: string): string {
  return value.replaceAll('_', ' ');
}

function list(values: readonly string[]): string {
  return values.length === 0 ? 'none' : values.map(humanize).join(', ');
}

function positionLabel(value: number, low: string, middle: string, high: string): string {
  if (value === 0) return `${low} edge`;
  if (value === 100) return `${high} edge`;
  if (value < THIRD) return low;
  if (value < TWO_THIRDS) return middle;
  return high;
}

function positionText(part: BodyPart, parent: BodyPart): string {
  const placement = part.placement!;
  return `Attaches to ${parent.name} (${parent.part_id}) at horizontal ${formatNumber(placement.horizontal)}% (${positionLabel(placement.horizontal, 'left', 'central', 'right')}), vertical ${formatNumber(placement.vertical)}% (${positionLabel(placement.vertical, 'lower', 'middle', 'upper')}), depth ${formatNumber(placement.depth)}% (${positionLabel(placement.depth, 'posterior', 'central-depth', 'anterior')}).`;
}

function proportionText(part: BodyPart, parent: BodyPart): string {
  const geometry = part.attributes.geometry;
  const parentGeometry = parent.attributes.geometry;
  const length = (geometry.length / parentGeometry.length) * 100;
  const width = (geometry.width / parentGeometry.width) * 100;
  const depth = (geometry.depth / parentGeometry.depth) * 100;
  return `Bounding-envelope proportions relative to ${parent.name} (${parent.part_id}): length ${formatNumber(length)}%, width ${formatNumber(width)}%, depth ${formatNumber(depth)}%.`;
}

function compositionText(part: BodyPart): string {
  const entries = Object.entries(part.attributes.composition)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([material, proportion]) => `${humanize(material)} ${formatNumber(proportion * 100)}%`);
  return entries.length === 0 ? 'Composition: none.' : `Composition: ${entries.join(', ')}.`;
}

export function describeParts(parts: readonly BodyPart[]): readonly PartDescription[] {
  const byId = new Map(parts.map((part) => [part.part_id, part]));
  return parts.map((part) => {
    const parent = part.parent_id === null ? null : byId.get(part.parent_id)!;
    const geometry = part.attributes.geometry;
    const placement = parent === null ? 'This is the body hierarchy root.' : positionText(part, parent);
    const proportions = parent === null ? '' : ` ${proportionText(part, parent)}`;
    const text = [
      `${part.name} (${part.part_id}).`,
      placement,
      `Approximate bounding dimensions: length ${formatNumber(geometry.length)} cm, width ${formatNumber(geometry.width)} cm, depth ${formatNumber(geometry.depth)} cm; shape: ${humanize(geometry.shape)}.`,
      proportions.trim(),
      compositionText(part),
      `Stiffness: ${formatNumber(part.attributes.mechanics.stiffness * 100)}%.`,
      `Surface: coverings ${list(part.attributes.surface.coverings)}, color ${part.attributes.surface.color}, texture ${humanize(part.attributes.surface.texture)}, markings ${list(part.attributes.surface.markings)}.`,
      `Functions: ${list(part.attributes.functions)}.`,
    ].filter((section) => section.length > 0).join(' ');
    return { part_id: part.part_id, parent_id: part.parent_id, text };
  });
}
