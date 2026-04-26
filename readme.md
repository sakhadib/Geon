# Geon

**Geon** is a lightweight geometric DSL that renders precise 2D constructions directly into SVG — entirely in the browser, with zero dependencies.

Write geometry like text. Get structured, deterministic visuals.

---

## ✨ What is Geon?

Geon lets you describe geometric scenes using a minimal, readable syntax:

```txt
scene 600x400
grid x -5 to 5 step 1 y -5 to 5 step 1

point A (0,0)
point B (4,0)
point C (4,3)

segment AB from A to B
circle C1 center A r 2
polygon T points A B C

label A "Origin"
````

➡️ Rendered instantly as SVG.

---

## 🚀 Live Demo & Documentation

👉 **Docs / Playground**: [https://sakhadib.github.io/Geon/](https://sakhadib.github.io/Geon/)

---

## ⚙️ Installation

Geon is a single file. No build step. No dependencies.

```html
<script src="geon.js"></script>
```

---

## 🧪 Usage

```html
<div id="canvas"></div>

<script>
Geon.render(`
  scene 600x400
  grid x -5 to 5 step 1 y -5 to 5 step 1

  point A (0,0)
  circle C center A r 2

  label A "Origin"
`, document.getElementById("canvas"));
</script>
```

---

## 🔑 Features

* **Declarative Geometry DSL**

  * Points, segments, circles, polygons
* **Anchor-based system**

  * `C.center`, `T.p1`, etc.
* **Vector offsets**

  * `A + (1,0)`
* **Deterministic rendering**

  * No layout guessing
* **Built-in Cartesian grid**
* **Labeling system**
* **Pure SVG output**
* **Zero dependencies**

---

## 🧠 Design Philosophy

Geon is built on a few strict principles:

* **Minimal syntax** → no braces, no semicolons
* **Readable structure** → line-based, natural flow
* **Deterministic execution** → top-to-bottom, no surprises
* **Geometry-first abstraction** → not canvas drawing, but construction

Inspired by **TikZ** and **Manim**, but designed for the browser.

---

## 📦 API

```js
Geon.render(source, container)
```

Returns:

```js
{ success: true }
```

or

```js
{ success: false, error: string }
```

---

## ⚠️ Constraints (v1)

* Order matters (no forward references)
* Static geometry only
* No animation
* No symbolic constraints (yet)

---

## 🧭 Roadmap

* Function / curve plotting
* Intersection & constraint system
* Better editor tooling
* Export utilities (PNG / SVG download)

---

## 📁 Structure

```
geon.js        # runtime (parser + resolver + renderer)
index.html     # docs + demo
```

---

## 🤝 Contributing

Open issues, suggestions, and PRs are welcome.

---

## 📜 License

MIT

---

## 🔥 Why Geon?

Because describing geometry should feel like **writing**, not wiring APIs.

