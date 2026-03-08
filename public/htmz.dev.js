function htmz(frame) {
  // -------------------------------->1------------------------------------
  // No history
  // ----------------------------------------------------------------------
  // This clears the iframe's history from the global history
  // by removing the iframe from the DOM (but immediately adding it back
  // for subsequent requests).
  // ---------------------------------1<-----------------------------------
  // -------------------------------->2-----------------------------------
  // Repeat GETs
  // ----------------------------------------------------------------------
  // This clears the iframe URL for a fresh start on next load.
  // ---------------------------------2<-----------------------------------
  // ------------------------------->1&2-----------------------------------
  if (frame.contentWindow.location.href === "about:blank") return;
  // --------------------------------1&2<----------------------------------
  setTimeout(() => {
    document
      .querySelector(frame.contentWindow.location.hash || null)
      ?.replaceWith(...frame.contentDocument.body.childNodes);
    // ---------------------------------2<-----------------------------------
    frame.contentWindow.location.replace("about:blank");
    // -------------------------------->2------------------------------------
    // ---------------------------------1<-----------------------------------
    frame.remove();
    document.body.appendChild(frame);
    // -------------------------------->1------------------------------------
  });
}
