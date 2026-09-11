import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { obtenerBloqueActual, cerrarRegistrosVencidos } from '../lib/bloques'

const ESTADOS_EQUIPO_FINAL = [
  { value: 'completamente_desmontado', label: 'Completamente / casi completamente desmontado' },
  { value: 'parcialmente_desmontado', label: 'Parcialmente desmontado' },
  { value: 'piezas_fuera', label: 'Con piezas fuera' },
  { value: 'montado', label: 'Montado' },
]

export default function AlumnoDashboard({ perfil }) {
  const [cargando, setCargando] = useState(true)
  const [equipos, setEquipos] = useState([])
  const [bloqueActual, setBloqueActual] = useState(null)
  const [registroActivo, setRegistroActivo] = useState(null) // {registro, miParticipacion}
  const [registroPendiente, setRegistroPendiente] = useState(null) // en_revision, sin validar
  const [equipoParaUnirse, setEquipoParaUnirse] = useState(null) // registro abierto de un compañero

  const cargarTodo = useCallback(async () => {
    setCargando(true)
    await cerrarRegistrosVencidos()
    const bloque = await obtenerBloqueActual()
    setBloqueActual(bloque)

    const { data: eq } = await supabase.from('equipos').select('*').order('codigo')
    setEquipos(eq || [])

    // ¿Tengo algún registro en_revision pendiente de que el profesor lo valide?
    const { data: misParticipaciones } = await supabase
      .from('registro_alumnos')
      .select('*, registros(*)')
      .eq('alumno_id', perfil.id)

    const pendiente = (misParticipaciones || []).find(p => p.registros?.estado === 'en_revision')
    setRegistroPendiente(pendiente || null)

    const abierto = (misParticipaciones || []).find(p => p.registros?.estado === 'abierto')
    if (abierto) {
      setRegistroActivo({ registro: abierto.registros, participacion: abierto })
    } else {
      setRegistroActivo(null)
    }

    setCargando(false)
  }, [perfil.id])

  useEffect(() => { cargarTodo() }, [cargarTodo])

  async function elegirEquipo(equipo) {
    // ¿Hay ya un registro "abierto" de un compañero sobre este equipo? (trabajo en grupo)
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

  if (cargando) return <p>Cargando…</p>

  if (registroPendiente) {
    return (
      <div className="aviso-box">
        <h2>Registro en revisión</h2>
        <p>
          Terminaste tu operación sobre el equipo, pero tu profesor/a todavía no la ha
          revisado. En cuanto la valide podrás elegir un equipo nuevo (o repetir el mismo).
        </p>
      </div>
    )
  }

  if (equipoParaUnirse) {
    return (
      <div className="aviso-box">
        <h2>{equipoParaUnirse.equipo.nombre} ya está en uso</h2>
        <p>Un compañero/a ha abierto un registro en grupo sobre este equipo. ¿Quieres unirte para anotar tu propia parte del trabajo?</p>
        <div className="botones">
          <button onClick={unirseAGrupo}>Unirme al registro</button>
          <button className="secundario" onClick={() => setEquipoParaUnirse(null)}>Cancelar</button>
        </div>
      </div>
    )
  }

  if (registroActivo) {
    return (
      <OperacionActiva
        registro={registroActivo.registro}
        participacion={registroActivo.participacion}
        perfil={perfil}
        onCerrado={cargarTodo}
      />
    )
  }

  return (
    <div>
      <div className="bloque-info">
        {bloqueActual
          ? <span>Bloque lectivo actual: <strong>{bloqueActual.nombre}</strong></span>
          : <span>No hay un bloque lectivo activo ahora mismo. Si tu profesor/a lo permite, puedes registrar una operación fuera de bloque.</span>}
      </div>
      <h2>Elige un equipo</h2>
      <div className="grid-equipos">
        {equipos.map(eq => (
          <button
            key={eq.id}
            className={`equipo-card estado-${eq.estado}`}
            disabled={eq.estado === 'en_revision'}
            onClick={() => elegirEquipo(eq)}
          >
            <strong>{eq.codigo}</strong>
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
        ))}
        {equipos.length === 0 && <p>Todavía no hay equipos cargados. Pídeselo a tu profesor/a.</p>}
      </div>
    </div>
  )
}

function OperacionActiva({ registro, participacion, perfil, onCerrado }) {
  const [descripcion, setDescripcion] = useState(participacion.descripcion_operaciones || '')
  const [problemas, setProblemas] = useState(participacion.problemas_encontrados || '')
  const [resultados, setResultados] = useState(participacion.resultados_obtenidos || '')
  const [guardando, setGuardando] = useState(false)

  const [mostrarCierre, setMostrarCierre] = useState(false)
  const [estadoFinal, setEstadoFinal] = useState('')
  const [desperfecto, setDesperfecto] = useState(false)
  const [terminado, setTerminado] = useState(true)
  const [ayuda, setAyuda] = useState(false)

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
      })
      .eq('id', registro.id)

    await supabase
      .from('equipos')
      .update({ estado: 'en_revision' })
      .eq('id', registro.equipo_id)

    onCerrado()
  }

  return (
    <div className="operacion-activa">
      <h2>Operación en curso</h2>
      <p className="muted">Inicio: {new Date(registro.fecha_inicio).toLocaleString('es-ES')}</p>

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
      <button onClick={guardarParticipacion} disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar mi progreso'}
      </button>

      <hr />

      {!mostrarCierre ? (
        <button className="finalizar" onClick={() => setMostrarCierre(true)}>
          Finalizar operación sobre el equipo
        </button>
      ) : (
        <div className="cierre-box">
          <h3>Cerrar operación</h3>
          <label>
            Estado del equipo al terminar
            <select value={estadoFinal} onChange={e => setEstadoFinal(e.target.value)}>
              <option value="">Selecciona…</option>
              {ESTADOS_EQUIPO_FINAL.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={desperfecto} onChange={e => setDesperfecto(e.target.checked)} />
            Se ha producido algún desperfecto o incidencia
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={terminado} onChange={e => setTerminado(e.target.checked)} />
            Hemos terminado las operaciones
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={ayuda} onChange={e => setAyuda(e.target.checked)} />
            Hemos recibido ayuda de un compañero/a o profesor/a
          </label>
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
