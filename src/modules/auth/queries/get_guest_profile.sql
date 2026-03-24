select id, free_questions_used
from guest_profiles
where id = $1;
