export interface CreatedClientShare {
  id: string;
  shareLink: string;
  expiresAt: string;
}

export async function copyClientShareLink(
  link: string,
  clipboard: { writeText(value: string): Promise<void> } | undefined
): Promise<boolean> {
  if (!clipboard) return false;
  try {
    await clipboard.writeText(link);
    return true;
  } catch {
    return false;
  }
}

export async function createClientShareLink(clientId: string, year: number): Promise<CreatedClientShare> {
  const response = await fetch('/api/share/client', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, year }),
    credentials: 'same-origin',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Não foi possível gerar o link. Tente novamente.');
  }
  if (typeof data?.shareLink !== 'string' || !data.shareLink) {
    throw new Error('O servidor não retornou o link. Tente novamente.');
  }
  return data;
}
