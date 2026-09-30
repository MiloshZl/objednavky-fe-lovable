# Backend security test plan

## 1. Auth tests
- valid login succeeds
- invalid token fails
- missing token fails
- revoked token fails
- expired session fails
- revoked session fails
- disabled user fails
- same login with too many attempts is throttled

## 2. RBAC tests
- therapist cannot access admin-only endpoint
- therapist cannot modify other therapist schedule
- therapist cannot delete patient or user records outside policy
- admin can access all permitted endpoints
- access without session is blocked

## 3. IDOR tests
- modify patient id in URL to access another patient
- modify reservation id to access other reservation
- modify schedule id to access other therapist data
- modify insurer id to access invalid period

## 4. Transaction and conflict tests
- overlapping reservation attempt fails with conflict response
- multi-slot reservation is atomic: all or nothing
- excuse operation does not block slot after save
- cancel operation keeps audit and leaves state consistent

## 5. Audit tests
- create reservation writes audit event
- change reservation writes old and new values
- excused and cancelled records keep chronological history

## 6. CSRF tests
- state-changing request without CSRF token fails when cookie auth is used
- same-site cookie accepted when correct
- cross-site cookie rejected

## 7. Negative tests for business rules
- weekend reservation blocked
- bank holiday reservation blocked
- invalid duration rejected
- uninsured patient without phone rejected
- insured patient without birth year rejected
- seventh visit warns but allows save
