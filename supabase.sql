-- شغّل هذا الملف مرة واحدة داخل Supabase > SQL Editor
create extension if not exists pgcrypto;

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  car_number text not null,
  car_type text not null,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ride_requests (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null,
  phone text not null,
  pickup text not null,
  destination text not null,
  request_type text not null check (request_type in ('now','later')),
  scheduled_at timestamptz,
  passengers int not null default 1 check (passengers between 1 and 12),
  notes text,
  status text not null default 'new' check (status in ('new','contacted','confirmed','on_the_way','completed','cancelled')),
  driver_id uuid references public.drivers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_ride_updated on public.ride_requests;
create trigger trg_ride_updated before update on public.ride_requests for each row execute function public.set_updated_at();

alter table public.ride_requests enable row level security;
alter table public.drivers enable row level security;

-- الزائر يستطيع فقط إنشاء طلب، ولا يستطيع قراءة الطلبات.
drop policy if exists "public can create ride request" on public.ride_requests;
create policy "public can create ride request" on public.ride_requests for insert to anon with check (true);

-- المدير المسجل في Supabase Auth يستطيع إدارة الطلبات والسائقين.
drop policy if exists "authenticated manage rides" on public.ride_requests;
create policy "authenticated manage rides" on public.ride_requests for all to authenticated using (true) with check (true);
drop policy if exists "authenticated manage drivers" on public.drivers;
create policy "authenticated manage drivers" on public.drivers for all to authenticated using (true) with check (true);

create index if not exists ride_status_idx on public.ride_requests(status);
create index if not exists ride_phone_idx on public.ride_requests(phone);
create index if not exists ride_order_number_idx on public.ride_requests(order_number);
