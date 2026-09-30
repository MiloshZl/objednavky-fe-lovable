# Matice oprávnění – rezervační systém

## 1. Role
- admin
- therapist

## 2. Základní pravidlo
- Každý endpoint musí kontrolovat přihlášení a oprávnění na backendu.
- Řádek, který není výslovně schválen, je BLOCKED.

| Aktér | Akce | Typ záznamu | Podmínka přístupu | Výsledek |
| --- | --- | --- | --- | --- |
| therapist | view dashboard | calendar | authenticated | povoleno |
| therapist | create reservation | reservation | authenticated + therapist may manage both therapists | povoleno |
| therapist | edit reservation | reservation | authenticated + owns record or same operational scope | povoleno |
| therapist | cancel reservation | reservation | authenticated + valid reservation state | povoleno |
| therapist | excuse reservation | reservation | authenticated + valid reservation | povoleno |
| therapist | update own schedule | schedule | authenticated + own therapist_id | povoleno |
| therapist | update other therapist schedule | schedule | authenticated + admin only | BLOCKED |
| therapist | view patient history | patient | authenticated + patient access allowed by policy | povoleno |
| therapist | edit patient | patient | authenticated + valid role policy | povoleno |
| admin | view all data | all | authenticated + admin | povoleno |
| admin | manage users | users | authenticated + admin | povoleno |
| admin | manage insurers + contract periods | insurer | authenticated + admin | povoleno |
| admin | revoke token | user/session | authenticated + admin | povoleno |
| admin | delete patient | patient | authenticated + admin, with policy and audit | povoleno pouze dle schváleného postupu |
| any | access without session | any | no valid session | BLOCKED |
| any | alter ID in URL | any | crafted id | BLOCKED |
| any | direct API access without UI | any | no session or invalid session | BLOCKED |

## 3. Povinné bezpečnostní testy
- Schválené i blokované scénáře musí být automaticky otestované.
- Test na cizí reservation ID, cizí schedule, cizí patient a cizí session.
- Test neplatné role a přístup přes URL parametr.

## 4. Upřesnění pro správu rezervací (27. 9. 2026)

Pro rezervační workflow mají následující konkrétní pravidla přednost před obecnými formulacemi „owns record“ a „crafted id“ výše. Vyplývají ze schválených oddílů 3 a 6 business zadání: obě terapeutky mohou objednávat, měnit, omlouvat a rušit termíny v obou kalendářích. Změna ID na jinou rezervaci v tomto společném rozsahu není porušením oprávnění; změna ID cizího rozvrhu nebo administrátorské relace ano.

| Aktér | Akce a endpoint pod `/api/v1` | Typ záznamu | Podmínka přístupu |
| --- | --- | --- | --- |
| ADMIN, THERAPIST | GET `/reservations`, `/reservations/therapists`, `/reservations/availability`, `/reservations/:id` | Kalendáře obou terapeutek | Platná relace a povolená role; terapeutka musí mít platné aktivní přiřazení |
| ADMIN, THERAPIST | POST `/reservations`, `/reservations/batch` | Jedna až šest rezervací obou terapeutek | Aktivní pacient a cílová terapeutka, validní čas, pracovní doba, smluvnost pojišťovny a bez kolize |
| ADMIN, THERAPIST | PATCH `/reservations/:id` | Aktivní rezervace obou terapeutek | Stejná validace jako vytvoření, kontrola aktuální verze |
| ADMIN, THERAPIST | POST `/reservations/:id/excuse`, `/reservations/:id/cancel` | Aktivní rezervace obou terapeutek | Povolený přechod stavu; historie se nemaže, opakování stejné operace nesmí vytvořit duplicitní audit |
| ADMIN, THERAPIST | GET `/reservations/:id/events` | Historie konkrétní rezervace | Stejný rozsah jako čtení rezervace; dle IT analýzy dostupná všem interním uživatelům |
| ADMIN, THERAPIST | POST `/patients/search` | Aktivní pacienti pro objednání | Minimální údaje pro jednoznačný výběr v obou kalendářích; hledaný text pouze v těle požadavku |
| ADMIN, THERAPIST | POST `/patients` | Nový pacient | Serverová validace; terapeutka vytváří pacienta pod vlastním přiřazením |
| THERAPIST | PATCH `/patients/:id` | Údaje pacienta | Zůstává kontrola vlastního `therapist_id`; společný kalendář neopravňuje k přepisu cizího pacienta |
| ADMIN | PATCH `/patients/:id` | Údaje pacienta | Platná administrátorská relace a serverová validace |
| ADMIN, THERAPIST | GET `/patients/:id` | Údaje pro editor klienta | ADMIN všichni aktivní pacienti; THERAPIST pouze vlastní `therapist_id`, jinak 404. Sdílený kalendář toto oprávnění nerozšiřuje. |
| Bez relace, odvolaná/neplatná relace, neaktivní účet, neznámá role | Všechny výše uvedené operace | Všechny uvedené záznamy | Zamítnuto na serveru |

Autentizaci vynucuje `authRequired`, role `authorize` na routerech; pravidla záznamů a vstupů kontrolují služby. Globální CSRF middleware chrání cookie požadavky měnící stav i POST hledání. Žádný nový endpoint nespravuje cizí pracovní dobu, účty ani relace. Všechny rezervační změny, jejich události a audit se potvrzují ve stejné transakci na jedné DB connection.
