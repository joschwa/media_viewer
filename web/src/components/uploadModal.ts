import { api, ApiError } from "../api/client.js";

export function openUploadModal(onClose: () => void): void {
  const backdrop = document.createElement("div");
  backdrop.className = "settings-backdrop";
  backdrop.innerHTML = `
    <div class="settings-modal">
      <h2>Upload media</h2>
      <p>Uploaded items are private to you until you publish them.</p>
      <form class="upload-form">
        <input type="file" name="files" multiple accept="image/*,video/*" />
        <button type="submit">Upload</button>
      </form>
      <p class="upload-status" hidden></p>
      <ul class="upload-results"></ul>
      <div class="settings-actions">
        <span></span>
        <button type="button" data-action="close">Close</button>
      </div>
    </div>
  `;

  const form = backdrop.querySelector<HTMLFormElement>(".upload-form")!;
  const fileInput = backdrop.querySelector<HTMLInputElement>('[name="files"]')!;
  const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const statusEl = backdrop.querySelector<HTMLParagraphElement>(".upload-status")!;
  const resultsEl = backdrop.querySelector<HTMLUListElement>(".upload-results")!;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const files = Array.from(fileInput.files ?? []);
    if (files.length === 0) return;

    submitBtn.disabled = true;
    statusEl.hidden = false;
    statusEl.textContent = `Uploading ${files.length} file${files.length === 1 ? "" : "s"}…`;
    resultsEl.innerHTML = "";

    try {
      const { results } = await api.uploadMedia(files);
      statusEl.textContent = "Done.";
      for (const result of results) {
        const li = document.createElement("li");
        const nameEl = document.createElement("strong");
        nameEl.textContent = result.filename;
        li.appendChild(nameEl);
        li.appendChild(document.createTextNode(`: ${result.status}${result.reason ? ` (${result.reason})` : ""}`));
        resultsEl.appendChild(li);
      }
      form.reset();
    } catch (err) {
      statusEl.textContent = err instanceof ApiError ? err.message : "Upload failed.";
    } finally {
      submitBtn.disabled = false;
    }
  });

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
}
