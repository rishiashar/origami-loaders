import { clamp } from './math';
import { getModel, type CompiledModel } from './models/index';
import { SvgScene } from './scene';
import { STYLE } from './styles';
import type { Frame } from './timeline';

export type Look = 'ink' | 'blueprint' | 'graphite' | 'paper';
const LOOKS: Look[] = ['ink', 'blueprint', 'graphite', 'paper'];

export interface StepInfo { index: number; diagram: number; label: string }

const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * <origami-loader model="crane" look="ink" theme="auto" speed="1" progress="0.4" paused>
 */
export class OrigamiLoader extends HTMLElement {
  static get observedAttributes() { return ['model', 'look', 'speed', 'progress', 'paused']; }

  private svg: SVGSVGElement;
  private model?: CompiledModel;
  private scene?: SvgScene;
  private frame?: Frame;
  private time = 0;
  private raf = 0;
  private last = 0;
  private visible = true;
  private io?: IntersectionObserver;
  private step = -1;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${STYLE}</style><svg part="svg" viewBox="-1.5 -1.5 3 3" aria-hidden="true"><g></g></svg>`;
    this.svg = root.querySelector('svg')!;
  }

  connectedCallback() {
    if (!this.hasAttribute('role')) this.setAttribute('role', 'progressbar');
    if (!this.hasAttribute('aria-label')) this.setAttribute('aria-label', 'Loading');
    this.load();
    this.applyLook();
    if (typeof IntersectionObserver === 'function') {
      this.io = new IntersectionObserver((entries) => {
        this.visible = entries[entries.length - 1].isIntersecting;
        this.sync();
      });
      this.io.observe(this);
    }
    this.sync();
  }

  disconnectedCallback() {
    this.io?.disconnect();
    this.stop();
  }

  attributeChangedCallback(name: string) {
    if (!this.isConnected) return;
    if (name === 'model') this.load();
    if (name === 'look') this.applyLook();
    this.sync();
  }

  /** Length of one loop, in seconds. */
  get duration(): number { return this.model?.timeline.duration ?? 0; }

  /** The step currently shown. */
  get currentStep(): StepInfo | undefined {
    const tl = this.model?.timeline;
    if (!tl) return undefined;
    const index = tl.stepAt(this.displayTime());
    const s = tl.steps[index];
    return { index, diagram: s.diagram, label: s.label };
  }

  /** Jump to a time (seconds) in the loop. */
  seek(seconds: number) {
    const d = this.duration;
    this.time = d ? ((seconds % d) + d) % d : 0;
    this.draw();
  }

  private load() {
    const name = this.getAttribute('model') || 'crane';
    this.model = getModel(name);
    if (!this.model) {
      console.warn(`<origami-loader>: unknown model "${name}"`);
      return;
    }
    this.scene = new SvgScene(this.svg.firstElementChild as SVGGElement, this.model.pattern);
    this.frame = undefined;
    this.step = -1;
    // Start on the flat sheet, so a paused or off-screen loader is never blank.
    this.time = this.model.timeline.content[0];
    this.draw();
  }

  private applyLook() {
    const look = this.getAttribute('look') as Look;
    this.svg.dataset.look = LOOKS.includes(look) ? look : 'ink';
  }

  private get speed() {
    const s = parseFloat(this.getAttribute('speed') ?? '');
    return Number.isFinite(s) && s > 0 ? s : 1;
  }

  private get progress(): number | undefined {
    const v = this.getAttribute('progress');
    if (v === null || v === '') return undefined;
    const p = parseFloat(v);
    return Number.isFinite(p) ? clamp(p) : undefined;
  }

  private displayTime(): number {
    const tl = this.model?.timeline;
    if (!tl) return 0;
    const p = this.progress;
    if (p !== undefined) return tl.content[0] + p * (tl.content[1] - tl.content[0]);
    if (reducedMotion()) {
      // Hold the end of each step instead of animating between them.
      const k = tl.stepAt(this.time);
      return tl.starts[k] + tl.steps[k].duration * 0.999;
    }
    return this.time;
  }

  private draw() {
    const m = this.model;
    if (!m || !this.scene) return;
    const p = this.progress;
    if (p !== undefined) {
      this.setAttribute('aria-valuenow', String(Math.round(p * 100)));
      this.setAttribute('aria-valuemin', '0');
      this.setAttribute('aria-valuemax', '100');
    } else {
      this.removeAttribute('aria-valuenow');
    }
    this.frame = m.timeline.evaluate(this.displayTime(), this.frame);
    this.scene.render(this.frame, m.kinematics.solve(this.frame.edgeAngles, m.maxFold));
    if (this.frame.step !== this.step) {
      this.step = this.frame.step;
      this.dispatchEvent(new CustomEvent('ol-step', { detail: this.currentStep }));
    }
  }

  private sync() {
    const run = this.isConnected && this.visible && !this.hasAttribute('paused') && this.progress === undefined;
    if (run && !this.raf) {
      this.last = 0;
      this.raf = requestAnimationFrame(this.tick);
    } else if (!run) {
      this.stop();
      this.draw();
    }
  }

  private stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    const d = this.duration;
    if (!d) return;
    this.time = (this.time + dt * this.speed) % d;
    this.draw();
  };
}

export function defineOrigamiLoader(tag = 'origami-loader') {
  if (typeof customElements !== 'undefined' && !customElements.get(tag)) {
    customElements.define(tag, class extends OrigamiLoader {});
  }
}
