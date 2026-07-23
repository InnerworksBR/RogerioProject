/**
 * Política de senha compartilhada entre redefinição, definição via convite e troca.
 * Módulo puro (sem React/DOM/`server-only`) para uso no cliente e em testes.
 */
export const MIN_PASSWORD_LENGTH = 8;

export type PasswordValidationResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Valida a nova senha e a confirmação. Retorna a primeira mensagem de erro em
 * pt-BR, ou `{ ok: true }` quando a senha é aceitável.
 */
export function validateNewPassword(
  password: string,
  confirmPassword: string
): PasswordValidationResult {
  if (!password) {
    return { ok: false, message: 'Informe a nova senha.' };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      message: `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    };
  }

  if (password !== confirmPassword) {
    return { ok: false, message: 'A confirmação não corresponde à senha.' };
  }

  return { ok: true };
}

/**
 * Sanitiza um caminho de redirecionamento interno contra open-redirect.
 * Aceita apenas caminhos absolutos do próprio site (`/...`), rejeitando
 * caminhos protocolo-relativos (`//host`) e URLs absolutas (`http://`).
 */
export function normalizeInternalPath(
  value: string | null | undefined,
  fallback = '/'
): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }

  return value;
}
