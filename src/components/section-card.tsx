import type { ReactNode } from "react";

export function SectionCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="surface-card padded">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2 className="card-title" style={{ marginTop: eyebrow ? 12 : 0 }}>
        {title}
      </h2>
      <div style={{ marginTop: 14 }}>{children}</div>
    </article>
  );
}
