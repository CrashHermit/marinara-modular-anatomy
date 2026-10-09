import type { AnatomyBody } from './contracts.js';
import type { PartCapability, ResolvedPartCapability } from '../index.js';
export function capabilitiesView(
  body: AnatomyBody,
  install: () => void,
  advance: () => void,
): HTMLElement {
  const section = document.createElement('section');
  section.append(heading('Part capabilities'));
  if (body.capability_demo_available) {
    section.append(text('The fictional demo bundle adds manipulators to both composite arms and a demo gland with producer and reservoir capabilities.'));
    const installButton = button('Install demo capabilities', install);
    section.append(installButton);
  }
  if (!body.capabilities || !body.capabilities.definitions.length) {
    section.append(message('No capabilities installed.'));
    return section;
  }

  const advanceButton = button('Advance production to native time', advance);
  advanceButton.disabled = body.game_time === null;
  section.append(advanceButton);
  section.append(message(body.capabilities.last_evaluated_at
    ? `Stored quantities settled through ${formatGameTime(body.capabilities.last_evaluated_at)}. Refresh does not produce material.`
    : 'Production has not started; first advance establishes the starting time.'));
  if (body.game_time === null) section.append(message('Initialize Marinara’s native numeric game time before advancing production. This action does not change the game clock.'));

  const materials = new Map(body.capabilities.materials.map((material) => [material.material_id, material]));
  const baseline = new Map((body.baseline_capabilities ?? []).map((capability) => [capability.capability_id, capability]));
  const effective = new Map((body.effective_capabilities ?? []).map((capability) => [capability.capability_id, capability]));
  for (const definition of body.capabilities.definitions) {
    const base = baseline.get(definition.capability_id) as ResolvedPartCapability;
    const current = effective.get(definition.capability_id);
    const article = document.createElement('article');
    article.className = 'part-card';
    article.append(heading(`${base.name} (${base.part_id})`));
    article.append(text(`Attached to: ${base.part_name} · Type: ${base.type}`));
    article.append(attributeGroup('Authored coefficients', authoredRows(definition, materials)));
    article.append(attributeGroup('Derived values', derivedRows(base, current, materials, body)));
    section.append(article);
  }
  return section;
}

function derivedRows(
  base: ResolvedPartCapability,
  current: ResolvedPartCapability | undefined,
  materials: ReadonlyMap<string, { readonly name: string; readonly unit: string }>,
  body: AnatomyBody,
): readonly (readonly [string, string, string | null])[] {
  const rows: Array<readonly [string, string, string | null]> = [];
  if (base.type !== 'sensor') {
    const currentVolume = current && current.type !== 'sensor' ? `${formatNumber(current.volume_cm3)} cm³` : null;
    rows.push(['Volume', `${formatNumber(base.volume_cm3)} cm³`, currentVolume]);
  }
  if (base.type === 'manipulator') {
    const currentManipulator = current?.type === 'manipulator' ? current : null;
    rows.push(
      ['Precision', formatNumber(base.precision), currentManipulator ? formatNumber(currentManipulator.precision) : null],
      ['Reach', `${formatNumber(base.reach_cm)} cm`, currentManipulator ? `${formatNumber(currentManipulator.reach_cm)} cm` : null],
      ['Grip units', formatNumber(base.grip_units), currentManipulator ? formatNumber(currentManipulator.grip_units) : null],
    );
  }
  if (base.type === 'reservoir') {
    const material = materials.get(base.material_id);
    const quantity = body.capabilities?.reservoir_quantities[base.capability_id] ?? 0;
    const currentReservoir = current?.type === 'reservoir' ? current : null;
    rows.push(
      ['Material', material?.name ?? base.material_id, material?.name ?? base.material_id],
      ['Capacity', `${formatNumber(base.capacity)} ${material?.unit ?? 'units'}`, currentReservoir ? `${formatNumber(currentReservoir.capacity)} ${material?.unit ?? 'units'}` : null],
      ['Stored quantity', `${formatNumber(quantity)} ${material?.unit ?? 'units'}`, `${formatNumber(quantity)} ${material?.unit ?? 'units'}`],
    );
    if (quantity > base.capacity) rows.push(['Capacity state', 'Stored quantity exceeds current capacity; contents are preserved.', currentReservoir ? 'Stored quantity exceeds current capacity; contents are preserved.' : null]);
  }
  if (base.type === 'producer') {
    const material = materials.get(base.material_id);
    const currentProducer = current?.type === 'producer' ? current : null;
    rows.push(
      ['Output', material?.name ?? base.material_id, material?.name ?? base.material_id],
      ['Destination reservoir', base.destination_reservoir_id, currentProducer?.destination_reservoir_id ?? null],
      ['Rate', `${formatNumber(base.rate_per_minute)} ${material?.unit ?? 'units'}/native minute`, currentProducer ? `${formatNumber(currentProducer.rate_per_minute)} ${material?.unit ?? 'units'}/native minute` : null],
    );
  }
  if (base.type === 'sensor') {
    const currentSensor = current?.type === 'sensor' ? current : null;
    rows.push(
      ['Inputs', base.inputs.map((input) => `${input.channel} × ${formatNumber(input.sensitivity)}`).join(', '), currentSensor ? currentSensor.inputs.map((input) => `${input.channel} × ${formatNumber(input.sensitivity)}`).join(', ') : null],
      ['Outputs', base.outputs.map((output) => `${output.channel} × ${formatNumber(output.gain)} from ${output.input_channels.join(', ')}`).join(', '), currentSensor ? currentSensor.outputs.map((output) => `${output.channel} × ${formatNumber(output.gain)} from ${output.input_channels.join(', ')}`).join(', ') : null],
    );
  }
  return rows;
}

