# Odložené regresní ověření

Na pokyn vlastníka z 29. 9. 2026 se testy během současné fáze vývoje nespouštějí. Tento seznam je podklad pro závěrečné ověření, nikoli záznam úspěšných testů. Spuštění až na výslovný pokyn uživatele; viz `AGENTS.md`.

## Kompaktní karta a editace klienta

- Mobilní a desktopová karta: dlouhé jméno, telefon s `tel:`, rok narození, pojišťovna, odlišná úhrada návštěvy, krátká/dlouhá/chybějící poznámka, historie.
- Menu „⋯“: klávesnice, Escape, kliknutí mimo, překrytí okolních karet, dostupnost akcí podle stavu a oprávnění.
- Oprava telefonu, poznámky, pojišťovny, jména a roku narození. Pro existující historii vyžadovat potvrzení opravy stejného klienta a aktuální verzi. Zachovat ID klienta, napojení rezervací a jejich pojistné snímky.
- Kontrola backendu bez UI: chybějící relace/CSRF, cizí pacient, neplatné ID/enum/potvrzení, stará verze, chybějící potvrzení opravy, neznámá pole a selhání auditu.
- Souběh opravy identity a vytvoření rezervace: stejné pořadí zámků terapeutek, atomický audit `identity_corrected`, žádné osobní údaje v provozním logu.
- Oprava kontaktu/identity u nyní nesmluvní pojišťovny je povolená; nová změna pojišťovny stále ověřuje smlouvu. Oprava identity se promítá do shody stejného klienta v historii i do počítání návštěv.
- Úprava termínu, úhrady, omluvení a zrušení: potvrzení, 409, obnova dat, žádná automatická opakování zápisu.

## Samoplátce a sedmá návštěva

- Klient má pojišťovnu, ale vybraná návštěva je `SELF_PAY`: ukládá `UNINSURED`/`null`, nezapočítává se a nezobrazuje varování.
- Pět pojištěných + libovolný počet samopláteckých + další pojištěná = šestá bez varování; až další pojištěná spustí upozornění.
- Šest pojištěných + 1–6 nových samopláteckých návštěv nezvyšuje počet pojištěných návštěv. Ověřit create, batch, preview, přesun, detail i denní/týdenní přehled.
- Změna sedmé pojištěné návštěvy na samoplátce odstraní její započtení a po obnovení i neaktuální upozornění. Ostatní historické úhrady a pojišťovna klienta zůstanou zachované.
- Změna samoplátce zpět na pojišťovnu jej znovu zahrne podle roku a pojišťovny. Omluvené/zrušené termíny, jiný rok a jiná pojišťovna se do dané skupiny nepočítají.

## Aktualizace existujících testů před závěrečným spuštěním

- Kontext plánování: aktualizovat očekávání nadpisů, přímých přepínačů terapeutek a cíleného tlačítka objednání; obecné objednání z pohledu „Obě“ vyžaduje explicitní výběr terapeutky.

- `frontend/test/patient-card.test.tsx` a `booking.test.tsx`: nové props karty, akce pod „⋯“, stručné texty, potvrzení a odemčená oprava identity. Dřívější očekávání velkých tlačítek a zakázaných polí již neplatí.
- `backend/test/patient-access-http.test.js`: místo plošného zákazu změny identity ověřit potvrzenou opravu, stale/ownership a audit; DB náhrada musí podporovat zámek všech terapeutek.
- `backend/test/reservation-payment.test.js`: doplnit výše uvedené hraniční počty a přesnou filtraci pojistných snímků, roku a vyloučené rezervace v DB náhradě.
- Závěrem skutečná MySQL pro souběh, transakce a výpočet shody; unit DB náhrada toto nenahrazuje.

## Kontext vlastní terapeutky a kolegyně

- Oba terapeutické účty: vlastní plán zelenomodrý, kolegyně fialová (`#70509B`) s jemným pozadím (`#F1EBF8`), vždy správné jméno. Boční pruhy kontextu a skupin mají 8 px v přehledech, hledání i objednávání; ověřit viditelnost a prostor pro obsah na mobilu. Admin má neutrální označení bez „můj/kolegyně“. Společný přehled je neutrální a skupiny mají samostatná označení.
- Přepínání mezi vlastním plánem, kolegyní a oběma zachovává datum; „← Můj plán“ vrací vlastní plán jedním klepnutím. Stejný kontext platí pro den, týden, dva týdny a volné termíny.
- Pomalé a neúspěšné požadavky, rychlé opakované přepínání: žádné staré termíny pod novým jménem. Změna filtru „U koho“ ve vyhledávání mění i horní přepínač; pozdní odpovědi nesmějí přepsat aktuální výsledky.
- Z pohledu „Obě“ obecné objednání čeká na explicitní výběr. Kliknutí na konkrétní čas v denním/týdenním přehledu i hledání přebírá skutečnou terapeutku termínu. Přesun a náhradní návštěva zachovávají kontext zdrojové rezervace.
- Formulář, termíny a závěrečné shrnutí zobrazují skutečný cíl. Dávka u obou terapeutek ukazuje obě jména; odebrání a přidání termínů aktualizuje kontext. Vlastnictví nového klienta a oprávnění na backendu zůstávají zachované.
- Mobilní rolování stránky i dialogu, dlouhá jména a zvětšené písmo: kontext je čitelný, není oříznutý; menu karet a ukládací lišta fungují. Ověřit klávesnici, oznámení změny a dotykové ovládání. Barva není jediným rozlišením.
