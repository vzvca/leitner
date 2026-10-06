(function (global) {
  "use strict";
  var m = global.m;
  var MathSvc = global.LeitnerMath;

  var MathText = {
    view: function (vnode) {
      var text = vnode.attrs.text || "";
      var segments = MathSvc.findSegments(text);
      if (segments.length === 1 && segments[0].type === "text") {
        return m("span", segments[0].value);
      }
      return m(
        "span",
        { class: "leitner-math" },
        segments.map(function (seg, i) {
          if (seg.type === "text") return m("span", { key: i }, seg.value);
          var res = MathSvc.renderMath(seg.value, seg.display);
          if (res.error) return m("span", { key: i, class: "math-error" }, "$" + seg.value + "$");
          return m("span", {
            key: i,
            class: seg.display ? "math-display" : "math-inline",
            oncreate: function (el) { el.dom.innerHTML = res.html; },
            onupdate: function (el) { el.dom.innerHTML = res.html; }
          });
        })
      );
    }
  };

  global.MathText = MathText;
})(window);
