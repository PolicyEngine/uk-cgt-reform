import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "./globals.css";

export const metadata = {
  title: "Capital gains tax reform dashboard | PolicyEngine",
  description:
    "Interactive dashboard estimating the revenue and distributional effects of reforms to UK capital gains tax rates from 2026-27, equalisation with income tax rates or any schedule you choose, using PolicyEngine UK microsimulation, with behavioural responses at PolicyEngine's capital gains elasticity beside CenTax's and the official one.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
