(function () {
  function highlightGeon(code) {
    // Order matters: comments → strings → keywords → numbers

    // Comments
    code = code.replace(/#.*$/gm, '<span class="g-comment">$&</span>');

    // Strings
    code = code.replace(/"([^"]*)"/g, '<span class="g-string">"$1"</span>');

    // Keywords
    code = code.replace(
      /\b(scene|grid|point|segment|circle|polygon|label|from|to|center|r|points|stroke|fill|width|color|size|x|y|step)\b/g,
      '<span class="g-keyword">$1</span>'
    );

    // Numbers
    code = code.replace(/\b-?\d+(\.\d+)?\b/g, '<span class="g-number">$&</span>');

    return code;
  }

  function setupGeonEditor(textarea, highlightDiv) {
    function sync() {
      const code = textarea.value;
      highlightDiv.innerHTML = highlightGeon(code) + "\n";
    }

    textarea.addEventListener("input", sync);

    textarea.addEventListener("scroll", () => {
      highlightDiv.scrollTop = textarea.scrollTop;
      highlightDiv.scrollLeft = textarea.scrollLeft;
    });

    // initial render
    sync();
  }

  window.GeonHighlight = {
    setupGeonEditor
  };
})();