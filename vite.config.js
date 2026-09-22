import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANTE: cambia "taller-registro-operaciones" por el nombre EXACTO
// de tu repositorio de GitHub si es distinto. Esto hace que las rutas de
// los archivos funcionen correctamente en https://tuusuario.github.io/tu-repo/
export default defineConfig({
  plugins: [react()],
  base: '/IT-OpsLogs/',
})
