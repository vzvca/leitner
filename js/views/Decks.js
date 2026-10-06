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
      s.catalog = null;
      s.catalogLoaded = false;
      s.catalogBusy = false;
      s.catalogError = "";
      s.installBusy = null;
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
      s.catalog = null;
      s.catalogLoaded = false;
      s.catalogBusy = false;
      s.catalogError = "";
      s.installBusy = null;
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
      s.catalog = null;
      s.catalogLoaded = false;
      s.catalogBusy = false;
      s.catalogError = "";
      s.installBusy = null;
    },
    doDelete: function (s, deck) {
      s.store.removeDeck(deck.id);
      s.confirmDeleteId = null;
      toast(s.store, "Jeu « " + deck.name + " » supprimé");
    },
    exportShare: function (s, deck) {
      var json = s.store.exportDeckShare(deck.id);
      if (!json) return;
      var blob = new Blob([json], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "leitner-" + deck.name.replace(/[^a-z0-9\u00C0-\u017F-]+/gi, "-").toLowerCase() + ".json";
      a.click();
      URL.revokeObjectURL(url);
      toast(s.store, "Jeu « " + deck.name + " » exporté (sans données de révision)");
    },
    importShare: function (s, ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var deck = s.store.importDeckShare(String(reader.result));
          toast(s.store, "Jeu « " + deck.name + " » importé (" + deck.cards.length + " cartes)");
          m.redraw();
        } catch (e) {
          toast(s.store, "Import échoué : " + e.message);
          m.redraw();
        }
      };
      reader.readAsText(file);
      ev.target.value = "";
    },
    loadCatalog: function (s) {
      if (s.catalogBusy || (s.catalog && s.catalogLoaded)) return;
      s.catalogBusy = true;
      s.catalogError = "";
      m.request({ method: "GET", url: "decks/catalog.json" })
        .then(function (catalog) {
          s.catalog = catalog;
          s.catalogLoaded = true;
        })
        .catch(function () {
          s.catalogError = "Impossible de charger le catalogue de jeux (le dossier decks/ doit être servi avec l'application).";
        })
        .finally(function () {
          s.catalogBusy = false;
          m.redraw();
        });
    },
    installFromCatalog: function (s, entry) {
      if (s.installBusy === entry.file) return;
      s.installBusy = entry.file;
      m.request({ method: "GET", url: "decks/" + entry.file })
        .then(function (data) {
          var deck = s.store.importDeckShare(data);
          toast(s.store, "Jeu « " + deck.name + " » ajouté (" + deck.cards.length + " cartes)");
        })
        .catch(function () {
          toast(s.store, "Échec du téléchargement de « " + entry.name + " »");
        })
        .finally(function () {
          s.installBusy = null;
          m.redraw();
        });
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
          m("p", [
            "Ou ",
            m("label.file-input-label", [
              "importer un jeu partagé (JSON) : ",
              m("input[type=file][accept='.json,application/json']", {
                onchange: function (e) { Decks.importShare(s, e); }
              })
            ])
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
          m("h2", "Jeux prêts à importer"),
          m("p.muted", "Jeux fournis avec l'application (dossier decks/). Un clic ajoute le jeu à votre collection, sans toucher à vos données de révision."),
          Decks.renderCatalog(s)
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

    renderCatalog: function (s) {
      if (!s.catalogLoaded && !s.catalogBusy && !s.catalogError) {
        Decks.loadCatalog(s);
      }
      if (s.catalogBusy) return m("p.muted", "Chargement du catalogue…");
      if (s.catalogError) return m("p", { style: "color:var(--danger)" }, "⚠ " + s.catalogError);
      if (!s.catalog || !Array.isArray(s.catalog.decks) || s.catalog.decks.length === 0) {
        return m("p.muted", "Aucun jeu disponible dans le catalogue.");
      }
      return m("table.cards-table", [
        m("thead", m("tr", [m("th", "Jeu"), m("th", "Cartes"), m("th", "")])),
        m("tbody", s.catalog.decks.map(function (entry) {
          return m("tr", { key: entry.file }, [
            m("td", [
              m("div", entry.name),
              entry.description ? m("div.muted", entry.description) : null
            ]),
            m("td", entry.cardCount || "—"),
            m("td.actions-col",
              m("button.primary", {
                disabled: s.installBusy === entry.file,
                onclick: function () { Decks.installFromCatalog(s, entry); }
              }, s.installBusy === entry.file ? "Import…" : "Importer")
            )
          ]);
        }))
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
        m("button", { onclick: function () { Decks.exportShare(s, deck); } }, "Exporter"),
        " ",
        m("button.danger", { onclick: function () { Decks.askDelete(s, deck); } }, "Supprimer")
      ]);
    }
  };

  global.Decks = Decks;
})(window);
