import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from './api/client'
import { ReservationsPage } from './features/reservations/ReservationsPage'
import { WorkSchedulePage } from './features/workSchedule/WorkSchedulePage'
import { dateKey } from './features/reservations/dates'
import './App.css'

type Role = 'ADMIN' | 'THERAPIST'
type View = 'overview' | 'reservations' | 'schedule' | 'users' | 'insurers' | 'sessions'
type ReservationStatus = 'ACTIVE' | 'EXCUSED' | 'CANCELLED'

type AppUser = {
  id: number
  login: string
  role: Role
  therapistId?: number | null
}

type SanitizedReservation = {
  id: number
  therapist_id: number
  patient_id: number
  start_at: string
  end_at: string
  duration_minutes: number
  status: ReservationStatus
  created_at: string
}

type AdminSession = {
  id: number
  user_id: number
  login: string
  device_label: string | null
  created_at: string
  last_seen_at: string
  expires_at: string
  is_revoked: boolean
}

type InsurerContract = {
  id: number
  validFrom: string | null
  validTo: string | null
}

type InsurerRecord = {
  id: number
  code: string
  name: string
  isActive: boolean
  contracts: InsurerContract[]
}

type AdminUser = {
  id: number
  login: string
  role: Role
  therapistId: number | null
  therapistName: string
  isActive: boolean
  lastLoginAt: string | null
}

const therapistNames: Record<number, string> = {
  1: 'Terapeutka A',
  2: 'Terapeutka B',
}

const defaultUsers: AdminUser[] = [
  { id: 1, login: 'admin', role: 'ADMIN', therapistId: null, therapistName: 'Administrátor', isActive: true, lastLoginAt: null },
  { id: 2, login: 'therapist_a', role: 'THERAPIST', therapistId: 1, therapistName: 'Terapeutka A', isActive: true, lastLoginAt: null },
  { id: 3, login: 'therapist_b', role: 'THERAPIST', therapistId: 2, therapistName: 'Terapeutka B', isActive: true, lastLoginAt: null },
]

function getPragueOffsetMinutes(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal' && part.type !== 'timeZoneName')
      .map((part) => [part.type, part.value]),
  )

  const utcMs = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  )

  return (utcMs - date.getTime()) / 60000
}

