
import React, { useState, useEffect, useMemo } from 'react';
import {
  Briefcase,
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  FolderKanban,
  Users,
  CheckCircle2,
  AlertCircle,
  Archive,
  ChevronDown,
  Eye,
  ExternalLink,
  Filter,
  RefreshCw,
  Search,
  Calendar,
  Download,
  Upload,
  Clock,
  Edit2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getProjectUrl } from '../../lib/utils';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { NewProjectModal } from '../../components/NewProjectModal';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { useGlobalAlert } from '../../components/GlobalAlert';
import { supabase } from '../../lib/supabase';

// ... (inside component)
export const ProjectManagerPage = () => {
  const navigate = useNavigate();
  const { projects, tasks, chapters, fetchData } = useData();
  const { profile } = useAuth(); // Import useAuth
  const { showAlert } = useGlobalAlert();

  // Chapter Filter State
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [showArchived, setShowArchived] = useState(false);

  // Compute Available Chapters based on Role
  const availableChapters = useMemo(() => {
    if (!profile) return [];

    const userChapters = (profile as any)?.profile_chapters || (profile as any)?.profileChapters || [];
    const userRoles = userChapters.map((pc: any) => pc.permission_slug);

    // Admin sees all chapters
    if (userRoles.includes('admin')) {
      return chapters;
    }

    // Others see only chapters where they are chair or manager
    const allowedChapterIds = userChapters
      .filter((pc: any) => ['chair', 'manager'].includes(pc.permission_slug))
      .map((pc: any) => pc.chapter_id);

    return chapters.filter((c: any) => allowedChapterIds.includes(c.id));
  }, [chapters, profile]);

  // Modal States
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<any>(null);

  // Confirmation Modal States
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning' as 'warning' | 'danger' | 'info',
    showConfirm: true,
    confirmAction: () => { },
    confirmLabel: 'Confirmar'
  });

  // Inicializa o filtro com o primeiro capítulo disponível
  useEffect(() => {
    if (availableChapters.length > 0 && !selectedChapterId) {
      // If current selection is not in available (e.g. permissions changed), reset
      const isCurrentValid = availableChapters.some(c => String(c.id) === selectedChapterId);
      if (!selectedChapterId || !isCurrentValid) {
        setSelectedChapterId(String(availableChapters[0].id));
      }
    }
  }, [availableChapters, selectedChapterId]);

  // Filtra os projetos com base no capítulo selecionado e status de arquivamento
  const filteredProjects = useMemo(() => {
    if (!selectedChapterId) return [];
    const chapId = Number(selectedChapterId);

    return projects.filter((p: any) => {
      // Filtro de Capítulo
      const pChapters = Array.isArray(p.capituloId) ? p.capituloId : [p.capituloId];
      const belongsToChapter = pChapters.includes(chapId);

      // Filtro de Arquivados
      const isArchived = p.status === 'Arquivado';
      const visibilityCheck = showArchived ? true : !isArchived;

      return belongsToChapter && visibilityCheck;
    });
  }, [projects, selectedChapterId, showArchived]);

  // ...

  // In the JSX return, specifically the selector part:

  // Modal definitions
  const handleCreateProject = () => {
    setProjectToEdit(null);
    setIsNewProjectModalOpen(true);
  };

  const handleEditProject = (project: any) => {
    setProjectToEdit(project);
    setIsNewProjectModalOpen(true);
  };

  const handleRestoreProject = (project: any) => {
    setConfirmModal({
      isOpen: true,
      title: 'Restaurar Projeto',
      message: `Tem certeza que deseja restaurar o projeto "${project.nome}"?`,
      type: 'info',
      showConfirm: true,
      confirmLabel: 'Restaurar',
      confirmAction: async () => {
        try {
          const { error } = await supabase
            .from('projects')
            .update({ status: 'Planejamento' })
            .eq('id', project.id);

          if (error) throw error;

          await fetchData(true);
          showAlert('Projeto Restaurado', `O projeto "${project.nome}" foi restaurado.`, 'success');
        } catch (error) {
          console.error('Erro ao restaurar projeto:', error);
          showAlert('Erro ao Restaurar', 'Não foi possível restaurar o projeto. Verifique suas permissões e tente novamente.', 'error');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleDeleteRequest = (project: any) => {
    const projectTasks = tasks.filter((t: any) => t.projetoId === project.id);
    const activeTasks = projectTasks.filter((t: any) => t.status !== 'archived').length;

    setConfirmModal({
      isOpen: true,
      title: 'Arquivar Projeto',
      message: `Tem certeza que deseja arquivar o projeto "${project.nome}"?`,
      type: 'warning',
      showConfirm: true,
      confirmLabel: 'Arquivar',
      confirmAction: async () => {
        if (activeTasks > 0) {
          showAlert('Tarefas Pendentes', 'Arquive todas as tarefas do projeto antes de arquivar o projeto.', 'warning');
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          return;
        }

        try {
          const { error } = await supabase
            .from('projects')
            .update({ status: 'Arquivado' })
            .eq('id', project.id);

          if (error) throw error;

          await fetchData(true);
          showAlert('Projeto Arquivado', `O projeto "${project.nome}" foi arquivado.`, 'success');
        } catch (error) {
          console.error('Erro ao arquivar projeto:', error);
          showAlert('Erro ao Arquivar', 'Não foi possível arquivar o projeto. Verifique suas permissões e tente novamente.', 'error');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
        {/* Seletor de Capítulo */}
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FolderKanban className="h-4 w-4 text-gray-400" />
          </div>
          <select
            value={selectedChapterId}
            onChange={(e) => setSelectedChapterId(e.target.value)}
            className="block w-full pl-10 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-xl border bg-white shadow-sm appearance-none cursor-pointer"
          >
            {availableChapters.map((c: any) => (
              <option key={c.id} value={c.id}>{c.sigla} - {c.nome}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </div>
        </div>

        <button
          onClick={handleCreateProject}
          className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-sm whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Criar Novo Projeto
        </button>
      </div>

      {/* Tabela de Projetos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Toolbar da Tabela */}
        <div className="flex items-center justify-end p-3 border-b border-gray-100 bg-gray-50">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${showArchived
              ? 'bg-gray-200 text-gray-800 border-gray-300'
              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'
              }`}
          >
            <Archive className="w-3.5 h-3.5" />
            {showArchived ? 'Ocultar Arquivados' : 'Mostrar Arquivados'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th scope="col" className="px-6 py-3">Projeto</th>
                <th scope="col" className="px-6 py-3">Responsável</th>
                <th scope="col" className="px-6 py-3">Capítulos</th>
                <th scope="col" className="px-6 py-3">Status das Tarefas</th>
                <th scope="col" className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length > 0 ? (
                filteredProjects.map((project: any) => {
                  // Calcular tarefas
                  const projectTasks = tasks.filter((t: any) => t.projetoId === project.id);
                  const totalTasks = projectTasks.length;
                  const archivedTasks = projectTasks.filter((t: any) => t.status === 'archived').length;
                  const activeTasks = totalTasks - archivedTasks;
                  const isReadyToArchive = activeTasks === 0;
                  const isArchived = project.status === 'Arquivado';

                  return (
                    <tr key={project.id} className={`border-b transition-colors ${isArchived ? 'bg-gray-50 opacity-75 grayscale-[0.5]' : 'bg-white hover:bg-gray-50'}`}>
                      <td className="px-6 py-4">
                        <div
                          className="flex flex-col cursor-pointer group"
                          onClick={() => navigate(getProjectUrl(project))}
                          title="Clique para abrir detalhes do projeto"
                        >
                          <span className="font-semibold text-gray-900 text-base group-hover:text-blue-600 transition-colors flex items-center gap-2">
                            {project.nome}
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400" />
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full w-fit mt-1 font-medium ${project.status === 'Concluído' ? 'bg-green-100 text-green-700' :
                            project.status === 'Planejamento' ? 'bg-gray-100 text-gray-700' :
                              project.status === 'Arquivado' ? 'bg-gray-200 text-gray-600' :
                                'bg-blue-100 text-blue-700'
                            }`}>
                            {project.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                            {project.responsavel?.charAt(0)}
                          </div>
                          <span className="text-gray-700">{project.responsavel}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex -space-x-1">
                          {project.capitulos && project.capitulos.map((c: any) => (
                            <div key={c.id} className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-600" title={c.nome}>
                              {c.sigla}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {totalTasks === 0 ? (
                          <span className="text-gray-400 italic text-xs">Sem tarefas</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-xs">
                              {isReadyToArchive ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-orange-500" />
                              )}
                              <span className={isReadyToArchive ? 'text-green-700 font-medium' : 'text-gray-700'}>
                                {isReadyToArchive ? 'Pronto para Arquivar' : `${activeTasks} ativas`}
                              </span>
                            </div>
                            <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${isReadyToArchive ? 'bg-green-500' : 'bg-orange-400'}`}
                                style={{ width: `${(archivedTasks / totalTasks) * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-[10px] text-gray-400">{archivedTasks}/{totalTasks} arquivadas</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(getProjectUrl(project))}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Ver Detalhes do Projeto"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleEditProject(project)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar Informações"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {isArchived ? (
                            <button
                              onClick={() => handleRestoreProject(project)}
                              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Restaurar Projeto"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDeleteRequest(project)}
                              className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${isReadyToArchive
                                ? 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                                : 'text-gray-200 cursor-not-allowed'
                                }`}
                              disabled={!isReadyToArchive}
                              title={isReadyToArchive ? "Arquivar Projeto" : "Tarefas pendentes impedem o arquivamento"}
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    {projects.length === 0 ? "Nenhum projeto encontrado no sistema." : "Nenhum projeto encontrado para este capítulo (verifique se estão arquivados)."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        projectToEdit={projectToEdit}
        initialChapterId={selectedChapterId ? Number(selectedChapterId) : undefined}
      />

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmLabel={confirmModal.confirmLabel}
        onConfirm={confirmModal.confirmAction}
      />
    </div>
  );
};
