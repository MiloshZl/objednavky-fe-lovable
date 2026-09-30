# Prompt pro Lovable: revize frontendu RehaFlex pro rychlou práci terapeutky

Jsi seniorní produktový designér se zkušeností s každodenními pracovními aplikacemi, specialista na responzivní UX a frontendový architekt React + TypeScript. Proveď důkladnou revizi **současného frontendu RehaFlex** a navrhni konkrétní úpravy pro desktop i mobil.

Hlavní cíl: **terapeutka co nejrychleji zjistí, co potřebuje, a bezpečně dokončí práci s co nejmenším počtem kliknutí, přepnutí, rolování a opakovaného zadávání údajů.** Vedle rychlosti úkolů snižuj riziko záměny pacienta, terapeutky, dne a úhrady. Technický výkon má tuto práci podporovat.

## 1. Rozsah této zakázky

- Nyní připrav **audit a návrh změn**, nikoli implementaci. Neupravuj aplikační kód, závislosti, backend, databázi, API, přihlašování ani infrastrukturu a nic nenasazuj.
- Výsledkem má být realizovatelný podklad pro úpravy existujícího frontendu. Posuzuj skutečný projekt, nepřepisuj jej do obecné rezervační šablony.
- Frontend používá React + TypeScript + Vite a vlastní CSS. Zachovej tuto architekturu. Automaticky nenavrhuj migraci na jiný framework, Tailwind, novou komponentovou knihovnu, Supabase ani Lovable Cloud.
- Návrhy vyžadující nové API nebo změnu obchodních pravidel jasně odděl jako závislosti mimo rozsah. Hlavní doporučené řešení musí být proveditelné nad současnými kontrakty.
- Pokud nemáš přístup k repozitáři nebo bezpečnému náhledu, výslovně to uveď a označ, co potřebuješ doplnit. Nedomýšlej si současné obrazovky, měření ani provedené ověření. Nesdělené přihlašovací údaje nevyžaduj do chatu.

## 2. Kontext a měřítko úspěchu

Jde o interní rezervační systém fyzioterapie pro **dvě terapeutky a administrátora**, tedy přesně tři interní účty. Pacienti se sami neobjednávají. Terapeutka pracuje mezi návštěvami a při domlouvání termínu s pacientem, často jednou rukou na telefonu; u počítače potřebuje rychlý přehled a pohodlné plánování více návštěv.

Optimalizuj v tomto pořadí:

1. Správnost a bezpečnost dokončení úkolu, srozumitelnost pracovního kontextu.
2. Rychlost běžné práce a snížení mentální námahy.
3. Čitelnost, dostupnost akcí a vhodná hustota informací pro dané zařízení.
4. Odezva rozhraní a rozumné množství síťových požadavků.
5. Vizuální sjednocení a estetika.

Navrhuj pracovní nástroj, nikoli prezentační web. Velké uvítací bloky, dekorativní grafy, přebytečné statistiky nebo animace bez přínosu pro úkol nemají prioritu. Vzhled má být klidný, kompaktní, dobře čitelný a kompletně česky.

## 3. Nejprve prostuduj podklady a skutečný stav

Začni obchodními pravidly, potom propoj API kontrakt, frontendovou validaci a UI. Přečti:

- `AGENTS.md`
- `zadani_rezervacni_system_fyzioterapie_pracovni_navrh.md`
- `IT_analyza_rezervacni_system_fyzioterapie(1).md`
- `docs/final-specification.md`
- `docs/mobile-ux-spec.md`
- `docs/frontend-ux-redesign-proposal.md`
- `docs/ux/therapist-context.md`
- `docs/reservation-patient-card.md`
- `docs/reservation-management.md`
- `docs/work-schedule-planner.md`
- `docs/permission-matrix.md`
- `docs/api-spec.md`
- `docs/deferred-regression.md`

Dokumentace obsahuje i historické návrhy a popisy dřívějšího stavu. Novější výslovně schválená pravidla mají přednost před staršími návrhy. Existenci funkce ověř v aktuálním kódu; při rozporu rozliš zamýšlené pravidlo a skutečné chování. Nejasné obchodní rozhodnutí označ, nepřijímej je za vlastníka.

Prohlédni zejména:

