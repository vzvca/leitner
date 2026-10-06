(function (global) {
  "use strict";
  var m = global.m;
  var MistralClient = global.MistralClient;

  function toast(store, msg) {
    store.toast = msg;
    store.toastKey = Date.now();
    clearTimeout(store._toastTimer);
    store._toastTimer = setTimeout(function () {
      store.toast = null;
      m.redraw();
    }, 2600);
  }

  var AIStudio = {
    oninit: function (vnode) {
      var s = vnode.state;
      s.store = vnode.attrs.store;
      s.settings = vnode.attrs.settings;
      s.tab = "generate";
      s.apiKey = s.settings.getApiKey();
      s.model = s.settings.getModel() || MistralClient.DEFAULT_MODEL;
      s.keyVisible = false;

      s.topic = "";
      s.size = "";
      s.genBusy = false;
      s.genError = "";
      s.preview = null;

      s.revisionInstruction = "";
      s.revBusy = false;
      s.revError = "";
      s.revPreview = null;
    },

    saveKey: function (s) {
      s.settings.setApiKey(s.apiKey);
      s.settings.setModel(s.model);
      toast(s.store, "Clé API et modèle enregistrés dans ce navigateur");
    },

    client: function (s) {
      if (!s.apiKey.trim()) {
        throw new Error("Renseignez votre clé API Mistral (onglet Clé API)");
      }
      return new MistralClient(s.apiKey.trim(), s.model.trim() || undefined);
    },

    doGenerate: function (s) {
      if (s.genBusy) return;
      var topic = s.topic.trim();
      if (!topic) {
        s.genError = "Décrivez le sujet du jeu de cartes.";
        return;
      }
      s.genBusy = true;
      s.genError = "";
      s.preview = null;
      var size = s.size ? parseInt(s.size, 10) : null;
      var client;
      try {
        client = AIStudio.client(s);
      } catch (e) {
        s.genBusy = false;
        s.genError = e.message;
        return;
      }
      client.generateDeck(topic, size)
        .then(function (data) {
          s.preview = data;
        })
        .catch(function (e) {
          s.genError = e.message || String(e);
        })
        .finally(function () {
          s.genBusy = false;
          m.redraw();
        });
    },

    acceptGenerated: function (s) {
      var data = s.preview;
      if (!data || !data.cards.length) return;
      var deck = s.store.addDeck(data.name || "Jeu généré");
      s.store.renameDeck(deck.id, data.name || "Jeu généré", data.description || "");
      data.cards.forEach(function (c) {
        deck.addCard(c.front, c.back);
      });
      s.store.save();
      s.preview = null;
      s.topic = "";
      s.size = "";
      toast(s.store, "Jeu « " + deck.name + " » créé avec " + deck.cards.length + " cartes");
      m.route.set("/cards");
    },

    doRevise: function (s) {
      if (s.revBusy) return;
      var deck = s.store.activeDeck();
      if (!deck || deck.cards.length === 0) {
        s.revError = "Le jeu actif ne contient aucune carte à réviser.";
        return;
      }
      var instruction = s.revisionInstruction.trim();
      if (!instruction) {
        s.revError = "Décrivez la modification souhaitée (ex. « remplacer les mots trop techniques par des mots courants »).";
        return;
      }
      s.revBusy = true;
      s.revError = "";
      s.revPreview = null;
      var client;
      try {
        client = AIStudio.client(s);
      } catch (e) {
        s.revBusy = false;
        s.revError = e.message;
        return;
      }
      client.reviseDeck(deck, instruction)
        .then(function (cards) {
          s.revPreview = cards;
        })
        .catch(function (e) {
          s.revError = e.message || String(e);
        })
        .finally(function () {
          s.revBusy = false;
          m.redraw();
        });
    },

    acceptRevision: function (s) {
      var deck = s.store.activeDeck();
      var cards = s.revPreview;
      if (!deck || !cards) return;
      deck.cards = cards.map(function (c) {
        var Card = global.Card;
        return new Card({
          deckId: deck.id,
          front: c.front,
          back: c.back,
          box: 1,
          dueDate: Card.todayString()
        });
      });
      s.store.save();
      s.revPreview = null;
      s.revisionInstruction = "";
      toast(s.store, "Jeu « " + deck.name + " » révisé : " + deck.cards.length + " cartes");
      m.route.set("/cards");
    },

    diffSummary: function (s) {
      var deck = s.store.activeDeck();
      if (!deck || !s.revPreview) return "";
      return deck.cards.length + " carte(s) avant → " + s.revPreview.length + " carte(s) après";
    },

    view: function (vnode) {
      var s = vnode.state;
      var activeDeck = s.store.activeDeck();

      function tabBtn(id, label) {
        return m("button", {
          onclick: function () { s.tab = id; },
          class: s.tab === id ? "primary" : ""
        }, label);
      }

      return m(".ai-view", [
        m(".card-panel", [
          m("h2", "🤖 Assistant IA (Mistral)"),
          m("p.muted", "Générez ou révisez un jeu de cartes avec l'API Mistral. Votre clé est stockée uniquement dans ce navigateur (localStorage) et n'est jamais envoyée ailleurs qu'à api.mistral.ai."),
          m("div", { style: "display:flex; gap:.5rem; flex-wrap:wrap; margin-top:.6rem" }, [
            tabBtn("generate", "Générer un jeu"),
            tabBtn("revise", "Réviser un jeu"),
            tabBtn("key", "Clé API")
          ])
        ]),

        s.tab === "generate" ? AIStudio.renderGenerate(s) : null,
        s.tab === "revise" ? AIStudio.renderRevise(s, activeDeck) : null,
        s.tab === "key" ? AIStudio.renderKey(s) : null
      ]);
    },

    renderGenerate: function (s) {
      return m(".card-panel", [
        m("h2", "Générer un nouveau jeu de cartes"),
        m("form.stack", { onsubmit: function (e) { e.preventDefault(); AIStudio.doGenerate(s); } }, [
          m("div", [
            m("label", "Sujet du jeu"),
            m("textarea", {
              value: s.topic,
              onchange: function (e) { s.topic = e.target.value; },
              placeholder: "ex. Vocabulaire anglais lié à la cuisine ; noms des départements français et leur numéro ; formules de dérivées en mathématiques…"
            })
          ]),
          m("div", [
            m("label", "Nombre de cartes (optionnel)"),
            m("select", {
              value: s.size,
              onchange: function (e) { s.size = e.target.value; }
            }, [
              m("option", { value: "" }, "Automatique (déduit du sujet)"),
              MistralClient.CARD_SIZES.map(function (n) {
                return m("option", { value: String(n) }, String(n));
              })
            ])
          ]),
          m("div", [
            m("button.primary[type=submit][disabled=" + (s.genBusy ? "disabled" : "") + "]",
              s.genBusy ? "Génération en cours…" : "Générer avec Mistral")
          ])
        ]),
        s.genError ? m("p", { style: "color:var(--danger)" }, "⚠ " + s.genError) : null,

        s.preview ? m("div", { style: "margin-top:1rem" }, [
          m("h2", "Aperçu — « " + (s.preview.name || "Jeu généré") + " » (" + s.preview.cards.length + " cartes)"),
          s.preview.description ? m("p.muted", s.preview.description) : null,
          m("table.cards-table", [
            m("thead", m("tr", [m("th", "Recto"), m("th", "Verso")])),
            m("tbody", s.preview.cards.slice(0, 20).map(function (c) {
              return m("tr", [m("td", c.front), m("td", c.back)]);
            }))
          ]),
          s.preview.cards.length > 20
            ? m("p.muted", "… et " + (s.preview.cards.length - 20) + " autres cartes")
            : null,
          m("div", { style: "display:flex; gap:.6rem; margin-top:.8rem" }, [
            m("button.primary", { onclick: function () { AIStudio.acceptGenerated(s); } }, "Créer ce jeu"),
            m("button", { onclick: function () { s.preview = null; } }, "Discarder")
          ])
        ]) : null
      ]);
    },

    renderRevise: function (s, activeDeck) {
      return m(".card-panel", [
        m("h2", "Réviser un jeu existant avec l'IA"),
        m("p", [
          "Jeu actif : ",
          m("strong", activeDeck ? activeDeck.name : "—"),
          " (" + (activeDeck ? activeDeck.cards.length : 0) + " cartes)"
        ]),
        m("form.stack", { onsubmit: function (e) { e.preventDefault(); AIStudio.doRevise(s); } }, [
          m("div", [
            m("label", "Consigne de révision"),
            m("textarea", {
              value: s.revisionInstruction,
              onchange: function (e) { s.revisionInstruction = e.target.value; },
              placeholder: "ex. Supprime les cartes trop techniques et remplace-les par des mots plus simples et courants ; ajoute 10 cartes sur les légumes ; corrige les fautes…"
            })
          ]),
          m("div", [
            m("button.primary[type=submit][disabled=" + (s.revBusy ? "disabled" : "") + "]",
              s.revBusy ? "Révision en cours…" : "Envoyer au modèle")
          ])
        ]),
        s.revError ? m("p", { style: "color:var(--danger)" }, "⚠ " + s.revError) : null,

        s.revPreview ? m("div", { style: "margin-top:1rem" }, [
          m("h2", "Aperçu de la révision (" + AIStudio.diffSummary(s) + ")"),
          m("table.cards-table", [
            m("thead", m("tr", [m("th", "Recto"), m("th", "Verso")])),
            m("tbody", s.revPreview.slice(0, 20).map(function (c) {
              return m("tr", [m("td", c.front), m("td", c.back)]);
            }))
          ]),
          s.revPreview.length > 20
            ? m("p.muted", "… et " + (s.revPreview.length - 20) + " autres cartes")
            : null,
          m("p.muted", "⚠ Appliquer la révision remplace toutes les cartes du jeu (les boîtes et statistiques sont remises à zéro pour les cartes remplacées)."),
          m("div", { style: "display:flex; gap:.6rem" }, [
            m("button.primary", { onclick: function () { AIStudio.acceptRevision(s); } }, "Appliquer"),
            m("button", { onclick: function () { s.revPreview = null; } }, "Annuler")
          ])
        ]) : null
      ]);
    },

    renderKey: function (s) {
      return m(".card-panel", [
        m("h2", "Clé API Mistral"),
        m("form.stack", { onsubmit: function (e) { e.preventDefault(); AIStudio.saveKey(s); } }, [
          m("div", [
            m("label", "Clé API"),
            m("input[type=" + (s.keyVisible ? "text" : "password") + "]", {
              value: s.apiKey,
              onchange: function (e) { s.apiKey = e.target.value; },
              placeholder: "ex. …  (https://console.mistral.ai)"
            }),
            m("div", { style: "margin-top:.3rem" }, [
              m("label", { style: "font-size:.85rem; cursor:pointer" }, [
                m("input[type=checkbox]", {
                  checked: s.keyVisible,
                  onchange: function (e) { s.keyVisible = e.target.checked; }
                }),
                " Afficher la clé"
              ])
            ])
          ]),
          m("div", [
            m("label", "Modèle"),
            m("input[type=text]", {
              value: s.model,
              onchange: function (e) { s.model = e.target.value; },
              placeholder: MistralClient.DEFAULT_MODEL
            })
          ]),
          m("div", [m("button.primary[type=submit]", "Enregistrer")])
        ]),
        m("p.muted", "La clé est conservée dans le localStorage de ce navigateur uniquement. Elle est envoyée à api.mistral.ai lors des générations/révisions.")
      ]);
    }
  };

  global.AIStudio = AIStudio;
})(window);
