// Single source of section typography: every titled block in every tab uses
// this. `size="lg"` is for the group intros that sit between section cards.
// `action` (a compact control) sits on the title's line, at the right; it
// stacks under the title on phones.
export default function SectionHeading({ title, description, size = "base", action }) {
  const heading = (
    <h2
      className={`${size === "lg" ? "text-2xl" : "text-xl"} font-semibold tracking-tight text-slate-900`}
    >
      {title}
    </h2>
  );
  return (
    <div className={size === "lg" ? "mb-2" : "mb-5"}>
      {action ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          {heading}
          <div className="shrink-0">{action}</div>
        </div>
      ) : (
        heading
      )}
      {description ? (
        <div className="mt-2 text-sm leading-6 text-slate-600">{description}</div>
      ) : null}
    </div>
  );
}
