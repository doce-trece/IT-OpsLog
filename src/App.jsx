import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './pages/Login.jsx'
import AlumnoDashboard from './pages/AlumnoDashboard.jsx'
import ProfesorDashboard from './pages/ProfesorDashboard.jsx'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = cargando
  const [perfil, setPerfil] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setPerfil(null)
      return
    }
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) console.error(error)
        setPerfil(data)
      })
  }, [session])

  if (session === undefined) {
    return <div className="cargando">Cargando…</div>
  }

  if (!session) {
    return <Login />
  }

  if (!perfil) {
    return <div className="cargando">Preparando tu cuenta…</div>
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Taller — Registro de operaciones</h1>
        <div className="user-box">
          <span>{perfil.nombre} · {perfil.rol === 'profesor' ? 'Profesor/a' : 'Alumno/a'}</span>
          <button onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
        </div>
      </header>
      <main>
        {perfil.rol === 'profesor'
          ? <ProfesorDashboard perfil={perfil} />
          : <AlumnoDashboard perfil={perfil} />}
      </main>
    </div>
  )
}
