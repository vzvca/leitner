(function (global) {
  "use strict";
  var m = global.m;
  var constants = global.LeitnerConstants;
  var shuffle = global.LeitnerShuffle.shuffleInPlace;

  var Review = {
    oninit: function (vnode) {
      vnode.state.store = vnode.attrs.store;
      vnode.state.queue = [];
      vnode.state.current = null;
      vnode.state.revealed = false;
      vnode.state.done = 0;
      vnode.state._deckId = vnode.attrs.store.activeDeck().id;
      Review.buildQueue(vnode);
    },
    onbeforeupdate: function (vnode) {
      var s = vnode.state;
      var deckId = s.store.activeDeck().id;
      if (deckId !== s._deckId) {
        s._deckId = deckId;
        s.done = 0;
        Review.buildQueue(vnode);
      }
    },
    buildQueue: function (vnode) {
      var s = vnode.state;
      var deck = s.store.activeDeck();
      s.queue = deck.dueCards().slice();
      shuffle(s.queue);
      s.current = s.queue.length > 0 ? s.queue[0] : null;
      s.queue = s.queue.slice(1);
      s.revealed = false;
    },
    answer: function (vnode, correct) {
      var s = vnode.state;
      var deck = s.store.activeDeck();
      var intervals = constants.BOX_INTERVALS_DAYS;
      if (correct) s.current.markCorrect(intervals);
      else s.current.markWrong(intervals);
      s.done += 1;
      s.store.save();
      if (s.queue.length > 0) {
        s.current = s.queue[0];
        s.queue = s.queue.slice(1);
        s.revealed = false;
      } else {
        s.current = null;
      }
    },
    view: function (vnode) {
      var s = vnode.state;
      var deck = s.store.activeDeck();

      if (!s.current && s.done === 0) {
        return m(".card-panel.review-card", [
          m("div", "🎉 Rien à réviser pour le moment !"),
          m("p.muted", "Toutes les cartes échéues ont été traitées. Revenez plus tard ou ajoutez de nouvelles cartes."),
          m(m.route.Link, { href: "/cards" }, "Voir mes cartes")
        ]);
      }

      if (!s.current) {
        return m(".card-panel.review-card", [
          m("div", "✅ Session terminée !"),
          m("p", s.done + " carte(s) révisée(s)."),
          m("div.review-actions", [
            m("button.primary", { onclick: function () { Review.buildQueue(vnode); s.done = 0; } }, "Réviser encore"),
            m(m.route.Link, { href: "/cards" }, "Voir mes cartes")
          ])
        ]);
      }

      return m(".review-view", [
        m(".review-progress",
          "Paquet : " + deck.name + " — restantes : " + (s.queue.length + 1) + " — révisées : " + s.done),
        m(".review-card", [
          m(".question", m(global.MathText, { text: s.current.front })),
          s.revealed
            ? m(".answer", m(global.MathText, { text: s.current.back }))
            : m("p.muted", "Réfléchissez, puis révélez la réponse."),
          s.revealed
            ? m(".review-actions", [
                m("button.fail", { onclick: function () { Review.answer(vnode, false); } }, "✗ Je me suis trompé"),
                m("button.success", { onclick: function () { Review.answer(vnode, true); } }, "✓ Je savais")
              ])
            : m(".review-actions", [
                m("button.primary", { onclick: function () { s.revealed = true; } }, "Révéler la réponse")
              ])
        ])
      ]);
    }
  };

  global.Review = Review;
})(window);
