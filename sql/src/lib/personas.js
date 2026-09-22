// Muestra siempre el nombre de usuario (más claro para identificar a
// quién pertenece un registro) en vez del email/nombre por defecto.
export function nombreMostrable(persona) {
  if (!persona) return '—'
  return persona.username || persona.nombre || '—'
}
