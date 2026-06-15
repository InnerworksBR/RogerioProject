import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReportChatConversation, ReportChatMessage, ReportChatRole } from '@/types/reportChat';

type DbClient = SupabaseClient<any, 'public', any>;

function mapConversation(row: any): ReportChatConversation {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: any): ReportChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

export function buildConversationTitle(content: string) {
  const title = content.replace(/\s+/g, ' ').trim();
  return title.length <= 64 ? title : `${title.slice(0, 61)}...`;
}

export async function listReportChatConversations(supabase: DbClient) {
  const { data, error } = await supabase
    .from('report_chat_conversations')
    .select('id, title, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(30);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapConversation);
}

export async function createReportChatConversation(
  supabase: DbClient,
  userId: string,
  firstQuestion: string
) {
  const { data, error } = await supabase
    .from('report_chat_conversations')
    .insert({ user_id: userId, title: buildConversationTitle(firstQuestion) })
    .select('id, title, created_at, updated_at')
    .single();

  if (error) throw new Error(error.message);
  return mapConversation(data);
}

export async function getOwnedReportChatConversation(
  supabase: DbClient,
  conversationId: string
) {
  const { data, error } = await supabase
    .from('report_chat_conversations')
    .select('id, title, created_at, updated_at')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapConversation(data) : null;
}

export async function listReportChatMessages(
  supabase: DbClient,
  conversationId: string,
  limit = 100
) {
  const { data, error } = await supabase
    .from('report_chat_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapMessage);
}

export async function listRecentReportChatMessages(
  supabase: DbClient,
  conversationId: string,
  limit = 20
) {
  const { data, error } = await supabase
    .from('report_chat_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).reverse().map(mapMessage);
}

export async function insertReportChatMessage(
  supabase: DbClient,
  userId: string,
  conversationId: string,
  role: ReportChatRole,
  content: string
) {
  const { data, error } = await supabase
    .from('report_chat_messages')
    .insert({ user_id: userId, conversation_id: conversationId, role, content })
    .select('id, role, content, created_at')
    .single();

  if (error) throw new Error(error.message);
  return mapMessage(data);
}

export async function touchReportChatConversation(
  supabase: DbClient,
  conversationId: string
) {
  const { data, error } = await supabase
    .from('report_chat_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .select('id, title, created_at, updated_at')
    .single();

  if (error) throw new Error(error.message);
  return mapConversation(data);
}

export async function deleteReportChatConversation(
  supabase: DbClient,
  conversationId: string
) {
  const { error } = await supabase
    .from('report_chat_conversations')
    .delete()
    .eq('id', conversationId);

  if (error) throw new Error(error.message);
}
