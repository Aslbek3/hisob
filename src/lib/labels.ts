import type { AccountType, CounterpartyKind, EntryKind, Role, SiteStatus } from "@prisma/client";

export const ROLE_LABEL: Record<Role, string> = {
  DIRECTOR: "Директор",
  ACCOUNTANT: "Ҳисобчи",
  FOREMAN: "Прораб",
};

export const KIND_LABEL: Record<EntryKind, string> = {
  INCOME: "Кирим",
  EXPENSE: "Харажат",
  TRANSFER: "Ўтказма",
  SUPPLIER_PAYMENT: "Етказиб берувчига тўлов",
  GOODS_RECEIPT: "Етказиб берувчи ҳисобидан",
};

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  BANK: "Банк (перечисления)",
  CASH: "Нахт касса",
  PERSONAL: "Шахсий",
};

export const SITE_STATUS_LABEL: Record<SiteStatus, string> = {
  ACTIVE: "Фаол",
  ARCHIVED: "Ёпилган",
};

export const COUNTERPARTY_KIND_LABEL: Record<CounterpartyKind, string> = {
  PAYER: "Пул берувчи (инвестор)",
  SUPPLIER: "Етказиб берувчи",
};
