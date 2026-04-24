-- Optional: allow owners to delete design_draft_ai_message rows (Clear history in the design tool).
-- Run in Supabase SQL editor if DELETE on design_draft_ai_message returns RLS errors.

CREATE POLICY design_draft_ai_message_delete_own ON public.design_draft_ai_message
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.design_draft d
      JOIN public.user_account u ON u.id = d.user_account_id
      WHERE d.id = design_draft_ai_message.design_draft_id
        AND u.auth_user_id = auth.uid()
    )


  
  );
