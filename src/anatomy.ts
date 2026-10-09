import type {
  Anatomy,
  AttributeOperation,
  BodyPart,
  GameTime,
  PartComposition,
  TemporaryStatus,
} from './model.js';
import { toGameMinutes } from './time.js';

type MutableBodyPart = {
  part_id: string;
  parent_id: string | null;
  name: string;
  description: string;
  attributes: {
    geometry: {
      length: number;
      width: number;
      depth: number;
      shape: string;
    };
    composition: Record<string, number>;
    mechanics: {
      stiffness: number;
    };
    surface: {
      coverings: string[];
      color: string;
      texture: string;
      markings: string[];
    };
    functions: Array<'locomotion' | 'manipulation'>;
  };
};

type MutableOperation = {
  readonly op: 'set' | 'add' | 'subtract' | 'multiply';
  readonly value: number;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function applyNumeric(current: number, operation: MutableOperation): number {
  switch (operation.op) {
    case 'set':
      return operation.value;
    case 'add':
      return current + operation.value;
    case 'subtract':
      return current - operation.value;
    case 'multiply':
      return current * operation.value;
  }
}

function applyOperation(part: MutableBodyPart, operation: AttributeOperation): void {
  switch (operation.field) {
    case 'geometry.length':
      part.attributes.geometry.length = applyNumeric(part.attributes.geometry.length, operation);
      return;
    case 'geometry.width':
      part.attributes.geometry.width = applyNumeric(part.attributes.geometry.width, operation);
      return;
    case 'geometry.depth':
      part.attributes.geometry.depth = applyNumeric(part.attributes.geometry.depth, operation);
      return;
    case 'geometry.shape':
      part.attributes.geometry.shape = operation.value;
      return;
    case 'composition':
      part.attributes.composition = clone(operation.value) as Record<string, number>;
      return;
    case 'mechanics.stiffness':
      part.attributes.mechanics.stiffness = applyNumeric(part.attributes.mechanics.stiffness, operation);
      return;
    case 'surface.coverings':
      part.attributes.surface.coverings = [...operation.value];
      return;
    case 'surface.color':
      part.attributes.surface.color = operation.value;
      return;
    case 'surface.texture':
      part.attributes.surface.texture = operation.value;
      return;
    case 'surface.markings':
      part.attributes.surface.markings = [...operation.value];
      return;
    case 'functions':
      part.attributes.functions = [...operation.value];
      return;
    default: {
      const material = operation.field.slice('composition.'.length);
      const composition = part.attributes.composition;
      composition[material] = applyNumeric(composition[material] as number, operation);
    }
  }
}

function copyPart(part: BodyPart): MutableBodyPart {
  return clone(part) as MutableBodyPart;
}

function copyParts(parts: readonly BodyPart[]): MutableBodyPart[] {
  return parts.map(copyPart);
}

export function createAnatomy(parts: readonly BodyPart[]): Anatomy {
  return {
    parts: copyParts(parts),
    statuses: [],
  };
}

export function changePermanentPart(
  anatomy: Anatomy,
  part_id: string,
  operations: readonly AttributeOperation[],
): Anatomy {
  const parts = copyParts(anatomy.parts);
  const target = parts.find((part) => part.part_id === part_id) as MutableBodyPart;
  for (const operation of operations) {
    applyOperation(target, operation);
  }
  return {
    parts,
    statuses: clone(anatomy.statuses),
  };
}

export function applyStatus(anatomy: Anatomy, status: TemporaryStatus): Anatomy {
  return {
    parts: clone(anatomy.parts),
    statuses: [...clone(anatomy.statuses), clone(status)],
  };
}

export function removeStatus(anatomy: Anatomy, status_id: string): Anatomy {
  return {
    parts: clone(anatomy.parts),
    statuses: anatomy.statuses.filter((status) => status.status_id !== status_id).map(clone),
  };
}

function statusIsActive(status: TemporaryStatus, now: GameTime): boolean {
  const current = toGameMinutes(now);
  const starts = toGameMinutes(status.starts_at);
  const expires = status.expires_at === null ? null : toGameMinutes(status.expires_at);
  return current >= starts && (expires === null || current < expires);
}

export function resolveAnatomy(anatomy: Anatomy, now: GameTime): readonly BodyPart[] {
  const parts = copyParts(anatomy.parts);
  for (const status of anatomy.statuses) {
    if (!statusIsActive(status, now)) {
      continue;
    }
    const target = parts.find((part) => part.part_id === status.part_id) as MutableBodyPart;
    for (const operation of status.operations) {
      applyOperation(target, operation);
    }
  }
  return parts;
}

export type { PartComposition };
