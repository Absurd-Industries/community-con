export function isAdminEmail(email: string, adminEmails: string | undefined): boolean {
  if (!adminEmails) return false

  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) return false

  return adminEmails
    .split(/[,\n]/)
    .map(candidate => candidate.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalizedEmail)
}
