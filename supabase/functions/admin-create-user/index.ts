import { createClient } from '@supabase/supabase-js';

type PermissionSlug = 'admin' | 'chair' | 'manager' | 'member' | 'external';

interface ChapterAssignment {
  id: number | string;
  role?: string;
  permission_slug?: PermissionSlug;
}

interface CreateUserPayload {
  email?: string;
  full_name?: string;
  role?: string;
  avatar_initials?: string;
  phone?: string;
  matricula?: string;
  birth_date?: string | null;
  membership_number?: string | null;
  social_links?: Record<string, string | null>;
  course?: string;
  skills?: string[];
  photo_url?: string;
  ieee_membership_date?: string | null;
  notes?: string | null;
  cpf?: string[];
  bio?: string;
  cover_config?: string;
  chapters?: ChapterAssignment[];
  redirect_to?: string;
}

const jsonHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
});

const jsonResponse = (body: unknown, status = 200, origin: string | null = null) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders(origin)
  });
};

const getInitials = (name: string) => {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

const normalizeAppUrl = (url: string) => url.replace(/\/+$/, '');

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getSupabaseSecretKey = () => {
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys);
      if (typeof parsed?.default === 'string') return parsed.default;
    } catch (_error) {
      return null;
    }
  }

  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
};

const getSupabasePublishableKey = () => {
  const publishableKeys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (publishableKeys) {
    try {
      const parsed = JSON.parse(publishableKeys);
      if (typeof parsed?.default === 'string') return parsed.default;
    } catch (_error) {
      return null;
    }
  }

  return Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: jsonHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = getSupabaseSecretKey();
  const publishableKey = getSupabasePublishableKey();

  if (!supabaseUrl || !serviceRoleKey || !publishableKey) {
    return jsonResponse({ error: 'Missing Supabase default environment variables' }, 500, origin);
  }

  const authorization = req.headers.get('authorization');
  const token = authorization?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return jsonResponse({ error: 'Missing authorization token' }, 401, origin);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const supabaseAuth = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { data: callerData, error: callerError } = await supabaseAuth.auth.getUser(token);

  if (callerError || !callerData.user) {
    return jsonResponse({ error: 'Invalid authorization token' }, 401, origin);
  }

  const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('auth_id', callerData.user.id)
    .single();

  if (callerProfileError || !callerProfile) {
    return jsonResponse({ error: 'Caller profile not found' }, 403, origin);
  }

  const { data: adminPermission, error: adminPermissionError } = await supabaseAdmin
    .from('profile_chapters')
    .select('id')
    .eq('profile_id', callerProfile.id)
    .eq('chapter_id', 1)
    .eq('permission_slug', 'admin')
    .maybeSingle();

  if (adminPermissionError || !adminPermission) {
    return jsonResponse({ error: 'Only global admins can create users' }, 403, origin);
  }

  let payload: CreateUserPayload;
  try {
    payload = await req.json();
  } catch (_error) {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400, origin);
  }

  const email = payload.email?.trim().toLowerCase();
  const fullName = payload.full_name?.trim();

  if (!email || !fullName) {
    return jsonResponse({ error: 'email and full_name are required' }, 400, origin);
  }

  const chapters = (payload.chapters || [])
    .map((chapter) => ({
      id: Number(chapter.id),
      role: chapter.role?.trim() || 'Membro',
      permission_slug: chapter.permission_slug || 'member'
    }))
    .filter((chapter) => Number.isFinite(chapter.id));

  if (chapters.length === 0) {
    return jsonResponse({ error: 'At least one chapter assignment is required' }, 400, origin);
  }

  const invalidPermission = chapters.find((chapter) =>
    !['admin', 'chair', 'manager', 'member', 'external'].includes(chapter.permission_slug)
  );

  if (invalidPermission) {
    return jsonResponse({ error: `Invalid permission_slug: ${invalidPermission.permission_slug}` }, 400, origin);
  }

  const appUrl = normalizeAppUrl(
    Deno.env.get('APP_URL') ||
    origin ||
    'http://127.0.0.1:3000'
  );

  const redirectTo = payload.redirect_to || appUrl;

  const userMetadata = {
    full_name: fullName,
    role: payload.role || 'Membro',
    avatar_initials: payload.avatar_initials || getInitials(fullName),
    phone: payload.phone || null,
    matricula: payload.matricula || null,
    birth_date: payload.birth_date || null,
    membership_number: payload.membership_number || null,
    social_links: payload.social_links || {},
    course: payload.course || null,
    skills: Array.isArray(payload.skills) ? payload.skills : [],
    photo_url: payload.photo_url ||
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}&backgroundColor=00a3ef`,
    ieee_membership_date: payload.ieee_membership_date || null,
    notes: payload.notes || null,
    cpf: Array.isArray(payload.cpf) ? payload.cpf : [],
    bio: payload.bio || null,
    cover_config: payload.cover_config || 'from-sky-500 to-slate-700',
    chapters: chapters.map((chapter) => ({
      id: String(chapter.id),
      role: chapter.role
    }))
  };

  const findAuthUserByEmail = async (targetEmail: string) => {
    const normalizedTarget = targetEmail.toLowerCase();

    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 100
      });

      if (error) throw error;

      const user = data.users.find((authUser) => authUser.email?.toLowerCase() === normalizedTarget);
      if (user) return user;

      if (data.lastPage && page >= data.lastPage) break;
      if (!data.users.length) break;
    }

    return null;
  };

  const findProfileByAuthId = async (authId: string) => {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, auth_id, email, full_name')
      .eq('auth_id', authId)
      .maybeSingle();

    if (error) throw error;
    return data;
  };

  const findProfileByEmail = async (targetEmail: string) => {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, auth_id, email, full_name')
      .ilike('email', targetEmail)
      .maybeSingle();

    if (error) throw error;
    return data;
  };

  const createProfilePayload = (authId: string) => ({
    auth_id: authId,
    email,
    full_name: fullName,
    role: userMetadata.role,
    avatar_initials: userMetadata.avatar_initials,
    phone: userMetadata.phone,
    matricula: userMetadata.matricula,
    birth_date: userMetadata.birth_date,
    membership_number: userMetadata.membership_number,
    social_links: userMetadata.social_links,
    course: userMetadata.course,
    skills: userMetadata.skills,
    photo_url: userMetadata.photo_url,
    ieee_membership_date: userMetadata.ieee_membership_date,
    notes: userMetadata.notes,
    cpf: userMetadata.cpf,
    bio: userMetadata.bio,
    cover_config: userMetadata.cover_config
  });

  const ensureProfile = async (authId: string, allowRepairExistingEmail = false) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const existingProfile = await findProfileByAuthId(authId);
      if (existingProfile) return existingProfile;
      await wait(200);
    }

    const profileByEmail = await findProfileByEmail(email);

    if (profileByEmail?.auth_id && profileByEmail.auth_id !== authId) {
      throw new Error('Já existe um perfil com esse e-mail vinculado a outro usuário.');
    }

    if (profileByEmail && !profileByEmail.auth_id) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update(createProfilePayload(authId))
        .eq('id', profileByEmail.id)
        .select('id, auth_id, email, full_name')
        .single();

      if (error) throw error;
      return data;
    }

    if (profileByEmail && allowRepairExistingEmail) {
      return profileByEmail;
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert(createProfilePayload(authId))
      .select('id, auth_id, email, full_name')
      .single();

    if (error) throw error;
    return data;
  };

  try {
    const { data: invitedUserData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: userMetadata,
        redirectTo
      }
    );

  let invitedAuthId = invitedUserData?.user?.id;
  let repairedExistingAuth = false;

  if (inviteError || !invitedAuthId) {
    const message = inviteError?.message || 'Failed to invite user';
    const lowerMessage = message.toLowerCase();
    const alreadyExists = lowerMessage.includes('already') || lowerMessage.includes('registered') || lowerMessage.includes('exists');

    if (!alreadyExists) {
      return jsonResponse({ error: message }, 400, origin);
    }

    const existingAuthUser = await findAuthUserByEmail(email);
    if (!existingAuthUser) {
      return jsonResponse({
        error: 'Esse e-mail já existe no Auth, mas não consegui localizar o usuário para reparar o perfil.'
      }, 409, origin);
    }

    invitedAuthId = existingAuthUser.id;
    repairedExistingAuth = true;

    const existingProfile = await findProfileByAuthId(invitedAuthId);
    if (existingProfile) {
      return jsonResponse({
        error: 'Já existe um usuário cadastrado com esse e-mail.'
      }, 409, origin);
    }
  }

  if (!invitedAuthId) {
    return jsonResponse({ error: 'Não foi possível determinar o usuário criado no Auth.' }, 500, origin);
  }

  const profile = await ensureProfile(invitedAuthId, repairedExistingAuth);

  const chapterRows = chapters.map((chapter) => ({
    profile_id: profile.id,
    chapter_id: chapter.id,
    role: chapter.role,
    permission_slug: chapter.permission_slug
  }));

  const { error: upsertError } = await supabaseAdmin
    .from('profile_chapters')
    .upsert(chapterRows, { onConflict: 'profile_id,chapter_id' });

  if (upsertError) {
    return jsonResponse({
      error: upsertError.message,
      auth_id: invitedAuthId,
      profile_id: profile.id
    }, 500, origin);
  }

    return jsonResponse({
      user: {
        auth_id: invitedAuthId,
        profile_id: profile.id,
        email: profile.email,
        full_name: profile.full_name
      },
      repaired_existing_auth: repairedExistingAuth
    }, 200, origin);
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Erro inesperado ao criar usuário.'
    }, 500, origin);
  }
});