function authoredRows(
  definition: PartCapability,
  materials: ReadonlyMap<string, { readonly name: string; readonly unit: string }>,
): readonly (readonly [string, string, string | null])[] {
  if (definition.type === 'manipulator') {
    const properties = definition.properties;
    return [
      ['Volume factor', formatNumber(properties.volume_factor), formatNumber(properties.volume_factor)],
      ['Precision', formatNumber(properties.precision), formatNumber(properties.precision)],
      ['Reach per cm', formatNumber(properties.reach_per_cm), formatNumber(properties.reach_per_cm)],
      ['Grip units per cm³', formatNumber(properties.grip_units_per_cm3), formatNumber(properties.grip_units_per_cm3)],
    ];
  }
  if (definition.type === 'reservoir') {
    const properties = definition.properties;
    const material = materials.get(properties.material_id);
    return [
      ['Volume factor', formatNumber(properties.volume_factor), formatNumber(properties.volume_factor)],
      ['Material', material?.name ?? properties.material_id, material?.name ?? properties.material_id],
      ['Capacity units per cm³', `${formatNumber(properties.capacity_units_per_cm3)} ${material?.unit ?? 'units'}`, `${formatNumber(properties.capacity_units_per_cm3)} ${material?.unit ?? 'units'}`],
    ];
  }
  if (definition.type === 'sensor') {
    return [
      ['Inputs', definition.properties.inputs.map((input) => `${input.channel} × ${formatNumber(input.sensitivity)}`).join(', '), definition.properties.inputs.map((input) => `${input.channel} × ${formatNumber(input.sensitivity)}`).join(', ')],
      ['Outputs', definition.properties.outputs.map((output) => `${output.channel} × ${formatNumber(output.gain)} from ${output.input_channels.join(', ')}`).join(', '), definition.properties.outputs.map((output) => `${output.channel} × ${formatNumber(output.gain)} from ${output.input_channels.join(', ')}`).join(', ')],
    ];
  }
  const properties = definition.properties;
  const material = materials.get(properties.material_id);
  return [
    ['Volume factor', formatNumber(properties.volume_factor), formatNumber(properties.volume_factor)],
    ['Material', material?.name ?? properties.material_id, material?.name ?? properties.material_id],
    ['Destination reservoir', properties.destination_reservoir_id, properties.destination_reservoir_id],
    ['Rate units per cm³ per native minute', `${formatNumber(properties.rate_units_per_cm3_per_minute)} ${material?.unit ?? 'units'}`, `${formatNumber(properties.rate_units_per_cm3_per_minute)} ${material?.unit ?? 'units'}`],
  ];
}

function attributeGroup(title: string, rows: readonly (readonly [string, string, string | null])[]): HTMLElement {
  const group = document.createElement('div');
  group.className = 'attribute-group';
  group.append(heading(title));
  for (const [label, baseline, effective] of rows) {
    const row = document.createElement('div');
    row.className = 'attribute-row';
    row.append(text(label));
    const values = document.createElement('div');
    values.className = 'attribute-values';
    values.append(text(`Baseline: ${baseline}`));
    values.append(text(effective === null ? 'Effective: not resolved' : `Effective: ${effective}`));
    row.append(values);
    group.append(row);
  }
  return group;
}

function button(label: string, action: () => void): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.addEventListener('click', action);
  return element;
}

function formatGameTime(time: { readonly day: number; readonly hour: number; readonly minute: number }): string {
  return `day ${time.day}, ${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

function heading(value: string): HTMLHeadingElement {
  const element = document.createElement('h3');
  element.textContent = value;
  return element;
}

function message(value: string): HTMLParagraphElement {
  return text(value);
}

function text(value: string): HTMLParagraphElement {
  const element = document.createElement('p');
  element.textContent = value;
  return element;
}
