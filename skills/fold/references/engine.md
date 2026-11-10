# Writing a model

How to write a model with the origami-loaders folding engine. Read it before writing one; come back to the section you need while you work.

1. [The shape of a model file](#the-shape-of-a-model-file)
2. [Coordinates](#coordinates)
3. [The camera, and which side faces you](#the-camera-and-which-side-faces-you)
4. [White side up or coloured side up](#white-side-up-or-coloured-side-up)
5. [Steps](#steps)
6. [Folding: `s.fold`](#folding-sfold)
7. [Unfolding](#unfolding)
8. [Joints: moving paper any way](#joints-moving-paper-any-way)
9. [Collapses: bases and petal folds](#collapses-bases-and-petal-folds)
10. [Reverse folds](#reverse-folds)
11. [The show and the ending](#the-show-and-the-ending)
12. [Before you run the check](#before-you-run-the-check)

Everything here is exported from `'origami-loaders'`. The ten files in `examples/` are real models written this way; when something here is unclear, the closest example shows it working.

## The shape of a model file

```ts
import { Folder, type Face, type P2 } from 'origami-loaders';

/**
 * The traditional paper cup: a square folded on its diagonal, two corners folded
 * across, the two top flaps folded down on either side.
 *
 * Sheet coordinates: the square [-1, 1]², coloured side toward +z.
 */

// Geometry with names, worked out from the paper, never eyeballed.
const C: P2 = [0, 0];

export function buildCup() {
  // Start tilted like paper on a table, below the frame and invisible; the intro brings it in.
  const F = new Folder({ rx: -24, ry: 180, ty: 0.6, tz: 0.4, o: 0 });

  F.step({ diagram: 1, label: 'Start with a square', duration: 0.8, phase: 'intro', ease: 'out', pose: { ty: 0, tz: 0, o: 1 } });

  F.step({ diagram: 2, label: 'Fold in half diagonally', duration: 0.8 }, (s) => {
    s.fold([-1, 1], [1, -1], { side: [1, 1], toward: -1 });
  });
  // ... one F.step for every step of the diagram ...

  F.step({ diagram: 7, label: 'Finished cup', duration: 1.2 });       // a hold: the lesson ends before it
  F.step({ diagram: 7, label: 'Off it goes', duration: 1.0, phase: 'outro', ease: 'in', pose: { ty: 0.5, o: 0 } });
  return F.compile();
}
```

Rules that keep a model checkable and teachable:

- One file, importing only from `'origami-loaders'`, exporting one `build<Name>()` that returns `F.compile()`.
- A doc comment naming the model, saying what it is in a sentence, and stating the sheet coordinates.
- Every coordinate is a named constant or an expression with a comment saying where it comes from ("the bottom corner meets the top edge here"). A number you can't explain is a fold you can't check.

## Coordinates

**The sheet.** By default a square, `[-1, 1]²`, 2 units wide. Give another shape as the second argument to `new Folder(pose, sheet)`, a polygon listed counter-clockwise:

| Paper | Sheet | Used by |
| --- | --- | --- |
| Square, edges level | default `[[-1, -1], [1, -1], [1, 1], [-1, 1]]` | crane, boat, pleat |
| Square on its corner (a diamond, side √2) | `[[0, -1], [1, 0], [0, 1], [-1, 0]]` | heart, fox, swan, whale |
| A4, 1 : √2 | `[[-a, -1], [a, -1], [a, 1], [-a, 1]]`, `a = Math.SQRT1_2` | plane |
| 1 : 2 | the same with `a = 0.5` | frog |

Use the diamond when the diagram starts with the square on a corner: the fold lines then run level and upright, which is much easier to get right.

**Model space** is where the paper lies now: x to the right, y up, z out of the paper toward +z, before the camera turns anything. Flat paper lies in the plane z = 0 (layers get a tiny real thickness, which you never handle). **Every fold line is given in model space**: where the line runs on the folded paper as it lies now, not where it was on the flat sheet. After the paper is folded in half, a line "from the folded edge to the corner" is wherever that edge and corner now are. Work it out from the current shape; draw it in a comment if it helps.

The **front** of the sheet is its +z side when flat and unfolded. In the paper look, the front is the coloured side (unless `colourDown`, below).

## The camera, and which side faces you

The pose places the model in the frame:

| Key | Meaning |
| --- | --- |
| `rx`, `ry`, `rz` | rotation in degrees: tilt toward you, turn about the vertical, turn in the plane of the screen |
| `tx`, `ty`, `tz` | move right, up, toward you |
| `s` | scale (the frame shows about −1.6 to 1.6) |
| `o` | opacity, 0 to 1 |

- With `ry` near 0 (or 360, 720) you see the **+z** side. With `ry` near 180 (or 540) you see the **−z** side.
- Paper on a table looks best slightly off axis: `rx` between −14 and −30, `ry` between 8 and 28, or between 180 and 192.
- **`toward: 1` swings the moving paper toward +z, `toward: -1` toward −z.** A valley fold brings the paper toward you, a mountain fold away. So toward you is `1` while you see +z, and `-1` while you see −z.
- **Turning the paper over is a pose step, not a fold.** Add 180 to `ry`, nothing else changes: the coordinates stay where they were, and from then on "toward you" has the other sign. Leave a comment where you turn over:

  ```ts
  F.step({ diagram: 3, label: 'Turn the paper over', duration: 0.8, ease: 'inOut', pose: { ry: 192 }, arc: { tz: 0.35 } });
  // Seen from the back now: folding toward us is toward −z.
  ```

  `arc` lifts the paper a little while it turns, as hands do. Keep adding: 12 → 192 → 372 → 552, so it always turns the same way.
- A diagram that rotates the model on the table ("turn the model so the point faces up") is `rz`.
- **Keep it in frame.** As the model gets smaller or moves, zoom and pan on the step that changes it (`pose: { s: 1.3, ty: -0.2 }`). The finished model should fill about half to two thirds of the frame, centred.

## White side up or coloured side up

Most models start white side up, so the folds bring the colour out. Do it either way, whichever is easier to reason about:

- **look at the back**: start with `ry` near 180, so the coloured +z side faces away (boat, heart, fox, swan, whale); or
- **keep `ry` near 0 and compile with `F.compile({ colourDown: true })`**, which makes the +z side the white one (plane, envelope, frog).

Then check on the contact sheet that the colour comes out exactly where the diagram shows it. Wrong colours are the most common thing the fold check can't see.

## Steps

```ts
F.step(meta, (s) => { /* folds with s */ });
```

| `meta` key | Meaning |
| --- | --- |
| `diagram` | the step's number on the paper diagram |
| `label` | the instruction, as a teacher would say it; the lesson shows it word for word |
| `duration` | seconds |
| `pose` | pose values reached by the end of the step (zoom, pan, turn over) |
| `arc` | pose offsets that swell and return within the step |
| `path` | `(u) => ({ ty: ..., rz: ... })`, pose offsets for any motion over the step (a hop, a flight) |
| `ease` | easing for the pose (and for solved collapses): `'fold'` (default for folds), `'inOut'`, `'in'`, `'out'`, `'linear'` |
| `phase` | `'intro'` for the first step, `'outro'` for the ending |

- **One `F.step` for every step of the diagram.** Several steps may share a diagram number: a fold and its unfold, or the left and right halves of one instruction done one after the other.
- **Durations:** 0.6–1.0 s for a fold, about 0.4 s for an unfold, 1.2–1.5 s for a collapse into a base. The loader plays them as written; the lesson plays them at half speed.
- **The first step is the intro**: `phase: 'intro'`, labelled "Start with a square" (or "...with a 1 : 2 rectangle"), bringing the paper in from the start pose (`pose: { ty: 0, tz: 0, o: 1 }`).
- **A step with no build function** only moves the camera: turning over, zooming, holding still.

**What the lesson teaches.** Every step from the first, until the first step that is only for show: one with a `path`, or one that neither folds nor changes the pose (a hold like "Finished crane"). So after the last fold, add a show step (a hold, a hop, rocking on the water) and then the outro. Never put a do-nothing step in the middle of the folding: the lesson would stop there. `check.mjs` warns when it finds one, and prints the lesson's steps so you can read them through.

## Folding: `s.fold`

```ts
s.fold(a, b, { side, toward, where?, deg?, at?, ease? })   // returns the faces that moved
```

- Cuts every flat piece of paper that matches `where` along the line through `a` and `b` (model space), and swings the part on the same side as the point `side` over by `deg` (180) toward `toward`.
- **Without `where` it folds every layer on that side**, like folding a folded sheet in half again. That is right for "fold in half" and wrong for "fold the top flap down".
- **To fold only some layers, filter them.** The filter gets each face's `FaceInfo`:
  - `sheet`: its centre on the flat sheet, which says where on the original paper it came from (`(f) => f.sheet[0] > 0` is everything from the right half of the sheet);
  - `model`: its centre where it lies now;
  - `up`: whether its front faces +z;
  - `flat`: whether it lies flat.

  Choose the test that is true of exactly the layers the diagram folds, and nothing else. A fold line that runs on into a flap it wasn't meant for is the commonest bug; the check reports it as `cancel` or `order`.
- `at: [t0, t1]` is when, within the step, this fold moves. Two folds in one step can overlap (`[0, 0.7]` and `[0.3, 1]`) for "fold both sides to the centre".
- `deg` below 180 leaves paper standing (wings at 90°) or partly folded.
- Keep what `fold` returns if you will unfold it later.

## Unfolding

Swing the same faces back about the same line, the other way:

```ts
let flap: Face[] = [];
F.step({ diagram: 2, label: 'Fold in half', duration: 0.7 }, (s) => {
  flap = s.fold(a, b, { side, toward: 1 });
});
F.step({ diagram: 2, label: 'Unfold', duration: 0.4, ease: 'inOut' }, (s) => {
  s.attach(flap, s.hinge(a, b, side, -1, 180, { ease: 'inOut' }));
});
```

The crease stays drawn on the paper afterwards, as a real precrease does. `examples/crane.ts` wraps the pair in a `precrease()` helper.

## Joints: moving paper any way

When a single fold isn't enough, make joints and attach faces to them.

| Call | What it makes |
| --- | --- |
| `s.hinge(a, b, sidePt, toward, deg, o?)` | a rotation about the line a→b that turns the `sidePt` side `deg` toward ±z; returns its index |
| `s.rot(a, b, deg, o?)` | a right-handed rotation about the axis a→b (2D or 3D points). `deg` is a number, `'free'` (the solver finds it) or `(d) => degrees` with d from 0 to 1 (worked out exactly) |
| `s.swing(pivot, deg, o?)` | a turn in the plane of the paper about a point |
| `s.move([x, y, z], o?)` | a straight move |
| `s.attach(faces, j1, j2, ...)` | carries faces on joints, innermost first: `j1` moves them within whatever `j2` carries. Chain joints so a flap folds while the paper it lies on lifts |
| `s.select(where?)` | the faces matching a filter |
| `s.split(faces, a, b, soft?)` | cuts faces along a line without moving them. `soft` is a line where paper flexes and no crease is left |
| `s.layer(above, below)` | forces `above` to stack over `below` wherever they overlap, for when the engine's guess is wrong |
| `s.pin(faceA, faceB, pt)` | keeps a sheet point the two faces share together while the solver works |

Joint options: `at: [t0, t1]` and `ease`.

## Collapses: bases and petal folds

When several creases move at once (a square base, a waterbomb base, a petal fold), the angles depend on each other. Give the ones you don't know as `'free'`, chain the faces so each rides the creases between it and a face that stays put, and pin the corners that must stay together. A small solver then finds the free angles at every moment, so the paper never tears.

```ts
const jT = s.hinge(o, [0, 1], [-0.3, 0.8], -1);       // a crease whose angle is known
const jTL = s.rot(o, [-1, 1], 'free', { free: 0 });   // one whose angle the solver finds
s.attach(q(topLeft), jT);
s.attach(q(leftTop), jTL, jT);                         // rides jTL, which rides jT
s.pin(faceOnOneSide, faceOnTheOther, [1, 0]);          // this corner of the sheet stays shared
```

Free angles with the same `free` index share one value (mirror-image creases). `examples/crane.ts` has the full square base and both petal folds.

When the motion can be worked out exactly, script it instead: a function angle `(d) => degrees`, and the helpers `turn`, `angleAbout`, `track`, `v3`, `sub`, `dot`, `cross` and `unit`. The frog's waterbomb base and squash fold work this way (`examples/frog.ts`): as each side triangle turns in by θ, the top comes down by γ = 2·atan(tan(θ/2)/√2).

## Reverse folds

- **Inside reverse fold** (a crane's neck, tail and head):

  ```ts
  s.insideReverse(faces, crease, { side, spine, front, local?, at?, ease? })
  ```

  The point goes in between its own two sides. Real paper can only do this by flexing: the layers beside the crease spread open along a soft line, the point swings through, and they close again, so no crease ever opens. `faces` is the point, every layer the crease runs through. `side` is a point toward the tip. `spine` is two points on the point's folded spine. `front` is a filter for the half nearer +z. `local` makes only the point's own layers flex, for a point that stands free like a neck. See `examples/crane.ts`.
- **Outside reverse fold**, and an inside one done the quick way:

  ```ts
  s.reverse(faces, crease, { side, axis, front, kind: 'inside' | 'outside', roll?, book? })
  ```

  This mirrors the part beyond the crease. Its crease opens on the way, which the check reports as a tear. So use `insideReverse` for inside reverse folds, and for outside ones follow the swan (`examples/swan.ts`), whose neck and head are pulled up with each motion worked out exactly.

## The show and the ending

- After the last fold, give the model a moment that suits it: a hold, a hop (`path`), rocking on water. This is also where the lesson ends.
- The outro (`phase: 'outro'`) is what the loader's `complete()` plays when the work is done: fly off, sail away, float up. It ends faded out (`o: 0`). Progress mode skips the intro and the outro.

## Before you run the check

- Every number comes from the paper's geometry, has a name and says where it comes from.
- One `F.step` for each step of the diagram, with the diagram's number and a label in a teacher's words.
- Fold lines are where the paper lies now (model space), not on the flat sheet.
- Every `toward` is chosen from which side faces the camera, above all after turning over.
- Every `where` matches exactly the layers the diagram folds.
- After the last fold comes a show step, then the outro.
