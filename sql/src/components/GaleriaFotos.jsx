export default function GaleriaFotos({ urls, tamano = 'normal' }) {
  if (!urls || urls.length === 0) return null
  const clase = tamano === 'grande' ? 'foto-miniatura-grande' : 'foto-miniatura'
  return (
    <div className="galeria-fotos">
      {urls.map((url, i) => (
        <a key={i} href={url} target="_blank" rel="noreferrer">
          <img src={url} alt="" className={clase} />
        </a>
      ))}
    </div>
  )
}
