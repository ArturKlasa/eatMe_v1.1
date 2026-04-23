export function isAdmin(user: { app_metadata?: { role?: string } } | null | undefined): boolean {
  return user?.app_metadata?.role === 'admin';
}
