
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Briefcase, User, Tag, ExternalLink,
  Edit2, Globe, Save, Plus, Trash2, Loader2, Code,
  Maximize2, Minimize2, Link as LinkIcon, Eye, EyeOff, Paperclip,
  ChevronDown, ChevronUp, MapPin, Calendar as CalendarIcon, Clock, Filter, ArrowUpDown, Archive, AlertCircle,
  FolderKanban, Settings, Check, Activity, BarChart2, List, Kanban
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useData } from '../context/DataContext';
import { PriorityBadge, StatusBadge, UserAvatar, extractPublicIdFromSlug, getTaskUrl } from '../lib/utils';
import { useGlobalAlert } from '../components/GlobalAlert';
import { NewTaskModal } from '../components/NewTaskModal';
import { NewProjectModal } from '../components/NewProjectModal';
import { ProjectGantt } from '../components/ProjectGantt';
import { EventDetailsModal } from '../components/EventDetailsModal';
import { supabase } from '../lib/supabase';

interface LinkItem {
  title: string;
  url: string;
  emoji: string;
}

const COMMON_EMOJIS = [
  '🔗', '📌', '📎', '📁', '📂',
  '📄', '📝', '📊', '📑', '📕',
  '💡', '🧠', '⚙️', '🛠️', '💻',
  '🖥️', '📱', '📷', '🎥', '🎬',
  '🌐', '📧', '💬', '📢', '✅',
  '⚠️', '🚨', '🚧', '📅', '⭐'
];

type SortOption = 'status' | 'priority' | 'deadline' | 'startDate';

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

import { usePermissions } from '../hooks/usePermissions';

