const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Email o contraseña incorrectos.",
  user_already_exists: "No se pudo completar el registro.",
  weak_password: "La contraseña no cumple los requisitos mínimos.",
};

const DEFAULT_MESSAGE = "Ocurrió un error, intentá de nuevo.";

export function mapAuthError(error: { code?: string } | null): string {
  const code = error?.code;
  if (code && code in AUTH_ERROR_MESSAGES) return AUTH_ERROR_MESSAGES[code];
  return DEFAULT_MESSAGE;
}
