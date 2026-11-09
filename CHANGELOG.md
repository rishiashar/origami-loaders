# Changelog

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
