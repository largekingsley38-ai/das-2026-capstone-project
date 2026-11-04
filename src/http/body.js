import { DomainError } from '../domain/errors.js';

// Reads the request body and returns it as a JSON object.
// An empty body counts as {}.
export async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.trim() === '') return {};

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new DomainError('BAD_JSON', 'Request body is not valid JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new DomainError('BAD_JSON', 'Request body must be a JSON object');
  }
  return parsed;
}