alter table public.leads
  add column preferred_state text,
  add column preferred_city text,
  add column preferred_areas text[];

update public.leads
set
  preferred_state = case
    when preferred_location ilike '%johor%' then 'Johor'
    when preferred_location ilike '%kedah%' then 'Kedah'
    when preferred_location ilike '%kelantan%' then 'Kelantan'
    when preferred_location ilike '%melaka%' then 'Melaka'
    when preferred_location ilike '%negeri sembilan%' then 'Negeri Sembilan'
    when preferred_location ilike '%pahang%' then 'Pahang'
    when preferred_location ilike '%penang%' then 'Penang'
    when preferred_location ilike '%perak%' then 'Perak'
    when preferred_location ilike '%perlis%' then 'Perlis'
    when preferred_location ilike '%sabah%' then 'Sabah'
    when preferred_location ilike '%sarawak%' then 'Sarawak'
    when preferred_location ilike '%selangor%' then 'Selangor'
    when preferred_location ilike '%terengganu%' then 'Terengganu'
    when preferred_location ilike '%kuala lumpur%'
      or preferred_location ilike '% kl %'
      or preferred_location ilike 'kl %'
      or preferred_location ilike '% kl'
      or preferred_location ilike 'kl' then 'Kuala Lumpur'
    when preferred_location ilike '%labuan%' then 'Labuan'
    when preferred_location ilike '%putrajaya%' then 'Putrajaya'
    else preferred_state
  end,
  preferred_city = case
    when preferred_location ilike '%mont kiara%' then 'Mont Kiara'
    when preferred_location ilike '%bangsar%' then 'Bangsar'
    when preferred_location ilike '%bukit bintang%' then 'Bukit Bintang'
    when preferred_location ilike '%cheras%' then 'Cheras'
    when preferred_location ilike '%damansara%' then 'Damansara'
    when preferred_location ilike '%desa parkcity%' then 'Desa ParkCity'
    when preferred_location ilike '%klcc%' then 'KLCC'
    when preferred_location ilike '%petaling jaya%' or preferred_location ilike '% pj %' then 'Petaling Jaya'
    when preferred_location ilike '%puchong%' then 'Puchong'
    when preferred_location ilike '%setapak%' then 'Setapak'
    when preferred_location ilike '%shah alam%' then 'Shah Alam'
    when preferred_location ilike '%subang jaya%' then 'Subang Jaya'
    when preferred_location ilike '%taman desa%' then 'Taman Desa'
    when preferred_location ilike '%ttdi%' then 'TTDI'
    else preferred_city
  end
where preferred_location is not null;

update public.leads
set preferred_areas = array[preferred_city]
where preferred_city is not null
  and preferred_areas is null;

create index leads_preferred_state_idx on public.leads(team_id, preferred_state);
create index leads_preferred_city_idx on public.leads(team_id, preferred_city);
