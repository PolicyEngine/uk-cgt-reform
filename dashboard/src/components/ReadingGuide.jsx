"use client";

import { useEffect, useState } from "react";

export default function ReadingGuide({ sections }) {
  const [active, setActive] = useState(sections[0]?.id);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries.find((entry) => entry.isIntersecting);
        if (first) setActive(first.target.id);
      },
      { rootMargin: "-120px 0px -55% 0px" },
    );
    sections.forEach(({ id }) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, [sections]);
  return (
    <nav className="reading-guide" aria-label="On this tab">
      <p className="eyebrow">On this tab</p>
      {sections.map(({ id, label }, index) => (
        <a
          key={id}
          href={`#${id}`}
          onClick={() => {
            const target = document.getElementById(id);
            if (target?.tagName === "DETAILS") target.open = true;
          }}
          aria-current={active === id ? "location" : undefined}
        >
          <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          {label}
        </a>
      ))}
    </nav>
  );
}

export function ReadingLayout({ sections, children }) {
  return (
    <div className="reading-layout">
      <div className="reading-content">{children}</div>
      <ReadingGuide sections={sections} />
    </div>
  );
}
