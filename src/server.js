import { createApp } from './http/app.js';
import { config } from './config.js';

const server = createApp();

server.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});