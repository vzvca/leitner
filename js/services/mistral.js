(function (global) {
  "use strict";

  var API_URL = "https://api.mistral.ai/v1/chat/completions";
  var DEFAULT_MODEL = "mistral-small-latest";
  var CARD_SIZES = [10, 20, 50, 100, 200];

  var SYSTEM_GENERATE = [
    "Tu es un assistant qui crée des jeux de cartes de mémorisation (flashcards).",
    "L'utilisateur décrit un sujet. Tu génères des cartes avec un recto (question/prompt) et un verso (réponse).",
    "Règles :",
    "- Les cartes doivent couvrir le sujet de façon exhaustive et sans doublons.",
    "- Si le sujet a une taille naturelle (ex. les 101 départements français, les 26 lettres de l'alphabet),",
    "  génère TOUTES les cartes correspondantes, même si cela diffère du nombre demandé ; explique alors ce choix.",
    "- Si aucun nombre n'est demandé, choisis un nombre pertinent pour le sujet (entre 10 et 50).",
    "Répond UNIQUEMENT avec un objet JSON valide, sans balises markdown, au format :",
    '{"name": "nom du jeu", "description": "courte description", "cards": [{"front": "...", "back": "..."}]}'
  ].join("\n");

  var SYSTEM_REVISE = [
    "Tu es un assistant qui révise des jeux de cartes de mémorisation (flashcards).",
    "L'utilisateur fournit le jeu existant (cartes front/back) et une consigne de révision.",
    "La consigne peut demander de supprimer des cartes, de remplacer des cartes, d'en ajouter,",
    "de corriger des erreurs, de simplifier, etc. Applique la consigne à l'ensemble du jeu.",
    "- Conserve la mise en forme minimale (texte simple).",
    "- Répond UNIQUEMENT avec un objet JSON valide, sans balises markdown, au format :",
    '{"cards": [{"front": "...", "back": "..."}]}',
    "Renvoie la liste COMPLÈTE des cartes du jeu révisé (celles conservées + les nouvelles), pas seulement les changements."
  ].join("\n");

  function MistralClient(apiKey, model) {
    this.apiKey = apiKey;
    this.model = model || DEFAULT_MODEL;
  }

  MistralClient.prototype.chat = function (messages, options) {
    options = options || {};
    var body = {
      model: this.model,
      messages: messages,
      temperature: typeof options.temperature === "number" ? options.temperature : 0.4,
      response_format: options.jsonMode === false ? undefined : { type: "json_object" }
    };
    if (body.response_format === undefined) delete body.response_format;
    return fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + this.apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error("API Mistral " + res.status + " : " + t.slice(0, 300));
        });
      }
      return res.json();
    }).then(function (data) {
      var content = data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : null;
      if (!content) throw new Error("Réponse vide de l'API Mistral");
      return content;
    });
  };

  function parseJSONLoose(text) {
    var t = String(text).trim();
    var fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fence) t = fence[1];
    var start = t.indexOf("{");
    var end = t.lastIndexOf("}");
    if (start > 0 || end < t.length - 1) {
      if (start !== -1 && end !== -1 && end > start) t = t.slice(start, end + 1);
    }
    return JSON.parse(t);
  }

  function extractCards(data) {
    if (!data || !Array.isArray(data.cards)) return [];
    return data.cards.filter(function (c) {
      return c && typeof c.front === "string" && typeof c.back === "string";
    }).map(function (c) {
      return { front: c.front.trim(), back: c.back.trim() };
    }).filter(function (c) {
      return c.front && c.back;
    });
  }

  MistralClient.prototype.generateDeck = function (topic, size) {
    var self = this;
    var userMsg = "Sujet du jeu de cartes : " + topic;
    if (size) userMsg += "\nNombre de cartes souhaité : environ " + size;

    function attempt(remaining) {
      return self.chat([
        { role: "system", content: SYSTEM_GENERATE },
        { role: "user", content: userMsg }
      ]).then(function (content) {
        return parseJSONLoose(content);
      }).then(function (data) {
        var cards = extractCards(data);
        if (cards.length === 0) throw new Error("Aucune carte valide dans la réponse");
        data.cards = cards;
        return data;
      }).catch(function (err) {
        if (remaining > 0 && /JSON/.test(err.message)) return attempt(remaining - 1);
        throw err;
      });
    }
    return attempt(2);
  };

  MistralClient.prototype.reviseDeck = function (deck, instruction) {
    var self = this;
    var payload = {
      name: deck.name,
      description: deck.description,
      instruction: instruction,
      cards: deck.cards.map(function (c) { return { front: c.front, back: c.back }; })
    };
    return self.chat([
      { role: "system", content: SYSTEM_REVISE },
      { role: "user", content: JSON.stringify(payload) }
    ]).then(function (content) {
      var data = parseJSONLoose(content);
      var cards = extractCards(data);
      if (cards.length === 0) throw new Error("Aucune carte valide dans la réponse");
      return cards;
    });
  };

  MistralClient.CARD_SIZES = CARD_SIZES;
  MistralClient.DEFAULT_MODEL = DEFAULT_MODEL;
  MistralClient.parseJSONLoose = parseJSONLoose;
  MistralClient.extractCards = extractCards;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = MistralClient;
  } else {
    global.MistralClient = MistralClient;
  }
})(typeof window !== "undefined" ? window : globalThis);
