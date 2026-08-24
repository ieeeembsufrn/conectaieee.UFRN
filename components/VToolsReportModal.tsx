
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Calendar, MapPin, AlignLeft, Layers, Tag, Globe, Loader2, Send, Link, Users, ChevronDown, ChevronUp, Trash2, UserPlus, Search, Video, Building2, Check, AlertTriangle, Save, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useData } from '../context/DataContext';
import { ConfirmationModal } from './ConfirmationModal';

interface VToolsReportModalProps {
   isOpen: boolean;
   onClose: () => void;
   eventToReport: any;
}

interface Attendee {
   id?: number; // DB ID if existing user
   name: string;
   type: 'member' | 'guest';
}

const EVENT_CATEGORIES: Record<string, string[]> = {
   'Administrativo (Administrative)': ['Reunião da Diretoria (ExCom)', 'Treinamento de Equipe (Officer Training)'],
   'Humanitário (Humanitarian)': ['Outros (Other)', 'SIGHT'],
   'Não Técnico (Nontechnical)': ['Jantar de Premiação (Awards Dinner)', 'Não Técnico - Outros (Nontechnical - Other)', 'Atividades Pré-Universitárias (Pre-University Activities)', 'Social (Social)'],
   'Programa STEM Pré-Universitário (Pre-U STEM Program)': ['Acampamento (Camp)', 'Dia de Carreira (Career Day)', 'Competições/Feiras STEM (Competition/STEM Fairs)', 'Meninas em STEM (Girls in STEM)', 'Visita Técnica/Indústria (Industry/Company Tour)', 'Mentoria (Mentoring)', 'Programa para Pais (Parent Program)', 'Workshop para Alunos (Student Workshop)', 'Workshop para Professores (Teacher Workshop)'],
   'Profissional (Professional)': ['Educação Continuada (Continuing Education)', 'Relações com a Indústria (Industry Relations)', 'Profissional - Outros (Professional - Other)', 'Desenvolvimento Profissional (Professional Development)'],
   'Técnico (Technical)': ['N/A']
};

const HOST_OUS = [
	   'SBC03101A - Universidade Federal do Rio de Janeiro,RA24',
	   'SBC66301A - Universidade Federal do Rio Grande do Norte,C16',
	   'SBC66301D - Universidade Federal do Rio Grande do Norte,EMB18',
	   'SBC66301E - Universidade Federal do Rio Grande do Norte,IE13',
	   'SBC66301 - Universidade Federal do Rio Grande do Norte,PE31',
	   'SBC66301C - Universidade Federal do Rio Grande do Norte,RA24',
	   'STB66301 - Universidade Federal do Rio Grande do Norte'
];

// Mapeamento Sigla do Capítulo -> Host OU
const CHAPTER_OU_MAP: Record<string, string> = {
	   'CS': 'SBC66301A - Universidade Federal do Rio Grande do Norte,C16',
	   'EMBS': 'SBC66301D - Universidade Federal do Rio Grande do Norte,EMB18',
	   'IES': 'SBC66301E - Universidade Federal do Rio Grande do Norte,IE13',
	   'PES': 'SBC66301 - Universidade Federal do Rio Grande do Norte,PE31',
	   'RAS': 'SBC66301C - Universidade Federal do Rio Grande do Norte,RA24',
	   'Ramo': 'STB66301 - Universidade Federal do Rio Grande do Norte'
};

