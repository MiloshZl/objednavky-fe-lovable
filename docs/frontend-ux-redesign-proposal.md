# FE: analýza a dopracování plánu rezervací a směn

Stav k 29. 9. 2026. Implementace navazuje na rozpracovanou větev
`feature/fe-ux-redesign-reservations-schedule`. Původní rozpracované změny backendu,
migrací a agentních instrukcí byly ponechány. Změny popsané níže jsou ve frontendu.

## Z čeho návrh vychází

Business zadání: interní práce dvou terapeutek a administrátora; sdílené rezervace,
vlastní směny, 45/60 minut, až šest termínů pro jednoho pacienta, omluvení a náhrada.
Odkazovaný prompt je přesměrování na frontendovou roli, nikoli nové business zadání.
Původní dokument obsahoval návrhy dalších fází; aktuální požadavek autorizuje jejich
dopracování. Není potřeba znovu schvalovat jednotlivé reverzibilní změny UI.

## Detailní nálezy při vstupní analýze

| Místo | Zjištění a důsledek | Provedená změna |
| --- | --- | --- |
| Denní plán | API nabízí začátky po 15 minutách. Každý měl velkou kartu. Překrývající se alternativy působily jako samostatné volné návštěvy. | Nabídky seskupené do časově souvislých úseků mezi návštěvami; rozbalení ukáže konkrétní časy. Žádné vymyšlené časy nad rámec API. |
| Horní část dne | Opakované filtry a velké sekce odsouvaly pacienty pod první obrazovku. | Kratší týdenní pásek; délka a část dne pod rozbalovacím nastavením nabídky volna. |
| Týden | Jen počty, bez jmen pacientů; po uložení nebo obnově se data nemusela načíst znovu. | Jména, časy, indikace opakované návštěvy, první volný termín a přechod do dne; obnova podle revize. |
| Delší období | Chyběl plán více týdnů. | Den / týden / dva týdny; navigace po celém zvoleném období. |
| Hledání | Filtr pondělí ovlivňoval až akci „další volný den“, nikoli aktuální nabídku. Smyčka hledala 30 odpovídajících dnů, což u pondělků znamenalo měsíce místo avizovaných 30 dnů. | Přímý seznam výsledků v přesném období 14 nebo 28 kalendářních dnů. Výběr více pracovních dnů a části dne, včetně výchozího data. |
| Hledání u kolegyně | Opakované přepínání terapeutky a jednotlivých dnů. | Hledání u jedné nebo obou terapeutek; každý výsledek uvádí datum i terapeutku. |
| Objednávání | Dlouhý formulář uvnitř plánu; vybrané návštěvy i uložení byly daleko pod nabídkou časů. | Samostatný modální dialog, výběr termínů nad výsledky, přichycené potvrzení. Při kliknutí na konkrétní čas stačí vybrat pacienta a potvrdit. |
| Více sezení | Překryv rozepsaných návštěv se řešil jen v rámci stejné terapeutky. | Jeden pacient nemůže v rozepsaném výběru obsadit souběžné časy ani u různých terapeutek. Maximum šest zůstává. |
| Konflikt 409 | Opakování stejného zastaralého výběru nemělo jasný další krok. | Pacient zůstane vybraný, uživatel přejde na aktuální volné časy; při konfliktu editované rezervace se vrátí k obnovenému plánu. |
| Omluvení | Náhrada vyžadovala znovu najít omluvenou návštěvu. | Po potvrzení omluvení okamžitá akce pro náhradní termín; omluvené a zrušené návštěvy dostupné přes historii dne. |
| Výpadek dostupnosti | Selhání volných časů skrylo i úspěšně načtené návštěvy. | Návštěvy zůstávají čitelné, nabídka volna ukáže vlastní chybu a obnovu. |
| Běžný týden | Dva formuláře se stejným ukládáním, jeden skrytý CSS. Nastavení jeho časů se nepoužívalo v odeslaném payloadu. | Jeden editor dnů, časů a přestávek; kopírování prvního dne do ostatních používá skutečně upravené hodnoty. |
| Úprava šablony | Editor existujícího týdne inicializoval jen původně aktivní dny. Přidání dalšího dne mohlo číst neexistující hodnoty. | Vždy inicializováno všech pět dnů; lze bezpečně zapínat a vypínat dny i po kopírování. |
| Použití šablony | Stejné ID řídilo editaci a použití; datumová pole byla také v editoru definice týdne. | Samostatné ID a formulář pro použití; pojmenovaný týden se uložením sám neaplikuje. |
| Denní směna | Formulář viditelný stále, i bez úmyslu upravovat den; při chybě načtení šly uložit výchozí hodnoty. | Editor jen po volbě dne, dva režimy „Pracuji“ / „Volno“, ukládání při chybě načtení zablokované s možností obnovy. |
| Kalendář směn | Pět pracovních dnů bylo na desktopu v sedmi sloupcích, mobil vyžadoval vodorovný posun. | Pět sloupců na desktopu, chronologický seznam na mobilu; svátky jasně označené a needitovatelné. |
| Mobilní navigace | Nadpis skupiny zabíral buňku dvoupoložkové spodní navigace; odhlášení se schovávalo. | Dvě položky „Můj plán“ a „Směny“, nadpis skupiny na mobilu skrytý, dostupný účet a odhlášení nahoře. |
| Kontext | Při přepnutí mezi plánem a směnami se ztrácelo datum. | Sdílené datum v paměti aplikace; žádné osobní údaje v URL nebo úložišti prohlížeče. |

