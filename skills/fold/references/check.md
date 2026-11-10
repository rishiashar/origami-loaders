# Checking a model

Two checks, and you need both. The fold check (`scripts/check.mjs`) proves the paper behaves like paper. The contact sheet (`scripts/lesson.mjs --frames`) shows whether it is the right model. A fold on the wrong line passes the first and fails the second.

## The fold check

```sh
node <skill>/scripts/check.mjs origami/tulip.ts
```

It folds the model, then lays out the picture at many moments of every step, exactly as the renderer does, and reports four kinds of problem. It prints the steps the lesson will teach, and warnings about the lesson. Exit code 0 means no issues.

### The engine stopped while folding

The engine refuses some impossible instructions outright, for example `reverse: the axis runs parallel to the crease`, `insideReverse: the spine runs parallel to the crease`, or `insideReverse: the point would land outside its own sides (that is an outside reverse fold)`. The crease, spine or axis points are wrong: usually two points that are the same, a line in the wrong direction, or points taken from the flat sheet instead of where the paper lies now.

### `cancel`: a face rides joints that undo each other

A piece of paper moves during the step and ends exactly where it started. This is almost always a fold line running on into a flap it wasn't meant for. Two folds in the step both caught that piece, one each way, so it went out and came back. Add a `where` filter so each fold moves only the layers the diagram folds.

### `order`: a farther layer painted over a nearer one

Where two layers overlap, the one further from the viewer was drawn on top, so the wrong side or layer of the paper shows. Usual causes, most likely first:

- the fold went the wrong way: check `toward` against which side faces the camera, above all after turning over;
- the fold moved the wrong layers: without `where` it folds every layer on that side;
- several layers that fold together were folded separately, and the stacking between them was guessed wrong: fold them in one `s.fold`, or say which goes above with `s.layer(above, below)`.

### `tear`: a crease opens

Two pieces of paper that share a crease drift apart: real paper would have to tear. Every crease is checked at 40 moments of every step, with no exceptions.

- **A layer was left behind.** Every layer the fold line runs through must move. Attach the whole flap, all its layers.
- **Joints are chained in the wrong order.** `s.attach(faces, inner, outer)`: the first joint moves the faces within what the next one carries.
- **A collapse with an angle that should be solved.** Give the unknown angles as `'free'` and `pin` the corners that must stay together.
- **An inside reverse fold done with `s.reverse`.** Its crease opens on the way. Use `s.insideReverse`, which flexes the paper the way hands do.
- **A fold whose line moved.** Within one step, the line has to be where the paper lies at the start of the step.

Never work around a tear by cutting the motion into more steps, or by shortening a step until the gap is too small to see. The lesson plays every step slowly, and the person folding along would be asked to tear their paper.

### Lesson warnings

- **"The lesson stops at step N"**: a step in the middle of the folding neither folds, turns nor moves the paper, so the lesson ends there. Give it something to do, or move it after the folding.
- **Steps with no label**: every step's label is shown as its instruction; write one.

Read the printed lesson steps through as if you were folding: is each one an instruction you could follow?

## The contact sheet

```sh
node <skill>/scripts/lesson.mjs origami/tulip.ts --name tulip --out out/tulip-lesson.html --frames out/frames
```

`out/frames/contact-sheet.png` shows every lesson step: half-folded on the left, done on the right, with the step's number and label. `step-NN-mid-fold.png` and `step-NN-done.png` are the single pictures, larger. Look at every step and compare it with the diagram:

| What you see | Usual cause |
| --- | --- |
| The colour is on the wrong side | the start pose: `ry` near 0 or 180, or `colourDown` (see *White side up* in `engine.md`) |
| A flap folds the wrong way, or behind instead of in front | `toward`, often after a turn over |
| The wrong flap moves, or every layer moves when one should | `where` |
| A step looks exactly like the one before | the fold moved nothing: its `where` matched no paper, or its `side` point is on the wrong side of the line |
| The model runs out of the frame, or ends up tiny | the step's `pose`: zoom with `s`, pan with `tx` and `ty` |
| The model is the right shape but faces the wrong way | `rz`, or the order of turning over |
| The finished model doesn't look like the thing | a fold line is in the wrong place: compare each step's line with the diagram |

When the sheet matches the diagram step by step, the model is right. Say in your summary that you looked, and what you compared it with.

## What neither check can tell you

Whether this is how the model is really folded. Both checks are about the file you wrote. For a lesson people will fold from, ask the person to fold it by hand once, following the lesson.
