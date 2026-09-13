/** Excel yuklab olish tugmasi. Oddiy havola — brauzer faylni o'zi yuklaydi. */
export function ExportLink({ href }: { href: string }) {
  return (
    <a href={href} className="btn" download>
      Excel
    </a>
  );
}
