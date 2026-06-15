'use client';

import { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  addConfigItem,
  deleteConfigItem,
  getConfigItems,
  updateConfigItem,
  type EditableConfigFields,
} from '@/lib/reportQueries';
import type {
  ConfigSeedSuggestion,
  ReportConfigItem,
  ReportKey,
  SeedSuggestionsResponse,
} from '@/types/config';
import {
  AlertTriangle,
  Edit2,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useConfirm } from '@/components/ui/use-confirm';

type EditableForm = Partial<ReportConfigItem> & {
  extra_data: Record<string, string>;
};

const REPORT_KEYS: ReportKey[] = ['base_itens', 'bagagitos', 'geral'];
const EXTRA_FIELDS: Record<ReportKey, string[]> = {
  base_itens: ['dts', 'r2a', 'lumax', 'loma', 'lancamento'],
  bagagitos: ['emb', 'plastiron', 'ano_aplicacao', 'aplicacao', 'cor', 'outros_dados'],
  geral: ['status', 'emb', 'plastiron', 'ano_aplicacao', 'aplicacao', 'cor', 'outros_dados'],
};

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState<ReportKey>('base_itens');
  const [items, setItems] = useState<ReportConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditableForm>({ extra_data: {} });
  const [isAdding, setIsAdding] = useState(false);
  const [seedPreview, setSeedPreview] = useState<SeedSuggestionsResponse | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedApplying, setSeedApplying] = useState(false);
  const [showOnlyNeedsReview, setShowOnlyNeedsReview] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    void loadItems();
  }, [activeTab]);

  async function loadItems() {
    setLoading(true);
    try {
      const data = (await getConfigItems(activeTab)) as ReportConfigItem[];
      setItems(data || []);
    } catch {
      toast.error('Erro ao carregar itens');
    } finally {
      setLoading(false);
    }
  }

  async function fetchSeedPreview(mode: 'preview' | 'apply') {
    if (mode === 'preview') {
      setSeedLoading(true);
    } else {
      setSeedApplying(true);
    }

    try {
      const response = await fetch('/api/config/seed-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });

      const json = (await response.json()) as SeedSuggestionsResponse | { error?: string };

      if (!response.ok) {
        throw new Error('error' in json ? json.error ?? 'Erro ao gerar seed.' : 'Erro ao gerar seed.');
      }

      setSeedPreview(json as SeedSuggestionsResponse);

      if (mode === 'apply') {
        const applied = (json as SeedSuggestionsResponse).applied?.insertedByReport;
        toast.success(
          `Sugestões aplicadas: ${applied?.base_itens ?? 0} base de itens, ${applied?.bagagitos ?? 0} bagagitos e ${applied?.geral ?? 0} geral.`
        );
        await loadItems();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar sugestões.');
    } finally {
      if (mode === 'preview') {
        setSeedLoading(false);
      } else {
        setSeedApplying(false);
      }
    }
  }

  const handleEdit = (item: ReportConfigItem) => {
    setEditingId(item.id);
    setEditForm({
      ...item,
      extra_data: { ...(item.extra_data || {}) },
    });
  };

  const handleSave = async (id: number) => {
    try {
      // Envia apenas os campos editáveis — nunca id/user_id/report_key/created_at.
      const payload: EditableConfigFields = {
        label: editForm.label ?? undefined,
        categoria: editForm.categoria,
        cod_referencia: editForm.cod_referencia ?? undefined,
        extra_data: editForm.extra_data,
        sort_order: editForm.sort_order,
      };
      await updateConfigItem(id, payload);
      toast.success('Item atualizado com sucesso');
      setEditingId(null);
      await loadItems();
    } catch {
      toast.error('Erro ao atualizar item');
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: 'Excluir item?',
      description: 'Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      variant: 'destructive',
    });
    if (!confirmed) return;

    try {
      await deleteConfigItem(id);
      toast.success('Item excluído com sucesso');
      await loadItems();
    } catch {
      toast.error('Erro ao excluir item');
    }
  };

  const handleAdd = async () => {
    try {
      await addConfigItem({
        report_key: activeTab,
        cod_referencia: editForm.cod_referencia || '',
        label: editForm.label || '',
        categoria: activeTab === 'geral' ? editForm.categoria || 'Sem categoria' : null,
        extra_data: editForm.extra_data || {},
        sort_order: items.length,
      });
      toast.success('Item adicionado com sucesso');
      setIsAdding(false);
      setEditForm({ extra_data: {} });
      await loadItems();
    } catch {
      toast.error('Erro ao adicionar item');
    }
  };

  const visibleItems = useMemo(() => {
    if (activeTab !== 'geral' || !showOnlyNeedsReview) {
      return items;
    }

    return items.filter(
      (item) => !item.categoria || item.categoria.trim() === '' || item.categoria === 'Sem categoria'
    );
  }, [activeTab, items, showOnlyNeedsReview]);

  const previewTotal =
    (seedPreview?.baseItens.suggestedCount ?? 0) +
    (seedPreview?.bagagitos.suggestedCount ?? 0) +
    (seedPreview?.geral.suggestedCount ?? 0);

  return (
    <>
    <ConfirmDialog />
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuração de Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os itens que aparecem nas bases de Itens, Bagagitos e Geral.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void fetchSeedPreview('preview')}
            disabled={seedLoading || seedApplying}
          >
            {seedLoading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 size-4" />
            )}
            Gerar sugestões iniciais
          </Button>

          {seedPreview && (
            <Button
              onClick={() => void fetchSeedPreview('apply')}
              disabled={seedApplying || previewTotal === 0}
            >
              {seedApplying ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 size-4" />
              )}
              Aplicar sugestões
            </Button>
          )}

          <Button
            onClick={() => {
              setIsAdding(true);
              setEditForm({ extra_data: {} });
            }}
          >
            <Plus className="mr-2 size-4" /> Adicionar Item
          </Button>
        </div>
      </div>

      {seedPreview && (
        <Card className="border-indigo-200/60 bg-indigo-50/50 dark:border-indigo-900/40 dark:bg-indigo-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-indigo-500" />
              Prévia do seed inicial
            </CardTitle>
            <CardDescription>
              Use esta carga inicial para preencher os cadastros faltantes sem depender da planilha original.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <SeedSummaryTile
                title="Base de Itens"
                existingCount={seedPreview.baseItens.existingCount}
                suggestedCount={seedPreview.baseItens.suggestedCount}
              />
              <SeedSummaryTile
                title="Bagagitos"
                existingCount={seedPreview.bagagitos.existingCount}
                suggestedCount={seedPreview.bagagitos.suggestedCount}
              />
              <SeedSummaryTile
                title="Geral"
                existingCount={seedPreview.geral.existingCount}
                suggestedCount={seedPreview.geral.suggestedCount}
                helper={`${seedPreview.geral.uncategorizedCount} itens começarão em "Sem categoria"`}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <SeedPreviewList title="Base de Itens" items={seedPreview.baseItens.sample} />
              <SeedPreviewList title="Bagagitos" items={seedPreview.bagagitos.sample} />
              <SeedPreviewList title="Geral" items={seedPreview.geral.sample} />
            </div>

            {seedPreview.bagagitos.lowConfidencePreview.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-900/60 dark:bg-amber-950/20">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="size-4" />
                  Prefixo `4` não será usado sozinho como regra de bagagito
                </div>
                <p className="mb-3 text-sm text-amber-700/90 dark:text-amber-300/90">
                  Os itens abaixo aparecem só como revisão manual opcional porque o prefixo `4` trouxe muitos falsos positivos na base atual.
                </p>
                <div className="flex flex-wrap gap-2">
                  {seedPreview.bagagitos.lowConfidencePreview.map((item) => (
                    <Badge key={item.cod_referencia} variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300">
                      {item.cod_referencia}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ReportKey)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="base_itens">Base de Itens</TabsTrigger>
          <TabsTrigger value="bagagitos">Bagagitos</TabsTrigger>
          <TabsTrigger value="geral">Geral</TabsTrigger>
        </TabsList>

        {REPORT_KEYS.map((key) => (
          <TabsContent key={key} value={key} className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>
                    {key === 'base_itens'
                      ? 'Itens Principais'
                      : key === 'bagagitos'
                        ? 'Linha de Bagagitos'
                        : 'Linha Completa (Geral)'}
                  </CardTitle>
                  <CardDescription>
                    Listagem de itens cadastrados para o relatório de {key.replace('_', ' ')}.
                  </CardDescription>
                </div>

                {key === 'geral' && (
                  <Button
                    variant={showOnlyNeedsReview ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowOnlyNeedsReview((value) => !value)}
                  >
                    <AlertTriangle className="mr-2 size-4" />
                    {showOnlyNeedsReview ? 'Mostrar todos' : 'Somente sem categoria'}
                  </Button>
                )}
              </CardHeader>

              <CardContent>
                {loading ? (
                  <div className="flex justify-center p-8 text-blue-500">
                    <Loader2 className="size-8 animate-spin" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left font-medium text-muted-foreground">
                          <th className="p-2 w-32">Cód. Referência</th>
                          <th className="p-2">Descrição (Label)</th>
                          {key === 'geral' && <th className="p-2">Categoria</th>}
                          <th className="p-2">Campos Extra</th>
                          <th className="p-2 w-24">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isAdding && key === activeTab && (
                          <EditRow
                            form={editForm}
                            setForm={setEditForm}
                            onSave={handleAdd}
                            onCancel={() => setIsAdding(false)}
                            reportKey={key}
                          />
                        )}

                        {visibleItems.length === 0 && !isAdding ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-muted-foreground">
                              Nenhum item cadastrado.
                            </td>
                          </tr>
                        ) : (
                          visibleItems.map((item) => {
                            const needsReview =
                              key === 'geral' &&
                              (!item.categoria || item.categoria.trim() === '' || item.categoria === 'Sem categoria');

                            return editingId === item.id ? (
                              <EditRow
                                key={item.id}
                                form={editForm}
                                setForm={setEditForm}
                                onSave={() => void handleSave(item.id)}
                                onCancel={() => setEditingId(null)}
                                reportKey={key}
                              />
                            ) : (
                              <tr
                                key={item.id}
                                className={`border-b transition-colors hover:bg-muted/50 ${
                                  needsReview ? 'bg-amber-50/60 dark:bg-amber-950/10' : ''
                                }`}
                              >
                                <td className="p-2 font-mono">{item.cod_referencia}</td>
                                <td className="p-2">{item.label}</td>
                                {key === 'geral' && (
                                  <td className="p-2">
                                    {needsReview ? (
                                      <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300">
                                        {item.categoria || 'Sem categoria'}
                                      </Badge>
                                    ) : (
                                      item.categoria
                                    )}
                                  </td>
                                )}
                                <td className="p-2">
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries(item.extra_data || {}).map(([field, value]) =>
                                      value ? (
                                        <Badge key={field} variant="secondary" className="text-[10px] uppercase">
                                          {field}: {value}
                                        </Badge>
                                      ) : null
                                    )}
                                  </div>
                                </td>
                                <td className="p-2">
                                  <div className="flex gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={() => handleEdit(item)}
                                    >
                                      <Edit2 className="size-3.5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-destructive"
                                      onClick={() => void handleDelete(item.id)}
                                    >
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
    </>
  );
}

function SeedSummaryTile({
  title,
  existingCount,
  suggestedCount,
  helper,
}: {
  title: string;
  existingCount: number;
  suggestedCount: number;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/70 p-4 dark:border-slate-800/70 dark:bg-slate-950/30">
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">
          {suggestedCount}
        </span>
        <span className="text-xs font-medium uppercase tracking-[0.15em] text-slate-400">
          sugestões
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {existingCount} itens já cadastrados.
      </p>
      {helper && (
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{helper}</p>
      )}
    </div>
  );
}

function SeedPreviewList({
  title,
  items,
}: {
  title: string;
  items: ConfigSeedSuggestion[];
}) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/70 p-4 dark:border-slate-800/70 dark:bg-slate-950/30">
      <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhuma sugestão pendente.
          </p>
        ) : (
          items.map((item) => (
            <div
              key={`${title}-${item.cod_referencia}`}
              className="rounded-xl border border-slate-200/70 px-3 py-2 text-sm dark:border-slate-800/70"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                  {item.cod_referencia}
                </span>
                <span className="text-xs text-slate-400">
                  {item.total_valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                {item.label}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function EditRow({
  form,
  setForm,
  onSave,
  onCancel,
  reportKey,
}: {
  form: EditableForm;
  setForm: React.Dispatch<React.SetStateAction<EditableForm>>;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
  reportKey: ReportKey;
}) {
  const extraFields = EXTRA_FIELDS[reportKey];

  return (
    <tr className="animate-in fade-in bg-blue-50/50 duration-200 dark:bg-blue-900/10">
      <td className="p-2">
        <Input
          placeholder="Cód. Ref"
          value={form.cod_referencia || ''}
          onChange={(event) =>
            setForm((current) => ({ ...current, cod_referencia: event.target.value }))
          }
          className="h-8 text-xs font-mono"
        />
      </td>
      <td className="p-2">
        <Input
          placeholder="Descrição"
          value={form.label || ''}
          onChange={(event) =>
            setForm((current) => ({ ...current, label: event.target.value }))
          }
          className="h-8 text-xs"
        />
      </td>
      {reportKey === 'geral' && (
        <td className="p-2">
          <Input
            placeholder="Categoria"
            value={form.categoria || ''}
            onChange={(event) =>
              setForm((current) => ({ ...current, categoria: event.target.value }))
            }
            className="h-8 text-xs"
          />
        </td>
      )}
      <td className="p-2">
        <div className="grid grid-cols-3 gap-1">
          {extraFields.map((field) => (
            <Input
              key={field}
              placeholder={field.replace('_', ' ')}
              value={form.extra_data?.[field] || ''}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  extra_data: {
                    ...current.extra_data,
                    [field]: event.target.value,
                  },
                }))
              }
              className="h-7 text-[10px] uppercase"
            />
          ))}
        </div>
      </td>
      <td className="p-2">
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="default"
            className="h-8 w-8 bg-green-600 hover:bg-green-700"
            onClick={() => void onSave()}
          >
            <Save className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onCancel}>
            <X className="size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
