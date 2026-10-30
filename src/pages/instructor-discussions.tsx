import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, CheckCircle, Clock, MessageSquare, Search, Send, User } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { apiRequest, resolveBackendAssetUrl } from '@/lib/api';

interface DiscussionCourse { id: string; title: string; thumbnail_url: string; discussion_count: number; }
interface DiscussionThread { id: number; title: string; content: string; status: 'needs_answer' | 'answered'; created_at: string; reply_count: number; student: { id: number; name: string; email: string }; }
interface Reply { id: number; content: string; created_at: string; user: { id: number; name: string; role: string }; }
const formatDate = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function InstructorDiscussionsPage() {
  const { courseId } = useParams<{ courseId?: string }>();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<DiscussionCourse[]>([]);
  const [threads, setThreads] = useState<DiscussionThread[]>([]);
  const [activeThread, setActiveThread] = useState<DiscussionThread | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyText, setReplyText] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'needs_answer' | 'answered'>('all');
  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const loadCourses = async () => {
      try { const data = await apiRequest('/instructor/discussions/courses') as { courses?: DiscussionCourse[] }; setCourses(data.courses ?? []); }
      catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load discussion courses.'); }
      finally { setLoading(false); }
    };
    void loadCourses();
  }, []);

  useEffect(() => {
    if (!courseId) { setThreads([]); return; }
    const loadThreads = async () => {
      setLoading(true);
      try { const data = await apiRequest(`/instructor/discussions/course?course_id=${encodeURIComponent(courseId)}`) as { discussions?: DiscussionThread[] }; setThreads(data.discussions ?? []); }
      catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load discussions.'); }
      finally { setLoading(false); }
    };
    void loadThreads();
  }, [courseId]);

  const openThread = async (thread: DiscussionThread) => {
    setActiveThread(thread); setReplies([]); setReplyText(''); setModalLoading(true);
    try { const data = await apiRequest(`/instructor/discussions?discussion_id=${thread.id}`) as { replies?: Reply[] }; setReplies(data.replies ?? []); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load replies.'); }
    finally { setModalLoading(false); }
  };

  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeThread || !replyText.trim()) return;
    setSending(true);
    try {
      await apiRequest(`/instructor/discussions?discussion_id=${activeThread.id}`, { method: 'POST', body: JSON.stringify({ content: replyText.trim() }) });
      const data = await apiRequest(`/instructor/discussions?discussion_id=${activeThread.id}`) as { replies?: Reply[] };
      const nextReplies = data.replies ?? [];
      setReplies(nextReplies); setReplyText('');
      setThreads((current) => current.map((item) => item.id === activeThread.id ? { ...item, status: 'answered', reply_count: nextReplies.length } : item));
      setActiveThread((current) => current ? { ...current, status: 'answered', reply_count: nextReplies.length } : current);
      toast.success('Reply posted successfully.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save reply.'); }
    finally { setSending(false); }
  };

  const selectedCourse = courses.find((course) => course.id === courseId);
  const filteredThreads = threads.filter((thread) => {
    const text = `${thread.title} ${thread.content} ${thread.student.name}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (status === 'all' || thread.status === status);
  });

  if (!courseId) return (
    <div className="space-y-6 pb-10">
      <div><h1 className="text-3xl font-bold tracking-tight">Discussions & Q&A</h1><p className="mt-1 text-muted-foreground">Choose a course to review its student questions.</p></div>
      {loading ? <Card className="p-12 text-center"><p className="text-sm text-muted-foreground">Loading courses…</p></Card> : courses.length === 0 ? <Card className="p-12 text-center"><MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" /><p className="text-sm text-muted-foreground">No courses are assigned to you.</p></Card> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{courses.map((course) => <button key={course.id} type="button" onClick={() => navigate(`/instructor/discussions/${encodeURIComponent(course.id)}`)} className="overflow-hidden rounded-lg border bg-card text-left transition-colors hover:border-primary"><div className="aspect-video bg-muted">{course.thumbnail_url && <img src={resolveBackendAssetUrl(course.thumbnail_url)} alt="" className="h-full w-full object-cover" />}</div><div className="p-5"><BookOpen className="mb-3 h-5 w-5 text-primary" /><h2 className="font-semibold">{course.title}</h2><p className="mt-1 text-sm text-muted-foreground">{course.discussion_count} discussion{course.discussion_count === 1 ? '' : 's'}</p></div></button>)}</div>}
    </div>
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><Button variant="ghost" size="sm" onClick={() => navigate('/instructor/discussions')}><ArrowLeft className="mr-1 h-4 w-4" /> All courses</Button><h1 className="mt-2 text-3xl font-bold tracking-tight">{selectedCourse?.title ?? 'Course discussions'}</h1><p className="mt-1 text-muted-foreground">Review and answer student questions.</p></div></div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="relative max-w-sm flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search discussions or students..." className="pl-9" /></div><div className="flex gap-2"><Button size="sm" variant={status === 'all' ? 'default' : 'outline'} onClick={() => setStatus('all')}>All</Button><Button size="sm" variant={status === 'needs_answer' ? 'default' : 'outline'} onClick={() => setStatus('needs_answer')}>Needs answer</Button><Button size="sm" variant={status === 'answered' ? 'default' : 'outline'} onClick={() => setStatus('answered')}>Answered</Button></div></div>
      {loading ? <Card className="p-12 text-center"><p className="text-sm text-muted-foreground">Loading discussions…</p></Card> : filteredThreads.length === 0 ? <Card className="p-12 text-center"><MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" /><p className="text-sm text-muted-foreground">No discussions found.</p></Card> : <div className="grid gap-4">{filteredThreads.map((thread) => <Card key={thread.id} onClick={() => void openThread(thread)} className="cursor-pointer transition-colors hover:border-primary"><CardContent className="p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{thread.title}</h2><Badge variant="outline" className={thread.status === 'answered' ? 'text-emerald-600' : 'text-amber-600'}>{thread.status === 'answered' ? <><CheckCircle className="mr-1 h-3 w-3" /> Answered</> : 'Needs answer'}</Badge></div><p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{thread.content}</p></div><span className="text-xs text-muted-foreground">{thread.reply_count} replies</span></div><div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {thread.student.name}</span><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatDate(thread.created_at)}</span></div></CardContent></Card>)}</div>}
      <Dialog open={Boolean(activeThread)} onOpenChange={(open) => { if (!open) setActiveThread(null); }}><DialogContent className="flex max-h-[90vh] max-w-2xl flex-col"><DialogHeader><DialogTitle>{activeThread?.title}</DialogTitle><DialogDescription>{activeThread?.student.name} ({activeThread?.student.email})</DialogDescription></DialogHeader><div className="flex-1 space-y-4 overflow-y-auto py-2"><div className="rounded-lg border bg-card p-4 text-sm">{activeThread?.content}</div>{modalLoading ? <p className="text-sm text-muted-foreground">Loading replies…</p> : replies.length === 0 ? <p className="text-sm italic text-muted-foreground">No replies yet.</p> : replies.map((reply) => <div key={reply.id} className={`rounded-lg border p-4 text-sm ${reply.user.role === 'instructor' ? 'ml-8 bg-primary/5' : 'mr-8 bg-muted/50'}`}><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{reply.user.name}</span><span>{formatDate(reply.created_at)}</span></div><p className="whitespace-pre-wrap">{reply.content}</p></div>)}</div><form onSubmit={sendReply} className="flex gap-2 border-t pt-4"><Textarea value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder="Write an instructor reply..." rows={2} /><Button type="submit" disabled={sending || !replyText.trim()}><Send className="mr-2 h-4 w-4" /> Reply</Button></form></DialogContent></Dialog>
    </div>
  );
}
