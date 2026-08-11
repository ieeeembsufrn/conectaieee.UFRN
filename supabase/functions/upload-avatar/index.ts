// Supabase Edge Function (Deno runtime).
// Generates a pre-signed PUT URL so the browser can upload avatars directly to Cloudflare R2.
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3@3';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3';
import { createClient } from 'npm:@supabase/supabase-js@2';

const jsonHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
});

const allowedContentTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const jsonResponse = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders(origin),
  });

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

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: jsonHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed. Use POST.' }, 405, origin);
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
    console.error('Invalid upload-avatar authorization token:', callerError?.message);
    return jsonResponse({ error: 'Invalid authorization token' }, 401, origin);
  }

  let body: { userId?: string | number; contentType?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400, origin);
  }

  const userId = Number(body.userId);
  const contentType = body.contentType;

  if (!Number.isFinite(userId)) {
    return jsonResponse({ error: 'userId is required.' }, 400, origin);
  }

  if (!contentType || !allowedContentTypes.has(contentType)) {
    return jsonResponse({ error: 'contentType must be image/jpeg, image/png or image/webp.' }, 400, origin);
  }

  const { data: requesterProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, profile_chapters(permission_slug, chapter_id)')
    .eq('auth_id', callerData.user.id)
    .single();

  if (profileError || !requesterProfile) {
    return jsonResponse({ error: 'Caller profile not found' }, 403, origin);
  }

  const isSelf = requesterProfile.id === userId;
  const isAdmin = ((requesterProfile as any).profile_chapters || []).some(
    (pc: any) => pc.chapter_id === 1 && pc.permission_slug === 'admin'
  );

  if (!isSelf && !isAdmin) {
    return jsonResponse({ error: 'You can only upload your own avatar.' }, 403, origin);
  }

  const accountId = Deno.env.get('CF_ACCOUNT_ID');
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const bucketName = Deno.env.get('R2_BUCKET_NAME');
  const publicBaseUrl = Deno.env.get('R2_PUBLIC_BASE_URL');

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicBaseUrl) {
    console.error('Missing R2 environment variables.');
    return jsonResponse({ error: 'Erro interno no servidor de configuração de storage.' }, 500, origin);
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const extensionByType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  const key = `avatars/${userId}/profile.${extensionByType[contentType]}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
    CacheControl: 'public, max-age=300',
  });

  try {
    const presignedUrl = await getSignedUrl(client, command, { expiresIn: 300 });
    const publicUrl = `${normalizeBaseUrl(publicBaseUrl)}/${key}`;
    return jsonResponse({ presignedUrl, publicUrl, key }, 200, origin);
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return jsonResponse({ error: 'Falha ao gerar URL de upload segura.' }, 500, origin);
  }
});
