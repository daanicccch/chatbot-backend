update guest_profiles
set free_questions_used = free_questions_used + 1,
    last_seen_at = now()
where id = $1
  and free_questions_used < $2
returning id, free_questions_used;
