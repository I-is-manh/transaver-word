{{--
  Khung chung cho email Transaver Word. Bố cục bằng bảng + CSS inline để Gmail/Outlook hiển thị đúng.
  Biến: $preheader (dòng xem trước trong hộp thư), $footer (tùy chọn). Nội dung đặt ở @section('content').
  Logo được nhúng vào email (CID), vì Gmail không tải được ảnh từ localhost.
--}}
@php
    $logoPath = resource_path('mail/logo-mark.png');
    $logoSrc = isset($message)
        ? $message->embed($logoPath)
        : 'data:image/png;base64,'.base64_encode((string) file_get_contents($logoPath)); // xem trước khi render ngoài mailer
    $font = "'Be Vietnam Pro','Segoe UI',Roboto,Helvetica,Arial,sans-serif";
@endphp
<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Transaver Word</title>
</head>
<body style="margin:0;padding:0;background:#EEF3F1;-webkit-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#EEF3F1">{{ $preheader ?? '' }}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF3F1">
    <tr>
      <td align="center" style="padding:40px 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">

          {{-- Logo --}}
          <tr>
            <td align="center" style="padding:0 0 24px">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle">
                    <img src="{{ $logoSrc }}" width="32" height="32" alt="" style="display:block;border:0;width:32px;height:32px">
                  </td>
                  <td style="vertical-align:middle;font-family:{!! $font !!};font-size:20px;font-weight:700;letter-spacing:-0.2px;color:#14201F">
                    Transaver <span style="color:#0F6E66">Word</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          {{-- Thẻ nội dung --}}
          <tr>
            <td style="background:#FFFFFF;border:1px solid #D9E2DF;border-radius:16px;overflow:hidden">
              <div style="height:6px;background:#0F6E66;line-height:6px;font-size:0">&nbsp;</div>
              <div style="padding:36px 40px 40px;font-family:{!! $font !!};color:#14201F">
                @yield('content')
              </div>
            </td>
          </tr>

          {{-- Chân thư --}}
          <tr>
            <td align="center" style="padding:24px 24px 0;font-family:{!! $font !!};font-size:12px;line-height:18px;color:#56645F">
              @isset($footer)<p style="margin:0 0 8px">{{ $footer }}</p>@endisset
              <p style="margin:0;color:#7D8C88">Transaver Word · Lưu từ một chạm, ôn lại bằng chính câu bạn đã đọc.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
