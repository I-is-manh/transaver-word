Chào {{ $user->name ?: 'bạn' }},

@if ($dueCount > 0)
Có {{ $dueCount }} từ đang chờ bạn ôn hôm nay. Chỉ cần vài phút là xong.
@else
Hôm nay bạn chưa ôn từ nào. Dành vài phút làm quen với từ mới nhé.
@endif

Ôn ngay: {{ $reviewUrl }}

Bạn có thể đổi giờ nhắc hoặc tắt email trong phần Cài đặt.
