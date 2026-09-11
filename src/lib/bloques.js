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
// "en_revision" para que el profesor los valide.
export async function cerrarRegistrosVencidos() {
  const ahora = new Date()
  const diaSemana = ahora.getDay() === 0 ? 7 : ahora.getDay()
  const horaActual = ahora.toTimeString().slice(0, 8)

  const { data: registrosAbiertos, error } = await supabase
    .from('registros')
    .select('id, bloque_lectivo_id, equipo_id, bloques_lectivos(dia_semana, hora_fin)')
    .eq('estado', 'abierto')

  if (error || !registrosAbiertos) return

  for (const r of registrosAbiertos) {
    const bloque = r.bloques_lectivos
    if (!bloque) continue // operación fuera de bloque: no se autocierra
    if (bloque.dia_semana === diaSemana && bloque.hora_fin < horaActual) {
      await supabase
        .from('registros')
        .update({
          estado: 'en_revision',
          fecha_fin: ahora.toISOString(),
          terminado: false,
          cerrado_automaticamente: true,
        })
        .eq('id', r.id)

      await supabase
        .from('equipos')
        .update({ estado: 'en_revision' })
        .eq('id', r.equipo_id)
    }
  }
}
