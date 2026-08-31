export function parseAllowedOrigins(configuredOrigins: string): string[] {
  return configuredOrigins
    .split(/[,\n]/)
    .map(origin => origin.trim())
    .filter(Boolean)
}
