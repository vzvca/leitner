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
      "shuffle.js": "js/models/shuffle.js",
      "mathRender.js": "js/services/mathRender.js",
      "cardMedia.js": "js/services/cardMedia.js",
      "imageStore.js": "js/services/imageStore.js",
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
var Shuffle = loadFile("js/models/shuffle.js");
var MathRender = loadFile("js/services/mathRender.js");
var CardMedia = loadFile("js/services/cardMedia.js");
var ImageStoreMod = loadFile("js/services/imageStore.js");
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

describe("Shuffle (file de révision)", function () {
  it("mélange sans perdre ni dupliquer d'éléments", function () {
    var input = [];
    for (var i = 0; i < 100; i++) input.push("c" + i);
    var copy = input.slice();
    Shuffle.shuffleInPlace(copy);
    assert.strictEqual(copy.length, 100);
    var seen = {};
    copy.forEach(function (x) {
      assert.ok(!seen[x], "pas de doublon");
      seen[x] = true;
    });
    assert.strictEqual(Object.keys(seen).length, 100);
  });

  it("ne suit pas l'ordre d'origine sur un jeu suffisamment grand", function () {
    var sameOrderCount = 0;
    var trials = 50;
    for (var t = 0; t < trials; t++) {
      var input = [];
      for (var i = 0; i < 20; i++) input.push(i);
      Shuffle.shuffleInPlace(input);
      var inOrder = true;
      for (var k = 0; k < input.length; k++) {
        if (input[k] !== k) { inOrder = false; break; }
      }
      if (inOrder) sameOrderCount++;
    }
    assert.ok(sameOrderCount < trials, "le mélange doit casser l'ordre (probabilité d'ordre intact ~ 1/20!)");
  });

  it("gère les cas limites (0, 1, 2 éléments)", function () {
    assert.deepStrictEqual(Shuffle.shuffleInPlace([]), []);
    var one = [42];
    assert.deepStrictEqual(Shuffle.shuffleInPlace(one), [42]);
    var two = [1, 2];
    Shuffle.shuffleInPlace(two);
    assert.strictEqual(two.length, 2);
    assert.ok(two.indexOf(1) !== -1 && two.indexOf(2) !== -1);
  });

  it("sépare les paires recto/verso réciproques (cas départements)", function () {
    var ordered = [];
    for (var n = 1; n <= 10; n++) {
      ordered.push({ front: String(n).padStart(2, "0"), back: "dept" + n });
      ordered.push({ front: "dept" + n, back: String(n).padStart(2, "0") });
    }
    var adjacentPairs = 0;
    var trials = 200;
    for (var t = 0; t < trials; t++) {
      var q = ordered.slice();
      Shuffle.shuffleInPlace(q);
      for (var i = 0; i < q.length - 1; i++) {
        if (q[i].front === q[i + 1].back && q[i].back === q[i + 1].front) {
          adjacentPairs++;
        }
      }
    }
    // En moyenne, une paire réciproque adjacente par tirage (10 paires, P ~ 2/20 par paire).
    // Avec un ordre fixe, on aurait 10 adjacences par tirage : on exige nettement moins.
    var avg = adjacentPairs / trials;
    assert.ok(avg < 5, "trop de paires réciproques adjacentes en moyenne : " + avg);
  });
});

