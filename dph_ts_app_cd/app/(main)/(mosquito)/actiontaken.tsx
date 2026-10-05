import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../../services/api';


// ─── Design Tokens ─────────────────────────────────────────────────────────────
const T = {
  bg: '#080D1A',
  bgCard: '#0E1525',
  bgElevated: '#141E30',
  bgGlass: 'rgba(255,255,255,0.04)',
  bgGlassBorder: 'rgba(255,255,255,0.08)',

  cyan: '#00E5FF',
  cyanDim: 'rgba(0,229,255,0.12)',
  cyanBorder: 'rgba(0,229,255,0.3)',

  violet: '#A78BFA',
  violetDim: 'rgba(167,139,250,0.12)',
  violetBorder: 'rgba(167,139,250,0.3)',

  emerald: '#34D399',
  emeraldDim: 'rgba(52,211,153,0.12)',
  emeraldBorder: 'rgba(52,211,153,0.3)',

  amber: '#FBBF24',
  amberDim: 'rgba(251,191,36,0.12)',

  rose: '#FB7185',
  roseDim: 'rgba(251,113,133,0.12)',
  roseBorder: 'rgba(251,113,133,0.3)',

  textPrimary: '#F1F5FF',
  textSecondary: '#7A8BAA',
  textMuted: '#3A4560',

  overlay: 'rgba(4,8,18,0.92)',
};

// ─── Types ─────────────────────────────────────────────────────────────────────
interface LocationData { latitude: number; longitude: number; }
interface SourceData { sourceName: string; count: number; }
interface ActionRow {
  id: string | number;
  work_type: string;
  submitted_at: string;
  latitude: string | number;
  longitude: string | number;
  image_path: string;
  action_date?: string;
  action_image_path?: string;
  action_location?: string;
  sources: SourceData[] | string;
  user_id: string | number;
}
interface SourceActionState { [sourceName: string]: { action: 'Destroyed' | 'Treated' | 'Not Selected' }; }
interface ModalViewDataType {
  type: 'register_location' | 'register_image' | 'action_image' | 'action_location';
  row: ActionRow | null;
}

// ─── Pulse Dot ──────────────────────────────────────────────────────────────────
const PulseDot = ({ color }: { color: string }) => {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.6, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);
  return (
    <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        position: 'absolute', width: 10, height: 10, borderRadius: 5,
        backgroundColor: color, opacity: 0.35, transform: [{ scale: anim }],
      }} />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
};

// ─── Stat Pill ─────────────────────────────────────────────────────────────────
const StatPill = ({ label, value, color, icon }: { label: string; value: number; color: string; icon: any }) => (
  <View style={[sp.wrap, { borderColor: color + '40' }]}>
    <View style={[sp.iconWrap, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon as any} size={18} color={color} />
    </View>
    <Text style={[sp.value, { color }]}>{value}</Text>
    <Text style={sp.label}>{label}</Text>
  </View>
);
const sp = StyleSheet.create({
  wrap: { alignItems: 'center', backgroundColor: T.bgCard, borderRadius: 16, padding: 14, borderWidth: 1, minWidth: 90 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  value: { fontSize: 26, fontWeight: '800', marginBottom: 2 },
  label: { fontSize: 11, color: T.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
});

// ─── Timeline Row ──────────────────────────────────────────────────────────────
const TimelineRow = ({
  item, index, isLocked, hasLocation, actionImages,
  onPress, onViewLocation, onViewImage, onViewActionLocation, onViewActionImage,
}: {
  item: ActionRow; index: number; isLocked: boolean; hasLocation: boolean; actionImages: { [key: string | number]: string };
  onPress: () => void; onViewLocation: () => void; onViewImage: () => void;
  onViewActionLocation: () => void; onViewActionImage: () => void;
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, index, slideAnim]);

  const date = new Date(item.submitted_at);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <View style={[tr.card, isLocked && tr.cardLocked]}>
        <View style={[tr.accent, { backgroundColor: isLocked ? T.emerald : T.cyan }]} />

        <View style={tr.header}>
          <View style={[tr.indexBadge, { backgroundColor: isLocked ? T.emeraldDim : T.cyanDim, borderColor: isLocked ? T.emeraldBorder : T.cyanBorder }]}>
            {isLocked
              ? <Ionicons name="checkmark" size={14} color={T.emerald} />
              : <Text style={[tr.indexText, { color: T.cyan }]}>{index}</Text>
            }
          </View>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={tr.workType}>{item.work_type}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <Ionicons name="time-outline" size={11} color={T.textMuted} />
              <Text style={tr.dateText}>{dateStr} · {timeStr}</Text>
            </View>
          </View>

          {isLocked
            ? <View style={tr.doneBadge}><Text style={tr.doneBadgeText}>DONE</Text></View>
            : <PulseDot color={T.cyan} />
          }
        </View>

        <View style={tr.toolbar}>
          <TouchableOpacity style={tr.toolBtn} onPress={onViewLocation}>
            <Ionicons name="location-outline" size={16} color={T.cyan} />
            <Text style={[tr.toolLabel, { color: T.cyan }]}>Entry Loc</Text>
          </TouchableOpacity>
          <TouchableOpacity style={tr.toolBtn} onPress={onViewImage}>
            <Ionicons name="image-outline" size={16} color={T.cyan} />
            <Text style={[tr.toolLabel, { color: T.cyan }]}>Entry Img</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[tr.toolBtn, !hasLocation && tr.toolBtnDisabled]} onPress={onViewActionLocation} disabled={!hasLocation}>
            <Ionicons name="map-outline" size={16} color={hasLocation ? T.violet : T.textMuted} />
            <Text style={[tr.toolLabel, { color: hasLocation ? T.violet : T.textMuted }]}>Act Loc</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[tr.toolBtn, !item.action_image_path && tr.toolBtnDisabled]} onPress={onViewActionImage} disabled={!item.action_image_path && !actionImages[item.id]}>
            <Ionicons name="images-outline" size={16} color={item.action_image_path ? T.violet : T.textMuted} />
            <Text style={[tr.toolLabel, { color: item.action_image_path ? T.violet : T.textMuted }]}>Act Img</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={onPress}
          disabled={isLocked}
          style={[tr.cta, isLocked && tr.ctaLocked]}
        >
          {isLocked ? (
            <>
              <Ionicons name="checkmark-circle" size={16} color={T.emerald} />
              <Text style={[tr.ctaText, { color: T.emerald }]}>Completed</Text>
            </>
          ) : (
            <>
              <Ionicons name="flash" size={16} color={T.bg} />
              <Text style={[tr.ctaText, { color: T.bg }]}>Take Action</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};
const tr = StyleSheet.create({
  card: { backgroundColor: T.bgCard, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: T.bgGlassBorder, overflow: 'hidden' },
  cardLocked: { borderColor: T.emeraldBorder, backgroundColor: 'rgba(52,211,153,0.04)' },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: 3 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  indexBadge: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  indexText: { fontSize: 13, fontWeight: '800' },
  workType: { fontSize: 15, fontWeight: '700', color: T.textPrimary, letterSpacing: 0.2 },
  dateText: { fontSize: 11, color: T.textMuted, fontWeight: '500' },
  doneBadge: { backgroundColor: T.emeraldDim, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: T.emeraldBorder },
  doneBadgeText: { fontSize: 10, fontWeight: '800', color: T.emerald, letterSpacing: 0.8 },
  toolbar: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  toolBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, backgroundColor: T.bgGlass, borderRadius: 10, borderWidth: 1, borderColor: T.bgGlassBorder, gap: 4 },
  toolBtnDisabled: { opacity: 0.35 },
  toolLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, backgroundColor: T.cyan, borderRadius: 12 },
  ctaLocked: { backgroundColor: T.emeraldDim, borderWidth: 1, borderColor: T.emeraldBorder },
  ctaText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
});

