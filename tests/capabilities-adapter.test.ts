import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createAnatomyService, PACKAGE_ID } from '../src/marinara/service.js';
import type {
  AnatomySubject,
  MarinaraApi,
  MarinaraChatRecord,
  MarinaraDocumentRecord,
  MarinaraPackageContext,
} from '../src/marinara/contracts.js';

interface Harness {
  readonly api: MarinaraApi;
  readonly documents: Map<string, MarinaraDocumentRecord>;
  readonly setGameTime: (game_time: { readonly day: number; readonly hour: number; readonly minute: number } | null) => void;
  readonly updates: () => number;
}

function createHarness(game_time: { readonly day: number; readonly hour: number; readonly minute: number } | null = null): Harness {
  let currentGameTime = game_time;
  let revision = 0;
  let updateCount = 0;
  const documents = new Map<string, MarinaraDocumentRecord>();
  const chat: MarinaraChatRecord = {
    id: 'chat-1',
    mode: 'game',
    characterIds: [],
    personaId: 'persona-1',
    metadata: {},
  };
  const api: MarinaraApi = {
    runtime: {
      persistence: {
        documents: {
          async getById(_package_id, id) {
            const document = documents.get(id);
            return document ? structuredClone(document) : null;
          },
          async create(input) {
            const document = { ...input, revision: ++revision };
            documents.set(input.id, structuredClone(document));
            return structuredClone(document);
          },
          async update(input) {
            const current = documents.get(input.id);
            if (!current || current.revision !== input.expectedRevision) return null;
            updateCount += 1;
            const document = { ...current, ...input, revision: ++revision };
            documents.set(input.id, structuredClone(document));
            return structuredClone(document);
          },
        },
        async withChatLock(_chat_id, operation) {
          return operation();
        },
        async getChat() {
          return {
            ...chat,
            metadata: JSON.stringify({
              gameId: 'game-1',
              gameTime: currentGameTime,
              enableAgents: true,
              activeAgentIds: [PACKAGE_ID],
            }),
          };
        },
      },
      resources: {
        async listCharacters() {
          return [];
        },
        async listPersonas() {
          return [{ id: 'persona-1', data: { name: 'Capability Subject' } }];
        },
      },
    },
    registerTool() {
      return () => undefined;
    },
    registerPromptContext() {
      return () => undefined;
    },
    async registerPrivilegedRoutes() {
      return () => undefined;
    },
  };
  return {
    api,
    documents,
    setGameTime(value) {
      currentGameTime = value;
    },
    updates: () => updateCount,
  };
}

const subject: AnatomySubject = { kind: 'persona', id: 'persona-1' };
const context = (api: MarinaraApi): MarinaraPackageContext => ({ api, package: { id: PACKAGE_ID, version: 'test' } });

test('adapter persists and reloads settled capability quantities and prompt context', async () => {
  const harness = createHarness(null);
  const service = createAnatomyService(context(harness.api));
  await service.initialize('chat-1', subject);
  await service.installCapabilityDemo('chat-1', subject);
  harness.setGameTime({ day: 1, hour: 8, minute: 0 });
  await service.advanceCapabilities('chat-1', subject);
  harness.setGameTime({ day: 1, hour: 9, minute: 40 });
  const advanced = await service.advanceCapabilities('chat-1', subject);
  const reservoir = advanced.capabilities?.reservoir_quantities['organ.demo.reservoir'] ?? 0;
  assert.ok(Math.abs(reservoir - 1.2566370614359172) < 1e-12);
  const updates = harness.updates();
  const sameTime = await service.advanceCapabilities('chat-1', subject);
  assert.equal(sameTime.capabilities?.reservoir_quantities['organ.demo.reservoir'], reservoir);
  assert.equal(harness.updates(), updates);
  const reloaded = await createAnatomyService(context(harness.api)).read('chat-1', subject);
  assert.equal(reloaded.capabilities?.reservoir_quantities['organ.demo.reservoir'], reservoir);
  const prompt = await service.contributePrompt({ chatId: 'chat-1', mode: 'game', chatMeta: {} });
  assert.match(prompt ?? '', /organ\.demo\.reservoir/);
  assert.match(prompt ?? '', /1\.256637/);
});
test('adapter projects generated baseline and effective descriptions without persisting them', async () => {
  const harness = createHarness({ day: 1, hour: 8, minute: 0 });
  const service = createAnatomyService(context(harness.api));
  const initialized = await service.initialize('chat-1', subject);
  assert.match(initialized.baseline_descriptions?.find((item) => item.part_id === 'arm.left')?.text ?? '', /length 60 cm/);
  assert.match(initialized.effective_descriptions?.find((item) => item.part_id === 'arm.left')?.text ?? '', /length 60 cm/);
  const beforeReads = harness.updates();
  const stored = [...harness.documents.values()][0]!;
  const storedData = stored.data as { readonly anatomy: { readonly parts: readonly Record<string, unknown>[] } };
  assert.equal('description' in storedData.anatomy.parts[0]!, false);
  assert.equal('baseline_descriptions' in storedData, false);
  assert.equal(harness.updates(), beforeReads);

  await service.applyEffect('chat-1', subject, 'arm.left', 'temporary-arm-growth');
  const active = await service.read('chat-1', subject);
  assert.match(active.baseline_descriptions?.find((item) => item.part_id === 'arm.left')?.text ?? '', /length 60 cm/);
  assert.match(active.effective_descriptions?.find((item) => item.part_id === 'arm.left')?.text ?? '', /length 63 cm/);
  harness.setGameTime({ day: 1, hour: 10, minute: 0 });
  const expired = await service.read('chat-1', subject);
  assert.match(expired.effective_descriptions?.find((item) => item.part_id === 'arm.left')?.text ?? '', /length 60 cm/);
  assert.equal(harness.updates(), beforeReads + 1);

  const baselineHarness = createHarness(null);
  const baselineService = createAnatomyService(context(baselineHarness.api));
  const baselineBody = await baselineService.initialize('chat-1', subject);
  assert.ok(baselineBody.baseline_descriptions);
  assert.equal(baselineBody.effective_descriptions, null);
  const prompt = await baselineService.contributePrompt({ chatId: 'chat-1', mode: 'game', chatMeta: {} });
  assert.match(prompt ?? '', /permanent baseline; not resolved against native time/);
  assert.match(prompt ?? '', /Approximate bounding dimensions/);
  assert.equal(baselineHarness.updates(), 0);
});


test('anatomy mutations settle installed capabilities before changing geometry', async () => {
  const harness = createHarness({ day: 1, hour: 8, minute: 0 });
  const service = createAnatomyService(context(harness.api));
  await service.initialize('chat-1', subject);
  await service.installCapabilityDemo('chat-1', subject);
  await service.advanceCapabilities('chat-1', subject);
  harness.setGameTime({ day: 1, hour: 9, minute: 0 });
  await service.applyEffect('chat-1', subject, 'arm.left', 'temporary-arm-growth');
  const body = await service.read('chat-1', subject);
  const reservoir = body.capabilities?.reservoir_quantities['organ.demo.reservoir'] ?? 0;
  assert.ok(Math.abs(reservoir - (60 * 0.5235987755982988 * 4 * 3 * 2 * 0.001)) < 1e-12);
});

test('capability advancement requires native numeric game time', async () => {
  const harness = createHarness(null);
  const service = createAnatomyService(context(harness.api));
  await service.initialize('chat-1', subject);
  await service.installCapabilityDemo('chat-1', subject);
  await assert.rejects(() => service.advanceCapabilities('chat-1', subject), /Initialize the native Game clock before advancing capabilities/);
});
