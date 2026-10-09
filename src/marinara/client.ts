import type { AnatomyBody, AnatomyContext, AnatomySubjectInfo } from './contracts.js';
import { partsTable } from './body-parts-view.js';
import type { TemporaryStatus } from '../index.js';

interface HostCapabilityProps {
  readonly chatId?: string;
  readonly enabledForChat?: boolean;
  readonly onEnabledForChatChange?: (enabled: boolean) => void;
  readonly onClose?: () => void;
  readonly [key: string]: unknown;
}

class ModularAnatomyElement extends HTMLElement {
  private props: HostCapabilityProps | null = null;
  private context: AnatomyContext | null = null;
  private body: AnatomyBody | null = null;
  private subject: AnatomySubjectInfo | null = null;
  private requestGeneration = 0;
  private connected = false;

  set capabilityProps(value: HostCapabilityProps) {
    const previousChatId = this.props?.chatId;
    this.props = value;
    if (this.connected && previousChatId !== value.chatId) void this.refresh();
    else if (this.connected) this.render();
  }

  get capabilityProps(): HostCapabilityProps | null {
    return this.props;
  }

  connectedCallback(): void {
    this.connected = true;
    this.addEventListener('marinara-capability-props', this.handlePropsEvent);
    this.render();
    if (this.props?.chatId) void this.refresh();
  }

  disconnectedCallback(): void {
    this.connected = false;
    this.removeEventListener('marinara-capability-props', this.handlePropsEvent);
  }

  private readonly handlePropsEvent = (): void => {
    if (this.props?.chatId) void this.refresh();
  };

  private async refresh(): Promise<void> {
    const chatId = this.props?.chatId;
    if (!chatId) {
      this.context = null;
      this.body = null;
      this.render();
      return;
    }
    const generation = ++this.requestGeneration;
    try {
      const context = await requestJson<AnatomyContext>(`/api/modular-anatomy/context?chat_id=${encodeURIComponent(chatId)}`);
      if (generation !== this.requestGeneration) return;
      this.context = context;
      this.subject = context.subjects.find((candidate) => candidate === this.subject || (candidate.kind === this.subject?.kind && candidate.id === this.subject?.id)) ?? context.subjects[0] ?? null;
      this.body = this.subject && context.enabled
        ? await requestJson<AnatomyBody>(bodyUrl(chatId, this.subject))
        : null;
      if (generation !== this.requestGeneration) return;
      this.render();
    } catch (error) {
      if (generation !== this.requestGeneration) return;
      this.body = null;
      this.renderError(error instanceof Error ? error.message : String(error));
    }
  }

  private async initialize(): Promise<void> {
    if (!this.props?.chatId || !this.subject) return;
    await this.mutate('/body/initialize', { subject_kind: this.subject.kind, subject_id: this.subject.id });
  }

  private async applyEffect(part_id: string, effect_id: string): Promise<void> {
    if (!this.props?.chatId || !this.subject) return;
    await this.mutate('/body/effects', {
      subject_kind: this.subject.kind,
      subject_id: this.subject.id,
      part_id,
      effect_id,
    });
  }

  private async removeStatus(status_id: string): Promise<void> {
    if (!this.props?.chatId || !this.subject) return;
    await this.mutate('/body/statuses/remove', {
      subject_kind: this.subject.kind,
      subject_id: this.subject.id,
      status_id,
    });
  }

  private async mutate(path: string, body: Record<string, unknown>): Promise<void> {
    try {
      await requestJson<unknown>(`/api/modular-anatomy${path}`, {
        method: 'POST',
        body: JSON.stringify({ chat_id: this.props?.chatId, ...body }),
        headers: { 'content-type': 'application/json' },
      });
      await this.refresh();
    } catch (error) {
      this.renderError(error instanceof Error ? error.message : String(error));
    }
  }

