(function (global) {
  "use strict";

  var Card = typeof require === "function" ? require("./Card.js") : global.Card;
  var constants =
    typeof require === "function" ? require("./constants.js") : global.LeitnerConstants;

  var idCounter = 0;

  function Deck(attrs) {
    attrs = attrs || {};
    idCounter += 1;
    this.id = attrs.id || "d" + Date.now().toString(36) + "-" + idCounter;
    this.name = attrs.name || "Paquet par défaut";
    this.description = attrs.description || "";
    this.cards = (attrs.cards || []).map(function (c) {
      return new Card(c);
    });
  }

  Deck.prototype.addCard = function (front, back, referenceDate) {
    var card = new Card({
      deckId: this.id,
      front: front,
      back: back,
      box: 1,
      dueDate: Card.todayString(referenceDate)
    });
    this.cards.push(card);
    return card;
  };

  Deck.prototype.removeCard = function (cardId) {
    var idx = this.cards.findIndex(function (c) { return c.id === cardId; });
    if (idx !== -1) this.cards.splice(idx, 1);
    return idx !== -1;
  };

  Deck.prototype.updateCard = function (cardId, front, back) {
    var card = this.findCard(cardId);
    if (!card) return null;
    card.front = front;
    card.back = back;
    return card;
  };

  Deck.prototype.findCard = function (cardId) {
    return this.cards.find(function (c) { return c.id === cardId; }) || null;
  };

  Deck.prototype.dueCards = function (referenceDate) {
    var ref = referenceDate || new Date();
    return this.cards.filter(function (c) { return c.isDue(ref); });
  };

  Deck.prototype.countByBox = function () {
    var counts = {};
    for (var b = 1; b <= constants.BOX_COUNT; b++) counts[b] = 0;
    this.cards.forEach(function (c) { counts[c.box] += 1; });
    return counts;
  };

  Deck.prototype.stats = function () {
    var total = this.cards.length;
    var correct = 0;
    var wrong = 0;
    this.cards.forEach(function (c) {
      correct += c.correctCount;
      wrong += c.wrongCount;
    });
    var answers = correct + wrong;
    return {
      totalCards: total,
      totalAnswers: answers,
      correctAnswers: correct,
      wrongAnswers: wrong,
      accuracy: answers === 0 ? null : Math.round((correct / answers) * 100),
      byBox: this.countByBox(),
      mastered: this.countByBox()[constants.BOX_COUNT] || 0
    };
  };

  Deck.prototype.toJSON = function () {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      cards: this.cards.map(function (c) {
        return {
          id: c.id,
          deckId: c.deckId,
          front: c.front,
          back: c.back,
          box: c.box,
          createdAt: c.createdAt,
          dueDate: c.dueDate,
          correctCount: c.correctCount,
          wrongCount: c.wrongCount
        };
      })
    };
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Deck;
  } else {
    global.Deck = Deck;
  }
})(typeof window !== "undefined" ? window : globalThis);
