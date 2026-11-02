/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // El portal muestra imágenes propias (/public/uploads, ya en WebP) y de
    // terceros (notas scrapeadas, links pegados a mano en el panel). El
    // optimizador de Vercel rechaza con 400 INVALID_IMAGE_OPTIMIZE_REQUEST toda
    // URL remota que no esté en remotePatterns, así que se desactiva y cada
    // navegador trae la imagen directo desde su origen.
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' }
    ],
    formats: ['image/webp']
  },
  experimental: {
    // sharp se usa del lado servidor para redimensionar / marca de agua
    serverComponentsExternalPackages: ['sharp', 'cheerio', 'fs', 'crypto', 'path', 'child_process', 'detect-libc', 'node:child_process', 'node:crypto', 'node:os', 'node:path', 'node:stream'],
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
  },

  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      crypto: false,
      path: false,
      child_process: false,
      'fs/promises': false,
      'node:child_process': false,
      'node:crypto': false,
      'node:os': false,
      'node:path': false,
      'node:stream': false,
    };
    config.externals = [
      ...(Array.isArray(config.externals) ? config.externals : []),
      'sharp',
      'node:child_process',
      'node:crypto',
      'node:os',
      'node:path',
      'node:stream',
      'detect-libc',
    ];
    return config;
  }
};

export default nextConfig;
