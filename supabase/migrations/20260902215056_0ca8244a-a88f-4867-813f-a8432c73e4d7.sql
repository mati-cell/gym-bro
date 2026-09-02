CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TYPE public.exercise_action AS ENUM ('subir_peso','bajar_peso','mantener','cambiar_ejercicio','revisar_tecnica');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  weight_kg NUMERIC,
  height_cm NUMERIC,
  age INTEGER,
  goal TEXT,
  experience_level TEXT,
  notes TEXT,
  ai_model TEXT NOT NULL DEFAULT 'openai/gpt-oss-20b',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.body_weight_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  logged_on DATE NOT NULL DEFAULT current_date,
  weight_kg NUMERIC NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_weight_logs TO authenticated;
GRANT ALL ON public.body_weight_logs TO service_role;
ALTER TABLE public.body_weight_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own weight logs" ON public.body_weight_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX body_weight_logs_user_date_idx ON public.body_weight_logs(user_id, logged_on DESC);
CREATE TRIGGER body_weight_logs_updated_at BEFORE UPDATE ON public.body_weight_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  day_number INTEGER,
  session_date DATE NOT NULL DEFAULT current_date,
  title TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions" ON public.sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX sessions_user_date_idx ON public.sessions(user_id, session_date DESC);
CREATE TRIGGER sessions_updated_at BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.session_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  muscle_group TEXT,
  planned_sets INTEGER,
  planned_reps TEXT,
  planned_weight_kg NUMERIC,
  actual_reps INTEGER[] NOT NULL DEFAULT '{}',
  performed BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  action public.exercise_action,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_exercises TO authenticated;
GRANT ALL ON public.session_exercises TO service_role;
ALTER TABLE public.session_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own session exercises" ON public.session_exercises FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX session_exercises_user_name_idx ON public.session_exercises(user_id, lower(name));
CREATE INDEX session_exercises_session_idx ON public.session_exercises(session_id, position);
CREATE TRIGGER session_exercises_updated_at BEFORE UPDATE ON public.session_exercises FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();