import { getModel } from './models/index';
import type { Player } from './player';

/** One step of a lesson: the paper is shown as it lies at `end`; moving to it plays the fold from `start`. */
export interface LessonStep {
  /** 1-based position in the lesson. */
  number: number;
  /** Number of the matching step on the model's paper diagram. */
  diagram: number;
  label: string;
  /** Seconds into the model's sequence. */
  start: number;
  end: number;
}

/**
 * The steps a lesson teaches: from the flat sheet to the finished model, one fold
 * (or turn of the paper) at a time. The model's own show (the boat rocking, the
 * heart beating, the crane flying off) is left out: teaching stops at the first
 * step that moves along a path, or that neither folds nor turns the paper.
 */
export function lessonSteps(player: Player): LessonStep[] {
  const m = player.model;
  const out: LessonStep[] = [];
  for (let k = 0; k < m.steps.length; k++) {
    const s = m.steps[k];
    if (s.phase === 'outro') break;
    const start = m.starts[k], end = start + s.duration;
    const add = () => out.push({ number: out.length + 1, diagram: s.diagram, label: s.label, start, end });
    if (k === 0) { add(); continue; }
    if (s.duration <= 0) continue;
    const show = !!s.path || (s.joints.length === 0 && !s.pose);
    if (show) {
      if (out.length > 1) break;
      continue;
    }
    add();
  }
  return out;
}

const motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;
/** On a server there is no HTMLElement; a stand-in lets the package import there. */
const Base: typeof HTMLElement = typeof HTMLElement === 'undefined' ? (class {} as typeof HTMLElement) : HTMLElement;
const PASS = ['look', 'theme', 'texture'];
/**
 * A step is shown just before it ends: at its very end the next step has begun, and
 * the crease that step is about to make would already show.
 */
const HOLD = 1e-3;

const STYLE = /* css */ `
:host{display:block;max-width:28rem;color:inherit;font:inherit;outline:none}
:host(:focus-visible){outline:2px solid currentColor;outline-offset:4px;border-radius:12px}
[part=stage]{position:relative}
origami-loader{display:block;width:100%;height:auto;aspect-ratio:1/1}
[part=caption]{display:flex;gap:.6em;align-items:baseline;margin:.9em 0 .7em;min-height:1.5em}
[part=count]{opacity:.6;white-space:nowrap;font-variant-numeric:tabular-nums}
[part=label]{font-weight:600}
[part=track]{height:3px;border-radius:3px;background:color-mix(in oklab,currentColor 14%,transparent);overflow:hidden;margin-bottom:.9em}
[part=bar]{height:100%;width:0;background:currentColor;transition:width .3s}
[part=controls]{display:flex;gap:.5em}
button{font:inherit;color:inherit;background:none;cursor:pointer;padding:.45em 1.1em;border-radius:999px;
border:1px solid color-mix(in oklab,currentColor 28%,transparent)}
button:hover:not(:disabled){border-color:currentColor}
button:disabled{opacity:.35;cursor:default}
button[data-act=next]{margin-left:auto}
`;

/**
 * Teaches a model one step at a time.
 *
 *   <origami-lesson model="crane" look="paper"></origami-lesson>
 *
 * Back and Next (or ← and →) move between steps, and Next plays that step's fold.
 * Replay plays the current step again. `step` (1-based) reads or sets the step shown.
 */
export class OrigamiLesson extends Base {
  static get observedAttributes() { return ['model', 'step', 'speed', ...PASS]; }

