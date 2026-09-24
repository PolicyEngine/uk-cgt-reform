/** @type {import('next').NextConfig} */
const BASE_PATH = "/uk/cgt-reform";
// Where the dashboard lived before the repository became uk-cgt-reform;
// links to it (the GitHub About section, shared URLs) must keep working.
const FORMER_BASE_PATH = "/uk/equalising-cgt";

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@policyengine/design-system"],
  // Mounted as a Next.js multizone under policyengine.org/uk/cgt-reform,
  // so pages and /_next assets must resolve under that path prefix.
  basePath: BASE_PATH,
  // Exposed so raw fetch() and plain <img> tags — which Next.js does not
  // auto-prefix under basePath — can build their own absolute URLs.
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
  // Outside the base path: the former path and the bare deployment domain
  // both land on the dashboard, keeping any query string (tab, schedule).
  async redirects() {
    return [
      { source: "/", destination: BASE_PATH, basePath: false, permanent: false },
      { source: FORMER_BASE_PATH, destination: BASE_PATH, basePath: false, permanent: true },
      {
        source: `${FORMER_BASE_PATH}/:path*`,
        destination: `${BASE_PATH}/:path*`,
        basePath: false,
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
