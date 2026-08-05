'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, Check, Edit2, Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/components/ui/use-confirm';

interface RawClient {
  cod_cliente: string;
  nome_cliente: string;
  group_id: string | null;
  group_name: string | null;
}

interface ClientGroup {
  id: string;
  name: string;
  updated_at: string;
  client_group_members: Array<{ id: number; cod_cliente: string; nome_cliente: string | null }>;
}

interface GroupsPayload {
  canManage: boolean;
  groups: ClientGroup[];
  clients: RawClient[];
}

export function ClientGroupsManager() {
  const [payload, setPayload] = useState<GroupsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const { confirm, ConfirmDialog } = useConfirm();

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/client-groups', { headers: { Accept: 'application/json' } });
      const data = await response.json() as GroupsPayload & { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Erro ao carregar grupos.');
      setPayload(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar grupos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const visibleClients = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return (payload?.clients ?? []).filter((client) => {
      if (client.group_id && client.group_id !== editingId) return false;
      return !normalized
        || client.cod_cliente.toLocaleLowerCase('pt-BR').includes(normalized)
        || client.nome_cliente.toLocaleLowerCase('pt-BR').includes(normalized);
    });
  }, [editingId, payload?.clients, query]);

  function resetEditor() {
    setEditingId(null);
    setName('');
    setCodes([]);
    setQuery('');
  }

  function edit(group: ClientGroup) {
    setEditingId(group.id);
    setName(group.name);
    setCodes(group.client_group_members.map((member) => member.cod_cliente));
  }

  async function save() {
    if (name.trim().length < 2 || codes.length < 2) {
      toast.info('Informe um nome e selecione pelo menos dois clientes.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/client-groups${editingId ? `?id=${editingId}` : ''}`, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, codes }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Erro ao salvar grupo.');
      toast.success(editingId ? 'Grupo atualizado.' : 'Grupo criado.');
      resetEditor();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar grupo.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(group: ClientGroup) {
    const accepted = await confirm({
      title: 'Desfazer consolidação?',
      description: `O grupo “${group.name}” será removido. Os clientes originais continuarão intactos e voltarão a aparecer separadamente.`,
      confirmLabel: 'Remover grupo',
      cancelLabel: 'Cancelar',
      variant: 'destructive',
    });
    if (!accepted) return;
    const response = await fetch(`/api/client-groups?id=${group.id}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      toast.error(data.error ?? 'Erro ao excluir grupo.');
      return;
    }
    toast.success('Grupo removido; os clientes originais foram preservados.');
    await load();
  }

  if (loading) {
    return <Card><CardContent className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> Carregando consolidações…</CardContent></Card>;
  }

  return (
    <>
      <ConfirmDialog />
      <Card className="border-indigo-200/60 dark:border-indigo-900/50">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2"><Building2 className="size-5 text-indigo-500" /> Clientes consolidados</CardTitle>
            <CardDescription className="mt-1">Una razões sociais do mesmo cliente sem alterar a planilha original.</CardDescription>
          </div>
          {payload?.canManage && !editingId && name === '' && (
            <Button onClick={() => setName('Novo grupo')}><Plus className="mr-2 size-4" /> Novo grupo</Button>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          {!payload?.canManage && (
            <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              Você usa as consolidações definidas pelo líder da conta. Somente o líder pode alterá-las.
            </p>
          )}

          {payload?.canManage && name !== '' && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-900 dark:bg-indigo-950/10">
              <div className="flex flex-col gap-3 md:flex-row">
                <Input aria-label="Nome do cliente consolidado" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome comercial do cliente" />
                <Input aria-label="Pesquisar razões sociais" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar código ou razão social" />
              </div>
              <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border bg-white p-2 dark:bg-slate-950">
                {visibleClients.map((client) => {
                  const selected = codes.includes(client.cod_cliente);
                  return (
                    <button
                      key={client.cod_cliente}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setCodes(selected ? codes.filter((code) => code !== client.cod_cliente) : [...codes, client.cod_cliente])}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-900"
                    >
                      <span className={`flex size-5 items-center justify-center rounded border ${selected ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-300'}`}>
                        {selected && <Check className="size-3" />}
                      </span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{client.nome_cliente}</span><span className="text-xs text-slate-400">{client.cod_cliente}</span></span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-500">{codes.length} clientes selecionados. Cada código pode pertencer a apenas um grupo.</p>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={resetEditor}><X className="mr-2 size-4" /> Cancelar</Button>
                <Button onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />} Salvar grupo</Button>
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {(payload?.groups ?? []).map((group) => (
              <div key={group.id} className="rounded-2xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="font-bold">{group.name}</h3><p className="text-xs text-slate-500">{group.client_group_members.length} razões sociais</p></div>
                  {payload?.canManage && <div className="flex gap-1"><Button size="icon" variant="ghost" aria-label={`Editar ${group.name}`} onClick={() => edit(group)}><Edit2 className="size-4" /></Button><Button size="icon" variant="ghost" aria-label={`Remover ${group.name}`} onClick={() => void remove(group)}><Trash2 className="size-4 text-rose-500" /></Button></div>}
                </div>
                <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  {group.client_group_members.map((member) => <li key={member.id}><span className="font-mono text-xs text-slate-400">{member.cod_cliente}</span> · {member.nome_cliente}</li>)}
                </ul>
              </div>
            ))}
            {(payload?.groups.length ?? 0) === 0 && <p className="text-sm text-slate-500">Nenhum cliente consolidado. Os clientes continuam aparecendo pelos códigos originais.</p>}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
