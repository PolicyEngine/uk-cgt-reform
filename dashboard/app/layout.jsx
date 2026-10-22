import PolicyEngineFooter from "../src/components/PolicyEngineFooter";
import PolicyEngineHeader from "../src/components/PolicyEngineHeader";

import "./globals.css";

export const metadata = {
  title: "Capital gains tax reform dashboard | PolicyEngine",
  description:
    "Interactive dashboard estimating the revenue and distributional effects of reforms to UK capital gains tax rates from 2026-27, equalisation with income tax rates or any schedule you choose, using PolicyEngine UK microsimulation, with behavioural responses at CenTax's elasticities.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      {/* A column at least the window's height, so the site footer sits at
          the bottom and any spare space stays inside the page. */}
      <body className="flex min-h-screen flex-col">
        <PolicyEngineHeader />
        <div className="flex flex-1 flex-col">{children}</div>
        <PolicyEngineFooter />
      </body>
    </html>
  );
}