export const VToolsReportModal = ({ isOpen, onClose, eventToReport }: VToolsReportModalProps) => {
   const { fetchData, users, tasks, projects, chapters } = useData();
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [isSavingDraft, setIsSavingDraft] = useState(false);

   // Validation State
   const [validationError, setValidationError] = useState<{ title: string, message: string } | null>(null);

   // Attendee Manager State
   const [isAttendeeSectionOpen, setIsAttendeeSectionOpen] = useState(false);
   const [attendees, setAttendees] = useState<Attendee[]>([]);
   const [searchQuery, setSearchQuery] = useState('');
   const [showSuggestions, setShowSuggestions] = useState(false);
   const searchRef = useRef<HTMLDivElement>(null);

   // Host OU State
   const [showOuDropdown, setShowOuDropdown] = useState(false);
   const ouDropdownRef = useRef<HTMLDivElement>(null);

   const [formData, setFormData] = useState({
      title: '',
      startDate: '',
      endDate: '',
      location: '',
      description: '',
      category: '',
      subCategory: '',
      eventType: 'Virtual', // Default to Virtual
      hostOu: [] as string[],
      isPublic: false,
      minutesUrl: '',
      attendeesIEEE: 0,
      attendeesGuests: 0
   });

   const toDateTimeString = (isoString: string) => {
      if (!isoString) return '';
      const date = new Date(isoString);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
   };

   // Logic to load Project Members (Updated for Team & Owners)
   const loadProjectMembers = () => {
      if (!eventToReport?.projectId) return;

      // 1. Find the full project object
      const fullProject = projects.find((p: any) => p.id === Number(eventToReport.projectId));
      if (!fullProject) return;

      const uniqueMap = new Map<number, Attendee>();

      // 2. Add Owners (Gerentes)
      if (fullProject.owners) {
         fullProject.owners.forEach((u: any) => {
            uniqueMap.set(u.id, { id: u.id, name: u.nome, type: 'member' });
         });
      }

      // 3. Add Team Members (Equipe)
      if (fullProject.team) {
         fullProject.team.forEach((u: any) => {
            uniqueMap.set(u.id, { id: u.id, name: u.nome, type: 'member' });
         });
      }

      // 4. Fallback: Add Task Assignees (find unique users assigned to tasks in this project)
      tasks.forEach((t: any) => {
         if (t.projetoId === eventToReport.projectId && t.responsavelIds) {
            t.responsavelIds.forEach((uid: number) => {
               const user = users.find((u: any) => u.id === uid);
               if (user) {
                  uniqueMap.set(user.id, { id: user.id, name: user.nome, type: 'member' });
               }
            });
         }
      });

      setAttendees(prev => {
         const existingIds = new Set(prev.map(a => a.id).filter(Boolean));
         const newMembers = Array.from(uniqueMap.values()).filter(m => !existingIds.has(m.id!));
         return [...prev, ...newMembers];
      });
   };

   const loadChapterMembers = () => {
      if (!eventToReport?.chapterId) return;

      const chapterMembers = users
         .filter((u: any) => u.chapterIds && u.chapterIds.includes(eventToReport.chapterId))
         .map((u: any) => ({ id: u.id, name: u.nome, type: 'member' as const }));

      setAttendees(prev => {
         const existingIds = new Set(prev.map(a => a.id).filter(Boolean));
         const newMembers = chapterMembers.filter(m => !existingIds.has(m.id));
         return [...prev, ...newMembers];
      });
   };

   // Click Outside
   useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
         if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
            setShowSuggestions(false);
         }
         if (ouDropdownRef.current && !ouDropdownRef.current.contains(event.target as Node)) {
            setShowOuDropdown(false);
         }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
   }, []);

   // Initialization
   useEffect(() => {
      if (isOpen && eventToReport) {

         // --- HOST OU AUTO-SELECTION LOGIC ---
         let initialHostOus = eventToReport.hostOus || [];

         // Se a lista estiver vazia, tenta preencher automaticamente pelo capítulo
         if (initialHostOus.length === 0 && eventToReport.chapterId) {
            const currentChapter = chapters.find((c: any) => c.id === Number(eventToReport.chapterId));
            if (currentChapter) {
               // Tenta encontrar pelo Acrônimo (Sigla)
               const defaultOU = CHAPTER_OU_MAP[currentChapter.sigla];
               if (defaultOU) {
                  initialHostOus = [defaultOU];
               } else {
                  // Fallback para Ramo (STB) se for o capítulo geral do Ramo
                  if (currentChapter.sigla === 'Ramo' || currentChapter.nome.includes('Ramo')) {
	                     initialHostOus = ['STB66301 - Universidade Federal do Rio Grande do Norte'];
                  }
               }
            }
         }

         // Load basic data
         setFormData({
            title: eventToReport.title,
            startDate: toDateTimeString(eventToReport.startDate),
            endDate: toDateTimeString(eventToReport.endDate),
            location: eventToReport.location || '',
            description: eventToReport.description || '',
            category: eventToReport.category || 'Administrativo (Administrative)',
            subCategory: eventToReport.subCategory || 'Reunião da Diretoria (ExCom)',
            eventType: eventToReport.vtoolsReported ? (eventToReport.eventType || 'Virtual') : 'Virtual', // Use event value if reported, else default to Virtual
            hostOu: initialHostOus,
            isPublic: eventToReport.isPublic || false,
            minutesUrl: eventToReport.meetingMinutesUrl || '',
            attendeesIEEE: eventToReport.attendeesIEEE || 0,
            attendeesGuests: eventToReport.attendeesGuests || 0
         });

         // Load Attendees List logic
         if (eventToReport.attendeeList && eventToReport.attendeeList.length > 0) {
            // If exists in DB, load it
            setAttendees(eventToReport.attendeeList);
         } else if (!eventToReport.vtoolsReported) {
            // New report: Auto-load suggestions
            if (eventToReport.projectId) {
               // Load project members automatically
               setAttendees([]); // Clear first
               setTimeout(loadProjectMembers, 0); // Defer slightly
            } else {
               setAttendees([]);
            }
         } else {
            setAttendees([]);
         }

         // Minimize by default
         setIsAttendeeSectionOpen(false);
         setValidationError(null);
      }
   }, [isOpen, eventToReport, chapters]);

   // Sync Counts with List
   useEffect(() => {
      const ieeeCount = attendees.filter(a => a.type === 'member').length;
      const guestCount = attendees.filter(a => a.type === 'guest').length;

      setFormData(prev => ({
         ...prev,
         attendeesIEEE: ieeeCount,
         attendeesGuests: guestCount
      }));
   }, [attendees]);

   // Search Filtering
   const filteredSuggestions = useMemo(() => {
      if (!searchQuery) return [];
      const lowerQuery = searchQuery.toLowerCase();

      // Filter users NOT already in the list
      const availableUsers = users.filter((u: any) => !attendees.some(a => a.id === u.id));

      return availableUsers.filter((u: any) =>
         u.nome.toLowerCase().includes(lowerQuery) ||
         u.email.toLowerCase().includes(lowerQuery)
      ).slice(0, 5); // Limit suggestions
   }, [users, searchQuery, attendees]);

   if (!isOpen || !eventToReport) return null;

   const handleAddMember = (user: any) => {
      setAttendees(prev => [...prev, { id: user.id, name: user.nome, type: 'member' }]);
      setSearchQuery('');
      setShowSuggestions(false);
   };

   const handleAddGuest = () => {
      if (!searchQuery.trim()) return;
      setAttendees(prev => [...prev, { name: searchQuery.trim(), type: 'guest' }]);
      setSearchQuery('');
      setShowSuggestions(false);
   };

   const handleRemoveAttendee = (index: number) => {
      setAttendees(prev => prev.filter((_, i) => i !== index));
   };

   const toggleHostOu = (ou: string) => {
      setFormData(prev => {
         const exists = prev.hostOu.includes(ou);
         if (exists) return { ...prev, hostOu: prev.hostOu.filter(o => o !== ou) };
         return { ...prev, hostOu: [...prev.hostOu, ou] };
      });
   };

   const getPayload = (isReported: boolean) => {
      return {
         title: formData.title,
         start_date: new Date(formData.startDate).toISOString(),
         end_date: new Date(formData.endDate).toISOString(),
         location: formData.location,
         description: formData.description,
         category: formData.category,
         sub_category: formData.subCategory,
         event_type: formData.eventType,
         host_ous: formData.hostOu,
         is_public: formData.isPublic,
         vtools_reported: isReported, // TRUE for confirm, FALSE for draft
         meeting_minutes_url: formData.minutesUrl,
         attendees_ieee: Number(formData.attendeesIEEE),
         attendees_guests: Number(formData.attendeesGuests),
         attendee_list: attendees // Save the JSON array
      };
   };

   const handleDraft = async () => {
      setIsSavingDraft(true);
      try {
         const payload = getPayload(false); // Keep reported false
         const { error } = await supabase
            .from('events')
            .update(payload)
            .eq('id', eventToReport.id);

         if (error) throw error;

         await fetchData(true);
         onClose();
      } catch (e) {
         console.error("Erro ao salvar rascunho:", e);
         alert("Erro ao salvar rascunho.");
      } finally {
         setIsSavingDraft(false);
      }
   };

   const handleMinutierGenerate = async () => {
      // 1. Save Draft (Same as handleDraft but without closing)
      setIsSavingDraft(true);
      try {
         const payload = getPayload(false);
         const { error } = await supabase
            .from('events')
            .update(payload)
            .eq('id', eventToReport.id);

         if (error) throw error;
         await fetchData(true);

         // 2. Encode and Redirect
         const dataToEncode = {
            ...formData,
            attendeeList: attendees,
            eventId: eventToReport.id,
            chapter: chapters.find((c: any) => c.id === eventToReport.chapterId)?.nome,
            project: projects.find((p: any) => p.id === eventToReport.projectId)?.nome
         };

         // Base64 encoding that handles UTF-8 correctly
         const jsonStr = JSON.stringify(dataToEncode);
         const base64 = btoa(unescape(encodeURIComponent(jsonStr)));

         window.open(`https://minutier.conectaieee.com?data=${base64}`, '_blank');

      } catch (e) {
         console.error("Erro ao preparar Minutier:", e);
         alert("Erro ao salvar dados antes de abrir o Minutier.");
      } finally {
         setIsSavingDraft(false);
      }
   };

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      // --- VALIDATIONS ---
      if (!formData.minutesUrl || !formData.minutesUrl.trim()) {
         setValidationError({
            title: 'Campo Obrigatório',
            message: 'O link da Ata (Meeting Minutes) é obrigatório para confirmar o reporte.'
         });
         return;
      }

      if (formData.hostOu.length === 0) {
         setValidationError({
            title: 'Campo Obrigatório',
            message: 'Selecione pelo menos uma Host Organizational Unit.'
         });
         return;
      }

      setIsSubmitting(true);

      try {
         const payload = getPayload(true); // MARK AS REPORTED
         const { error } = await supabase
            .from('events')
            .update(payload)
            .eq('id', eventToReport.id);

         if (error) throw error;

         await fetchData(true);
         onClose();
      } catch (e) {
         console.error("Erro ao reportar evento:", e);
         alert("Erro ao reportar evento.");
      } finally {
         setIsSubmitting(false);
      }
   };

   const handleCategoryChange = (newCategory: string) => {
      const subCategories = EVENT_CATEGORIES[newCategory] || [];
      let newSub = '';
      if (subCategories.length === 1 && subCategories[0] === 'N/A') {
         newSub = 'N/A';
      } else if (subCategories.length > 0) {
         newSub = subCategories[0];
      }
      setFormData(prev => ({
         ...prev,
         category: newCategory,
         subCategory: newSub
      }));
   };

   return (
      <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">

         {/* Validation Modal */}
         <ConfirmationModal
            isOpen={!!validationError}
            onClose={() => setValidationError(null)}
            title={validationError?.title || ''}
            message={validationError?.message || ''}
            type="warning"
            showConfirmButton={false}
            cancelLabel="Entendi"
         />

         <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-100 flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-red-50">
               <h2 className="text-xl font-bold text-red-700 flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  Reportar ao vTools
               </h2>
               <button onClick={onClose} className="p-2 text-gray-400 hover:bg-red-100 hover:text-red-600 rounded-full transition-colors">
                  <X className="w-5 h-5" />
               </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">

               <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-xs text-yellow-800 mb-2">
                  <strong>Atenção:</strong> Verifique as informações abaixo antes de confirmar o reporte. Esta ação marcará o evento como enviado na base de dados.
               </div>

               <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Título do Evento</label>
                  <input
                     required
                     type="text"
                     value={formData.title}
                     onChange={e => setFormData({ ...formData, title: e.target.value })}
                     className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-100 outline-none"
                  />
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="md:col-span-2 text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 border-b border-gray-200 pb-1">
                     Classificação vTools
                  </div>

                  <div>
                     <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                        <Layers className="w-3 h-3" /> Categoria
                     </label>
                     <select
                        required
                        value={formData.category}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-100 outline-none text-xs"
                     >
                        {Object.keys(EVENT_CATEGORIES).map(cat => (
                           <option key={cat} value={cat}>{cat}</option>
                        ))}
                     </select>
                  </div>

                  <div>
                     <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                        <Tag className="w-3 h-3" /> Sub-Categoria
                     </label>
                     <select
                        required
                        value={formData.subCategory}
                        onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-100 outline-none text-xs"
                     >
                        {EVENT_CATEGORIES[formData.category]?.map(sub => (
                           <option key={sub} value={sub}>{sub}</option>
                        ))}
                     </select>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="block text-sm font-semibold text-gray-700 mb-1">Início</label>
                     <input
                        required
                        type="datetime-local"
                        value={formData.startDate}
                        onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-100 outline-none text-sm"
                     />
                  </div>
                  <div>
                     <label className="block text-sm font-semibold text-gray-700 mb-1">Fim</label>
                     <input
                        required
                        type="datetime-local"
                        value={formData.endDate}
                        onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-100 outline-none text-sm"
                     />
                  </div>
               </div>

               {/* Event Type Toggle - ORDER SWAPPED */}
               <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Evento</label>
                  <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 w-full">
                     <button
                        type="button"
                        onClick={() => setFormData({ ...formData, eventType: 'Virtual' })}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${formData.eventType === 'Virtual' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                     >
                        <Video className="w-4 h-4" /> Virtual
                     </button>
                     <button
                        type="button"
                        onClick={() => setFormData({ ...formData, eventType: 'InPerson' })}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${formData.eventType === 'InPerson' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                     >
                        <MapPin className="w-4 h-4" /> Presencial
                     </button>
                  </div>
               </div>

               <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                     <MapPin className="w-3.5 h-3.5" /> Local
                  </label>
                  <input
                     required
                     type="text"
                     value={formData.location}
                     onChange={e => setFormData({ ...formData, location: e.target.value })}
                     className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-100 outline-none"
                  />
               </div>

               <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                     <AlignLeft className="w-3.5 h-3.5" /> Descrição
                  </label>
                  <textarea
                     rows={3}
                     value={formData.description}
                     onChange={e => setFormData({ ...formData, description: e.target.value })}
                     className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-100 outline-none resize-none"
                  />
               </div>

               {/* Host OU Selection */}
               <div className="relative" ref={ouDropdownRef}>
                  <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                     <Building2 className="w-3.5 h-3.5" /> Host Organizational Unit <span className="text-red-500">*</span>
                  </label>
                  <div
                     className="w-full min-h-[42px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer flex flex-wrap gap-1 items-center"
                     onClick={() => setShowOuDropdown(!showOuDropdown)}
                  >
                     {formData.hostOu.length === 0 && <span className="text-gray-400 text-sm">Selecione as OUs...</span>}
                     {formData.hostOu.map(ou => (
                        <span key={ou} className="bg-white border border-gray-300 text-gray-700 text-xs px-2 py-1 rounded flex items-center gap-1 shadow-sm">
                           {ou.split('-')[0].trim()}
                           <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleHostOu(ou); }}
                              className="hover:text-red-500"
                           >
                              <X className="w-3 h-3" />
                           </button>
                        </span>
                     ))}
                     <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
                  </div>

                  {showOuDropdown && (
                     <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                        {HOST_OUS.map(ou => {
                           const isSelected = formData.hostOu.includes(ou);
                           return (
                              <div
                                 key={ou}
                                 className={`px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2 text-xs ${isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                 onClick={() => toggleHostOu(ou)}
                              >
                                 <div className={`w-4 h-4 border rounded flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                 </div>
                                 {ou}
                              </div>
                           );
                        })}
                     </div>
                  )}
               </div>

               {/* --- ATTENDEE MANAGER SECTION --- */}
               <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div
                     className="bg-gray-50 p-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                     onClick={() => setIsAttendeeSectionOpen(!isAttendeeSectionOpen)}
                  >
                     <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-bold text-gray-700">Lista de Presença</span>
                        <span className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-500">
                           {attendees.length} pessoas
                        </span>
                     </div>
                     {isAttendeeSectionOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>

                  {isAttendeeSectionOpen && (
                     <div className="p-4 bg-white space-y-4 animate-in slide-in-from-top-2 duration-200">
                        {/* Search Bar */}
                        <div className="relative" ref={searchRef}>
                           <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                 type="text"
                                 className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                                 placeholder="Buscar membro ou adicionar convidado..."
                                 value={searchQuery}
                                 onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                                 onFocus={() => setShowSuggestions(true)}
                              />
                           </div>

                           {/* Suggestions Dropdown */}
                           {showSuggestions && searchQuery && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                                 {filteredSuggestions.length > 0 ? (
                                    filteredSuggestions.map((u: any) => (
                                       <div
                                          key={u.id}
                                          className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700 flex items-center justify-between"
                                          onClick={() => handleAddMember(u)}
                                       >
                                          <span>{u.nome}</span>
                                          <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Membro</span>
                                       </div>
                                    ))
                                 ) : (
                                    <div
                                       className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700 flex items-center gap-2"
                                       onClick={handleAddGuest}
                                    >
                                       <UserPlus className="w-4 h-4 text-orange-500" />
                                       <span>Adicionar "{searchQuery}" como Convidado</span>
                                    </div>
                                 )}
                              </div>
                           )}
                        </div>

                        {/* Add All Button (Only for Chapter Events without Project) */}
                        {!eventToReport.projectId && attendees.length === 0 && (
                           <button
                              type="button"
                              onClick={loadChapterMembers}
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                           >
                              <UserPlus className="w-3 h-3" /> Adicionar todos os membros do Capítulo
                           </button>
                        )}

                        {/* Badges List */}
                        <div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-gray-50 rounded-lg border border-gray-100">
                           {attendees.length === 0 && <span className="text-xs text-gray-400 italic mx-auto self-center">Nenhum participante adicionado.</span>}

                           {attendees.map((att, idx) => (
                              <span
                                 key={idx}
                                 className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${att.type === 'member'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-orange-50 text-orange-700 border-orange-200'
                                    }`}
                              >
                                 {att.name}
                                 <button type="button" onClick={() => handleRemoveAttendee(idx)} className="hover:text-red-500 ml-1">
                                    <X className="w-3 h-3" />
                                 </button>
                              </span>
                           ))}
                        </div>

                        {/* Clear List */}
                        {attendees.length > 0 && (
                           <div className="flex justify-end">
                              <button
                                 type="button"
                                 onClick={() => setAttendees([])}
                                 className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors"
                              >
                                 <Trash2 className="w-3 h-3" /> Limpar Lista
                              </button>
                           </div>
                        )}
                     </div>
                  )}
               </div>

               {/* Counts (Read-Only/Editable but synced) */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                     <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> IEEE Attendees
                     </label>
                     <input
                        type="number"
                        min="0"
                        value={formData.attendeesIEEE}
                        onChange={e => setFormData({ ...formData, attendeesIEEE: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-100 outline-none"
                     />
                  </div>
                  <div>
                     <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-gray-400" /> Guest Attendees
                     </label>
                     <input
                        type="number"
                        min="0"
                        value={formData.attendeesGuests}
                        onChange={e => setFormData({ ...formData, attendeesGuests: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-100 outline-none"
                     />
                  </div>
               </div>

               <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                     <Link className="w-3.5 h-3.5" /> Link da Ata (Meeting Minutes) <span className="text-red-500">*</span>
                  </label>
                  <input
                     type="url"
                     value={formData.minutesUrl}
                     onChange={e => setFormData({ ...formData, minutesUrl: e.target.value })}
                     className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-100 outline-none"
                     placeholder="https://docs.google.com/..."
                  />
                  <button
                     type="button"
                     onClick={handleMinutierGenerate}
                     disabled={isSavingDraft || isSubmitting}
                     className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl border border-blue-100 font-bold text-xs transition-all shadow-sm"
                  >
                     {isSavingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                     Gerar ata com Minutier
                  </button>
               </div>

               {/* Read Only Visibility Display */}
               <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-600">
                  <Globe className={`w-4 h-4 ${formData.isPublic ? 'text-blue-500' : 'text-gray-400'}`} />
                  <span>Visibilidade: <strong>{formData.isPublic ? 'Pública' : 'Privada'}</strong></span>
               </div>

               <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                     type="button"
                     onClick={onClose}
                     className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-xl text-sm font-medium transition-colors"
                  >
                     Cancelar
                  </button>

                  {/* Draft Button */}
                  <button
                     type="button"
                     onClick={handleDraft}
                     disabled={isSavingDraft || isSubmitting}
                     className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                  >
                     {isSavingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                     Salvar Rascunho
                  </button>

                  {/* Confirm Button */}
                  <button
                     type="submit"
                     disabled={isSubmitting || isSavingDraft}
                     className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-500/20 flex items-center gap-2"
                  >
                     {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                     Confirmar Report
                  </button>
               </div>
            </form>
         </div>
      </div>
   );
};
