# leitner

Application web (SPA) de mémorisation par les **boîtes de Leitner** — idéale pour du vocabulaire en langue étrangère, des formules mathématiques, etc.

## Fonctionnement

Les cartes sont réparties dans **5 boîtes** aux intervalles de révision croissants :

| Boîte | 1 | 2 | 3 | 4 | 5 |
|-------|---|---|---|---|---|
| Révision | quotidienne | tous les 2 j | tous les 4 j | tous les 7 j | tous les 15 j |

- Une nouvelle carte entre en **boîte 1** et est due immédiatement.
- Bonne réponse → la carte monte d'une boîte (échéance = intervalle de la nouvelle boîte).
- Mauvaise réponse → retour en **boîte 1**.
- Une carte en boîte 5 est considérée comme acquise.

## Technique

- **HTML / CSS / JavaScript** vanilla, aucune étape de build.
- [Mithril.js v2](https://mithril.js.org) servi localement (`vendor/mithril.min.js`).
- Persistance **localStorage** (aucun backend requis).
- **Jeux de cartes multiples** (ex. « Anglais — cuisine », « Anglais — voyage », « Dates historiques ») : création, renommage, suppression, sélection du jeu actif (sélecteur dans l'en-tête + page « Jeux »).
- Import / export JSON des paquets.

## Structure

```
index.html            point d'entrée
css/app.css           styles
vendor/mithril.min.js librairie Mithril
js/models/            Card, Deck, constantes (logique métier pure, testable sous Node)
js/services/store.js  persistance localStorage + import/export
js/views/             composants Mithril (Layout, Decks, CardList, Review, Stats)
js/app.js             bootstrap + routage
test/logic.test.js    tests unitaires (node:test)
```

## Lancer l'application

Aucun build nécessaire. Servez simplement le répertoire, par exemple :

```bash
npx serve .
# ou
python3 -m http.server 8000
```

Puis ouvrez `http://localhost:8000`.

> Ouvrir `index.html` directement en `file://` peut ne pas suffire selon le navigateur ; un petit serveur statique est recommandé.

## Tests

```bash
node --test test/
```
