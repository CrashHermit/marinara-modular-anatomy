import { randomUUID } from 'node:crypto';
import datasetJson from '../../data/humanoid-basic.json' with { type: 'json' };
import effectsJson from '../../data/anatomy-effects.json' with { type: 'json' };
import {
  applyAnatomyEffect,
  createAnatomy,
  removeStatus,
  resolveAnatomy,
} from '../index.js';
import type {
  Anatomy,
  AnatomyEffectDefinition,
  BodyDataset,
  GameTime,
  PermanentAnatomyEffectDefinition,
  TemporaryAnatomyEffectDefinition,
} from '../index.js';
import type {
  AnatomyBody,
  AnatomyContext,
  AnatomyDocumentData,
  AnatomyStatusRemovalResult,
  AnatomySubject,
  AnatomySubjectInfo,
  MarinaraApi,
  MarinaraChatRecord,
  MarinaraDocumentRecord,
  MarinaraPackageContext,
  MarinaraPromptRequest,
} from './contracts.js';
import { upgradeAnatomyDocumentData } from './anatomy-document-upgrade.js';

export const PACKAGE_ID = 'modular-anatomy';
export const DOCUMENT_KIND = 'character-anatomy';

type StoredAnatomyDocument = MarinaraDocumentRecord & { readonly data: AnatomyDocumentData };

const dataset = datasetJson as BodyDataset;
const effects = effectsJson as readonly AnatomyEffectDefinition[];

export class AnatomyService {
  readonly api: MarinaraApi;
  readonly package_id: string;

  constructor(api: MarinaraApi, package_id = PACKAGE_ID) {
    this.api = api;
    this.package_id = package_id;
  }

  async getContext(chat_id: string): Promise<AnatomyContext> {
    const chat = await this.requireChat(chat_id);
    const metadata = readMetadata(chat.metadata);
    const game_id = metadata.gameId as string;
    const game_time = (metadata.gameTime as GameTime | undefined) ?? null;
    return {
      enabled: isFeatureEnabled(chat, metadata, this.package_id),
      game_id,
      game_time,
      subjects: await this.subjects(chat),
      effects,
    };
  }

  async initialize(chat_id: string, subject: AnatomySubject): Promise<AnatomyBody> {
    return this.api.runtime.persistence.withChatLock(chat_id, async () => {
      const context = await this.enabledContext(chat_id);
      const subject_info = findSubject(context.subjects, subject);
      const document_id = anatomyDocumentId(context.game_id, subject);
      const current = await this.getDocument(document_id);
      if (current) return bodyFromDocument(asStoredDocument(current), subject_info, context.game_time, effects);

      const now = new Date().toISOString();
      const data: AnatomyDocumentData = {
        game_id: context.game_id,
        subject,
        template_id: dataset.template_id,
        anatomy: createAnatomy(dataset.parts),
      };
      const created = await this.api.runtime.persistence.documents.create({
        id: document_id,
        packageId: this.package_id,
        kind: DOCUMENT_KIND,
        name: `Anatomy ${context.game_id} ${subject.kind}:${subject.id}`,
        description: 'Persistent modular anatomy state.',
        data,
        createdAt: now,
        updatedAt: now,
      });
      return bodyFromDocument(asStoredDocument(created), subject_info, context.game_time, effects);
    });
  }

  async read(chat_id: string, subject: AnatomySubject): Promise<AnatomyBody> {
    const context = await this.enabledContext(chat_id);
    const subject_info = findSubject(context.subjects, subject);
    const current = await this.getDocument(anatomyDocumentId(context.game_id, subject));
    if (!current) {
      return {
        state: 'uninitialized',
        game_id: context.game_id,
        subject: subject_info,
        template_id: null,
        game_time: context.game_time,
        permanent: null,
        effective_parts: null,
        effects,
        statuses: [],
      };
    }
    return bodyFromDocument(asStoredDocument(current), subject_info, context.game_time, effects);
  }

