(function (global) {
  "use strict";
  var m = global.m;

  var Layout = {
    view: function (vnode) {
      var route = m.route.get ? m.route.get() : "";
      function isActive(prefix) {
        return route === prefix || route.indexOf(prefix + "/") === 0;
      }
      return [
        m("header.app-header", [
          m("h1", "🃏 Leitner"),
          m("nav", [
            m(m.route.Link, { href: "/cards", class: isActive("/cards") ? "active" : "" }, "Cartes"),
            m(m.route.Link, { href: "/review", class: isActive("/review") ? "active" : "" }, "Révision"),
            m(m.route.Link, { href: "/stats", class: isActive("/stats") ? "active" : "" }, "Statistiques")
          ])
        ]),
        m("main", vnode.children),
        vnode.attrs.store.toast
          ? m("div.toast", { key: vnode.attrs.store.toastKey }, vnode.attrs.store.toast)
          : null
      ];
    }
  };

  global.Layout = Layout;
})(window);
