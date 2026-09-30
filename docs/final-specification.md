# Finální specifikace projektu – rezervační systém fyzioterapie

## 1. Cíl
Interní webová aplikace pro dvě terapeutky a administrátora. Aplikace slouží k evidenci rezervací, pacientů, pracovní doby a dostupnosti s důrazem na jednoduché ovládání zejména na mobilu. Pacienti se neobjednávají sami.

## 2. Role a oprávnění
- admin: správa všech dat, účtů, pojišťoven, smluvních období a relací
- therapist: vlastní pracovní doba, přehled rezervací a práce s pacienty, změna objednávek u obou terapeutek

## 3. Auth a relace
- Přihlášení používá login + 32 znakový token.
- Token se uživateli předává osobně nebo přes interní admin-only bezpečný kanál. Nikdy ne přes e-mail, SMS ani chat.
- Token se v DB ukládá pouze v hashované podobě.
- Session ID je v cookie, ne v URL.
- Cookie: HttpOnly, Secure, SameSite=Lax, path=/, short-lived, revokable.
- Session má platnost 30 dní nečinnosti a max. 180 dní absolutně.
- Po odhlášení, zneplatnění tokenu nebo změně zařízení se relace okamžitě zruší.
- Admin může zneplatnit vybrané zařízení i všechna zařízení uživatele.

## 4. Business pravidla
- Vznikají přesně tři interní účty: dvě terapeutky + admin.
- Jednorázová změna má přednost před šablonou.
- Omluvená rezervace nezapočítává do sedmé návštěvy.
- Víkend a české svátky nejsou dostupné.
- Délka návštěvy je 45 nebo 60 minut, výchozí 45.
- V jednom postupu lze vytvořit až šest sezení.
- Při sedmé a další rezervaci se zobrazuje varování, ale uložení není blokováno.
- Potvrzeno vlastníkem 27. 9. 2026: rezervace uchovává pojišťovnu platnou při svém vytvoření. Změna pojišťovny na kartě pacienta nepřepočítá staré rezervace; nové rezervace se započítávají pod novou pojišťovnou. Prostý přesun rezervace její původní pojišťovnu nemění.
- Dva pacienti se stejnými údaji mohou být rozlišeni výjimkou a poznámkou.
- Tabulka `holidays` musí obsahovat platná data státních svátků pro daný rok a projekt musí připravit automatickou aktualizaci tohoto seznamu jednou za měsíc.

## 5. Data a model
- Databáze MySQL v utf8mb4, čas v Europe/Prague.
- Všechna write operace běží v transakci.
- Audit uchovává autora, čas a staré/nové hodnoty.
- `holidays` je zdroj pravdy pro uzavřené dny; FE používá stejná data pouze jako UX pomoc, nikoli jako autorizaci.

## 6. API
- API pod /api/v1.
- Serverová validace všech vstupů.
- Jednotný formát chyb.
- Backend validuje oprávnění pro každý endpoint.

## 7. Security hardening
- deny by default
- IDOR protection
- CSRF protection pro cookie-based requests
- rate limiting a brute-force protection pro login
- logy bez tokenů, cookies, telefonních čísel a zdravotních dat
- žádné citlivé hodnoty v frontend buildu ani URL

## 8. Mobilní UX
- denní přehled v první řadě
- přepínání terapeutek a společného pohledu
- rychlá rezervace, jednoduché formuláře, minimum kliknutí
- jasné stavy rezervací a upozornění

## 9. Otevřená rozhodnutí
- přesný formát a mechanismus token handover je formálně admin-only a osobní
- retence auditních logů a data pacientů je pro projekt přesně definována v samostatné dokumentaci
- přesný interval startu je 15 minut, nikoli 5/10/15 v první verzi

## 10. Implementace správy rezervací

Aktuální API kontrakt, způsob migrace a hranice ověření jsou v [reservation-management.md](reservation-management.md). Konkrétní oprávnění rezervačního workflow upřesňuje [permission-matrix.md](permission-matrix.md), oddíl 4.
