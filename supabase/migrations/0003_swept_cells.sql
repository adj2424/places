-- Swept cells store the query circle that was issued, not the square cell.
-- Containment answers "is this circle wholly inside fresh covered ground?"

create table public.swept_cells (
  id bigserial primary key,
  center geometry(Point, 32618) not null,
  radius_meters double precision not null check (radius_meters > 0),
  -- Materialized buffer used by containment queries.
  coverage geometry(Polygon, 32618) not null,
  swept_at timestamptz not null,
  incomplete boolean not null default false,
  request_params jsonb not null default '{}'::jsonb
);

create index swept_cells_coverage_gix on public.swept_cells using gist (coverage);
create index swept_cells_swept_at_idx on public.swept_cells (swept_at desc);

create or replace function public.swept_cells_set_coverage()
returns trigger
language plpgsql
as $$
begin
  new.coverage := ST_Buffer(new.center, new.radius_meters);
  return new;
end;
$$;

create trigger swept_cells_set_coverage
  before insert or update of center, radius_meters on public.swept_cells
  for each row
  execute function public.swept_cells_set_coverage();

-- True when the query circle lies entirely inside the union of fresh coverage.
create or replace function public.is_circle_fully_covered(
  lon double precision,
  lat double precision,
  radius_meters double precision,
  fresh_since timestamptz
)
returns boolean
language sql
stable
as $$
  with query_circle as (
    select ST_Buffer(
      ST_Transform(ST_SetSRID(ST_MakePoint(lon, lat), 4326), 32618),
      radius_meters
    ) as geom
  ),
  covered as (
    select ST_UnaryUnion(ST_Collect(coverage)) as geom
    from public.swept_cells
    where swept_at >= fresh_since
  )
  select coalesce(
    ST_Covers((select geom from covered), (select geom from query_circle)),
    false
  );
$$;
