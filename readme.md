<div align="center">

# Geon

**A zero-dependency JavaScript library that renders static 2D mathematical graphics from a concise, natural-language-like DSL into SVG — directly in the browser.**

[![Version](https://img.shields.io/badge/version-v2.0.0-c8491a?style=flat-square)](#)
[![License](https://img.shields.io/badge/license-MIT-6b6457?style=flat-square)](LICENSE)
[![No Dependencies](https://img.shields.io/badge/dependencies-none-3a7d3a?style=flat-square)](#)
[![Single File](https://img.shields.io/badge/size-single%20file-3a7d3a?style=flat-square)](#)

[**Documentation**](https://sakhadib.github.io/Geon/) · [**Live Demo**](https://sakhadib.github.io/Geon/live.html) · [**Releases**](https://github.com/sakhadib/Geon/releases)

</div>

---

## What is Geon?

Geon lets you describe geometric figures and mathematical curves in a readable, line-by-line DSL and renders them as clean SVG — no canvas API, no third-party libraries, no build step.

```
scene 600x400
grid x -5 to 5 step 1 y -5 to 5 step 1

let r = 2.5

style guide {
  stroke gray
  width 1
  dash 4,4
}

point A (0,0)
point B polar (r,45)
midpoint M of A B

segment AB from A to B stroke gray width 2 arrow end
circle C center A r r stroke blue fill lightblue opacity 0.35
plot P y=x^2-2 from -3 to 3 stroke crimson width 2

label A "Origin" position southwest
label B "Polar point" position northeast
label P "y = x^2 - 2" color crimson
```

Drop in `geon.js`, call `Geon.render()`. That's the whole workflow.

---

## Features

- **Zero dependencies** — a single `geon.js` file, nothing else
- **Declarative DSL** — natural, low-friction syntax; no semicolons or setup code
- **Variables and expressions** — `let`, arithmetic, constants, and tuple-level math functions
- **Mathematical plotting** — render `y=<expr>` curves over a domain
- **Expanded primitives** — points, segments, circles, ellipses, rectangles, arcs, polygons, infinite lines, rays, and cubic Beziers
- **Anchor system** — shapes reference each other by name; build compositions from named points and shape anchors
- **Intersections** — derive points from line/circle and circle/circle intersections
- **Reusable styling** — inline style tokens plus named `style` blocks and `use`
- **Advanced SVG styling** — dash patterns, opacity, and arrowheads
- **Smart labels** — automatic overlap avoidance plus directional hints
- **Tooling hooks** — `Geon.parse()` and `Geon.resolve()` for editors, previews, and debugging

---

## Installation

Download `geon.js` from this repository and include it with a `<script>` tag.

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

      let r = 2

      point A (0,0)
      point B polar (r,30)

      circle C center A r r stroke blue fill lightblue opacity 0.35
      segment AB from A to B stroke black width 2 arrow end
      plot S y=x^2-2 from -3 to 3 stroke crimson width 2

      label A "Origin" position southwest
      label C "Circle" color blue
      label S "Parabola" color crimson
    `, document.getElementById('canvas'));
  </script>

</body>
</html>
```

Open the file in any browser. Done.

---

## Language Reference

Every Geon program needs one `scene` and one `grid` declaration, followed by any number of statements. Identifiers must be declared before they are used.

```
Program   ::= scene  grid  Statement*
Statement ::= let | style | point | midpoint | segment | circle | ellipse
            | rect | arc | polygon | line | ray | bezier | plot
            | intersect | label | layer
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

### Expressions and `let`

Geon v2 supports numeric expressions in coordinates, polar tuples, radii, dimensions, plot formulas, and `let` declarations.

```
let <name> = <expression>
```

```
let r = 2.5
let theta = 30

point A (r*cos(theta), r*sin(theta))
circle C center A r r*0.5
```

| Supported | Syntax |
|---|---|
| Operators | `+`, `-`, `*`, `/`, `^` |
| Constants | `pi`, `tau`, `e` |
| Degree trig | `sin(x)`, `cos(x)`, `tan(x)` |
| Radian trig | `sinr(x)`, `cosr(x)`, `tanr(x)` |
| Other functions | `sqrt`, `abs`, `floor`, `ceil`, `round`, `log`, `exp`, `sign` |

Expressions are evaluated by Geon's tokenizer-based evaluator; the library does not use JavaScript `eval()`. Function-call expressions such as `sin(30)` are safest inside tuple expressions, for example point coordinates and vector offsets. Scalar fields such as radii and plot formulas should be written as compact single-token expressions like `r*0.5`, `pi`, or `x^2-2`.

### `point`

Declares a named point. Points render as small filled circles and can be used as anchors for other shapes.

```
point <id> (<x>,<y>)
point <id> <AnchorExpr>
point <id> polar (<r>,<degrees>)
```

```
point A (0,0)
point B A + (2,1)           # offset from another point
point P C.center + (1,0)    # offset from a circle's center
point Q T.p2                # second vertex of polygon T
point R polar (3,45)        # polar coordinate from the origin
```

### `midpoint`

Creates a point halfway between two existing point-like identifiers.

```
midpoint <id> of <pointA> <pointB>
```

```
midpoint M of A B
label M "midpoint"
```

### `segment`

Draws a line between two anchor expressions.

```
segment <id> from <AnchorExpr> to <AnchorExpr> [style]
```

```
segment AB from A to B
segment S  from (-2,0) to (2,0) stroke red width 3
segment R  from A to C.center stroke blue arrow end
```

**Available anchors:** `segId.from`, `segId.to`, `segId.mid`

### `circle`

Draws a circle. The radius is in logical (grid) units.

```
circle <id> center <AnchorExpr> r <expression> [style]
```

```
circle C center A r 2
circle D center (0,0) r pi stroke blue fill lightblue opacity 0.35
```

**Available anchors:** `circleId.center`

> Radius `0` is valid and renders as a dot. Negative radius is an error.

### `ellipse`

Draws an ellipse centered on an anchor expression.

```
ellipse <id> center <AnchorExpr> rx <expression> ry <expression> [style]
```

```
ellipse E center A rx 3 ry 1.5 stroke purple fill plum opacity 0.35
```

**Available anchors:** `ellipseId.center`

### `rect`

Draws a rectangle from its top-left logical point with width and height in grid units.

```
rect <id> at <AnchorExpr> w <expression> h <expression> [style]
```

```
rect R at (-2,2) w 4 h 2 stroke black fill gainsboro opacity 0.5
```

**Available anchors:** `rectId.topleft`, `rectId.topright`, `rectId.bottomleft`, `rectId.bottomright`, `rectId.center`

### `arc`

Draws a circular arc in degrees.

```
arc <id> center <AnchorExpr> r <expression> from <degrees> to <degrees> [style]
```

```
arc A1 center (0,0) r 3 from 20 to 160 stroke orange width 3
```

**Available anchors:** `arcId.center`

### `polygon`

Draws a closed polygon. Requires at least 3 points.

```
polygon <id> points <AnchorExpr> <AnchorExpr> <AnchorExpr> ... [style]
```

```
polygon T points A B (1,2)
polygon Q points (-1,-1) (1,-1) (1,1) (-1,1) fill pink opacity 0.6
```

**Available anchors:** `polyId.p1`, `polyId.p2`, … (1-indexed vertices), `polyId.centroid`

### `line` and `ray`

Draws an infinite line through two points, or a ray from one point through another.

```
line <id> through <AnchorExpr> <AnchorExpr> [style]
ray <id> from <AnchorExpr> through <AnchorExpr> [style]
```

```
line L through A B stroke gray dash 4,4
ray R from A through B stroke red arrow end
```

**Available anchors:** `lineId.p1`, `lineId.p2`, `lineId.mid`, `rayId.origin`

### `bezier`

Draws a cubic Bezier curve.

```
bezier <id> from <AnchorExpr> control <AnchorExpr> <AnchorExpr> to <AnchorExpr> [style]
```

```
bezier BZ from (-4,-1) control (-2,3) (2,-3) to (4,1) stroke crimson width 3
```

**Available anchors:** `bezierId.from`, `bezierId.to`, `bezierId.mid`

### `plot`

Plots a function `y=<expression>` over an x-domain. The expression can use `x`, variables from `let`, constants, and compact arithmetic.

```
plot <id> y=<expression> from <expression> to <expression> [step <expression>] [style]
```

```
plot P y=x^2 from -3 to 3 stroke crimson width 2
plot Q y=x^3-x from -3 to 3 step 0.05 stroke blue
```

If `step` is omitted, Geon samples roughly 300 points across the domain. Non-finite points are treated as discontinuities.

### `intersect`

Creates point symbols from intersections between supported shapes.

```
intersect <id> <shapeA> <shapeB>
```

```
line L through (-3,0) (3,0)
circle C center (0,0) r 2
intersect X L C

label X "first"
label X_2 "second"
```

Supported combinations are line-family vs line-family, line-family vs circle, and circle vs circle. Line-family shapes include `segment`, `line`, and `ray`; intersections are computed from their supporting lines. The first intersection is stored as `<id>`, and a second intersection, when present, is stored as `<id>_2`.

### `label`

Attaches a text annotation to a declared identifier. Labels are always rendered on the topmost layer, after all shapes.

```
label <target> "<text>" [position <direction>] [style]
```

```
label A  "Origin"
label C  "Unit Circle" color blue
label T  "Triangle" size 10
label AB "Hypotenuse" color red size 14
label P  "north-east label" position northeast
```

| Target type | Label anchors at |
|---|---|
| point | The point itself |
| circle | Center of the circle |
| segment | Midpoint of the segment |
| polygon | Centroid of the polygon |
| rect | Center of the rectangle |
| plot | Middle sampled point |

Supported position hints: `north`, `south`, `east`, `west`, `northeast`, `northwest`, `southeast`, `southwest`.

Multiple labels on the same target are both rendered. When labels would overlap and no explicit position is given, Geon repositions later labels to nearby free space.

### `style`

Defines a reusable style block. Apply it with `use <styleName>`, then override any token inline if needed.

```
style <name> {
  <style tokens>
}
```

```
style construction {
  stroke gray
  width 1
  dash 4,4
  opacity 0.75
}

line L through A B use construction
circle C center A r 2 use construction stroke blue
```

### `layer`

`layer <name>` is accepted by the parser as a source marker. The current renderer still uses the fixed render order described below.

---

## Anchor Expressions

An *anchor expression* resolves to a 2D coordinate. They appear wherever a position is needed.

```
AnchorExpr ::=
    (x,y)                   # literal coordinate; x and y may be expressions
  | pointId                 # named point
  | shapeId.anchor          # named anchor on a shape
  | AnchorExpr + (dx,dy)    # vector offset; right side must be a tuple
```

**Supported shape anchors:**

| Shape | Anchor syntax |
|---|---|
| point | `pointId` |
| circle | `circleId.center` |
| ellipse | `ellipseId.center` |
| rect | `rectId.topleft`, `rectId.topright`, `rectId.bottomleft`, `rectId.bottomright`, `rectId.center` |
| arc | `arcId.center` |
| polygon | `polyId.p1`, `polyId.p2`, …, `polyId.centroid` |
| segment | `segId.from`, `segId.to`, `segId.mid` |
| line | `lineId.p1`, `lineId.p2`, `lineId.mid` |
| ray | `rayId.origin` |
| bezier | `bezierId.from`, `bezierId.to`, `bezierId.mid` |

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

Style tokens are appended inline after a shape or label declaration, or placed in a named `style` block. All tokens are optional.

```
circle C center A r 2  stroke blue  fill lightblue  opacity 0.35  width 3
segment S from A to B  stroke coral  width 2  dash 4,4  arrow end
polygon T points A B (1,2)  fill pink  stroke red  opacity 0.7
label A "Origin" color red size 14
```

| Token | Default | Accepts |
|---|---|---|
| `stroke` | `black` | Single-token CSS color names are safest; `#` starts comments |
| `fill` | `none` | Single-token CSS color names, or `none` |
| `width` | `2` | Number (SVG stroke width) |
| `dash` | `null` | SVG dash array such as `4,4` |
| `opacity` | `1` | Number, commonly `0` to `1` |
| `arrow` | `null` | `start`, `end`, or `both` |
| `color` | `#222` | Single-token CSS color names for labels |
| `size` | `12` | Number (label font size) |
| `use` | n/a | Name of a declared style block |

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

### Tooling helpers

```js
Geon.parse(source)
Geon.resolve(source)
Geon.version
```

`Geon.parse()` returns `{ ast, styleBlocks }` or throws. `Geon.resolve()` runs the full parse/resolve pipeline and returns resolved symbols, labels, variables, scene, and grid data without rendering. `Geon.version` is currently `"2.0.0"`.

---

## Error Reference

All errors stop execution immediately and include a line number where possible.

| Error | Cause |
|---|---|
| `Missing 'scene WxH'` | No `scene` statement in the program |
| `Missing 'grid x ... y ...'` | No `grid` statement in the program |
| `Undefined identifier 'X'` / `Undefined id 'X'` | Referencing a name that was never declared |
| `Duplicate id 'X'` | Declaring the same name twice |
| `Invalid anchor 'X.prop'` | Accessing a property that doesn't exist on that shape |
| `Expression error in (...)` | A coordinate expression could not be evaluated |
| `Undefined variable or function: 'x'` | An expression references an unknown variable or function |
| `Division by zero` | An expression divides by zero |
| `Polygon requires >= 3 points` | A `polygon` with fewer than 3 vertices |
| `Invalid radius` | A circle radius is negative or invalid |
| `Grid step must be > 0` | A step value of zero or negative |
| `Grid x min must be < max` | Inverted grid range |
| `Undefined label target 'X'` | `label X "..."` where X was never declared |
| `Unknown keyword 'X'` | Unrecognized or capitalized keyword (e.g. `Point`, `Circle`) |
| `Malformed coordinate` | Coordinates like `(1,)` or `(,2)` |
| `Expected (dx,dy) after '+'` | Vector addition with a non-tuple right-hand side |
| `No intersection found between 'A' and 'B'` | Supported shapes do not intersect |
| `Cannot intersect shapes of types ...` | Intersection requested for unsupported shape types |

---

## Edge Cases

| Case | Behavior |
|---|---|
| Forward reference (use before declare) | ❌ Error |
| Duplicate identifier | ❌ Error |
| Unknown expression variable/function | ❌ Error |
| Division by zero in expression | ❌ Error |
| Grid step = 0 | ❌ Error |
| Grid min ≥ max | ❌ Error |
| Negative radius | ❌ Error |
| Missing `scene` or `grid` | ❌ Error |
| Capitalized keywords (`Point`, `Circle`) | ❌ Error |
| Malformed coordinate `(1,)` | ❌ Error |
| Accessing `circle.radius` as anchor | ❌ Error |
| Label on undeclared target | ❌ Error |
| Unsupported intersection pair | ❌ Error |
| No intersection found | ❌ Error |
| Zero radius circle | ✅ Allowed — renders as a dot |
| Zero-length segment (same endpoints) | ✅ Allowed — renders as point-like line |
| Collinear polygon (area = 0) | ✅ Allowed — renders as a line |
| Self-intersecting polygon | ✅ Allowed — SVG handles rendering |
| Coordinates outside grid bounds | ✅ Allowed — SVG clips naturally |
| Extra whitespace between tokens | ✅ Allowed |
| Multiple labels on the same target | ✅ Allowed — both rendered, with automatic overlap avoidance |
| Invalid CSS color name in `stroke` | ✅ Allowed — SVG silently falls back |

---

## Full Example

```
scene 700x450
grid x -6 to 6 step 1 y -4 to 4 step 1

let r = 2.5
let angle = 35

style construction {
  stroke gray
  width 1
  dash 4,4
  opacity 0.75
}

# Define anchor points
point A (0,0)
point B polar (r,angle)
midpoint M of A B

# Core geometry
segment AB from A to B stroke gray width 2 arrow end
circle C center A r r stroke blue fill lightblue opacity 0.35
ellipse E center M rx 1.4 ry 0.6 stroke purple fill plum opacity 0.35
rect R at (-5,3) w 2 h 1.25 stroke black fill gainsboro opacity 0.5
arc K center A r 3 from 20 to 150 stroke orange width 3

# Lines, curves, and derived points
line L through (-5,-1) (5,2) use construction
ray Y from A through (1,1) stroke crimson arrow end
bezier BZ from (-4,-2) control (-2,3) (2,-3) to (4,2) stroke green width 2
plot P y=x^2-2 from -3 to 3 step 0.05 stroke crimson width 2
intersect X L C

# Labels
label A  "Origin" position southwest size 14 color black
label B  "Polar point" position northeast
label M  "Midpoint" position south
label C  "Circle C" color blue
label X  "Intersection"
label P  "y = x^2 - 2" color crimson
```

---

## Links

| | |
|---|---|
| 📦 Releases | [GitHub Releases](https://github.com/sakhadib/Geon/releases) |
| 📖 Documentation | [sakhadib.github.io/Geon](https://sakhadib.github.io/Geon/) |
| 🎮 Live Demo | [sakhadib.github.io/Geon/live.html](https://sakhadib.github.io/Geon/live.html) |
| 🗂 Repository | [github.com/sakhadib/Geon](https://github.com/sakhadib/Geon) |

---

## License

MIT — see [LICENSE](LICENSE) for details.
