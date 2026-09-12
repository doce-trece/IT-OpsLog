import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { cerrarRegistrosVencidos } from '../lib/bloques'
import { etiquetaEstadoEquipo, colorEstadoEquipo, formatearDuracion } from '../lib/estados'
import FormularioEquipo from '../components/FormularioEquipo.jsx'

export default function ProfesorDashboard({ perfil }) {
  const [vista, setVista] = useState('abiertas')
  const [registros, setRegistros] = useState([])
  const [equipos, setEquipos] = useState([])
  const [personas, setPersonas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [seleccionado, setSeleccionado] = useState(null)
  const [alumnoFiltro, setAlumnoFiltro] = useState(null)
  const [equipoFiltro, setEquipoFiltro] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    await cerrarRegistrosVencidos()

    const { data: reg } = await supabase
      .from('registros')
      .select('*, equipos(codigo, tipo, modelo_basico), bloques_lectivos(nombre), registro_alumnos(*, profiles(nombre)), notas_profesor(*)')
      .order('created_at', { ascending: false })
    setRegistros(reg || [])

    const { data: eq } = await supabase.from('equipos').select('*').order('codigo')
    setEquipos(eq || [])

    const { data: per } = await supabase.from('profiles').select('*').order('nombre')
    setPersonas(per || [])

    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const personasPorId = Object.fromEntries(personas.map(p => [p.id, p]))
  const alumnos = personas.filter(p => p.rol === 'alumno')

  const abiertas = registros.filter(r => r.estado === 'abierto')
  const pendientes = registros.filter(r => r.estado === 'en_revision')

  let listaVisible = registros
  if (vista === 'abiertas') listaVisible = abiertas
  if (vista === 'pendientes') listaVisible = pendientes
  if (vista === 'porAlumno' && alumnoFiltro) {
    listaVisible = registros.filter(r => r.registro_alumnos.some(ra => ra.alumno_id === alumnoFiltro))
  }
  if (vista === 'porEquipo' && equipoFiltro) {
    listaVisible = registros.filter(r => r.equipo_id === equipoFiltro)
  }

  return (
    <div className="profesor-grid">
      <aside>
        <nav className="tabs">
          <button className={vista === 'abiertas' ? 'activo' : ''} onClick={() => { setVista('abiertas'); setSeleccionado(null) }}>
            🟢 Abiertas ahora ({abiertas.length})
          </button>
          <button className={vista === 'pendientes' ? 'activo' : ''} onClick={() => { setVista('pendientes'); setSeleccionado(null) }}>
            Pendientes de revisar ({pendientes.length})
          </button>
          <button className={vista === 'historico' ? 'activo' : ''} onClick={() => { setVista('historico'); setSeleccionado(null) }}>
            Histórico completo
          </button>
          <button className={vista === 'porAlumno' ? 'activo' : ''} onClick={() => { setVista('porAlumno'); setSeleccionado(null) }}>
            Por alumno
          </button>
          <button className={vista === 'porEquipo' ? 'activo' : ''} onClick={() => { setVista('porEquipo'); setSeleccionado(null) }}>
            Por equipo
          </button>
          <button className={vista === 'equipos' ? 'activo' : ''} onClick={() => { setVista('equipos'); setSeleccionado(null) }}>
            Equipos
          </button>
        </nav>

        {vista === 'porAlumno' && (
          <select className="selector-filtro" value={alumnoFiltro || ''} onChange={e => setAlumnoFiltro(e.target.value || null)}>
            <option value="">Elige un alumno…</option>
            {alumnos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        )}
        {vista === 'porEquipo' && (
          <select className="selector-filtro" value={equipoFiltro || ''} onChange={e => setEquipoFiltro(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Elige un equipo…</option>
            {equipos.map(e => <option key={e.id} value={e.id}>{e.codigo} — {e.tipo}</option>)}
          </select>
        )}

        {vista === 'porAlumno' && alumnoFiltro && (
          <p className="muted total-tiempo">
            Tiempo total: {formatearDuracion(listaVisible.reduce((acc, r) => acc + duracionMs(r), 0))}
          </p>
        )}

        {vista !== 'equipos' && (
          <ul className="lista-registros">
            {cargando && <li className="muted">Cargando…</li>}
            {!cargando && listaVisible.length === 0 && <li className="muted">Nada que mostrar</li>}
            {listaVisible.map(r => (
              <li key={r.id}>
                <button
                  className={`item-registro estado-${r.estado} ${seleccionado?.id === r.id ? 'seleccionado' : ''}`}
                  onClick={() => setSeleccionado(r)}
                >
                  <strong>{r.equipos?.codigo} · {r.equipos?.tipo} {r.equipos?.modelo_basico}</strong>
                  <span className="fila-badges">
                    <span className="badge">{r.estado}</span>
                    {r.terminado && <span className="badge badge-terminado">✓ Terminado</span>}
                    {r.desperfecto && <span className="badge badge-desperfecto">⚠ Desperfecto</span>}
                  </span>
                  <span className="muted">
                    {r.registro_alumnos.map(ra => ra.profiles?.nombre).join(', ')}
                  </span>
                  <span className="muted">{new Date(r.created_at).toLocaleString('es-ES')} · {formatearDuracion(duracionMs(r))}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {vista === 'equipos' && <GestionEquipos equipos={equipos} personasPorId={personasPorId} onCambio={cargar} />}
      </aside>

      <section className="detalle">
        {vista !== 'equipos' && seleccionado && (
          <DetalleRegistro
            key={seleccionado.id}
            registro={seleccionado}
            perfil={perfil}
            personasPorId={personasPorId}
            onCambio={() => { setSeleccionado(null); cargar() }}
          />
        )}
        {vista !== 'equipos' && !seleccionado && <p className="muted">Selecciona un registro de la lista.</p>}
      </section>
    </div>
  )
}

function duracionMs(registro) {
  const inicio = new Date(registro.fecha_inicio).getTime()
  const fin = registro.fecha_fin ? new Date(registro.fecha_fin).getTime() : Date.now()
  return fin - inicio
}

function DetalleRegistro({ registro, perfil, personasPorId, onCambio }) {
  const [nuevaNota, setNuevaNota] = useState('')
  const [notas, setNotas] = useState(registro.notas_profesor || [])
  const [guardandoNota, setGuardandoNota] = useState(false)

  async function guardarNota() {
    if (!nuevaNota.trim()) return
    setGuardandoNota(true)
    const { data, error } = await supabase
      .from('notas_profesor')
      .insert({ registro_id: registro.id, profesor_id: perfil.id, nota: nuevaNota.trim() })
      .select()
      .single()
    setGuardandoNota(false)
    if (error) { alert(error.message); return }
    setNotas([...notas, data])
    setNuevaNota('')
  }

  async function marcarRevisado() {
    await supabase
      .from('registros')
      .update({ estado: 'revisado', revisado_por: perfil.id, revisado_en: new Date().toISOString() })
      .eq('id', registro.id)
    await supabase.from('equipos').update({ estado: 'libre' }).eq('id', registro.equipo_id)
    onCambio()
  }

  async function eliminarRegistro() {
    if (!window.confirm('¿Eliminar este registro por completo? No se puede deshacer.')) return
    await supabase.from('registros').delete().eq('id', registro.id)
    await supabase.from('equipos').update({ estado: 'libre' }).eq('id', registro.equipo_id)
    onCambio()
  }

  const ayudaDeNombre = registro.ayuda_recibida_de ? personasPorId[registro.ayuda_recibida_de]?.nombre : null

  return (
    <div>
      <h2>{registro.equipos?.codigo} · {registro.equipos?.tipo} {registro.equipos?.modelo_basico}</h2>
      <p className="muted">
        {registro.bloques_lectivos?.nombre || (registro.fuera_de_bloque ? 'Fuera de bloque lectivo' : '—')}
        {' · '}Inicio: {new Date(registro.fecha_inicio).toLocaleString('es-ES')}
        {registro.fecha_fin && <> · Fin: {new Date(registro.fecha_fin).toLocaleString('es-ES')}</>}
        {' · '}Tiempo empleado: {formatearDuracion(duracionMs(registro))}
      </p>

      {registro.cerrado_automaticamente && (
        <div className="aviso-inline">⚠ Este registro se cerró automáticamente al terminar el bloque lectivo (el alumno no lo cerró a tiempo).</div>
      )}

      <div className="resumen-cierre">
        <span>
          <strong>Estado del equipo:</strong>{' '}
          {registro.estado_equipo_final
            ? <span style={{ color: colorEstadoEquipo(registro.estado_equipo_final), fontWeight: 600 }}>{etiquetaEstadoEquipo(registro.estado_equipo_final)}</span>
            : '—'}
        </span>
        <span><strong>Desperfecto/incidencia:</strong> {registro.desperfecto ? '⚠ Sí' : 'No'}</span>
        <span><strong>Terminado:</strong> {registro.terminado ? '✓ Sí' : 'No'}</span>
        <span><strong>Ayuda recibida:</strong> {registro.ayuda_recibida ? `Sí, de ${ayudaDeNombre || '—'}` : 'No'}</span>
      </div>

      <h3>Operaciones por alumno</h3>
      {registro.registro_alumnos.map(ra => (
        <div key={ra.id} className="participacion-alumno">
          <h4>{ra.profiles?.nombre}</h4>
          <p><strong>Operaciones:</strong> {ra.descripcion_operaciones || '—'}</p>
          <p><strong>Problemas:</strong> {ra.problemas_encontrados || '—'}</p>
          <p><strong>Resultados:</strong> {ra.resultados_obtenidos || '—'}</p>
        </div>
      ))}

      <h3>Notas privadas (solo tú las ves)</h3>
      <div className="notas-lista">
        {notas.map(n => (
          <div key={n.id} className="nota">
            <p>{n.nota}</p>
            <span className="muted">{new Date(n.created_at).toLocaleString('es-ES')}</span>
          </div>
        ))}
        {notas.length === 0 && <p className="muted">Sin notas todavía.</p>}
      </div>
      <div className="nueva-nota">
        <textarea
          value={nuevaNota}
          onChange={e => setNuevaNota(e.target.value)}
          placeholder="Añadir nota al revisar el puesto de trabajo…"
          rows={2}
        />
        <button onClick={guardarNota} disabled={guardandoNota}>Añadir nota</button>
      </div>

      <div className="botones acciones-profesor">
        {registro.estado !== 'revisado' && (
          <button className="finalizar" onClick={marcarRevisado}>
            Marcar como revisado (libera el equipo)
          </button>
        )}
        <button className="peligro" onClick={eliminarRegistro}>Eliminar registro</button>
      </div>
      {registro.estado === 'revisado' && (
        <p className="ok-msg">✓ Revisado el {new Date(registro.revisado_en).toLocaleString('es-ES')}</p>
      )}
    </div>
  )
}

function GestionEquipos({ equipos, personasPorId, onCambio }) {
  const [editando, setEditando] = useState(null) // id del equipo en edición, o 'nuevo'
  const [historialDe, setHistorialDe] = useState(null)
  const [historial, setHistorial] = useState([])

  async function verHistorial(equipoId) {
    if (historialDe === equipoId) { setHistorialDe(null); return }
    const { data } = await supabase
      .from('equipos_historial')
      .select('*')
      .eq('equipo_id', equipoId)
      .order('modificado_en', { ascending: false })
    setHistorial(data || [])
    setHistorialDe(equipoId)
  }

  return (
    <div className="gestion-equipos">
      {editando ? (
        <FormularioEquipo
          equipo={editando === 'nuevo' ? null : equipos.find(e => e.id === editando)}
          onGuardado={() => { setEditando(null); onCambio() }}
          onCancelar={() => setEditando(null)}
        />
      ) : (
        <button onClick={() => setEditando('nuevo')}>+ Añadir equipo</button>
      )}

      <h3>Equipos ({equipos.length})</h3>
      <p className="muted">Tanto alumnos como profesor pueden crear y editar equipos. Cada cambio queda registrado en el historial, con quién lo hizo y cuándo.</p>
      <ul className="lista-equipos-simple">
        {equipos.map(e => (
          <li key={e.id} className="fila-equipo">
            <div className="fila-equipo-cabecera">
              <div>
                <strong>{e.codigo}</strong> — {e.tipo} {e.modelo_basico}
                {e.notas_inventario && <div className="muted">⚠ {e.notas_inventario}</div>}
                {e.ultima_modificacion_en && (
                  <div className="muted">
                    Última modificación: {personasPorId[e.ultima_modificacion_por]?.nombre || '—'} · {new Date(e.ultima_modificacion_en).toLocaleString('es-ES')}
                  </div>
                )}
              </div>
              <div className="fila-equipo-acciones">
                <span className={`badge estado-${e.estado}`}>{e.estado}</span>
                <button className="secundario" onClick={() => setEditando(e.id)}>Editar</button>
                <button className="secundario" onClick={() => verHistorial(e.id)}>Historial</button>
              </div>
            </div>
            {historialDe === e.id && (
              <div className="historial-equipo">
                {historial.length === 0 && <p className="muted">Sin cambios registrados todavía.</p>}
                {historial.map(h => (
                  <div key={h.id} className="historial-item">
                    <span className="muted">
                      {personasPorId[h.modificado_por]?.nombre || 'Alguien'} · {new Date(h.modificado_en).toLocaleString('es-ES')}
                    </span>
                    <span className="muted">Valores anteriores: {h.datos_anteriores.tipo} {h.datos_anteriores.modelo_basico}, notas: "{h.datos_anteriores.notas_inventario || '—'}"</span>
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
