update app_users
set email = $2,
    display_name = $3,
    updated_at = now()
where id = $1
returning id, email, display_name, supabase_user_id;
