import { DomainError } from '../domain/errors.js';
import { newId } from '../domain/ids.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { signToken } from '../lib/token.js';

export const ROLES = ['attendee', 'organizer', 'staff'];
const TOKEN_SECONDS = 8 * 60 * 60;

function cleanEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function createAuthService(repository, { secret }) {
  let dummyHash;

  const publicUser = (account) => ({ id: account.id, email: account.email, role: account.role });
  const tokenFor = (account) =>
    signToken({ sub: account.id, role: account.role }, { secret, expiresInSeconds: TOKEN_SECONDS });

  async function signup(input = {}) {
    const email = cleanEmail(input.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new DomainError('VALIDATION', 'A valid email is required');
    }
    if (typeof input.password !== 'string' || input.password.length < 8) {
      throw new DomainError('VALIDATION', 'Password must be at least 8 characters');
    }
    const role = input.role ?? 'attendee';
    if (!ROLES.includes(role)) {
      throw new DomainError('VALIDATION', 'role must be one of: ' + ROLES.join(', '));
    }

    const account = {
      id: newId(),
      email,
      passwordHash: await hashPassword(input.password),
      role,
      createdAt: new Date().toISOString(),
    };
    const saved = await repository.createAccount(account);
    if (!saved) throw new DomainError('EMAIL_TAKEN', 'That email is already registered');
    return { user: publicUser(account), token: tokenFor(account) };
  }

  async function login(input = {}) {
    const email = cleanEmail(input.email);
    const account = email ? await repository.findAccountByEmail(email) : undefined;
    // Always check a hash, so an unknown email takes the same time as a wrong password.
    dummyHash ??= await hashPassword('dummy-password');
    const password = typeof input.password === 'string' ? input.password : '';
    const ok = await verifyPassword(password, account ? account.passwordHash : dummyHash);
    if (!account || !ok) {
      throw new DomainError('INVALID_CREDENTIALS', 'Wrong email or password');
    }
    return { user: publicUser(account), token: tokenFor(account) };
  }

  async function me(userId) {
    const account = await repository.getAccount(userId);
    if (!account) throw new DomainError('UNAUTHENTICATED', 'Account not found');
    return publicUser(account);
  }

  return { signup, login, me };
}