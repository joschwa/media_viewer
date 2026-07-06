import { api, ApiError } from "../api/client.js";

export function renderLogin(container: HTMLElement, onSuccess: () => void): void {
  const form = document.createElement("form");
  form.className = "card";
  form.innerHTML = `
    <h1>Media Viewer</h1>
    <label>Username <input name="username" autocomplete="username" required /></label>
    <label>Password <input name="password" type="password" autocomplete="current-password" required /></label>
    <button type="submit">Log in</button>
    <p class="error" hidden></p>
  `;

  const errorEl = form.querySelector<HTMLParagraphElement>(".error")!;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const data = new FormData(form);
    const username = String(data.get("username") ?? "");
    const password = String(data.get("password") ?? "");
    try {
      await api.login(username, password);
      onSuccess();
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Something went wrong.";
      errorEl.hidden = false;
    }
  });

  container.appendChild(form);
}
