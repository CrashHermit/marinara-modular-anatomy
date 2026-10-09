import type { Anatomy, BodyPart, GameTime } from '../model.js';

export interface MaterialDefinition {
  readonly material_id: string;
  readonly name: string;
  readonly unit: string;
}

interface PartCapabilityBase {
  readonly capability_id: string;
  readonly part_id: string;
  readonly name: string;
}

export interface ManipulatorCapability extends PartCapabilityBase {
  readonly type: 'manipulator';
  readonly properties: {
    readonly volume_factor: number;
    readonly precision: number;
    readonly reach_per_cm: number;
    readonly grip_units_per_cm3: number;
  };
}

export interface ReservoirCapability extends PartCapabilityBase {
  readonly type: 'reservoir';
  readonly properties: {
    readonly volume_factor: number;
    readonly material_id: string;
    readonly capacity_units_per_cm3: number;
  };
}

export interface ProducerCapability extends PartCapabilityBase {
  readonly type: 'producer';
  readonly properties: {
    readonly volume_factor: number;
    readonly material_id: string;
    readonly destination_reservoir_id: string;
    readonly rate_units_per_cm3_per_minute: number;
  };
}

export type PartCapability = ManipulatorCapability | ReservoirCapability | ProducerCapability;

export interface CapabilityState {
  readonly definitions: readonly PartCapability[];
  readonly materials: readonly MaterialDefinition[];
  readonly reservoir_quantities: Readonly<Record<string, number>>;
  readonly last_evaluated_at: GameTime | null;
  readonly installed_bundle_ids: readonly string[];
}

interface ResolvedPartCapabilityBase {
  readonly capability_id: string;
  readonly part_id: string;
  readonly part_name: string;
  readonly name: string;
  readonly volume_cm3: number;
}

export interface ResolvedManipulatorCapability extends ResolvedPartCapabilityBase {
  readonly type: 'manipulator';
  readonly precision: number;
  readonly reach_cm: number;
  readonly grip_units: number;
}

export interface ResolvedReservoirCapability extends ResolvedPartCapabilityBase {
  readonly type: 'reservoir';
  readonly material_id: string;
  readonly capacity: number;
}

export interface ResolvedProducerCapability extends ResolvedPartCapabilityBase {
  readonly type: 'producer';
  readonly material_id: string;
  readonly destination_reservoir_id: string;
  readonly rate_per_minute: number;
}

export type ResolvedPartCapability =
  | ResolvedManipulatorCapability
  | ResolvedReservoirCapability
  | ResolvedProducerCapability;

export interface CapabilityBundle {
  readonly bundle_id: string;
  readonly template_id: string;
  readonly parts: readonly BodyPart[];
  readonly materials: readonly MaterialDefinition[];
  readonly capabilities: readonly PartCapability[];
}

export interface InstalledCapabilityBundle {
  readonly anatomy: Anatomy;
  readonly capabilities: CapabilityState;
}
