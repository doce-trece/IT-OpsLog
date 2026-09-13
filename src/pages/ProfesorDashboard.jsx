import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { ESTADOS_EQUIPO_FINAL, etiquetaEstadoEquipo, colorEstadoEquipo, formatearDuracion } from '../lib/estados'
import { calcularSesionesYDias, tiempoConectadoMs } from '../lib/sesiones'
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
  const [equipoEditando, setEquipoEditando] = useState(null) // id o 'nuevo', para el panel de Equipos

  const irAEquipos = () => { setVista('equipos'); setSeleccionado(null); setEquipoEditando(null) }
  const irAPorAlumno = () => { setVista('porAlumno'); setSeleccionado(null) }

  const cargar = useCallback(async () => {
    setCargando(true)

    const { data: reg } = await supabase
      .from('registros')
      .select('*, equipos(codigo, tipo, modelo_basico), registro_alumnos(*, profiles(nombre)), notas_profesor(*)')
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
        <div className="accesos-rapidos">
          <button className="icono-acceso" title="Ir a gestión de equipos" onClick={irAEquipos}>🖥️ Equipos</button>
          <button className="icono-acceso" title="Ir a por alumno" onClick={irAPorAlumno}>👤 Por alumno</button>
        </div>
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
          <button className={vista === 'porAlumno' ? 'activo' : ''} onClick={irAPorAlumno}>
            Por alumno
          </button>
          <button className={vista === 'porEquipo' ? 'activo' : ''} onClick={() => { setVista('porEquipo'); setSeleccionado(null) }}>
            Por equipo
          </button>
          <button className={vista === 'equipos' ? 'activo' : ''} onClick={irAEquipos}>
            Equipos
          </button>
        </nav>

        {vista === 'porAlumno' && (
          <select className="selector-filtro" value={alumnoFiltro || ''} onChange={e => { setAlumnoFiltro(e.target.value || null); setSeleccionado(null) }}>
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

        {vista !== 'equipos' && vista !== 'porAlumno' && (
          <ul className="lista-registros">
            {cargando && <li className="muted">Cargando…</li>}
            {!cargando && listaVisible.length === 0 && <li className="muted">Nada que mostrar</li>}
            {listaVisible.map(r => (
              <li key={r.id}>
                <button
                  className={`item-registro estado-${r.estado} ${seleccionado?.id === r.id ? 'seleccionado' : ''}`}
                  onClick={() => setSeleccionado(r)}
                >
                  <strong>{r.titulo || `${r.equipos?.codigo} · ${r.equipos?.tipo} ${r.equipos?.modelo_basico}`}</strong>
                  <span className="fila-badges">
                    <span className="badge">{r.estado}</span>
                    {r.terminado && <span className="badge badge-terminado">✓ Terminado</span>}
                    {r.desperfecto && <span className="badge badge-desperfecto">⚠ Desperfecto</span>}
                  </span>
                  <span className="muted">
                    {r.registro_alumnos.map(ra => ra.profiles?.nombre).join(', ')}
                  </span>
                  <span className="muted">
                    Inicio: {new Date(r.fecha_inicio).toLocaleDateString('es-ES')}
                    {' · '}{calcularSesionesYDias(r).diasCalendario}d
                    {' · '}{calcularSesionesYDias(r).sesiones} ses.
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="detalle">
        {vista === 'equipos' && (
          <GestionEquipos
            equipos={equipos}
            personasPorId={personasPorId}
            onCambio={cargar}
            editando={equipoEditando}
            setEditando={setEquipoEditando}
          />
        )}

        {vista === 'porAlumno' && !alumnoFiltro && <p className="muted">Elige un alumno en la lista de la izquierda.</p>}

        {vista === 'porAlumno' && alumnoFiltro && !seleccionado && (
          <div className="lista-central">
            <h2>{personasPorId[alumnoFiltro]?.nombre}</h2>
            {listaVisible.length === 0 && <p className="muted">Este alumno todavía no tiene registros.</p>}
            {listaVisible.map(r => (
              <button key={r.id} className={`item-registro-central estado-${r.estado}`} onClick={() => setSeleccionado(r)}>
                <strong>{r.titulo || `${r.equipos?.codigo} · ${r.equipos?.tipo} ${r.equipos?.modelo_basico}`}</strong>
                <span className="fila-badges">
                  <span className="badge">{r.estado}</span>
                  {r.terminado && <span className="badge badge-terminado">✓ Terminado</span>}
                  {r.desperfecto && <span className="badge badge-desperfecto">⚠ Desperfecto</span>}
                </span>
                <span className="muted">
                  Inicio: {new Date(r.fecha_inicio).toLocaleDateString('es-ES')}
                  {' · '}{calcularSesionesYDias(r).diasCalendario}d
                  {' · '}{calcularSesionesYDias(r).sesiones} ses.
                </span>
              </button>
            ))}
          </div>
        )}

        {vista === 'porAlumno' && seleccionado && (
          <div>
            <button className="link-btn" onClick={() => setSeleccionado(null)}>← Volver a los registros de {personasPorId[alumnoFiltro]?.nombre}</button>
            <DetalleRegistro
              key={seleccionado.id}
              registro={seleccionado}
              perfil={perfil}
              personasPorId={personasPorId}
              onCambio={() => { setSeleccionado(null); cargar() }}
            />
          </div>
        )}

        {vista !== 'equipos' && vista !== 'porAlumno' && seleccionado && (
          <DetalleRegistro
            key={seleccionado.id}
            registro={seleccionado}
            perfil={perfil}
            personasPorId={personasPorId}
            onCambio={() => { setSeleccionado(null); cargar() }}
          />
        )}
        {vista !== 'equipos' && vista !== 'porAlumno' && !seleccionado && <p className="muted">Selecciona un registro de la lista.</p>}
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
  const [editandoEstado, setEditandoEstado] = useState(false)
  const [estadoNuevo, setEstadoNuevo] = useState(registro.estado_equipo_final || '')

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
      .update({ estado: 'revisado', terminado: true, revisado_por: perfil.id, revisado_en: new Date().toISOString() })
      .eq('id', registro.id)
    await supabase.from('equipos').update({ estado: 'libre' }).eq('id', registro.equipo_id)
    onCambio()
  }

  async function guardarEstadoEquipo() {
    await supabase.from('registros').update({ estado_equipo_final: estadoNuevo }).eq('id', registro.id)
    await supabase.from('equipos').update({ ultimo_estado_funcional: estadoNuevo }).eq('id', registro.equipo_id)
    setEditandoEstado(false)
    onCambio()
  }

  async function eliminarRegistro() {
    if (!window.confirm('¿Eliminar este registro por completo? No se puede deshacer.')) return
    await supabase.from('registros').delete().eq('id', registro.id)
    await supabase.from('equipos').update({ estado: 'libre' }).eq('id', registro.equipo_id)
    onCambio()
  }

  const ayudaDeNombres = (registro.ayuda_recibida_de || []).map(id => personasPorId[id]?.nombre).filter(Boolean).join(', ')
  const { diasCalendario, diasTrabajados, sesiones } = calcularSesionesYDias(registro)
  const tiempoConectado = tiempoConectadoMs(registro)

  return (
    <div>
      <h2>{registro.equipos?.codigo} · {registro.equipos?.tipo} {registro.equipos?.modelo_basico}</h2>
      <p className="muted">
        Inicio: {new Date(registro.fecha_inicio).toLocaleString('es-ES')}
        {registro.enviado_revision_en && <> · Enviado a revisión: {new Date(registro.enviado_revision_en).toLocaleString('es-ES')}</>}
        {registro.revisado_en && <> · Revisado: {new Date(registro.revisado_en).toLocaleString('es-ES')}</>}
        {' · '}Lleva abierto {diasCalendario} {diasCalendario === 1 ? 'día' : 'días'} ({diasTrabajados} con actividad)
        {' · '}{sesiones} {sesiones === 1 ? 'sesión de aula' : 'sesiones de aula'}
        {' · '}Tiempo conectado: {formatearDuracion(tiempoConectado)}{registro.conexion_iniciada_en ? ' (conectado ahora mismo)' : ''}
      </p>

      <div className="resumen-cierre">
        <span>
          <strong>Estado del equipo:</strong>{' '}
          {registro.estado_equipo_final
            ? <span style={{ color: colorEstadoEquipo(registro.estado_equipo_final), fontWeight: 600 }}>{etiquetaEstadoEquipo(registro.estado_equipo_final)}</span>
            : '—'}
          {' '}
          <button className="link-btn" onClick={() => setEditandoEstado(v => !v)}>{editandoEstado ? 'cancelar' : 'cambiar'}</button>
        </span>
        <span><strong>Desperfecto/incidencia:</strong> {registro.desperfecto ? '⚠ Sí' : 'No'}</span>
        <span><strong>Terminado:</strong> {registro.terminado ? '✓ Sí' : 'No'}</span>
        <span><strong>Ayuda recibida:</strong> {registro.ayuda_recibida ? `Sí, de ${ayudaDeNombres || '—'}` : 'No'}</span>
      </div>

      {editandoEstado && (
        <div className="cierre-box">
          <select value={estadoNuevo} onChange={e => setEstadoNuevo(e.target.value)}>
            <option value="">Selecciona…</option>
            {ESTADOS_EQUIPO_FINAL.map(o => (
              <option key={o.value} value={o.value} style={{ color: o.color }}>{o.label}</option>
            ))}
          </select>
          <button onClick={guardarEstadoEquipo}>Guardar estado del equipo</button>
        </div>
      )}

      <h3>Operaciones por alumno</h3>
      {registro.registro_alumnos.map(ra => (
        <div key={ra.id} className="participacion-alumno">
          <h4>{ra.profiles?.nombre}</h4>
          {ra.foto_url && <img src={ra.foto_url} alt="" className="foto-miniatura-grande" />}
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

function GestionEquipos({ equipos, personasPorId, onCambio, editando, setEditando }) {
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
              {e.foto_url && <img src={e.foto_url} alt="" className="foto-miniatura" />}
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
