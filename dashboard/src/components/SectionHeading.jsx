import { NoBreakYears } from "./controls";

// Single source of section typography: every titled block in every tab uses
// this. `size="lg"` is for the group intros that sit between section cards.
// `action` (one or more pills) sits in one left-aligned row directly under
// the title, above the description; it wraps only on phones.
// `paired`: a card in a two-column pair (PAIRED_CARD). On desktop the title,
// the pills and the description each take one of the rows the pair shares,
// so both cards' titles, pills and charts line up.
export default function SectionHeading({ title, description, size = "base", action, paired = false }) {
  const heading = (
    <h2
      className={`${size === "lg" ? "text-2xl" : "text-xl"} font-semibold tracking-tight text-slate-900`}
    >
      {typeof title === "string" ? <NoBreakYears text={title} /> : title}
    </h2>
  );
  const lg = paired ? " lg:contents" : "";
  return (
    <div className={`${size === "lg" ? "mb-2" : "mb-5"}${lg}`}>
      {heading}
      {action ? <div className="mt-3 flex flex-wrap gap-1.5">{action}</div> : null}
      {description ? (
        <div className={`mt-2 text-sm leading-6 text-slate-600${paired ? " lg:mb-5" : ""}`}>{description}</div>
      ) : null}
    </div>
  );
}
