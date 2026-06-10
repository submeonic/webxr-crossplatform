import { defineConfig } from 'vite'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig({
  plugins: [
    mkcert(),

    {
      name: 'disable-cache',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          res.setHeader(
            'Cache-Control',
            'no-store, no-cache, must-revalidate, proxy-revalidate'
          )
          res.setHeader('Pragma', 'no-cache')
          res.setHeader('Expires', '0')
          next()
        })
      }
    }
  ],

  server: {
    host: '0.0.0.0',
    https: true,
    hmr: {
      overlay: false
    }
  },

  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