  async applyEffect(
    chat_id: string,
    subject: AnatomySubject,
    part_id: string,
    effect_id: string,
  ): Promise<{ readonly status_id: string | null; readonly body: AnatomyBody }> {
    return this.api.runtime.persistence.withChatLock(chat_id, async () => {
      const context = await this.enabledContext(chat_id);
      const subject_info = findSubject(context.subjects, subject);
      const current = await this.requireDocument(context.game_id, subject);
      const definition = effects.find((effect) => effect.effect_id === effect_id) as AnatomyEffectDefinition;
      const status_id = definition.lifetime.kind === 'temporary' ? randomUUID() : null;
      let anatomy: Anatomy;
      if (definition.lifetime.kind === 'temporary') {
        const temporaryDefinition = definition as TemporaryAnatomyEffectDefinition;
        anatomy = applyAnatomyEffect(current.data.anatomy, temporaryDefinition, part_id, {
          kind: 'temporary',
          now: requireGameTime(context.game_time),
          status_id: status_id as string,
        });
      } else {
        const permanentDefinition = definition as PermanentAnatomyEffectDefinition;
        anatomy = applyAnatomyEffect(current.data.anatomy, permanentDefinition, part_id);
      }
      const updated = await this.save(current, { ...current.data, anatomy });
      return {
        status_id,
        body: bodyFromDocument(updated, subject_info, context.game_time, effects),
      };
    });
  }

  async removeStatus(
    chat_id: string,
    subject: AnatomySubject,
    status_id: string,
  ): Promise<AnatomyStatusRemovalResult> {
    return this.api.runtime.persistence.withChatLock(chat_id, async () => {
      const context = await this.enabledContext(chat_id);
      const subject_info = findSubject(context.subjects, subject);
      const current = await this.requireDocument(context.game_id, subject);
      const anatomy = removeStatus(current.data.anatomy, status_id);
      const updated = await this.save(current, { ...current.data, anatomy });
      return {
        status_id,
        body: bodyFromDocument(updated, subject_info, context.game_time, effects),
      };
    });
  }

  async contributePrompt(request: MarinaraPromptRequest): Promise<string | null> {
    if (request.mode !== 'game') return null;
    const context = await this.getContext(request.chatId);
    if (!context.enabled) return null;

    const blocks: string[] = [
      'Modular Anatomy (deterministic read-only context):',
      `Native game time: ${context.game_time ? formatGameTime(context.game_time) : 'not initialized; effective values are not resolved.'}`,
      `Named effects available for explicit invocation: ${context.effects.map((effect) => effect.effect_id).join(', ')}`,
    ];
    for (const subject of context.subjects) {
      const current = await this.getDocument(anatomyDocumentId(context.game_id, subject));
      if (!current) continue;
      const stored = asStoredDocument(current);
      const anatomy = stored.data.anatomy;
      const parts = context.game_time ? resolveAnatomy(anatomy, context.game_time) : anatomy.parts;
      blocks.push(
        JSON.stringify({
          subject,
          template_id: stored.data.template_id,
          values: context.game_time ? 'effective' : 'permanent baseline; not resolved against native time',
          parts,
          statuses: anatomy.statuses,
        }),
      );
    }
    return blocks.join('\n');
  }

  private async enabledContext(chat_id: string): Promise<AnatomyContext> {
    const context = await this.getContext(chat_id);
    if (!context.enabled) throw new Error('Modular Anatomy is unavailable until enabled in an active Game.');
    return context;
  }

  private async requireChat(chat_id: string): Promise<MarinaraChatRecord> {
    const chat = await this.api.runtime.persistence.getChat(chat_id);
    if (!chat) throw new Error(`Chat ${chat_id} was not found.`);
    return chat;
  }