function memStorageGlobal() {
  var data = {};
  return {
    getItem: function (k) { return k in data ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
    removeItem: function (k) { delete data[k]; }
  };
}

describe("MathRender (segments LaTeX)", function () {
  it("texte sans math reste un seul segment texte", function () {
    var segs = MathRender.findSegments("Dérivée de la fonction carrée");
    assert.strictEqual(segs.length, 1);
    assert.strictEqual(segs[0].type, "text");
    assert.strictEqual(segs[0].value, "Dérivée de la fonction carrée");
  });

  it("découpe texte + $math$ inline", function () {
    var segs = MathRender.findSegments("Dérivée de $f(x) = e^{x}$ avec $a$ réel");
    assert.strictEqual(segs.length, 5);
    assert.strictEqual(segs[0].type, "text");
    assert.strictEqual(segs[0].value, "Dérivée de ");
    assert.strictEqual(segs[1].type, "math");
    assert.strictEqual(segs[1].value, "f(x) = e^{x}");
    assert.strictEqual(segs[1].display, false);
    assert.strictEqual(segs[2].type, "text");
    assert.strictEqual(segs[2].value, " avec ");
    assert.strictEqual(segs[3].type, "math");
    assert.strictEqual(segs[3].value, "a");
    assert.strictEqual(segs[4].type, "text");
    assert.strictEqual(segs[4].value, " réel");
  });

  it("gère $$...$$ en mode display et \\(...\\)", function () {
    var segs = MathRender.findSegments("Formule : $$x^{2}$$ et \\(y\\)");
    assert.strictEqual(segs.length, 4);
    assert.strictEqual(segs[1].type, "math");
    assert.strictEqual(segs[1].display, true);
    assert.strictEqual(segs[1].value, "x^{2}");
    assert.strictEqual(segs[3].type, "math");
    assert.strictEqual(segs[3].display, false);
    assert.strictEqual(segs[3].value, "y");
  });

  it("délimiteur non fermé : reste du texte", function () {
    var segs = MathRender.findSegments("un $ non fermé et la suite");
    assert.strictEqual(segs.length, 1);
    assert.strictEqual(segs[0].type, "text");
    assert.strictEqual(segs[0].value, "un $ non fermé et la suite");
  });

  it("ignore les $$ vides", function () {
    var segs = MathRender.findSegments("a $$ b");
    assert.strictEqual(segs.length, 1);
    assert.strictEqual(segs[0].type, "text");
    assert.strictEqual(segs[0].value, "a $$ b");
  });

  it("hasMath détecte les formules", function () {
    assert.ok(MathRender.hasMath("$e^{x}$"));
    assert.ok(!MathRender.hasMath("e^x texte brut"));
    assert.ok(!MathRender.hasMath("texte simple"));
  });

  it("renderMath sans KaTeX chargé signale l'erreur sans planter", function () {
    var res = MathRender.renderMath("x^{2}", false);
    assert.ok(res.error);
  });

  it("import du jeu d'exemple dérivées (format export)", function () {
    var raw = fs.readFileSync(path.join(__dirname, "..", "exemple-jeu-derivees.json"), "utf8");
    var s = new Store(memStorageGlobal());
    var n = s.importJSON(raw);
    assert.strictEqual(n, 1);
    var deck = s.decks[0];
    assert.strictEqual(deck.cards.length, 15);
    assert.ok(MathRender.hasMath(deck.cards[0].front));
  });
});

describe("Partage de jeux individuels", function () {
  var deck1;

  beforeEach(function () {
    deck1 = new Deck({ name: "Cuisine EN" });
    deck1.addCard("knife", "couteau");
    var c = deck1.addCard("oven", "four");
    c.markCorrect([1, 2, 4, 7, 15]);
    c.wrongCount = 2;
  });

  it("exportDeckShare produit un JSON sans boîtes ni statistiques", function () {
    var s = new Store(memStorageGlobal());
    s.decks = [deck1];
    var raw = s.exportDeckShare(deck1.id);
    assert.ok(raw, "export non vide");
    var data = JSON.parse(raw);
    assert.strictEqual(data.format, "leitner-deck-share");
    assert.strictEqual(data.version, 1);
    assert.strictEqual(data.name, "Cuisine EN");
    assert.strictEqual(data.cards.length, 2);
    data.cards.forEach(function (c) {
      assert.deepStrictEqual(Object.keys(c).sort(), ["back", "front"]);
    });
  });

  it("exportDeckShare sur un id inconnu renvoie null", function () {
    var s = new Store(memStorageGlobal());
    s.decks = [deck1];
    assert.strictEqual(s.exportDeckShare("inconnu"), null);
  });

  it("importDeckShare ajoute le jeu sans toucher aux autres paquets", function () {
    var s = new Store(memStorageGlobal());
    s.decks = [deck1];
    var shared = JSON.stringify({
      format: "leitner-deck-share",
      version: 1,
      name: "Départements",
      cards: [{ front: "07", back: "Ardèche" }, { front: "69", back: "Rhône" }]
    });
    var deck = s.importDeckShare(shared);
    assert.strictEqual(s.decks.length, 2);
    assert.strictEqual(deck.cards.length, 2);
    assert.strictEqual(deck.cards[0].front, "07");
    assert.strictEqual(deck.cards[0].box, 1);
    assert.ok(deck.cards[0].dueDate, "échéance initialisée");
    assert.strictEqual(deck1.cards.length, 2, "le paquet existant est intact");
  });

  it("importDeckShare filtre les cartes invalides et renomme en cas de doublon", function () {
    var s = new Store(memStorageGlobal());
    s.decks = [deck1];
    var shared = JSON.stringify({
      name: "Cuisine EN",
      cards: [
        { front: "a", back: "b" },
        { front: "", back: "x" },
        { front: "y" },
        null
      ]
    });
    var deck = s.importDeckShare(shared);
    assert.strictEqual(deck.cards.length, 1);
    assert.strictEqual(deck.name, "Cuisine EN (2)");
  });

  it("importDeckShare rejette un jeu sans carte valide", function () {
    var s = new Store(memStorageGlobal());
    assert.throws(function () {
      s.importDeckShare('{"name":"vide","cards":[]}');
    }, /Aucune carte valide/);
  });

  it("les jeux du catalogue decks/ sont au format share et valides", function () {
    var s = new Store(memStorageGlobal());
    var cat = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "decks", "catalog.json"), "utf8"));
    assert.ok(cat.decks.length >= 3);
    cat.decks.forEach(function (entry) {
      var raw = fs.readFileSync(path.join(__dirname, "..", "decks", entry.file), "utf8");
      var deck = s.importDeckShare(raw);
      assert.strictEqual(deck.name, entry.name);
      assert.strictEqual(deck.cards.length, entry.cardCount);
    });
  });
});

