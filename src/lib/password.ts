import bcrypt from "bcryptjs";

export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

let dummyHash: string | null = null;

/**
 * Mavjud bo'lmagan login uchun ham bcrypt ishlatiladi — shunda javob vaqtidan
 * "bunday login bor/yo'q"ni bilib bo'lmaydi.
 */
export function getDummyHash(): string {
  dummyHash ??= bcrypt.hashSync("dummy-password-for-timing", 10);
  return dummyHash;
}