  private async subjects(chat: MarinaraChatRecord): Promise<readonly AnatomySubjectInfo[]> {
    const characters = await this.api.runtime.resources.listCharacters(chat.characterIds);
    const personas = chat.personaId
      ? await this.api.runtime.resources.listPersonas([chat.personaId])
      : [];
    return [
      ...characters.map((character) => ({
        kind: 'character' as const,
        id: character.id,
        name: resourceName(character.data),
      })),
      ...personas.map((persona) => ({
        kind: 'persona' as const,
        id: persona.id,
        name: resourceName(persona.data),
      })),
    ];
  }

  private async getDocument(id: string): Promise<MarinaraDocumentRecord | null> {
    return this.api.runtime.persistence.documents.getById(this.package_id, id);
  }

  private async requireDocument(game_id: string, subject: AnatomySubject): Promise<StoredAnatomyDocument> {
    const current = await this.getDocument(anatomyDocumentId(game_id, subject));
    if (!current) throw new Error('Initialize the anatomy before applying or removing a status.');
    return asStoredDocument(current);
  }

  private async save(
    current: StoredAnatomyDocument,
    data: AnatomyDocumentData,
  ): Promise<StoredAnatomyDocument> {
    const updated = await this.api.runtime.persistence.documents.update({
      id: current.id,
      packageId: this.package_id,
      expectedRevision: current.revision,
      name: current.name,
      description: current.description,
      data,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) throw new Error('Anatomy storage conflict; reload the body and try the action again.');
    return asStoredDocument(updated);
  }
}

export function createAnatomyService(context: MarinaraPackageContext): AnatomyService {
  return new AnatomyService(context.api, context.package.id);
}

export function anatomyDocumentId(game_id: string, subject: AnatomySubject): string {
  return `anatomy:${JSON.stringify([game_id, subject.kind, subject.id])}`;
}

function asStoredDocument(document: MarinaraDocumentRecord): StoredAnatomyDocument {
  const data = typeof document.data === 'string'
    ? JSON.parse(document.data) as AnatomyDocumentData
    : document.data as AnatomyDocumentData;
  return { ...document, data: upgradeAnatomyDocumentData(data, dataset) };
}

function bodyFromDocument(
  document: StoredAnatomyDocument,
  subject: AnatomySubjectInfo,
  game_time: GameTime | null,
  available_effects: readonly AnatomyEffectDefinition[],
): AnatomyBody {
  return {
    state: game_time ? 'ready' : 'clock_uninitialized',
    game_id: document.data.game_id,
    subject,
    template_id: document.data.template_id,
    game_time,
    permanent: document.data.anatomy,
    effective_parts: game_time ? resolveAnatomy(document.data.anatomy, game_time) : null,
    effects: available_effects,
    statuses: document.data.anatomy.statuses,
  };
}

function readMetadata(metadata: unknown): Record<string, unknown> {
  return typeof metadata === 'string' ? JSON.parse(metadata) as Record<string, unknown> : metadata as Record<string, unknown>;
}

function isFeatureEnabled(chat: MarinaraChatRecord, metadata: Record<string, unknown>, package_id: string): boolean {
  return chat.mode === 'game'
    && metadata.enableAgents === true
    && (metadata.activeAgentIds as readonly string[]).includes(package_id);
}
function findSubject(subjects: readonly AnatomySubjectInfo[], subject: AnatomySubject): AnatomySubjectInfo {
  return subjects.find((candidate) => candidate.kind === subject.kind && candidate.id === subject.id) as AnatomySubjectInfo;
}

function resourceName(data: unknown): string {
  const record = typeof data === 'string'
    ? JSON.parse(data) as { readonly name: string }
    : data as { readonly name: string };
  return record.name;
}

function requireGameTime(game_time: GameTime | null): GameTime {
  if (!game_time) throw new Error('Initialize the native Game clock before applying a temporary anatomy effect.');
  return game_time;
}

function formatGameTime(time: GameTime): string {
  return `day ${time.day}, ${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
}