| Oblast | Soubory |
| --- | --- |
| Přihlášení, obal aplikace, navigace, administrace | `frontend/src/App.tsx`, `frontend/src/App.css`, `frontend/src/index.css` |
| Denní plán a přepínání kontextu | `frontend/src/features/reservations/ReservationsPage.tsx`, `therapistContext.ts` ve stejné složce |
| Týden a dva týdny | `frontend/src/features/reservations/WeekOverview.tsx` |
| Hledání volných termínů | `frontend/src/features/reservations/SlotFinder.tsx`, `planning.ts` ve stejné složce |
| Objednání a změna rezervace | `frontend/src/features/reservations/ReservationComposer.tsx` |
| Výběr, detail a oprava klienta | `PatientPicker.tsx`, `PatientDetails.tsx`, `PatientEditor.tsx` v `frontend/src/features/reservations/` |
| Karta návštěvy a její akce | `frontend/src/features/reservations/ReservationPatient.tsx` |
| Styly rezervací, typy, datum a úhrada | `reservations.css`, `types.ts`, `dates.ts`, `insurance.ts` v `frontend/src/features/reservations/` |
| Směny a běžný týden | `frontend/src/features/workSchedule/WorkSchedulePage.tsx`, `workSchedule.css`, `api.ts` ve stejné složce |
| Komunikace s API | `frontend/src/api/client.ts`, `frontend/src/features/reservations/api.ts` |

Výchozí orientace k 30. 9. 2026, kterou znovu ověř: frontend již obsahuje denní, týdenní a dvoutýdenní pohled, hledání volna na 14/28 kalendářních dnů, filtry dnů a části dne, objednání až šesti návštěv, modální objednávku, seskupení volných časů do úseků, kompaktní karty s nabídkou „⋯“, omluvení a náhradu, správu směn i rozlišení vlastního plánu a plánu kolegyně. Neuváděj existující funkce jako chybějící novinky; posuď jejich skutečnou použitelnost.

## 4. Pravidla, která návrh musí zachovat

- Terapeutky mohou zobrazovat a spravovat rezervace v obou kalendářích. Správa pracovních rozvrhů je oddělená: terapeutka spravuje vlastní, admin oba. Sdílené rezervace neopravňují k přístupu k cizímu editoru směn.
- Terapeutka může upravovat vlastního klienta, admin všechny podle serverových oprávnění. Respektuj `can_edit`; neveřejné poznámky jiného vlastníka nesmějí být zpřístupněny.
- Délka návštěvy je pouze 45 nebo 60 minut, výchozí 45. V jednom postupu se vybírá nejvýše šest návštěv pro jednoho pacienta.
- Dostupnost určuje API. Víkendy a české svátky nejsou dostupné. Jednorázová změna směny má přednost před šablonou. Nepřidávej volné časy odvozené jen z prázdného místa v kalendáři.
- Omluvená návštěva zůstává v evidenci, uvolňuje čas a nepočítá se do sedmé návštěvy. Omluvení a zrušení jsou odlišné akce. Zachovej vazbu náhradního termínu na původní návštěvu podle stávajícího kontraktu.
- U sedmé a další započítávané pojištěné rezervace zobraz srozumitelné upozornění; samotné upozornění nesmí blokovat uložení ani vyžadovat další potvrzení. Pravidla počítání a serverové vyhodnocení neměň.
- Rozliš pojišťovnu klienta a úhradu konkrétní návštěvy. Rozhoduje pojistný snímek rezervace; návštěva „bez pojišťovny“ se nikdy nezapočítá do sedmé pojištěné návštěvy. Změna úhrady návštěvy automaticky nemění kartu klienta ani ostatní návštěvy. Volba úhrady nové dávky platí podle současného kontraktu pro celou dávku.
- Telefon klienta je povinný. Rok narození u klienta bez pojišťovny povinný není. Zachovej rozlišení skutečně různých osob se shodnými údaji.
- Oprava jména nebo roku narození stejného klienta s historií zachovává ID, vazby a pojistné snímky. Zachovej výslovné potvrzení opravy stejné osoby, oprávnění a kontrolu aktuální verze.
- Nenavrhuj bez nového obchodního rozhodnutí stav „návštěva proběhla“, docházku, platby, veřejné objednávání, pacientský portál, SMS, e-maily nebo automatické připomínky. Současné stavy rezervací jsou `ACTIVE`, `EXCUSED`, `CANCELLED`.
- Autorizace, validace zápisu, transakce, audit a poslední ověření dostupnosti zůstávají na serveru. Zachovej session, CSRF, verzování a existující zacházení s konflikty; skrytí tlačítka není oprávnění.
- Nevkládej osobní údaje, vyhledávaná jména, tokeny ani cookies do URL, logů, analytiky, zdrojových kódů či trvalých úložišť prohlížeče. Nenavrhuj offline ukládání zdravotních či rezervačních dat. Pro ukázky používej výhradně smyšlené údaje.

