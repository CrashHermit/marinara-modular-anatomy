import type { SensorCapability } from './model.js';

export interface SensorStimulus {
  readonly [channel: string]: number;
}

export interface SensorReading {
  readonly inputs: SensorStimulus;
  readonly outputs: Readonly<Record<string, number>>;
}

export function resolveSensor(capability: SensorCapability, stimulus: SensorStimulus): SensorReading {
  const sensitivities = new Map(capability.properties.inputs.map((input) => [input.channel, input.sensitivity]));
  const outputs = Object.fromEntries(capability.properties.outputs.map((output) => {
    const intensity = output.input_channels.reduce(
      (total, channel) => total + (stimulus[channel] as number) * (sensitivities.get(channel) as number),
      0,
    );
    return [output.channel, intensity * output.gain];
  }));
  return {
    inputs: structuredClone(stimulus),
    outputs,
  };
}
