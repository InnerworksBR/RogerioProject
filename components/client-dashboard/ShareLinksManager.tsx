'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/use-confirm';
import type { ShareLink } from '@/types/operations';

export function ShareLinksManager({ clientId, year }: { clientId: string; year: number }) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const { confirm, ConfirmDialog } = useConfirm();

  const loadLinks = async () => {
    const response = await fetch('/api/share/client');
    if (!response.ok) return;
    const data = await response.json();
    setLinks((data.links ?? []).filter((link: ShareLink) => link.client_id === clientId && link.year === year));
  };

  useEffect(() => {
    void loadLinks();
    window.addEventListener('share-links-updated', loadLinks);
    return () => window.removeEventListener('share-links-updated', loadLinks);
  }, [clientId, year]);

  const revoke = async (id: string, expiresAt: string) => {
    const confirmed = await confirm({
      title: 'Revogar link de compartilhamento?',
      description: `O link com validade até ${new Date(expiresAt).toLocaleDateString('pt-BR')} será desativado imediatamente. Qualquer pessoa com o link perderá o acesso.`,
      confirmLabel: 'Revogar',
      cancelLabel: 'Cancelar',
      variant: 'destructive',
    });
    if (!confirmed) return;

    const response = await fetch('/api/share/client', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) return toast.error('Erro ao revogar o link.');
    toast.success('Link revogado.');
    await loadLinks();
  };

  if (links.length === 0) return null;

  return (
    <>
      <ConfirmDialog />
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Button key={link.id} variant="ghost" size="sm" onClick={() => void revoke(link.id, link.expires_at)}>
            <Trash2 className="mr-1 h-3 w-3" />
            Revogar link até {new Date(link.expires_at).toLocaleDateString('pt-BR')}
          </Button>
        ))}
      </div>
    </>
  );
}
