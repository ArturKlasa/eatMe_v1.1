'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/browser';

interface Props {
  userId: string;
}

/**
 * Subscribes to the per-user broadcast channel so that publishing in one tab
 * causes all other open tabs to refresh automatically (cross-tab consistency).
 */
export function RealtimeStatusListener({ userId }: Props) {
  const router = useRouter();

  useEffect(() => {
    const channel = supabase
      .channel(`user-${userId}`)
      .on('broadcast', { event: 'restaurant.published' }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, router]);

  return null;
}
