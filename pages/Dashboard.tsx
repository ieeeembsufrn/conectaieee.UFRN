
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, ClipboardList, Users, FolderKanban } from 'lucide-react';
import { useData } from '../context/DataContext';

import { useAuth } from '../context/AuthContext';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { projects, tasks, users, chapters, loading } = useData();
  const { profile } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">Carregando dados...</p>
        </div>
      </div>
    );
  }

  // Filtrar projetos ativos
  const activeProjects = projects.filter((p: any) => p.status !== 'Arquivado');
  const mainTasks = tasks.filter((t: any) => !t.parentTaskId);

  // Split Chapters based on User Profile
  const myChapters: any[] = [];
  const otherChapters: any[] = [];

  if (profile) {
    // AuthContext loads `profile_chapters` (snake_case) from Supabase.
    // Ensure we handle both potential cases (raw from DB or hydrated).
    const userChapters = (profile as any).profileChapters || (profile as any).profile_chapters || [];
    const myChapterIds = userChapters.map((pc: any) => pc.chapter_id); // Join table has 'chapter_id'

    chapters.forEach((c: any) => {
      // Allow number vs string comparison just in case
      if (myChapterIds.includes(c.id) || myChapterIds.includes(Number(c.id))) {
        myChapters.push(c);
      } else {
        otherChapters.push(c);
      }
    });
  } else {
    // If no specific chapters (admin or member of none), show all in "others" (or maybe just all as usual)
    chapters.forEach((c: any) => otherChapters.push(c));
  }


  const stats = {
    projetos: activeProjects.length,
    tarefas: mainTasks.length,
    membros: users.length,
    capitulos: chapters.length
  };

  const ChapterCard = ({ cap }: { cap: any }) => {
    const Icon = cap.icon;
    // Contagem precisa por capítulo (ignorando arquivados)
    const capProjectsCount = activeProjects.filter((p: any) =>
      Array.isArray(p.capituloId) ? p.capituloId.includes(cap.id) : p.capituloId === cap.id
    ).length;

    return (
      <div
        key={cap.id}
        className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1"
        onClick={() => navigate(`/chapters/${cap.acronym ? cap.acronym.toLowerCase() : cap.id}`)}
      >
        <div className="h-32 bg-gray-100 relative overflow-hidden">
          <img src={cap.cover_image_url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt="cover" />
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors"></div>
          <div className={`absolute -bottom-6 left-6 w-16 h-16 rounded-xl bg-gradient-to-br ${cap.color_theme} p-1 shadow-lg ring-4 ring-white`}>
            <div className="w-full h-full bg-white rounded-lg flex items-center justify-center">
              <Icon className="w-8 h-8 text-gray-800" />
            </div>
          </div>
        </div>
        <div className="pt-8 p-6">
          <h3 className="text-lg font-bold text-gray-900">{cap.name}</h3>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{cap.description}</p>

          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-50">
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="font-medium">{cap.members_count}</span> Membros
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <Briefcase className="w-4 h-4 text-purple-500" />
              <span className="font-medium">{capProjectsCount}</span> Projetos
            </div>
          </div>

          <button className="w-full mt-4 py-2 bg-gray-50 text-blue-600 font-medium rounded-lg text-sm hover:bg-blue-50 transition-colors">
            Ver Detalhes
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard de Estatísticas</h1>
          <p className="text-gray-500 mt-1">Visão geral quantitativa do IEEE Student Branch Brasil</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Projetos Ativos</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats.projetos}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total de Tarefas</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats.tarefas}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-lg">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Membros</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats.membros}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Capítulos</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats.capitulos}</h3>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Nossos Capítulos</h2>

        {/* Helper function to avoid code duplication is handled via component above, 
            but we can't define component inside component cleanly in React usually (re-renders), 
            better to map directly or extract outside. 
            For this refactor, I'll inline the map content or use the inner generic component if stable enough.
            Actually, redefining component inside render is bad practice (remounts input).
            Let's just map cleanly.
        */}

        {myChapters.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {myChapters.map((cap: any) => (
                <ChapterCard key={cap.id} cap={cap} />
              ))}
            </div>

            {/* Visual Separator as requested */}
            <hr className="my-8 border-gray-200" />
          </>
        )}

        {/* Other Chapters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {otherChapters.map((cap: any) => (
            <ChapterCard key={cap.id} cap={cap} />
          ))}
        </div>
      </div>
    </div>
  );
};
