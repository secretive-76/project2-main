import { useEffect, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/api';
import { toast } from 'sonner';

type Message = { id: number; student_id: number; course_id: string; sender_role: 'student' | 'instructor'; content: string; created_at: string; student_name: string };

export function InstructorMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState<Record<number, string>>({});
  const load = () => apiRequest('/instructor/course-messages').then((data: { messages?: Message[] }) => setMessages(data.messages ?? [])).catch(() => toast.error('Could not load student messages. Make sure this instructor is assigned to the course.'));
  useEffect(() => { load(); }, []);
  const send = async (message: Message) => {
    const content = reply[message.id]?.trim(); if (!content) return;
    try { await apiRequest('/instructor/course-message', { method: 'POST', body: JSON.stringify({ student_id: message.student_id, course_id: message.course_id, content }) }); setReply((current) => ({ ...current, [message.id]: '' })); toast.success('Reply sent to student.'); load(); }
    catch { toast.error('Could not send reply. Confirm this course is assigned to your instructor account.'); }
  };
  const studentMessages = messages.filter((message) => message.sender_role === 'student');
  return <div className="space-y-6 animate-in-slide"><PageHeader title="Student Messages" description="Reply to questions from students enrolled in your assigned courses." />
    {studentMessages.length === 0 ? <Card><CardContent className="p-10 text-center text-sm text-muted-foreground"><MessageSquare className="mx-auto mb-3 h-8 w-8" />No student messages yet.</CardContent></Card> : <div className="space-y-4">{studentMessages.map((message) => <Card key={message.id}><CardContent className="space-y-3 p-5"><div><p className="font-medium text-foreground">{message.student_name}</p><p className="text-xs text-muted-foreground">Course: {message.course_id}</p></div><p className="rounded-lg bg-muted p-3 text-sm">{message.content}</p><div className="flex gap-2"><Input value={reply[message.id] ?? ''} onChange={(event) => setReply((current) => ({ ...current, [message.id]: event.target.value }))} placeholder="Write a reply…" /><Button onClick={() => send(message)}><Send className="mr-2 h-4 w-4" />Reply</Button></div></CardContent></Card>)}</div>}
  </div>;
}
