/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Las imagenes que descarga el scraper se optimizan y se convierten a WebP
    // antes de guardarse en /public/uploads, pero dejamos remotos permitidos
    // para los banners externos que cargue el administrador.
    remotePatterns: [
      { protocol: 'https', hostname: '**' }
    ],
    formats: ['image/webp']
  },
  experimental: {
    // sharp se usa del lado servidor para redimensionar / marca de agua
    serverComponentsExternalPackages: ['sharp', 'cheerio', 'fs', 'crypto', 'path', 'child_process', 'detect-libc'],
    // Habilita src/instrumentation.ts, donde se enciende el planificador de scraping
    instrumentationHook: true,
    // Las Server Actions del panel suben fotos de avisos (hasta 3 de 6 MB):
    // el limite por defecto (1 MB) es insuficiente.
    serverActions: { bodySizeLimit: '20mb' }
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
        ]
      }
    ];
  }
};

export default nextConfig;
