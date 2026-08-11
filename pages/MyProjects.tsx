import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  FolderKanban,
  Loader2,
  LogOut,
  User
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatDateDisplay, getProjectUrl, getTaskUrl } from '../lib/utils';

const statusLabels: Record<string, string> = {
  todo: 'A fazer',
  doing: 'Fazendo',
  review: 'Em revisão',
  done: 'Concluído',
  archived: 'Arquivado'
};

const statusStyles: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-700 border-slate-200',
  doing: 'bg-amber-100 text-amber-800 border-amber-200',
  review: 'bg-violet-100 text-violet-700 border-violet-200',
  done: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  archived: 'bg-gray-100 text-gray-500 border-gray-200'
};

const priorityStyles: Record<string, string> = {
  urgente: 'text-red-700 bg-red-50 border-red-100',
  alta: 'text-orange-700 bg-orange-50 border-orange-100',
  media: 'text-blue-700 bg-blue-50 border-blue-100',
  baixa: 'text-emerald-700 bg-emerald-50 border-emerald-100'
};

const formatShortDate = (date?: string | null) => {
  if (!date) return 'Sem data';
  return formatDateDisplay(date);
};

const getExternalProjectUrl = (project: any) => {
  return getProjectUrl(project).replace('/projects/', '/my-projects/projects/');
};

const getExternalTaskUrl = (task: any) => {
  return getTaskUrl(task).replace('/tasks/', '/my-projects/tasks/');
};

