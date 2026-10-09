export type AnatomicalFunction = string;

export interface GameTime {
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

export interface PartGeometry {
  readonly length: number;
  readonly width: number;
  readonly depth: number;
  readonly shape: string;
}

export interface PartComposition {
  readonly [material: string]: number;
}

export interface PartMechanics {
  readonly stiffness: number;
}

export interface PartSurface {
  readonly coverings: readonly string[];
  readonly color: string;
  readonly texture: string;
  readonly markings: readonly string[];
}

export interface PartAttributes {
  readonly geometry: PartGeometry;
  readonly composition: PartComposition;
  readonly mechanics: PartMechanics;
  readonly surface: PartSurface;
  readonly functions: readonly AnatomicalFunction[];
}

export interface BodyPart {
  readonly part_id: string;
  readonly parent_id: string | null;
  readonly name: string;
  readonly description: string;
  readonly roles: readonly string[];
  readonly attributes: PartAttributes;
}

export interface BodyDataset {
  readonly template_id: string;
  readonly units: {
    readonly length: 'cm';
  };
  readonly parts: readonly BodyPart[];
}

export type NumericOperator = 'set' | 'add' | 'subtract' | 'multiply';
export type NumericField =
  | 'geometry.length'
  | 'geometry.width'
  | 'geometry.depth'
  | 'mechanics.stiffness';

type NumericAttributeOperation = {
  readonly field: NumericField;
  readonly op: NumericOperator;
  readonly value: number;
};

type CompositionComponentOperation = {
  readonly field: `composition.${string}`;
  readonly op: NumericOperator;
  readonly value: number;
};

type SetOperation<Field extends string, Value> = {
  readonly field: Field;
  readonly op: 'set';
  readonly value: Value;
};

export type AttributeOperation =
  | NumericAttributeOperation
  | CompositionComponentOperation
  | SetOperation<'geometry.shape', string>
  | SetOperation<'composition', PartComposition>
  | SetOperation<'surface.coverings', readonly string[]>
  | SetOperation<'surface.color', string>
  | SetOperation<'surface.texture', string>
  | SetOperation<'surface.markings', readonly string[]>
  | SetOperation<'roles', readonly string[]>
  | SetOperation<'functions', readonly AnatomicalFunction[]>;

export interface TemporaryStatus {
  readonly status_id: string;
  readonly part_id: string;
  readonly starts_at: GameTime;
  readonly expires_at: GameTime | null;
  readonly operations: readonly AttributeOperation[];
}

export interface Anatomy {
  readonly parts: readonly BodyPart[];
  readonly statuses: readonly TemporaryStatus[];
}
