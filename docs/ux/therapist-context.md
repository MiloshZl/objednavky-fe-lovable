# Návrh: rozlišení vlastního plánu a plánu kolegyně

Stav: schválený návrh implementovaný ve frontendu. Ukázková jména v samostatném HTML náhledu nejsou skutečná data.

## Problém

`ReservationsPage` dříve používal nadpis „Můj plán“ i při výběru druhé terapeutky nebo obou. Výběr terapeutky měnil obsah, ale hlavní nadpis ani okolní vzhled neukazovaly změnu pracovního kontextu.

## Doporučené řešení

1. Současný obecný nadpis nahradit kompaktním pruhem s režimem a skutečným jménem. Vlastní plán: „Můj plán / Jana Nováková“. Cizí plán: „Plán kolegyně / Petra Svobodová“. Obě: „Společný přehled / Obě terapeutky“.
2. Barvou kódovat vztah k přihlášené terapeutce: vlastní zelenomodrá, kolegyně fialová. Jde o barvy režimu, nikoli trvale přiřazené osobám; po přihlášení druhé terapeutky se vztah obrátí. Pro admina použít neutrální režim „Plán terapeutky / jméno“, bez označení „můj“ a „kolegyně“.
3. Barvu použít na bočním pruhu širokém 8 px a jemném pozadí kontextového pruhu, ve výběru terapeutky a na okraji skupiny rezervací. Stejnou šířku použít v denním a týdenním přehledu, výsledcích hledání a vybraných termínech. Karty zůstávají světlé/kontrastní a kompaktní. Červená a oranžová zůstávají vyhrazené chybám a upozorněním, včetně sedmé návštěvy.
4. Pro právě dvě terapeutky použít přímé přepnutí „Můj plán / jméno kolegyně / Obě“. V cizím a společném přehledu nabídnout „← Můj plán“ na jedno klepnutí. Zachovat vybrané datum.
5. Kontextový pruh při rolování skutečné aplikace ponechat sticky; nahradí stávající nadpis, nepřidává další velký banner. Na malém displeji se jméno zalomí, nikoli ořízne. V náhledu není simulované vnitřní rolování.
6. V pohledu obou je horní pruh neutrální a každá skupina má vlastní označení „já / kolegyně“ a barvu. Karty nepřebírají dvě různé barevné informace současně.
7. Akce objednání nese cíl: „Objednat u mě / Objednat · celé jméno“. Celé jméno nevyžaduje automatické skloňování. Formulář a závěrečné shrnutí opakují jméno skutečné terapeutky termínu. Klik na konkrétní volný čas přebírá jeho terapeutku. Obecné objednání z pohledu obou vyžaduje výběr terapeutky, bez skrytého předvýběru. Dávka termínů u obou terapeutek ukáže obě jména a označí jednotlivé termíny.
8. Barva vždy doplňuje text, nikdy jej nenahrazuje. Přepnutí oznamuje `aria-live`, ovládání je přístupné klávesnicí. Žádné potvrzovací okno pouze kvůli přepnutí plánu.

## Vizuální hodnoty pro světlé téma

- Vlastní: akcent `#286E67`, jemné pozadí `#E8F3EF`.
- Kolegyně: fialový akcent `#70509B`, jemné pozadí `#F1EBF8`.
- Obě/admin: neutrální `#51616A`, pozadí `#EDF1F3`.

Na žádost uživatele z 30. 9. 2026 zůstává původní zelenomodrá/fialová kombinace; pro lepší viditelnost jsou boční pruhy rozšířené na 8 px. Samostatný HTML náhled zachycuje původní návrh s tenčími pruhy a používá také varianty pro tmavý vzhled.

## Dopad na implementaci

Rozlišení je čistě frontendové: používá `ownTherapistId`, vybraný `therapistId` i seznam jmen. Žádná nová oprávnění, DB pole ani endpointy nejsou potřeba. Stejný kontext je implementovaný také v týdnu, dvoutýdenním přehledu a vyhledávání termínů. Vyhledávací filtr a hlavní přepínač sdílí výběr terapeutky. Při změně terapeutky mizí staré výsledky; vyhledávání navíc váže výsledky na aktuální dotaz. Nový formulář z pohledu obou nemá automatický výběr vlastní/první terapeutky; konkrétní slot si terapeutku zachovává. Vlastnictví klienta a serverová oprávnění se nemění.

Testy ani regresní běhy nebyly spouštěny podle vývojového režimu projektu. Proběhla statická kontrola TypeScriptu. Scénáře pro závěrečné ověření jsou v `docs/deferred-regression.md`.
