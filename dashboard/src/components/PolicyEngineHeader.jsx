const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// PolicyEngine site header, rendered by the dashboard itself. Multizone
// rewrites proxy this app under policyengine.org/uk/cgt-reform but do
// not inject the parent site shell, so — like the other published dashboards
// (uk-cliff-watch etc.) — we render the header/nav here. Links point at the
// UK site so the tool sits inside the PolicyEngine UK experience.
const NAV_LINKS = [
  { label: "Research", href: "https://policyengine.org/uk/research" },
  { label: "Model", href: "https://policyengine.org/uk/model" },
  { label: "API", href: "https://policyengine.org/uk/api" },
  { label: "About", href: "https://policyengine.org/uk/about" },
  { label: "Donate", href: "https://policyengine.org/uk/donate" },
];

export default function PolicyEngineHeader() {
  return (
    <nav
      className="sticky top-0 z-50 w-full"
      style={{
        background:
          "linear-gradient(to right, var(--pe-color-primary-800, #234E52), var(--pe-color-primary-600, #2C7A7B))",
      }}
    >
      <div className="mx-auto flex h-[58px] max-w-[1400px] items-center gap-4 px-4 sm:gap-8 sm:px-6 md:px-8">
        <a
          href="https://policyengine.org/uk"
          aria-label="PolicyEngine UK home"
          className="flex flex-shrink-0 items-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${BASE_PATH}/assets/logos/policyengine-white.svg`}
            alt="PolicyEngine"
            className="h-6 w-auto"
          />
        </a>

        {/* On a narrow screen the links scroll sideways rather than widen the page. */}
        <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto whitespace-nowrap sm:gap-6 md:gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="flex-shrink-0 text-sm font-medium text-white sm:text-[15px] no-underline transition-opacity hover:opacity-80"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
