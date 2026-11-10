# Changelog

## Unreleased

- `<origami-lesson>` teaches a model one step at a time: Back and Next (or ← and →) move between steps, Next plays that step's fold, and Replay plays it again. It shows the step number and label, follows the loader's looks and themes, and stops before the model's own show, such as the crane flying off.
- The fold check ships in the package as `origami-loaders/check`, so anyone writing a model can check that the right side of the paper shows, no fold undoes itself and no crease comes apart.

## 0.1.2

- `swan` folds the way paper does. The tip folds back for the head before the model folds in half; then the neck is pulled up and the head after it, as origami.me teaches. Each pull is worked out exactly: the crease at the base swings round and the chest folds with it, so the neck never comes loose from the body.
- `whale` folds its tail with a plain mountain fold, as origami.me does, and flicks it by opening that fold a little.
- `crane` no longer comes apart at its neck, tail and head. The engine can now flex paper: for an inside reverse fold the layers beside the crease spread open along a soft line, the point swings through between them, and they close again. `insideReverse` is on the step builder for your own models.
- The fold check is stricter: every crease of every model is checked at 40 moments of every step, with no exceptions.
- The crane stays in the frame while its neck and tail fold up: the view closes in on the body only once the second leg has risen.

## 0.1.1

- `frog` folds the way origami.me teaches it. After the front legs, the bottom folds up and the sides fold in. Then the bottom is pushed up and its side flaps squash out to become real back legs. The bottom then folds up and back down in half for the spring. The finished frog sits side-on and pitches nose-up as it hops.
- The README links to the demo site, [origami-loaders.vercel.app](https://origami-loaders.vercel.app), where every model, look and paper colour folds live.
- The package's homepage on npm is the demo site.

## 0.1.0

The first release. `<origami-loader>` is a loader that folds a sheet of paper into an origami model, drawn in 3D as live SVG. It is one web component with no dependencies, and works in plain HTML, React, Vue, Svelte or any other framework.

```sh
npm i origami-loaders
```

```html
<script src="https://cdn.jsdelivr.net/npm/origami-loaders"></script>
<origami-loader model="crane" look="paper"></origami-loader>
```

### Ten models

- `crane`: all 14 steps of the classic diagram, then it flies off.
- `plane`: the classic dart in 7 steps. It circles once, then flies off.
- `pleat`: an accordion that breathes, for waits with no end in sight.
- `envelope`: four corners to the centre, so a quarter of the work is one corner.
- `boat`: a sailboat in three folds. It rocks, then sails off.
- `frog`: the traditional jumping frog. It hops twice, then hops away.
- `swan`: kite, neck, head. It drifts, then glides off.
- `heart`: the classic heart. It beats.
- `whale`: the traditional whale, from a fish base. It swims, flicks its tail and dives.
- `fox`: a fox's face. It tilts its head and twitches its ears.

### Four looks

`ink` line art, `blueprint` wireframe with fold lines, `graphite` shading and two-tone `paper` with a grain that folds with the sheet. Each one works in light and dark, and can be recoloured with CSS custom properties.

### Real progress

Set `progress` from 0 to 1 and the paper shows that point of the fold. Call `complete()` when the work is done: the model plays its ending, then fires `ol-complete`. `seek()`, `currentStep` and the `ol-step` event let a page follow the fold step by step.

### Built in

- Reduced motion is respected, and loaders pause when they scroll off screen.
- Safe to import during server rendering (Next.js, Nuxt, SvelteKit, Astro).
- About 21 kB gzipped with all ten models. The Paper Shaders grain loads on demand as its own chunk.
- The folding engine is exported (`Folder`, `registerModel`), so a page can fold and register its own models.
