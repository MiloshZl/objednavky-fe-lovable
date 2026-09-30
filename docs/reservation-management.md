# Správa rezervací – první implementace

Datum: 27. 9. 2026. Implementace vychází z business zadání, IT analýzy, finální specifikace a projektových backendových, frontendových, bezpečnostních a provozních promptů. Pravidla přístupu jsou v [matici oprávnění, oddíl 4](permission-matrix.md).

## Chování

- Výchozí obrazovka pro administrátora i terapeutky je denní přehled. Datum, terapeutka nebo obě, délka 45/60 minut; rezervace a nabídka volných časů.
- Pacient se vybírá jednou; v jednom uložení lze objednat 1–6 návštěv. Celá dávka uspěje, nebo se celá vrátí zpět. Jeden obsazený termín nesmí způsobit částečné uložení.
- Aktivní termín lze přesunout nebo změnit jeho délku. Omluvení a zrušení zachovává záznam a historii; oba stavy uvolní čas a nezapočítávají se do upozornění.
- Náhradní rezervace je nový záznam se stejným pacientem a odkazem na původní omluvený termín. Nesmí vzniknout dvě aktivní náhrady téhož termínu.
- Výchozí délka je 45 minut, začátky po 15 minutách. Celá návštěva musí ležet v pracovním intervalu. Jednorázová změna dne má přednost před šablonou. Víkend a svátek z tabulky `holidays` se nenabízí.
- Sedmá a další započítávaná návštěva pojištěného pacienta v roce termínu vrací informativní upozornění, které neblokuje uložení. Samoplátci upozornění nepodléhají. Výslovné výjimky různých osob v `patient_identity_exceptions` se zohledňují.
- Vlastník 27. 9. 2026 potvrdil zachování původní pojišťovny na starších rezervacích. Nová rezervace standardně získá `insurer_type_snapshot` a `insurer_id_snapshot` z uzamčeného záznamu pacienta. Přesun rezervace snímek nemění. Náhradní termín je nová rezervace a použije aktuální pojišťovnu. Od 29. 9. 2026 lze při objednání výslovně zvolit samoplátce nebo změnit úhradu jedné aktivní návštěvy; viz [karta pacienta a úhrada](reservation-patient-card.md).

## API pod `/api/v1`

Každá odpověď má obálku `{success:true,data:...}` nebo standardní chybu. Všechny níže uvedené trasy vyžadují aktivní relaci a roli ADMIN nebo THERAPIST s platným přiřazením. Požadavky POST/PATCH vyžadují CSRF ochranu. Citlivé odpovědi mají `Cache-Control: no-store`.

| Metoda a cesta | Vstup / účel |
| --- | --- |
| GET `/reservations/therapists` | Aktivní terapeutky, `id` a `display_name` |
| GET `/reservations?date=2026-09-29&therapistId=1` | Denní přehled; filtr terapeutky je volitelný |
| GET `/reservations/availability?therapistId=1&date=2026-09-29&durationMinutes=45` | Volné sloty `{start,end}`; při přesunu volitelně `excludeReservationId` |
| GET `/reservations/:id` | Detail rezervace |
| GET `/reservations/:id/events` | Historie s autorem, časem a starými/novými hodnotami |
| POST `/reservations` | `{patientId,therapistId,startAt,durationMinutes}`; pro náhradu navíc `originalReservationId` |
| POST `/reservations/batch` | `{patientId,sessions:[{therapistId,startAt,durationMinutes}]}`; 1–6 položek |
| PATCH `/reservations/:id` | Změna terapeutky, začátku či délky; `expectedUpdatedAt` z naposledy načtené rezervace |
| POST `/reservations/:id/excuse` | Omluvení; `{expectedUpdatedAt}` |
| POST `/reservations/:id/cancel` | Zrušení; `{expectedUpdatedAt}` |
| POST `/patients/search` | `{query}`; sdílený výběr pacientů, bez hledaného jména/telefonu v URL |

Časy v API obsahují explicitní offset, např. `2026-09-29T09:00:00+02:00`. Backend převádí do `Europe/Prague` nezávisle na pásmu hostitele. Stávající `DATETIME` sloupce uchovávají pražský místní čas; kód je zpracovává jako řetězce, nikoli přes pevný letní offset ovladače. `updated_at` slouží jako neprůhledná verze záznamu; klient ji nemá převádět do jiného pásma.

Rezervace ve výpisu obsahuje `id`, `patient_id`, `patient_name`, `therapist_id`, `therapist_name`, `start_at`, `end_at`, `duration_minutes`, `status`, `updated_at` a `warning`. Neznámé vstupní klíče a neplatné identifikátory se odmítají. Při souběžné změně klient obnoví přehled a uživatel výběr ověří; změna se automaticky neopakuje.

## Transakce a souběh

