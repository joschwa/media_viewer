import type { SessionInfo } from "@media_viewer/shared";
import { api, mediaUrl } from "../api/client.js";
import { renderAdmin } from "./admin.js";

type LoggedInSession = Extract<SessionInfo, { loggedIn: true }>;

export async function renderSlideshow(
  container: HTMLElement,
  session: LoggedInSession,
  rerender: () => void,
): Promise<void> {
  const wrap = document.createElement("div");
  wrap.className = "slideshow";
  wrap.innerHTML = `
    <div class="top-bar">
      <span>${session.username} (${session.role})</span>
      <span>
        ${session.role === "admin" ? '<button data-action="admin">Admin</button>' : ""}
        <button data-action="logout">Log out</button>
      </span>
    </div>
    <div class="media-frame"></div>
    <div class="nav-buttons">
      <button data-action="prev">&larr; Back</button>
      <span class="counter"></span>
      <button data-action="next">Next &rarr;</button>
    </div>
  `;
  container.appendChild(wrap);

  wrap.querySelector('[data-action="logout"]')?.addEventListener("click", async () => {
    await api.logout();
    rerender();
  });
  wrap.querySelector('[data-action="admin"]')?.addEventListener("click", () => {
    container.innerHTML = "";
    void renderAdmin(container, rerender);
  });

  const frameEl = wrap.querySelector<HTMLDivElement>(".media-frame")!;
  const counterEl = wrap.querySelector<HTMLSpanElement>(".counter")!;
  const prevBtn = wrap.querySelector<HTMLButtonElement>('[data-action="prev"]')!;
  const nextBtn = wrap.querySelector<HTMLButtonElement>('[data-action="next"]')!;

  const items = await api.listMedia();
  let index = 0;

  function renderCurrent() {
    frameEl.innerHTML = "";

    if (items.length === 0) {
      frameEl.innerHTML = '<p class="empty-state">No media to show yet.</p>';
      counterEl.textContent = "";
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }

    prevBtn.disabled = false;
    nextBtn.disabled = false;

    const item = items[index];
    if (item.mediaType === "image") {
      const img = document.createElement("img");
      img.src = mediaUrl(item.id, "preview");
      img.alt = item.originalFilename;
      frameEl.appendChild(img);
    } else {
      const video = document.createElement("video");
      video.src = mediaUrl(item.id, "preview");
      video.controls = true;
      frameEl.appendChild(video);
    }
    counterEl.textContent = `${index + 1} / ${items.length}`;
  }

  prevBtn.addEventListener("click", () => {
    index = (index - 1 + items.length) % items.length;
    renderCurrent();
  });
  nextBtn.addEventListener("click", () => {
    index = (index + 1) % items.length;
    renderCurrent();
  });

  renderCurrent();
}
