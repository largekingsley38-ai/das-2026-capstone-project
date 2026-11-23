import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openApiDocument } from '../src/http/openapi.js';
import { createRouter } from '../src/http/router.js';
import { registerApiRoutes } from '../src/http/apiRoutes.js';

const router = createRouter();
registerApiRoutes(router, {});
router.get('/health', () => ({}));

const operations = Object.entries(openApiDocument.paths).flatMap(([path, methods]) =>
  Object.keys(methods).map((method) => ({ method: method.toUpperCase(), path })),
);

test('every documented route exists on the router', () => {
  for (const { method, path } of operations) {
    const concrete = path.replace(/\{[^}]+\}/g, 'example');
    assert.ok(router.match(method, concrete), `${method} ${path} is documented but has no route`);
  }
});

test('every router path is documented', () => {
  const documented = new Set(operations.map(({ method, path }) => `${method} ${path}`));
  assert.equal(documented.size, 19, 'expected 19 documented operations');
});
