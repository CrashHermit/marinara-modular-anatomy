import type { BodyPart } from '../model.js';
import type { PartCapability, ResolvedPartCapability } from './model.js';

export function resolveCapabilities(
  definitions: readonly PartCapability[],
  parts: readonly BodyPart[],
): readonly ResolvedPartCapability[] {
  const partsById = new Map(parts.map((part) => [part.part_id, part]));
  return definitions.map((definition) => {
    const part = partsById.get(definition.part_id) as BodyPart;
    const geometry = part.attributes.geometry;
    const volume_cm3 = geometry.length * geometry.width * geometry.depth * definition.properties.volume_factor;
    const common = {
      capability_id: definition.capability_id,
      part_id: definition.part_id,
      part_name: part.name,
      name: definition.name,
      volume_cm3,
    };
    switch (definition.type) {
      case 'manipulator':
        return {
          ...common,
          type: definition.type,
          precision: definition.properties.precision,
          reach_cm: geometry.length * definition.properties.reach_per_cm,
          grip_units: volume_cm3 * definition.properties.grip_units_per_cm3,
        };
      case 'reservoir':
        return {
          ...common,
          type: definition.type,
          material_id: definition.properties.material_id,
          capacity: volume_cm3 * definition.properties.capacity_units_per_cm3,
        };
      case 'producer':
        return {
          ...common,
          type: definition.type,
          material_id: definition.properties.material_id,
          destination_reservoir_id: definition.properties.destination_reservoir_id,
          rate_per_minute: volume_cm3 * definition.properties.rate_units_per_cm3_per_minute,
        };
    }
  });
}
