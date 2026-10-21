// src/screens/manager/ManagerReportsScreen.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Animated, StyleSheet } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import Icon from '../../components/common/Icon';
import Button from '../../components/common/Button';
import BranchSelector from '../../components/common/BranchSelector';
import SectionHeader from '../../components/common/SectionHeader';
import SignaturePad from '../../components/common/SignaturePad';
import BottomNavBar, { useBottomNavBarHeight } from '../../components/common/BottomNavBar';
import QRScannerModal from '../../components/common/QRScannerModal';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import authService from '../../services/authService';
import reportService from '../../services/reportService';
import inventoryService from '../../services/inventoryService';
import { supabase } from '../../services/supabaseClient';
import storage from '../../utils/storage';
import { formatDisplayDate } from '../../utils/formatters';
import { describeReceivingScan } from '../../utils/scanLookup';
import ScanResultSheet from '../../components/common/ScanResultSheet';
import { getSignature, saveSignature, clearSignature, signatureToSvg } from '../../utils/signature';

const PERIOD_TYPES = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

const REPORT_KINDS = [
  { key: 'transaction', label: 'Transaction Report' },
  { key: 'received', label: 'Received Stocks' },
];

// Saved reports, same prefix as the other offline screen caches.
const REPORT_CACHE_PREFIX = 'chemstock_cache_manager-report:';

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Built from the phone's local date. toISOString() converts to UTC first,
// which in the Philippines (UTC+8) moved every date back a day — October
// came out as Sep 30 – Oct 30.
function toISODate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
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
    // Move from the 1st: shifting from the 29th-31st overflowed into the wrong month
    // (Oct 31 minus a month became Oct 1, Jan 31 plus a month skipped February).
    return new Date(anchorDate.getFullYear(), anchorDate.getMonth() + direction, 1);
  }
  return next;
}

