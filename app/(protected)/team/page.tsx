'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Clock3, Mail, Plus, Power, RotateCcw, Send, Shield, Sparkles, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/components/ui/use-confirm';
import { createClient } from '@/lib/supabase';

interface Rep {
  id: string;
  name: string;
  email: string;
  last_sign_in_at: string | null;
  is_active: boolean;
}

type LicensePlan = 'plan_1' | 'plan_2' | 'plan_3';
type LicenseRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

interface LicenseRequest {
  id: string;
  plan: LicensePlan;
  quantity: number;
  status: LicenseRequestStatus;
  notes: string | null;
  created_at: string;
}

const LICENSE_PLANS: Array<{ id: LicensePlan; name: string; support: string; benefits: string[] }> = [
  { id: 'plan_1', name: 'Plano 1', support: '6 horas de suporte mensal', benefits: ['Relatórios', '6 horas de suporte mensal'] },
  { id: 'plan_2', name: 'Plano 2', support: '12 horas de suporte mensal', benefits: ['Relatórios', 'Pequenas melhorias', '12 horas de suporte mensal', 'IA básica'] },
  { id: 'plan_3', name: 'Plano 3', support: '16 horas de suporte mensal', benefits: ['Relatórios', 'Evolução do portal', '16 horas de suporte mensal', 'IA avançada com chat para consultar dados dos clientes'] },
];

const STATUS_LABELS: Record<LicenseRequestStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  cancelled: 'Cancelada',
};

const STATUS_STYLES: Record<LicenseRequestStatus, string> = {
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  approved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  rejected: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
  cancelled: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
};

