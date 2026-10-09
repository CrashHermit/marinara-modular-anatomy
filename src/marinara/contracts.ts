import type {
  Anatomy,
  AnatomyEffectDefinition,
  BodyPart,
  GameTime,
  TemporaryStatus,
} from '../index.js';

export interface MarinaraChatRecord {
  readonly id: string;
  readonly mode: string;
  readonly characterIds: readonly string[];
  readonly personaId: string | null;
  readonly metadata: unknown;
}

export interface MarinaraCharacterRecord {
  readonly id: string;
  readonly data: unknown;
}

export interface MarinaraPersonaRecord {
  readonly id: string;
  readonly data: unknown;
}

export interface MarinaraDocumentRecord {
  readonly id: string;
  readonly packageId: string;
  readonly kind: string;
  readonly name: string;
  readonly description: string;
  readonly data: unknown;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MarinaraDocumentStore {
  getById(packageId: string, id: string): Promise<MarinaraDocumentRecord | null>;
  create(input: {
    readonly id: string;
    readonly packageId: string;
    readonly kind: string;
    readonly name: string;
    readonly description: string;
    readonly data: unknown;
    readonly createdAt: string;
    readonly updatedAt: string;
  }): Promise<MarinaraDocumentRecord>;
  update(input: {
    readonly id: string;
    readonly packageId: string;
    readonly expectedRevision: number;
    readonly name: string;
    readonly description: string;
    readonly data: unknown;
    readonly updatedAt: string;
  }): Promise<MarinaraDocumentRecord | null>;
}

export interface MarinaraPersistence {
  readonly documents: MarinaraDocumentStore;
  withChatLock<T>(chat_id: string, operation: () => Promise<T>): Promise<T>;
  getChat(chat_id: string): Promise<MarinaraChatRecord | null>;
}

export interface MarinaraResources {
  listCharacters(character_ids?: readonly string[]): Promise<readonly MarinaraCharacterRecord[]>;
  listPersonas(persona_ids?: readonly string[]): Promise<readonly MarinaraPersonaRecord[]>;
}

export interface MarinaraToolRegistration {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
  readonly handler: (args: Record<string, unknown>, context: MarinaraToolCall) => unknown | Promise<unknown>;
}

export interface MarinaraToolCall {
  readonly chatId: string;
  readonly packageId: string;
  readonly toolName: string;
}

export interface MarinaraPromptRequest {
  readonly chatId: string;
  readonly chatMeta: Record<string, unknown>;
  readonly mode: string;
  readonly targetCharacterIds?: readonly string[];
  readonly personaId?: string | null;
  readonly placedAgentTypes?: readonly string[];
  readonly wrapFormat?: 'xml' | 'markdown' | 'none';
}

export interface MarinaraApi {
  readonly runtime: {
    readonly persistence: MarinaraPersistence;
    readonly resources: MarinaraResources;
  };
  registerTool(registration: MarinaraToolRegistration): () => void;
  registerPromptContext(contributor: (request: MarinaraPromptRequest) => unknown | Promise<unknown>): () => void;
  registerPrivilegedRoutes(
    routes: (app: unknown) => unknown | Promise<unknown>,
    options: { readonly prefix: string },
  ): Promise<() => void>;
}

export interface MarinaraPackageContext {
  readonly api: MarinaraApi;
  readonly package: {
    readonly id: string;
    readonly version: string;
  };
}

export type AnatomySubject =
  | { readonly kind: 'character'; readonly id: string }
  | { readonly kind: 'persona'; readonly id: string };

export type AnatomySubjectInfo = AnatomySubject & {
  readonly name: string;
};

export interface AnatomyDocumentData {
  readonly game_id: string;
  readonly subject: AnatomySubject;
  readonly template_id: string;
  readonly anatomy: Anatomy;
}

export interface AnatomyContext {
  readonly enabled: boolean;
  readonly game_id: string;
  readonly game_time: GameTime | null;
  readonly subjects: readonly AnatomySubjectInfo[];
  readonly effects: readonly AnatomyEffectDefinition[];
}

export type AnatomyBodyState = 'uninitialized' | 'clock_uninitialized' | 'ready';

export interface AnatomyBody {
  readonly state: AnatomyBodyState;
  readonly game_id: string;
  readonly subject: AnatomySubjectInfo;
  readonly template_id: string | null;
  readonly game_time: GameTime | null;
  readonly permanent: Anatomy | null;
  readonly effective_parts: readonly BodyPart[] | null;
  readonly effects: readonly AnatomyEffectDefinition[];
  readonly statuses: readonly TemporaryStatus[];
}

export interface AnatomyStatusRemovalResult {
  readonly status_id: string;
  readonly body: AnatomyBody;
}
