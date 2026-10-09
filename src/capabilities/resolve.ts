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
    const common = {
      capability_id: definition.capability_id,
      part_id: definition.part_id,
      part_name: part.name,
      name: definition.name,
    };
    switch (definition.type) {
      case 'manipulator': {
        const volume_cm3 = geometry.length * geometry.width * geometry.depth * definition.properties.volume_factor;
        return {
          ...common,
          type: definition.type,
          volume_cm3,
          precision: definition.properties.precision,
          reach_cm: geometry.length * definition.properties.reach_per_cm,
          grip_units: volume_cm3 * definition.properties.grip_units_per_cm3,
        };
      }
      case 'reservoir': {
        const volume_cm3 = geometry.length * geometry.width * geometry.depth * definition.properties.volume_factor;
        return {
          ...common,
          type: definition.type,
          volume_cm3,
          material_id: definition.properties.material_id,
          capacity: volume_cm3 * definition.properties.capacity_units_per_cm3,
        };
      }
      case 'producer': {
        const volume_cm3 = geometry.length * geometry.width * geometry.depth * definition.properties.volume_factor;
        return {
          ...common,
          type: definition.type,
          volume_cm3,
          material_id: definition.properties.material_id,
          destination_reservoir_id: definition.properties.destination_reservoir_id,
          rate_per_minute: volume_cm3 * definition.properties.rate_units_per_cm3_per_minute,
        };
      }
      case 'sensor':
        return {
          ...common,
          type: definition.type,
          inputs: structuredClone(definition.properties.inputs),
          outputs: structuredClone(definition.properties.outputs),
        };
    }
  });
}
