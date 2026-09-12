import { supabase } from '../supabaseClient'

// Devuelve el bloque lectivo en el que estamos AHORA MISMO, o null si
// no hay clase (recreo, fuera de horario...). "fuera_de_bloque" no se decide
// aquí: si no hay bloque activo pero el profesor permite operar dentro del
// horario general, se marca manualmente en el registro.
export async function obtenerBloqueActual() {
  const ahora = new Date()
  const diaSemana = ahora.getDay() === 0 ? 7 : ahora.getDay() // 1=lunes...7=domingo
  const horaActual = ahora.toTimeString().slice(0, 8) // HH:MM:SS

  const { data, error } = await supabase
    .from('bloques_lectivos')
    .select('*')
    .eq('dia_semana', diaSemana)
    .lte('hora_inicio', horaActual)
    .gte('hora_fin', horaActual)
    .maybeSingle()

  if (error) {
    console.error('Error obteniendo bloque actual', error)
    return null
  }
  return data
}

// Se llama al cargar cualquier panel: busca registros "abierto" cuyo bloque
// lectivo ya haya terminado hoy y los cierra automáticamente, dejándolos
// "en_revision" para que el profesor los valide. Además, crea automáticamente
// un registro de continuación sobre el mismo equipo (que sigue bloqueado
// para el resto de la clase hasta que se revise), copiando lo que cada
// alumno había escrito, para poder retomarlo en el siguiente bloque/sesión.
export async function cerrarRegistrosVencidos() {
  const ahora = new Date()
  const diaSemana = ahora.getDay() === 0 ? 7 : ahora.getDay()
  const horaActual = ahora.toTimeString().slice(0, 8)

  const { data: registrosAbiertos, error } = await supabase
    .from('registros')
    .select('*, bloques_lectivos(dia_semana, hora_fin), registro_alumnos(*)')
    .eq('estado', 'abierto')

  if (error || !registrosAbiertos) return

  for (const r of registrosAbiertos) {
    const bloque = r.bloques_lectivos
    if (!bloque) continue // operación fuera de bloque: no se autocierra
    if (bloque.dia_semana !== diaSemana || bloque.hora_fin >= horaActual) continue

    await supabase
      .from('registros')
      .update({
        estado: 'en_revision',
        fecha_fin: ahora.toISOString(),
        terminado: false,
        cerrado_automaticamente: true,
      })
      .eq('id', r.id)

    // Crear el registro de continuación para el siguiente bloque/sesión
    const { data: nuevoRegistro } = await supabase
      .from('registros')
      .insert({
        equipo_id: r.equipo_id,
        titulo: r.titulo,
        creado_por: r.creado_por,
        registro_anterior_id: r.id,
      })
      .select()
      .single()

    if (nuevoRegistro) {
      for (const participante of r.registro_alumnos) {
        await supabase.from('registro_alumnos').insert({
          registro_id: nuevoRegistro.id,
          alumno_id: participante.alumno_id,
          descripcion_operaciones: participante.descripcion_operaciones,
          problemas_encontrados: participante.problemas_encontrados,
          resultados_obtenidos: participante.resultados_obtenidos,
        })
      }
      // El equipo sigue "ocupado" (bloqueado para otros) porque el trabajo
      // continúa en el nuevo registro, en vez de pasar a "en_revision".
      await supabase.from('equipos').update({ estado: 'ocupado' }).eq('id', r.equipo_id)
    } else {
      await supabase.from('equipos').update({ estado: 'en_revision' }).eq('id', r.equipo_id)
    }
  }
}
