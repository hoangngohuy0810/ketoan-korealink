# **App Name**: Nhật Ký Thu Chi

## Core Features:

- Quản lý Thông tin Doanh nghiệp: Cho phép kế toán nhập và quản lý thông tin cốt lõi của doanh nghiệp (Tên, Mã số thuế, tên viết tắt) để AI xác định loại giao dịch (Thu/Chi). Dữ liệu này được lưu trữ cố định và có thể chỉnh sửa.
- Tải lên Hóa đơn PDF & Công cụ Trích xuất dữ liệu bằng AI: Cho phép người dùng tải lên một hoặc nhiều hóa đơn PDF bằng cách kéo và thả. Công cụ AI tự động trích xuất các chi tiết giao dịch khác nhau như ngày, số hóa đơn, thông tin bên liên quan và số liệu tài chính từ mỗi tài liệu.
- Xem xét & Xác nhận Dữ liệu Trích xuất: Hiển thị các chi tiết giao dịch được AI trích xuất để người dùng xem xét dưới dạng thẻ, cho phép chỉnh sửa thủ công bất kỳ trường nào. Nó hiển thị mức độ tin cậy của AI và làm nổi bật các điểm không nhất quán (ví dụ: lỗi tính toán VAT) trước khi lưu dữ liệu đã xác thực vào nhật ký giao dịch.
- Bảng điều khiển Nhật ký Giao dịch Tương tác: Giao diện chính hiển thị tất cả các giao dịch đã xác nhận dưới dạng bảng có thể lọc, tìm kiếm và mã hóa màu. Bao gồm một thanh tóm tắt cố định cho các chỉ số tài chính chính như tổng doanh thu, tổng chi phí và chênh lệch trong khoảng thời gian đã chọn.
- Lọc, Tìm kiếm & Tóm tắt Nhật ký: Cung cấp các bộ lọc trực quan cho khoảng thời gian, loại giao dịch (Thu/Chi) và danh mục, cùng với chức năng tìm kiếm văn bản (theo Tên đối tác và Số hóa đơn), tất cả đều hiển thị phía trên bảng nhật ký giao dịch.
- Nhập giao dịch thủ công: Cung cấp nút '＋ Thêm thủ công' mở một biểu mẫu dạng ngăn kéo, cho phép kế toán nhập đầy đủ chi tiết giao dịch trong trường hợp không có tệp hóa đơn PDF liên quan.
- Chỉnh sửa Giao dịch & Truy cập Chứng từ Gốc: Cho phép chỉnh sửa trực tiếp dữ liệu giao dịch hiện có bằng cách nhấp vào bất kỳ hàng nào trong nhật ký. Một biểu tượng liên quan cho phép người dùng xem tài liệu PDF gốc đã tải lên trong một bảng điều khiển bên cạnh.

## Style Guidelines:

- Màu chủ đạo: Một màu xanh lam đậm, chuyên nghiệp (#2966AD), được chọn để gợi lên sự tin cậy, rõ ràng và ổn định trong ngữ cảnh tài chính.
- Màu nền: Một màu xanh lam rất nhạt, ít bão hòa (#EFF2F6) cung cấp một nền tảng sạch sẽ, dịu mắt và dễ đọc cho dữ liệu tài chính chi tiết, hài hòa tinh tế với màu chủ đạo.
- Màu nhấn: Một màu xanh lam-ngọc tươi mới, tràn đầy năng lượng (#41C3D7), tương đồng với màu chủ đạo, được sử dụng một cách tiết kiệm để làm nổi bật các yếu tố tương tác và thu hút sự chú ý đến các lời kêu gọi hành động mà không làm mất đi cảm giác chuyên nghiệp tổng thể.
- Phông chữ tiêu đề và nội dung: 'Inter' (sans-serif), được chọn vì khả năng đọc tuyệt vời trên nhiều kích thước màn hình và vẻ ngoài hiện đại, trung tính, lý tưởng để trình bày thông tin tài chính chính xác.
- Sử dụng các icon đường nét sạch, tối giản. Một icon PDF nhỏ nên được sử dụng để chỉ các liên kết đến tài liệu hóa đơn gốc.
- Giao diện chính là hiển thị trực tiếp bảng nhật ký giao dịch khi khởi động ứng dụng, không có bảng điều khiển trung gian hay điều hướng phức tạp. Các điều khiển chính như tải lên PDF và nhập thủ công luôn hiển thị. Các hàng 'THU' được phân biệt trực quan bằng viền trái màu xanh lá nhạt, trong khi các hàng 'CHI' sử dụng viền đỏ nhạt. Chi tiết có thể chỉnh sửa được quản lý thông qua các ngăn kéo bên cạnh thay vì chuyển trang hoàn toàn.
- Các hiệu ứng chuyển đổi mượt mà, tinh tế khi mở và đóng các ngăn kéo, trạng thái tải khi trích xuất bằng AI và cập nhật nhật ký giao dịch giúp nâng cao trải nghiệm người dùng mà không gây phân tâm.