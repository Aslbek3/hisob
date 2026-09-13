import type { Role } from "@prisma/client";

export type SessionUser = {
  id: number;
  name: string;
  role: Role;
  /** Prorab uchun biriktirilgan ob'ektlar; boshqa rollarda bo'sh (hammasi ochiq). */
  siteIds: number[];
};
