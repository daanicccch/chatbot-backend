select id, email, display_name, supabase_user_id
from app_users
where supabase_user_id = $1;
