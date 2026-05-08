---
name: geon-dsl
description: >
  Generate valid Geon DSL programs for rendering 2D mathematical graphics as SVG.
  Use this skill whenever the user asks to draw, visualize, or diagram anything using
  Geon — geometric figures, function curves, coordinate geometry, triangle constructions,
  circle theorems, intersection points, labeled diagrams, or any mathematical illustration.
  Also trigger when the user provides a Geon snippet to fix, extend, or explain.
  Geon DSL is a zero-dependency JavaScript library: one <script> tag, one Geon.render() call.
---

# Geon DSL Code Generation Skill

Geon v2.0 is a declarative DSL that compiles to SVG. Every statement is one line (except `style` blocks). **All keywords are lowercase.** No semicolons. `#` starts a comment.

---

## Program Structure (REQUIRED)

Every valid Geon program must start with exactly these two lines, in this order:

```
scene <width>x<height>
grid x <xmin> to <xmax> step <dx>  y <ymin> to <ymax> step <dy>
```

Then any number of statements follow. Identifiers must be declared before use (no forward references).

```
scene 600x400
grid x -5 to 5 step 1  y -4 to 4 step 1
```

**Grid rules:** `xmin < xmax`, `ymin < ymax`, `dx > 0`, `dy > 0`. Geon uses **math coordinates**: positive Y goes up.

---

## Variables — `let`

```
let <name> = <expression>
```

```
let r = 2.5
let theta = 45
let side = sqrt(3)
```

Variables can be used in any expression afterward. They are evaluated top-to-bottom; reference order matters.

---

## Expressions

Used inside coordinates, radii, dimensions, and `let` declarations.

| Feature | Syntax |
|---|---|
| Operators | `+  -  *  /  ^` |
| Constants | `pi`  `tau`  `e` |
| Trig (degrees) | `sin(x)`  `cos(x)`  `tan(x)` |
| Trig (radians) | `sinr(x)`  `cosr(x)`  `tanr(x)` |
| Other functions | `sqrt`  `abs`  `floor`  `ceil`  `round`  `log`  `exp`  `sign` |

**Important:** Function calls like `sin(30)` are safe inside tuple coordinates `(x,y)`. In scalar positions (radius, width, etc.) use compact no-space expressions like `r*0.5`, `pi`, `x^2`.

---

## Shapes — Quick Reference

### `point`
```
point <id> (<x>,<y>)
point <id> polar (<r>,<degrees>)
point <id> <AnchorExpr>
point <id> <AnchorExpr> + (<dx>,<dy>)
```
```
point O (0,0)
point A polar (3,60)
point B O + (2,1)
point C circleC.center + (1,0)
```

### `midpoint`
```
midpoint <id> of <pointA> <pointB>
```
```
midpoint M of A B
```

### `segment`
```
segment <id> from <AnchorExpr> to <AnchorExpr> [style]
```
```
segment AB from A to B stroke black width 2
segment h  from (-3,0) to (3,0) stroke gray dash 4,4
segment r  from O to C.center stroke blue arrow end
```
Anchors: `segId.from`  `segId.to`  `segId.mid`

### `circle`
```
circle <id> center <AnchorExpr> r <expr> [style]
```
```
circle C center O r 2 stroke blue fill lightblue opacity 0.35
circle unit center (0,0) r 1 stroke black
```
Anchors: `circleId.center`

### `ellipse`
```
ellipse <id> center <AnchorExpr> rx <expr> ry <expr> [style]
```
```
ellipse E center O rx 3 ry 1.5 stroke purple fill plum opacity 0.3
```
Anchors: `ellipseId.center`

### `rect`
```
rect <id> at <AnchorExpr> w <expr> h <expr> [style]
```
`at` is the **top-left** corner in math coordinates (remember: Y goes up, so top-left has the larger Y value).
```
rect box at (-2,3) w 4 h 2 stroke black fill gainsboro opacity 0.5
```
Anchors: `rectId.topleft`  `rectId.topright`  `rectId.bottomleft`  `rectId.bottomright`  `rectId.center`

### `arc`
```
arc <id> center <AnchorExpr> r <expr> from <startDeg> to <endDeg> [style]
```
Angles in degrees, counter-clockwise from positive-X axis.
```
arc a1 center O r 2 from 0 to 90 stroke orange width 2
arc sweep center A r 1.5 from 20 to 150 stroke green
```
Anchors: `arcId.center`

### `polygon`
```
polygon <id> points <AnchorExpr> <AnchorExpr> <AnchorExpr> [more...] [style]
```
Requires ≥ 3 points. Points can be named refs, shape anchors, or literal coords.
```
polygon T points A B C fill yellow opacity 0.4 stroke black
polygon quad points (-2,0) (0,2) (2,0) (0,-2) stroke navy fill aliceblue
```
Anchors: `polyId.p1`  `polyId.p2`  …  `polyId.centroid`