Každý rezervační zápis získá jednu vyhrazenou connection z poolu, začne transakci a uzamkne řádky terapeutek ve stabilním pořadí. Pro tento systém se dvěma terapeutkami zámek serializuje i výpočet počtu návštěv společného pacienta napříč kalendáři. Po získání zámků proběhne kontrola pacienta, pracovní doby, pojištění, kolize a stavu. Rezervace, `reservation_events` a `audit_log` se potvrdí společně. Při chybě se vše vrátí zpět a connection se uvolní.

Budoucí zápisy pracovní doby musí získat stejný zámek terapeutky před změnou šablon či výjimek a ověřit stávající rezervace. Obecné auditní logy zůstávají administrátorské; historie jednotlivé rezervace je sdílená podle IT analýzy. Provozní chybové logy obsahují pouze kód HTTP, metodu a serverem vygenerované ID požadavku, nikdy surovou chybu MySQL nebo SQL.

## Příprava databáze

Nová databáze používá [úplné schéma](sql-migrations.sql). Existující databáze potřebuje [inkrementální migraci](../backend/migrations/20260927_reservation_insurance.sql). Migrace se během vývoje automaticky nespouští.

1. Zálohujte databázi a ověřte možnost obnovy; migraci nejprve vyzkoušejte na oddělené kopii.
2. Zastavte aplikační zápisy. V databázovém klientu explicitně vyberte správnou databázi a v migračním souboru vyplňte ID aktivního administrátora pro audit. Nevyplněné ID migraci zastaví před změnou schématu.
3. Spusťte jednorázovou migraci a ověřte nenulový typ pojištění všech rezervací. DDL MySQL implicitně potvrzuje změny; po selhání zkontrolujte stav a neopakujte celý skript naslepo.
4. Staré záznamy nemají historickou pojišťovnu uloženou. Migrace použije aktuální kartu pacienta a každý takový odhad označí v auditu `insurance_snapshot_baselined` s `inferredFromCurrentPatient:true`. U pacientů, kteří pojišťovnu již měnili, je nutné historické hodnoty ověřit z původních podkladů. Migrace ztracenou historii nedokáže rekonstruovat.
5. Před spuštěním API zkontrolujte platné pracovní šablony, smluvní období pojišťoven a kalendář svátků pro plánované roky.

## Svátky a provoz na Synology

Generátor obsahuje 13 českých svátků pro rok, včetně Velkého pátku, Velikonočního pondělí, 6. července a Štědrého dne. Opravené datumy vycházejí z [kalendáře ČNB](https://www.cnb.cz/cs/verejnost/servis-pro-media/harmonogramy-a-dalsi-informace/svatky-v-ceske-republice/). Původní chybné záznamy 1. března, Nanebevstoupení a Letnic nejsou české dny pracovního klidu.

Z adresáře backendu se aktualizace připraví příkazem `npm run db:refresh-holidays -- 2026 ADMIN_ID` (nahraďte `ADMIN_ID` platným ID). Skript vyžaduje přístup ke správné databázi přes serverové prostředí, pracuje v transakci, zamyká terapeutky a ukládá audit. Přepisuje pouze vlastní zdroje `cz-generated` a `cz-official`; ruční uzavírky zachová. Nově uzavřený den s aktivní rezervací odmítne, aby ji nevyřadil z pracovní doby.

V Synology Task Scheduleru nastavte měsíční spuštění pro aktuální a následující rok uvnitř backendového kontejneru, po přípravě zálohy. Skutečný název kontejneru, tajné proměnné, HTTPS proxy a plánovač zůstávají záležitostí cílového prostředí; v této iteraci nebyl NAS změněn. API a MySQL patří do privátní sítě, prohlížeč používá HTTPS se společným původem frontend/API. Tajné proměnné se nikdy nepředávají do Vite buildu.

## Ověření a navazující práce

Automatické testy pokrývají pravidla termínů, oprávnění, životnost relace, CSRF, dávkové vrácení změn, audit a pojistné snímky. Frontend se kontroluje TypeScriptem, produkčním buildem a lintem. Přesný výsledek běhu je uveden v předání implementace.

V tomto prostředí není dostupný připojený prohlížeč ani běžící Docker daemon. Testy s náhradou DB nenahrazují integrační ověření zámků a migrace na skutečné MySQL. Před nasazením je nutné provést dva souběžné zápisy do stejného slotu (právě jeden uspěje), zkontrolovat vrácení celé dávky při kolizi, migraci a mobilní workflow na iPhonu/Samsungu.

Původní blokace jména a roku narození u klienta s historií byla na požadavek vlastníka nahrazena výslovnou opravou stejného klienta s kontrolou verze, oprávnění a auditem `identity_corrected`. Oprava zachovává ID, vazby rezervací a jejich pojistné snímky; aktuální opravená identita se používá i v historických přehledech a při počítání shodných návštěv. Podrobnosti obsahuje [karta pacienta a úhrada](reservation-patient-card.md). Správa výjimek shodné identity zůstává samostatnou navazující oblastí.
