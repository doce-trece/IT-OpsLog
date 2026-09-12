import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { obtenerBloqueActual, cerrarRegistrosVencidos } from '../lib/bloques'
import { ESTADOS_EQUIPO_FINAL, colorEstadoEquipo, etiquetaEstadoEquipo, formatearDuracion } from '../lib/estados'
import { subirFoto } from '../lib/fotos'
import FormularioEquipo from '../components/FormularioEquipo.jsx'

export default function AlumnoDashboard({ perfil }) {
  const [cargando, setCargando] = useState(true)
  const [equipos, setEquipos] = useState([])
  const [personas, setPersonas] = useState([])
  const [bloqueActual, setBloqueActual] = useState(null)
  const [registroActivo, setRegistroActivo] = useState(null) // {registro, participacion}
  const [registroPendiente, setRegistroPendiente] = useState(null)
  const [equipoParaUnirse, setEquipoParaUnirse] = useState(null)
  const [editandoEquipo, setEditandoEquipo] = useState(null) // id de equipo o 'nuevo'
  const [vista, setVista] = useState('principal') // principal | historial

  const cargarTodo = useCallback(async () => {
    setCargando(true)
    await cerrarRegistrosVencidos()
    const bloque = await obtenerBloqueActual()
    setBloqueActual(bloque)

    const { data: eq } = await supabase.from('equipos').select('*').order('codigo')
    setEquipos(eq || [])

    const { data: todasLasPersonas } = await supabase.from('profiles').select('id, nombre, rol').order('nombre')
    setPersonas(todasLasPersonas || [])

    const { data: misParticipaciones } = await supabase
      .from('registro_alumnos')
      .select('*, registros(*)')
      .eq('alumno_id', perfil.id)

    const pendiente = (misParticipaciones || []).find(p => p.registros?.estado === 'en_revision')
    setRegistroPendiente(pendiente || null)

    const abierto = (misParticipaciones || []).find(p => p.registros?.estado === 'abierto')
    setRegistroActivo(abierto ? { registro: abierto.registros, participacion: abierto } : null)

    setCargando(false)
  }, [perfil.id])

  useEffect(() => { cargarTodo() }, [cargarTodo])

  async function elegirEquipo(equipo) {
    const { data: registroExistente } = await supabase
      .from('registros')
      .select('*')
      .eq('equipo_id', equipo.id)
      .eq('estado', 'abierto')
      .maybeSingle()

    if (registroExistente) {
      setEquipoParaUnirse({ equipo, registro: registroExistente })
      return
    }

    const bloque = bloqueActual
    const { data: nuevoRegistro, error } = await supabase
      .from('registros')
      .insert({
        equipo_id: equipo.id,
        bloque_lectivo_id: bloque?.id ?? null,
        fuera_de_bloque: !bloque,
        creado_por: perfil.id,
      })
      .select()
      .single()

    if (error) { alert('Error creando el registro: ' + error.message); return }

    // Continuidad del diario: si ya trabajaste antes en este mismo equipo y
    // aquello NO quedó terminado y revisado, arrastramos lo que escribiste.
    const { data: registrosPrevios } = await supabase
      .from('registros')
      .select('*, registro_alumnos(*)')
      .eq('equipo_id', equipo.id)
      .eq('creado_por', perfil.id)
      .neq('id', nuevoRegistro.id)
      .order('created_at', { ascending: false })
      .limit(1)

    const anterior = registrosPrevios?.[0]
    const cerradoDelTodo = anterior && anterior.terminado === true && anterior.estado === 'revisado'
    const participacionAnterior = anterior && !cerradoDelTodo
      ? anterior.registro_alumnos.find(ra => ra.alumno_id === perfil.id)
      : null

    await supabase.from('registro_alumnos').insert({
      registro_id: nuevoRegistro.id,
      alumno_id: perfil.id,
      descripcion_operaciones: participacionAnterior?.descripcion_operaciones || null,
      problemas_encontrados: participacionAnterior?.problemas_encontrados || null,
      resultados_obtenidos: participacionAnterior?.resultados_obtenidos || null,
    })

    if (anterior && !cerradoDelTodo && anterior.desperfecto) {
      await supabase.from('registros').update({ desperfecto: true }).eq('id', nuevoRegistro.id)
    }

    await supabase.from('equipos').update({ estado: 'ocupado' }).eq('id', equipo.id)
    await cargarTodo()
  }

  async function unirseAGrupo() {
    const { registro } = equipoParaUnirse
    const { error } = await supabase.from('registro_alumnos').insert({
      registro_id: registro.id,
      alumno_id: perfil.id,
    })
    if (error) { alert('No se pudo unir: ' + error.message); return }
    setEquipoParaUnirse(null)
    await cargarTodo()
  }

  async function eliminarRegistro(registro) {
    if (!window.confirm('¿Seguro que quieres eliminar por completo este registro? No se puede deshacer.')) return
    const { error } = await supabase.from('registros').delete().eq('id', registro.id)
    if (error) { alert('No se pudo eliminar: ' + error.message); return }
    await supabase.from('equipos').update({ estado: 'libre' }).eq('id', registro.equipo_id)
    await cargarTodo()
  }

  async function reabrirRegistro(registro) {
    await supabase
      .from('registros')
      .update({ estado: 'abierto', fecha_fin: null })
      .eq('id', registro.id)
    await supabase.from('equipos').update({ estado: 'ocupado' }).eq('id', registro.equipo_id)
    await cargarTodo()
  }

  if (cargando) return <p>Cargando…</p>

  let contenido
  if (registroPendiente) {
    contenido = (
      <div className="aviso-box">
        <h2>Registro en revisión</h2>
        <p>
          Terminaste tu operación sobre el equipo, pero tu profesor/a todavía no la ha
          revisado. En cuanto la valide podrás elegir un equipo nuevo (o repetir el mismo).
        </p>
        <div className="botones">
          <button onClick={() => reabrirRegistro(registroPendiente.registros)}>
            Reabrir y seguir trabajando
          </button>
          <button className="peligro secundario" onClick={() => eliminarRegistro(registroPendiente.registros)}>
            Eliminar este registro
          </button>
        </div>
      </div>
    )
  } else if (equipoParaUnirse) {
    contenido = (
      <div className="aviso-box">
        <h2>{equipoParaUnirse.equipo.nombre} ya está en uso</h2>
        <p>Un compañero/a ha abierto un registro en grupo sobre este equipo. ¿Quieres unirte para anotar tu propia parte del trabajo?</p>
        <div className="botones">
          <button onClick={unirseAGrupo}>Unirme al registro</button>
          <button className="secundario" onClick={() => setEquipoParaUnirse(null)}>Cancelar</button>
        </div>
      </div>
    )
  } else if (registroActivo) {
    contenido = (
      <OperacionActiva
        registro={registroActivo.registro}
        participacion={registroActivo.participacion}
        personas={personas.filter(p => p.id !== perfil.id)}
        onCerrado={cargarTodo}
        onEliminar={() => eliminarRegistro(registroActivo.registro)}
      />
    )
  } else {
    contenido = (
      <div>
        <div className="bloque-info">
          {bloqueActual
            ? <span>Bloque lectivo actual: <strong>{bloqueActual.nombre}</strong></span>
            : <span>No hay un bloque lectivo activo ahora mismo. Si tu profesor/a lo permite, puedes registrar una operación fuera de bloque.</span>}
        </div>

        {editandoEquipo && (
          <FormularioEquipo
            equipo={editandoEquipo === 'nuevo' ? null : equipos.find(e => e.id === editandoEquipo)}
            onGuardado={() => { setEditandoEquipo(null); cargarTodo() }}
            onCancelar={() => setEditandoEquipo(null)}
          />
        )}

        <div className="cabecera-equipos">
          <h2>Elige un equipo</h2>
          <button className="secundario" onClick={() => setEditandoEquipo('nuevo')}>+ Añadir equipo</button>
        </div>
        <div className="grid-equipos">
          {equipos.map(eq => (
            <div key={eq.id} className={`equipo-card estado-${eq.estado}`}>
              <button
                className="equipo-card-boton"
                disabled={eq.estado === 'en_revision'}
                onClick={() => elegirEquipo(eq)}
              >
                <div className="equipo-card-titulo">
                  <strong>{eq.codigo}</strong>
                  {eq.ultimo_estado_funcional && (
                    <span
                      className="punto-estado"
                      style={{ background: colorEstadoEquipo(eq.ultimo_estado_funcional) }}
                      title={etiquetaEstadoEquipo(eq.ultimo_estado_funcional)}
                    />
                  )}
                </div>
                <span>{eq.tipo} {eq.modelo_basico}</span>
                {(eq.ram || eq.disco || eq.procesador) && (
                  <span className="muted ficha-tecnica">
                    {[eq.procesador, eq.ram, eq.disco].filter(Boolean).join(' · ')}
                  </span>
                )}
                {eq.notas_inventario && (
                  <span className="aviso-equipo">⚠ {eq.notas_inventario}</span>
                )}
                <span className="badge">
                  {eq.estado === 'libre' && 'Libre'}
                  {eq.estado === 'ocupado' && 'Ocupado (grupo) — toca para unirte'}
                  {eq.estado === 'en_revision' && 'En revisión del profesor'}
                </span>
              </button>
              <button className="link-btn editar-equipo" onClick={() => setEditandoEquipo(eq.id)}>Editar ficha del equipo</button>
            </div>
          ))}
          {equipos.length === 0 && <p>Todavía no hay equipos cargados. Añade el primero con el botón de arriba.</p>}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="historial-toggle">
        <button className="link-btn" onClick={() => setVista(v => v === 'historial' ? 'principal' : 'historial')}>
          {vista === 'historial' ? '← Volver' : '🕘 Ver mi historial'}
        </button>
      </div>
      {vista === 'historial' ? <HistorialAlumno perfil={perfil} /> : contenido}
    </div>
  )
}

function HistorialAlumno({ perfil }) {
  const [cargando, setCargando] = useState(true)
  const [participaciones, setParticipaciones] = useState([])

  useEffect(() => {
    supabase
      .from('registro_alumnos')
      .select('*, registros(*, equipos(codigo, tipo, modelo_basico))')
      .eq('alumno_id', perfil.id)
      .order('updated_at', { ascending: false })
      .then(({ data }) => { setParticipaciones(data || []); setCargando(false) })
  }, [perfil.id])

  if (cargando) return <p>Cargando historial…</p>
  if (participaciones.length === 0) return <p className="muted">Todavía no tienes ningún registro.</p>

  const grupos = {}
  for (const p of participaciones) {
    const dia = new Date(p.registros.fecha_inicio).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    grupos[dia] = grupos[dia] || []
    grupos[dia].push(p)
  }

  return (
    <div>
      <h2>Mi historial</h2>
      {Object.entries(grupos).map(([dia, items]) => (
        <div key={dia} className="grupo-dia">
          <h3 className="titulo-dia">{dia}</h3>
          {items.map(p => (
            <div key={p.id} className={`item-historial estado-${p.registros.estado}`}>
              <strong>{p.registros.titulo || `${p.registros.equipos?.codigo} · ${p.registros.equipos?.tipo}`}</strong>
              <span className="fila-badges">
                <span className="badge">{p.registros.estado}</span>
                {p.registros.terminado && <span className="badge badge-terminado">✓ Terminado</span>}
                {p.registros.desperfecto && <span className="badge badge-desperfecto">⚠ Desperfecto</span>}
              </span>
              <span className="muted">{p.registros.equipos?.codigo} — {new Date(p.registros.fecha_inicio).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function OperacionActiva({ registro, participacion, personas, onCerrado, onEliminar }) {
  const [titulo, setTitulo] = useState(registro.titulo || '')
  const [descripcion, setDescripcion] = useState(participacion.descripcion_operaciones || '')
  const [problemas, setProblemas] = useState(participacion.problemas_encontrados || '')
  const [resultados, setResultados] = useState(participacion.resultados_obtenidos || '')
  const [guardando, setGuardando] = useState(false)
  const [foto, setFoto] = useState(null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)

  const [desperfecto, setDesperfecto] = useState(registro.desperfecto || false)

  const [mostrarCierre, setMostrarCierre] = useState(false)
  const [estadoFinal, setEstadoFinal] = useState('')
  const [terminado, setTerminado] = useState(true)
  const [ayuda, setAyuda] = useState(false)
  const [ayudaDe, setAyudaDe] = useState('')

  const huboDatosPrevios = Boolean(participacion.descripcion_operaciones || participacion.problemas_encontrados || participacion.resultados_obtenidos)

  async function toggleDesperfecto(checked) {
    setDesperfecto(checked)
    await supabase.from('registros').update({ desperfecto: checked }).eq('id', registro.id)
  }

  async function guardarTitulo() {
    await supabase.from('registros').update({ titulo }).eq('id', registro.id)
  }

  async function subirFotoOperacion(file) {
    if (!file) return
    setSubiendoFoto(true)
    const url = await subirFoto(file, 'operaciones')
    setSubiendoFoto(false)
    if (!url) return
    await supabase.from('registro_alumnos').update({ foto_url: url }).eq('id', participacion.id)
    participacion.foto_url = url // refleja el cambio sin esperar a recargar
    setFoto(null)
  }

  async function guardarParticipacion() {
    setGuardando(true)
    await supabase
      .from('registro_alumnos')
      .update({
        descripcion_operaciones: descripcion,
        problemas_encontrados: problemas,
        resultados_obtenidos: resultados,
        updated_at: new Date().toISOString(),
      })
      .eq('id', participacion.id)
    setGuardando(false)
  }

  async function finalizarOperacion() {
    if (!estadoFinal) { alert('Indica en qué estado queda el equipo.'); return }
    if (ayuda && !ayudaDe) { alert('Indica quién te ha ayudado.'); return }
    await guardarParticipacion()

    await supabase
      .from('registros')
      .update({
        estado: 'en_revision',
        fecha_fin: new Date().toISOString(),
        estado_equipo_final: estadoFinal,
        desperfecto,
        terminado,
        ayuda_recibida: ayuda,
        ayuda_recibida_de: ayuda ? ayudaDe : null,
      })
      .eq('id', registro.id)

    await supabase
      .from('equipos')
      .update({ estado: 'en_revision', ultimo_estado_funcional: estadoFinal })
      .eq('id', registro.equipo_id)
    onCerrado()
  }

  return (
    <div className="operacion-activa">
      <h2>Operación en curso</h2>
      <p className="muted">Inicio: {new Date(registro.fecha_inicio).toLocaleString('es-ES')}</p>
      {huboDatosPrevios && (
        <div className="aviso-inline">
          📓 Se han cargado los apuntes de tu última sesión con este equipo porque aún no se dio por terminada y revisada. Puedes seguir editándolos.
        </div>
      )}

      <label>
        Título de la operación
        <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} onBlur={guardarTitulo} placeholder="Ej. Cambio de disco duro" />
      </label>

      <label className="checkbox destacado">
        <input type="checkbox" checked={desperfecto} onChange={e => toggleDesperfecto(e.target.checked)} />
        Se ha producido algún desperfecto o incidencia (puedes marcarlo en cualquier momento)
      </label>

      <label>
        Describe las operaciones que has realizado
        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3} />
      </label>
      <label>
        ¿Qué problemas has encontrado?
        <textarea value={problemas} onChange={e => setProblemas(e.target.value)} rows={3} />
      </label>
      <label>
        ¿Qué resultados has obtenido?
        <textarea value={resultados} onChange={e => setResultados(e.target.value)} rows={3} />
      </label>
      <label>
        Foto de la reparación (opcional)
        {participacion.foto_url && <img src={participacion.foto_url} alt="" className="foto-previa" />}
        <input type="file" accept="image/*" onChange={e => subirFotoOperacion(e.target.files[0])} disabled={subiendoFoto} />
        {subiendoFoto && <span className="muted">Subiendo…</span>}
      </label>
      <button onClick={guardarParticipacion} disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar mi progreso'}
      </button>

      <hr />

      {!mostrarCierre ? (
        <div className="botones">
          <button className="finalizar" onClick={() => setMostrarCierre(true)}>
            Finalizar operación sobre el equipo
          </button>
          <button className="peligro secundario" onClick={onEliminar}>
            Eliminar este registro
          </button>
        </div>
      ) : (
        <div className="cierre-box">
          <h3>Cerrar operación</h3>
          <label>
            Estado del equipo al terminar
            <select value={estadoFinal} onChange={e => setEstadoFinal(e.target.value)}>
              <option value="">Selecciona…</option>
              {ESTADOS_EQUIPO_FINAL.map(o => (
                <option key={o.value} value={o.value} style={{ color: o.color }}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={terminado} onChange={e => setTerminado(e.target.checked)} />
            Hemos terminado las operaciones
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={ayuda} onChange={e => setAyuda(e.target.checked)} />
            Hemos recibido ayuda de un compañero/a o profesor/a
          </label>
          {ayuda && (
            <label>
              ¿De quién?
              <select value={ayudaDe} onChange={e => setAyudaDe(e.target.value)}>
                <option value="">Selecciona…</option>
                {personas.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}{p.rol === 'profesor' ? ' (profesor/a)' : ''}</option>
                ))}
              </select>
            </label>
          )}
          <p className="muted">
            Al confirmar, el equipo quedará "en revisión" hasta que tu profesor/a lo valide.
            No podrás elegir un equipo nuevo hasta entonces.
          </p>
          <div className="botones">
            <button onClick={finalizarOperacion}>Confirmar cierre</button>
            <button className="secundario" onClick={() => setMostrarCierre(false)}>Volver</button>
          </div>
        </div>
      )}
    </div>
  )
}