export const MyProjects = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { projects, tasks, loading } = useData();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Usuario';
  const displayRole = profile?.role || 'Participante externo';
  const displayAvatar = profile?.avatar_initials || displayName[0]?.toUpperCase() || 'U';

  const managedProjectIds = useMemo(() => {
    if (!profile) return new Set<number>();

    return new Set(
      projects
        .filter((project: any) =>
          project.projectMembers?.some((member: any) => member.profile_id === profile.id && member.is_owner)
        )
        .map((project: any) => project.id)
    );
  }, [projects, profile]);

  const assignedProjectIds = useMemo(() => {
    if (!profile) return new Set<number>();

    return new Set(
      tasks
        .filter((task: any) => task.responsavelIds?.includes(profile.id) && task.status !== 'archived')
        .map((task: any) => task.projetoId)
    );
  }, [tasks, profile]);

  const myProjects = useMemo(() => {
    if (!profile) return [];

    return projects
      .filter((project: any) => {
        const isProjectMember = project.projectMembers?.some((member: any) => member.profile_id === profile.id);
        const hasAssignedTask = assignedProjectIds.has(project.id);

        return isProjectMember || hasAssignedTask;
      })
      .filter((project: any) => project.status !== 'Arquivado');
  }, [projects, profile, assignedProjectIds]);

  const myTasks = useMemo(() => {
    if (!profile) return [];

    return tasks
      .filter((task: any) =>
        task.status !== 'archived' &&
        (
          task.responsavelIds?.includes(profile.id) ||
          managedProjectIds.has(task.projetoId)
        )
      )
      .sort((a: any, b: any) => {
        if (!a.prazo && !b.prazo) return 0;
        if (!a.prazo) return 1;
        if (!b.prazo) return -1;
        return new Date(a.prazo).getTime() - new Date(b.prazo).getTime();
      });
  }, [tasks, profile, managedProjectIds]);

  const completedTasks = myTasks.filter((task: any) => task.status === 'done').length;
  const openTasks = myTasks.length - completedTasks;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-blue-700">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/LogoRamoIEEE.png"
              alt="Logo Ramo Estudantil IEEE UnB"
              className="h-11 sm:h-12 w-auto object-contain shrink-0"
            />
            <div className="hidden sm:block min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">Ramo Estudantil IEEE UnB</p>
              <p className="text-xs text-slate-500 truncate">Área externa de acompanhamento</p>
            </div>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowProfileMenu((value) => !value)}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1.5 shadow-sm hover:bg-slate-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold overflow-hidden">
                {profile?.photo_url ? (
                  <img src={profile.photo_url} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  displayAvatar
                )}
              </div>
              <div className="hidden md:block text-left pr-1">
                <p className="text-sm font-bold leading-tight max-w-40 truncate">{displayName}</p>
                <p className="text-xs text-slate-500 leading-tight max-w-40 truncate">{displayRole}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-xl py-1 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 md:hidden">
                  <p className="text-sm font-bold text-slate-900">{displayName}</p>
                  <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    navigate('/my-profile');
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <User className="w-4 h-4" />
                  Editar perfil
                </button>
                <button
                  type="button"
                  onClick={signOut}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sair da conta
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <section className="relative overflow-hidden rounded-2xl bg-blue-950 text-white border border-blue-900 shadow-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_20%,rgba(250,204,21,0.22),transparent_28%),linear-gradient(135deg,rgba(37,99,235,0.88),rgba(15,23,42,0.96))]" />
          <div className="relative p-6 sm:p-8 lg:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg">
                  <span className="text-blue-900 font-extrabold text-lg tracking-tight">IEEE</span>
                </div>
                <div className="h-8 w-px bg-blue-300/50" />
                <span className="text-blue-100 text-xs sm:text-sm font-semibold uppercase tracking-wide">ConectaIEEE</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black leading-tight">
                Meus projetos e entregas
              </h1>
              <p className="text-blue-100 mt-3 text-base sm:text-lg max-w-xl">
                Acompanhe os projetos e tarefas em que você participa junto ao Ramo Estudantil IEEE UnB.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 md:min-w-[320px]">
              <div className="rounded-xl bg-white/10 border border-white/15 p-4">
                <p className="text-2xl font-black">{myProjects.length}</p>
                <p className="text-xs text-blue-100 mt-1">Projetos</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/15 p-4">
                <p className="text-2xl font-black">{openTasks}</p>
                <p className="text-xs text-blue-100 mt-1">Pendentes</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/15 p-4">
                <p className="text-2xl font-black">{completedTasks}</p>
                <p className="text-xs text-blue-100 mt-1">Concluídas</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-blue-700" />
              Projetos
            </h2>
          </div>

          {myProjects.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
              Nenhum projeto vinculado ao seu perfil.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {myProjects.map((project: any) => {
                const projectTasks = myTasks.filter((task: any) => task.projetoId === project.id);
                const done = projectTasks.filter((task: any) => task.status === 'done').length;

                return (
                  <article key={project.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className={`h-2 bg-gradient-to-r ${project.cor || 'from-blue-600 to-cyan-500'}`} />
                    <div className="p-5 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-black text-lg text-slate-900 truncate">{project.nome}</h3>
                          <p className="text-sm text-slate-500 line-clamp-2 mt-1">{project.descricao || 'Sem descrição.'}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs font-bold">
                          {project.status || 'Ativo'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase">Progresso</p>
                          <p className="font-black text-slate-900">{project.progresso || 0}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase">Tarefas</p>
                          <p className="font-black text-slate-900">{done}/{projectTasks.length}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase">Prazo</p>
                          <p className="font-black text-slate-900">{formatShortDate(project.dataFim)}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => navigate(getExternalProjectUrl(project))}
                        className="w-full h-10 rounded-lg bg-blue-700 text-white text-sm font-bold hover:bg-blue-800 transition-colors flex items-center justify-center gap-2"
                      >
                        Ver detalhes do projeto
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3 pb-10">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-700" />
            Minhas tarefas
          </h2>

          {myTasks.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
              Nenhuma tarefa atribuída a você.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
              {myTasks.map((task: any) => {
                const statusClass = statusStyles[task.status] || statusStyles.todo;
                const priorityClass = priorityStyles[String(task.prioridade || '').toLowerCase()] || 'text-slate-600 bg-slate-50 border-slate-100';

                return (
                  <div key={task.id} className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`px-2.5 py-1 rounded-full border text-xs font-bold ${statusClass}`}>
                          {statusLabels[task.status] || task.status}
                        </span>
                        {task.prioridade && (
                          <span className={`px-2.5 py-1 rounded-full border text-xs font-bold ${priorityClass}`}>
                            {task.prioridade}
                          </span>
                        )}
                      </div>
                      <h3 className="font-black text-slate-900 truncate">{task.titulo}</h3>
                      <p className="text-sm text-slate-500 truncate mt-1">{task.projeto}</p>
                      {task.descricao && (
                        <p className="text-sm text-slate-600 line-clamp-2 mt-2">{task.descricao}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {formatShortDate(task.prazo)}
                      </span>
                      {task.status === 'done' ? (
                        <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-4 h-4" />
                          Finalizada
                        </span>
                      ) : task.prazo ? (
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          Em aberto
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4" />
                          Sem prazo
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(getExternalTaskUrl(task))}
                      className="h-10 px-4 rounded-lg border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                    >
                      Abrir tarefa
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

    </div>
  );
};
