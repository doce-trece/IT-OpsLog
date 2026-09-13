// Calcula cuántos días de calendario lleva abierto un registro (desde que
// se creó hasta que se revisó, o hasta hoy si sigue en marcha), y cuántos
// de esos días tuvo actividad real (alguien guardó algo ese día).
export function calcularSesionesYDias(registro) {
  const inicio = new Date(registro.fecha_inicio)
  const fin = registro.revisado_en ? new Date(registro.revisado_en) : new Date()
  const diasCalendario = Math.max(1, Math.round((fin - inicio) / 86400000) + 1)
  const fechasActividad = registro.fechas_actividad || [registro.fecha_inicio?.slice(0, 10)]
  return {
    diasCalendario,
    diasTrabajados: fechasActividad.length,
  }
}

// Cuenta cuántos bloques lectivos (sesiones de aula) se han "usado" en la
// operación, contando SOLO los días en los que hubo actividad real (no
// todo el rango de calendario desde que se abrió, para no contar de más
// los días en los que el alumno faltó o no tocó el registro) y, dentro
// del día en que se abrió o se cerró, solo los bloques cuya franja
// horaria realmente cae dentro del tiempo en que el registro ha estado
// abierto (para no contar bloques anteriores al inicio ni posteriores al
// momento actual).
export function contarBloquesTranscurridos(bloques, registro) {
  if (!bloques || bloques.length === 0) return 0
  const fechasActividad = registro.fechas_actividad || [registro.fecha_inicio?.slice(0, 10)]
  const inicioRegistro = new Date(registro.fecha_inicio)
  const finRegistro = registro.revisado_en ? new Date(registro.revisado_en) : new Date()
  const fechaInicioStr = registro.fecha_inicio?.slice(0, 10)
  const fechaFinStr = finRegistro.toISOString().slice(0, 10)

  let contador = 0
  for (const fecha of fechasActividad) {
    if (!fecha) continue
    const [anio, mes, dia] = fecha.split('-').map(Number)
    const diaSemanaJs = new Date(anio, mes - 1, dia).getDay()
    const diaSemana = diaSemanaJs === 0 ? 7 : diaSemanaJs

    for (const b of bloques.filter(bl => bl.dia_semana === diaSemana)) {
      const [hI, mI] = b.hora_inicio.split(':').map(Number)
      const [hF, mF] = b.hora_fin.split(':').map(Number)
      const inicioBloque = new Date(anio, mes - 1, dia, hI, mI, 0, 0)
      const finBloque = new Date(anio, mes - 1, dia, hF, mF, 0, 0)

      // El día en que se abrió el registro: no cuentan los bloques que ya
      // habían terminado antes de esa hora.
      if (fecha === fechaInicioStr && finBloque <= inicioRegistro) continue
      // El día en que se cerró (o hoy, si sigue abierto): no cuentan los
      // bloques que todavía no habían empezado a esa hora.
      if (fecha === fechaFinStr && inicioBloque > finRegistro) continue

      contador++
    }
  }
  return contador
}

// Añade el día de hoy a la lista de días con actividad, si todavía no
// estaba. Se llama al ENTRAR en la app (si hay un registro activo) y al
// CERRAR SESIÓN, no cada vez que se guarda un cambio suelto.
export async function registrarActividad(supabase, registro) {
  const hoy = new Date().toISOString().slice(0, 10)
  const fechasActuales = registro.fechas_actividad || [registro.fecha_inicio?.slice(0, 10)]
  if (fechasActuales.includes(hoy)) return fechasActuales

  const nuevasFechas = [...fechasActuales, hoy]
  await supabase.from('registros').update({ fechas_actividad: nuevasFechas }).eq('id', registro.id)
  registro.fechas_actividad = nuevasFechas // refleja el cambio sin esperar a recargar
  return nuevasFechas
}

// Busca si el usuario logueado tiene algún registro propio sin revisar y,
// si lo tiene, marca el día de hoy como día con actividad. Pensada para
// llamarla al entrar en la app y justo antes de cerrar sesión, sin
// depender de qué pantalla esté montada en ese momento.
export async function marcarActividadSesionActual(supabase) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data } = await supabase
    .from('registro_alumnos')
    .select('registros(*)')
    .eq('alumno_id', user.id)

  const activo = (data || []).map(d => d.registros).find(r => r && r.estado !== 'revisado')
  if (activo) await registrarActividad(supabase, activo)
}
