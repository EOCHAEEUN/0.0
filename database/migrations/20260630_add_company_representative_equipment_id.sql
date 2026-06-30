-- Add representative equipment pointer for dashboard priority selection.
-- Applied concept: company.representative_equipment_id references equipment.equipment_id

alter table public.company
  add column if not exists representative_equipment_id uuid null;

comment on column public.company.representative_equipment_id is
  'Optional primary equipment for dashboard priority actions. Must belong to the same company.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'company_representative_equipment_id_fkey'
  ) then
    alter table public.company
      add constraint company_representative_equipment_id_fkey
      foreign key (representative_equipment_id)
      references public.equipment (equipment_id)
      on delete set null;
  end if;
end $$;
