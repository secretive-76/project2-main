import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/components/providers/auth-provider';
import type { CourseMessage } from '@/types';

export function useCourseMessages(courseId: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<CourseMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    if (!user || !courseId) { setLoading(false); return; }
    try {
      const data = await apiRequest(`/student/course-messages?course_id=${encodeURIComponent(courseId)}`) as { messages?: CourseMessage[] };
      setMessages(data.messages ?? []);
    } catch (error) {
      setError('Messages could not load. Start the Go backend, then refresh this page.');
      console.error('Failed to load course messages:', error);
    } finally {
      setLoading(false);
    }
  }, [user, courseId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  const sendMessage = useCallback(async (content: string) => {
    if (!user || !content.trim() || sending) return;
    setError(null);
    setSending(true);
    try {
      const message = await apiRequest('/student/course-message', {
        method: 'POST',
        body: JSON.stringify({ course_id: courseId, content: content.trim() }),
      }) as CourseMessage;
      setMessages((current) => [...current, message]);
    } catch (error) {
      setError('Message could not be sent. Please try again.');
      console.error('Failed to send course message:', error);
    } finally {
      setSending(false);
    }
  }, [user, courseId, sending]);

  return { messages, loading, sending, error, sendMessage, scrollRef };
}
