import { api } from "./api/client.js";
import { renderHome } from "./views/home.js";
import { renderLogin } from "./views/login.js";

async function render(): Promise<void> {
  const app = document.getElementById("app")!;
  app.innerHTML = "";

  const session = await api.getSession();
  if (!session.loggedIn) {
    renderLogin(app, render);
  } else {
    renderHome(app, session, render);
  }
}

void render();
