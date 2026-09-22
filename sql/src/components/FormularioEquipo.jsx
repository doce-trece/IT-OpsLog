import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { subirFotos } from '../lib/fotos'
import GaleriaFotos from './GaleriaFotos.jsx'

export default function FormularioEquipo({ equipo, claseFija, clases, onGuardado, onCancelar }) {
  const vacio = { codigo: '', tipo: '', modelo_basico: '', modelo: '', sn: '', product_id: '', educa_serial: '', ram: '', disco: '', procesador: '', notas_inventario: '', origen: '', anio_entrada_taller: '' }
  const [form, setForm] = useState(equipo ? {
    codigo: equipo.codigo || '', tipo: equipo.tipo || '', modelo_basico: equipo.modelo_basico || '',
    modelo: equipo.modelo || '', sn: equipo.sn || '', product_id: equipo.product_id || '',
    educa_serial: equipo.educa_serial || '', ram: equipo.ram || '', disco: equipo.disco || '',
    procesador: equipo.procesador || '', notas_inventario: equipo.notas_inventario || '',
    origen: equipo.origen || '', anio_entrada_taller: equipo.anio_entrada_taller || '',
  } : vacio)
  const [claseId, setClaseId] = useState(equipo?.clase_id || claseFija || '')
  const [guardando, setGuardando] = useState(false)
  const [fotosNuevas, setFotosNuevas] = useState([])
  const [subiendoFoto, setSubiendoFoto] = useState(false)

  function campo(clave, placeholder) {
    return (
      <input
        placeholder={placeholder}
        value={form[clave]}
        onChange={e => setForm({ ...form, [clave]: e.target.value })}
      />
    )
  }

  async function guardar(e) {
    e.preventDefault()
    if (!form.codigo.trim()) { alert('El código (ID) es obligatorio.'); return }
    if (!claseId) { alert('Selecciona la clase a la que pertenece el equipo.'); return }
    setGuardando(true)

    let fotosUrls = equipo?.fotos_urls || []
    if (fotosNuevas.length > 0) {
      setSubiendoFoto(true)
      const nuevas = await subirFotos(fotosNuevas, 'equipos')
      setSubiendoFoto(false)
      fotosUrls = [...fotosUrls, ...nuevas]
    }

    const datos = { ...form, anio_entrada_taller: form.anio_entrada_taller ? Number(form.anio_entrada_taller) : null, fotos_urls: fotosUrls, clase_id: claseId }
    const { error } = equipo
      ? await supabase.from('equipos').update(datos).eq('id', equipo.id)
      : await supabase.from('equipos').insert(datos)
    setGuardando(false)
    if (error) { alert(error.message); return }
    onGuardado()
  }

  return (
    <form onSubmit={guardar} className="form-equipo">
      <h3>{equipo ? `Editar ${equipo.codigo}` : 'Nuevo equipo'}</h3>
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
      {campo('origen', 'Origen')}
      {campo('anio_entrada_taller', 'Año de entrada al taller')}
      {campo('notas_inventario', 'Notas / incidencias conocidas')}
      {clases && (
        <label>
          Clase *
          <select value={claseId} onChange={e => setClaseId(Number(e.target.value))}>
            <option value="">Selecciona…</option>
            {clases.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
      )}
      <label>
        Fotos del equipo (puedes elegir varias)
        <GaleriaFotos urls={equipo?.fotos_urls} />
        <input type="file" accept="image/*" multiple onChange={e => setFotosNuevas(Array.from(e.target.files))} />
      </label>
      <div className="botones">
        <button type="submit" disabled={guardando}>{guardando ? (subiendoFoto ? 'Subiendo fotos…' : 'Guardando…') : 'Guardar'}</button>
        <button type="button" className="secundario" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  )
}
