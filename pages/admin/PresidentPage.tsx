
import React, { useState, useMemo } from 'react';
import {
  Globe,
  ArrowLeft,
  UserPlus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Users,
  Briefcase,
  Shield,
  FolderKanban,
  Quote,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { UserAvatar } from '../../lib/utils';
import { hasExternalPermission } from '../../lib/access';
import { MemberModal } from '../../components/MemberModal';
import { supabase } from '../../lib/supabase';

export const PresidentPage = () => {
  const navigate = useNavigate();
  const { users, chapters, tools, fetchData } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('Todos');
  const [chapterFilter, setChapterFilter] = useState('Todos');
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);

  // --- States para Frases Motivacionais ---
  const [quoteInput, setQuoteInput] = useState('');
  const [isSavingQuotes, setIsSavingQuotes] = useState(false);
  const [isUpdatingStats, setIsUpdatingStats] = useState(false);

  // Recupera as frases atuais
  const quotesList = useMemo(() => {
    const tool = tools.find((t: any) => t.id === 'motivational_quotes');
    if (!tool || !tool.content) return [];
    try {
      return JSON.parse(tool.content);
    } catch (e) {
      console.error("Erro ao fazer parse das frases", e);
      return [];
    }
  }, [tools]);

  // Filtragem de Membros
  const filteredUsers = useMemo(() => {
    return users.filter((user: any) => {
      const matchesSearch =
        user.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesChapter = chapterFilter === 'Todos' ||
        (user.chapterIds && user.chapterIds.includes(Number(chapterFilter)));

	      let matchesRole = roleFilter === 'Todos';
	      if (!matchesRole) {
	        if (roleFilter === 'Externos') {
	          matchesRole = hasExternalPermission(user);
	        } else {
	          const mainRoleMatch = user.role === roleFilter;
	          const chapterRoleMatch = user.chapterRoles
	            ? Object.values(user.chapterRoles).some((r: any) => r === roleFilter)
	            : false;
	          matchesRole = mainRoleMatch || chapterRoleMatch;
	        }
	      }

      return matchesSearch && matchesChapter && matchesRole;
    });
  }, [users, searchTerm, roleFilter, chapterFilter]);

  const handleEditMember = (user: any) => {
    setSelectedMember(user);
    setIsMemberModalOpen(true);
  };

  const handleNewMember = () => {
    setSelectedMember(null);
    setIsMemberModalOpen(true);
  };

  // --- Handlers de Frases ---
  const handleAddQuote = async () => {
    if (!quoteInput.trim()) return;
    setIsSavingQuotes(true);

    try {
      const newQuotes = [...quotesList, quoteInput.trim()];

      const { error } = await supabase
        .from('tools')
        .upsert({
          id: 'motivational_quotes',
          content: JSON.stringify(newQuotes),
          status: 'active'
        });

      if (error) throw error;

      setQuoteInput('');
      await fetchData(true);
    } catch (e) {
      console.error("Erro ao salvar frase:", e);
      alert("Erro ao adicionar frase. Tente novamente.");
    } finally {
      setIsSavingQuotes(false);
    }
  };

  const handleDeleteQuote = async (index: number) => {
    if (!window.confirm("Deseja remover esta frase?")) return;

    try {
      const newQuotes = quotesList.filter((_: any, i: number) => i !== index);

      const { error } = await supabase
        .from('tools')
        .upsert({
          id: 'motivational_quotes',
          content: JSON.stringify(newQuotes),
          status: 'active'
        });

      if (error) throw error;
      await fetchData(true);
    } catch (e) {
      console.error("Erro ao remover frase:", e);
      alert("Erro ao remover frase.");
    }
  };

  // --- Handler Estatísticas ---
  const handleUpdateStats = async () => {
    if (isUpdatingStats) return;
    setIsUpdatingStats(true);

    try {
      // Para cada capítulo, contar membros e projetos REAIS na base
      const updates = chapters.map(async (chapter: any) => {
        // 1. Contar Membros (ProfileChapters)
        const { count: membersCount, error: membersError } = await supabase
          .from('profile_chapters')
          .select('id', { count: 'exact', head: true })
          .eq('chapter_id', chapter.id);

        if (membersError) throw membersError;

        // 2. Contar Projetos (ProjectChapters)
        const { count: projectsCount, error: projectsError } = await supabase
          .from('project_chapters')
          .select('project_id', { count: 'exact', head: true })
          .eq('chapter_id', chapter.id);

        if (projectsError) throw projectsError;

        // 3. Atualizar Capítulo
        const { error: updateError } = await supabase
          .from('chapters')
          .update({
            members_count: membersCount || 0,
            projects_count: projectsCount || 0
          })
          .eq('id', chapter.id);

        if (updateError) throw updateError;
      });

      await Promise.all(updates);
      await fetchData(true); // Recarrega dados globais
      alert("Estatísticas atualizadas com sucesso!");

    } catch (error) {
      console.error("Erro ao atualizar estatísticas:", error);
      alert("Erro ao atualizar estatísticas. Verifique o console.");
    } finally {
      setIsUpdatingStats(false);
    }
  };

  // Stats Rápidos
  const stats = {
    total: users.length,
    presidentes: users.filter((u: any) => {
      const isMainPres = u.role?.toLowerCase().includes('presidente');
      const isChapPres = u.chapterRoles ? Object.values(u.chapterRoles).some((r: any) => String(r).toLowerCase().includes('presidente')) : false;
      return isMainPres || isChapPres;
    }).length,
	    externos: users.filter((u: any) => hasExternalPermission(u)).length
  };

  return (
    <div className="space-y-6 pb-20">
      <MemberModal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        memberToEdit={selectedMember}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              Gestão Presidencial
              <Shield className="w-5 h-5 text-yellow-500" />
            </h1>
            <p className="text-gray-500 text-sm">Administração global de membros, cargos e alocação em capítulos.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleUpdateStats}
            disabled={isUpdatingStats}
            className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50"
            title="Recalcular membros e projetos por capítulo"
          >
            <RefreshCw className={`w-4 h-4 ${isUpdatingStats ? 'animate-spin' : ''}`} />
            Atualizar Estatísticas
          </button>

          <button
            onClick={handleNewMember}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Cadastrar Novo Usuário
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total de Membros</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-50 text-yellow-600 rounded-lg flex items-center justify-center">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Liderança (Pres.)</p>
            <p className="text-2xl font-bold text-gray-900">{stats.presidentes}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-lg flex items-center justify-center">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
	            <p className="text-sm text-gray-500 font-medium">Externos</p>
	            <p className="text-2xl font-bold text-gray-900">{stats.externos}</p>
          </div>
        </div>
      </div>

      {/* Tabela de Gestão */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

        {/* Filters Toolbar */}
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">

            {/* Filtro de Capítulo */}
            <div className="relative w-full sm:w-auto">
              <FolderKanban className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <select
                value={chapterFilter}
                onChange={(e) => setChapterFilter(e.target.value)}
                className="w-full sm:w-48 pl-9 pr-8 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
              >
                <option value="Todos">Todos os Capítulos</option>
                {chapters.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.sigla}</option>
                ))}
              </select>
            </div>

            {/* Filtro de Cargo */}
            <div className="relative w-full sm:w-auto">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full sm:w-48 pl-9 pr-8 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
              >
                <option value="Todos">Todos os Cargos</option>
                <option value="Conselheiro">Conselheiro</option>
                <option value="Presidente">Presidente</option>
                <option value="Vice-Presidente">Vice-Presidente</option>
	                <option value="Diretor de Projetos">Diretor</option>
	                <option value="Membro">Membro</option>
	                <option value="Trainee">Trainee</option>
	                <option value="Externos">Externos</option>
	              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th scope="col" className="px-6 py-3">Membro</th>
                <th scope="col" className="px-6 py-3">Capítulos & Cargos</th>
                <th scope="col" className="px-6 py-3">Título Principal</th>
                <th scope="col" className="px-6 py-3">Nº Membresia</th>
                <th scope="col" className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user: any) => {
                  return (
                    <tr key={user.id} className="bg-white border-b hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={user} size="sm" />
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900">{user.nome}</span>
                            <span className="text-xs text-gray-500">{user.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          {user.chapterIds && user.chapterIds.length > 0 ? (
                            user.chapterIds.map((cid: number) => {
                              const chap = chapters.find((c: any) => c.id === cid);
                              if (!chap) return null;
                              const roleInChapter = user.chapterRoles?.[cid] || 'Membro';

                              return (
                                <div key={cid} className="flex items-center gap-2">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border border-gray-200 bg-white shadow-sm w-16 justify-center shrink-0`}>
                                    {chap.sigla}
                                  </span>
                                  <span className="text-xs text-gray-700">
                                    {roleInChapter}
                                  </span>
                                </div>
                              );
                            })
                          ) : (
                            <span className="text-gray-400 italic text-xs">Sem atribuição</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800`}>
                          {user.role || 'Membro'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">
                        {user.nroMembresia || '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleEditMember(user)}
                          className="font-medium text-blue-600 hover:underline flex items-center justify-end gap-1 ml-auto hover:bg-blue-50 p-1.5 rounded transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Nenhum membro encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Módulo de Frases Motivacionais */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-8">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center">
              <Quote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Frases Motivacionais</h2>
              <p className="text-sm text-gray-500">Configuração das dicas diárias exibidas na tela inicial.</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400 font-medium">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            {quotesList.length} frases ativas
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Adicionar Nova */}
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700">Adicionar Nova Frase</label>
            <div className="relative">
              <textarea
                value={quoteInput}
                onChange={(e) => setQuoteInput(e.target.value)}
                placeholder="Ex: A persistência é o caminho do êxito..."
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none resize-none h-32 text-sm leading-relaxed"
              />
              <button
                onClick={handleAddQuote}
                disabled={isSavingQuotes || !quoteInput.trim()}
                className="absolute bottom-3 right-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingQuotes ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Adicionar
              </button>
            </div>
            <p className="text-xs text-gray-400">As frases serão exibidas aleatoriamente para todos os usuários na tela inicial.</p>
          </div>

          {/* Lista de Frases */}
          <div className="bg-gray-50 rounded-xl border border-gray-100 p-1 overflow-hidden flex flex-col h-[300px]">
            <div className="overflow-y-auto p-3 space-y-2 flex-1 custom-scrollbar">
              {quotesList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center p-4">
                  <Quote className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">Nenhuma frase cadastrada.</p>
                </div>
              ) : (
                quotesList.map((quote: string, index: number) => (
                  <div key={index} className="group bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex items-start gap-3 hover:border-blue-200 transition-colors">
                    <span className="text-xs font-mono text-gray-300 select-none mt-0.5">#{index + 1}</span>
                    <p className="text-sm text-gray-700 flex-1 leading-relaxed">"{quote}"</p>
                    <button
                      onClick={() => handleDeleteQuote(index)}
                      className="text-gray-300 hover:text-red-500 p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Remover frase"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
