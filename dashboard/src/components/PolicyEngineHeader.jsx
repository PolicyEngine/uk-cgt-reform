"use client";
import { Header } from "@policyengine/ui-kit/layout";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const navItems = [
  { label: "Research", href: "https://policyengine.org/uk/research" },
  { label: "Model", href: "https://policyengine.org/uk/model" },
  { label: "API", href: "https://policyengine.org/uk/api" },
  { label: "About", href: "https://policyengine.org/uk/about" },
  { label: "Donate", href: "https://policyengine.org/uk/donate" },
];
export default function PolicyEngineHeader() {
  return (
    <Header
      navItems={navItems}
      logoSrc={`${BASE_PATH}/assets/logos/policyengine-white.svg`}
      logoHref="https://policyengine.org/uk"
      className="site-header"
      styles={{ root: { position: "relative" } }}
    />
  );
}
