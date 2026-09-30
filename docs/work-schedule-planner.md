# Plánovač směn terapeuta

## Cíl

Umožnit terapeutce spravovat vlastní pracovní dobu a adminovi spravovat pracovní dobu obou terapeutek. Plánovač pracuje s opakovanými šablonami a jednorázovými výjimkami. Rezervace smějí používat pouze efektivní pracovní intervaly vrácené serverem.

## Model plánování

### 1. Týdenní šablony

- Šablona patří právě jednomu aktivnímu terapeutovi.
- Den týdne je 1 až 7, kde 1 je pondělí a 7 neděle.
- Jeden den může mít více intervalů, například `08:00-12:00` a `13:00-17:00`.
- Interval má `valid_from` včetně a nepovinné `valid_to` včetně.
- Šablona je aktivní jen v rozsahu platnosti a při `is_active = true`.
- Intervaly stejného terapeuta se nesmí překrývat ve stejné platnosti.
- Víkend lze uložit jen jako explicitně uzavřený den; běžný pracovní plán má pondělí až pátek.

### 2. Jednorázové výjimky

- Pro jedno datum existuje nejvýše jedna výjimka na terapeuta.
- `is_day_off = true` uzavře celý den.
- Jinak výjimka obsahuje jeden nebo více pracovních intervalů; pokud API zatím podporuje jen jeden interval, musí být limit explicitní a rozšíření zůstat kompatibilní.
- Výjimka má přednost před všemi šablonami pro dané datum.
- Výjimka na český svátek nemůže otevřít dostupnost pro rezervace.
- Změna se odmítne, pokud by existující aktivní rezervace ležela mimo nový pracovní interval. Omluvené a zrušené rezervace kolizi nevytvářejí.

### 3. Efektivní kalendář

Pro datum se vyhodnotí v tomto pořadí:

1. neplatné datum, víkend nebo český svátek => žádné intervaly;
2. existující výjimka => její intervaly nebo zavřený den;
3. aktivní šablony platné pro datum a den týdne;
4. bez odpovídající šablony => žádné intervaly.

Intervaly se vracejí v časovém pořadí a bez překryvu. Rezervační dostupnost i plánovač musí používat stejný resolver.

## Oprávnění

| Operace | Terapeutka | Admin |
| --- | --- | --- |
| Číst vlastní efektivní kalendář | ano | ano |
| Číst kalendář druhé terapeutky | ne | ano |
| Vytvořit/upravit/deaktivovat vlastní šablonu | ano | ano |
| Vytvořit/upravit vlastní výjimku | ano | ano |
| Spravovat šablony/výjimky druhé terapeutky | ne | ano |
| Otevřít víkend nebo svátek | ne | ne |

Autorizace se kontroluje serverově podle `req.user.role` a `req.user.therapistId`; `therapistId` z URL/body není důkaz vlastnictví.

## UX plánovače

- Výchozí pohled je pracovní týden vybraného terapeuta.
- Každý den zobrazuje efektivní intervaly, stav `pracuje / volno / svátek` a zdroj `šablona / výjimka`.
- Terapeutka upravuje pouze vlastní rozvrh; admin nejprve vybere terapeutku.
- Týdenní šablona se upravuje po dnech a dovoluje přidat druhý interval.
- Jednorázová změna nabízí `zavřít den` nebo `nastavit intervaly`.
- Po uložení se obnoví efektivní kalendář ze serveru.
- Konflikt s rezervací zobrazí konkrétní datum a bezpečný další krok; klient nesmí změnu pouze optimisticky aplikovat.

## Akceptační scénáře

- Šablona platná od 1. října se nepoužije 30. září.
- Šablona s `valid_to = 15. října` se nepoužije 16. října.
- Výjimka `day_off` překryje pracovní šablonu.
- Dva intervaly jednoho dne se vrátí seřazené a rezervace může využít oba.
- Překrývající se interval je odmítnut bez částečného zápisu.
- Aktivní rezervace mimo novou dostupnost způsobí bezpečný konflikt a změna se neuloží.
- Omluvená rezervace neblokuje zúžení pracovní doby.
- Terapeutka nemůže číst ani měnit rozvrh druhé terapeutky.
- Sobota, neděle a český svátek zůstanou zavřené i přes šablonu.

## Zjištění současného stavu

- Existují tabulky `day_templates` a `schedule_overrides`.
- Existuje resolver `resolveWorkIntervals` a route `/api/v1/work-schedule`.
- Resolver nyní nefiltruje šablony podle `valid_from` a `valid_to`; to je nutné opravit před použitím plánovače.
- Současné write route nepoužívají transakci ani audit; API implementace to musí doplnit.
- Výjimky používají child tabulku `schedule_override_intervals`, takže jeden den může mít více nekolizních intervalů a přestávek. Staré hodnoty ve sloupcích `start_time`/`end_time` zůstávají jako kompatibilní fallback.