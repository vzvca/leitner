(function (global) {
  "use strict";
  var m = global.m;
  var constants = global.LeitnerConstants;

  function toast(store, msg) {
    store.toast = msg;
    store.toastKey = Date.now();
    clearTimeout(store._toastTimer);
    store._toastTimer = setTimeout(function () {
      store.toast = null;
      m.redraw();
    }, 2200);
  }

  var Stats = {
    oninit: function (vnode) {
      vnode.state.store = vnode.attrs.store;
    },
    doExport: function (store) {
      var blob = new Blob([store.exportJSON()], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "leitner-export.json";
      a.click();
      URL.revokeObjectURL(url);
      toast(store, "Export téléchargé");
    },
    doImport: function (store, ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var n = store.importJSON(String(reader.result));
          toast(store, n + " paquet(s) importé(s)");
          m.redraw();
        } catch (e) {
          toast(store, "Import échoué : " + e.message);
          m.redraw();
        }
      };
      reader.readAsText(file);
      ev.target.value = "";
    },
    view: function (vnode) {
      var store = vnode.state.store;
      var deck = store.activeDeck();
      var st = deck.stats();

      return m(".stats-view", [
        m(".card-panel", [
          m("h2", "Statistiques — " + deck.name),
          m(".stats-grid", [
            m(".stat-tile", [m(".stat-value", st.totalCards), m(".stat-label", "Cartes")]),
            m(".stat-tile", [m(".stat-value", st.mastered), m(".stat-label", "Acquises (boîte " + constants.BOX_COUNT + ")")]),
            m(".stat-tile", [m(".stat-value", st.totalAnswers), m(".stat-label", "Réponses")]),
            m(".stat-tile", [
              m(".stat-value", st.accuracy === null ? "—" : st.accuracy + "%"),
              m(".stat-label", "Précision")
            ])
          ]),
          m("h2", "Répartition par boîte"),
          m("table.cards-table", [
            m("thead", m("tr", [m("th", "Boîte"), m("th", "Interval"), m("th", "Cartes")])),
            m("tbody", Object.keys(st.byBox).map(function (b) {
              return m("tr", [
                m("td", "Boîte " + b),
                m("td", constants.BOX_INTERVALS_DAYS[b - 1] + " jour(s)"),
                m("td", st.byBox[b])
              ]);
            }))
          ])
        ]),
        m(".card-panel", [
          m("h2", "Sauvegarde"),
          m("p.muted", "Les données sont stockées dans votre navigateur (localStorage). Exportez régulièrement pour éviter toute perte."),
          m(".import-export", [
            m("button.primary", { onclick: function () { Stats.doExport(store); } }, "⬇ Exporter (JSON)"),
            m("label.file-input-label", [
              "⬆ Importer : ",
              m("input[type=file][accept='.json,application/json']", {
                onchange: function (e) { Stats.doImport(store, e); }
              })
            ])
          ])
        ])
      ]);
    }
  };

  global.Stats = Stats;
})(window);
