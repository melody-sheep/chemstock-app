// src/screens/manager/ManagerReportsScreen.js
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Icon from '../../components/common/Icon';
import BottomNavBar from '../../components/common/BottomNavBar';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import authService from '../../services/authService';
import reportService from '../../services/reportService';
import { supabase } from '../../services/supabaseClient';
import { formatDisplayDate } from '../../utils/formatters';

const PERIOD_TYPES = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function getPeriodRange(periodType, anchorDate) {
  if (periodType === 'weekly') {
    const start = startOfWeek(anchorDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start, end };
  }
  const start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const end = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
  return { start, end };
}

function shiftAnchor(periodType, anchorDate, direction) {
  const next = new Date(anchorDate);
  if (periodType === 'weekly') {
    next.setDate(next.getDate() + direction * 7);
  } else {
    next.setMonth(next.getMonth() + direction);
  }
  return next;
}

function buildReportHtml({ branchName, periodLabel, periodRange, products, systemDetails, managerName, signOffDate }) {
  const rows = products
    .map(
      (p) => `
        <tr>
          <td>${p.productCode}</td>
          <td>${p.actualInventory}</td>
          <td>${p.sales}</td>
          <td>${p.returned}</td>
          <td class="${p.loss > 0 ? 'loss' : ''}">${p.loss}</td>
          <td class="${p.over > 0 ? 'over' : ''}">${p.over}</td>
        </tr>`
    )
    .join('');

  const totals = products.reduce(
    (acc, p) => {
      acc.actual += p.actualInventory;
      acc.sales += p.sales;
      acc.returned += p.returned;
      acc.loss += p.loss;
      acc.over += p.over;
      return acc;
    },
    { actual: 0, sales: 0, returned: 0, loss: 0, over: 0 }
  );

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #272632; }
          h1 { font-size: 20px; margin-bottom: 2px; }
          .subtitle { color: #555353; font-size: 12px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th, td { border: 1px solid #DBE4EE; padding: 8px 10px; font-size: 12px; text-align: left; }
          th { background: #F1F3F6; font-weight: 700; }
          td.loss { color: #B91C1C; font-weight: 700; }
          td.over { color: #B26400; font-weight: 700; }
          tfoot td { font-weight: 700; background: #F8FAFC; }
          .sign-row { margin-top: 32px; font-size: 12px; }
          .sign-row span { display: inline-block; min-width: 220px; border-bottom: 1px solid #272632; margin-right: 24px; padding-bottom: 2px; }
          .details { margin-top: 24px; font-size: 11px; color: #555353; }
          .details div { margin-bottom: 4px; }
        </style>
      </head>
      <body>
        <h1>${branchName} — ${periodLabel} Stock Report</h1>
        <div class="subtitle">${periodRange}</div>
        <table>
          <thead>
            <tr><th>Code</th><th>Actual Inv</th><th>Sales</th><th>Returned</th><th>Loss</th><th>Over</th></tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <td>Totals</td>
              <td>${totals.actual}</td>
              <td>${totals.sales}</td>
              <td>${totals.returned}</td>
              <td>${totals.loss}</td>
              <td>${totals.over}</td>
            </tr>
          </tfoot>
        </table>
        <div class="sign-row">Manager Sign-off: <span>${managerName || ''}</span> Date: <span>${signOffDate}</span></div>
        <div class="details">
          <div><strong>System Extra Details</strong></div>
          <div>Reports accepted: ${systemDetails?.reportsAccepted ?? 0} · Auto-filed (missed): ${systemDetails?.reportsAutoFiled ?? 0}</div>
          <div>Discrepancy resolutions accepted: ${systemDetails?.discrepancyResolutionsAccepted ?? 0}</div>
          <div>Photo-verified resolutions: ${systemDetails?.photoVerifiedResolutions ?? 0} · Geotagged resolutions: ${systemDetails?.geotaggedResolutions ?? 0}</div>
        </div>
      </body>
    </html>
  `;
}

export default function ManagerReportsScreen() {
  const navigation = useNavigation();
  const [manager, setManager] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [periodType, setPeriodType] = useState('monthly');
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [managerName, setManagerName] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      async function init() {
        const currentManager = await authService.getCurrentUser();
        if (cancelled) return;
        setManager(currentManager);
        setManagerName(currentManager?.full_name || currentManager?.username || '');

        const branchIds = currentManager?.branchIds || [];
        if (branchIds.length === 0) return;

        const { data } = await supabase.from('branches').select('id, name').in('id', branchIds);
        if (cancelled) return;
        setBranches(data || []);
        setSelectedBranchId((prev) => prev || branchIds[0]);
      }
      init();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const loadReport = useCallback(async () => {
    if (!selectedBranchId) return;
    setIsLoading(true);
    const { start, end } = getPeriodRange(periodType, anchorDate);
    const result = await reportService.getBranchReport(selectedBranchId, toISODate(start), toISODate(end));
    setReport(result.success ? result.data : null);
    setIsLoading(false);
  }, [selectedBranchId, periodType, anchorDate]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleTabPress = (key) => {
    if (key === 'dashboard') {
      navigation.navigate('ManagerDashboard');
    } else if (key === 'stock') {
      navigation.navigate('ManagerStock');
    } else if (key === 'reports') {
      navigation.navigate('ManagerReports');
    } else if (key === 'settings') {
      navigation.navigate('ManagerSettings');
    } else {
      navigation.navigate('ComingSoon', { tabKey: key, role: 'manager' });
    }
  };

  const { start, end } = getPeriodRange(periodType, anchorDate);
  const periodLabel = periodType === 'weekly' ? 'Weekly' : 'Monthly';
  const periodRangeLabel = `${formatDisplayDate(toISODate(start))} – ${formatDisplayDate(toISODate(end))}`;
  const branchName = branches.find((b) => b.id === selectedBranchId)?.name || '';
  const products = report?.products || [];
  const systemDetails = report?.systemDetails;

  const buildHtml = () =>
    buildReportHtml({
      branchName,
      periodLabel,
      periodRange: periodRangeLabel,
      products,
      systemDetails,
      managerName,
      signOffDate: formatDisplayDate(toISODate(new Date())),
    });

  const handlePrint = async () => {
    setIsExporting(true);
    try {
      await Print.printAsync({ html: buildHtml() });
    } catch (error) {
      Alert.alert('Print Failed', error.message || 'Could not open the print dialog.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: buildHtml() });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Save Report PDF' });
      } else {
        Alert.alert('PDF Ready', `Saved to: ${uri}`);
      }
    } catch (error) {
      Alert.alert('Export Failed', error.message || 'Could not generate the PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleShareToChat = async () => {
    setIsExporting(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: buildHtml() });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Report' });
      } else {
        Alert.alert('Sharing Unavailable', 'Sharing is not available on this device.');
      }
    } catch (error) {
      Alert.alert('Share Failed', error.message || 'Could not share the report.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText="Manager Dashboard"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <SecondaryHeader height={56}>
          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>Branch Report</Text>
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>
        </SecondaryHeader>

        <View style={styles.controlsWrap}>
          <View style={styles.periodTypeRow}>
            {PERIOD_TYPES.map((p) => {
              const isActive = p.key === periodType;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.periodTypeButton, isActive && styles.periodTypeButtonActive]}
                  onPress={() => {
                    setPeriodType(p.key);
                    setAnchorDate(new Date());
                  }}
                >
                  <Text style={[styles.periodTypeText, isActive && styles.periodTypeTextActive]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.rangeRow}>
            <TouchableOpacity onPress={() => setAnchorDate(shiftAnchor(periodType, anchorDate, -1))} style={styles.rangeArrow}>
              <Icon name="arrowLeft" size={16} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.rangeText}>{periodRangeLabel}</Text>
            <TouchableOpacity onPress={() => setAnchorDate(shiftAnchor(periodType, anchorDate, 1))} style={styles.rangeArrow}>
              <Icon name="arrowRight" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {branches.length > 1 && (
            <View style={styles.branchChipsRow}>
              {branches.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.branchChip, selectedBranchId === b.id && styles.branchChipActive]}
                  onPress={() => setSelectedBranchId(b.id)}
                >
                  <Text style={[styles.branchChipText, selectedBranchId === b.id && styles.branchChipTextActive]}>
                    {b.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.previewLabel}>LIVE PAPER SHEET PREVIEW</Text>
            <Text style={styles.previewHint}>(Scroll right to review all columns)</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colCode]}>Code</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colNum]}>Actual Inv</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colNum]}>Sales</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colNum]}>Returned</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colNum]}>Loss</Text>
                  <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colNum]}>Over</Text>
                </View>

                {products.length === 0 ? (
                  <Text style={styles.emptyText}>No accepted reports in this period yet.</Text>
                ) : (
                  products.map((p) => (
                    <View key={p.productCode} style={styles.tableRow}>
                      <Text style={[styles.tableCell, styles.colCode]}>{p.productCode}</Text>
                      <Text style={[styles.tableCell, styles.colNum]}>{p.actualInventory}</Text>
                      <Text style={[styles.tableCell, styles.colNum]}>{p.sales}</Text>
                      <Text style={[styles.tableCell, styles.colNum]}>{p.returned}</Text>
                      <Text style={[styles.tableCell, styles.colNum, p.loss > 0 && styles.lossCell]}>{p.loss}</Text>
                      <Text style={[styles.tableCell, styles.colNum, p.over > 0 && styles.overCell]}>{p.over}</Text>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>

            <View style={styles.signOffCard}>
              <Text style={styles.signOffLabel}>Manager Sign-off:</Text>
              <TextInput
                style={styles.signOffInput}
                value={managerName}
                onChangeText={setManagerName}
                placeholder="Your name"
              />
              <Text style={styles.signOffDate}>Date: {formatDisplayDate(toISODate(new Date()))}</Text>
            </View>

            <TouchableOpacity
              style={[styles.actionButton, styles.printButton]}
              onPress={handlePrint}
              disabled={isExporting}
            >
              <Icon name="trayUp" size={18} color="#0085F9" />
              <Text style={styles.actionButtonTextBlue}>Share to Printer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.pdfButton]}
              onPress={handleDownloadPdf}
              disabled={isExporting}
            >
              <Icon name="document" size={18} color="#0085F9" />
              <Text style={styles.actionButtonTextBlue}>Download Clean PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.chatButton]}
              onPress={handleShareToChat}
              disabled={isExporting}
            >
              <Icon name="send" size={18} color="#03045E" />
              <Text style={styles.actionButtonTextNavy}>Share to Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.detailsToggle}
              onPress={() => setIsDetailsExpanded((v) => !v)}
            >
              <Text style={styles.detailsToggleText}>System Extra Details</Text>
              <Icon
                name="caretDown"
                size={16}
                color={COLORS.textSecondary}
                style={isDetailsExpanded ? styles.caretExpanded : undefined}
              />
            </TouchableOpacity>

            {isDetailsExpanded && systemDetails && (
              <View style={styles.detailsCard}>
                <Text style={styles.detailsRow}>Reports accepted: {systemDetails.reportsAccepted}</Text>
                <Text style={styles.detailsRow}>Reports auto-filed (missed): {systemDetails.reportsAutoFiled}</Text>
                <Text style={styles.detailsRow}>Discrepancy resolutions accepted: {systemDetails.discrepancyResolutionsAccepted}</Text>
                <Text style={styles.detailsRow}>Photo-verified resolutions: {systemDetails.photoVerifiedResolutions}</Text>
                <Text style={styles.detailsRow}>Geotagged resolutions: {systemDetails.geotaggedResolutions}</Text>
              </View>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>
        )}

        <BottomNavBar activeTab="reports" onTabPress={handleTabPress} onFabPress={() => {}} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  pageTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  controlsWrap: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    gap: SPACING.sm,
  },
  periodTypeRow: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: '#F1F3F6',
    padding: 4,
  },
  periodTypeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  periodTypeButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  periodTypeText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: COLORS.textSecondary,
  },
  periodTypeTextActive: {
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  rangeArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#272632',
  },
  branchChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  branchChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#F1F3F6',
  },
  branchChipActive: {
    backgroundColor: COLORS.primaryLight,
  },
  branchChipText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: COLORS.textSecondary,
  },
  branchChipTextActive: {
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: 96,
  },
  previewLabel: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#272632',
  },
  previewHint: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F3F6',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  tableCell: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: '#272632',
  },
  tableHeaderCell: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  colCode: { width: 120 },
  colNum: { width: 90, textAlign: 'right' },
  lossCell: { color: '#B91C1C', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  overCell: { color: '#B26400', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  emptyText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    paddingVertical: 16,
  },
  signOffCard: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  signOffLabel: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#272632',
  },
  signOffInput: {
    borderWidth: 1,
    borderColor: '#DBE4EE',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: '#272632',
  },
  signOffDate: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    height: 48,
    marginTop: 12,
  },
  printButton: { backgroundColor: '#E3F2FF' },
  pdfButton: { backgroundColor: '#E3F2FF' },
  chatButton: { backgroundColor: '#EDEBFF' },
  actionButtonTextBlue: {
    color: '#0085F9',
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  actionButtonTextNavy: {
    color: '#03045E',
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  detailsToggleText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#272632',
  },
  detailsCard: {
    marginTop: 8,
    gap: 4,
  },
  detailsRow: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  caretExpanded: {
    transform: [{ rotate: '180deg' }],
  },
});
