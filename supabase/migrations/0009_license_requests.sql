-- Commercial license requests submitted by account leaders.
CREATE TABLE IF NOT EXISTS license_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan        TEXT NOT NULL CHECK (plan IN ('plan_1', 'plan_2', 'plan_3')),
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_license_requests_leader_created
  ON license_requests(leader_id, created_at DESC);

ALTER TABLE license_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "license_requests_leader_read" ON license_requests
  FOR SELECT TO authenticated
  USING (
    leader_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'leader'
    )
  );

CREATE POLICY "license_requests_leader_insert" ON license_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    leader_id = auth.uid()
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'leader'
    )
  );

CREATE POLICY "license_requests_leader_cancel" ON license_requests
  FOR UPDATE TO authenticated
  USING (
    leader_id = auth.uid()
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'leader'
    )
  )
  WITH CHECK (
    leader_id = auth.uid()
    AND status = 'cancelled'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'leader'
    )
  );

GRANT SELECT, INSERT ON TABLE license_requests TO authenticated;
GRANT UPDATE(status, updated_at) ON TABLE license_requests TO authenticated;
REVOKE ALL ON TABLE license_requests FROM anon;