### `line` (infinite)
```
line <id> through <AnchorExpr> <AnchorExpr> [style]
```
```
line L through A B stroke gray dash 4,4
line ax through (-5,0) (5,0) stroke black width 1
```
Anchors: `lineId.p1`  `lineId.p2`  `lineId.mid`

### `ray`
```
ray <id> from <AnchorExpr> through <AnchorExpr> [style]
```
```
ray r1 from O through A stroke red arrow end
```
Anchors: `rayId.origin`

### `bezier` (cubic)
```
bezier <id> from <AnchorExpr> control <cp1> <cp2> to <AnchorExpr> [style]
```
```
bezier curve from (-3,-2) control (-1,3) (1,-3) to (3,2) stroke green width 2
```
Anchors: `bezierId.from`  `bezierId.to`  `bezierId.mid`

### `plot`
```
plot <id> y=<expr> from <xMin> to <xMax> [step <dx>] [style]
```
`x` is the free variable. Default step is auto (fine). Use `step` to control sampling density.
```
plot P y=x^2-2 from -3 to 3 stroke crimson width 2
plot S y=sin(x) from -360 to 360 step 5 stroke steelblue
plot T y=2*x+1 from -4 to 4 stroke orange
```
> Note: `sin(x)` in plot formulas treats x as **degrees**. Use `sinr(x)` for radians.

### `intersect`
```
intersect <id> <shapeA> <shapeB>
```
Supported pairs: line↔circle, circle↔circle, line↔line. Produces a point (first intersection if multiple).
```
intersect X L C
intersect P c1 c2
```

---

## Anchor Expressions

An anchor expression resolves to a 2D coordinate. Used wherever a position is needed.

```
(<x>,<y>)               # literal; x and y may be full expressions
pointId                 # named point
shapeId.anchor          # shape anchor property
AnchorExpr + (<dx>,<dy>) # vector offset — right side MUST be a tuple
```

**The right side of `+` must always be a `(dx,dy)` tuple — not a variable name or another anchor.**

```
# Valid
point P A + (1,0)
point Q C.center + (0,-2)
segment S from A to rectR.topright

# Invalid
point B A + A      # Error — right side must be a tuple
```

---

## Styling

Style tokens appear inline after any shape declaration, or inside a named `style` block.

| Token | Default | Values |
|---|---|---|
| `stroke` | `black` | Any single-word CSS color (`blue`, `crimson`, `#abc` not recommended — `#` starts comments) |
| `fill` | `none` | CSS color or `none` |
| `width` | `2` | Number (SVG stroke-width) |
| `opacity` | `1` | 0.0 – 1.0 |
| `dash` | none | SVG dash array, e.g. `4,4` or `8,4` |
| `arrow` | none | `start`, `end`, or `both` |
| `color` | `#222` | Label text color |
| `size` | `12` | Label font size |
| `use` | — | Name of a declared `style` block |

> **Color names:** Use standard single-word CSS color names. Hex codes starting with `#` will be treated as comments and break parsing. Stick to named colors: `red`, `blue`, `crimson`, `steelblue`, `lightblue`, `plum`, `gainsboro`, `coral`, `orange`, `navy`, `forestgreen`, `gold`, `violet`, etc.

### Named Style Blocks

```
style <name> {
  stroke gray
  width 1
  dash 4,4
  opacity 0.75
}

line L through A B use construction
circle C center O r 2 use construction stroke blue   # override stroke inline
```

---

## Labels

```
label <targetId> "<text>" [position <dir>] [color <color>] [size <n>]
```

Target can be any named shape or point. Labels always render on top.

```
label O "Origin" position southwest size 14
label C "Circle C" color blue
label P "y = x²" color crimson position northeast
```

Position hints: `north`  `south`  `east`  `west`  `northeast`  `northwest`  `southeast`  `southwest`

When no position is given, Geon auto-places the label with spiral collision avoidance.

---

## Rendering Order

1. **Grid** (always bottom)
2. **Shapes** (declaration order — later shapes appear on top)
3. **Labels** (always topmost)

---

## JavaScript Integration

```html
<script src="geon.js"></script>
<script>
  Geon.render(`
    scene 600x400
    grid x -5 to 5 step 1  y -4 to 4 step 1
    point O (0,0)
    circle C center O r 2 stroke blue fill lightblue opacity 0.35
    label O "Origin" position southwest
  `, document.getElementById('canvas'));
</script>
```

`Geon.render(source, container)` returns `{ success: true }` or `{ success: false, error: "..." }`.

---

## Common Errors and How to Avoid Them

