(function (global) {
  "use strict";
  var m = global.m;

  function toast(store, msg) {
    store.toast = msg;
    store.toastKey = Date.now();
    clearTimeout(store._toastTimer);
    store._toastTimer = setTimeout(function () {
      store.toast = null;
      m.redraw();
    }, 2200);
  }

  var Decks = {
    oninit: function (vnode) {
      var s = vnode.state;
      s.store = vnode.attrs.store;
      s.newName = "";
      s.newDescription = "";
      s.editingId = null;
      s.editName = "";
      s.editDescription = "";
      s.confirmDeleteId = null;
    },
    create: function (s, e) {
      e.preventDefault();
      var name = s.newName.trim();
      if (!name) {
        toast(s.store, "Le nom est requis");
        return;
      }
      var deck = s.store.addDeck(name);
      s.store.renameDeck(deck.id, name, s.newDescription);
      s.newName = "";
      s.newDescription = "";
      toast(s.store, "Jeu de cartes « " + name + " » créé");
    },
    startEdit: function (s, deck) {
      s.editingId = deck.id;
      s.editName = deck.name;
      s.editDescription = deck.description || "";
      s.confirmDeleteId = null;
    },
    saveEdit: function (s, e) {
      e.preventDefault();
      if (!s.editingId) return;
      var name = s.editName.trim();
      if (!name) {
        toast(s.store, "Le nom est requis");
        return;
      }
      s.store.renameDeck(s.editingId, name, s.editDescription);
      s.editingId = null;
      toast(s.store, "Jeu de cartes renommé");
    },
    askDelete: function (s, deck) {
      s.confirmDeleteId = deck.id;
    },
    cancelDelete: function (s) {
      s.confirmDeleteId = null;
    },
    doDelete: function (s, deck) {
      s.store.removeDeck(deck.id);
      s.confirmDeleteId = null;
      toast(s.store, "Jeu « " + deck.name + " » supprimé");
    },
    select: function (s, deck) {
      s.store.setActiveDeck(deck.id);
      toast(s.store, "Jeu actif : « " + deck.name + " »");
    },
    view: function (vnode) {
      var s = vnode.state;
      var active = s.store.activeDeck();

      return m(".decks-view", [
        m(".card-panel", [
          m("h2", "Nouveau jeu de cartes"),
          m("p", [
            "Ou ",
            m(m.route.Link, { href: "/ai" }, "générer un jeu avec l'IA Mistral →")
          ]),
          m("form.stack", { onsubmit: function (e) { Decks.create(s, e); } }, [
            m("div", [
              m("label", "Nom du jeu"),
              m("input[type=text]", {
                value: s.newName,
                onchange: function (e) { s.newName = e.target.value; },
                placeholder: "ex. Anglais — cuisine"
              })
            ]),
            m("div", [
              m("label", "Description (optionnelle)"),
              m("input[type=text]", {
                value: s.newDescription,
                onchange: function (e) { s.newDescription = e.target.value; },
                placeholder: "ex. Vocabulaire anglais lié à la cuisine"
              })
            ]),
            m("div", [m("button.primary[type=submit]", "Créer le jeu")])
          ])
        ]),

        m(".card-panel", [
          m("h2", "Mes jeux de cartes (" + s.store.decks.length + ")"),
          s.store.decks.length === 0
            ? m("p.muted", "Aucun jeu de cartes.")
            : m("table.cards-table", [
                m("thead", m("tr", [
                  m("th", "Jeu"),
                  m("th", "Cartes"),
                  m("th", "Échéues"),
                  m("th", "")
                ])),
                m("tbody", s.store.decks.map(function (deck) {
                  var due = deck.dueCards().length;
                  var isActive = deck.id === active.id;
                  return m("tr", { key: deck.id }, [
                    m("td", [
                      m("div", { style: "font-weight:" + (isActive ? "600" : "normal") }, [
                        isActive ? "● " : "",
                        deck.name
                      ]),
                      deck.description ? m("div.muted", deck.description) : null
                    ]),
                    m("td", deck.cards.length),
                    m("td", due > 0 ? due + " à réviser" : "—"),
                    m("td.actions-col", Decks.actionsCell(s, deck, isActive))
                  ]);
                }))
              ])
        ])
      ]);
    },

    actionsCell: function (s, deck, isActive) {
      if (s.editingId === deck.id) {
        return m("form.stack", { onsubmit: function (e) { Decks.saveEdit(s, e); } }, [
          m("input[type=text]", {
            value: s.editName,
            onchange: function (e) { s.editName = e.target.value; },
            placeholder: "Nom"
          }),
          m("input[type=text]", {
            value: s.editDescription,
            onchange: function (e) { s.editDescription = e.target.value; },
            placeholder: "Description"
          }),
          m("div", { style: "display:flex; gap:.5rem" }, [
            m("button.primary[type=submit]", "Enregistrer"),
            m("button[type=button]", { onclick: function () { s.editingId = null; } }, "Annuler")
          ])
        ]);
      }
      if (s.confirmDeleteId === deck.id) {
        return m("span", [
          "Supprimer « " + deck.name + " » ? ",
          m("button.danger", { onclick: function () { Decks.doDelete(s, deck); } }, "Oui"),
          " ",
          m("button", { onclick: function () { Decks.cancelDelete(s); } }, "Annuler")
        ]);
      }
      return m("span", [
        isActive ? null : m("button.primary", { onclick: function () { Decks.select(s, deck); } }, "Choisir"),
        " ",
        m("button", { onclick: function () { Decks.startEdit(s, deck); } }, "Renommer"),
        " ",
        m("button.danger", { onclick: function () { Decks.askDelete(s, deck); } }, "Supprimer")
      ]);
    }
  };

  global.Decks = Decks;
})(window);
