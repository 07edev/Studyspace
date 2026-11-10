# Hướng dẫn triển khai StudySpace

## Kế hoạch và tiến độ

- Đọc `docs/TV1_IMPLEMENTATION_PLAN.md` trước khi triển khai hoặc tiếp tục công việc TV1.
- Chọn công việc từ mục `Công việc tiếp theo`, kiểm tra phụ thuộc rồi cập nhật trạng thái khi bắt đầu và kết thúc.
- Bám phạm vi và điều kiện nghiệm thu trong kế hoạch. Nếu phát hiện cần đổi thứ tự hoặc thiết kế, ghi lý do và ảnh hưởng vào nhật ký của kế hoạch.
- Cập nhật bằng chứng kiểm tra thực tế. Chưa chạy được kiểm tra nào thì ghi rõ; không đánh dấu hoàn thành chỉ dựa vào UI mock hoặc mã đã viết.
- Chỉ dẫn mới của người dùng được ưu tiên; cập nhật kế hoạch tương ứng để các lượt sau tiếp tục đúng hướng.

## Ranh giới dự án

- TV1 là người dùng, phụ trách Core/Identity và base dùng chung cho Backend, Web Admin và App.
- Giữ React Native CLI hiện có ở gốc repository. Mọi thay đổi cấu trúc phải bảo toàn Android/iOS và các lệnh chạy hiện có.
- TV2 sở hữu Places/Taxonomy; TV3 sở hữu Content/Uploads/Reports/Notifications. TV1 tích hợp qua contract, không tạo bản sao nghiệp vụ của họ.
- G1 dùng Welcome và 5 tab trên App, không Drawer. Ngoài phạm vi hiện tại: booking, payment, subscription, chat realtime, tính năng G2/G3.
- Không commit secrets hoặc token. Không tự thay đổi phiên bản nền tảng khi chưa có nhu cầu tương thích cụ thể.
