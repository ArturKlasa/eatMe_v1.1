import 'server-only';

export async function logAdminAction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  ctx: { adminId: string; adminEmail: string },
  action: string,
  resourceType: string,
  resourceId: string,
  oldData?: Record<string, unknown> | null,
  newData?: Record<string, unknown> | null
): Promise<void> {
  await supabase.from('admin_audit_log').insert({
    admin_id: ctx.adminId,
    admin_email: ctx.adminEmail,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    old_data: oldData ?? null,
    new_data: newData ?? null,
  });
}
