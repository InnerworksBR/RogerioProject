export type ReportChatRole = 'user' | 'assistant';

export interface ReportChatMessage {
  id?: string;
  role: ReportChatRole;
  content: string;
  createdAt?: string;
}

export interface ReportChatConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export type ReportChatUnavailableReason =
  | 'disabled'
  | 'missing_api_key'
  | 'plan_required';

export interface ReportChatSuccessResponse {
  available: true;
  conversation: ReportChatConversation;
  message: ReportChatMessage;
}

export interface ReportChatUnavailableResponse {
  available: false;
  reason: ReportChatUnavailableReason;
}

export type ReportChatResponse =
  | ReportChatSuccessResponse
  | ReportChatUnavailableResponse;
