import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRouteUser } from '@/lib/auth';
import { isAIReportChatEnabled } from '@/lib/server/env';
import { consumeAIRateLimit } from '@/lib/server/rateLimit';
import { answerReportChat } from '@/lib/server/reportChat';
import { hasAIReportChatAccess } from '@/lib/server/reportChatAccess';
import {
  createReportChatConversation,
  deleteReportChatConversation,
  getOwnedReportChatConversation,
  insertReportChatMessage,
  listRecentReportChatMessages,
  listReportChatConversations,
  listReportChatMessages,
  touchReportChatConversation,
} from '@/lib/server/reportChatHistory';
import { requireSameOrigin } from '@/lib/server/requestSecurity';
import type { ReportChatResponse } from '@/types/reportChat';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_PERSISTED_ASSISTANT_LENGTH = 8000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unavailable(reason: 'disabled' | 'missing_api_key' | 'plan_required') {
  return NextResponse.json({ available: false, reason } satisfies ReportChatResponse);
}

function rateLimited(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: 'Limite de uso da IA atingido. Aguarde um pouco e tente novamente.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  );
}

async function requireChatAccess() {
  const { supabase, user, response } = await requireAuthenticatedRouteUser();
  if (response || !user) {
    return { error: response || NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!isAIReportChatEnabled()) return { error: unavailable('disabled') };

  try {
    if (!(await hasAIReportChatAccess(supabase))) {
      return { error: unavailable('plan_required') };
    }
  } catch (error) {
    console.error('Error checking report chat access:', error instanceof Error ? error.message : 'unknown');
    return { error: NextResponse.json({ error: 'Nao foi possivel validar o acesso ao chat.' }, { status: 500 }) };
  }

  return { supabase, user };
}

export async function GET(request: NextRequest) {
  const context = await requireChatAccess();
  if (context.error || !context.supabase) return context.error;

  try {
    const conversationId = request.nextUrl.searchParams.get('conversationId');
    if (!conversationId) {
      return NextResponse.json({ conversations: await listReportChatConversations(context.supabase) });
    }
    if (!UUID_PATTERN.test(conversationId)) {
      return NextResponse.json({ error: 'Conversa invalida.' }, { status: 400 });
    }

    const conversation = await getOwnedReportChatConversation(context.supabase, conversationId);
    if (!conversation) return NextResponse.json({ error: 'Conversa nao encontrada.' }, { status: 404 });

    return NextResponse.json({
      conversation,
      messages: await listReportChatMessages(context.supabase, conversationId),
    });
  } catch (error) {
    console.error('Error loading report chat history:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Nao foi possivel carregar o historico.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const context = await requireChatAccess();
  if (context.error || !context.supabase || !context.user) return context.error;
  if (!process.env.OPENAI_API_KEY) return unavailable('missing_api_key');

  try {
    const body = (await request.json().catch(() => ({}))) as {
      conversationId?: unknown;
      content?: unknown;
    };
    if (typeof body.content !== 'string' || !body.content.trim() || body.content.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: 'Envie uma pergunta valida com ate 2000 caracteres.' }, { status: 400 });
    }

    const rateLimit = await consumeAIRateLimit(context.supabase, 'ai_report_chat');
    if (!rateLimit.allowed) return rateLimited(rateLimit.retryAfterSeconds);

    let conversation;
    if (body.conversationId === undefined || body.conversationId === null) {
      conversation = await createReportChatConversation(context.supabase, context.user.id, body.content);
    } else {
      if (typeof body.conversationId !== 'string' || !UUID_PATTERN.test(body.conversationId)) {
        return NextResponse.json({ error: 'Conversa invalida.' }, { status: 400 });
      }
      conversation = await getOwnedReportChatConversation(context.supabase, body.conversationId);
      if (!conversation) return NextResponse.json({ error: 'Conversa nao encontrada.' }, { status: 404 });
    }

    await insertReportChatMessage(context.supabase, context.user.id, conversation.id, 'user', body.content.trim());
    const recentMessages = await listRecentReportChatMessages(context.supabase, conversation.id);
    const content = (await answerReportChat(context.supabase, recentMessages))
      .slice(0, MAX_PERSISTED_ASSISTANT_LENGTH);
    const message = await insertReportChatMessage(context.supabase, context.user.id, conversation.id, 'assistant', content);
    conversation = await touchReportChatConversation(context.supabase, conversation.id);

    return NextResponse.json({ available: true, conversation, message } satisfies ReportChatResponse);
  } catch (error) {
    console.error('Error answering report chat:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Nao foi possivel responder agora. Tente reformular a pergunta.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const context = await requireChatAccess();
  if (context.error || !context.supabase) return context.error;

  try {
    const { conversationId } = (await request.json().catch(() => ({}))) as { conversationId?: unknown };
    if (typeof conversationId !== 'string' || !UUID_PATTERN.test(conversationId)) {
      return NextResponse.json({ error: 'Conversa invalida.' }, { status: 400 });
    }

    const conversation = await getOwnedReportChatConversation(context.supabase, conversationId);
    if (!conversation) return NextResponse.json({ error: 'Conversa nao encontrada.' }, { status: 404 });
    await deleteReportChatConversation(context.supabase, conversationId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting report chat conversation:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Nao foi possivel excluir a conversa.' }, { status: 500 });
  }
}
