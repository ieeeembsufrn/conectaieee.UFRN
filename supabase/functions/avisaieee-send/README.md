# avisaieee-send

Gateway administrativo para enviar notificações push manuais pelo painel AvisaIEEE.

## Secrets necessários

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SECRET_KEY`
- `SUPABASE_ANON_KEY` ou `SUPABASE_PUBLISHABLE_KEY`
- `FIREBASE_SERVICE_ACCOUNT_JSON`

Alternativamente ao JSON completo do Firebase:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

## Payload

```json
{
  "title": "Reunião geral amanhã",
  "body": "A reunião começa às 18h no laboratório.",
  "type": "general",
  "audience": {
    "mode": "chapter",
    "chapter_id": 2
  },
  "url": "https://app.example.com/#/calendar"
}
```

`type` pode ser `general`, `chapter_event`, `task_due`, `task_overdue` ou `assignment`.
