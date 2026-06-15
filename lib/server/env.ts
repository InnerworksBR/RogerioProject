import 'server-only';

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }

  return value;
}

export function getPublicSupabaseEnv() {
  return {
    url: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  };
}

export function getAdminSupabaseEnv() {
  return {
    ...getPublicSupabaseEnv(),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  };
}

export function isAIReportSummaryEnabled() {
  return process.env.AI_REPORT_SUMMARY_ENABLED === 'true';
}

export function isAIReportChatEnabled() {
  return process.env.AI_REPORT_CHAT_ENABLED === 'true';
}
