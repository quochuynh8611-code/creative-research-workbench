/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.API_BASE_URL
          ? `${process.env.API_BASE_URL}/:path*`
          : 'http://localhost:8000/:path*',
      },
    ]
  },
}

export default nextConfig
