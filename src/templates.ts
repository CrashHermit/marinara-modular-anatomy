import type { Anatomy, AnatomyTemplate } from './model.js';
import { createAnatomy } from './anatomy.js';

export function createAnatomyFromTemplate(template: AnatomyTemplate): Anatomy {
  return createAnatomy(template.parts);
}
