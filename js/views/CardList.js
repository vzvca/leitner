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
      vnode.state.frontIsImage = false;
      vnode.state.frontImageSrc = "";
      vnode.state.frontImageCaption = "";
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
      var imgCaption = s.frontImageCaption.trim();
      var convertPromise = null;
      if (s.frontIsImage) {
        var raw = s.frontImageSrc.trim();
        if (!raw) {
          toast(s.store, "Choisissez une image (fichier, bibliothèque ou URL https)");
          return;
        }
        if (raw.indexOf("idb:") === 0) {
          if (!global.CardMedia.idbId(raw)) {
            toast(s.store, "Identifiant IndexedDB invalide");
            return;
          }
          front = raw + (imgCaption ? "\n" + imgCaption : "");
        } else if (raw.indexOf("img:") === 0) {
          var src = global.CardMedia.imageSrc(raw);
          if (!src) {
            toast(s.store, "Source d'image invalide (chemin images/..., data:image/... ou https)");
            return;
          }
          // Toute source img: est convertie en image IndexedDB (dédupliquée).
          convertPromise = global.ImageStore.ingestFromUrl(src).then(function (res) {
            return "idb:" + res.id + (imgCaption ? "\n" + imgCaption : "");
          });
        } else {
          toast(s.store, "Source d'image invalide");
          return;
        }
      }
      (convertPromise || Promise.resolve(front)).then(function (finalFront) {
        CardList.commitCard(vnode, finalFront, back);
      }).catch(function (err) {
        toast(s.store, "Impossible de copier l'image dans la bibliothèque : " +
          (err && err.message ? err.message : "erreur inconnue"));
        m.redraw();
      });
    },

    commitCard: function (vnode, front, back) {
      var s = vnode.state;
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
      s.frontIsImage = false;
      s.frontImageSrc = "";
      s.frontImageCaption = "";
    },
    edit: function (vnode, card) {
      var s = vnode.state;
      s.editingId = card.id;
      if (global.CardMedia.isImageField(card.front)) {
        s.frontIsImage = true;
        s.frontImageSrc = card.front.split("\n")[0];
        s.frontImageCaption = global.CardMedia.imageCaption(card.front);
        s.front = "";
      } else {
        s.frontIsImage = false;
        s.frontImageSrc = "";
        s.frontImageCaption = "";
        s.front = card.front;
      }
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
                  m("label", { style: "cursor:pointer" }, [
                    m("input[type=checkbox]", {
                      checked: s.frontIsImage,
                      onchange: function (e) { s.frontIsImage = e.target.checked; }
                    }),
                    " Recto = image"
                  ])
                ]),
                s.frontIsImage
                  ? m("div", [
                      m("label", "Image du recto"),
                      m(global.ImagePicker, {
                        store: s.store,
                        value: s.frontImageSrc,
                        onchange: function (v) {
                          s.frontImageSrc = v;
                        }
                      }),
                      m("label", { style: "margin-top:.4rem" }, "Légende (optionnelle)"),
                      m("input[type=text]", {
                        value: s.frontImageCaption,
                        onchange: function (e) { s.frontImageCaption = e.target.value; },
                        placeholder: "ex. Quel est cet animal ?"
                      })
                    ])
                  : m("div", [
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
                    m("td", m(global.CardSide, { text: card.front })),
                    m("td", m(global.CardSide, { text: card.back })),
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
