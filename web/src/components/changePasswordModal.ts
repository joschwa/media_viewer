import { api, ApiError } from "../api/client.js";

export function openChangePasswordModal(onClose: () => void): void {
  const backdrop = document.createElement("div");
  backdrop.className = "settings-backdrop";
  backdrop.innerHTML = `
    <div class="settings-modal">
      <h2>Change password</h2>
      <form class="change-password-form">
        <label>Current password <input type="password" name="currentPassword" required /></label>
        <label>New password <input type="password" name="newPassword" required minlength="8" /></label>
        <label>Confirm new password <input type="password" name="confirmPassword" required minlength="8" /></label>
        <button type="submit">Change password</button>
        <p class="error" hidden></p>
        <p class="success" hidden>Password changed. Your other devices have been logged out.</p>
      </form>
      <div class="settings-actions">
        <span></span>
        <button type="button" data-action="close">Close</button>
      </div>
    </div>
  `;

  const form = backdrop.querySelector<HTMLFormElement>(".change-password-form")!;
  const errorEl = backdrop.querySelector<HTMLParagraphElement>(".error")!;
  const successEl = backdrop.querySelector<HTMLParagraphElement>(".success")!;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    successEl.hidden = true;

    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword"));
    const newPassword = String(data.get("newPassword"));
    const confirmPassword = String(data.get("confirmPassword"));

    if (newPassword !== confirmPassword) {
      errorEl.textContent = "New passwords don't match.";
      errorEl.hidden = false;
      return;
    }

    try {
      await api.changePassword(currentPassword, newPassword);
      form.reset();
      successEl.hidden = false;
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Something went wrong.";
      errorEl.hidden = false;
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
