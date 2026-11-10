import React, { useEffect, useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { colors } from '../theme/tokens';
import type { FileUploader, UploadRules } from '../upload/types';
import { useUpload } from '../upload/useUpload';
import { AppText } from './AppText';
import { Button } from './Button';

export function ProgressBar({ fraction, label }: { fraction: number; label?: string }) {
  const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Tiến trình tải lên'}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={styles.track}
    >
      <View style={[styles.fill, { width: `${percent}%` }]} />
    </View>
  );
}

type Props = {
  label: string;
  uploader: FileUploader;
  rules: UploadRules;
  // Called with the server's fileId only once the file is READY; null again when the user removes it.
  onChange: (fileId: string | null) => void;
  chooseLabel?: string;
  hint?: string;
};

/**
 * Pick -> upload with progress -> READY. Shows retry on failure and lets the user cancel or replace.
 * The parent only ever sees a READY fileId (U06: "READY mới apply fileId").
 */
export function UploadPicker({ label, uploader, rules, onChange, chooseLabel = 'Chọn tệp', hint }: Props) {
  const { state, choose, retry, clear } = useUpload(uploader, rules);
  const report = useRef(onChange);
  report.current = onChange;
  const lastReported = useRef<string | null>(null);
  const readyId = state.phase === 'ready' ? state.fileId : null;
  useEffect(() => {
    // Tell the parent only about changes: opening the screen must not wipe an existing value.
    if (readyId !== lastReported.current) {
      lastReported.current = readyId;
      report.current(readyId);
    }
  }, [readyId]);

  return (
    <View style={styles.group}>
      <AppText variant="label">{label}</AppText>
      {state.phase === 'idle' && (
        <>
          <Button variant="secondary" title={chooseLabel} onPress={choose} />
          {hint ? (
            <AppText variant="caption" muted>
              {hint}
            </AppText>
          ) : null}
        </>
      )}
      {state.phase !== 'idle' && (
        <View style={styles.card}>
          <View style={styles.row}>
            {state.file.mimeType.startsWith('image/') ? (
              <Image
                source={{ uri: state.file.uri }}
                style={styles.thumb}
                accessibilityIgnoresInvertColors
              />
            ) : null}
            <AppText style={styles.name} numberOfLines={1}>
              {state.file.name}
            </AppText>
          </View>
          {state.phase === 'uploading' && (
            <>
              <ProgressBar fraction={state.progress} />
              <AppText variant="caption" muted>
                Đang tải lên… {Math.round(state.progress * 100)}%
              </AppText>
              <Button variant="ghost" title="Hủy" onPress={clear} />
            </>
          )}
          {state.phase === 'ready' && (
            <>
              <AppText variant="caption" style={styles.ok}>
                Đã tải lên
              </AppText>
              <Button variant="secondary" title="Đổi tệp" onPress={choose} />
              <Button variant="ghost" title="Gỡ" onPress={clear} />
            </>
          )}
          {state.phase === 'failed' && (
            <>
              <AppText accessibilityLiveRegion="polite" variant="caption" style={styles.error}>
                {state.message}
              </AppText>
              <Button variant="secondary" title="Thử lại" onPress={retry} />
              <Button variant="ghost" title="Chọn tệp khác" onPress={choose} />
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 10 },
  card: {
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.primarySoft },
  name: { flex: 1 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.primarySoft, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.primary },
  ok: { color: colors.primary },
  error: { color: colors.error },
});
