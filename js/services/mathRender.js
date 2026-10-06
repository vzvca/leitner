(function (global) {
  "use strict";

  var DELIMS = [
    { left: "$$", display: true },
    { left: "$", display: false },
    { left: "\\(", display: false },
    { left: "\\[", display: true }
  ];

  var PAIRS = { "$$": "$$", "$": "$", "\\(": "\\)", "\\[": "\\]" };

  function findSegments(text) {
    var segments = [];
    var i = 0;
    var n = text.length;
    while (i < n) {
      var best = null;
      for (var d = 0; d < DELIMS.length; d++) {
        var pos = text.indexOf(DELIMS[d].left, i);
        if (pos === -1) continue;
        if (!best || pos < best.pos) {
          best = { pos: pos, left: DELIMS[d].left, display: DELIMS[d].display };
        }
      }
      if (!best) break;
      var close = PAIRS[best.left];
      var end = text.indexOf(close, best.pos + best.left.length);
      if (end === -1) break;
      var math = text.slice(best.pos + best.left.length, end);
      if (math.trim()) {
        if (best.pos > i) segments.push({ type: "text", value: text.slice(i, best.pos) });
        segments.push({ type: "math", value: math, display: best.display });
        i = end + close.length;
      } else {
        i = best.pos + best.left.length;
      }
    }
    if (i < n) segments.push({ type: "text", value: text.slice(i) });
    return segments;
  }

  function fallbackSup(text) {
    return text.replace(/\^([A-Za-z0-9]+)/g, function (_, e) { return "^" + e; });
  }

  function renderMath(src, display) {
    var katex = global.katex;
    if (!katex) return { error: "KaTeX non chargé" };
    try {
      return {
        html: katex.renderToString(src, {
          throwOnError: false,
          displayMode: display === true
        })
      };
    } catch (e) {
      return { error: e.message || String(e) };
    }
  }

  function hasMath(text) {
    return /\$[^$]+\$(?!\$)|\\\(|\\\[/.test(text || "");
  }

  var api = {
    findSegments: findSegments,
    renderMath: renderMath,
    hasMath: hasMath,
    fallbackSup: fallbackSup
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.LeitnerMath = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
