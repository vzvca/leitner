(function (global) {
  "use strict";
  var m = global.m;

  var Layout = {
    view: function (vnode) {
      var route = m.route.get ? m.route.get() : "";
      function isActive(prefix) {
        return route === prefix || route.indexOf(prefix + "/") === 0;
      }
      var store = vnode.attrs.store;
      var activeDeck = store.activeDeck();
      return [
        m("header.app-header", [
          m("h1", "🃏 Leitner"),
          m("nav", [
            m(m.route.Link, { href: "/cards", class: isActive("/cards") ? "active" : "" }, "Cartes"),
            m(m.route.Link, { href: "/review", class: isActive("/review") ? "active" : "" }, "Révision"),
            m(m.route.Link, { href: "/stats", class: isActive("/stats") ? "active" : "" }, "Statistiques"),
            m(m.route.Link, { href: "/decks", class: isActive("/decks") ? "active" : "" }, "Jeux"),
            m(m.route.Link, { href: "/ai", class: isActive("/ai") ? "active" : "" }, "Assistant IA")
          ]),
          activeDeck
            ? m("label", { style: "display:flex; align-items:center; gap:.4rem" }, [
                m("span.muted", "Jeu actif :"),
                m("select", {
                  onchange: function (e) { store.setActiveDeck(e.target.value); m.redraw(); }
                }, store.decks.map(function (d) {
                  return m("option", { value: d.id, selected: d.id === activeDeck.id }, d.name);
                }))
              ])
            : null
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
