import { api } from "./api/client.js";
import { renderLogin } from "./views/login.js";
import { renderSlideshow } from "./views/slideshow.js";

async function render(): Promise<void> {
  const app = document.getElementById("app")!;
  app.innerHTML = "";

  const session = await api.getSession();
  if (!session.loggedIn) {
    renderLogin(app, render);
  } else {
    await renderSlideshow(app, session, render);
  }
}

void render();
