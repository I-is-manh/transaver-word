@extends('mail.layout', [
    'preheader' => 'Bấm một nút để xác nhận email và bắt đầu học từ mới.',
    'footer' => 'Bạn nhận được email này vì địa chỉ này vừa được dùng để đăng ký Transaver Word. Nếu không phải bạn, hãy bỏ qua email: tài khoản sẽ không được xác nhận.',
])

@php
    // Chèn ký tự vô hình sau "@" để Gmail không tự biến email thành link xanh.
    $displayEmail = str_replace('@', '@&zwnj;', e($user->email));
@endphp

@section('content')
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:0 0 20px">
        <div style="width:64px;height:64px;border-radius:32px;background:#E3F3F0;text-align:center;line-height:64px;font-size:30px">&#9993;&#65039;</div>
      </td>
    </tr>
    <tr>
      <td align="center" style="font-size:24px;line-height:32px;font-weight:700;color:#14201F;padding:0 0 12px">
        Xác nhận email của bạn
      </td>
    </tr>
    <tr>
      <td align="center" style="font-size:15px;line-height:24px;color:#3A4744;padding:0 0 8px">
        Chào {{ $user->name ?: 'bạn' }}, cảm ơn bạn đã đăng ký Transaver Word.
      </td>
    </tr>
    <tr>
      <td align="center" style="font-size:15px;line-height:24px;color:#3A4744;padding:0 0 28px">
        Bấm nút dưới đây để xác nhận<br>
        <span style="display:inline-block;margin-top:6px;padding:4px 12px;border-radius:999px;background:#F2F6F5;color:#14201F;font-weight:600;text-decoration:none">{!! $displayEmail !!}</span>
      </td>
    </tr>

    {{-- Nút bấm dạng bảng: hiển thị đúng cả trên Outlook --}}
    <tr>
      <td align="center" style="padding:0 0 28px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" bgcolor="#0F6E66" style="border-radius:12px;background:#0F6E66">
              <a href="{{ $verifyUrl }}" target="_blank"
                 style="display:inline-block;padding:15px 40px;font-size:16px;line-height:20px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:12px">
                Xác nhận email
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td align="center" style="border-top:1px solid #E6ECEA;padding:20px 0 0;font-size:13px;line-height:20px;color:#56645F">
        &#9203; Nút có hiệu lực trong <strong style="color:#14201F">{{ $expireHours }} giờ</strong>.
        Hết hạn thì đăng nhập và bấm <strong style="color:#14201F">Gửi lại email</strong>.
      </td>
    </tr>
  </table>
@endsection
