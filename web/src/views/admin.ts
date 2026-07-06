import type { AdminUser, Role } from "@media_viewer/shared";
import { api, ApiError } from "../api/client.js";

export async function renderAdmin(container: HTMLElement, onBack: () => void): Promise<void> {
  const wrap = document.createElement("div");
  wrap.className = "admin";
  wrap.innerHTML = `
    <button data-action="back">&larr; Back</button>
    <h1>Admin</h1>
    <h2>Create user</h2>
    <form class="create-user">
      <label>Username <input name="username" required minlength="3" /></label>
      <label>Password <input name="password" type="password" required minlength="8" /></label>
      <label>Role
        <select name="role">
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
      </label>
      <button type="submit">Create</button>
      <p class="error" hidden></p>
    </form>
    <h2>Existing users</h2>
    <ul class="user-list"></ul>
  `;

  const listEl = wrap.querySelector<HTMLUListElement>(".user-list")!;
  const form = wrap.querySelector<HTMLFormElement>(".create-user")!;
  const errorEl = wrap.querySelector<HTMLParagraphElement>(".error")!;

  async function loadUsers() {
    const users = await api.listUsers();
    listEl.innerHTML = users.map((u: AdminUser) => `<li>${u.username} — ${u.role}</li>`).join("");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const data = new FormData(form);
    try {
      await api.createUser(String(data.get("username")), String(data.get("password")), data.get("role") as Role);
      form.reset();
      await loadUsers();
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Something went wrong.";
      errorEl.hidden = false;
    }
  });

  wrap.querySelector('[data-action="back"]')?.addEventListener("click", () => {
    container.innerHTML = "";
    onBack();
  });

  container.appendChild(wrap);
  await loadUsers();
}
