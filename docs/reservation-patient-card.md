# Karta objednaného pacienta a úhrada návštěvy

Změna podle požadavku vlastníka z 29. 9. 2026.

- Denní karta má dvě hlavní řádky: čas a jméno; telefon s `tel:`, rok a krátké označení úhrady. Pojišťovnu klienta opakuje pouze při odlišné úhradě návštěvy. Vynechává stav „Aktivní“, opakované jméno terapeutky a vysvětlení běžných pojmů. Dlouhá poznámka se rozbaluje. Akce jsou pod „⋯“ včetně editace, změny termínu/úhrady, omluvení, zrušení a náhrady.
- „Upravit klienta“ otevírá formulář přímo v kartě, také při výběru pacienta pro nové objednání. Terapeutka smí upravit vlastního pacienta, admin všechny. Cizí poznámka se neposílá do prohlížeče. Lze opravit i jméno a rok narození klienta s historií; jde o výslovnou opravu stejné osoby, nikoli přiřazení rezervací jinému klientovi.
- Pojišťovna klienta je výchozí volba pro nová objednání. Samoplátce lze zvolit pro právě objednávaných 1–6 návštěv bez změny klienta. U existující aktivní rezervace lze samostatně změnit úhradu; ostatní rezervace se nemění.
- Změna úhrady podléhá stejným oprávněním jako změna rezervace. Kontroluje se stav, verze, případný smluvní vztah pojišťovny pro datum návštěvy a pravidla termínu. Změna, událost a audit jsou v jedné transakci. Samoplátce se nezapočítává do sedmé pojištěné návštěvy.

## API

- `GET /api/v1/patients/:id`: vlastní aktivní pacient terapeutky nebo pacient přístupný adminovi; jinak 404. Vrací údaje pro editor, `has_reservations`, `updated_at` a `can_edit`. Bez relace zamítá autentizační vrstva.
- `PATCH /api/v1/patients/:id`: editor posílá `expectedUpdatedAt`; stará verze vrací 409 `PATIENT_STALE`. Verze se při zápisu monotónně zvýší. Dosavadní transakce, audit a kontrola vlastníka platí i bez UI.
- Při změně jména nebo roku je `expectedUpdatedAt` povinné. Pokud existují rezervace, vyžaduje se `correctIdentity: true`; chybějící potvrzení vrací 409 `PATIENT_IDENTITY_CONFIRM_REQUIRED`. Zápis zamyká terapeutky ve stejném pořadí jako rezervace a následně klienta. Audit `identity_corrected` uchovává autora, čas a původní/nové hashe změněných údajů. Zůstává stejné ID klienta i vazby rezervací; opravená identita se projeví v historických přehledech a výpočtu shody pro sedmou návštěvu. Pojistné snímky rezervací se nemění.
- Oprava ostatních údajů při nezměněné pojišťovně nevyžaduje její současnou smluvnost. Změna pojišťovny nadále ověřuje platnou smlouvu.
- Odpovědi rezervací obsahují `patient` s povolenými údaji a `can_edit`; poznámka je dostupná pouze vlastníkovi a adminovi. `insurer_type_snapshot`, `insurer_id_snapshot`, `insurer_code`, `insurer_name` nadále popisují návštěvu. Údaje připojeného pacienta se nekopírují do událostí ani auditu rezervací.
- `POST /reservations`, `POST /reservations/batch`, `POST /reservations/preview` přijímají volitelné `paymentMode`: `PATIENT` používá údaje uzamčeného pacienta, `SELF_PAY` ukládá `UNINSURED` / `null`. Vynechání zachovává dosavadní chování. Pro dávku platí jedna volba pro všechny její návštěvy.
- `PATCH /reservations/:id` přijímá stejné `paymentMode`, také bez změny času. Při jeho uvedení je povinná platná `expectedUpdatedAt`. Bez `paymentMode` se původní úhrada zachová. Výslovná změna vytváří událost `updated` se starými a novými hodnotami. Neznámé režimy a přímé zadávání pojistných snímků jsou odmítnuty.

Nová databázová migrace není potřeba. Po poslední úpravě karty a povolení oprav identity nebyly podle pokynu vlastníka spuštěny testy. Potřebné aktualizace existujících testů a závěrečné scénáře jsou v [odloženém regresním ověření](deferred-regression.md). Dřívější výsledky testů se na tuto změnu nevztahují.
