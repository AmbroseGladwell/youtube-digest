// Runs before first paint, when the settings store cannot have answered yet. Mirrors
// applyAppearance.ts, and is the same file in both shells (docs/features/appearance.md, "No flash").
(function () {
  var THEMES = ["light", "dark"];
  var ACCENTS = ["orange", "gold", "lime", "emerald", "teal", "sky", "violet", "raspberry"];
  var saved = {};
  try {
    saved = JSON.parse(localStorage.getItem("overview.appearance.v1")) || {};
  } catch (error) {
    saved = {};
  }
  var root = document.documentElement;
  if (THEMES.indexOf(saved.theme) !== -1) root.setAttribute("data-theme", saved.theme);
  if (saved.accentColour !== "orange" && ACCENTS.indexOf(saved.accentColour) !== -1) {
    root.setAttribute("data-accent", saved.accentColour);
    var links = document.querySelectorAll("link[data-accent-href]");
    for (var i = 0; i < links.length; i += 1) {
      links[i].setAttribute("href", links[i].getAttribute("data-accent-href").replace("{accent}", saved.accentColour));
    }
  }
})();
