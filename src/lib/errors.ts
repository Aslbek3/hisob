/**
 * Servis qatlami xatosi — foydalanuvchiga ko'rsatiladigan xabar bilan.
 * API route uni tutib, `status` bilan JSON qilib qaytaradi (lib/api.ts).
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export const forbidden = (message = "Бу амал учун рухсат йўқ") => new ServiceError(message, 403, "FORBIDDEN");
export const notFound = (message = "Топилмади") => new ServiceError(message, 404, "NOT_FOUND");