describe("CardMedia (cartes image)", function () {
  it("isImageField détecte le préfixe img:", function () {
    assert.ok(CardMedia.isImageField("img:images/a/b.jpg"));
    assert.ok(CardMedia.isImageField("img:data:image/png;base64,AAAA"));
    assert.ok(!CardMedia.isImageField("images/a/b.jpg"));
    assert.ok(!CardMedia.isImageField("Recto textuel"));
  });

  it("allowedSrc accepte les chemins images/, data:image et https", function () {
    assert.strictEqual(CardMedia.allowedSrc("img:images/animaux/renard.jpg"), "images/animaux/renard.jpg");
    assert.strictEqual(CardMedia.allowedSrc("img:images/a b.jpg"), null, "pas d'espace");
    assert.strictEqual(
      CardMedia.allowedSrc("img:data:image/png;base64,iVBORw0KGgo="),
      "data:image/png;base64,iVBORw0KGgo="
    );
    assert.strictEqual(CardMedia.allowedSrc("img:https://example.com/a.png"), "https://example.com/a.png");
  });

  it("allowedSrc rejette javascript:, http:, ../ et les data URLs invalides", function () {
    assert.strictEqual(CardMedia.allowedSrc("img:javascript:alert(1)"), null);
    assert.strictEqual(CardMedia.allowedSrc("img:http://insecure.com/a.png"), null);
    assert.strictEqual(CardMedia.allowedSrc("img:../secrets.txt"), null);
    assert.strictEqual(CardMedia.allowedSrc("img:/etc/passwd"), null);
    assert.strictEqual(CardMedia.allowedSrc("img:data:text/html;base64,PGI+"), null);
    assert.strictEqual(CardMedia.allowedSrc("img:"), null);
  });

  it("data URLs trop volumineuses sont refusées (> ~500 Ko)", function () {
    var big = "data:image/png;base64," + new Array(700001).join("A");
    assert.strictEqual(CardMedia.allowedSrc("img:" + big), null);
  });

  it("légende sur la deuxième ligne du champ", function () {
    var field = CardMedia.toImageField("images/a.svg", "Quelle est cette forme ?");
    assert.strictEqual(field, "img:images/a.svg\nQuelle est cette forme ?");
    assert.strictEqual(CardMedia.imageCaption(field), "Quelle est cette forme ?");
    assert.strictEqual(CardMedia.imageSrc(field), "images/a.svg");
    assert.strictEqual(CardMedia.imageSrc("img:images/a.svg"), "images/a.svg");
    assert.strictEqual(CardMedia.imageCaption("img:images/a.svg"), "");
  });

  it("toImageField sans légende n'ajoute pas de ligne", function () {
    assert.strictEqual(CardMedia.toImageField("images/a.svg"), "img:images/a.svg");
  });

  it("les fronts du jeu formes-geometriques sont des images valides", function () {
    var raw = fs.readFileSync(path.join(__dirname, "..", "decks", "formes-geometriques.json"), "utf8");
    var deck = JSON.parse(raw);
    assert.strictEqual(deck.cards.length, 10);
    deck.cards.forEach(function (c) {
      assert.ok(CardMedia.isImageField(c.front), "front doit être img:");
      assert.ok(CardMedia.imageSrc(c.front), "src doit être autorisée: " + c.front);
    });
  });
});

