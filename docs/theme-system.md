# Transaver Word: Hệ thống theme (đặc tả thiết kế)

> **Trạng thái: đã thiết kế, CHƯA dev.** Tài liệu này đủ chi tiết để lập trình viên (hoặc Claude ở phiên sau) dev hệ thống theme cho cả web app và extension mà không cần hỏi lại.
>
> Ngày soạn: 08/11/2026 · Liên quan: [final-decision-features.md](final-decision-features.md) (mục "Đổi điểm lấy theme, Premium" đang ở nhóm **Để sau**), [database-design.md](database-design.md), [brand/tokens.json](../brand/tokens.json)
>
> Xem trực quan: mở [theme-preview.html](theme-preview.html) bằng trình duyệt. Mở thẳng một theme: `theme-preview.html#theme=autumn&mode=light&demo=flip` (`demo` = `flip` | `correct` | `wrong` | `complete` | `streak`). Giả lập ngày để xem theme dịp tự bật: `theme-preview.html#date=2026-10-30`.

---

## Mục lục

0. [Đọc nhanh cho người dev](#0-đọc-nhanh-cho-người-dev)
1. [Nguyên tắc thiết kế](#1-nguyên-tắc-thiết-kế)
2. [Danh sách theme](#2-danh-sách-theme)
3. [Màu sắc](#3-màu-sắc)
4. [Chuyển động: quy tắc chung](#4-chuyển-động-quy-tắc-chung)
5. [Đặc tả hiệu ứng của từng bộ](#5-đặc-tả-hiệu-ứng-của-từng-bộ)
6. [Đồng bộ web app và extension](#6-đồng-bộ-web-app-và-extension)
7. [Theme theo dịp: tự áp dụng cho toàn hệ thống](#7-theme-theo-dịp-tự-áp-dụng-cho-toàn-hệ-thống)
8. [Mở khóa: điểm streak và mua](#8-mở-khóa-điểm-streak-và-mua)
9. [Database và API](#9-database-và-api)
10. [Hợp đồng HTML / CSS / JS](#10-hợp-đồng-html--css--js)
11. [Các file trong repo](#11-các-file-trong-repo)
12. [Cách thêm một theme mới](#12-cách-thêm-một-theme-mới)
13. [Checklist dev và tiêu chí nghiệm thu](#13-checklist-dev-và-tiêu-chí-nghiệm-thu)
14. [Việc còn mở](#14-việc-còn-mở)

---

## 0. Đọc nhanh cho người dev

- Có **15 theme**:
  - 3 miễn phí: `teal` (mặc định), `sea`, `mist`.
  - 7 mở khóa: `starry`, `autumn`, `ocean`, `sakura`, `firefly`, `grid`, `map`.
  - 5 theo dịp, **tự bật cho toàn hệ thống** trong thời gian của dịp: `tet`, `mid-autumn`, `halloween`, `teachers-day`, `christmas` (mục 7).
- Mỗi theme = **bộ màu** (18 token × sáng/tối) + **bộ hiệu ứng** (8 khoảnh khắc). 3 theme miễn phí dùng chung bộ hiệu ứng `basic`.
- **Nguồn dữ liệu gốc** là [brand/themes/themes.json](../brand/themes/themes.json). Không sửa tay `themes.css` và `themes.meta.js`: chạy `python3 brand/themes/build_themes.py` để kiểm tra độ tương phản và sinh lại.
- `effects.css`, `effects.js` và `theme-preview.html` là **bản mẫu thiết kế** (prototype) chạy được, dùng để xem và làm tham chiếu. Khi dev có thể dùng lại logic, nhưng phải đưa vào kiến trúc thật của web app và extension, và rà lại theo checklist ở mục 13.
- Thứ tự làm đề xuất: (1) màu + chọn theme miễn phí, đồng bộ web ↔ extension; (2) hiệu ứng `basic`; (3) theme theo dịp tự áp dụng (không phụ thuộc hệ thống điểm, làm được sớm); (4) hệ thống điểm và mở khóa; (5) hiệu ứng riêng của các theme mở khóa.
- Chức năng này phụ thuộc **streak** (MVP) và **hệ thống điểm** (chưa có). Theo file quyết định, nó nằm ở nhóm "Để sau".

---

## 1. Nguyên tắc thiết kế

1. **Đây là app học tập.** Hiệu ứng phải nhẹ nhàng, ngắn, có lý do. Mỗi theme gắn với một hình ảnh học tập (cột "Gắn với việc học" ở mục 2). Hiệu ứng là phần thưởng cho việc nhớ đúng, không phải trang trí liên tục.
2. **Không làm phân tâm khi đang nghĩ.** Trong lúc người dùng đang nhìn câu hỏi hoặc gõ đáp án: không có chuyển động nào trên thẻ, không có nền động. Hiệu ứng chỉ chạy **sau** một hành động (lật thẻ, trả lời, lưu, xong buổi).
3. **Ưu tiên chế độ sáng.** Mọi theme thiết kế cho chế độ sáng trước. Chế độ tối là bản đi kèm, cùng nhận diện. App mặc định theo hệ điều hành, nhưng ảnh minh họa, trang giới thiệu và ảnh chụp cửa hàng dùng bản sáng.
4. **Đồng bộ web và extension.** Cùng một nguồn màu, cùng lựa chọn theme của người dùng (mục 6).
5. **Theme đổi cảm giác, không đổi cách dùng.** Bố cục, vị trí nút, hình dạng nút, thứ tự thao tác giữ nguyên ở mọi theme.
6. **Màu mang ý nghĩa giữ cố định:** vàng hoa cúc cho phần thưởng và streak (`accent*`), đỏ cho "Quên" và lỗi (`danger`). Chỉ `info` (nút "Dễ") được đổi khi trùng tông với màu chủ đạo.
7. **Đọc rõ trước, đẹp sau.** Mọi cặp chữ/nền đạt ngưỡng tương phản ở mục 3.3, kiểm tra tự động bằng script.
8. **Tôn trọng "giảm chuyển động".** Khi hệ điều hành bật `prefers-reduced-motion` hoặc người dùng tắt hiệu ứng trong Cài đặt: không hạt, không nền động, lật thẻ chuyển tức thì. Màu theme vẫn giữ.
9. **Tự làm, không dùng tài nguyên ngoài.** Hình vẽ bằng SVG và Canvas tự viết, font từ Google Fonts giấy phép OFL. Không sao chép theme hay hiệu ứng của app khác.

---

## 2. Danh sách theme

| ID | Tên | Nhóm | Ý tưởng | Gắn với việc học | Bộ hiệu ứng |
|---|---|---|---|---|---|
| `teal` | Teal Mực | Miễn phí, **mặc định** | Bộ màu brand gốc: mực xanh trên trang vở trắng | Cuốn vở và cây bút mực: gọn gàng, tập trung | `basic` |
| `sea` | Biển Đêm | Miễn phí | Xanh dương sâu trên nền giấy sáng, dịu mắt | Bàn học cạnh cửa sổ nhìn ra biển: bình tĩnh, tập trung lâu | `basic` |
| `mist` | Sương Sớm | Miễn phí | Xám than trung tính, tối giản, ít màu nhất | Buổi học sáng sớm: yên tĩnh, không gì làm xao nhãng | `basic` |
| `starry` | Đêm Sao | Mở khóa | Nền giấy tím oải hương nhạt với sao nhỏ; bản tối là bầu trời đêm | Mỗi từ thuộc là một ngôi sao, thanh tiến độ là chòm sao kiến thức nối dần | `starry` |
| `autumn` | Mùa Thu | Mở khóa | Nâu hạt dẻ trên nền giấy ngà, lá phong, trang sách | Đọc sách mùa thu: thẻ lật như trang sách, tiến độ là cành cây ra lá | `autumn` |
| `ocean` | Đại Dương | Mở khóa | Xanh lam ngọc trên nền trắng như nước trong | Học sâu như lặn sâu: mỗi từ thuộc là một bọt nước nổi lên | `ocean` |
| `sakura` | Anh Đào | Mở khóa | Hồng mận trên nền giấy trắng hồng, cánh hoa nhẹ | Mùa xuân của khởi đầu mới: mỗi buổi ôn là một bông hoa nở | `sakura` |
| `firefly` | Đom Đóm | Mở khóa | Xanh rêu trên nền giấy xanh nhạt, ánh vàng ấm như đèn bàn; bản tối là rừng đêm | Ngọn đèn học buổi tối: mỗi từ thuộc là một đốm sáng | `firefly` |
| `grid` | Giấy Kẻ Ô | Mở khóa | Nền giấy vở ô ly trắng, nét mực tím quen thuộc của học trò | Cuốn vở ô ly: đúng thì được đánh dấu tích, xong buổi được đóng dấu điểm 10, mốc streak được dán sao như cô giáo khen | `grid` |
| `map` | Bản Đồ Cổ | Mở khóa | Giấy da cũ, mực xanh lục, la bàn và đường đi nét đứt | Hành trình khám phá từ mới: tiến độ là con đường trên bản đồ, xong buổi là tìm thấy rương báu | `map` |
| `tet` | Tết Nguyên Đán | **Theo dịp** | **Đỏ** phong bao lì xì và **vàng** may mắn, hoa mai, hoa đào | Năm mới học từ mới: mỗi từ thuộc là một bông mai nở, mốc streak là một phong bao lì xì | `tet` |
| `mid-autumn` | Trung Thu | **Theo dịp** | **Cam đỏ** đèn lồng, **vàng** trăng rằm, xanh chàm đêm | Rước đèn học bài: mỗi từ thuộc thắp thêm một chiếc đèn lồng | `midautumn` |
| `halloween` | Halloween | **Theo dịp** | **Cam** bí ngô, tím, nền đêm đen tím; dễ thương chứ không đáng sợ | Học xong mỗi từ như nhận thêm một viên kẹo | `halloween` |
| `teachers-day` | Ngày Nhà giáo | **Theo dịp** | Xanh bảng lớp, phấn trắng, hoa tặng thầy cô | Tri ân thầy cô: mỗi từ thuộc là một bông hoa trong bó hoa 20/11 | `teachers` |
| `christmas` | Giáng Sinh | **Theo dịp** | **Đỏ** Giáng sinh, **xanh lá thông**, vàng ánh sao, tuyết trắng | Mỗi buổi ôn là một món quà gửi cho chính mình | `christmas` |

---

## 3. Màu sắc

### 3.1. 18 token màu

Mọi theme định nghĩa đủ các token sau (ý nghĩa lấy từ [brand/tokens.json](../brand/tokens.json)). Code chỉ dùng token, **không bao giờ viết mã màu trực tiếp** trong component.

| Token | Dùng cho |
|---|---|
| `brand` | Màu chủ đạo: nút chính, link, trạng thái đang chọn, vòng focus, thanh tiến độ |
| `brand-strong` | Hover/pressed của nút chính, chữ nhấn trên `brand-tint` |
| `brand-tint` | Nền nhạt: thẻ đang chọn, nút "Được", nền thanh tiến độ |
| `on-brand` | Chữ/icon trên nền `brand` |
| `accent` | **Cố định.** Vàng hoa cúc: streak, XP, vệt highlight từ trong câu. Chỉ làm nền, không làm chữ trên nền sáng |
| `accent-strong` | **Cố định.** Chữ mang màu phần thưởng ("+12 XP") |
| `accent-tint` | **Cố định.** Nền chip XP, highlight mềm của từ trong câu ngữ cảnh |
| `on-accent` | **Cố định.** Chữ trên nền `accent` |
| `ink` | Chữ chính, tiêu đề |
| `ink-muted` | Chữ phụ: phiên âm, nguồn trang, chú thích |
| `surface-0` | Nền trang, nền popup extension |
| `surface-1` | Nền nâng: thẻ, khung dịch, menu |
| `line` | Đường kẻ trang trí, viền thẻ |
| `line-strong` | Viền ô nhập, checkbox |
| `danger` | **Cố định.** Nút "Quên", lỗi, xóa |
| `on-danger` | Chữ trên `danger` (sinh tự động: trắng ở sáng, `surface-0` ở tối) |
| `info` | Nút "Dễ". Phải lệch màu chủ đạo ≥ 30° sắc độ |
| `on-info` | Chữ trên `info` (sinh tự động như `on-danger`) |
| `again-bg`, `again-fg`, `again-border` | **Nút "Quên"** (sinh tự động). Mặc định nền `danger` đặc, chữ `on-danger`. Khi màu chủ đạo lệch màu đỏ < 25° sắc độ (Tết, Giáng sinh, Halloween, Trung thu, Mùa Thu) thì chuyển sang **kiểu viền**: nền `surface-1`, chữ và viền `danger`, để không lẫn với nút chính màu đỏ/cam |

**Giá trị cố định** (mọi theme):

| Token | Sáng | Tối |
|---|---|---|
| `accent` | `#F2A516` | `#F7B73A` |
| `accent-strong` | `#8A5A00` | `#F7B73A` |
| `accent-tint` | `#FDF1D6` | `#3A2E10` |
| `on-accent` | `#1D1A10` | `#1D1A10` |
| `danger` | `#B42318` | `#F97066` |

### 3.2. Bảng màu từng theme

Bảng dưới sinh từ `themes.json` ngày 08/11/2026. Nếu khác với `themes.json` thì **`themes.json` đúng**.

#### Teal Mực (`teal`) · Miễn phí · mặc định

| Token | Sáng | Tối |
|---|---|---|
| `brand` | `#0F6E66` | `#3CC4B4` |
| `brand-strong` | `#0B5650` | `#6BD9CB` |
| `brand-tint` | `#E3F3F0` | `#12302D` |
| `on-brand` | `#FFFFFF` | `#0E1514` |
| `ink` | `#14201F` | `#E8EFEE` |
| `ink-muted` | `#56645F` | `#9AAAA6` |
| `surface-0` | `#F7F9F8` | `#0E1514` |
| `surface-1` | `#FFFFFF` | `#162120` |
| `line` | `#D9E2DF` | `#2A3836` |
| `line-strong` | `#7D8C88` | `#5F716D` |
| `info` | `#2F5BD3` | `#8AA8F5` |

#### Biển Đêm (`sea`) · Miễn phí

| Token | Sáng | Tối |
|---|---|---|
| `brand` | `#1D4E9E` | `#7FA8F5` |
| `brand-strong` | `#163C7A` | `#A9C4FA` |
| `brand-tint` | `#E6EEFA` | `#16233D` |
| `on-brand` | `#FFFFFF` | `#0B1220` |
| `ink` | `#121A2B` | `#E7ECF5` |
| `ink-muted` | `#4F5B70` | `#9AA6BA` |
| `surface-0` | `#F6F8FB` | `#0B1220` |
| `surface-1` | `#FFFFFF` | `#131C2E` |
| `line` | `#D8DFEA` | `#263247` |
| `line-strong` | `#7A869A` | `#5C6A82` |
| `info` | `#0F6E66` | `#3CC4B4` |

#### Sương Sớm (`mist`) · Miễn phí

| Token | Sáng | Tối |
|---|---|---|
| `brand` | `#34495E` | `#B8C7D6` |
| `brand-strong` | `#22313F` | `#D9E3EC` |
| `brand-tint` | `#E9EEF2` | `#232B33` |
| `on-brand` | `#FFFFFF` | `#111518` |
| `ink` | `#1A1F24` | `#E9ECEF` |
| `ink-muted` | `#565F68` | `#A0A9B2` |
| `surface-0` | `#F5F6F7` | `#111417` |
| `surface-1` | `#FFFFFF` | `#1A1E22` |
| `line` | `#DDE1E5` | `#2C3238` |
| `line-strong` | `#7B848D` | `#626B74` |
| `info` | `#0F6E66` | `#3CC4B4` |

#### Đêm Sao (`starry`) · Mở khóa

| Token | Sáng | Tối |
|---|---|---|
| `brand` | `#4B3BA8` | `#A99BFF` |
| `brand-strong` | `#3A2D85` | `#CBC2FF` |
| `brand-tint` | `#EEEBFA` | `#221D40` |
| `on-brand` | `#FFFFFF` | `#0E0B1E` |
| `ink` | `#1B1730` | `#ECEAF7` |
| `ink-muted` | `#575270` | `#A6A1C0` |
| `surface-0` | `#F7F6FB` | `#0D0B1A` |
| `surface-1` | `#FFFFFF` | `#171429` |
| `line` | `#DEDAEC` | `#2C2745` |
| `line-strong` | `#827C99` | `#655F85` |
| `info` | `#0F6E66` | `#3CC4B4` |

#### Mùa Thu (`autumn`) · Mở khóa

| Token | Sáng | Tối |
|---|---|---|
| `brand` | `#8A4B22` | `#E0A27A` |
| `brand-strong` | `#6B3818` | `#F0C3A3` |
| `brand-tint` | `#F6ECE3` | `#3A261A` |
| `on-brand` | `#FFFFFF` | `#1A110B` |
| `ink` | `#24180F` | `#F2EAE3` |
| `ink-muted` | `#66574A` | `#B5A497` |
| `surface-0` | `#F8F5F1` | `#15100C` |
| `surface-1` | `#FFFFFF` | `#1F1812` |
| `line` | `#E6DCD1` | `#36291F` |
| `line-strong` | `#8C7E71` | `#7B6857` |
| `info` | `#2F5BD3` | `#8AA8F5` |

#### Đại Dương (`ocean`) · Mở khóa

| Token | Sáng | Tối |
|---|---|---|
| `brand` | `#0A6683` | `#4CC9E0` |
| `brand-strong` | `#084F66` | `#8BDDED` |
| `brand-tint` | `#E2F2F7` | `#0F2E36` |
| `on-brand` | `#FFFFFF` | `#06161B` |
| `ink` | `#0F1E24` | `#E4F1F4` |
| `ink-muted` | `#4C5F66` | `#96AEB5` |
| `surface-0` | `#F4F9FA` | `#07161B` |
| `surface-1` | `#FFFFFF` | `#0E2128` |
| `line` | `#D3E3E8` | `#1D3740` |
| `line-strong` | `#758C94` | `#557079` |
| `info` | `#5B3FC4` | `#B3A3FF` |

#### Anh Đào (`sakura`) · Mở khóa

| Token | Sáng | Tối |
|---|---|---|
| `brand` | `#A33A6E` | `#F29AC4` |
| `brand-strong` | `#812C57` | `#F8C2DB` |
| `brand-tint` | `#FBEAF2` | `#3B1A2A` |
| `on-brand` | `#FFFFFF` | `#1D0B14` |
| `ink` | `#26131C` | `#F7EAF0` |
| `ink-muted` | `#6A5260` | `#C0A3B1` |
| `surface-0` | `#FCF7F9` | `#170C12` |
| `surface-1` | `#FFFFFF` | `#24141C` |
| `line` | `#EEDCE5` | `#3D2631` |
| `line-strong` | `#8F7884` | `#7B616D` |
| `info` | `#2F5BD3` | `#8AA8F5` |

#### Đom Đóm (`firefly`) · Mở khóa

| Token | Sáng | Tối |
|---|---|---|
| `brand` | `#48651C` | `#C4E36A` |
| `brand-strong` | `#384F15` | `#DCF09F` |
| `brand-tint` | `#EDF3E2` | `#26300F` |
| `on-brand` | `#FFFFFF` | `#10160A` |
| `ink` | `#182012` | `#EAF0E1` |
| `ink-muted` | `#56604B` | `#A3AD95` |
| `surface-0` | `#F7F9F3` | `#0C1109` |
| `surface-1` | `#FFFFFF` | `#151C10` |
| `line` | `#DDE4D2` | `#283222` |
| `line-strong` | `#7D8770` | `#616D56` |
| `info` | `#2F5BD3` | `#8AA8F5` |

#### Giấy Kẻ Ô (`grid`) · Mở khóa

| Token | Sáng | Tối |
|---|---|---|
| `brand` | `#6A2C91` | `#CFA3EE` |
| `brand-strong` | `#522270` | `#E3C8F6` |
| `brand-tint` | `#F3EAF8` | `#2D1B3A` |
| `on-brand` | `#FFFFFF` | `#120E1C` |
| `ink` | `#1C1830` | `#ECEAF5` |
| `ink-muted` | `#58546B` | `#A7A2BD` |
| `surface-0` | `#F8F8FB` | `#121019` |
| `surface-1` | `#FFFFFF` | `#1B1826` |
| `line` | `#DCDDEA` | `#2D2940` |
| `line-strong` | `#7E7C94` | `#6B6684` |
| `info` | `#0F6E66` | `#3CC4B4` |

#### Bản Đồ Cổ (`map`) · Mở khóa

| Token | Sáng | Tối |
|---|---|---|
| `brand` | `#2E6B3E` | `#8FCB98` |
| `brand-strong` | `#23532F` | `#B6E0BC` |
| `brand-tint` | `#E6F0E5` | `#1E2E20` |
| `on-brand` | `#FFFFFF` | `#0F1510` |
| `ink` | `#241D14` | `#EFE8DA` |
| `ink-muted` | `#5E5343` | `#B3A893` |
| `surface-0` | `#F7F1E6` | `#16130D` |
| `surface-1` | `#FFFCF6` | `#201B13` |
| `line` | `#E3D7C3` | `#362E22` |
| `line-strong` | `#8A7C66` | `#7B6E55` |
| `info` | `#2F5BD3` | `#8AA8F5` |

#### Halloween (`halloween`) · Theo dịp

| Token | Sáng | Tối |
|---|---|---|
| `brand` | `#A63A0B` | `#FB9B5B` |
| `brand-strong` | `#822D08` | `#FDC09A` |
| `brand-tint` | `#FCEEE6` | `#3A2216` |
| `on-brand` | `#FFFFFF` | `#170B04` |
| `ink` | `#1E1528` | `#F1EBF5` |
| `ink-muted` | `#5C5068` | `#ADA0BC` |
| `surface-0` | `#FBF8F6` | `#120D17` |
| `surface-1` | `#FFFFFF` | `#1B1522` |
| `line` | `#EADFD8` | `#2F2738` |
| `line-strong` | `#85797A` | `#6C6084` |
| `info` | `#5B3FC4` | `#B794F4` |

#### Ngày Nhà giáo (`teachers-day`) · Theo dịp

| Token | Sáng | Tối |
|---|---|---|
| `brand` | `#2C5A7A` | `#8EC0E4` |
| `brand-strong` | `#214560` | `#B7D7EE` |
| `brand-tint` | `#E6EFF5` | `#16283A` |
| `on-brand` | `#FFFFFF` | `#0A131B` |
| `ink` | `#142029` | `#E6EEF4` |
| `ink-muted` | `#4F5E69` | `#9AAAB8` |
| `surface-0` | `#F6F8FA` | `#0B131A` |
| `surface-1` | `#FFFFFF` | `#131D26` |
| `line` | `#D8E1E8` | `#24323F` |
| `line-strong` | `#77889A` | `#5B6C7C` |
| `info` | `#5B3FC4` | `#B3A3FF` |

#### Giáng Sinh (`christmas`) · Theo dịp

| Token | Sáng | Tối |
|---|---|---|
| `brand` | `#B3202A` | `#F58A8F` |
| `brand-strong` | `#8C1820` | `#F9B3B6` |
| `brand-tint` | `#FBEAEB` | `#3A181B` |
| `on-brand` | `#FFFFFF` | `#1A0A0C` |
| `ink` | `#1F1516` | `#F3ECEC` |
| `ink-muted` | `#615254` | `#B8A6A7` |
| `surface-0` | `#FBFAF8` | `#140E0F` |
| `surface-1` | `#FFFFFF` | `#1E1617` |
| `line` | `#E8DEDD` | `#382728` |
| `line-strong` | `#8A7C7D` | `#78625F` |
| `info` | `#1E6A4C` | `#6FD1A8` |

#### Tết Nguyên Đán (`tet`) · Theo dịp

| Token | Sáng | Tối |
|---|---|---|
| `brand` | `#A51D24` | `#F28B82` |
| `brand-strong` | `#821419` | `#F8B4AD` |
| `brand-tint` | `#FCEBEA` | `#3A1A1A` |
| `on-brand` | `#FFFFFF` | `#1A0B0B` |
| `ink` | `#241414` | `#F6ECE8` |
| `ink-muted` | `#64504D` | `#BCA8A3` |
| `surface-0` | `#FFF9F4` | `#160D0C` |
| `surface-1` | `#FFFFFF` | `#211413` |
| `line` | `#F0DDD3` | `#3B2523` |
| `line-strong` | `#8E7A72` | `#7A605B` |
| `info` | `#2F5BD3` | `#8AA8F5` |

#### Trung Thu (`mid-autumn`) · Theo dịp

| Token | Sáng | Tối |
|---|---|---|
| `brand` | `#A83D17` | `#F79A6B` |
| `brand-strong` | `#843011` | `#FBC1A2` |
| `brand-tint` | `#FCEDE5` | `#382015` |
| `on-brand` | `#FFFFFF` | `#160A04` |
| `ink` | `#1A1A2E` | `#ECECF5` |
| `ink-muted` | `#575872` | `#A3A6C2` |
| `surface-0` | `#FBF9F4` | `#0C0E1A` |
| `surface-1` | `#FFFFFF` | `#151829` |
| `line` | `#E8E1D8` | `#282C47` |
| `line-strong` | `#807D8C` | `#5F6487` |
| `info` | `#34418E` | `#9AA8F2` |

**Ghi chú về `info`:** `sea`, `mist`, `starry`, `grid`, `halloween`, `mid-autumn` dùng teal; `ocean`, `teachers-day` dùng tím (`#5B3FC4` / `#B3A3FF`), vì màu `info` gốc (xanh dương) quá giống màu chủ đạo của các theme này.

**Ghi chú về theme theo dịp:** dùng đúng **màu truyền thống** của dịp làm màu chủ đạo: Tết và Giáng sinh màu đỏ, Halloween cam bí ngô, Trung thu cam đỏ đèn lồng (đã tra cứu, xem mục 7.1). Vì màu chủ đạo gần màu đỏ của nút "Quên" nên các theme này dùng nút "Quên" kiểu viền (token `again-*`). `info` của Giáng sinh là xanh lá thông, của Halloween là tím, của Trung thu là xanh chàm, để mỗi theme có đủ cặp màu đặc trưng.

### 3.3. Ngưỡng tương phản (script kiểm tra tự động)

`build_themes.py` kiểm tra các cặp sau ở **cả sáng và tối**. Theme nào không đạt thì script báo lỗi và không sinh CSS.

| Chữ / nền | Ngưỡng |
|---|---|
| `ink` trên `surface-0`, `surface-1` | ≥ 7 |
| `ink` trên `brand-tint` | ≥ 4.5 |
| `ink-muted` trên `surface-0`, `surface-1` | ≥ 5.5 |
| `brand` trên `surface-0`, `surface-1` | ≥ 5.5 |
| `on-brand` trên `brand` | ≥ 4.5 |
| `brand-strong` trên `brand-tint` | ≥ 4.5 |
| `accent-strong` trên `surface-0`, `surface-1`, `accent-tint` | ≥ 4.5 |
| `on-accent` trên `accent` | ≥ 4.5 |
| `line-strong` trên `surface-0`, `surface-1` | ≥ 3 |
| `danger`, `info` trên `surface-1`; `on-danger`, `on-info` trên nền tương ứng | ≥ 4.5 |
| `again-fg` trên `again-bg` (nút Quên) | ≥ 4.5 |
| Sắc độ `info` so với `brand` | lệch ≥ 30° |
| Sắc độ `brand` so với `danger` < 25° | Không báo lỗi, tự chuyển nút Quên sang kiểu viền |

> Lưu ý: `tokens.json` ghi chữ phụ ≥ 6:1 và màu chủ đạo ≥ 5.8:1, nhưng chính bộ màu gốc Teal Mực đo được 5.87 và 5.77 trên `surface-0`. Script dùng 5.5 (vẫn cao hơn WCAG AA 4.5). Nên cập nhật lại con số trong `tokens.json` hoặc chỉnh nhẹ màu gốc. Việc này cần chủ sản phẩm quyết định.

### 3.4. Font

Giữ font brand ở mọi theme: **Lexend** (tiêu đề, từ vựng), **Be Vietnam Pro** (nội dung), **JetBrains Mono** (phiên âm, số liệu). Theme không đổi font, để giữ nhận diện và tránh tải thêm.

---

## 4. Chuyển động: quy tắc chung

### 4.1. Token chuyển động

| Token CSS | Giá trị | Dùng cho |
|---|---|---|
| `--tv-duration-fast` | 150ms | Hover, đổi trạng thái nhỏ |
| `--tv-duration-base` | 240ms | Đổi theme, hiện/ẩn |
| `--tv-duration-flip` | 420ms | Lật thẻ. **Không kiểu lật nào được quá 500ms** |
| `--tv-duration-celebrate` | 1600ms | Hiệu ứng xong buổi ôn, mốc streak |
| `--tv-ease-standard` | `cubic-bezier(0.2, 0.7, 0.2, 1)` | Mặc định |
| `--tv-ease-emphasized` | `cubic-bezier(0.3, 1.4, 0.5, 1)` | Nảy nhẹ khi đúng, lớp phủ ăn mừng |
| `--tv-ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Đóng lớp phủ |

### 4.2. 8 khoảnh khắc và nơi xuất hiện

| # | Khoảnh khắc | Kích hoạt khi | Nơi xuất hiện |
|---|---|---|---|
| 1 | Nền trang | Luôn (khi được phép) | **Chỉ trang chủ web app.** Không chạy ở màn hình ôn tập, danh sách từ, cài đặt, extension |
| 2 | Bấm Lưu | Bấm nút "Lưu" trong khung dịch | Extension (khung dịch trên trang) |
| 3 | Lật thẻ | Bấm vào flashcard | Màn hình ôn tập |
| 4 | Trả lời đúng | Chấm "Được"/"Dễ", trắc nghiệm đúng, điền chỗ trống đúng | Màn hình ôn tập |
| 5 | Trả lời sai | Chấm "Quên", trắc nghiệm sai, điền chỗ trống sai | Màn hình ôn tập |
| 6 | Thanh tiến độ | Luôn hiển thị; chuyển động khi giá trị thay đổi | Trang chủ, đầu màn hình ôn tập |
| 7 | Xong buổi ôn | Hoàn thành mục tiêu ngày | Màn hình kết thúc buổi ôn |
| 8 | Mốc streak | Đạt 7, 30, 100, 365 ngày | Lần mở app đầu tiên sau khi đạt mốc |
| + | Lời chào dịp lễ | Lần mở web app đầu tiên trong thời gian của dịp | Lớp phủ dùng biểu tượng streak của theme dịp + câu chào (`greeting`). Mỗi người chỉ thấy 1 lần mỗi dịp |

### 4.3. Giới hạn để giữ nhẹ nhàng

| Quy tắc | Giới hạn |
|---|---|
| Hạt khi trả lời đúng | ≤ 10 hạt, sống ≤ 1.6s |
| Hạt khi lật thẻ | ≤ 12 hạt |
| Hạt khi xong buổi ôn | ≤ 30 hạt, lớp phủ tự đóng sau 2.2s (bấm để đóng sớm) |
| Nền động | ≤ 36 sao hoặc ≤ 8 hạt lớn (lá, bọt, cánh hoa, đom đóm); độ mờ 0.2 – 0.35; sao băng cách nhau 14 – 24s |
| Lớp phủ ăn mừng | Tối đa 1 lần cho mỗi sự kiện, không chồng nhau |
| Trả lời sai | Chỉ chuyển động trên thẻ (rung, lắc, chớp), **không có hạt**, ≤ 700ms |
| Âm thanh | Không có trong thiết kế này. Nếu thêm sau thì tắt mặc định |
| Hiệu năng | Chỉ animate `transform`, `opacity`, `filter`; canvas giới hạn devicePixelRatio ≤ 2; dừng vẽ khi tab ẩn |

### 4.4. Khi tắt chuyển động

Điều kiện: `prefers-reduced-motion: reduce`, **hoặc** cài đặt người dùng `motion = off` (render thành `data-tv-motion="off"` trên phần tử gốc).

- Không vẽ hạt, không nền động.
- Lật thẻ, thanh tiến độ: chuyển trạng thái tức thì (thời gian 1ms).
- Lớp phủ xong buổi ôn và streak vẫn hiện (để báo thông tin) nhưng không có animation.
- Màu theme giữ nguyên.

---

## 5. Đặc tả hiệu ứng của từng bộ

Tên hiệu ứng (cột "ID") khớp với `effect_sets` trong `themes.json` và `SETS` trong `effects.js`. Màu ghi theo token. "Hạt" vẽ bằng Canvas, còn lại bằng CSS.

### 5.1. `basic`: Teal Mực, Biển Đêm, Sương Sớm

| Khoảnh khắc | ID | Mô tả | Thông số |
|---|---|---|---|
| Nền | `none` | Không có | – |
| Lưu | `pulse` | Vòng sáng lan ra từ nút | `box-shadow` 0 → 14px, `brand` 55% → 0%, 700ms |
| Lật thẻ | `flip3d` | Lật 3D quanh trục dọc | `rotateY` 0 → -180° (mặt trước), 180° → 0 (mặt sau), 420ms, `perspective: 1200px` |
| Đúng | `glow` | Viền thẻ sáng lên và nảy nhẹ; 8 chấm nhỏ bung lên rồi rơi | Viền `brand` 4px + bóng 28px, 900ms; `scale` 1 → 1.04 → 1, 420ms; hạt tròn 2 – 3.5px, màu `brand`/`accent`/`brand-strong` |
| Sai | `shake` | Rung ngang | `translateX` -7 → 6 → -4 → 2 → 0px, 420ms |
| Tiến độ | `fill` | Thanh màu đơn | Nền `brand-tint`, phần đầy `brand`, `width` chuyển 600ms |
| Xong buổi | `check-pop` | Lớp phủ dấu tích + 20 mảnh pháo giấy nhỏ bắn lên | Biểu tượng tròn `brand` có dấu tích `on-brand`; mảnh chữ nhật 3 – 5px |
| Streak | `flame` | Ngọn lửa | SVG lửa `accent` với lõi `accent-tint`; vòng 16 ngôi sao màu `accent` toả ra |

### 5.2. `starry`: Đêm Sao

Hạt đặc trưng: **ngôi sao 4 cánh** (`star`). Bản sáng: sao màu `brand` rất mờ trên nền giấy tím nhạt. Bản tối: sao màu `ink` trên nền đêm.

| Khoảnh khắc | ID | Mô tả | Thông số |
|---|---|---|---|
| Nền | `stars` | Sao lấp lánh tại chỗ; thỉnh thoảng một sao băng | ≤ 36 chấm 0.5 – 1.7px, độ mờ dao động theo hàm sin (sáng 0.12 – 0.37, tối 0.25 – 0.8); sao băng mỗi 14 – 24s |
| Lưu | `star-trail` | Một ngôi sao bay theo đường cong vào icon extension, để lại vệt sao nhỏ | Đường cong bậc 2, 750ms, ease-out bậc 3; khi tới nơi bung 5 hạt |
| Lật thẻ | `stardust` | Mặt trước mờ và nhoè dần như tan thành bụi sao, mặt sau hiện ra; 12 sao nhỏ rắc trên thẻ | Mặt trước: `opacity` 1 → 0, `blur` 0 → 8px, `scale` → 0.96. Mặt sau: ngược lại. 420ms |
| Đúng | `shooting-star` | Sao băng vụt chéo qua thẻ, 6 sao nhỏ bung ở cuối | Vệt dài 90px màu `accent`, 750ms |
| Sai | `dim-flicker` | Thẻ chớp tối như sao mờ đi | `brightness` 1 → 0.55 → 1.05 → 0.7 → 1, 520ms |
| Tiến độ | `constellation` | Chuỗi chấm sao trên thanh, đầu thanh phát sáng | Chấm `on-brand` 1.6px cách 18px trên nền `brand`; bóng sáng `brand` 14px ở đầu |
| Xong buổi | `starburst` | 30 ngôi sao bùng ra từ giữa màn hình | Tốc độ ≤ 340px/s, sống ≤ 1.6s |
| Streak | `nova` | Ngôi sao 8 cánh toả sáng | SVG sao `accent`, vòng `brand`, tâm `accent-tint` |

### 5.3. `autumn`: Mùa Thu

Hạt đặc trưng: **lá** (`leaf`, hình lá có gân). Màu lá: `brand`, `accent`, `#C2552B`, `#D98A2B`.

| Khoảnh khắc | ID | Mô tả | Thông số |
|---|---|---|---|
| Nền | `falling-leaves` | Vài chiếc lá rơi chậm, đung đưa | ≤ 4 lá 5 – 9px, rơi 12 – 24px/s, độ mờ 0.28 (sáng) / 0.25 (tối) |
| Lưu | `leaf-fly` | Chiếc lá bay vào icon extension | Như `star-trail`, hạt là lá |
| Lật thẻ | `page-turn` | Lật như trang sách, bản lề mép trái, có bóng đổ | Mặt trước `rotateY` 0 → -178°, `transform-origin: left`, bóng `ink` 35% |
| Đúng | `leaf-burst` | 8 chiếc lá bung ra rồi rơi xuống | Tốc độ 190px/s, trọng lực 160, đung đưa 30px |
| Sai | `branch-sway` | Thẻ lắc như cành cây trước gió | `rotate` -2.2° → 1.6° → -0.6° → 0, gốc ở đáy, 640ms |
| Tiến độ | `branch-grow` | Cành cây có lá mọc dọc phần đã đầy | Thân `brand` 3px; lá xen kẽ `accent` và `brand` cách 22px; phần chưa đầy là đường `line` 2px |
| Xong buổi | `leaf-shower` | 24 chiếc lá rơi từ trên xuống khắp màn hình | Rơi 60 – 140px/s, sống 2.8 – 4s, xuất hiện rải trong 0.8s |
| Streak | `maple-glow` | Lá phong phát sáng | SVG lá phong `accent`, gân `brand` |

### 5.4. `ocean`: Đại Dương

Hạt đặc trưng: **bọt nước** (`bubble`, vòng tròn có điểm sáng). Màu: `brand`, `brand-strong`.

| Khoảnh khắc | ID | Mô tả | Thông số |
|---|---|---|---|
| Nền | `bubbles` | Bọt nước nổi lên chậm | ≤ 8 bọt 2.5 – 7px, nổi 10 – 22px/s, độ mờ 0.22 (sáng) / 0.28 (tối) |
| Lưu | `bubble-rise` | Bọt nước bay vào icon extension | Như `star-trail`, hạt là bọt |
| Lật thẻ | `ripple` | Thẻ chìm xuống như gợn nước rồi mặt sau nổi lên; 3 vòng sóng lan ra | Mặt trước `translateY` -10px, `scaleY` 0.92, `blur` 5px, mờ dần; vòng elip `brand` lan 160 – 240px/s |
| Đúng | `bubble-burst` | 9 bọt nước bung lên | Tốc độ 130px/s, trọng lực âm -120 (bay lên) |
| Sai | `wave-wobble` | Thẻ uốn như mặt nước | `skewX` -3° → 2.5° → -1°, 640ms |
| Tiến độ | `wave-fill` | Mép trên phần đầy là mặt sóng chạy ngang | Vòng cung trong suốt bán kính 8px lặp mỗi 20px, chạy 2.4s/vòng |
| Xong buổi | `wave-sweep` | 20 bọt nước dâng từ đáy lên, 3 vòng sóng lan từ giữa | Bọt nổi 180 – 320px/s |
| Streak | `pearl` | Viên ngọc trai trên vỏ sò | SVG ngọc chuyển màu `surface-1` → `brand-tint` → `brand` |

### 5.5. `sakura`: Anh Đào

Hạt đặc trưng: **cánh hoa** (`petal`, có khía ở đầu). Màu: `brand`, `brand-strong`, `#F7B6D2`, `#FFD9E8`.

| Khoảnh khắc | ID | Mô tả | Thông số |
|---|---|---|---|
| Nền | `petals` | Cánh hoa bay chéo nhẹ | ≤ 6 cánh 4 – 7px, rơi 14 – 26px/s, trôi ngang 6 – 16px/s, độ mờ 0.32 (sáng) / 0.3 (tối) |
| Lưu | `petal-fly` | Cánh hoa bay vào icon extension | Như `star-trail`, hạt là cánh hoa |
| Lật thẻ | `bloom` | Mặt sau nở ra từ tâm; 6 cánh hoa tung ra | `clip-path: circle(0%)` → `circle(75%)`, xoay -4° → 0 |
| Đúng | `petal-burst` | 9 cánh hoa tung ra rồi rơi chậm | Tốc độ 170px/s, trọng lực 90, đung đưa 26px |
| Sai | `petal-droop` | Thẻ rủ xuống nhẹ | `translateY` 5px + `rotate` 1.5°, gốc ở mép trên, 620ms |
| Tiến độ | `blossom` | Hoa nhỏ nở dọc thanh | Chấm hoa `on-brand` 55% bán kính 4px, nhuỵ `accent-tint` 2px, cách 16px |
| Xong buổi | `petal-shower` | 28 cánh hoa bay chéo khắp màn hình | Rơi 70 – 130px/s, trôi ngang 30 – 80px/s |
| Streak | `sakura-bloom` | Bông anh đào 5 cánh nở | SVG 5 cánh `brand`, nhuỵ `accent` |

### 5.6. `firefly`: Đom Đóm

Hạt đặc trưng: **đốm sáng** (`firefly`, gradient tròn toả sáng). Bản sáng: đốm màu `accent` (như ánh đèn bàn). Bản tối: đốm màu `brand` (xanh vàng chanh).

| Khoảnh khắc | ID | Mô tả | Thông số |
|---|---|---|---|
| Nền | `fireflies` | Đom đóm bay lượn chậm, sáng tắt | ≤ 8 đốm, quỹ đạo sin, chu kỳ sáng ~4s |
| Lưu | `firefly-fly` | Đom đóm bay vào icon extension | Như `star-trail`, hạt là đốm sáng |
| Lật thẻ | `light-up` | Mặt trước tối đi, mặt sau được thắp sáng, viền phát sáng | Mặt trước `brightness` → 0.2 và mờ dần; mặt sau `brightness` 0.3 → 1, bóng sáng `brand` 36px |
| Đúng | `firefly-glow` | 6 đom đóm bay lên từ thẻ | Tốc độ 60px/s, trọng lực -40 |
| Sai | `flicker-out` | Thẻ chập chờn như ánh đèn | `brightness` 1 → 0.5 → 1.1 → 0.35 → 1, 600ms |
| Tiến độ | `glow-fill` | Đầu thanh là đốm sáng bập bùng | Chấm 16px gradient `brand-strong`, phóng to 0.9 → 1.25, chu kỳ 1.8s |
| Xong buổi | `firefly-swarm` | 20 đom đóm từ mép màn hình tụ về giữa rồi tản ra | Tốc độ 140 – 220px/s, lực cản 0.965 |
| Streak | `lantern` | Chiếc đèn lồng sáng | SVG đèn `accent`, lõi `accent-tint` |

### 5.7. `grid`: Giấy Kẻ Ô

Hạt đặc trưng: **giọt mực** (`ink`). Màu: `brand` (mực tím), `brand-strong`. Nền trang là **giấy ô ly tĩnh** (CSS, không động).

| Khoảnh khắc | ID | Mô tả | Thông số |
|---|---|---|---|
| Nền | `grid-paper` | Giấy ô ly | CSS trên `.tv-page`: hai lớp `linear-gradient` kẻ ô 24px, màu `line` 85%. Không chuyển động |
| Lưu | `ink-drop` | Giọt mực bay vào icon extension | Như `star-trail`, hạt là giọt mực |
| Lật thẻ | `notebook-flip` | Lật lên như trang vở gáy lò xo | Mặt trước `rotateX` 0 → 178°, bản lề mép trên, bóng `ink` 30% |
| Đúng | `check-draw` | Dấu tích được "viết" bằng nét bút ở góc phải trên của thẻ, 5 giọt mực nhỏ | SVG nét `brand` 6px, `stroke-dashoffset` 80 → 0 trong 420ms, mờ dần sau 1.1s |
| Sai | `erase` | Thẻ nhoè đi như bị tẩy | `blur` 1.5px + `opacity` .6 + lắc ngang ±4px, 620ms |
| Tiến độ | `pencil-line` | Nét bút, đầu thanh là ngòi bút | Thân `brand` dày 6px; ngòi tam giác `accent` 10px; phần chưa đầy là nét đứt `line-strong` |
| Xong buổi | `stamp-10` | Đóng dấu "10 · HOÀN THÀNH" | SVG con dấu tròn `brand` xoay -12°, rơi xuống `scale` 1.8 → 0.94 → 1 trong 520ms; 6 giọt mực bắn ra |
| Streak | `star-sticker` | Nhãn dán ngôi sao như cô giáo khen | SVG sao 5 cánh `accent`, viền `surface-1` 5px |

### 5.8. `map`: Bản Đồ Cổ

Hạt đặc trưng: **đồng xu vàng** (`coin`). Màu: `accent`, `#D9A520`. Nền trang là **giấy da tĩnh** (CSS).

| Khoảnh khắc | ID | Mô tả | Thông số |
|---|---|---|---|
| Nền | `map-lines` | Giấy da: vân mờ ở góc, kinh tuyến rất nhạt | CSS trên `.tv-page`: 2 `radial-gradient` `line-strong` 12–14% ở góc + kẻ dọc `line` mỗi 120px. Không chuyển động |
| Lưu | `pin-drop` | Đồng xu bay vào icon extension như đánh dấu trên bản đồ | Như `star-trail`, hạt là đồng xu |
| Lật thẻ | `unfold` | Mặt trước gấp vào giữa, mặt sau mở ra như tờ bản đồ | Hai nửa thời gian 210ms: mặt trước `scaleX` 1 → 0, rồi mặt sau `scaleX` 0 → 1 |
| Đúng | `coin-burst` | 8 đồng xu vàng bung ra rồi rơi | Tốc độ 200px/s, trọng lực 300 |
| Sai | `compass-wobble` | Thẻ rung như kim la bàn | `rotate` -2.5° → 2° → -1.2° → 0.6° → 0, 700ms |
| Tiến độ | `route` | Đường đi nét đứt, đầu thanh cắm cờ | Nét `brand` 10px cách 6px; cờ nhỏ `accent` trên cán `ink-muted`; phần chưa đi là chấm `line-strong` |
| Xong buổi | `treasure` | Rương báu, đồng xu vàng bung lên | Biểu tượng rương; 20 đồng xu bắn lên trong góc ±0.8 rad, trọng lực 420 |
| Streak | `compass` | La bàn | SVG vòng `brand`, kim `accent` / `ink-muted` |

### 5.9. `halloween`: Halloween (theo dịp)

Hạt đặc trưng: **kẹo** (`candy`). Màu: cam `#F28C28`, `brand` (cam bí ngô), `accent`, `info` (tím). Dễ thương, **không** dùng hình ma quỷ, máu, mạng nhện đáng sợ.

| Khoảnh khắc | ID | Mô tả | Thông số |
|---|---|---|---|
| Nền | `bats` | Vài chú dơi nhỏ bay ngang chậm, vỗ cánh | ≤ 4 con 6 – 9px, bay ngang 14 – 26px/s, độ mờ 0.2 (sáng) / 0.3 (tối) |
| Lưu | `candy-fly` | Viên kẹo bay vào icon extension | Như `star-trail` |
| Lật thẻ | `light-up` | Như Đom Đóm (5.6), 5 viên kẹo rơi ra | |
| Đúng | `candy-burst` | 8 viên kẹo bung ra | Tốc độ 190px/s, trọng lực 220 |
| Sai | `shake` | Như `basic` | |
| Tiến độ | `glow-fill` | Như Đom Đóm (5.6) | |
| Xong buổi | `candy-shower` | Mưa kẹo | 26 viên từ trên xuống |
| Streak | `jack-o-lantern` | Bí ngô cười | SVG bí ngô cam, cuống xanh, mặt cười `ink` |

### 5.10. `teachers`: Ngày Nhà giáo (theo dịp)

Hạt đặc trưng: **hoa 5 cánh** (`flower`). Màu: hồng `#E8577A`, `#F4A3B5`, vàng `#F7C948`, `brand`.

| Khoảnh khắc | ID | Mô tả | Thông số |
|---|---|---|---|
| Nền | `petals` | Như Anh Đào (5.5) | |
| Lưu | `petal-fly` | Bông hoa bay vào icon extension | |
| Lật thẻ | `page-turn` | Như Mùa Thu (5.3) | |
| Đúng | `flower-burst` | 9 bông hoa tung ra | Tốc độ 170px/s, trọng lực 90 |
| Sai | `shake` | Như `basic` | |
| Tiến độ | `blossom` | Như Anh Đào (5.5) | |
| Xong buổi | `flower-shower` | Mưa hoa | 26 bông |
| Streak | `bouquet` | Bó hoa tặng thầy cô | SVG 3 bông hồng, vàng, hồng nhạt, giấy gói `brand` |

### 5.11. `christmas`: Giáng Sinh (theo dịp)

Hạt đặc trưng: **bông tuyết** (`snow`). Màu tuyết: trắng (tối) / xanh xám nhạt `#9DBFD6` (sáng, để thấy được trên nền trắng); thêm `brand` (đỏ) và `info` (xanh lá thông).

| Khoảnh khắc | ID | Mô tả | Thông số |
|---|---|---|---|
| Nền | `snow` | Tuyết rơi nhẹ | ≤ 12 bông 2 – 4.5px, rơi 10 – 22px/s, độ mờ 0.55 |
| Lưu | `snow-fly` | Bông tuyết bay vào icon extension | |
| Lật thẻ | `flip3d` | Như `basic` | |
| Đúng | `snow-burst` | 9 bông tuyết bung ra | Tốc độ 150px/s, trọng lực 50 |
| Sai | `shake` | Như `basic` | |
| Tiến độ | `fill` | Như `basic` | |
| Xong buổi | `snow-shower` | Tuyết rơi dày một lúc | 26 bông |
| Streak | `gift` | Hộp quà | SVG hộp `brand`, nơ đỏ `#D7263D` |

### 5.12. `tet`: Tết Nguyên Đán (theo dịp)

Hạt đặc trưng: **hoa 5 cánh** (`flower`). Màu: vàng mai `#F2B705`, hồng đào `#F48FB1`, đỏ `#D7263D`.

| Khoảnh khắc | ID | Mô tả | Thông số |
|---|---|---|---|
| Nền | `mai-blossoms` | Hoa mai, hoa đào rơi nhẹ | ≤ 6 bông 3.5 – 6px, rơi 12 – 22px/s, độ mờ 0.4 |
| Lưu | `lixi-fly` | Bông mai bay vào icon extension | |
| Lật thẻ | `bloom` | Như Anh Đào (5.5), hạt là hoa mai | |
| Đúng | `mai-burst` | 9 bông mai, đào tung ra | Tốc độ 170px/s, trọng lực 90 |
| Sai | `shake` | Như `basic` | |
| Tiến độ | `blossom` | Như Anh Đào (5.5) | |
| Xong buổi | `firework-soft` | 3 chùm "pháo hoa" nhẹ bằng hoa mai, đào ở 3 vị trí, cách nhau 0.35s | 12 bông mỗi chùm, tốc độ 160px/s |
| Streak | `lixi` | Phong bao lì xì | SVG phong bao đỏ `#D7263D`, huy hiệu tròn `accent` |

### 5.13. `midautumn`: Trung Thu (theo dịp)

Hạt đặc trưng: **đèn lồng nhỏ** (`lantern`, có quầng sáng). Màu: cam `#F28C28`, `accent`, đỏ `#E5484D`.

| Khoảnh khắc | ID | Mô tả | Thông số |
|---|---|---|---|
| Nền | `lanterns` | Đèn lồng trôi lên chậm | ≤ 5 đèn 5 – 8px, bay lên 6 – 12px/s, độ mờ 0.35 (sáng) / 0.5 (tối) |
| Lưu | `lantern-fly` | Đèn lồng nhỏ bay vào icon extension | |
| Lật thẻ | `light-up` | Như Đom Đóm (5.6), 5 đèn lồng bay lên | |
| Đúng | `lantern-glow` | 6 đèn lồng nhỏ bay lên từ thẻ | Tốc độ 70px/s, trọng lực -60 |
| Sai | `flicker-out` | Như Đom Đóm (5.6) | |
| Tiến độ | `glow-fill` | Như Đom Đóm (5.6) | |
| Xong buổi | `lantern-rise` | Đèn lồng bay lên khắp màn hình | 14 đèn từ đáy lên |
| Streak | `full-moon` | Trăng rằm | SVG trăng tròn chuyển màu `accent-tint` → `accent`, mây `surface-1` |

---

## 6. Đồng bộ web app và extension

### 6.1. Một nguồn màu cho cả hai

- Web app và extension cùng dùng `brand/themes/themes.css` (sinh từ `themes.json`). Bước build của mỗi bên **copy file này** vào bundle, không viết lại màu.
- Hiện extension đang khai báo màu brand trực tiếp trong [extension/popup/popup.css](../extension/popup/popup.css) và [extension/src/content.js](../extension/src/content.js) (khoảng dòng 388). Khi dev theme phải thay bằng token từ `themes.css`.
- Extension khung dịch nằm trong Shadow DOM, nên phải **chèn nội dung `themes.css` vào trong shadow root** và đặt `data-tv-theme` lên phần tử gốc bên trong shadow root (CSS của trang ngoài không vào được Shadow DOM).

### 6.2. Lưu lựa chọn theme ở đâu

| Nơi | Giá trị | Vai trò |
|---|---|---|
| Backend: `user_settings.settings.theme` | `{ "value": "autumn", "source": "user" }` | **Nguồn chính**, theo tài khoản |
| Backend: `user_settings.settings.motion` | `{ "value": "on" \| "off", "source": "user" }` | Công tắc hiệu ứng |
| Extension: `chrome.storage.sync` | `{ theme, motion, unlocked: [...] }` | Bản sao để dùng ngay khi mở, cả khi offline |
| Web app: `localStorage` | `{ theme, motion }` | Bản sao để trang hiện đúng màu ngay từ khung hình đầu, tránh nháy màu mặc định |

Chế độ sáng/tối: mặc định theo hệ điều hành. **Đã có nút chọn (08/11/2026)**: lưu `settings.appearance = "system" | "light" | "dark"` trên server, xem [api-contract.md mục 6.4](api-contract.md).

### 6.3. Luồng đồng bộ

1. Người dùng đổi theme ở **Cài đặt → Giao diện** trên web app.
2. Web app áp dụng ngay (đổi `data-tv-theme`), ghi `localStorage`, gọi `PUT /api/settings`.
3. Web app gửi tin nhắn tới extension để đổi ngay, không chờ đồng bộ: `chrome.runtime.sendMessage(EXTENSION_ID, { type: "theme-changed", theme, motion })`. Cần khai báo `externally_connectable` cho domain web app trong `manifest.json`.
4. Extension nhận tin, ghi `chrome.storage.sync`, các khung dịch đang mở nghe `chrome.storage.onChanged` và đổi theme.
5. Dự phòng khi extension không nhận được tin (ví dụ đổi theme trên máy khác): mỗi lần mở popup và mỗi lần đồng bộ định kỳ, extension gọi `GET /api/settings` để cập nhật.

### 6.4. Quy tắc hiển thị

- **Chưa đăng nhập:** dùng `teal`, trừ khi đang có dịp lễ (theme dịp tự bật, mục 7).
- **Đang có dịp lễ:** cả web app và extension cùng hiện theme dịp theo mục 7.3.
- **Theme chưa mở khóa** (dữ liệu lỗi hoặc bị gỡ): server trả về `teal`, extension và web app tự quay về `teal`.
- **Extension chỉ dùng:** màu của theme + hiệu ứng **Lưu** (khoảnh khắc 2). Không có nền động, không hạt nào khác, vì khung dịch hiện trên trang web của người khác.
- **Web app dùng:** đủ 8 khoảnh khắc theo mục 4.2.
- Công tắc `motion` áp dụng cho cả hai bên.

---

## 7. Theme theo dịp: tự áp dụng cho toàn hệ thống

### 7.1. Các dịp và màu truyền thống

| Dịp | Theme | Thời gian áp dụng | Cách tính | Màu chủ đạo (đã tra cứu) |
|---|---|---|---|---|
| Tết Nguyên Đán | `tet` | 7 ngày trước Tết → mùng 6 | Âm lịch, ngày quy đổi sẵn | Đỏ (may mắn, phong bao lì xì) + vàng (thịnh vượng) |
| Tết Trung Thu | `mid-autumn` | 5 ngày trước rằm tháng 8 → 1 ngày sau | Âm lịch, ngày quy đổi sẵn | Không có màu quy định; dùng cam đỏ đèn lồng, vàng trăng, chàm đêm |
| Halloween | `halloween` | 25/10 → 01/11 | Dương lịch cố định | Cam (bí ngô), đen, tím |
| Ngày Nhà giáo Việt Nam | `teachers-day` | 17/11 → 21/11 | Dương lịch cố định | Không có màu quy định; dùng xanh bảng lớp và màu hoa tươi |
| Giáng Sinh | `christmas` | 18/12 → 26/12 | Dương lịch cố định | Đỏ, xanh lá thông, vàng |

**Ngày âm lịch đã quy đổi** (trong `themes.json` → `seasons.events[].anchor_dates`):

| Năm | Mùng 1 Tết | Rằm tháng 8 |
|---|---|---|
| 2026 | 17/02 | 25/09 |
| 2027 | 06/02 | 15/09 |
| 2028 | 26/01 | 03/10 |
| 2029 | 13/02 | 22/09 |
| 2030 | 03/02 | 12/09 |

> Ngày âm lịch được quy đổi từ hiểu biết sẵn có, **cần đối chiếu lại** với lịch vạn niên chính thức trước khi dùng. Mỗi năm phải bổ sung năm mới; `build_themes.py` báo lỗi nếu dịp âm lịch thiếu năm. Khi dev có thể thay bằng thư viện đổi âm lịch, hoặc để admin sửa ngày trong bảng `seasonal_events` (mục 9).

`build_themes.py` kiểm tra: mỗi dịp trỏ tới theme có `tier: "seasonal"`, không có hai dịp chồng ngày trong cùng năm.

### 7.2. Quy tắc áp dụng

1. **Tự bật cho mọi người dùng** (cả web app và extension, cả người chưa đăng nhập) khi ngày hôm nay **theo múi giờ của người dùng** nằm trong khoảng của dịp, gồm cả ngày đầu và ngày cuối.
2. **Hết dịp tự quay về** theme người dùng đã chọn. Lựa chọn của người dùng không bị ghi đè trong database; theme dịp chỉ là lớp hiển thị tạm.
3. **Miễn phí cho mọi người** trong thời gian của dịp. Ngoài thời gian đó không chọn được theme dịp (không bán, không đổi điểm).
4. **Có công tắc "Tự đổi theme theo dịp"** trong Cài đặt → Giao diện, **mặc định bật**. Người dùng tắt thì luôn giữ theme của mình.
5. **Lời chào dịp lễ:** lần đầu mở web app trong dịp, hiện lớp phủ với biểu tượng streak của theme dịp và câu chào (`greeting` trong `themes.json`). Mỗi người chỉ thấy **1 lần mỗi dịp** (lưu cờ đã xem). Extension không hiện lời chào.
6. **Chế độ sáng/tối và công tắc hiệu ứng** vẫn theo cài đặt của người dùng.
7. Trên trang Cài đặt → Giao diện, khi đang có dịp: hiện dòng "Đang có dịp Halloween: theme Halloween được bật tới hết 01/11", có nút tắt nhanh. Ngoài dịp: hiện dòng "Dịp tiếp theo: Ngày Nhà giáo Việt Nam từ 17/11".

### 7.3. Logic chọn theme đang áp dụng

Bản mẫu: [brand/themes/seasonal.js](../brand/themes/seasonal.js). **Backend phải cài đúng logic này** và trả kết quả cho cả hai bên, để web app và extension luôn hiện cùng một theme.

```
active_theme(user, today_in_user_timezone):
    if user chưa đăng nhập: chosen = "teal"
    else: chosen = user_settings.theme (nếu chưa mở khóa thì "teal")
    if (user chưa đăng nhập hoặc user_settings.seasonal != "off"):
        event = dịp có khoảng [start, end] chứa today   // xét cả năm trước để bắt dịp vắt qua năm
        if event: return { theme: event.theme, reason: "season", event, ends_on }
    return { theme: chosen, reason: "chosen" }
```

Kết quả đã kiểm tra với bản mẫu: 24/10 → theme đã chọn; 30/10 → `halloween` (tới 01/11); 02/11 → theme đã chọn; 20/11 → `teachers-day`; 25/12 → `christmas`; 01/02/2027 → `tet` (tới 11/02); tắt công tắc → luôn theme đã chọn.

### 7.4. Đồng bộ web và extension khi đổi dịp

- Backend trả `active_theme` (kèm `reason`, `ends_on`) trong `GET /api/settings`.
- Extension cache kết quả trong `chrome.storage.sync` kèm `ends_on`. Đến nửa đêm (theo `chrome.alarms`, giờ của máy) extension tự tính lại bằng cùng logic với lịch đã cache, để đổi theme đúng giờ cả khi chưa gọi được server.
- Web app tính lại khi tải trang và khi qua nửa đêm.
- Lịch các dịp (`seasons.events`) được đóng gói vào cả web app và extension từ `themes.meta.js`, nên tính được cả khi offline.

## 8. Mở khóa: điểm streak và mua

> Đây là **đề xuất**. Các con số cần chủ sản phẩm chốt trước khi dev (xem mục 14).

- **3 theme miễn phí** dùng được ngay, không cần đăng nhập để xem nhưng cần đăng nhập để lưu lựa chọn.
- **7 theme mở khóa** (`starry`, `autumn`, `ocean`, `sakura`, `firefly`, `grid`, `map`), mỗi theme mở bằng **một trong hai cách**:
  - **Đổi điểm streak** (đề xuất 30 điểm, tức khoảng 1 tháng học đều).
  - **Mua** (giá chưa chốt; có thể là mua lẻ từng theme hoặc gói Premium mở tất cả).
- Mở khóa là **vĩnh viễn**. Đổi theme qua lại không mất gì.
- **5 theme theo dịp không bán và không đổi điểm**: tự bật miễn phí cho mọi người trong dịp (mục 7).

**Cách kiếm điểm streak (đề xuất):**

| Sự kiện | Điểm |
|---|---|
| Mỗi ngày đạt mục tiêu ôn (ngày được tính vào streak) | +1 |
| Đạt mốc 7 ngày | +5 |
| Đạt mốc 30 ngày | +15 |
| Đạt mốc 100 ngày | +50 |
| Ngày được giữ bằng thẻ đóng băng | 0 (giữ streak nhưng không cộng điểm) |

- **Tiêu điểm không làm mất streak.** Điểm là số dư riêng, streak là số ngày liên tiếp.
- Điểm chỉ cộng cho **việc học thật** (đạt mục tiêu ngày), không cộng cho việc mở app, để giữ nguyên tắc "thưởng cho việc nhớ" trong [product-plan.md](product-plan.md#6-phần-thưởng-và-động-lực).

**Giao diện mở khóa (Cài đặt → Giao diện):**

- Lưới thẻ theme: ô màu xem trước, tên, dòng "Gắn với việc học".
- Theme khóa: biểu tượng ổ khóa, nút "Đổi 30 điểm" (mờ đi nếu không đủ điểm, ghi "Còn thiếu 12 điểm") và nút "Mua".
- Bấm vào theme khóa: **xem trước tạm thời 10 giây** trên giao diện mẫu (lật thẻ, trả lời đúng) rồi quay về theme đang dùng, để người dùng biết mình mở khóa cái gì.
- Sau khi mở khóa: hiện lớp phủ ăn mừng của chính theme đó, rồi áp dụng luôn.

---

## 9. Database và API

### 9.1. Bảng cần thêm (bổ sung cho [database-design.md](database-design.md))

**`user_theme_unlocks`**

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | BIGINT PK | |
| `user_id` | BIGINT FK → `users` | `ON DELETE CASCADE` |
| `theme_id` | VARCHAR(30) | Khớp `id` trong `themes.json` |
| `method` | ENUM('points', 'purchase', 'gift') | |
| `points_spent` | INT NULL | |
| `order_id` | VARCHAR(64) NULL | Mã giao dịch nếu mua |
| `unlocked_at` | TIMESTAMP | |

Index: `UNIQUE (user_id, theme_id)`. Theme miễn phí **không** cần dòng trong bảng này.

**`streak_point_ledger`**: sổ điểm, chỉ thêm, không sửa.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | BIGINT PK | |
| `user_id` | BIGINT FK → `users` | `ON DELETE CASCADE` |
| `delta` | INT | Dương là cộng, âm là tiêu |
| `reason` | VARCHAR(30) | `daily_goal`, `milestone_7`, `milestone_30`, `milestone_100`, `unlock_theme`, `admin_adjust` |
| `ref` | VARCHAR(64) NULL | Ví dụ ngày `2026-11-08` hoặc `theme:autumn` |
| `created_at` | TIMESTAMP | |

Index: `(user_id, created_at)`; `UNIQUE (user_id, reason, ref)` để không cộng trùng một ngày hay một mốc.

**`seasonal_events`**: lịch dịp lễ để admin sửa ngày mà không cần phát hành lại app. Dữ liệu ban đầu lấy từ `themes.json` → `seasons.events`.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | BIGINT PK | |
| `theme_id` | VARCHAR(30) | Theme có `tier: seasonal` |
| `name` | VARCHAR(100) | Ví dụ "Halloween" |
| `starts_on` | DATE | Ngày bắt đầu (gồm) |
| `ends_on` | DATE | Ngày kết thúc (gồm) |
| `greeting` | VARCHAR(255) | Câu chào |
| `enabled` | BOOLEAN | Tắt một dịp mà không xóa |

Index: `(starts_on, ends_on)`. Mỗi dòng là **một lần** diễn ra (ví dụ Halloween 2026, Halloween 2027), job hằng năm tạo dòng cho năm sau từ `themes.json`.

**Thêm vào `user_settings.settings`:** `seasonal: { value: "on" | "off" }` (mặc định `on`) và `seen_greetings: ["halloween-2026", …]` (dịp đã xem lời chào).

**Thêm cột vào `streaks`:** `points_balance INT NOT NULL DEFAULT 0`. Đây là số dư tính sẵn, luôn bằng tổng `delta` trong sổ. Cập nhật trong **cùng transaction** với việc ghi sổ.

### 9.2. API

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/themes` | Danh sách theme: `id`, `name`, `tier`, `unlocked` (bool), `price_points`, `price_money`. Kèm `points_balance` của user |
| POST | `/api/themes/{id}/unlock` | Body `{ "method": "points" }`. Kiểm tra đủ điểm và chưa mở → trong một transaction: ghi sổ `-price`, trừ `points_balance`, thêm `user_theme_unlocks`. Trả về số dư mới. Lỗi: `409` đã mở, `402` không đủ điểm |
| PUT | `/api/settings` | Ghi `theme`, `motion`, `seasonal`. **Server từ chối** theme chưa mở khóa (`403`) và theme dịp (`422`) |
| GET | `/api/settings` | Trả cài đặt + `active_theme: { theme, reason, ends_on, event }`. Extension dùng để đồng bộ dự phòng |
| GET | `/api/seasons` | Lịch các dịp đang bật (từ `seasonal_events`) để client tính khi offline |
| POST | `/api/seasons/{key}/greeting-seen` | Đánh dấu đã xem lời chào dịp |

Mua bằng tiền đi qua cổng thanh toán (chưa thiết kế). Khi thanh toán thành công thì server thêm dòng `method = purchase`.

---

## 10. Hợp đồng HTML / CSS / JS

### 10.1. Thuộc tính trên phần tử gốc

| Thuộc tính | Giá trị | Ghi chú |
|---|---|---|
| `data-tv-theme` | `teal` \| `sea` \| `mist` \| `starry` \| `autumn` \| `ocean` \| `sakura` \| `firefly` | Đặt trên `<html>` (web app) hoặc phần tử gốc trong shadow root (extension) |
| `data-tv-mode` | không có \| `light` \| `dark` | Không có = theo hệ điều hành |
| `data-tv-motion` | `on` \| `off` | `off` = tắt hiệu ứng |
| class `tv-page` | – | Đặt trên phần tử gốc của trang để nhận **nền tĩnh** của theme (giấy ô ly của `grid`, giấy da của `map`) |

### 10.2. Component

```html
<!-- Flashcard. data-tv-flip lấy từ bộ hiệu ứng của theme -->
<div class="tv-card" data-tv-flip="page-turn" role="button" tabindex="0">
  <div class="tv-card__face tv-card__front">…mặt trước…</div>
  <div class="tv-card__face tv-card__back">…mặt sau…</div>
</div>

<!-- Thanh tiến độ. --value từ 0 đến 1 -->
<div class="tv-progress" data-tv-progress="branch-grow" style="--value: 0.68">
  <div class="tv-progress__bar"></div>
</div>
```

- Lật thẻ = thêm/bỏ class `.is-flipped` trên `.tv-card`.
- Phản hồi đúng: class `.tv-fx-correct` (+ `.tv-fx-correct-pop` với bộ `basic`) trong ~950ms.
- Phản hồi sai: class `.tv-fx-wrong-<ID>` (ví dụ `.tv-fx-wrong-branch-sway`) trong ~700ms.
- Nút Lưu bộ `basic`: class `.tv-fx-pulse`.
- Nút "Quên": luôn dùng `background: var(--again-bg); color: var(--again-fg); border: 1px solid var(--again-border)`. Không dùng thẳng `--danger`.

### 10.3. API hiệu ứng (theo bản mẫu `effects.js`)

```js
const fx = TVEffects.create({ container: document.body, set: 'autumn' });
fx.setSet('ocean');          // đổi bộ hiệu ứng, tự cập nhật data-tv-flip / data-tv-progress
fx.refresh();                // gọi lại sau khi đổi sáng/tối hoặc đổi theme
fx.setMotion(false);         // tắt hiệu ứng
fx.flip(cardEl);
fx.correct(el);
fx.wrong(el);
fx.save(saveButton, extensionIconEl);   // target có thể bỏ trống: hạt bay lên
fx.complete({ title: 'Xong buổi ôn hôm nay!', sub: 'Bạn đã ôn 25 từ' });
fx.streak(30);
fx.announce({ title: 'Halloween', sub: 'Mỗi từ thuộc là một viên kẹo.' });   // lời chào dịp lễ
fx.destroy();

// Chọn theme đang áp dụng (theme dịp)
TVSeasonal.resolveActiveTheme({ chosen: 'autumn', seasonalEnabled: true, date: '2026-10-30', seasons: window.TV_SEASONS });
```

`TVEffects.SETS` là bảng ID hiệu ứng, phải khớp `effect_sets` trong `themes.json`. Nếu web app viết bằng React/Vue thì bọc API này trong một hook/composable, khởi tạo một lần ở layout gốc.

---

## 11. Các file trong repo

| File | Loại | Sửa tay? | Nội dung |
|---|---|---|---|
| [brand/themes/themes.json](../brand/themes/themes.json) | Nguồn gốc | **Có** | Màu 8 theme × sáng/tối, màu cố định, token chuyển động, bộ hiệu ứng, ý tưởng, quy tắc thiết kế |
| [brand/themes/build_themes.py](../brand/themes/build_themes.py) | Công cụ | Có | Kiểm tra tương phản, sinh `themes.css` và `themes.meta.js` |
| [brand/themes/themes.css](../brand/themes/themes.css) | Sinh tự động | **Không** | Biến CSS theo `data-tv-theme` / `data-tv-mode` |
| [brand/themes/themes.meta.js](../brand/themes/themes.meta.js) | Sinh tự động | **Không** | `window.TV_THEMES` và `window.TV_SEASONS` (lịch dịp) |
| [brand/themes/effects.css](../brand/themes/effects.css) | Bản mẫu | Có | Kiểu lật thẻ, đúng/sai, thanh tiến độ, lớp phủ, giảm chuyển động |
| [brand/themes/effects.js](../brand/themes/effects.js) | Bản mẫu | Có | Hạt Canvas, nền động, ăn mừng, biểu tượng streak (SVG) |
| [brand/themes/seasonal.js](../brand/themes/seasonal.js) | Bản mẫu | Có | Logic chọn theme theo dịp; backend cài lại đúng logic này |
| [docs/theme-preview.html](theme-preview.html) | Bản mẫu | Có | Trang xem trước tương tác, có giả lập ngày để xem theme dịp tự bật |
| [brand/tokens.json](../brand/tokens.json) | Brand gốc | Có | Ý nghĩa từng token, font, khoảng cách, bo góc. Theme `teal` = bộ màu ở đây |

Lệnh build: `python3 brand/themes/build_themes.py` (không cần cài thêm gì).

---

## 12. Cách thêm một theme mới

1. Thêm một mục vào `themes` trong `themes.json`: `id`, `name`, `tier`, `concept`, `study`, `effects`, `light`, `dark` (đủ 11 token riêng; 5 token cố định tự lấy từ `fixed`).
2. Nếu theme có bộ hiệu ứng mới: thêm vào `effect_sets` trong `themes.json` **và** `SETS` + `SHAPE` trong `effects.js`, thêm CSS lật thẻ, sai, tiến độ vào `effects.css`, thêm biểu tượng streak vào `ICONS`.
3. Chạy `python3 brand/themes/build_themes.py`. Sửa màu cho tới khi đạt hết ngưỡng.
4. Mở `theme-preview.html`, xem cả sáng lẫn tối, bấm thử đủ 8 khoảnh khắc, bật/tắt "giảm chuyển động".
5. Cập nhật bảng ở mục 2 và mục 5 của tài liệu này.

**Thêm một dịp lễ mới:** tạo theme `tier: "seasonal"` như trên, rồi thêm một mục vào `seasons.events` (`rule: "fixed"` với `start`/`end` dạng `MM-DD`, hoặc `rule: "lunar"` với `anchor_dates` và `days_before`/`days_after`), kèm `greeting`. Dùng **màu truyền thống** của dịp làm màu chủ đạo (tra cứu nếu chưa chắc). Chạy build để kiểm tra không chồng ngày với dịp khác.

Gợi ý chọn màu: chế độ sáng làm trước. Theme thường nên có màu chủ đạo lệch các theme khác ≥ 25° sắc độ và tránh vùng đỏ (trùng `danger`). Theme dịp lễ thì ưu tiên màu truyền thống, kể cả đỏ hay cam; script sẽ tự chuyển nút Quên sang kiểu viền.

---

## 13. Checklist dev và tiêu chí nghiệm thu

**Giai đoạn 1: màu và theme miễn phí**
- [ ] Web app nạp `themes.css`, đặt `data-tv-theme` trên `<html>`; đọc `localStorage` trước khi render để không nháy màu.
- [ ] Mọi component dùng token, không còn mã màu viết trực tiếp (tìm bằng grep `#[0-9a-fA-F]{6}` trong code giao diện).
- [ ] Extension: popup và khung dịch (Shadow DOM) dùng `themes.css`, bỏ màu viết trực tiếp ở `popup.css` và `content.js`.
- [ ] Trang Cài đặt → Giao diện, chọn được 3 theme miễn phí, công tắc hiệu ứng.
- [ ] Đồng bộ theo mục 6: đổi ở web → extension đổi trong ≤ 2s khi đang mở; mở popup trên máy khác thấy theme mới.

**Giai đoạn 2: hiệu ứng `basic`**
- [ ] 8 khoảnh khắc của bộ `basic` đúng thông số mục 5.1.
- [ ] Nền động chỉ ở trang chủ; màn hình ôn tập không có chuyển động khi đang nghĩ đáp án.
- [ ] Bật `prefers-reduced-motion` hoặc công tắc tắt → không hạt, lật thẻ tức thì.

**Giai đoạn 3: theme theo dịp**
- [ ] Bảng `seasonal_events`, job tạo lịch năm sau, logic `active_theme` mục 7.3 ở backend.
- [ ] Web app và extension hiện cùng theme dịp; qua nửa đêm ngày bắt đầu/kết thúc thì tự đổi (thử bằng cách chỉnh giờ máy).
- [ ] Công tắc "Tự đổi theme theo dịp", lời chào 1 lần mỗi dịp, dòng trạng thái trong Cài đặt.
- [ ] Nút "Quên" dùng token `again-*` (kiểu viền ở theme màu đỏ/cam).

**Giai đoạn 4: điểm và mở khóa**
- [ ] Bảng và cột ở mục 9.1; cộng điểm hằng ngày chạy cùng cron streak, không cộng trùng.
- [ ] API mục 9.2; server từ chối theme chưa mở khóa.
- [ ] Giao diện mở khóa mục 8, có xem trước 10 giây.

**Giai đoạn 5: 7 theme mở khóa và hiệu ứng theme dịp**
- [ ] Hiệu ứng mỗi bộ đúng mục 5.2 – 5.13 và giới hạn mục 4.3.
- [ ] Extension chỉ có hiệu ứng Lưu của theme.

**Tiêu chí nghiệm thu chung**
- `build_themes.py` chạy không lỗi.
- Đổi theme không thay đổi bố cục hay vị trí nút (so sánh ảnh chụp hai theme).
- Lật thẻ ≤ 500ms ở mọi theme; trang không giật trên laptop phổ thông (60 khung hình/giây khi có hạt).
- Dùng bàn phím được: Tab tới thẻ, Enter/Space để lật.

---

## 14. Việc còn mở

| Vấn đề | Đề xuất hiện tại | Ai quyết |
|---|---|---|
| Số điểm để đổi 1 theme | 30 điểm | Chủ sản phẩm |
| Cách kiếm điểm | Bảng ở mục 8 | Chủ sản phẩm |
| Giá bán theme / gói Premium | Chưa có | Chủ sản phẩm |
| Ngưỡng tương phản trong `tokens.json` (ghi 6.0 / 5.8, đo thực tế 5.87 / 5.77) | Cập nhật con số hoặc chỉnh nhẹ màu gốc | Chủ sản phẩm |
| Đối chiếu ngày âm lịch 2026–2030 (mục 7.1) | Kiểm tra với lịch vạn niên chính thức | Dev |
| Màu chủ đạo của Trung thu và 20/11 | Không có màu quy định; đang dùng cam đỏ đèn lồng và xanh bảng lớp | Chủ sản phẩm |
| Thêm dịp khác (Valentine, 8/3, khai giảng 5/9…) | Có thể thêm theo mục 12 | Chủ sản phẩm |
| Âm thanh hiệu ứng | Không làm trong thiết kế này | Chủ sản phẩm |
