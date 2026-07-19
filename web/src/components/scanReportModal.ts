import { api, ApiError } from "../api/client.js";

function renderErrorList(errors: { file: string; reason: string }[]): HTMLUListElement {
  const ul = document.createElement("ul");
  ul.className = "scan-errors";
  for (const err of errors) {
    const li = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = err.file;
    li.appendChild(strong);
    li.appendChild(document.createTextNode(`: ${err.reason}`));
    ul.appendChild(li);
  }
  return ul;
}

export function openScanReportModal(onClose: () => void): void {
  const backdrop = document.createElement("div");
  backdrop.className = "settings-backdrop";
  backdrop.innerHTML = `
    <div class="settings-modal">
      <h2>Scan incoming folder</h2>
      <p class="scan-status">Scanning&hellip;</p>
      <div class="scan-report" hidden></div>
      <div class="settings-actions">
        <span></span>
        <button type="button" data-action="close">Close</button>
      </div>
    </div>
  `;

  const statusEl = backdrop.querySelector<HTMLParagraphElement>(".scan-status")!;
  const reportEl = backdrop.querySelector<HTMLDivElement>(".scan-report")!;

  function close() {
    backdrop.remove();
    document.removeEventListener("keydown", onKeydown);
    onClose();
  }
  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector('[data-action="close"]')?.addEventListener("click", close);
  document.addEventListener("keydown", onKeydown);

  document.body.appendChild(backdrop);

  void api
    .triggerScan()
    .then((result) => {
      statusEl.hidden = true;
      reportEl.hidden = false;

      const summary = document.createElement("ul");
      summary.className = "scan-summary";
      summary.innerHTML = `
        <li>Scanned: ${result.scanned}</li>
        <li>Imported: ${result.imported}</li>
        <li>Duplicates: ${result.duplicates}</li>
        <li>Quarantined: ${result.quarantined}</li>
      `;
      reportEl.appendChild(summary);

      if (result.errors.length > 0) {
        reportEl.appendChild(renderErrorList(result.errors));
      }
    })
    .catch((err) => {
      statusEl.textContent = err instanceof ApiError ? err.message : "Scan failed.";
    });
}
