
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, FolderKanban, Briefcase, Loader2, Save, Users, Check, Palette, Image, ChevronDown, User, Plus, Search, Trash2, Download, FileJson, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useData } from '../context/DataContext';
import { UserAvatar, getLocalDateISOString, generatePublicId } from '../lib/utils';
import { pdf } from '@react-pdf/renderer';
import { ProjectReportPDF } from './ProjectReportPDF';
import { useGlobalAlert } from './GlobalAlert';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectToEdit?: any; // Propcional para edição
  initialChapterId?: number;
  tasks?: any[]; // Tarefas para o relatório
}

// Lista de cores do Tailwind para o seletor
const TW_COLORS = [
  'slate', 'gray', 'zinc', 'neutral', 'stone',
  'red', 'orange', 'amber', 'yellow', 'lime',
  'green', 'emerald', 'teal', 'cyan', 'sky',
  'blue', 'indigo', 'violet', 'purple', 'fuchsia',
  'pink', 'rose'
];

export const NewProjectModal = ({ isOpen, onClose, projectToEdit, initialChapterId, tasks = [] }: NewProjectModalProps) => {
  const { chapters, users, tasks: allTasks, fetchData } = useData();
  const { showAlert } = useGlobalAlert();

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    status: 'Planejamento',
    progresso: 0,
    dataInicio: getLocalDateISOString(),
    dataFim: '',
    isPartnership: false,
    tags: '',
    notes: '',
    chapterIds: [] as number[],
    color: 'from-blue-600 to-indigo-600',
    coverImage: ''
  });

  // Team Management State
  const [ownerIds, setOwnerIds] = useState<number[]>([]);
  const [teamIds, setTeamIds] = useState<number[]>([]);

  // UI States for Team Search
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
  const [showOwnerSuggestions, setShowOwnerSuggestions] = useState(false);
  const ownerSearchRef = useRef<HTMLDivElement>(null);

  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [showTeamSuggestions, setShowTeamSuggestions] = useState(false);
  const teamSearchRef = useRef<HTMLDivElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [includeArchivedTasks, setIncludeArchivedTasks] = useState(true);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const [chapterSearchQuery, setChapterSearchQuery] = useState('');
  const [showChapterDropdown, setShowChapterDropdown] = useState(false);
  const chapterDropdownRef = useRef<HTMLDivElement>(null);

  // Gradient Picker State
  const [showGradientPicker, setShowGradientPicker] = useState(false);
  const [gradientState, setGradientState] = useState({
    from: 'blue',
    to: 'indigo'
  });
  const pickerRef = useRef<HTMLDivElement>(null);

  // Team Change Confirmation State
  const [showConfirmTeamChange, setShowConfirmTeamChange] = useState(false);
  const initialOwnersRef = useRef<number[]>([]);
  const initialTeamRef = useRef<number[]>([]);

  const projectReportTasks = useMemo(() => {
    if (!projectToEdit) return tasks;

    const sourceTasks = allTasks.length > 0 ? allTasks : tasks;
    return sourceTasks
      .filter((task: any) => String(task.projetoId ?? task.project_id) === String(projectToEdit.id))
      .sort((a: any, b: any) => {
        const aParent = Number(a.parentTaskId ?? a.parent_task_id ?? 0) || 0;
        const bParent = Number(b.parentTaskId ?? b.parent_task_id ?? 0) || 0;
        if (aParent !== bParent) return aParent - bParent;
        return (Number(a.id) || 0) - (Number(b.id) || 0);
      });
  }, [allTasks, tasks, projectToEdit?.id]);

  const archivedReportTasksCount = projectReportTasks.filter((task: any) => task.status === 'archived').length;
  const exportTasks = includeArchivedTasks
    ? projectReportTasks
    : projectReportTasks.filter((task: any) => task.status !== 'archived');

  // Initialize form
  useEffect(() => {
    if (isOpen) {
      if (projectToEdit) {
        // Edit Mode: Populate data
        setFormData({
          nome: projectToEdit.nome,
          descricao: projectToEdit.descricao || '',
          status: projectToEdit.status || 'Planejamento',
          progresso: projectToEdit.progresso || 0,
          dataInicio: projectToEdit.dataInicio || new Date().toISOString().split('T')[0],
          dataFim: projectToEdit.dataFim || '',
          isPartnership: projectToEdit.parceria || false,
          tags: Array.isArray(projectToEdit.tags) ? projectToEdit.tags.join(', ') : '',
          notes: projectToEdit.notes || '',
          chapterIds: projectToEdit.capituloId || [],
          color: projectToEdit.cor || 'from-blue-600 to-indigo-600',
          coverImage: projectToEdit.coverImage || ''
        });

        // Populate Team Arrays
        setOwnerIds(projectToEdit.ownerIds || []);
        setTeamIds(projectToEdit.teamIds || []);

        // Track Initial Team State for confirmation
        initialOwnersRef.current = projectToEdit.ownerIds || [];
        initialTeamRef.current = projectToEdit.teamIds || [];

        // Extract Colors
        if (projectToEdit.cor) {
          const parts = projectToEdit.cor.split(' ');
          const fromPart = parts.find((p: string) => p.startsWith('from-'));
          const toPart = parts.find((p: string) => p.startsWith('to-'));
          if (fromPart && toPart) {
            const fromColor = fromPart.replace('from-', '').split('-')[0];
            const toColor = toPart.replace('to-', '').split('-')[0];
            setGradientState({ from: fromColor, to: toColor });
          }
        }

      } else {
        // Create Mode: Reset
        setFormData({
          nome: '',
          descricao: '',
          status: 'Planejamento',
          progresso: 0,
          dataInicio: new Date().toISOString().split('T')[0],
          dataFim: '',
          isPartnership: false,
          tags: '',
          notes: '',
          chapterIds: initialChapterId ? [initialChapterId] : [],
          color: 'from-blue-600 to-indigo-600',
          coverImage: ''
        });
        setOwnerIds([]);
        setTeamIds([]);
        setGradientState({ from: 'blue', to: 'indigo' });
      }
      setChapterSearchQuery('');
      setOwnerSearchQuery('');
      setTeamSearchQuery('');
    }
  }, [isOpen, projectToEdit?.id, initialChapterId]);

  // Click Outside Handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chapterDropdownRef.current && !chapterDropdownRef.current.contains(event.target as Node)) {
        setShowChapterDropdown(false);
      }
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowGradientPicker(false);
      }
      if (ownerSearchRef.current && !ownerSearchRef.current.contains(event.target as Node)) {
        setShowOwnerSuggestions(false);
      }
      if (teamSearchRef.current && !teamSearchRef.current.contains(event.target as Node)) {
        setShowTeamSuggestions(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const applyGradient = () => {
    const config = `from-${gradientState.from}-600 to-${gradientState.to}-600`;
    setFormData(prev => ({ ...prev, color: config }));
    setShowGradientPicker(false);
  };

  const handleExportJSON = async () => {
    if (!projectToEdit) return;
    setIsExporting(true);
    try {
      const dataToExport = {
        project: projectToEdit,
        tasks: exportTasks,
        metadata: {
          exportedAt: new Date().toISOString(),
          version: '1.0'
        }
      };

      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = projectToEdit.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50);
      a.download = `relatorio-${safeName}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 150);
    } catch (error) {
      console.error("Erro no export JSON", error);
      showAlert("Erro na Exportação", "Falha ao gerar o arquivo JSON.", "error");
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  const handleExportPDF = async () => {
    if (!projectToEdit) return;
    setIsExporting(true);
    try {
      const blob = await pdf(<ProjectReportPDF project={projectToEdit} tasks={exportTasks} users={users} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = projectToEdit.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50);
      a.download = `relatorio-${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 150);
    } catch (error) {
      console.error("Erro no export PDF", error);
      showAlert("Erro na Exportação", "Falha ao gerar o arquivo PDF.", "error");
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.chapterIds.length === 0) {
      alert("Selecione pelo menos um capítulo.");
      return;
    }

    // Check for team changes in Edit mode
    if (projectToEdit && !showConfirmTeamChange) {
      const ownersChanged = JSON.stringify([...ownerIds].sort()) !== JSON.stringify([...initialOwnersRef.current].sort());
      const teamChanged = JSON.stringify([...teamIds].sort()) !== JSON.stringify([...initialTeamRef.current].sort());

      if (ownersChanged || teamChanged) {
        setShowConfirmTeamChange(true);
        return;
      }
    }

    await handleSave();
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    setShowConfirmTeamChange(false);

    // 1. Prepare Project Payload (Clean, no array columns)
    const projectPayload: any = {
      name: formData.nome,
      description: formData.descricao,
      status: formData.status,
      progress: Number(formData.progresso),
      start_date: formData.dataInicio,
      end_date: formData.dataFim || null,
      is_partnership: formData.isPartnership,
      // REMOVED: owner_ids, team_ids, chapter_ids (Now relational)
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      notes: formData.notes,
      color_theme: formData.color,
      cover_image: formData.coverImage
    };

    try {
      let projectId;

      if (projectToEdit) {
        projectId = projectToEdit.id;
        const { error } = await supabase
          .from('projects')
          .update(projectPayload)
          .eq('id', projectId);

        if (error) throw error;
      } else {
        projectPayload.checkpoints = [];
        projectPayload.content_url = '[]';
        projectPayload.public_id = generatePublicId(); // Generate NanoID
        const { data, error } = await supabase
          .from('projects')
          .insert([projectPayload])
          .select()
          .single();

        if (error) throw error;
        projectId = data.id;
      }

      // 2. Handle Relations (Upsert then Cleanup Strategy to preserve RLS permissions)

      // A. Chapter Relations
      if (formData.chapterIds.length > 0) {
        const chapterInserts = formData.chapterIds.map(cid => ({
          project_id: projectId,
          chapter_id: cid
        }));

        // Upsert new list
        const { error: upsertChapErr } = await supabase.from('project_chapters').upsert(chapterInserts, { onConflict: 'project_id, chapter_id' });
        if (upsertChapErr) throw upsertChapErr;

        // Delete removed ones
        const { error: delChapErr } = await supabase
          .from('project_chapters')
          .delete()
          .eq('project_id', projectId)
          .not('chapter_id', 'in', `(${formData.chapterIds.join(',')})`);
        if (delChapErr) console.error("Error cleaning up chapters:", delChapErr);
      } else {
        // If empty (shoudn't happen due to validation), just clear
        await supabase.from('project_chapters').delete().eq('project_id', projectId);
      }

      // B. Members Relations (Owners & Team)
      const memberInserts = [];
      // Owners
      for (const oid of ownerIds) {
        memberInserts.push({
          project_id: projectId,
          profile_id: oid,
          is_owner: true
        });
      }
      // Team (avoid duplicates)
      for (const tid of teamIds) {
        if (!ownerIds.includes(tid)) {
          memberInserts.push({
            project_id: projectId,
            profile_id: tid,
            is_owner: false
          });
        }
      }

      if (memberInserts.length > 0) {
        // Upsert new list
        const { error: upsertMemErr } = await supabase.from('project_members').upsert(memberInserts, { onConflict: 'project_id, profile_id' });
        if (upsertMemErr) throw upsertMemErr;

        // Delete removed ones
        const newUserIds = memberInserts.map(m => m.profile_id);
        const { error: delMemErr } = await supabase
          .from('project_members')
          .delete()
          .eq('project_id', projectId)
          .not('profile_id', 'in', `(${newUserIds.join(',')})`);
        if (delMemErr) console.error("Error cleaning up members:", delMemErr);
      } else {
        // Just clear
        await supabase.from('project_members').delete().eq('project_id', projectId);
      }

      await fetchData(true);
      onClose();
    } catch (e) {
      console.error("Erro ao salvar projeto:", e);
      alert("Erro ao salvar projeto. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Handlers ---

  // Chapter Handlers
  const handleSelectChapter = (id: number) => {
    setFormData(prev => {
      if (prev.chapterIds.includes(id)) {
        return { ...prev, chapterIds: prev.chapterIds.filter(c => c !== id) };
      }
      return { ...prev, chapterIds: [...prev.chapterIds, id] };
    });
    setChapterSearchQuery('');
  };

  const handleRemoveChapter = (id: number) => {
    setFormData(prev => ({ ...prev, chapterIds: prev.chapterIds.filter(c => c !== id) }));
  };

  // Team Handlers (Owners)
  const handleAddOwner = (user: any) => {
    if (!ownerIds.includes(user.id)) {
      setOwnerIds(prev => [...prev, user.id]);
    }
    // Optional: Auto-add to general team if not there
    if (!teamIds.includes(user.id)) {
      setTeamIds(prev => [...prev, user.id]);
    }
    setOwnerSearchQuery('');
    setShowOwnerSuggestions(false);
  };

  const handleRemoveOwner = (id: number) => {
    setOwnerIds(prev => prev.filter(uid => uid !== id));
  };

  // Team Handlers (General)
  const handleAddMember = (user: any) => {
    if (!teamIds.includes(user.id)) {
      setTeamIds(prev => [...prev, user.id]);
    }
    setTeamSearchQuery('');
    setShowTeamSuggestions(false);
  };

  const handleRemoveMember = (id: number) => {
    setTeamIds(prev => prev.filter(uid => uid !== id));
    // Also remove from owners if removing from team? Maybe explicit is better.
    // Let's keep them somewhat independent in removal to allow "Owner but not in main list" scenarios (though rare)
  };

  // --- Filters ---
  const filteredChapters = chapters.filter((c: any) =>
    c.nome.toLowerCase().includes(chapterSearchQuery.toLowerCase()) ||
    c.sigla.toLowerCase().includes(chapterSearchQuery.toLowerCase())
  );
  const selectedChapters = chapters.filter((c: any) => formData.chapterIds.includes(c.id));

  // Users Filter for Owners
  const filteredOwners = users.filter((u: any) =>
    !ownerIds.includes(u.id) &&
    (u.nome.toLowerCase().includes(ownerSearchQuery.toLowerCase()) || u.email.toLowerCase().includes(ownerSearchQuery.toLowerCase()))
  );

  // Users Filter for Team
  const filteredTeam = users.filter((u: any) =>
    !teamIds.includes(u.id) &&
    (u.nome.toLowerCase().includes(teamSearchQuery.toLowerCase()) || u.email.toLowerCase().includes(teamSearchQuery.toLowerCase()))
  );

  // Hydrate selected users for display
  const selectedOwners = users.filter((u: any) => ownerIds.includes(u.id));
  const selectedTeam = users.filter((u: any) => teamIds.includes(u.id));

  const statusOptions = ['Planejamento', 'Em Andamento', 'Pausado', 'Concluído'];

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-100 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-6 py-4 flex items-center justify-between z-20 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-blue-600" />
              {projectToEdit ? 'Editar Projeto' : 'Novo Projeto'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {projectToEdit ? 'Atualize as informações principais do projeto' : 'Inicie uma nova iniciativa para o capítulo'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {projectToEdit && (
              <div className="relative" ref={exportMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium transition-all shadow-sm"
                >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Relatório
                  <ChevronDown className={`w-3 h-3 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                </button>

                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-100 shadow-xl rounded-xl overflow-hidden z-50">
                    <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
                      <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeArchivedTasks}
                          onChange={(event) => setIncludeArchivedTasks(event.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>
                          <span className="block font-medium">Incluir tarefas arquivadas</span>
                          <span className="block text-xs text-gray-500">
                            {exportTasks.length}/{projectReportTasks.length} tarefas no relatório
                            {archivedReportTasksCount > 0 ? `, ${archivedReportTasksCount} arquivadas` : ''}
                          </span>
                        </span>
                      </label>
                    </div>
                    <div className="p-1">
                      <button
                        type="button"
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg transition-colors text-left"
                      >
                        <FileText className="w-4 h-4" />
                        Baixar PDF
                      </button>
                      <button
                        type="button"
                        onClick={handleExportJSON}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-purple-600 rounded-lg transition-colors text-left"
                      >
                        <FileJson className="w-4 h-4" />
                        Baixar JSON
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">

          {/* Nome e Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700">
                Nome do Projeto <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                placeholder="Ex: Workshop de Robótica"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
              >
                {statusOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">
              Descrição
            </label>
            <textarea
              required
              rows={3}
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none resize-none"
              placeholder="Descreva o objetivo do projeto..."
            />
          </div>

          {/* TEAM MANAGEMENT SECTION */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-xl border border-gray-200">

            {/* 1. Project Owners / Managers */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-purple-700 flex items-center gap-1.5">
                <Users className="w-4 h-4" /> Líderes (Gerentes)
              </label>

              <div className="relative" ref={ownerSearchRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-purple-400" />
                  <input
                    type="text"
                    className="w-full pl-8 pr-3 py-2 text-xs border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-100 bg-white"
                    placeholder="Adicionar gerente..."
                    value={ownerSearchQuery}
                    onChange={(e) => { setOwnerSearchQuery(e.target.value); setShowOwnerSuggestions(true); }}
                    onFocus={() => setShowOwnerSuggestions(true)}
                  />
                </div>
                {showOwnerSuggestions && ownerSearchQuery && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                    {filteredOwners.length > 0 ? (
                      filteredOwners.map((u: any) => (
                        <div key={u.id} onClick={() => handleAddOwner(u)} className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-xs flex items-center gap-2">
                          <UserAvatar user={u} size="xs" showRing={false} />
                          <span>{u.nome}</span>
                        </div>
                      ))
                    ) : <div className="p-2 text-xs text-gray-400">Nenhum usuário encontrado.</div>}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 min-h-[30px] content-start">
                {selectedOwners.map(u => (
                  <span key={u.id} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-[10px] font-bold border border-purple-200 shadow-sm">
                    {u.nome.split(' ')[0]}
                    <button type="button" onClick={() => handleRemoveOwner(u.id)} className="hover:text-purple-900 ml-0.5"><X className="w-3 h-3" /></button>
                  </span>
                ))}
                {selectedOwners.length === 0 && <span className="text-[10px] text-gray-400 italic">Sem gerentes definidos.</span>}
              </div>
            </div>

            {/* 2. Project Team Members */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-blue-700 flex items-center gap-1.5">
                <Users className="w-4 h-4" /> Equipe do Projeto
              </label>

              <div className="relative" ref={teamSearchRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-400" />
                  <input
                    type="text"
                    className="w-full pl-8 pr-3 py-2 text-xs border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white"
                    placeholder="Adicionar membro..."
                    value={teamSearchQuery}
                    onChange={(e) => { setTeamSearchQuery(e.target.value); setShowTeamSuggestions(true); }}
                    onFocus={() => setShowTeamSuggestions(true)}
                  />
                </div>
                {showTeamSuggestions && teamSearchQuery && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                    {filteredTeam.length > 0 ? (
                      filteredTeam.map((u: any) => (
                        <div key={u.id} onClick={() => handleAddMember(u)} className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-xs flex items-center gap-2">
                          <UserAvatar user={u} size="xs" showRing={false} />
                          <span>{u.nome}</span>
                        </div>
                      ))
                    ) : <div className="p-2 text-xs text-gray-400">Nenhum usuário encontrado.</div>}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 min-h-[30px] content-start">
                {selectedTeam.map(u => (
                  <span key={u.id} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-[10px] font-medium border border-blue-100">
                    {u.nome.split(' ')[0]}
                    <button type="button" onClick={() => handleRemoveMember(u.id)} className="hover:text-blue-900 ml-0.5"><X className="w-3 h-3" /></button>
                  </span>
                ))}
                {selectedTeam.length === 0 && <span className="text-[10px] text-gray-400 italic">Sem equipe definida.</span>}
              </div>
            </div>
          </div>

          {/* Capítulos Participantes (PESQUISA COM DROPDOWN) */}
          <div className="space-y-1.5 relative" ref={chapterDropdownRef}>
            <label className="block text-sm font-semibold text-gray-700">
              Capítulos Envolvidos <span className="text-red-500">*</span>
            </label>

            <div className="min-h-[46px] w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-xl focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-500 transition-all flex flex-wrap gap-2">
              {selectedChapters.map((cap: any) => {
                const Icon = cap.icon || FolderKanban;
                return (
                  <span key={cap.id} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-blue-100 text-blue-700 rounded-lg text-sm font-medium shadow-sm">
                    <Icon className="w-3.5 h-3.5" />
                    <span>{cap.sigla}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveChapter(cap.id)}
                      className="hover:bg-blue-50 rounded-full p-0.5 transition-colors ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}

              <div className="flex-1 relative min-w-[120px]">
                <input
                  type="text"
                  value={chapterSearchQuery}
                  onChange={(e) => {
                    setChapterSearchQuery(e.target.value);
                    setShowChapterDropdown(true);
                  }}
                  onFocus={() => setShowChapterDropdown(true)}
                  className="w-full h-full bg-transparent border-none outline-none text-sm px-2 py-1 placeholder-gray-400"
                  placeholder={selectedChapters.length === 0 ? "Buscar capítulo..." : "Adicionar outro..."}
                />
              </div>
            </div>

            {showChapterDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto z-30 animate-in fade-in slide-in-from-top-2 duration-200">
                {filteredChapters.length > 0 ? (
                  <div className="py-2">
                    {filteredChapters.map((cap: any) => {
                      const isSelected = formData.chapterIds.includes(cap.id);
                      const Icon = cap.icon || FolderKanban;
                      return (
                        <button
                          key={cap.id}
                          type="button"
                          onClick={() => handleSelectChapter(cap.id)}
                          className={`w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors text-left ${isSelected ? 'bg-blue-50/50' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                              }`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                                {cap.sigla}
                              </p>
                              <p className="text-xs text-gray-500 truncate max-w-[200px]">{cap.nome}</p>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    Nenhum capítulo encontrado
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700">Tags (separadas por vírgula)</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">#</div>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full pl-8 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Ex: Educação, Social, Técnico"
                />
              </div>
            </div>

            {/* Toggle Parceria */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 h-full">
              <div
                onClick={() => setFormData({ ...formData, isPartnership: !formData.isPartnership })}
                className={`w-10 h-5 rounded-full p-0.5 cursor-pointer transition-colors duration-300 flex-shrink-0 ${formData.isPartnership ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${formData.isPartnership ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
              <label className="text-xs font-medium text-gray-700 cursor-pointer" onClick={() => setFormData({ ...formData, isPartnership: !formData.isPartnership })}>
                Parceria Externa?
              </label>
            </div>
          </div>

          {/* Seção de Personalização Visual */}
          <div className="pt-4 border-t border-gray-100 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Palette className="w-4 h-4 text-blue-600" />
              Personalização Visual
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Imagem de Capa */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5" /> URL da Imagem de Capa
                </label>
                <input
                  type="text"
                  value={formData.coverImage}
                  onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-sm"
                  placeholder="https://..."
                />
                {formData.coverImage && (
                  <div className="h-16 w-full mt-2 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                    <img src={formData.coverImage} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {/* Seletor de Gradiente */}
              <div className="space-y-1.5 relative" ref={pickerRef}>
                <label className="block text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" /> Tema do Projeto
                </label>

                <button
                  type="button"
                  onClick={() => setShowGradientPicker(!showGradientPicker)}
                  className={`w-full h-[42px] px-4 rounded-xl border border-gray-200 flex items-center justify-between transition-all hover:bg-gray-50`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${formData.color}`}></div>
                    <span className="text-sm text-gray-600">Gradiente Selecionado</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {showGradientPicker && (
                  <div className="absolute right-0 bottom-full mb-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-200 z-50 p-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                      <span className="text-sm font-bold text-gray-800">Gerador de Tema</span>
                      <button type="button" onClick={() => setShowGradientPicker(false)}><X className="w-4 h-4 text-gray-400" /></button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Cor Inicial (From)</label>
                        <div className="grid grid-cols-6 gap-1.5">
                          {TW_COLORS.map(color => (
                            <button
                              key={`from-${color}`}
                              type="button"
                              onClick={() => setGradientState(prev => ({ ...prev, from: color }))}
                              className={`w-6 h-6 rounded-full shadow-sm hover:scale-110 transition-transform bg-${color}-600 ${gradientState.from === color ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Cor Final (To)</label>
                        <div className="grid grid-cols-6 gap-1.5">
                          {TW_COLORS.map(color => (
                            <button
                              key={`to-${color}`}
                              type="button"
                              onClick={() => setGradientState(prev => ({ ...prev, to: color }))}
                              className={`w-6 h-6 rounded-full shadow-sm hover:scale-110 transition-transform bg-${color}-600 ${gradientState.to === color ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="pt-2">
                        <div className={`h-8 w-full rounded-lg mb-2 bg-gradient-to-r from-${gradientState.from}-600 to-${gradientState.to}-600 shadow-inner`}></div>
                        <button
                          type="button"
                          onClick={applyGradient}
                          className="w-full py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Aplicar Gradiente
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Datas e Progresso */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700">Data Início</label>
              <input
                type="date"
                required
                value={formData.dataInicio}
                onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700">Data Fim (Prevista)</label>
              <input
                type="date"
                value={formData.dataFim}
                onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700">Progresso Inicial (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.progresso}
                onChange={(e) => setFormData({ ...formData, progresso: Number(e.target.value) })}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-xl transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all flex items-center gap-2 text-sm disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {projectToEdit ? 'Salvar Alterações' : 'Criar Projeto'}
            </button>
          </div>
        </form>
      </div>

      {/* Team Change Confirmation Overlay */}
      {showConfirmTeamChange && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center border border-gray-100 transform animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-10 h-10 text-amber-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Confirmar Alteração</h3>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Você está modificando os <strong>membros da equipe ou gerência</strong> deste projeto. Deseja aplicar estas mudanças?
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSubmitting}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Confirmar e Salvar
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmTeamChange(false)}
                className="w-full py-3.5 bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold rounded-2xl transition-all"
              >
                Voltar e Revisar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
