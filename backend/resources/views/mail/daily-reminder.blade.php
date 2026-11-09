<!doctype html>
<html lang="vi">
<body style="margin:0;padding:24px;background:#F7F9F8;font-family:'Be Vietnam Pro',system-ui,sans-serif;color:#14201F">
  <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #D9E2DF;border-radius:12px;padding:24px">
    <p style="font-size:16px;margin:0 0 12px">Chào {{ $user->name ?: 'bạn' }},</p>
    @if ($dueCount > 0)
      <p style="font-size:16px;margin:0 0 16px">Có <strong>{{ $dueCount }} từ</strong> đang chờ bạn ôn hôm nay. Chỉ cần vài phút là xong.</p>
    @else
      <p style="font-size:16px;margin:0 0 16px">Hôm nay bạn chưa ôn từ nào. Dành vài phút làm quen với từ mới nhé.</p>
    @endif
    <a href="{{ $reviewUrl }}" style="display:inline-block;background:#0F6E66;color:#FFFFFF;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Ôn ngay</a>
    <p style="font-size:13px;color:#56645F;margin:20px 0 0">Bạn có thể đổi giờ nhắc hoặc tắt email trong phần Cài đặt.</p>
  </div>
</body>
</html>
