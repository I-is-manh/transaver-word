<!doctype html>
<html lang="vi">
<body style="margin:0;padding:24px;background:#F7F9F8;font-family:'Be Vietnam Pro',system-ui,sans-serif;color:#14201F">
  <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #D9E2DF;border-radius:12px;padding:24px">
    <p style="font-size:13px;color:#56645F;margin:0 0 8px">Tuần {{ \Illuminate\Support\Carbon::parse($report['week_start'])->format('d/m') }} – {{ \Illuminate\Support\Carbon::parse($report['week_end'])->format('d/m') }}</p>
    <p style="font-size:18px;font-weight:600;margin:0 0 16px">
      @if ($report['newly_mastered'] > 0)
        Tuần này bạn thuộc thêm {{ $report['newly_mastered'] }} từ.
      @else
        Cảm ơn bạn đã dành thời gian học tuần này.
      @endif
    </p>
    <table style="width:100%;font-size:15px;border-collapse:collapse">
      <tr><td style="padding:6px 0">Số ngày học</td><td style="text-align:right;font-weight:600">{{ $report['days_active'] }}/7</td></tr>
      <tr><td style="padding:6px 0">Lượt ôn</td><td style="text-align:right;font-weight:600">{{ $report['reviews_count'] }}</td></tr>
      <tr><td style="padding:6px 0">Từ mới đã lưu</td><td style="text-align:right;font-weight:600">{{ $report['words_saved'] }}</td></tr>
      <tr><td style="padding:6px 0">Tổng số từ đã thuộc</td><td style="text-align:right;font-weight:600">{{ $report['mastered_total'] }}</td></tr>
      @if ($report['accuracy'] !== null)
        <tr><td style="padding:6px 0">Tỉ lệ nhớ đúng</td><td style="text-align:right;font-weight:600">{{ round($report['accuracy'] * 100) }}%</td></tr>
      @endif
    </table>
    <a href="{{ $statsUrl }}" style="display:inline-block;margin-top:20px;background:#0F6E66;color:#FFFFFF;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Xem chi tiết</a>
    <p style="font-size:13px;color:#56645F;margin:20px 0 0">Bạn có thể tắt báo cáo tuần trong phần Cài đặt.</p>
  </div>
</body>
</html>
