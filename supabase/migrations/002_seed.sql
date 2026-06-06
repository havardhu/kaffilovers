-- Kaffilauget — optional seed data
-- Drop / skip in prod once you have real data.

-- Members (you should still also create them in Supabase Auth → Users
-- so they can actually log in. Match the email exactly.)
insert into public.members (name, email, phone, is_admin) values
  ('Håvard Hu',       'havard@example.no', '482 09 173', true),
  ('Kari Solbakken',  'kari@example.no',   '934 12 087', false),
  ('Ole Lien',        'ole@example.no',    '901 55 240', false),
  ('Ingrid Møller',   'ingrid@example.no', '918 64 502', false),
  ('Lars Berg',       'lars@example.no',   '975 31 688', false),
  ('Astrid Voll',     'astrid@example.no', '456 70 219', false),
  ('Tone Rygg',       'tone@example.no',   '913 28 446', false),
  ('Per Aas',         'per@example.no',    '489 60 351', false)
on conflict (email) do nothing;

-- Rounds
insert into public.rounds (id, label, deadline, deadline_iso, status, vat_rate, admin_fee) values
  ('2026-06', 'Juni-runden',  'onsdag 10. juni',  '2026-06-10', 'åpen',     15, 5),
  ('2026-07', 'Juli-runden',  'onsdag 9. juli',   '2026-07-09', 'planlagt', 15, 5),
  ('2026-05', 'Mai-runden',   'onsdag 14. mai',   '2026-05-14', 'lukket',   15, 5),
  ('2026-04', 'April-runden', 'onsdag 9. april',  '2026-04-09', 'lukket',   15, 5)
on conflict (id) do nothing;

-- Catalog (the same set seeded into each round for the demo)
do $$
declare
  r record;
begin
  for r in select id from public.rounds loop
    insert into public.round_coffees (round_id, coffee_key, name, notes, weight, price, sort_order) values
      (r.id, 'brasil-rosimeire',       'Brasil, Rosimeire, Mantiqueira, natural (B)',        'Myk og fruktig. Rødfrukt, plomme og brunt sukker. Søt og rund.',                  '250 g', 165, 0),
      (r.id, 'etiopia-chelchele',      'Etiopia, Chelchele, Yirgacheffe, vasket (B)',        'Floral og te-aktig. Sjasmin, bergamott og steinfrukt. Delikat og ren.',           '250 g', 195, 1),
      (r.id, 'kenya-gatomboya',        'Kenya, Gatomboya, Nyeri, vasket (B)',                'Sprudlende og saftig. Solbær, grapefrukt og rårørsukker. Høy syre.',              '250 g', 215, 2),
      (r.id, 'colombia-paraiso',       'Colombia, El Paraíso, Cauca, natural (E)',           'Rik og syrlig. Tropisk frukt, litchi og kanel. Eksperimentell prosess.',          '250 g', 210, 3),
      (r.id, 'guatemala-injerto',      'Guatemala, El Injerto, Huehuetenango, vasket (E)',   'Balansert og søt. Melkesjokolade, hasselnøtt og rødt eple.',                      '250 g', 185, 4),
      (r.id, 'rwanda-nyamasheke',      'Rwanda, Nyamasheke, vasket (B)',                     'Klar og søt. Aprikos, svart te og honning. Lett og elegant.',                     '250 g', 189, 5),
      (r.id, 'supreme-house-espresso', 'Supreme House Espresso, blanding (E)',               'Mørk sjokolade, karamell og valnøtt. Fyldig og rund i koppen.',                   '250 g', 159, 6),
      (r.id, 'peru-cajamarca',         'Peru, La Florida, Cajamarca, vasket (B)',            'Mild og nøtteaktig. Mandel, kakao og appelsin. Lav syre, snill.',                 '250 g', 169, 7)
    on conflict (round_id, coffee_key) do nothing;
  end loop;
end $$;
