(function (global) {
  "use strict";

  function shuffleInPlace(arr, random) {
    var rng = random || Math.random;
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      if (j > i) j = i;
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  var api = { shuffleInPlace: shuffleInPlace };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.LeitnerShuffle = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