## Výsledné pracovní postupy

1. **Co mě dnes čeká:** po přihlášení vlastní den. Návštěvy a volné úseky v časovém
   pořadí. Přechod na jiný den jedním klepnutím v pásku.
2. **Jak vypadá týden:** přepnout na Týden nebo 2 týdny. Vidět pacienty a časy;
   klepnutí na den otevře jeho ovládání, klepnutí na první volno objednávání.
3. **Klient může jen pondělí dopoledne:** Volné termíny → Po + Dopoledne.
   Výsledky ukazují odpovídající dny v celém zvoleném období, případně u obou terapeutek.
4. **Objednat konkrétní čas:** rozbalit volný úsek, vybrat čas, vybrat pacienta,
   potvrdit. Termín je již připravený.
5. **Objednat více návštěv:** pacienta vybrat jednou a přidávat termíny; lze odebrat,
   změnit terapeutku a pokračovat do dalšího období. Při přechodu z vyhledávání
   se zachovají preference dnů, části dne a délky hledaného období.
6. **Přesun / omluvení:** přímo na kartě návštěvy. Omluvení uvolní čas a nabídne
   náhradu, původní záznam zůstává v historii.
7. **Jednorázově nepracuji:** Směny → den → Volno → uložit. Pokud jsou v cestě
   rezervace, backend změnu odmítne a UI nabídne obnovu.
8. **Pravidelná pracovní doba:** Směny → Běžný týden → vytvořit nebo upravit →
   uložit → Použít od… s explicitním obdobím. Historie použitých intervalů je
   dostupná v rozbalovací sekci.

## Architektura, chyby a přístupnost

- `SlotFinder` je společný pro samostatné hledání a dialog objednávky.
- `planning.ts` soustřeďuje rozsah hledání, časový filtr, seskupování nabídky a
  kontrolu překryvů rozepsaných návštěv.
- Vyhledávání má nejvýše tři současné požadavky; změna parametrů nebo odchod ruší
  předchozí požadavky. Týden se načítá po dnech. Neúspěšně načtené dny nejsou
  vydávány za obsazené; částečný výsledek obsahuje upozornění a obnovu.
- Časy jsou prezentované v Europe/Prague, včetně přechodů letního času.
- Modální `dialog` používá nativní modalitu a vrací fokus při zavření. Escape
  respektuje rozepsanou rezervaci; její zahození vyžaduje výslovnou volbu.
- Filtry mají `aria-pressed`, navigace `aria-current`, chyby `role=alert`,
  průběh `role=status`. Mobilní vstupy mají 16px písmo, akce minimálně 44px;
  respektuje se omezený pohyb.
- API kontrakty, autorizační hranice, transakce, audit a pravidla počítání návštěv
  se nemění. Poslední kontrola dostupnosti a oprávnění vždy patří backendu.
- Zde se nezavádí nový stav „návštěva proběhla“: současný kontrakt rozlišuje
  ACTIVE / EXCUSED / CANCELLED. Případnou evidenci docházky je potřeba nejdřív
  definovat jako samostatné business pravidlo.
- Návrat jednorázové změny přesně na aktuální běžnou šablonu nemá v existujícím
  kontraktu samostatnou operaci. UI proto neslibuje zavádějící akci „jako obvykle“.

## Ověření a hranice

Automatické frontendové testy používají Vitest + Testing Library + jsdom,
syntetická jména a mockované API. Pokrývají filtry i jejich hranice, šest termínů,
překryvy, síťové selhání a retry, abort, 409, upozornění sedmé návštěvy, omluvení
a náhradu, obnovu týdne, editaci chybějících dnů šablony, kopírování časů,
oddělení uložení a použití, den volna, svátky a zakázané ukládání při chybě.
Build provádí kontrolu TypeScriptu. Existující backendová sada dále ověřuje
pozitivní i negativní scénáře přístupu a doménových pravidel.

V tomto běhu nebyl dostupný připojený Browser. Skutečné vykreslení na iPhonu,
Androidu a desktopu proto není vizuálně potvrzené. Před nasazením je ještě potřeba
zkontrolovat 360/390px a desktop, nativní fokus dialogu, klávesnici telefonu a
živou integraci s MySQL včetně souběžného obsazení stejného termínu ze dvou relací.
Testy jsdom neověřují rozměry CSS ani transakce skutečné databáze.

Používá se existující denní API, takže širší hledání znamená více čtecích
požadavků. Počet současných požadavků je omezený; případné hromadné API je
samostatná optimalizace. Změny nejsou nasazené a neprovádějí DB migrace.
