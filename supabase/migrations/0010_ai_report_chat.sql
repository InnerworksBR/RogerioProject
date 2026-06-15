-- AI report chat entitlement. Representatives inherit their leader's plan.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'plan_1'
  CHECK (subscription_plan IN ('plan_1', 'plan_2', 'plan_3'));

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_plan
  ON profiles(subscription_plan);

CREATE OR REPLACE FUNCTION get_effective_subscription_plan()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN profile.role = 'leader' THEN profile.subscription_plan
    WHEN profile.role = 'rep' THEN COALESCE(leader.subscription_plan, 'plan_1')
    ELSE 'plan_1'
  END
  FROM profiles profile
  LEFT JOIN profiles leader ON leader.id = profile.leader_id
  WHERE profile.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION get_effective_subscription_plan() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_effective_subscription_plan() TO authenticated;
REVOKE ALL ON FUNCTION get_effective_subscription_plan() FROM anon;