Zachovej také již schválený vizuální kontext: vlastní plán zelenomodrý (`#286E67`, jemné pozadí `#E8F3EF`), plán kolegyně fialový (`#70509B`, `#F1EBF8`), společný/admin neutrální (`#51616A`, `#EDF1F3`), boční akcenty 8 px. Barva označuje vztah k přihlášené terapeutce, není napevno přidělena osobě. Vždy ji doplň textem. Admin nemá „můj plán“ ve významu vlastní terapeutické identity. Červená a oranžová zůstávají pro chyby a upozornění.

## 5. Proveď audit skutečných pracovních scénářů

U každého scénáře popiš současnou cestu, třecí místa a doporučenou cestu zvlášť pro mobil a desktop. Uveď počet aktivací ovládacích prvků, přechodů mezi obrazovkami, opakovaných vstupů a potřebu rolování. Zadávání textu počítej zvlášť; nezkrášluj srovnání změnou výchozího stavu. Čas uváděj jako měření pouze tehdy, pokud byl skutečně změřen, jinak jako odhad k ověření.

1. **Co mě dnes čeká:** po přihlášení poznat datum, terapeutku, pořadí návštěv a volné úseky, rychle se vrátit na dnešek.
2. **Zavolat pacientovi:** z denní karty přímo přes `tel:`, bez otevření detailu a bez nechtěného spuštění jiné akce.
3. **Objednat existujícího pacienta na konkrétní volný čas:** převzít terapeutku, den, čas a délku, vyhledat pacienta jednou, zkontrolovat a uložit.
4. **Založit nového pacienta při objednávání:** neztratit vybraný termín ani rozpracovanou rezervaci; srozumitelně řešit povinná pole a shodné osoby.
5. **Najít termín podle možností pacienta:** například pondělí dopoledne, 60 minut, u kterékoli terapeutky, v přesně vymezeném období.
6. **Objednat 1–6 návštěv:** pacient a parametry se nevyplňují opakovaně; vybrané termíny, jejich počet a možnost odebrání jsou přehledné i při dalším hledání. Zohledni termíny u obou terapeutek a zákaz souběhu téhož pacienta.
7. **Přesunout, omluvit nebo zrušit návštěvu:** najít akci z karty, znát její důsledek, po omluvení navázat náhradou bez nového hledání pacienta.
8. **Opravit klienta nebo změnit úhradu návštěvy:** nezaměnit dvě různé operace, respektovat oprávnění a povinná potvrzení.
9. **Přepnout na kolegyni nebo obě terapeutky:** zachovat datum a relevantní filtry, jasně poznat nový kontext a skutečný cíl objednání. Z konkrétního slotu převzít jeho terapeutku; obecná objednávka z pohledu obou nesmí skrytě vybrat první terapeutku.
10. **Naplánovat práci:** přehled týdne/dvou týdnů, jednorázové volno, přestávka, běžný týden a jeho použití v období. Oddělit uložení šablony od jejího použití a jasně řešit konflikt s rezervacemi.
11. **Pokračovat po chybě:** pomalá síť, částečně načtené dny, obsazení termínu někým jiným, zastaralá verze klienta či rezervace, ztráta relace. Zachovat bezpečně použitelný vstup, nikdy nepředstírat úspěšný zápis.

U častých akcí směřuj k dostupnosti v jednom až dvou krocích. Nezaměňuj dostupnost akce s dokončením celého objednání a neodstraňuj nutné kontroly jen kvůli počtu kliknutí.

## 6. Responzivní návrh: mobil a desktop mají vlastní uspořádání

### Mobil

