import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthGate } from '../../shared/auth/AuthGate';
import { useSession, useSessionManager } from '../../shared/auth/AuthProvider';
import { queryKeys, useApiQuery, usePagedQuery, type PagedQuery } from '../../shared/query';
import { AppText, Button, Card, EmptyState, PagedList, TextField, UploadPicker, useConfirm, useToast } from '../../shared/ui';
import { createFileUploader } from '../../shared/upload/fileUploader';
import { DOCUMENT_RULES, EVIDENCE_RULES, POST_IMAGE_RULES } from '../../shared/upload/types';
import { useModal } from '../../navigation/ModalCoordinator';
import type { FeatureId } from '../../navigation/types';
import { colors } from '../../shared/theme/tokens';

type Post = {
  id: string;
  authorId: string;
  title?: string;
  content?: string;
  imageFileIds?: string[];
  category?: string;
  status: string;
  likesCount: number;
  commentsCount: number;
  liked: boolean;
  saved: boolean;
  createdAt: string;
};

type Comment = {
  id: string;
  authorId: string;
  content: string;
  status: string;
  replyCount: number;
  createdAt: string;
};

type DocumentItem = {
  id: string;
  title: string;
  description?: string;
  category: string;
  format: string;
  sizeBytes: number;
  downloadsCount: number;
};

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  targetType?: string;
  targetId?: string;
  read: boolean;
  createdAt: string;
};

