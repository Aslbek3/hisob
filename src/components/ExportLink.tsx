/** Excel yuklab olish tugmasi. Oddiy havola — brauzer faylni o'zi yuklaydi. */
export function ExportLink({ href, label = "Excel", primary = false }: { href: string; label?: string; primary?: boolean }) {
  return (
    <a href={href} className={`btn ${primary ? "btn-primary" : ""}`} download>
      {label}
    </a>
  );
}
