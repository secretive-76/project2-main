import { useEffect, useState } from 'react';
import { Search, Mail, BookOpen, CheckCircle2, User, Clock, Award, FileText, ChevronRight, Send, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';

interface ModuleProgress {
  moduleName: string;
  hoursSpent: number;
  completedLectures: number;
  totalLectures: number;
}

interface Submission {
  id: string;
  title: string;
  type: 'Quiz' | 'Lab' | 'Assignment';
  score: string;
  submittedDate: string;
  status: 'Graded' | 'Pending';
}

interface ChatMessage {
  id: string;
  sender: 'instructor' | 'student';
  text: string;
  timestamp: string;
}

interface StudentCourse {
  courseId: string;
  enrolledCourse: string;
  progress: number;
  totalHoursSpent: number;
  lastActive: string;
  status: 'active' | 'completed' | 'at-risk';
  modules: ModuleProgress[];
  submissions: Submission[];
  messages: ChatMessage[];
}

interface Student {
  id: string;
  name: string;
  email: string;
  courses: StudentCourse[];
}

export function InstructorStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [newChatText, setNewChatText] = useState('');
  const [activeCourseId, setActiveCourseId] = useState('');

  const activeCourse = activeStudent?.courses.find((course) => course.courseId === activeCourseId) ?? activeStudent?.courses[0];

  const getStudentSummary = (student: Student) => ({
    progress: student.courses.length ? Math.round(student.courses.reduce((sum, course) => sum + course.progress, 0) / student.courses.length) : 0,
    totalHours: student.courses.reduce((sum, course) => sum + course.totalHoursSpent, 0),
    lastActive: student.courses.map((course) => course.lastActive).sort().at(-1) ?? '',
    status: student.courses.some((course) => course.status === 'at-risk') ? 'at-risk' : student.courses.every((course) => course.status === 'completed') ? 'completed' : 'active',
  });

  useEffect(() => {
    const loadStudents = async () => {
      setLoading(true);
      try {
        const data = await apiRequest('/instructor/students') as {
          students?: Array<{
            id: number;
            name: string;
            email: string;
            course_id: string;
            enrolled_course: string;
            progress: number;
            total_hours_spent: number;
            last_active: string;
            status: StudentCourse['status'];
            modules: Array<{ module_name: string; hours_spent: number; completed_lectures: number; total_lectures: number }>;
            submissions: Array<{ id: number; title: string; type: 'Quiz' | 'Lab' | 'Assignment'; score: string; submitted_date: string; status: 'Graded' | 'Pending' }>;
            messages: Array<{ id: number; sender: 'instructor' | 'student'; text: string; timestamp: string }>;
          }>;
        };
        const grouped = new Map<string, Student>();
        for (const student of data.students ?? []) {
          const course: StudentCourse = {
            courseId: student.course_id,
            enrolledCourse: student.enrolled_course,
            progress: student.progress,
            totalHoursSpent: student.total_hours_spent,
            lastActive: student.last_active,
            status: student.status,
            modules: student.modules.map((module) => ({ moduleName: module.module_name, hoursSpent: module.hours_spent, completedLectures: module.completed_lectures, totalLectures: module.total_lectures })),
            submissions: student.submissions.map((submission) => ({ id: String(submission.id), title: submission.title, type: submission.type, score: submission.score, submittedDate: submission.submitted_date, status: submission.status })),
            messages: student.messages.map((message) => ({ id: String(message.id), sender: message.sender, text: message.text, timestamp: message.timestamp })),
          };
          const existing = grouped.get(String(student.id));
          if (existing) existing.courses.push(course);
          else grouped.set(String(student.id), { id: String(student.id), name: student.name, email: student.email, courses: [course] });
        }
        setStudents([...grouped.values()]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not load students.');
      } finally {
        setLoading(false);
      }
    };

    void loadStudents();
  }, []);

  const filteredStudents = students.filter((stud) =>
    stud.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stud.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stud.courses.some((course) => course.enrolledCourse.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleOpenDetail = (student: Student) => {
    setActiveStudent(student);
    setActiveCourseId(student.courses[0]?.courseId ?? '');
    setIsDetailOpen(true);
  };

  const handleOpenChat = (e: React.MouseEvent, student: Student) => {
    e.stopPropagation();
    setActiveStudent(student);
    setActiveCourseId(student.courses[0]?.courseId ?? '');
    setIsChatOpen(true);
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatText.trim() || !activeStudent) return;

    try {
      if (!activeCourse) return;
      const data = await apiRequest('/instructor/course-message', {
        method: 'POST',
        body: JSON.stringify({
          student_id: Number(activeStudent.id),
          course_id: activeCourse.courseId,
          content: newChatText.trim(),
        }),
      }) as { id: number; sender_role: 'instructor'; content: string; created_at: string };
      const newMessage: ChatMessage = {
        id: String(data.id),
        sender: data.sender_role,
        text: data.content,
        timestamp: data.created_at,
      };
      const updatedCourses = activeStudent.courses.map((course) => course.courseId === activeCourse.courseId ? { ...course, messages: [...course.messages, newMessage] } : course);
      const updated = { ...activeStudent, courses: updatedCourses };
      setActiveStudent(updated);
      setStudents((current) => current.map((student) => student.id === updated.id ? updated : student));
      setNewChatText('');
      toast.success('Instruction / message sent to student.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send message.');
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Students</h1>
        <p className="text-muted-foreground mt-1">
          Click any student card to inspect detailed learning hours, module progress, grades, and dedicated chat history.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search students or courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{students.length}</span> Enrolled Students
        </div>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <Card className="flex items-center justify-center p-12 text-center">
            <p className="text-sm text-muted-foreground">Loading students…</p>
          </Card>
        ) : filteredStudents.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center">
            <User className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-semibold">No students found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Try searching with a different name or course keyword.
            </p>
          </Card>
        ) : (
          filteredStudents.map((stud) => (
            (() => {
              const summary = getStudentSummary(stud);
              return (
            <Card
              key={stud.id}
              onClick={() => handleOpenDetail(stud)}
              className="cursor-pointer transition-all hover:border-indigo/50 hover:bg-card/80 group"
            >
              <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base group-hover:text-indigo transition-colors">{stud.name}</span>
                    <span className="text-xs text-muted-foreground">({stud.email})</span>
                    {summary.status === 'completed' && (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/25 gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Completed
                      </Badge>
                    )}
                    {summary.status === 'active' && (
                      <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 border-indigo-500/25">
                        Active
                      </Badge>
                    )}
                    {summary.status === 'at-risk' && (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/25">
                        Needs Attention
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <BookOpen className="h-4 w-4 text-indigo" />
                      {stud.courses.map((course) => course.enrolledCourse).join(', ')}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {summary.totalHours} hrs invested
                    </span>
                    <span>•</span>
                    <span>Last active: {summary.lastActive}</span>
                  </div>

                  <div className="space-y-1 max-w-md pt-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Course Progress</span>
                      <span className="font-medium">{summary.progress}%</span>
                    </div>
                    <Progress value={summary.progress} className="h-2" />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleOpenChat(e, stud)}
                    className="gap-1.5"
                  >
                    <MessageSquare className="h-4 w-4 text-indigo" /> Chat ({stud.courses.reduce((count, course) => count + course.messages.length, 0)})
                  </Button>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </CardContent>
            </Card>
              );
            })()
          ))
        )}
      </div>

      {/* Detailed Student Modal / Drawer */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {activeStudent && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-indigo/10 flex items-center justify-center text-indigo font-bold text-lg">
                      {activeStudent.name.charAt(0)}
                    </div>
                    <div>
                      <DialogTitle className="text-xl">{activeStudent.name}</DialogTitle>
                      <DialogDescription>{activeStudent.email} • {activeStudent.courses.length} instructor course{activeStudent.courses.length === 1 ? '' : 's'}</DialogDescription>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-3 my-4">
                <Card className="bg-muted/40 p-4 text-center">
                  <p className="text-xs text-muted-foreground">Total Time Spent</p>
                  <p className="text-xl font-bold mt-1 text-foreground">{activeCourse ? getStudentSummary({ ...activeStudent, courses: [activeCourse] }).totalHours : 0} hrs</p>
                </Card>
                <Card className="bg-muted/40 p-4 text-center">
                  <p className="text-xs text-muted-foreground">Overall Progress</p>
                  <p className="text-xl font-bold mt-1 text-foreground">{activeCourse?.progress ?? 0}%</p>
                </Card>
                <Card className="bg-muted/40 p-4 text-center">
                  <p className="text-xs text-muted-foreground">Submissions</p>
                  <p className="text-xl font-bold mt-1 text-foreground">{activeCourse?.submissions.length ?? 0}</p>
                </Card>
              </div>

              <Tabs defaultValue="modules" className="mt-4">
                <div className="mb-4 flex flex-wrap gap-2">
                  {activeStudent.courses.map((course) => (
                    <Button key={course.courseId} size="sm" variant={activeCourse?.courseId === course.courseId ? 'default' : 'outline'} onClick={() => setActiveCourseId(course.courseId)}>
                      {course.enrolledCourse}
                    </Button>
                  ))}
                </div>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="modules">Module & Lecture Hours</TabsTrigger>
                  <TabsTrigger value="submissions">Submissions & Grades</TabsTrigger>
                </TabsList>

                <TabsContent value="modules" className="space-y-4 pt-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Module Breakdown</h4>
                  <div className="space-y-3">
                    {(activeCourse?.modules ?? []).map((mod, idx) => (
                      <div key={idx} className="p-3 rounded-lg border bg-card space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-medium">{mod.moduleName}</span>
                          <span className="text-xs font-semibold text-indigo bg-indigo/10 px-2 py-0.5 rounded-full">
                            {mod.hoursSpent} hrs spent
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Completed lectures: {mod.completedLectures} / {mod.totalLectures}</span>
                          <span>{Math.round((mod.completedLectures / mod.totalLectures) * 100)}%</span>
                        </div>
                        <Progress value={(mod.completedLectures / mod.totalLectures) * 100} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="submissions" className="space-y-4 pt-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Assignments & Quiz Grades</h4>
                  <div className="space-y-3">
                    {(activeCourse?.submissions ?? []).map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{sub.title}</span>
                            <Badge variant="outline" className="text-xs">{sub.type}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">Submitted on {sub.submittedDate}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-base">{sub.score}</span>
                          <div>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${sub.status === 'Graded' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                              {sub.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="mt-6 flex justify-between sm:justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDetailOpen(false);
                    setIsChatOpen(true);
                  }}
                  className="gap-2"
                >
                  <MessageSquare className="h-4 w-4 text-indigo" /> Open Chat Box ({activeCourse?.messages.length ?? 0})
                </Button>
                <Button onClick={() => setIsDetailOpen(false)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dedicated Chat Box Drawer / Dialog */}
      <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
        <DialogContent className="sm:max-w-xl h-[80vh] flex flex-col justify-between p-0 overflow-hidden">
          {activeStudent && (
            <>
              {/* Chat Header */}
              <div className="px-6 py-4 border-b bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-indigo/10 flex items-center justify-center text-indigo font-bold">
                    {activeStudent.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">{activeStudent.name}</h3>
                    <p className="text-xs text-muted-foreground">Course Chat & Instructions • {activeCourse?.enrolledCourse}</p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/25">
                  Connected
                </Badge>
              </div>

              {/* Chat Message History */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-card/40">
                {(activeCourse?.messages.length ?? 0) === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-6">
                    <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-2" />
                    <p className="font-medium text-sm">No chat history yet</p>
                    <p className="text-xs mt-1">Send instructions or feedback below. The student can reply here anytime.</p>
                  </div>
                ) : (
                  (activeCourse?.messages ?? []).map((msg) => {
                    const isInstructor = msg.sender === 'instructor';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isInstructor ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1 px-1">
                          <span>{isInstructor ? 'You (Instructor)' : activeStudent.name}</span>
                          <span>•</span>
                          <span>{msg.timestamp}</span>
                        </div>
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            isInstructor
                              ? 'bg-indigo text-indigo-foreground rounded-br-sm'
                              : 'bg-muted text-foreground border rounded-bl-sm'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input Footer */}
              <form onSubmit={handleSendChatMessage} className="p-4 border-t bg-card flex items-center gap-2">
                <Input
                  placeholder="Type instructions, suggestions, or feedback..."
                  value={newChatText}
                  onChange={(e) => setNewChatText(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" size="icon" className="shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}