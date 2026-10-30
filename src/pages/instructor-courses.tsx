import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  MoreVertical,
  BookOpen,
  Users,
  Star,
  Eye,
  Edit,
  Trash2,
  Sparkles,
  X,
  Layers,
  Video,
  FileText,
  ClipboardCheck,
  ListChecks,
  Upload as UploadIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { apiRequest, resolveBackendAssetUrl } from '@/lib/api';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface QuizQuestion {
  question: string;
  choices: string[];
  correctChoice: number;
}

interface Lecture {
  id: string;
  title: string;
  videoFile: File | null;
  pdfFile: File | null;
  // server-side paths already stored for this lesson (populated on edit load)
  existingVideoUrl: string;
  existingResourceUrl: string;
  // Multiple quiz questions per lecture (replaces the legacy single quizQuestion field)
  quizQuestions: QuizQuestion[];
  timeLimitMinutes?: number;
  // Legacy single-field kept only for backward-compat with content in platform_lessons.content
  assignmentTask?: string;
  // Structured assignment fields (stored in platform_assignments)
  assignmentTitle?: string;
  assignmentInstructions?: string;
  assignmentPoints?: number;
}

interface ModuleItem {
  id: string;
  title: string;
  isFreePreview: boolean;
  lectures: Lecture[];
}

interface CourseItem {
  id: string;
  title: string;
  category: string;
  status: string;
  students: number;
  rating: number;
  reviewsCount: number;
  priceType: 'free' | 'paid' | 'freemium';
  price: string;
  lessons: number;
  image: string;
}

