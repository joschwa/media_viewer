import type { AdminUser, Role, SessionInfo } from "@media_viewer/shared";
import { api, ApiError } from "../api/client.js";

type LoggedInSession = Extract<SessionInfo, { loggedIn: true }>;

/** Wires up the shared backdrop close behavior (Escape, click-outside, an optional close button) every
 * modal in this file needs, so each modal doesn't have to redefine it. Returns the close function. */
function attachModalClose(backdrop: HTMLDivElement, closeSelector = '[data-action="close"]'): () => void {
  function close() {
    backdrop.remove();
    document.removeEventListener("keydown", onKeydown);
  }
  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector(closeSelector)?.addEventListener("click", close);
  document.addEventListener("keydown", onKeydown);
  return close;
}

function openResetPasswordModal(user: AdminUser, onDone: () => void): void {
  const backdrop = document.createElement("div");
  backdrop.className = "settings-backdrop";
  backdrop.innerHTML = `
    <div class="settings-modal">
      <h2>Reset password</h2>
      <p>Set a new password for <strong class="target-username"></strong>. They'll be logged out everywhere.</p>
      <form class="reset-password-form">
        <label>New password <input type="password" name="newPassword" required minlength="8" /></label>
        <button type="submit">Set password</button>
        <p class="error" hidden></p>
      </form>
      <div class="settings-actions">
        <span></span>
        <button type="button" data-action="close">Cancel</button>
      </div>
    </div>
  `;
  backdrop.querySelector<HTMLElement>(".target-username")!.textContent = user.username;

  const close = attachModalClose(backdrop);
  const form = backdrop.querySelector<HTMLFormElement>(".reset-password-form")!;
  const errorEl = backdrop.querySelector<HTMLParagraphElement>(".error")!;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const data = new FormData(form);
    try {
      await api.adminResetPassword(user.id, String(data.get("newPassword")));
      close();
      onDone();
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Something went wrong.";
      errorEl.hidden = false;
    }
  });

  document.body.appendChild(backdrop);
}

function openDeleteUserModal(user: AdminUser, onDone: () => void): void {
  const backdrop = document.createElement("div");
  backdrop.className = "settings-backdrop";
  backdrop.innerHTML = `
    <div class="settings-modal">
      <h2>Delete user</h2>
      <p>Delete <strong class="target-username"></strong>? This will also <strong>permanently delete all of their photos and videos</strong>. This cannot be undone.</p>
      <p class="error" hidden></p>
      <div class="settings-actions">
        <button type="button" class="danger" data-action="confirm">Delete permanently</button>
        <button type="button" data-action="close">Cancel</button>
      </div>
    </div>
  `;
  backdrop.querySelector<HTMLElement>(".target-username")!.textContent = user.username;

  const close = attachModalClose(backdrop);
  const errorEl = backdrop.querySelector<HTMLParagraphElement>(".error")!;

  backdrop.querySelector('[data-action="confirm"]')?.addEventListener("click", async () => {
    errorEl.hidden = true;
    try {
      await api.deleteUser(user.id);
      close();
      onDone();
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Something went wrong.";
      errorEl.hidden = false;
    }
  });

  document.body.appendChild(backdrop);
}

function openTransferModal(user: AdminUser, allUsers: AdminUser[], onDone: () => void): void {
  const otherUsers = allUsers.filter((u) => u.id !== user.id);

  const backdrop = document.createElement("div");
  backdrop.className = "settings-backdrop";
  backdrop.innerHTML = `
    <div class="settings-modal">
      <h2>Transfer media</h2>
      <p>Move all media owned by <strong class="target-username"></strong> to another user.</p>
      <form class="transfer-form">
        <label>Transfer to <select name="toUserId"></select></label>
        <button type="submit">Transfer</button>
        <p class="error" hidden></p>
        <p class="success" hidden></p>
      </form>
      <div class="settings-actions">
        <span></span>
        <button type="button" data-action="close">Close</button>
      </div>
    </div>
  `;
  backdrop.querySelector<HTMLElement>(".target-username")!.textContent = user.username;

  const selectEl = backdrop.querySelector<HTMLSelectElement>('[name="toUserId"]')!;
  if (otherUsers.length === 0) {
    selectEl.disabled = true;
    const opt = document.createElement("option");
    opt.textContent = "No other users";
    selectEl.appendChild(opt);
  } else {
    for (const other of otherUsers) {
      const opt = document.createElement("option");
      opt.value = String(other.id);
      opt.textContent = other.username;
      selectEl.appendChild(opt);
    }
  }

  attachModalClose(backdrop);
  const form = backdrop.querySelector<HTMLFormElement>(".transfer-form")!;
  const errorEl = backdrop.querySelector<HTMLParagraphElement>(".error")!;
  const successEl = backdrop.querySelector<HTMLParagraphElement>(".success")!;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    successEl.hidden = true;
    const toUserId = Number(selectEl.value);
    if (!toUserId) return;
    try {
      const result = await api.transferMedia(user.id, toUserId);
      successEl.textContent = `Transferred ${result.transferred} item${result.transferred === 1 ? "" : "s"}.`;
      successEl.hidden = false;
      onDone();
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Something went wrong.";
      errorEl.hidden = false;
    }
  });

  document.body.appendChild(backdrop);
}

export async function renderAdmin(container: HTMLElement, session: LoggedInSession, onBack: () => void): Promise<void> {
  const wrap = document.createElement("div");
  wrap.className = "card admin";
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
    <table class="user-table">
      <thead>
        <tr>
          <th>Username</th>
          <th>Role</th>
          <th>Created</th>
          <th>Logins</th>
          <th>Last login</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;

  const tbodyEl = wrap.querySelector<HTMLTableSectionElement>(".user-table tbody")!;
  const form = wrap.querySelector<HTMLFormElement>(".create-user")!;
  const errorEl = wrap.querySelector<HTMLParagraphElement>(".error")!;

  let allUsers: AdminUser[] = [];

  function renderUserRow(user: AdminUser): HTMLTableRowElement {
    const tr = document.createElement("tr");
    const cells = [
      user.username,
      user.role,
      new Date(user.createdAt).toLocaleDateString(),
      String(user.loginCount),
      user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never",
    ];
    for (const text of cells) {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    }

    const actionsTd = document.createElement("td");
    actionsTd.className = "actions";

    const isSelf = user.id === session.userId;
    const isLastAdmin = user.role === "admin" && allUsers.filter((u) => u.role === "admin").length <= 1;

    // Self-service "Change password" (nav menu) already covers your own account.
    if (!isSelf) {
      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.textContent = "Reset password";
      resetBtn.addEventListener("click", () => openResetPasswordModal(user, () => void loadUsers()));
      actionsTd.appendChild(resetBtn);
    }

    const transferBtn = document.createElement("button");
    transferBtn.type = "button";
    transferBtn.textContent = "Transfer";
    transferBtn.addEventListener("click", () => openTransferModal(user, allUsers, () => void loadUsers()));
    actionsTd.appendChild(transferBtn);

    // Mirrors the server-side safety rails (can't delete yourself or the last admin) so the UI
    // doesn't offer an action guaranteed to fail — the server still enforces both regardless.
    if (!isSelf && !isLastAdmin) {
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "danger";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => openDeleteUserModal(user, () => void loadUsers()));
      actionsTd.appendChild(deleteBtn);
    }

    tr.appendChild(actionsTd);
    return tr;
  }

  async function loadUsers() {
    allUsers = await api.listUsers();
    tbodyEl.innerHTML = "";
    for (const user of allUsers) {
      tbodyEl.appendChild(renderUserRow(user));
    }
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
