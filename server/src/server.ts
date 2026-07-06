import { buildApp } from "./app.js";
import { config } from "./config.js";

const app = await buildApp();

try {
  const address = await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(`Server listening at ${address}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
