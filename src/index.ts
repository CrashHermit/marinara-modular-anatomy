export {
  applyStatus,
  changePermanentPart,
  createAnatomy,
  removeStatus,
  resolveAnatomy,
} from './anatomy.js';
export { applyAnatomyEffect } from './effects.js';
export type {
  AnatomyEffectDefinition,
  AnatomyEffectBase,
  PermanentAnatomyEffectDefinition,
  TemporaryAnatomyEffectDefinition,
  TemporaryEffectApplicationContext,
} from './effects.js';
export { toGameMinutes } from './time.js';
export type {
  Anatomy,
  AnatomicalFunction,
  AttributeOperation,
  BodyDataset,
  BodyPart,
  GameTime,
  NumericField,
  NumericOperator,
  PartAttributes,
  PartComposition,
  PartGeometry,
  PartMechanics,
  PartSurface,
  TemporaryStatus,
} from './model.js';
