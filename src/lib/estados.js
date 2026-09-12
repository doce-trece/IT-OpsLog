// Orden y colores de "más dañado / rojo" a "mejor / verde", tal como se
// deben mostrar siempre en los desplegables y en los paneles.
export const ESTADOS_EQUIPO_FINAL = [
  { value: 'desmontado_no_funcional', label: 'Completamente o casi completamente desmontado y NO FUNCIONAL', color: '#dc2626' },
  { value: 'desmontado_funcional', label: 'Completamente o casi completamente desmontado y funcional', color: '#ea580c' },
  { value: 'piezas_fuera_no_funcional', label: 'Con piezas fuera (NO FUNCIONAL)', color: '#f59e0b' },
  { value: 'parcial_no_funcional', label: 'Parcialmente desmontado y NO FUNCIONAL', color: '#eab308' },
  { value: 'parcial_funcional', label: 'Parcialmente desmontado y funcional', color: '#a3e635' },
  { value: 'montado_no_funcional', label: 'Montado y NO FUNCIONAL', color: '#4ade80' },
  { value: 'montado_funcional', label: 'Montado y funcional', color: '#16a34a' },
]

export function colorEstadoEquipo(value) {
  return ESTADOS_EQUIPO_FINAL.find(e => e.value === value)?.color || '#9ca3af'
}

export function etiquetaEstadoEquipo(value) {
  return ESTADOS_EQUIPO_FINAL.find(e => e.value === value)?.label || '—'
}

// Formatea una duración en milisegundos como "1h 20min" / "35min"
export function formatearDuracion(ms) {
  if (ms == null || ms < 0) return '—'
  const minutosTotales = Math.round(ms / 60000)
  const horas = Math.floor(minutosTotales / 60)
  const minutos = minutosTotales % 60
  if (horas === 0) return `${minutos} min`
  return `${horas}h ${minutos}min`
}
