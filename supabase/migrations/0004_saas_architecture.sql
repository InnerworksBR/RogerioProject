-- =============================================================
-- Autimex Reports - SaaS Architecture Migration
-- Run this AFTER 0003_auth_and_seed_support.sql
-- =============================================================

-- 1. Create Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('leader', 'rep')),
  leader_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  license_count INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying team members
CREATE INDEX IF NOT EXISTS idx_profiles_leader_id ON profiles(leader_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
-- Leaders can read their own profile and profiles of reps they manage
-- Reps can read their own profile
CREATE POLICY "profiles_read_access" ON profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid() OR leader_id = auth.uid()
  );

-- Only service role can insert/update/delete profiles (done via API)

-- 2. Ensure default user has a Leader profile
DO $$
DECLARE
  v_default_user_id UUID;
BEGIN
  SELECT id INTO v_default_user_id FROM auth.users WHERE email = 'teste@teste.com' LIMIT 1;
  
  IF v_default_user_id IS NOT NULL THEN
    INSERT INTO profiles (id, role, license_count)
    VALUES (v_default_user_id, 'leader', 10) -- Give 10 licenses by default
    ON CONFLICT (id) DO UPDATE SET role = 'leader';
  END IF;
END $$;

-- 3. Add user_id to data tables
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE sales_rows ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE report_config_items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 4. Migrate existing data to the default user
DO $$
DECLARE
  v_default_user_id UUID;
BEGIN
  SELECT id INTO v_default_user_id FROM auth.users WHERE email = 'teste@teste.com' LIMIT 1;
  
  IF v_default_user_id IS NOT NULL THEN
    UPDATE uploads SET user_id = v_default_user_id WHERE user_id IS NULL;
    UPDATE sales_rows SET user_id = v_default_user_id WHERE user_id IS NULL;
    UPDATE report_config_items SET user_id = v_default_user_id WHERE user_id IS NULL;
  END IF;
END $$;

-- 5. Enforce NOT NULL on user_id now that data is migrated
ALTER TABLE uploads ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE sales_rows ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE report_config_items ALTER COLUMN user_id SET NOT NULL;

-- 6. Update RLS Policies for SaaS Data Isolation

-- Drop old authenticated policies
DROP POLICY IF EXISTS "authenticated_uploads_access" ON uploads;
DROP POLICY IF EXISTS "authenticated_sales_access" ON sales_rows;
DROP POLICY IF EXISTS "authenticated_config_access" ON report_config_items;

-- UPLOADS: You can see uploads if you own them, or if you are the leader of the owner
CREATE POLICY "saas_uploads_access" ON uploads
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR
    user_id IN (SELECT id FROM profiles WHERE leader_id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
  );

-- SALES_ROWS: Same logic
CREATE POLICY "saas_sales_access" ON sales_rows
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR
    user_id IN (SELECT id FROM profiles WHERE leader_id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
  );

-- CONFIG_ITEMS: Same logic
CREATE POLICY "saas_config_access" ON report_config_items
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR
    user_id IN (SELECT id FROM profiles WHERE leader_id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
  );

-- 7. Helper functions for the Leader Dashboard (Rankings)
-- Since RLS handles the filtering, a Leader calling this will automatically query over all their reps' data.

CREATE OR REPLACE FUNCTION get_rep_ranking(p_ano INT DEFAULT NULL)
RETURNS TABLE (
  rep_id UUID,
  rep_email TEXT,
  total_faturado NUMERIC,
  total_pedidos BIGINT,
  num_clientes BIGINT
)
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT 
    s.user_id as rep_id,
    u.email as rep_email,
    SUM(s.valor_total) as total_faturado,
    COUNT(DISTINCT s.codigo_pedido) as total_pedidos,
    COUNT(DISTINCT s.cod_cliente) as num_clientes
  FROM sales_rows s
  JOIN auth.users u ON u.id = s.user_id
  WHERE (p_ano IS NULL OR s.ano = p_ano)
    AND (s.user_id = auth.uid() OR s.user_id IN (SELECT id FROM profiles WHERE leader_id = auth.uid()))
  GROUP BY s.user_id, u.email
  ORDER BY total_faturado DESC;
$$;

CREATE OR REPLACE FUNCTION get_client_ranking(p_ano INT DEFAULT NULL)
RETURNS TABLE (
  cod_cliente TEXT,
  nome_cliente TEXT,
  rep_email TEXT,
  total_faturado NUMERIC
)
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT 
    s.cod_cliente,
    MAX(s.nome_cliente) as nome_cliente,
    MAX(u.email) as rep_email,
    SUM(s.valor_total) as total_faturado
  FROM sales_rows s
  JOIN auth.users u ON u.id = s.user_id
  WHERE (p_ano IS NULL OR s.ano = p_ano)
    AND (s.user_id = auth.uid() OR s.user_id IN (SELECT id FROM profiles WHERE leader_id = auth.uid()))
  GROUP BY s.cod_cliente
  ORDER BY total_faturado DESC;
$$;

GRANT SELECT ON TABLE profiles TO authenticated;
GRANT EXECUTE ON FUNCTION get_rep_ranking(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_client_ranking(INT) TO authenticated;