export function InstructorCoursesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Published' | 'Pending' | 'Disapproved'>('All');

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Development');
  const [newPriceType, setNewPriceType] = useState<'free' | 'paid' | 'freemium'>('paid');
  const [newPrice, setNewPrice] = useState('৳4,000');
  const [coverImage, setCoverImage] = useState<File | null>(null);

  // Edit Modal State
  const [editingCourse, setEditingCourse] = useState<CourseItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPriceType, setEditPriceType] = useState<'free' | 'paid' | 'freemium'>('paid');
  const [editPrice, setEditPrice] = useState('');
  const [editCoverImage, setEditCoverImage] = useState<File | null>(null);
  const [activeLectureTool, setActiveLectureTool] = useState<{ moduleId: string; lectureId: string; tool: 'quiz' | 'assignment' } | null>(null);

  // Modules & Lectures State (Shared for create/edit)
  const [modules, setModules] = useState<ModuleItem[]>([
    {
      id: 'm-1',
      title: 'Introduction & Setup',
      isFreePreview: true,
      lectures: [
        { id: 'l-1', title: 'Welcome & Overview', videoFile: null, pdfFile: null, existingVideoUrl: '', existingResourceUrl: '', quizQuestions: [] },
      ],
    },
  ]);

  // Admin feedback from the last review cycle, shown in the edit modal header
  const [editAdminFeedback, setEditAdminFeedback] = useState('');
  // Loading flag while fetching curriculum on edit open
  const [editCurriculumLoading, setEditCurriculumLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadCourses = async () => {
      try {
        const data = await apiRequest('/instructor/courses');
        if (cancelled) return;

        const savedCourses = Array.isArray(data.courses) ? data.courses : [];
        setCourses(
          savedCourses.map((course: {
            id: string;
            title: string;
            category?: string;
            status?: string;
            thumbnail_url?: string;
            student_count?: number;
            avg_rating?: number;
            review_count?: number;
          }) => ({
            id: course.id,
            title: course.title,
            category: course.category || 'General',
            status: course.status === 'approved' ? 'Published' : course.status === 'disapproved' ? 'Disapproved' : 'Pending',
            students: course.student_count ?? 0,
            rating: course.avg_rating ?? 0,
            reviewsCount: course.review_count ?? 0,
            priceType: 'paid',
            price: 'Paid',
            lessons: 0,
            image: resolveBackendAssetUrl(course.thumbnail_url) || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80',
          }))
        );
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Could not load your courses.');
        }
      }
    };

    void loadCourses();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalReviews = courses.reduce((acc, course) => acc + course.reviewsCount, 0);
  const totalRatingPoints = courses.reduce((acc, course) => acc + course.rating * course.reviewsCount, 0);
  const averageRating = totalReviews > 0 ? totalRatingPoints / totalReviews : 0;

  const filteredCourses = courses.filter((course) => {
    const matchesSearch =
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || course.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDeleteCourse = async (id: string) => {
    if (!confirm('Are you sure you want to delete this course?')) return;
    try {
      const data = await apiRequest(`/courses/delete?course_id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setCourses((prev) => prev.filter((course) => course.id !== id));
      toast.success(data.message || 'Course deleted.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete course.');
    }
  };

  const handleOpenEdit = async (course: CourseItem) => {
    // Populate basic metadata immediately so the modal opens right away
    setEditingCourse(course);
    setEditTitle(course.title);
    setEditCategory(course.category);
    setEditPriceType(course.priceType);
    setEditPrice(course.price);
    setEditCoverImage(null);
    setEditAdminFeedback('');
    setEditCurriculumLoading(true);

    // Reset modules to a blank placeholder while loading
    setModules([
      {
        id: 'm-1',
        title: 'Loading curriculum…',
        isFreePreview: course.priceType === 'free',
        lectures: [{ id: 'l-1', title: '', videoFile: null, pdfFile: null, existingVideoUrl: '', existingResourceUrl: '', quizQuestions: [] }],
      },
    ]);

    try {
      const token = localStorage.getItem('akademia-token');
      const res = await fetch(`http://localhost:8081/api/instructor/courses/${encodeURIComponent(course.id)}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not load course curriculum');

      // Show admin feedback banner when the course was disapproved
      if (data.admin_feedback) setEditAdminFeedback(data.admin_feedback);

      // Map the API response into the editor's ModuleItem shape
      const hydratedModules: ModuleItem[] = Array.isArray(data.modules) && data.modules.length > 0
        ? data.modules.map((mod: {
            id: string; title: string;
            lessons?: {
              id: string; title: string;
              lesson_type?: string; content?: string;
              duration_minutes?: number;
              video_path?: string; resource_path?: string;
              assignment_title?: string; assignment_instructions?: string; assignment_points?: number;
              quiz_questions?: { question: string; choices: string[]; correct_choice: number }[];
            }[];
          }) => ({
            id: mod.id,
            title: mod.title,
            isFreePreview: course.priceType === 'free',
            lectures: Array.isArray(mod.lessons) ? mod.lessons.map((ls) => {
              return {
                id: ls.id,
                title: ls.title,
                videoFile: null,
                pdfFile: null,
                existingVideoUrl: ls.video_path || '',
                existingResourceUrl: ls.resource_path || '',
                assignmentTask: ls.lesson_type === 'assignment' ? (ls.content || '') : undefined,
                timeLimitMinutes: ls.duration_minutes ?? 10,
                assignmentTitle: ls.assignment_title || '',
                assignmentInstructions: ls.assignment_instructions || '',
                assignmentPoints: ls.assignment_points ?? 100,
                quizQuestions: Array.isArray(ls.quiz_questions)
                  ? ls.quiz_questions.map((q) => ({
                      question: q.question,
                      choices: Array.isArray(q.choices) && q.choices.length >= 2
                        ? q.choices
                        : ['', '', '', ''],
                      correctChoice: q.correct_choice ?? 0,
                    }))
                  : [],
              } satisfies Lecture;
            }) : [],
          }))
        : [
            {
              id: 'm-1',
              title: 'Module 1',
              isFreePreview: course.priceType === 'free',
              lectures: [{ id: 'l-1', title: 'Lecture 1', videoFile: null, pdfFile: null, existingVideoUrl: '', existingResourceUrl: '', quizQuestions: [] }],
            },
          ];

      setModules(hydratedModules);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load curriculum');
      // Fall back to a blank module so the instructor can still edit
      setModules([{
        id: 'm-1',
        title: 'Module 1',
        isFreePreview: course.priceType === 'free',
        lectures: [{ id: 'l-1', title: 'Lecture 1', videoFile: null, pdfFile: null, existingVideoUrl: '', existingResourceUrl: '', quizQuestions: [] }],
      }]);
    } finally {
      setEditCurriculumLoading(false);
    }
  };

  useEffect(() => {
    const editId = searchParams.get('edit');
    const course = editId ? courses.find((item) => item.id === editId) : undefined;
    if (course) {
      void handleOpenEdit(course);
      setSearchParams({}, { replace: true });
    }
  }, [courses, searchParams, setSearchParams]);

  // Module actions
  const addModule = () => {
    setModules([
      ...modules,
      {
        id: `m-${Date.now()}`,
        title: `Module ${modules.length + 1}`,
        isFreePreview: false,
        lectures: [{ id: `l-${Date.now()}`, title: 'Lecture 1', videoFile: null, pdfFile: null, existingVideoUrl: '', existingResourceUrl: '', quizQuestions: [] }],
      },
    ]);
  };

  const removeModule = (moduleId: string) => {
    setModules(modules.filter((m) => m.id !== moduleId));
  };

  const updateModuleTitle = (moduleId: string, title: string) => {
    setModules(modules.map((m) => (m.id === moduleId ? { ...m, title } : m)));
  };

  const toggleModulePreview = (moduleId: string) => {
    setModules(
      modules.map((m) => (m.id === moduleId ? { ...m, isFreePreview: !m.isFreePreview } : m))
    );
  };

  // Lecture actions
  const addLecture = (moduleId: string) => {
    setModules(
      modules.map((m) => {
        if (m.id === moduleId) {
          return {
            ...m,
            lectures: [
              ...m.lectures,
              {
                id: `l-${Date.now()}`,
                title: `Lecture ${m.lectures.length + 1}`,
                videoFile: null,
                pdfFile: null,
                existingVideoUrl: '',
                existingResourceUrl: '',
                quizQuestions: [],
              },
            ],
          };
        }
        return m;
      })
    );
  };

  const removeLecture = (moduleId: string, lectureId: string) => {
    setModules(
      modules.map((m) => {
        if (m.id === moduleId) {
          return {
            ...m,
            lectures: m.lectures.filter((l) => l.id !== lectureId),
          };
        }
        return m;
      })
    );
  };

  const updateLectureTitle = (moduleId: string, lectureId: string, title: string) => {
    setModules(
      modules.map((m) => {
        if (m.id === moduleId) {
          return {
            ...m,
            lectures: m.lectures.map((l) => (l.id === lectureId ? { ...l, title } : l)),
          };
        }
        return m;
      })
    );
  };

  const updateLectureFile = (
    moduleId: string,
    lectureId: string,
    fileType: 'videoFile' | 'pdfFile',
    file: File | null
  ) => {
    setModules(
      modules.map((m) => {
        if (m.id === moduleId) {
          return {
            ...m,
            lectures: m.lectures.map((l) =>
              l.id === lectureId ? { ...l, [fileType]: file } : l
            ),
          };
        }
        return m;
      })
    );
  };

  const addQuizQuestion = (moduleId: string, lectureId: string) => {
    setModules((current) =>
      current.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              lectures: module.lectures.map((lecture) =>
                lecture.id === lectureId
                  ? {
                      ...lecture,
                      quizQuestions: [
                        ...lecture.quizQuestions,
                        { question: '', choices: ['', '', '', ''], correctChoice: 0 },
                      ],
                    }
                  : lecture
              ),
            }
          : module
      )
    );
  };

  const updateQuizQuestion = (
    moduleId: string,
    lectureId: string,
    qIdx: number,
    update: Partial<QuizQuestion>
  ) => {
    setModules((current) =>
      current.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              lectures: module.lectures.map((lecture) => {
                if (lecture.id !== lectureId) return lecture;
                const updated = lecture.quizQuestions.map((q, i) =>
                  i === qIdx ? { ...q, ...update } : q
                );
                return { ...lecture, quizQuestions: updated };
              }),
            }
          : module
      )
    );
  };

  const removeQuizQuestion = (moduleId: string, lectureId: string, qIdx: number) => {
    setModules((current) =>
      current.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              lectures: module.lectures.map((lecture) =>
                lecture.id === lectureId
                  ? { ...lecture, quizQuestions: lecture.quizQuestions.filter((_, i) => i !== qIdx) }
                  : lecture
              ),
            }
          : module
      )
    );
  };

  const updateLectureAssignmentField = (
    moduleId: string,
    lectureId: string,
    field: 'assignmentTitle' | 'assignmentInstructions' | 'assignmentPoints',
    value: string | number
  ) => {
    setModules((current) =>
      current.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              lectures: module.lectures.map((lecture) =>
                lecture.id === lectureId ? { ...lecture, [field]: value } : lecture
              ),
            }
          : module
      )
    );
  };

  // Switch the active tool panel for a lecture.
  // Toggling the same button closes the panel.
  // We intentionally do NOT reset the other tool's data here — the instructor
  // may switch back and their inputs must still be there.
  // Cleanup of unused fields is handled at submit time via lesson_type derivation.
  const switchLectureTool = (
    moduleId: string,
    lectureId: string,
    tool: 'quiz' | 'assignment'
  ) => {
    if (activeLectureTool?.lectureId === lectureId && activeLectureTool.tool === tool) {
      setActiveLectureTool(null);
    } else {
      setActiveLectureTool({ moduleId, lectureId, tool });
    }
  };

  const resetCreateForm = () => {
    setNewTitle('');
    setNewCategory('Development');
    setNewPriceType('paid');
    setNewPrice('৳4,000');
    setCoverImage(null);
    setActiveLectureTool(null);
    setModules([
      {
        id: 'm-1',
        title: 'Introduction & Setup',
        isFreePreview: true,
        lectures: [
          { id: 'l-1', title: 'Welcome & Overview', videoFile: null, pdfFile: null, existingVideoUrl: '', existingResourceUrl: '', quizQuestions: [] },
        ],
      },
    ]);
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const totalLessonsCount = modules.reduce((acc, m) => acc + m.lectures.length, 0);
    const imageUrl = coverImage
      ? URL.createObjectURL(coverImage)
      : 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80';

    const payload = {
      title: newTitle.trim(),
      slug: newTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `course-${Date.now()}`,
      description: `Course created by instructor in ${newCategory}.`,
      category: newCategory,
      difficulty: 'Beginner',
      thumbnail_url: '',
      modules: modules.map((module, moduleIndex) => ({
        title: module.title || `Module ${moduleIndex + 1}`,
        position: moduleIndex,
        lessons: module.lectures.map((lecture, lectureIndex) => ({
          title: lecture.title || `Lecture ${lectureIndex + 1}`,
          lesson_type: lecture.assignmentTitle?.trim() || lecture.assignmentInstructions?.trim()
            ? 'assignment'
            : lecture.quizQuestions.some((q) => q.question.trim())
            ? 'quiz'
            : lecture.videoFile
            ? 'video'
            : lecture.pdfFile
            ? 'reading'
            : 'video',
          position: lectureIndex,
          duration_minutes: Math.max(1, lecture.timeLimitMinutes ?? 10),
          video_field: lecture.videoFile ? `lesson-video-${lecture.id}` : '',
          resource_field: lecture.pdfFile ? `lesson-resource-${lecture.id}` : '',
          content: lecture.assignmentInstructions?.trim() || '',
          assignment_title: lecture.assignmentTitle?.trim() || '',
          assignment_instructions: lecture.assignmentInstructions?.trim() || '',
          assignment_points: lecture.assignmentPoints ?? 100,
          quiz_questions: lecture.quizQuestions
            .filter((q) => q.question.trim() && q.choices.some((c) => c.trim()))
            .map((q, qIdx) => ({
              question: q.question.trim(),
              choices: q.choices.filter((c) => c.trim()),
              correct_choice: q.correctChoice,
              position: qIdx,
            })),
        })),
      })),
    };

    try {
      const token = localStorage.getItem('akademia-token');
      const formData = new FormData();
      formData.append('course', JSON.stringify(payload));
      if (coverImage) {
        formData.append('thumbnail', coverImage, coverImage.name);
      }
      modules.forEach((module) => {
        module.lectures.forEach((lecture) => {
          if (lecture.videoFile) {
            formData.append(`lesson-video-${lecture.id}`, lecture.videoFile, lecture.videoFile.name);
          }
          if (lecture.pdfFile) {
            formData.append(`lesson-resource-${lecture.id}`, lecture.pdfFile, lecture.pdfFile.name);
          }
        });
      });

      const response = await fetch('http://localhost:8081/api/courses/create', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Course creation failed');
      }

      const createdCourse: CourseItem = {
        id: data.id || `c-${Date.now()}`,
        title: newTitle.trim(),
        category: newCategory,
        status: 'Pending',
        students: 0,
        rating: 0,
        reviewsCount: 0,
        priceType: newPriceType,
        price: newPriceType === 'free' ? 'Free' : (newPrice.startsWith('৳') ? newPrice : `৳${newPrice}`),
        lessons: totalLessonsCount || 1,
        image: resolveBackendAssetUrl(data.thumbnail_url) || imageUrl,
      };

      setCourses((prev) => [createdCourse, ...prev]);
      setNewTitle('');
      setCoverImage(null);
      setIsCreateModalOpen(false);
      toast.success('Course saved to the database as a draft.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the course.');
    }
  };

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse || !editTitle.trim()) return;

    const totalLessonsCount = modules.reduce((acc, m) => acc + m.lectures.length, 0);
    const imageUrl = editCoverImage ? URL.createObjectURL(editCoverImage) : editingCourse.image;

    const coursePayload = {
      title: editTitle.trim(),
      category: editCategory,
      difficulty: 'Beginner',
      description: `Course updated by instructor in ${editCategory}.`,
      modules: modules.map((module, moduleIndex) => ({
        id: module.id,
        title: module.title || `Module ${moduleIndex + 1}`,
        position: moduleIndex,
        lessons: module.lectures.map((lecture, lectureIndex) => {
          const lessonType = lecture.assignmentTitle?.trim() || lecture.assignmentInstructions?.trim()
            ? 'assignment'
            : lecture.quizQuestions.some((q) => q.question.trim())
            ? 'quiz'
            : lecture.videoFile
            ? 'video'
            : lecture.pdfFile
            ? 'reading'
            : lecture.existingVideoUrl
            ? 'video'
            : lecture.existingResourceUrl
            ? 'reading'
            : 'video';
          return {
            id: lecture.id,
            title: lecture.title || `Lecture ${lectureIndex + 1}`,
            lesson_type: lessonType,
            position: lectureIndex,
            duration_minutes: Math.max(1, lecture.timeLimitMinutes ?? 10),
            // New file upload field names (empty string = no new upload)
            video_field: lecture.videoFile ? `edit-lesson-video-${lecture.id}` : '',
            resource_field: lecture.pdfFile ? `edit-lesson-resource-${lecture.id}` : '',
            // Tell the backend which existing paths to keep when no new file is provided
            keep_video_path: lecture.existingVideoUrl,
            keep_resource_path: lecture.existingResourceUrl,
            content: lecture.assignmentInstructions?.trim() || '',
            assignment_title: lecture.assignmentTitle?.trim() || '',
            assignment_instructions: lecture.assignmentInstructions?.trim() || '',
            assignment_points: lecture.assignmentPoints ?? 100,
            quiz_questions: lecture.quizQuestions
              .filter((q) => q.question.trim() && q.choices.some((c) => c.trim()))
              .map((q, qIdx) => ({
                question: q.question.trim(),
                choices: q.choices.filter((c) => c.trim()),
                correct_choice: q.correctChoice,
                position: qIdx,
              })),
          };
        }),
      })),
    };

    try {
      const token = localStorage.getItem('akademia-token');
      const formData = new FormData();
      formData.append('course', JSON.stringify(coursePayload));
      if (editCoverImage) {
        formData.append('thumbnail', editCoverImage, editCoverImage.name);
      }
      // Append new lesson file uploads
      modules.forEach((module) => {
        module.lectures.forEach((lecture) => {
          if (lecture.videoFile) {
            formData.append(`edit-lesson-video-${lecture.id}`, lecture.videoFile, lecture.videoFile.name);
          }
          if (lecture.pdfFile) {
            formData.append(`edit-lesson-resource-${lecture.id}`, lecture.pdfFile, lecture.pdfFile.name);
          }
        });
      });

      const response = await fetch(
        `http://localhost:8081/api/instructor/courses/${encodeURIComponent(editingCourse.id)}/curriculum`,
        {
          method: 'PUT',
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: formData,
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Course update failed');

      setCourses(
        courses.map((c) => {
          if (c.id === editingCourse.id) {
            return {
              ...c,
              title: editTitle.trim(),
              category: editCategory,
              priceType: editPriceType,
              price: editPriceType === 'free' ? 'Free' : (editPrice.startsWith('৳') ? editPrice : `৳${editPrice}`),
              lessons: totalLessonsCount || c.lessons,
              image: imageUrl,
              status: 'Pending',
            };
          }
          return c;
        })
      );
      setEditingCourse(null);
      toast.success('Course curriculum updated — awaiting admin re-approval before going live.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update course.');
    }
  };

  return (
    <div className="space-y-8 p-6 lg:p-8 relative">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            My Courses
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your published courses and drafts. Editing any course will submit it for re-approval.
          </p>
        </div>
        <Button
          onClick={() => {
            resetCreateForm();
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-2 bg-primary text-primary-foreground shadow hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          <span>Create New Course</span>
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground">Total Courses</span>
            <BookOpen className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{courses.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {courses.filter((c) => c.status === 'Published').length} Published
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground">Total Enrolled</span>
            <Users className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {courses.reduce((acc, curr) => acc + curr.students, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {courses.length ? 'Current enrollment total' : 'No enrollments yet'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground">Avg. Rating</span>
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {averageRating > 0 ? averageRating.toFixed(1) : '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalReviews > 0 ? `Across ${totalReviews.toLocaleString()} reviews` : 'No reviews yet'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground">Pending Courses</span>
            <Sparkles className="h-4 w-4 text-teal-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {courses.filter((c) => c.status === 'Pending').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pending admin approval</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search courses by title or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          {(['All', 'Published', 'Pending', 'Disapproved'] as const).map((filter) => (
            <Button
              key={filter}
              variant={statusFilter === filter ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(filter)}
              className="text-xs"
            >
              {filter}
            </Button>
          ))}
        </div>
      </div>

      {/* Course Cards Grid */}
      {filteredCourses.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course) => (
            <Card
              key={course.id}
              className="group flex flex-col overflow-hidden border border-border bg-card transition-all hover:shadow-md"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-muted">
                <img
                  src={course.image}
                  alt={course.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <Badge
                  variant={course.status === 'Published' ? 'default' : 'secondary'}
                  className="absolute left-3 top-3 border-none bg-background/80 font-semibold backdrop-blur"
                >
                  {course.status}
                </Badge>
                <div className="absolute right-3 top-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8 rounded-full bg-background/80 backdrop-blur hover:bg-background"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenEdit(course)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Course
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/courses/${course.id}`)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Preview
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDeleteCourse(course.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <CardHeader className="flex-1 p-5 pb-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold text-primary">{course.category}</span>
                  <span className="capitalize">{course.priceType}</span>
                </div>
                <CardTitle className="line-clamp-2 text-lg font-bold text-foreground mt-1">
                  {course.title}
                </CardTitle>
              </CardHeader>

              <CardContent className="p-5 pt-0">
                <div className="flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    <span>{course.students.toLocaleString()} students</span>
                  </div>
                  {course.rating > 0 ? (
                    <div className="flex items-center gap-1 font-medium text-foreground">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span>{course.rating}</span>
                    </div>
                  ) : (
                    <span className="italic">No ratings yet</span>
                  )}
                </div>
              </CardContent>

              <CardFooter className="flex items-center justify-between border-t border-border bg-muted/20 p-4">
                <span className="text-lg font-extrabold text-foreground">
                  {course.priceType === 'free' ? 'Free' : course.price}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenEdit(course)}
                  className="gap-1.5 text-xs text-primary"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">No courses found</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Try adjusting your search query or filters.
          </p>
        </div>
      )}

      {/* Create Course Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl bg-card border border-border p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h3 className="text-lg font-bold text-foreground">Create New Course</h3>
                <p className="text-xs text-muted-foreground">Course will be saved as Draft for admin approval.</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCreateModalOpen(false)}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-6 pt-4 overflow-y-auto pr-2 flex-1">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Course Title</label>
                  <Input
                    required
                    placeholder="e.g. Masterclass in TypeScript"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="Development">Development</option>
                      <option value="Frontend">Frontend</option>
                      <option value="Backend">Backend</option>
                      <option value="Design">Design</option>
                      <option value="AI & Data">AI & Data</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Pricing Structure</label>
                    <select
                      value={newPriceType}
                      onChange={(e) => {
                        const val = e.target.value as 'free' | 'paid' | 'freemium';
                        setNewPriceType(val);
                        if (val === 'free') {
                          setModules(modules.map((m) => ({ ...m, isFreePreview: true })));
                        }
                      }}
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="paid">Paid (Full)</option>
                      <option value="free">Free Course</option>
                      <option value="freemium">Freemium (Select Free Modules)</option>
                    </select>
                  </div>
                </div>

                {newPriceType !== 'free' && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Price (৳)</label>
                    <Input
                      required
                      placeholder="e.g. ৳4,500"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <UploadIcon className="h-3.5 w-3.5" /> Cover Picture (from device)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCoverImage(e.target.files?.[0] || null)}
                    className="mt-1.5 block w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  />
                </div>
              </div>

              {/* Modules & Lectures */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-primary" /> Curriculum
                  </h4>
                  <Button type="button" size="sm" variant="outline" onClick={addModule} className="gap-1">
                    <Plus className="h-3.5 w-3.5" /> Add Module
                  </Button>
                </div>

                <div className="space-y-4">
                  {modules.map((mod, modIdx) => (
                    <div key={mod.id} className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-xs font-bold text-muted-foreground">#{modIdx + 1}</span>
                          <Input
                            value={mod.title}
                            onChange={(e) => updateModuleTitle(mod.id, e.target.value)}
                            placeholder="Module Title"
                            className="h-8 text-sm font-medium"
                          />
                        </div>

                        {newPriceType === 'freemium' && (
                          <Button
                            type="button"
                            size="sm"
                            variant={mod.isFreePreview ? 'default' : 'outline'}
                            onClick={() => toggleModulePreview(mod.id)}
                            className="text-xs h-8 shrink-0"
                          >
                            {mod.isFreePreview ? 'Free Preview' : 'Paid Locked'}
                          </Button>
                        )}

                        {modules.length > 1 && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeModule(mod.id)}
                            className="h-8 w-8 text-destructive shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="pl-4 space-y-2 border-l-2 border-primary/20">
                        {mod.lectures.map((lec, lecIdx) => (
                          <div key={lec.id} className="rounded-md border border-border/60 bg-card p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1">
                                <span className="text-[11px] text-muted-foreground font-semibold">L{lecIdx + 1}</span>
                                <Input
                                  value={lec.title}
                                  onChange={(e) => updateLectureTitle(mod.id, lec.id, e.target.value)}
                                  placeholder="Lecture Title"
                                  className="h-7 text-xs"
                                />
                              </div>
                              {mod.lectures.length > 1 && (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => removeLecture(mod.id, lec.id)}
                                  className="h-7 w-7 text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                              <div className="flex items-center gap-1.5 bg-muted/50 p-1.5 rounded border border-border/40">
                                <Video className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                                <span className="truncate flex-1">
                                  {lec.videoFile ? lec.videoFile.name : 'Upload Video'}
                                </span>
                                <input
                                  type="file"
                                  accept="video/*"
                                  onChange={(e) =>
                                    updateLectureFile(mod.id, lec.id, 'videoFile', e.target.files?.[0] || null)
                                  }
                                  className="hidden"
                                  id={`vid-create-${lec.id}`}
                                />
                                <label
                                  htmlFor={`vid-create-${lec.id}`}
                                  className="cursor-pointer font-semibold text-primary hover:underline"
                                >
                                  Browse
                                </label>
                              </div>

                              <div className="flex items-center gap-1.5 bg-muted/50 p-1.5 rounded border border-border/40">
                                <FileText className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                <span className="truncate flex-1">
                                  {lec.pdfFile ? lec.pdfFile.name : 'Upload PDF / Material'}
                                </span>
                                <input
                                  type="file"
                                  accept=".pdf,.doc,.docx,.ppt,.pptx"
                                  onChange={(e) =>
                                    updateLectureFile(mod.id, lec.id, 'pdfFile', e.target.files?.[0] || null)
                                  }
                                  className="hidden"
                                  id={`pdf-create-${lec.id}`}
                                />
                                <label
                                  htmlFor={`pdf-create-${lec.id}`}
                                  className="cursor-pointer font-semibold text-primary hover:underline"
                                >
                                  Browse
                                </label>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-2 text-xs">
                              <span className="font-medium text-muted-foreground">L{lecIdx + 1} Tools:</span>
                              <Button
                                type="button"
                                variant={activeLectureTool?.lectureId === lec.id && activeLectureTool.tool === 'quiz' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-7 gap-1 px-2 text-xs text-primary"
                                onClick={() => switchLectureTool(mod.id, lec.id, 'quiz')}
                              >
                                <ListChecks className="h-3.5 w-3.5" /> Add Quiz
                              </Button>
                              <Button
                                type="button"
                                variant={activeLectureTool?.lectureId === lec.id && activeLectureTool.tool === 'assignment' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-7 gap-1 px-2 text-xs text-primary"
                                onClick={() => switchLectureTool(mod.id, lec.id, 'assignment')}
                              >
                                <ClipboardCheck className="h-3.5 w-3.5" /> Add Assignment Task
                              </Button>
                            </div>
                            <div className="space-y-2 rounded-md border border-info/20 bg-info/5 p-3">
                              {activeLectureTool?.lectureId === lec.id && activeLectureTool.tool === 'assignment' ? (
                                <>
                                  <p className="text-xs font-semibold text-info">Assignment details</p>
                                  <Input
                                    value={lec.assignmentTitle ?? ''}
                                    onChange={(e) => updateLectureAssignmentField(mod.id, lec.id, 'assignmentTitle', e.target.value)}
                                    placeholder="Assignment title (e.g. Build a REST API)"
                                    className="h-8 text-xs"
                                  />
                                  <textarea
                                    value={lec.assignmentInstructions ?? ''}
                                    onChange={(e) => updateLectureAssignmentField(mod.id, lec.id, 'assignmentInstructions', e.target.value)}
                                    placeholder="Describe the work students should submit…"
                                    className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary"
                                  />
                                  <div className="flex items-center gap-2">
                                    <label className="text-xs text-muted-foreground shrink-0">Total points:</label>
                                    <Input
                                      type="number"
                                      min={1}
                                      value={lec.assignmentPoints ?? 100}
                                      onChange={(e) => updateLectureAssignmentField(mod.id, lec.id, 'assignmentPoints', Math.max(1, Number(e.target.value) || 1))}
                                      className="h-8 w-24 text-xs"
                                    />
                                  </div>
                                </>
                              ) : (
                                <>
                              <p className="text-xs font-semibold text-info">
                                Quiz questions ({lec.quizQuestions.length})
                              </p>
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-muted-foreground shrink-0" htmlFor={`${lec.id}-quiz-time`}>Time limit (minutes):</label>
                                <Input
                                  id={`${lec.id}-quiz-time`}
                                  type="number"
                                  min={1}
                                  step={1}
                                  value={lec.timeLimitMinutes ?? 10}
                                  onChange={(e) => setModules((current) => current.map((module) => module.id === mod.id
                                    ? { ...module, lectures: module.lectures.map((lecture) => lecture.id === lec.id ? { ...lecture, timeLimitMinutes: Math.max(1, Number(e.target.value) || 1) } : lecture) }
                                    : module))}
                                  className="h-8 w-24 text-xs"
                                />
                              </div>
                              {lec.quizQuestions.map((q, qIdx) => (
                                <div key={`${lec.id}-q-${qIdx}`} className="rounded border border-border/50 bg-background p-2 space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-semibold text-muted-foreground">Q{qIdx + 1}</span>
                                    {lec.quizQuestions.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => removeQuizQuestion(mod.id, lec.id, qIdx)}
                                        className="text-[10px] text-destructive hover:underline shrink-0"
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </div>
                                  <Input
                                    value={q.question}
                                    onChange={(e) => updateQuizQuestion(mod.id, lec.id, qIdx, { question: e.target.value })}
                                    placeholder="Question text"
                                    className="h-7 text-xs"
                                  />
                                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                                    {(q.choices.length >= 2 ? q.choices : ['', '', '', '']).map((choice, cIdx) => (
                                      <Input
                                        key={`${lec.id}-q${qIdx}-c${cIdx}`}
                                        value={choice}
                                        onChange={(e) => {
                                          const choices = [...(q.choices.length >= 2 ? q.choices : ['', '', '', ''])];
                                          choices[cIdx] = e.target.value;
                                          updateQuizQuestion(mod.id, lec.id, qIdx, { choices });
                                        }}
                                        placeholder={`Choice ${cIdx + 1}`}
                                        className="h-7 text-xs"
                                      />
                                    ))}
                                  </div>
                                  <select
                                    value={q.correctChoice}
                                    onChange={(e) => updateQuizQuestion(mod.id, lec.id, qIdx, { correctChoice: Number(e.target.value) })}
                                    className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
                                  >
                                    {(q.choices.length >= 2 ? q.choices : ['', '', '', '']).map((_, cIdx) => (
                                      <option key={cIdx} value={cIdx}>Correct: choice {cIdx + 1}</option>
                                    ))}
                                  </select>
                                </div>
                              ))}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => addQuizQuestion(mod.id, lec.id)}
                                className="h-7 gap-1 text-xs w-full mt-1"
                              >
                                <Plus className="h-3 w-3" /> Add Question
                              </Button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}

                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => addLecture(mod.id)}
                          className="text-xs h-7 text-primary gap-1 mt-1"
                        >
                          <Plus className="h-3 w-3" /> Add Lecture
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border sticky bottom-0 bg-card py-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Submit for Approval</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Course Modal */}
      {editingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl bg-card border border-border p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h3 className="text-lg font-bold text-foreground">Edit Course: {editingCourse.title}</h3>
                <p className="text-xs text-amber-500 font-medium">⚠️ Editing will reset course status to Draft for admin re-approval.</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditingCourse(null)}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Admin feedback banner — only shown when the last review was a rejection */}
            {editAdminFeedback && (
              <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
                <p className="font-semibold text-destructive">Admin feedback from last review:</p>
                <p className="mt-1 text-foreground">{editAdminFeedback}</p>
              </div>
            )}

            <form onSubmit={handleUpdateCourse} className="space-y-6 pt-4 overflow-y-auto pr-2 flex-1">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Course Title</label>
                  <Input
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Category</label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="Development">Development</option>
                      <option value="Frontend">Frontend</option>
                      <option value="Backend">Backend</option>
                      <option value="Design">Design</option>
                      <option value="AI & Data">AI & Data</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Pricing Structure</label>
                    <select
                      value={editPriceType}
                      onChange={(e) => {
                        const val = e.target.value as 'free' | 'paid' | 'freemium';
                        setEditPriceType(val);
                        if (val === 'free') {
                          setModules(modules.map((m) => ({ ...m, isFreePreview: true })));
                        }
                      }}
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="paid">Paid (Full)</option>
                      <option value="free">Free Course</option>
                      <option value="freemium">Freemium (Select Free Modules)</option>
                    </select>
                  </div>
                </div>

                {editPriceType !== 'free' && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Price (৳)</label>
                    <Input
                      required
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <UploadIcon className="h-3.5 w-3.5" /> Replace Cover Picture (Optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setEditCoverImage(e.target.files?.[0] || null)}
                    className="mt-1.5 block w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  />
                </div>
              </div>

              {/* Modules & Lectures */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-primary" /> Curriculum Updates
                  </h4>
                  <Button type="button" size="sm" variant="outline" onClick={addModule} className="gap-1" disabled={editCurriculumLoading}>
                    <Plus className="h-3.5 w-3.5" /> Add Module
                  </Button>
                </div>

                {editCurriculumLoading ? (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                    <span className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full shrink-0" />
                    Loading existing curriculum…
                  </div>
                ) : (
                <div className="space-y-4">
                  {modules.map((mod, modIdx) => (
                    <div key={mod.id} className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-xs font-bold text-muted-foreground">#{modIdx + 1}</span>
                          <Input
                            value={mod.title}
                            onChange={(e) => updateModuleTitle(mod.id, e.target.value)}
                            placeholder="Module Title"
                            className="h-8 text-sm font-medium"
                          />
                        </div>

                        {editPriceType === 'freemium' && (
                          <Button
                            type="button"
                            size="sm"
                            variant={mod.isFreePreview ? 'default' : 'outline'}
                            onClick={() => toggleModulePreview(mod.id)}
                            className="text-xs h-8 shrink-0"
                          >
                            {mod.isFreePreview ? 'Free Preview' : 'Paid Locked'}
                          </Button>
                        )}

                        {modules.length > 1 && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeModule(mod.id)}
                            className="h-8 w-8 text-destructive shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="pl-4 space-y-2 border-l-2 border-primary/20">
                        {mod.lectures.map((lec, lecIdx) => (
                          <div key={lec.id} className="rounded-md border border-border/60 bg-card p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1">
                                <span className="text-[11px] text-muted-foreground font-semibold">L{lecIdx + 1}</span>
                                <Input
                                  value={lec.title}
                                  onChange={(e) => updateLectureTitle(mod.id, lec.id, e.target.value)}
                                  placeholder="Lecture Title"
                                  className="h-7 text-xs"
                                />
                              </div>
                              {mod.lectures.length > 1 && (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => removeLecture(mod.id, lec.id)}
                                  className="h-7 w-7 text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                              {/* Video upload slot — shows existing filename or new selection */}
                              <div className="flex items-center gap-1.5 bg-muted/50 p-1.5 rounded border border-border/40">
                                <Video className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                                <span className="truncate flex-1">
                                  {lec.videoFile
                                    ? lec.videoFile.name
                                    : lec.existingVideoUrl
                                    ? `✓ ${lec.existingVideoUrl.split('/').pop()}`
                                    : 'Upload Video'}
                                </span>
                                <input
                                  type="file"
                                  accept="video/*"
                                  onChange={(e) =>
                                    updateLectureFile(mod.id, lec.id, 'videoFile', e.target.files?.[0] || null)
                                  }
                                  className="hidden"
                                  id={`vid-edit-${lec.id}`}
                                />
                                <label
                                  htmlFor={`vid-edit-${lec.id}`}
                                  className="cursor-pointer font-semibold text-primary hover:underline shrink-0"
                                >
                                  {lec.existingVideoUrl && !lec.videoFile ? 'Replace' : 'Browse'}
                                </label>
                              </div>

                              {/* PDF/resource upload slot — shows existing filename or new selection */}
                              <div className="flex items-center gap-1.5 bg-muted/50 p-1.5 rounded border border-border/40">
                                <FileText className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                <span className="truncate flex-1">
                                  {lec.pdfFile
                                    ? lec.pdfFile.name
                                    : lec.existingResourceUrl
                                    ? `✓ ${lec.existingResourceUrl.split('/').pop()}`
                                    : 'Upload PDF / Material'}
                                </span>
                                <input
                                  type="file"
                                  accept=".pdf,.doc,.docx,.ppt,.pptx"
                                  onChange={(e) =>
                                    updateLectureFile(mod.id, lec.id, 'pdfFile', e.target.files?.[0] || null)
                                  }
                                  className="hidden"
                                  id={`pdf-edit-${lec.id}`}
                                />
                                <label
                                  htmlFor={`pdf-edit-${lec.id}`}
                                  className="cursor-pointer font-semibold text-primary hover:underline shrink-0"
                                >
                                  {lec.existingResourceUrl && !lec.pdfFile ? 'Replace' : 'Browse'}
                                </label>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-2 text-xs">
                              <span className="font-medium text-muted-foreground">L{lecIdx + 1} Tools:</span>
                              <Button
                                type="button"
                                variant={activeLectureTool?.lectureId === lec.id && activeLectureTool.tool === 'quiz' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-7 gap-1 px-2 text-xs text-primary"
                                onClick={() => switchLectureTool(mod.id, lec.id, 'quiz')}
                              >
                                <ListChecks className="h-3.5 w-3.5" /> Add Quiz
                              </Button>
                              <Button
                                type="button"
                                variant={activeLectureTool?.lectureId === lec.id && activeLectureTool.tool === 'assignment' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-7 gap-1 px-2 text-xs text-primary"
                                onClick={() => switchLectureTool(mod.id, lec.id, 'assignment')}
                              >
                                <ClipboardCheck className="h-3.5 w-3.5" /> Add Assignment Task
                              </Button>
                            </div>
                            {/* Inline quiz / assignment panel for edit modal */}
                            {activeLectureTool?.lectureId === lec.id && (
                              <div className="space-y-2 rounded-md border border-info/20 bg-info/5 p-3 mt-2">
                                {activeLectureTool.tool === 'assignment' ? (
                                  <>
                                    <p className="text-xs font-semibold text-info">Assignment details</p>
                                    <Input
                                      value={lec.assignmentTitle ?? ''}
                                      onChange={(e) => updateLectureAssignmentField(mod.id, lec.id, 'assignmentTitle', e.target.value)}
                                      placeholder="Assignment title (e.g. Build a REST API)"
                                      className="h-8 text-xs"
                                    />
                                    <textarea
                                      value={lec.assignmentInstructions ?? ''}
                                      onChange={(e) => updateLectureAssignmentField(mod.id, lec.id, 'assignmentInstructions', e.target.value)}
                                      placeholder="Describe the work students should submit…"
                                      className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary"
                                    />
                                    <div className="flex items-center gap-2">
                                      <label className="text-xs text-muted-foreground shrink-0">Total points:</label>
                                      <Input
                                        type="number"
                                        min={1}
                                        value={lec.assignmentPoints ?? 100}
                                        onChange={(e) => updateLectureAssignmentField(mod.id, lec.id, 'assignmentPoints', Math.max(1, Number(e.target.value) || 1))}
                                        className="h-8 w-24 text-xs"
                                      />
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-xs font-semibold text-info">
                                      Quiz questions ({lec.quizQuestions.length})
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <label className="text-xs text-muted-foreground shrink-0" htmlFor={`edit-${lec.id}-quiz-time`}>Time limit (minutes):</label>
                                      <Input
                                        id={`edit-${lec.id}-quiz-time`}
                                        type="number"
                                        min={1}
                                        step={1}
                                        value={lec.timeLimitMinutes ?? 10}
                                        onChange={(e) => setModules((current) => current.map((module) => module.id === mod.id
                                          ? { ...module, lectures: module.lectures.map((lecture) => lecture.id === lec.id ? { ...lecture, timeLimitMinutes: Math.max(1, Number(e.target.value) || 1) } : lecture) }
                                          : module))}
                                        className="h-8 w-24 text-xs"
                                      />
                                    </div>
                                    {lec.quizQuestions.map((q, qIdx) => (
                                      <div key={`edit-${lec.id}-q-${qIdx}`} className="rounded border border-border/50 bg-background p-2 space-y-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="text-[11px] font-semibold text-muted-foreground">Q{qIdx + 1}</span>
                                          {lec.quizQuestions.length > 1 && (
                                            <button
                                              type="button"
                                              onClick={() => removeQuizQuestion(mod.id, lec.id, qIdx)}
                                              className="text-[10px] text-destructive hover:underline shrink-0"
                                            >
                                              Remove
                                            </button>
                                          )}
                                        </div>
                                        <Input
                                          value={q.question}
                                          onChange={(e) => updateQuizQuestion(mod.id, lec.id, qIdx, { question: e.target.value })}
                                          placeholder="Question text"
                                          className="h-7 text-xs"
                                        />
                                        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                                          {(q.choices.length >= 2 ? q.choices : ['', '', '', '']).map((choice, cIdx) => (
                                            <Input
                                              key={`edit-${lec.id}-q${qIdx}-c${cIdx}`}
                                              value={choice}
                                              onChange={(e) => {
                                                const choices = [...(q.choices.length >= 2 ? q.choices : ['', '', '', ''])];
                                                choices[cIdx] = e.target.value;
                                                updateQuizQuestion(mod.id, lec.id, qIdx, { choices });
                                              }}
                                              placeholder={`Choice ${cIdx + 1}`}
                                              className="h-7 text-xs"
                                            />
                                          ))}
                                        </div>
                                        <select
                                          value={q.correctChoice}
                                          onChange={(e) => updateQuizQuestion(mod.id, lec.id, qIdx, { correctChoice: Number(e.target.value) })}
                                          className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
                                        >
                                          {(q.choices.length >= 2 ? q.choices : ['', '', '', '']).map((_, cIdx) => (
                                            <option key={cIdx} value={cIdx}>Correct: choice {cIdx + 1}</option>
                                          ))}
                                        </select>
                                      </div>
                                    ))}
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => addQuizQuestion(mod.id, lec.id)}
                                      className="h-7 gap-1 text-xs w-full mt-1"
                                    >
                                      <Plus className="h-3 w-3" /> Add Question
                                    </Button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ))}

                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => addLecture(mod.id)}
                          className="text-xs h-7 text-primary gap-1 mt-1"
                        >
                          <Plus className="h-3 w-3" /> Add Lecture
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border sticky bottom-0 bg-card py-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingCourse(null)}
                >
                  Cancel
                </Button>
                <Button type="submit">Save & Submit for Re-Approval</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}