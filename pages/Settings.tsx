
import React, { useState, useEffect, useRef } from 'react';
import {
   Save,
   User,
   Mail,
   GraduationCap,
   Calendar,
   BadgeCheck,
   Briefcase,
   Image,
   Palette,
   Linkedin,
   Github,
   Instagram,
   X,
   Plus,
   Loader2,
   Lock,
   Check,
   ChevronDown,
   Eye,
   EyeOff,
   Upload
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { requestNotificationPermission } from '../lib/notifications';
import { Bell } from 'lucide-react';

// Lista de cores do Tailwind para o seletor
const TW_COLORS = [
   'slate', 'gray', 'zinc', 'neutral', 'stone',
   'red', 'orange', 'amber', 'yellow', 'lime',
   'green', 'emerald', 'teal', 'cyan', 'sky',
   'blue', 'indigo', 'violet', 'purple', 'fuchsia',
   'pink', 'rose'
];

export const Settings = () => {
   const { users, chapters, fetchData } = useData();
   const { profile, refreshProfile } = useAuth();
   const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
   const [loading, setLoading] = useState(false);
   const [avatarUploading, setAvatarUploading] = useState(false);
   const [avatarError, setAvatarError] = useState('');
   const [successMsg, setSuccessMsg] = useState('');

   // Gradient Picker State
   const [showGradientPicker, setShowGradientPicker] = useState(false);
   const [gradientState, setGradientState] = useState({
      from: 'blue',
      to: 'indigo'
   });
   const pickerRef = useRef<HTMLDivElement>(null);
   const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
   const [permissionStatus, setPermissionStatus] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied');

   const isAdmin = ((profile as any).profile_chapters || (profile as any).profileChapters || []).some((pc: any) => pc.chapter_id === 1 && pc.permission_slug === 'admin');

   // Markdown Preview State
   const [showBioPreview, setShowBioPreview] = useState(false);

   // Form State
   const [formData, setFormData] = useState({
      email: '',
      matricula: '',
      nroMembresia: '',
      dataNascimento: '',
      foto: '',
      coverConfig: '',
      bio: '',
      social: { linkedin: '', github: '', instagram: '' },
      habilidades: [] as string[],
      phone: '',
      cpf: '',
      ieeeMembershipDate: '',
      course: ''
   });

   const [newSkill, setNewSkill] = useState('');

   // Load User Data when selection changes
   useEffect(() => {
      if (users.length > 0) {
         if (selectedUserId === null) {
            // Se já tem profile carregado, usa ele, senão o primeiro da lista (fallback)
            // Mas a regra diz: por padrão seleciona o logado.
            if (profile) {
               setSelectedUserId(profile.id);
            } else {
               setSelectedUserId(users[0].id);
            }
         } else if (!isAdmin && profile && selectedUserId !== profile.id) {
            // Se não é admin, força selecionar a si mesmo
            setSelectedUserId(profile.id);
         }
      }
   }, [users, selectedUserId, profile, isAdmin]);

   useEffect(() => {
      if (selectedUserId) {
         const user = users.find((u: any) => u.id === Number(selectedUserId));
         if (user) {
            setFormData({
               email: user.email || '',
               matricula: user.matricula === 'N/D' ? '' : (user.matricula || ''),
               nroMembresia: user.nroMembresia || '',
               dataNascimento: user.dataNascimento ? user.dataNascimento.split('T')[0] : '',
               foto: user.foto || '',
               coverConfig: user.coverConfig || '',
               bio: user.bio || '',
               social: {
                  linkedin: user.social?.linkedin || '',
                  github: user.social?.github || '',
                  instagram: user.social?.instagram || ''
               },
               habilidades: user.habilidades || [],
               phone: user.phone || '',
               cpf: (user.cpf && user.cpf.length > 0) ? user.cpf[0] : '',
               ieeeMembershipDate: user.ieee_membership_date || '',
               course: user.course || ''
            });
         }
      }
   }, [selectedUserId, users]);

   // Click outside listener for picker
   useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
         if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
            setShowGradientPicker(false);
         }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
   }, []);

   const selectedUser = users.find((u: any) => u.id === Number(selectedUserId));
   const userChapter = selectedUser ? chapters.find((c: any) => c.id === selectedUser.capituloId) : null;

   const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedUserId) return;
      setLoading(true);
      setSuccessMsg('');

      try {
         const { error } = await supabase
            .from('profiles')
            .update({
               email: formData.email,
               matricula: formData.matricula,
               membership_number: formData.nroMembresia,
               birth_date: formData.dataNascimento || null,
               photo_url: formData.foto,
               cover_config: formData.coverConfig,
               bio: formData.bio,
               skills: formData.habilidades,
               social_links: formData.social,
               phone: formData.phone,
               cpf: formData.cpf ? [formData.cpf] : [],
               ieee_membership_date: formData.ieeeMembershipDate,
               course: formData.course
            })
            .eq('id', selectedUserId);

         if (error) throw error;

         await fetchData(true);
         setSuccessMsg('Perfil atualizado com sucesso!');
         setTimeout(() => setSuccessMsg(''), 3000);
      } catch (err) {
         console.error('Erro ao salvar perfil:', err);
         alert('Erro ao salvar perfil.');
      } finally {
         setLoading(false);
      }
   };

   const handleAddSkill = () => {
      if (newSkill.trim() && !formData.habilidades.includes(newSkill.trim())) {
         setFormData(prev => ({
            ...prev,
            habilidades: [...prev.habilidades, newSkill.trim()]
         }));
         setNewSkill('');
      }
   };

   const removeSkill = (skill: string) => {
      setFormData(prev => ({
         ...prev,
         habilidades: prev.habilidades.filter(s => s !== skill)
      }));
   };

   const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      setAvatarError('');

      if (!file || !selectedUserId) return;

      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
         setAvatarError('Use uma imagem JPG, PNG ou WebP.');
         return;
      }

      if (file.size > 5 * 1024 * 1024) {
         setAvatarError('A imagem deve ter no máximo 5 MB.');
         return;
      }

      setAvatarUploading(true);

      try {
         const { error: currentUserError } = await supabase.auth.getUser();
         if (currentUserError) {
            throw new Error('Sessão expirada. Faça login novamente.');
         }

         const { data: sessionData } = await supabase.auth.getSession();
         const accessToken = sessionData.session?.access_token;

         if (!accessToken) {
            throw new Error('Sessão expirada. Faça login novamente.');
         }

         const functionResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-avatar`, {
            method: 'POST',
            headers: {
               Authorization: `Bearer ${accessToken}`,
               apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
               'Content-Type': 'application/json'
            },
            body: JSON.stringify({
               userId: selectedUserId,
               contentType: file.type
            })
         });

         const data = await functionResponse.json().catch(() => null);
         if (!functionResponse.ok) {
            throw new Error(data?.error || data?.message || `Falha na função de upload (${functionResponse.status}).`);
         }

         if (!data?.presignedUrl || !data?.publicUrl) {
            throw new Error('Resposta inválida da função de upload.');
         }

         const uploadResponse = await fetch(data.presignedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file
         });

         if (!uploadResponse.ok) {
            throw new Error('Falha ao enviar imagem para o storage.');
         }

         const publicUrl = data.publicUrl;
         const versionedUrl = `${publicUrl}${publicUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;

         const { error: updateError } = await supabase
            .from('profiles')
            .update({ photo_url: versionedUrl })
            .eq('id', selectedUserId);

         if (updateError) throw updateError;

         setFormData(prev => ({ ...prev, foto: versionedUrl }));
         await fetchData(true);
         await refreshProfile();
         setSuccessMsg('Foto atualizada com sucesso!');
         setTimeout(() => setSuccessMsg(''), 3000);
      } catch (err) {
         console.error('Erro ao enviar avatar:', err);
         setAvatarError(err instanceof Error ? err.message : 'Não foi possível enviar a foto. Tente novamente.');
      } finally {
         setAvatarUploading(false);
      }
   };

   const applyGradient = () => {
      // Gera a string no formato que o app já espera: "from-COLOR-600 to-COLOR-800"
      // Usamos tons fixos (600 e 800) para garantir bom contraste e estética
      const config = `from-${gradientState.from}-600 to-${gradientState.to}-800`;
      setFormData(prev => ({ ...prev, coverConfig: config }));
      setShowGradientPicker(false);
   };

   if (loading) return <div className="p-8">Carregando...</div>;
   if (!selectedUser && users.length > 0) return <div className="p-8">Usuário não encontrado.</div>;
   if (!selectedUser) return <div className="p-8">Carregando dados...</div>;

   return (
      <div className="max-w-4xl mx-auto space-y-6 pb-20">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
               <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Configurações de Perfil</h1>
               <p className="text-gray-500 mt-1">Gerencie suas informações pessoais e profissionais.</p>
            </div>

            {/* User Selector (Simulating Auth) */}
            <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-200 shadow-sm overflow-hidden max-w-full">
               <span className="text-xs font-bold text-gray-500 uppercase px-2 shrink-0">Editando:</span>

               {isAdmin ? (
                  <select
                     value={selectedUserId || ''}
                     onChange={(e) => setSelectedUserId(Number(e.target.value))}
                     className="bg-transparent border-none text-sm font-medium text-gray-900 focus:ring-0 cursor-pointer outline-none flex-1 min-w-0 truncate pr-8 max-w-[140px] md:max-w-xs"
                  >
                     {users.map((u: any) => (
                        <option key={u.id} value={u.id}>{u.full_name}</option>
                     ))}
                  </select>
               ) : (
                  <span className="text-sm font-medium text-gray-900 px-2 truncate">
                     {selectedUser?.full_name || 'Usuário'}
                  </span>
               )}
            </div>
         </div>

         <form onSubmit={handleSave} className="space-y-6">

            {/* Read-Only Identity Card */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden ring-1 ring-white/10">
               <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
               <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
                  <img
                     src={selectedUser.photo_url || selectedUser.foto}
                     className="w-20 h-20 rounded-xl border-4 border-white/10 bg-slate-700 object-cover shrink-0 shadow-lg"
                     alt="Avatar"
                  />
                  <div className="min-w-0 flex-1">
                     <h2 className="text-2xl font-bold truncate tracking-tight">{selectedUser.full_name}</h2>
                     <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2 mt-2 text-slate-300 text-sm">
                        {userChapter && (
                           <span className="flex items-center gap-1.5 bg-white/10 px-2 py-0.5 rounded-md backdrop-blur-md border border-white/5 shadow-sm">
                              <Briefcase className="w-3.5 h-3.5" />
                              <span className="truncate max-w-[120px]">{userChapter.acronym}</span>
                           </span>
                        )}
                        <span className="flex items-center gap-1.5 bg-blue-500/20 text-blue-200 px-2 py-0.5 rounded-md border border-blue-500/30 shadow-sm">
                           <BadgeCheck className="w-3.5 h-3.5" />
                           <span className="truncate max-w-[150px]">{selectedUser.role}</span>
                        </span>
                        <span className="flex items-center gap-1 opacity-60 text-xs" title="Campo não editável">
                           <Lock className="w-3 h-3" />
                           Somente Leitura
                        </span>
                     </div>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

               {/* Left Column: Personal Info */}
               <div className="lg:col-span-2 space-y-6">

                  {/* Informações de Contato */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                     <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                           <User className="w-5 h-5 text-blue-600" />
                           Informações Pessoais
                        </h3>
                        {/* Botão Alterar Senha - visível apenas para o próprio usuário */}
                        {profile && selectedUserId === profile.id && (
                           <button
                              type="button"
                              onClick={() => setIsChangePasswordOpen(true)}
                              className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                           >
                              <Lock className="w-3.5 h-3.5" />
                              Alterar Senha
                           </button>
                        )}
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                           <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5" /> Email
                           </label>
                           <input
                              type="email"
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                              value={formData.email}
                              onChange={e => setFormData({ ...formData, email: e.target.value })}
                           />
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                              <GraduationCap className="w-3.5 h-3.5" /> Matrícula
                           </label>
                           <input
                              type="text"
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                              value={formData.matricula}
                              onChange={e => setFormData({ ...formData, matricula: e.target.value })}
                           />
                        </div>

                        {/* NOVOS CAMPOS */}
                        <div className="space-y-1.5">
                           <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                              <GraduationCap className="w-3.5 h-3.5" /> Curso
                           </label>
                           <input
                              type="text"
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                              placeholder="Ex: Engenharia Elétrica"
                              value={formData.course}
                              onChange={e => setFormData({ ...formData, course: e.target.value })}
                           />
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5" /> Telefone
                           </label>
                           <input
                              type="text"
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                              placeholder="(00) 00000-0000"
                              value={formData.phone}
                              onChange={e => setFormData({ ...formData, phone: e.target.value })}
                           />
                        </div>

                        <div className="space-y-1.5">
                           <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                              <BadgeCheck className="w-3.5 h-3.5" /> Nº Membresia IEEE
                           </label>
                           <input
                              type="text"
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                              placeholder="Ex: 90123456"
                              value={formData.nroMembresia}
                              onChange={e => setFormData({ ...formData, nroMembresia: e.target.value })}
                           />
                        </div>
                        {/* NOVO */}
                        <div className="space-y-1.5">
                           <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" /> Entrada IEEE (Mês/Ano)
                           </label>
                           <input
                              type="text"
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                              placeholder="Ex: 03/2023"
                              value={formData.ieeeMembershipDate}
                              onChange={e => setFormData({ ...formData, ieeeMembershipDate: e.target.value })}
                           />
                        </div>

                        <div className="space-y-1.5">
                           <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" /> Data de Nascimento
                           </label>
                           <input
                              type="date"
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                              value={formData.dataNascimento}
                              onChange={e => setFormData({ ...formData, dataNascimento: e.target.value })}
                           />
                        </div>
                        {/* NOVO */}
                        <div className="space-y-1.5">
                           <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5" /> CPF (Somente Admin/Próprio)
                           </label>
                           <input
                              type="text"
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                              placeholder="000.000.000-00"
                              value={formData.cpf}
                              onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                           />
                        </div>
                     </div>
                  </div>

                  {/* Bio & Skills */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                     <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-purple-600" />
                        Perfil Profissional
                     </h3>

                     <div className="space-y-4">
                        <div className="space-y-1.5">
                           <label className="text-sm font-semibold text-gray-700">Biografia</label>

                           <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm transition-all focus-within:ring-2 focus-within:ring-purple-100 focus-within:border-purple-300">
                              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
                                 <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Editor Markdown</span>
                                 <button
                                    type="button"
                                    onClick={() => setShowBioPreview(!showBioPreview)}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors"
                                 >
                                    {showBioPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    {showBioPreview ? 'Voltar a Editar' : 'Visualizar Preview'}
                                 </button>
                              </div>

                              {showBioPreview ? (
                                 <div className="w-full px-4 py-3 min-h-[160px] prose prose-sm max-w-none text-gray-600 bg-gray-50/50 overflow-y-auto break-words">
                                    <ReactMarkdown>{formData.bio}</ReactMarkdown>
                                    {(!formData.bio) && <span className="text-gray-400 italic">Nenhuma biografia informada.</span>}
                                 </div>
                              ) : (
                                 <textarea
                                    rows={6}
                                    className="w-full px-4 py-3 bg-white outline-none text-sm leading-relaxed text-gray-700 resize-y"
                                    placeholder="# Sobre mim... (Use Markdown para formatar títulos, listas, etc)"
                                    value={formData.bio}
                                    onChange={e => setFormData({ ...formData, bio: e.target.value })}
                                 />
                              )}
                           </div>
                        </div>

                        <div className="space-y-1.5">
                           <label className="text-sm font-semibold text-gray-700">Habilidades e Competências</label>
                           <div className="flex gap-2">
                              <input
                                 type="text"
                                 className="flex-1 min-w-0 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm"
                                 placeholder="Digite e Enter"
                                 value={newSkill}
                                 onChange={e => setNewSkill(e.target.value)}
                                 onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                              />
                              <button
                                 type="button"
                                 onClick={handleAddSkill}
                                 className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-2.5 rounded-xl transition-colors shrink-0"
                              >
                                 <Plus className="w-5 h-5" />
                              </button>
                           </div>
                           <div className="flex flex-wrap gap-2 mt-3 min-h-[40px]">
                              {formData.habilidades.map(skill => (
                                 <span key={skill} className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-100 rounded-lg text-sm font-medium flex items-center gap-1.5 break-all">
                                    {skill}
                                    <button type="button" onClick={() => removeSkill(skill)} className="hover:text-purple-900"><X className="w-3 h-3" /></button>
                                 </span>
                              ))}
                           </div>
                        </div>
                     </div>
                  </div>

               </div>

               {/* Right Column: Visuals & Socials */}
               <div className="space-y-6">

                  {/* Visual Config */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                     <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Palette className="w-5 h-5 text-orange-500" />
                        Aparência do Perfil
                     </h3>
                     <div className="space-y-4">
                        <div className="space-y-1.5">
                           <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                              <Image className="w-3.5 h-3.5" /> URL da Foto
                           </label>
                           <div className="flex items-center gap-3 mb-2">
                              <img
                                 src={formData.foto || selectedUser.photo_url || selectedUser.foto}
                                 alt="Preview do avatar"
                                 className="w-14 h-14 rounded-xl border border-gray-200 bg-gray-50 object-cover shrink-0"
                              />
                              <label className={`h-10 px-4 rounded-xl border text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer ${avatarUploading ? 'bg-gray-100 text-gray-400 border-gray-200 pointer-events-none' : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100'}`}>
                                 {avatarUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                 {avatarUploading ? 'Enviando...' : 'Enviar foto'}
                                 <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="hidden"
                                    onChange={handleAvatarUpload}
                                    disabled={avatarUploading}
                                 />
                              </label>
                           </div>
                           <input
                              type="text"
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-100 outline-none transition-all text-sm truncate"
                              placeholder="https://..."
                              value={formData.foto}
                              onChange={e => setFormData({ ...formData, foto: e.target.value })}
                           />
                           {avatarError && <p className="text-xs font-medium text-red-600">{avatarError}</p>}
                        </div>

                        {/* Input de Capa + Gradient Picker */}
                        <div className="space-y-1.5 relative" ref={pickerRef}>
                           <label className="text-sm font-semibold text-gray-700 flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5">
                                 <Palette className="w-3.5 h-3.5" /> Capa
                              </div>
                           </label>

                           <div className="flex gap-2">
                              <input
                                 type="text"
                                 className="flex-1 min-w-0 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-100 outline-none transition-all text-sm truncate"
                                 placeholder="URL ou Gradiente"
                                 value={formData.coverConfig}
                                 onChange={e => setFormData({ ...formData, coverConfig: e.target.value })}
                              />
                              <button
                                 type="button"
                                 onClick={() => setShowGradientPicker(!showGradientPicker)}
                                 className={`p-2.5 rounded-xl border transition-all shrink-0 ${showGradientPicker ? 'bg-orange-100 border-orange-200 text-orange-600' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                                 title="Gerador de Gradiente"
                              >
                                 <Palette className="w-5 h-5" />
                              </button>
                           </div>

                           {/* GRADIENT PICKER POPOVER - FIXED RESPONSIVENESS */}
                           {showGradientPicker && (
                              <div className="absolute right-0 top-full mt-2 w-72 max-w-[90vw] bg-white rounded-2xl shadow-xl border border-gray-200 z-50 p-4 animate-in fade-in slide-in-from-top-2">
                                 <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                                    <span className="text-sm font-bold text-gray-800">Gerador</span>
                                    <button type="button" onClick={() => setShowGradientPicker(false)}><X className="w-4 h-4 text-gray-400" /></button>
                                 </div>
                                 {/* ... colors ... */}

                                 <div className="space-y-4">
                                    {/* Cor Inicial */}
                                    <div>
                                       <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Cor Inicial (From)</label>
                                       <div className="grid grid-cols-6 gap-1.5">
                                          {TW_COLORS.map(color => (
                                             <button
                                                key={`from-${color}`}
                                                type="button"
                                                onClick={() => setGradientState(prev => ({ ...prev, from: color }))}
                                                className={`w-8 h-8 rounded-full shadow-sm hover:scale-110 transition-transform bg-${color}-600 ${gradientState.from === color ? 'ring-2 ring-offset-2 ring-orange-500' : ''}`}
                                                title={color}
                                             />
                                          ))}
                                       </div>
                                    </div>

                                    {/* Cor Final */}
                                    <div>
                                       <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Cor Final (To)</label>
                                       <div className="grid grid-cols-6 gap-1.5">
                                          {TW_COLORS.map(color => (
                                             <button
                                                key={`to-${color}`}
                                                type="button"
                                                onClick={() => setGradientState(prev => ({ ...prev, to: color }))}
                                                className={`w-8 h-8 rounded-full shadow-sm hover:scale-110 transition-transform bg-${color}-800 ${gradientState.to === color ? 'ring-2 ring-offset-2 ring-orange-500' : ''}`}
                                                title={color}
                                             />
                                          ))}
                                       </div>
                                    </div>

                                    {/* Preview e Ação */}
                                    <div className="pt-2">
                                       <div className={`h-12 w-full rounded-lg mb-3 bg-gradient-to-r from-${gradientState.from}-600 to-${gradientState.to}-800 shadow-inner flex items-center justify-center`}>
                                          <span className="text-white text-xs font-bold drop-shadow-md">Preview</span>
                                       </div>
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

                           {/* Mini Preview da Capa Atual (Input) */}
                           <div className="mt-2 h-16 w-full rounded-lg overflow-hidden border border-gray-200 relative">
                              {formData.coverConfig && formData.coverConfig.startsWith('http') ? (
                                 <img src={formData.coverConfig} className="w-full h-full object-cover" alt="Preview" />
                              ) : (
                                 <div className={`w-full h-full bg-gradient-to-r ${formData.coverConfig || 'from-gray-100 to-gray-200'}`}></div>
                              )}
                              <div className="absolute inset-0 flex items-center justify-center bg-black/10 text-white text-xs font-bold uppercase tracking-widest backdrop-blur-[1px]">Preview</div>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Social Media */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                     <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Globe className="w-5 h-5 text-blue-500" />
                        Redes Sociais
                     </h3>
                     <div className="space-y-3">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                              <Linkedin className="w-4 h-4" />
                           </div>
                           <input
                              type="text"
                              className="flex-1 min-w-0 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                              placeholder="LinkedIn URL"
                              value={formData.social.linkedin}
                              onChange={e => setFormData({ ...formData, social: { ...formData.social, linkedin: e.target.value } })}
                           />
                        </div>
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center flex-shrink-0">
                              <Github className="w-4 h-4" />
                           </div>
                           <input
                              type="text"
                              className="flex-1 min-w-0 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-200 outline-none transition-all text-sm"
                              placeholder="GitHub URL"
                              value={formData.social.github}
                              onChange={e => setFormData({ ...formData, social: { ...formData.social, github: e.target.value } })}
                           />
                        </div>
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center flex-shrink-0">
                              <Instagram className="w-4 h-4" />
                           </div>
                           <input
                              type="text"
                              className="flex-1 min-w-0 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-pink-100 outline-none transition-all text-sm"
                              placeholder="Instagram URL"
                              value={formData.social.instagram}
                              onChange={e => setFormData({ ...formData, social: { ...formData.social, instagram: e.target.value } })}
                           />
                        </div>
                     </div>
                  </div>

                  {/* Notificações */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                     <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Bell className="w-5 h-5 text-yellow-500" />
                        Notificações
                     </h3>
                     <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                           Receba alertas sobre tarefas e novidades.
                        </div>
                        <button
                           type="button"
                           onClick={async () => {
                              if (!selectedUserId) return;
                              try {
                                 const token = await requestNotificationPermission(selectedUserId);
                                 if (token) {
                                    setPermissionStatus('granted');
                                    alert('Notificações ativadas com sucesso!');
                                 }
                              } catch (e) {
                                 console.error(e);
                                 alert('Erro ao ativar notificações.');
                              }
                           }}
                           className="px-4 py-2 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200 rounded-lg text-sm font-medium transition-colors"
                        >
                           {permissionStatus === 'granted' ? 'Re-sincronizar' : 'Ativar Notificações'}
                        </button>
                     </div>
                  </div>

               </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-gray-200">
               {successMsg && (
                  <span className="mr-4 text-sm font-medium text-green-600 animate-in fade-in slide-in-from-right-5">{successMsg}</span>
               )}
               <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
               >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Salvar Alterações
               </button>
            </div>
         </form>

         <ChangePasswordModal
            isOpen={isChangePasswordOpen}
            onClose={() => setIsChangePasswordOpen(false)}
         />
      </div>
   );
};

// Helper Icon for form
function Globe(props: any) {
   return (
      <svg
         {...props}
         xmlns="http://www.w3.org/2000/svg"
         width="24"
         height="24"
         viewBox="0 0 24 24"
         fill="none"
         stroke="currentColor"
         strokeWidth="2"
         strokeLinecap="round"
         strokeLinejoin="round"
      >
         <circle cx="12" cy="12" r="10" />
         <line x1="2" x2="22" y1="12" y2="12" />
         <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z" />
      </svg>
   );
}
