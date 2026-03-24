with params as (
  select case
    when char_length(trim($4)) >= 3 then websearch_to_tsquery('simple', $4)
    else null::tsquery
  end as query_ts
),
search_hits as (
  select
    dc.content,
    dc.created_at,
    1 as source_rank,
    ts_rank(dc.content_tsv, p.query_ts) as rank
  from document_chunks dc
  cross join params p
  where p.query_ts is not null
    and dc.owner_type = $1
    and dc.owner_id = $2
    and dc.chat_id = $3
    and dc.content_tsv @@ p.query_ts
  order by rank desc, dc.created_at desc
  limit $5
),
recent_hits as (
  select
    dc.content,
    dc.created_at,
    2 as source_rank,
    null::real as rank
  from document_chunks dc
  where dc.owner_type = $1
    and dc.owner_id = $2
    and dc.chat_id = $3
    and not exists (select 1 from search_hits)
  order by dc.created_at desc
  limit $6
)
select content
from (
  select content, created_at, source_rank, rank
  from search_hits
  union all
  select content, created_at, source_rank, rank
  from recent_hits
) relevant_chunks
order by source_rank asc, rank desc nulls last, created_at desc;
