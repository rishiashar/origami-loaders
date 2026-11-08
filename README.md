# origami-loaders

**Loaders that fold.** 3D origami animations rendered as lightweight SVG — no canvas, no WebGL, no dependencies.

A framework-agnostic web component: drop `<origami-loader>` into any page, React, Vue, Svelte or plain HTML.

## Install

```sh
npm i origami-loaders
```

With a bundler, import the package once. It registers the `<origami-loader>` element as a side effect. The `OrigamiLoader` class is also exported.

```js
import 'origami-loaders';
```

```html
<origami-loader look="ink"></origami-loader>
```

Without a bundler, load the IIFE build from jsDelivr:

```html
<script src="https://cdn.jsdelivr.net/npm/origami-loaders"></script>
<origami-loader look="blueprint" theme="dark"></origami-loader>
```

## Attributes

| Attribute  | Values                                   | Default | Description |
| ---------- | ---------------------------------------- | ------- | ----------- |
| `model`    | `crane` \| `plane`                       | `crane` | Which origami model to fold. |
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
el.stepCount;     // steps on the paper diagram: 14 for the crane, 7 for the plane

el.addEventListener('ol-step', (e) => {
  const { index, diagram, label } = e.detail; // fired when the step changes
});
```

### Real progress

Set `progress` as work advances, then call `complete()` when it is done. The model plays its ending (the crane flies off, the plane leaves), fires `ol-complete`, and stays empty until you start again.

```js
upload.on('progress', (p) => el.setAttribute('progress', p)); // 0 to 1
upload.on('done', () => el.complete());
el.addEventListener('ol-complete', () => showSent());
el.restart(); // or set progress again to fold a fresh sheet
```

## Models

- **crane** is the default. It folds all 14 steps of the classic diagram and takes about 25 seconds per loop.
- **plane** is the classic paper dart. It has about 7 steps and takes about 10 seconds per loop. Select it with `model="plane"`.

```html
<origami-loader model="plane"></origami-loader>
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
- [x] A second model, the paper plane
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
6. **Paper.** Paper Shaders' paper-texture shader renders the grain once per page on a hidden WebGL canvas; the result is baked into an image that each panel maps in sheet space, so the grain folds with the paper (`src/paper-shader.ts`, with a small CPU fallback in `src/texture.ts`).
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

## Releasing

Publishing runs in GitHub Actions when a `v*` tag is pushed (`.github/workflows/publish.yml`). It typechecks, tests, builds, checks the tag against the version in `package.json`, then runs `npm publish --provenance`.

One-time setup:

1. On npmjs.com, create an access token. A granular token with read and write access to this package works, as does an automation token. For the first release the package does not exist yet, so the granular token needs to cover new packages or use an automation token.
2. In the GitHub repo, go to Settings, Secrets and variables, Actions, and add the token as a repository secret named `NPM_TOKEN`.

For each release:

```sh
npm version 0.1.1 --no-git-tag-version   # or edit package.json by hand
git commit -am "Release v0.1.1"
git tag v0.1.1
git push && git push --tags
```

## Credits

The paper texture comes from the paper-texture shader in [Paper Shaders](https://shaders.paper.design) (Apache-2.0), rendered once per page and baked into the grain that folds with the paper. It loads on demand as its own chunk; `texture="grain"` uses a smaller built-in grain instead, and `texture="none"` turns texture off. See `THIRD_PARTY_NOTICES.txt`.

## License

MIT
