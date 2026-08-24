import { createClient } from '@supabase/supabase-js';

type AudienceMode = 'all' | 'chapter' | 'manual';
type MessageType = 'general' | 'chapter_event' | 'task_due' | 'task_overdue' | 'assignment';

interface SendPayload {
  title?: string;
  body?: string;
  type?: MessageType;
  audience?: {
    mode?: AudienceMode;
    chapter_id?: number | string | null;
    profile_ids?: Array<number | string>;
  };
  url?: string;
  data?: Record<string, string | number | boolean | null | undefined>;
}

interface NotificationTokenRow {
  id: number;
  profile_id: number;
  token: string;
  platform?: string | null;
  notify_due_tasks: boolean;
  notify_overdue_tasks: boolean;
  notify_chapter_events: boolean;
  notify_new_assignments: boolean;
}

interface FirebaseServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const MAX_TOKENS_PER_SEND = 500;
const SEND_CONCURRENCY = 25;

let cachedGoogleAccessToken: { token: string; expiresAt: number } | null = null;

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

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, '');

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

const base64UrlEncode = (input: string | ArrayBuffer) => {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);

  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const pemToArrayBuffer = (pem: string) => {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
};

const getFirebaseServiceAccount = (): FirebaseServiceAccount | null => {
  const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');

  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson);
      if (parsed?.client_email && parsed?.private_key && parsed?.project_id) {
        return parsed;
      }
    } catch (_error) {
      return null;
    }
  }

  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
  const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID');

  if (!clientEmail || !privateKey || !projectId) {
    return null;
  }

  return {
    client_email: clientEmail,
    private_key: privateKey,
    project_id: projectId
  };
};

const createSignedJwt = async (serviceAccount: FirebaseServiceAccount) => {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };
  const claimSet = {
    iss: serviceAccount.client_email,
    scope: FCM_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600
  };

  const unsignedJwt = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claimSet))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(serviceAccount.private_key),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsignedJwt)
  );

  return `${unsignedJwt}.${base64UrlEncode(signature)}`;
};

const getGoogleAccessToken = async (serviceAccount: FirebaseServiceAccount) => {
  if (cachedGoogleAccessToken && cachedGoogleAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedGoogleAccessToken.token;
  }

  const assertion = await createSignedJwt(serviceAccount);
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) {
    console.error('Failed to get Google access token:', data);
    throw new Error('Failed to authenticate with Firebase.');
  }

  cachedGoogleAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000
  };

  return cachedGoogleAccessToken.token;
};

const normalizeProfileIds = (values: Array<number | string> = []) => {
  return Array.from(new Set(
    values
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
  ));
};

const toStringData = (data: SendPayload['data']) => {
  const output: Record<string, string> = {};
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value === null || typeof value === 'undefined') return;
    output[key] = String(value);
  });
  return output;
};

const preferenceColumnByType: Partial<Record<MessageType, keyof NotificationTokenRow>> = {
  chapter_event: 'notify_chapter_events',
  task_due: 'notify_due_tasks',
  task_overdue: 'notify_overdue_tasks',
  assignment: 'notify_new_assignments'
};

const isUnregisteredTokenError = (errorBody: any) => {
  const details = Array.isArray(errorBody?.error?.details) ? errorBody.error.details : [];
  return details.some((detail: any) => detail?.errorCode === 'UNREGISTERED');
};

const sendFcmMessage = async (
  serviceAccount: FirebaseServiceAccount,
  accessToken: string,
  tokenRow: NotificationTokenRow,
  title: string,
  body: string,
  messageType: MessageType,
  url: string | undefined,
  appBaseUrl: string,
  extraData: Record<string, string>
) => {
  const iconUrl = appBaseUrl
    ? `${appBaseUrl}/assets/android-launchericon-192-192.png`
    : '/assets/android-launchericon-192-192.png';

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          token: tokenRow.token,
          notification: {
            title,
            body
          },
          data: {
            source: 'avisaieee',
            type: messageType,
            profile_id: String(tokenRow.profile_id),
            ...extraData
          },
          webpush: {
            notification: {
              icon: iconUrl,
              badge: iconUrl,
              tag: `avisaieee-${messageType}`
            },
            ...(url ? { fcm_options: { link: url } } : {})
          }
        }
      })
    }
  );

  const responseBody = await response.json().catch(() => null);

  return {
    ok: response.ok,
    tokenId: tokenRow.id,
    profileId: tokenRow.profile_id,
    status: response.status,
    name: responseBody?.name,
    error: response.ok ? null : responseBody?.error?.message || 'Firebase send failed',
    shouldDisableToken: !response.ok && isUnregisteredTokenError(responseBody)
  };
};

