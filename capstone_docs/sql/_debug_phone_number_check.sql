-- Scratch file, not a migration — run these three queries one at a time in
-- the Supabase SQL editor to isolate whether update_agent_phone_number
-- itself works, independent of the app. Delete this file once done.

-- 1. Find a sales_rep to test with, and see its current phone_number.
select id, username, role, phone_number
from public.user_profiles
where role = 'sales_rep'
limit 5;

-- 2. Copy an id from above into both places below, then run this on its own.
select public.update_agent_phone_number('PASTE-ID-HERE', '09171234567');

-- 3. Immediately re-check that same row.
select id, username, phone_number
from public.user_profiles
where id = 'PASTE-ID-HERE';