function normalizeDateValue(value?: string | null) {
  if (!value) return null

  const trimmed = String(value).trim()
  if (!trimmed) return null

  const hasExplicitTimezone = /Z|[+-]\d{2}:?\d{2}$/.test(trimmed)
  const naiveSqlMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/)

  if (naiveSqlMatch && !hasExplicitTimezone) {
    const [, year, month, day, hour, minute, second = '00'] = naiveSqlMatch
    const utcTime = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    )

    const pragueOffsetMinutes = getPragueOffsetMinutes(new Date(utcTime))
    return new Date(utcTime - pragueOffsetMinutes * 60 * 1000)
  }

  const parsed = new Date(trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDateTime(value?: string | null) {
  const parsedDate = normalizeDateValue(value)
  if (!parsedDate) return '—'

  return new Intl.DateTimeFormat('cs-CZ', {
    timeZone: 'Europe/Prague',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsedDate)
}

function formatSessionStatus(isRevoked: boolean, expiresAt: string) {
  const expiresAtDate = normalizeDateValue(expiresAt)

  if (isRevoked) return 'Zneplatněno'
  if (!expiresAtDate || expiresAtDate.getTime() <= Date.now()) return 'Vypršelo'
  return 'Aktivní'
}

function App() {
  const [planDate, setPlanDate] = useState(dateKey())
  const [loggedIn, setLoggedIn] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [username, setUsername] = useState('admin')
  const [token, setToken] = useState('')
  const [user, setUser] = useState<AppUser | null>(null)
  const [reservations, setReservations] = useState<SanitizedReservation[]>([])
  const [sessions, setSessions] = useState<AdminSession[]>([])
  const [users, setUsers] = useState<AdminUser[]>(defaultUsers)
  const [insurers, setInsurers] = useState<InsurerRecord[]>([])
  const [activeView, setActiveView] = useState<View>('reservations')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [showUserCreate, setShowUserCreate] = useState(false)
  const [resetTargetUserId, setResetTargetUserId] = useState<number | null>(null)
  const [newAccessKey, setNewAccessKey] = useState('')
  const [newUserLogin, setNewUserLogin] = useState('')
  const [newUserRole, setNewUserRole] = useState<Role>('THERAPIST')
  const [newUserTherapistId, setNewUserTherapistId] = useState<number | ''>('')
  const [generatedAccessKey, setGeneratedAccessKey] = useState('')

  const [newContractInsurerId, setNewContractInsurerId] = useState<number | ''>('')
  const [newContractFrom, setNewContractFrom] = useState('')
  const [newContractTo, setNewContractTo] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    apiFetch<{ user: AppUser }>('/auth/me', { signal: controller.signal })
      .then((me) => { setUser(me.user); setLoggedIn(true) })
      .catch(() => { /* An absent session leaves the login form available. */ })
      .finally(() => { if (!controller.signal.aborted) setCheckingSession(false) })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!loggedIn) return
    const expire = () => {
      setLoggedIn(false)
      setUser(null)
      setToken('')
      setReservations([])
      setSessions([])
      setUsers([])
      setInsurers([])
      setNewAccessKey('')
      setGeneratedAccessKey('')
      setShowUserCreate(false)
      setShowPasswordReset(false)
      setActiveView('reservations')
      setErrorMessage('Přihlášení vypršelo nebo bylo odvoláno. Přihlaste se znovu.')
    }
    window.addEventListener('session-expired', expire)
    return () => window.removeEventListener('session-expired', expire)
  }, [loggedIn])

  const todayLabel = new Intl.DateTimeFormat('cs-CZ', {
    timeZone: 'Europe/Prague',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  const normalizedUsers = useMemo(
    () =>
      users.map((entry) => ({
        ...entry,
        therapistName: entry.role === 'ADMIN' ? 'Administrátor' : entry.therapistName,
      })),
    [users],
  )

  const computedStats = useMemo(() => {
    const activeReservations = reservations.filter((reservation) => reservation.status === 'ACTIVE').length
    const excusedReservations = reservations.filter((reservation) => reservation.status === 'EXCUSED').length
    const activeSessions = sessions.filter((session) => {
      const expiresAt = normalizeDateValue(session.expires_at)
      return !session.is_revoked && expiresAt && expiresAt.getTime() > Date.now()
    }).length

    return {
      all: reservations.length,
      activeReservations,
      excusedReservations,
      activeSessions,
      inactiveUsers: normalizedUsers.filter((entry) => !entry.isActive).length,
    }
  }, [normalizedUsers, reservations, sessions])

  const filteredReservations = useMemo(() => {
    return [...reservations].sort((first, second) => new Date(second.start_at).getTime() - new Date(first.start_at).getTime())
  }, [reservations])

  const therapistSummary = useMemo(() => {
    return Object.entries(therapistNames).map(([therapistId, therapistName]) => {
      const therapistReservations = filteredReservations.filter(
        (reservation) => Number(reservation.therapist_id) === Number(therapistId),
      )

      return {
        therapistId: Number(therapistId),
        therapistName,
        count: therapistReservations.length,
        active: therapistReservations.filter((reservation) => reservation.status === 'ACTIVE').length,
        excused: therapistReservations.filter((reservation) => reservation.status === 'EXCUSED').length,
      }
    })
  }, [filteredReservations])

  const upcomingReservations = useMemo(() => filteredReservations.slice(0, 5), [filteredReservations])

  const recentActivity = useMemo(
    () => [...sessions].sort((first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime()).slice(0, 5),
    [sessions],
  )

  const insurerSummary = useMemo(() => {
    const activeContracts = insurers.filter((insurer) => insurer.contracts.length > 0).length
    return {
      total: insurers.length,
      activeContracts,
    }
  }, [insurers])

  const loadAdminData = async () => {
    type ActiveAdminUserApi = {
      id: number
      login: string
      role: Role
      therapist_id: number | null
      is_active: boolean
      last_login_at: string | null
      active_session_count: number
      last_seen_at: string | null
    }

    const [me, reservationData, sessionData, activeUsers, insurerData] = await Promise.all([
      apiFetch<{ user: AppUser }>('/auth/me'),
      apiFetch<SanitizedReservation[]>(`/reservations?date=${dateKey()}`),
      apiFetch<AdminSession[]>('/admin/sessions'),
      apiFetch<ActiveAdminUserApi[]>('/admin/users/active'),
      apiFetch<InsurerRecord[]>('/insurers'),
    ])

    setUser(me.user)
    setReservations(reservationData)
    setSessions(sessionData)
    setInsurers(insurerData)

    const mergedUsers = (activeUsers.length > 0 ? activeUsers : defaultUsers).map((candidate) => {
      const match = sessionData.find((session) => session.user_id === candidate.id)
      const therapistId = 'therapist_id' in candidate ? candidate.therapist_id ?? null : candidate.therapistId ?? null
      const isActive = 'is_active' in candidate ? Boolean(candidate.is_active) : Boolean(candidate.isActive)
      const lastLoginAt = 'last_login_at' in candidate ? candidate.last_login_at ?? (match ? match.last_seen_at : null) : candidate.lastLoginAt

      const normalized = {
        id: candidate.id,
        login: candidate.login,
        role: candidate.role,
        therapistId,
        therapistName: candidate.role === 'ADMIN' ? 'Administrátor' : (therapistId ? therapistNames[therapistId] ?? 'Neznámý terapeut' : 'Neznámý terapeut'),
        isActive,
        lastLoginAt,
      }

      return normalized
    })

    setUsers(mergedUsers)
  }

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setErrorMessage('')

    try {
      const me = await apiFetch<{ user: AppUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login: username.trim(), token: token.trim() }),
      })

      setUser(me.user)
      setToken('')
      setActiveView('reservations')
      setLoggedIn(true)
    } catch (error) {
      setLoggedIn(false)
      setUser(null)
      setReservations([])
      setSessions([])
      setErrorMessage(error instanceof Error ? error.message : 'Přihlášení se nezdařilo.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' })
      setLoggedIn(false)
      setUser(null)
      setToken('')
      setReservations([])
      setSessions([])
      setUsers([])
      setInsurers([])
      setNewAccessKey('')
      setGeneratedAccessKey('')
      setShowUserCreate(false)
      setShowPasswordReset(false)
      setErrorMessage('')
      setActiveView('reservations')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Odhlášení se nezdařilo. Zkuste to znovu.')
    }
  }

  const revokeSession = async (sessionId: number) => {
    if (!user || user.role !== 'ADMIN') return

    try {
      await apiFetch<{ revoked: boolean }>(`/admin/sessions/${sessionId}/revoke`, {
        method: 'POST',
      })

      setSessions((current) =>
        current.map((session) =>
          session.id === sessionId ? { ...session, is_revoked: true } : session,
        ),
      )
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Zneplatnění relace se nezdařilo.')
    }
  }

  const revokeAllUserSessions = async (targetUserId: number) => {
    if (!user || user.role !== 'ADMIN') return

    try {
      await apiFetch<{ revokedAll: boolean; userId: number }>('/admin/sessions/revoke-all', {
        method: 'POST',
        body: JSON.stringify({ userId: targetUserId }),
      })

      setSessions((current) =>
        current.map((session) =>
          session.user_id === targetUserId ? { ...session, is_revoked: true } : session,
        ),
      )
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Zneplatnění všech relací se nezdařilo.')
    }
  }

  const handlePasswordReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!resetTargetUserId) return

    try {
      await apiFetch<{ userId: number; login: string }>('/admin/users/' + resetTargetUserId + '/password-reset', {
        method: 'POST',
        body: JSON.stringify({ newPassword: newAccessKey.trim() }),
      })

      setShowPasswordReset(false)
      setResetTargetUserId(null)
      setNewAccessKey('')
      setErrorMessage('Přístupový klíč byl úspěšně resetován. Starý přístup přestal platit.')
      await loadAdminData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Reset přístupového klíče se nezdařil.')
    }
  }

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      const payload = await apiFetch<{ id: number; login: string; role: Role; therapistId: number | null; accessKey: string }>('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          login: newUserLogin.trim(),
          role: newUserRole,
          therapistId: newUserRole === 'THERAPIST' ? Number(newUserTherapistId) : null,
        }),
      })

      setGeneratedAccessKey(payload.accessKey)
      setShowUserCreate(false)
      setNewUserLogin('')
      setNewUserRole('THERAPIST')
      setNewUserTherapistId('')
      setErrorMessage(`Uživatel ${payload.login} byl vytvořen. Nový přístupový klíč byl vygenerován a zobrazen níže.`)
      await loadAdminData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Vytvoření uživatele se nezdařilo.')
    }
  }

  const handleCreateContract = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!newContractInsurerId || !newContractFrom) {
      setErrorMessage('Vyberte pojišťovnu a datum platnosti od.')
      return
    }

    try {
      await apiFetch<{ id: number; insurerId: number; validFrom: string; validTo: string | null }>('/insurers/' + newContractInsurerId + '/contracts', {
        method: 'POST',
        body: JSON.stringify({
          validFrom: newContractFrom,
          validTo: newContractTo || null,
        }),
      })

      setNewContractInsurerId('')
      setNewContractFrom('')
      setNewContractTo('')
      setErrorMessage('Smluvní období bylo přidáno.')
      await loadAdminData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Přidání smluvního období se nezdařilo.')
    }
  }

  const handleDeleteContract = async (contractId: number) => {
    try {
      await apiFetch<{ deleted: boolean; id: number }>('/insurers/contracts/' + contractId, {
        method: 'DELETE',
      })

      setErrorMessage('Smluvní období bylo odstraněno.')
      await loadAdminData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Odstranění smluvního období se nezdařilo.')
    }
  }

  const toggleUserStatus = (targetUserId: number) => {
    setUsers((current) =>
      current.map((entry) =>
        entry.id === targetUserId ? { ...entry, isActive: !entry.isActive } : entry,
      ),
    )
  }

  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    if (loggedIn && isAdmin && activeView !== 'reservations' && activeView !== 'schedule') {
      loadAdminData().catch(() => {
        setErrorMessage('Nepodařilo se načíst admin data.')
      })
    }
  }, [loggedIn, isAdmin, activeView])

  if (checkingSession) return <main className="app-shell"><section className="login-card" role="status">Ověřování přihlášení…</section></main>

  if (!loggedIn) {
    return (
      <main className="app-shell">
        <section className="login-card">
          <div className="brand-block">
            <img src="/favicon.svg" alt="RehaFlex logo" className="brand-logo" />
            <div>
              <p className="eyebrow">Interní rezervační systém</p>
              <h1>RehaFlex</h1>
            </div>
          </div>

          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Login
              <input
                className="field-control"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="admin"
              />
            </label>

            <label>
              32 znakový token
              <input
                className="field-control"
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="••••••••••••••••••••••••••••••"
              />
            </label>

            <button type="submit" className="primary-button" disabled={isLoading}>
              {isLoading ? 'Přihlašování...' : 'Přihlásit se'}
            </button>
          </form>

          {errorMessage && <p className="error-banner">{errorMessage}</p>}

        </section>
      </main>
    )
  }

  return (
    <main className={`app-shell app-shell--dashboard${isAdmin ? '' : ' app-shell--therapist'}`}>
      <div className="admin-layout">
        <aside className="sidebar">
          <div className="brand-block sidebar-brand">
            <img src="/favicon.svg" alt="RehaFlex logo" className="brand-logo" />
            <div>
              <p className="eyebrow">{isAdmin ? 'Admin panel' : 'Rezervace a návštěvy'}</p>
              <h1>RehaFlex</h1>
            </div>
          </div>

          <nav className="sidebar-nav" aria-label="Hlavní menu">
            <p className="nav-group-label">Plán</p>
            {[
              { id: 'reservations', label: 'Můj plán' },
              { id: 'schedule', label: 'Směny' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={activeView === item.id ? 'page' : undefined}
                className={activeView === item.id ? 'nav-item nav-item--active' : 'nav-item'}
                onClick={() => setActiveView(item.id as View)}
              >
                {item.label}
              </button>
            ))}
            {isAdmin && <>
              <p className="nav-group-label">Správa</p>
              {[
                { id: 'overview', label: 'Souhrn' },
                { id: 'users', label: 'Uživatelé' },
                { id: 'insurers', label: 'Pojišťovny' },
                { id: 'sessions', label: 'Aktivita' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-current={activeView === item.id ? 'page' : undefined}
                className={activeView === item.id ? 'nav-item nav-item--active' : 'nav-item'}
                  onClick={() => setActiveView(item.id as View)}
                >
                  {item.label}
                </button>
              ))}
            </>}
          </nav>

          <div className="sidebar-footer">
            <div>
              <p className="eyebrow">Přihlášen</p>
              <strong>{user?.login}</strong>
            </div>
            <button type="button" className="ghost-button" onClick={handleLogout}>Odhlásit</button>
          </div>
        </aside>

        <section className="content-panel">
          <div className="mobile-account"><strong>RehaFlex · {user?.login}</strong><button type="button" className="ghost-button" onClick={handleLogout}>Odhlásit</button></div>
          {activeView !== 'reservations' && activeView !== 'schedule' && <header className="topbar">
            <div>
              <p className="eyebrow">Dnešní přehled</p>
              <h2>{todayLabel}</h2>
            </div>
            <div className="topbar-actions">
              <span className="soft-label">{filteredReservations.length} záznamů</span>
            </div>
          </header>}

          {errorMessage && <div className="error-banner">{errorMessage}</div>}

          {activeView === 'overview' && <section className="stats-grid" aria-label="Statistiky">
            <article className="stat-card stat-card--primary">
              <span>Celkem rezervací</span>
              <strong>{computedStats.all}</strong>
              <small>v dnešním dni</small>
            </article>
            <article className="stat-card">
              <span>Aktivní</span>
              <strong>{computedStats.activeReservations}</strong>
              <small>schválené termíny</small>
            </article>
            <article className="stat-card">
              <span>Omluvené</span>
              <strong>{computedStats.excusedReservations}</strong>
              <small>nepočítají se do limitu</small>
            </article>
            <article className="stat-card">
              <span>Aktivní relace</span>
              <strong>{computedStats.activeSessions}</strong>
              <small>přihlášena zařízení</small>
            </article>
          </section>}

          {activeView === 'overview' && (
            <div className="stacked-panels">
              <section className="panel">
                <div className="panel-heading">
                  <h3>Terapeutky</h3>
                  <span>{therapistSummary.length} profily</span>
                </div>

                <div className="therapist-summary">
                  {therapistSummary.map((therapist) => (
                    <div key={therapist.therapistId} className="therapist-card">
                      <div className="therapist-card__header">
                        <strong>{therapist.therapistName}</strong>
                        <span>{therapist.count} záznamů</span>
                      </div>

                      <div className="therapist-card__stats">
                        <div>
                          <span>Aktivní</span>
                          <strong>{therapist.active}</strong>
                        </div>
                        <div>
                          <span>Omluvené</span>
                          <strong>{therapist.excused}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <h3>Nejbližší rezervace</h3>
                  <span>{upcomingReservations.length} položek</span>
                </div>

                <div className="reservation-list">
                  {upcomingReservations.map((reservation) => {
                    const therapistName = therapistNames[reservation.therapist_id] ?? 'Neznámý terapeut'
                    return (
                      <div key={reservation.id} className="reservation-item">
                        <div>
                          <strong>{formatDateTime(reservation.start_at)}</strong>
                          <small>{therapistName}</small>
                        </div>
                        <div className="reservation-item__meta">
                          <span>Pacient #{reservation.patient_id}</span>
                          <span className={`tag ${reservation.status === 'ACTIVE' ? 'tag--success' : reservation.status === 'EXCUSED' ? 'tag--warning' : 'tag--muted'}`}>
                            {reservation.status}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <h3>Pojišťovny</h3>
                  <span>{insurerSummary.total} záznamů</span>
                </div>

                <div className="summary-boxes">
                  <div className="summary-box">
                    <span>Celkem</span>
                    <strong>{insurerSummary.total}</strong>
                  </div>
                  <div className="summary-box">
                    <span>Smluvní</span>
                    <strong>{insurerSummary.activeContracts}</strong>
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <h3>Aktivita na webu</h3>
                  <span>{recentActivity.length} posledních záznamů</span>
                </div>

                <div className="activity-list">
                  {recentActivity.map((session) => (
                    <div key={session.id} className="activity-item">
                      <div>
                        <strong>{session.login}</strong>
                        <small>{session.device_label ?? 'web'}</small>
                      </div>
                      <span className={`tag ${session.is_revoked ? 'tag--muted' : 'tag--success'}`}>
                        {session.is_revoked ? 'Zneplatněno' : 'Aktivní'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeView === 'reservations' && (
            <ReservationsPage initialDate={planDate} onDateChange={setPlanDate} ownTherapistId={user?.therapistId ?? null} />
          )}

          {activeView === 'schedule' && (
            <WorkSchedulePage initialDate={planDate} onDateChange={setPlanDate} ownTherapistId={user?.therapistId ?? null} isAdmin={isAdmin} />
          )}

          {activeView === 'users' && (
            <section className="panel">
              <div className="panel-heading">
                <h3>Správa uživatelů</h3>
                <span>{normalizedUsers.length} účtů</span>
              </div>

              <div className="inline-actions" style={{ marginBottom: '1rem' }}>
                <button type="button" className="primary-button" onClick={() => setShowUserCreate(true)}>
                  Přidat uživatele
                </button>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Login</th>
                      <th>Role</th>
                      <th>Terapeut</th>
                      <th>Poslední přihlášení</th>
                      <th>Stav</th>
                      <th>Akce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {normalizedUsers.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.login}</td>
                        <td>{entry.role}</td>
                        <td>{entry.therapistName}</td>
                        <td>{formatDateTime(entry.lastLoginAt)}</td>
                        <td>
                          <span className={entry.isActive ? 'tag tag--success' : 'tag tag--danger'}>
                            {entry.isActive ? 'Aktivní' : 'Deaktivovaný'}
                          </span>
                        </td>
                        <td>
                          <div className="inline-actions">
                            <button type="button" className="secondary-button" onClick={() => revokeAllUserSessions(entry.id)}>
                              Zneplatnit relace
                            </button>
                            <button type="button" className="secondary-button" onClick={() => {
                              setResetTargetUserId(entry.id)
                              setShowPasswordReset(true)
                            }}>
                              Nové heslo
                            </button>
                            <button type="button" className="ghost-button" onClick={() => toggleUserStatus(entry.id)}>
                              {entry.isActive ? 'Deaktivovat' : 'Aktivovat'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeView === 'insurers' && (
            <section className="panel">
              <div className="panel-heading">
                <h3>Smluvní pojišťovny</h3>
                <span>{insurers.length} záznamů</span>
              </div>

              <form onSubmit={handleCreateContract} className="login-form" style={{ marginBottom: '1rem' }}>
                <label>
                  Pojišťovna
                  <select className="field-control" value={newContractInsurerId} onChange={(event) => setNewContractInsurerId(event.target.value === '' ? '' : Number(event.target.value))}>
                    <option value="">Vyberte pojišťovnu</option>
                    {insurers.map((insurer) => (
                      <option key={insurer.id} value={insurer.id}>{insurer.code} – {insurer.name}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Platnost od
                  <input className="field-control" type="date" value={newContractFrom} onChange={(event) => setNewContractFrom(event.target.value)} />
                </label>

                <label>
                  Platnost do
                  <input className="field-control" type="date" value={newContractTo} onChange={(event) => setNewContractTo(event.target.value)} />
                </label>

                <div className="inline-actions">
                  <button type="submit" className="primary-button">Přidat smlouvu</button>
                </div>
              </form>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Kód</th>
                      <th>Název</th>
                      <th>Platnost</th>
                      <th>Akce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insurers.map((insurer) => (
                      <tr key={insurer.id}>
                        <td>{insurer.code}</td>
                        <td>{insurer.name}</td>
                        <td>
                          {insurer.contracts.length > 0 ? insurer.contracts.map((contract) => (
                            <div key={contract.id}>
                              {contract.validFrom} – {contract.validTo ?? 'bez limitu'}
                            </div>
                          )) : 'Bez smluvního období'}
                        </td>
                        <td>
                          <div className="inline-actions">
                            {insurer.contracts.map((contract) => (
                              <button key={contract.id} type="button" className="ghost-button" onClick={() => handleDeleteContract(contract.id)}>
                                Odebrat
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeView === 'sessions' && (
            <section className="panel">
              <div className="panel-heading">
                <h3>Aktivní relace</h3>
                <span>{sessions.filter((session) => !session.is_revoked).length} aktivních</span>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Uživatel</th>
                      <th>Zařízení</th>
                      <th>Vytvořeno</th>
                      <th>Expirace</th>
                      <th>Stav</th>
                      <th>Akce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => (
                      <tr key={session.id}>
                        <td>{session.login}</td>
                        <td>{session.device_label ?? 'web'}</td>
                        <td>{formatDateTime(session.created_at)}</td>
                        <td>{formatDateTime(session.expires_at)}</td>
                        <td>
                          <span className={`tag ${formatSessionStatus(session.is_revoked, session.expires_at) === 'Aktivní' ? 'tag--success' : 'tag--muted'}`}>
                            {formatSessionStatus(session.is_revoked, session.expires_at)}
                          </span>
                        </td>
                        <td>
                          {!session.is_revoked && (
                            <button type="button" className="secondary-button" onClick={() => revokeSession(session.id)}>
                              Zneplatnit
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {showUserCreate && (
            <div className="modal-backdrop" onClick={() => setShowUserCreate(false)}>
              <div className="modal-card" onClick={(event) => event.stopPropagation()}>
                <div className="panel-heading">
                  <h3>Přidat uživatele</h3>
                </div>

                <form onSubmit={handleCreateUser} className="login-form">
                  <label>
                    Login
                    <input
                      className="field-control"
                      value={newUserLogin}
                      onChange={(event) => setNewUserLogin(event.target.value)}
                      placeholder="např. milosh"
                    />
                  </label>

                  <label>
                    Role
                    <select className="field-control" value={newUserRole} onChange={(event) => setNewUserRole(event.target.value as Role)}>
                      <option value="THERAPIST">THERAPIST</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </label>

                  {newUserRole === 'THERAPIST' && (
                    <label>
                      ID terapeuta
                      <input
                        className="field-control"
                        type="number"
                        min="1"
                        value={newUserTherapistId}
                        onChange={(event) => setNewUserTherapistId(event.target.value === '' ? '' : Number(event.target.value))}
                        placeholder="1"
                      />
                    </label>
                  )}

                  <div className="inline-actions">
                    <button type="submit" className="primary-button">Vytvořit</button>
                    <button type="button" className="ghost-button" onClick={() => setShowUserCreate(false)}>Zrušit</button>
                  </div>
                </form>

                {generatedAccessKey && (
                  <div className="security-note" style={{ marginTop: '1rem' }}>
                    <strong>Vygenerovaný klíč:</strong>
                    <div>{generatedAccessKey}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {showPasswordReset && (
            <div className="modal-backdrop" onClick={() => setShowPasswordReset(false)}>
              <div className="modal-card" onClick={(event) => event.stopPropagation()}>
                <div className="panel-heading">
                  <h3>Reset přístupového klíče</h3>
                </div>

                <form onSubmit={handlePasswordReset} className="login-form">
                  <label>
                    Nový klíč
                    <input
                      className="field-control"
                      type="password"
                      value={newAccessKey}
                      onChange={(event) => setNewAccessKey(event.target.value)}
                      placeholder="Zadejte nový přístupový klíč"
                    />
                  </label>

                  <div className="inline-actions">
                    <button type="submit" className="primary-button">Uložit</button>
                    <button type="button" className="ghost-button" onClick={() => setShowPasswordReset(false)}>Zrušit</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default App
