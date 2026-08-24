
export interface LayoutProps {
  children: any; // Simplified to avoid React dependency issues in types file
}

export enum ThemeMode {
  LIGHT = 'LIGHT',
  DARK = 'DARK',
}

// --- Database Entities ---

export interface Permission {
  id: number;
  slug: string; // 'admin', 'chair', 'manager', 'member', 'external'
}

export interface Chapter {
  id: number;
  name: string;
  acronym: string;
  description?: string;
  color_theme?: string;
  icon_name?: string;
  cover_image_url?: string;
  calendar_url?: string;
  email?: string;
  is_not_chapter?: boolean;
  keywords?: string[];
  content_url?: string | any;
  members_count: number;
  projects_count: number;
  nome?: string;
  sigla?: string;
  icon?: any;
  links?: any[];
  coverImage?: string;
  cor?: string;
  descricao?: string;
  calendarUrl?: string; // Legacy
}

export interface Profile {
  id: number; // BigInt is returned as number/string in JS usually, but lets use number for ID
  full_name: string;
  email: string;
  role?: string;
  avatar_initials?: string;
  matricula?: string;
  skills?: string[];
  photo_url?: string;
  bio?: string;
  membership_number?: string;
  cover_config?: string;
  social_links?: any;
  ieee_membership_date?: string; // Mês/Ano
  course?: string;
  // Hydrated
  chapters?: Chapter[];
  profileChapters?: ProfileChapter[]; // Join table details

  // Legacy Compatibility
  nome?: string;
  avatar?: string;
  chapterRoles?: Record<number, string>;
  chapterIds?: number[];
  capituloId?: number;
  habilidades?: string[];
  foto?: string;
  nroMembresia?: string;
  coverConfig?: string;
  social?: {
    linkedin?: string;
    github?: string;
    instagram?: string;
  };
}

export interface ProfileChapter {
  id: number;
  profile_id: number;
  chapter_id: number;
  role: string;
  permission_slug: string;
  // Hydrated
  permission?: Permission;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  status: string;
  progress: number;
  start_date?: string;
  end_date?: string;
  is_partnership: boolean;
  tags?: string[];
  checkpoints?: any;
  notes?: string;
  content_url?: any;
  color_theme?: string;
  cover_image?: string;
  // Hydrated
  owners: Profile[];
  team: Profile[];
  chapters: Chapter[];
  // Raw Relationships (Optional, for easy access)
  projectMembers?: ProjectMember[];
  projectChapters?: ProjectChapter[];

  // Legacy Compatibility
  nome?: string;
  descricao?: string;
  progresso?: number;
  dataInicio?: string;
  dataFim?: string;
  parceria?: boolean;
  responsavel?: string;
  ownerIds?: number[];
  teamIds?: number[];
  capituloId?: number[];
  capitulos?: Chapter[];
  capitulo?: string;
  links?: any[];
  cor?: string;
  coverImage?: string;
}

export interface ProjectMember {
  project_id: number;
  profile_id: number;
  is_owner: boolean;
}

export interface ProjectChapter {
  project_id: number;
  chapter_id: number;
}

export interface Task {
  id: number;
  public_id?: string;
  title: string;
  description?: string;
  status: 'todo' | 'doing' | 'review' | 'done' | 'archived';
  priority?: string;
  start_date?: string;
  deadline?: string;
  tags?: string[];
  attachments_count: number;
  content_url?: string;
  project_id: number;
  parent_task_id?: number | null;
  created_at?: string;
  // Hydrated
  project?: Project;
  assignees: Profile[];

  // Legacy Compatibility
  titulo?: string;
  descricao?: string;
  prioridade?: string;
  dataInicio?: string;
  prazo?: string;
  anexos?: number;
  url?: string;
  projetoId?: number;
  parentTaskId?: number | null;
  projeto?: string;
  responsavelId?: number | null;
  responsavelIds?: number[];
  responsavel?: string;
  responsavelFull?: Profile | null;
  capitulo?: string;
  reimbursement_status?: 'not_required' | 'requested_section' | 'requested_external' | 'paid';
}

export interface TaskAssignee {
  task_id: number;
  profile_id: number;
}

export interface Event {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  location?: string;
  description?: string;
  category?: string;
  sub_category?: string;
  event_type?: string;
  host_ous?: string[];
  is_public: boolean;
  vtools_reported: boolean;
  meeting_minutes_url?: string;
  attendees_ieee: number;
  attendees_guests: number;
  attendee_list?: any;
  chapter_id?: number;
  project_id?: number;
  // Hydrated
  chapter?: Chapter;
  project?: Project;

  // Legacy/Hydrated
  startDate?: string;
  endDate?: string;
  subCategory?: string;
  eventType?: string;
  hostOus?: string[];
  isPublic?: boolean;
  vtoolsReported?: boolean;
  meetingMinutesUrl?: string;
  attendeesIEEE?: number;
  attendeesGuests?: number;
  attendeeList?: any[];
  chapterId?: number;
  projectId?: number;
}

export interface Finance {
  id: number;
  type: 'entry' | 'exit';
  description: string;
  amount: number;
  currency: 'BRL' | 'USD';
  date: string;
  invoice_url?: string;
  notes?: string;
  chapter_id?: number;
  project_id?: number;
  created_by?: string;
  created_at?: string;
  reimbursement_status?: 'not_required' | 'requested_section' | 'requested_external' | 'paid';
  // Hydrated
  chapter?: Chapter;
  project?: Project;
  created_by_user?: Profile;
}
