import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { ESTADOS_EQUIPO_FINAL, etiquetaEstadoEquipo, colorEstadoEquipo, formatearDuracion } from '../lib/estados'
import { calcularSesionesYDias, tiempoConectadoMs, useRelojEnVivo } from '../lib/sesiones'
import { nombreMostrable } from '../lib/personas'
import FormularioEquipo from '../components/FormularioEquipo.jsx'
import GaleriaFotos from '../components/GaleriaFotos.jsx'

export default function ProfesorDashboard({ perfil }) {
  const [vista, setVista] = useState('abiertas')
  const [registros, setRegistros] = useState([])
  const [equipos, setEquipos] = useState([])
  const [personas, setPersonas] = useState([])
  const [clases, setClases] = useState([])
  const [cargando, setCargando] = useState(true)
  const [seleccionado, setSeleccionado] = useState(null)
  const [alumnoFiltro, setAlumnoFiltro] = useState(null)
  const [equipoFiltro, setEquipoFiltro] = useState(null)
  const [equipoEditando, setEquipoEditando] = useState(null) // id o 'nuevo', para el panel de Equipos

  const irAEquipos = () => { setVista('equipos'); setSeleccionado(null); setEquipoEditando(null) }
  const irAPorAlumno = () => { setVista('porAlumno'); setSeleccionado(null) }
  const irAClases = () => { setVista('clases'); setSeleccionado(null) }

  const cargar = useCallback(async () => {
    setCargando(true)

    const { data: reg } = await supabase
      .from('registros')
      .select('*, equipos(codigo, tipo, modelo_basico, clase_id), registro_alumnos(*, profiles(nombre, username)), notas_profesor(*)')
      .order('created_at', { ascending: false })
    setRegistros(reg || [])

    const { data: eq } = await supabase.from('equipos').select('*').order('codigo')
    setEquipos(eq || [])

    const { data: per } = await supabase.from('profiles').select('*').order('nombre')
    setPersonas(per || [])

    const { data: cl } = await supabase.from('clases').select('*').order('nombre')
    setClases(cl || [])

    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const personasPorId = Object.fromEntries(personas.map(p => [p.id, p]))
  const clasesPorId = Object.fromEntries(clases.map(c => [c.id, c]))
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
          <button className="icono-acceso" title="Ir a clases" onClick={irAClases}>🏫 Clases</button>
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
          <button className={vista === 'clases' ? 'activo' : ''} onClick={irAClases}>
            Clases
          </button>
        </nav>

        {vista === 'porAlumno' && (
          <select className="selector-filtro" value={alumnoFiltro || ''} onChange={e => { setAlumnoFiltro(e.target.value || null); setSeleccionado(null) }}>
            <option value="">Elige un alumno…</option>
            {alumnos.map(a => <option key={a.id} value={a.id}>{nombreMostrable(a)}</option>)}
          </select>
        )}
        {vista === 'porEquipo' && (
          <select className="selector-filtro" value={equipoFiltro || ''} onChange={e => setEquipoFiltro(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Elige un equipo…</option>
            {equipos.map(e => <option key={e.id} value={e.id}>{e.codigo} — {e.tipo} ({clasesPorId[e.clase_id]?.nombre})</option>)}
          </select>
        )}

        {vista === 'porAlumno' && alumnoFiltro && (
          <p className="muted total-tiempo">
            Tiempo total: {formatearDuracion(listaVisible.reduce((acc, r) => acc + duracionMs(r), 0))}
          </p>
        )}

        {vista !== 'equipos' && vista !== 'porAlumno' && vista !== 'clases' && (
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
                    {r.registro_alumnos.map(ra => nombreMostrable(ra.profiles)).join(', ')}
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
            clases={clases}
            personasPorId={personasPorId}
            onCambio={cargar}
            editando={equipoEditando}
            setEditando={setEquipoEditando}
          />
        )}

        {vista === 'clases' && (
          <GestionClases
            clases={clases}
            alumnos={alumnos}
            onCambio={cargar}
          />
        )}

        {vista === 'porAlumno' && !alumnoFiltro && <p className="muted">Elige un alumno en la lista de la izquierda.</p>}

        {vista === 'porAlumno' && alumnoFiltro && !seleccionado && (
          <div className="lista-central">
            <h2>{nombreMostrable(personasPorId[alumnoFiltro])}</h2>
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
            <button className="link-btn" onClick={() => setSeleccionado(null)}>← Volver a los registros de {nombreMostrable(personasPorId[alumnoFiltro])}</button>
            <DetalleRegistro
              key={seleccionado.id}
              registro={seleccionado}
              perfil={perfil}
              personasPorId={personasPorId}
              onCambio={() => { setSeleccionado(null); cargar() }}
            />
          </div>
        )}

        {vista !== 'equipos' && vista !== 'porAlumno' && vista !== 'clases' && seleccionado && (
          <DetalleRegistro
            key={seleccionado.id}
            registro={seleccionado}
            perfil={perfil}
            personasPorId={personasPorId}
            onCambio={() => { setSeleccionado(null); cargar() }}
          />
        )}
        {vista !== 'equipos' && vista !== 'porAlumno' && vista !== 'clases' && !seleccionado && <p className="muted">Selecciona un registro de la lista.</p>}
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
  const [desperfecto, setDesperfecto] = useState(registro.desperfecto || false)
  const [terminado, setTerminado] = useState(registro.terminado || false)
  const [ayuda, setAyuda] = useState(registro.ayuda_recibida || false)
  const [ayudaDe, setAyudaDe] = useState(registro.ayuda_recibida_de || [])

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

  async function reabrirRevision() {
    if (!window.confirm(
      '⚠ Vas a reabrir este registro después de haberlo revisado.\n\n' +
      'Volverá a "en revisión", el alumno podrá seguir editándolo y el equipo ' +
      'quedará bloqueado para otros hasta que lo vuelvas a marcar como revisado.\n\n' +
      '¿Seguro que quieres continuar?'
    )) return

    await supabase
      .from('registros')
      .update({ estado: 'en_revision', revisado_por: null, revisado_en: null })
      .eq('id', registro.id)
    await supabase.from('equipos').update({ estado: 'en_revision' }).eq('id', registro.equipo_id)
    onCambio()
  }

  async function guardarEstadoEquipo() {
    await supabase.from('registros').update({ estado_equipo_final: estadoNuevo }).eq('id', registro.id)
    await supabase.from('equipos').update({ ultimo_estado_funcional: estadoNuevo }).eq('id', registro.equipo_id)
    setEditandoEstado(false)
    onCambio()
  }

  async function toggleDesperfecto(checked) {
    setDesperfecto(checked)
    await supabase.from('registros').update({ desperfecto: checked }).eq('id', registro.id)
  }

  async function toggleTerminado(checked) {
    setTerminado(checked)
    await supabase.from('registros').update({ terminado: checked }).eq('id', registro.id)
  }

  async function cambiarAyuda(checked) {
    setAyuda(checked)
    const nuevaLista = checked ? ayudaDe : []
    if (!checked) setAyudaDe([])
    await supabase.from('registros').update({ ayuda_recibida: checked, ayuda_recibida_de: nuevaLista }).eq('id', registro.id)
  }

  async function toggleAyudante(id, checked) {
    const nuevaLista = checked ? [...ayudaDe, id] : ayudaDe.filter(x => x !== id)
    setAyudaDe(nuevaLista)
    await supabase.from('registros').update({ ayuda_recibida_de: nuevaLista }).eq('id', registro.id)
  }

  async function eliminarRegistro() {
    if (!window.confirm('¿Eliminar este registro por completo? No se puede deshacer.')) return
    await supabase.from('registros').delete().eq('id', registro.id)
    await supabase.from('equipos').update({ estado: 'libre' }).eq('id', registro.equipo_id)
    onCambio()
  }

  const personasAyuda = Object.values(personasPorId)
  const ayudaDeNombres = ayudaDe.map(id => nombreMostrable(personasPorId[id])).join(', ')
  const { diasCalendario, diasTrabajados, sesiones } = calcularSesionesYDias(registro)
  useRelojEnVivo(Boolean(registro.conexion_iniciada_en))
  const tiempoConectado = tiempoConectadoMs(registro)

  return (
    <div>
      <h2>{registro.titulo || `${registro.equipos?.codigo} · ${registro.equipos?.tipo} ${registro.equipos?.modelo_basico}`}</h2>
      {registro.titulo && (
        <p className="muted">{registro.equipos?.codigo} · {registro.equipos?.tipo} {registro.equipos?.modelo_basico}</p>
      )}
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
        <span>
          <strong>Desperfecto/incidencia:</strong>{' '}
          <label className="checkbox-inline">
            <input type="checkbox" checked={desperfecto} onChange={e => toggleDesperfecto(e.target.checked)} />
            {desperfecto ? 'Sí' : 'No'}
          </label>
        </span>
        <span>
          <strong>Terminado:</strong>{' '}
          <label className="checkbox-inline">
            <input type="checkbox" checked={terminado} onChange={e => toggleTerminado(e.target.checked)} />
            {terminado ? 'Sí' : 'No'}
          </label>
        </span>
        <span>
          <strong>Ayuda recibida:</strong>{' '}
          <label className="checkbox-inline">
            <input type="checkbox" checked={ayuda} onChange={e => cambiarAyuda(e.target.checked)} />
            {ayuda ? `Sí, de ${ayudaDeNombres || '—'}` : 'No'}
          </label>
        </span>
      </div>

      {ayuda && (
        <div className="lista-ayudantes">
          {personasAyuda.filter(p => p.id !== registro.creado_por).map(p => (
            <label key={p.id} className="checkbox">
              <input
                type="checkbox"
                checked={ayudaDe.includes(p.id)}
                onChange={e => toggleAyudante(p.id, e.target.checked)}
              />
              {nombreMostrable(p)}{p.rol === 'profesor' ? ' (profesor/a)' : ''}
            </label>
          ))}
        </div>
      )}

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
          <h4>{nombreMostrable(ra.profiles)}</h4>
          <GaleriaFotos urls={ra.fotos_urls} tamano="grande" />
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
        {registro.estado === 'revisado' && (
          <button className="secundario" onClick={reabrirRevision}>
            Reabrir (deshacer revisión)
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

function GestionClases({ clases, alumnos, onCambio }) {
  const [nombreNueva, setNombreNueva] = useState('')
  const [permiteOperaciones, setPermiteOperaciones] = useState(true)
  const [guardando, setGuardando] = useState(false)

  async function anadirClase(e) {
    e.preventDefault()
    if (!nombreNueva.trim()) return
    setGuardando(true)
    const { error } = await supabase.from('clases').insert({ nombre: nombreNueva.trim(), permite_operaciones: permiteOperaciones })
    setGuardando(false)
    if (error) { alert(error.message); return }
    setNombreNueva('')
    setPermiteOperaciones(true)
    onCambio()
  }

  async function toggleOperaciones(clase) {
    await supabase.from('clases').update({ permite_operaciones: !clase.permite_operaciones }).eq('id', clase.id)
    onCambio()
  }

  async function asignarClase(alumnoId, claseId) {
    await supabase.from('profiles').update({ clase_id: claseId || null }).eq('id', alumnoId)
    onCambio()
  }

  return (
    <div className="gestion-clases">
      <h2>Clases</h2>
      <form onSubmit={anadirClase} className="form-equipo">
        <input placeholder="Nombre de la clase (ej. SMR2)" value={nombreNueva} onChange={e => setNombreNueva(e.target.value)} />
        <label className="checkbox">
          <input type="checkbox" checked={permiteOperaciones} onChange={e => setPermiteOperaciones(e.target.checked)} />
          Tiene registro de operaciones activado (si no, solo gestionará inventario)
        </label>
        <button type="submit" disabled={guardando}>Añadir clase</button>
      </form>

      <ul className="lista-equipos-simple">
        {clases.map(c => (
          <li key={c.id}>
            <div>
              <strong>{c.nombre}</strong>
              {' '}
              <span className="muted">{c.permite_operaciones ? 'Con registro de operaciones' : 'Solo inventario'}</span>
            </div>
            <button className="secundario" onClick={() => toggleOperaciones(c)}>
              {c.permite_operaciones ? 'Desactivar operaciones' : 'Activar operaciones'}
            </button>
          </li>
        ))}
        {clases.length === 0 && <p className="muted">Todavía no has creado ninguna clase.</p>}
      </ul>

      <h3>Asignar alumnos a una clase</h3>
      <ul className="lista-equipos-simple">
        {alumnos.map(a => (
          <li key={a.id}>
            <span>{nombreMostrable(a)}</span>
            <select value={a.clase_id || ''} onChange={e => asignarClase(a.id, e.target.value ? Number(e.target.value) : null)}>
              <option value="">Sin clase asignada</option>
              {clases.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </li>
        ))}
        {alumnos.length === 0 && <p className="muted">Todavía no hay alumnos dados de alta.</p>}
      </ul>
    </div>
  )
}

function GestionEquipos({ equipos, clases, personasPorId, onCambio, editando, setEditando }) {
  const [historialDe, setHistorialDe] = useState(null)
  const [historial, setHistorial] = useState([])
  const clasesPorId = Object.fromEntries(clases.map(c => [c.id, c]))

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

  async function eliminarEquipo(equipo) {
    if (!window.confirm(`¿Eliminar por completo el equipo ${equipo.codigo}? Esto también borrará su historial y no se puede deshacer.`)) return
    const { error } = await supabase.from('equipos').delete().eq('id', equipo.id)
    if (error) {
      if (error.message.includes('foreign key') || error.code === '23503') {
        alert(`No se puede eliminar ${equipo.codigo}: todavía tiene registros de operaciones asociados. Elimínalos primero (o márcalos como revisados) si de verdad quieres borrar el equipo.`)
      } else {
        alert('No se pudo eliminar: ' + error.message)
      }
      return
    }
    onCambio()
  }

  return (
    <div className="gestion-equipos">
      {editando ? (
        <FormularioEquipo
          equipo={editando === 'nuevo' ? null : equipos.find(e => e.id === editando)}
          clases={clases}
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
              <GaleriaFotos urls={e.fotos_urls} />
              <div>
                <strong>{e.codigo}</strong> — {e.tipo} {e.modelo_basico}
                {' '}<span className="badge">{clasesPorId[e.clase_id]?.nombre || '—'}</span>
                {e.notas_inventario && <div className="muted">⚠ {e.notas_inventario}</div>}
                {e.ultima_modificacion_en && (
                  <div className="muted">
                    Última modificación: {nombreMostrable(personasPorId[e.ultima_modificacion_por])} · {new Date(e.ultima_modificacion_en).toLocaleString('es-ES')}
                  </div>
                )}
              </div>
              <div className="fila-equipo-acciones">
                <span className={`badge estado-${e.estado}`}>{e.estado}</span>
                <button className="secundario" onClick={() => setEditando(e.id)}>Editar</button>
                <button className="secundario" onClick={() => verHistorial(e.id)}>Historial</button>
                <button className="peligro" onClick={() => eliminarEquipo(e)}>Eliminar</button>
              </div>
            </div>
            {historialDe === e.id && (
              <div className="historial-equipo">
                {historial.length === 0 && <p className="muted">Sin cambios registrados todavía.</p>}
                {historial.map(h => (
                  <div key={h.id} className="historial-item">
                    <span className="muted">
                      {nombreMostrable(personasPorId[h.modificado_por])} · {new Date(h.modificado_en).toLocaleString('es-ES')}
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
