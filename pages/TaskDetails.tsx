
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Briefcase, User, Tag, ExternalLink,
  Edit2, Globe, Save, Plus, Trash2, Loader2, Code,
  Maximize2, Minimize2, Link as LinkIcon, Eye, EyeOff, Paperclip,
  CheckCircle2, Circle, CircleDot, Check, X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useData } from '../context/DataContext';
import { PriorityBadge, StatusBadge, UserAvatar, getLocalDateISOString, getTaskUrl } from '../lib/utils';
import { NewTaskModal } from '../components/NewTaskModal';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { supabase } from '../lib/supabase';
import { usePermissions } from '../hooks/usePermissions';
import { useGlobalAlert } from '../components/GlobalAlert';
import { hasExternalPermission } from '../lib/access';
import { nanoid } from 'nanoid';

// --- Types (Single Source of Truth Structure) ---
type ResourceType = 'url' | 'html';
type DisplayMode = 'iframe-100' | 'iframe-50' | 'link-only';

interface ResourceItem {
  type: ResourceType;
  value: string;
  displayMode: DisplayMode;
}

// --- Helper: Parse Logic ---
const parseTaskResources = (task: any): ResourceItem[] => {
  if (!task) return [];

  const rawContent = task.content_url ?? task.url;

  if (!rawContent) return [];

  try {
    let content;

    if (typeof rawContent === 'string') {
      try {
        content = JSON.parse(rawContent);
      } catch {
        content = [rawContent];
      }
    } else {
      content = rawContent;
    }

    if (Array.isArray(content)) {
      return content.map((item: any) => {
        if (typeof item === 'string') {
          return {
            type: 'url',
            value: item,
            displayMode: 'iframe-100'
          };
        }
        return {
          type: item.type || 'url',
          value: item.value || '',
          displayMode: item.displayMode || 'iframe-100'
        };
      });
    }

    return [];
  } catch (e) {
    console.error("Erro ao ler recursos do banco:", e);
    return [];
  }
};

