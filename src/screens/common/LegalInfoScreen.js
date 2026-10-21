import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import Icon from '../../components/common/Icon';
import { FAQ_CONTENT, LEGAL_CONTENT, ROLE_LABELS } from '../../constants/legalContent';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

// A different colour for each entry, so the list is easy to tell apart at a glance.
const TONES = ['#0085F9', '#2E9E5B', '#D98200', '#7B6FE8', '#E5484D', '#0E9AA7', '#4F5BD5'];
const toneFor = (index) => TONES[index % TONES.length];

export default function LegalInfoScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { type = 'faq', role = 'manager' } = route.params || {};

  const title = type === 'faq' ? 'FAQ' : 'Laws';
  const entries = useMemo(() => {
    if (type === 'faq') return FAQ_CONTENT[role] || FAQ_CONTENT.manager;
    return LEGAL_CONTENT[role] || LEGAL_CONTENT.manager;
  }, [role, type]);
  const [expandedIndex, setExpandedIndex] = useState(null);

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          title={title}
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Icon name={type === 'faq' ? 'question' : 'document'} size={26} color={type === 'faq' ? '#7B6FE8' : '#4F5BD5'} weight="duotone" />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{title === 'FAQ' ? 'Help for your ChemStock workflow' : 'Rules that guide safe use'}</Text>
              <Text style={styles.heroText}>
                {ROLE_LABELS[role] || 'ChemStock user'} · {type === 'faq' ? 'Quick answers for everyday tasks.' : 'Privacy, accountability, and operational policies.'}
              </Text>
            </View>
          </View>

          {type === 'faq' && <Text style={styles.sectionLabel}>Common questions</Text>}
          {entries.map((entry, index) => (
            <View key={`${entry.title || 'question'}-${index}`} style={styles.entry}>
              {type === 'faq' ? (
                <>
                  <Pressable
                    style={styles.questionRow}
                    onPress={() => setExpandedIndex(expandedIndex === index ? null : index)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: expandedIndex === index }}
                  >
                    <View style={[styles.entryIcon, { backgroundColor: toneFor(index) + '1A' }]}>
                      <Icon name={entry.icon || 'question'} size={19} color={toneFor(index)} weight="duotone" />
                    </View>
                    <Text style={styles.question}>{entry.question}</Text>
                    <Icon name={expandedIndex === index ? 'caretDown' : 'arrowRight'} size={18} color={COLORS.textTertiary} />
                  </Pressable>
                  {expandedIndex === index && <Text style={styles.answerIndented}>{entry.answer}</Text>}
                  {entry.category && expandedIndex === index && <Text style={styles.category}>{entry.category}</Text>}
                </>
              ) : (
                <>
                  <View style={styles.lawHeading}>
                    <View style={[styles.entryIcon, { backgroundColor: toneFor(index) + '1A' }]}>
                      <Icon name={entry.icon || 'document'} size={20} color={toneFor(index)} weight="duotone" />
                    </View>
                    <Text style={styles.sectionTitle}>{entry.title}</Text>
                  </View>
                  {entry.paragraphs.map((paragraph, paragraphIndex) => (
                    <Text key={`${entry.title}-p-${paragraphIndex}`} style={styles.answer}>
                      {paragraph}
                    </Text>
                  ))}
                </>
              )}
            </View>
          ))}
          {type === 'legal' && <Text style={styles.disclaimer}>These in-app guidelines support ChemStock operations. Follow your organization’s approved policies and applicable Philippine regulations when they provide a stricter requirement.</Text>}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 14,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginRight: SPACING.sm,
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginBottom: 3,
  },
  heroText: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.fontSize.xs,
    lineHeight: 18,
  },
  sectionLabel: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginBottom: SPACING.sm,
  },
  // No card boxes: each entry sits on the screen, split by a thin line.
  entry: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  question: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#111827',
    marginBottom: SPACING.xs,
  },
  category: {
    color: COLORS.secondaryDark,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginTop: 2,
    marginBottom: SPACING.xs,
    marginLeft: 46,
  },
  answerIndented: {
    marginTop: SPACING.sm,
    marginLeft: 46,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: '#374151',
    lineHeight: 22,
  },
  lawHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#111827',
    marginBottom: SPACING.sm,
  },
  answer: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: '#374151',
    lineHeight: 22,
    marginBottom: SPACING.sm,
  },
  disclaimer: {
    color: COLORS.textTertiary,
    fontSize: TYPOGRAPHY.fontSize.xs,
    lineHeight: 18,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
});
