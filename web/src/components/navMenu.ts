export type NavMenuOptions = {
  username: string;
  role: string;
  isAdmin: boolean;
  onSettings: () => void;
  onAdmin: () => void;
  onUpload: () => void;
  onChangePassword: () => void;
  onTriggerScan: () => void;
  onLogout: () => void;
};

export function openNavMenu(options: NavMenuOptions, onClose: () => void): void {
  const backdrop = document.createElement("div");
  backdrop.className = "nav-menu-backdrop";
  backdrop.innerHTML = `
    <div class="nav-menu-panel">
      <div class="nav-menu-header">
        <span>${options.username} (${options.role})</span>
        <button data-action="close" class="nav-menu-close" aria-label="Close menu">&times;</button>
      </div>
      <button data-action="upload">Upload</button>
      <button data-action="change-password">Change password</button>
      <button data-action="settings">Settings</button>
      ${options.isAdmin ? '<button data-action="admin">Admin</button>' : ""}
      ${options.isAdmin ? '<button data-action="scan">Trigger scan</button>' : ""}
      <button data-action="logout">Log out</button>
    </div>
  `;

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
  backdrop.querySelector('[data-action="upload"]')?.addEventListener("click", () => {
    close();
    options.onUpload();
  });
  backdrop.querySelector('[data-action="change-password"]')?.addEventListener("click", () => {
    close();
    options.onChangePassword();
  });
  backdrop.querySelector('[data-action="settings"]')?.addEventListener("click", () => {
    close();
    options.onSettings();
  });
  backdrop.querySelector('[data-action="admin"]')?.addEventListener("click", () => {
    close();
    options.onAdmin();
  });
  backdrop.querySelector('[data-action="scan"]')?.addEventListener("click", () => {
    close();
    options.onTriggerScan();
  });
  backdrop.querySelector('[data-action="logout"]')?.addEventListener("click", () => {
    close();
    options.onLogout();
  });
  document.addEventListener("keydown", onKeydown);

  document.body.appendChild(backdrop);
}