- Prioritou je rychlý chronologický denní přehled a ovládání palcem. Zhodnoť, kolik prostoru zabírá hlavička, kontext, filtry a navigace před první návštěvou.
- Zachovej kompaktní kartu: čas a jméno; telefon s voláním, rok a stručná úhrada. Sekundární akce pod „⋯“, dlouhá poznámka rozbalovací. Běžné pojmy zbytečně nevysvětluj na každé kartě.
- Navrhni vhodné chování pro týden/dva týdny bez zmenšení desktopové tabulky na nečitelnou mřížku. Hlavní pracovní obsah nesmí vyžadovat vodorovné posouvání celé stránky.
- Prověř spodní navigaci, sticky kontext a potvrzení objednávky společně: nesmějí se překrývat, zakrývat obsah ani zabrat většinu nízkého displeje.
- Dialog objednávky musí fungovat s otevřenou softwarovou klávesnicí, bezpečnými okraji telefonu a měnící se výškou viewportu. Aktivní pole, chyba a cesta k uložení musí zůstat dosažitelné.
- Dotykové cíle navrhni alespoň 44 × 44 CSS px, vstupní písmo alespoň 16 px. Kompaktnost řeš omezením balastu, nikoli zmenšením čitelnosti či zásahové plochy.

### Desktop a tablet

- Využij šířku pro porovnání dnů a terapeutek. Posuď vedle sebe umístěné plány obou terapeutek a přehled pracovního týdne, s jasnou časovou orientací.
- U formuláře objednávky zvaž rozložení výběru pacienta/termínů a průběžného souhrnu vedle sebe. Ukaž, kdy toto rozložení přejde do jednoho sloupce.
- Zhodnoť šířku obsahu, postranní navigaci, hustotu řádků, nadbytečné mezery a zalamování názvů. Desktop nemá být pouze roztaženou mobilní obrazovkou.
- Navrhni plné ovládání klávesnicí, logické pořadí fokusu a návrat fokusu po zavření dialogu. Případné zkratky jsou doplněk, nesmějí rušit psaní do polí.
- Tablet posuzuj i jako dotykové zařízení. Nespoléhej na hover, pravé tlačítko ani drag-and-drop jako jedinou cestu k operaci.

### Společné požadavky

- Pro každou klíčovou obrazovku vysvětli, co zůstává vždy viditelné, co se postupně odhaluje a proč.
- Navrhni jednotné odsazení, typografickou hierarchii, tlačítka, formuláře a stavy při zachování současné identity. Požaduj čitelný kontrast, viditelný fokus, popisky polí, textové označení stavů a omezení animací podle preference uživatele.
- Ošetři dlouhá česká jména, poznámky, zvětšení textu, prázdný den, plný den a seznam mnoha výsledků. Text nesmí vytlačit hlavní akci mimo displej.
- Zachovej srozumitelné datum a čas v `Europe/Prague`; návrh nesmí změnit význam termínu při jiné časové zóně zařízení.
- Rozliš „žádný výsledek“, „není pracovní doba“, „neodpovídá filtrům“ a „data se nepodařilo načíst“ pouze podle dostupných dat. Pokud API důvod nevrací, UI jej nesmí hádat.

## 7. Technický výkon a odolnost frontendu

Zkontroluj síťové požadavky a správu stavu při přepínání data, terapeutky, pohledu a filtrů. V kódu již existuje debounce, rušení požadavků a omezení souběhu hledání; posuď jejich dostatečnost, nenavrhuj je automaticky jako chybějící.

Zaměř se na:

- Duplicitní načítání, načítání nepotřebných dnů a množství požadavků pro týden, dva týdny a hledání u obou terapeutek. Doporuč rozumné omezení souběhu nad stávajícím denním API.
- Ochranu před opožděnou odpovědí starého dotazu. Data kolegyně nesmějí ani krátce vypadat jako nový vlastní plán. Zachování předchozího obsahu při načítání musí respektovat jeho původní kontext.
- Obnovu relevantních přehledů po vytvoření, přesunu, omluvení, změně úhrady či směny. Případná paměťová cache musí mít správný klíč, invalidaci a vyčištění při odhlášení či změně účtu.
- Stabilitu rozložení při načítání, oddělené chyby návštěv a dostupnosti, bezpečné opakování čtení a zřetelný stav ukládání.
- Zabránění dvojímu odeslání. Po nejasném výsledku zápisu neslibuj bezpečné automatické opakování bez opory v současném kontraktu; nejprve navrhni ověření aktuálního stavu.
- Zachování rozpracovaného formuláře v paměti během opravitelných chyb. Při odhlášení nebo ztrátě oprávnění nesmějí citlivá data zůstat viditelná. Nenavrhuj lokální frontu zápisů ani optimistické potvrzení obsazeného termínu.
- Zbytečné překreslování, objem JS/CSS a případné dělení administrační části. Novou knihovnu, memoizaci nebo virtualizaci doporuč jen s konkrétním důvodem a náklady.

