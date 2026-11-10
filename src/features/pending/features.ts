import type { FeatureId } from '../../navigation/types';

// TV2/TV3 replace these entry points with their feature components as they land.
export const features: Record<
  FeatureId,
  { title: string; description: string; owner: 'TV2' | 'TV3' }
> = {
  places: {
    title: 'Khám phá nơi học',
    description:
      'Tìm quán cà phê, thư viện và những không gian phù hợp với cách học của bạn.',
    owner: 'TV2',
  },
  community: {
    title: 'Cộng đồng học tập',
    description:
      'Chia sẻ trải nghiệm, đặt câu hỏi và tìm thêm cảm hứng từ cộng đồng.',
    owner: 'TV3',
  },
  documents: {
    title: 'Kho tài liệu',
    description:
      'Khám phá và chia sẻ tài liệu theo môn học, ngành học bạn quan tâm.',
    owner: 'TV3',
  },
  favorites: {
    title: 'Địa điểm yêu thích',
    description: 'Những góc học bạn lưu sẽ xuất hiện ở đây.',
    owner: 'TV2',
  },
  suggestions: {
    title: 'Đề xuất của tôi',
    description: 'Theo dõi địa điểm và những cập nhật bạn đã đóng góp.',
    owner: 'TV2',
  },
  'my-posts': {
    title: 'Bài viết của tôi',
    description: 'Quản lý bài đã đăng và tiếp tục những bản nháp của bạn.',
    owner: 'TV3',
  },
  'saved-posts': {
    title: 'Bài viết đã lưu',
    description: 'Giữ lại những chia sẻ hữu ích để đọc sau.',
    owner: 'TV3',
  },
  'my-documents': {
    title: 'Tài liệu của tôi',
    description: 'Theo dõi tài liệu đã chia sẻ và kết quả kiểm duyệt.',
    owner: 'TV3',
  },
  notifications: {
    title: 'Thông báo',
    description: 'Cập nhật tương tác mới và kết quả đóng góp của bạn.',
    owner: 'TV3',
  },
};
