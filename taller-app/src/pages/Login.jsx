import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [vista, setVista] = useState('login') // login | recuperar | enviado

  return (
    <div className="login-wrap">
      {vista === 'login' && <FormularioLogin onOlvido={() => setVista('recuperar')} />}
      {vista === 'recuperar' && (
        <FormularioRecuperar
          onEnviado={() => setVista('enviado')}
          onVolver={() => setVista('login')}
        />
      )}
      {vista === 'enviado' && <MensajeEnviado onVolver={() => setVista('login')} />}
    </div>
  )
}

function FormularioLogin({ onOlvido }) {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setCargando(true)

    const { data: email, error: errorUsuario } = await supabase.rpc('email_from_username', {
      p_username: usuario.trim(),
    })

    if (errorUsuario || !email) {
      setError('Ese usuario no existe.')
      setCargando(false)
      return
    }

    const { error: errorLogin } = await supabase.auth.signInWithPassword({ email, password })
    setCargando(false)
    if (errorLogin) setError('Usuario o contraseña incorrectos.')
  }

  return (
    <form className="login-box" onSubmit={handleSubmit}>
      <h1>Registro de operaciones</h1>
      <p className="subtitle">Inicia sesión con el usuario que te ha dado tu profesor/a</p>
      <label>
        Usuario
        <input type="text" value={usuario} onChange={e => setUsuario(e.target.value)} autoComplete="username" required />
      </label>
      <label>
        Contraseña
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
      </label>
      {error && <div className="error-msg">{error}</div>}
      <button type="submit" disabled={cargando}>{cargando ? 'Entrando…' : 'Entrar'}</button>
      <button type="button" className="link-btn" onClick={onOlvido}>¿Has olvidado tu contraseña?</button>
    </form>
  )
}

function FormularioRecuperar({ onEnviado, onVolver }) {
  const [usuario, setUsuario] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setCargando(true)

    const { data: email, error: errorUsuario } = await supabase.rpc('email_from_username', {
      p_username: usuario.trim(),
    })

    if (errorUsuario || !email) {
      setError('Ese usuario no existe.')
      setCargando(false)
      return
    }

    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`
    const { error: errorReset } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    setCargando(false)
    if (errorReset) { setError('No se pudo enviar el correo. Inténtalo de nuevo.'); return }
    onEnviado()
  }

  return (
    <form className="login-box" onSubmit={handleSubmit}>
      <h1>Recuperar contraseña</h1>
      <p className="subtitle">Te enviaremos un enlace al correo asociado a tu usuario</p>
      <label>
        Usuario
        <input type="text" value={usuario} onChange={e => setUsuario(e.target.value)} autoComplete="username" required />
      </label>
      {error && <div className="error-msg">{error}</div>}
      <button type="submit" disabled={cargando}>{cargando ? 'Enviando…' : 'Enviar enlace'}</button>
      <button type="button" className="link-btn" onClick={onVolver}>Volver al login</button>
    </form>
  )
}

function MensajeEnviado({ onVolver }) {
  return (
    <div className="login-box">
      <h1>Revisa tu correo</h1>
      <p className="subtitle">
        Si el usuario existe, te hemos enviado un enlace para elegir una contraseña nueva.
        Puede tardar unos minutos en llegar; revisa también la carpeta de spam.
      </p>
      <button type="button" onClick={onVolver}>Volver al login</button>
    </div>
  )
}
