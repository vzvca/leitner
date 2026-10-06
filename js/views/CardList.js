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

  var CardList = {
    oninit: function (vnode) {
      var store = vnode.attrs.store;
      vnode.state.store = store;
      vnode.state.showForm = false;
      vnode.state.front = "";
      vnode.state.back = "";
      vnode.state.editingId = null;
      vnode.state.filterBox = "";
      vnode.state.search = "";
    },
    filtered: function (vnode) {
      var s = vnode.state;
      var deck = s.store.activeDeck();
      var q = s.search.trim().toLowerCase();
      return deck.cards.filter(function (c) {
        var okBox = s.filterBox === "" || String(c.box) === s.filterBox;
        var okSearch =
          q === "" ||
          c.front.toLowerCase().indexOf(q) !== -1 ||
          c.back.toLowerCase().indexOf(q) !== -1;
        return okBox && okSearch;
      });
    },
    save: function (vnode, e) {
      e.preventDefault();
      var s = vnode.state;
      var front = s.front.trim();
      var back = s.back.trim();
      if (!front || !back) {
        toast(s.store, "Recto et verso sont requis");
        return;
      }
      var deck = s.store.activeDeck();
      if (s.editingId) {
        deck.updateCard(s.editingId, front, back);
        toast(s.store, "Carte modifiée");
      } else {
        deck.addCard(front, back);
        toast(s.store, "Carte ajoutée");
      }
      s.store.save();
      s.showForm = false;
      s.editingId = null;
      s.front = "";
      s.back = "";
    },
    edit: function (vnode, card) {
      var s = vnode.state;
      s.editingId = card.id;
      s.front = card.front;
      s.back = card.back;
      s.showForm = true;
    },
    remove: function (vnode, card) {
      var s = vnode.state;
      s.store.activeDeck().removeCard(card.id);
      s.store.save();
      toast(s.store, "Carte supprimée");
    },
    view: function (vnode) {
      var s = vnode.state;
      var deck = s.store.activeDeck();
      var counts = deck.countByBox();
      var cards = CardList.filtered(vnode);

      return m(".cards-view", [
        m(".card-panel", [
          m("h2", deck.name + " — " + deck.cards.length + " carte(s)"),
          m(".boxes-overview",
            Object.keys(counts).map(function (b) {
              return m(".box-chip", [
                m(".box-name", "Boîte " + b),
                m(".box-count", counts[b])
              ]);
            })
          ),
          m("div", { style: "display:flex; gap:.8rem; flex-wrap:wrap; align-items:center" }, [
            m("button.primary", {
              onclick: function () {
                s.showForm = !s.showForm;
                if (!s.showForm) { s.editingId = null; s.front = ""; s.back = ""; }
              }
            }, s.showForm && s.editingId ? "Annuler la modification" : (s.showForm ? "Fermer" : "+ Nouvelle carte")),
            m("span.muted", "Filtrer :"),
            m("select", {
              value: s.filterBox,
              onchange: function (e) { s.filterBox = e.target.value; }
            }, [
              m("option", { value: "" }, "Toutes les boîtes")
            ].concat(
              Array.from({ length: constants.BOX_COUNT }, function (_, i) {
                return m("option", { value: String(i + 1) }, "Boîte " + (i + 1));
              })
            )),
            m("input[type=text][placeholder='Rechercher…']", {
              value: s.search,
              onchange: function (e) { s.search = e.target.value; }
            })
          ])
        ]),

        s.showForm
          ? m(".card-panel", [
              m("h2", s.editingId ? "Modifier la carte" : "Nouvelle carte"),
              m("form.stack", { onsubmit: function (e) { CardList.save(vnode, e); } }, [
                m("div", [
                  m("label", "Recto (question)"),
                  m("input[type=text]", {
                    value: s.front,
                    onchange: function (e) { s.front = e.target.value; }
                  })
                ]),
                m("div", [
                  m("label", "Verso (réponse)"),
                  m("textarea", {
                    value: s.back,
                    onchange: function (e) { s.back = e.target.value; }
                  })
                ]),
                m("div", [
                  m("button.primary[type=submit]", s.editingId ? "Enregistrer" : "Ajouter")
                ])
              ])
            ])
          : null,

        cards.length === 0
          ? m(".card-panel.muted", "Aucune carte à afficher. Ajoutez votre première carte !")
          : m(".card-panel", [
              m("table.cards-table", [
                m("thead", [
                  m("tr", [
                    m("th", "Recto"),
                    m("th", "Verso"),
                    m("th", "Boîte"),
                    m("th", "Échéance"),
                    m("th", "Réussites / Erreurs"),
                    m("th", "")
                  ])
                ]),
                m("tbody", cards.map(function (card) {
                  return m("tr", { key: card.id }, [
                    m("td", m(global.MathText, { text: card.front })),
                    m("td", m(global.MathText, { text: card.back })),
                    m("td.box-col", "Boîte " + card.box),
                    m("td", card.dueDate || "—"),
                    m("td", card.correctCount + " / " + card.wrongCount),
                    m("td.actions-col", [
                      m("button", { onclick: function () { CardList.edit(vnode, card); } }, "Modifier"),
                      " ",
                      m("button.danger", { onclick: function () { CardList.remove(vnode, card); } }, "Supprimer")
                    ])
                  ]);
                }))
              ])
            ])
      ]);
    }
  };

  global.CardList = CardList;
})(window);
