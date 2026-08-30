
import React, { useState, useRef, useEffect } from 'react';
import { X, Check, FolderKanban, Briefcase, Plus, Loader2, Save, Activity, Tag, ChevronDown, Flag, Trash2 } from 'lucide-react';
import { UserAvatar, getLocalDateISOString } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { hasExternalPermission } from '../lib/access';
import { nanoid } from 'nanoid';
import { ConfirmationModal } from './ConfirmationModal';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  projeto?: any;
  taskToEdit?: any; // New prop for editing mode
}

export const NewTaskModal = ({ isOpen, onClose, projeto = null, taskToEdit = null }: NewTaskModalProps) => {
  const { users, projects, fetchData } = useData();
  const { profile } = useAuth();

  const ExternalBadge = () => (
    <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
      External
    </span>
  );

  // Helper to calculate default dates
  const getTodayDate = () => getLocalDateISOString();
  const getNextWeekDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    selectedProjectId: projeto ? projeto.id : null,
    responsavelIds: [],
    prioridade: 'média',
    dataInicio: getTodayDate(),
    prazo: getNextWeekDate(),
    tags: [] as string[],
    status: 'todo'
  });

  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Search & Dropdown States
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);

  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const priorityDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (taskToEdit) {
        // Populate for Edit Mode
        setFormData({
          titulo: taskToEdit.titulo,
          descricao: taskToEdit.descricao || '',
          selectedProjectId: taskToEdit.projetoId || null,
          responsavelIds: taskToEdit.responsavelIds || (taskToEdit.responsavelId ? [taskToEdit.responsavelId] : []),
          prioridade: taskToEdit.prioridade || 'média',
          dataInicio: taskToEdit.dataInicio || getTodayDate(),
          prazo: taskToEdit.prazo || getNextWeekDate(),
          tags: Array.isArray(taskToEdit.tags) ? taskToEdit.tags : [],
          status: taskToEdit.status || 'todo'
        });
      } else {
        // Reset for Create Mode
        setFormData({
          titulo: '',
          descricao: '',
          selectedProjectId: projeto ? projeto.id : null,
          responsavelIds: profile ? [profile.id] : [],
          prioridade: 'média',
          dataInicio: getTodayDate(),
          prazo: getNextWeekDate(),
          tags: [],
          status: 'todo'
        });
      }
      setTagInput('');
    }
  }, [isOpen, projeto?.id, taskToEdit?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target as Node)) {
        setShowProjectDropdown(false);
      }
      if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(event.target as Node)) {
        setShowPriorityDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const taskPayload: any = {
      title: formData.titulo,
      status: formData.status,
      priority: formData.prioridade,
      start_date: formData.dataInicio,
      deadline: formData.prazo,
      tags: formData.tags, // Pass array directly
      project_id: formData.selectedProjectId,
      // REMOVED: assignee_ids (Normalized)
      // Only set these on insert, ideally triggering from default in DB, but keeping existing logic
      ...(!taskToEdit && {
        description: formData.descricao,
        attachments_count: 0
      })
    };

    try {
      let taskId;

      if (taskToEdit) {
        taskId = taskToEdit.id;
        const { error } = await supabase
          .from('tasks')
          .update(taskPayload)
          .eq('id', taskId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('tasks')
          .insert([{
            ...taskPayload,
            public_id: nanoid(5) // Generate short ID
          }])
          .select()
          .single();

        if (error) throw error;
        taskId = data.id;
      }

      // Handle Assignees (Delete All & Re-insert)
      await supabase.from('task_assignees').delete().eq('task_id', taskId);

      if (formData.responsavelIds.length > 0) {
        const assigneeInserts = formData.responsavelIds.map(uid => ({
          task_id: taskId,
          profile_id: uid
        }));
        const { error: assignErr } = await supabase.from('task_assignees').insert(assigneeInserts);
        if (assignErr) console.error("Error saving assignees:", assignErr);
      }

      await fetchData();
      onClose();
    } catch (e) {
      console.error("Error saving task:", e);
      alert("Error saving task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!taskToEdit?.id) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskToEdit.id);

      if (error) throw error;

      await fetchData(true);
      onClose();
    } catch (e: any) {
      console.error("Error deleting task:", e);
      alert(`Erro ao deletar tarefa: ${e.message || 'Erro desconhecido'}`);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // --- Handlers para Chips de Tags ---
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim();
      if (val && !formData.tags.includes(val)) {
        setFormData(prev => ({ ...prev, tags: [...prev.tags, val] }));
      }
      setTagInput('');
    } else if (e.key === 'Backspace' && !tagInput && formData.tags.length > 0) {
      setFormData(prev => ({
        ...prev,
        tags: prev.tags.slice(0, -1)
      }));
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tagToRemove)
    }));
  };

  // --- Handlers para Select ---
  const handleSelectUser = (userId: number) => {
    setFormData(prev => {
      const exists = prev.responsavelIds.includes(userId);
      if (exists) {
        return { ...prev, responsavelIds: prev.responsavelIds.filter(id => id !== userId) };
      } else {
        return { ...prev, responsavelIds: [...prev.responsavelIds, userId] };
      }
    });
  };

  const handleSelectProject = (projectId: number) => {
    setFormData(prev => ({
      ...prev,
      selectedProjectId: prev.selectedProjectId === projectId ? null : projectId
    }));
    setShowProjectDropdown(false);
    setProjectSearchQuery('');
  };

  const filteredUsers = users.filter((user: any) =>
    user.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedUsers = users.filter((user: any) =>
    formData.responsavelIds.includes(user.id)
  );

  const selectedProject = projects.find((p: any) =>
    formData.selectedProjectId === p.id
  );

  const statusOptions = [
    { value: 'todo', label: 'A Fazer' },
    { value: 'doing', label: 'Fazendo' },
    { value: 'review', label: 'Revisão' },
    { value: 'done', label: 'Concluída' }
  ];

  // Configuração visual das prioridades para o Dropdown
  const priorityConfig: Record<string, { label: string, color: string, badge: string }> = {
    'baixa': { label: 'Baixa', color: 'text-slate-700', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
    'média': { label: 'Média', color: 'text-orange-700', badge: 'bg-orange-100 text-orange-700 border-orange-200' },
    'alta': { label: 'Alta', color: 'text-red-700', badge: 'bg-red-100 text-red-700 border-red-200' },
    'urgente': { label: 'Urgente', color: 'text-purple-700', badge: 'bg-purple-100 text-purple-700 border-purple-200 animate-pulse' }
  };

  return (
    <>
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Deletar Tarefa"
        message="Tem certeza que deseja deletar esta tarefa? Se ela tiver subtarefas, elas também serão deletadas. Esta ação não pode ser desfeita."
        type="danger"
        confirmLabel="Sim, deletar"
      />

      <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-100">
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-6 py-4 flex items-center justify-between z-20">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {taskToEdit
                ? 'Editar Tarefa'
                : projeto ? `Nova Tarefa: ${projeto.nome}` : 'Nova Tarefa'
              }
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {taskToEdit ? 'Atualize os detalhes da tarefa' : 'Preencha os detalhes para criar uma nova atividade'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* Status Selection */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <label className="block text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              Etapa do Projeto
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, status: opt.value })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${formData.status === opt.value
                    ? 'bg-white border-blue-500 text-blue-700 shadow-sm ring-1 ring-blue-500'
                    : 'bg-transparent border-gray-200 text-gray-600 hover:bg-white hover:border-gray-300'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">
              Título da Tarefa <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none placeholder-gray-400"
              placeholder="Ex: Criar apresentação do workshop"
            />
          </div>

          {/* Projeto Vinculado (Single Selection) */}
          <div className="space-y-1.5 relative" ref={projectDropdownRef}>
            <label className="block text-sm font-semibold text-gray-700">
              Projeto Vinculado <span className="text-red-500">*</span>
            </label>
            <div className="min-h-[46px] w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-500 transition-all flex items-center justify-between">
              {selectedProject ? (
                <div className="flex items-center gap-2 text-sm font-medium text-purple-700">
                  <Briefcase className="w-4 h-4" />
                  <span>{selectedProject.nome}</span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, selectedProjectId: null })}
                    className="ml-2 p-0.5 hover:bg-purple-100 rounded-full text-purple-400 hover:text-purple-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={projectSearchQuery}
                    onChange={(e) => {
                      setProjectSearchQuery(e.target.value);
                      setShowProjectDropdown(true);
                    }}
                    onFocus={() => setShowProjectDropdown(true)}
                    className="w-full bg-transparent border-none outline-none text-sm py-1 placeholder-gray-400"
                    placeholder="Pesquisar projeto..."
                  />
                </div>
              )}
              {!selectedProject && <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>

            {showProjectDropdown && !selectedProject && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto z-30 animate-in fade-in slide-in-from-top-2 duration-200">
                {projects.filter((p: any) => p.nome.toLowerCase().includes(projectSearchQuery.toLowerCase())).length > 0 ? (
                  <div className="py-2">
                    {projects
                      .filter((p: any) => p.nome.toLowerCase().includes(projectSearchQuery.toLowerCase()))
                      .map((p: any) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectProject(p.id)}
                          className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                            <FolderKanban className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{p.nome}</p>
                            <p className="text-xs text-gray-500">{p.capitulo}</p>
                          </div>
                        </button>
                      ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500 text-sm">Nenhum projeto encontrado</div>
                )}
              </div>
            )}
          </div>

          {/* Linha de Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700">
                Data de Início
              </label>
              <input
                type="date"
                required
                value={formData.dataInicio}
                onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-gray-600"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700">
                Data de Entrega <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.prazo}
                onChange={(e) => setFormData({ ...formData, prazo: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-gray-600"
              />
            </div>
          </div>

          <div className="space-y-1.5 relative" ref={dropdownRef}>
            <label className="block text-sm font-semibold text-gray-700">
              Responsáveis <span className="text-red-500">*</span>
            </label>
            <div className="min-h-[46px] w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-xl focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-500 transition-all flex flex-wrap gap-2">
              {selectedUsers.map((user: any) => (
                <span key={user.id} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-blue-100 text-blue-700 rounded-lg text-sm font-medium shadow-sm">
                  <UserAvatar user={user} size="xs" showRing={false} />
                  {user.nome.split(' ')[0]}
                  {hasExternalPermission(user) && <ExternalBadge />}
                  <button
                    type="button"
                    onClick={() => handleSelectUser(user.id)}
                    className="hover:bg-blue-50 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <div className="flex-1 relative min-w-[120px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowUserDropdown(true);
                  }}
                  onFocus={() => setShowUserDropdown(true)}
                  className="w-full h-full bg-transparent border-none outline-none text-sm px-2 py-1 placeholder-gray-400"
                  placeholder={selectedUsers.length === 0 ? "Pesquisar responsável..." : "Adicionar mais..."}
                />
              </div>
            </div>
            {showUserDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto z-30 animate-in fade-in slide-in-from-top-2 duration-200">
                {filteredUsers.length > 0 ? (
                  <div className="py-2">
                    {filteredUsers.map((user: any) => {
                      const isSelected = formData.responsavelIds.includes(user.id);
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => handleSelectUser(user.id)}
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
	                              <p className="text-xs text-gray-500">{user.email}</p>
	                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-blue-600" />}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Seletor de Prioridade Personalizado */}
            <div className="space-y-1.5 relative" ref={priorityDropdownRef}>
              <label className="block text-sm font-semibold text-gray-700">
                Nível de Prioridade
              </label>
              <button
                type="button"
                onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Flag className={`w-4 h-4 ${priorityConfig[formData.prioridade]?.color}`} />
                  <span className={`px-2 py-0.5 rounded text-sm font-medium border ${priorityConfig[formData.prioridade]?.badge}`}>
                    {priorityConfig[formData.prioridade]?.label}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showPriorityDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showPriorityDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 z-30 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                  {Object.keys(priorityConfig).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, prioridade: key });
                        setShowPriorityDropdown(false);
                      }}
                      className={`w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors text-left ${formData.prioridade === key ? 'bg-gray-50' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <Flag className={`w-4 h-4 ${priorityConfig[key].color}`} />
                        <span className={`text-sm font-medium ${priorityConfig[key].color}`}>
                          {priorityConfig[key].label}
                        </span>
                      </div>
                      {formData.prioridade === key && <Check className="w-4 h-4 text-blue-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700">
                Tags <span className="text-xs font-normal text-gray-400">(opcional)</span>
              </label>
              <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-500 transition-all flex flex-wrap gap-2 items-center min-h-[46px]">
                {formData.tags.map((tag, index) => (
                  <span key={index} className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium animate-in fade-in zoom-in duration-200">
                    <Tag className="w-3 h-3" />
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-blue-900 focus:outline-none ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  className="flex-1 bg-transparent outline-none min-w-[120px] text-sm text-gray-700 placeholder-gray-400"
                  placeholder={formData.tags.length === 0 ? "Ex: Design, Frontend (Enter)" : "Adicionar..."}
                />
              </div>
            </div>
          </div>

          {!taskToEdit && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-gray-700">
                  Descrição Detalhada
                </label>
              </div>

              <div className="relative">
                <textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  rows={5}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none resize-none placeholder-gray-400 leading-relaxed"
                  placeholder="Descreva o objetivo e os requisitos da tarefa..."
                />
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between gap-3 border-t border-gray-100 mt-2">
            {taskToEdit ? (
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={isDeleting || isSubmitting}
                className="px-4 py-2.5 text-red-600 font-medium hover:bg-red-50 rounded-xl transition-colors text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Deletar
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-xl transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isDeleting}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  taskToEdit ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />
                )}
                {isSubmitting ? 'Salvando...' : (taskToEdit ? 'Atualizar Tarefa' : 'Criar Tarefa')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
    </>
  );
};
