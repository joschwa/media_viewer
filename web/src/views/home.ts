import type { SessionInfo } from "@media_viewer/shared";
import { api } from "../api/client.js";
import { renderAdmin } from "./admin.js";

type LoggedInSession = Extract<SessionInfo, { loggedIn: true }>;

export function renderHome(container: HTMLElement, session: LoggedInSession, rerender: () => void): void {
  const wrap = document.createElement("div");
  wrap.className = "home";
  wrap.innerHTML = `
    <p>Logged in as <strong>${session.username}</strong> (${session.role})</p>
    <p><em>The slideshow view arrives in Milestone 3.</em></p>
    <button data-action="logout">Log out</button>
    ${session.role === "admin" ? `<button data-action="admin">Admin panel</button>` : ""}
  `;

  wrap.querySelector('[data-action="logout"]')?.addEventListener("click", async () => {
    await api.logout();
    rerender();
  });

  wrap.querySelector('[data-action="admin"]')?.addEventListener("click", () => {
    container.innerHTML = "";
    void renderAdmin(container, rerender);
  });

  container.appendChild(wrap);
}
