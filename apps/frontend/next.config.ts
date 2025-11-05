/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['lightweight-charts'],
  
  // Disable error overlay temporarily
  reactStrictMode: true,
  
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5000/api/:path*', // Adjust to your NestJS port
      },
      // Proxy for on-prem graph server to avoid CORS issues
      {
        source: '/watchlist-graphs/:path*',
        destination: 'http://100.93.172.21:6969/Watchlist_assets/:path*',
      },
    ];
  },

  // Configure external image domains
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '100.93.172.21',
        port: '6969',
        pathname: '/Watchlist_assets/**',
      },
    ],
    unoptimized: true, // Disable image optimization for external images
  },

  // Hide error overlays in development
  onError: (err) => {
    // Suppress errors from showing in overlay
    console.error('Suppressed error:', err);
  },

  // For Next.js 13+ - disable error overlay
  experimental: {
    errorOverlay: false,
  },

  // Additional option to reduce noise
  compiler: {
    removeConsole: false, // Set to true if you want to remove console.logs in production
  },
};

module.exports = nextConfig;