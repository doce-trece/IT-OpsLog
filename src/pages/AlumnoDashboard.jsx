import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { ESTADOS_EQUIPO_FINAL, colorEstadoEquipo, etiquetaEstadoEquipo, formatearDuracion } from '../lib/estados'
import { calcularSesionesYDias, tiempoConectadoMs, registrarConexion, cerrarConexion } from '../lib/sesiones'
import { subirFoto, subirFotos } from '../lib/fotos'
import { nombreMostrable } from '../lib/personas'
import GaleriaFotos from '../components/GaleriaFotos.jsx'
import FormularioEquipo from '../components/FormularioEquipo.jsx'

export default function AlumnoDashboard({ perfil }) {
  const [cargando, setCargando] = useState(true)
  const [equipos, setEquipos] = useState([])
  const [personas, setPersonas] = useState([])
  const [registroActivo, setRegistroActivo] = useState(null) // {registro, participacion}
  const [equipoParaUnirse, setEquipoParaUnirse] = useState(null)
  const [editandoEquipo, setEditandoEquipo] = useState(null)
  const [vista, setVista] = useState('principal') // principal | historial

  const cargarTodo = useCallback(async () => {
    setCargando(true)

    const { data: eq } = await supabase.from('equipos').select('*').order('codigo')
    setEquipos(eq || [])

    const { data: todasLasPersonas } = await supabase.from('profiles').select('id, nombre, username, rol').order('nombre')
    setPersonas(todasLasPersonas || [])

    const { data: todosLosBloques } = await supabase.from('bloques_lectivos').select('*')

    const { data: misParticipaciones } = await supabase
      .from('registro_alumnos')
      .select('*, registros(*)')
      .eq('alumno_id', perfil.id)

    // "Activo" = cualquier registro propio que aún no haya sido revisado,
    // esté abierto o ya enviado a revisión: se sigue pudiendo editar.
    const activo = (misParticipaciones || []).find(p => p.registros && p.registros.estado !== 'revisado')

    // Cuenta como conexión: sella el bloque del instante actual y arranca
    // (o continúa) el cronómetro de tiempo conectado. Se hace ANTES de
    // guardar el estado para que la pantalla ya muestre los datos al día.
    if (activo) await registrarConexion(supabase, activo.registros, todosLosBloques || [])

    setRegistroActivo(activo ? { registro: activo.registros, participacion: activo } : null)

    setCargando(false)
  }, [perfil.id])

  useEffect(() => { cargarTodo() }, [cargarTodo])

  async function elegirEquipo(equipo) {
    const { data: registroExistente } = await supabase
      .from('registros')
      .select('*')
      .eq('equipo_id', equipo.id)
      .neq('estado', 'revisado')
      .maybeSingle()

    if (registroExistente) {
      setEquipoParaUnirse({ equipo, registro: registroExistente })
      return
    }

    const { data: nuevoRegistro, error } = await supabase
      .from('registros')
      .insert({ equipo_id: equipo.id, creado_por: perfil.id })
      .select()
      .single()

    if (error) { alert('Error creando el registro: ' + error.message); return }

    await supabase.from('registro_alumnos').insert({
      registro_id: nuevoRegistro.id,
      alumno_id: perfil.id,
    })

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

  if (cargando) return <p>Cargando…</p>

  let contenido
  if (equipoParaUnirse) {
    contenido = (
      <div className="aviso-box">
        <h2>{equipoParaUnirse.equipo.codigo} · {equipoParaUnirse.equipo.tipo} ya está en uso</h2>
        <p>Un compañero/a tiene un registro abierto (o pendiente de revisión) sobre este equipo. ¿Quieres unirte para anotar tu propia parte del trabajo?</p>
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
        onCambio={cargarTodo}
        onEliminar={() => eliminarRegistro(registroActivo.registro)}
      />
    )
  } else {
    contenido = (
      <div>
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
              <button className="equipo-card-boton" onClick={() => elegirEquipo(eq)}>
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
                {eq.notas_inventario && <span className="aviso-equipo">⚠ {eq.notas_inventario}</span>}
                <span className="badge">
                  {eq.estado === 'libre' && 'Libre'}
                  {eq.estado === 'ocupado' && 'En uso — toca para unirte'}
                  {eq.estado === 'en_revision' && 'Pendiente de revisión — toca para unirte'}
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

function OperacionActiva({ registro, participacion, personas, onCambio, onEliminar }) {
  const [titulo, setTitulo] = useState(registro.titulo || '')
  const [descripcion, setDescripcion] = useState(participacion.descripcion_operaciones || '')
  const [problemas, setProblemas] = useState(participacion.problemas_encontrados || '')
  const [resultados, setResultados] = useState(participacion.resultados_obtenidos || '')
  const [guardando, setGuardando] = useState(false)
  const [foto, setFoto] = useState(null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)

  const [desperfecto, setDesperfecto] = useState(registro.desperfecto || false)
  const [terminado, setTerminado] = useState(registro.terminado || false)
  const [estadoFinal, setEstadoFinal] = useState(registro.estado_equipo_final || '')
  const [ayuda, setAyuda] = useState(registro.ayuda_recibida || false)
  const [ayudaDe, setAyudaDe] = useState(registro.ayuda_recibida_de || [])

  const { diasCalendario, diasTrabajados, sesiones } = calcularSesionesYDias(registro)
  const tiempoConectado = tiempoConectadoMs(registro)

  async function guardarTitulo() {
    await supabase.from('registros').update({ titulo }).eq('id', registro.id)
  }

  async function toggleDesperfecto(checked) {
    setDesperfecto(checked)
    await supabase.from('registros').update({ desperfecto: checked }).eq('id', registro.id)
  }

  async function toggleTerminado(checked) {
    setTerminado(checked)
    await supabase.from('registros').update({ terminado: checked }).eq('id', registro.id)
  }

  async function cambiarEstadoFinal(value) {
    setEstadoFinal(value)
    await supabase.from('registros').update({ estado_equipo_final: value }).eq('id', registro.id)
    if (value) await supabase.from('equipos').update({ ultimo_estado_funcional: value }).eq('id', registro.equipo_id)
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

  async function subirFotoOperacion(files) {
    if (!files || files.length === 0) return
    setSubiendoFoto(true)
    const nuevas = await subirFotos(Array.from(files), 'operaciones')
    setSubiendoFoto(false)
    if (nuevas.length === 0) return
    const listaActual = participacion.fotos_urls || []
    const listaNueva = [...listaActual, ...nuevas]
    await supabase.from('registro_alumnos').update({ fotos_urls: listaNueva }).eq('id', participacion.id)
    participacion.fotos_urls = listaNueva
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

  async function enviarARevision() {
    await guardarParticipacion()
    await cerrarConexion(supabase, registro) // para el cronómetro: no sigue sumando tiempo en revisión
    await supabase
      .from('registros')
      .update({ estado: 'en_revision', enviado_revision_en: new Date().toISOString() })
      .eq('id', registro.id)
    await supabase.from('equipos').update({ estado: 'en_revision' }).eq('id', registro.equipo_id)
    onCambio()
  }

  return (
    <div className="operacion-activa">
      <h2>{registro.estado === 'en_revision' ? 'Registro enviado a revisión' : 'Operación en curso'}</h2>
      <p className="muted">
        Inicio: {new Date(registro.fecha_inicio).toLocaleString('es-ES')}
        {' · '}Lleva abierto {diasCalendario} {diasCalendario === 1 ? 'día' : 'días'} ({diasTrabajados} con actividad)
        {' · '}{sesiones} {sesiones === 1 ? 'sesión de aula' : 'sesiones de aula'}
        {' · '}Tiempo conectado: {formatearDuracion(tiempoConectado)}{registro.conexion_iniciada_en ? ' (en curso)' : ''}
      </p>

      {registro.estado === 'en_revision' && (
        <div className="aviso-inline">
          📋 Enviado a revisión el {new Date(registro.enviado_revision_en).toLocaleString('es-ES')}. Tu profesor/a
          todavía no lo ha validado — puedes seguir editando todo lo que necesites mientras tanto.
        </div>
      )}

      <label>
        Título de la operación
        <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} onBlur={guardarTitulo} placeholder="Ej. Cambio de disco duro" />
      </label>

      <label className="checkbox destacado">
        <input type="checkbox" checked={desperfecto} onChange={e => toggleDesperfecto(e.target.checked)} />
        Se ha producido algún desperfecto o incidencia
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
        Fotos de la reparación (opcional, puedes elegir varias)
        <GaleriaFotos urls={participacion.fotos_urls} />
        <input type="file" accept="image/*" multiple onChange={e => subirFotoOperacion(e.target.files)} disabled={subiendoFoto} />
        {subiendoFoto && <span className="muted">Subiendo…</span>}
      </label>
      <button onClick={guardarParticipacion} disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar mi progreso'}
      </button>

      <hr />

      <label>
        Estado del equipo
        <select value={estadoFinal} onChange={e => cambiarEstadoFinal(e.target.value)}>
          <option value="">Selecciona…</option>
          {ESTADOS_EQUIPO_FINAL.map(o => (
            <option key={o.value} value={o.value} style={{ color: o.color }}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={terminado} onChange={e => toggleTerminado(e.target.checked)} />
        Hemos terminado las operaciones
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={ayuda} onChange={e => cambiarAyuda(e.target.checked)} />
        Hemos recibido ayuda de uno o varios compañeros/as o profesor/a
      </label>
      {ayuda && (
        <div className="lista-ayudantes">
          {personas.map(p => (
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

      <div className="botones acciones-alumno">
        {registro.estado === 'abierto' && (
          <button className="finalizar" onClick={enviarARevision}>Enviar a revisión</button>
        )}
        <button className="peligro secundario" onClick={onEliminar}>Eliminar este registro</button>
      </div>
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
          {items.map(p => {
            const { diasCalendario, sesiones } = calcularSesionesYDias(p.registros)
            return (
              <div key={p.id} className={`item-historial estado-${p.registros.estado}`}>
                <strong>{p.registros.titulo || `${p.registros.equipos?.codigo} · ${p.registros.equipos?.tipo}`}</strong>
                <span className="fila-badges">
                  <span className="badge">{p.registros.estado}</span>
                  {p.registros.terminado && <span className="badge badge-terminado">✓ Terminado</span>}
                  {p.registros.desperfecto && <span className="badge badge-desperfecto">⚠ Desperfecto</span>}
                </span>
                <span className="muted">
                  {p.registros.equipos?.codigo} · Inicio: {new Date(p.registros.fecha_inicio).toLocaleDateString('es-ES')}
                  {' · '}{diasCalendario} {diasCalendario === 1 ? 'día' : 'días'}
                  {' · '}{sesiones} {sesiones === 1 ? 'sesión' : 'sesiones'}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