  private loader!: HTMLElement;
  private els!: Record<'count' | 'label' | 'bar' | 'back' | 'replay' | 'next', HTMLElement>;
  private player?: Player;
  private list: LessonStep[] = [];
  private index = 0;
  private raf = 0;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${STYLE}</style>
<div part="stage"><origami-loader role="presentation" aria-hidden="true"></origami-loader></div>
<div part="caption"><span part="count"></span><span part="label" aria-live="polite"></span></div>
<div part="track"><div part="bar"></div></div>
<div part="controls"><button part="button back" data-act="back">Back</button><button part="button replay" data-act="replay">Replay</button><button part="button next" data-act="next">Next</button></div>`;
    this.loader = root.querySelector('origami-loader')!;
    const q = (s: string) => root.querySelector(s) as HTMLElement;
    this.els = {
      count: q('[part=count]'), label: q('[part=label]'), bar: q('[part=bar]'),
      back: q('[data-act=back]'), replay: q('[data-act=replay]'), next: q('[data-act=next]'),
    };
    root.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('button')?.dataset.act;
      if (act === 'back') this.back();
      else if (act === 'replay') this.replay();
      else if (act === 'next') this.next();
    });
    this.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') this.next();
      else if (e.key === 'ArrowLeft') this.back();
      else if (e.key === 'Home') this.goTo(1);
      else if (e.key === 'End') this.goTo(this.list.length);
      else return;
      e.preventDefault();
    });
  }

  connectedCallback() {
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    for (const a of PASS) this.pass(a);
    this.load();
  }

  disconnectedCallback() { this.stop(); }

  attributeChangedCallback(name: string, _old: string | null, value: string | null) {
    if (!this.isConnected) return;
    if (PASS.includes(name)) this.pass(name);
    else if (name === 'model') this.load();
    else if (name === 'step') {
      const n = parseInt(value ?? '', 10);
      if (Number.isFinite(n) && n !== this.step) this.goTo(n, false);
    }
  }

  /** Every step of the lesson. */
  get steps(): LessonStep[] { return this.list.slice(); }
  /** The step shown, 1-based. */
  get step(): number { return this.index + 1; }
  set step(n: number) { this.goTo(n, false); }

  /** Go to the next step and play its fold. On the last step, start over. */
  next() {
    if (this.index >= this.list.length - 1) this.goTo(1, false);
    else this.goTo(this.index + 2, true);
  }

  back() { this.goTo(this.index, false); }

  /** Play the current step's fold again. */
  replay() { this.goTo(this.index + 1, true); }

  /** Show step n (1-based); with `play`, fold it from where the step starts. */
  goTo(n: number, play = false) {
    if (!this.list.length) return;
    this.index = Math.min(this.list.length, Math.max(1, Math.round(n))) - 1;
    const s = this.list[this.index];
    this.stop();
    if (play && this.index > 0 && !motion?.matches) this.playStep(s);
    else this.show(s.end - HOLD);
    this.updateText();
    if (this.getAttribute('step') !== String(this.step)) this.setAttribute('step', String(this.step));
    this.dispatchEvent(new CustomEvent('ol-lesson-step', { detail: { ...s, count: this.list.length } }));
  }

  private load() {
    const name = this.getAttribute('model') || 'crane';
    this.player = getModel(name);
    this.list = this.player ? lessonSteps(this.player) : [];
    if (!this.player) console.warn(`<origami-lesson>: unknown model "${name}"`);
    this.loader.setAttribute('model', name);
    const n = parseInt(this.getAttribute('step') ?? '', 10);
    this.goTo(Number.isFinite(n) ? n : 1, false);
  }

  private pass(name: string) {
    const v = this.getAttribute(name);
    if (v === null) this.loader.removeAttribute(name);
    else this.loader.setAttribute(name, v);
  }

  /** Lessons fold at half the loader's pace by default, slow enough to follow. */
  private get speed() {
    const s = parseFloat(this.getAttribute('speed') ?? '');
    return Number.isFinite(s) && s > 0 ? s : 0.5;
  }

  /** Show the paper as it lies at time t, through the loader's progress, which maps its content span. */
  private show(t: number) {
    const [a, b] = this.player?.model.content ?? [0, 1];
    const p = b > a ? Math.min(1, Math.max(0, (t - a) / (b - a))) : 0;
    this.loader.setAttribute('progress', p.toFixed(7));
  }

  private playStep(s: LessonStep) {
    const length = (s.end - s.start) / this.speed;
    let t0 = 0;
    const tick = (now: number) => {
      if (!t0) t0 = now;
      const u = Math.min(1, (now - t0) / 1000 / length);
      this.show(s.start + (s.end - HOLD - s.start) * u);
      this.raf = u < 1 ? requestAnimationFrame(tick) : 0;
    };
    this.show(s.start);
    this.raf = requestAnimationFrame(tick);
  }

  private stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private updateText() {
    const { count, label, bar, back, replay, next } = this.els;
    const total = this.list.length;
    const s = this.list[this.index];
    count.textContent = total ? `Step ${this.step} of ${total}` : '';
    label.textContent = s?.label ?? '';
    bar.style.width = total > 1 ? `${(this.index / (total - 1)) * 100}%` : '0';
    (back as HTMLButtonElement).disabled = this.index === 0;
    (replay as HTMLButtonElement).disabled = this.index === 0;
    next.textContent = this.index >= total - 1 ? 'Start over' : 'Next';
  }
}

export function defineOrigamiLesson(tag = 'origami-lesson') {
  if (typeof customElements !== 'undefined' && !customElements.get(tag)) {
    customElements.define(tag, class extends OrigamiLesson {});
  }
}
