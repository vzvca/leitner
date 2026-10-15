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
      vnode.state.frontImageMode = "idb"; // "idb" | "ref" (chemin/https/data url)
      vnode.state.frontImageIdbBusy = false;
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
    pickFrontImage: function (s, ev) {
      var file = ev.target.files && ev.target.files[0];
      ev.target.value = "";
      if (!file) return;
      if (!/^image\/(png|jpe?g|gif|webp)$/.test(file.type)) {
        toast(s.store, "Format d'image non supporté (png, jpg, gif, webp)");
        return;
      }
      var img = new Image();
      var reader = new FileReader();
      reader.onload = function () {
        img.onload = function () {
          var maxDim = 640;
          var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          var canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          var dataUrl = canvas.toDataURL("image/jpeg", 0.72);
          if (dataUrl.length > 700000) {
            toast(s.store, "Image trop volumineuse même après compression (" + Math.round(dataUrl.length / 1024) + " Ko). Réduisez ses dimensions.");
            return;
          }
          s.frontImageSrc = dataUrl;
          s.frontIsImage = true;
          m.redraw();
        };
        img.onerror = function () {
          toast(s.store, "Impossible de lire cette image");
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    },
    pickFrontImageIdb: function (s, ev) {
      var file = ev.target.files && ev.target.files[0];
      ev.target.value = "";
      if (!file) return;
      if (!/^image\/(png|jpe?g|gif|webp)$/.test(file.type)) {
        toast(s.store, "Format non supporté (png, jpg, gif, webp)");
        return;
      }
      s.frontImageIdbBusy = true;
      var id = "img-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
      global.ImageStore.put(id, file)
        .then(function () {
          s.frontImageSrc = "idb:" + id;
          s.frontImageMode = "idb";
          toast(s.store, "Image enregistrée dans IndexedDB (" + Math.round(file.size / 1024) + " Ko)");
        })
        .catch(function (e) {
          toast(s.store, "IndexedDB : " + e.message);
        })
        .finally(function () {
          s.frontImageIdbBusy = false;
          m.redraw();
        });
    },
    save: function (vnode, e) {
      e.preventDefault();
      var s = vnode.state;
      var front = s.front.trim();
      var back = s.back.trim();
      if (s.frontIsImage) {
        var raw = s.frontImageSrc.trim() || front;
        if (raw.indexOf("idb:") === 0) {
          if (!global.CardMedia.idbId("idb:" + raw.slice(4))) {
            toast(s.store, "Identifiant IndexedDB invalide");
            return;
          }
          front = "idb:" + raw.slice(4).trim() +
            (s.frontImageCaption.trim() ? "\n" + s.frontImageCaption.trim() : "");
        } else {
          if (!global.CardMedia.allowedSrc("img:" + raw)) {
            toast(s.store, "Source d'image invalide (chemin images/..., data:image/... ou https)");
            return;
          }
          front = global.CardMedia.toImageField(raw, s.frontImageCaption);
        }
      }
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
        var firstLine = card.front.split("\n")[0];
        if (firstLine.indexOf("idb:") === 0) {
          s.frontImageMode = "idb";
          s.frontImageSrc = firstLine;
        } else {
          s.frontImageMode = "ref";
          s.frontImageSrc = firstLine.slice(global.CardMedia.PREFIX.length);
        }
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
                      m("label", { style: "cursor:pointer; display:inline-block; margin-right:1rem" }, [
                        m("input[type=radio]", {
                          name: "frontImageMode",
                          checked: s.frontImageMode === "idb",
                          onchange: function () { s.frontImageMode = "idb"; }
                        }),
                        " Fichier (IndexedDB, ≤ 2 Mo)"
                      ]),
                      m("label", { style: "cursor:pointer; display:inline-block" }, [
                        m("input[type=radio]", {
                          name: "frontImageMode",
                          checked: s.frontImageMode === "ref",
                          onchange: function () { s.frontImageMode = "ref"; }
                        }),
                        " Référence (chemin images/… ou https)"
                      ]),
                      s.frontImageMode === "idb"
                        ? m("div", [
                            m("label.file-input-label", [
                              "Choisir un fichier : ",
                              m("input[type=file][accept='image/png,image/jpeg,image/gif,image/webp']", {
                                disabled: s.frontImageIdbBusy,
                                onchange: function (e) { CardList.pickFrontImageIdb(s, e); }
                              })
                            ]),
                            s.frontImageIdbBusy ? m("div.muted", "Enregistrement…") : null,
                            s.frontImageSrc.indexOf("idb:") === 0
                              ? m("div.muted", "Image stockée : " + s.frontImageSrc + " (dans ce navigateur uniquement)")
                              : null
                          ])
                        : m("div", [
                            m("label.file-input-label", [
                              "Ou importer compressé en data URL (≤ ~500 Ko) : ",
                              m("input[type=file][accept='image/png,image/jpeg,image/gif,image/webp']", {
                                onchange: function (e) { CardList.pickFrontImage(s, e); }
                              })
                            ]),
                            m("input[type=text]", {
                              value: s.frontImageSrc,
                              onchange: function (e) { s.frontImageSrc = e.target.value; },
                              placeholder: "chemin images/… (ex. images/animaux/renard.jpg) ou https://…",
                              style: "margin-top:.4rem"
                            })
                          ]),
                      m("label", { style: "margin-top:.4rem" }, "Légende (optionnelle)"),
                      m("input[type=text]", {
                        value: s.frontImageCaption,
                        onchange: function (e) { s.frontImageCaption = e.target.value; },
                        placeholder: "ex. Quel est cet animal ?"
                      }),
                      s.frontImageMode === "ref" && s.frontImageSrc && global.CardMedia.allowedSrc("img:" + s.frontImageSrc.trim())
                        ? m("img", {
                            src: global.CardMedia.imageSrc("img:" + s.frontImageSrc.trim()),
                            alt: "aperçu",
                            style: "margin-top:.5rem; max-width:12rem; max-height:8rem; border-radius:6px; border:1px solid var(--border)"
                          })
                        : null
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