| Error | Cause | Fix |
|---|---|---|
| `Missing 'scene WxH'` | No `scene` line | Add `scene 600x400` as first line |
| `Missing 'grid x ... y ...'` | No `grid` line | Add `grid x -5 to 5 step 1 y -5 to 5 step 1` |
| `Undefined identifier 'X'` | Using a name before declaring it | Declare points/shapes before referencing them |
| `Duplicate id 'X'` | Same name used twice | Use unique names for every shape |
| `Unknown keyword 'X'` | Capitalized keyword | All keywords must be lowercase: `point`, not `Point` |
| `Expected (dx,dy) after '+'` | `A + B` instead of `A + (dx,dy)` | Right side of `+` must always be a literal tuple |
| `Expression error in (...)` | Invalid expression in coordinate | Check for undefined variables or syntax errors |
| `Invalid anchor 'X.prop'` | Accessing a non-existent property | Check anchor table for valid properties per shape type |
| `No intersection found` | Shapes don't actually intersect | Verify geometry; intersect only works for line↔circle, circle↔circle, line↔line |

---

## Patterns and Recipes

### Triangle with labeled vertices
```
scene 500x400
grid x -4 to 4 step 1 y -3 to 4 step 1

point A (-2,-1)
point B (2,-1)
point C (0,3)

segment ab from A to B stroke black width 2
segment bc from B to C stroke black width 2
segment ca from C to A stroke black width 2
polygon tri points A B C fill lightyellow opacity 0.5 stroke none

label A "A" position southwest
label B "B" position southeast
label C "C" position north
```

### Unit circle with angle
```
scene 500x500
grid x -2 to 2 step 1 y -2 to 2 step 1

let theta = 50

point O (0,0)
point P polar (1,theta)

circle unit center O r 1 stroke black
segment r from O to P stroke blue width 2 arrow end
arc angle center O r 0.3 from 0 to theta stroke orange width 2

label P "P" position northeast
label O "O" position southwest
```

### Parabola with axis of symmetry
```
scene 600x400
grid x -5 to 5 step 1 y -3 to 5 step 1

plot f y=x^2-2 from -3 to 3 stroke crimson width 2
line axis through (0,-3) (0,5) stroke gray dash 4,4 width 1
point vertex (0,-2)

label f "y = x² - 2" color crimson position east
label vertex "vertex" position east
```

### Intersecting circles
```
scene 600x500
grid x -5 to 5 step 1 y -4 to 4 step 1

point A (-1,0)
point B (1,0)

circle c1 center A r 2 stroke blue fill lightblue opacity 0.3
circle c2 center B r 2 stroke red fill lightsalmon opacity 0.3

intersect X c1 c2

label X "Intersection" position north
label c1 "C₁" color blue
label c2 "C₂" color red
```

### Reusable construction style
```
scene 600x400
grid x -5 to 5 step 1 y -4 to 4 step 1

style guide {
  stroke gray
  width 1
  dash 4,4
  opacity 0.7
}

point A (0,0)
point B (3,0)
point C (1.5,2.5)

midpoint M of A B

line perp through M C use guide
segment base from A to B stroke black width 2
polygon tri points A B C stroke black fill lightyellow opacity 0.5

label M "M" position south
```

---

## Full Feature Example

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

# Anchor points
point A (0,0)
point B polar (r,angle)
midpoint M of A B

# Shapes
segment AB from A to B stroke gray width 2 arrow end
circle C center A r r stroke blue fill lightblue opacity 0.35
ellipse E center M rx 1.4 ry 0.6 stroke purple fill plum opacity 0.35
rect R at (-5,3) w 2 h 1.25 stroke black fill gainsboro opacity 0.5
arc K center A r 3 from 20 to 150 stroke orange width 3

# Derived geometry
line L through (-5,-1) (5,2) use construction
ray Y from A through (1,1) stroke crimson arrow end
bezier BZ from (-4,-2) control (-2,3) (2,-3) to (4,2) stroke green width 2
plot P y=x^2-2 from -3 to 3 step 0.05 stroke crimson width 2
intersect X L C

# Labels
label A "Origin" position southwest size 14 color black
label B "Polar point" position northeast
label M "Midpoint" position south
label C "Circle C" color blue
label X "Intersection"
label P "y = x² - 2" color crimson
```

---

## Key Rules to Never Violate

1. `scene` and `grid` are mandatory — always first.
2. All keywords are **lowercase only**. `Point`, `Circle`, `Line` etc. are errors.
3. Declare every identifier before using it.
4. No identifier can be declared twice.
5. `#` starts a comment — never use `#` inside color values; use named CSS colors only.
6. The right side of `+` in an anchor expression must always be `(dx,dy)` — never a name.
7. `sin`, `cos`, `tan` take **degrees**. Use `sinr`, `cosr`, `tanr` for radians.
8. `rect at (x,y)` — the point `(x,y)` is the **top-left corner** (in math/Y-up space, this means larger Y).
9. `intersect` only works for: line↔line, line↔circle, circle↔circle.
10. `polygon` requires at least 3 vertex anchor expressions.