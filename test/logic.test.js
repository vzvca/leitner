"use strict";

var nodeTest = require("node:test");
var describe = nodeTest.describe;
var it = nodeTest.it;
var beforeEach = nodeTest.beforeEach;
var assert = require("node:assert/strict");
var fs = require("fs");
var path = require("path");
var vm = require("vm");

var modules = {};
var ctx = vm.createContext({
  console: console,
  module: undefined,
  exports: undefined,
  require: function (name) {
    var map = {
      "Card.js": "js/models/Card.js",
      "./Card.js": "js/models/Card.js",
      "constants.js": "js/models/constants.js",
      "./constants.js": "js/models/constants.js",
      "Deck.js": "js/models/Deck.js",
      "./Deck.js": "js/models/Deck.js",
      "store.js": "js/services/store.js",
      "mistral.js": "js/services/mistral.js",
      "settings.js": "js/services/settings.js",
      "../models/Deck.js": "js/models/Deck.js",
      "../models/constants.js": "js/models/constants.js"
    };
    var norm = map[name] || name.replace(/^\.\//, "").replace(/^\.\.\//, "");
    if (!modules[norm]) loadFile(norm);
    return modules[norm];
  }
});

function loadFile(rel) {
  var norm = rel.replace(/^\.\//, "").replace(/^\.\.\//, "");
  var code = fs.readFileSync(path.join(__dirname, "..", norm), "utf8");
  var localModule = { exports: {} };
  ctx.module = localModule;
  ctx.exports = localModule.exports;
  vm.runInContext(code, ctx, { filename: norm });
  modules[norm] = localModule.exports;
  return localModule.exports;
}

var constants = loadFile("js/models/constants.js");
var Card = loadFile("js/models/Card.js");
var Deck = loadFile("js/models/Deck.js");
var Store = loadFile("js/services/store.js");
var MistralClient = loadFile("js/services/mistral.js");
var Settings = loadFile("js/services/settings.js");

var REF = new Date(2026, 0, 10);
function dayString(d) {
  return d.toISOString().slice(0, 10);
}

describe("constants", function () {
  it("définit 5 boîtes avec des intervalles croissants", function () {
    assert.strictEqual(constants.BOX_COUNT, 5);
    assert.strictEqual(constants.BOX_INTERVALS_DAYS.length, 5);
    var prev = 0;
    constants.BOX_INTERVALS_DAYS.forEach(function (i) {
      assert.ok(i > prev, "intervalles croissants");
      prev = i;
    });
  });
});

describe("Card", function () {
  it("nouvelle carte : boîte 1 et échéance J+1", function () {
    var c = new Card({ front: "a", back: "b" });
    assert.strictEqual(c.box, 1);
    assert.strictEqual(c.correctCount, 0);
  });

  it("markCorrect fait monter d'une boîte et fixe l'échéance selon l'intervalle", function () {
    var c = new Card({ front: "a", back: "b", box: 2 });
    c.markCorrect(constants.BOX_INTERVALS_DAYS, REF);
    assert.strictEqual(c.box, 3);
    assert.strictEqual(c.dueDate, dayString(new Date(2026, 0, 10 + 4)));
  });

  it("markCorrect en dernière boîte reste en dernière boîte", function () {
    var c = new Card({ front: "a", back: "b", box: 5 });
    c.markCorrect(constants.BOX_INTERVALS_DAYS, REF);
    assert.strictEqual(c.box, 5);
  });

  it("markWrong renvoie en boîte 1", function () {
    var c = new Card({ front: "a", back: "b", box: 4 });
    c.markWrong(constants.BOX_INTERVALS_DAYS, REF);
    assert.strictEqual(c.box, 1);
    assert.strictEqual(c.dueDate, dayString(new Date(2026, 0, 10 + 1)));
    assert.strictEqual(c.wrongCount, 1);
  });

  it("isDue : vrai si échéance <= aujourd'hui, faux sinon, vrai sans échéance", function () {
    var today = new Card({ front: "a", back: "b" });
    today.dueDate = dayString(new Date(2026, 0, 10));
    assert.ok(today.isDue(REF));

    var future = new Card({ front: "a", back: "b" });
    future.dueDate = dayString(new Date(2026, 0, 12));
    assert.ok(!future.isDue(REF));

    var none = new Card({ front: "a", back: "b" });
    none.dueDate = null;
    assert.ok(none.isDue(REF));
  });
});

describe("Deck", function () {
  var deck;
  beforeEach(function () {
    deck = new Deck({ name: "Test" });
  });

  it("addCard place la carte en boîte 1 avec échéance J+1", function () {
    var c = deck.addCard("bonjour", "hello", REF);
    assert.strictEqual(deck.cards.length, 1);
    assert.strictEqual(c.box, 1);
    assert.strictEqual(c.dueDate, Card.todayString(REF));
    assert.strictEqual(c.deckId, deck.id);
  });

  it("updateCard / findCard / removeCard", function () {
    var c = deck.addCard("a", "b", REF);
    assert.ok(deck.updateCard(c.id, "x", "y"));
    assert.strictEqual(deck.findCard(c.id).front, "x");
    assert.ok(deck.removeCard(c.id));
    assert.strictEqual(deck.cards.length, 0);
    assert.ok(!deck.removeCard(c.id));
  });

  it("dueCards ne renvoie que les cartes échéues", function () {
    var d1 = deck.addCard("a", "b", REF);
    var d2 = deck.addCard("c", "d", REF);
    d2.dueDate = "2026-01-20";
    var due = deck.dueCards(REF);
    assert.strictEqual(due.length, 1);
    assert.strictEqual(due[0].id, d1.id);
  });

  it("countByBox et stats", function () {
    var c1 = deck.addCard("a", "b", REF);
    var c2 = deck.addCard("c", "d", REF);
    c2.markCorrect(constants.BOX_INTERVALS_DAYS, REF);
    c2.markCorrect(constants.BOX_INTERVALS_DAYS, REF);
    c1.markWrong(constants.BOX_INTERVALS_DAYS, REF);
    var st = deck.stats();
    assert.strictEqual(st.totalCards, 2);
    assert.strictEqual(st.byBox[1], 1);
    assert.strictEqual(st.byBox[3], 1);
    assert.strictEqual(st.correctAnswers, 2);
    assert.strictEqual(st.wrongAnswers, 1);
    assert.strictEqual(st.accuracy, 67);
    assert.strictEqual(st.mastered, 0);
  });

  it("toJSON round-trip", function () {
    deck.addCard("a", "b", REF);
    var json = JSON.parse(JSON.stringify(deck.toJSON()));
    var copy = new Deck(json);
    assert.strictEqual(copy.cards.length, 1);
    assert.strictEqual(copy.cards[0].front, "a");
    assert.strictEqual(copy.cards[0].box, 1);
  });
});

describe("Store", function () {
  function memStorage() {
    var data = {};
    return {
      getItem: function (k) { return k in data ? data[k] : null; },
      setItem: function (k, v) { data[k] = String(v); },
      removeItem: function (k) { delete data[k]; }
    };
  }

  it("sans données existantes, crée un paquet par défaut", function () {
    var s = new Store(memStorage());
    assert.strictEqual(s.decks.length, 1);
    assert.ok(s.activeDeck());
  });

  it("sauvegarde et recharge les cartes", function () {
    var storage = memStorage();
    var s1 = new Store(storage);
    s1.activeDeck().addCard("a", "b", REF);
    s1.save();
    var s2 = new Store(storage);
    assert.strictEqual(s2.activeDeck().cards.length, 1);
    assert.strictEqual(s2.activeDeck().cards[0].front, "a");
  });

  it("addDeck / setActiveDeck / removeDeck", function () {
    var s = new Store(memStorage());
    var d1 = s.decks[0];
    var d2 = s.addDeck("Espagnol");
    assert.strictEqual(s.activeDeck().id, d2.id);
    s.setActiveDeck(d1.id);
    assert.strictEqual(s.activeDeck().id, d1.id);
    s.removeDeck(d1.id);
    assert.strictEqual(s.activeDeck().id, d2.id);
  });

  it("removeDeck du dernier paquet recrée un paquet par défaut", function () {
    var s = new Store(memStorage());
    var only = s.decks[0];
    s.removeDeck(only.id);
    assert.strictEqual(s.decks.length, 1);
    assert.notStrictEqual(s.decks[0].id, only.id);
  });

  it("renameDeck modifie nom et description, rejette un nom vide", function () {
    var s = new Store(memStorage());
    var deck = s.addDeck("Espagnol");
    s.renameDeck(deck.id, "Anglais — cuisine", "Vocabulaire cuisine");
    assert.strictEqual(deck.name, "Anglais — cuisine");
    assert.strictEqual(deck.description, "Vocabulaire cuisine");
    s.renameDeck(deck.id, "   ");
    assert.strictEqual(deck.name, "Anglais — cuisine");
    assert.strictEqual(s.renameDeck("inconnu", "x"), null);
  });

  it("addDeck rend le nouveau paquet actif et le persiste", function () {
    var storage = memStorage();
    var s = new Store(storage);
    var d = s.addDeck("Voyage");
    assert.strictEqual(s.activeDeck().id, d.id);
    var s2 = new Store(storage);
    assert.strictEqual(s2.activeDeckId, d.id);
    assert.strictEqual(s2.decks.length, 2);
  });

  it("importJSON accepte un export valide et rejette un format invalide", function () {
    var s = new Store(memStorage());
    s.activeDeck().addCard("x", "y", REF);
    var raw = s.exportJSON();
    var n = s.importJSON(raw);
    assert.strictEqual(n, 1);
    assert.throws(function () { s.importJSON('{"foo":1}'); }, /Format invalide/);
    assert.throws(function () { s.importJSON('{"decks":[]}'); }, /Aucun paquet/);
  });
});

describe("MistralClient (logique pure)", function () {
  it("parseJSONLoose gère JSON nu, encadré de texte et bloc markdown", function () {
    var o1 = MistralClient.parseJSONLoose('{"a":1}');
    assert.strictEqual(o1.a, 1);
    var o2 = MistralClient.parseJSONLoose('Voici le JSON : {"b":2} merci');
    assert.strictEqual(o2.b, 2);
    var o4 = MistralClient.parseJSONLoose('```json\n{"c":3}\n```');
    assert.strictEqual(o4.c, 3);
  });

  it("parseJSONLoose rejette le JSON invalide", function () {
    assert.throws(function () { MistralClient.parseJSONLoose("pas du json"); });
  });

  it("extractCards filtre les cartes invalides et normalise", function () {
    var cards = MistralClient.extractCards({
      cards: [
        { front: "  a ", back: " b " },
        { front: "", back: "x" },
        { front: "y" },
        null,
        { front: "c", back: "d" }
      ]
    });
    assert.strictEqual(cards.length, 2);
    assert.strictEqual(cards[0].front, "a");
    assert.strictEqual(cards[0].back, "b");
    assert.strictEqual(cards[1].front, "c");
  });

  it("CARD_SIZES propose 10, 20, 50, 100, 200", function () {
    assert.strictEqual(MistralClient.CARD_SIZES.length, 5);
    [10, 20, 50, 100, 200].forEach(function (v, i) {
      assert.strictEqual(MistralClient.CARD_SIZES[i], v);
    });
  });
});

describe("Settings (clé API)", function () {
  it("sauvegarde et relit la clé API et le modèle", function () {
    var storage = (function () {
      var data = {};
      return {
        getItem: function (k) { return k in data ? data[k] : null; },
        setItem: function (k, v) { data[k] = String(v); }
      };
    })();
    var st = new Settings(storage);
    assert.strictEqual(st.getApiKey(), "");
    st.setApiKey("  test-key  ");
    st.setModel("mistral-small-latest");
    var st2 = new Settings(storage);
    assert.strictEqual(st2.getApiKey(), "test-key");
    assert.strictEqual(st2.getModel(), "mistral-small-latest");
  });
});

describe("Cycle de Leitner de bout en bout", function () {
  it("une carte traverse les boîtes puis est acquise ; une erreur la renvoie en boîte 1", function () {
    var deck = new Deck({ name: "cycle" });
    var c = deck.addCard("eau", "water", REF);
    var intervals = constants.BOX_INTERVALS_DAYS;

    var ref = new Date(REF.getTime());
    assert.strictEqual(c.dueDate, Card.todayString(ref), "nouvelle carte due immédiatement");

    for (var box = 2; box <= 5; box++) {
      c.markCorrect(intervals, ref);
      assert.strictEqual(c.box, box);
      var expectedDue = new Date(ref.getTime());
      expectedDue.setDate(expectedDue.getDate() + intervals[box - 1]);
      assert.strictEqual(c.dueDate, dayString(expectedDue));
      assert.ok(!c.isDue(REF), "pas due avant son échéance");
      ref = expectedDue;
      assert.ok(c.isDue(ref), "due le jour de son échéance");
    }

    assert.strictEqual(deck.stats().mastered, 1);

    c.markWrong(intervals, REF);
    assert.strictEqual(c.box, 1);
  });
});
