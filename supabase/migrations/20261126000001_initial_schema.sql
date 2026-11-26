-- CrisIsStudent — Esquema inicial de sincronización multidispositivo en Supabase
-- Ejecutar en Supabase SQL Editor (o vía Supabase CLI).
-- Principios:
--   1. Multi-tenant estricto por user_id (auth.users.id) con ON DELETE CASCADE.
--   2. Claves primarias compuestas (user_id, id) para evitar colisiones entre usuarios.
--   3. Soft-delete (deleted_at) para propagar borrados a dispositivos offline.
--   4. Cursor de sincronización fiable en servidor (server_updated_at via trigger).
--   5. Row Level Security (RLS) activo en TODAS las tablas; acceso denegado a rol anon.

-- ============================================================================
-- 1. Funciones y triggers auxiliares
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_server_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.server_updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Evita que un usuario escale su propio rol a admin mediante UPDATE en profiles
CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND auth.role() = 'authenticated' THEN
    RAISE EXCEPTION 'No tienes permiso para modificar el rol de usuario.';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. Tabla de perfiles
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS trg_profiles_protect_role ON public.profiles;
CREATE TRIGGER trg_profiles_protect_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_change();

-- ============================================================================
-- 3. Tablas de dominio (espejo de Dexie TaiStudyDB v5)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.study_blocks (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL,
  code text NOT NULL,
  title text NOT NULL,
  short_title text NOT NULL,
  description text NOT NULL DEFAULT '',
  color text NOT NULL,
  icon text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.topics (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL,
  block_id text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  status text NOT NULL,
  round_count integer NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}',
  content_json jsonb,
  plain_text text NOT NULL DEFAULT '',
  custom_outline_md text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_reviewed_at timestamptz,
  server_updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (user_id, id),
  CONSTRAINT topics_content_max_size CHECK (octet_length(coalesce(content_json::text, '')) < 2097152)
);

CREATE TABLE IF NOT EXISTS public.study_sessions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL,
  topic_id text NOT NULL,
  block_id text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 0,
  type text NOT NULL,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.weekly_plan_items (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL,
  week_start_date text NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  topic_id text NOT NULL,
  block_id text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  target_pomodoros integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.case_studies (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL,
  block_id text NOT NULL,
  title text NOT NULL,
  statement text NOT NULL,
  source text,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.questions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL,
  block_id text NOT NULL,
  topic_id text,
  case_study_id text,
  prompt text NOT NULL,
  options jsonb NOT NULL,
  correct_index smallint NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  explanation text,
  reference text,
  source text,
  tags text[] NOT NULL DEFAULT '{}',
  flagged boolean NOT NULL DEFAULT false,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.exam_attempts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL,
  title text NOT NULL,
  date timestamptz NOT NULL,
  mode text NOT NULL,
  penalty_ratio double precision NOT NULL DEFAULT 0,
  case_study_id text,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_count integer NOT NULL DEFAULT 0,
  wrong_count integer NOT NULL DEFAULT 0,
  blank_count integer NOT NULL DEFAULT 0,
  net_score double precision NOT NULL DEFAULT 0,
  max_score double precision NOT NULL DEFAULT 0,
  score_on_10 double precision NOT NULL DEFAULT 0,
  duration_sec integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.flashcards (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL,
  block_id text NOT NULL,
  topic_id text,
  front text NOT NULL,
  back text NOT NULL,
  hint text,
  tags text[] NOT NULL DEFAULT '{}',
  srs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.gamification_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp integer NOT NULL DEFAULT 0,
  streak_days integer NOT NULL DEFAULT 0,
  longest_streak_days integer NOT NULL DEFAULT 0,
  streak_freezes integer NOT NULL DEFAULT 2,
  max_streak_freezes integer NOT NULL DEFAULT 3,
  last_active_date text,
  active_dates text[] NOT NULL DEFAULT '{}',
  freeze_used_dates text[] NOT NULL DEFAULT '{}',
  weekly_rest_days integer[] NOT NULL DEFAULT '{0}',
  claimed_mission_ids text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. Índices de sincronización incremental y triggers server_updated_at
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_study_blocks_sync ON public.study_blocks (user_id, server_updated_at);
CREATE INDEX IF NOT EXISTS idx_topics_sync ON public.topics (user_id, server_updated_at);
CREATE INDEX IF NOT EXISTS idx_study_sessions_sync ON public.study_sessions (user_id, server_updated_at);
CREATE INDEX IF NOT EXISTS idx_weekly_plan_items_sync ON public.weekly_plan_items (user_id, server_updated_at);
CREATE INDEX IF NOT EXISTS idx_case_studies_sync ON public.case_studies (user_id, server_updated_at);
CREATE INDEX IF NOT EXISTS idx_questions_sync ON public.questions (user_id, server_updated_at);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_sync ON public.exam_attempts (user_id, server_updated_at);
CREATE INDEX IF NOT EXISTS idx_flashcards_sync ON public.flashcards (user_id, server_updated_at);
CREATE INDEX IF NOT EXISTS idx_gamification_profiles_sync ON public.gamification_profiles (user_id, server_updated_at);

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'study_blocks',
    'topics',
    'study_sessions',
    'weekly_plan_items',
    'case_studies',
    'questions',
    'exam_attempts',
    'flashcards',
    'gamification_profiles'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_server_updated_at ON public.%I;', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_server_updated_at BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_server_updated_at();',
      tbl,
      tbl
    );
  END LOOP;
END;
$$;

-- ============================================================================
-- 5. Row Level Security (RLS) estricto
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'study_blocks',
    'topics',
    'study_sessions',
    'weekly_plan_items',
    'case_studies',
    'questions',
    'exam_attempts',
    'flashcards',
    'gamification_profiles'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

    EXECUTE format('DROP POLICY IF EXISTS "%I_select_own" ON public.%I;', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%I_select_own" ON public.%I FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);',
      tbl,
      tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS "%I_insert_own" ON public.%I;', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%I_insert_own" ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);',
      tbl,
      tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS "%I_update_own" ON public.%I;', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%I_update_own" ON public.%I FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);',
      tbl,
      tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS "%I_delete_own" ON public.%I;', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%I_delete_own" ON public.%I FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);',
      tbl,
      tbl
    );
  END LOOP;
END;
$$;

-- ============================================================================
-- 6. Permisos SQL explícitos (authenticated sí, anon denegado)
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.study_blocks,
  public.topics,
  public.study_sessions,
  public.weekly_plan_items,
  public.case_studies,
  public.questions,
  public.exam_attempts,
  public.flashcards,
  public.gamification_profiles
TO authenticated;

REVOKE ALL ON TABLE
  public.profiles,
  public.study_blocks,
  public.topics,
  public.study_sessions,
  public.weekly_plan_items,
  public.case_studies,
  public.questions,
  public.exam_attempts,
  public.flashcards,
  public.gamification_profiles
FROM anon;
