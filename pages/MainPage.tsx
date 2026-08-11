
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  ClipboardList,
  FolderKanban,
  Target,
  Calendar as CalendarIcon,
  ArrowUpRight,
  Trophy,
  Zap,
  ChevronRight,
  HelpCircle,
  MapPin
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { EventDetailsModal } from '../components/EventDetailsModal';

export const MainPage = () => {
  const navigate = useNavigate();
  const { projects, tasks, chapters, chapterGoals, tools, events } = useData();
  const [activePeriod, setActivePeriod] = useState<string>('');

  // Modal State
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedEventForDetails, setSelectedEventForDetails] = useState<any>(null);

  // State for motivational quote
  const [motivationalQuote, setMotivationalQuote] = useState("Mantenha suas metas atualizadas trimestralmente para alinhar com a estratégia global.");

  // Logic to load motivational quote from tools table
  useEffect(() => {
    const quoteTool = tools.find((t: any) => t.id === 'motivational_quotes');

    if (quoteTool && quoteTool.status === 'active' && quoteTool.content) {
      try {
        const phrases = JSON.parse(quoteTool.content);
        if (Array.isArray(phrases) && phrases.length > 0) {
          // Select random phrase
          const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
          setMotivationalQuote(randomPhrase);
        }
      } catch (e) {
        console.error("Erro ao processar frases motivacionais:", e);
      }
    }
  }, [tools]);

  // Identify "Ramo Estudantil" chapter (assumed to be the main one or explicitly named 'Ramo')
  const ramoChapter = chapters.find((c: any) => (c.acronym && c.acronym === 'Ramo') || (c.name && c.name.includes('Ramo')) || c.id === 1);
  const mainTasks = tasks.filter((t: any) => !t.parentTaskId);

  // Filter goals for Ramo
  const allRamoGoals = useMemo(() =>
    ramoChapter ? chapterGoals.filter((g: any) => g.chapter_id === ramoChapter.id) : [],
    [chapterGoals, ramoChapter]);

  // Calcula os períodos disponíveis dinamicamente
  const availablePeriods = useMemo(() => {
    const periods = Array.from(new Set(allRamoGoals.map((g: any) => g.period || 'Anual')));
    const sortOrder: Record<string, number> = { 'Mensal': 1, 'Trimestral': 2, 'Semestral': 3, 'Anual': 4 };
    return periods.sort((a: any, b: any) => (sortOrder[a] || 9) - (sortOrder[b] || 9));
  }, [allRamoGoals]);

  // Define o período ativo inicial se ainda não estiver definido
  useEffect(() => {
    if (availablePeriods.length > 0 && !availablePeriods.includes(activePeriod)) {
      setActivePeriod(availablePeriods[0]);
    } else if (availablePeriods.length === 0) {
      setActivePeriod('Anual'); // Fallback
    }
  }, [availablePeriods, activePeriod]);

  const filteredGoals = allRamoGoals.filter((g: any) => (g.period || 'Anual') === activePeriod);

  // Get upcoming public events (next 4 events sorted by date)
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Include events from today onwards

    return events
      .filter((e: any) => e.isPublic && new Date(e.startDate) >= now)
      .sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 4);
  }, [events]);

  const handleEventClick = (rawEvent: any) => {
    // Format event data to match what EventDetailsModal expects (RBC structure)
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

  return (
    <div className="space-y-8 pb-10">

      <EventDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        event={selectedEventForDetails}
      // Read-only in MainPage
      />

      {/* 1. HERO SECTION */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                <span className="text-blue-800 font-extrabold text-lg tracking-tighter">IEEE</span>
              </div>
              <div className="h-8 w-px bg-blue-400/50"></div>
              <span className="text-blue-100 font-medium tracking-wide text-sm uppercase">Brasil Section</span>
            </div>

            <div>
              <h1 className="text-3xl md:text-4xl font-bold leading-tight">
                Bem-vindo ao <span className="text-blue-200">ConectaIEEE</span>
              </h1>
              <p className="text-blue-100 mt-2 max-w-xl text-lg opacity-90">
                A plataforma central para gestão de projetos, metas e colaboração dos Ramos Estudantis.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => navigate('/projects')}
                className="px-6 py-2.5 bg-white text-blue-900 font-semibold rounded-lg shadow-sm hover:bg-blue-50 transition-colors flex items-center gap-2"
              >
                Ver Projetos
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Decorative Illustration Area */}
          <div className="hidden md:block pr-8 opacity-90">
            <Trophy className="w-32 h-32 text-blue-300/20 absolute right-10 top-1/2 -translate-y-1/2" />
            <Target className="w-16 h-16 text-yellow-400/80 relative z-10 animate-pulse" />
          </div>
        </div>
      </div>

      {/* 2. SHORTCUT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => navigate('/projects')}
          className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Briefcase className="w-6 h-6" />
            </div>
            <span className="text-2xl font-bold text-gray-900">{projects.length}</span>
          </div>
          <h3 className="font-semibold text-gray-900">Projetos Ativos</h3>
          <p className="text-xs text-gray-500 mt-1">Gerencie iniciativas e parcerias</p>
        </div>

        <div
          onClick={() => navigate('/tasks')}
          className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-orange-50 text-orange-600 rounded-lg group-hover:bg-orange-600 group-hover:text-white transition-colors">
              <ClipboardList className="w-6 h-6" />
            </div>
            <span className="text-2xl font-bold text-gray-900">{mainTasks.length}</span>
          </div>
          <h3 className="font-semibold text-gray-900">Minhas Tarefas</h3>
          <p className="text-xs text-gray-500 mt-1">Acompanhe suas entregas</p>
        </div>

        <div
          onClick={() => navigate('/dashboard')}
          className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <FolderKanban className="w-6 h-6" />
            </div>
            <span className="text-2xl font-bold text-gray-900">{chapters.length}</span>
          </div>
          <h3 className="font-semibold text-gray-900">Capítulos</h3>
          <p className="text-xs text-gray-500 mt-1">Veja as unidades organizacionais</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* 3. LEFT COLUMN: OKRs & Goals (Read-Only) */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Target className="w-6 h-6 text-red-500" />
                <h2 className="text-xl font-bold text-gray-900">Metas do Ramo</h2>
              </div>

              <div className="flex items-center gap-2">
                {/* Pílulas de filtro dinâmicas */}
                {availablePeriods.length > 0 && availablePeriods.map(period => (
                  <button
                    key={period}
                    onClick={() => setActivePeriod(period)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-all border ${activePeriod === period
                      ? 'bg-blue-100 text-blue-700 border-blue-200 shadow-sm'
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                      }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              {filteredGoals.length > 0 ? (
                filteredGoals.map((goal: any) => {
                  const percentage = Math.min(100, Math.round((goal.current_value / goal.target_value) * 100));
                  const createdDate = goal.created_at ? new Date(goal.created_at).toLocaleDateString('pt-BR') : 'Data desconhecida';

                  return (
                    <div key={goal.id} className="group relative">
                      <div className="flex justify-between items-end mb-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-medium text-gray-900">{goal.title}</h4>
                            {goal.description && (
                              <div className="group/desc relative">
                                <HelpCircle className="w-3.5 h-3.5 text-gray-300 hover:text-gray-500 cursor-help transition-colors" />
                                {/* Description Tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-xs p-2 rounded-lg opacity-0 group-hover/desc:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                  {goal.description}
                                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                                </div>
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {goal.indicator_label}: {goal.current_value} / {goal.target_value}
                          </span>
                        </div>

                        {/* Percentage with Creation Date Tooltip */}
                        <div className="group/perc relative">
                          <span className="font-bold text-gray-900 cursor-default">{percentage}%</span>
                          <div className="absolute bottom-full right-0 mb-2 w-max bg-gray-900 text-white text-xs p-2 rounded-lg opacity-0 group-hover/perc:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl whitespace-nowrap">
                            {percentage}% Concluído &rarr; Meta Criada em {createdDate}
                            <div className="absolute -bottom-1 right-2 w-2 h-2 bg-gray-900 rotate-45"></div>
                          </div>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full ${goal.color || 'bg-blue-600'} transition-all duration-1000`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma meta {activePeriod ? activePeriod.toLowerCase() : ''} definida.</p>
                </div>
              )}
            </div>

            {/* AREA DA DICA (FRASE MOTIVACIONAL ALEATÓRIA) */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                <Zap className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                <span className="font-medium">Dica:</span>
                <span className="italic">{motivationalQuote}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. RIGHT COLUMN: Calendar (Showing Public Events) */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-full">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-bold text-gray-900">Agenda Geral</h2>
              </div>
              <span className="text-xs font-medium bg-orange-100 text-orange-700 px-2 py-1 rounded-full">Próximos</span>
            </div>

            <div className="relative border-l-2 border-gray-100 ml-3 space-y-8">
              {upcomingEvents.length > 0 ? upcomingEvents.map((event: any) => {
                const date = new Date(event.startDate);
                const day = date.getDate();
                const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();

                // Fallback para nome do capítulo se disponível
                const chapterName = event.chapter ? event.chapter.acronym : 'Evento';

                return (
                  <div key={event.id} className="relative pl-6 cursor-pointer group" onClick={() => handleEventClick(event)}>
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-orange-400 group-hover:scale-125 transition-transform"></div>
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center justify-center bg-orange-50 rounded-lg w-12 h-12 flex-shrink-0 border border-orange-100">
                        <span className="text-xs font-bold text-orange-400">{month}</span>
                        <span className="text-lg font-bold text-orange-600 leading-none">{day}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-gray-900 line-clamp-1 group-hover:text-blue-600 transition-colors">{event.title}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded uppercase">{chapterName}</span>
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
              }) : (
                <div className="pl-6 text-sm text-gray-500">Nenhum evento público agendado.</div>
              )}
            </div>

            <button
              onClick={() => navigate('/calendar')}
              className="w-full mt-8 py-2 text-sm text-gray-500 hover:text-blue-600 font-medium border-t border-gray-100 flex items-center justify-center gap-1 transition-colors"
            >
              Ver calendário completo
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
