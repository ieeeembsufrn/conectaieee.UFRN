-- db_seed_ufrn.sql
-- Script para popular o banco de dados com dados de teste para o IEEE UFRN.
-- Execute este script no Editor SQL do Supabase.

BEGIN;

-- 1. Limpar dados existentes (COMENTADO PARA EVITAR PERDA DE DADOS - DESCOMENTE SE DESEJAR LIMPAR)
-- TRUNCATE TABLE public.profile_chapters CASCADE;
-- TRUNCATE TABLE public.project_members CASCADE;
-- TRUNCATE TABLE public.project_chapters CASCADE;
-- TRUNCATE TABLE public.task_assignees CASCADE;
-- TRUNCATE TABLE public.tasks CASCADE;
-- TRUNCATE TABLE public.projects CASCADE;
-- TRUNCATE TABLE public.chapters CASCADE;
-- TRUNCATE TABLE public.profiles CASCADE;
-- Nota: Permissions não limpamos pois já são seedadas no schema base.

-- 2. Inserir Capítulos
INSERT INTO public.chapters (name, acronym, description, color_theme, icon_name, cover_image_url, calendar_url, email, keywords, members_count, projects_count) VALUES
('Ramo Estudantil IEEE UFRN', 'Ramo', 'O Ramo Estudantil IEEE UFRN é a unidade organizacional base.', 'from-blue-700 to-blue-900', 'Globe', 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=1200', 'https://calendar.google.com/calendar/ical/pt.brazilian%23holiday%40group.v.calendar.google.com/public/basic.ics', 'ramo@ieee.ufrn.br', ARRAY['#leadership', '#engineering', '#ufrn', '#student-branch'], 50, 5),
('Computer Society', 'CS', 'A Computer Society (CS) é a principal fonte para computação.', 'from-blue-500 to-indigo-600', 'Monitor', 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=1200', null, 'cs@ieee.ufrn.br', ARRAY['#computing', '#software', '#ai', '#development'], 18, 4),
('Engineering in Medicine & Biology Society', 'EMBS', 'Engenharia biomédica.', 'from-rose-500 to-pink-700', 'Dna', 'https://images.unsplash.com/photo-1628595351029-c2bf17511435?fm=jpg&q=60&w=3000&auto=format&fit=crop&ixlib=rb-4.1.0', null, 'embs@ieee.ufrn.br', ARRAY['#biomedical', '#health', '#medicine', '#biology'], 9, 2),
('Industrial Electronics Society', 'IES', 'Eletrônica industrial, automação e sistemas inteligentes.', 'from-amber-500 to-stone-700', 'Cpu', 'https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?auto=format&fit=crop&q=80&w=1200', null, 'ies@ieee.ufrn.br', ARRAY['#industrial-electronics', '#automation', '#power-electronics', '#systems'], 6, 1),
('Power & Energy Society', 'PES', 'A Power & Energy Society (PES) é líder mundial em energia.', 'from-green-500 to-emerald-700', 'Zap', 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&q=80&w=1200', null, 'pes@ieee.ufrn.br', ARRAY['#energy', '#power', '#smartgrid', '#renewables'], 12, 2),
('Robotics & Automation Society', 'RAS', 'O Capítulo da Sociedade de Robótica e Automação (RAS).', 'from-red-500 to-orange-600', 'Bot', 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=1200', null, 'ras@ieee.ufrn.br', ARRAY['#robotics', '#automation', '#drones', '#ros', '#control'], 15, 3);




-- Instalar pgcrypto para hash de senhas (necessário para o auth)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 3. Inserir Usuarios Auth e Perfis (Profiles)
DO $$
DECLARE
  v_admin_auth_id uuid := gen_random_uuid();
  v_ras_auth_id uuid := gen_random_uuid();
  v_pm_auth_id uuid := gen_random_uuid();
  v_member_auth_id uuid := gen_random_uuid();

  v_chapter_ieee bigint;
  v_chapter_ras bigint;
  v_chapter_cs bigint;
  
  v_profile_admin bigint;
  v_profile_ras bigint;
  v_profile_pm bigint;
  v_profile_member bigint;
  
  v_project_semana bigint;
  v_project_workshop bigint;
  
  v_task_plan bigint;
BEGIN

  -- 3.1 Criar usuários no auth.users (Authentication do Supabase)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES
  ('00000000-0000-0000-0000-000000000000', v_admin_auth_id, 'authenticated', 'authenticated', 'admin.ufrn@teste.com', crypt('admin.ufrn@teste.com', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name": "Admin IEEE UFRN"}', NOW(), NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', v_ras_auth_id, 'authenticated', 'authenticated', 'ras.ufrn@teste.com', crypt('ras.ufrn@teste.com', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name": "Lider RAS UFRN"}', NOW(), NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', v_pm_auth_id, 'authenticated', 'authenticated', 'pm.ufrn@teste.com', crypt('pm.ufrn@teste.com', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name": "Gerente de Projetos UFRN"}', NOW(), NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', v_member_auth_id, 'authenticated', 'authenticated', 'membro.ufrn@teste.com', crypt('membro.ufrn@teste.com', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name": "Membro Ativo UFRN"}', NOW(), NOW(), '', '', '', '');

  -- 3.2 Inserir identidades para o login do Supabase funcionar corretamente com a senha atrelada
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at) VALUES
  (gen_random_uuid(), v_admin_auth_id, format('{"sub":"%s","email":"%s"}', v_admin_auth_id::text, 'admin.ufrn@teste.com')::jsonb, 'email', v_admin_auth_id::text, NOW(), NOW(), NOW()),
  (gen_random_uuid(), v_ras_auth_id, format('{"sub":"%s","email":"%s"}', v_ras_auth_id::text, 'ras.ufrn@teste.com')::jsonb, 'email', v_ras_auth_id::text, NOW(), NOW(), NOW()),
  (gen_random_uuid(), v_pm_auth_id, format('{"sub":"%s","email":"%s"}', v_pm_auth_id::text, 'pm.ufrn@teste.com')::jsonb, 'email', v_pm_auth_id::text, NOW(), NOW(), NOW()),
  (gen_random_uuid(), v_member_auth_id, format('{"sub":"%s","email":"%s"}', v_member_auth_id::text, 'membro.ufrn@teste.com')::jsonb, 'email', v_member_auth_id::text, NOW(), NOW(), NOW());

  -- 3.3 Inserir Perfis em public.profiles
  -- Se o db já tiver triggers que criam estes os rows em public.profiles logo após a criacao em auth.users, esta inserção pode colidir
  -- Usaremos um pequeno IF para garantir (não criamos se a trigger já tiver criado o perfil via auth):
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE email = 'admin.ufrn@teste.com') THEN
    INSERT INTO public.profiles (auth_id, full_name, email, role, matricula, avatar_initials, bio) VALUES
    (v_admin_auth_id, 'Admin IEEE UFRN', 'admin.ufrn@teste.com', 'Presidente do Ramo', '2020001', 'AU', 'Presidencia do IEEE UFRN. Focado em expansao e impacto.'),
    (v_ras_auth_id, 'Lider RAS UFRN', 'ras.ufrn@teste.com', 'Presidente RAS', '2021002', 'LR', 'Apaixonado por robotica e automacao.'),
    (v_pm_auth_id, 'Gerente de Projetos UFRN', 'pm.ufrn@teste.com', 'Diretor de Projetos', '2022003', 'GP', 'Organizado e focado em entregas.'),
    (v_member_auth_id, 'Membro Ativo UFRN', 'membro.ufrn@teste.com', 'Voluntario', '2023004', 'MU', 'Estudante da UFRN e membro ativo do IEEE.');
  ELSE
    -- Caso a trigger já os tenha criado, apenas fazemos update dos campos faltantes
    UPDATE public.profiles SET full_name = 'Admin IEEE UFRN', role = 'Presidente do Ramo', matricula = '2020001', avatar_initials = 'AU', bio = 'Presidencia do IEEE UFRN. Focado em expansao e impacto.' WHERE email = 'admin.ufrn@teste.com';
    UPDATE public.profiles SET full_name = 'Lider RAS UFRN', role = 'Presidente RAS', matricula = '2021002', avatar_initials = 'LR', bio = 'Apaixonado por robotica e automacao.' WHERE email = 'ras.ufrn@teste.com';
    UPDATE public.profiles SET full_name = 'Gerente de Projetos UFRN', role = 'Diretor de Projetos', matricula = '2022003', avatar_initials = 'GP', bio = 'Organizado e focado em entregas.' WHERE email = 'pm.ufrn@teste.com';
    UPDATE public.profiles SET full_name = 'Membro Ativo UFRN', role = 'Voluntario', matricula = '2023004', avatar_initials = 'MU', bio = 'Estudante da UFRN e membro ativo do IEEE.' WHERE email = 'membro.ufrn@teste.com';
  END IF;

  -- Get Chapter IDs
  SELECT id INTO v_chapter_ieee FROM public.chapters WHERE acronym = 'Ramo';
  SELECT id INTO v_chapter_ras FROM public.chapters WHERE acronym = 'RAS';
  SELECT id INTO v_chapter_cs FROM public.chapters WHERE acronym = 'CS';

  -- Get Profile IDs
  SELECT id INTO v_profile_admin FROM public.profiles WHERE email = 'admin.ufrn@teste.com';
  SELECT id INTO v_profile_ras FROM public.profiles WHERE email = 'ras.ufrn@teste.com';
  SELECT id INTO v_profile_pm FROM public.profiles WHERE email = 'pm.ufrn@teste.com';
  SELECT id INTO v_profile_member FROM public.profiles WHERE email = 'membro.ufrn@teste.com';

  -- 4. Vincular Perfis a Capítulos (profile_chapters)
  
  -- Admin é Global Admin (Slug 'admin' no Chapter 1/Ramo)
  INSERT INTO public.profile_chapters (profile_id, chapter_id, role, permission_slug) VALUES
  (v_profile_admin, v_chapter_ieee, 'Presidente', 'admin'), -- GLOBAL ADMIN
  (v_profile_admin, v_chapter_ras, 'Membro Honorário', 'member');

  -- Líder RAS é Chair do RAS
  INSERT INTO public.profile_chapters (profile_id, chapter_id, role, permission_slug) VALUES
  (v_profile_ras, v_chapter_ras, 'Presidente', 'chair'),
  (v_profile_ras, v_chapter_ieee, 'Diretor Técnico', 'manager');

  -- PM é Manager no CS e IEEE
  INSERT INTO public.profile_chapters (profile_id, chapter_id, role, permission_slug) VALUES
  (v_profile_pm, v_chapter_cs, 'Diretor de Projetos', 'manager'),
  (v_profile_pm, v_chapter_ieee, 'Assessor', 'member');

  -- Membro é membro em tudo
  INSERT INTO public.profile_chapters (profile_id, chapter_id, role, permission_slug) VALUES
  (v_profile_member, v_chapter_ieee, 'Trainee', 'member'),
  (v_profile_member, v_chapter_cs, 'Membro', 'member');


  -- 5. Criar Projetos
  
  -- Projeto 1: Semana da Engenharia (IEEE UFRN)
  INSERT INTO public.projects (public_id, name, description, status, start_date, end_date, progress, color_theme, is_partnership)
  VALUES ('sem2501', 'Semana da Engenharia UFRN 2025', 'Maior evento do ano com palestras e workshops.', 'Planejamento', CURRENT_DATE + 10, CURRENT_DATE + 40, 15, 'from-blue-500 to-cyan-500', false)
  RETURNING id INTO v_project_semana;

  -- Relacionar Projeto 1
  INSERT INTO public.project_chapters (project_id, chapter_id) VALUES (v_project_semana, v_chapter_ieee);
  INSERT INTO public.project_members (project_id, profile_id, is_owner) VALUES 
  (v_project_semana, v_profile_admin, true), -- Owner
  (v_project_semana, v_profile_pm, false),
  (v_project_semana, v_profile_member, false);


  -- Projeto 2: Workshop de Arduino (RAS)
  INSERT INTO public.projects (public_id, name, description, status, start_date, end_date, progress, color_theme, is_partnership)
  VALUES ('workard', 'Workshop de Arduino', 'Curso básico para calouros.', 'Em Andamento', CURRENT_DATE - 5, CURRENT_DATE + 5, 60, 'from-purple-500 to-pink-500', false)
  RETURNING id INTO v_project_workshop;

  -- Relacionar Projeto 2
  INSERT INTO public.project_chapters (project_id, chapter_id) VALUES (v_project_workshop, v_chapter_ras);
  INSERT INTO public.project_members (project_id, profile_id, is_owner) VALUES
  (v_project_workshop, v_profile_ras, true),
  (v_project_workshop, v_profile_member, false);

  
  -- 6. Criar Tarefas
  
  -- Tarefa P1
  INSERT INTO public.tasks (public_id, title, description, status, priority, project_id, deadline, start_date)
  VALUES ('xyBgj', 'Contatar Palestrantes', 'Enviar e-mail convite para lista A.', 'doing', 'alta', v_project_semana, CURRENT_DATE + 5, CURRENT_DATE)
  RETURNING id INTO v_task_plan;

  INSERT INTO public.task_assignees (task_id, profile_id) VALUES (v_task_plan, v_profile_pm), (v_task_plan, v_profile_member);

  -- Tarefa P2
  INSERT INTO public.tasks (public_id, title, description, status, priority, project_id, deadline, start_date)
  VALUES ('Za92k', 'Comprar Kits Arduino', 'Verificar orçamento e realizar compra.', 'done', 'urgente', v_project_workshop, CURRENT_DATE - 2, CURRENT_DATE - 10);
  
  -- Responsáveis P2
  
  INSERT INTO public.tasks (public_id, title, description, status, priority, project_id, deadline)
  VALUES ('Lm01p', 'Preparar Slides', 'Aula 1 e 2.', 'todo', 'media', v_project_workshop, CURRENT_DATE + 1)
  RETURNING id INTO v_task_plan; -- reutilizando a variavel

  INSERT INTO public.task_assignees (task_id, profile_id) VALUES (v_task_plan, v_profile_ras);

END $$;

COMMIT;
