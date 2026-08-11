-- Batch upsert that writes only Google-sourced and derived columns.
-- Operator columns and the contact-time snapshot are intentionally absent
-- from the update set so a re-sweep cannot destroy outcome data.

create or replace function public.upsert_leads_batch(rows jsonb)
returns void
language plpgsql
as $$
declare
  item jsonb;
  point geometry(Point, 32618);
begin
  for item in select * from jsonb_array_elements(rows)
  loop
    if (item->>'lon') is null or (item->>'lat') is null then
      point := null;
    else
      point := ST_Transform(
        ST_SetSRID(
          ST_MakePoint((item->>'lon')::double precision, (item->>'lat')::double precision),
          4326
        ),
        32618
      );
    end if;

    insert into public.leads (
      place_id,
      display_name,
      formatted_address,
      national_phone_number,
      primary_type,
      types,
      business_status,
      rating,
      user_rating_count,
      website_uri,
      pure_service_area,
      brand_id,
      location,
      segment,
      exclusion_reason,
      website_status,
      email,
      score,
      score_breakdown,
      selection_source,
      verified_at
    ) values (
      item->>'place_id',
      item->>'display_name',
      item->>'formatted_address',
      item->>'national_phone_number',
      item->>'primary_type',
      coalesce(
        array(select jsonb_array_elements_text(coalesce(item->'types', '[]'::jsonb))),
        '{}'::text[]
      ),
      item->>'business_status',
      nullif(item->>'rating', '')::double precision,
      coalesce((item->>'user_rating_count')::integer, 0),
      item->>'website_uri',
      coalesce((item->>'pure_service_area')::boolean, false),
      item->>'brand_id',
      point,
      item->>'segment',
      item->>'exclusion_reason',
      item->>'website_status',
      item->>'email',
      nullif(item->>'score', '')::double precision,
      item->'score_breakdown',
      item->>'selection_source',
      (item->>'verified_at')::timestamptz
    )
    on conflict (place_id) do update set
      display_name = excluded.display_name,
      formatted_address = excluded.formatted_address,
      national_phone_number = excluded.national_phone_number,
      primary_type = excluded.primary_type,
      types = excluded.types,
      business_status = excluded.business_status,
      rating = excluded.rating,
      user_rating_count = excluded.user_rating_count,
      website_uri = excluded.website_uri,
      pure_service_area = excluded.pure_service_area,
      brand_id = excluded.brand_id,
      location = excluded.location,
      segment = excluded.segment,
      exclusion_reason = excluded.exclusion_reason,
      website_status = excluded.website_status,
      email = excluded.email,
      score = excluded.score,
      score_breakdown = excluded.score_breakdown,
      selection_source = excluded.selection_source,
      verified_at = excluded.verified_at,
      updated_at = now();
  end loop;
end;
$$;

create or replace function public.count_normalized_names()
returns table (normalized_name text, distinct_locations bigint)
language sql
stable
as $$
  select
    lower(trim(regexp_replace(display_name, '[^a-zA-Z0-9]+', ' ', 'g'))) as normalized_name,
    count(distinct place_id) as distinct_locations
  from public.leads
  group by 1
  having count(distinct place_id) >= 1;
$$;

create or replace function public.find_stale_verifications(
  verified_before timestamptz,
  row_limit integer
)
returns table (
  place_id text,
  display_name text,
  formatted_address text,
  national_phone_number text,
  primary_type text,
  types text[],
  business_status text,
  rating double precision,
  user_rating_count integer,
  website_uri text,
  pure_service_area boolean,
  brand_id text,
  lon double precision,
  lat double precision,
  segment text,
  exclusion_reason text,
  website_status text,
  email text,
  score double precision,
  score_breakdown jsonb,
  selection_source text,
  verified_at timestamptz,
  contact_status text,
  contacted_at timestamptz,
  notes text,
  contact_snapshot_score double precision,
  contact_snapshot_breakdown jsonb,
  contact_snapshot_user_rating_count integer,
  contact_snapshot_rating double precision,
  contact_snapshot_segment text,
  contact_snapshot_taken_at timestamptz
)
language sql
stable
as $$
  select
    l.place_id,
    l.display_name,
    l.formatted_address,
    l.national_phone_number,
    l.primary_type,
    l.types,
    l.business_status,
    l.rating,
    l.user_rating_count,
    l.website_uri,
    l.pure_service_area,
    l.brand_id,
    case when l.location is null then null else ST_X(ST_Transform(l.location, 4326)) end,
    case when l.location is null then null else ST_Y(ST_Transform(l.location, 4326)) end,
    l.segment,
    l.exclusion_reason,
    l.website_status,
    l.email,
    l.score,
    l.score_breakdown,
    l.selection_source,
    l.verified_at,
    l.contact_status,
    l.contacted_at,
    l.notes,
    l.contact_snapshot_score,
    l.contact_snapshot_breakdown,
    l.contact_snapshot_user_rating_count,
    l.contact_snapshot_rating,
    l.contact_snapshot_segment,
    l.contact_snapshot_taken_at
  from public.leads l
  where l.verified_at < verified_before
    and l.website_uri is not null
  order by l.verified_at asc
  limit row_limit;
$$;

create or replace function public.find_qualified_within(
  lon double precision,
  lat double precision,
  radius_meters double precision,
  row_limit integer
)
returns table (
  place_id text,
  display_name text,
  formatted_address text,
  national_phone_number text,
  primary_type text,
  types text[],
  business_status text,
  rating double precision,
  user_rating_count integer,
  website_uri text,
  pure_service_area boolean,
  brand_id text,
  lon double precision,
  lat double precision,
  segment text,
  exclusion_reason text,
  website_status text,
  email text,
  score double precision,
  score_breakdown jsonb,
  selection_source text,
  verified_at timestamptz,
  contact_status text,
  contacted_at timestamptz,
  notes text,
  contact_snapshot_score double precision,
  contact_snapshot_breakdown jsonb,
  contact_snapshot_user_rating_count integer,
  contact_snapshot_rating double precision,
  contact_snapshot_segment text,
  contact_snapshot_taken_at timestamptz
)
language sql
stable
as $$
  with origin as (
    select ST_Transform(ST_SetSRID(ST_MakePoint(lon, lat), 4326), 32618) as geom
  )
  select
    l.place_id,
    l.display_name,
    l.formatted_address,
    l.national_phone_number,
    l.primary_type,
    l.types,
    l.business_status,
    l.rating,
    l.user_rating_count,
    l.website_uri,
    l.pure_service_area,
    l.brand_id,
    case when l.location is null then null else ST_X(ST_Transform(l.location, 4326)) end,
    case when l.location is null then null else ST_Y(ST_Transform(l.location, 4326)) end,
    l.segment,
    l.exclusion_reason,
    l.website_status,
    l.email,
    l.score,
    l.score_breakdown,
    l.selection_source,
    l.verified_at,
    l.contact_status,
    l.contacted_at,
    l.notes,
    l.contact_snapshot_score,
    l.contact_snapshot_breakdown,
    l.contact_snapshot_user_rating_count,
    l.contact_snapshot_rating,
    l.contact_snapshot_segment,
    l.contact_snapshot_taken_at
  from public.leads l, origin
  where l.segment is not null
    and l.exclusion_reason is null
    and (
      l.location is null
      or ST_DWithin(l.location, origin.geom, radius_meters)
    )
  order by l.score desc nulls last
  limit row_limit;
$$;
