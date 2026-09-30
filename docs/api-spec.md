# API specifikace – /api/v1

## 1. Auth
### POST /api/v1/auth/login
Request:
```json
{
  "login": "therapist1",
  "token": "32znakovy-token"
}
```
Response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "login": "therapist1",
      "role": "THERAPIST"
    }
  }
}
```

### POST /api/v1/auth/logout
- odvolá aktivní session

### GET /api/v1/auth/me
- vrací aktuálního uživatele z validní relace

## 2. Pacienti
### GET /api/v1/patients?query=
### POST /api/v1/patients
### PATCH /api/v1/patients/:id

Detail pro editor `GET /api/v1/patients/:id`, rozšíření odpovědí rezervací o kartu pacienta a parametr `paymentMode` pro samoplátce jsou popsány v [kontraktu karty pacienta a úhrady návštěvy](reservation-patient-card.md#api).

Validace:
- phone required
- insurer required or uninsured
- birth_year required for insured
- name and surname required

## 3. Rezervace

Implementovaný kontrakt včetně dostupnosti, historie, náhrad a verzování záznamu upřesňuje [reservation-management.md](reservation-management.md). Dostupnost je nyní na `/api/v1/reservations/availability`.
### GET /api/v1/reservations?date=&therapistId=
### POST /api/v1/reservations
### POST /api/v1/reservations/batch
### PATCH /api/v1/reservations/:id
### POST /api/v1/reservations/:id/excuse
### POST /api/v1/reservations/:id/cancel

Constrainty:
- start time and duration must fit inside work interval
- no overlaps with existing active reservations
- excuse does not block time
- cancelled and excused do not count to seventh visit

## 4. Dostupnost
### GET /api/v1/availability?therapistId=&date=&duration=
Response obsahuje sloty na 15min intervalech.

## 5. Rozvrh

Skutečný prefix je `/api/v1/work-schedule` (ne `/api/v1/schedule`). Podrobný popis modelu a chování je v [work-schedule-planner.md](work-schedule-planner.md).

### GET /api/v1/work-schedule/therapists
### GET /api/v1/work-schedule?therapistId=&date=
- vrací efektivní intervaly pro daný den, se zdrojem výpočtu (šablona/výjimka/svátek)
### GET /api/v1/work-schedule/week?therapistId=&startDate=&days=&workdays=
- `days` (výchozí 5, max 31), `workdays=true` vynechá víkendy
### GET /api/v1/work-schedule/templates?therapistId=&from=&to=
### POST /api/v1/work-schedule/templates
- vytvoří jednu nebo více nepojmenovaných `day_templates` řádek
### PATCH /api/v1/work-schedule/templates/:id
### POST /api/v1/work-schedule/templates/:id/deactivate
### GET /api/v1/work-schedule/overrides?therapistId=&from=&to=
### PUT /api/v1/work-schedule/overrides/:overrideDate
- idempotentní zápis výjimky nebo dne volna, podporuje víc intervalů s přestávkami

### GET /api/v1/work-schedule/template-sets?therapistId=
- pojmenované, znovu použitelné týdenní šablony
### GET /api/v1/work-schedule/template-sets/:id?therapistId=
### POST /api/v1/work-schedule/template-sets
- uloží šablonu; `validFrom`/`validTo` jsou volitelné a šablonu rovnou nepromítnou do rozvrhu, pokud nejsou zadané
### PATCH /api/v1/work-schedule/template-sets/:id
- upraví název a denní rozvrh šablony, nepromítá se automaticky do aktuálního rozvrhu
### DELETE /api/v1/work-schedule/template-sets/:id?therapistId=&confirm=true
- soft delete (`is_active = false`); bez `confirm=true` vrací `409 CONFIRM_REQUIRED`
### POST /api/v1/work-schedule/template-sets/:id/apply
- aplikuje šablonu do efektivního rozvrhu pro zadané `validFrom`/`validTo`

Constrainty:
- víkendy a české svátky nelze otevřít žádnou výjimkou
- zápis kontroluje kolizi s aktivními rezervacemi (`SCHEDULE_RESERVATION_CONFLICT` / `SCHEDULE_TEMPLATE_CONFLICT`, 409)
- terapeutka smí číst a měnit pouze vlastní rozvrh, admin oba


## 6. Admin
### GET /api/v1/admin/users
### POST /api/v1/admin/users
### PATCH /api/v1/admin/users/:id
### GET /api/v1/admin/sessions
### POST /api/v1/admin/sessions/:id/revoke
### POST /api/v1/admin/sessions/revoke-all
### GET /api/v1/admin/audit

## 7. Chyby
Standard:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Zadané údaje nejsou validní."
  }
}
```

## 8. Security constraints
- všetky endpointy musí být chráněné relací
- každý write endpoint běží v transakci
- žádné důvěry v URL, body requestu nebo UI
- všechny cizí záznamy jsou blokovány
