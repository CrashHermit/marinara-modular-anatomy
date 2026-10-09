import { createAnatomyService, PACKAGE_ID } from './service.js';
import type {
  AnatomySubject,
  MarinaraPackageContext,
  MarinaraPromptRequest,
  MarinaraToolCall,
  MarinaraToolRegistration,
} from './contracts.js';

interface RouteRequest {
  readonly query?: Record<string, unknown>;
  readonly body?: Record<string, unknown>;
}

interface RouteReply {
  status(code: number): { send(payload: unknown): unknown };
}

type RouteHandler = (request: RouteRequest, reply: RouteReply) => unknown | Promise<unknown>;

interface RouteRegistrar {
  get(path: string, handler: RouteHandler): void;
  post(path: string, handler: RouteHandler): void;
}

export async function activate(context: MarinaraPackageContext): Promise<() => void> {
  const service = createAnatomyService(context);
  const cleanups: Array<() => void> = [];
  for (const registration of toolRegistrations(service)) {
    cleanups.push(context.api.registerTool(registration));
  }
  cleanups.push(context.api.registerPromptContext((request) => service.contributePrompt(request)));
  cleanups.push(await context.api.registerPrivilegedRoutes((rawApp) => {
    const app = rawApp as RouteRegistrar;
    app.get('/context', (request, reply) => route(reply, () => service.getContext(stringQuery(request, 'chat_id'))));
    app.get('/body', (request, reply) => route(reply, () => service.read(
      stringQuery(request, 'chat_id'),
      subjectFrom(request.query ?? {}),
    )));
    app.post('/body/initialize', (request, reply) => route(reply, () => service.initialize(
      stringBody(request, 'chat_id'),
      subjectFrom(request.body ?? {}),
    )));
    app.post('/body/effects', (request, reply) => route(reply, () => service.applyEffect(
      stringBody(request, 'chat_id'),
      subjectFrom(request.body ?? {}),
      stringBody(request, 'part_id'),
      stringBody(request, 'effect_id'),
    )));
    app.post('/body/capabilities/install-demo', (request, reply) => route(reply, () => service.installCapabilityDemo(
      stringBody(request, 'chat_id'),
      subjectFrom(request.body ?? {}),
    )));
    app.post('/body/capabilities/advance', (request, reply) => route(reply, () => service.advanceCapabilities(
      stringBody(request, 'chat_id'),
      subjectFrom(request.body ?? {}),
    )));
    app.post('/body/statuses/remove', (request, reply) => route(reply, () => service.removeStatus(
      stringBody(request, 'chat_id'),
      subjectFrom(request.body ?? {}),
      stringBody(request, 'status_id'),
    )));
  }, { prefix: `/api/${PACKAGE_ID}` }));

  return () => {
    for (const cleanup of cleanups.reverse()) cleanup();
  };
}

function toolRegistrations(service: ReturnType<typeof createAnatomyService>): readonly MarinaraToolRegistration[] {
  const subjectProperties = {
    subject_kind: { type: 'string', enum: ['character', 'persona'] },
    subject_id: { type: 'string' },
  };
  return [
    {
      name: 'initialize_body',
      description: 'Initialize the selected character or persona with the authored modular anatomy template.',
      parameters: {
        type: 'object',
        properties: subjectProperties,
        required: ['subject_kind', 'subject_id'],
        additionalProperties: false,
      },
      handler: (args, call) => service.initialize(call.chatId, subjectFrom(args)),
    },
    {
      name: 'read_body',
      description: 'Read the selected subject anatomy baseline and effective native-time projection.',
      parameters: {
        type: 'object',
        properties: subjectProperties,
        required: ['subject_kind', 'subject_id'],
        additionalProperties: false,
      },
      handler: (args, call) => service.read(call.chatId, subjectFrom(args)),
    },
    {
      name: 'apply_effect',
      description: 'Apply one authored deterministic anatomy effect to a selected part after the game rules resolve it.',
      parameters: {
        type: 'object',
        properties: {
          ...subjectProperties,
          part_id: { type: 'string', enum: ['arm.left', 'arm.right'] },
          effect_id: { type: 'string', enum: ['temporary-arm-growth', 'temporary-scales', 'permanent-composition-shift'] },
        },
        required: ['subject_kind', 'subject_id', 'part_id', 'effect_id'],
        additionalProperties: false,
      },
      handler: (args, call) => service.applyEffect(call.chatId, subjectFrom(args), stringArg(args, 'part_id'), stringArg(args, 'effect_id')),
    },
    {
      name: 'install_capability_demo',
      description: 'Add the fictional manipulator, producer, and reservoir demonstration capabilities without replacing existing anatomy.',
      parameters: {
        type: 'object',
        properties: subjectProperties,
        required: ['subject_kind', 'subject_id'],
        additionalProperties: false,
      },
      handler: (args, call) => service.installCapabilityDemo(call.chatId, subjectFrom(args)),
    },
    {
      name: 'advance_capabilities',
      description: 'Settle installed capability production to the existing native game time without advancing the game clock.',
      parameters: {
        type: 'object',
        properties: subjectProperties,
        required: ['subject_kind', 'subject_id'],
        additionalProperties: false,
      },
      handler: (args, call) => service.advanceCapabilities(call.chatId, subjectFrom(args)),
    },
    {
      name: 'remove_status',
      description: 'Remove one selected temporary anatomy status and reveal the current baseline or remaining statuses.',
      parameters: {
        type: 'object',
        properties: {
          ...subjectProperties,
          status_id: { type: 'string' },
        },
        required: ['subject_kind', 'subject_id', 'status_id'],
        additionalProperties: false,
      },
      handler: (args, call) => service.removeStatus(call.chatId, subjectFrom(args), stringArg(args, 'status_id')),
    },
  ] satisfies readonly MarinaraToolRegistration[];
}

function subjectFrom(values: Record<string, unknown>): AnatomySubject {
  return {
    kind: stringValue(values, 'subject_kind') as AnatomySubject['kind'],
    id: stringValue(values, 'subject_id'),
  };
}

function stringQuery(request: RouteRequest, key: string): string {
  return stringValue(request.query ?? {}, key);
}

function stringBody(request: RouteRequest, key: string): string {
  return stringValue(request.body ?? {}, key);
}

function stringArg(args: Record<string, unknown>, key: string): string {
  return stringValue(args, key);
}

function stringValue(values: Record<string, unknown>, key: string): string {
  return values[key] as string;
}

async function route(reply: RouteReply, action: () => unknown | Promise<unknown>): Promise<unknown> {
  try {
    return await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('storage conflict') ? 409 : message.includes('unavailable') ? 403 : 400;
    return reply.status(status).send({ error: message });
  }
}

export type { MarinaraToolCall };