// ─── Radio Option ──────────────────────────────────────────────────────────────
const RadioOption = ({
  label, selected, color, onPress,
}: { label: string; selected: boolean; color: string; onPress: () => void }) => (
  <TouchableOpacity style={[ro.wrap, selected && { borderColor: color, backgroundColor: color + '15' }]} onPress={onPress} activeOpacity={0.7}>
    <View style={[ro.circle, { borderColor: color }]}>
      {selected && <View style={[ro.dot, { backgroundColor: color }]} />}
    </View>
    <Text style={[ro.label, selected && { color, fontWeight: '700' }]}>{label}</Text>
  </TouchableOpacity>
);
const ro = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: T.bgGlassBorder, gap: 8 },
  circle: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 13, color: T.textSecondary, fontWeight: '600' },
});

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ActionTaken() {
  const navigation = useNavigation();

  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [actionData, setActionData] = useState<ActionRow[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<string | number | null>(null);
  const [selectedRowData, setSelectedRowData] = useState<ActionRow | null>(null);

  const [selectedActions, setSelectedActions] = useState<{ [key: string | number]: string[] }>({});
  const [actionImages, setActionImages] = useState<{ [key: string | number]: string }>({});
  const [actionLocations, setActionLocations] = useState<{ [key: string | number]: LocationData }>({});
  const [lockRows, setLockRows] = useState<{ [key: string | number]: boolean }>({});
  const [sourceActions, setSourceActions] = useState<{ [key: string | number]: SourceActionState }>({});

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedLocation, setCapturedLocation] = useState<LocationData | null>(null);

  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [modalViewData, setModalViewData] = useState<ModalViewDataType>({ type: 'register_location', row: null });

  const [locationLoader, setLocationLoader] = useState(false);
  const [photoLoader, setPhotoLoader] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const scrollRef = useRef<ScrollView>(null);
  const headerFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerFade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [headerFade]);

  useEffect(() => {
    console.log(' SOURCE ACTION STATE UPDATED:', sourceActions);
  }, [sourceActions]);

  // ── Load user ────────────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('user_info').then(raw => {
      if (raw) {
        const u = JSON.parse(raw);
        setUserRole(u.role);
        setUserId(u.user_id);
      }
    });
  }, []);

  // ── Fetch data ───────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${BASE_URL}/dashboard/get-larva-entries`),
        fetch(`${BASE_URL}/dashboard/get-special-larva-entries`),
      ]);
      const d1: ActionRow[] = await r1.json();
      const d2: ActionRow[] = await r2.json();

      const merged = [...d1, ...d2].filter(x => String(x.user_id) === String(userId));
      const filtered = merged.filter(x =>
        x.work_type !== 'Routine ATP' &&
        ['Fever', 'Dengue', 'Scrub typus', 'Malaria', 'Filaria', 'Chikungunya', 'JE', 'Lepto', 'Rabies', 'Scrub'].includes(x.work_type)
      );

      setActionData(filtered);

      const locked: { [k: string | number]: boolean } = {};
      const locs: { [k: string | number]: LocationData } = {};

      filtered.forEach(item => {
        if (item.action_date || item.action_image_path || actionImages[item.id]) {
          locked[item.id] = true;
        }
        if (item.action_location) {
          try { locs[item.id] = JSON.parse(item.action_location); } catch { }
        }
      });

      setLockRows(locked);
      setActionLocations(locs);
    } catch (e) {
      console.error('Fetch error:', e);
    }
  }, [userId, actionImages]);

  useEffect(() => {
    if (userId) fetchData();
  }, [userId, fetchData]);

  // ── Pagination ───────────────────────────────────────────────────────────────
  const sorted = [...actionData].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
  const paginated = sorted.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const totalPages = Math.ceil(actionData.length / rowsPerPage);

  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: true }); }, [currentPage]);

  // ── Open action modal ────────────────────────────────────────────────────────
  const openActionModal = (row: ActionRow) => {
    const sources: SourceData[] = Array.isArray(row.sources)
      ? row.sources
      : (() => { try { return JSON.parse(row.sources as string); } catch { return []; } })();
    setSelectedRowId(row.id);
    setSelectedRowData({ ...row, sources });
    setCapturedImage(null);
    setCapturedLocation(null);
    setActionModalVisible(true);
  };

  const toggleAction = (name: string) => {
    setSelectedActions(prev => {
      const arr = prev[selectedRowId!] || [];
      return {
        ...prev,
        [selectedRowId!]: arr.includes(name) ? arr.filter(a => a !== name) : [...arr, name],
      };
    });
  };

  // ── Start action flow ────────────────────────────────────────────────────────
  const startActionFlow = async (rowId: string | number) => {
    if (!selectedActions[rowId]?.length) {
      alert('Select at least one action');
      return;
    }

    try {
      setLocationLoader(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationLoader(false);
        alert('Location permission denied');
        return;
      }

      let loc: LocationData | null = null;
      try {
        const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
        loc = { latitude: l.coords.latitude, longitude: l.coords.longitude };
      } catch {
        setLocationLoader(false);
        alert('Unable to capture location');
        return;
      }
      setLocationLoader(false);

      setPhotoLoader(true);
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setPhotoLoader(false);
        alert('Camera access denied');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.5,
        base64: false,
        aspect: [4, 3],
        exif: false,
      });

      if (!result.assets?.length) {
        setPhotoLoader(false);
        return;
      }

      const fileUri = result.assets[0].uri;
      console.log('📸 Image captured at:', fileUri);

      try {
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (!fileInfo.exists) {
          setPhotoLoader(false);
          alert('Image file not accessible');
          return;
        }
        console.log('✅ Image file verified:', fileInfo.size, 'bytes');
      } catch (checkError) {
        console.error('⚠️ File check error:', checkError);
      }

      setPhotoLoader(false);
      setActionModalVisible(false);

      setCapturedLocation(loc);
      setActionLocations(prev => ({ ...prev, [rowId]: loc! }));

      setTimeout(() => {
        setCapturedImage(fileUri);
        setActionImages(prev => ({ ...prev, [rowId]: fileUri }));
        console.log('✅ Image state updated');
      }, 100);

      setTimeout(() => {
        console.log('📱 Opening preview modal');
        setPreviewModalVisible(true);
      }, 500);

    } catch (e) {
      console.error('❌ Action Flow Error:', e);
      setLocationLoader(false);
      setPhotoLoader(false);
      alert(`An error occurred: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  // ── Convert file URI to base64 ────────────────────────────────────────────────
  const convertFileToBase64 = async (fileUri: string): Promise<string> => {
    try {
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `data:image/jpeg;base64,${base64}`;
    } catch (e) {
      console.error('Failed to convert file to base64:', e);
      return '';
    }
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const submitAction = async () => {
    try {
      if (!selectedRowData || !selectedRowId) {
        alert('Invalid row data');
        return;
      }

      setSubmitting(true);

      const sources: SourceData[] = Array.isArray(selectedRowData.sources)
        ? selectedRowData.sources
        : (() => { try { return JSON.parse(selectedRowData.sources as string); } catch { return []; } })();

      const sourceActionData = sources.map(src => ({
        sourceName: src.sourceName,
        count: src.count,
        action: sourceActions[selectedRowId]?.[src.sourceName]?.action || 'Not Selected',
      }));

      if (selectedActions[selectedRowId]?.includes('Source Reduction')) {
        if (sourceActionData.some(x => x.action === 'Not Selected')) {
          alert('Please select Destroyed or Treated for all sources');
          setSubmitting(false);
          return;
        }
      }

      let imageBase64 = actionImages[selectedRowId];
      if (imageBase64 && (imageBase64.startsWith('file://') || imageBase64.startsWith('/storage'))) {
        console.log('Converting file URI to base64...');
        imageBase64 = await convertFileToBase64(imageBase64);
        if (!imageBase64) {
          alert('Failed to process image');
          setSubmitting(false);
          return;
        }
      }

      let finalImage = imageBase64 || capturedImage;
      if (finalImage && (finalImage.startsWith('file://') || finalImage.startsWith('/storage'))) {
        finalImage = await convertFileToBase64(finalImage);
      }

      const body = {
        rowId: selectedRowId,
        selectedActions: selectedActions[selectedRowId] || [],
        sourceActions: sourceActionData,
        image_base64: finalImage,
        location: capturedLocation || actionLocations[selectedRowId],
        role: userRole || '',
      };

      console.log('🚀 Submitting Payload (image size: ' + (finalImage?.length || 0) + ' bytes)');

      const res = await fetch(`${BASE_URL}/dashboard/save-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Server responded with an error');
      }

      alert('Action submitted successfully!');

      setLockRows(prev => ({ ...prev, [selectedRowId]: true }));
      setPreviewModalVisible(false);
      setCapturedImage(null);
      setCapturedLocation(null);
      setSelectedRowId(null);

      fetchData();

    } catch (e: any) {
      console.error('❌ Submission Error:', e);
      alert(`Submission failed: ${e.message || 'Check your internet connection'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openView = (type: ModalViewDataType['type'], row: ActionRow) => {
    setModalViewData({ type, row });
    setViewModalVisible(true);
  };

  // ── Stats ────────────────────────────────────────────────────────────────────
  const actionTakenCount = Object.values(lockRows).filter(Boolean).length;
  const pendingCount = actionData.length - actionTakenCount;

  const today = new Date();
  const isSameDay = (d1: Date, d2: Date) =>
    d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
  const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(0, 0, 0, 0); return d; })();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Previous month
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
  const prevMonthRows = actionData.filter(x => {
    const d = new Date(x.submitted_at);
    return d >= prevMonthStart && d <= prevMonthEnd;
  });
  const prevMonthName = prevMonthStart.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const todayRows = actionData.filter(x => isSameDay(new Date(x.submitted_at), today));
  const weekRows = actionData.filter(x => new Date(x.submitted_at) >= weekStart);
  const monthRows = actionData.filter(x => new Date(x.submitted_at) >= monthStart);

  // ─── Breakdown data ──────────────────────────────────────────────────────────
  const breakdownItems = [
    {
      label: 'Today',
      done: todayRows.filter(x => lockRows[x.id]).length,
      pending: todayRows.filter(x => !lockRows[x.id]).length,
      total: todayRows.length,
      color: T.cyan,
      icon: 'sunny-outline',
      isPending: false,
    },
    {
      label: 'Week',
      done: weekRows.filter(x => lockRows[x.id]).length,
      pending: weekRows.filter(x => !lockRows[x.id]).length,
      total: weekRows.length,
      color: T.violet,
      icon: 'calendar-outline',
      isPending: false,
    },
    {
      label: 'Month',
      done: monthRows.filter(x => lockRows[x.id]).length,
      pending: monthRows.filter(x => !lockRows[x.id]).length,
      total: monthRows.length,
      color: T.amber,
      icon: 'time-outline',
      isPending: false,
    },
    {
      label: prevMonthName,
      done: prevMonthRows.filter(x => lockRows[x.id]).length,
      pending: prevMonthRows.filter(x => !lockRows[x.id]).length,
      total: prevMonthRows.length,
      color: T.rose,
      icon: 'calendar-clear-outline',
      isPending: true,
    },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <LinearGradient colors={['#0A1628', '#0E1E38']} style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back-outline" size={22} color={T.textPrimary} />
        </TouchableOpacity>

        <Animated.View style={[s.headerCenter, { opacity: headerFade }]}>
          <Text style={s.headerTitle}>Action Hub</Text>
          <View style={s.headerPill}>
            <PulseDot color={T.cyan} />
            <Text style={s.headerPillText}>Field Ops</Text>
          </View>
        </Animated.View>

        <TouchableOpacity style={s.headerBtn} onPress={() => setInfoModalVisible(true)}>
          <Ionicons name="information-circle-outline" size={22} color={T.textPrimary} />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── Stats Row ─────────────────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHeadRow}>
            <Text style={s.sectionTitle}>Overview</Text>
            <TouchableOpacity style={s.refreshBtn} onPress={fetchData}>
              <Ionicons name="refresh-outline" size={18} color={T.cyan} />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            <StatPill label="Total" value={actionData.length} color={T.cyan} icon="checkmark-circle-outline" />
            <StatPill label="Pending" value={pendingCount} color={T.rose} icon="alert-circle-outline" />
            <StatPill label="Today" value={todayRows.filter(x => lockRows[x.id]).length} color={T.emerald} icon="sunny-outline" />
            <StatPill label="Week" value={weekRows.filter(x => lockRows[x.id]).length} color={T.violet} icon="calendar-outline" />
            <StatPill label="Month" value={monthRows.filter(x => lockRows[x.id]).length} color={T.amber} icon="time-outline" />
          </ScrollView>
        </View>

        {/* ── Detailed Breakdown ────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Breakdown</Text>
          <View style={s.breakdownGrid}>
            {breakdownItems.map(({ label, done, pending, total, color, icon, isPending }) => {
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <View key={label} style={[s.bdCard, { borderColor: color + '30' }]}>
                  {/* Top row */}
                  <View style={s.bdTopRow}>
                    <View style={[s.bdIconWrap, { backgroundColor: color + '18' }]}>
                      <Ionicons name={icon as any} size={15} color={color} />
                    </View>
                    <Text style={[s.bdLabel, { color }]}>{label}</Text>
                    {isPending ? (
                      <View style={[s.bdPendingBadge, { borderColor: color + '50', backgroundColor: color + '15' }]}>
                        <Text style={[s.bdPendingBadgeText, { color }]}>{pending} Pending</Text>
                      </View>
                    ) : (
                      <Text style={s.bdPct}>{pct}%</Text>
                    )}
                  </View>

                  {/* Progress bar — always shows done/total ratio */}
                  <View style={s.bdBarTrack}>
                    <View style={[s.bdBarFill, { width: `${pct}%` as any, backgroundColor: color }]} />
                  </View>

                  {/* Stats row */}
                  <View style={s.bdStatsRow}>
                    <View style={s.bdStat}>
                      <Text style={[s.bdStatNum, { color: T.emerald }]}>{done}</Text>
                      <Text style={s.bdStatLabel}>Done</Text>
                    </View>
                    <View style={[s.bdDot, { backgroundColor: color + '40' }]} />
                    {isPending ? (
                      <>
                        <View style={s.bdStat}>
                          <Text style={[s.bdStatNum, { color: T.rose }]}>{pending}</Text>
                          <Text style={s.bdStatLabel}>Pending</Text>
                        </View>
                        <View style={[s.bdDot, { backgroundColor: color + '40' }]} />
                      </>
                    ) : (
                      <>
                        <View style={s.bdStat}>
                          <Text style={[s.bdStatNum, { color: T.textSecondary }]}>{pending}</Text>
                          <Text style={s.bdStatLabel}>Left</Text>
                        </View>
                        <View style={[s.bdDot, { backgroundColor: color + '40' }]} />
                      </>
                    )}
                    <View style={s.bdStat}>
                      <Text style={[s.bdStatNum, { color: T.textMuted }]}>{total}</Text>
                      <Text style={s.bdStatLabel}>Total</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Pending Actions ───────────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHeadRow}>
            <Text style={s.sectionTitle}>Pending</Text>
            <View style={[s.countBadge, { backgroundColor: T.roseDim, borderColor: T.roseBorder }]}>
              <Text style={[s.countBadgeText, { color: T.rose }]}>{paginated.filter(x => !lockRows[x.id]).length}</Text>
            </View>
          </View>
          {paginated.filter(x => !lockRows[x.id]).length > 0 ? (
            paginated.filter(x => !lockRows[x.id]).map((item, i) => (
              <TimelineRow
                key={item.id} item={item} index={(currentPage - 1) * rowsPerPage + i + 1}
                isLocked={false} hasLocation={!!actionLocations[item.id]} actionImages={actionImages}
                onPress={() => openActionModal(item)}
                onViewLocation={() => openView('register_location', item)}
                onViewImage={() => openView('register_image', item)}
                onViewActionLocation={() => openView('action_location', item)}
                onViewActionImage={() => openView('action_image', item)}
              />
            ))
          ) : (
            <View style={s.emptyBox}>
              <Ionicons name="checkmark-done-circle-outline" size={40} color={T.emerald} />
              <Text style={s.emptyText}>All caught up!</Text>
            </View>
          )}
        </View>

        {/* ── Completed Actions ─────────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHeadRow}>
            <Text style={s.sectionTitle}>Completed</Text>
            <View style={[s.countBadge, { backgroundColor: T.emeraldDim, borderColor: T.emeraldBorder }]}>
              <Text style={[s.countBadgeText, { color: T.emerald }]}>{paginated.filter(x => lockRows[x.id]).length}</Text>
            </View>
          </View>
          {paginated.filter(x => lockRows[x.id]).length > 0 ? (
            paginated.filter(x => lockRows[x.id]).map((item, i) => (
              <TimelineRow
                key={item.id} item={item} index={(currentPage - 1) * rowsPerPage + i + 1}
                isLocked={true} hasLocation={!!actionLocations[item.id]} actionImages={actionImages}
                onPress={() => openActionModal(item)}
                onViewLocation={() => openView('register_location', item)}
                onViewImage={() => openView('register_image', item)}
                onViewActionLocation={() => openView('action_location', item)}
                onViewActionImage={() => openView('action_image', item)}
              />
            ))
          ) : (
            <View style={s.emptyBox}>
              <Ionicons name="hourglass-outline" size={40} color={T.textMuted} />
              <Text style={s.emptyText}>No completed actions yet</Text>
            </View>
          )}
        </View>

        {/* ── Pagination ────────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <View style={s.pagination}>
            <TouchableOpacity
              style={[s.pageBtn, currentPage === 1 && s.pageBtnDisabled]}
              onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <Ionicons name="chevron-back" size={18} color={currentPage === 1 ? T.textMuted : T.cyan} />
            </TouchableOpacity>
            <View style={s.pageInfo}>
              <Text style={[s.pageNum, { color: T.cyan }]}>{currentPage}</Text>
              <Text style={s.pageSep}> / </Text>
              <Text style={s.pageTotal}>{totalPages}</Text>
            </View>
            <TouchableOpacity
              style={[s.pageBtn, currentPage === totalPages && s.pageBtnDisabled]}
              onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <Ionicons name="chevron-forward" size={18} color={currentPage === totalPages ? T.textMuted : T.cyan} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Loading overlays ─────────────────────────────────────────── */}
        {(locationLoader || photoLoader) && (
          <View style={s.floatingLoader}>
            <ActivityIndicator color={T.cyan} />
            <Text style={s.floatingLoaderText}>
              {locationLoader ? 'Capturing GPS...' : 'Opening camera...'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ═══════════════════════ ACTION MODAL ═══════════════════════════════ */}
      <Modal visible={actionModalVisible} transparent animationType="slide">
        <View style={m.backdrop}>
          <View style={m.sheet}>
            <View style={m.handle} />
            <Text style={m.title}>Select Action</Text>

            {['Anti Larval Work', 'Source Reduction', 'Fogging'].map(txt => {
              const checked = selectedActions[selectedRowId!]?.includes(txt);
              return (
                <TouchableOpacity
                  key={txt}
                  style={[m.checkRow, checked && { borderColor: T.cyan, backgroundColor: T.cyanDim }]}
                  onPress={() => toggleAction(txt)}
                  activeOpacity={0.7}
                >
                  <View style={[m.checkbox, checked && { backgroundColor: T.cyan, borderColor: T.cyan }]}>
                    {checked && <Ionicons name="checkmark" size={12} color={T.bg} />}
                  </View>
                  <Text style={[m.checkLabel, checked && { color: T.cyan }]}>{txt}</Text>
                </TouchableOpacity>
              );
            })}

            {selectedActions[selectedRowId!]?.includes('Source Reduction') &&
              Array.isArray(selectedRowData?.sources) && selectedRowData!.sources.length > 0 && (
                <View style={m.sourcesBox}>
                  <Text style={m.sourcesTitle}>Source Actions</Text>
                  {selectedRowData!.sources.map((src, idx) => {
                    const act = sourceActions[selectedRowData!.id]?.[src.sourceName]?.action;
                    return (
                      <View key={idx} style={m.sourceRow}>
                        <View style={{ marginBottom: 12 }}>
                          <Text style={m.sourceName}>🔹 {src.sourceName}</Text>
                          <Text style={m.sourceCount}>Total found: {src.count}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <RadioOption
                            label="Destroyed"
                            selected={act === 'Destroyed'}
                            color={T.rose}
                            onPress={() => {
                              if (!selectedRowData) return;
                              setSourceActions(prev => ({
                                ...prev,
                                [selectedRowData.id]: {
                                  ...(prev[selectedRowData.id] || {}),
                                  [src.sourceName]: { action: 'Destroyed' as const },
                                },
                              }));
                            }}
                          />
                          <RadioOption
                            label="Treated"
                            selected={act === 'Treated'}
                            color={T.emerald}
                            onPress={() => {
                              if (!selectedRowData) return;
                              setSourceActions(prev => ({
                                ...prev,
                                [selectedRowData.id]: {
                                  ...(prev[selectedRowData.id] || {}),
                                  [src.sourceName]: { action: 'Treated' as const },
                                },
                              }));
                            }}
                          />
                        </View>

                        {act && act !== 'Not Selected' && (
                          <Text style={[s.actionConfirmedText, { color: act === 'Destroyed' ? T.rose : T.emerald }]}>
                            Selected: {act}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

            <TouchableOpacity style={m.primaryBtn} onPress={() => startActionFlow(selectedRowId!)}>
              {locationLoader || photoLoader
                ? <ActivityIndicator color={T.bg} size="small" />
                : <>
                  <Ionicons name="flash" size={16} color={T.bg} />
                  <Text style={m.primaryBtnText}>Next — Capture</Text>
                </>
              }
            </TouchableOpacity>
            <TouchableOpacity style={m.ghostBtn} onPress={() => setActionModalVisible(false)}>
              <Text style={m.ghostBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════ PREVIEW MODAL ══════════════════════════════ */}
      <Modal visible={previewModalVisible} transparent animationType="fade">
        <View style={m.backdrop}>
          <ScrollView contentContainerStyle={m.previewScroll} showsVerticalScrollIndicator={false}>
            <View style={m.previewBox}>
              <View style={m.handle} />
              <Text style={m.title}>Confirm & Submit</Text>

              {Array.isArray(selectedRowData?.sources) && selectedRowData!.sources.length > 0 && (
                <View style={m.sourcesBox}>
                  <Text style={m.sourcesTitle}>Source Summary</Text>
                  <View style={m.tableHead}>
                    <Text style={[m.tableHeadCell, { flex: 2 }]}>Source</Text>
                    <Text style={[m.tableHeadCell, { flex: 0.8, textAlign: 'center' }]}>Count</Text>
                    <Text style={[m.tableHeadCell, { flex: 1.2, textAlign: 'right' }]}>Action</Text>
                  </View>
                  {selectedRowData!.sources.map((src, idx) => {
                    const act = sourceActions[selectedRowId!]?.[src.sourceName]?.action || 'Not Selected';
                    const color = act === 'Destroyed' ? T.rose : act === 'Treated' ? T.emerald : T.textMuted;
                    return (
                      <View key={idx} style={m.tableRow}>
                        <Text style={[m.tableCell, { flex: 2 }]}>{src.sourceName}</Text>
                        <Text style={[m.tableCell, { flex: 0.8, textAlign: 'center' }]}>{src.count}</Text>
                        <Text style={[m.tableCell, { flex: 1.2, textAlign: 'right', color, fontWeight: '700' }]}>{act}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              <Text style={m.previewSectionLabel}>📍 Action Location</Text>
              {capturedLocation ? (
                <View style={[m.map, { backgroundColor: '#091322', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ fontSize: 24, marginBottom: 6 }}>📍</Text>
                  <Text style={{ color: '#00E5FF', fontWeight: '800', fontSize: 13 }}>
                    {capturedLocation.latitude.toFixed(5)}°N, {capturedLocation.longitude.toFixed(5)}°E
                  </Text>
                </View>
              ) : (
                <View style={m.missingBox}><Text style={m.missingText}>Location not captured</Text></View>
              )}

              <Text style={m.previewSectionLabel}>📷 Action Photo</Text>
              {capturedImage ? (
                <Image source={{ uri: capturedImage }} style={m.previewImg} resizeMode="cover" />
              ) : (
                <View style={m.missingBox}><Text style={m.missingText}>No image captured</Text></View>
              )}

              <TouchableOpacity style={m.primaryBtn} onPress={submitAction} disabled={submitting}>
                {submitting
                  ? <ActivityIndicator color={T.bg} size="small" />
                  : <>
                    <Ionicons name="checkmark-circle" size={16} color={T.bg} />
                    <Text style={m.primaryBtnText}>Submit Entry</Text>
                  </>
                }
              </TouchableOpacity>
              <TouchableOpacity style={m.ghostBtn} onPress={() => setPreviewModalVisible(false)}>
                <Text style={m.ghostBtnText}>Back</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ═══════════════════════ VIEW MODAL ════════════════════════════════ */}
      <Modal visible={viewModalVisible} transparent animationType="fade">
        <View style={m.backdrop}>
          <View style={m.sheet}>
            <View style={m.handle} />
            <Text style={m.title}>
              {modalViewData.type === 'register_location' ? '📍 Entry Location'
                : modalViewData.type === 'register_image' ? '📷 Entry Photo'
                  : modalViewData.type === 'action_image' ? '📷 Action Photo'
                    : '📍 Action Location'}
            </Text>

            {modalViewData.type === 'register_location' && modalViewData.row?.latitude && (
              <View style={[m.map, { backgroundColor: '#091322', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ fontSize: 24, marginBottom: 6 }}>📍</Text>
                <Text style={{ color: '#00E5FF', fontWeight: '800', fontSize: 13 }}>
                  {Number(modalViewData.row.latitude).toFixed(5)}°N, {Number(modalViewData.row.longitude).toFixed(5)}°E
                </Text>
              </View>
            )}
            {modalViewData.type === 'register_image' && modalViewData.row?.image_path && (
              <Image source={{ uri: `${BASE_URL}${modalViewData.row.image_path}` }} style={m.previewImg} />
            )}
            {modalViewData.type === 'action_image' && modalViewData.row?.action_image_path && (
              <Image source={{ uri: `${BASE_URL}${modalViewData.row.action_image_path}` }} style={m.previewImg} />
            )}
            {modalViewData.type === 'action_location' && modalViewData.row && actionLocations[modalViewData.row.id] && (
              <View style={[m.map, { backgroundColor: '#091322', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ fontSize: 24, marginBottom: 6 }}>📍</Text>
                <Text style={{ color: '#34D399', fontWeight: '800', fontSize: 13 }}>
                  {Number(actionLocations[modalViewData.row.id].latitude).toFixed(5)}°N, {Number(actionLocations[modalViewData.row.id].longitude).toFixed(5)}°E
                </Text>
              </View>
            )}

            <TouchableOpacity style={m.ghostBtn} onPress={() => setViewModalVisible(false)}>
              <Text style={m.ghostBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════ INFO MODAL ════════════════════════════════ */}
      <Modal visible={infoModalVisible} transparent animationType="fade">
        <View style={m.backdrop}>
          <View style={m.sheet}>
            <View style={m.handle} />
            <Text style={m.title}>ℹ️ How It Works</Text>
            <Text style={m.infoText}>
              {'✦ Tap "Take Action" on a pending entry\n✦ Select the type of action taken\n✦ GPS location is captured automatically\n✦ Take a photo as evidence\n✦ Review and submit'}
            </Text>
            <TouchableOpacity style={m.ghostBtn} onPress={() => setInfoModalVisible(false)}>
              <Text style={m.ghostBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, gap: 12 },
  headerBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.bgGlassBorder },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: T.textPrimary, letterSpacing: 0.3 },
  headerPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, backgroundColor: T.cyanDim, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: T.cyanBorder },
  headerPillText: { fontSize: 11, fontWeight: '700', color: T.cyan, letterSpacing: 0.5 },
  scroll: { flex: 1 },
  section: { paddingHorizontal: 16, marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: T.textPrimary, letterSpacing: 0.2, marginBottom: 12 },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  refreshBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: T.cyanDim, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.cyanBorder },

  // ── Breakdown ────────────────────────────────────────────────────────────────
  breakdownGrid: { gap: 10 },
  bdCard: { backgroundColor: T.bgCard, borderRadius: 16, padding: 14, borderWidth: 1 },
  bdTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  bdIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  bdLabel: { flex: 1, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  bdPct: { fontSize: 13, fontWeight: '800', color: T.textMuted },
  bdPendingBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  bdPendingBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  bdBarTrack: { height: 5, backgroundColor: T.bgGlass, borderRadius: 99, marginBottom: 12, overflow: 'hidden' },
  bdBarFill: { height: 5, borderRadius: 99 },
  bdStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bdStat: { alignItems: 'center', flex: 1 },
  bdStatNum: { fontSize: 20, fontWeight: '800' },
  bdStatLabel: { fontSize: 10, color: T.textMuted, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  bdDot: { width: 4, height: 4, borderRadius: 2 },

  // ── General ──────────────────────────────────────────────────────────────────
  countBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  countBadgeText: { fontSize: 12, fontWeight: '800' },
  emptyBox: { alignItems: 'center', paddingVertical: 36, backgroundColor: T.bgCard, borderRadius: 16, borderWidth: 1, borderColor: T.bgGlassBorder, marginTop: 8, gap: 10 },
  emptyText: { fontSize: 14, color: T.textSecondary, fontWeight: '600' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, paddingVertical: 24 },
  pageBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: T.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.bgGlassBorder },
  pageBtnDisabled: { opacity: 0.3 },
  pageInfo: { flexDirection: 'row', alignItems: 'baseline' },
  pageNum: { fontSize: 18, fontWeight: '800' },
  pageSep: { fontSize: 14, color: T.textMuted },
  pageTotal: { fontSize: 14, color: T.textSecondary, fontWeight: '600' },
  floatingLoader: { position: 'absolute', bottom: 24, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.bgElevated, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, borderWidth: 1, borderColor: T.cyanBorder },
  floatingLoaderText: { fontSize: 13, color: T.cyan, fontWeight: '600' },
  actionConfirmedText: { marginTop: 8, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});

// ─── Modal Styles ─────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: T.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: T.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, borderWidth: 1, borderColor: T.bgGlassBorder, borderBottomWidth: 0 },
  previewScroll: { flexGrow: 1, justifyContent: 'flex-end' },
  previewBox: { backgroundColor: T.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, borderWidth: 1, borderColor: T.bgGlassBorder, borderBottomWidth: 0 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: T.textMuted, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', color: T.textPrimary, textAlign: 'center', marginBottom: 20, letterSpacing: 0.2 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: T.bgGlassBorder, marginBottom: 10, backgroundColor: T.bgGlass },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: T.textMuted, alignItems: 'center', justifyContent: 'center' },
  checkLabel: { fontSize: 14, color: T.textSecondary, fontWeight: '600' },
  sourcesBox: { backgroundColor: T.bgElevated, borderRadius: 14, padding: 14, marginVertical: 12, borderWidth: 1, borderColor: T.bgGlassBorder },
  sourcesTitle: { fontSize: 13, fontWeight: '800', color: T.cyan, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  sourceRow: { marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: T.bgGlassBorder },
  sourceName: { fontSize: 14, fontWeight: '700', color: T.textPrimary, marginBottom: 2 },
  sourceCount: { fontSize: 12, color: T.textMuted, marginBottom: 10 },
  tableHead: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: T.bgGlassBorder, marginBottom: 6 },
  tableHeadCell: { fontSize: 11, fontWeight: '800', color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.bgGlassBorder },
  tableCell: { fontSize: 13, color: T.textSecondary, fontWeight: '500', flex: 1 },
  previewSectionLabel: { fontSize: 13, fontWeight: '700', color: T.textSecondary, marginBottom: 8, marginTop: 4 },
  map: { width: '100%', height: 200, borderRadius: 14, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: T.cyanBorder },
  previewImg: { width: '100%', height: 220, borderRadius: 14, marginBottom: 14, borderWidth: 1, borderColor: T.cyanBorder },
  missingBox: { padding: 16, backgroundColor: T.bgGlass, borderRadius: 10, borderWidth: 1, borderColor: T.bgGlassBorder, alignItems: 'center', marginBottom: 14 },
  missingText: { fontSize: 13, color: T.textMuted, fontWeight: '500' },
  infoText: { fontSize: 14, color: T.textSecondary, lineHeight: 26, fontWeight: '500' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, backgroundColor: T.cyan, borderRadius: 14, marginTop: 16 },
  primaryBtnText: { fontSize: 15, fontWeight: '800', color: T.bg },
  ghostBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 8 },
  ghostBtnText: { fontSize: 14, fontWeight: '700', color: T.textSecondary },
});