export default function TeamManagementPage() {
  const [reps, setReps] = useState<Rep[]>([]);
  const [licenseRequests, setLicenseRequests] = useState<LicenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLeader, setIsLeader] = useState(false);
  const [licenseCount, setLicenseCount] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<LicensePlan>('plan_1');
  const [requestedQuantity, setRequestedQuantity] = useState('1');
  const [requestNotes, setRequestNotes] = useState('');
  const [isRequestingLicenses, setIsRequestingLicenses] = useState(false);
  const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const fetchProfileAndReps = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, license_count')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'leader') return;

      setIsLeader(true);
      setLicenseCount(profile.license_count);
      const [repsResponse, requestsResponse] = await Promise.all([
        fetch('/api/admin/reps'),
        fetch('/api/admin/license-requests'),
      ]);
      const [repsData, requestsData] = await Promise.all([
        repsResponse.json(),
        requestsResponse.json(),
      ]);
      if (!repsResponse.ok) throw new Error(repsData.error || 'Erro ao carregar representantes.');
      if (!requestsResponse.ok) throw new Error(requestsData.error || 'Erro ao carregar solicitações.');
      setReps(repsData.reps ?? []);
      setLicenseRequests(requestsData.requests ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar dados da equipe.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProfileAndReps();
  }, []);

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/admin/reps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), email: newEmail.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao enviar convite.');
      toast.success('Convite enviado com sucesso.');
      setNewName('');
      setNewEmail('');
      await fetchProfileAndReps();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar convite.');
    } finally {
      setIsCreating(false);
    }
  };

  const updateRepStatus = async (rep: Rep) => {
    setProcessingId(rep.id);
    try {
      const response = await fetch('/api/admin/reps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rep.id, isActive: !rep.is_active }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao alterar acesso.');
      toast.success(rep.is_active ? 'Representante inativado.' : 'Representante reativado.');
      await fetchProfileAndReps();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao alterar acesso.');
    } finally {
      setProcessingId(null);
    }
  };

  const deleteRep = async (rep: Rep) => {
    const confirmed = await confirm({
      title: `Excluir ${rep.name}?`,
      description: 'O acesso será removido. Vendas e uploads serão preservados na conta do líder.',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      variant: 'destructive',
    });
    if (!confirmed) return;

    setProcessingId(rep.id);
    try {
      const response = await fetch('/api/admin/reps', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rep.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao excluir representante.');
      toast.success('Representante excluído.');
      await fetchProfileAndReps();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir representante.');
    } finally {
      setProcessingId(null);
    }
  };

  const submitLicenseRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    const quantity = Number(requestedQuantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      toast.error('Informe uma quantidade válida de licenças.');
      return;
    }

    setIsRequestingLicenses(true);
    try {
      const response = await fetch('/api/admin/license-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selectedPlan, quantity, notes: requestNotes.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao solicitar licenças.');
      toast.success('Solicitação enviada para análise.');
      setRequestedQuantity('1');
      setRequestNotes('');
      await fetchProfileAndReps();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao solicitar licencas.');
    } finally {
      setIsRequestingLicenses(false);
    }
  };

  const cancelLicenseRequest = async (id: string) => {
    setCancellingRequestId(id);
    try {
      const response = await fetch('/api/admin/license-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao cancelar solicitação.');
      toast.success('Solicitação cancelada.');
      await fetchProfileAndReps();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao cancelar solicitacao.');
    } finally {
      setCancellingRequestId(null);
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-400">Carregando equipe...</div>;

  if (!isLeader) {
    return (
      <div className="mx-auto mt-10 max-w-2xl rounded-[2rem] p-10 text-center glass-card">
        <Shield className="mx-auto mb-4 h-12 w-12 text-rose-500" />
        <h2 className="mb-2 text-2xl font-bold text-white">Acesso restrito</h2>
        <p className="text-slate-400">Apenas líderes podem gerenciar representantes e licenças.</p>
      </div>
    );
  }

  const activeReps = reps.filter((rep) => rep.is_active);
  const licensesAvailable = licenseCount - activeReps.length;

  return (
    <>
    <ConfirmDialog />
    <div className="mx-auto max-w-6xl space-y-8 pb-20">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Gestão da equipe</h1>
          <p className="mt-2 text-slate-400">Convide representantes por e-mail e gerencie suas licenças.</p>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-indigo-500/30 px-6 py-4 glass-card">
          <Users className="h-6 w-6 text-indigo-400" />
          <p className="font-bold text-white">{activeReps.length} / {licenseCount} licenças usadas</p>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <section className="rounded-[2rem] p-6 glass-card">
          <h2 className="mb-6 text-xl font-bold text-white">Representantes</h2>
          {reps.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-slate-400">
              Nenhum representante cadastrado.
            </p>
          ) : reps.map((rep) => (
            <div key={rep.id} className={`mb-3 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${rep.is_active ? 'border-white/5 bg-[#030712]/50' : 'border-amber-500/20 bg-amber-500/5'}`}>
              <div>
                <p className="flex items-center gap-2 font-bold text-white">
                  {rep.name}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${rep.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                    {rep.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </p>
                <p className="flex items-center gap-1 text-sm text-slate-400"><Mail className="h-3 w-3" />{rep.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="mr-2 text-sm text-slate-400">
                  {rep.last_sign_in_at ? new Date(rep.last_sign_in_at).toLocaleDateString('pt-BR') : 'Convite pendente'}
                </p>
                <Button variant="outline" size="sm" disabled={processingId === rep.id} onClick={() => void updateRepStatus(rep)}>
                  {rep.is_active ? <Power className="mr-1 h-3 w-3" /> : <RotateCcw className="mr-1 h-3 w-3" />}
                  {rep.is_active ? 'Inativar' : 'Reativar'}
                </Button>
                <Button variant="outline" size="sm" disabled={processingId === rep.id} onClick={() => void deleteRep(rep)} className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10">
                  <Trash2 className="mr-1 h-3 w-3" />Excluir
                </Button>
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-[2rem] border border-indigo-500/20 p-6 glass-card">
          <h2 className="mb-2 flex items-center gap-2 text-xl font-bold text-white"><Plus className="h-5 w-5 text-indigo-400" />Novo representante</h2>
          <p className="mb-6 text-sm text-slate-400">O representante receberá um e-mail para definir a própria senha.</p>
          {licensesAvailable <= 0 ? (
            <p className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-400">
              <AlertTriangle className="h-5 w-5 shrink-0" />Limite de licenças atingido. Contate o suporte para expandir a operação.
            </p>
          ) : (
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="invite-name" className="block text-sm font-medium text-slate-300">
                  Nome completo
                </label>
                <Input
                  id="invite-name"
                  required
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="invite-email" className="block text-sm font-medium text-slate-300">
                  E-mail
                </label>
                <Input
                  id="invite-email"
                  required
                  type="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  placeholder="email@empresa.com.br"
                />
              </div>
              <Button type="submit" disabled={isCreating} className="w-full bg-indigo-600 text-white hover:bg-indigo-700">
                {isCreating ? 'Enviando...' : 'Enviar convite'}
              </Button>
            </form>
          )}
        </section>
      </div>

      <section className="space-y-6 rounded-[2rem] border border-indigo-500/20 p-6 glass-card">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-white">
            <Sparkles className="h-5 w-5 text-indigo-400" />Solicitar novas licencas
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Escolha o plano ideal para sua operação. A liberação das licenças acontece após análise comercial.
          </p>
        </div>

        <form onSubmit={submitLicenseRequest} className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            {LICENSE_PLANS.map((plan) => {
              const isSelected = selectedPlan === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`rounded-2xl border p-5 text-left transition-all ${isSelected ? 'border-indigo-400 bg-indigo-500/15 ring-2 ring-indigo-500/20' : 'border-white/10 bg-[#030712]/40 hover:border-indigo-500/40'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-white">{plan.name}</p>
                      <p className="mt-1 text-sm font-medium text-indigo-300">{plan.support}</p>
                    </div>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${isSelected ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-slate-600 text-transparent'}`}>
                      <Check className="h-4 w-4" />
                    </span>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {plan.benefits.map((benefit) => (
                      <li key={benefit} className="flex gap-2 text-sm text-slate-300">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{benefit}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-[180px_1fr_auto] lg:items-end">
            <label className="space-y-2 text-sm font-medium text-slate-300">
              Quantidade de licenças
              <Input required type="number" min="1" step="1" value={requestedQuantity} onChange={(event) => setRequestedQuantity(event.target.value)} />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-300">
              Observação opcional
              <textarea
                maxLength={1000}
                value={requestNotes}
                onChange={(event) => setRequestNotes(event.target.value)}
                placeholder="Conte brevemente como pretende expandir a equipe."
                className="flex min-h-10 w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-white shadow-xs outline-none placeholder:text-slate-500 focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/30"
              />
            </label>
            <Button type="submit" disabled={isRequestingLicenses} className="bg-indigo-600 text-white hover:bg-indigo-700">
              <Send className="mr-2 h-4 w-4" />{isRequestingLicenses ? 'Enviando...' : 'Enviar solicitação'}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-[2rem] p-6 glass-card">
        <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-white">
          <Clock3 className="h-5 w-5 text-indigo-400" />Histórico de solicitações
        </h2>
        {licenseRequests.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 py-8 text-center text-slate-400">
            Nenhuma solicitação de licença enviada.
          </p>
        ) : licenseRequests.map((request) => (
          <div key={request.id} className="mb-3 flex flex-col gap-3 rounded-2xl border border-white/5 bg-[#030712]/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-white">{LICENSE_PLANS.find((plan) => plan.id === request.plan)?.name}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[request.status]}`}>
                  {STATUS_LABELS[request.status]}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-400">
                {request.quantity} {request.quantity === 1 ? 'licença solicitada' : 'licenças solicitadas'} em {new Date(request.created_at).toLocaleDateString('pt-BR')}
              </p>
              {request.notes && <p className="mt-2 text-sm text-slate-300">{request.notes}</p>}
            </div>
            {request.status === 'pending' && (
              <Button variant="outline" size="sm" disabled={cancellingRequestId === request.id} onClick={() => void cancelLicenseRequest(request.id)} className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10">
                <X className="mr-1 h-3 w-3" />Cancelar
              </Button>
            )}
          </div>
        ))}
      </section>
    </div>
    </>
  );
}
