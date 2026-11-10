# Delivering a model

One model file, two things to hand over: the loader and the lesson. Register the model once, before any element that uses it is put on the page. Use a short, lowercase name (`tulip`, `jumping-frog`).

## In an app with a bundler (Vite, Next.js, webpack, ...)

```js
import 'origami-loaders';                      // defines <origami-loader> and <origami-lesson>
import { registerModel } from 'origami-loaders';
import { buildTulip } from './origami/tulip';

registerModel('tulip', buildTulip);
```

```html
<origami-loader model="tulip" look="paper"></origami-loader>   <!-- the loader -->
<origami-lesson model="tulip" look="paper"></origami-lesson>   <!-- the lesson -->
```

Importing is safe during server rendering; the elements only come alive in the browser.

### React and Next.js

Put the registration in a client module, at the top level:

```tsx
'use client';
import 'origami-loaders';
import { registerModel } from 'origami-loaders';
import { buildTulip } from '../origami/tulip';

registerModel('tulip', buildTulip);

export function TulipLoader() {
  return <origami-loader model="tulip" look="paper" />;
}
export function TulipLesson() {
  return <origami-lesson model="tulip" look="paper" />;
}
```

React 19 passes attributes to custom elements as they are. With TypeScript, declare the tags once:

```ts
// origami.d.ts
import type { DetailedHTMLProps, HTMLAttributes } from 'react';
type Tag<P> = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & P;
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'origami-loader': Tag<{ model?: string; look?: string; theme?: string; progress?: number | string; paused?: boolean; speed?: number | string; texture?: string }>;
      'origami-lesson': Tag<{ model?: string; look?: string; theme?: string; step?: number | string; speed?: number | string; texture?: string }>;
    }
  }
}
```

### Vue

Tell Vue the tags are custom elements (in `vite.config`):

```js
vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('origami-') } } })
```

Register the model in `main.js`, then use the tags in templates.

### Svelte

Register in the root component's `<script>` (or a module it imports), and use the tags as they are.

## In a plain HTML page

Write the model as a `.js` file (or strip the types out of the `.ts` one), and load the package from a CDN. The import map, before any module script, lets the model's own `import ... from 'origami-loaders'` find the package:

```html
<script type="importmap">
  { "imports": { "origami-loaders": "https://cdn.jsdelivr.net/npm/origami-loaders@0.2/dist/origami-loaders.js" } }
</script>
<script type="module">
  import { registerModel } from 'origami-loaders';
  import { buildTulip } from './origami/tulip.js';
  registerModel('tulip', buildTulip);
</script>

<origami-lesson model="tulip" look="paper"></origami-lesson>
```

Module scripts and import maps need the page served over http(s), not opened as a file. For a page that opens as a file, make a standalone lesson page (next).

## A standalone lesson page

For a teacher, a parent, a class or anyone without an app: one HTML file with the package and the model inside it. It opens by double-clicking, offline, and can be emailed or put on any web host.

```sh
node <skill>/scripts/lesson.mjs origami/tulip.ts --name tulip --out tulip-lesson.html \
  --title "Fold a tulip" --intro "One square of paper, eight folds. Fold along as it plays." \
  --look paper --theme light
```

Write the title and intro for whoever will read them: a child, a class, a reader of a tutorial. Mention the paper (what size, which colour face up), since that is the first thing anyone asks.

## The lesson element

`<origami-lesson>` shows one step at a time: its number, its label, and the paper as it lies after that step. Back and Next (or ← and →, Home and End) move between steps; Next plays the step's fold at half the loader's pace, and Replay plays it again. Reduced motion skips the folding and shows each result.

| Attribute or property | Meaning |
| --- | --- |
| `model`, `look`, `theme`, `texture` | as for the loader |
| `speed` | folding pace, default `0.5` |
| `step` | the step shown, from 1; set it to jump |
| `steps` | every step: `{ number, diagram, label, start, end }` |
| `next()`, `back()`, `replay()`, `goTo(n)` | move it from script |
| `ol-lesson-step` event | fires on every step, `detail` is the step plus `count` |

Its text takes the page's colour and font. Style its parts with `::part(stage)`, `::part(caption)`, `::part(count)`, `::part(label)`, `::part(track)`, `::part(bar)`, `::part(controls)` and `::part(button)`.

## The loader element

| Attribute | Meaning |
| --- | --- |
| `model` | the registered name |
| `look` | `ink`, `blueprint`, `graphite`, `paper` |
| `theme` | `light`, `dark`, `auto` (follows the system) |
| `speed` | playback speed |
| `progress` | 0 to 1: show that point of the fold for real progress; then call `complete()` to play the ending |
| `paused` | stops playback |
| `texture` | `none` or `grain` instead of the default paper texture |

## Colours

Both elements take CSS custom properties: `--ol-ink` (lines), `--ol-bg` (the page background; match it), `--ol-front` and `--ol-back` (the paper's two sides in the paper look) and `--ol-stroke` (line width). Size the loader with CSS `width` and `height`; the lesson fills its width.

```css
origami-loader, origami-lesson { --ol-front: #2f6fdf; --ol-back: #f6f3ec; --ol-bg: #fff; }
```
