import { createApplication } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = createApplication(config);

app.server.listen(config.port, () => {
  console.log(`PokéDex Manager disponible en http://localhost:${config.port}`);
});

async function shutdown() {
  await app.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
