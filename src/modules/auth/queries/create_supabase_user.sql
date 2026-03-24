insert into app_users (supabase_user_id, email, password_hash, display_name)
values ($1, $2, null, $3)
returning id, email, display_name, supabase_user_id;
