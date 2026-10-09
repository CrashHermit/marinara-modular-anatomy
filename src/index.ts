export {
  applyStatus,
  changePermanentPart,
  createAnatomy,
  removeStatus,
  resolveAnatomy,
} from './anatomy.js';
export { createAnatomyFromTemplate } from './templates.js';
export { describeParts } from './descriptions.js';
export type { PartDescription } from './descriptions.js';
export { applyAnatomyEffect } from './effects.js';
export type {
  AnatomyEffectDefinition,
  AnatomyEffectBase,
  PermanentAnatomyEffectDefinition,
  TemporaryAnatomyEffectDefinition,
  TemporaryEffectApplicationContext,
} from './effects.js';
export {
  advanceCapabilities,
  createCapabilityState,
  installCapabilityBundle,
  replaceCapability,
  resolveCapabilities,
} from './capabilities/index.js';
export type {
  CapabilityBundle,
  CapabilityState,
  InstalledCapabilityBundle,
  ManipulatorCapability,
  MaterialDefinition,
  PartCapability,
  ProducerCapability,
  ReservoirCapability,
  ResolvedManipulatorCapability,
  ResolvedPartCapability,
  ResolvedProducerCapability,
  ResolvedReservoirCapability,
} from './capabilities/index.js';
export { toGameMinutes } from './time.js';
export type {
  Anatomy,
  AnatomicalFunction,
  AnatomyTemplate,
  AttributeOperation,
  BodyPart,
  GameTime,
  NumericField,
  NumericOperator,
  PartAttributes,
  PartComposition,
  PartGeometry,
  PartMechanics,
  PartPlacement,
  PartSurface,
  TemporaryStatus,
} from './model.js';