type ReportItem = {
  id: string;
  targetType: string;
  targetId: string;
  reasonCode: string;
  status: string;
  description?: string;
  decisionReason?: string;
  evidenceFileIds: string[];
  createdAt: string;
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Chưa thể thực hiện. Vui lòng thử lại.';

export function CommunityScreen() {
  const { open } = useModal();
  const { requireAuth } = useAuthGate();
  const posts = usePagedQuery<Post>(queryKeys.posts.list(), '/posts', {}, { authenticated: false });
  const queryClient = useQueryClient();
  const session = useSessionManager();
  const toast = useToast();
  const header = (
    <View style={styles.header}>
      <View style={styles.heading}>
        <AppText variant="caption" style={styles.kicker}>STUDYSPACE / CỘNG ĐỒNG</AppText>
        <AppText variant="title">Góc chia sẻ học tập</AppText>
        <AppText muted>Chia sẻ điều hữu ích và cùng nhau học tốt hơn.</AppText>
      </View>
      <Button
        title="Viết bài"
        onPress={() => requireAuth({
          reason: 'Đăng nhập để chia sẻ bài viết với cộng đồng.',
          action: () => open({ name: 'post-editor' }),
        })}
      />
      <Button
        variant="secondary"
        title="Bài viết của tôi"
        onPress={() => requireAuth({
          reason: 'Đăng nhập để xem bài viết và bản nháp của bạn.',
          action: () => open({ name: 'feature', feature: 'my-posts' }),
        })}
      />
      <Button
        variant="ghost"
        title="Báo cáo của tôi"
        onPress={() => requireAuth({
          reason: 'Đăng nhập để theo dõi các báo cáo bạn đã gửi.',
          action: () => open({ name: 'feature', feature: 'my-reports' }),
        })}
      />
    </View>
  );

  const toggle = (post: Post, kind: 'likes' | 'saves') => requireAuth({
    reason: 'Đăng nhập để tương tác với bài viết.',
    action: async () => {
      try {
        await session.request(`/posts/${post.id}/${kind}/me`, {
          method: kind === 'likes'
            ? post.liked ? 'DELETE' : 'PUT'
            : post.saved ? 'DELETE' : 'PUT',
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
      } catch (error) {
        toast(errorMessage(error));
      }
    },
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <PagedList
        query={posts}
        header={header}
        keyExtractor={post => post.id}
        renderItem={post => (
          <Card>
            <View style={styles.postHeader}>
              <AppText variant="caption" muted>{post.category ?? 'Cộng đồng'} · {new Date(post.createdAt).toLocaleDateString('vi-VN')}</AppText>
              <Button
                title="Báo cáo"
                variant="ghost"
                onPress={() => requireAuth({
                  reason: 'Đăng nhập để gửi báo cáo nội dung.',
                  action: () => open({ name: 'report-content', targetType: 'POST', targetId: post.id }),
                })}
              />
            </View>
            {!!post.title && <AppText variant="heading">{post.title}</AppText>}
            <AppText>{post.content}</AppText>
            {post.imageFileIds?.[0] ? <PostImage fileId={post.imageFileIds[0]} /> : null}
            <View style={styles.actions}>
              <Button title={`${post.liked ? 'Đã thích' : 'Thích'} · ${post.likesCount}`} variant="secondary" onPress={() => toggle(post, 'likes')} />
              <Button title={`Bình luận · ${post.commentsCount}`} variant="secondary" onPress={() => open({ name: 'post-comments', postId: post.id })} />
              <Button title={post.saved ? 'Đã lưu' : 'Lưu'} variant="ghost" onPress={() => toggle(post, 'saves')} />
            </View>
          </Card>
        )}
        emptyTitle="Chưa có bài viết"
        emptyDescription="Hãy là người đầu tiên chia sẻ điều hữu ích."
      />
    </SafeAreaView>
  );
}

function PostImage({ fileId }: { fileId: string }) {
  const image = useApiQuery<{ url: string }>(
    ['files', 'access', fileId],
    `/files/${fileId}/access`,
    { authenticated: false },
  );
  if (!image.data?.url) return null;
  return (
    <Image
      source={{ uri: image.data.url }}
      style={styles.postImage}
      accessibilityLabel="Ảnh đính kèm bài viết"
    />
  );
}

export function DocumentsScreen() {
  const { open } = useModal();
  const { requireAuth } = useAuthGate();
  const docs = usePagedQuery<DocumentItem>(queryKeys.documents.list(), '/documents', {}, { authenticated: false });
  const header = (
    <View style={styles.header}>
      <View style={styles.heading}>
        <AppText variant="caption" style={styles.kicker}>STUDYSPACE / TÀI LIỆU</AppText>
        <AppText variant="title">Kho tài liệu</AppText>
        <AppText muted>Tìm tài liệu học tập được cộng đồng chia sẻ.</AppText>
      </View>
      <Button
        variant="secondary"
        title="Tài liệu của tôi"
        onPress={() => requireAuth({
          reason: 'Đăng nhập để xem tài liệu bạn đã chia sẻ.',
          action: () => open({ name: 'feature', feature: 'my-documents' }),
        })}
      />
      <Button
        title="Chia sẻ tài liệu"
        onPress={() => requireAuth({
          reason: 'Đăng nhập để chia sẻ tài liệu học tập.',
          action: () => open({ name: 'document-editor' }),
        })}
      />
    </View>
  );
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <PagedList
        query={docs}
        header={header}
        keyExtractor={document => document.id}
        renderItem={document => (
          <Card>
            <AppText variant="heading">{document.title}</AppText>
            <AppText variant="caption" muted>{document.category} · {document.format} · {Math.ceil(document.sizeBytes / 1024)} KB</AppText>
            {!!document.description && <AppText>{document.description}</AppText>}
            <AppText variant="caption" muted>{document.downloadsCount} lượt tải</AppText>
            <View style={styles.actions}>
              <Button title="Chi tiết" variant="secondary" onPress={() => open({ name: 'document-detail', documentId: document.id })} />
              <Button
                title="Báo cáo"
                variant="ghost"
                onPress={() => requireAuth({
                  reason: 'Đăng nhập để gửi báo cáo nội dung.',
                  action: () => open({ name: 'report-content', targetType: 'DOCUMENT', targetId: document.id }),
                })}
              />
            </View>
          </Card>
        )}
        emptyTitle="Chưa có tài liệu"
        emptyDescription="Tài liệu đã được duyệt sẽ xuất hiện ở đây."
      />
    </SafeAreaView>
  );
}

export function Tv3FeatureModal({ feature }: { feature: FeatureId }) {
  if (feature === 'my-posts' || feature === 'saved-posts') {
    return <MyPostsModal saved={feature === 'saved-posts'} />;
  }
  if (feature === 'my-documents') return <MyDocumentsModal />;
  if (feature === 'my-reports') return <MyReportsModal />;
  if (feature === 'notifications') return <NotificationsModal />;
  return <EmptyState title="Tính năng đang được hoàn thiện" description="Nội dung này sẽ sớm có mặt trên StudySpace." />;
}

function MyPostsModal({ saved }: { saved: boolean }) {
  const { open } = useModal();
  const session = useSessionManager();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const path = saved ? '/users/me/saved-posts' : '/users/me/posts';
  const key = queryKeys.posts.list({ saved });
  const posts = usePagedQuery<Post>(key, path);
  const remove = async (post: Post) => {
    if (!await confirm({ title: 'Xóa bài viết?', message: 'Bài viết sẽ không còn hiển thị với bạn bè.', destructive: true })) return;
    try {
      await session.request(`/posts/${post.id}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
      toast('Đã xóa bài viết.');
    } catch (error) {
      toast(errorMessage(error));
    }
  };
  const unsave = async (post: Post) => {
    try {
      await session.request(`/posts/${post.id}/saves/me`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: key });
      toast('Đã gỡ bài viết khỏi danh sách đã lưu.');
    } catch (error) {
      toast(errorMessage(error));
    }
  };
  return (
    <ModalList
      query={posts}
      renderItem={post => (
        <Card>
          {!!post.title && <AppText variant="heading">{post.title}</AppText>}
          <AppText>{post.content}</AppText>
          <AppText variant="caption" muted>{post.status} · {post.commentsCount} bình luận</AppText>
          {saved ? (
            <Button title="Bỏ lưu" variant="ghost" onPress={() => unsave(post)} />
          ) : (
            <View style={styles.actions}>
              <Button title="Chỉnh sửa" variant="secondary" onPress={() => open({ name: 'post-editor', postId: post.id })} />
              <Button title="Xóa" variant="ghost" onPress={() => remove(post)} />
            </View>
          )}
        </Card>
      )}
      emptyTitle={saved ? 'Chưa có bài viết đã lưu' : 'Bạn chưa có bài viết'}
      emptyDescription="Bài viết của bạn sẽ hiển thị ở đây."
    />
  );
}

function MyDocumentsModal() {
  const docs = usePagedQuery<DocumentItem>(queryKeys.documents.list({ mine: true }), '/users/me/documents');
  return (
    <ModalList
      query={docs}
      renderItem={document => (
        <Card>
          <AppText variant="heading">{document.title}</AppText>
          <AppText variant="caption" muted>{document.format} · {document.category}</AppText>
        </Card>
      )}
      emptyTitle="Bạn chưa chia sẻ tài liệu"
      emptyDescription="Tài liệu đã gửi sẽ xuất hiện ở đây cùng trạng thái kiểm duyệt."
    />
  );
}

function MyReportsModal() {
  const session = useSessionManager();
  const toast = useToast();
  const reports = usePagedQuery<ReportItem>(['reports', 'mine'], '/reports/mine');
  const openEvidence = async (fileId: string) => {
    try {
      const access = await session.request<{ url: string }>(`/files/${fileId}/access`);
      await Linking.openURL(access.url);
    } catch (error) {
      toast(errorMessage(error));
    }
  };
  return (
    <ModalList
      query={reports}
      renderItem={report => (
        <Card>
          <AppText variant="heading">{report.targetType} · {report.reasonCode}</AppText>
          <AppText variant="caption" muted>{report.status} · {new Date(report.createdAt).toLocaleDateString('vi-VN')}</AppText>
          {!!report.description && <AppText>{report.description}</AppText>}
          {!!report.decisionReason && <AppText>Phản hồi kiểm duyệt: {report.decisionReason}</AppText>}
          {report.evidenceFileIds.map(fileId => (
            <Button key={fileId} title="Mở tệp minh chứng" variant="ghost" onPress={() => openEvidence(fileId)} />
          ))}
        </Card>
      )}
      emptyTitle="Bạn chưa gửi báo cáo"
      emptyDescription="Các báo cáo bạn gửi sẽ được hiển thị tại đây."
    />
  );
}

function NotificationsModal() {
  const queryClient = useQueryClient();
  const session = useSessionManager();
  const toast = useToast();
  const notifications = usePagedQuery<NotificationItem>(['notifications', 'list'], '/notifications');
  const markAll = async () => {
    try {
      await session.request('/notifications/read-all', { method: 'POST' });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (error) {
      toast(errorMessage(error));
    }
  };
  const markRead = async (notification: NotificationItem) => {
    try {
      await session.request(`/notifications/${notification.id}`, {
        method: 'PATCH',
        body: { read: !notification.read },
      });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (error) {
      toast(errorMessage(error));
    }
  };
  return (
    <ModalList
      query={notifications}
      header={<Button title="Đánh dấu tất cả đã đọc" variant="secondary" onPress={() => markAll()} />}
      renderItem={item => (
        <Card style={!item.read ? styles.unread : undefined}>
          <AppText variant="heading">{item.title}</AppText>
          <AppText>{item.body}</AppText>
          <AppText variant="caption" muted>{new Date(item.createdAt).toLocaleString('vi-VN')}</AppText>
          <Button title={item.read ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'} variant="ghost" onPress={() => markRead(item)} />
        </Card>
      )}
      emptyTitle="Chưa có thông báo"
      emptyDescription="Các cập nhật về bài viết, tài liệu và báo cáo sẽ xuất hiện ở đây."
    />
  );
}

export function PostEditorModal({ postId }: { postId?: string }) {
  const { close, setDirty } = useModal();
  const session = useSessionManager();
  const queryClient = useQueryClient();
  const toast = useToast();
  const uploader = useMemo(() => createFileUploader(session, 'POST_IMAGE'), [session]);
  const existing = useApiQuery<Post>(
    queryKeys.posts.detail(postId ?? ''),
    `/posts/${postId ?? ''}`,
    { enabled: !!postId },
  );
  const [initial, setInitial] = useState<{ title: string; content: string; category: string } | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [imageFileId, setImageFileId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (postId && existing.data && !initial) {
      const values = {
        title: existing.data.title ?? '',
        content: existing.data.content ?? '',
        category: existing.data.category ?? '',
      };
      setTitle(values.title);
      setContent(values.content);
      setCategory(values.category);
      setInitial(values);
    }
  }, [existing.data, initial, postId]);
  const dirty = initial
    ? title !== initial.title || content !== initial.content || category !== initial.category || imageFileId !== null
    : title !== '' || content !== '' || category !== '' || imageFileId !== null;
  useEffect(() => setDirty(dirty), [dirty, setDirty]);
  const save = async () => {
    setBusy(true);
    try {
      await session.request(postId ? `/posts/${postId}` : '/posts', {
        method: postId ? 'PATCH' : 'POST',
        body: {
          title: title.trim(),
          content: content.trim(),
          ...(category.trim() ? { category: category.trim() } : {}),
          ...(imageFileId ? { imageFileIds: [imageFileId] } : {}),
          ...(!postId ? { status: 'PUBLISHED' } : {}),
        },
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
      toast(postId ? 'Đã cập nhật bài viết.' : 'Bài viết đã được đăng.');
      setDirty(false);
      close();
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  if (postId && existing.isPending) {
    return <EmptyState title="Đang tải bài viết" description="Vui lòng đợi trong giây lát." />;
  }
  if (postId && (existing.error || !existing.data)) {
    return <EmptyState title="Chưa thể tải bài viết" description={existing.error?.message ?? 'Bài viết không khả dụng.'} action={{ label: 'Thử lại', onPress: () => existing.refetch() }} />;
  }
  return (
    <View style={styles.form}>
      <AppText muted>{postId ? 'Cập nhật nội dung bài viết của bạn.' : 'Bài viết sẽ xuất hiện trên bảng tin cộng đồng.'}</AppText>
      <TextField label="Tiêu đề" value={title} onChangeText={setTitle} maxLength={180} />
      <TextField label="Chủ đề" value={category} onChangeText={setCategory} maxLength={80} />
      <TextField label="Nội dung" value={content} onChangeText={setContent} multiline maxLength={10000} style={styles.multiline} />
      <UploadPicker
        label="Ảnh bài viết (không bắt buộc)"
        uploader={uploader}
        rules={POST_IMAGE_RULES}
        onChange={setImageFileId}
        hint="JPEG, PNG hoặc WebP; tối đa 10 MB."
      />
      <Button title={postId ? 'Lưu thay đổi' : 'Đăng bài'} loading={busy} disabled={title.trim().length < 5 || !content.trim()} onPress={() => save()} />
      <Button title="Để sau" variant="ghost" onPress={close} />
    </View>
  );
}

export function PostCommentsModal({ postId }: { postId: string }) {
  const { requireAuth } = useAuthGate();
  const session = useSessionManager();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [content, setContent] = useState('');
  const comments = usePagedQuery<Comment>(['posts', postId, 'comments'], `/posts/${postId}/comments`, {}, { authenticated: false });
  const submit = () => {
    const text = content.trim();
    if (!text) return;
    requireAuth({
      reason: 'Đăng nhập để bình luận.',
      action: async () => {
        try {
          await session.request(`/posts/${postId}/comments`, { method: 'POST', body: { content: text } });
          setContent('');
          await queryClient.invalidateQueries({ queryKey: ['posts', postId, 'comments'] });
          await queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
        } catch (error) {
          toast(errorMessage(error));
        }
      },
    });
  };
  return (
    <View style={styles.form}>
      <TextField label="Viết bình luận" value={content} onChangeText={setContent} multiline maxLength={2000} style={styles.multiline} />
      <Button title="Gửi bình luận" onPress={submit} disabled={!content.trim()} />
      <ModalList
        query={comments}
        renderItem={comment => <CommentThread postId={postId} comment={comment} />}
        emptyTitle="Chưa có bình luận"
        emptyDescription="Hãy bắt đầu cuộc trò chuyện."
      />
    </View>
  );
}

function CommentThread({ postId, comment }: { postId: string; comment: Comment }) {
  const { open } = useModal();
  const { requireAuth } = useAuthGate();
  const session = useSessionManager();
  const sessionState = useSession();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [reply, setReply] = useState('');
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const replies = usePagedQuery<Comment>(
    ['posts', postId, 'comments', comment.id],
    `/posts/${postId}/comments`,
    { parentId: comment.id },
    { authenticated: false, enabled: repliesOpen },
  );
  useEffect(() => {
    if (!editing) setEditText(comment.content);
  }, [comment.content, editing]);
  const ownComment = sessionState.user?.id === comment.authorId && comment.status === 'PUBLISHED';
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['posts', postId, 'comments'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all }),
    ]);
  };
  const submitReply = () => {
    const text = reply.trim();
    if (!text) return;
    requireAuth({
      reason: 'Đăng nhập để phản hồi bình luận.',
      action: async () => {
        try {
          await session.request(`/posts/${postId}/comments`, {
            method: 'POST',
            body: { content: text, parentId: comment.id },
          });
          setReply('');
          setRepliesOpen(true);
          await refresh();
        } catch (error) {
          toast(errorMessage(error));
        }
      },
    });
  };
  const saveEdit = async () => {
    try {
      await session.request(`/comments/${comment.id}`, { method: 'PATCH', body: { content: editText.trim() } });
      setEditing(false);
      await refresh();
    } catch (error) {
      toast(errorMessage(error));
    }
  };
  const deleteComment = async () => {
    if (!await confirm({ title: 'Xóa bình luận?', destructive: true })) return;
    try {
      await session.request(`/comments/${comment.id}`, { method: 'DELETE' });
      await refresh();
    } catch (error) {
      toast(errorMessage(error));
    }
  };
  return (
    <Card>
      {editing ? (
        <>
          <TextField label="Chỉnh sửa bình luận" value={editText} onChangeText={setEditText} multiline maxLength={2000} />
          <View style={styles.actions}>
            <Button title="Lưu" onPress={() => saveEdit()} disabled={!editText.trim()} />
            <Button title="Hủy" variant="ghost" onPress={() => setEditing(false)} />
          </View>
        </>
      ) : (
        <AppText>{comment.content || 'Bình luận này đã bị ẩn hoặc xóa.'}</AppText>
      )}
      <AppText variant="caption" muted>{comment.replyCount} phản hồi</AppText>
      <View style={styles.actions}>
        <Button
          title={repliesOpen ? 'Ẩn phản hồi' : `Phản hồi · ${comment.replyCount}`}
          variant="secondary"
          onPress={() => setRepliesOpen(value => !value)}
        />
        <Button
          title="Báo cáo"
          variant="ghost"
          onPress={() => requireAuth({
            reason: 'Đăng nhập để gửi báo cáo nội dung.',
            action: () => open({ name: 'report-content', targetType: 'COMMENT', targetId: comment.id }),
          })}
        />
        {ownComment && (
          <>
            <Button title="Sửa" variant="ghost" onPress={() => setEditing(true)} />
            <Button title="Xóa" variant="ghost" onPress={() => deleteComment()} />
          </>
        )}
      </View>
      {repliesOpen && (
        <View style={styles.replyGroup}>
          <TextField label="Viết phản hồi" value={reply} onChangeText={setReply} multiline maxLength={2000} />
          <Button title="Gửi phản hồi" onPress={submitReply} disabled={!reply.trim()} />
          <ModalList
            query={replies}
            renderItem={item => (
              <Card>
                <AppText>{item.content || 'Phản hồi này đã bị ẩn hoặc xóa.'}</AppText>
                <AppText variant="caption" muted>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</AppText>
              </Card>
            )}
            emptyTitle="Chưa có phản hồi"
            emptyDescription="Hãy bắt đầu cuộc trò chuyện."
          />
        </View>
      )}
    </Card>
  );
}

export function ReportContentModal({
  targetType,
  targetId,
}: {
  targetType: 'POST' | 'COMMENT' | 'DOCUMENT';
  targetId: string;
}) {
  const { close, setDirty } = useModal();
  const session = useSessionManager();
  const toast = useToast();
  const uploader = useMemo(() => createFileUploader(session, 'EVIDENCE'), [session]);
  const [reasonCode, setReasonCode] = useState('SPAM');
  const [description, setDescription] = useState('');
  const [evidenceFileId, setEvidenceFileId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDirty(description !== '' || reasonCode !== 'SPAM' || evidenceFileId !== null), [description, reasonCode, evidenceFileId, setDirty]);
  const submit = async () => {
    setBusy(true);
    try {
      await session.request('/reports', {
        method: 'POST',
        body: {
          targetType,
          targetId,
          reasonCode,
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(evidenceFileId ? { evidenceFileIds: [evidenceFileId] } : {}),
        },
      });
      toast('Đã gửi báo cáo. Cảm ơn bạn đã giúp cộng đồng an toàn hơn.');
      setDirty(false);
      close();
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.form}>
      <AppText muted>Báo cáo chỉ được gửi đến nhóm kiểm duyệt.</AppText>
      {[
        ['SPAM', 'Nội dung rác'],
        ['HARASSMENT', 'Quấy rối'],
        ['INAPPROPRIATE', 'Nội dung không phù hợp'],
        ['MISINFORMATION', 'Thông tin sai lệch'],
        ['COPYRIGHT', 'Vi phạm bản quyền'],
        ['OTHER', 'Lý do khác'],
      ].map(([value, label]) => (
        <Button key={value} title={`${reasonCode === value ? '● ' : ''}${label}`} variant={reasonCode === value ? 'secondary' : 'ghost'} onPress={() => setReasonCode(value)} />
      ))}
      <TextField label="Mô tả thêm" value={description} onChangeText={setDescription} multiline maxLength={2000} style={styles.multiline} />
      <UploadPicker
        label="Tệp minh chứng (không bắt buộc)"
        uploader={uploader}
        rules={EVIDENCE_RULES}
        onChange={setEvidenceFileId}
        hint="Ảnh hoặc tài liệu được hỗ trợ; tối đa 20 MB."
      />
      <Button title="Gửi báo cáo" loading={busy} onPress={() => submit()} />
      <Button title="Hủy" variant="ghost" onPress={close} />
    </View>
  );
}

export function DocumentEditorModal() {
  const { close, setDirty } = useModal();
  const session = useSessionManager();
  const queryClient = useQueryClient();
  const toast = useToast();
  const uploader = useMemo(() => createFileUploader(session, 'DOCUMENT'), [session]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [fileId, setFileId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareRightsConfirmed, setShareRightsConfirmed] = useState(false);
  const dirty = title !== '' || description !== '' || category !== '' || fileId !== null || shareRightsConfirmed;
  useEffect(() => setDirty(dirty), [dirty, setDirty]);
  const submit = async () => {
    if (!fileId) return;
    setBusy(true);
    try {
      await session.request('/documents', {
        method: 'POST',
        body: {
          title: title.trim(),
          description: description.trim(),
          category: category.trim(),
          fileId,
          visibility: 'PUBLIC',
          shareRightsConfirmed,
        },
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      toast('Tài liệu đã được gửi để kiểm duyệt.');
      setDirty(false);
      close();
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.form}>
      <AppText muted>Tài liệu sẽ được kiểm duyệt trước khi xuất hiện công khai.</AppText>
      <TextField label="Tiêu đề" value={title} onChangeText={setTitle} maxLength={200} />
      <TextField label="Danh mục" value={category} onChangeText={setCategory} maxLength={80} />
      <TextField label="Mô tả" value={description} onChangeText={setDescription} multiline maxLength={3000} style={styles.multiline} />
      <UploadPicker
        label="Tệp tài liệu"
        uploader={uploader}
        rules={DOCUMENT_RULES}
        onChange={setFileId}
        hint="PDF, DOCX, PPTX, XLSX hoặc TXT; tối đa 20 MB."
      />
      <Button
        variant={shareRightsConfirmed ? 'secondary' : 'ghost'}
        title={`${shareRightsConfirmed ? '✓ ' : ''}Tôi có quyền chia sẻ tài liệu này`}
        onPress={() => setShareRightsConfirmed(value => !value)}
      />
      <Button title="Gửi kiểm duyệt" loading={busy} disabled={!fileId || title.trim().length < 3 || category.trim().length < 2 || !shareRightsConfirmed} onPress={() => submit()} />
      <Button title="Hủy" variant="ghost" onPress={close} />
    </View>
  );
}

export function DocumentDetailModal({ documentId }: { documentId: string }) {
  const query = useApiQuery<DocumentItem>(queryKeys.documents.detail(documentId), `/documents/${documentId}`, { authenticated: false });
  const session = useSessionManager();
  const toast = useToast();
  const open = async (action: 'preview-access' | 'download-access') => {
    try {
      const access = await session.publicRequest<{ url: string }>(
        `/documents/${documentId}/${action}`,
        { method: action === 'preview-access' ? 'GET' : 'POST' },
      );
      await Linking.openURL(access.url);
    } catch (error) {
      toast(errorMessage(error));
    }
  };
  if (query.isPending) return <EmptyState title="Đang tải tài liệu" description="Vui lòng đợi trong giây lát." />;
  if (query.error || !query.data) return <EmptyState title="Chưa thể tải tài liệu" description={query.error?.message ?? 'Tài liệu không khả dụng.'} action={{ label: 'Thử lại', onPress: () => query.refetch() }} />;
  return (
    <View style={styles.form}>
      <AppText variant="heading">{query.data.title}</AppText>
      <AppText variant="caption" muted>{query.data.category} · {query.data.format}</AppText>
      <AppText>{query.data.description ?? 'Không có mô tả.'}</AppText>
      <Button title="Xem trước" variant="secondary" onPress={() => open('preview-access')} />
      <Button title="Tải xuống" onPress={() => open('download-access')} />
    </View>
  );
}

function ModalList<T>({
  query,
  renderItem,
  header,
  emptyTitle,
  emptyDescription,
}: {
  query: PagedQuery<T>;
  renderItem: (item: T) => ReactNode;
  header?: ReactNode;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (header) return (
    <View style={styles.form}>
      {header}
      <ModalListItems query={query} renderItem={renderItem} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />
    </View>
  );
  return <ModalListItems query={query} renderItem={renderItem} emptyTitle={emptyTitle} emptyDescription={emptyDescription} />;
}

function ModalListItems<T>({
  query,
  renderItem,
  emptyTitle,
  emptyDescription,
}: {
  query: PagedQuery<T>;
  renderItem: (item: T) => ReactNode;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (query.status === 'loading') return <EmptyState title="Đang tải" description="Vui lòng đợi trong giây lát." />;
  if (query.status === 'error') return <EmptyState title="Chưa thể tải nội dung" description={query.error?.message ?? 'Đã xảy ra lỗi.'} action={{ label: 'Thử lại', onPress: query.retry }} />;
  if (query.items.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <View style={styles.form}>
      {query.items.map((item, index) => {
        const key = typeof item === 'object' && item !== null && 'id' in item && typeof item.id === 'string'
          ? item.id
          : String(index);
        return <View key={key}>{renderItem(item)}</View>;
      })}
      {query.hasNext && <Button title="Tải thêm" variant="secondary" loading={query.isFetchingNext} onPress={query.fetchNext} />}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { gap: 12, paddingBottom: 8 },
  heading: { gap: 8 },
  kicker: { color: colors.primary, fontWeight: '700', letterSpacing: 0.6 },
  postHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  form: { gap: 16 },
  multiline: { minHeight: 140, textAlignVertical: 'top' },
  unread: { borderColor: colors.primary },
  postImage: { width: '100%', height: 220, borderRadius: 16, backgroundColor: colors.primarySoft },
  replyGroup: { gap: 12, paddingLeft: 12 },
});
