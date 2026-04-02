/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  // experimental.serverActions.allowedOrigins restringido a localhost:3000 bloqueaba
  // Server Actions en producción (velo-manager.vercel.app). Eliminado — Next.js
  // aplica same-origin por defecto, que es el comportamiento seguro correcto.
}

module.exports = nextConfig
