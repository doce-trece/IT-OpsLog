import { useEffect, useState, useRef } from 'react'

const MINUTOS_INACTIVIDAD = 20
const EVENTOS = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll']

// Devuelve true cuando el usuario lleva MINUTOS_INACTIVIDAD sin interactuar
// con la página. Vuelve a false en cuanto detecta cualquier actividad.
export function useInactividad() {
  const [inactivo, setInactivo] = useState(false)
  const timeoutRef = useRef(null)

  useEffect(() => {
    function reiniciarTemporizador() {
      setInactivo(false)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setInactivo(true), MINUTOS_INACTIVIDAD * 60 * 1000)
    }

    reiniciarTemporizador()
    EVENTOS.forEach(ev => window.addEventListener(ev, reiniciarTemporizador))

    return () => {
      EVENTOS.forEach(ev => window.removeEventListener(ev, reiniciarTemporizador))
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return inactivo
}
