'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, Loader2, MessageSquare, MessageSquarePlus, Send, Sparkles, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/use-confirm';
import type { ReportChatConversation, ReportChatMessage, ReportChatResponse } from '@/types/reportChat';

const SUGGESTIONS = [
  'Quais clientes mais faturaram no último ano disponível?',
  'Quais produtos caíram em relação ao ano anterior?',
  'Resuma o desempenho comercial do último ano disponível.',
  'Quais oportunidades comerciais merecem atenção?',
];

function getUnavailableMessage(reason: string) {
  if (reason === 'disabled') return 'O chat está temporariamente desativado.';
  if (reason === 'missing_api_key') return 'A integração com IA ainda não foi configurada.';
  return 'O Chat IA está disponível para contas do Plano 3.';
}

export function ReportChat() {
  const [conversations, setConversations] = useState<ReportChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ReportChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    void loadConversations();
  }, []);

  async function loadConversations(selectConversation = true) {
    setLoadingHistory(true);
    try {
      const response = await fetch('/api/ai/report-chat');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar conversas.');
      const nextConversations = (data.conversations ?? []) as ReportChatConversation[];
      setConversations(nextConversations);
      if (selectConversation && !activeConversationId && nextConversations[0]) {
        await openConversation(nextConversations[0].id);
      }
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : 'Erro ao carregar conversas.');
    } finally {
      setLoadingHistory(false);
    }
  }

  async function openConversation(conversationId: string) {
    setLoadingHistory(true);
    setError(null);
    try {
      const response = await fetch(`/api/ai/report-chat?conversationId=${encodeURIComponent(conversationId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao abrir conversa.');
      setActiveConversationId(conversationId);
      setMessages(data.messages ?? []);
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : 'Erro ao abrir conversa.');
    } finally {
      setLoadingHistory(false);
    }
  }

  async function sendQuestion(content: string) {
    const trimmed = content.trim();
    if (!trimmed || loading) return;

    const optimisticMessage = { role: 'user', content: trimmed } satisfies ReportChatMessage;
    setMessages((current) => [...current, optimisticMessage]);
    setQuestion('');
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/ai/report-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: activeConversationId, content: trimmed }),
      });
      const json = (await response.json().catch(() => null)) as ReportChatResponse | { error?: string } | null;
      if (!response.ok) {
        throw new Error(json && 'error' in json ? json.error ?? 'Erro ao consultar a IA.' : 'Erro ao consultar a IA.');
      }
      if (!json || !('available' in json)) throw new Error('Resposta inválida da IA.');
      if (!json.available) throw new Error(getUnavailableMessage(json.reason));

      setActiveConversationId(json.conversation.id);
      setMessages((current) => [...current, json.message]);
      setConversations((current) => [
        json.conversation,
        ...current.filter((conversation) => conversation.id !== json.conversation.id),
      ]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível consultar a IA.');
    } finally {
      setLoading(false);
    }
  }

  async function deleteConversation(conversationId: string) {
    const confirmed = await confirm({
      title: 'Excluir esta conversa?',
      description: 'Esta ação não pode ser desfeita. O histórico de mensagens será perdido.',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      variant: 'destructive',
    });
    if (!confirmed) return;

    try {
      const response = await fetch('/api/ai/report-chat', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao excluir conversa.');

      const remaining = conversations.filter((conversation) => conversation.id !== conversationId);
      setConversations(remaining);
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
        setMessages([]);
        if (remaining[0]) await openConversation(remaining[0].id);
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Erro ao excluir conversa.');
    }
  }

  function startNewConversation() {
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
  }

  return (
    <>
    <ConfirmDialog />
    <div className="mx-auto grid min-h-[calc(100vh-9rem)] max-w-7xl gap-5 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-[2rem] border border-white/10 p-4 glass-card">
        <Button onClick={startNewConversation} className="w-full bg-indigo-600 text-white hover:bg-indigo-700">
          <MessageSquarePlus className="mr-2 h-4 w-4" />Nova conversa
        </Button>
        <p className="mt-6 px-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Histórico</p>
        <div className="mt-3 space-y-2">
          {loadingHistory && conversations.length === 0 ? (
            <p className="flex items-center gap-2 px-2 py-3 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Carregando...</p>
          ) : conversations.length === 0 ? (
            <p className="px-2 py-3 text-sm text-slate-500">Nenhuma conversa salva.</p>
          ) : conversations.map((conversation) => (
            <div key={conversation.id} className={`group flex items-center gap-1 rounded-xl border ${activeConversationId === conversation.id ? 'border-indigo-500/40 bg-indigo-500/15' : 'border-transparent hover:bg-white/5'}`}>
              <button type="button" onClick={() => void openConversation(conversation.id)} className="min-w-0 flex-1 px-3 py-3 text-left">
                <p className="truncate text-sm font-medium text-slate-200">{conversation.title}</p>
                <p className="mt-1 text-[11px] text-slate-500">{new Date(conversation.updatedAt).toLocaleDateString('pt-BR')}</p>
              </button>
              <button type="button" onClick={() => void deleteConversation(conversation.id)} aria-label="Excluir conversa" className="mr-2 rounded-lg p-2 text-slate-500 opacity-100 transition-colors hover:bg-rose-500/10 hover:text-rose-400 lg:opacity-0 lg:group-hover:opacity-100">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-indigo-500/20 p-6 glass-card sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-indigo-400">
              <Sparkles className="h-4 w-4" />Plano 3
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Chat IA dos Relatorios</h1>
            <p className="mt-2 text-sm text-slate-400">Pergunte sobre clientes, produtos, faturamento e oportunidades comerciais.</p>
          </div>
          <MessageSquare className="hidden h-10 w-10 text-indigo-400 sm:block" />
        </header>

        <section className="flex flex-1 flex-col rounded-[2rem] p-5 glass-card">
          <div className="flex-1 space-y-4 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="mx-auto max-w-2xl py-10 text-center">
                <Bot className="mx-auto h-12 w-12 text-indigo-400" />
                <h2 className="mt-4 text-xl font-bold text-white">Como posso ajudar na análise?</h2>
                <p className="mt-2 text-sm text-slate-400">Escolha uma sugestão ou escreva sua pergunta. As respostas usam somente os relatórios autorizados para sua conta.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button key={suggestion} type="button" onClick={() => void sendQuestion(suggestion)} className="rounded-2xl border border-white/10 bg-[#030712]/50 p-4 text-left text-sm text-slate-300 transition-colors hover:border-indigo-500/40 hover:bg-indigo-500/10">
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : messages.map((message, index) => (
              <div key={message.id ?? `${message.role}-${index}`} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && <Bot className="mt-2 h-5 w-5 shrink-0 text-indigo-400" />}
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === 'user' ? 'whitespace-pre-wrap bg-indigo-600 text-white' : 'border border-white/10 bg-[#030712]/60 text-slate-200'}`}>
                  {message.role === 'assistant' ? <AssistantMarkdown content={message.content} /> : message.content}
                </div>
                {message.role === 'user' && <User className="mt-2 h-5 w-5 shrink-0 text-slate-400" />}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />Consultando os relatórios autorizados...
              </div>
            )}
          </div>

          {error && <p className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p>}

          <form onSubmit={(event) => { event.preventDefault(); void sendQuestion(question); }} className="mt-5 flex gap-3 border-t border-white/10 pt-5">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="Ex.: qual foi meu melhor cliente em 2026?"
              className="min-h-14 flex-1 resize-none rounded-xl border border-white/10 bg-[#030712]/60 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-500"
            />
            <Button type="submit" disabled={loading || !question.trim()} className="h-auto bg-indigo-600 px-5 text-white hover:bg-indigo-700">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </section>
      </div>
    </div>
    </>
  );
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-indigo-300 underline underline-offset-2" />,
        p: ({ node: _node, ...props }) => <p {...props} className="mb-3 last:mb-0" />,
        ul: ({ node: _node, ...props }) => <ul {...props} className="mb-3 list-disc space-y-1 pl-5 last:mb-0" />,
        ol: ({ node: _node, ...props }) => <ol {...props} className="mb-3 list-decimal space-y-1 pl-5 last:mb-0" />,
        code: ({ node: _node, ...props }) => <code {...props} className="rounded bg-white/10 px-1 py-0.5 font-mono text-xs text-indigo-200" />,
        pre: ({ node: _node, ...props }) => <pre {...props} className="mb-3 overflow-x-auto rounded-xl bg-black/30 p-3 last:mb-0" />,
        strong: ({ node: _node, ...props }) => <strong {...props} className="font-bold text-white" />,
        em: ({ node: _node, ...props }) => <em {...props} className="italic text-slate-100" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
