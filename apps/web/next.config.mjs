/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.API_BASE_URL
          ? `${process.env.API_BASE_URL}/api/:path*`
          : 'http://localhost:8000/api/:path*',
      },
    ]
  },
}

export default nextConfig