export const TaskDetails = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { tasks, fetchData, users, projects } = useData();
  const { checkProjectPermissions, checkTaskPermissions, withTaskEditPermission } = usePermissions();
  const { showAlert } = useGlobalAlert();
  const isExternalRoute = location.pathname.startsWith('/my-projects');
  const getTaskDetailsUrl = (task: any) => {
    const taskUrl = getTaskUrl(task);
    return isExternalRoute ? taskUrl.replace('/tasks/', '/my-projects/tasks/') : taskUrl;
  };
  const ExternalBadge = () => (
    <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
      External
    </span>
  );

  // UI States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [isSavingDesc, setIsSavingDesc] = useState(false);
  const [isAddingResource, setIsAddingResource] = useState(false);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [isSavingSubtask, setIsSavingSubtask] = useState(false);
  const [isUpdatingSubtaskId, setIsUpdatingSubtaskId] = useState<number | null>(null);
  const [subtaskToEdit, setSubtaskToEdit] = useState<any | null>(null);
  const [subtaskToDelete, setSubtaskToDelete] = useState<any | null>(null);
  const [isDeletingSubtask, setIsDeletingSubtask] = useState(false);
  const [showSubtaskAssigneeDropdown, setShowSubtaskAssigneeDropdown] = useState(false);
  const [showEditSubtaskAssigneeDropdown, setShowEditSubtaskAssigneeDropdown] = useState(false);
  const [showDescPreview, setShowDescPreview] = useState(false);

  // Data States
  const [description, setDescription] = useState('');
  const [resources, setResources] = useState<ResourceItem[]>([]);

  // Form States
  const [newResValue, setNewResValue] = useState('');
  const [newResDisplay, setNewResDisplay] = useState<DisplayMode>('iframe-100');
  const [newSubtask, setNewSubtask] = useState({
    title: '',
    description: '',
    assigneeId: '',
    assigneeSearch: '',
    deadline: ''
  });
  const [editSubtaskForm, setEditSubtaskForm] = useState({
    title: '',
    description: '',
    assigneeId: '',
    assigneeSearch: '',
    deadline: ''
  });

  const normalizedTaskId = taskId?.replace(/\.$/, '');
  const task = tasks.find((t: any) =>
    t.public_id === taskId || t.public_id === normalizedTaskId
  );

  const project = projects.find((p: any) => p.id === task?.projetoId || p.id === task?.project_id);
  const parentTask = task?.parentTaskId ? tasks.find((t: any) => t.id === task.parentTaskId) : null;
  const isSubtask = !!parentTask;
  const subtasks = tasks
    .filter((t: any) => t.parentTaskId === task?.id)
    .sort((a: any, b: any) => {
      const statusOrder: Record<string, number> = { doing: 0, todo: 1, review: 2, done: 3, archived: 4 };
      const statusDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
      if (statusDiff !== 0) return statusDiff;
      if (!a.prazo && !b.prazo) return 0;
      if (!a.prazo) return 1;
      if (!b.prazo) return -1;
      return new Date(a.prazo + 'T12:00:00').getTime() - new Date(b.prazo + 'T12:00:00').getTime();
    });
  const completedSubtasks = subtasks.filter((t: any) => t.status === 'done').length;
  const subtaskProgress = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;
  const parentAssigneeIds = task?.responsavelIds || [];
  const selectedSubtaskAssignee = users.find((u: any) => String(u.id) === newSubtask.assigneeId);
  const filteredSubtaskAssignees = users
    .filter((user: any) => {
      const query = newSubtask.assigneeSearch.trim().toLowerCase();
      if (!query) return parentAssigneeIds.includes(user.id);
      return user.nome?.toLowerCase().includes(query) || user.email?.toLowerCase().includes(query);
    })
    .sort((a: any, b: any) => {
      const aInParent = parentAssigneeIds.includes(a.id);
      const bInParent = parentAssigneeIds.includes(b.id);
      if (aInParent === bInParent) return (a.nome || '').localeCompare(b.nome || '');
      return aInParent ? -1 : 1;
    });
  const selectedEditSubtaskAssignee = users.find((u: any) => String(u.id) === editSubtaskForm.assigneeId);
  const filteredEditSubtaskAssignees = users
    .filter((user: any) => {
      const query = editSubtaskForm.assigneeSearch.trim().toLowerCase();
      if (!query) return parentAssigneeIds.includes(user.id);
      return user.nome?.toLowerCase().includes(query) || user.email?.toLowerCase().includes(query);
    })
    .sort((a: any, b: any) => {
      const aInParent = parentAssigneeIds.includes(a.id);
      const bInParent = parentAssigneeIds.includes(b.id);
      if (aInParent === bInParent) return (a.nome || '').localeCompare(b.nome || '');
      return aInParent ? -1 : 1;
    });

  // --- Effect: Load from Source of Truth ---
  useEffect(() => {
    if (task) {
      setDescription(task.descricao || '');
      setResources(parseTaskResources(task));
    }
  }, [task]);

  useEffect(() => {
    if (!task?.id) return;

    const scrollToTop = () => {
      const appScroller = document.getElementById('app-main-scroll');
      appScroller?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    scrollToTop();
    const frame = window.requestAnimationFrame(() => {
      scrollToTop();
      window.requestAnimationFrame(scrollToTop);
    });
    const timeout = window.setTimeout(scrollToTop, 120);

    setIsAddingSubtask(false);
    setSubtaskToEdit(null);
    setSubtaskToDelete(null);
    setShowSubtaskAssigneeDropdown(false);
    setShowEditSubtaskAssigneeDropdown(false);
    setNewSubtask({ title: '', description: '', assigneeId: '', assigneeSearch: '', deadline: '' });
    setEditSubtaskForm({ title: '', description: '', assigneeId: '', assigneeSearch: '', deadline: '' });

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [task?.id]);

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-gray-500">
        <p className="text-lg">Tarefa não encontrada.</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-blue-600 hover:underline">Voltar</button>
      </div>
    );
  }

  // --- Handlers ---

  const handleSaveDescription = async () => {
    if (!task || !project) return;

    withTaskEditPermission(task, project, async () => {
      setIsSavingDesc(true);
      try {
        const { error } = await supabase
          .from('tasks')
          .update({ description: description })
          .eq('id', task.id);

        if (error) throw error;

        await fetchData(true);
        setIsEditingDesc(false);
        setShowDescPreview(false);
      } catch (error) {
        console.error("Error saving description:", error);
        showAlert("Erro ao Salvar", "Não foi possível salvar a descrição.", "error");
      } finally {
        setIsSavingDesc(false);
      }
    });
  };

  const handleAddResource = async () => {
    if (!newResValue.trim() || !task || !project) return;

    withTaskEditPermission(task, project, async () => {
      setIsAddingResource(true);

      const newResource: ResourceItem = {
        type: 'url',
        value: newResValue.trim(),
        displayMode: newResDisplay
      };

      const updatedResources = [...resources, newResource];
      setResources(updatedResources);
      setNewResValue('');

      try {
        await saveResources(updatedResources);
      } finally {
        setIsAddingResource(false);
      }
    });
  };

  const saveResources = async (resourcesToSave: ResourceItem[]) => {
    try {
      const valueToSave = resourcesToSave.length > 0 ? JSON.stringify(resourcesToSave) : null;

      // Atualiza content_url E attachments_count ao mesmo tempo
      const { error } = await supabase
        .from('tasks')
        .update({
          content_url: valueToSave,
          attachments_count: resourcesToSave.length
        })
        .eq('id', task.id);

      if (error) throw error;

      await fetchData(true);
    } catch (err: any) {
      console.error('Erro ao salvar recursos no banco:', err);
      showAlert("MSG_ERROR", `Erro ao salvar recursos: ${err.message || 'Erro desconhecido'}`, "error");
      await fetchData(true);
    }
  };

  const handleDeleteResource = async (indexToRemove: number) => {
    if (!task || !project) return;
    withTaskEditPermission(task, project, async () => {
      const updatedResources = resources.filter((_, index) => index !== indexToRemove);
      await saveResources(updatedResources);
    });
  };

  const canEditCurrentTask = () => !!task && !!project && checkTaskPermissions(task, project).canEdit;
  const canDeleteSubtasks = () => !!project && checkProjectPermissions(project).canEdit;

  const runSubtaskAction = (subtask: any, action: () => void) => {
    if (!task || !project) return;

    const canEditSubtask = checkTaskPermissions(subtask, project).canEdit;
    if (canEditCurrentTask() || canEditSubtask) {
      action();
      return;
    }

    showAlert("Acesso Negado", "Apenas responsáveis pela tarefa ou gerentes podem editar subtarefas.", "warning");
  };

  const handleCreateSubtask = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!task || !project || !newSubtask.title.trim()) return;

    if (!canEditCurrentTask()) {
      showAlert("Acesso Negado", "Apenas responsáveis pela tarefa ou gerentes podem criar subtarefas.", "warning");
      return;
    }

    setIsSavingSubtask(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{
          public_id: nanoid(5),
          title: newSubtask.title.trim(),
          description: newSubtask.description.trim() || null,
          status: 'todo',
          priority: task.priority || task.prioridade || 'média',
          start_date: getLocalDateISOString(),
          deadline: newSubtask.deadline || null,
          tags: [],
          attachments_count: 0,
          content_url: null,
          project_id: task.project_id || task.projetoId,
          parent_task_id: task.id
        }])
        .select()
        .single();

      if (error) throw error;

      if (newSubtask.assigneeId) {
        const { error: assignErr } = await supabase
          .from('task_assignees')
          .insert([{
            task_id: data.id,
            profile_id: Number(newSubtask.assigneeId)
          }]);

        if (assignErr) throw assignErr;
      }

      setNewSubtask({ title: '', description: '', assigneeId: '', assigneeSearch: '', deadline: '' });
      setShowSubtaskAssigneeDropdown(false);
      setIsAddingSubtask(false);
      await fetchData(true);
    } catch (error: any) {
      console.error("Erro ao criar subtarefa:", error);
      showAlert("Erro ao Criar", error.message || "Não foi possível criar a subtarefa.", "error");
    } finally {
      setIsSavingSubtask(false);
    }
  };

  const startEditingSubtask = (subtask: any) => {
    const currentAssigneeId = subtask.responsavelIds?.[0] ? String(subtask.responsavelIds[0]) : '';
    setSubtaskToEdit(subtask);
    setEditSubtaskForm({
      title: subtask.titulo || '',
      description: subtask.descricao || '',
      assigneeId: currentAssigneeId,
      assigneeSearch: '',
      deadline: subtask.prazo || ''
    });
    setShowEditSubtaskAssigneeDropdown(false);
  };

  const cancelEditingSubtask = () => {
    setSubtaskToEdit(null);
    setEditSubtaskForm({ title: '', description: '', assigneeId: '', assigneeSearch: '', deadline: '' });
    setShowEditSubtaskAssigneeDropdown(false);
  };

  const handleUpdateSubtask = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!subtaskToEdit || !project || !editSubtaskForm.title.trim()) return;

    runSubtaskAction(subtaskToEdit, async () => {
      setIsSavingSubtask(true);
      try {
        const { error } = await supabase
          .from('tasks')
          .update({
            title: editSubtaskForm.title.trim(),
            description: editSubtaskForm.description.trim() || null,
            deadline: editSubtaskForm.deadline || null
          })
          .eq('id', subtaskToEdit.id);

        if (error) throw error;

        await supabase.from('task_assignees').delete().eq('task_id', subtaskToEdit.id);

        if (editSubtaskForm.assigneeId) {
          const { error: assignErr } = await supabase
            .from('task_assignees')
            .insert([{
              task_id: subtaskToEdit.id,
              profile_id: Number(editSubtaskForm.assigneeId)
            }]);

          if (assignErr) throw assignErr;
        }

        cancelEditingSubtask();
        await fetchData(true);
      } catch (error: any) {
        console.error("Erro ao editar subtarefa:", error);
        showAlert("Erro ao Salvar", error.message || "Não foi possível editar a subtarefa.", "error");
      } finally {
        setIsSavingSubtask(false);
      }
    });
  };

  const handleDeleteSubtask = async () => {
    if (!subtaskToDelete || !project) return;

    if (!canDeleteSubtasks()) {
      showAlert("Acesso Negado", "Apenas gerentes do projeto podem apagar subtarefas.", "warning");
      return;
    }

    setIsDeletingSubtask(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', subtaskToDelete.id);

      if (error) throw error;

      if (subtaskToEdit?.id === subtaskToDelete.id) {
        cancelEditingSubtask();
      }

      setSubtaskToDelete(null);
      await fetchData(true);
    } catch (error: any) {
      console.error("Erro ao apagar subtarefa:", error);
      showAlert("Erro ao Apagar", error.message || "Não foi possível apagar a subtarefa.", "error");
    } finally {
      setIsDeletingSubtask(false);
    }
  };

  const getNextSubtaskStatus = (status: string) => {
    if (status === 'todo') return 'doing';
    if (status === 'doing') return 'done';
    return 'todo';
  };

  const handleCycleSubtaskStatus = async (subtask: any) => {
    if (!project) return;

    runSubtaskAction(subtask, async () => {
      const nextStatus = getNextSubtaskStatus(subtask.status);
      setIsUpdatingSubtaskId(subtask.id);
      try {
        const { error } = await supabase
          .from('tasks')
          .update({ status: nextStatus })
          .eq('id', subtask.id);

        if (error) throw error;

        await fetchData(true);
      } catch (error: any) {
        console.error("Erro ao atualizar subtarefa:", error);
        showAlert("Erro ao Atualizar", error.message || "Não foi possível atualizar a subtarefa.", "error");
      } finally {
        setIsUpdatingSubtaskId(null);
      }
    });
  };

  const renderSubtaskStatusIcon = (status: string) => {
    if (status === 'done') return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    if (status === 'doing') return <CircleDot className="w-5 h-5 text-yellow-500" />;
    return <Circle className="w-5 h-5 text-gray-300" />;
  };

  const getSubtaskStatusLabel = (status: string) => {
    if (status === 'done') return 'Concluída';
    if (status === 'doing') return 'Fazendo';
    return 'A fazer';
  };

  // --- Renders ---

  const renderResourceCard = (res: ResourceItem, index: number) => {
    const colSpanClass = 'lg:col-span-2';

    return (
      <div key={index} className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group flex flex-col ${colSpanClass} transition-all duration-300`}>
        <div className="p-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 truncate max-w-[70%]">
            <Globe className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span className="truncate">{res.value || 'Embed'}</span>
          </div>
          <div className="flex items-center gap-1">
            {res.type === 'url' && (
              <a
                href={res.value}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Abrir em nova aba"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              type="button"
              onClick={() => handleDeleteResource(index)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Remover recurso"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {res.displayMode === 'link-only' ? (
          <div className="p-6 flex flex-col items-center justify-center bg-gray-50/50 flex-1 min-h-[100px]">
            {res.type === 'url' ? (
              <a href={res.value} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline font-medium break-all text-center">
                <LinkIcon className="w-4 h-4 flex-shrink-0" />
                {res.value}
              </a>
            ) : (
              <div className="text-gray-500 text-sm flex items-center gap-2">
                <Code className="w-4 h-4" />
                Conteúdo HTML Oculto (Apenas Link)
              </div>
            )}
          </div>
        ) : (
          <div className={`w-full bg-gray-100 relative ${res.displayMode === 'iframe-100' ? 'h-[700px]' : 'h-[400px]'}`}>
            {res.type === 'url' ? (
              <iframe
                src={res.value}
                className="w-full h-full border-none"
                title={`Preview recurso ${index + 1}`}
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                loading="lazy"
              />
            ) : (
              <iframe
                srcDoc={res.value}
                className="w-full h-full border-none bg-white"
                title={`Embed ${index + 1}`}
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                loading="lazy"
              />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <NewTaskModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        taskToEdit={task}
      />
      <ConfirmationModal
        isOpen={!!subtaskToDelete}
        onClose={() => {
          if (!isDeletingSubtask) setSubtaskToDelete(null);
        }}
        onConfirm={handleDeleteSubtask}
        title="Apagar Subtarefa"
        message={`Tem certeza que deseja apagar "${subtaskToDelete?.titulo || 'esta subtarefa'}"? Esta ação não pode ser desfeita.`}
        type="danger"
        confirmLabel={isDeletingSubtask ? 'Apagando...' : 'Sim, apagar'}
        cancelLabel="Cancelar"
      />

      {/* Header Navigation */}
      <button
        onClick={() => navigate(isExternalRoute ? '/my-projects' : -1)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="font-medium">Voltar</span>
      </button>

      {/* Main Content Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3">
                <StatusBadge status={task.status} />
                <PriorityBadge prioridade={task.prioridade} />
              </div>

              {parentTask && (
	                <button
	                  type="button"
	                  onClick={() => navigate(getTaskDetailsUrl(parentTask))}
	                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors"
	                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Subtarefa de: {parentTask.titulo}
                </button>
              )}

              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
                {task.titulo}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
                  <Briefcase className="w-4 h-4 text-purple-500" />
                  <span className="font-medium text-gray-700">{task.projeto}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
                  <User className="w-4 h-4 text-blue-500" />
                  <div className="flex items-center gap-2">
                    {(task.responsavelIds && users) ? (
                      users
                        .filter((u: any) => task.responsavelIds.includes(u.id))
                        .map((u: any) => (
                          <span key={u.id} className="inline-flex items-center gap-2 px-2 py-1 bg-white rounded-md border border-gray-100 text-sm text-gray-700">
                            <UserAvatar user={u} size="xs" showRing={false} />
                            <span className="truncate max-w-[120px]">{u.nome}</span>
                          </span>
                        ))
                    ) : (
                      <span className="font-medium text-gray-700">{task.responsavel}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
                  <Calendar className="w-4 h-4 text-orange-500" />
                  <span className="font-medium text-gray-700">
                    {task.dataInicio ? new Date(task.dataInicio + 'T12:00:00').toLocaleDateString('pt-BR') : '...'} - {task.prazo ? new Date(task.prazo + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem prazo'}
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
                  <Paperclip className="w-4 h-4 text-slate-500" />
                  <span className="font-medium text-gray-700">
                    {resources.length} Anexos
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (task && project) withTaskEditPermission(task, project, () => setIsEditModalOpen(true));
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-medium transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Editar Detalhes
            </button>
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                Descrição
              </h3>
              {!isEditingDesc && (
                <button
                  onClick={() => {
                    if (task && project) withTaskEditPermission(task, project, () => setIsEditingDesc(true));
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                  title="Editar descrição"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {isEditingDesc ? (
              <div className="animate-in fade-in duration-200 bg-white border border-blue-200 rounded-xl overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Editor Markdown</span>
                  <button
                    type="button"
                    onClick={() => setShowDescPreview(!showDescPreview)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors"
                  >
                    {showDescPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showDescPreview ? 'Voltar a Editar' : 'Visualizar Preview'}
                  </button>
                </div>

                {showDescPreview ? (
                  <div className="w-full p-4 min-h-[200px] prose prose-blue prose-sm max-w-none text-gray-600 overflow-y-auto">
                    <ReactMarkdown>{description}</ReactMarkdown>
                    {!description && <span className="text-gray-400 italic">Nenhuma descrição para visualizar.</span>}
                  </div>
                ) : (
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-4 bg-transparent outline-none text-gray-700 leading-relaxed resize-y min-h-[200px]"
                    placeholder="Descreva os detalhes desta tarefa (Markdown suportado)..."
                    autoFocus
                  />
                )}

                <div className="flex items-center gap-2 p-3 bg-gray-50 border-t border-gray-100 justify-end">
                  <button
                    onClick={() => {
                      setIsEditingDesc(false);
                      setShowDescPreview(false);
                      setDescription(task.descricao || '');
                    }}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                    disabled={isSavingDesc}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveDescription}
                    disabled={isSavingDesc}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
                  >
                    {isSavingDesc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar Descrição
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="prose prose-blue max-w-none text-gray-600 bg-gray-50/50 p-6 rounded-xl border border-transparent hover:border-gray-200 transition-colors cursor-text min-h-[100px]"
                onClick={() => setIsEditingDesc(true)}
              >
                {description ? (
                  <ReactMarkdown>{description}</ReactMarkdown>
                ) : (
                  <span className="text-gray-400 italic">Sem descrição fornecida. Clique para adicionar.</span>
                )}
              </div>
            )}
          </div>

          {task.tags && task.tags.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex flex-wrap gap-2">
                {task.tags.map((tag: string) => (
                  <span key={tag} className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {!isSubtask && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-visible relative">
          <div className="p-5 md:p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Subtarefas
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {subtasks.length === 0
                  ? 'Nenhuma subtarefa criada'
                  : `${completedSubtasks}/${subtasks.length} concluídas`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {subtasks.length > 0 && (
                <div className="hidden sm:flex items-center gap-2 min-w-[150px]">
                  <div className="h-2 flex-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${subtaskProgress}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-500">{subtaskProgress}%</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  if (!canEditCurrentTask()) {
                    showAlert("Acesso Negado", "Apenas responsáveis pela tarefa ou gerentes podem criar subtarefas.", "warning");
                    return;
                  }
                  setIsAddingSubtask(true);
                }}
                className="flex items-center gap-2 px-3 py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Subtarefa
              </button>
            </div>
          </div>

          {isAddingSubtask && (
            <form onSubmit={handleCreateSubtask} className="p-5 md:p-6 bg-gray-50 border-b border-gray-100 space-y-4 relative z-20">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Título
                  </label>
                  <input
                    type="text"
                    required
                    value={newSubtask.title}
                    onChange={(e) => setNewSubtask(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm"
                    placeholder="Título da subtarefa"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Data de Entrega
                  </label>
                  <input
                    type="date"
                    value={newSubtask.deadline}
                    onChange={(e) => setNewSubtask(prev => ({ ...prev, deadline: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm text-gray-600"
                  />
                </div>
              </div>

              <textarea
                value={newSubtask.description}
                onChange={(e) => setNewSubtask(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm resize-none"
                placeholder="Descrição curta da subtarefa"
              />

              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="flex-1 space-y-2 relative">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Responsável
                  </label>

                  <div className="min-h-[46px] w-full px-2 py-2 bg-white border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-500 transition-all flex flex-wrap gap-2 items-center">
	                    {selectedSubtaskAssignee && (
	                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 text-blue-700 rounded-lg text-sm font-medium shadow-sm">
	                        <UserAvatar user={selectedSubtaskAssignee} size="xs" showRing={false} />
	                        {selectedSubtaskAssignee.nome.split(' ')[0]}
	                        {hasExternalPermission(selectedSubtaskAssignee) && <ExternalBadge />}
	                        <button
                          type="button"
                          onClick={() => setNewSubtask(prev => ({ ...prev, assigneeId: '', assigneeSearch: '' }))}
                          className="hover:bg-blue-100 rounded-full p-0.5 transition-colors"
                          title="Remover responsável"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}

                    <div className="flex-1 relative min-w-[150px]">
                      <input
                        type="text"
                        value={newSubtask.assigneeSearch}
                        onChange={(e) => {
                          setNewSubtask(prev => ({ ...prev, assigneeSearch: e.target.value }));
                          setShowSubtaskAssigneeDropdown(true);
                        }}
                        onFocus={() => setShowSubtaskAssigneeDropdown(true)}
                        className="w-full bg-transparent border-none outline-none text-sm px-2 py-1 placeholder-gray-400"
                        placeholder={selectedSubtaskAssignee ? "Trocar responsável..." : "Pesquisar responsável..."}
                      />
                    </div>
                  </div>

                  {showSubtaskAssigneeDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-64 overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      {!newSubtask.assigneeSearch.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewSubtask(prev => ({ ...prev, assigneeId: '', assigneeSearch: '' }));
                            setShowSubtaskAssigneeDropdown(false);
                          }}
                          className={`w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors text-left ${!newSubtask.assigneeId ? 'bg-blue-50/50' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                              <User className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">Sem responsável</p>
                              <p className="text-xs text-gray-500">Criar subtarefa sem atribuição</p>
                            </div>
                          </div>
                          {!newSubtask.assigneeId && <Check className="w-4 h-4 text-blue-600" />}
                        </button>
                      )}

                      {filteredSubtaskAssignees.length > 0 ? (
                        <div className="py-1">
                          {filteredSubtaskAssignees.map((user: any, index: number) => {
                            const isSelected = String(user.id) === newSubtask.assigneeId;
                            return (
                              <React.Fragment key={user.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewSubtask(prev => ({
                                      ...prev,
                                      assigneeId: String(user.id),
                                      assigneeSearch: ''
                                    }));
                                    setShowSubtaskAssigneeDropdown(false);
                                  }}
                                  className={`w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors text-left ${isSelected ? 'bg-blue-50/50' : ''}`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <UserAvatar user={user} size="md" showRing={false} />
                                    <div className="min-w-0">
	                                      <div className="flex items-center gap-2">
	                                        <p className={`text-sm font-medium truncate ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
	                                          {user.nome}
	                                        </p>
	                                        {hasExternalPermission(user) && <ExternalBadge />}
	                                      </div>
                                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                    </div>
                                  </div>
                                  {isSelected && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                                </button>
                              </React.Fragment>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          Nenhum usuário encontrado
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingSubtask(false);
                      setNewSubtask({ title: '', description: '', assigneeId: '', assigneeSearch: '', deadline: '' });
                      setShowSubtaskAssigneeDropdown(false);
                    }}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                    disabled={isSavingSubtask}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSubtask || !newSubtask.title.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingSubtask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="divide-y divide-gray-100">
            {subtasks.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Circle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Adicione subtarefas para quebrar esta entrega em passos menores.</p>
              </div>
            ) : (
              subtasks.map((subtask: any) => {
                const assignedUsers = users.filter((u: any) => subtask.responsavelIds?.includes(u.id));
                const isDone = subtask.status === 'done';
                const isUpdating = isUpdatingSubtaskId === subtask.id;
                const isEditingThisSubtask = subtaskToEdit?.id === subtask.id;

                if (isEditingThisSubtask) {
                  return (
                    <form
                      key={subtask.id}
                      onSubmit={handleUpdateSubtask}
                      className="p-4 md:p-6 bg-blue-50/40 border-l-4 border-blue-500 space-y-4 relative z-20"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">
                            Título
                          </label>
                          <input
                            type="text"
                            required
                            value={editSubtaskForm.title}
                            onChange={(e) => setEditSubtaskForm(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm"
                            autoFocus
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">
                            Data de Entrega
                          </label>
                          <input
                            type="date"
                            value={editSubtaskForm.deadline}
                            onChange={(e) => setEditSubtaskForm(prev => ({ ...prev, deadline: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm text-gray-600"
                          />
                        </div>
                      </div>

                      <textarea
                        value={editSubtaskForm.description}
                        onChange={(e) => setEditSubtaskForm(prev => ({ ...prev, description: e.target.value }))}
                        rows={2}
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm resize-none"
                        placeholder="Descrição curta da subtarefa"
                      />

                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        <div className="flex-1 space-y-2 relative">
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">
                            Responsável
                          </label>

                          <div className="min-h-[46px] w-full px-2 py-2 bg-white border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-500 transition-all flex flex-wrap gap-2 items-center">
	                            {selectedEditSubtaskAssignee && (
	                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 text-blue-700 rounded-lg text-sm font-medium shadow-sm">
	                                <UserAvatar user={selectedEditSubtaskAssignee} size="xs" showRing={false} />
	                                {selectedEditSubtaskAssignee.nome.split(' ')[0]}
	                                {hasExternalPermission(selectedEditSubtaskAssignee) && <ExternalBadge />}
	                                <button
                                  type="button"
                                  onClick={() => setEditSubtaskForm(prev => ({ ...prev, assigneeId: '', assigneeSearch: '' }))}
                                  className="hover:bg-blue-100 rounded-full p-0.5 transition-colors"
                                  title="Remover responsável"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            )}

                            <div className="flex-1 relative min-w-[150px]">
                              <input
                                type="text"
                                value={editSubtaskForm.assigneeSearch}
                                onChange={(e) => {
                                  setEditSubtaskForm(prev => ({ ...prev, assigneeSearch: e.target.value }));
                                  setShowEditSubtaskAssigneeDropdown(true);
                                }}
                                onFocus={() => setShowEditSubtaskAssigneeDropdown(true)}
                                className="w-full bg-transparent border-none outline-none text-sm px-2 py-1 placeholder-gray-400"
                                placeholder={selectedEditSubtaskAssignee ? "Trocar responsável..." : "Pesquisar responsável..."}
                              />
                            </div>
                          </div>

                          {showEditSubtaskAssigneeDropdown && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-64 overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                              {!editSubtaskForm.assigneeSearch.trim() && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditSubtaskForm(prev => ({ ...prev, assigneeId: '', assigneeSearch: '' }));
                                    setShowEditSubtaskAssigneeDropdown(false);
                                  }}
                                  className={`w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors text-left ${!editSubtaskForm.assigneeId ? 'bg-blue-50/50' : ''}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                      <User className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">Sem responsável</p>
                                      <p className="text-xs text-gray-500">Manter subtarefa sem atribuição</p>
                                    </div>
                                  </div>
                                  {!editSubtaskForm.assigneeId && <Check className="w-4 h-4 text-blue-600" />}
                                </button>
                              )}

                              {filteredEditSubtaskAssignees.length > 0 ? (
                                <div className="py-1">
                                  {filteredEditSubtaskAssignees.map((user: any) => {
                                    const isSelected = String(user.id) === editSubtaskForm.assigneeId;

                                    return (
                                      <button
                                        key={user.id}
                                        type="button"
                                        onClick={() => {
                                          setEditSubtaskForm(prev => ({
                                            ...prev,
                                            assigneeId: String(user.id),
                                            assigneeSearch: ''
                                          }));
                                          setShowEditSubtaskAssigneeDropdown(false);
                                        }}
                                        className={`w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors text-left ${isSelected ? 'bg-blue-50/50' : ''}`}
                                      >
                                        <div className="flex items-center gap-3 min-w-0">
                                          <UserAvatar user={user} size="md" showRing={false} />
                                          <div className="min-w-0">
	                                            <div className="flex items-center gap-2 min-w-0">
	                                              <p className={`text-sm font-medium truncate ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
	                                                {user.nome}
	                                              </p>
	                                              {hasExternalPermission(user) && <ExternalBadge />}
	                                            </div>
	                                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                          </div>
                                        </div>
                                        {isSelected && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="p-4 text-center text-gray-500 text-sm">
                                  Nenhum usuário encontrado
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={cancelEditingSubtask}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                            disabled={isSavingSubtask}
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={isSavingSubtask || !editSubtaskForm.title.trim()}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSavingSubtask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar
                          </button>
                        </div>
                      </div>
                    </form>
                  );
                }

                return (
                  <div
                    key={subtask.id}
                    className={`px-4 py-3 md:px-6 grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_minmax(0,1fr)_170px_120px_95px_auto] items-center gap-3 transition-colors ${isDone ? 'bg-green-50/30' : 'hover:bg-gray-50'}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleCycleSubtaskStatus(subtask)}
                      disabled={isUpdating}
                      className="p-1 rounded-full hover:bg-white transition-colors disabled:cursor-wait"
                      title={`${getSubtaskStatusLabel(subtask.status)}. Clique para avançar o status.`}
                    >
                      {isUpdating ? <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> : renderSubtaskStatusIcon(subtask.status)}
                    </button>

                    <div className="flex-1 min-w-0">
	                      <button
	                        type="button"
	                        onClick={() => navigate(getTaskDetailsUrl(subtask))}
	                        className={`block text-left font-semibold text-sm transition-colors truncate max-w-full ${isDone ? 'text-gray-500 line-through' : 'text-gray-900 hover:text-blue-600'}`}
                        title={subtask.titulo}
                      >
                        {subtask.titulo}
                      </button>

                      {subtask.descricao && (
                        <p className={`text-xs mt-0.5 truncate ${isDone ? 'text-gray-400' : 'text-gray-500'}`} title={subtask.descricao}>
                          {subtask.descricao}
                        </p>
                      )}
                    </div>

                    <div className="col-start-2 md:col-start-auto flex items-center gap-1.5 min-w-0 text-xs text-gray-500">
                      {assignedUsers.length > 0 ? (
                        <>
                          <div className="flex -space-x-1.5 flex-shrink-0">
                            {assignedUsers.slice(0, 2).map((u: any) => (
                              <UserAvatar key={u.id} user={u} size="xs" className="ring-2 ring-white" />
                            ))}
                          </div>
                          <span className="truncate">
                            {assignedUsers.map((u: any) => u.nome.split(' ')[0]).join(', ')}
                          </span>
                        </>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-400">
                          <User className="w-3.5 h-3.5" />
                          Sem responsável
                        </span>
                      )}
                    </div>

                    <div className="col-start-2 md:col-start-auto flex items-center gap-1 text-xs text-gray-500">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>
                        {subtask.prazo ? new Date(subtask.prazo + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem prazo'}
                      </span>
                    </div>

                    <div className="col-start-2 md:col-start-auto">
                      <span className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-[11px] font-bold border whitespace-nowrap ${subtask.status === 'doing'
                        ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                        : isDone
                          ? 'bg-green-50 text-green-700 border-green-100'
                          : 'bg-gray-50 text-gray-500 border-gray-100'
                        }`}>
                        {getSubtaskStatusLabel(subtask.status)}
                      </span>
                    </div>

                    <div className="col-start-3 row-start-1 md:row-start-auto md:col-start-auto flex items-center justify-end gap-1">
                      {canDeleteSubtasks() && (
                        <button
                          type="button"
                          onClick={() => setSubtaskToDelete(subtask)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Apagar subtarefa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => runSubtaskAction(subtask, () => startEditingSubtask(subtask))}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar subtarefa"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Resources Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 px-1">
          <Globe className="w-5 h-5 text-gray-500" />
          Recursos e Links
        </h3>

        {/* Add New Resource Form */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-600" />
            Adicionar Novo Recurso
          </h4>

          <div className="flex flex-col gap-4">
            {/* Form Controls */}
            <div className="flex flex-col md:flex-row gap-4">
              {/* Type: somente URL (HTML embed removido) */}
              <div className="bg-gray-50 p-1 rounded-lg flex inline-flex self-start">
                <button
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 bg-white text-blue-600 shadow-sm`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  URL Link
                </button>
              </div>

              {/* Display Selection */}
              <div className="bg-gray-50 p-1 rounded-lg flex inline-flex self-start overflow-x-auto">
                <button
                  onClick={() => setNewResDisplay('iframe-100')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap ${newResDisplay === 'iframe-100' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  Largura 100%
                </button>
                <button
                  onClick={() => setNewResDisplay('iframe-50')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap ${newResDisplay === 'iframe-50' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  Largura 50%
                </button>
                <button
                  onClick={() => setNewResDisplay('link-only')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap ${newResDisplay === 'link-only' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  Apenas Link
                </button>
              </div>
            </div>

            {/* Input & Submit */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="url"
                  value={newResValue}
                  onChange={(e) => setNewResValue(e.target.value)}
                  placeholder="Cole a URL do recurso aqui (https://...)"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddResource(); }}
                />
              </div>
              <button
                onClick={handleAddResource}
                disabled={!newResValue.trim() || isAddingResource}
                className="px-6 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl font-medium transition-colors shadow-lg shadow-gray-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap h-fit"
              >
                {isAddingResource ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Adicionar
              </button>
            </div>
          </div>
        </div>

        {/* Resources Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {resources.map((res, index) => renderResourceCard(res, index))}
        </div>

        {resources.length === 0 && (
          <div className="w-full bg-white rounded-xl border border-dashed border-gray-300 p-8 flex flex-col items-center justify-center text-gray-500">
            <Globe className="w-10 h-10 mb-3 opacity-20" />
            <p>Nenhum recurso vinculado.</p>
          </div>
        )}
      </div>
    </div>
  );
};
