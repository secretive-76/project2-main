import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/components/providers/auth-provider';
import { generateTitle } from '@/lib/ai-engine';

export interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; created_at: string; }
export interface ChatConversation { id: string; title: string; created_at: string; updated_at: string; }

function toConversation(raw: { id: number; title: string; created_at: string; updated_at: string }): ChatConversation {
  return { ...raw, id: String(raw.id) };
}
function toMessage(raw: { id: number; role: 'user' | 'assistant'; content: string; created_at: string }): ChatMessage {
  return { ...raw, id: String(raw.id) };
}

export function useChat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const streamTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadConversations = useCallback(async () => {
    if (!user) { setLoadingConversations(false); return; }
    try {
      const data = await apiRequest('/student/ai/conversations') as { conversations?: Array<{ id: number; title: string; created_at: string; updated_at: string }> };
      setConversations((data.conversations ?? []).map(toConversation));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI Coach could not load conversations.';
      setError(message);
      console.error('Failed to load AI conversations:', error);
    }
    finally { setLoadingConversations(false); }
  }, [user]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const data = await apiRequest(`/student/ai/messages?conversation_id=${encodeURIComponent(conversationId)}`) as { messages?: Array<{ id: number; role: 'user' | 'assistant'; content: string; created_at: string }> };
      setMessages((data.messages ?? []).map(toMessage));
    } catch (error) { console.error('Failed to load AI messages:', error); }
    finally { setLoadingMessages(false); }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { if (activeConversationId) loadMessages(activeConversationId); else setMessages([]); }, [activeConversationId, loadMessages]);

  const streamResponse = useCallback((fullText: string, onComplete: () => void) => {
    setStreamingText(''); let index = 0;
    if (streamTimer.current) clearInterval(streamTimer.current);
    streamTimer.current = setInterval(() => {
      index += Math.max(1, Math.floor(fullText.length / 120));
      setStreamingText(fullText.slice(0, index));
      if (index >= fullText.length) { if (streamTimer.current) clearInterval(streamTimer.current); setStreamingText(''); onComplete(); }
    }, 16);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!user || !text.trim() || sending) return;
    setError(null);
    setSending(true);
    try {
      let conversationId = activeConversationId;
      if (!conversationId) {
        const created = await apiRequest('/student/ai/conversation', { method: 'POST', body: JSON.stringify({ title: generateTitle(text) }) }) as { id: number; title: string; created_at: string; updated_at: string };
        const conversation = toConversation(created);
        conversationId = conversation.id;
        setActiveConversationId(conversationId);
        setConversations((current) => [conversation, ...current]);
      }
      const savedUser = await apiRequest('/student/ai/message', { method: 'POST', body: JSON.stringify({ conversation_id: Number(conversationId), role: 'user', content: text.trim() }) }) as { id: number; role: 'user'; content: string; created_at: string };
      setMessages((current) => [...current, toMessage(savedUser)]);
      const generated = await apiRequest('/student/ai/generate-live', { method: 'POST', body: JSON.stringify({ prompt: text.trim() }) }) as { content: string };
      const response = generated.content;
      streamResponse(response, async () => {
        try {
          const savedAssistant = await apiRequest('/student/ai/message', { method: 'POST', body: JSON.stringify({ conversation_id: Number(conversationId), role: 'assistant', content: response }) }) as { id: number; role: 'assistant'; content: string; created_at: string };
          setMessages((current) => [...current, toMessage(savedAssistant)]);
          loadConversations();
        } catch (error) { console.error('Failed to save AI response:', error); }
        finally { setSending(false); }
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'AI Coach could not generate a response.');
      setSending(false);
      console.error('Failed to send AI message:', error);
    }
  }, [user, activeConversationId, sending, streamResponse, loadConversations]);

  const newConversation = useCallback(() => { if (streamTimer.current) clearInterval(streamTimer.current); setActiveConversationId(null); setMessages([]); setStreamingText(''); setSending(false); }, []);
  const deleteConversation = useCallback(async (conversationId: string) => { setConversations((current) => current.filter((item) => item.id !== conversationId)); if (activeConversationId === conversationId) newConversation(); }, [activeConversationId, newConversation]);
  useEffect(() => () => { if (streamTimer.current) clearInterval(streamTimer.current); }, []);

  return { conversations, activeConversationId, messages, loadingConversations, loadingMessages, sending, streamingText, error, setActiveConversationId, sendMessage, newConversation, deleteConversation };
}
