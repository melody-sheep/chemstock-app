-- Let a Sales Rep or Collector view the Manager who created their account.
-- Contact details are returned only for that agent's assigned Manager.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_agent_manager_contact(p_agent_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', manager.id,
    'full_name', manager.full_name,
    'email', manager.email,
    'phone_number', manager.phone_number,
    'profile_photo_path', (
      SELECT media.storage_path
      FROM public.media
      WHERE media.id = manager.profile_media_id
    )
  )
  FROM public.user_profiles agent
  JOIN public.user_profiles manager
    ON manager.id = agent.created_by
    AND manager.role = 'manager'
  WHERE agent.id = p_agent_id
    AND agent.role IN ('sales_rep', 'collector')
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_agent_manager_contact(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_agent_manager_contact(uuid) TO anon;

COMMIT;
