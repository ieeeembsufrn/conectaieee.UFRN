
import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  User,
  Mail,
  GraduationCap,
  Briefcase,
  Save,
  Loader2,
  ChevronDown,
  Trash2,
  Calendar,
  BadgeCheck,
  Image,
  Linkedin,
  Github,
  Instagram,
  Phone,
  FileText,
  Palette
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useData } from '../context/DataContext';
import { getAuthRecoveryRedirectUrl } from '../lib/appUrl';
import { fetchProfilePrivateData, saveProfilePrivateData } from '../lib/profilePrivateData';

interface MemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberToEdit?: any;
}

const ROLES = [
  'Conselheiro',
  'Presidente',
  'Vice-Presidente',
  'Diretor de Projetos',
  'Diretor de Marketing',
  'Tesoureiro',
  'Secretário',
  'Membro',
  'Trainee'
];

const PERMISSIONS = [
  { slug: 'member', label: 'Membro' },
  { slug: 'manager', label: 'Gerente' },
  { slug: 'chair', label: 'Chair/Líder' },
  { slug: 'admin', label: 'Admin' }
];

const getInitials = (name: string) => {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

const getDefaultFormData = () => ({
  nome: '',
  email: '',
  matricula: '',
  role: 'Membro',
  chapterIds: [] as number[],
  chapterRoles: {} as Record<string, string>,
  chapterPermissions: {} as Record<string, string>,
  phone: '',
  cpf: '',
  birthDate: '',
  membershipNumber: '',
  course: '',
  ieeeMembershipDate: '',
  photoUrl: '',
  coverConfig: '',
  linkedin: '',
  github: '',
  instagram: '',
  skillsText: '',
  notes: '',
  bio: ''
});

const parseSkills = (value: string) => {
  return value
    .split(/[\n,]/)
    .map((skill) => skill.trim())
    .filter(Boolean);
};

const getFunctionErrorMessage = async (error: any) => {
  const response = error?.context;
  if (response instanceof Response) {
    try {
      const body = await response.clone().json();
      if (body?.error) return body.error;
    } catch (_parseError) {
      // Keep the SDK message when the function response is not JSON.
    }
  }

  return error?.message || 'Não foi possível criar o usuário.';
};

export const MemberModal = ({ isOpen, onClose, memberToEdit }: MemberModalProps) => {
  const { chapters, fetchData } = useData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingRecoveryLink, setIsSendingRecoveryLink] = useState(false);
  const [isLoadingPrivateData, setIsLoadingPrivateData] = useState(false);
  const [privateFieldsLoaded, setPrivateFieldsLoaded] = useState(false);
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const ramoChapter = chapters.find((c: any) =>
    c.id === 1 ||
    c.sigla === 'Ramo' ||
    c.acronym === 'Ramo' ||
    String(c.nome || c.name || '').toLowerCase().includes('ramo')
  );

  // State
  const [formData, setFormData] = useState(getDefaultFormData());

  // Dropdown UI State
  const [showChapterDropdown, setShowChapterDropdown] = useState(false);
  const chapterDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPrivateFieldsLoaded(!memberToEdit);
      setIsLoadingPrivateData(false);

      if (memberToEdit) {
        let isCurrentMember = true;

        setFormData({
          nome: memberToEdit.nome,
          email: memberToEdit.email,
          matricula: memberToEdit.matricula === 'N/D' ? '' : memberToEdit.matricula,
          role: memberToEdit.role || 'Membro',
          chapterIds: memberToEdit.chapterIds || [],
          chapterRoles: memberToEdit.chapterRoles || {},
          chapterPermissions: memberToEdit.profileChapters
            ? memberToEdit.profileChapters.reduce((acc: any, curr: any) => ({ ...acc, [curr.chapter_id]: curr.permission_slug }), {})
            : {},
          phone: '',
          cpf: '',
          birthDate: '',
          membershipNumber: memberToEdit.nroMembresia || memberToEdit.membership_number || '',
          course: memberToEdit.course || '',
          ieeeMembershipDate: memberToEdit.ieee_membership_date || '',
          photoUrl: memberToEdit.photo_url || memberToEdit.foto || '',
          coverConfig: memberToEdit.coverConfig || memberToEdit.cover_config || '',
          linkedin: memberToEdit.social?.linkedin || memberToEdit.social_links?.linkedin || '',
          github: memberToEdit.social?.github || memberToEdit.social_links?.github || '',
          instagram: memberToEdit.social?.instagram || memberToEdit.social_links?.instagram || '',
          skillsText: (memberToEdit.habilidades || memberToEdit.skills || []).join(', '),
          notes: '',
          bio: memberToEdit.bio || ''
        });
        setShowAdvancedFields(false);
        setIsLoadingPrivateData(true);

        fetchProfilePrivateData(memberToEdit.id)
          .then((data) => {
            if (!isCurrentMember) return;

            setFormData(prev => ({
              ...prev,
              phone: data?.phone || '',
              cpf: data?.cpf?.[0] || '',
              birthDate: data?.birth_date ? data.birth_date.split('T')[0] : '',
              notes: data?.notes || ''
            }));
            setPrivateFieldsLoaded(true);
          })
          .catch((error) => {
            if (!isCurrentMember) return;
            console.error('Erro ao carregar dados privados do membro:', error);
          })
          .finally(() => {
            if (isCurrentMember) {
              setIsLoadingPrivateData(false);
            }
          });

        return () => {
          isCurrentMember = false;
        };
      } else {
        setFormData(getDefaultFormData());
        setShowAdvancedFields(false);
      }
    }
  }, [isOpen, memberToEdit]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chapterDropdownRef.current && !chapterDropdownRef.current.contains(event.target as Node)) {
        setShowChapterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (memberToEdit && !privateFieldsLoaded) {
      alert('Aguarde o carregamento dos dados privados antes de salvar.');
      return;
    }
    setIsSubmitting(true);

    const fullName = formData.nome.trim();
    const email = formData.email.trim().toLowerCase();
    const skills = parseSkills(formData.skillsText);
    const chapterAssignments = formData.chapterIds.map(cid => ({
      id: cid,
      role: formData.chapterRoles[cid] || 'Membro',
      permission_slug: formData.chapterPermissions[cid] || 'member'
    }));

    const privateProfilePayload = {
      phone: formData.phone.trim() || null,
      cpf: formData.cpf.trim() ? [formData.cpf.trim()] : [],
      birth_date: formData.birthDate || null,
      notes: formData.notes.trim() || null
    };

    const profilePayload: any = {
      full_name: fullName,
      email,
      matricula: formData.matricula.trim(),
      role: formData.role, // Título principal
      membership_number: formData.membershipNumber.trim() || null,
      course: formData.course.trim() || null,
      ieee_membership_date: formData.ieeeMembershipDate.trim() || null,
      photo_url: formData.photoUrl.trim() || null,
      cover_config: formData.coverConfig.trim() || null,
      social_links: {
        linkedin: formData.linkedin.trim(),
        github: formData.github.trim(),
        instagram: formData.instagram.trim()
      },
      skills,
      bio: formData.bio.trim() || null,
      // REMOVED: chapter_ids, chapter_roles (Normalized)
      // Se for criação, adicionar iniciais básicas
      ...(!memberToEdit && {
        avatar_initials: getInitials(fullName)
      })
    };

    try {
      if (memberToEdit) {
        const profileId = memberToEdit.id;
        const { error } = await supabase
          .from('profiles')
          .update(profilePayload)
          .eq('id', profileId);
        if (error) throw error;
        await saveProfilePrivateData(profileId, privateProfilePayload);

        const chapterRows = chapterAssignments.map(chapter => ({
          profile_id: profileId,
          chapter_id: chapter.id,
          role: chapter.role,
          permission_slug: chapter.permission_slug
        }));

        const { data: existingChapters, error: existingChaptersError } = await supabase
          .from('profile_chapters')
          .select('chapter_id')
          .eq('profile_id', profileId);
        if (existingChaptersError) throw existingChaptersError;

        if (chapterRows.length > 0) {
          const { error: chapErr } = await supabase
            .from('profile_chapters')
            .upsert(chapterRows, { onConflict: 'profile_id,chapter_id' });
          if (chapErr) throw chapErr;
        }

        const selectedChapterIds = new Set(chapterAssignments.map(chapter => chapter.id));
        const removedChapterIds = (existingChapters || [])
          .map((chapter: any) => chapter.chapter_id)
          .filter((chapterId: number) => !selectedChapterIds.has(chapterId));

        if (removedChapterIds.length > 0) {
          const { error: deleteChaptersError } = await supabase
            .from('profile_chapters')
            .delete()
            .eq('profile_id', profileId)
            .in('chapter_id', removedChapterIds);
          if (deleteChaptersError) throw deleteChaptersError;
        }
      } else {
        if (chapterAssignments.length === 0) {
          throw new Error('Adicione pelo menos um capítulo ou use a opção de Membro externo.');
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        let activeSession = sessionData.session;
        const expiresAt = activeSession?.expires_at ? activeSession.expires_at * 1000 : 0;

        if (activeSession && expiresAt && expiresAt - Date.now() < 60_000) {
          const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) throw refreshError;
          activeSession = refreshedData.session;
        }

        const accessToken = activeSession?.access_token;
        if (!accessToken) {
          throw new Error('Sua sessão expirou. Faça login novamente antes de cadastrar um usuário.');
        }

        const { error: userValidationError } = await supabase.auth.getUser(accessToken);
        if (userValidationError) {
          throw new Error('Sua sessão não pôde ser validada. Faça login novamente antes de cadastrar um usuário.');
        }

	        const { data, error } = await supabase.functions.invoke('admin-create-user', {
	          headers: {
	            Authorization: `Bearer ${accessToken}`
	          },
	          body: {
	            email,
	            full_name: fullName,
	            matricula: formData.matricula.trim(),
	            role: formData.role || 'Membro',
	            avatar_initials: getInitials(fullName),
	            phone: privateProfilePayload.phone,
	            cpf: privateProfilePayload.cpf,
	            birth_date: privateProfilePayload.birth_date,
	            membership_number: formData.membershipNumber.trim() || null,
	            course: formData.course.trim() || null,
	            ieee_membership_date: formData.ieeeMembershipDate.trim() || null,
	            photo_url: formData.photoUrl.trim() || undefined,
	            cover_config: formData.coverConfig.trim() || undefined,
	            social_links: {
	              linkedin: formData.linkedin.trim(),
	              github: formData.github.trim(),
	              instagram: formData.instagram.trim()
	            },
	            skills,
	            notes: privateProfilePayload.notes,
	            bio: formData.bio.trim() || null,
	            chapters: chapterAssignments
	          }
	        });

        if (error) {
          throw new Error(await getFunctionErrorMessage(error));
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        if (data?.user?.profile_id) {
          await saveProfilePrivateData(data.user.profile_id, privateProfilePayload);
        }
      }

      await fetchData(true);
      onClose();
    } catch (e: any) {
      console.error("Erro ao salvar membro:", e);
      alert(e.message || "Erro ao salvar dados do membro. Verifique o console para mais detalhes.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddChapter = (id: number) => {
    setFormData(prev => {
      // Se já existe, não faz nada
      if (prev.chapterIds.includes(id)) return prev;

      // Adiciona o ID e define cargo padrão como 'Membro'
      return {
        ...prev,
        chapterIds: [...prev.chapterIds, id],
        chapterRoles: { ...prev.chapterRoles, [id]: 'Membro' },
        chapterPermissions: { ...prev.chapterPermissions, [id]: 'member' }
      };
    });
    setShowChapterDropdown(false);
  };

  const handleRemoveChapter = (id: number) => {
    setFormData(prev => {
      const newRoles = { ...prev.chapterRoles };
      const newPermissions = { ...prev.chapterPermissions };
      delete newRoles[id];
      delete newPermissions[id];
      return {
        ...prev,
        chapterIds: prev.chapterIds.filter(c => c !== id),
        chapterRoles: newRoles,
        chapterPermissions: newPermissions
      };
    });
  };

  const handleChangeRole = (chapterId: number, newRole: string) => {
    setFormData(prev => ({
      ...prev,
      chapterRoles: { ...prev.chapterRoles, [chapterId]: newRole }
    }));
  };

	  const handleChangePermission = (chapterId: number, newPermission: string) => {
	    setFormData(prev => ({
	      ...prev,
	      chapterPermissions: { ...prev.chapterPermissions, [chapterId]: newPermission }
	    }));
	  };

  const handleSendRecoveryLink = async () => {
    const email = formData.email.trim();
    if (!email) {
      alert('Informe um email antes de enviar o link de recuperação.');
      return;
    }

    setIsSendingRecoveryLink(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRecoveryRedirectUrl()
      });

      if (error) throw error;

      alert(`Link de recuperação enviado para ${email}.`);
    } catch (error: any) {
      console.error('Erro ao enviar link de recuperação:', error);
      alert(error.message || 'Não foi possível enviar o link de recuperação.');
    } finally {
      setIsSendingRecoveryLink(false);
    }
  };

  const handleSetExternalMember = () => {
    if (!ramoChapter) {
      alert('Capítulo Ramo não encontrado. Verifique o cadastro de capítulos.');
      return;
    }

    setFormData(prev => ({
      ...prev,
      role: 'External',
      matricula: 'EXTERNO',
      chapterIds: [ramoChapter.id],
      chapterRoles: { [ramoChapter.id]: 'External' },
      chapterPermissions: { [ramoChapter.id]: 'external' }
    }));
    setShowChapterDropdown(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-gray-100 flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            {memberToEdit ? 'Editar Membro' : 'Cadastrar Novo Usuário'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Dados Pessoais */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  required
                  type="text"
                  value={formData.nome}
                  onChange={e => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                  placeholder="Ex: João da Silva"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                    placeholder="joao@exemplo.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Matrícula</label>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.matricula}
                    onChange={e => setFormData({ ...formData, matricula: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                    placeholder="Ex: 200012345"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-100 my-2"></div>

          {/* Dados Organizacionais */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Atribuição Organizacional</h3>

            <div className="space-y-4">
              {/* Cargo Principal (Visual) */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Título Principal (Sistema)</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm"
                    placeholder="Ex: Presidente do Ramo, Membro Ativo"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Cargo exibido no card principal e listas gerais.</p>
              </div>

	                {/* Multi-Select Capítulos com Cargos Específicos */}
	              <div className="relative" ref={chapterDropdownRef}>
	                <div className="flex justify-between items-center mb-2">
	                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">Cargos por Capítulo</label>
	                  <div className="flex items-center gap-3">
	                    <button
	                      type="button"
	                      onClick={handleSetExternalMember}
	                      disabled={!ramoChapter}
	                      className="text-xs text-amber-700 font-bold hover:underline disabled:text-gray-300 disabled:no-underline flex items-center gap-1"
	                      title="Vincula ao Ramo com permissão External"
	                    >
	                      Membro externo
	                    </button>
	                    <button
	                      type="button"
	                      onClick={() => setShowChapterDropdown(!showChapterDropdown)}
	                      className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1"
	                    >
	                      + Adicionar Capítulo
	                    </button>
	                  </div>
	                </div>

                {/* Dropdown de Adição */}
                {showChapterDropdown && (
                  <div className="absolute top-6 right-0 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                    {chapters.filter((c: any) => !formData.chapterIds.includes(c.id)).length === 0 && (
                      <div className="p-3 text-xs text-gray-500 text-center">Todos os capítulos adicionados.</div>
                    )}
                    {chapters.map((c: any) => {
                      const isSelected = formData.chapterIds.includes(c.id);
                      if (isSelected) return null;
                      return (
                        <div
                          key={c.id}
                          className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer flex items-center gap-2 text-sm text-gray-700 border-b border-gray-50 last:border-0"
                          onClick={() => handleAddChapter(c.id)}
                        >
                          <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${c.cor}`}></div>
                          {c.sigla} - {c.nome}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Lista de Capítulos Selecionados e seus Cargos */}
                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                  {formData.chapterIds.length === 0 && (
                    <div className="text-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-sm">
                      Nenhum capítulo vinculado.
                    </div>
                  )}

                  {formData.chapterIds.map(id => {
                    const chapter = chapters.find((c: any) => c.id === id);
                    if (!chapter) return null;

                    return (
                      <div key={id} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${chapter.cor} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                            {chapter.sigla}
                          </div>
                          <span className="text-sm font-medium text-gray-700 truncate" title={chapter.nome}>
                            {chapter.nome}
                          </span>
                        </div>

                        <select
                          value={formData.chapterRoles[id] || 'Membro'}
                          onChange={(e) => handleChangeRole(id, e.target.value)}
                          className="bg-white border border-gray-300 text-gray-700 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-32 p-1.5 outline-none"
                        >
                          {ROLES.map(role => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>

	                        {/* Permission Selector */}
	                        <div title="Nível de Permissão">
	                          {formData.chapterPermissions[id] === 'external' ? (
	                            <span className="inline-flex items-center justify-center w-24 px-2 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs font-bold">
	                              External
	                            </span>
	                          ) : (
	                            <select
	                              value={formData.chapterPermissions[id] || 'member'}
	                              onChange={(e) => handleChangePermission(id, e.target.value)}
	                              className={`border border-gray-300 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-24 p-1.5 outline-none ${(formData.chapterPermissions[id] === 'admin' || formData.chapterPermissions[id] === 'chair')
	                                  ? 'bg-yellow-50 text-yellow-700 font-bold border-yellow-200'
	                                  : 'bg-white text-gray-700'
	                                }`}
	                            >
	                              {PERMISSIONS.map(p => (
	                                <option key={p.slug} value={p.slug}>{p.label}</option>
	                              ))}
	                            </select>
	                          )}
	                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveChapter(id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
	                  })}
	                </div>
	                {memberToEdit && (
	                  <button
	                    type="button"
	                    onClick={handleSendRecoveryLink}
	                    disabled={isSendingRecoveryLink || !formData.email.trim()}
	                    className="mt-3 w-full px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border border-blue-100"
	                  >
	                    {isSendingRecoveryLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
	                    Enviar link de recuperação de senha
	                  </button>
	                )}
	              </div>
	            </div>
	          </div>

          <div className="border border-gray-100 rounded-xl overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setShowAdvancedFields(prev => !prev)}
              className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900">Informações extras do perfil</p>
                  <p className="text-xs text-gray-500 truncate">Telefone, redes, IEEE, bio, foto e dados acadêmicos.</p>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showAdvancedFields ? 'rotate-180' : ''}`} />
            </button>

            {showAdvancedFields && (
              <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-4">
                {isLoadingPrivateData && (
                  <div className="flex items-center gap-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Carregando dados privados...
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Telefone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                        placeholder="(61) 99999-9999"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">CPF</label>
                    <input
                      type="text"
                      value={formData.cpf}
                      onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                      placeholder="000.000.000-00"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Data de Nascimento</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="date"
                        value={formData.birthDate}
                        onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Curso</label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={formData.course}
                        onChange={e => setFormData({ ...formData, course: e.target.value })}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                        placeholder="Engenharia de Computação"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nº de Membresia IEEE</label>
                    <div className="relative">
                      <BadgeCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={formData.membershipNumber}
                        onChange={e => setFormData({ ...formData, membershipNumber: e.target.value })}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                        placeholder="Ex: 98765432"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Entrada IEEE</label>
                    <input
                      type="text"
                      value={formData.ieeeMembershipDate}
                      onChange={e => setFormData({ ...formData, ieeeMembershipDate: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                      placeholder="Ex: 03/2025"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">URL da Foto</label>
                    <div className="relative">
                      <Image className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="url"
                        value={formData.photoUrl}
                        onChange={e => setFormData({ ...formData, photoUrl: e.target.value })}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Capa do Perfil</label>
                    <div className="relative">
                      <Palette className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={formData.coverConfig}
                        onChange={e => setFormData({ ...formData, coverConfig: e.target.value })}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                        placeholder="from-blue-600 to-indigo-800"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">LinkedIn</label>
                    <div className="relative">
                      <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="url"
                        value={formData.linkedin}
                        onChange={e => setFormData({ ...formData, linkedin: e.target.value })}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">GitHub</label>
                    <div className="relative">
                      <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="url"
                        value={formData.github}
                        onChange={e => setFormData({ ...formData, github: e.target.value })}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Instagram</label>
                    <div className="relative">
                      <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="url"
                        value={formData.instagram}
                        onChange={e => setFormData({ ...formData, instagram: e.target.value })}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Habilidades</label>
                  <textarea
                    value={formData.skillsText}
                    onChange={e => setFormData({ ...formData, skillsText: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm resize-none"
                    placeholder="Python, Gestão de projetos, Marketing"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Observações internas</label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm resize-none"
                    placeholder="Notas administrativas sobre o cadastro."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Bio do Perfil</label>
                  <textarea
                    value={formData.bio}
                    onChange={e => setFormData({ ...formData, bio: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm resize-y"
                    placeholder="Resumo profissional, trajetória, interesses e experiências."
                  />
                </div>
              </div>
            )}
          </div>

		          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 mt-2 flex-shrink-0">
		            <button
		              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingPrivateData || (memberToEdit && !privateFieldsLoaded)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all flex items-center gap-2"
            >
              {(isSubmitting || isLoadingPrivateData) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isLoadingPrivateData ? 'Carregando...' : memberToEdit ? 'Salvar Alterações' : 'Cadastrar e enviar convite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