// Only the report's own text needs escaping: names and codes go straight into the PDF's HTML.
const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function buildReportHtml({ branchName, periodLabel, periodRange, products, systemDetails, managerName, signOffDate, logoBase64, signatureSvg = '' }) {
  const rows = products
    .map(
      (p) => `
        <tr>
          <td>${esc(p.productCode)}</td>
          <td>${p.actualInventory}</td>
          <td>${p.sales}</td>
          <td>${p.returned}</td>
          <td class="${p.loss > 0 ? 'loss' : ''}">${p.loss}</td>
          <td class="${p.over > 0 ? 'over' : ''}">${p.over}</td>
          <td class="${p.status === 'Unresolved' ? 'loss' : ''}">${esc(p.status || 'Resolved')}</td>
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
          .company-header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
          .company-logo { width: 48px; height: 48px; object-fit: contain; flex-shrink: 0; }
          .company-name { font-size: 18px; font-weight: 700; letter-spacing: 0.5px; }
          .company-address { font-size: 11px; color: #555353; margin-top: 2px; }
          .distributor-box { border-top: 1px solid #272632; border-bottom: 1px solid #272632; padding: 10px 0; margin-bottom: 14px; }
          .distributor-row { display: flex; font-size: 12px; margin-bottom: 4px; }
          .distributor-row:last-child { margin-bottom: 0; }
          .distributor-label { font-weight: 700; width: 140px; flex-shrink: 0; }
          .distributor-value { border-bottom: 1px solid #272632; flex: 1; padding-bottom: 1px; }
          .bor-title { text-align: center; font-size: 15px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 18px; }
          h1 { font-size: 16px; margin-bottom: 2px; }
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
        <div class="company-header">
          ${logoBase64 ? `<img class="company-logo" src="data:image/png;base64,${logoBase64}" alt="Cospachem" />` : ''}
          <div>
            <div class="company-name">A AND AIMEE LABORATORIES</div>
            <div class="company-address">Gochalieo Compound, Brgy. Buray-Buray, Cabuyao City, Laguna</div>
          </div>
        </div>

        <div class="distributor-box">
          <div class="distributor-row">
            <span class="distributor-label">DISTRIBUTOR'S NAME</span>
            <span class="distributor-value">${esc(managerName)}</span>
          </div>
          <div class="distributor-row">
            <span class="distributor-label">OFFICE</span>
            <span class="distributor-value">${esc(branchName)}</span>
          </div>
        </div>

        <div class="bor-title">DISTRIBUTOR'S REPORT (BOR)</div>

        <h1>${esc(branchName)} — ${esc(periodLabel)} Transaction Report</h1>
        <div class="subtitle">${periodRange}</div>
        <table>
          <thead>
            <tr><th>Code</th><th>Actual Inv</th><th>Sales</th><th>Returned</th><th>Loss</th><th>Over</th><th>Status</th></tr>
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
              <td></td>
            </tr>
          </tfoot>
        </table>
        <div class="sign-row">Manager Sign-off: <span>${signatureSvg}${esc(managerName)}</span> Date: <span>${signOffDate}</span></div>
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

function buildReceivedStockHtml({ branchName, periodLabel, periodRange, items, managerName, signOffDate, logoBase64, signatureSvg = '' }) {
  const rows = items
    .map(
      (i) => `
        <tr>
          <td>${esc(i.productCode)}</td>
          <td>${i.quantity}</td>
        </tr>`
    )
    .join('');

  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #272632; }
          .company-header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
          .company-logo { width: 48px; height: 48px; object-fit: contain; flex-shrink: 0; }
          .company-name { font-size: 18px; font-weight: 700; letter-spacing: 0.5px; }
          .company-address { font-size: 11px; color: #555353; margin-top: 2px; }
          h1 { font-size: 16px; margin-bottom: 2px; }
          .subtitle { color: #555353; font-size: 12px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th, td { border: 1px solid #DBE4EE; padding: 8px 10px; font-size: 12px; text-align: left; }
          th { background: #F1F3F6; font-weight: 700; }
          tfoot td { font-weight: 700; background: #F8FAFC; }
          .sign-row { margin-top: 32px; font-size: 12px; }
          .sign-row span { display: inline-block; min-width: 220px; border-bottom: 1px solid #272632; margin-right: 24px; padding-bottom: 2px; }
        </style>
      </head>
      <body>
        <div class="company-header">
          ${logoBase64 ? `<img class="company-logo" src="data:image/png;base64,${logoBase64}" alt="Cospachem" />` : ''}
          <div>
            <div class="company-name">A AND AIMEE LABORATORIES</div>
            <div class="company-address">Gochalieo Compound, Brgy. Buray-Buray, Cabuyao City, Laguna</div>
          </div>
        </div>

        <h1>${esc(branchName)} — ${esc(periodLabel)} Received Stocks Report</h1>
        <div class="subtitle">${periodRange}</div>
        <table>
          <thead>
            <tr><th>Code</th><th>Total Received</th></tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <td>Total Received</td>
              <td>${totalQuantity}</td>
            </tr>
          </tfoot>
        </table>
        <div class="sign-row">Manager Sign-off: <span>${signatureSvg}${esc(managerName)}</span> Date: <span>${signOffDate}</span></div>
      </body>
    </html>
  `;
}

export default function ManagerReportsScreen() {
  const navigation = useNavigation();
  const bottomNavHeight = useBottomNavBarHeight();
  const [manager, setManager] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [reportKind, setReportKind] = useState('transaction');
  const [periodType, setPeriodType] = useState('monthly');
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [report, setReport] = useState(null);
  const [receivedItems, setReceivedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  // Offline, and this branch/period/report was never loaded on this phone.
  const [isUnavailableOffline, setIsUnavailableOffline] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [managerName, setManagerName] = useState('');
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [scanSummary, setScanSummary] = useState(null);
  const [logoBase64, setLogoBase64] = useState(null);
  // Which export is running ('print' | 'pdf' | 'chat'), for the button label.
  const [exportingKind, setExportingKind] = useState(null);
  // The manager's drawn signature (kept on this phone only).
  const [signature, setSignature] = useState(null);
  const [isSignPadVisible, setIsSignPadVisible] = useState(false);
  // BUG 1: only the newest load may update the screen.
  const latestLoadRef = useRef(0);

  // The controls block (report type, period, branch) slides away when you scroll down and comes
  // back when you scroll up. It floats over the report, which keeps room for it at the top, so
  // nothing resizes while you scroll.
  const [controlsHeight, setControlsHeight] = useState(0);
  const controlsProgress = useRef(new Animated.Value(0)).current; // 0 shown, 1 hidden
  const controlsHidden = useRef(false);
  const lastScrollY = useRef(0);
  const setControlsHidden = (hide) => {
    if (controlsHidden.current === hide) return;
    controlsHidden.current = hide;
    Animated.timing(controlsProgress, { toValue: hide ? 1 : 0, duration: 50, useNativeDriver: true }).start();
  };
  const handleReportScroll = (event) => {
    const y = event.nativeEvent.contentOffset.y;
    const delta = y - lastScrollY.current;
    lastScrollY.current = y;
    if (y <= 8) {
      setControlsHidden(false);
    } else if (delta > 6) {
      setControlsHidden(true);
    }
    // No "scroll up" branch on purpose: the controls come back only at the very top of the sheet.
  };
  const controlsTranslateY = controlsProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -controlsHeight] });

  // Resolved once and reused on every print/export — the logo asset never
  // changes mid-session, no reason to re-read it from disk each time.
  useEffect(() => {
    let cancelled = false;
    async function loadLogo() {
      try {
        const asset = Asset.fromModule(require('../../../assets/CospachemLogo.png'));
        await asset.downloadAsync();
        const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (!cancelled) setLogoBase64(base64);
      } catch (error) {
        console.error('[ERROR] [ManagerReportsScreen] Failed to load report logo:', error);
      }
    }
    loadLogo();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSignature(manager?.id).then((saved) => {
      if (!cancelled) setSignature(saved);
    });
    return () => {
      cancelled = true;
    };
  }, [manager?.id]);

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

        // Offline, the branch names come from the copy saved on the phone.
        const branchesKey = `${REPORT_CACHE_PREFIX}branches:${currentManager.id}`;
        const { data, error } = await supabase.from('branches').select('id, name').in('id', branchIds);
        if (cancelled) return;
        let branchList = data || [];
        if (error) {
          branchList = (await storage.get(branchesKey)) || [];
        } else {
          storage.set(branchesKey, branchList);
        }
        if (cancelled) return;
        setBranches(branchList);
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
    const loadId = ++latestLoadRef.current;
    const isStale = () => loadId !== latestLoadRef.current;
    setIsLoading(true);
    setIsUnavailableOffline(false);
    const { start, end } = getPeriodRange(periodType, anchorDate);
    // One saved copy per manager + report type + branch + period.
    const cacheKey = `${REPORT_CACHE_PREFIX}${manager?.id}:${reportKind}:${selectedBranchId}:${toISODate(start)}:${periodType}`;
    const showSavedCopy = async () => {
      const saved = await storage.get(cacheKey);
      if (isStale()) return;
      if (saved) {
        if (reportKind === 'received') setReceivedItems(saved.receivedItems || []);
        else setReport(saved.report ?? null);
      } else {
        if (reportKind === 'received') setReceivedItems([]);
        else setReport(null);
        setIsUnavailableOffline(true);
      }
      setIsLoading(false);
    };

    if (reportKind === 'received') {
      // End bound needs to cover the whole end day, not just its midnight.
      const endOfDay = new Date(end);
      endOfDay.setHours(23, 59, 59, 999);
      const result = await inventoryService.getReceivingLogs([selectedBranchId], 200, start.toISOString(), endOfDay.toISOString());
      if (isStale()) return;
      if (!result.success) {
        await showSavedCopy();
        return;
      }

      // Merged by product code — the same code received across multiple
      // batches/dates in the period shows as one row with a combined total,
      // not one row per batch.
      const mergedByCode = new Map();
      (result.success ? result.data : []).forEach((batch) => {
        (batch.branch_inventory || []).forEach((item) => {
          const existing = mergedByCode.get(item.product_code);
          if (existing) {
            existing.quantity += item.received_quantity;
          } else {
            mergedByCode.set(item.product_code, {
              productCode: item.product_code,
              quantity: item.received_quantity,
            });
          }
        });
      });
      const merged = Array.from(mergedByCode.values()).sort((a, b) => a.productCode.localeCompare(b.productCode));
      setReceivedItems(merged);
      storage.set(cacheKey, { receivedItems: merged });
    } else {
      const result = await reportService.getBranchReport(selectedBranchId, toISODate(start), toISODate(end));
      if (isStale()) return;
      if (!result.success) {
        await showSavedCopy();
        return;
      }
      setReport(result.data);
      storage.set(cacheKey, { report: result.data });
    }
    setIsLoading(false);
  }, [selectedBranchId, reportKind, periodType, anchorDate, manager?.id]);

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

  const handleScanned = async (qrCode) => {
    setIsScannerVisible(false);
    const currentManager = await authService.getCurrentUser();
    const summary = await describeReceivingScan(qrCode, currentManager?.branchIds || []);
    setScanSummary(summary);
  };

  const { start, end } = getPeriodRange(periodType, anchorDate);
  const periodLabel = periodType === 'weekly' ? 'Weekly' : 'Monthly';
  const periodRangeLabel = `${formatDisplayDate(toISODate(start))} – ${formatDisplayDate(toISODate(end))}`;
  const branchName = branches.find((b) => b.id === selectedBranchId)?.name || '';
  const products = report?.products || [];
  const systemDetails = report?.systemDetails;
  // BUG 3: no browsing into periods that have not started.
  const nextPeriodStart = getPeriodRange(periodType, shiftAnchor(periodType, anchorDate, 1)).start;
  const canGoForward = nextPeriodStart <= new Date();
  const currentPeriodStart = getPeriodRange(periodType, new Date()).start;
  const isCurrentPeriod = toISODate(start) === toISODate(currentPeriodStart);
  // BUG 4: nothing to export while loading, or when the report has no rows.
  const hasReportRows = reportKind === 'received' ? receivedItems.length > 0 : products.length > 0;
  const canExport = !isLoading && hasReportRows;

  const buildHtml = () =>
    reportKind === 'received'
      ? buildReceivedStockHtml({
          branchName,
          periodLabel,
          periodRange: periodRangeLabel,
          items: receivedItems,
          managerName,
          signOffDate: formatDisplayDate(toISODate(new Date())),
          logoBase64,
          signatureSvg: signatureToSvg(signature),
        })
      : buildReportHtml({
          branchName,
          periodLabel,
          periodRange: periodRangeLabel,
          products,
          systemDetails,
          managerName,
          signOffDate: formatDisplayDate(toISODate(new Date())),
          logoBase64,
          signatureSvg: signatureToSvg(signature),
        });

  const handlePrint = async () => {
    setExportingKind('print');
    setIsExporting(true);
    try {
      await Print.printAsync({ html: buildHtml() });
    } catch (error) {
      Alert.alert('Print Failed', error.message || 'Could not open the print dialog.');
    } finally {
      setExportingKind(null);
      setIsExporting(false);
    }
  };

  // expo-print writes its generated PDF into its own cache subfolder, which
  // neither expo-sharing's FileProvider nor a cross-module file read (tried
  // via both expo-file-system/legacy's copyAsync and the new File API) can
  // reliably read back on a real device/APK — each attempt surfaced a
  // different low-level Android read-permission error even though nothing
  // is actually wrong with the PDF itself. Asking expo-print for the PDF's
  // bytes directly (base64) sidesteps all of that: nothing ever reads back
  // expo-print's own output file — the bytes are written fresh into
  // documentDirectory through the legacy module, the same one already used
  // successfully elsewhere on this screen (the logo asset read).
  const getShareableReportUri = async () => {
    const { base64 } = await Print.printToFileAsync({ html: buildHtml(), base64: true });
    const fileName = `${reportKind === 'received' ? 'Received-Stocks' : 'Transaction'}-Report-${toISODate(new Date())}.pdf`;
    const destUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(destUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    return destUri;
  };

  const handleDownloadPdf = async () => {
    setExportingKind('pdf');
    setIsExporting(true);
    try {
      const uri = await getShareableReportUri();
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Save Report PDF' });
      } else {
        Alert.alert('PDF Ready', `Saved to: ${uri}`);
      }
    } catch (error) {
      Alert.alert('Export Failed', error.message || 'Could not generate the PDF.');
    } finally {
      setExportingKind(null);
      setIsExporting(false);
    }
  };

  const handleShareToChat = async () => {
    setExportingKind('chat');
    setIsExporting(true);
    try {
      const uri = await getShareableReportUri();
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Report' });
      } else {
        Alert.alert('Sharing Unavailable', 'Sharing is not available on this device.');
      }
    } catch (error) {
      Alert.alert('Share Failed', error.message || 'Could not share the report.');
    } finally {
      setExportingKind(null);
      setIsExporting(false);
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          title="Report Generation"
          titleAlign="left"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <SecondaryHeader height={76}>
          <View style={styles.titleRow}>
            <View style={styles.titleTextCol}>
              <Text style={styles.pageTitle} numberOfLines={1}>
                {reportKind === 'received' ? 'Received Stocks' : 'Transaction Report'}
              </Text>
              <Text style={styles.pageSubtitle}>Preview, then print or share</Text>
            </View>
            <LiveStatusPill pillStyle={styles.onlinePill} dotStyle={styles.onlineDot} textStyle={styles.onlineText} />
          </View>
        </SecondaryHeader>

        <View style={styles.listArea}>
        {isLoading ? (
          <View style={[styles.loadingWrap, { paddingTop: controlsHeight }]}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.content, { paddingTop: controlsHeight + SPACING.sm, paddingBottom: bottomNavHeight + SPACING.xl }]}
            onScroll={handleReportScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.previewLabel}>LIVE PAPER SHEET PREVIEW</Text>
            <Text style={styles.previewHint}>(Scroll right to review all columns)</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {reportKind === 'received' ? (
                <View>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colCode]}>Code</Text>
                    <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colNum]}>Total Received</Text>
                  </View>

                  {receivedItems.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Icon name="clipboardText" size={24} color={COLORS.textSecondary} />
                      <Text style={styles.emptyText}>{isUnavailableOffline ? 'Not saved on this phone yet — open this report once while online to see it offline.' : 'No stock received in this period yet.'}</Text>
                    </View>
                  ) : (
                    receivedItems.map((item) => (
                      <View key={item.productCode} style={styles.tableRow}>
                        <Text style={[styles.tableCell, styles.colCode]}>{item.productCode}</Text>
                        <Text style={[styles.tableCell, styles.colNum]}>{item.quantity}</Text>
                      </View>
                    ))
                  )}
                </View>
              ) : (
                <View>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colCode]}>Code</Text>
                    <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colNum]}>Actual Inv</Text>
                    <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colNum]}>Sales</Text>
                    <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colNum]}>Returned</Text>
                    <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colNum]}>Loss</Text>
                    <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colNum]}>Over</Text>
                    <Text style={[styles.tableCell, styles.tableHeaderCell, styles.colStatus]}>Status</Text>
                  </View>

                  {products.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Icon name="clipboardText" size={24} color={COLORS.textSecondary} />
                      <Text style={styles.emptyText}>{isUnavailableOffline ? 'Not saved on this phone yet — open this report once while online to see it offline.' : 'No accepted reports in this period yet. Reports show here once you accept them.'}</Text>
                    </View>
                  ) : (
                    products.map((p) => (
                      <View key={p.productCode} style={styles.tableRow}>
                        <Text style={[styles.tableCell, styles.colCode]}>{p.productCode}</Text>
                        <Text style={[styles.tableCell, styles.colNum]}>{p.actualInventory}</Text>
                        <Text style={[styles.tableCell, styles.colNum]}>{p.sales}</Text>
                        <Text style={[styles.tableCell, styles.colNum]}>{p.returned}</Text>
                        <Text style={[styles.tableCell, styles.colNum, p.loss > 0 && styles.lossCell]}>{p.loss}</Text>
                        <Text style={[styles.tableCell, styles.colNum, p.over > 0 && styles.overCell]}>{p.over}</Text>
                        <Text
                          style={[
                            styles.tableCell,
                            styles.colStatus,
                            p.status === 'Unresolved' ? styles.lossCell : styles.resolvedCell,
                          ]}
                        >
                          {p.status || 'Resolved'}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              )}
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

              <View style={styles.signatureRow}>
                <View style={styles.signatureBox}>
                  {signature ? (
                    <Svg width="100%" height="100%" viewBox={`0 0 ${signature.width} ${signature.height}`}>
                      {signature.paths.map((d, index) => (
                        <Path key={index} d={d} stroke="#272632" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      ))}
                    </Svg>
                  ) : (
                    <Text style={styles.signaturePlaceholder}>No signature yet</Text>
                  )}
                </View>
                <View style={styles.signatureActions}>
                  <TouchableOpacity style={styles.signatureButton} onPress={() => setIsSignPadVisible(true)} accessibilityRole="button">
                    <Icon name="pencilSimpleLine" size={14} color="#0085F9" />
                    <Text style={styles.signatureButtonText}>{signature ? 'Redo' : 'Add signature'}</Text>
                  </TouchableOpacity>
                  {!!signature && (
                    <TouchableOpacity
                      onPress={() => {
                        clearSignature(manager?.id);
                        setSignature(null);
                      }}
                      accessibilityRole="button"
                    >
                      <Text style={styles.signatureClear}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <Text style={styles.signatureHint}>
                Optional. Saved only on this phone and printed above your name on the PDF.
              </Text>
            </View>

            <SectionHeader icon="document" size="md" label="Export" style={styles.exportLabel} />
            <Button
              title={exportingKind === 'pdf' ? 'Preparing PDF…' : 'Download Clean PDF'}
              icon="document"
              variant="black"
              onPress={handleDownloadPdf}
              disabled={isExporting || !canExport}
              loading={exportingKind === 'pdf'}
              height={48}
              fontSize={16}
              borderRadius={24}
              hasShadow={false}
              width="100%"
              style={styles.exportMain}
            />
            <View style={styles.exportRow}>
              <View style={styles.exportCol}>
                <Button
                  title={exportingKind === 'print' ? 'Opening…' : 'Printer'}
                  icon="trayUp"
                  iconSize={18}
                  variant="outline"
                  accentColor="#0085F9"
                  onPress={handlePrint}
                  disabled={isExporting || !canExport}
                  loading={exportingKind === 'print'}
                  height={44}
                  fontSize={15}
                  borderRadius={22}
                  hasShadow={false}
                  width="100%"
                />
              </View>
              <View style={styles.exportCol}>
                <Button
                  title={exportingKind === 'chat' ? 'Preparing…' : 'Chat'}
                  icon="send"
                  iconSize={18}
                  variant="outline"
                  accentColor="#7B6FE8"
                  onPress={handleShareToChat}
                  disabled={isExporting || !canExport}
                  loading={exportingKind === 'chat'}
                  height={44}
                  fontSize={15}
                  borderRadius={22}
                  hasShadow={false}
                  width="100%"
                />
              </View>
            </View>
            {!canExport && <Text style={styles.exportHint}>There is nothing to export for this period yet.</Text>}

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

        <Animated.View
          style={[styles.controlsWrap, styles.controlsFloat, { transform: [{ translateY: controlsTranslateY }] }]}
          onLayout={(event) => setControlsHeight(event.nativeEvent.layout.height)}
        >
          <View style={styles.periodTypeRow}>
            {REPORT_KINDS.map((k) => {
              const isActive = k.key === reportKind;
              return (
                <TouchableOpacity
                  key={k.key}
                  style={[styles.periodTypeButton, isActive && styles.periodTypeButtonActive]}
                  onPress={() => setReportKind(k.key)}
                >
                  <Text style={[styles.periodTypeText, isActive && styles.periodTypeTextActive]}>{k.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

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
            <TouchableOpacity
              onPress={() => setAnchorDate(shiftAnchor(periodType, anchorDate, -1))}
              style={styles.rangeArrow}
              accessibilityRole="button"
              accessibilityLabel="Previous period"
            >
              <Icon name="arrowLeft" size={18} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.rangeText}>{periodRangeLabel}</Text>
            <TouchableOpacity
              onPress={() => canGoForward && setAnchorDate(shiftAnchor(periodType, anchorDate, 1))}
              disabled={!canGoForward}
              style={[styles.rangeArrow, !canGoForward && styles.rangeArrowDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Next period"
              accessibilityState={{ disabled: !canGoForward }}
            >
              <Icon name="arrowRight" size={18} color={canGoForward ? COLORS.primary : COLORS.textTertiary} />
            </TouchableOpacity>
          </View>
          {!isCurrentPeriod && (
            <TouchableOpacity
              style={styles.thisPeriodPill}
              onPress={() => setAnchorDate(new Date())}
              accessibilityRole="button"
            >
              <Text style={styles.thisPeriodText}>Back to {periodType === 'weekly' ? 'this week' : 'this month'}</Text>
            </TouchableOpacity>
          )}

          {branches.length > 1 && (
            <BranchSelector
              branches={branches}
              selectedId={selectedBranchId}
              onSelect={setSelectedBranchId}
              scrollable
              scrollBleed={SPACING.lg}
            />
          )}
        </Animated.View>
        </View>

        <BottomNavBar activeTab="reports" onTabPress={handleTabPress} onFabPress={() => setIsScannerVisible(true)} fabLabel="Scan" />
      </View>

      <SignaturePad
        visible={isSignPadVisible}
        onClose={() => setIsSignPadVisible(false)}
        onSave={(drawn) => {
          setSignature(drawn);
          saveSignature(manager?.id, drawn);
          setIsSignPadVisible(false);
        }}
      />

      <QRScannerModal
        visible={isScannerVisible}
        onClose={() => setIsScannerVisible(false)}
        onScanned={handleScanned}
      />
      <ScanResultSheet
        summary={scanSummary}
        onClose={() => setScanSummary(null)}
        onScanAgain={() => {
          setScanSummary(null);
          setIsScannerVisible(true);
        }}
      />
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
  titleTextCol: { flexShrink: 1, flex: 1 },
  pageSubtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
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
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    gap: 6,
  },
  listArea: { flex: 1, overflow: 'hidden' },
  // Floats at the top of the report with a solid background, so rows pass cleanly under it.
  controlsFloat: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    zIndex: 2,
    elevation: 2,
  },
  periodTypeRow: {
    flexDirection: 'row',
    borderRadius: 20,
    backgroundColor: '#ECEEF3',
    padding: 3,
  },
  periodTypeButton: {
    flex: 1,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodTypeButtonActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#0085F9',
  },
  periodTypeText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: COLORS.textSecondary,
  },
  periodTypeTextActive: {
    color: '#0085F9',
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeArrowDisabled: { opacity: 0.5 },
  thisPeriodPill: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EAF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thisPeriodText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#0085F9',
  },
  emptyBox: { alignItems: 'center', gap: 6, paddingVertical: SPACING.lg, width: 300 },
  signatureRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 4 },
  signatureBox: {
    flex: 1,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dotted',
    borderColor: '#0085F9',
    backgroundColor: '#F7FBFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  signaturePlaceholder: { fontSize: 12, color: '#9AB8D6', fontFamily: TYPOGRAPHY.fontFamily.regular },
  signatureActions: { alignItems: 'flex-start', gap: 8 },
  signatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: '#EAF4FF',
  },
  signatureButtonText: { fontSize: 13, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: '#0085F9' },
  signatureClear: { fontSize: 13, fontFamily: TYPOGRAPHY.fontFamily.medium, color: COLORS.error },
  signatureHint: { fontSize: 11, lineHeight: 16, color: COLORS.textTertiary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  exportLabel: { marginTop: SPACING.lg, marginBottom: 0 },
  exportMain: { marginTop: SPACING.sm },
  exportRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  exportCol: { flex: 1 },
  exportHint: { marginTop: SPACING.sm, fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
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
    fontSize: 12,
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
    fontSize: 11,
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
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: '#272632',
  },
  tableHeaderCell: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  colCode: { width: 120 },
  colNum: { width: 90, textAlign: 'right' },
  colStatus: { width: 100 },
  lossCell: { color: '#B91C1C', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  overCell: { color: '#B26400', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  resolvedCell: { color: COLORS.success, fontFamily: TYPOGRAPHY.fontFamily.medium, fontWeight: '600' },
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
    fontSize: 12,
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
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  caretExpanded: {
    transform: [{ rotate: '180deg' }],
  },
});
