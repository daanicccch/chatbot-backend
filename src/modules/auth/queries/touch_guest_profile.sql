update guest_profiles
set last_seen_at = now()
where id = $1
returning id, free_questions_used;
