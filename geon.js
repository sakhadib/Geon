/**
 * Geon v2.0 — Zero-dependency mathematical graphics DSL → SVG renderer
 *
 * New in v2:
 *   - Variables & expressions (let, arithmetic, sin/cos/tan/sqrt/abs/pi/e)
 *   - Function plotting (plot f y=x^2 from -5 to 5)
 *   - New primitives: rect, arc, ellipse, bezier, ray/line-through
 *   - Intersection engine (intersect P line1 circle1)
 *   - Style blocks (style name { ... }) + "use stylename"
 *   - Advanced styling: dash, opacity, arrowhead
 *   - Smart label placement with directional hints
 *   - Constraint helpers: midpoint, distance+angle
 *   - Secure expression evaluator (no eval())
 *   - Layering: layer background / foreground
 *   - Polar coordinates: point A polar (r, deg)
 */
(function (global) {
  "use strict";

  // ---------------------------------------------------------------------------
  // ERRORS
  // ---------------------------------------------------------------------------
  function GeonError(msg, lineNo) {
    this.message = lineNo != null ? `[Line ${lineNo}] ${msg}` : msg;
    this.name = "GeonError";
  }
  GeonError.prototype = Object.create(Error.prototype);
  function fail(msg, lineNo) { throw new GeonError(msg, lineNo); }

  // ---------------------------------------------------------------------------
  // EXPRESSION EVALUATOR (no eval — tokenizer-based)
  // ---------------------------------------------------------------------------
  const MATH_FNS = {
    sin: x => Math.sin(x * Math.PI / 180),   // degrees by default
    cos: x => Math.cos(x * Math.PI / 180),
    tan: x => Math.tan(x * Math.PI / 180),
    sinr: Math.sin,  // radians variants
    cosr: Math.cos,
    tanr: Math.tan,
    sqrt: Math.sqrt,
    abs: Math.abs,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    log: Math.log,
    exp: Math.exp,
    sign: Math.sign,
  };
  const MATH_CONSTS = { pi: Math.PI, e: Math.E, tau: 2 * Math.PI };

  function exprTokenize(src) {
    const toks = [];
    let i = 0;
    while (i < src.length) {
      if (/\s/.test(src[i])) { i++; continue; }
      if (/\d/.test(src[i]) || (src[i] === '.' && /\d/.test(src[i+1]||''))) {
        let j = i;
        while (j < src.length && /[\d.]/.test(src[j])) j++;
        toks.push({ t: 'NUM', v: parseFloat(src.slice(i, j)) });
        i = j; continue;
      }
      if (/[a-zA-Z_]/.test(src[i])) {
        let j = i;
        while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++;
        toks.push({ t: 'ID', v: src.slice(i, j) });
        i = j; continue;
      }
      if ('+-*/^%'.includes(src[i])) { toks.push({ t: 'OP', v: src[i] }); i++; continue; }
      if (src[i] === '(') { toks.push({ t: 'LP' }); i++; continue; }
      if (src[i] === ')') { toks.push({ t: 'RP' }); i++; continue; }
      if (src[i] === ',') { toks.push({ t: 'COMMA' }); i++; continue; }
      throw new GeonError(`Unexpected char in expression: ${src[i]}`);
    }
    return toks;
  }

  function evalExpr(src, vars) {
    const toks = exprTokenize(src);
    let pos = 0;
    function peek() { return toks[pos]; }
    function consume() { return toks[pos++]; }
    function expect(t) { const tok = consume(); if (tok?.t !== t) throw new GeonError(`Expected ${t} in expression`); return tok; }

    function parseExpr() { return parseAddSub(); }
    function parseAddSub() {
      let l = parseMulDiv();
      while (peek()?.t === 'OP' && '+-'.includes(peek().v)) {
        const op = consume().v;
        const r = parseMulDiv();
        l = op === '+' ? l + r : l - r;
      }
      return l;
    }
    function parseMulDiv() {
      let l = parsePow();
      while (peek()?.t === 'OP' && '*/'.includes(peek().v)) {
        const op = consume().v;
        const r = parsePow();
        if (op === '*') l *= r;
        else { if (r === 0) throw new GeonError("Division by zero"); l /= r; }
      }
      return l;
    }
    function parsePow() {
      let base = parseUnary();
      if (peek()?.t === 'OP' && peek().v === '^') {
        consume();
        const exp = parseUnary();
        base = Math.pow(base, exp);
      }
      return base;
    }
    function parseUnary() {
      if (peek()?.t === 'OP' && peek().v === '-') { consume(); return -parsePrimary(); }
      if (peek()?.t === 'OP' && peek().v === '+') { consume(); return parsePrimary(); }
      return parsePrimary();
    }
    function parsePrimary() {
      const tok = peek();
      if (!tok) throw new GeonError("Unexpected end of expression");
      if (tok.t === 'NUM') { consume(); return tok.v; }
      if (tok.t === 'LP') {
        consume();
        const v = parseExpr();
        expect('RP');
        return v;
      }
      if (tok.t === 'ID') {
        consume();
        const name = tok.v;
        if (MATH_CONSTS[name] !== undefined) return MATH_CONSTS[name];
        if (MATH_FNS[name]) {
          expect('LP');
          const arg = parseExpr();
          // optional second arg for future atan2
          let result;
          if (peek()?.t === 'COMMA') {
            consume();
            const arg2 = parseExpr();
            result = MATH_FNS[name](arg, arg2);
          } else {
            result = MATH_FNS[name](arg);
          }
          expect('RP');
          return result;
        }
        if (vars && vars[name] !== undefined) return vars[name];
        throw new GeonError(`Undefined variable or function: '${name}'`);
      }
      throw new GeonError(`Unexpected token in expression: ${JSON.stringify(tok)}`);
    }

    const result = parseExpr();
    if (pos !== toks.length) throw new GeonError(`Unexpected trailing content in expression`);
    return result;
  }

  // ---------------------------------------------------------------------------
  // LEXER
  // ---------------------------------------------------------------------------
  function tokenizeLine(line) {
    const tokens = [];
    let i = 0;
    while (i < line.length) {
      if (/\s/.test(line[i])) { i++; continue; }

      // Quoted string
      if (line[i] === '"') {
        let j = i + 1;
        while (j < line.length && line[j] !== '"') j++;
        if (j >= line.length) throw new GeonError("Unterminated string literal");
        tokens.push({ type: "STRING", value: line.slice(i + 1, j) });
        i = j + 1; continue;
      }

      // Tuple (x,y) — can contain expressions
      if (line[i] === '(') {
        let depth = 1, j = i + 1;
        while (j < line.length && depth > 0) {
          if (line[j] === '(') depth++;
          else if (line[j] === ')') depth--;
          j++;
        }
        if (depth !== 0) throw new GeonError("Unterminated parenthesis");
        const inner = line.slice(i + 1, j - 1).trim();
        tokens.push({ type: "TUPLE", raw: inner });
        i = j; continue;
      }

      // Brace block {
      if (line[i] === '{') { tokens.push({ type: "LBRACE" }); i++; continue; }
      if (line[i] === '}') { tokens.push({ type: "RBRACE" }); i++; continue; }

      // Plus (standalone, outside parens)
      if (line[i] === '+') { tokens.push({ type: "PLUS" }); i++; continue; }

      // Equals sign
      if (line[i] === '=') { tokens.push({ type: "EQ" }); i++; continue; }

      // Word / number / expression fragment
      let j = i;
      while (j < line.length && !/[\s()+"{}\[\]=]/.test(line[j])) j++;
      const word = line.slice(i, j);
      if (word.length > 0) tokens.push({ type: "WORD", value: word });
      i = j;
    }
    return tokens;
  }

  // ---------------------------------------------------------------------------
  // TUPLE PARSER (supports expressions)
  // ---------------------------------------------------------------------------
  function parseTupleExpr(raw, vars, lineNo) {
    // Split on top-level comma only
    let depth = 0, splitAt = -1;
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === '(') depth++;
      else if (raw[i] === ')') depth--;
      else if (raw[i] === ',' && depth === 0) { splitAt = i; break; }
    }
    if (splitAt < 0) fail(`Malformed coordinate (no comma): (${raw})`, lineNo);
    const xs = raw.slice(0, splitAt).trim();
    const ys = raw.slice(splitAt + 1).trim();
    if (!xs || !ys) fail(`Malformed coordinate: (${raw})`, lineNo);
    try {
      return [evalExpr(xs, vars), evalExpr(ys, vars)];
    } catch(e) {
      fail(`Expression error in (${raw}): ${e.message}`, lineNo);
    }
  }

  // ---------------------------------------------------------------------------
  // PARSER
  // ---------------------------------------------------------------------------
  function isValidId(s) { return /^[A-Za-z][A-Za-z0-9_]*$/.test(s); }

  function parseAnchorExpr(tokens, idx, lineNo) {
    let base = null;
    if (idx >= tokens.length) fail("Expected anchor expression", lineNo);
    const tok = tokens[idx];

    if (tok.type === "TUPLE") {
      // Defer eval to resolver (needs var context)
      base = { kind: "coordExpr", raw: tok.raw };
      idx++;
    } else if (tok.type === "WORD") {
      const val = tok.value;
      if (val.includes(".")) {
        const parts = val.split(".");
        if (parts.length !== 2) fail(`Invalid anchor: ${val}`, lineNo);
        base = { kind: "shapeAnchor", id: parts[0], prop: parts[1] };
      } else {
        base = { kind: "ref", id: val };
      }
      idx++;
    } else {
      fail(`Unexpected token in anchor: ${JSON.stringify(tok)}`, lineNo);
    }

    while (idx < tokens.length && tokens[idx].type === "PLUS") {
      idx++;
      if (idx >= tokens.length || tokens[idx].type !== "TUPLE")
        fail("Expected (dx,dy) after '+'", lineNo);
      base = { kind: "add", base, rawDelta: tokens[idx].raw };
      idx++;
    }
    return { expr: base, nextIdx: idx };
  }

  const STYLE_KEYS = new Set(["stroke","fill","width","color","size","dash","opacity","arrow","use"]);

  function parseStyle(tokens, idx, styleBlocks) {
    const style = { stroke: "black", fill: "none", width: 2, color: "#222", size: 12, dash: null, opacity: 1, arrow: null };
    while (idx < tokens.length) {
      const tok = tokens[idx];
      if (tok.type !== "WORD") { idx++; continue; }
      if (tok.value === "use" && idx + 1 < tokens.length) {
        const sname = tokens[idx+1].value;
        if (styleBlocks && styleBlocks[sname]) Object.assign(style, styleBlocks[sname]);
        idx += 2;
      } else if (tok.value === "stroke" && idx+1 < tokens.length) {
        style.stroke = tokens[idx+1].value; idx += 2;
      } else if (tok.value === "fill" && idx+1 < tokens.length) {
        style.fill = tokens[idx+1].value; idx += 2;
      } else if (tok.value === "width" && idx+1 < tokens.length) {
        style.width = Number(tokens[idx+1].value) || 2; idx += 2;
      } else if (tok.value === "color" && idx+1 < tokens.length) {
        style.color = tokens[idx+1].value; idx += 2;
      } else if (tok.value === "size" && idx+1 < tokens.length) {
        style.size = Number(tokens[idx+1].value) || 12; idx += 2;
      } else if (tok.value === "dash" && idx+1 < tokens.length) {
        style.dash = tokens[idx+1].value; idx += 2; // e.g. "4,4"
      } else if (tok.value === "opacity" && idx+1 < tokens.length) {
        style.opacity = parseFloat(tokens[idx+1].value); idx += 2;
      } else if (tok.value === "arrow" && idx+1 < tokens.length) {
        style.arrow = tokens[idx+1].value; idx += 2; // start/end/both
      } else {
        idx++;
      }
    }
    return style;
  }

  function parse(source) {
    const lines = source.split("\n");
    const ast = [];
    const styleBlocks = {};
    let i = 0;

    while (i < lines.length) {
      const lineNo = i + 1;
      const raw = lines[i];
      const commentIdx = raw.indexOf("#");
      const line = (commentIdx >= 0 ? raw.slice(0, commentIdx) : raw).trim();
      i++;
      if (!line) continue;

      const tokens = tokenizeLine(line);
      if (tokens.length === 0) continue;
      const kw = tokens[0];
      if (kw.type !== "WORD") fail(`Expected keyword`, lineNo);

      // --- style block (multi-line)
      if (kw.value === "style") {
        const sname = tokens[1]?.value;
        if (!sname) fail("style requires a name", lineNo);
        // collect until closing }
        let blockLines = line;
        while (i < lines.length && !blockLines.includes("}")) {
          blockLines += " " + lines[i].replace(/#.*/,"").trim();
          i++;
        }
        // parse style from inside {}
        const inner = blockLines.replace(/^style\s+\w+\s*\{/, "").replace(/\}.*$/,"").trim();
        const innerTokens = tokenizeLine(inner);
        styleBlocks[sname] = parseStyle(innerTokens, 0, null);
        continue;
      }

      const node = parseSingleLine(tokens, lineNo, styleBlocks);
      if (node) ast.push(node);
    }
    return { ast, styleBlocks };
  }

  function parseSingleLine(tokens, lineNo, styleBlocks) {
    if (tokens.length === 0) return null;
    const kw = tokens[0];
    if (kw.type !== "WORD") fail(`Expected keyword at line ${lineNo}`, lineNo);

    switch (kw.value) {

      case "scene": {
        const dim = tokens[1]?.value || "";
        const m = /^(\d+)x(\d+)$/.exec(dim);
        if (!m) fail(`Invalid scene dimensions: ${dim}`, lineNo);
        return { kind: "scene", width: +m[1], height: +m[2], lineNo };
      }

      case "grid": {
        // grid x XMIN to XMAX step DX y YMIN to YMAX step DY
        if (tokens.length < 13) fail("Malformed grid", lineNo);
        const xmin=+tokens[2].value, xmax=+tokens[4].value, dx=+tokens[6].value;
        const ymin=+tokens[8].value, ymax=+tokens[10].value, dy=+tokens[12].value;
        if ([xmin,xmax,dx,ymin,ymax,dy].some(isNaN)) fail("Non-numeric grid value",lineNo);
        if (dx<=0||dy<=0) fail("Grid step must be > 0",lineNo);
        if (xmin>=xmax) fail("Grid x min must be < max",lineNo);
        if (ymin>=ymax) fail("Grid y min must be < max",lineNo);
        return { kind:"grid", xmin, xmax, dx, ymin, ymax, dy, lineNo };
      }

      case "let": {
        // let varname = expression
        if (tokens.length < 4) fail("let requires: let name = expr", lineNo);
        const name = tokens[1].value;
        if (!isValidId(name)) fail(`Invalid variable name: ${name}`, lineNo);
        if (tokens[2].type !== "EQ") fail("Expected '=' in let", lineNo);
        const exprStr = tokens.slice(3).map(t => t.value || t.raw || "").join("");
        return { kind: "let", name, exprStr, lineNo };
      }

      case "point": {
        if (tokens.length < 3) fail("point requires id and coordinate", lineNo);
        const id = tokens[1].value;
        if (!isValidId(id)) fail(`Invalid id: ${id}`, lineNo);

        // polar support: point A polar (r, deg)
        if (tokens[2]?.value === "polar") {
          if (tokens[3]?.type !== "TUPLE") fail("point polar requires (r,deg)", lineNo);
          return { kind: "point", id, polarExpr: tokens[3].raw, lineNo };
        }

        const { expr, nextIdx } = parseAnchorExpr(tokens, 2, lineNo);
        return { kind: "point", id, anchor: expr, lineNo };
      }

      case "midpoint": {
        // midpoint M of A B
        if (tokens.length < 5) fail("midpoint requires: midpoint id of A B", lineNo);
        const id = tokens[1].value;
        if (tokens[2].value !== "of") fail("Expected 'of' in midpoint", lineNo);
        return { kind: "midpoint", id, a: tokens[3].value, b: tokens[4].value, lineNo };
      }

      case "segment": {
        if (tokens.length < 6) fail("Malformed segment", lineNo);
        const id = tokens[1].value;
        if (tokens[2].value !== "from") fail("Expected 'from'", lineNo);
        const fr = parseAnchorExpr(tokens, 3, lineNo);
        const toIdx = fr.nextIdx;
        if (tokens[toIdx]?.value !== "to") fail("Expected 'to'", lineNo);
        const tr = parseAnchorExpr(tokens, toIdx + 1, lineNo);
        const style = parseStyle(tokens, tr.nextIdx, styleBlocks);
        return { kind:"segment", id, from:fr.expr, to:tr.expr, style, lineNo };
      }

      case "circle": {
        if (tokens.length < 5) fail("Malformed circle", lineNo);
        const id = tokens[1].value;
        if (tokens[2].value !== "center") fail("Expected 'center'", lineNo);
        const cr = parseAnchorExpr(tokens, 3, lineNo);
        const rIdx = cr.nextIdx;
        if (tokens[rIdx]?.value !== "r") fail("Expected 'r'", lineNo);
        const rExprStr = tokens[rIdx+1]?.value || "";
        const style = parseStyle(tokens, rIdx+2, styleBlocks);
        return { kind:"circle", id, center:cr.expr, rExpr: rExprStr, style, lineNo };
      }

      case "ellipse": {
        // ellipse id center AnchorExpr rx val ry val [style]
        if (tokens.length < 7) fail("Malformed ellipse", lineNo);
        const id = tokens[1].value;
        if (tokens[2].value !== "center") fail("Expected 'center'", lineNo);
        const cr = parseAnchorExpr(tokens, 3, lineNo);
        let idx = cr.nextIdx;
        if (tokens[idx]?.value !== "rx") fail("Expected 'rx'", lineNo);
        const rxExpr = tokens[idx+1]?.value || "";
        if (tokens[idx+2]?.value !== "ry") fail("Expected 'ry'", lineNo);
        const ryExpr = tokens[idx+3]?.value || "";
        const style = parseStyle(tokens, idx+4, styleBlocks);
        return { kind:"ellipse", id, center:cr.expr, rxExpr, ryExpr, style, lineNo };
      }

      case "rect": {
        // rect id at AnchorExpr w val h val [style]
        if (tokens.length < 8) fail("Malformed rect", lineNo);
        const id = tokens[1].value;
        if (tokens[2].value !== "at") fail("Expected 'at'", lineNo);
        const ar = parseAnchorExpr(tokens, 3, lineNo);
        let idx = ar.nextIdx;
        if (tokens[idx]?.value !== "w") fail("Expected 'w'", lineNo);
        const wExpr = tokens[idx+1]?.value || "";
        if (tokens[idx+2]?.value !== "h") fail("Expected 'h'", lineNo);
        const hExpr = tokens[idx+3]?.value || "";
        const style = parseStyle(tokens, idx+4, styleBlocks);
        return { kind:"rect", id, at:ar.expr, wExpr, hExpr, style, lineNo };
      }

      case "arc": {
        // arc id center AnchorExpr r val from deg to deg [style]
        if (tokens.length < 10) fail("Malformed arc", lineNo);
        const id = tokens[1].value;
        if (tokens[2].value !== "center") fail("Expected 'center'", lineNo);
        const cr = parseAnchorExpr(tokens, 3, lineNo);
        let idx = cr.nextIdx;
        if (tokens[idx]?.value !== "r") fail("Expected 'r'", lineNo);
        const rExpr = tokens[idx+1]?.value || "";
        if (tokens[idx+2]?.value !== "from") fail("Expected 'from'", lineNo);
        const startExpr = tokens[idx+3]?.value || "";
        if (tokens[idx+4]?.value !== "to") fail("Expected 'to'", lineNo);
        const endExpr = tokens[idx+5]?.value || "";
        const style = parseStyle(tokens, idx+6, styleBlocks);
        return { kind:"arc", id, center:cr.expr, rExpr, startExpr, endExpr, style, lineNo };
      }

      case "polygon": {
        if (tokens.length < 5) fail("Malformed polygon", lineNo);
        const id = tokens[1].value;
        if (tokens[2].value !== "points") fail("Expected 'points'", lineNo);
        const points = [];
        let idx = 3;
        while (idx < tokens.length) {
          const t = tokens[idx];
          if (t.type === "WORD" && STYLE_KEYS.has(t.value)) break;
          const r = parseAnchorExpr(tokens, idx, lineNo);
          points.push(r.expr);
          idx = r.nextIdx;
        }
        if (points.length < 3) fail("Polygon requires >= 3 points", lineNo);
        const style = parseStyle(tokens, idx, styleBlocks);
        return { kind:"polygon", id, points, style, lineNo };
      }

      case "line": {
        // line id through AnchorExpr AnchorExpr [style]
        if (tokens.length < 5) fail("Malformed line", lineNo);
        const id = tokens[1].value;
        if (tokens[2].value !== "through") fail("Expected 'through'", lineNo);
        const r1 = parseAnchorExpr(tokens, 3, lineNo);
        const r2 = parseAnchorExpr(tokens, r1.nextIdx, lineNo);
        const style = parseStyle(tokens, r2.nextIdx, styleBlocks);
        return { kind:"infiniteLine", id, p1:r1.expr, p2:r2.expr, style, lineNo };
      }

      case "ray": {
        // ray id from AnchorExpr through AnchorExpr [style]
        if (tokens.length < 6) fail("Malformed ray", lineNo);
        const id = tokens[1].value;
        if (tokens[2].value !== "from") fail("Expected 'from'", lineNo);
        const r1 = parseAnchorExpr(tokens, 3, lineNo);
        if (tokens[r1.nextIdx]?.value !== "through") fail("Expected 'through'", lineNo);
        const r2 = parseAnchorExpr(tokens, r1.nextIdx + 1, lineNo);
        const style = parseStyle(tokens, r2.nextIdx, styleBlocks);
        return { kind:"ray", id, origin:r1.expr, through:r2.expr, style, lineNo };
      }

      case "bezier": {
        // bezier id from A control B C to D [style]
        if (tokens.length < 9) fail("Malformed bezier", lineNo);
        const id = tokens[1].value;
        if (tokens[2].value !== "from") fail("Expected 'from'", lineNo);
        const r1 = parseAnchorExpr(tokens, 3, lineNo);
        let idx = r1.nextIdx;
        if (tokens[idx]?.value !== "control") fail("Expected 'control'", lineNo);
        idx++;
        const r2 = parseAnchorExpr(tokens, idx, lineNo);
        idx = r2.nextIdx;
        const r3 = parseAnchorExpr(tokens, idx, lineNo);
        idx = r3.nextIdx;
        if (tokens[idx]?.value !== "to") fail("Expected 'to'", lineNo);
        const r4 = parseAnchorExpr(tokens, idx + 1, lineNo);
        const style = parseStyle(tokens, r4.nextIdx, styleBlocks);
        return { kind:"bezier", id, p0:r1.expr, cp1:r2.expr, cp2:r3.expr, p1:r4.expr, style, lineNo };
      }

      case "plot": {
        // plot id y=expr from val to val [step val] [style]
        if (tokens.length < 7) fail("Malformed plot", lineNo);
        const id = tokens[1].value;
        // find y= token
        let yExprStr = null, idx = 2;
        while (idx < tokens.length) {
          const tv = tokens[idx].value || "";
          if (tv.startsWith("y=")) { yExprStr = tv.slice(2); idx++; break; }
          if (tokens[idx].type === "EQ" && idx > 2) { yExprStr = tokens[idx+1]?.value || ""; idx+=2; break; }
          idx++;
        }
        if (!yExprStr) fail("plot requires y=<expr>", lineNo);
        if (tokens[idx]?.value !== "from") fail("Expected 'from' in plot", lineNo);
        const fromVal = tokens[idx+1]?.value || "0";
        if (tokens[idx+2]?.value !== "to") fail("Expected 'to' in plot", lineNo);
        const toVal = tokens[idx+3]?.value || "10";
        idx += 4;
        let stepExpr = null;
        if (tokens[idx]?.value === "step") { stepExpr = tokens[idx+1]?.value; idx += 2; }
        const style = parseStyle(tokens, idx, styleBlocks);
        return { kind:"plot", id, yExprStr, fromVal, toVal, stepExpr, style, lineNo };
      }

      case "intersect": {
        // intersect id shape1 shape2
        if (tokens.length < 4) fail("Malformed intersect", lineNo);
        const id = tokens[1].value;
        return { kind:"intersect", id, s1:tokens[2].value, s2:tokens[3].value, lineNo };
      }

      case "label": {
        if (tokens.length < 3) fail("Malformed label", lineNo);
        const target = tokens[1].value;
        if (tokens[2].type !== "STRING") fail("Expected quoted string in label", lineNo);
        let idx = 3;
        let pos = null;
        if (tokens[idx]?.value === "position" && tokens[idx+1]) { pos = tokens[idx+1].value; idx += 2; }
        const style = parseStyle(tokens, idx, styleBlocks);
        return { kind:"label", target, text:tokens[2].value, labelPos: pos, style, lineNo };
      }

      case "layer": {
        return { kind:"layer", name: tokens[1]?.value || "default", lineNo };
      }

      default:
        if (/^[A-Z]/.test(kw.value)) fail(`Unknown keyword '${kw.value}' — did you mean lowercase?`, lineNo);
        fail(`Unknown keyword: '${kw.value}'`, lineNo);
    }
  }

  // ---------------------------------------------------------------------------
  // RESOLVER
  // ---------------------------------------------------------------------------
  function resolve(ast, styleBlocks) {
    let sceneNode = null, gridNode = null;
    for (const n of ast) {
      if (n.kind === "scene") {
        if (sceneNode) fail("Duplicate scene", n.lineNo);
        sceneNode = n;
      } else if (n.kind === "grid") {
        if (gridNode) fail("Duplicate grid", n.lineNo);
        gridNode = n;
      }
    }
    if (!sceneNode) fail("Missing 'scene WxH'");
    if (!gridNode)  fail("Missing 'grid x ... y ...'");

    const vars = {};       // user variables (let)
    const symbols = {};    // named shapes
    const labels = [];
    const statements = [];

    for (const node of ast) {
      if (node.kind === "scene" || node.kind === "grid" || node.kind === "layer") continue;

      if (node.kind === "let") {
        try {
          vars[node.name] = evalExpr(node.exprStr, vars);
        } catch(e) {
          fail(`In 'let ${node.name}': ${e.message}`, node.lineNo);
        }
        continue;
      }

      if (node.kind === "point") {
        if (symbols[node.id]) fail(`Duplicate id '${node.id}'`, node.lineNo);
        let coords;
        if (node.polarExpr) {
          const [r, deg] = parseTupleExpr(node.polarExpr, vars, node.lineNo);
          const rad = deg * Math.PI / 180;
          coords = [r * Math.cos(rad), r * Math.sin(rad)];
        } else {
          coords = resolveAnchor(node.anchor, symbols, vars, node.lineNo);
        }
        symbols[node.id] = { kind:"point", coords, anchors:{}, lineNo:node.lineNo };
        statements.push(node);
        continue;
      }

      if (node.kind === "midpoint") {
        if (symbols[node.id]) fail(`Duplicate id '${node.id}'`, node.lineNo);
        const a = getPoint(node.a, symbols, node.lineNo);
        const b = getPoint(node.b, symbols, node.lineNo);
        const coords = [(a[0]+b[0])/2, (a[1]+b[1])/2];
        symbols[node.id] = { kind:"point", coords, anchors:{}, lineNo:node.lineNo };
        statements.push(node);
        continue;
      }

      if (node.kind === "segment") {
        if (symbols[node.id]) fail(`Duplicate id '${node.id}'`, node.lineNo);
        const from = resolveAnchor(node.from, symbols, vars, node.lineNo);
        const to   = resolveAnchor(node.to,   symbols, vars, node.lineNo);
        symbols[node.id] = { kind:"segment", from, to, style:node.style,
          anchors:{ from, to, mid:[(from[0]+to[0])/2,(from[1]+to[1])/2] }, lineNo:node.lineNo };
        statements.push(node);
        continue;
      }

      if (node.kind === "circle") {
        if (symbols[node.id]) fail(`Duplicate id '${node.id}'`, node.lineNo);
        const center = resolveAnchor(node.center, symbols, vars, node.lineNo);
        let radius;
        try { radius = evalExpr(node.rExpr, vars); } catch(e) { fail(e.message, node.lineNo); }
        if (isNaN(radius)||radius<0) fail("Invalid radius", node.lineNo);
        symbols[node.id] = { kind:"circle", center, radius, style:node.style,
          anchors:{ center }, lineNo:node.lineNo };
        statements.push(node);
        continue;
      }

      if (node.kind === "ellipse") {
        if (symbols[node.id]) fail(`Duplicate id '${node.id}'`, node.lineNo);
        const center = resolveAnchor(node.center, symbols, vars, node.lineNo);
        const rx = evalExpr(node.rxExpr, vars);
        const ry = evalExpr(node.ryExpr, vars);
        symbols[node.id] = { kind:"ellipse", center, rx, ry, style:node.style,
          anchors:{ center }, lineNo:node.lineNo };
        statements.push(node);
        continue;
      }

      if (node.kind === "rect") {
        if (symbols[node.id]) fail(`Duplicate id '${node.id}'`, node.lineNo);
        const at = resolveAnchor(node.at, symbols, vars, node.lineNo);
        const w = evalExpr(node.wExpr, vars);
        const h = evalExpr(node.hExpr, vars);
        const cx = at[0] + w/2, cy = at[1] + h/2;
        symbols[node.id] = { kind:"rect", at, w, h, style:node.style,
          anchors:{ topleft:at, center:[cx,cy],
            topright:[at[0]+w,at[1]], bottomleft:[at[0],at[1]-h], bottomright:[at[0]+w,at[1]-h] },
          lineNo:node.lineNo };
        statements.push(node);
        continue;
      }

      if (node.kind === "arc") {
        if (symbols[node.id]) fail(`Duplicate id '${node.id}'`, node.lineNo);
        const center = resolveAnchor(node.center, symbols, vars, node.lineNo);
        const r = evalExpr(node.rExpr, vars);
        const startDeg = evalExpr(node.startExpr, vars);
        const endDeg   = evalExpr(node.endExpr, vars);
        symbols[node.id] = { kind:"arc", center, r, startDeg, endDeg, style:node.style,
          anchors:{ center }, lineNo:node.lineNo };
        statements.push(node);
        continue;
      }

      if (node.kind === "infiniteLine") {
        if (symbols[node.id]) fail(`Duplicate id '${node.id}'`, node.lineNo);
        const p1 = resolveAnchor(node.p1, symbols, vars, node.lineNo);
        const p2 = resolveAnchor(node.p2, symbols, vars, node.lineNo);
        symbols[node.id] = { kind:"infiniteLine", p1, p2, style:node.style,
          anchors:{ p1, p2, mid:[(p1[0]+p2[0])/2,(p1[1]+p2[1])/2] }, lineNo:node.lineNo };
        statements.push(node);
        continue;
      }

      if (node.kind === "ray") {
        if (symbols[node.id]) fail(`Duplicate id '${node.id}'`, node.lineNo);
        const origin  = resolveAnchor(node.origin,  symbols, vars, node.lineNo);
        const through = resolveAnchor(node.through, symbols, vars, node.lineNo);
        symbols[node.id] = { kind:"ray", origin, through, style:node.style,
          anchors:{ origin }, lineNo:node.lineNo };
        statements.push(node);
        continue;
      }

      if (node.kind === "bezier") {
        if (symbols[node.id]) fail(`Duplicate id '${node.id}'`, node.lineNo);
        const p0  = resolveAnchor(node.p0,  symbols, vars, node.lineNo);
        const cp1 = resolveAnchor(node.cp1, symbols, vars, node.lineNo);
        const cp2 = resolveAnchor(node.cp2, symbols, vars, node.lineNo);
        const p1  = resolveAnchor(node.p1,  symbols, vars, node.lineNo);
        symbols[node.id] = { kind:"bezier", p0, cp1, cp2, p1, style:node.style,
          anchors:{ from:p0, to:p1, mid:[(p0[0]+p1[0])/2,(p0[1]+p1[1])/2] }, lineNo:node.lineNo };
        statements.push(node);
        continue;
      }

      if (node.kind === "polygon") {
        if (symbols[node.id]) fail(`Duplicate id '${node.id}'`, node.lineNo);
        const pts = node.points.map(p => resolveAnchor(p, symbols, vars, node.lineNo));
        if (pts.length < 3) fail("Polygon needs >= 3 points", node.lineNo);
        const anchors = { centroid: centroid(pts) };
        pts.forEach((p,i) => { anchors[`p${i+1}`] = p; });
        symbols[node.id] = { kind:"polygon", points:pts, style:node.style, anchors, lineNo:node.lineNo };
        statements.push(node);
        continue;
      }

      if (node.kind === "plot") {
        if (symbols[node.id]) fail(`Duplicate id '${node.id}'`, node.lineNo);
        let fromX, toX;
        try {
          fromX = evalExpr(node.fromVal, vars);
          toX   = evalExpr(node.toVal,   vars);
        } catch(e) { fail(e.message, node.lineNo); }
        const step = node.stepExpr ? evalExpr(node.stepExpr, vars) : (toX - fromX) / 300;
        const pts = [];
        for (let x = fromX; x <= toX + step*0.001; x += step) {
          try {
            const y = evalExpr(node.yExprStr, { ...vars, x });
            if (isFinite(y)) pts.push([x, y]);
            else pts.push(null); // discontinuity
          } catch(_) { pts.push(null); }
        }
        symbols[node.id] = { kind:"plot", points:pts, style:node.style,
          anchors:{}, lineNo:node.lineNo };
        statements.push(node);
        continue;
      }

      if (node.kind === "intersect") {
        if (symbols[node.id]) fail(`Duplicate id '${node.id}'`, node.lineNo);
        const s1 = symbols[node.s1], s2 = symbols[node.s2];
        if (!s1) fail(`Undefined shape '${node.s1}'`, node.lineNo);
        if (!s2) fail(`Undefined shape '${node.s2}'`, node.lineNo);
        const pts = computeIntersect(s1, s2, node.lineNo);
        if (pts.length === 0) fail(`No intersection found between '${node.s1}' and '${node.s2}'`, node.lineNo);
        // Store first intersection as a point; extras as id_2, id_3
        const id = node.id;
        symbols[id] = { kind:"point", coords:pts[0], anchors:{}, lineNo:node.lineNo };
        if (pts[1]) {
          symbols[id+"_2"] = { kind:"point", coords:pts[1], anchors:{}, lineNo:node.lineNo };
        }
        statements.push(node);
        continue;
      }

      if (node.kind === "label") {
        labels.push(node);
        continue;
      }
    }

    for (const lbl of labels) {
      if (!symbols[lbl.target]) fail(`Undefined label target '${lbl.target}'`, lbl.lineNo);
    }

    return { scene:sceneNode, grid:gridNode, statements, symbols, labels, vars };
  }

  // ---------------------------------------------------------------------------
  // INTERSECTION ENGINE
  // ---------------------------------------------------------------------------
  function computeIntersect(s1, s2, lineNo) {
    // Normalize to line vs line, line vs circle, circle vs circle, segment vs anything
    const k1 = s1.kind, k2 = s2.kind;

    function lineCoeffs(p1, p2) {
      // ax + by = c  (normalized)
      const a = p2[1] - p1[1];
      const b = p1[0] - p2[0];
      const c = a*p1[0] + b*p1[1];
      return { a, b, c };
    }

    function lineLineIntersect(l1, l2) {
      const det = l1.a*l2.b - l2.a*l1.b;
      if (Math.abs(det) < 1e-10) return []; // parallel
      return [[(l1.c*l2.b - l2.c*l1.b)/det, (l1.a*l2.c - l2.a*l1.c)/det]];
    }

    function lineCircleIntersect(lc, circ) {
      const { a, b, c } = lc;
      const [cx, cy] = circ.center, r = circ.radius;
      // Translate: line ax+by=c, circle center (cx,cy) r
      const dist = (a*cx + b*cy - c) / Math.sqrt(a*a + b*b);
      if (Math.abs(dist) > r + 1e-9) return [];
      const foot_x = cx + a*(c - a*cx - b*cy)/(a*a+b*b);
      const foot_y = cy + b*(c - a*cx - b*cy)/(a*a+b*b);
      if (Math.abs(Math.abs(dist) - r) < 1e-9) return [[foot_x, foot_y]]; // tangent
      const d = Math.sqrt(r*r - dist*dist);
      const dx = -b/Math.sqrt(a*a+b*b), dy = a/Math.sqrt(a*a+b*b);
      return [[foot_x + d*dx, foot_y + d*dy],[foot_x - d*dx, foot_y - d*dy]];
    }

    function circleCircleIntersect(c1, c2) {
      const dx = c2.center[0]-c1.center[0], dy = c2.center[1]-c1.center[1];
      const d = Math.sqrt(dx*dx+dy*dy);
      if (d > c1.radius+c2.radius+1e-9 || d < Math.abs(c1.radius-c2.radius)-1e-9) return [];
      const a = (c1.radius**2 - c2.radius**2 + d**2)/(2*d);
      const h2 = c1.radius**2 - a**2;
      if (h2 < 0) return [];
      const h = Math.sqrt(Math.max(0,h2));
      const mx = c1.center[0] + a*dx/d, my = c1.center[1] + a*dy/d;
      if (h < 1e-9) return [[mx,my]];
      return [[mx+h*dy/d, my-h*dx/d],[mx-h*dy/d, my+h*dx/d]];
    }

    function getLineCoeffs(s) {
      if (s.kind === "segment") return lineCoeffs(s.from, s.to);
      if (s.kind === "infiniteLine") return lineCoeffs(s.p1, s.p2);
      if (s.kind === "ray") return lineCoeffs(s.origin, s.through);
      return null;
    }

    const lc1 = getLineCoeffs(s1), lc2 = getLineCoeffs(s2);
    if (lc1 && lc2) return lineLineIntersect(lc1, lc2);
    if (lc1 && (k2==="circle")) return lineCircleIntersect(lc1, s2);
    if (lc2 && (k1==="circle")) return lineCircleIntersect(lc2, s1);
    if (k1==="circle" && k2==="circle") return circleCircleIntersect(s1, s2);
    fail(`Cannot intersect shapes of types '${k1}' and '${k2}'`, lineNo);
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------
  function getPoint(id, symbols, lineNo) {
    const s = symbols[id];
    if (!s) fail(`Undefined identifier '${id}'`, lineNo);
    if (s.kind === "point") return s.coords;
    if (s.anchors?.center) return s.anchors.center;
    if (s.anchors?.from)   return s.anchors.from;
    fail(`'${id}' is not usable as a point`, lineNo);
  }

  function resolveAnchor(expr, symbols, vars, lineNo) {
    if (!expr) fail("Null anchor", lineNo);
    if (expr.kind === "coordExpr") {
      return parseTupleExpr(expr.raw, vars, lineNo);
    }
    if (expr.kind === "ref") return getPoint(expr.id, symbols, lineNo);
    if (expr.kind === "shapeAnchor") {
      const sym = symbols[expr.id];
      if (!sym) fail(`Undefined id '${expr.id}'`, lineNo);
      if (!sym.anchors || sym.anchors[expr.prop] === undefined)
        fail(`Invalid anchor '${expr.id}.${expr.prop}'`, lineNo);
      return sym.anchors[expr.prop];
    }
    if (expr.kind === "add") {
      const base = resolveAnchor(expr.base, symbols, vars, lineNo);
      const [dx, dy] = parseTupleExpr(expr.rawDelta, vars, lineNo);
      return [base[0]+dx, base[1]+dy];
    }
    fail(`Unknown anchor kind: ${expr.kind}`, lineNo);
  }

  function centroid(pts) {
    return [pts.reduce((a,p)=>a+p[0],0)/pts.length, pts.reduce((a,p)=>a+p[1],0)/pts.length];
  }

  // ---------------------------------------------------------------------------
  // RENDERER
  // ---------------------------------------------------------------------------
  function render(resolved) {
    const { scene, grid, statements, symbols, labels } = resolved;
    const W = scene.width, H = scene.height;
    const xRange = grid.xmax - grid.xmin;
    const yRange = grid.ymax - grid.ymin;
    const toSvgX = lx => ((lx - grid.xmin) / xRange) * W;
    const toSvgY = ly => H - ((ly - grid.ymin) / yRange) * H;
    function pt(lx, ly) { return [toSvgX(lx), toSvgY(ly)]; }
    function scaleX(d) { return (d / xRange) * W; }
    function scaleY(d) { return (d / yRange) * H; }

    // Extend a line segment beyond viewport
    function extendLine(p1, p2) {
      const dx = p2[0]-p1[0], dy = p2[1]-p1[1];
      const bigT = 1000;
      return [
        [p1[0]-dx*bigT, p1[1]-dy*bigT],
        [p1[0]+dx*bigT, p1[1]+dy*bigT]
      ];
    }

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.style.cssText = "display:block;background:#ffffff;overflow:hidden";

    function el(tag, attrs) {
      const e = document.createElementNS(svgNS, tag);
      for (const [k,v] of Object.entries(attrs)) e.setAttribute(k, v);
      return e;
    }

    // --- Defs for arrowheads ---
    const defs = el("defs", {});
    function mkArrow(id, color) {
      const m = el("marker", { id, markerWidth:"8", markerHeight:"6",
        refX:"8", refY:"3", orient:"auto" });
      const p = el("polygon", { points:"0 0, 8 3, 0 6", fill: color });
      m.appendChild(p);
      defs.appendChild(m);
    }
    const arrowColors = {};
    function getArrowId(color) {
      if (!arrowColors[color]) {
        const id = `arrow_${color.replace(/[^a-z0-9]/g,"_")}`;
        mkArrow(id, color);
        arrowColors[color] = id;
      }
      return arrowColors[color];
    }
    svg.appendChild(defs);

    // --- Grid ---
    const gridG = el("g", { class:"geon-grid" });
    for (let lx=grid.xmin; lx<=grid.xmax+1e-9; lx+=grid.dx) {
      const [sx] = pt(lx,0);
      const isAxis = Math.abs(lx)<1e-9;
      gridG.appendChild(el("line", { x1:sx,y1:0,x2:sx,y2:H,
        stroke:isAxis?"#555":"#ddd","stroke-width":isAxis?1.5:0.5 }));
    }
    for (let ly=grid.ymin; ly<=grid.ymax+1e-9; ly+=grid.dy) {
      const [,sy] = pt(0,ly);
      const isAxis = Math.abs(ly)<1e-9;
      gridG.appendChild(el("line", { x1:0,y1:sy,x2:W,y2:sy,
        stroke:isAxis?"#555":"#ddd","stroke-width":isAxis?1.5:0.5 }));
    }
    const tickG = el("g", { class:"geon-ticks","font-size":"9",fill:"#888","font-family":"monospace" });
    const [ox,oy] = pt(0,0);
    for (let lx=grid.xmin; lx<=grid.xmax+1e-9; lx+=grid.dx) {
      if (Math.abs(lx)<1e-9) continue;
      const [sx] = pt(lx,0);
      tickG.appendChild(el("text",{x:sx,y:oy+12,"text-anchor":"middle"})).textContent=+lx.toFixed(4);
    }
    for (let ly=grid.ymin; ly<=grid.ymax+1e-9; ly+=grid.dy) {
      if (Math.abs(ly)<1e-9) continue;
      const [,sy] = pt(0,ly);
      tickG.appendChild(el("text",{x:ox-4,y:sy+3,"text-anchor":"end"})).textContent=+ly.toFixed(4);
    }
    svg.appendChild(gridG);
    svg.appendChild(tickG);

    // --- Shapes ---
    const shapesG = el("g",{ class:"geon-shapes" });

    function applyStyle(e, s) {
      e.setAttribute("stroke", s.stroke);
      e.setAttribute("stroke-width", s.width);
      e.setAttribute("fill", s.fill||"none");
      if (s.opacity!=null&&s.opacity!==1) e.setAttribute("opacity", s.opacity);
      if (s.dash) e.setAttribute("stroke-dasharray", s.dash);
      if (s.arrow) {
        const aid = getArrowId(s.stroke);
        if (s.arrow==="end"||s.arrow==="both") e.setAttribute("marker-end",`url(#${aid})`);
        if (s.arrow==="start"||s.arrow==="both") e.setAttribute("marker-start",`url(#${aid})`);
      }
    }

    for (const node of statements) {
      if (node.kind==="label"||node.kind==="layer"||node.kind==="intersect") {
        // intersect renders child points below
        if (node.kind==="intersect") {
          const sym = symbols[node.id];
          if (sym?.kind==="point") {
            const [sx,sy]=pt(...sym.coords);
            shapesG.appendChild(el("circle",{cx:sx,cy:sy,r:3.5,fill:"#e44"}));
          }
        }
        continue;
      }
      const sym = symbols[node.id];
      if (!sym) continue;

      if (sym.kind==="point") {
        const [sx,sy]=pt(...sym.coords);
        shapesG.appendChild(el("circle",{cx:sx,cy:sy,r:3,fill:"black"}));
        continue;
      }

      if (sym.kind==="segment") {
        const [x1,y1]=pt(...sym.from);
        const [x2,y2]=pt(...sym.to);
        const e=el("line",{x1,y1,x2,y2}); applyStyle(e,sym.style);
        shapesG.appendChild(e); continue;
      }

      if (sym.kind==="circle") {
        const [cx,cy]=pt(...sym.center);
        const rx=scaleX(sym.radius), ry=scaleY(sym.radius);
        const e=el("ellipse",{cx,cy,rx,ry}); applyStyle(e,sym.style);
        shapesG.appendChild(e); continue;
      }

      if (sym.kind==="ellipse") {
        const [cx,cy]=pt(...sym.center);
        const rx=scaleX(sym.rx), ry=scaleY(sym.ry);
        const e=el("ellipse",{cx,cy,rx,ry}); applyStyle(e,sym.style);
        shapesG.appendChild(e); continue;
      }

      if (sym.kind==="rect") {
        const [x1,y1]=pt(sym.at[0], sym.at[1]);
        const [x2,y2]=pt(sym.at[0]+sym.w, sym.at[1]-sym.h);
        const e=el("rect",{x:Math.min(x1,x2),y:Math.min(y1,y2),
          width:Math.abs(x2-x1),height:Math.abs(y2-y1)});
        applyStyle(e,sym.style); shapesG.appendChild(e); continue;
      }

      if (sym.kind==="arc") {
        const [cx,cy]=pt(...sym.center);
        const rx=scaleX(sym.r), ry=scaleY(sym.r);
        const s=sym.startDeg, en=sym.endDeg;
        const sx=cx+rx*Math.cos(s*Math.PI/180);
        const sy_=cy-ry*Math.sin(s*Math.PI/180);
        const ex=cx+rx*Math.cos(en*Math.PI/180);
        const ey=cy-ry*Math.sin(en*Math.PI/180);
        const large=(en-s)>180?1:0;
        const d=`M ${sx} ${sy_} A ${rx} ${ry} 0 ${large} 0 ${ex} ${ey}`;
        const e=el("path",{d,fill:"none"}); applyStyle(e,sym.style);
        shapesG.appendChild(e); continue;
      }

      if (sym.kind==="infiniteLine") {
        const [ep1,ep2]=extendLine(sym.p1, sym.p2);
        const [x1,y1]=pt(...ep1), [x2,y2]=pt(...ep2);
        const e=el("line",{x1,y1,x2,y2}); applyStyle(e,sym.style);
        shapesG.appendChild(e); continue;
      }

      if (sym.kind==="ray") {
        const dx=sym.through[0]-sym.origin[0], dy=sym.through[1]-sym.origin[1];
        const far=[sym.origin[0]+dx*1000, sym.origin[1]+dy*1000];
        const [x1,y1]=pt(...sym.origin), [x2,y2]=pt(...far);
        const e=el("line",{x1,y1,x2,y2}); applyStyle(e,sym.style);
        shapesG.appendChild(e); continue;
      }

      if (sym.kind==="bezier") {
        const [x0,y0]=pt(...sym.p0);
        const [cx1,cy1]=pt(...sym.cp1);
        const [cx2,cy2]=pt(...sym.cp2);
        const [x1,y1]=pt(...sym.p1);
        const d=`M ${x0} ${y0} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x1} ${y1}`;
        const e=el("path",{d,fill:"none"}); applyStyle(e,sym.style);
        shapesG.appendChild(e); continue;
      }

      if (sym.kind==="polygon") {
        const pts=sym.points.map(p=>pt(...p).join(",")).join(" ");
        const e=el("polygon",{points:pts}); applyStyle(e,sym.style);
        shapesG.appendChild(e); continue;
      }

      if (sym.kind==="plot") {
        let pathD="", open=false;
        for (const p of sym.points) {
          if (!p) { open=false; continue; }
          const [sx,sy_]=pt(...p);
          if (!open) { pathD+=`M ${sx} ${sy_} `; open=true; }
          else        { pathD+=`L ${sx} ${sy_} `; }
        }
        if (pathD) {
          const e=el("path",{d:pathD.trim(),fill:"none"}); applyStyle(e,sym.style);
          shapesG.appendChild(e);
        }
        continue;
      }
    }

    svg.appendChild(shapesG);

    // --- Labels ---
    const labelsG = el("g",{ class:"geon-labels","font-family":"sans-serif" });
    const DIR_OFFSETS = {
      north:[0,-14], south:[0,14], east:[14,0], west:[-14,0],
      northeast:[10,-10], northwest:[-10,-10], southeast:[10,10], southwest:[-10,10]
    };

    function rectIntersect(r1,r2,pad=2) {
      return !(r2.x>=r1.x+r1.w+pad||r2.x+r2.w+pad<=r1.x||r2.y>=r1.y+r1.h+pad||r2.y+r2.h+pad<=r1.y);
    }

    const placedBoxes=[];

    for (const lbl of labels) {
      const sym=symbols[lbl.target];
      if (!sym) continue;
      let anchor;
      if (sym.kind==="point") anchor=sym.coords;
      else if (sym.kind==="circle") anchor=sym.anchors.center;
      else if (sym.kind==="segment") anchor=sym.anchors.mid;
      else if (sym.kind==="polygon") anchor=sym.anchors.centroid;
      else if (sym.kind==="rect") anchor=sym.anchors.center;
      else if (sym.kind==="plot") {
        const mid=sym.points.filter(Boolean);
        anchor=mid[Math.floor(mid.length/2)]||[0,0];
      } else continue;

      const [sx,sy]=pt(...anchor);
      const fontSize=lbl.style?.size||12;
      const approxW=lbl.text.length*(fontSize*0.55);
      const approxH=fontSize*1.2;

      let px=sx, py=sy-8;

      // Directional hint
      if (lbl.labelPos && DIR_OFFSETS[lbl.labelPos]) {
        const [ddx,ddy]=DIR_OFFSETS[lbl.labelPos];
        px=sx+ddx; py=sy+ddy;
      }

      let box={x:px-approxW/2,y:py-approxH*0.8,w:approxW,h:approxH};
      let attempts=0, angle=-Math.PI/2, radius=0;

      // If no direction hint, use spiral collision avoidance
      if (!lbl.labelPos) {
        while (attempts<80) {
          const overlapping=placedBoxes.some(p=>rectIntersect(box,p));
          if (!overlapping) break;
          angle+=0.5; radius+=2;
          px=sx+Math.cos(angle)*radius;
          py=sy-8+Math.sin(angle)*radius;
          box={x:px-approxW/2,y:py-approxH*0.8,w:approxW,h:approxH};
          attempts++;
        }
      }

      placedBoxes.push(box);

      // Leader line if offset far enough
      const dist=Math.sqrt((px-sx)**2+(py-sy)**2);
      if (dist>18) {
        const ll=el("line",{x1:sx,y1:sy,x2:px,y2:py,
          stroke:"#aaa","stroke-width":"0.7",opacity:"0.8"});
        labelsG.appendChild(ll);
      }

      const anchor_=approxW<20?"middle":(px>sx?"start":"end");
      const t=el("text",{x:px,y:py,fill:lbl.style?.color||"#222",
        "font-size":fontSize,"text-anchor":"middle","font-weight":"500"});
      t.textContent=lbl.text;
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
      if (!container) throw new Error("Geon.render: container required");
      let result;
      try {
        const { ast, styleBlocks } = parse(source);
        const resolved = resolve(ast, styleBlocks);
        const svgEl = render(resolved);
        container.innerHTML = "";
        container.appendChild(svgEl);
        result = { success:true };
      } catch(e) {
        const msg = e instanceof GeonError ? e.message : (e.message||String(e));
        container.innerHTML = "";
        const d = document.createElement("div");
        d.style.cssText = "color:#c00;font-family:monospace;white-space:pre-wrap;padding:8px;background:#fff0f0;border:1px solid #faa;border-radius:4px";
        d.textContent = "Geon Error:\n" + msg;
        container.appendChild(d);
        result = { success:false, error:msg };
      }
      return result;
    },

    /** Parse only — returns { ast, styleBlocks } or throws */
    parse(source) { return parse(source); },

    /** Full pipeline returning resolved symbols — useful for tooling */
    resolve(source) {
      const { ast, styleBlocks } = parse(source);
      return resolve(ast, styleBlocks);
    },

    version: "2.0.0"
  };

  global.Geon = Geon;

})(typeof window !== "undefined" ? window : global);