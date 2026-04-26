import { useState } from 'react'
import { Car, Clock, MapPin, Phone, CheckCircle, AlertCircle, Navigation } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

interface Course {
  id: string
  heure: string
  client: string
  pax: number
  depart: string
  arrivee: string
  vehicule: string
  statut: 'en_attente' | 'en_cours' | 'termine' | 'annule'
  contact?: string
}

const MOCK_COURSES: Course[] = [
  {
    id: '1', heure: '08:30', client: 'Groupe YS Travel',
    pax: 18, depart: 'Hôtel Sofitel Casablanca', arrivee: 'Aéroport CMN',
    vehicule: 'Mercedes Sprinter 20 places', statut: 'en_attente', contact: '+212 6 12 34 56 78',
  },
  {
    id: '2', heure: '14:00', client: 'Famille Dubois',
    pax: 4, depart: 'Aéroport CMN', arrivee: 'Riad Fès Médina',
    vehicule: 'Toyota Land Cruiser', statut: 'en_attente', contact: '+33 6 98 76 54 32',
  },
  {
    id: '3', heure: '18:00', client: 'Incentive SANOFI',
    pax: 35, depart: 'Palais des Congrès Marrakech', arrivee: 'Hôtel Mamounia',
    vehicule: 'Autocar 48 places', statut: 'en_attente',
  },
]

const STATUT_CONFIG = {
  en_attente: { label: 'En attente',  color: '#f59e0b', bg: '#f59e0b15' },
  en_cours:   { label: 'En cours',    color: '#3b82f6', bg: '#3b82f615' },
  termine:    { label: 'Terminé',     color: '#10b981', bg: '#10b98115' },
  annule:     { label: 'Annulé',      color: '#ef4444', bg: '#ef444415' },
}

export function DriverPortalPage() {
  const { user } = useAuthStore()
  const [courses, setCourses] = useState<Course[]>(MOCK_COURSES)
  const today = new Date().toLocaleDateString('fr-MA', { weekday: 'long', day: 'numeric', month: 'long' })

  function updateStatut(id: string, statut: Course['statut']) {
    setCourses(prev => prev.map(c => c.id === id ? { ...c, statut } : c))
  }

  const termine  = courses.filter(c => c.statut === 'termine').length
  const total    = courses.length
  const enCours  = courses.find(c => c.statut === 'en_cours')

  return (
    <div style={{ minHeight: '100vh', background: '#0A0F1D', color: '#fff', padding: '1.5rem', maxWidth: 560, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#1628A9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Car size={20} />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: '1rem' }}>{user?.full_name ?? 'Chauffeur'}</p>
            <p style={{ fontSize: '0.75rem', color: '#64748b' }}>RIDE HORIZON · {today}</p>
          </div>
        </div>

        {/* Barre progression */}
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '0.75rem 1rem', display: 'flex', gap: '2rem', marginTop: '1rem' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1628A9' }}>{total}</p>
            <p style={{ fontSize: '0.7rem', color: '#64748b' }}>Courses</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>{termine}</p>
            <p style={{ fontSize: '0.7rem', color: '#64748b' }}>Terminées</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>{total - termine}</p>
            <p style={{ fontSize: '0.7rem', color: '#64748b' }}>Restantes</p>
          </div>
        </div>
      </div>

      {/* Course en cours highlight */}
      {enCours && (
        <div style={{ background: '#1628A915', border: '1px solid #1628A9', borderRadius: 12, padding: '1rem', marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.7rem', color: '#1628A9', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            🔵 Course en cours
          </p>
          <p style={{ fontWeight: 600 }}>{enCours.client}</p>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, fontSize: '0.8rem', color: '#94a3b8' }}>
            <Navigation size={12} /> {enCours.depart} → {enCours.arrivee}
          </div>
        </div>
      )}

      {/* Liste courses */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {courses.map((course) => {
          const cfg = STATUT_CONFIG[course.statut]
          return (
            <div key={course.id} style={{
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: '1rem',
              background: 'rgba(255,255,255,0.02)',
            }}>
              {/* Heure + statut */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={14} color='#64748b' />
                  <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{course.heure}</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>· {course.pax} pax</span>
                </div>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 20, background: cfg.bg, color: cfg.color }}>
                  {cfg.label}
                </span>
              </div>

              {/* Client */}
              <p style={{ fontWeight: 600, marginBottom: 6 }}>{course.client}</p>

              {/* Trajet */}
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <MapPin size={11} color='#10b981' /> <span>{course.depart}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <MapPin size={11} color='#ef4444' /> <span>{course.arrivee}</span>
                </div>
              </div>

              {/* Véhicule + contact */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#475569', marginBottom: 10 }}>
                <span>🚌 {course.vehicule}</span>
                {course.contact && (
                  <a href={`tel:${course.contact}`} style={{ color: '#1628A9', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                    <Phone size={11} /> {course.contact}
                  </a>
                )}
              </div>

              {/* Actions */}
              {course.statut === 'en_attente' && (
                <button
                  onClick={() => updateStatut(course.id, 'en_cours')}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: 'none', background: '#1628A9', color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Démarrer la course
                </button>
              )}
              {course.statut === 'en_cours' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => updateStatut(course.id, 'termine')}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <CheckCircle size={14} /> Arrivé
                  </button>
                  <button
                    onClick={() => updateStatut(course.id, 'annule')}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: 8, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <AlertCircle size={14} /> Problème
                  </button>
                </div>
              )}
              {course.statut === 'termine' && (
                <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#10b981' }}>✓ Course complétée</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
