# Backend architecture – rezervační systém fyzioterapie

## 1. Cíl architektury
- bezpečný REST API pod /api/v1
- backend je jediný zdroj pravdy pro role, session, validaci a přístup ke datům
- data je nutné chránit proti IDOR, CSRF, race conditions a mass assignment
- návrh je jednoduchý, mobilně orientovaný a vhodný pro Docker provoz na Synology DS224+

## 2. Technologie
- Node.js 20+
- Express nebo Fastify (doporučuji Fastify pro bezpečnost a rychlost)
- MySQL 8
- Prisma nebo Knex + SQL (doporučuji Prisma pro návrh a migrace, ale je třeba uvažovat i přímé SQL v produkci)
- zod nebo Joi pro validaci
- bcrypt/argon2 nebo custom hash pro token storage
- pino nebo winston pro bezpečné logování

## 3. Struktura projektu
```text
backend/
  src/
    app.js
    server.js
    config/
      env.js
      logger.js
      timezone.js
    db/
      connection.js
      migrations/
      seed/
    auth/
      login.controller.js
      auth.middleware.js
      session.service.js
      token.service.js
      csrf.service.js
    users/
      users.controller.js
      users.service.js
      users.repo.js
      users.validator.js
    therapists/
      therapists.controller.js
      therapists.service.js
      therapists.repo.js
    patients/
      patients.controller.js
      patients.service.js
      patients.repo.js
      patients.validator.js
    reservations/
      reservations.controller.js
      reservations.service.js
      reservations.repo.js
      availability.service.js
      conflict.service.js
      seventh-visit.service.js
    schedule/
      templates.service.js
      overrides.service.js
      schedule.repo.js
    insurers/
      insurers.controller.js
      insurers.service.js
      insurers.repo.js
    audit/
      audit.controller.js
      audit.service.js
      audit.repo.js
    middleware/
      authRequired.js
      authorize.js
      errorHandler.js
      rateLimit.js
      requestId.js
      validate.js
    utils/
      crypto.js
      time.js
      sanitize.js
      normalize.js
    security/
      csrf.js
      rateLimiter.js
      ip.js
      ownership.js
    tests/
      auth.test.js
      patients.test.js
      reservations.test.js
      security.test.js
```

## 4. Core security rules
- všechny requesty jsou ověřeny relací, role a oprávněním na serveru
- žádné důvěřování v URL, body requestu nebo frontend state
- každá mutace běží v transakci
- audit log ukládá staré i nové hodnoty
- žádné tokeny ani osobní údaje v logu nebo URL
- deny by default

## 5. Autentizace a session model
### 5.1 Login flow
1. uživatel odešle login + 32 znakovou hodnotu tokenu
2. backend vyhledá uživatele podle loginu
3. backend ověří hash tokenu
4. backend ověří, že účet je aktivní
5. backend vygeneruje session ID a uloží hash do DB
6. backend nastaví HttpOnly Secure cookie
7. backend vytvoří `active_sessions` záznam
8. backend aktualizuje `last_login_at`

### 5.2 Session policy
- session cookie: `sessionId`
- nečinnost 30 dní
- absolutní max 180 dní
- server vždy ověřuje session hash z DB
- při odhlášení, vypršení nebo odvolání se relace zneplatní v DB

### 5.3 Token policy
- token se nikdy neukládá jako běžné heslo
- ukládá se pouze hash
- nová hodnota po obnově invaliduje starou
- admin má plnou možnost odvolání všech relací a tokenů

## 6. Authorization model
### 6.1 Role map
- `ADMIN`: přístup ke všem datům a admin funkcím
- `THERAPIST`: přístup ke svému rozvrhu, pacientům, rezervacím a čtení mezi terapeuty podle bezpečnostní politiky

### 6.2 Middleware chain
```text
request -> requestId -> rateLimit -> parse body -> authRequired -> sessionValidation -> authorize(role or scope) -> validate -> controller -> service -> repo -> audit -> response
```

### 6.3 Must-have guardrails
- endpoint level authorization
- ownership validation before data read/write
- explicit allow-lists, never implicit access by role name alone
- `subjectId` from session, never from request body

## 7. Reservation logic
### 7.1 Core rules
- sloty se počítají po 15 minutách
- délka rezervace: 45 nebo 60 minut
- víkend a svátek = neprůchozí
- reservation musí být plně v pracovní době terapeutky
- zrušené a omluvené rezervace neblokují čas
- přesná kolize musí být kontrolována na serveru

### 7.2 Conflict strategy
- `BEGIN TRANSACTION`
- lock relevant therapist/date row (or narrow transaction lock)
- recompute availability from templates + overrides + existing reservations
- validate patient and insurer state
- calculate seventh visit warning in same transaction
- insert reservation and reservation event
- `COMMIT`

### 7.3 Seventh visit rule
- počítají se pouze `ACTIVE` záznamy
- vynechat `CANCELLED` a `EXCUSED`
- počítat podle kalendářního roku termínu
- varování při 7. a další rezervaci, ale ne blokování

## 8. Schedule logic
- způsob zpracování šablon a jednorázových změn je: jednorázová změna má přednost před šablonou
- vyhodnocení pracovního času je vždy z aktuální kombinace šablony a override
- pokud existují rezervace v době změny, změna je povolena jen po jejich úpravě nebo zrušení

## 9. Audit and event log
- audit log není pouze nástroj pro UI, ale důležitý bezpečnostní a provozní zdroj
- pro každý write endpoint se vytvoří záznam do `audit_log`
- záznam obsahuje:
  - entita a id
  - akce
  - actor
  - čas
  - old_values
  - new_values
  - request_id
- nezapisovat tokeny, cookies, telefonní čísla, zdravotní data ani osobní poznámky do logu

## 10. DB access and repositories
- business logic v services
- SQL v repository layer
- controllers pouze vstup/výstup a validace
- žádné přímé SQL v route handlers

## 11. API response standard
```json
{
  "success": true,
  "data": { },
  "meta": {
    "requestId": "..."
  }
}
```

Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Zadané údaje nejsou validní."
  }
}
```

## 12. Security testing strategy
- testy pro valid/invalid login
- testy pro přístup k cizímu záznamu přes ID
- testy pro změnu role a přístup
- testy pro CSRF a cookie-based auth
- bruteforce testy
- testy pro rezervace a kolize
- testy pro audit a přístupnost dat

## 13. Production deployment on Synology DS224+
- API v Dockeru
- MySQL v Dockeru nebo NAS-managed service
- FE jako statický web přes reverse proxy
- port DB není veřejný
- reverse proxy slouží jako jediný veřejný vstup
- HTTPS only
- secrets v env / Docker secrets

## 14. Recommended implementation order
1. auth + session + RBAC + middleware
2. users + therapists + patients + insurers
3. schedule + availability + conflict validation
4. reservations + audit + seventh visit logic
5. admin endpoints + device revoke + audit UI
6. security hardening + load and race tests
