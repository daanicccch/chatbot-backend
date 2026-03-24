select id, email, display_name, password_hash, supabase_user_id
from app_users
where email = $1;
