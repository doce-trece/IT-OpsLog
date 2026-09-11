import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function SetNewPassword({ onCompletado }) {
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirmar) {
      setError('Las dos contraseñas no coinciden.')
      return
    }

    setCargando(true)
    const { error: errorUpdate } = await supabase.auth.updateUser({ password })
    setCargando(false)

    if (errorUpdate) { setError('No se pudo cambiar la contraseña. Vuelve a pedir el enlace.'); return }
    onCompletado()
  }

  return (
    <div className="login-wrap">
      <form className="login-box" onSubmit={handleSubmit}>
        <h1>Elige tu nueva contraseña</h1>
        <label>
          Nueva contraseña
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required />
        </label>
        <label>
          Repite la contraseña
          <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} autoComplete="new-password" required />
        </label>
        {error && <div className="error-msg">{error}</div>}
        <button type="submit" disabled={cargando}>{cargando ? 'Guardando…' : 'Guardar contraseña'}</button>
      </form>
    </div>
  )
}
