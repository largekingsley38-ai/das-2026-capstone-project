import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { DomainError } from '../domain/errors.js';
import { createRouter } from './router.js';
import { config } from '../config.js';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Every error leaves the server in this one shape.
function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
  });
  res.end(text);
}

function sendError(res, status, code, message) {
  sendJson(res, status, { error: { code, message } });
}

// One place that turns a DomainError code into an HTTP status.
const STATUS_BY_CODE = {
  VALIDATION: 400,
  NOT_FOUND: 404,
  SOLD_OUT: 409,
  INVALID_STATE: 409,
  INVALID_TRANSITION: 409,
};

export async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.trim() === '') return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainError('BAD_JSON', 'Request body is not valid JSON');
  }
}

async function serveStatic(res, pathname) {
  const publicRoot = fileURLToPath(config.publicDir);
  const relative = pathname === '/' ? 'index.html' : pathname;

  let decoded;
  try {
    decoded = decodeURIComponent(relative);
  } catch {
    return sendError(res, 400, 'VALIDATION', 'Bad path');
  }

  // Never let a path escape the public folder.
  const target = path.resolve(publicRoot, '.' + path.sep + decoded);
  if (target !== publicRoot.replace(/[\\/]$/, '') && !target.startsWith(publicRoot)) {
    return sendError(res, 404, 'NOT_FOUND', 'Not found');
  }

  try {
    const data = await readFile(target);
    const type = MIME_TYPES[path.extname(target)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': data.length });
    res.end(data);
  } catch {
    sendError(res, 404, 'NOT_FOUND', 'Not found');
  }
}

export function createApp() {
  const router = createRouter();

  router.get('/health', () => ({ status: 200, body: { status: 'ok' } }));

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const pathname = url.pathname;

      let found = null;
      try {
        found = router.match(req.method, pathname);
      } catch {
        return sendError(res, 400, 'VALIDATION', 'Bad path');
      }

      if (found) {
        const result = await found.handler({ req, params: found.params, url });
        return sendJson(res, result.status ?? 200, result.body);
      }

      if (pathname.startsWith('/api')) {
        return sendError(res, 404, 'NOT_FOUND', 'No such API path');
      }

      if (req.method === 'GET' || req.method === 'HEAD') {
        return await serveStatic(res, pathname);
      }
      return sendError(res, 404, 'NOT_FOUND', 'Not found');
    } catch (error) {
      if (error instanceof DomainError) {
        const status = error.code === 'BAD_JSON' ? 400 : (STATUS_BY_CODE[error.code] ?? 400);
        return sendError(res, status, error.code, error.message);
      }
      // Never send a stack trace to the client.
      console.error(error);
      return sendError(res, 500, 'INTERNAL', 'Something went wrong');
    }
  });

  return server;
}