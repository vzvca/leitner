(function (global) {
  "use strict";

  var BOX_COUNT = 5;
  var BOX_INTERVALS_DAYS = [1, 2, 4, 7, 15];

  var constants = {
    BOX_COUNT: BOX_COUNT,
    BOX_INTERVALS_DAYS: BOX_INTERVALS_DAYS,
    STORAGE_KEY: "leitner.decks.v1"
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = constants;
  } else {
    global.LeitnerConstants = constants;
  }
})(typeof window !== "undefined" ? window : globalThis);
