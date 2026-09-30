# Secure auth flow

## Cíl
Zajistit bezpečné přihlášení a relace pro interní uživatele bez zranitelnosti vůči brute-force, session fixation a IDOR.

## Flow
1. Uživatel odešle login + 32znakový token na backend.
2. Backend ověří aktivní účet a hash tokenu z DB.
3. Pokud je validní, backend vytvoří novou session a vygeneruje session ID.
4. Session ID se uloží do HttpOnly Secure cookie.
5. Backend ukládá pouze hash session ID a metadata relace v DB.
6. Každý request kontroluje relaci na serveru a roli v autorizaci.
7. Při odhlášení, zneplatnění tokenu nebo deaktivaci účtu se relace odvolá.
8. Session má maximální životnost 30 dní nečinnosti a 180 dní absolutně; po zrušení relace nebo změně zařízení se účastník musí přihlásit znovu.

## Token handover
- Admin přidělí token osobně nebo prostřednictvím interní bezpečné, admin-only komunikace.
- Token se nezveřejňuje v e-mailu, SMS ani chatu.
- Po zobrazení je token předán uživateli jednou a server jej neukládá v otevřené podobě.

## Důležité zásady
- Žádné tokeny v URL, logu nebo frontend build.
- Rate limiting a lockout pro login.
- CSRF ochrana pro cookies.
- Případné expirované nebo zneplatněné relace jsou okamžitě zamítnuty.
- Všechny mutace jsou pod serverovou kontrolou a auditem.