const runInBatches = async <T, R>(
  items: T[],
  batchSize: number,
  worker: (item: T) => Promise<R>
) => {
  const results: R[] = [];

  for (let start = 0; start < items.length; start += batchSize) {
    const batch = items.slice(start, start + batchSize);
    results.push(...await Promise.all(batch.map(worker)));
  }

  return results;
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
  const authToken = authorization?.replace(/^Bearer\s+/i, '');

  if (!authToken) {
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

  const { data: callerData, error: callerError } = await supabaseAuth.auth.getUser(authToken);

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
    return jsonResponse({ error: 'Only global admins can send AvisaIEEE notifications' }, 403, origin);
  }

  const firebaseServiceAccount = getFirebaseServiceAccount();
  if (!firebaseServiceAccount) {
    return jsonResponse({ error: 'Missing Firebase service account environment variables' }, 500, origin);
  }

  let payload: SendPayload;
  try {
    payload = await req.json();
  } catch (_error) {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400, origin);
  }

  const title = payload.title?.trim();
  const body = payload.body?.trim();
  const messageType = payload.type || 'general';
  const audienceMode = payload.audience?.mode || 'all';

  if (!title || !body) {
    return jsonResponse({ error: 'title and body are required' }, 400, origin);
  }

  if (title.length > 80) {
    return jsonResponse({ error: 'title must have at most 80 characters' }, 400, origin);
  }

  if (body.length > 240) {
    return jsonResponse({ error: 'body must have at most 240 characters' }, 400, origin);
  }

  if (!['general', 'chapter_event', 'task_due', 'task_overdue', 'assignment'].includes(messageType)) {
    return jsonResponse({ error: 'Invalid notification type' }, 400, origin);
  }

  if (!['all', 'chapter', 'manual'].includes(audienceMode)) {
    return jsonResponse({ error: 'Invalid audience mode' }, 400, origin);
  }

  let profileIds: number[] | null = null;

  if (audienceMode === 'manual') {
    profileIds = normalizeProfileIds(payload.audience?.profile_ids);
    if (profileIds.length === 0) {
      return jsonResponse({ error: 'profile_ids are required for manual audience' }, 400, origin);
    }
  }

  if (audienceMode === 'chapter') {
    const chapterId = Number(payload.audience?.chapter_id);
    if (!Number.isFinite(chapterId)) {
      return jsonResponse({ error: 'chapter_id is required for chapter audience' }, 400, origin);
    }

    const { data: chapterMembers, error: chapterMembersError } = await supabaseAdmin
      .from('profile_chapters')
      .select('profile_id')
      .eq('chapter_id', chapterId);

    if (chapterMembersError) {
      console.error('Error loading chapter audience:', chapterMembersError);
      return jsonResponse({ error: 'Failed to load chapter audience' }, 500, origin);
    }

    profileIds = normalizeProfileIds((chapterMembers || []).map((row: any) => row.profile_id));
    if (profileIds.length === 0) {
      return jsonResponse({
        sent: false,
        total_tokens: 0,
        success_count: 0,
        failure_count: 0,
        disabled_count: 0,
        message: 'Nenhum membro encontrado para este capítulo.'
      }, 200, origin);
    }
  }

  let tokenQuery = supabaseAdmin
    .from('notification_tokens')
    .select(`
      id,
      profile_id,
      token,
      platform,
      notify_due_tasks,
      notify_overdue_tasks,
      notify_chapter_events,
      notify_new_assignments
    `)
    .eq('enabled', true);

  if (profileIds) {
    tokenQuery = tokenQuery.in('profile_id', profileIds);
  }

  const { data: tokenRows, error: tokensError } = await tokenQuery;

  if (tokensError) {
    console.error('Error loading notification tokens:', tokensError);
    return jsonResponse({ error: 'Failed to load notification tokens' }, 500, origin);
  }

  const preferenceColumn = preferenceColumnByType[messageType];
  const eligibleTokens = ((tokenRows || []) as NotificationTokenRow[])
    .filter((tokenRow) => !preferenceColumn || tokenRow[preferenceColumn] === true);

  if (eligibleTokens.length === 0) {
    return jsonResponse({
      sent: false,
      total_tokens: 0,
      success_count: 0,
      failure_count: 0,
      disabled_count: 0,
      message: 'Nenhum token elegível para este envio.'
    }, 200, origin);
  }

  if (eligibleTokens.length > MAX_TOKENS_PER_SEND) {
    return jsonResponse({
      error: `Too many tokens for one manual send. Limit is ${MAX_TOKENS_PER_SEND}.`,
      total_tokens: eligibleTokens.length
    }, 413, origin);
  }

  const accessToken = await getGoogleAccessToken(firebaseServiceAccount);
  const extraData = toStringData(payload.data);
  const appBaseUrl = normalizeBaseUrl(Deno.env.get('APP_URL') || origin || payload.url || '');
  const notificationUrl = payload.url || (appBaseUrl ? `${appBaseUrl}/#/` : undefined);

  const results = await runInBatches(
    eligibleTokens,
    SEND_CONCURRENCY,
    (tokenRow) => sendFcmMessage(
      firebaseServiceAccount,
      accessToken,
      tokenRow,
      title,
      body,
      messageType,
      notificationUrl,
      appBaseUrl,
      extraData
    )
  );

  const disabledTokenIds = results
    .filter((result) => result.shouldDisableToken)
    .map((result) => result.tokenId);

  if (disabledTokenIds.length > 0) {
    const { error: disableError } = await supabaseAdmin
      .from('notification_tokens')
      .update({
        enabled: false,
        last_seen_at: new Date().toISOString()
      })
      .in('id', disabledTokenIds);

    if (disableError) {
      console.error('Error disabling invalid notification tokens:', disableError);
    }
  }

  const successCount = results.filter((result) => result.ok).length;
  const failureCount = results.length - successCount;

  return jsonResponse({
    sent: successCount > 0,
    total_tokens: eligibleTokens.length,
    success_count: successCount,
    failure_count: failureCount,
    disabled_count: disabledTokenIds.length,
    failures: results
      .filter((result) => !result.ok)
      .slice(0, 20)
      .map((result) => ({
        token_id: result.tokenId,
        profile_id: result.profileId,
        status: result.status,
        error: result.error
      }))
  }, failureCount > 0 && successCount === 0 ? 502 : 200, origin);
});
