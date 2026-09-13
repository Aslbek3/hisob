import Link from "next/link";

/** Sahifa sarlavhasi: nom, ixtiyoriy orqaga havola va o'ng tomonda amallar. */
export function PageHeader({
  title,
  back,
  subtitle,
  actions,
}: {
  title: React.ReactNode;
  back?: { href: string; label: string };
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-4">
      {back && (
        <Link href={back.href} className="link text-[13px]">
          ← {back.label}
        </Link>
      )}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[18px] font-semibold leading-tight">{title}</h1>
          {subtitle && <div className="text-ink-3 mt-0.5">{subtitle}</div>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
