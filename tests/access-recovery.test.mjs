import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('password recovery, reset and callback routes are public in the proxy', async () => {
  const proxy = await read('proxy.ts');
  assert.match(proxy, /pathname === '\/recuperar-senha'/);
  assert.match(proxy, /pathname === '\/redefinir-senha'/);
  assert.match(proxy, /pathname === '\/auth\/callback'/);
  assert.match(proxy, /isAccessRecoveryRoute/);
  // As rotas de recuperação entram na composição de rotas públicas.
  assert.match(proxy, /isPublicRoute =[\s\S]*isAccessRecoveryRoute/);
});

test('account/security page stays behind authentication', async () => {
  // /conta vive sob (protected) e ainda valida a sessão na própria página.
  const page = await read('app/(protected)/conta/page.tsx');
  assert.match(page, /createServerSupabaseClient/);
  assert.match(page, /if \(!user\)/);
  assert.match(page, /redirect\('\/login'\)/);
});

test('auth callback exchanges the PKCE code and sanitizes the redirect target', async () => {
  const route = await read('app/auth/callback/route.ts');
  assert.match(route, /exchangeCodeForSession\(code\)/);
  assert.match(route, /normalizeInternalPath\(searchParams\.get\('next'\)/);
  assert.match(route, /\/login\?error=link_invalido/);
});

test('shared password policy enforces minimum length and blocks open redirects', async () => {
  const policy = await read('lib/passwordPolicy.ts');
  assert.match(policy, /MIN_PASSWORD_LENGTH = 8/);
  assert.match(policy, /password\.length < MIN_PASSWORD_LENGTH/);
  assert.match(policy, /password !== confirmPassword/);
  // normalizeInternalPath rejeita caminhos protocolo-relativos e URLs absolutas.
  assert.match(policy, /!value\.startsWith\('\/'\) \|\| value\.startsWith\('\/\/'\)/);
});

test('forgot-password flow keeps a neutral response and targets the callback', async () => {
  const form = await read('components/auth/ForgotPasswordForm.tsx');
  assert.match(form, /resetPasswordForEmail/);
  assert.match(form, /\/auth\/callback\?next=\/redefinir-senha/);
  // Sucesso é exibido sem revelar se o email existe (anti-enumeração).
  assert.match(form, /setSent\(true\)/);
});

test('reset-password form validates and requires a recovery session', async () => {
  const form = await read('components/auth/ResetPasswordForm.tsx');
  assert.match(form, /validateNewPassword\(password, confirmPassword\)/);
  assert.match(form, /updateUser\(\{ password \}\)/);
  assert.match(form, /sessionState === 'missing'/);
  assert.match(form, /\/recuperar-senha/);
});

test('change-password reauthenticates with the current password before updating', async () => {
  const form = await read('components/auth/ChangePasswordForm.tsx');
  assert.match(form, /signInWithPassword\(\{\s*email,\s*password: currentPassword,?\s*\}\)/);
  assert.match(form, /Senha atual incorreta/);
  assert.match(form, /updateUser\(\{\s*password: newPassword,?\s*\}\)/);
  assert.match(form, /A nova senha deve ser diferente da atual/);
});

test('login exposes the forgot-password entry point', async () => {
  const login = await read('components/auth/LoginForm.tsx');
  assert.match(login, /href="\/recuperar-senha"/);
  assert.match(login, /Esqueci minha senha/);
});

test('representative invite lands on the password definition flow', async () => {
  const route = await read('app/api/admin/reps/route.ts');
  assert.match(route, /redirectTo: `\$\{req\.nextUrl\.origin\}\/auth\/callback\?next=\/redefinir-senha`/);
  assert.doesNotMatch(route, /redirectTo: `\$\{req\.nextUrl\.origin\}\/login`/);
});
