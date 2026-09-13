import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { subirFoto } from '../lib/fotos'

export default function FormularioEquipo({ equipo, onGuardado, onCancelar }) {
  const vacio = { codigo: '', tipo: '', modelo_basico: '', modelo: '', sn: '', product_id: '', educa_serial: '', ram: '', disco: '', procesador: '', notas_inventario: '', origen: '', anio_entrada_taller: '' }
  const [form, setForm] = useState(equipo ? {
    codigo: equipo.codigo || '', tipo: equipo.tipo || '', modelo_basico: equipo.modelo_basico || '',
    modelo: equipo.modelo || '', sn: equipo.sn || '', product_id: equipo.product_id || '',
    educa_serial: equipo.educa_serial || '', ram: equipo.ram || '', disco: equipo.disco || '',
    procesador: equipo.procesador || '', notas_inventario: equipo.notas_inventario || '',
    origen: equipo.origen || '', anio_entrada_taller: equipo.anio_entrada_taller || '',
  } : vacio)
  const [guardando, setGuardando] = useState(false)
  const [foto, setFoto] = useState(null)
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
    setGuardando(true)

    let foto_url = equipo?.foto_url || null
    if (foto) {
      setSubiendoFoto(true)
      const url = await subirFoto(foto, 'equipos')
      setSubiendoFoto(false)
      if (url) foto_url = url
    }

    const datos = { ...form, anio_entrada_taller: form.anio_entrada_taller ? Number(form.anio_entrada_taller) : null, foto_url }
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
      <label>
        Foto del equipo
        {equipo?.foto_url && <img src={equipo.foto_url} alt="" className="foto-previa" />}
        <input type="file" accept="image/*" onChange={e => setFoto(e.target.files[0] || null)} />
      </label>
      <div className="botones">
        <button type="submit" disabled={guardando}>{guardando ? (subiendoFoto ? 'Subiendo foto…' : 'Guardando…') : 'Guardar'}</button>
        <button type="button" className="secundario" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  )
}
