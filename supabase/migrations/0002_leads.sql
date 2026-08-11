-- EPSG:32618 (UTM zone 18N) covers Northern Virginia in meters so buffers and
-- containment are not ellipses. Transform to 4326 only at the API boundary.

create table public.leads (
  place_id text primary key,

  -- Google-sourced
  display_name text not null,
  formatted_address text,
  national_phone_number text,
  primary_type text,
  types text[] not null default '{}',
  business_status text not null,
  rating double precision,
  user_rating_count integer not null default 0,
  website_uri text,
  pure_service_area boolean not null default false,
  brand_id text,
  -- Nullable: pure service-area businesses often have no Google location.
  location geometry(Point, 32618),

  -- Derived by the sweep
  segment text,
  exclusion_reason text,
  website_status text not null,
  email text,
  score double precision,
  score_breakdown jsonb,
  selection_source text,
  verified_at timestamptz not null,

  -- Operator-owned; sweeps never write these columns.
  contact_status text,
  contacted_at timestamptz,
  notes text,

  -- Contact-time snapshot; written once when contact_status first leaves null.
  contact_snapshot_score double precision,
  contact_snapshot_breakdown jsonb,
  contact_snapshot_user_rating_count integer,
  contact_snapshot_rating double precision,
  contact_snapshot_segment text,
  contact_snapshot_taken_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_score_desc_idx on public.leads (score desc nulls last);
create index leads_location_gix on public.leads using gist (location);
create index leads_verified_at_idx on public.leads (verified_at);
create index leads_normalized_name_idx on public.leads (
  lower(regexp_replace(display_name, '[^a-zA-Z0-9]+', ' ', 'g'))
);

-- Snapshot current scoring inputs the first time an operator records contact.
-- Subsequent contact_status edits and all sweep upserts leave the snapshot alone.
create or replace function public.leads_snapshot_on_first_contact()
returns trigger
language plpgsql
as $$
begin
  if old.contact_status is null
     and new.contact_status is not null
     and old.contact_snapshot_taken_at is null
     and new.score is not null
     and new.segment is not null then
    new.contact_snapshot_score := new.score;
    new.contact_snapshot_breakdown := new.score_breakdown;
    new.contact_snapshot_user_rating_count := new.user_rating_count;
    new.contact_snapshot_rating := new.rating;
    new.contact_snapshot_segment := new.segment;
    new.contact_snapshot_taken_at := coalesce(new.contacted_at, now());
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger leads_snapshot_on_first_contact
  before update on public.leads
  for each row
  execute function public.leads_snapshot_on_first_contact();

-- API read surface only. Operators edit the base table in the table editor;
-- Supabase cannot edit through a view, so this must not become the operator UI.
create or replace view public.qualified_leads as
select *
from public.leads
where segment is not null
  and exclusion_reason is null;