  private render(): void {
    const root = document.createElement('div');
    root.className = 'modular-anatomy';
    root.append(styleNode());
    const header = document.createElement('div');
    header.className = 'header';
    const title = document.createElement('h2');
    title.textContent = 'Modular Anatomy';
    header.append(title);
    if (this.props?.onClose) {
      const back = document.createElement('button');
      back.type = 'button';
      back.textContent = 'Back to Agents';
      back.addEventListener('click', () => this.props?.onClose?.());
      header.append(back);
    }
    root.append(header);

    if (!this.props?.chatId) {
      root.append(message('Open this detail panel from an active Game.'));
      this.replaceChildren(root);
      return;
    }

    const controls = document.createElement('div');
    controls.className = 'controls';
    const enabled = this.props.enabledForChat === true;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.textContent = enabled ? 'Disable for this Game' : 'Enable for this Game';
    toggle.addEventListener('click', () => this.props?.onEnabledForChatChange?.(!enabled));
    controls.append(toggle);
    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.textContent = 'Refresh';
    refresh.addEventListener('click', () => void this.refresh());
    controls.append(refresh);
    root.append(controls);

    if (!this.context) {
      root.append(message('Loading native Game context…'));
      this.replaceChildren(root);
      return;
    }
    root.append(message(this.context.game_time ? `Native time: day ${this.context.game_time.day}, ${String(this.context.game_time.hour).padStart(2, '0')}:${String(this.context.game_time.minute).padStart(2, '0')}` : 'Native numeric game time is not initialized. Use Marinara’s existing Game time control before applying temporary effects.'));
    if (!this.context.enabled) {
      root.append(message('Enable Modular Anatomy for this Game to read or change anatomy.'));
      this.replaceChildren(root);
      return;
    }
    if (!this.context.subjects.length) {
      root.append(message('This Game has no character or persona subject available.'));
      this.replaceChildren(root);
      return;
    }

    const subjectLabel = document.createElement('label');
    subjectLabel.textContent = 'Subject';
    const subjectSelect = document.createElement('select');
    for (const candidate of this.context.subjects) {
      const option = document.createElement('option');
      option.value = `${candidate.kind}:${candidate.id}`;
      option.textContent = `${candidate.name} (${candidate.kind})`;
      option.selected = candidate.kind === this.subject?.kind && candidate.id === this.subject?.id;
      subjectSelect.append(option);
    }
    subjectSelect.addEventListener('change', () => {
      const selected = this.context?.subjects.find((candidate) => `${candidate.kind}:${candidate.id}` === subjectSelect.value);
      if (selected) {
        this.subject = selected;
        void this.refresh();
      }
    });
    subjectLabel.append(subjectSelect);
    root.append(subjectLabel);

    if (!this.body || this.body.state === 'uninitialized') {
      const initialize = document.createElement('button');
      initialize.type = 'button';
      initialize.textContent = 'Initialize authored body template';
      initialize.addEventListener('click', () => void this.initialize());
      root.append(initialize);
      this.replaceChildren(root);
      return;
    }
    root.append(message(`Template: ${this.body.template_id ?? 'not initialized'}`));
    if (this.body.state === 'clock_uninitialized') root.append(message('Baseline is available; effective temporary values are not resolved until native numeric time exists.'));
    root.append(effectControls(this.body, (part_id, effect_id) => void this.applyEffect(part_id, effect_id)));
    root.append(statusControls(this.body.statuses, this.body.game_time, (status_id) => void this.removeStatus(status_id)));
    root.append(partsTable(this.body));
    this.replaceChildren(root);
  }

  private renderError(error: string): void {
    const root = document.createElement('div');
    root.append(styleNode());
    root.append(message(`Modular Anatomy error: ${error}`));
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Retry';
    retry.addEventListener('click', () => void this.refresh());
    root.append(retry);
    this.replaceChildren(root);
  }
}

