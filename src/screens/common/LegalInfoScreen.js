import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import Icon from '../../components/common/Icon';
import { FAQ_CONTENT, LEGAL_CONTENT, ROLE_LABELS } from '../../constants/legalContent';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const FAQ_COLOR = '#6C63D9';
const LEGAL_COLOR = '#3157B7';

export default function LegalInfoScreen() {
  const route = useRoute();
  const { type = 'faq', role = 'manager' } = route.params || {};
  const isFaq = type === 'faq';
  const title = isFaq ? 'FAQ' : 'Laws & Policies';
  const entries = useMemo(() => {
    if (isFaq) return FAQ_CONTENT[role] || FAQ_CONTENT.manager;
    return LEGAL_CONTENT[role] || LEGAL_CONTENT.manager;
  }, [isFaq, role]);
  const [expandedQuestion, setExpandedQuestion] = useState(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All topics');

  const categories = useMemo(
    () => ['All topics', ...new Set(entries.map((entry) => entry.category).filter(Boolean))],
    [entries],
  );
  const filteredFaqs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter((entry) => (
      (activeCategory === 'All topics' || entry.category === activeCategory)
      && (!query || `${entry.question} ${entry.answer} ${entry.category || ''}`.toLowerCase().includes(query))
    ));
  }, [activeCategory, entries, search]);

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

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.hero, !isFaq && styles.legalHero]}>
            <View style={[styles.heroIcon, !isFaq && styles.legalHeroIcon]}>
              <Icon
                name={isFaq ? 'question' : 'document'}
                size={25}
                color={isFaq ? FAQ_COLOR : LEGAL_COLOR}
                weight="duotone"
              />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>{ROLE_LABELS[role] || 'ChemStock user'}</Text>
              <Text style={styles.heroTitle}>
                {isFaq ? 'Here to help you get things done' : 'Clear guidance for responsible use'}
              </Text>
              <Text style={styles.heroText}>
                {isFaq
                  ? 'Search common questions or choose a topic to find a practical answer.'
                  : 'Review the privacy and operating guidance for your ChemStock role.'}
              </Text>
            </View>
          </View>

          {isFaq ? (
            <>
              <View style={styles.searchBox}>
                <Icon name="search" size={19} color={COLORS.textTertiary} />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search questions"
                  placeholderTextColor={COLORS.textTertiary}
                  returnKeyType="search"
                  accessibilityLabel="Search frequently asked questions"
                />
                {search.length > 0 && (
                  <Pressable
                    onPress={() => setSearch('')}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                  >
                    <Text style={styles.clearSearch}>Clear</Text>
                  </Pressable>
                )}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryList}
              >
                {categories.map((category) => {
                  const selected = activeCategory === category;
                  return (
                    <Pressable
                      key={category}
                      onPress={() => {
                        setActiveCategory(category);
                        setExpandedQuestion(null);
                      }}
                      style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>
                        {category}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.resultHeading}>
                <Text style={styles.sectionLabel}>Questions</Text>
                <Text style={styles.resultCount}>{filteredFaqs.length} topics</Text>
              </View>

              {filteredFaqs.length > 0 ? filteredFaqs.map((entry) => {
                const isExpanded = expandedQuestion === entry.question;
                return (
                  <View key={entry.question} style={[styles.faqCard, isExpanded && styles.faqCardExpanded]}>
                    <Pressable
                      style={styles.questionRow}
                      onPress={() => setExpandedQuestion(isExpanded ? null : entry.question)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isExpanded }}
                    >
                      <View style={[styles.entryIcon, isExpanded && styles.entryIconSelected]}>
                        <Icon name="question" size={18} color={FAQ_COLOR} weight="duotone" />
                      </View>
                      <View style={styles.questionCopy}>
                        <Text style={styles.question}>{entry.question}</Text>
                        <Text style={styles.questionCategory}>{entry.category || 'General'}</Text>
                      </View>
                      <View style={[styles.expandIcon, isExpanded && styles.expandIconSelected]}>
                        <Icon
                          name="caretDown"
                          size={17}
                          color={isExpanded ? '#FFFFFF' : COLORS.textSecondary}
                        />
                      </View>
                    </Pressable>
                    {isExpanded && (
                      <View style={styles.answerWrap}>
                        <View style={styles.answerDivider} />
                        <Text style={styles.answer}>{entry.answer}</Text>
                      </View>
                    )}
                  </View>
                );
              }) : (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Icon name="search" size={22} color={FAQ_COLOR} />
                  </View>
                  <Text style={styles.emptyTitle}>No matching questions</Text>
                  <Text style={styles.emptyText}>Try another search or choose a different topic.</Text>
                  <Pressable
                    onPress={() => {
                      setSearch('');
                      setActiveCategory('All topics');
                    }}
                    style={styles.resetButton}
                    accessibilityRole="button"
                  >
                    <Text style={styles.resetButtonText}>Show all questions</Text>
                  </Pressable>
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.guidanceBanner}>
                <Icon name="info" size={19} color={LEGAL_COLOR} />
                <Text style={styles.guidanceText}>
                  This is practical in-app guidance, not legal advice. Follow your organization’s approved policies and applicable requirements.
                </Text>
              </View>

              {entries.map((entry) => (
                <View key={entry.title} style={styles.legalCard}>
                  <View style={styles.legalHeading}>
                    <View style={styles.legalIcon}>
                      <Icon name={entry.icon || 'document'} size={20} color={LEGAL_COLOR} weight="duotone" />
                    </View>
                    <View style={styles.legalTitleCopy}>
                      <Text style={styles.legalTitle}>{entry.title}</Text>
                      {entry.reference && <Text style={styles.legalReference}>{entry.reference}</Text>}
                    </View>
                  </View>
                  {entry.summary && <Text style={styles.legalSummary}>{entry.summary}</Text>}
                  {entry.paragraphs.map((paragraph, index) => (
                    <Text key={`${entry.title}-p-${index}`} style={styles.legalParagraph}>
                      {paragraph}
                    </Text>
                  ))}
                  {entry.practices?.length > 0 && (
                    <View style={styles.practiceBox}>
                      <Text style={styles.practiceTitle}>What to do</Text>
                      {entry.practices.map((practice) => (
                        <View key={practice} style={styles.practiceRow}>
                          <Icon name="checkCircle" size={16} color="#27834A" />
                          <Text style={styles.practiceText}>{practice}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </>
          )}
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
    backgroundColor: '#F0EEFF',
    borderRadius: 18,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  legalHero: {
    backgroundColor: '#EDF3FF',
  },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginRight: SPACING.sm,
  },
  legalHeroIcon: {
    backgroundColor: '#FFFFFF',
  },
  heroCopy: {
    flex: 1,
  },
  eyebrow: {
    color: FAQ_COLOR,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  heroTitle: {
    color: '#18233A',
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    lineHeight: 21,
    marginBottom: 3,
  },
  heroText: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.fontSize.xs,
    lineHeight: 18,
  },
  searchBox: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E5E9F0',
    marginBottom: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    paddingVertical: 10,
    paddingHorizontal: SPACING.sm,
  },
  clearSearch: {
    color: FAQ_COLOR,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  categoryList: {
    paddingBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  categoryChip: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E9F0',
  },
  categoryChipSelected: {
    backgroundColor: FAQ_COLOR,
    borderColor: FAQ_COLOR,
  },
  categoryChipText: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  resultHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  sectionLabel: {
    color: '#18233A',
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  resultCount: {
    color: COLORS.textTertiary,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E9EDF3',
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  faqCardExpanded: {
    borderColor: '#D9D5FF',
  },
  questionRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  entryIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0EEFF',
    marginRight: SPACING.sm,
  },
  entryIconSelected: {
    backgroundColor: '#E9E6FF',
  },
  questionCopy: {
    flex: 1,
    paddingRight: SPACING.xs,
  },
  question: {
    color: '#18233A',
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 20,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  questionCategory: {
    color: FAQ_COLOR,
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginTop: 3,
  },
  expandIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F5F8',
  },
  expandIconSelected: {
    backgroundColor: FAQ_COLOR,
    transform: [{ rotate: '180deg' }],
  },
  answerWrap: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  answerDivider: {
    height: 1,
    backgroundColor: '#EEF0F5',
    marginBottom: SPACING.sm,
  },
  answer: {
    color: '#465166',
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 22,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9EDF3',
  },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0EEFF',
    marginBottom: SPACING.sm,
  },
  emptyTitle: {
    color: '#18233A',
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginBottom: 4,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  resetButton: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#F0EEFF',
    borderRadius: 10,
  },
  resetButtonText: {
    color: FAQ_COLOR,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  guidanceBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EDF3FF',
    borderRadius: 13,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  guidanceText: {
    flex: 1,
    color: '#3F5276',
    fontSize: TYPOGRAPHY.fontSize.xs,
    lineHeight: 18,
    marginLeft: SPACING.xs,
  },
  legalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E7EBF2',
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  legalHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  legalIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF3FF',
    marginRight: SPACING.sm,
  },
  legalTitleCopy: {
    flex: 1,
  },
  legalTitle: {
    color: '#18233A',
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: 21,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  legalReference: {
    color: LEGAL_COLOR,
    fontSize: TYPOGRAPHY.fontSize.xs,
    lineHeight: 17,
    marginTop: 3,
  },
  legalSummary: {
    color: '#3F5276',
    backgroundColor: '#F3F6FC',
    borderRadius: 10,
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  legalParagraph: {
    color: '#465166',
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 22,
    marginBottom: SPACING.sm,
  },
  practiceBox: {
    backgroundColor: '#F5F8F5',
    borderRadius: 12,
    padding: SPACING.sm,
    marginTop: 2,
  },
  practiceTitle: {
    color: '#245E3A',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginBottom: SPACING.xs,
  },
  practiceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: SPACING.xs,
  },
  practiceText: {
    flex: 1,
    color: '#43554A',
    fontSize: TYPOGRAPHY.fontSize.xs,
    lineHeight: 18,
    marginLeft: SPACING.xs,
  },
});
