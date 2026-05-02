/**
 * Geon v0.1 — Zero-dependency DSL → SVG renderer
 * Spec: mvp_plan.md + edge_case.md
 */
(function (global) {
  "use strict";

  // ---------------------------------------------------------------------------
  // LEXER — line-based tokenizer
  // ---------------------------------------------------------------------------

  function tokenizeLine(line) {
    const tokens = [];
    let i = 0;
    while (i < line.length) {
      // Skip whitespace
      if (/\s/.test(line[i])) { i++; continue; }

      // Quoted string
      if (line[i] === '"') {
        let j = i + 1;
        while (j < line.length && line[j] !== '"') j++;
        if (j >= line.length) throw new Error("Unterminated string literal");
        tokens.push({ type: "STRING", value: line.slice(i + 1, j) });
        i = j + 1;
        continue;
      }

      // Coordinate / vector tuple  (x,y)
      if (line[i] === '(') {
        let j = i + 1;
        while (j < line.length && line[j] !== ')') j++;
        if (j >= line.length) throw new Error("Unterminated parenthesis");
        const inner = line.slice(i + 1, j).trim();
        tokens.push({ type: "TUPLE", raw: inner });
        i = j + 1;
        continue;
      }

      // Plus sign
      if (line[i] === '+') {
        tokens.push({ type: "PLUS" });
        i++;
        continue;
      }

      // Word token (keyword / identifier / number)
      let j = i;
      while (j < line.length && !/[\s()+"]/.test(line[j])) j++;
      const word = line.slice(i, j);
      if (word.length > 0) tokens.push({ type: "WORD", value: word });
      i = j;
    }
    return tokens;
  }

  function parseTuple(raw, lineNo) {
    const parts = raw.split(",");
    if (parts.length !== 2) throw new GeonError(`Malformed coordinate at line ${lineNo}: (${raw})`, lineNo);
    const x = parts[0].trim();
    const y = parts[1].trim();
    if (x === "" || y === "") throw new GeonError(`Malformed coordinate at line ${lineNo}: (${raw})`, lineNo);
    const nx = Number(x), ny = Number(y);
    if (isNaN(nx) || isNaN(ny)) throw new GeonError(`Non-numeric coordinate at line ${lineNo}: (${raw})`, lineNo);
    return [nx, ny];
  }

  // ---------------------------------------------------------------------------
  // ERROR
  // ---------------------------------------------------------------------------

  function GeonError(msg, lineNo) {
    this.message = lineNo != null ? `[Line ${lineNo}] ${msg}` : msg;
    this.name = "GeonError";
  }
  GeonError.prototype = Object.create(Error.prototype);

  function fail(msg, lineNo) { throw new GeonError(msg, lineNo); }

  // ---------------------------------------------------------------------------
  // PARSER — converts tokens into AST nodes
  // ---------------------------------------------------------------------------

  function parseAnchorExpr(tokens, idx, lineNo) {
    // AnchorExpr ::= TUPLE | identifier | shape.anchor | AnchorExpr + TUPLE
    let base = null;

    if (idx >= tokens.length) fail("Expected anchor expression", lineNo);

    const tok = tokens[idx];

    if (tok.type === "TUPLE") {
      const coords = parseTuple(tok.raw, lineNo);
      base = { kind: "coord", x: coords[0], y: coords[1] };
      idx++;
    } else if (tok.type === "WORD") {
      // Could be identifier or shape.anchor
      const val = tok.value;
      if (val.includes(".")) {
        const parts = val.split(".");
        if (parts.length !== 2) fail(`Invalid anchor expression: ${val}`, lineNo);
        base = { kind: "shapeAnchor", id: parts[0], prop: parts[1] };
      } else {
        base = { kind: "ref", id: val };
      }
      idx++;
    } else {
      fail(`Unexpected token in anchor expression: ${JSON.stringify(tok)}`, lineNo);
    }

    // Check for vector addition
    while (idx < tokens.length && tokens[idx].type === "PLUS") {
      idx++; // consume '+'
      if (idx >= tokens.length || tokens[idx].type !== "TUPLE") {
        fail("Expected (dx,dy) after '+'", lineNo);
      }
      const coords = parseTuple(tokens[idx].raw, lineNo);
      base = { kind: "add", base, dx: coords[0], dy: coords[1] };
      idx++;
    }

    return { expr: base, nextIdx: idx };
  }

  function parseStyle(tokens, idx) {
    const style = { stroke: "black", fill: "none", width: 2 };
    while (idx < tokens.length) {
      const tok = tokens[idx];
      if (tok.type !== "WORD") { idx++; continue; }
      if (tok.value === "stroke" && idx + 1 < tokens.length) {
        style.stroke = tokens[idx + 1].value || tokens[idx + 1].raw || "black";
        idx += 2;
      } else if (tok.value === "fill" && idx + 1 < tokens.length) {
        style.fill = tokens[idx + 1].value || tokens[idx + 1].raw || "none";
        idx += 2;
      } else if (tok.value === "width" && idx + 1 < tokens.length) {
        const w = Number(tokens[idx + 1].value);
        style.width = isNaN(w) ? 2 : w;
        idx += 2;
      } else {
        idx++;
      }
    }
    return style;
  }

  function parseLine(tokens, lineNo) {
    if (tokens.length === 0) return null;

    const kw = tokens[0];
    if (kw.type !== "WORD") fail(`Expected keyword at line ${lineNo}`, lineNo);

    switch (kw.value) {
      // ---- scene ----
      case "scene": {
        if (tokens.length < 2) fail("scene requires WxH", lineNo);
        const dim = tokens[1].value;
        const match = /^(\d+)x(\d+)$/.exec(dim);
        if (!match) fail(`Invalid scene dimensions: ${dim}`, lineNo);
        return { kind: "scene", width: Number(match[1]), height: Number(match[2]), lineNo };
      }

      // ---- grid ----
      case "grid": {
        // grid x <xmin> to <xmax> step <dx> y <ymin> to <ymax> step <dy>
        // tokens: grid x XMIN to XMAX step DX y YMIN to YMAX step DY
        //          0   1  2    3   4    5   6  7  8    9  10   11  12
        if (tokens.length < 13) fail("Malformed grid declaration", lineNo);
        const xmin = Number(tokens[2].value);
        const xmax = Number(tokens[4].value);
        const dx   = Number(tokens[6].value);
        const ymin = Number(tokens[8].value);
        const ymax = Number(tokens[10].value);
        const dy   = Number(tokens[12].value);
        if (isNaN(xmin)||isNaN(xmax)||isNaN(dx)||isNaN(ymin)||isNaN(ymax)||isNaN(dy))
          fail("Non-numeric grid value", lineNo);
        if (dx <= 0) fail("Grid step must be > 0", lineNo);
        if (dy <= 0) fail("Grid step must be > 0", lineNo);
        if (xmin >= xmax) fail("Grid x min must be < x max", lineNo);
        if (ymin >= ymax) fail("Grid y min must be < y max", lineNo);
        return { kind: "grid", xmin, xmax, dx, ymin, ymax, dy, lineNo };
      }

      // ---- point ----
      case "point": {
        if (tokens[0].value !== "point") break;
        if (tokens.length < 3) fail("point requires id and coordinate", lineNo);
        const id = tokens[1].value;
        if (!isValidId(id)) fail(`Invalid identifier: ${id}`, lineNo);
        const { expr, nextIdx } = parseAnchorExpr(tokens, 2, lineNo);
        return { kind: "point", id, anchor: expr, lineNo };
      }

      // ---- segment ----
      case "segment": {
        // segment <id> from <AnchorExpr> to <AnchorExpr> [style]
        if (tokens.length < 6) fail("Malformed segment", lineNo);
        const id = tokens[1].value;
        if (!isValidId(id)) fail(`Invalid identifier: ${id}`, lineNo);
        if (tokens[2].value !== "from") fail("Expected 'from' in segment", lineNo);
        const fromResult = parseAnchorExpr(tokens, 3, lineNo);
        const toIdx = fromResult.nextIdx;
        if (toIdx >= tokens.length || tokens[toIdx].value !== "to")
          fail("Expected 'to' in segment", lineNo);
        const toResult = parseAnchorExpr(tokens, toIdx + 1, lineNo);
        const style = parseStyle(tokens, toResult.nextIdx);
        return { kind: "segment", id, from: fromResult.expr, to: toResult.expr, style, lineNo };
      }

      // ---- circle ----
      case "circle": {
        // circle <id> center <AnchorExpr> r <number> [style]
        if (tokens.length < 5) fail("Malformed circle", lineNo);
        const id = tokens[1].value;
        if (!isValidId(id)) fail(`Invalid identifier: ${id}`, lineNo);
        if (tokens[2].value !== "center") fail("Expected 'center' in circle", lineNo);
        const centerResult = parseAnchorExpr(tokens, 3, lineNo);
        const rIdx = centerResult.nextIdx;
        if (rIdx >= tokens.length || tokens[rIdx].value !== "r")
          fail("Expected 'r' in circle", lineNo);
        if (rIdx + 1 >= tokens.length) fail("Expected radius value", lineNo);
        const radius = Number(tokens[rIdx + 1].value);
        if (isNaN(radius)) fail("Radius must be a number", lineNo);
        if (radius < 0) fail("Radius must be >= 0", lineNo);
        const style = parseStyle(tokens, rIdx + 2);
        return { kind: "circle", id, center: centerResult.expr, radius, style, lineNo };
      }

      // ---- polygon ----
      case "polygon": {
        // polygon <id> points <AnchorExpr> <AnchorExpr> <AnchorExpr> ... [style]
        if (tokens.length < 5) fail("Malformed polygon", lineNo);
        const id = tokens[1].value;
        if (!isValidId(id)) fail(`Invalid identifier: ${id}`, lineNo);
        if (tokens[2].value !== "points") fail("Expected 'points' in polygon", lineNo);
        const points = [];
        let idx = 3;
        while (idx < tokens.length) {
          const t = tokens[idx];
          // style keywords break the point list
          if (t.type === "WORD" && (t.value === "stroke" || t.value === "fill" || t.value === "width")) break;
          const result = parseAnchorExpr(tokens, idx, lineNo);
          points.push(result.expr);
          idx = result.nextIdx;
        }
        if (points.length < 3) fail("Polygon requires >= 3 points", lineNo);
        const style = parseStyle(tokens, idx);
        return { kind: "polygon", id, points, style, lineNo };
      }

      // ---- label ----
      case "label": {
        // label <target> "<text>"
        if (tokens.length < 3) fail("Malformed label", lineNo);
        const target = tokens[1].value;
        if (tokens[2].type !== "STRING") fail("Expected quoted string in label", lineNo);
        return { kind: "label", target, text: tokens[2].value, lineNo };
      }

      default:
        // Unknown keyword — check case sensitivity
        if (/^[A-Z]/.test(kw.value)) fail(`Unknown keyword '${kw.value}' — keywords are lowercase`, lineNo);
        fail(`Unknown keyword: ${kw.value}`, lineNo);
    }
  }

  function isValidId(s) {
    return /^[A-Za-z][A-Za-z0-9_]*$/.test(s);
  }

  function parse(source) {
    const lines = source.split("\n");
    const ast = [];
    for (let i = 0; i < lines.length; i++) {
      const lineNo = i + 1;
      const raw = lines[i];
      // Strip comments (# style)
      const commentIdx = raw.indexOf("#");
      const line = (commentIdx >= 0 ? raw.slice(0, commentIdx) : raw).trim();
      if (!line) continue;
      const tokens = tokenizeLine(line);
      if (tokens.length === 0) continue;
      const node = parseLine(tokens, lineNo);
      if (node) ast.push(node);
    }
    return ast;
  }

  // ---------------------------------------------------------------------------
  // RESOLVER — validates structure, resolves anchors to numeric coords
  // ---------------------------------------------------------------------------

  function resolve(ast) {
    // Validate top-level structure
    let sceneNode = null, gridNode = null;
    for (const node of ast) {
      if (node.kind === "scene") {
        if (sceneNode) fail("Duplicate scene declaration", node.lineNo);
        sceneNode = node;
      } else if (node.kind === "grid") {
        if (gridNode) fail("Duplicate grid declaration", node.lineNo);
        gridNode = node;
      }
    }
    if (!sceneNode) fail("Missing scene declaration — 'scene WxH' is required");
    if (!gridNode) fail("Missing grid declaration — 'grid x ... y ...' is required");

    // Symbol table: id → resolved entry
    const symbols = {};

    // Deferred label validation
    const labels = [];

    // Process statements in order (strict, no forward references)
    for (const node of ast) {
      if (node.kind === "scene" || node.kind === "grid") continue;

      if (node.kind === "point") {
        if (symbols[node.id]) fail(`Duplicate identifier '${node.id}'`, node.lineNo);
        // Detect self-reference before resolving
        checkSelfRef(node.id, node.anchor, node.lineNo);
        const coords = resolveAnchor(node.anchor, symbols, node.lineNo);
        symbols[node.id] = { kind: "point", coords, lineNo: node.lineNo };
        continue;
      }

      if (node.kind === "segment") {
        if (symbols[node.id]) fail(`Duplicate identifier '${node.id}'`, node.lineNo);
        const from = resolveAnchor(node.from, symbols, node.lineNo);
        const to   = resolveAnchor(node.to,   symbols, node.lineNo);
        symbols[node.id] = {
          kind: "segment",
          from, to,
          style: node.style,
          anchors: {
            from,
            to,
            mid: [(from[0]+to[0])/2, (from[1]+to[1])/2]
          },
          lineNo: node.lineNo
        };
        continue;
      }

      if (node.kind === "circle") {
        if (symbols[node.id]) fail(`Duplicate identifier '${node.id}'`, node.lineNo);
        const center = resolveAnchor(node.center, symbols, node.lineNo);
        symbols[node.id] = {
          kind: "circle",
          center, radius: node.radius,
          style: node.style,
          anchors: { center },
          lineNo: node.lineNo
        };
        continue;
      }

      if (node.kind === "polygon") {
        if (symbols[node.id]) fail(`Duplicate identifier '${node.id}'`, node.lineNo);
        const pts = node.points.map(p => resolveAnchor(p, symbols, node.lineNo));
        // Build named anchors p1, p2, ...
        const anchors = { centroid: centroid(pts) };
        pts.forEach((p, i) => { anchors[`p${i+1}`] = p; });
        symbols[node.id] = {
          kind: "polygon",
          points: pts,
          style: node.style,
          anchors,
          lineNo: node.lineNo
        };
        continue;
      }

      if (node.kind === "label") {
        labels.push(node);
        continue;
      }
    }

    // Validate labels
    for (const lbl of labels) {
      if (!symbols[lbl.target]) fail(`Undefined label target '${lbl.target}'`, lbl.lineNo);
    }

    return {
      scene: sceneNode,
      grid: gridNode,
      statements: ast.filter(n => n.kind !== "scene" && n.kind !== "grid"),
      symbols,
      labels
    };
  }

  function checkSelfRef(id, expr, lineNo) {
    function walk(e) {
      if (!e) return;
      if (e.kind === "ref" && e.id === id) fail(`Circular reference: '${id}' references itself`, lineNo);
      if (e.kind === "shapeAnchor" && e.id === id) fail(`Circular reference: '${id}' references itself`, lineNo);
      if (e.kind === "add") walk(e.base);
    }
    walk(expr);
  }

  function resolveAnchor(expr, symbols, lineNo) {
    if (!expr) fail("Null anchor expression", lineNo);

    if (expr.kind === "coord") return [expr.x, expr.y];

    if (expr.kind === "ref") {
      const sym = symbols[expr.id];
      if (!sym) fail(`Undefined identifier '${expr.id}'`, lineNo);
      if (sym.kind === "point") return sym.coords;
      // Shapes used as direct refs — use their primary anchor
      if (sym.anchors && sym.anchors.center) return sym.anchors.center;
      if (sym.anchors && sym.anchors.from) return sym.anchors.from;
      if (sym.anchors && sym.anchors.centroid) return sym.anchors.centroid;
      fail(`Cannot use '${expr.id}' as a point reference`, lineNo);
    }

    if (expr.kind === "shapeAnchor") {
      const sym = symbols[expr.id];
      if (!sym) fail(`Undefined identifier '${expr.id}'`, lineNo);
      if (!sym.anchors || sym.anchors[expr.prop] === undefined)
        fail(`Invalid anchor '${expr.id}.${expr.prop}'`, lineNo);
      return sym.anchors[expr.prop];
    }

    if (expr.kind === "add") {
      const base = resolveAnchor(expr.base, symbols, lineNo);
      // The right-hand side must be a coord (dx,dy), not another ref
      // By grammar, add.dx and add.dy are already numbers from the TUPLE
      return [base[0] + expr.dx, base[1] + expr.dy];
    }

    fail(`Unknown anchor expression kind: ${expr.kind}`, lineNo);
  }

  function centroid(pts) {
    const sx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const sy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    return [sx, sy];
  }

  // ---------------------------------------------------------------------------
  // RENDERER
  // ---------------------------------------------------------------------------

  function render(resolved) {
    const { scene, grid, statements, symbols, labels } = resolved;
    const W = scene.width, H = scene.height;

    // Coordinate mapping: logical → SVG pixels
    const xRange = grid.xmax - grid.xmin;
    const yRange = grid.ymax - grid.ymin;
    const toSvgX = lx => ((lx - grid.xmin) / xRange) * W;
    const toSvgY = ly => H - ((ly - grid.ymin) / yRange) * H; // Y-flip

    function pt(lx, ly) { return [toSvgX(lx), toSvgY(ly)]; }

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.style.display = "block";
    svg.style.background = "#ffffff";

    function el(tag, attrs) {
      const e = document.createElementNS(svgNS, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      return e;
    }

    // ---- Grid ----
    const gridG = el("g", { "class": "geon-grid" });

    // Vertical lines
    for (let lx = grid.xmin; lx <= grid.xmax + 1e-9; lx += grid.dx) {
      const [sx] = pt(lx, 0);
      const isAxis = Math.abs(lx) < 1e-9;
      gridG.appendChild(el("line", {
        x1: sx, y1: 0, x2: sx, y2: H,
        stroke: isAxis ? "#555" : "#ddd",
        "stroke-width": isAxis ? 1.5 : 0.5
      }));
    }

    // Horizontal lines
    for (let ly = grid.ymin; ly <= grid.ymax + 1e-9; ly += grid.dy) {
      const [, sy] = pt(0, ly);
      const isAxis = Math.abs(ly) < 1e-9;
      gridG.appendChild(el("line", {
        x1: 0, y1: sy, x2: W, y2: sy,
        stroke: isAxis ? "#555" : "#ddd",
        "stroke-width": isAxis ? 1.5 : 0.5
      }));
    }

    // Axis tick labels
    const tickG = el("g", { "class": "geon-ticks", "font-size": "9", fill: "#888", "font-family": "monospace" });
    const [ox, oy] = pt(0, 0);
    for (let lx = grid.xmin; lx <= grid.xmax + 1e-9; lx += grid.dx) {
      if (Math.abs(lx) < 1e-9) continue;
      const [sx] = pt(lx, 0);
      tickG.appendChild(el("text", { x: sx, y: oy + 12, "text-anchor": "middle" })).textContent = lx;
    }
    for (let ly = grid.ymin; ly <= grid.ymax + 1e-9; ly += grid.dy) {
      if (Math.abs(ly) < 1e-9) continue;
      const [, sy] = pt(0, ly);
      tickG.appendChild(el("text", { x: ox - 4, y: sy + 3, "text-anchor": "end" })).textContent = ly;
    }

    svg.appendChild(gridG);
    svg.appendChild(tickG);

    // ---- Shapes (in declaration order) ----
    const shapesG = el("g", { "class": "geon-shapes" });

    for (const node of statements) {
      if (node.kind === "label") continue;
      const sym = symbols[node.id];
      if (!sym) continue;

      if (sym.kind === "point") {
        const [sx, sy] = pt(...sym.coords);
        shapesG.appendChild(el("circle", { cx: sx, cy: sy, r: 3, fill: "black" }));
        continue;
      }

      if (sym.kind === "segment") {
        const [x1, y1] = pt(...sym.from);
        const [x2, y2] = pt(...sym.to);
        shapesG.appendChild(el("line", {
          x1, y1, x2, y2,
          stroke: sym.style.stroke,
          "stroke-width": sym.style.width,
          fill: "none"
        }));
        continue;
      }

      if (sym.kind === "circle") {
        const [cx, cy] = pt(...sym.center);
        const rx = (sym.radius / xRange) * W;
        const ry = (sym.radius / yRange) * H;
        shapesG.appendChild(el("ellipse", {
          cx, cy, rx, ry,
          stroke: sym.style.stroke,
          "stroke-width": sym.style.width,
          fill: sym.style.fill
        }));
        continue;
      }

      if (sym.kind === "polygon") {
        const ptStr = sym.points.map(p => pt(...p).join(",")).join(" ");
        shapesG.appendChild(el("polygon", {
          points: ptStr,
          stroke: sym.style.stroke,
          "stroke-width": sym.style.width,
          fill: sym.style.fill
        }));
        continue;
      }
    }

    svg.appendChild(shapesG);

    // ---- Labels (on top) ----
    const labelsG = el("g", { "class": "geon-labels", "font-size": "12", "font-family": "sans-serif", "text-anchor": "middle" });

    for (const lbl of labels) {
      const sym = symbols[lbl.target];
      if (!sym) continue;
      let anchor;
      if (sym.kind === "point") anchor = sym.coords;
      else if (sym.kind === "circle") anchor = sym.anchors.center;
      else if (sym.kind === "segment") anchor = sym.anchors.mid;
      else if (sym.kind === "polygon") anchor = sym.anchors.centroid;
      else continue;
      const [sx, sy] = pt(...anchor);
      const t = el("text", { x: sx, y: sy - 5, fill: "#222" });
      t.textContent = lbl.text;
      labelsG.appendChild(t);
    }

    svg.appendChild(labelsG);

    return svg;
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  const Geon = {
    render(source, container) {
      if (!container) throw new Error("Geon.render: container element is required");
      let ast, resolved, svgEl;
      try {
        ast = parse(source);
        resolved = resolve(ast);
        svgEl = render(resolved);
      } catch (e) {
        const msg = e instanceof GeonError ? e.message : (e.message || String(e));
        container.innerHTML = "";
        const errDiv = document.createElement("div");
        errDiv.style.cssText = "color:#c00;font-family:monospace;white-space:pre-wrap;padding:8px;background:#fff0f0;border:1px solid #faa;border-radius:4px";
        errDiv.textContent = "Geon Error:\n" + msg;
        container.appendChild(errDiv);
        return { success: false, error: msg };
      }
      container.innerHTML = "";
      container.appendChild(svgEl);
      return { success: true };
    }
  };

  global.Geon = Geon;

})(typeof window !== "undefined" ? window : global);