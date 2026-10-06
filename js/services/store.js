(function (global) {
  "use strict";

  var Deck = typeof require === "function" ? require("../models/Deck.js") : global.Deck;
  var constants =
    typeof require === "function"
      ? require("../models/constants.js")
      : global.LeitnerConstants;

  function Store(storage) {
    this.storage = storage || null;
    this.decks = [];
    this.activeDeckId = null;
    if (this.storage) this.load();
  }

  Store.prototype.load = function () {
    if (!this.storage) return;
    var raw = this.storage.getItem(constants.STORAGE_KEY);
    if (!raw) {
      this.decks = [new Deck({ name: "Paquet par défaut" })];
      this.activeDeckId = this.decks[0].id;
      this.save();
      return;
    }
    try {
      var data = JSON.parse(raw);
      this.decks = (data.decks || []).map(function (d) { return new Deck(d); });
      this.activeDeckId = data.activeDeckId || (this.decks[0] && this.decks[0].id);
    } catch (e) {
      this.decks = [new Deck({ name: "Paquet par défaut" })];
      this.activeDeckId = this.decks[0].id;
    }
    if (this.decks.length === 0) {
      this.decks = [new Deck({ name: "Paquet par défaut" })];
      this.activeDeckId = this.decks[0].id;
    }
  };

  Store.prototype.save = function () {
    if (!this.storage) return;
    var payload = {
      activeDeckId: this.activeDeckId,
      decks: this.decks.map(function (d) { return d.toJSON(); })
    };
    this.storage.setItem(constants.STORAGE_KEY, JSON.stringify(payload));
  };

  Store.prototype.activeDeck = function () {
    var self = this;
    return (
      this.decks.find(function (d) { return d.id === self.activeDeckId; }) ||
      this.decks[0]
    );
  };

  Store.prototype.setActiveDeck = function (deckId) {
    this.activeDeckId = deckId;
    this.save();
  };

  Store.prototype.addDeck = function (name) {
    var deck = new Deck({ name: name });
    this.decks.push(deck);
    this.activeDeckId = deck.id;
    this.save();
    return deck;
  };

  Store.prototype.renameDeck = function (deckId, name, description) {
    var deck = this.decks.find(function (d) { return d.id === deckId; });
    if (!deck) return null;
    if (typeof name === "string" && name.trim()) deck.name = name.trim();
    if (typeof description === "string") deck.description = description.trim();
    this.save();
    return deck;
  };

  Store.prototype.removeDeck = function (deckId) {
    var idx = this.decks.findIndex(function (d) { return d.id === deckId; });
    if (idx === -1) return false;
    this.decks.splice(idx, 1);
    if (this.decks.length === 0) {
      this.decks = [new Deck({ name: "Paquet par défaut" })];
    }
    if (this.activeDeckId === deckId) {
      this.activeDeckId = this.decks[0].id;
    }
    this.save();
    return true;
  };

  Store.prototype.exportJSON = function () {
    return JSON.stringify(
      { decks: this.decks.map(function (d) { return d.toJSON(); }) },
      null,
      2
    );
  };

  Store.prototype.importJSON = function (raw) {
    var data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!data || !Array.isArray(data.decks)) {
      throw new Error("Format invalide : attendu { decks: [...] }");
    }
    var decks = data.decks.map(function (d) { return new Deck(d); });
    if (decks.length === 0) throw new Error("Aucun paquet trouvé dans l'import");
    this.decks = decks;
    this.activeDeckId = decks[0].id;
    this.save();
    return decks.length;
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Store;
  } else {
    global.Store = Store;
  }
})(typeof window !== "undefined" ? window : globalThis);
