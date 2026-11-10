import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BookOpen, Compass, Sprout, Users } from 'lucide-react-native';
import type { FeatureId } from '../../navigation/types';
import { colors } from '../../shared/theme/tokens';
import { AppText, Card, EmptyState, Screen } from '../../shared/ui';
import { features } from './features';

export function PendingFeature({ feature }: { feature: FeatureId }) {
  return (
    <EmptyState
      icon={<Sprout size={30} color={colors.primary} />}
      title="Sắp có trên StudySpace"
      description={`${features[feature].description} Tính năng này đang được hoàn thiện.`}
    />
  );
}

function FeatureScreen({
  feature,
  label,
}: {
  feature: 'places' | 'community' | 'documents';
  label: string;
}) {
  const Icon =
    feature === 'places' ? Compass : feature === 'community' ? Users : BookOpen;
  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="caption" muted>
          STUDYSPACE / {label}
        </AppText>
        <AppText variant="title">{features[feature].title}</AppText>
      </View>
      <View style={styles.banner}>
        <Icon size={46} color={colors.primary} strokeWidth={1.4} />
        <AppText variant="heading" style={styles.center}>
          {feature === 'places'
            ? 'Một nơi để tập trung.'
            : feature === 'community'
            ? 'Học tốt hơn, cùng nhau.'
            : 'Kiến thức để sẻ chia.'}
        </AppText>
      </View>
      <Card>
        <PendingFeature feature={feature} />
      </Card>
    </Screen>
  );
}
export function ExploreScreen() {
  return <FeatureScreen feature="places" label="KHÁM PHÁ" />;
}
export function CommunityScreen() {
  return <FeatureScreen feature="community" label="CỘNG ĐỒNG" />;
}
export function DocumentsScreen() {
  return <FeatureScreen feature="documents" label="TÀI LIỆU" />;
}
const styles = StyleSheet.create({
  header: { gap: 8 },
  banner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    padding: 32,
    backgroundColor: colors.primarySoft,
    borderRadius: 24,
  },
  center: { textAlign: 'center' },
});
