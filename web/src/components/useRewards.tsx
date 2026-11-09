import { useCallback } from 'react';
import type { Achievement } from '@/api/types';
import { Icon } from './Icon';
import { useToast } from './toastContext';

/** Hiện thông báo khi đạt huy hiệu mới (mục 8.1). */
export function useRewards() {
  const toast = useToast();
  return useCallback(
    (list: Achievement[] | undefined) => {
      for (const a of list ?? []) {
        toast.show({
          tone: 'reward',
          title: `Huy hiệu mới: ${a.name}`,
          message: a.xp_reward ? `${a.description} · +${a.xp_reward} XP` : a.description,
          icon: <Icon name={a.icon} size={28} />,
          duration: 6000,
        });
      }
    },
    [toast],
  );
}
