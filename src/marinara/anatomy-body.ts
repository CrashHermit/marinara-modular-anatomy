import capabilityDemoJson from '../../data/capability-demo.json' with { type: 'json' };
import { describeParts, resolveAnatomy } from '../index.js';
import { resolveCapabilities } from '../capabilities/index.js';
import type { AnatomyEffectDefinition, CapabilityBundle, GameTime } from '../index.js';
import type { AnatomyBody, AnatomyDocumentData, AnatomySubjectInfo } from './contracts.js';

const capabilityDemo = capabilityDemoJson as CapabilityBundle;

export function buildAnatomyBody(
  data: AnatomyDocumentData,
  subject: AnatomySubjectInfo,
  game_time: GameTime | null,
  available_effects: readonly AnatomyEffectDefinition[],
): AnatomyBody {
  const effective_parts = game_time ? resolveEffectiveParts(data, game_time) : null;
  const baseline_descriptions = describeParts(data.anatomy.parts);
  const effective_descriptions = effective_parts ? describeParts(effective_parts) : null;
  return {
    state: game_time ? 'ready' : 'clock_uninitialized',
    game_id: data.game_id,
    subject,
    template_id: data.template_id,
    game_time,
    permanent: data.anatomy,
    effective_parts,
    baseline_descriptions,
    effective_descriptions,
    effects: available_effects,
    statuses: data.anatomy.statuses,
    capabilities: data.capabilities,
    baseline_capabilities: resolveCapabilities(data.capabilities.definitions, data.anatomy.parts),
    effective_capabilities: effective_parts ? resolveCapabilities(data.capabilities.definitions, effective_parts) : null,
    capability_demo_available: data.template_id === capabilityDemo.template_id
      && !data.capabilities.installed_bundle_ids.includes(capabilityDemo.bundle_id),
  };
}

function resolveEffectiveParts(data: AnatomyDocumentData, game_time: GameTime) {
  return resolveAnatomy(data.anatomy, game_time);
}