describe("IndexedDB (imageStore)", function () {
  function fakeFile(size, type) {
    return { size: size, type: type };
  }

  it("put/get/remove fonctionnent via un mock IndexedDB", function () {
    var saved = {};
    var fakeIndexedDB = {
      open: function (name, version) {
        var store = {
          get: function (id) { return req(saved[id] || null); },
          put: function (rec) { saved[rec.id] = rec; return req(rec.id); },
          delete: function (id) { delete saved[id]; return req(true); },
          getAllKeys: function () { return req(Object.keys(saved)); }
        };
        function req(result) {
          var r = { result: undefined, onsuccess: null, onerror: null };
          r._fire = function () {
            r.result = result;
            r.onsuccess && r.onsuccess({ target: r });
          };
          return r;
        }
        // On simule les réponses asynchrones immédiatement
        var origGet = store.get, origPut = store.put, origDel = store.delete, origKeys = store.getAllKeys;
        store.get = function (id) { var r = origGet(id); setTimeout(function () { r._fire(); }, 0); return r; };
        store.put = function (rec) { var r = origPut(rec); setTimeout(function () { r._fire(); }, 0); return r; };
        store.delete = function (id) { var r = origDel(id); setTimeout(function () { r._fire(); }, 0); return r; };
        store.getAllKeys = function () { var r = origKeys(); setTimeout(function () { r._fire(); }, 0); return r; };
        var db = {
          objectStoreNames: { contains: function () { return true; } },
          transaction: function () {
            return { objectStore: function () { return store; } };
          }
        };
        var openReq = {
          onsuccess: null, onerror: null, onupgradeneeded: null
        };
        setTimeout(function () {
          openReq.onsuccess && openReq.onsuccess({ target: { result: db } });
        }, 0);
        return openReq;
      }
    };
    ctx.indexedDB = fakeIndexedDB;
    ImageStoreMod._resetForTests();

    return ImageStoreMod.put("img-1", fakeFile(1024, "image/png"))
      .then(function (id) {
        assert.strictEqual(id, "img-1");
        return ImageStoreMod.get("img-1");
      })
      .then(function (blob) {
        assert.ok(blob, "blob retrouvé");
        assert.strictEqual(blob.size, 1024);
        return ImageStoreMod.list();
      })
      .then(function (keys) {
        assert.ok(keys.indexOf("img-1") !== -1);
        return ImageStoreMod.remove("img-1");
      })
      .then(function () {
        return ImageStoreMod.get("img-1");
      })
      .then(function (blob) {
        assert.strictEqual(blob, null, "blob supprimé");
        delete ctx.indexedDB;
      });
  });

  it("refuse les blobs trop volumineux (> 2 Mo)", function () {
    return ImageStoreMod.put("big", fakeFile(3 * 1024 * 1024, "image/png"))
      .then(function () { throw new Error("devrait refuser"); })
      .catch(function (e) {
        assert.ok(/volumineuse/.test(e.message), e.message);
      });
  });

  it("refuse les entrées invalides (id manquant, pseudo-blob)", function () {
    return ImageStoreMod.put("", fakeFile(10, "image/png"))
      .then(function () { throw new Error("devrait refuser"); }, function (e) {
        assert.ok(/id requis/.test(e.message));
        return ImageStoreMod.put("x", { pas: "un blob" });
      })
      .then(function () { throw new Error("devrait refuser 2"); }, function (e) {
        assert.ok(/blob invalide/.test(e.message));
      });
  });

  it("CardMedia.idbId valide les identifiants idb:", function () {
    assert.strictEqual(CardMedia.idbId("idb:img-abc123"), "img-abc123");
    assert.strictEqual(CardMedia.idbId("idb:img-abc123\nLégende"), "img-abc123");
    assert.strictEqual(CardMedia.idbId("idb:"), null);
    assert.strictEqual(CardMedia.idbId("idb:avec espace"), null);
    assert.strictEqual(CardMedia.idbId("idb:../evil"), null);
    assert.strictEqual(CardMedia.idbId("img:images/a.svg"), null);
    assert.ok(CardMedia.isImageField("idb:img-abc123"));
    assert.ok(!CardMedia.isImageField("idb:"));
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
