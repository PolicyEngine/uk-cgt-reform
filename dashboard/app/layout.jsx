import "./globals.css";

export const metadata = {
  title: "Capital gains tax reform dashboard | PolicyEngine",
  description:
    "Interactive dashboard estimating the revenue and distributional effects of reforms to UK capital gains tax rates from 2026-27, equalisation with income tax rates or any schedule you choose, using PolicyEngine UK microsimulation with CenTax-aligned behavioural responses.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
