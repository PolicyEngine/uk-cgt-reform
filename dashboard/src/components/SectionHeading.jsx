import { splitFiscalYears } from "../lib/formatters";

// Single source of section typography: every titled block in every tab uses
// this. `size="lg"` is for the group intros that sit between section cards.
// `action` (one or more pills) sits on the title's line, at the right, in a
// row that wraps; when the pills leave the title under 14rem the row drops
// under the title, still at the right. It stacks under the title on phones.
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
      {action ? (
        <div className={`flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-4${lg}`}>
          <div className="min-w-0 sm:flex-[1_1_14rem]">{heading}</div>
          <div className={`flex min-w-0 flex-wrap gap-2 sm:ml-auto sm:justify-end${paired ? " lg:mt-3" : ""}`}>
            {action}
          </div>
        </div>
      ) : (
        heading
      )}
      {description ? (
        <div className={`mt-2 text-sm leading-6 text-slate-600${paired ? " lg:mb-5" : ""}`}>{description}</div>
      ) : null}
    </div>
  );
}

// Text with each fiscal year ("2027-28") kept on one line.
export function NoBreakYears({ text }) {
  return splitFiscalYears(text).map((part, i) =>
    part.year ? (
      <span key={i} className="whitespace-nowrap">
        {part.text}
      </span>
    ) : (
      part.text
    ),
  );
}
