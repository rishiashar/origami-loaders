import { clamp } from './math';
import { getModel } from './models/index';
import type { Frame, Player } from './player';
import { SvgScene } from './scene';
import { STYLE } from './styles';
import { paperTexture, textureSize } from './texture';

export type Look = 'ink' | 'blueprint' | 'graphite' | 'paper';
const LOOKS: Look[] = ['ink', 'blueprint', 'graphite', 'paper'];

export interface StepInfo { index: number; diagram: number; label: string }

const motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;

/**
 * <origami-loader model="crane" look="ink" theme="auto" speed="1" progress="0.4" paused texture="none">
 */
export class OrigamiLoader extends HTMLElement {
  static get observedAttributes() { return ['model', 'look', 'speed', 'progress', 'paused', 'texture']; }

  private svg: SVGSVGElement;
  private player?: Player;
  private scene?: SvgScene;
  private frame?: Frame;
  private time = 0;
  private raf = 0;
  private last = 0;
  private visible = true;
  private io?: IntersectionObserver;
  private step = -1;
  private onMotion = () => this.sync();

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${STYLE}</style><svg part="svg" viewBox="-1.6 -1.6 3.2 3.2" aria-hidden="true"><g></g></svg>`;
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
    motion?.addEventListener?.('change', this.onMotion);
    this.sync();
  }

  disconnectedCallback() {
    this.io?.disconnect();
    motion?.removeEventListener?.('change', this.onMotion);
    this.stop();
  }

  attributeChangedCallback(name: string) {
    if (!this.isConnected) return;
    if (name === 'model') this.load();
    if (name === 'look') this.applyLook();
    if (name === 'texture') this.loadTexture();
    this.sync();
  }

  /** Length of one loop, in seconds. */
  get duration(): number { return this.player?.duration ?? 0; }

  /** The step currently shown. */
  get currentStep(): StepInfo | undefined {
    const p = this.player;
    if (!p) return undefined;
    const index = p.stepAt(this.displayTime());
    const s = p.model.steps[index];
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
    this.player = getModel(name);
    if (!this.player) {
      console.warn(`<origami-loader>: unknown model "${name}"`);
      return;
    }
    this.scene = new SvgScene(this.svg.firstElementChild as SVGGElement, this.player.model);
    this.frame = undefined;
    this.step = -1;
    // Start on the flat sheet, so a paused or off-screen loader is never blank.
    this.time = this.player.model.content[0];
    this.loadTexture();
    this.draw();
  }

  private loadTexture() {
    const scene = this.scene;
    const off = this.getAttribute('texture') === 'none';
    this.svg.dataset.tex = off ? 'off' : 'loading';
    if (!scene || off) return;
    const px = (this.getBoundingClientRect().width || 160) * (globalThis.devicePixelRatio || 1) * (2 / 3.2);
    const kind = this.getAttribute('texture') === 'grain' ? 'grain' : 'paper';
    paperTexture(textureSize(px), kind).then((href) => {
      if (scene !== this.scene || !href) return;
      scene.setTexture(href);
      if (this.svg.dataset.tex !== 'off') this.svg.dataset.tex = 'on';
    });
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
    const pl = this.player;
    if (!pl) return 0;
    const [a, b] = pl.model.content;
    const p = this.progress;
    if (p !== undefined) return a + p * (b - a);
    // Reduced motion: no movement at all — show the finished model.
    if (motion?.matches) return b - 1e-3;
    return this.time;
  }

  private draw() {
    const pl = this.player;
    if (!pl || !this.scene) return;
    const p = this.progress;
    if (p !== undefined) {
      this.setAttribute('aria-valuenow', String(Math.round(p * 100)));
      this.setAttribute('aria-valuemin', '0');
      this.setAttribute('aria-valuemax', '100');
    } else {
      this.removeAttribute('aria-valuenow');
    }
    this.frame = pl.evaluate(this.displayTime(), this.frame);
    this.scene.render(this.frame);
    if (this.frame.step !== this.step) {
      this.step = this.frame.step;
      this.dispatchEvent(new CustomEvent('ol-step', { detail: this.currentStep }));
    }
  }

  private sync() {
    const run = this.isConnected && this.visible && !this.hasAttribute('paused')
      && this.progress === undefined && !motion?.matches;
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
