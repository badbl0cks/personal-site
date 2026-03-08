function htmz(frame) {
  if (frame.contentWindow.location.href === "about:blank") return;
  setTimeout(() => {
    document
      .querySelector(frame.contentWindow.location.hash || null)
      ?.replaceWith(...frame.contentDocument.body.childNodes);
    frame.contentWindow.location.replace("about:blank");
    frame.remove();
    document.body.appendChild(frame);
  });
}
