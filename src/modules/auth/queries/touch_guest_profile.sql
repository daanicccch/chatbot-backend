update guest_profiles
set last_seen_at = now()
where id = $1;
