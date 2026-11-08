# origami-loaders

**Loaders that fold.** 3D origami animations rendered as lightweight SVG — no canvas, no WebGL, no dependencies.

A framework-agnostic web component: drop `<origami-loader>` into any page, React, Vue, Svelte or plain HTML.

## Install

```sh
npm install origami-loaders
```

```html
<script type="module">
  import 'origami-loaders';
</script>

<origami-loader look="ink"></origami-loader>
```

### CDN

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/origami-loaders"></script>
<origami-loader look="blueprint" theme="dark"></origami-loader>
```

Importing the package registers the `<origami-loader>` custom element as a side effect. The `OrigamiLoader` class is also exported.

## Attributes

| Attribute  | Values                                   | Default | Description |
| ---------- | ---------------------------------------- | ------- | ----------- |
| `model`    | `crane`                                  | `crane` | Which origami model to fold. |
| `look`     | `ink` \| `blueprint` \| `graphite` \| `paper` | `ink`   | Rendering style. |
| `theme`    | `light` \| `dark` \| `auto`              | `auto`  | `auto` follows `prefers-color-scheme`. |
| `speed`    | number                                   | `1`     | Playback speed multiplier. |
| `progress` | `0`..`1`                                 | unset   | When present, the loader is in determinate mode and shows that point of the fold sequence instead of playing. |
| `paused`   | boolean attribute                        | unset   | Pauses playback. |

## CSS custom properties

| Property      | Used by           | Description |
| ------------- | ----------------- | ----------- |
| `--ol-ink`    | all looks         | Line color. |
| `--ol-bg`     | all looks         | Face fill used to hide lines behind other faces. Should match the page background. |
| `--ol-front`  | `paper`           | Front-side paper color. |
| `--ol-back`   | `paper`           | Back-side paper color. |
| `--ol-stroke` | all looks         | Line width, e.g. `1.5px`. |

Size is set with CSS `width` / `height` (default `160px` square).

```css
origami-loader {
  width: 96px;
  height: 96px;
  --ol-ink: #1b1b1d;
  --ol-bg: #fff;
  --ol-stroke: 1.5px;
}
```

## JavaScript API

```js
const el = document.querySelector('origami-loader');

el.duration;      // total length of the fold sequence, in seconds
el.seek(2.5);     // jump to a time, in seconds
el.currentStep;   // { index, diagram, label }

el.addEventListener('ol-step', (e) => {
  const { index, diagram, label } = e.detail; // fired when the step changes
});
```

## Looks

- **ink** — line art, hidden lines removed.
- **blueprint** — see-through wireframe with diagram-style fold lines.
- **graphite** — monochrome with soft light shading.
- **paper** — two-tone origami paper.

## Status

Early days. The paper crane follows the classic 14-step diagram; **steps 1–3** (pre-creasing the sheet: both diagonals, turn over, both book folds) are done.

- [x] Folding engine: crease patterns, forward kinematics, timeline, 3D projection, depth sorting
- [x] Four looks, light + dark, recolourable
- [x] Crane steps 1–3
- [ ] Crane step 4: collapse into the square base (first compound fold: many creases move at once)
- [ ] Crane steps 5–14: kite folds, petal folds, narrowing, reverse folds for neck, tail and head
- [ ] Loop ending: the crane flaps and flies off, a new sheet drops in
- [ ] More models: boat, frog, …
- [ ] Static SVG export for no-JS / `<img>` use

## How it works

Every model is **real paper geometry**, not drawings.

1. **Crease pattern.** The square sheet is cut into convex faces along every line it will ever be folded on (`src/pattern.ts`).
2. **Fold sequence.** Each step says which creases move, to what angle (valley = toward you, mountain = away) and with what easing, plus how the whole sheet is turned (`src/timeline.ts`, `src/models/crane.ts`).
3. **Kinematics.** Fold angles become a rigid 3D transform per face by walking outward from one face that stays still and rotating across each bent crease (`src/kinematics.ts`).
4. **Projection.** Faces are projected with a perspective camera and shaded by how they face a light (`src/scene.ts`).
5. **Depth.** SVG has no depth buffer, so faces that stay flat together are grouped into panels and painted back-to-front with plane tests and a topological sort. Paper never closes perfectly flat (a 1.5° springback), which keeps stacked layers in a well-defined order.
6. **Looks are CSS.** The renderer only outputs geometry, which side of the paper is showing and a light value; each look is a few lines of CSS over that (`src/styles.ts`).

The result is a live `<svg>` updated every frame: crisp at any size, themeable with CSS variables, about 7 kB gzipped for the engine, the component and the crane. It pauses itself off screen, and under `prefers-reduced-motion` it steps between key poses instead of animating.

## Development

```sh
npm install
npm run typecheck
npm test
npm run build      # dist/ bundles + types, and a self-contained demo/dist/index.html
npm run demo       # build, then print the demo page path
npm run capture    # screenshots + video of the demo (needs Playwright and ffmpeg)
```

## License

MIT
