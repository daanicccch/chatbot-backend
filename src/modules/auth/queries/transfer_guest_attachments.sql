update attachments
set owner_type = 'user',
    owner_id = $2
where owner_type = 'guest'
  and owner_id = $1;
