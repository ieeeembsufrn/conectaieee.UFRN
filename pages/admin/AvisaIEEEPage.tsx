import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Clipboard,
  Filter,
  Loader2,
  Mail,
  MessageSquareText,
  Radio,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { supabase } from '../../lib/supabase';
import { UserAvatar } from '../../lib/utils';

interface NotificationTokenRow {
  id: number;
  profile_id: number;
  token: string;
  platform?: string | null;
  user_agent?: string | null;
  enabled: boolean;
  last_seen_at?: string | null;
  notify_due_tasks: boolean;
  notify_overdue_tasks: boolean;
  notify_chapter_events: boolean;
  notify_new_assignments: boolean;
}

const tokenPreview = (token: string) => {
  if (!token) return '-';
  if (token.length <= 24) return token;
  return `${token.slice(0, 14)}...${token.slice(-10)}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Sem registro';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
};

export const AvisaIEEEPage = () => {
  const navigate = useNavigate();
  const { users, chapters } = useData();
  const [tokens, setTokens] = useState<NotificationTokenRow[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [chapterFilter, setChapterFilter] = useState('all');
  const [audienceMode, setAudienceMode] = useState<'all' | 'chapter' | 'manual'>('all');
  const [selectedProfileIds, setSelectedProfileIds] = useState<number[]>([]);
  const [messageTitle, setMessageTitle] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [messageType, setMessageType] = useState('general');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<any>(null);
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    let isActive = true;

    const fetchTokens = async () => {
      setLoadingTokens(true);
      try {
        const { data, error } = await supabase
          .from('notification_tokens')
          .select('*')
          .eq('enabled', true)
          .order('last_seen_at', { ascending: false });

        if (error) throw error;
        if (isActive) setTokens((data || []) as NotificationTokenRow[]);
      } catch (error) {
        console.error('Erro ao carregar tokens de notificação:', error);
      } finally {
        if (isActive) setLoadingTokens(false);
      }
    };

    fetchTokens();

    return () => {
      isActive = false;
    };
  }, []);

  const activeProfileIds = useMemo(
    () => Array.from(new Set(tokens.map((token) => token.profile_id))),
    [tokens]
  );

  const notificationUsers = useMemo(() => {
    return activeProfileIds
      .map((profileId) => {
        const user = users.find((candidate: any) => candidate.id === profileId);
        if (!user) return null;
        const userTokens = tokens.filter((token) => token.profile_id === profileId);
        return {
          ...user,
          tokens: userTokens,
          activeDevices: userTokens.length
        };
      })
      .filter(Boolean) as any[];
  }, [activeProfileIds, tokens, users]);

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return notificationUsers.filter((user: any) => {
      const matchesSearch =
        !query ||
        user.nome?.toLowerCase().includes(query) ||
        user.full_name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query);

      const matchesChapter =
        chapterFilter === 'all' ||
        user.chapterIds?.includes(Number(chapterFilter));

      return matchesSearch && matchesChapter;
    });
  }, [notificationUsers, searchTerm, chapterFilter]);

  const recipients = useMemo(() => {
    if (audienceMode === 'manual') {
      return filteredUsers.filter((user: any) => selectedProfileIds.includes(user.id));
    }

    if (audienceMode === 'chapter' && chapterFilter !== 'all') {
      return filteredUsers.filter((user: any) => user.chapterIds?.includes(Number(chapterFilter)));
    }

    return filteredUsers;
  }, [audienceMode, chapterFilter, filteredUsers, selectedProfileIds]);

  const recipientTokens = recipients.flatMap((user: any) => user.tokens || []);
  const selectedSet = new Set(selectedProfileIds);

  const toggleRecipient = (profileId: number) => {
    setSelectedProfileIds((current) =>
      current.includes(profileId)
        ? current.filter((id) => id !== profileId)
        : [...current, profileId]
    );
  };

  const handlePreparedSend = async () => {
    setSendResult(null);
    setSendError('');

    const title = messageTitle.trim();
    const body = messageBody.trim();

    if (!title || !body || recipientTokens.length === 0) return;

    const filteredProfileIds = filteredUsers.map((user: any) => user.id);
    const manualProfileIds = recipients.map((user: any) => user.id);

    const audience =
      audienceMode === 'manual'
        ? { mode: 'manual', profile_ids: manualProfileIds }
        : audienceMode === 'chapter' && chapterFilter !== 'all'
          ? { mode: 'chapter', chapter_id: Number(chapterFilter) }
          : searchTerm.trim() || chapterFilter !== 'all'
            ? { mode: 'manual', profile_ids: filteredProfileIds }
            : { mode: 'all' };

    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      let activeSession = sessionData.session;
      const expiresAt = activeSession?.expires_at ? activeSession.expires_at * 1000 : 0;

      if (activeSession && expiresAt && expiresAt - Date.now() < 60_000) {
        const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) throw refreshError;
        activeSession = refreshedData.session;
      }

      const accessToken = activeSession?.access_token;
      if (!accessToken) {
        throw new Error('Sua sessão expirou. Faça login novamente antes de enviar o aviso.');
      }

      const { error: userValidationError } = await supabase.auth.getUser(accessToken);
      if (userValidationError) {
        throw new Error('Sua sessão não pôde ser validada. Faça login novamente antes de enviar o aviso.');
      }

      const { data, error } = await supabase.functions.invoke('avisaieee-send', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: {
          title,
          body,
          type: messageType,
          audience,
          url: `${window.location.origin}${window.location.pathname}#/`
        }
      });

      if (error) throw error;

      setSendResult(data);
      if (data?.success_count > 0) {
        setMessageTitle('');
        setMessageBody('');
      }
    } catch (error: any) {
      console.error('Erro ao enviar AvisaIEEE:', error);
      setSendError(error?.message || 'Não foi possível enviar o aviso.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              AvisaIEEE
              <BellRing className="w-5 h-5 text-amber-500" />
            </h1>
            <p className="text-gray-500 text-sm">Central administrativa de comunicados push.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 shadow-sm">
            <Users className="w-4 h-4 text-blue-600" />
            {notificationUsers.length} usuários ativos
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 shadow-sm">
            <Smartphone className="w-4 h-4 text-emerald-600" />
            {tokens.length} dispositivos
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6">
        <div className="space-y-6 min-w-0">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-col lg:flex-row gap-3 justify-between">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por nome ou email..."
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <select
                    value={chapterFilter}
                    onChange={(event) => setChapterFilter(event.target.value)}
                    className="w-full sm:w-56 pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500 appearance-none"
                  >
                    <option value="all">Todos os capítulos</option>
                    {chapters.map((chapter: any) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.sigla || chapter.acronym} - {chapter.nome || chapter.name}
                      </option>
                    ))}
                  </select>
                </div>

                <select
                  value={audienceMode}
                  onChange={(event) => setAudienceMode(event.target.value as any)}
                  className="w-full sm:w-48 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="all">Enviar para todos filtrados</option>
                  <option value="chapter">Segmentar por capítulo</option>
                  <option value="manual">Selecionar grupo</option>
                </select>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {loadingTokens ? (
                <div className="p-10 text-center text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-amber-500" />
                  Carregando usuários com notificações...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-10 text-center text-gray-500">Nenhum usuário com notificação ativa encontrado.</div>
              ) : (
                filteredUsers.map((user: any) => (
                  <div key={user.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {audienceMode === 'manual' && (
                          <button
                            type="button"
                            onClick={() => toggleRecipient(user.id)}
                            className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${selectedSet.has(user.id)
                              ? 'bg-amber-500 border-amber-500 text-white'
                              : 'bg-white border-gray-300 text-transparent'
                              }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        <UserAvatar user={user} size="sm" />
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{user.nome || user.full_name}</p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {user.chapterIds?.map((chapterId: number) => {
                              const chapter = chapters.find((item: any) => item.id === chapterId);
                              return chapter ? (
                                <span key={chapterId} className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] font-bold text-gray-600">
                                  {chapter.sigla || chapter.acronym}
                                </span>
                              ) : null;
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="lg:w-[420px] space-y-2">
                        {user.tokens.map((token: NotificationTokenRow) => (
                          <div key={token.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                                {token.platform || 'dispositivo'}
                              </span>
                              <span className="text-[10px] text-gray-400">{formatDate(token.last_seen_at)}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <code className="min-w-0 flex-1 truncate text-[11px] text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                {tokenPreview(token.token)}
                              </code>
                              <button
                                type="button"
                                onClick={() => navigator.clipboard?.writeText(token.token)}
                                className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                                title="Copiar token"
                              >
                                <Clipboard className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sticky top-4">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquareText className="w-5 h-5 text-amber-500" />
              <h2 className="font-bold text-gray-900">Compor aviso</h2>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                <p className="text-xs font-semibold text-amber-700">Destinatários</p>
                <p className="text-2xl font-bold text-amber-900">{recipients.length}</p>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                <p className="text-xs font-semibold text-blue-700">Tokens</p>
                <p className="text-2xl font-bold text-blue-900">{recipientTokens.length}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold uppercase text-gray-500">Tipo</label>
                <select
                  value={messageType}
                  onChange={(event) => setMessageType(event.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="general">Aviso geral</option>
                  <option value="chapter_event">Evento de capítulo</option>
                  <option value="task_due">Tarefas a vencer</option>
                  <option value="task_overdue">Tarefas atrasadas</option>
                  <option value="assignment">Nova tarefa atribuída</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-gray-500">Título</label>
                <input
                  value={messageTitle}
                  onChange={(event) => setMessageTitle(event.target.value)}
                  maxLength={80}
                  placeholder="Ex: Reunião geral amanhã"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-gray-500">Mensagem</label>
                <textarea
                  value={messageBody}
                  onChange={(event) => setMessageBody(event.target.value)}
                  maxLength={240}
                  rows={5}
                  placeholder="Escreva a mensagem que será enviada por push..."
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none resize-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handlePreparedSend}
              disabled={sending || !messageTitle.trim() || !messageBody.trim() || recipientTokens.length === 0}
              className="mt-4 w-full px-4 py-3 rounded-lg bg-gray-900 text-white font-bold text-sm hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? 'Enviando...' : 'Enviar aviso'}
            </button>

            {sendError && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-100 p-3 text-xs font-medium text-red-700">
                {sendError}
              </div>
            )}

            {sendResult && (
              <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-800">
                Envio processado: {sendResult.success_count || 0} sucesso(s), {sendResult.failure_count || 0} falha(s), {sendResult.disabled_count || 0} token(s) desativado(s).
              </div>
            )}

            <div className="mt-4 rounded-lg bg-gray-50 border border-gray-100 p-3 text-xs text-gray-500 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-gray-700">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Segurança do envio
              </div>
              <p>A Edge Function valida admin, recalcula tokens elegíveis no servidor e respeita preferências por tipo.</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Radio className="w-5 h-5 text-blue-600" />
              <h2 className="font-bold text-gray-900">Segmentos rápidos</h2>
            </div>
            <div className="space-y-2">
              <button onClick={() => setAudienceMode('all')} className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm text-gray-700">
                Todos com token ativo
              </button>
              <button onClick={() => setAudienceMode('chapter')} className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm text-gray-700">
                Capítulo selecionado
              </button>
              <button onClick={() => setAudienceMode('manual')} className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm text-gray-700">
                Grupo manual
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