export const ProjectDetails = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation(); // Hook logic
  const { projects, tasks, users, events, fetchData } = useData();
  const { withProjectEditPermission, withTaskCreatePermission, withTaskEditPermission } = usePermissions();
  const { showAlert } = useGlobalAlert();

  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('status');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // Kanban Drag & Drop State
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Status Dropdown State
  const [openStatusMenuId, setOpenStatusMenuId] = useState<number | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<number | null>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  // Notes & Links State
  const [notes, setNotes] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [showNotesPreview, setShowNotesPreview] = useState(false);

  const [links, setLinks] = useState<LinkItem[]>([]);
  const [newLink, setNewLink] = useState<LinkItem>({ title: '', url: '', emoji: '🔗' });
  const [isAddingLink, setIsAddingLink] = useState(false);

  // Emoji Picker State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Events/Agenda State
  const [isEventsOpen, setIsEventsOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedEventForDetails, setSelectedEventForDetails] = useState<any>(null);

  // Gantt State
  const [isGanttOpen, setIsGanttOpen] = useState(false);

  // Find Project Logic
  const projeto = useMemo(() => {
    if (!projectId) return null;

    // Slug URL /projects/slug-full-nanoid
    const publicId = extractPublicIdFromSlug(projectId);
    // Try finding by public_id
    const found = projects.find((p: any) => p.public_id === publicId);

    return found;
  }, [projects, projectId]);

  // Load Data
  useEffect(() => {
    if (projeto) {
      setNotes(projeto.notes || '');
      setLinks(projeto.links || []);
    }
  }, [projeto]);

  // Click outside to close menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close Status Menu
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
        setOpenStatusMenuId(null);
      }
      // Close Emoji Picker
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!projeto) {
    return <div className="p-6">Projeto não encontrado</div>;
  }

  // --- Filter Logic ---
  const tarefasDoProjeto = tasks.filter((t: any) => t.projetoId === projeto.id);
  const tarefasPrincipaisDoProjeto = tarefasDoProjeto.filter((t: any) => !t.parentTaskId);
  const getSubtaskStats = (taskId: number) => {
    const taskSubtasks = tarefasDoProjeto.filter((t: any) => t.parentTaskId === taskId && t.status !== 'archived');
    if (taskSubtasks.length === 0) return null;

    return {
      completed: taskSubtasks.filter((t: any) => t.status === 'done').length,
      total: taskSubtasks.length
    };
  };

  const tarefasFiltradas = tarefasPrincipaisDoProjeto.filter((t: any) => {
    // 1. Check Archived Logic
    if (t.status === 'archived' && !showArchived) return false;

    // 2. Check Filter Status
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;

    return true;
  });

  // --- Events Logic ---
  const projectEvents = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    // Filter events for this project, sorted by date
    return events
      .filter((e: any) => e.projectId === projeto.id && new Date(e.startDate.length === 10 ? e.startDate + 'T12:00:00' : e.startDate) >= now)
      .sort((a: any, b: any) => new Date(a.startDate.length === 10 ? a.startDate + 'T12:00:00' : a.startDate).getTime() - new Date(b.startDate.length === 10 ? b.startDate + 'T12:00:00' : b.startDate).getTime());
  }, [events, projeto.id]);

  const handleEventClick = (rawEvent: any) => {
    const formattedEvent = {
      title: rawEvent.title,
      start: new Date(rawEvent.startDate),
      end: new Date(rawEvent.endDate),
      resource: rawEvent,
      isExternal: false
    };
    setSelectedEventForDetails(formattedEvent);
    setIsDetailsModalOpen(true);
  };

  // --- Grouping Logic ---
  const groupedTasks = useMemo(() => {
    const groups: { id: string; label: string; tasks: any[]; color?: string; icon?: any }[] = [];

    if (sortBy === 'status') {
      const statusOrder = ['todo', 'doing', 'review', 'done', 'archived'];
      const statusLabels: Record<string, string> = {
        todo: 'A Fazer', doing: 'Em Andamento', review: 'Em Revisão', done: 'Concluído', archived: 'Arquivado'
      };

      statusOrder.forEach(key => {
        const groupTasks = tarefasFiltradas.filter((t: any) => t.status === key)
          .sort((a: any, b: any) => {
            // Sort by shortest deadline first
            if (!a.prazo && !b.prazo) return 0;
            if (!a.prazo) return 1; // No deadline at the end
            if (!b.prazo) return -1; // No deadline at the end
            return new Date(a.prazo + 'T12:00:00').getTime() - new Date(b.prazo + 'T12:00:00').getTime();
          });

        if (groupTasks.length > 0) {
          groups.push({ id: key, label: statusLabels[key], tasks: groupTasks });
        }
      });
    }
    else if (sortBy === 'priority') {
      const priorityOrder = ['urgente', 'alta', 'média', 'baixa'];
      const priorityLabels: Record<string, string> = {
        urgente: 'Urgente', alta: 'Alta', média: 'Média', baixa: 'Baixa'
      };
      const priorityColors: Record<string, string> = {
        urgente: 'text-purple-600', alta: 'text-red-600', média: 'text-orange-600', baixa: 'text-slate-600'
      };

      priorityOrder.forEach(key => {
        const groupTasks = tarefasFiltradas.filter((t: any) => t.prioridade === key);
        if (groupTasks.length > 0) {
          groups.push({ id: key, label: priorityLabels[key], tasks: groupTasks, color: priorityColors[key] });
        }
      });
      // Handle any undefined priorities
      const others = tarefasFiltradas.filter((t: any) => !priorityOrder.includes(t.prioridade));
      if (others.length > 0) groups.push({ id: 'other', label: 'Sem Prioridade', tasks: others });
    }
    else if (sortBy === 'deadline') {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const bucket = {
        overdue: [] as any[],
        today: [] as any[],
        tomorrow: [] as any[],
        week: [] as any[],
        later: [] as any[],
        noDate: [] as any[]
      };

      tarefasFiltradas.forEach((t: any) => {
        if (!t.prazo) {
          bucket.noDate.push(t);
          return;
        }
        const d = new Date(t.prazo + 'T12:00:00');
        d.setHours(0, 0, 0, 0);
        const diffTime = d.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0 && t.status !== 'done') bucket.overdue.push(t);
        else if (diffDays === 0) bucket.today.push(t);
        else if (diffDays === 1) bucket.tomorrow.push(t);
        else if (diffDays > 1 && diffDays <= 7) bucket.week.push(t);
        else bucket.later.push(t);
      });

      // Helper to sort inside groups
      const sortDate = (a: any, b: any) => new Date(a.prazo + 'T12:00:00').getTime() - new Date(b.prazo + 'T12:00:00').getTime();

      if (bucket.overdue.length) groups.push({ id: 'overdue', label: 'Atrasadas', tasks: bucket.overdue.sort(sortDate), color: 'text-red-600', icon: AlertCircle });
      if (bucket.today.length) groups.push({ id: 'today', label: 'Para Hoje', tasks: bucket.today.sort(sortDate), color: 'text-orange-600', icon: Clock });
      if (bucket.tomorrow.length) groups.push({ id: 'tomorrow', label: 'Para Amanhã', tasks: bucket.tomorrow.sort(sortDate), color: 'text-blue-600' });
      if (bucket.week.length) groups.push({ id: 'week', label: 'Esta Semana', tasks: bucket.week.sort(sortDate) });
      if (bucket.later.length) groups.push({ id: 'later', label: 'Futuro / Concluídas', tasks: bucket.later.sort(sortDate) });
      if (bucket.noDate.length) groups.push({ id: 'nodate', label: 'Sem Prazo', tasks: bucket.noDate });
    }
    else if (sortBy === 'startDate') {
      const withDate = tarefasFiltradas.filter((t: any) => t.dataInicio).sort((a: any, b: any) => new Date(a.dataInicio + 'T12:00:00').getTime() - new Date(b.dataInicio + 'T12:00:00').getTime());
      const noDate = tarefasFiltradas.filter((t: any) => !t.dataInicio);

      if (withDate.length) groups.push({ id: 'dated', label: 'Cronograma', tasks: withDate });
      if (noDate.length) groups.push({ id: 'nodate', label: 'Sem Data de Início', tasks: noDate });
    }

    return groups;
  }, [tarefasFiltradas, sortBy]);


  const stats = {
    total: tarefasPrincipaisDoProjeto.filter((t: any) => t.status !== 'archived').length,
    todo: tarefasPrincipaisDoProjeto.filter((t: any) => t.status === 'todo').length,
    doing: tarefasPrincipaisDoProjeto.filter((t: any) => t.status === 'doing').length,
    review: tarefasPrincipaisDoProjeto.filter((t: any) => t.status === 'review').length,
    done: tarefasPrincipaisDoProjeto.filter((t: any) => t.status === 'done').length,
  };

  const handleStatusUpdate = async (taskId: number, newStatus: string) => {
    const task = tasks.find((t: any) => t.id === taskId);
    if (!task) return;

    withTaskEditPermission(task, projeto, async () => {
      setOpenStatusMenuId(null);
      setIsUpdatingStatus(taskId);
      try {
        const { error } = await supabase
          .from('tasks')
          .update({ status: newStatus })
          .eq('id', taskId);

        if (error) throw error;
        await fetchData(true); // Refresh data quietly
      } catch (error) {
        console.error("Erro ao atualizar status:", error);
        showAlert("Erro na Atualização", "Você não tem permissão para alterar este status ou ocorreu um erro.", "error");
      } finally {
        setIsUpdatingStatus(null);
      }
    });
  };

  const handleSaveNotes = async () => {
    withProjectEditPermission(projeto, async () => {
      setIsSavingNotes(true);
      try {
        const { error } = await supabase
          .from('projects')
          .update({ notes: notes })
          .eq('id', projeto.id);

        if (error) throw error;
        setIsEditingNotes(false);
        setShowNotesPreview(false);
        await fetchData(true);
      } catch (e) {
        console.error("Error saving notes", e);
        showAlert("Erro ao Salvar", "Não foi possível salvar as anotações.", "error");
      } finally {
        setIsSavingNotes(false);
      }
    });
  };

  const handleAddLink = async () => {
    if (!newLink.url || !newLink.title) return;

    withProjectEditPermission(projeto, async () => {
      setIsAddingLink(true);
      const updatedLinks = [...links, newLink];
      try {
        const { error } = await supabase
          .from('projects')
          .update({ content_url: JSON.stringify(updatedLinks) })
          .eq('id', projeto.id);

        if (error) throw error;
        setNewLink({ title: '', url: '', emoji: '🔗' });
        await fetchData(true);
      } catch (e) {
        console.error("Error saving link", e);
        showAlert("Erro ao Salvar", "Não foi possível adicionar o link.", "error");
      } finally {
        setIsAddingLink(false);
      }
    });
  };

  const handleDeleteLink = async (index: number) => {
    withProjectEditPermission(projeto, async () => {
      const updatedLinks = links.filter((_, i) => i !== index);
      setLinks(updatedLinks); // Optimistic UI
      try {
        const { error } = await supabase
          .from('projects')
          .update({ content_url: JSON.stringify(updatedLinks) })
          .eq('id', projeto.id);

        if (error) throw error;
        await fetchData(true);
      } catch (e) {
        console.error("Error removing link", e);
        showAlert("Erro ao Remover", "Não foi possível remover o link.", "error");
      }
    });
  };

  const statusOptions = [
    { value: 'todo', label: 'A Fazer', color: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200' },
    { value: 'doing', label: 'Fazendo', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200' },
    { value: 'review', label: 'Revisão', color: 'bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200' },
    { value: 'done', label: 'Concluído', color: 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200' },
    { value: 'archived', label: 'Arquivado', color: 'bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-200' }
  ];

  const getStatusStyle = (status: string) => {
    const found = statusOptions.find(o => o.value === status);
    return found ? found.color : statusOptions[0].color;
  };

  const getStatusLabel = (status: string) => {
    const found = statusOptions.find(o => o.value === status);
    return found ? found.label : status;
  };

  // --- Kanban Columns Logic ---
  // Independe do filtro de status (as colunas já segmentam por status);
  // respeita apenas o toggle "Mostrar Arquivadas" para exibir a 5ª coluna.
  const kanbanColumns = useMemo(() => {
    return statusOptions
      .filter(o => o.value !== 'archived' || showArchived)
      .map(o => {
        const colTasks = tarefasPrincipaisDoProjeto
          .filter((t: any) => t.status === o.value)
          .sort((a: any, b: any) => {
            if (!a.prazo && !b.prazo) return 0;
            if (!a.prazo) return 1;
            if (!b.prazo) return -1;
            return new Date(a.prazo + 'T12:00:00').getTime() - new Date(b.prazo + 'T12:00:00').getTime();
          });
        return { ...o, tasks: colTasks };
      });
  }, [tarefasPrincipaisDoProjeto, showArchived]);

  // Extraído para variável para poder ser reposicionado acima ou abaixo
  // dos cards de status dependendo do modo de visualização (lista/kanban).
  const agendaSection = (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsEventsOpen(!isEventsOpen)}
      >
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-bold text-gray-900">Agenda do Projeto</h2>
          <span className="text-xs font-medium bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">
            {projectEvents.length} Eventos
          </span>
        </div>
        <button className="text-gray-400">
          {isEventsOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {isEventsOpen && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          {projectEvents.length > 0 ? (
            <div className="space-y-3">
              {projectEvents.map((event: any) => {
                const date = new Date(event.startDate.length === 10 ? event.startDate + 'T12:00:00' : event.startDate);
                const day = date.getDate();
                const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();

                return (
                  <div key={event.id} className="relative pl-6 cursor-pointer group" onClick={() => handleEventClick(event)}>
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-orange-400 group-hover:scale-125 transition-transform"></div>
                    <div className="flex gap-4 p-3 bg-white rounded-lg border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all">
                      <div className="flex flex-col items-center justify-center bg-orange-50 rounded-lg w-12 h-12 flex-shrink-0 border border-orange-100">
                        <span className="text-xs font-bold text-orange-400">{month}</span>
                        <span className="text-lg font-bold text-orange-600 leading-none">{day}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-gray-900 line-clamp-1 group-hover:text-blue-600 transition-colors">{event.title}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          {event.location && (
                            <span className="text-[10px] text-gray-400 flex items-center gap-0.5 truncate">
                              <MapPin className="w-3 h-3" /> {event.location}
                            </span>
                          )}
                        </div>
                        <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] rounded-full font-medium bg-blue-50 text-blue-600 truncate max-w-full">
                          {event.category || 'Geral'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500 italic text-sm">
              Nenhum evento agendado para este projeto.
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6 pb-20">
      <NewTaskModal
        isOpen={showNewTaskModal}
        onClose={() => setShowNewTaskModal(false)}
        projeto={projeto}
      />

      <NewProjectModal
        isOpen={showEditProjectModal}
        onClose={() => setShowEditProjectModal(false)}
        projectToEdit={projeto}
        tasks={tarefasPrincipaisDoProjeto}
      />

      <EventDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        event={selectedEventForDetails}
      // Read-only in ProjectDetails
      />

      {/* Header do Projeto */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative">
        <div className="p-4 md:p-6">
          <button
            onClick={() => {
              if (location.state && location.state.from) {
                navigate(location.state.from);
              } else {
                navigate('/projects');
              }
            }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Voltar</span>
          </button>


          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900">{projeto.nome}</h1>
                    {projeto.parceria && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                        Parceria
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm md:text-base mb-3">{projeto.descricao}</p>

                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-500 items-center">
                    <div className="flex items-center gap-1.5">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-600">{projeto.responsavel}</span>
                    </div>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {projeto.dataInicio ? new Date(projeto.dataInicio + 'T12:00:00').toLocaleDateString('pt-BR') : ''} - {projeto.dataFim ? new Date(projeto.dataFim + 'T12:00:00').toLocaleDateString('pt-BR') : ''}
                    </span>

                    <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                      {projeto.capitulos && projeto.capitulos.length > 0 ? (
                        projeto.capitulos.map((cap: any) => {
                          const Icon = cap.icon || FolderKanban;
                          return (
                            <span key={cap.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-xs font-medium text-gray-700">
                              <Icon className="w-3 h-3 text-gray-500" />
                              {cap.sigla}
                            </span>
                          )
                        })
                      ) : (
                        <span className="flex items-center gap-1">
                          <FolderKanban className="w-4 h-4" />
                          {projeto.capitulo}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                {projeto.tags && projeto.tags.map((tag: string) => (
                  <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => withTaskCreatePermission(projeto, () => setShowNewTaskModal(true))}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors whitespace-nowrap shadow-sm shadow-blue-200"
              >
                <Plus className="w-5 h-5" />
                Nova Tarefa
              </button>

              <button
                onClick={() => withProjectEditPermission(projeto, () => setShowEditProjectModal(true))}
                className="p-2.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 bg-white border border-gray-200 rounded-lg transition-all shadow-sm"
                title="Editar Projeto"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-600 font-medium">Progresso Geral do Projeto</span>
              <span className="font-bold text-gray-900">{projeto.progresso}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${projeto.progresso}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* No modo Kanban, a Agenda sobe para logo após o Header */}
      {viewMode === 'kanban' && agendaSection}

      {/* Filtros de Status (Cards) - Hidden on Mobile */}
      <div className="hidden md:grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        <div
          onClick={() => setFilterStatus('all')}
          className={`bg-white p-4 rounded-xl shadow-sm border-2 cursor-pointer transition-all ${filterStatus === 'all' ? 'border-blue-600' : 'border-gray-100 hover:border-gray-200'
            }`}
        >
          <p className="text-xs md:text-sm text-gray-500 font-medium">Total (Ativas)</p>
          <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>

        <div
          onClick={() => setFilterStatus('todo')}
          className={`bg-white p-4 rounded-xl shadow-sm border-2 cursor-pointer transition-all ${filterStatus === 'todo' ? 'border-gray-600' : 'border-gray-100 hover:border-gray-200'
            }`}
        >
          <p className="text-xs md:text-sm text-gray-500 font-medium">A Fazer</p>
          <p className="text-2xl md:text-3xl font-bold text-gray-700 mt-1">{stats.todo}</p>
        </div>

        <div
          onClick={() => setFilterStatus('doing')}
          className={`bg-white p-4 rounded-xl shadow-sm border-2 cursor-pointer transition-all ${filterStatus === 'doing' ? 'border-blue-600' : 'border-gray-100 hover:border-gray-200'
            }`}
        >
          <p className="text-xs md:text-sm text-gray-500 font-medium">Fazendo</p>
          <p className="text-2xl md:text-3xl font-bold text-blue-600 mt-1">{stats.doing}</p>
        </div>

        <div
          onClick={() => setFilterStatus('review')}
          className={`bg-white p-4 rounded-xl shadow-sm border-2 cursor-pointer transition-all ${filterStatus === 'review' ? 'border-yellow-600' : 'border-gray-100 hover:border-gray-200'
            }`}
        >
          <p className="text-xs md:text-sm text-gray-500 font-medium">Revisão</p>
          <p className="text-2xl md:text-3xl font-bold text-yellow-600 mt-1">{stats.review}</p>
        </div>

        <div
          onClick={() => setFilterStatus('done')}
          className={`bg-white p-4 rounded-xl shadow-sm border-2 cursor-pointer transition-all ${filterStatus === 'done' ? 'border-green-600' : 'border-gray-100 hover:border-gray-200'
            }`}
        >
          <p className="text-xs md:text-sm text-gray-500 font-medium">Concluído</p>
          <p className="text-2xl md:text-3xl font-bold text-green-600 mt-1">{stats.done}</p>
        </div>
      </div>

      {/* No modo Lista, a Agenda mantém a posição original */}
      {viewMode === 'list' && agendaSection}

      {/* Lista de Tarefas */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible">
        <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900">
              Tarefas do Projeto
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {viewMode === 'kanban'
                ? `${kanbanColumns.reduce((acc, c) => acc + c.tasks.length, 0)} tarefas`
                : `${filterStatus === 'all' ? 'Todas as tarefas' : `Filtrando: ${filterStatus}`} (${tarefasFiltradas.length})`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle: List / Kanban */}
            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-200">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                title="Visualização em Lista"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                title="Visualização em Kanban"
              >
                <Kanban className="w-4 h-4" />
              </button>
            </div>

            {viewMode === 'list' && (
              <>
                {/* Sort Select */}
                <div className="relative flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                    <ArrowUpDown className="w-3 h-3" /> Ordenar:
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="bg-transparent border-none text-sm font-medium text-gray-900 focus:ring-0 cursor-pointer outline-none pl-1 pr-6"
                    style={{ backgroundImage: 'none' }}
                  >
                    <option value="status">Status</option>
                    <option value="priority">Prioridade</option>
                    <option value="deadline">Data de Entrega</option>
                    <option value="startDate">Data de Início</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-3 pointer-events-none" />
                </div>

                {/* Mobile Status Filter */}
                <div className="md:hidden relative flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Status:
                  </span>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-transparent border-none text-sm font-medium text-gray-900 focus:ring-0 cursor-pointer outline-none pl-1 pr-6"
                    style={{ backgroundImage: 'none' }}
                  >
                    <option value="all">Todos</option>
                    <option value="todo">A Fazer</option>
                    <option value="doing">Fazendo</option>
                    <option value="review">Revisão</option>
                    <option value="done">Concluído</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-3 pointer-events-none" />
                </div>
              </>
            )}

            {/* Toggle Show Archived */}
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${showArchived ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
            >
              <Archive className="w-4 h-4" />
              <span className="hidden sm:inline">{showArchived ? 'Ocultar Arquivadas' : 'Mostrar Arquivadas'}</span>
            </button>

            {viewMode === 'list' && filterStatus !== 'all' && (
              <button
                onClick={() => setFilterStatus('all')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-sm font-medium hover:bg-blue-100 transition-colors"
              >
                <Filter className="w-3.5 h-3.5" />
                Limpar filtro
              </button>
            )}
          </div>
        </div>

        {viewMode === 'kanban' ? (
        <div className="p-4 md:p-6 overflow-x-auto">
          <div className="flex gap-4 min-w-max items-start">
            {kanbanColumns.map((col) => (
              <div
                key={col.value}
                onDragOver={(e) => {
                  if (draggedTaskId == null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverColumn !== col.value) setDragOverColumn(col.value);
                }}
                onDragLeave={(e) => {
                  // Ignore leave events that bubble from a child element into another child
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  setDragOverColumn((prev) => (prev === col.value ? null : prev));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverColumn(null);
                  const taskId = draggedTaskId;
                  setDraggedTaskId(null);
                  if (taskId == null) return;
                  const draggedTask = tasks.find((t: any) => t.id === taskId);
                  if (draggedTask && draggedTask.status !== col.value) {
                    handleStatusUpdate(taskId, col.value);
                  }
                }}
                className={`w-72 flex-shrink-0 bg-gray-50 rounded-xl border-2 flex flex-col max-h-[70vh] transition-colors ${dragOverColumn === col.value ? 'border-blue-400 bg-blue-50/50' : 'border-transparent'}`}
              >
                <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                  <span className={`text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-full border ${col.color}`}>
                    {col.label}
                  </span>
                  <span className="text-xs font-bold text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                    {col.tasks.length}
                  </span>
                </div>

                <div className="p-3 space-y-3 overflow-y-auto">
                  {col.tasks.length === 0 ? (
                    <p className="text-xs text-gray-400 italic text-center py-6 pointer-events-none">
                      {dragOverColumn === col.value ? 'Solte aqui' : 'Nenhuma tarefa'}
                    </p>
                  ) : (
	                    col.tasks.map((tarefa: any) => {
	                      const assignedUsers = users.filter((u: any) => tarefa.responsavelIds?.includes(u.id));
	                      const isArchived = tarefa.status === 'archived';
	                      const isDragging = draggedTaskId === tarefa.id;
	                      const isUpdatingThis = isUpdatingStatus === tarefa.id;
	                      const subtaskStats = getSubtaskStats(tarefa.id);

	                      return (
                        <div
                          key={tarefa.id}
                          draggable={!isUpdatingStatus}
                          onDragStart={(e) => {
                            setDraggedTaskId(tarefa.id);
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', String(tarefa.id));
                          }}
                          onDragEnd={() => {
                            setDraggedTaskId(null);
                            setDragOverColumn(null);
                          }}
                          onClick={() => navigate(getTaskUrl(tarefa))}
                          className={`relative bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-blue-200 transition-all ${isArchived ? 'opacity-75 grayscale-[0.5]' : ''} ${isDragging ? 'opacity-40' : ''} ${isUpdatingThis ? 'opacity-70 pointer-events-none' : ''}`}
                        >
                          {isUpdatingThis && (
                            <div className="absolute inset-0 bg-white/60 rounded-lg flex items-center justify-center z-10">
                              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                            </div>
                          )}
                          <h4 className={`text-sm font-semibold mb-2 line-clamp-2 ${isArchived ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                            {tarefa.titulo}
                          </h4>

                          {tarefa.tags && tarefa.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {tarefa.tags.map((tag: string) => (
                                <span key={tag} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between mt-2">
                            <PriorityBadge prioridade={tarefa.prioridade} />

                            {assignedUsers.length > 0 ? (
                              <div className="flex -space-x-2">
                                {assignedUsers.slice(0, 3).map((u: any) => (
                                  <UserAvatar key={u.id} user={u} size="sm" className="ring-2 ring-white" />
                                ))}
                                {assignedUsers.length > 3 && (
                                  <div className="flex items-center justify-center h-6 w-6 rounded-full ring-2 ring-white bg-gray-100 text-[10px] font-bold text-gray-500">
                                    +{assignedUsers.length - 3}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <User className="w-3.5 h-3.5 text-gray-300" />
                            )}
                          </div>

	                          {(tarefa.prazo || subtaskStats) && (
	                            <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-gray-500">
	                              {tarefa.prazo && (
	                                <span className="flex items-center gap-1">
	                                  <Calendar className="w-3 h-3" />
	                                  {new Date(tarefa.prazo + 'T12:00:00').toLocaleDateString('pt-BR')}
	                                </span>
	                              )}
	                              {subtaskStats && (
	                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-green-50 text-green-700 border border-green-100 font-bold" title="Subtarefas concluídas">
	                                  ✅ {subtaskStats.completed}/{subtaskStats.total}
	                                </span>
	                              )}
	                            </div>
	                          )}
	                        </div>
	                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        ) : (
        <div className="divide-y divide-gray-100">
          {groupedTasks.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Code className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">Nenhuma tarefa encontrada</p>
              <p className="text-sm text-gray-400 mt-1">Crie uma nova tarefa para começar</p>
            </div>
          ) : (
            groupedTasks.map((group) => (
              <div key={group.id} className="last:border-b-0 border-b border-gray-100">
                {/* Group Header */}
                {groupedTasks.length > 1 && (
                  <div className="bg-gray-50 px-6 py-2.5 flex items-center gap-2 border-b border-gray-100">
                    {group.icon && <group.icon className={`w-4 h-4 ${group.color || 'text-gray-500'}`} />}
                    <h3 className={`text-sm font-bold uppercase tracking-wide ${group.color || 'text-gray-600'}`}>
                      {group.label}
                    </h3>
                    <span className="bg-white px-2 py-0.5 rounded-full text-xs font-bold text-gray-400 border border-gray-200">
                      {group.tasks.length}
                    </span>
                  </div>
                )}

                {/* Tasks in Group */}
                <div className="divide-y divide-gray-100">
	                  {group.tasks.map((tarefa: any) => {
	                    const assignedUsers = users.filter((u: any) =>
	                      tarefa.responsavelIds?.includes(u.id)
	                    );
	                    const isArchived = tarefa.status === 'archived';
	                    const subtaskStats = getSubtaskStats(tarefa.id);

	                    return (
                      <div
                        key={tarefa.id}
                        className={`p-4 md:p-6 transition-colors group cursor-pointer relative ${isArchived ? 'bg-slate-50 opacity-75 grayscale-[0.5] hover:opacity-100' : 'hover:bg-gray-50'}`}
                        onClick={() => navigate(getTaskUrl(tarefa))}
                      >
                        <div className="flex gap-4 items-center">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h3 className={`font-semibold text-sm md:text-base flex-1 transition-colors ${isArchived ? 'text-gray-500 line-through' : 'text-gray-900 group-hover:text-blue-600'}`}>
                                {tarefa.titulo}
                              </h3>
                              <button className="p-1 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                <Edit2 className="w-4 h-4 text-gray-500" />
                              </button>
                            </div>

                            {/* Description removed */}

                            {tarefa.tags && tarefa.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-4">
                                {tarefa.tags.map((tag: string) => (
                                  <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                              <PriorityBadge prioridade={tarefa.prioridade} />

                              <div className="h-4 w-px bg-gray-200 hidden sm:block"></div>

                              <div className="flex items-center">
                                {assignedUsers.length > 0 ? (
                                  <div className="flex -space-x-2 overflow-hidden">
                                    {assignedUsers.map((u: any) => (
                                      <UserAvatar key={u.id} user={u} size="sm" className="ring-2 ring-white" />
                                    ))}
                                    {assignedUsers.length > 4 && (
                                      <div className="flex items-center justify-center h-6 w-6 rounded-full ring-2 ring-white bg-gray-100 text-[10px] font-bold text-gray-500">
                                        +{assignedUsers.length - 4}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="flex items-center gap-1 italic text-gray-400">
                                    <User className="w-3 h-3" />
                                    Sem responsável
                                  </span>
                                )}
                              </div>

                              <div className="h-4 w-px bg-gray-200 hidden sm:block"></div>

	                              <span className="flex items-center gap-1">
	                                <Calendar className="w-3.5 h-3.5" />
	                                {tarefa.prazo ? new Date(tarefa.prazo + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
	                              </span>

	                              {subtaskStats && (
	                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 text-green-700 border border-green-100 font-bold" title="Subtarefas concluídas">
	                                  ✅ {subtaskStats.completed}/{subtaskStats.total}
	                                </span>
	                              )}

	                              <div className="flex items-center gap-3 ml-auto mr-4">
                                {tarefa.anexos > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Paperclip className="w-3.5 h-3.5" />
                                    {tarefa.anexos}
                                  </span>
                                )}
                                {/* Comments count removed */}
                              </div>
                            </div>
                          </div>

                          <div className="flex-shrink-0 ml-2" ref={openStatusMenuId === tarefa.id ? statusMenuRef : null}>
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenStatusMenuId(openStatusMenuId === tarefa.id ? null : tarefa.id);
                                }}
                                disabled={isUpdatingStatus === tarefa.id}
                                className={`flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border-2 font-bold text-sm transition-all shadow-sm min-w-[140px] ${getStatusStyle(tarefa.status)} ${isUpdatingStatus === tarefa.id ? 'opacity-70 cursor-wait' : 'hover:shadow-md hover:brightness-95'}`}
                              >
                                {isUpdatingStatus === tarefa.id ? (
                                  <div className="flex items-center justify-center w-full">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  </div>
                                ) : (
                                  <>
                                    <span>{getStatusLabel(tarefa.status)}</span>
                                    <ChevronDown className="w-4 h-4 opacity-70" />
                                  </>
                                )}
                              </button>

                              {openStatusMenuId === tarefa.id && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                  {statusOptions.map((option) => (
                                    <button
                                      key={option.value}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStatusUpdate(tarefa.id, option.value);
                                      }}
                                      className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center justify-between ${tarefa.status === option.value ? 'bg-blue-50/50 text-blue-700 font-medium' : 'text-gray-700'
                                        }`}
                                    >
                                      {option.label}
                                      {tarefa.status === option.value && <Check className="w-4 h-4" />}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
        )}
      </div>

      {/* Gantt Chart Section (Collapsible) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setIsGanttOpen(!isGanttOpen)}
        >
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-bold text-gray-900">Gantt Chart</h2>
          </div>
          <button className="text-gray-400">
            {isGanttOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {isGanttOpen && (
          <div className="border-t border-gray-100 p-4 bg-gray-50">
            <ProjectGantt
              projectId={projeto.id}
              tasks={tarefasFiltradas.filter((t: any) => t.status !== 'archived')} // Hide archived from Gantt
              checkpoints={projeto.checkpoints || []}
            />
          </div>
        )}
      </div>

      {/* Bloco de Informações Adicionais (Notas e Links) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 md:p-6">
          {/* Notes Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                Anotações Gerais
              </h3>
              {!isEditingNotes && (
                <button
                  onClick={() => setIsEditingNotes(true)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                  title="Editar anotações"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {isEditingNotes ? (
              <div className="animate-in fade-in duration-200 bg-white border border-blue-200 rounded-xl overflow-hidden shadow-sm">
                {/* Header with Preview Toggle */}
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Editor Markdown</span>
                  <button
                    type="button"
                    onClick={() => setShowNotesPreview(!showNotesPreview)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors"
                  >
                    {showNotesPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showNotesPreview ? 'Voltar a Editar' : 'Visualizar Preview'}
                  </button>
                </div>

                {showNotesPreview ? (
                  <div className="w-full p-4 min-h-[120px] prose prose-blue prose-sm max-w-none text-gray-600 overflow-y-auto">
                    <ReactMarkdown>{notes}</ReactMarkdown>
                    {!notes && <span className="text-gray-400 italic">Nenhuma anotação para visualizar.</span>}
                  </div>
                ) : (
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-4 bg-transparent outline-none text-gray-700 leading-relaxed resize-y min-h-[120px]"
                    placeholder="Adicione notas rápidas, contatos ou observações (Markdown suportado)..."
                    autoFocus
                  />
                )}

                <div className="flex items-center gap-2 p-3 bg-gray-50 border-t border-gray-100 justify-end">
                  <button
                    onClick={() => {
                      setIsEditingNotes(false);
                      setShowNotesPreview(false);
                      setNotes(projeto.notes || '');
                    }}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
                  >
                    {isSavingNotes ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="prose prose-sm max-w-none text-gray-600 bg-gray-50/50 p-4 rounded-xl border border-transparent hover:border-gray-200 transition-colors cursor-text min-h-[60px]"
                onClick={() => setIsEditingNotes(true)}
              >
                {notes ? <ReactMarkdown>{notes}</ReactMarkdown> : <span className="text-gray-400 italic">Sem anotações. Clique para adicionar.</span>}
              </div>
            )}
          </div>

          {/* Link Gallery Section */}
          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              Recursos e Links
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {links.map((link, idx) => (
                <div
                  key={idx}
                  className="group relative bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:shadow-md hover:border-blue-200 transition-all cursor-pointer h-32"
                  onClick={() => window.open(link.url, '_blank')}
                >
                  <span className="text-3xl mb-2 block">{link.emoji}</span>
                  <span className="text-xs font-bold text-gray-800 line-clamp-2 leading-tight">{link.title}</span>

                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteLink(idx); }}
                    className="absolute top-1 right-1 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                    title="Remover link"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Add Link Block */}
              <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-3 flex flex-col items-center justify-center text-center h-32">
                {!isAddingLink ? (
                  <div className="cursor-pointer w-full h-full flex flex-col items-center justify-center" onClick={() => setIsAddingLink(true)}>
                    <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center mb-2 shadow-sm text-blue-600">
                      <Plus className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-medium text-gray-500">Adicionar Link</span>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col gap-2">
                    <div className="flex gap-1 items-center">
                      {/* Emoji Picker Trigger */}
                      <div className="relative" ref={emojiPickerRef}>
                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className="w-8 h-8 text-center text-lg border border-gray-200 rounded bg-white hover:bg-gray-50 flex items-center justify-center transition-colors outline-none focus:ring-2 focus:ring-blue-100 overflow-hidden"
                        >
                          {newLink.emoji || '🔗'}
                        </button>

                        {/* Mini Emoji Picker */}
                        {showEmojiPicker && (
                          <div className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 shadow-xl rounded-xl p-3 z-50 w-64 animate-in fade-in zoom-in-95 duration-200">
                            <div className="grid grid-cols-6 gap-2">
                              {COMMON_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => {
                                    setNewLink({ ...newLink, emoji });
                                    setShowEmojiPicker(false);
                                  }}
                                  className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-lg transition-colors"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <input
                                type="text"
                                className="w-full px-2 py-1.5 text-sm text-center border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition-all placeholder:text-gray-400"
                                placeholder="Ou digite aqui..."
                                value={newLink.emoji}
                                onChange={(e) => setNewLink({ ...newLink, emoji: e.target.value })}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <input
                        className="flex-1 px-2 text-xs border border-gray-200 rounded bg-white outline-none focus:border-blue-500 h-8"
                        placeholder="Título"
                        value={newLink.title}
                        onChange={e => setNewLink({ ...newLink, title: e.target.value })}
                      />
                    </div>
                    <input
                      className="w-full px-2 py-1 text-xs border border-gray-200 rounded bg-white outline-none focus:border-blue-500"
                      placeholder="URL (https://...)"
                      value={newLink.url}
                      onChange={e => setNewLink({ ...newLink, url: e.target.value })}
                    />
                    <div className="flex gap-1 mt-auto">
                      <button onClick={() => setIsAddingLink(false)} className="flex-1 py-1 text-[10px] bg-gray-200 hover:bg-gray-300 rounded text-gray-600">Cancelar</button>
                      <button onClick={handleAddLink} className="flex-1 py-1 text-[10px] bg-blue-600 hover:bg-blue-700 rounded text-white font-medium">Salvar</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
