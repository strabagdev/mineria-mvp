import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

const USER_AVATAR_TONE_COUNT = 7;

function normalizeInitialSource(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function resolveUserInitials(name?: string | null, email?: string | null) {
  const normalizedName = normalizeInitialSource(name ?? "");
  const nameParts = normalizedName.split(/\s+/).filter(Boolean);

  if (nameParts.length >= 2) {
    return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
  }

  if (nameParts.length === 1) {
    return nameParts[0].slice(0, 2).toUpperCase();
  }

  const normalizedEmail = normalizeInitialSource(email ?? "");
  const emailName = normalizedEmail.split("@")[0] ?? "";
  const emailParts = emailName.split(/[._-]+/).filter(Boolean);

  if (emailParts.length >= 2) {
    return `${emailParts[0][0]}${emailParts[1][0]}`.toUpperCase();
  }

  return (emailName.slice(0, 2) || "?").toUpperCase();
}

function hashUserAvatarSeed(seed: string) {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return hash;
}

type PageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <header className="opcl-page-header">
      <div className="opcl-page-header-copy">
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="opcl-page-header-action">{action}</div> : null}
    </header>
  );
}

type PanelProps = HTMLAttributes<HTMLElement> & {
  as?: "article" | "aside" | "section";
};

export function Panel({ as: Comp = "article", className = "", ...props }: PanelProps) {
  return <Comp className={`opcl-panel ${className}`.trim()} {...props} />;
}

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  meta?: ReactNode;
};

export function SectionHeader({ eyebrow, title, meta }: SectionHeaderProps) {
  return (
    <div className="opcl-section-header">
      <div>
        {eyebrow ? <p className="opcl-eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      {meta ? <div className="opcl-section-meta">{meta}</div> : null}
    </div>
  );
}

type StatusBadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "total"
  | "partial";

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: StatusBadgeTone;
}) {
  return <span className={`opcl-status-badge ${tone}`}>{children}</span>;
}

type EmptyStateProps = {
  children: ReactNode;
};

export function EmptyState({ children }: EmptyStateProps) {
  return <p className="opcl-empty-state">{children}</p>;
}

type ActionProps = ButtonHTMLAttributes<HTMLButtonElement>;

function actionClass(base: string, className?: string) {
  return `${base}${className ? ` ${className}` : ""}`;
}

export function PrimaryAction({ className, ...props }: ActionProps) {
  return <button className={actionClass("opcl-action primary", className)} {...props} />;
}

export function SecondaryAction({ className, ...props }: ActionProps) {
  return <button className={actionClass("opcl-action secondary", className)} {...props} />;
}

export function DangerAction({ className, ...props }: ActionProps) {
  return <button className={actionClass("opcl-action danger", className)} {...props} />;
}

type CompactRowProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
};

export function CompactRow({ selected = false, className = "", ...props }: CompactRowProps) {
  return (
    <button
      className={`opcl-compact-row ${selected ? "selected" : ""} ${className}`.trim()}
      {...props}
    />
  );
}

type UserAvatarProps = {
  name?: string | null;
  email?: string | null;
  userId?: string | null;
  size?: "compact" | "detail";
};

export function UserAvatar({ name, email, userId, size = "compact" }: UserAvatarProps) {
  const seed = userId || email || name || "";
  const tone = hashUserAvatarSeed(seed) % USER_AVATAR_TONE_COUNT;

  return (
    <span
      className={`opcl-user-avatar ${size}`}
      data-tone={tone}
      aria-hidden="true"
    >
      {resolveUserInitials(name, email)}
    </span>
  );
}
