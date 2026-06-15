-- Transactional, retry-safe representative offboarding.
CREATE TABLE IF NOT EXISTS public.rep_offboarding_operations (
  leader_id              UUID NOT NULL,
  rep_id                 UUID NOT NULL,
  started_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at           TIMESTAMPTZ,
  transferred_sales      BIGINT NOT NULL DEFAULT 0,
  transferred_uploads    BIGINT NOT NULL DEFAULT 0,
  deleted_config_items   BIGINT NOT NULL DEFAULT 0,
  deleted_share_links    BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (leader_id, rep_id)
);

REVOKE ALL ON TABLE public.rep_offboarding_operations FROM PUBLIC;
REVOKE ALL ON TABLE public.rep_offboarding_operations FROM anon;
REVOKE ALL ON TABLE public.rep_offboarding_operations FROM authenticated;

CREATE OR REPLACE FUNCTION public.offboard_representative(p_rep_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_leader_id UUID := auth.uid();
  v_transferred_sales BIGINT;
  v_transferred_uploads BIGINT;
  v_deleted_config_items BIGINT;
  v_deleted_share_links BIGINT;
BEGIN
  IF v_leader_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles leader
    WHERE leader.id = v_leader_id
      AND leader.role = 'leader'
  ) THEN
    RAISE EXCEPTION 'Only leaders can offboard representatives'
      USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM public.profiles representative
  WHERE representative.id = p_rep_id
    AND representative.role = 'rep'
    AND representative.leader_id = v_leader_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Representative not found'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.rep_offboarding_operations (leader_id, rep_id)
  VALUES (v_leader_id, p_rep_id)
  ON CONFLICT (leader_id, rep_id) DO NOTHING;

  UPDATE public.sales_rows
  SET user_id = v_leader_id
  WHERE user_id = p_rep_id;
  GET DIAGNOSTICS v_transferred_sales = ROW_COUNT;

  UPDATE public.uploads
  SET user_id = v_leader_id
  WHERE user_id = p_rep_id;
  GET DIAGNOSTICS v_transferred_uploads = ROW_COUNT;

  DELETE FROM public.report_config_items
  WHERE user_id = p_rep_id;
  GET DIAGNOSTICS v_deleted_config_items = ROW_COUNT;

  DELETE FROM public.share_links
  WHERE user_id = p_rep_id;
  GET DIAGNOSTICS v_deleted_share_links = ROW_COUNT;

  UPDATE public.rep_offboarding_operations
  SET completed_at = NOW(),
      transferred_sales = transferred_sales + v_transferred_sales,
      transferred_uploads = transferred_uploads + v_transferred_uploads,
      deleted_config_items = deleted_config_items + v_deleted_config_items,
      deleted_share_links = deleted_share_links + v_deleted_share_links
  WHERE leader_id = v_leader_id
    AND rep_id = p_rep_id;

  RETURN jsonb_build_object(
    'transferred_sales', v_transferred_sales,
    'transferred_uploads', v_transferred_uploads,
    'deleted_config_items', v_deleted_config_items,
    'deleted_share_links', v_deleted_share_links
  );
END;
$$;

REVOKE ALL ON FUNCTION public.offboard_representative(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.offboard_representative(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.offboard_representative(UUID) TO authenticated;
