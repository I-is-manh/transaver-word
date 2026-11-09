import { useMutation, useQueryClient } from '@tanstack/react-query';
import { wordsApi } from '@/api/words';
import type { Word } from '@/api/types';
import { useToast } from '@/components/toastContext';
import { qk } from '@/lib/queryKeys';

/** Hành động trên một từ, kèm toast "Hoàn tác" khi xóa. */
export function useWordActions() {
  const qc = useQueryClient();
  const toast = useToast();

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.words });
    void qc.invalidateQueries({ queryKey: qk.stats });
    void qc.invalidateQueries({ queryKey: qk.decks });
  };

  const onError = (err: unknown) =>
    toast.show({ tone: 'error', message: err instanceof Error ? err.message : 'Có lỗi xảy ra.' });

  const setStatus = useMutation({
    mutationFn: ({ word, status }: { word: Word; status: Word['status'] }) =>
      wordsApi.update(word.id, { status }),
    onSuccess: ({ word }) => {
      refresh();
      toast.show({
        tone: 'success',
        message:
          word.status === 'known'
            ? `Đã đánh dấu "${word.text}" là đã biết. Từ này không còn trong lịch ôn.`
            : `"${word.text}" đã quay lại lịch ôn.`,
      });
    },
    onError,
  });

  const restore = useMutation({
    mutationFn: (id: number) => wordsApi.restore(id),
    onSuccess: refresh,
    onError,
  });

  const remove = useMutation({
    mutationFn: (word: Word) => wordsApi.remove(word.id).then(() => word),
    onSuccess: (word) => {
      refresh();
      toast.show({
        message: `Đã chuyển "${word.text}" vào thùng rác.`,
        action: { label: 'Hoàn tác', onClick: () => restore.mutate(word.id) },
      });
    },
    onError,
  });

  return { setStatus, remove, restore, refresh };
}
