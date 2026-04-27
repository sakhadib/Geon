<div align="center">

# Geon

**A zero-dependency JavaScript library that renders static 2D geometric scenes from a concise, natural-language-like DSL into SVG — directly in the browser.**

[![Release](https://img.shields.io/badge/release-v0.1-c8491a?style=flat-square)](https://github.com/sakhadib/Geon/releases/tag/v0.1)
[![License](https://img.shields.io/badge/license-MIT-6b6457?style=flat-square)](LICENSE)
[![No Dependencies](https://img.shields.io/badge/dependencies-none-3a7d3a?style=flat-square)](#)
[![Single File](https://img.shields.io/badge/size-single%20file-3a7d3a?style=flat-square)](#)

[**Documentation**](https://sakhadib.github.io/Geon/) · [**Live Demo**](https://sakhadib.github.io/Geon/live.html) · [**Release v0.1**](https://github.com/sakhadib/Geon/releases/tag/v0.1)

</div>

---

## What is Geon?

Geon lets you describe geometric figures in a readable, line-by-line DSL and renders them as clean SVG — no canvas API, no third-party libraries, no build step.

```
scene 600x400
grid x -5 to 5 step 1 y -5 to 5 step 1

point A (0,0)
point B (3,0)

segment AB from A to B stroke #555 width 2

circle C center A r 2 stroke blue fill rgba(0,0,255,0.08)

polygon T points A B (1,3) fill rgba(255,100,0,0.15) stroke orange

point P C.center + (1,0)

label A "Origin"
label C "Circle C"
label T "Triangle"
label AB "Base"
```

Drop in `geon.js`, call `Geon.render()`. That's the whole workflow.

---

## Features

- **Zero dependencies** — a single `geon.js` file, nothing else
- **Declarative DSL** — natural, low-friction syntax; no braces, semicolons, or punctuation overhead
- **Anchor system** — shapes reference each other by name; build compositions from named points and shape anchors
- **SVG output** — clean, scalable, resolution-independent rendering
- **Strict error reporting** — every error includes a line number and a clear reason
- **Deterministic** — output is always the same for the same input; order-sensitive by design

---

## Installation

Download `geon.js` from the [v0.1 release](https://github.com/sakhadib/Geon/releases/tag/v0.1) and include it with a `<script>` tag.

```html
<script src="geon.js"></script>
```

No npm. No bundler. No configuration.

---

## Quickstart

```html
<!DOCTYPE html>
<html>
<head><title>Geon Demo</title></head>
<body>

  <div id="canvas"></div>

  <script src="geon.js"></script>
  <script>
    Geon.render(`
      scene 600x400
      grid x -5 to 5 step 1 y -5 to 5 step 1

      point A (0,0)
      point B (2,0)

      circle C center A r 2 stroke blue

      segment AB from A to B stroke black width 2

      label A "Origin"
      label C "Circle"
    `, document.getElementById('canvas'));
  </script>

</body>
</html>
```

Open the file in any browser. Done.

---

## Language Reference

Every Geon program must begin with a `scene` and a `grid` declaration, followed by any number of statements.

```
Program   ::= scene  grid  Statement*
Statement ::= point | segment | circle | polygon | label
```

### `scene`

Declares the SVG viewport dimensions in pixels.

```
scene <width>x<height>
```

```
scene 600x400
scene 800x800
```

### `grid`

Defines the logical coordinate system — bounds and step interval for both axes. The grid renders as light reference lines, with the x=0 and y=0 axes drawn darker. **Geon uses standard math coordinates: positive Y goes up.**

```
grid x <xmin> to <xmax> step <dx>  y <ymin> to <ymax> step <dy>
```

```
grid x -5 to 5 step 1  y -5 to 5 step 1
grid x  0 to 10 step 2 y  0 to 10 step 2
```

| Constraint | Rule |
|---|---|
| `xmin < xmax` | Required |
| `ymin < ymax` | Required |
| `dx > 0`, `dy > 0` | Required — zero step is an error |

### `point`

Declares a named point. Points render as small filled circles and can be used as anchors for other shapes.

```
point <id> (<x>,<y>)
point <id> <AnchorExpr>
```

```
point A (0,0)
point B A + (2,1)        # offset from another point
point P C.center + (1,0) # offset from a circle's center
point Q T.p2             # second vertex of polygon T
```

### `segment`

Draws a line between two anchor expressions.

```
segment <id> from <AnchorExpr> to <AnchorExpr> [style]
```

```
segment AB from A to B
segment S  from (-2,0) to (2,0) stroke red width 3
segment R  from A to C.center   stroke blue
```

**Available anchors:** `segId.from`, `segId.to`

### `circle`

Draws a circle. The radius is in logical (grid) units.

```
circle <id> center <AnchorExpr> r <number> [style]
```

```
circle C center A r 2
circle C center (0,0) r 3 stroke blue fill rgba(0,0,255,0.1)
```

**Available anchors:** `circleId.center`

> Radius `0` is valid and renders as a dot. Negative radius is an error.

### `polygon`

Draws a closed polygon. Requires at least 3 points.

```
polygon <id> points <AnchorExpr> <AnchorExpr> <AnchorExpr> ... [style]
```

```
polygon T points A B (1,2)
polygon Q points (-1,-1) (1,-1) (1,1) (-1,1) fill rgba(255,0,0,0.2)
```

**Available anchors:** `polyId.p1`, `polyId.p2`, … (1-indexed vertices)

### `label`

Attaches a text annotation to any declared identifier. Labels are always rendered on the topmost layer, after all shapes.

```
label <target> "<text>" [style]
```

```
label A  "Origin"
label C  "Unit Circle" color blue
label T  "Triangle" size 10
label AB "Hypotenuse" color red size 14
```

| Target type | Label anchors at |
|---|---|
| point | The point itself |
| circle | Center of the circle |
| segment | Midpoint of the segment |
| polygon | Centroid of the polygon |

Multiple labels on the same target are both rendered (stacked).

---

## Anchor Expressions

An *anchor expression* resolves to a 2D coordinate. They appear wherever a position is needed.

```
AnchorExpr ::=
    (x,y)                   # literal coordinate
  | pointId                 # named point
  | shapeId.anchor          # named anchor on a shape
  | AnchorExpr + (dx,dy)    # vector offset (right-hand side must be a literal tuple)
```

**Supported shape anchors:**

| Shape | Anchor syntax |
|---|---|
| point | `pointId` |
| circle | `circleId.center` |
| polygon | `polyId.p1`, `polyId.p2`, … |
| segment | `segId.from`, `segId.to` |

```
# Valid
point P A + (1,0)
point Q C.center + (-1,2)
segment S from A to C.center

# Invalid — right-hand side of + must be a (dx,dy) tuple, not a ref
point B A + A    # Error
```

---

## Styling

Style tokens are appended inline after the shape or label declaration. All tokens are optional.

```
circle C center A r 2  stroke blue  fill rgba(0,0,255,0.15)  width 3
segment S from A to B  stroke #e07b54  width 2
polygon T points A B (1,2)  fill rgba(255,0,0,0.2)  stroke red
label A "Origin" color red size 14
```

| Token | Default | Accepts |
|---|---|---|
| `stroke` | `black` | Any CSS color — named, hex, rgb, rgba (shapes) |
| `fill` | `none` | Any CSS color, or `none` (shapes) |
| `width` | `2` | Number ≥ 0 (shapes) |
| `color` | `#222` | Any CSS color (labels) |
| `size` | `12` | Number ≥ 0 (labels) |

---

## Rendering Order

Geon renders in three fixed layers:

1. **Grid** — light reference lines and axis labels
2. **Shapes** — in declaration order; later shapes appear on top
3. **Labels** — always topmost, regardless of where `label` appears in source

```
circle A center (0,0) r 2   # drawn first → underneath
circle B center (1,0) r 2   # drawn second → on top of A
```

---

## JavaScript API

```js
Geon.render(source, container)
```

| Parameter | Type | Description |
|---|---|---|
| `source` | `string` | The Geon DSL program |
| `container` | `HTMLElement` | DOM element to render into |

**Returns:**

```js
{ success: true }
// or
{ success: false, error: "..." }
```

On success, the container is cleared and the rendered `<svg>` is appended. On error, a styled error message is shown in the container and the error string is returned.

```js
const result = Geon.render(source, document.getElementById('canvas'));
if (!result.success) {
  console.error('Geon error:', result.error);
}
```

---

## Error Reference

All errors stop execution immediately and include a line number.

| Error | Cause |
|---|---|
| `Missing scene declaration` | No `scene` statement in the program |
| `Missing grid declaration` | No `grid` statement in the program |
| `Undefined identifier 'X'` | Referencing a name that was never declared |
| `Duplicate identifier 'X'` | Declaring the same name twice |
| `Circular reference` | A point that depends on itself directly or transitively |
| `Invalid anchor 'X.prop'` | Accessing a property that doesn't exist on that shape (e.g. `circle.radius`) |
| `Polygon requires >= 3 points` | A `polygon` with fewer than 3 vertices |
| `Radius must be >= 0` | A circle with a negative radius |
| `Grid step must be > 0` | A step value of zero or negative |
| `Grid x min must be < x max` | Inverted grid range |
| `Undefined label target 'X'` | `label X "..."` where X was never declared |
| `Unknown keyword 'X'` | Unrecognized or capitalized keyword (e.g. `Point`, `Circle`) |
| `Malformed coordinate` | Coordinates like `(1,)` or `(,2)` |
| `Expected (dx,dy) after '+'` | Vector addition with a non-literal right-hand side |

---

## Edge Cases

| Case | Behavior |
|---|---|
| Forward reference (use before declare) | ❌ Error |
| Chained circular dependency | ❌ Error |
| Duplicate identifier | ❌ Error |
| Grid step = 0 | ❌ Error |
| Grid min ≥ max | ❌ Error |
| Negative radius | ❌ Error |
| Missing `scene` or `grid` | ❌ Error |
| Capitalized keywords (`Point`, `Circle`) | ❌ Error |
| Malformed coordinate `(1,)` | ❌ Error |
| Accessing `circle.radius` as anchor | ❌ Error |
| Label on undeclared target | ❌ Error |
| Zero radius circle | ✅ Allowed — renders as a dot |
| Zero-length segment (same endpoints) | ✅ Allowed — renders as point-like line |
| Collinear polygon (area = 0) | ✅ Allowed — renders as a line |
| Self-intersecting polygon | ✅ Allowed — SVG handles rendering |
| Coordinates outside grid bounds | ✅ Allowed — SVG clips naturally |
| Extra whitespace between tokens | ✅ Allowed |
| Multiple labels on the same target | ✅ Allowed — both rendered (stacked) |
| Invalid CSS color name in `stroke` | ✅ Allowed — SVG silently falls back |

---

## Full Example

```
scene 600x400
grid x -5 to 5 step 1 y -5 to 5 step 1

# Define anchor points
point A (0,0)
point B (3,0)

# Draw a segment between them
segment AB from A to B stroke #555 width 2

# Circle centered on A
circle C center A r 2 stroke blue fill rgba(0,0,255,0.08)

# Triangle using A, B, and a literal coordinate
polygon T points A B (1,3) fill rgba(255,100,0,0.15) stroke orange

# Point derived from a shape anchor
point P C.center + (1,0)

# Labels
label A  "Origin" size 14 color black
label C  "Circle C" color blue
label T  "Triangle" color orange
label AB "Base" color #555
```

---

## Links

| | |
|---|---|
| 📦 Release | [v0.1 — GitHub Releases](https://github.com/sakhadib/Geon/releases/tag/v0.1) |
| 📖 Documentation | [sakhadib.github.io/Geon](https://sakhadib.github.io/Geon/) |
| 🎮 Live Demo | [sakhadib.github.io/Geon/live.html](https://sakhadib.github.io/Geon/live.html) |
| 🗂 Repository | [github.com/sakhadib/Geon](https://github.com/sakhadib/Geon) |

---

## License

MIT — see [LICENSE](LICENSE) for details.
