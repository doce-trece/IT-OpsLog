import { supabase } from '../supabaseClient'

// Sube un archivo de imagen al bucket "fotos" y devuelve su URL pública,
// o null si algo falla (y avisa con un alert sencillo).
export async function subirFoto(file, carpeta) {
  if (!file) return null
  const extension = file.name.split('.').pop()
  const nombre = `${carpeta}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`

  const { error } = await supabase.storage.from('fotos').upload(nombre, file)
  if (error) {
    alert('No se pudo subir la foto: ' + error.message)
    return null
  }

  const { data } = supabase.storage.from('fotos').getPublicUrl(nombre)
  return data.publicUrl
}

// Sube varios archivos de una vez y devuelve el array de URLs que sí se
// subieron correctamente (las que fallen se avisan pero no cortan el resto).
export async function subirFotos(files, carpeta) {
  const urls = []
  for (const file of files) {
    const url = await subirFoto(file, carpeta)
    if (url) urls.push(url)
  }
  return urls
}
