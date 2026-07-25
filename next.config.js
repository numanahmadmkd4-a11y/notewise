/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // pdfjs-dist optionally imports 'canvas' for server-side rendering,
    // which we don't need since we only extract text in the browser.
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