Neuváděj naměřené zrychlení bez měření. Odděl potvrzený problém, hypotézu z kódu a návrh měření pro pozdější ověření.

## 8. Jak smíš ověřovat

Platí výslovný vývojový režim projektu: **nespouštěj žádné automatické testy**, včetně jednotkových, integračních, E2E, regresních, snapshotů a watch režimu, ani nepřímo přes jiný skript. Tento zákaz nenahrazuj žádostí o nové potvrzení při každém kroku.

Audit prováděj čtením kódu a dokumentace. Je-li dostupný bezpečný vývojový náhled, můžeš jej ručně vizuálně prohlédnout se syntetickými daty; nevytvářej ani neupravuj reálné rezervace. Vizuální prohlídka není důkaz funkční regrese. Cílenou statickou kontrolu použij jen tehdy, když je pro audit potřebná a příkaz neobsahuje testy.

Připrav matici pozdějšího ručního ověření alespoň pro 360 × 800, 390 × 844, 768 × 1024, 1024 × 768, 1366 × 768 a 1920 × 1080; zahrň Safari na iPhonu, Chrome na Androidu a desktopové prohlížeče. Přidej otevřenou mobilní klávesnici, zvětšení na 200 %, dlouhé údaje, pomalou síť, částečnou chybu, 409, vypršení relace a ovládání klávesnicí. Každý stav označ jako skutečně prohlédnutý, posouzený pouze z kódu nebo neověřený.

Pozitivní i negativní scénáře pro závěrečnou regresi připrav jako návrh doplnění `docs/deferred-regression.md`. Testy se spustí až na výslovný pokyn vlastníka na konci vývoje. Výstup nesmí tvrdit, že je aplikace připravená k produkčnímu nasazení.

## 9. Požadovaný výstup

Odevzdej v češtině jeden souvislý, konkrétní návrh v následujícím pořadí:

1. **Stručný verdikt:** pět největších příležitostí ke zrychlení práce terapeutky, co už funguje dobře a má zůstat, jaké podklady a obrazovky jsi skutečně prohlédl.
2. **Auditní tabulka:** ID, obrazovka/komponenta a odkaz na konkrétní soubor, pozorování, důkaz nebo neověřená hypotéza, dopad na práci, mobil/desktop, závažnost. Neoznačuj problém za nalezený jen proto, že bývá v podobných aplikacích běžný.
3. **Srovnání pracovních postupů před/po:** pro scénáře z oddílu 5 ukaž konkrétní kroky, vstupy a rolování. Uveď, co návrh šetří, co musí zůstat a proč; čísla bez měření označ jako odhad.
4. **Doporučené uspořádání obrazovek:** denní plán, týden/dva týdny, hledání, objednávka 1–6 návštěv, karta/oprava klienta a směny. Pro každou ukaž jednoduchý textový wireframe mobilu i desktopu, hierarchii akcí a chování na tabletu. Popiš i načítání, prázdný stav, chybu a konflikt. Neomez se na vizuální moodboard.
5. **Prioritizovaný seznam změn:** P0 = riziko chybného úkonu či nedokončení práce; P1 = častá úspora času; P2 = méně časté zlepšení a vizuální sjednocení. U každé změny uveď problém, přesné řešení, přínos, dotčené soubory, náročnost S/M/L, riziko regrese, závislosti a měřitelná akceptační kritéria. Označ, zda jde čistě o FE, nebo o návrh mimo rozsah.
6. **Výkon a přístupnost:** konkrétní nálezy a doporučení vázané na komponenty, bez neprokázaných čísel nebo obecných sloganů.
7. **Pořadí budoucí realizace:** malé navazující celky od největšího přínosu, s jasným rozsahem. Nyní je neimplementuj.
8. **Otevřená rozhodnutí a plán ověření:** jen skutečné nejasnosti; nabídni doporučenou variantu a vysvětli dopad. Přilož návrh regresních scénářů a výslovně uveď, že automatické testy nebyly spuštěny.

Vyber jedno doporučené řešení pro každý hlavní problém. Alternativy uváděj pouze tam, kde existuje podstatný kompromis. U každého návrhu si odpověz: **Který každodenní úkon tato změna zrychlí, omezí jeho chybovost nebo zlepší jeho čitelnost, a jak to později ověříme?** Pokud neumíš konkrétně odpovědět, změnu nezařazuj mezi priority.
