# origami-loaders

**Loaders that fold.** 3D origami animations rendered as lightweight SVG — no canvas, no WebGL, no dependencies.

**[See them fold →](https://origami-loaders.vercel.app)** Every model, look and paper colour, live, in example apps. Pick one and copy its tag.

A framework-agnostic web component: drop `<origami-loader>` into any page, React, Vue, Svelte or plain HTML.

## Install

```sh
npm i origami-loaders
```

With a bundler, import the package once. It registers the `<origami-loader>` element as a side effect. The `OrigamiLoader` class is also exported. It is safe to import during server rendering (Next.js, Nuxt, SvelteKit, Astro): the element registers only once the page runs in a browser.

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
| `model`    | `crane`, `plane`, `pleat`, `envelope`, `boat`, `frog`, `swan`, `heart`, `whale`, `fox` | `crane` | Which origami model to fold. |
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

| Model | What it does |
| --- | --- |
| `crane` | The default. All 14 steps of the classic diagram, about 25 seconds a loop, then it flies off. |
| `plane` | The classic dart in 7 steps. Circles once, then flies off. |
| `pleat` | An accordion that breathes. Made for "thinking" and other waits with no end in sight. |
| `envelope` | Four corners to the centre, so progress maps neatly: a quarter of the work, one corner. |
| `boat` | A sailboat in three folds. Rocks on the water, then sails off. |
| `frog` | The traditional jumping frog, from a waterbomb base. Its pleat is a spring: it hops twice, then hops away. |
| `swan` | Kite, neck, head. Drifts on the water, then glides off. |
| `heart` | The classic heart, folded on the side you see. It beats. |
| `whale` | The traditional whale, from a fish base: the rabbit ears become its flippers. Swims, flicks its tail, then dives. |
| `fox` | A fox's face. Tilts its head and twitches its ears. |

Pick one with the `model` attribute:

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
- [x] Ten models: crane, plane, pleat, envelope, boat, frog, swan, heart, whale, fox
- [x] A fold check in the test suite that catches the wrong layer showing, folds that undo themselves, and torn creases
- [ ] Static SVG export for no-JS / `<img>` use
- [x] Paper look: models can start coloured side down, as real ones do, so the plane and envelope fold the colour out
- [x] Reverse folds are real: the point is mirrored across its crease and stays joined to it (the crane's neck, tail and head, the swan's neck and head, the whale's tail)
- [x] The crane shows only its coloured side, wings included, as a crane folded from one-sided paper does

## How it works

A model is written the way origami is taught: one fold at a time, against the paper as it currently lies (`src/models/crane.ts`).

1. **Folds cut the paper.** Each fold splits the faces it passes through along the fold line, so the crease pattern builds itself (`src/fold.ts`).
2. **Joints move the faces.** A hinge rotates faces about a fold line; joints chain, so a flap can fold while it is being lifted. A **reverse fold** mirrors the point across its crease, so it turns inside out and stays joined along the crease, tucked between the layers (inside) or wrapped round them (outside). It gets there the way fingers move it: it swings round and turns over about its own spine, opening like a book.
3. **Compound folds are solved.** The square base and the petal folds move several creases at once. Those angles are left free, `pin` says which corners must stay together, and a small Gauss–Newton solver works out the angles along the whole motion so the paper never tears. The frog's waterbomb base is worked out exactly instead: as each side triangle turns in by θ, the top comes down by γ = 2·atan(tan(θ/2)/√2).
4. **Layers are tracked.** After every step the engine works out which face ended up on top wherever two overlap, and gives every face a layer height, so flat stacks have real thickness. Paper that stands up, like a crane's spread wings, keeps its stacking turned with it.
5. **Rendering.** Faces are projected with a perspective camera and shaded by how they face a light. Faces lying flat together are drawn as one panel and painted back-to-front with plane tests and a topological sort; where no plane separates two panels, the one nearer the eye where they actually overlap goes on top (`src/scene.ts`).
6. **Paper.** Paper Shaders' paper-texture shader renders the grain once per page on a hidden WebGL canvas; the result is baked into an image that each panel maps in sheet space, so the grain folds with the paper (`src/paper-shader.ts`, with a small CPU fallback in `src/texture.ts`).
7. **Looks are CSS** (`src/styles.ts`). The paper look colours the front of the sheet; a model compiled with `colourDown` starts with the front facing away, the way you fold coloured paper, so the folds bring the colour out.

The crane compiles in about 50 ms on first use. A frame costs about 1 ms of script. The whole package, all ten models included, is about 21 kB gzipped.

## Development

`npm test` also runs a fold check over every model (`test/inspect.ts`, under a second). At several moments in every step it lays the frame out exactly as the renderer does and fails if a farther layer is painted over a nearer one (the wrong side of the paper showing), if a face rides folds that undo each other, or if a crease tears. A reverse fold may open its crease on the way, but it must be shut again by the end of the step.

```sh
npm install
npm run typecheck
npm test
npm run build      # dist/ bundles + types, and a self-contained demo/dist/index.html
npm run demo       # build, then print the demo page path
npm run capture    # screenshots + video of the demo (needs Playwright and ffmpeg)
```

## Releasing

Publishing runs in GitHub Actions when a `v*` tag is pushed (`.github/workflows/publish.yml`). It typechecks, tests, builds, checks the tag against the version in `package.json`, then publishes with provenance: a signed record on npm of the commit and workflow that built the package. What changed in each version is in `CHANGELOG.md`.

### The first release, with a token

The package does not exist on npm until the first release, so that one release uses a token.

1. On npmjs.com, go to Access Tokens and generate a granular access token:
   - **Bypass two-factor authentication** ticked, so the workflow can publish without a code from your phone.
   - Packages and scopes: **Read and write (publish and stage)** on **All Packages**. The package cannot be picked by name until it exists.
   - Expiration: 7 days. It is only needed once.
2. In the GitHub repo, go to Settings, Secrets and variables, Actions, and add the token as a repository secret named `NPM_TOKEN`.
3. Tag the release commit on `main` and push the tag:

   ```sh
   git tag v0.1.0
   git push origin v0.1.0
   ```

4. Follow the Publish run in the repo's Actions tab. When it is green, the package is at npmjs.com/package/origami-loaders.
5. Delete the `NPM_TOKEN` secret and revoke the token on npmjs.com. It has done its job.

### Every release after, with no token

From then on, npm trusts this repo's publish workflow directly (trusted publishing), so no token is stored anywhere. npm stops letting tokens publish directly in January 2027, so this is the way to release from then on. The workflow needs no change: npm tries trusted publishing first and falls back to a token only when there is one.

1. On npmjs.com, open the package's Settings, find Trusted Publisher, choose GitHub Actions and enter `rishiashar`, `origami-loaders` and `publish.yml`. The next publish must happen within 2 days of adding it, or the connection expires and has to be added again, so do this when the next release is ready.
2. Bump the version, tag it and push:

   ```sh
   npm version 0.1.1 --no-git-tag-version   # or edit package.json by hand
   git commit -am "Release v0.1.1"
   git tag v0.1.1
   git push && git push --tags
   ```

   Or, once the version bump is on `main`, either:
   - run the Publish workflow on `main` (Actions, Publish, Run workflow). It publishes the version in `package.json`, then creates its tag and GitHub release with the notes from `CHANGELOG.md`; or
   - publish a GitHub Release with a new tag such as `v0.1.1` on `main` (Releases, Draft a new release). Creating the tag starts the same publish.

3. Once that release is out, go to the package's Settings, Publishing access, and choose **Require two-factor authentication and disallow tokens**, so a leaked token can never publish.

## Credits

The paper texture comes from the paper-texture shader in [Paper Shaders](https://shaders.paper.design) (Apache-2.0), rendered once per page and baked into the grain that folds with the paper. It loads on demand as its own chunk; `texture="grain"` uses a smaller built-in grain instead, and `texture="none"` turns texture off. See `THIRD_PARTY_NOTICES.txt`.

## License

MIT
