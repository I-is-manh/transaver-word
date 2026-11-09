Tuần {{ $report['week_start'] }} – {{ $report['week_end'] }}

@if ($report['newly_mastered'] > 0)
Tuần này bạn thuộc thêm {{ $report['newly_mastered'] }} từ.
@else
Cảm ơn bạn đã dành thời gian học tuần này.
@endif

- Số ngày học: {{ $report['days_active'] }}/7
- Lượt ôn: {{ $report['reviews_count'] }}
- Từ mới đã lưu: {{ $report['words_saved'] }}
- Tổng số từ đã thuộc: {{ $report['mastered_total'] }}
@if ($report['accuracy'] !== null)
- Tỉ lệ nhớ đúng: {{ round($report['accuracy'] * 100) }}%
@endif

Xem chi tiết: {{ $statsUrl }}

Bạn có thể tắt báo cáo tuần trong phần Cài đặt.
