(function (global) {
  "use strict";
  var m = global.m;

  var store = new global.Store(global.localStorage);
  global.AppStore = store;
  var settings = new global.Settings(global.localStorage);
  global.AppSettings = settings;

  var root = document.getElementById("app");
  m.route(root, "/cards", {
    "/decks": {
      render: function () { return m(global.Layout, { store: store }, m(global.Decks, { store: store })); }
    },
    "/ai": {
      render: function () { return m(global.Layout, { store: store }, m(global.AIStudio, { store: store, settings: settings })); }
    },
    "/cards": {
      render: function () { return m(global.Layout, { store: store }, m(global.CardList, { store: store })); }
    },
    "/review": {
      render: function () { return m(global.Layout, { store: store }, m(global.Review, { store: store })); }
    },
    "/stats": {
      render: function () { return m(global.Layout, { store: store }, m(global.Stats, { store: store })); }
    }
  });
})(window);
