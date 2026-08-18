
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { iconMap } from '../lib/utils';
import { FolderKanban } from 'lucide-react';
import {
  Project, Task, Profile, Chapter, Event, Permission,
  ProfileChapter, ProjectMember, ProjectChapter, TaskAssignee
} from '../types';
import { useAuth } from './AuthContext';

interface DataContextType {
  tasks: Task[];
  projects: Project[];
  users: Profile[];
  chapters: Chapter[];
  events: Event[];
  classifieds: any[];
  chapterGoals: any[];
  tools: any[];
  permissions: Permission[];
  loading: boolean;
  fetchData: (skipLoading?: boolean) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [classifieds, setClassifieds] = useState<any[]>([]);
  const [chapterGoals, setChapterGoals] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const { loading: authLoading, user } = useAuth();

  const fetchData = async (skipLoading = false) => {
    try {
      // Only show global loading if we don't have data yet, or if forced
      const hasData = tasks.length > 0 || projects.length > 0 || users.length > 0;
      if (!skipLoading && !hasData) {
        setLoading(true);
      }

      const [
        capsRes, profsRes, projsRes, tasksRes, eventsRes,
        classifiedsRes, goalsRes, toolsRes, permsRes,
        profCapsRes, projMemsRes, projCapsRes, taskAssignsRes
      ] = await Promise.all([
        supabase.from('chapters').select('*').order('id', { ascending: true }),
        supabase.from('profiles').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('tasks').select('*'),
        supabase.from('events').select('*').order('start_date', { ascending: true }),
        supabase.from('classifieds').select('*').order('created_at', { ascending: false }),
        supabase.from('chapter_goals').select('*'),
        supabase.from('tools').select('*'),
        supabase.from('permissions').select('*'),
        supabase.from('profile_chapters').select('*'),
        supabase.from('project_members').select('*'),
        supabase.from('project_chapters').select('*'),
        supabase.from('task_assignees').select('*')
      ]);

      if (capsRes.error) console.error("Chapters error:", capsRes.error);

      const rawChapters = capsRes.data || [];
      const rawProfiles = profsRes.data || [];
      const rawProjects = projsRes.data || [];
      const rawTasks = tasksRes.data || [];
      const rawPermissions = permsRes.data || [];

      // Relations
      const relProfileChapters = (profCapsRes.data || []) as ProfileChapter[];
      const relProjectMembers = (projMemsRes.data || []) as ProjectMember[];
      const relProjectChapters = (projCapsRes.data || []) as ProjectChapter[];
      const relTaskAssignees = (taskAssignsRes.data || []) as TaskAssignee[];

      // 1. Process Chapters
      const loadedChapters: Chapter[] = rawChapters.map(c => ({
        id: c.id,
        name: c.name,
        acronym: c.acronym,
        description: c.description,
        color_theme: c.color_theme,
        icon_name: c.icon_name,
        // @ts-ignore - iconMap handling handled in component usually, or here just passing reference
        icon: iconMap[c.icon_name] || FolderKanban,
        cover_image_url: c.cover_image_url,
        calendar_url: c.calendar_url,
        email: c.email,
        is_not_chapter: c.is_not_chapter || false,
        keywords: c.keywords || [],
        content_url: c.content_url ? (typeof c.content_url === 'string' ? JSON.parse(c.content_url) : c.content_url) : [],
        members_count: c.members_count,
        projects_count: c.projects_count,
        // Legacy Compatibility
        nome: c.name,
        sigla: c.acronym,
        cor: c.color_theme,
        descricao: c.description
      }));

      // 2. Process Permissions
      const loadedPermissions: Permission[] = rawPermissions;

      // 3. Process Users (Hydrate with permissions and chapters)
      const loadedUsers: Profile[] = rawProfiles.map(u => {
        // Find links in profile_chapters
        const userChapRels = relProfileChapters.filter(pc => pc.profile_id === u.id);
        const userChapters = userChapRels.map(pc => loadedChapters.find(c => c.id === pc.chapter_id)).filter(Boolean) as Chapter[];

        return {
          id: u.id,
          full_name: u.full_name,
          email: u.email,
          role: u.role,
          avatar_initials: u.avatar_initials,
          matricula: u.matricula || 'N/D',
          birth_date: u.birth_date,
          skills: u.skills || [],
          photo_url: u.photo_url,
          bio: u.bio,
          membership_number: u.membership_number,
          cover_config: u.cover_config,
          social_links: u.social_links || { linkedin: '', github: '', instagram: '' },
          // New Fields
          cpf: u.cpf || [], // Ensure array
          phone: u.phone,
          ieee_membership_date: u.ieee_membership_date,
          course: u.course,
          fcm_token: u.fcm_token,
          // Hydrated
          chapters: userChapters,
          profileChapters: userChapRels,
          // Legacy Compatibility Fields (mapped to new structure)
          nome: u.full_name,
          avatar: u.avatar_initials,
          chapterRoles: userChapRels.reduce((acc: any, curr) => ({ ...acc, [curr.chapter_id]: curr.role }), {}),
          chapterIds: userChapters.map(c => c.id),
          capituloId: userChapters.length > 0 ? userChapters[0].id : null,
          dataNascimento: u.birth_date,
          habilidades: u.skills || [],
          foto: u.photo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.full_name)}&backgroundColor=00a3ef`,
          nroMembresia: u.membership_number,
          coverConfig: u.cover_config,
          social: u.social_links || { linkedin: '', github: '', instagram: '' }
        };
      });

      // 4. Process Projects
      const loadedProjects: Project[] = rawProjects.map(p => {
        // Relations
        const loopsMembers = relProjectMembers.filter(pm => pm.project_id === p.id);
        const loopsChapters = relProjectChapters.filter(pc => pc.project_id === p.id);

        const projectChapters = loopsChapters.map(pc => loadedChapters.find(c => c.id === pc.chapter_id)).filter(Boolean) as Chapter[];

        const ownersRel = loopsMembers.filter(m => m.is_owner);
        const teamRel = loopsMembers.filter(m => !m.is_owner);

        const owners = ownersRel.map(r => loadedUsers.find(u => u.id === r.profile_id)).filter(Boolean) as Profile[];
        const team = teamRel.map(r => loadedUsers.find(u => u.id === r.profile_id)).filter(Boolean) as Profile[];

        // Merge owners and team for legacy 'team' view potentially, or keep distinct
        // Current interface has owners and team distinct

        const ownerNames = owners.map(u => u.full_name).join(' & ');

        return {
          id: p.id,
          public_id: p.public_id,
          name: p.name,
          description: p.description,
          status: p.status,
          progress: p.progress,
          start_date: p.start_date,
          end_date: p.end_date,
          is_partnership: p.is_partnership,
          tags: p.tags || [],
          checkpoints: p.checkpoints || [],
          notes: p.notes,
          content_url: p.content_url ? (typeof p.content_url === 'string' ? JSON.parse(p.content_url) : p.content_url) : [],
          color_theme: p.color_theme,
          cover_image: p.cover_image,

          // Hydrated
          owners,
          team,
          chapters: projectChapters,
          projectMembers: loopsMembers,
          projectChapters: loopsChapters,

          // Legacy Compatibility
          nome: p.name,
          descricao: p.description,
          progresso: p.progress,
          dataInicio: p.start_date,
          dataFim: p.end_date,
          parceria: p.is_partnership,
          responsavel: ownerNames || 'N/D',
          ownerIds: owners.map(o => o.id),
          teamIds: team.map(t => t.id),
          capituloId: projectChapters.map(c => c.id),
          capitulos: projectChapters,
          capitulo: projectChapters.map(c => c.acronym).join(', '),
          links: p.content_url ? (typeof p.content_url === 'string' ? JSON.parse(p.content_url) : p.content_url) : [],
          cor: p.color_theme,
          coverImage: p.cover_image
        };
      });

      // 5. Process Tasks
      const loadedTasks: Task[] = rawTasks.map(t => {
        const proj = loadedProjects.find(p => p.id === t.project_id);

        const taskAssigns = relTaskAssignees.filter(ta => ta.task_id === t.id);
        const assignees = taskAssigns.map(ta => loadedUsers.find(u => u.id === ta.profile_id)).filter(Boolean) as Profile[];
        const firstAssignee = assignees[0];

        return {
          id: t.id,
          public_id: t.public_id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          start_date: t.start_date,
          deadline: t.deadline,
          tags: t.tags || [],
          attachments_count: t.attachments_count,
          content_url: t.content_url,
          project_id: t.project_id,
          parent_task_id: t.parent_task_id,
          created_at: t.created_at,

          // Hydrated
          project: proj,
          assignees: assignees,

          // Legacy Compatibility
          titulo: t.title,
          descricao: t.description,
          prioridade: t.priority,
          dataInicio: t.start_date,
          prazo: t.deadline,
          anexos: t.attachments_count,
          url: t.content_url,
          projetoId: t.project_id,
          parentTaskId: t.parent_task_id,
          projeto: proj ? proj.name : 'Desconhecido',
          responsavelId: firstAssignee ? firstAssignee.id : null,
          responsavelIds: assignees.map(a => a.id),
          responsavel: firstAssignee ? firstAssignee.full_name.split(' ')[0] : 'N/A',
          responsavelFull: firstAssignee || null,
          capitulo: proj ? (proj as any).capitulo : 'N/A', // Accessing legacy prop
          reimbursement_status: t.reimbursement_status // Map new field
        };
      });

      // 6. Process Events
      const loadedEvents = (eventsRes.data || []).map(e => ({
        ...e,
        startDate: e.start_date,
        endDate: e.end_date,
        subCategory: e.sub_category,
        eventType: e.event_type || 'Virtual',
        hostOus: e.host_ous || [],
        isPublic: e.is_public,
        vtoolsReported: e.vtools_reported,
        meetingMinutesUrl: e.meeting_minutes_url,
        attendeesIEEE: e.attendees_ieee,
        attendeesGuests: e.attendees_guests,
        attendeeList: e.attendee_list || [],
        chapterId: e.chapter_id,
        projectId: e.project_id,
        chapter: loadedChapters.find((c) => c.id === e.chapter_id),
        project: loadedProjects.find((p) => p.id === e.project_id)
      }));

      // 7. Others
      // 7. Others - Classifieds with Relations
      const loadedClassifieds = (classifiedsRes.data || []).map((c: any) => {
        const responsibleProfile = loadedUsers.find(u => u.id === c.responsible_id);
        const linkedTask = loadedTasks.find(t => t.id === c.task_id);
        const linkedChapters = (c.chapter_ids || []).map((cid: number) =>
          loadedChapters.find(ch => ch.id === cid)
        ).filter(Boolean);

        return {
          id: c.id,
          type: c.type,
          title: c.title,
          description: c.description,
          imageUrl: c.image_url,
          createdAt: c.created_at,
          taskId: c.task_id,
          chapterIds: c.chapter_ids || [],
          responsible_id: c.responsible_id,
          offers_text: c.offers_text, // Map Offers History

          // Hydrated
          responsible: responsibleProfile ? responsibleProfile.full_name : 'Anônimo',
          responsibleProfile: responsibleProfile,
          task: linkedTask,
          chapters: linkedChapters
        };
      });

      setClassifieds(loadedClassifieds);
      setChapterGoals(goalsRes.data || []);
      setTools(toolsRes.data || []);

      setChapters(loadedChapters);
      setUsers(loadedUsers);
      setProjects(loadedProjects);
      setTasks(loadedTasks);
      setEvents(loadedEvents);
      setPermissions(loadedPermissions);

    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    } finally {
      // Always turn off loading at end
      if (!skipLoading) setLoading(false);
    }
  };



  useEffect(() => {
    if (!authLoading) {
      fetchData();
    }
  }, [authLoading, user?.id]);

  return (
    <DataContext.Provider value={{
      tasks, projects, users, chapters, events, classifieds,
      chapterGoals, tools, permissions, loading, fetchData
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
