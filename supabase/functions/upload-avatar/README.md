# upload-avatar

Gera URL pre-assinada para upload de avatar no Cloudflare R2.

## Secrets

As chaves padrao do Supabase ja ficam disponiveis na Edge Function.
Configure os secrets do R2:

```bash
supabase secrets set \
  CF_ACCOUNT_ID="..." \
  R2_ACCESS_KEY_ID="..." \
  R2_SECRET_ACCESS_KEY="..." \
  R2_BUCKET_NAME="..." \
  R2_PUBLIC_BASE_URL="https://cdn1.conectaieee.com"
```

## Deploy

```bash
supabase functions deploy upload-avatar --no-verify-jwt
```

## Permissao

Qualquer usuario autenticado pode trocar a propria foto. Admin global tambem
pode trocar a foto de outros usuarios.
