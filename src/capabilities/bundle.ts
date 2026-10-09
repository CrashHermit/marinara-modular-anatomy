import type { Anatomy } from '../model.js';
import type { CapabilityBundle, CapabilityState, InstalledCapabilityBundle } from './model.js';

export function installCapabilityBundle(
  anatomy: Anatomy,
  state: CapabilityState,
  bundle: CapabilityBundle,
): InstalledCapabilityBundle {
  if (state.installed_bundle_ids.includes(bundle.bundle_id)) return { anatomy, capabilities: state };
  const existingState = state;
  const quantities = { ...existingState.reservoir_quantities };
  for (const capability of bundle.capabilities) {
    if (capability.type === 'reservoir') quantities[capability.capability_id] ??= 0;
  }
  const installedState: CapabilityState = {
    ...existingState,
    definitions: [...existingState.definitions, ...structuredClone(bundle.capabilities)],
    materials: [...existingState.materials, ...structuredClone(bundle.materials)],
    reservoir_quantities: quantities,
    installed_bundle_ids: [...existingState.installed_bundle_ids, bundle.bundle_id],
  };
  return {
    anatomy: {
      parts: structuredClone([...anatomy.parts, ...bundle.parts]),
      statuses: structuredClone(anatomy.statuses),
    },
    capabilities: installedState,
  };
}
