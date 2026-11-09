<?php

// Câu mặc định cho lỗi HTTP khi code không đặt câu riêng.

return [
    '400' => 'Yêu cầu không hợp lệ.',
    '401' => 'Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.',
    '403' => 'Bạn không có quyền thực hiện thao tác này.',
    '404' => 'Không tìm thấy.',
    '405' => 'Phương thức không được hỗ trợ.',
    '409' => 'Thao tác bị xung đột với dữ liệu hiện tại.',
    '413' => 'Dữ liệu gửi lên quá lớn.',
    '419' => 'Phiên làm việc đã hết hạn.',
    '429' => 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
    '500' => 'Có lỗi xảy ra ở máy chủ. Vui lòng thử lại sau.',
    '503' => 'Hệ thống đang bảo trì. Vui lòng thử lại sau.',
    'default' => 'Có lỗi xảy ra. Vui lòng thử lại sau.',
];
