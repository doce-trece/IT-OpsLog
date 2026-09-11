import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { cerrarRegistrosVencidos } from '../lib/bloques'

const ETIQUETAS_ESTADO_EQUIPO = {
  completamente_desmontado: 'Completamente / casi desmontado',
  parcialmente_desmontado: 'Parcialmente desmontado',
  piezas_fuera: 'Con piezas fuera',
  montado: 'Montado',
}

export default function ProfesorDashboard({ perfil }) {
  const [vista, setVista] = useState('pendientes') // pendientes | historico | equipos
  const [registros, setRegistros] = useState([])
  const [equipos, setEquipos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [seleccionado, setSeleccionado] = useState(null)

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

    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const pendientes = registros.filter(r => r.estado === 'en_revision')
  const listaVisible = vista === 'pendientes' ? pendientes : registros

  return (
    <div className="profesor-grid">
      <aside>
        <nav className="tabs">
          <button className={vista === 'pendientes' ? 'activo' : ''} onClick={() => setVista('pendientes')}>
            Pendientes de revisar ({pendientes.length})
          </button>
          <button className={vista === 'historico' ? 'activo' : ''} onClick={() => setVista('historico')}>
            Histórico completo
          </button>
          <button className={vista === 'equipos' ? 'activo' : ''} onClick={() => setVista('equipos')}>
            Equipos
          </button>
        </nav>

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
                  <span className="badge">{r.estado}</span>
                  <span className="muted">
                    {r.registro_alumnos.map(ra => ra.profiles?.nombre).join(', ')}
                  </span>
                  <span className="muted">{new Date(r.created_at).toLocaleString('es-ES')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {vista === 'equipos' && <GestionEquipos equipos={equipos} onCambio={cargar} />}
      </aside>

      <section className="detalle">
        {vista !== 'equipos' && seleccionado && (
          <DetalleRegistro
            key={seleccionado.id}
            registro={seleccionado}
            perfil={perfil}
            onValidado={() => { setSeleccionado(null); cargar() }}
          />
        )}
        {vista !== 'equipos' && !seleccionado && <p className="muted">Selecciona un registro de la lista.</p>}
      </section>
    </div>
  )
}

function DetalleRegistro({ registro, perfil, onValidado }) {
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
    onValidado()
  }

  return (
    <div>
      <h2>{registro.equipos?.codigo} · {registro.equipos?.tipo} {registro.equipos?.modelo_basico}</h2>
      <p className="muted">
        {registro.bloques_lectivos?.nombre || (registro.fuera_de_bloque ? 'Fuera de bloque lectivo' : '—')}
        {' · '}Inicio: {new Date(registro.fecha_inicio).toLocaleString('es-ES')}
        {registro.fecha_fin && <> · Fin: {new Date(registro.fecha_fin).toLocaleString('es-ES')}</>}
      </p>

      {registro.cerrado_automaticamente && (
        <div className="aviso-inline">⚠ Este registro se cerró automáticamente al terminar el bloque lectivo (el alumno no lo cerró a tiempo).</div>
      )}

      <div className="resumen-cierre">
        <span><strong>Estado del equipo:</strong> {ETIQUETAS_ESTADO_EQUIPO[registro.estado_equipo_final] || '—'}</span>
        <span><strong>Desperfecto/incidencia:</strong> {registro.desperfecto ? 'Sí' : 'No'}</span>
        <span><strong>Terminado:</strong> {registro.terminado ? 'Sí' : 'No'}</span>
        <span><strong>Ayuda recibida:</strong> {registro.ayuda_recibida ? 'Sí' : 'No'}</span>
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

      {registro.estado === 'en_revision' && (
        <button className="finalizar" onClick={marcarRevisado}>
          Marcar como revisado (libera el equipo)
        </button>
      )}
      {registro.estado === 'revisado' && (
        <p className="ok-msg">✓ Revisado el {new Date(registro.revisado_en).toLocaleString('es-ES')}</p>
      )}
    </div>
  )
}

function GestionEquipos({ equipos, onCambio }) {
  const [form, setForm] = useState({
    codigo: '', tipo: '', modelo_basico: '', modelo: '', sn: '',
    product_id: '', educa_serial: '', ram: '', disco: '', procesador: '', notas_inventario: '',
  })

  function campo(clave, placeholder) {
    return (
      <input
        placeholder={placeholder}
        value={form[clave]}
        onChange={e => setForm({ ...form, [clave]: e.target.value })}
      />
    )
  }

  async function anadir(e) {
    e.preventDefault()
    if (!form.codigo.trim()) { alert('El código (ID) es obligatorio.'); return }
    const { error } = await supabase.from('equipos').insert(form)
    if (error) { alert(error.message); return }
    setForm({ codigo: '', tipo: '', modelo_basico: '', modelo: '', sn: '', product_id: '', educa_serial: '', ram: '', disco: '', procesador: '', notas_inventario: '' })
    onCambio()
  }

  return (
    <div className="gestion-equipos">
      <h3>Añadir equipo</h3>
      <p className="muted">
        Para cargar todo tu inventario de golpe desde el Excel, es más rápido usar
        Supabase → Table editor → equipos → Import data from CSV (mismas columnas
        que tu Excel: ID, TIPO, MODELO BASICO, MODELO, SN, PRODUCT ID, EDUCA
        SERIAL, RAM, DISCO, PROCESADOR, NOTAS).
      </p>
      <form onSubmit={anadir} className="form-equipo">
        {campo('codigo', 'ID (ej. MME_FP_VIA01) *')}
        {campo('tipo', 'Tipo (ej. ThinkCentre Lenovo)')}
        {campo('modelo_basico', 'Modelo básico')}
        {campo('modelo', 'Modelo')}
        {campo('sn', 'SN')}
        {campo('product_id', 'Product ID')}
        {campo('educa_serial', 'Educa Serial')}
        {campo('ram', 'RAM')}
        {campo('disco', 'Disco')}
        {campo('procesador', 'Procesador')}
        {campo('notas_inventario', 'Notas / incidencias conocidas')}
        <button type="submit">Añadir</button>
      </form>
      <h3>Equipos ({equipos.length})</h3>
      <ul className="lista-equipos-simple">
        {equipos.map(e => (
          <li key={e.id}>
            <div>
              <strong>{e.codigo}</strong> — {e.tipo} {e.modelo_basico}
              {e.notas_inventario && <div className="muted">⚠ {e.notas_inventario}</div>}
            </div>
            <span className={`badge estado-${e.estado}`}>{e.estado}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
