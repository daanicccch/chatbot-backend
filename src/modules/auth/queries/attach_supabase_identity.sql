update app_users
set supabase_user_id = $2,
    email = $3,
    display_name = $4,
    updated_at = now()
where id = $1
returning id, email, display_name, supabase_user_id;
