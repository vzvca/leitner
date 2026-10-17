(function (global) {
  "use strict";

  var Deck = typeof require === "function" ? require("../models/Deck.js") : global.Deck;
  var ImageStore = typeof require === "function" ? require("./imageStore.js") : global.ImageStore;
  var CardMediaModule = typeof require === "function" ? require("./cardMedia.js") : null;
  function getCardMedia() {
    return CardMediaModule || global.CardMedia;
  }
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

  Store.prototype.exportDeckShare = function (deckId, options) {
    var deck = this.decks.find(function (d) { return d.id === deckId; });
    if (!deck) return Promise.resolve(null);
    options = options || {};

    var idRefs = {};
    deck.cards.forEach(function (c) {
      var id = getCardMedia().isImageField(c.front) ? getCardMedia().idbId(c.front) : null;
      if (id) idRefs[id] = true;
    });
    var ids = Object.keys(idRefs);

    var exportImages = options.embedIdbImages !== false && typeof ImageStore !== "undefined" && ids.length > 0;

    var imagesPromise = exportImages
      ? Promise.all(ids.map(function (id) {
          return ImageStore.get(id).then(function (blob) {
            if (!blob) return null;
            return blobToDataUrl(blob).then(function (dataUrl) {
              return { id: id, data: dataUrl };
            });
          }).catch(function () { return null; });
        }))
      : Promise.resolve([]);

    return imagesPromise.then(function (results) {
      var images = {};
      var embedded = results.filter(Boolean);
      embedded.forEach(function (img) { images[img.id] = img.data; });

      return JSON.stringify(
        {
          format: "leitner-deck-share",
          version: 2,
          name: deck.name,
          description: deck.description,
          cards: deck.cards.map(function (c) {
            return { front: c.front, back: c.back };
          }),
          images: Object.keys(images).length > 0 ? images : undefined
        },
        null,
        2
      );
    });
  };

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      if (typeof FileReader !== "undefined") {
        var reader = new FileReader();
        reader.onload = function () { resolve(String(reader.result)); };
        reader.onerror = function () { reject(reader.error || new Error("lecture blob impossible")); };
        reader.readAsDataURL(blob);
      } else {
        reject(new Error("FileReader indisponible"));
      }
    });
  }

  Store.prototype.importDeckShare = function (raw) {
    var self = this;
    var data = typeof raw === "string" ? JSON.parse(raw) : raw;
    var cards = data && Array.isArray(data.cards) ? data.cards : [];
    var valid = cards.filter(function (c) {
      return c && typeof c.front === "string" && typeof c.back === "string" &&
        c.front.trim() && c.back.trim();
    }).map(function (c) {
      return { front: c.front.trim(), back: c.back.trim() };
    });
    if (valid.length === 0) {
      return Promise.reject(new Error("Aucune carte valide dans le jeu importé"));
    }

    var name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Jeu importé";
    var images = data && data.images && typeof data.images === "object" ? data.images : null;
    var hasIdb = valid.some(function (c) {
      return getCardMedia().isImageField(c.front) && getCardMedia().idbId(c.front) !== null;
    });

    if (!images || !hasIdb || typeof ImageStore === "undefined") {
      // Pas d'images embarquées : importer tel quel (les cartes idb: garderont leur référence)
      var deck = self._buildImportedDeck(valid, name, data);
      return Promise.resolve(deck);
    }

    // Images embarquées : restaurer chaque blob sous un NOUVEL uuid (évite les conflits)
    var idMap = {};
    var restorePromises = [];
    Object.keys(images).forEach(function (oldId) {
      var dataUrl = images[oldId];
      if (typeof dataUrl !== "string" || dataUrl.indexOf("data:image/") !== 0) return;
      var blob = dataUrlToBlob(dataUrl);
      if (!blob) return;
      var newId = ImageStore.uuid();
      idMap[oldId] = newId;
      restorePromises.push(ImageStore.put(newId, blob));
    });

    return Promise.all(restorePromises).then(function () {
      var remapped = valid.map(function (c) {
        var id = getCardMedia().isImageField(c.front) ? getCardMedia().idbId(c.front) : null;
        if (!id || !idMap[id]) return c;
        var nl = c.front.indexOf("\n");
        var caption = nl === -1 ? "" : c.front.slice(nl + 1);
        return {
          front: "idb:" + idMap[id] + (caption ? "\n" + caption : ""),
          back: c.back
        };
      });
      return self._buildImportedDeck(remapped, name, data);
    });
  };

  Store.prototype._buildImportedDeck = function (cards, name, data) {
    var deck = new Deck({ name: name, description: typeof data.description === "string" ? data.description : "" });
    cards.forEach(function (c) {
      deck.addCard(c.front, c.back);
    });
    var existing = this.decks.filter(function (d) { return d.name === deck.name; }).length;
    if (existing > 0) deck.name = deck.name + " (2)";
    this.decks.push(deck);
    this.activeDeckId = deck.id;
    this.save();
    return deck;
  };

  function dataUrlToBlob(dataUrl) {
    if (typeof atob === "undefined" || typeof Uint8Array === "undefined") return null;
    try {
      var match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
      if (!match) return null;
      var mime = match[1];
      var bin = atob(match[2]);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    } catch (e) {
      return null;
    }
  }

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
