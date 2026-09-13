// ---------------------------------------------------------------------
// Modelo: cada vez que el alumno "se conecta" (entra en la app y tiene
// este registro activo) se sella el bloque lectivo que corresponde a ese
// instante y arranca un cronómetro. Al "desconectar" (cerrar sesión, o
// enviar el registro a revisión) se para el cronómetro y se suma el
// tiempo transcurrido al total. Si se olvida cerrar sesión, se detecta
// la próxima vez que se conecta y se estima ese tiempo con la duración
// de los bloques que quedaron sellados aquel día.
// ---------------------------------------------------------------------

function claveBloque(fecha, bloqueId) {
  return `${fecha}#${bloqueId}`
}

function duracionBloqueSegundos(bloque) {
  const [hI, mI] = bloque.hora_inicio.split(':').map(Number)
  const [hF, mF] = bloque.hora_fin.split(':').map(Number)
  return ((hF * 60 + mF) - (hI * 60 + mI)) * 60
}

function bloqueEnEsteInstante(bloques, fecha) {
  const diaSemana = fecha.getDay() === 0 ? 7 : fecha.getDay()
  const horaActual = fecha.toTimeString().slice(0, 8)
  return (bloques || []).find(b => b.dia_semana === diaSemana && b.hora_inicio <= horaActual && b.hora_fin >= horaActual) || null
}

// Días de calendario que lleva abierto, sesiones (bloques) contadas y
// días distintos con alguna sesión contada.
export function calcularSesionesYDias(registro) {
  const inicio = new Date(registro.fecha_inicio)
  const fin = registro.revisado_en ? new Date(registro.revisado_en) : new Date()
  const diasCalendario = Math.max(1, Math.round((fin - inicio) / 86400000) + 1)
  const bloquesContados = registro.bloques_contados || []
  const diasTrabajados = new Set(bloquesContados.map(c => c.split('#')[0])).size || (bloquesContados.length ? 1 : 0)
  return { diasCalendario, diasTrabajados, sesiones: bloquesContados.length }
}

// Tiempo total conectado (ms), sumando el tramo en curso si hay una
// conexión abierta ahora mismo.
export function tiempoConectadoMs(registro) {
  let total = (registro.tiempo_conectado_segundos || 0) * 1000
  if (registro.conexion_iniciada_en) {
    total += Date.now() - new Date(registro.conexion_iniciada_en).getTime()
  }
  return total
}

// Se llama al ENTRAR en la app (o recargarla) mientras el registro sigue
// editable (no revisado). Sella el bloque del instante actual, y si
// detecta una conexión de un día anterior que no se cerró, estima su
// duración con los bloques que quedaron contados ese día.
export async function registrarConexion(supabase, registro, bloques) {
  const ahora = new Date()
  const hoy = ahora.toISOString().slice(0, 10)

  let bloquesContados = registro.bloques_contados || []
  let tiempoConectado = registro.tiempo_conectado_segundos || 0
  let conexionIniciada = registro.conexion_iniciada_en

  if (conexionIniciada) {
    const fechaConexion = conexionIniciada.slice(0, 10)
    if (fechaConexion !== hoy) {
      // No se cerró sesión aquel día: estimamos su duración con los
      // bloques que quedaron sellados ese día.
      const segundosEstimados = bloquesContados
        .filter(c => c.startsWith(fechaConexion + '#'))
        .reduce((acc, c) => {
          const bloqueId = Number(c.split('#')[1])
          const bloque = (bloques || []).find(b => b.id === bloqueId)
          return acc + (bloque ? duracionBloqueSegundos(bloque) : 0)
        }, 0)
      tiempoConectado += segundosEstimados
      conexionIniciada = null
    }
  }

  if (!conexionIniciada) {
    conexionIniciada = ahora.toISOString()
  }

  const bloqueActual = bloqueEnEsteInstante(bloques, ahora)
  if (bloqueActual) {
    const clave = claveBloque(hoy, bloqueActual.id)
    if (!bloquesContados.includes(clave)) bloquesContados = [...bloquesContados, clave]
  }

  const cambios = {
    bloques_contados: bloquesContados,
    tiempo_conectado_segundos: tiempoConectado,
    conexion_iniciada_en: conexionIniciada,
  }
  await supabase.from('registros').update(cambios).eq('id', registro.id)
  Object.assign(registro, cambios)
}

// Se llama al CERRAR SESIÓN o al enviar el registro a revisión: para el
// cronómetro y suma el tiempo transcurrido desde que se conectó.
export async function cerrarConexion(supabase, registro) {
  if (!registro.conexion_iniciada_en) return
  const segundos = Math.max(0, Math.round((Date.now() - new Date(registro.conexion_iniciada_en).getTime()) / 1000))
  const nuevoTiempo = (registro.tiempo_conectado_segundos || 0) + segundos
  await supabase
    .from('registros')
    .update({ tiempo_conectado_segundos: nuevoTiempo, conexion_iniciada_en: null })
    .eq('id', registro.id)
  registro.tiempo_conectado_segundos = nuevoTiempo
  registro.conexion_iniciada_en = null
}

// Busca si el usuario logueado tiene algún registro propio sin revisar y,
// si lo tiene y estaba conectado, cierra esa conexión (para el botón de
// "Cerrar sesión", sin depender de qué pantalla esté montada).
export async function cerrarConexionSesionActual(supabase) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data } = await supabase
    .from('registro_alumnos')
    .select('registros(*)')
    .eq('alumno_id', user.id)

  const activo = (data || []).map(d => d.registros).find(r => r && r.estado !== 'revisado')
  if (activo) await cerrarConexion(supabase, activo)
}
