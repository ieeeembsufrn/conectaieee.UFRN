# admin-create-user

Cria usuarios pelo painel admin sem expor chaves secretas no frontend.

## Secrets

As chaves padrao do Supabase ja ficam disponiveis na Edge Function.
Configure apenas:

```bash
supabase secrets set APP_URL="https://unb.conectaieee.com"
```

## Deploy

```bash
supabase functions deploy admin-create-user --no-verify-jwt
```

## Permissao

O chamador precisa estar autenticado e ser admin global:
`permission_slug = 'admin'` no `chapter_id = 1`.
