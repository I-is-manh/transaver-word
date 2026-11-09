Chào {{ $user->name ?: 'bạn' }},

Cảm ơn bạn đã đăng ký Transaver Word. Mở đường dẫn dưới đây để xác nhận {{ $user->email }} là email của bạn:

{{ $verifyUrl }}

Đường dẫn có hiệu lực trong {{ $expireHours }} giờ. Nếu bạn không đăng ký tài khoản này, hãy bỏ qua email.
