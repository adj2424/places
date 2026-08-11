create or replace function public.record_swept_cells(rows jsonb)
returns void
language plpgsql
as $$
declare
  item jsonb;
begin
  for item in select * from jsonb_array_elements(rows)
  loop
    insert into public.swept_cells (
      center,
      radius_meters,
      coverage,
      swept_at,
      incomplete
    ) values (
      ST_Transform(
        ST_SetSRID(
          ST_MakePoint(
            (item->>'center_lon')::double precision,
            (item->>'center_lat')::double precision
          ),
          4326
        ),
        32618
      ),
      (item->>'radius_meters')::double precision,
      ST_Buffer(
        ST_Transform(
          ST_SetSRID(
            ST_MakePoint(
              (item->>'center_lon')::double precision,
              (item->>'center_lat')::double precision
            ),
            4326
          ),
          32618
        ),
        (item->>'radius_meters')::double precision
      ),
      (item->>'swept_at')::timestamptz,
      coalesce((item->>'incomplete')::boolean, false)
    );
  end loop;
end;
$$;

create or replace function public.list_fresh_swept_circles(fresh_since timestamptz)
returns table (lon double precision, lat double precision, radius_meters double precision)
language sql
stable
as $$
  select
    ST_X(ST_Transform(center, 4326)) as lon,
    ST_Y(ST_Transform(center, 4326)) as lat,
    swept_cells.radius_meters
  from public.swept_cells
  where swept_at >= fresh_since;
$$;
