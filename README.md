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

The paper crane folds through all 14 steps of the classic diagram, about 25 seconds per loop: pre-creases, square base, petal folds on both sides, narrowing, inside reverse folds for the neck, tail and head, then the wings spread and it flies off while a new sheet drops in.

- [x] Folding engine: folds against the paper as it lies, solved compound folds, layer stacking, 3D projection, depth sorting
- [x] The crane, all 14 steps
- [x] Four looks, light and dark, recolourable, with procedural paper grain
- [x] Progress mode, reduced motion, pauses off screen
- [ ] More models: boat, frog, …
- [ ] Static SVG export for no-JS / `<img>` use
- [ ] Paper look: wing tops should show the coloured side

## How it works

A model is written the way origami is taught: one fold at a time, against the paper as it currently lies (`src/models/crane.ts`).

1. **Folds cut the paper.** Each fold splits the faces it passes through along the fold line, so the crease pattern builds itself (`src/fold.ts`).
2. **Joints move the faces.** A hinge rotates faces about a fold line; a swing turns them in the plane (for reverse folds); joints chain, so a flap can fold while it is being lifted.
3. **Compound folds are solved.** The square base and the petal folds move several creases at once. Those angles are left free, `pin` says which corners must stay together, and a small Gauss–Newton solver works out the angles along the whole motion so the paper never tears.
4. **Layers are tracked.** After every step the engine works out which face ended up on top wherever two overlap, and gives every face a layer height, so flat stacks have real thickness.
5. **Rendering.** Faces are projected with a perspective camera and shaded by how they face a light. Faces lying flat together are drawn as one panel and painted back-to-front with plane tests and a topological sort (`src/scene.ts`).
6. **Paper.** A tiny CPU shader pass generates paper grain (fibres, tooth, cloudiness) once per page, and each panel maps it in sheet space, so the grain folds with the paper (`src/texture.ts`).
7. **Looks are CSS** (`src/styles.ts`).

The crane compiles in about 50 ms on first use. A frame costs about 1 ms of script. The whole package, crane included, is about 13 kB gzipped.

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