function effectControls(body: AnatomyBody, apply: (part_id: string, effect_id: string) => void): HTMLElement {
  const section = document.createElement('section');
  section.append(heading('Apply authored effect'));
  const part = select('Part', body.effects[0]?.eligible_part_ids ?? []);
  const effect = document.createElement('select');
  effect.setAttribute('aria-label', 'Effect');
  for (const definition of body.effects) {
    const option = document.createElement('option');
    option.value = definition.effect_id;
    option.textContent = `${definition.name}: ${definition.description}`;
    effect.append(option);
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Apply';
  button.addEventListener('click', () => apply(part.value, effect.value));
  section.append(part, effect, button);
  return section;
}

function statusControls(
  statuses: readonly TemporaryStatus[],
  gameTime: { readonly day: number; readonly hour: number; readonly minute: number } | null,
  remove: (status_id: string) => void,
): HTMLElement {
  const section = document.createElement('section');
  section.append(heading('Temporary statuses'));
  if (!statuses.length) section.append(message('None stored.'));
  for (const status of statuses) {
    const expiry = status.expires_at ? ` until ${formatGameTime(status.expires_at)}` : ' with no expiry';
    const expired = gameTime !== null && status.expires_at !== null && compareGameTime(gameTime, status.expires_at) >= 0;
    const state = status.expires_at === null ? 'Active' : expired ? 'Expired' : 'Active';
    const row = document.createElement('div');
    row.className = `status ${expired ? 'expired' : 'active'}`;
    row.append(text(`${state} · ${status.part_id} · starts ${formatGameTime(status.starts_at)}${expiry}`));
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Remove';
    button.addEventListener('click', () => remove(status.status_id));
    row.append(button);
    section.append(row);
  }
  return section;
}


function formatGameTime(time: { readonly day: number; readonly hour: number; readonly minute: number }): string {
  return `day ${time.day}, ${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
}

function compareGameTime(
  left: { readonly day: number; readonly hour: number; readonly minute: number },
  right: { readonly day: number; readonly hour: number; readonly minute: number },
): number {
  return (left.day - right.day) * 1440 + (left.hour - right.hour) * 60 + left.minute - right.minute;
}



function select(label: string, values: readonly string[]): HTMLSelectElement {
  const element = document.createElement('select');
  element.setAttribute('aria-label', label);
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    element.append(option);
  }
  return element;
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

function styleNode(): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = `
    .modular-anatomy { box-sizing: border-box; color: inherit; display: grid; gap: 0.75rem; font: inherit; max-height: 100%; overflow-y: auto; padding: 1rem; }
    .modular-anatomy .header { align-items: center; display: flex; gap: 0.75rem; justify-content: space-between; }
    .modular-anatomy .controls, .modular-anatomy section, .modular-anatomy article, .modular-anatomy .attribute-group { display: grid; gap: 0.5rem; }
    .modular-anatomy .part-card { border: 1px solid var(--border); border-radius: 0.5rem; padding: 0.75rem; }
    .modular-anatomy .attribute-row { display: grid; gap: 0.25rem; grid-template-columns: minmax(7rem, 0.35fr) minmax(0, 1fr); }
    .modular-anatomy .attribute-row > p { margin: 0; font-weight: 600; }
    .modular-anatomy .attribute-values { display: grid; gap: 0.15rem; }
    .modular-anatomy .attribute-values p { margin: 0; }
    .modular-anatomy button, .modular-anatomy select { color: inherit; background: var(--surface); border: 1px solid var(--border); border-radius: 0.35rem; padding: 0.4rem; }
    .modular-anatomy pre { overflow: auto; color: inherit; opacity: 0.9; white-space: pre-wrap; }
    .modular-anatomy .part-index { margin: 0; padding-left: 1.25rem; }
    .modular-anatomy .status { align-items: center; display: flex; gap: 0.5rem; justify-content: space-between; }
    .modular-anatomy .status.expired { opacity: 0.7; }
  `;
  return style;
}

function bodyUrl(chatId: string, subject: AnatomySubjectInfo): string {
  return `/api/modular-anatomy/body?chat_id=${encodeURIComponent(chatId)}&subject_kind=${encodeURIComponent(subject.kind)}&subject_id=${encodeURIComponent(subject.id)}`;
}

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.method && init.method !== 'GET') headers.set('x-marinara-csrf', '1');
  const adminSecret = localStorage.getItem('marinara_admin_secret');
  if (adminSecret) headers.set('X-Admin-Secret', adminSecret);
  const response = await fetch(url, { ...init, headers, credentials: 'same-origin', cache: 'no-store' });
  const payload = await response.json() as T | { error?: string };
  if (!response.ok) {
    const errorPayload = payload as { error?: string };
    throw new Error(errorPayload.error ?? `Request failed with HTTP ${response.status}`);
  }
  return payload as T;
}

if (!customElements.get('marinara-capability-modular-anatomy')) {
  customElements.define('marinara-capability-modular-anatomy', ModularAnatomyElement);
}
