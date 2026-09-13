import type { AccountType, EntryKind, Role, SiteStatus } from "@prisma/client";

export const ROLE_LABEL: Record<Role, string> = {
  DIRECTOR: "Direktor",
  ACCOUNTANT: "Buxgalter",
  FOREMAN: "Prorab",
};

export const KIND_LABEL: Record<EntryKind, string> = {
  INCOME: "Kirim",
  EXPENSE: "Chiqim",
  TRANSFER: "O'tkazma",
};

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  BANK: "Bank",
  CASH: "Naqd kassa",
  PERSONAL: "Shaxsiy",
};

export const SITE_STATUS_LABEL: Record<SiteStatus, string> = {
  ACTIVE: "Faol",
  ARCHIVED: "Arxivda",
};
