import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Image,
  Alert, ActivityIndicator, StyleSheet, Platform, StatusBar,
  FlatList, Dimensions, Modal, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { pushDataToServer, BASE_URL } from '../../../../services/api';

const { width: SW, height: SH } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────
// API CONFIG
// ─────────────────────────────────────────────────────────────
const API_BASE = BASE_URL;

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface LatLng { latitude: number; longitude: number; accuracy?: number; }
interface ImgData { uri: string; base64?: string; name?: string; }
interface DropdownItem { label: string; value: string; }

interface CollectedDataItem {
  id: string; user_id: string; username: string;
  block_name: string;
  geolocation: LatLng; user_geolocation: LatLng;
  address: string; date: string; time: string;
  selected_area: string;
  monitoringArea: 'Fever' | 'Dengue' | 'Routine ATP' | 'Scrub';
  phc_id?: string; phc_name?: string;
  hsc_id?: string; hsc_name?: string;
  images: ImgData[]; synced: boolean;
  syncedAt?: string; createdAt: string;
}
interface UserInfo {
  user_id: string; username: string; block_name: string;
  district_name?: string; address?: string;
}
type TabType = 'collect' | 'sync' | 'calendar';
type NetworkStatus = 'online' | 'offline' | 'syncing';

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const MONITORING_OPTIONS: {
  label: string; value: CollectedDataItem['monitoringArea'];
  icon: string; accent: string; lightBg: string;
}[] = [
    { label: 'Fever', value: 'Fever', icon: 'thermometer-high', accent: '#EF4444', lightBg: '#FEF2F2' },
    { label: 'Dengue', value: 'Dengue', icon: 'bug-outline', accent: '#F97316', lightBg: '#FFF7ED' },
    { label: 'Routine ATP', value: 'Routine ATP', icon: 'clipboard-check-outline', accent: '#10B981', lightBg: '#ECFDF5' },
    { label: 'Scrub', value: 'Scrub', icon: 'leaf-circle-outline', accent: '#8B5CF6', lightBg: '#F5F3FF' },
  ];

const STORAGE = {
  DATA: 'mosquito_data_v3',
  USER: 'user_info',
  SYNC: 'last_sync_time',
} as const;

const TABS: { id: TabType; icon: string; label: string }[] = [
  { id: 'collect', icon: 'database-plus-outline', label: 'Collect' },
  { id: 'sync', icon: 'cloud-sync-outline', label: 'Sync' },
  { id: 'calendar', icon: 'calendar-month-outline', label: 'Calendar' },
];

// ─────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────
const C = {
  bg: '#F0F4FF',
  bgCard: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceHigh: '#F8FAFF',
  surfaceMid: '#EEF2FF',
  border: '#E2E8F8',
  borderMed: '#C7D2F0',
  borderFocus: '#6366F1',
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryBright: '#818CF8',
  primaryDim: '#EEF2FF',
  primaryGlow: '#6366F122',
  teal: '#0EA5E9',
  tealDim: '#E0F2FE',
  green: '#10B981',
  greenDim: '#ECFDF5',
  greenDark: '#059669',
  amber: '#F59E0B',
  amberDim: '#FFFBEB',
  amberDark: '#D97706',
  red: '#EF4444',
  redDim: '#FEF2F2',
  violet: '#8B5CF6',
  violetDim: '#F5F3FF',
  text: '#0F172A',
  textSec: '#475569',
  textMuted: '#94A3B8',
  textLight: '#CBD5E1',
  white: '#FFFFFF',
  overlay: '#00000050',
  shadowColor: '#1E3A8A',
};

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────
const nowDT = () => {
  const n = new Date();
  return {
    date: n.toISOString().split('T')[0],
    time: n.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
  };
};
const uid = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const firstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// ─────────────────────────────────────────────────────────────
// SECTION LABEL
// ─────────────────────────────────────────────────────────────
const SL = ({ text, required }: { text: string; required?: boolean }) => (
  <View style={g.slRow}>
    <Text style={g.slText}>{text}</Text>
    {required && <Text style={g.slRequired}>*</Text>}
  </View>
);

// ─────────────────────────────────────────────────────────────
// DIVIDER
// ─────────────────────────────────────────────────────────────
const Divider = () => <View style={g.divider} />;

// ─────────────────────────────────────────────────────────────
// CUSTOM DROPDOWN
// ─────────────────────────────────────────────────────────────
interface DropdownProps {
  label: string; placeholder: string;
  value: string | null; items: DropdownItem[];
  onSelect: (item: DropdownItem) => void;
  loading?: boolean; optional?: boolean;
  iconName?: string; accent?: string;
  accentDim?: string; disabled?: boolean;
  required?: boolean;
}
function Dropdown({
  label, placeholder, value, items, onSelect,
  loading, optional, iconName, accent = C.primary,
  accentDim = C.primaryDim, disabled, required,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.value === value);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const openModal = () => {
    if (disabled) return;
    setOpen(true);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 1, tension: 70, friction: 12, useNativeDriver: true }),
    ]).start();
  };
  const closeModal = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => setOpen(false));
  };

  const monOpt = MONITORING_OPTIONS.find((o) => o.value === value);
  const resolvedAccent = monOpt?.accent ?? accent;
  const resolvedDim = monOpt?.lightBg ?? accentDim;
  const isFocused = !!selected;

  return (
    <View style={{ marginBottom: 16 }}>
      <SL text={label} required={required} />
      <TouchableOpacity
        style={[
          g.dropTrigger,
          isFocused && { borderColor: resolvedAccent, backgroundColor: resolvedDim },
          disabled && { opacity: 0.45, backgroundColor: C.surfaceHigh },
        ]}
        onPress={openModal}
        activeOpacity={0.8}
        disabled={disabled}
      >
        <View style={g.dropTriggerLeft}>
          {(monOpt || iconName) && (
            <View style={[g.dropIconBadge, { backgroundColor: isFocused ? resolvedAccent + '22' : C.surfaceMid }]}>
              <MaterialCommunityIcons
                name={(monOpt?.icon ?? iconName) as any}
                size={16}
                color={isFocused ? resolvedAccent : C.textMuted}
              />
            </View>
          )}
          <Text style={[
            g.dropTriggerText,
            !selected && { color: C.textMuted },
            selected && { color: C.text, fontWeight: '600' },
          ]}>
            {selected ? selected.label : placeholder}
          </Text>
        </View>
        {loading
          ? <ActivityIndicator size="small" color={C.textMuted} />
          : <MaterialCommunityIcons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={isFocused ? resolvedAccent : C.textMuted}
          />
        }
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="none" onRequestClose={closeModal}>
        <Animated.View style={[g.modalOverlay, { opacity: fadeAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeModal} activeOpacity={1} />
          <Animated.View style={[
            g.modalSheet,
            { transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [SH * 0.6, 0] }) }] },
          ]}>
            <View style={g.sheetHandle} />
            <View style={g.sheetTitleRow}>
              <View style={[g.sheetTitleIcon, { backgroundColor: resolvedDim }]}>
                <MaterialCommunityIcons
                  name={(monOpt?.icon ?? iconName ?? 'format-list-bulleted') as any}
                  size={16} color={resolvedAccent}
                />
              </View>
              <Text style={g.sheetTitle}>{label}</Text>
              <TouchableOpacity onPress={closeModal} style={g.sheetCloseBtn}>
                <MaterialCommunityIcons name="close" size={15} color={C.textMuted} />
              </TouchableOpacity>
            </View>
            <Divider />
            {optional && (
              <TouchableOpacity
                style={g.sheetClearRow}
                onPress={() => { onSelect({ label: '', value: '' }); closeModal(); }}
              >
                <View style={[g.sheetItemIcon, { backgroundColor: C.redDim }]}>
                  <MaterialCommunityIcons name="close-circle-outline" size={15} color={C.red} />
                </View>
                <Text style={[g.sheetItemText, { color: C.textMuted }]}>Clear selection</Text>
              </TouchableOpacity>
            )}
            <FlatList
              data={items}
              keyExtractor={(i) => i.value}
              style={{ maxHeight: SH * 0.44 }}
              renderItem={({ item }) => {
                const isActive = item.value === value;
                const mOpt = MONITORING_OPTIONS.find((o) => o.value === item.value);
                const iA = mOpt?.accent ?? accent;
                const iADim = mOpt?.lightBg ?? accentDim;
                return (
                  <TouchableOpacity
                    style={[g.sheetItem, isActive && { backgroundColor: iADim }]}
                    onPress={() => { onSelect(item); closeModal(); }}
                    activeOpacity={0.6}
                  >
                    <View style={[g.sheetItemIcon, { backgroundColor: isActive ? iA + '20' : C.surfaceMid }]}>
                      {mOpt
                        ? <MaterialCommunityIcons name={mOpt.icon as any} size={16} color={isActive ? iA : C.textMuted} />
                        : <MaterialCommunityIcons name={(iconName ?? 'map-marker-outline') as any} size={16} color={isActive ? iA : C.textMuted} />
                      }
                    </View>
                    <Text style={[g.sheetItemText, isActive && { color: iA, fontWeight: '700' }]}>
                      {item.label}
                    </Text>
                    {isActive && (
                      <View style={[g.sheetCheck, { backgroundColor: iA }]}>
                        <MaterialCommunityIcons name="check" size={11} color={C.white} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={g.sheetSep} />}
            />
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// DATA COLLECTION TAB
// ─────────────────────────────────────────────────────────────
function DataCollection({ userInfo, onDataSaved }: { userInfo: UserInfo | null; onDataSaved: () => void }) {
  const [location, setLocation] = useState<LatLng | null>(null);
  const [images, setImages] = useState<ImgData[]>([]);
  const [monArea, setMonArea] = useState<CollectedDataItem['monitoringArea'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [locLoading, setLocLoading] = useState(true);
  const [mapExpanded, setMapExpanded] = useState(false);

  const [phcList, setPhcList] = useState<DropdownItem[]>([]);
  const [hscList, setHscList] = useState<DropdownItem[]>([]);
  const [phcLoading, setPhcLoading] = useState(false);
  const [hscLoading, setHscLoading] = useState(false);
  const [selPhc, setSelPhc] = useState<DropdownItem | null>(null);
  const [selHsc, setSelHsc] = useState<DropdownItem | null>(null);

  useEffect(() => { fetchLocation(); fetchPHC(); }, []);

  const fetchLocation = async () => {
    setLocLoading(true); setLocError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocError('Location permission denied.\nEnable in device Settings.');
        setLocLoading(false); return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const loc: LatLng = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? undefined,
      };
      setLocation(loc);
    } catch {
      setLocError('Unable to fetch location.\nTap Retry to try again.');
    } finally { setLocLoading(false); }
  };

  const fetchPHC = async () => {
    setPhcLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/phc/list`);
      if (res.ok) {
        const json = await res.json();
        setPhcList((json.data ?? json).map((p: any) => ({ label: p.name, value: String(p.id) })));
      }
    } catch { } finally { setPhcLoading(false); }
  };

  const fetchHSC = async (phcId: string) => {
    setHscLoading(true); setHscList([]); setSelHsc(null);
    try {
      const res = await fetch(`${API_BASE}/api/hsc/list?phc_id=${phcId}`);
      if (res.ok) {
        const json = await res.json();
        setHscList((json.data ?? json).map((h: any) => ({ label: h.name, value: String(h.id) })));
      }
    } catch { } finally { setHscLoading(false); }
  };

  const handlePhcSelect = (item: DropdownItem) => {
    if (!item.value) { setSelPhc(null); setHscList([]); setSelHsc(null); return; }
    setSelPhc(item); fetchHSC(item.value);
  };

  // ── Camera only, single image ──
  const handleImageCapture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to capture evidence.');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({
      quality: 0.75,
      base64: true,
      allowsEditing: false,
    });
    if (!r.canceled && r.assets[0]) {
      const a = r.assets[0];
      setImages([{ uri: a.uri, base64: a.base64 ?? undefined, name: a.fileName ?? `photo_${Date.now()}.jpg` }]);
    }
  };

  const handleSave = async () => {
    if (!location) { Alert.alert('GPS Required', 'Waiting for location fix.'); return; }
    if (!images.length) { Alert.alert('Photo Required', 'Capture a photo before saving.'); return; }
    if (!monArea) { Alert.alert('Required', 'Please select a monitoring type.'); return; }
    if (!userInfo) { Alert.alert('Error', 'User info missing.'); return; }
    setIsLoading(true);
    try {
      const { date, time } = nowDT();
      const rec: CollectedDataItem = {
        id: uid(), ...userInfo,
        geolocation: location, user_geolocation: location,
        address: userInfo.address ?? '',
        date, time,
        selected_area: selPhc?.label ?? 'Unknown',
        monitoringArea: monArea,
        phc_id: selPhc?.value, phc_name: selPhc?.label,
        hsc_id: selHsc?.value, hsc_name: selHsc?.label,
        images, synced: false, createdAt: new Date().toISOString(),
      };
      const raw = await AsyncStorage.getItem(STORAGE.DATA);
      const all: CollectedDataItem[] = raw ? JSON.parse(raw) : [];
      all.push(rec);
      await AsyncStorage.setItem(STORAGE.DATA, JSON.stringify(all));
      setImages([]); setMonArea(null); setSelPhc(null); setSelHsc(null); setHscList([]);
      onDataSaved();
      Alert.alert('Record Saved ✓', `${all.length} record${all.length !== 1 ? 's' : ''} stored locally.`);
    } catch {
      Alert.alert('Save Failed', 'Something went wrong. Please try again.');
    } finally { setIsLoading(false); }
  };

  // ── GPS loading ──
  if (locLoading) return (
    <View style={g.centered}>
      <View style={g.loadingRing}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
      <Text style={g.bigLabel}>Acquiring Signal</Text>
      <Text style={g.subLabel}>Fetching your GPS coordinates…</Text>
    </View>
  );

  if (locError) return (
    <View style={g.centered}>
      <View style={[g.loadingRing, { borderColor: C.red + '30', backgroundColor: C.redDim }]}>
        <MaterialCommunityIcons name="map-marker-off-outline" size={30} color={C.red} />
      </View>
      <Text style={[g.bigLabel, { color: C.red }]}>Location Unavailable</Text>
      <Text style={[g.subLabel, { textAlign: 'center' }]}>{locError}</Text>
      <TouchableOpacity style={g.retryBtn} onPress={fetchLocation} activeOpacity={0.8}>
        <MaterialCommunityIcons name="refresh" size={15} color={C.white} />
        <Text style={g.retryTxt}>Retry GPS</Text>
      </TouchableOpacity>
    </View>
  );

  const monOpt = MONITORING_OPTIONS.find((o) => o.value === monArea);
  const canSave = !isLoading && !!location && images.length > 0 && !!monArea;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── FACILITY ── */}
      <View style={g.sectionCard}>
        <View style={g.sectionHeader}>
          <View style={[g.sectionHeaderIcon, { backgroundColor: C.tealDim }]}>
            <MaterialCommunityIcons name="hospital-building" size={16} color={C.teal} />
          </View>
          <Text style={g.sectionTitle}>Facility Details</Text>
        </View>
        <Divider />
        <View style={{ paddingTop: 16 }}>
          <Dropdown
            label="PHC Location"
            placeholder="Select Primary Health Centre"
            value={selPhc?.value ?? null}
            items={phcList}
            onSelect={handlePhcSelect}
            loading={phcLoading}
            optional
            iconName="hospital-building"
            accent={C.teal}
            accentDim={C.tealDim}
          />
          {(selPhc?.value || hscList.length > 0) && (
            <Dropdown
              label="HSC Location"
              placeholder="Select Health Sub-Centre"
              value={selHsc?.value ?? null}
              items={hscList}
              onSelect={(item) => setSelHsc(item.value ? item : null)}
              loading={hscLoading}
              optional
              iconName="home-plus-outline"
              accent={C.violet}
              accentDim={C.violetDim}
              disabled={hscLoading}
            />
          )}
        </View>
      </View>

      {/* ── GPS MAP ── */}
      <View style={g.sectionCard}>
        <View style={g.sectionHeader}>
          <View style={[g.sectionHeaderIcon, { backgroundColor: C.greenDim }]}>
            <MaterialCommunityIcons name="crosshairs-gps" size={16} color={C.green} />
          </View>
          <Text style={g.sectionTitle}>GPS Location</Text>
          <View style={g.gpsLiveBadge}>
            <View style={g.gpsLiveDot} />
            <Text style={g.gpsLiveTxt}>Live</Text>
          </View>
        </View>
        <Divider />
        <View style={[g.mapCard, { backgroundColor: '#091322', justifyContent: 'center', alignItems: 'center' }]}>
          {location && (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 140, height: 140, borderRadius: 70, borderWidth: 1, borderColor: 'rgba(0,212,255,0.15)', position: 'absolute' }} />
              <View style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: 'rgba(0,212,255,0.25)', position: 'absolute' }} />
              <View style={g.markerOuter}>
                <View style={[g.markerInner, { backgroundColor: monOpt?.accent ?? C.primary }]}>
                  <MaterialCommunityIcons name="crosshairs-gps" size={14} color={C.white} />
                </View>
              </View>
            </View>
          )}
          <View style={g.mapControls}>
            <TouchableOpacity style={g.mapCtrlBtn} onPress={fetchLocation} activeOpacity={0.8}>
              <MaterialCommunityIcons name="crosshairs-gps" size={15} color={C.teal} />
            </TouchableOpacity>
            <TouchableOpacity style={g.mapCtrlBtn} onPress={() => setMapExpanded((v) => !v)} activeOpacity={0.8}>
              <MaterialCommunityIcons name={mapExpanded ? 'arrow-collapse' : 'arrow-expand'} size={14} color={C.textSec} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={g.coordRow}>
          <MaterialCommunityIcons name="map-marker-check-outline" size={14} color={C.green} />
          <Text style={g.coordText}>
            {location!.latitude.toFixed(6)}°N  ·  {location!.longitude.toFixed(6)}°E
          </Text>
          {location!.accuracy != null && (
            <View style={g.accBadge}>
              <Text style={g.accText}>±{location!.accuracy.toFixed(0)}m</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── MONITORING TYPE ── */}
      <View style={g.sectionCard}>
        <View style={g.sectionHeader}>
          <View style={[g.sectionHeaderIcon, { backgroundColor: monOpt?.lightBg ?? C.primaryDim }]}>
            <MaterialCommunityIcons
              name={(monOpt?.icon ?? 'stethoscope') as any}
              size={16}
              color={monOpt?.accent ?? C.primary}
            />
          </View>
          <Text style={g.sectionTitle}>Monitoring Type</Text>
          <View style={g.requiredBadge}><Text style={g.requiredTxt}>Required</Text></View>
        </View>
        <Divider />
        <View style={{ paddingTop: 16 }}>
          <Dropdown
            label="Select Monitoring Area"
            placeholder="Choose a monitoring type…"
            value={monArea}
            items={MONITORING_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
            onSelect={(item) => setMonArea(item.value as CollectedDataItem['monitoringArea'])}
            required
          />
          {monOpt && (
            <View style={[g.monPreviewCard, { backgroundColor: monOpt.lightBg, borderColor: monOpt.accent + '35' }]}>
              <View style={[g.monPreviewIcon, { backgroundColor: monOpt.accent + '18' }]}>
                <MaterialCommunityIcons name={monOpt.icon as any} size={22} color={monOpt.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[g.monPreviewLabel, { color: monOpt.accent }]}>{monOpt.label} Monitoring</Text>
                <Text style={g.monPreviewSub}>Selected area type</Text>
              </View>
              <TouchableOpacity
                onPress={() => setMonArea(null)}
                style={[g.monPreviewClear, { backgroundColor: monOpt.accent + '15' }]}
              >
                <MaterialCommunityIcons name="close" size={14} color={monOpt.accent} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* ── EVIDENCE PHOTO ── */}
      <View style={g.sectionCard}>
        <View style={g.sectionHeader}>
          <View style={[g.sectionHeaderIcon, { backgroundColor: '#FFF0F9' }]}>
            <MaterialCommunityIcons name="camera-outline" size={16} color="#E11D7A" />
          </View>
          <Text style={g.sectionTitle}>Evidence Photo</Text>
          {images.length > 0 && (
            <View style={g.photoBadge}>
              <Text style={g.photoBadgeTxt}>1 / 1</Text>
            </View>
          )}
        </View>
        <Divider />
        <View style={{ paddingTop: 14 }}>
          {images.length === 0 ? (
            /* ── No image yet ── */
            <TouchableOpacity
              style={[g.captureBtn, isLoading && { opacity: 0.5 }]}
              onPress={handleImageCapture}
              disabled={isLoading}
              activeOpacity={0.75}
            >
              <View style={g.captureBtnLeft}>
                <View style={g.captureBtnIcon}>
                  <MaterialCommunityIcons name="camera-plus-outline" size={18} color={C.primary} />
                </View>
                <View>
                  <Text style={g.captureBtnTitle}>Capture Photo</Text>
                  <Text style={g.captureBtnSub}>Opens camera  ·  1 photo max</Text>
                </View>
              </View>
              <View style={g.captureBtnArrow}>
                <MaterialCommunityIcons name="chevron-right" size={16} color={C.primary} />
              </View>
            </TouchableOpacity>
          ) : (
            /* ── Image preview ── */
            <View style={g.singleImgWrapper}>
              <Image
                source={{ uri: images[0].uri }}
                style={g.singleImgPreview}
                resizeMode="cover"
              />
              {/* Retake */}
              <TouchableOpacity
                style={g.retakeBtn}
                onPress={handleImageCapture}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="camera-retake-outline" size={15} color={C.white} />
                <Text style={g.retakeTxt}>Retake</Text>
              </TouchableOpacity>
              {/* Remove */}
              <TouchableOpacity
                style={g.singleRemoveBtn}
                onPress={() => setImages([])}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <MaterialCommunityIcons name="close" size={11} color={C.white} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* ── SAVE ── */}
      <TouchableOpacity
        style={[g.saveBtn, !canSave && g.saveBtnOff]}
        onPress={handleSave}
        disabled={!canSave}
        activeOpacity={0.85}
      >
        {isLoading
          ? <ActivityIndicator size="small" color={C.white} />
          : <MaterialCommunityIcons name="content-save-check-outline" size={20} color={C.white} />
        }
        <Text style={g.saveTxt}>{isLoading ? 'Saving…' : 'Save Record Locally'}</Text>
      </TouchableOpacity>

      {!canSave && !isLoading && (
        <Text style={g.validationHint}>
          {!monArea ? '· Select a monitoring type' : !images.length ? '· Capture a photo' : ''}
        </Text>
      )}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────
// SYNC TAB
// ─────────────────────────────────────────────────────────────
function SyncTab({ networkStatus }: { networkStatus: NetworkStatus }) {
  const [data, setData] = useState<CollectedDataItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    load();
    const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, []);

  const load = async () => {
    const raw = await AsyncStorage.getItem(STORAGE.DATA).catch(() => null);
    const all: CollectedDataItem[] = raw ? JSON.parse(raw) : [];
    setData(all.filter((x) => !x.synced));
  };

  const push = async () => {
    if (networkStatus !== 'online') {
      Alert.alert('No Connection', 'Records will sync when you are online.');
      return;
    }
    setIsSyncing(true);
    try {
      const raw = await AsyncStorage.getItem(STORAGE.DATA).catch(() => null);
      const all: CollectedDataItem[] = raw ? JSON.parse(raw) : [];
      const pending = all.filter((x) => !x.synced);
      if (!pending.length) { Alert.alert('All Synced', 'No pending records to upload.'); return; }

      let successCount = 0;
      const updated = [...all];

      for (const item of pending) {
        try {
          const payload = {
            ...item,
            images: item.images.map((img) => ({ base64: img.base64 || '', name: img.name || 'photo.jpg' })),
          };
          const res = await pushDataToServer(payload);
          if (res.ok) {
            const index = updated.findIndex((d) => d.id === item.id);
            if (index !== -1) { updated[index].synced = true; updated[index].syncedAt = new Date().toISOString(); successCount++; }
          }
        } catch (err) { console.log('❌ Error syncing item:', item.id, err); }
      }

      await AsyncStorage.setItem(STORAGE.DATA, JSON.stringify(updated));
      await AsyncStorage.setItem(STORAGE.SYNC, new Date().toISOString());
      setData(updated.filter((x) => !x.synced));
      Alert.alert('Sync Complete', `${successCount} of ${pending.length} records uploaded.`);
    } catch { Alert.alert('Sync Error', 'Something went wrong. Please try again.'); }
    finally { setIsSyncing(false); }
  };

  useEffect(() => {
    if (networkStatus === 'online' && data.length > 0) {
      const t = setTimeout(push, 2000);
      return () => clearTimeout(t);
    }
  }, [networkStatus, data.length]);

  const accentOf: Record<string, string> = { Fever: '#EF4444', Dengue: '#F97316', 'Routine ATP': '#10B981', Scrub: '#8B5CF6' };
  const lightBgOf: Record<string, string> = { Fever: '#FEF2F2', Dengue: '#FFF7ED', 'Routine ATP': '#ECFDF5', Scrub: '#F5F3FF' };
  const iconOf: Record<string, string> = { Fever: 'thermometer-high', Dengue: 'bug-outline', 'Routine ATP': 'clipboard-check-outline', Scrub: 'leaf-circle-outline' };

  const netCfg = networkStatus === 'online'
    ? { bg: C.greenDim, border: C.green + '40', text: C.greenDark, icon: 'wifi', lbl: 'Online — Ready to Sync' }
    : networkStatus === 'syncing'
      ? { bg: C.primaryDim, border: C.primary + '40', text: C.primaryDark, icon: 'cloud-sync', lbl: 'Syncing in progress…' }
      : { bg: C.amberDim, border: C.amber + '40', text: C.amberDark, icon: 'wifi-off', lbl: 'Offline — Will Auto-Sync' };

  const renderItem = ({ item, index }: { item: CollectedDataItem; index: number }) => {
    const ac = accentOf[item.monitoringArea] ?? C.primary;
    const lbg = lightBgOf[item.monitoringArea] ?? C.primaryDim;
    const ic = iconOf[item.monitoringArea] ?? 'bug-outline';
    return (
      <View style={[g.listCard, { borderLeftColor: ac }]}>
        <View style={[g.listNumBadge, { backgroundColor: lbg }]}>
          <Text style={[g.listNumTxt, { color: ac }]}>{String(index + 1).padStart(2, '0')}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={g.listTitleRow}>
            <View style={[g.listTypePill, { backgroundColor: lbg }]}>
              <MaterialCommunityIcons name={ic as any} size={11} color={ac} />
              <Text style={[g.listTypeTxt, { color: ac }]}>{item.monitoringArea}</Text>
            </View>
            {item.phc_name && <Text style={g.listMeta} numberOfLines={1}>{item.phc_name}</Text>}
          </View>
          <Text style={g.listDate}>{item.date}  ·  {item.time}</Text>
          <View style={g.metaRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={11} color={C.textMuted} />
            <Text style={g.metaTxt}>{item.geolocation.latitude.toFixed(5)}, {item.geolocation.longitude.toFixed(5)}</Text>
          </View>
          <View style={g.metaRow}>
            <MaterialCommunityIcons name="image-outline" size={11} color={C.textMuted} />
            <Text style={g.metaTxt}>{item.images.length} photo</Text>
          </View>
        </View>
        <View style={[g.syncPill, { backgroundColor: item.synced ? C.greenDim : C.amberDim }]}>
          <View style={[g.syncPillDot, { backgroundColor: item.synced ? C.green : C.amber }]} />
          <Text style={[g.syncPillTxt, { color: item.synced ? C.greenDark : C.amberDark }]}>
            {item.synced ? 'Synced' : 'Pending'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={[g.netBanner, { backgroundColor: netCfg.bg, borderColor: netCfg.border }]}>
        <View style={[g.netBannerIcon, { backgroundColor: netCfg.text + '18' }]}>
          <MaterialCommunityIcons name={netCfg.icon as any} size={14} color={netCfg.text} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[g.netTitle, { color: netCfg.text }]}>{netCfg.lbl}</Text>
          {data.length > 0 && (
            <Text style={[g.netSub, { color: netCfg.text + 'AA' }]}>
              {data.length} record{data.length !== 1 ? 's' : ''} awaiting upload
            </Text>
          )}
        </View>
        {isSyncing && <ActivityIndicator size="small" color={netCfg.text} />}
      </View>

      {data.length === 0 ? (
        <View style={g.centered}>
          <View style={[g.loadingRing, { borderColor: C.green + '40', backgroundColor: C.greenDim }]}>
            <MaterialCommunityIcons name="check-all" size={30} color={C.green} />
          </View>
          <Text style={g.bigLabel}>All Clear</Text>
          <Text style={g.subLabel}>No unsynced records</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 90 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      {data.length > 0 && (
        <View style={g.syncFooter}>
          <TouchableOpacity
            style={[g.syncBtn, (isSyncing || networkStatus === 'offline') && { opacity: 0.5 }]}
            onPress={push}
            disabled={isSyncing || networkStatus === 'offline'}
            activeOpacity={0.85}
          >
            {isSyncing
              ? <ActivityIndicator size="small" color={C.white} />
              : <MaterialCommunityIcons name="cloud-upload-outline" size={18} color={C.white} />
            }
            <Text style={g.syncBtnTxt}>
              {isSyncing ? 'Uploading…' : `Push ${data.length} Record${data.length !== 1 ? 's' : ''} to Server`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// CALENDAR TAB
// ─────────────────────────────────────────────────────────────
function CalendarTab() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [allData, setAllData] = useState<CollectedDataItem[]>([]);
  const [selDate, setSelDate] = useState<string | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  useEffect(() => {
    loadAll();
    const iv = setInterval(loadAll, 5000);
    return () => clearInterval(iv);
  }, []);

  const loadAll = async () => {
    const raw = await AsyncStorage.getItem(STORAGE.DATA).catch(() => null);
    setAllData(raw ? JSON.parse(raw) : []);
  };

  const countMap = useMemo(() => {
    const map: Record<string, { total: number; synced: number }> = {};
    allData.forEach((item) => {
      if (!item.date) return;
      const [y, m] = item.date.split('-').map(Number);
      if (y === year && m - 1 === month) {
        if (!map[item.date]) map[item.date] = { total: 0, synced: 0 };
        map[item.date].total++;
        if (item.synced) map[item.date].synced++;
      }
    });
    return map;
  }, [allData, year, month]);

  const monthStats = useMemo(() => {
    const days = Object.values(countMap);
    return {
      total: days.reduce((a, d) => a + d.total, 0),
      synced: days.reduce((a, d) => a + d.synced, 0),
      pending: days.reduce((a, d) => a + (d.total - d.synced), 0),
      activeDays: days.filter((d) => d.total > 0).length,
    };
  }, [countMap]);

  const maxCount = useMemo(() => Math.max(1, ...Object.values(countMap).map((d) => d.total)), [countMap]);

  const selectedItems = useMemo(
    () => allData.filter((item) => item.date === selDate).sort((a, b) => a.time.localeCompare(b.time)),
    [allData, selDate],
  );

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); };

  const days = daysInMonth(year, month);
  const offset = firstDayOfMonth(year, month);
  const cells = Array.from({ length: offset + days }, (_, i) => (i < offset ? null : i - offset + 1));

  const heatColor = (count: number) => {
    if (!count) return 'transparent';
    const r = count / maxCount;
    if (r < 0.25) return C.primary + '28';
    if (r < 0.5) return C.primary + '55';
    if (r < 0.75) return C.primary + '88';
    return C.primary;
  };

  const accentOf: Record<string, string> = { Fever: '#EF4444', Dengue: '#F97316', 'Routine ATP': '#10B981', Scrub: '#8B5CF6' };
  const lightBgOf: Record<string, string> = { Fever: '#FEF2F2', Dengue: '#FFF7ED', 'Routine ATP': '#ECFDF5', Scrub: '#F5F3FF' };
  const iconOf: Record<string, string> = { Fever: 'thermometer-high', Dengue: 'bug-outline', 'Routine ATP': 'clipboard-check-outline', Scrub: 'leaf-circle-outline' };

  const STATS = [
    { label: 'Total', value: monthStats.total, icon: 'database-outline', color: C.primary, bg: C.primaryDim },
    { label: 'Synced', value: monthStats.synced, icon: 'check-circle-outline', color: C.greenDark, bg: C.greenDim },
    { label: 'Pending', value: monthStats.pending, icon: 'clock-outline', color: C.amberDark, bg: C.amberDim },
    { label: 'Days', value: monthStats.activeDays, icon: 'calendar-check-outline', color: C.violet, bg: C.violetDim },
  ];

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

      {/* Stats row */}
      <View style={g.statsRow}>
        {STATS.map((s) => (
          <View key={s.label} style={[g.statCard, { borderColor: s.color + '30' }]}>
            <View style={[g.statIconWrap, { backgroundColor: s.bg }]}>
              <MaterialCommunityIcons name={s.icon as any} size={15} color={s.color} />
            </View>
            <Text style={[g.statVal, { color: s.color }]}>{s.value}</Text>
            <Text style={g.statLbl}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Calendar card */}
      <View style={g.sectionCard}>

        {/* Month nav */}
        <View style={g.calHeader}>
          <TouchableOpacity onPress={prevMonth} style={g.calNavBtn}>
            <MaterialCommunityIcons name="chevron-left" size={19} color={C.textSec} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={g.calMonthTxt}>{MONTH_NAMES[month]}  {year}</Text>
            {monthStats.total > 0 && (
              <Text style={g.calMonthSub}>{monthStats.total} submission{monthStats.total !== 1 ? 's' : ''}</Text>
            )}
          </View>
          <TouchableOpacity onPress={nextMonth} style={g.calNavBtn}>
            <MaterialCommunityIcons name="chevron-right" size={19} color={C.textSec} />
          </TouchableOpacity>
        </View>

        <Divider />

        {/* Day header row */}
        <View style={g.calDayNames}>
          {DAY_NAMES.map((d) => (
            <View key={d} style={{ width: CAL_CELL_W, alignItems: 'center', paddingVertical: 8 }}>
              <Text style={g.calDayName}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Grid */}
        <View style={g.calGrid}>
          {cells.map((day, idx) => {
            if (!day) return <View key={`e-${idx}`} style={{ width: CAL_CELL_W, height: CAL_CELL_W, marginBottom: 6 }} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const info = countMap[dateStr];
            const count = info?.total ?? 0;
            const synced = info?.synced ?? 0;
            const pending = count - synced;
            const isToday = dateStr === today.toISOString().split('T')[0];
            const isSel = selDate === dateStr;

            return (
              <TouchableOpacity
                key={dateStr}
                style={[
                  g.calCell,
                  { width: CAL_CELL_W, height: CAL_CELL_W, marginBottom: 6 },
                  count > 0 && !isSel && { backgroundColor: heatColor(count) },
                  isToday && !isSel && { borderWidth: 1.5, borderColor: C.primary },
                  isSel && { backgroundColor: C.primary },
                ]}
                onPress={() => { setSelDate(dateStr); if (count > 0) setDetailVisible(true); }}
                activeOpacity={0.7}
              >
                <Text style={[
                  g.calDayNum,
                  isToday && !isSel && { color: C.primary, fontWeight: '800' },
                  isSel && { color: C.white, fontWeight: '800' },
                  count > 0 && !isSel && { color: C.primaryDark, fontWeight: '700' },
                ]}>
                  {day}
                </Text>
                {/* Synced / Pending dot indicators */}
                {count > 0 && (
                  <View style={{ flexDirection: 'row', gap: 2, position: 'absolute', bottom: 4 }}>
                    {synced > 0 && (
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isSel ? C.white : C.green }} />
                    )}
                    {pending > 0 && (
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isSel ? C.white + 'AA' : C.amber }} />
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Legend */}
        <View style={g.legend}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 12 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} />
            <Text style={g.legendLbl}>Synced</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 12 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.amber }} />
            <Text style={g.legendLbl}>Pending</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 13, height: 13, borderRadius: 3, borderWidth: 1.5, borderColor: C.primary }} />
            <Text style={g.legendLbl}>Today</Text>
          </View>
        </View>
      </View>

      {/* Detail modal */}
      <Modal visible={detailVisible} transparent animationType="slide" onRequestClose={() => setDetailVisible(false)}>
        <View style={g.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setDetailVisible(false)} activeOpacity={1} />
          <View style={g.detailSheet}>
            <View style={g.sheetHandle} />
            <View style={g.detailHeader}>
              <View>
                <Text style={g.detailDate}>{selDate}</Text>
                <Text style={g.detailCount}>{selectedItems.length} record{selectedItems.length !== 1 ? 's' : ''} collected</Text>
              </View>
              <TouchableOpacity onPress={() => setDetailVisible(false)} style={g.sheetCloseBtn}>
                <MaterialCommunityIcons name="close" size={15} color={C.textMuted} />
              </TouchableOpacity>
            </View>
            <Divider />
            <FlatList
              data={selectedItems}
              keyExtractor={(i) => i.id}
              style={{ maxHeight: SH * 0.5 }}
              contentContainerStyle={{ paddingBottom: 24, paddingTop: 8 }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              renderItem={({ item }) => {
                const ac = accentOf[item.monitoringArea] ?? C.primary;
                const lbg = lightBgOf[item.monitoringArea] ?? C.primaryDim;
                const ic = iconOf[item.monitoringArea] ?? 'bug-outline';
                return (
                  <View style={[g.detailCard, { borderLeftColor: ac }]}>
                    <View style={[g.detailCardIcon, { backgroundColor: lbg }]}>
                      <MaterialCommunityIcons name={ic as any} size={16} color={ac} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={[g.listTypePill, { backgroundColor: lbg, alignSelf: 'flex-start', marginBottom: 4 }]}>
                        <Text style={[g.listTypeTxt, { color: ac }]}>{item.monitoringArea}</Text>
                      </View>
                      <Text style={g.listDate}>{item.time}</Text>
                      {item.phc_name && <Text style={g.metaTxt}>PHC: {item.phc_name}</Text>}
                      {item.hsc_name && <Text style={g.metaTxt}>HSC: {item.hsc_name}</Text>}
                      <View style={g.metaRow}>
                        <MaterialCommunityIcons name="map-marker-outline" size={11} color={C.textMuted} />
                        <Text style={g.metaTxt}>{item.geolocation.latitude.toFixed(5)}, {item.geolocation.longitude.toFixed(5)}</Text>
                      </View>
                    </View>
                    <View style={[g.syncPill, { backgroundColor: item.synced ? C.greenDim : C.amberDim }]}>
                      <View style={[g.syncPillDot, { backgroundColor: item.synced ? C.green : C.amber }]} />
                      <Text style={[g.syncPillTxt, { color: item.synced ? C.greenDark : C.amberDark }]}>
                        {item.synced ? 'Synced' : 'Pending'}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function DBCWorker() {
  const [tab, setTab] = useState<TabType>('collect');
  const [user, setUser] = useState<UserInfo | null>(null);
  const [net, setNet] = useState<NetworkStatus>('online');
  const [rKey, setRKey] = useState(0);

  const [userDropdownVisible, setUserDropdownVisible] = useState(false);
  const userFadeAnim = useRef(new Animated.Value(0)).current;
  const userSlideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (userDropdownVisible) {
      Animated.parallel([
        Animated.timing(userFadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(userSlideAnim, { toValue: 1, tension: 70, friction: 12, useNativeDriver: true }),
      ]).start();
    }
  }, [userDropdownVisible]);

  const closeUserModal = () => {
    Animated.parallel([
      Animated.timing(userFadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(userSlideAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => setUserDropdownVisible(false));
  };

  useEffect(() => {
    loadUser();
    const unsub = NetInfo.addEventListener((s) => setNet(s.isConnected ? 'online' : 'offline'));
    return () => unsub();
  }, []);

  const loadUser = async () => {
    const raw = await AsyncStorage.getItem(STORAGE.USER).catch(() => null);
    if (raw) { setUser(JSON.parse(raw)); return; }
    const mock: UserInfo = {
      user_id: 'USR001', username: 'health_worker_01',
      block_name: 'Block A', district_name: 'District 1',
      address: 'Health Centre, Ward 5',
    };
    setUser(mock);
    await AsyncStorage.setItem(STORAGE.USER, JSON.stringify(mock));
  };

  const netColor = net === 'online' ? C.greenDark : net === 'syncing' ? C.primaryDark : C.amberDark;
  const netBg = net === 'online' ? C.greenDim : net === 'syncing' ? C.primaryDim : C.amberDim;
  const netLabel = net === 'online' ? 'Online' : net === 'syncing' ? 'Syncing' : 'Offline';
  const netIcon = net === 'online' ? 'wifi' : net === 'syncing' ? 'cloud-sync' : 'wifi-off';

  return (
    <SafeAreaView style={g.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bgCard} />

      {/* ── HEADER ── */}
      <View style={g.header}>
        <View style={g.headerIconWrap}>
          <MaterialCommunityIcons name="shield-bug-outline" size={20} color={C.primary} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={g.headerTitle}>Vector Surveillance</Text>
          <Text style={g.headerSub}>Disease Monitoring System</Text>
        </View>
        <View style={[g.netPill, { backgroundColor: netBg, borderColor: netColor + '35' }]}>
          <View style={[g.netDot, { backgroundColor: netColor }]} />
          <MaterialCommunityIcons name={netIcon as any} size={11} color={netColor} />
          <Text style={[g.netPillTxt, { color: netColor }]}>{netLabel}</Text>
        </View>
      </View>

      {/* ── USER BANNER ── */}
      {user && (
        <>
          <TouchableOpacity
            style={g.userBanner}
            onPress={() => setUserDropdownVisible(true)}
            activeOpacity={0.8}
          >
            <View style={g.userAvatar}>
              <Text style={g.userAvatarTxt}>{user.username.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={g.userNameTxt}>{user.username}</Text>
              <Text style={g.userSubTxt}>
                {user.block_name}{user.district_name ? `  ·  ${user.district_name}` : ''}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-down" size={16} color={C.textMuted} />
          </TouchableOpacity>

          {/* User Profile Modal */}
          <Modal
            visible={userDropdownVisible}
            transparent
            animationType="none"
            onRequestClose={closeUserModal}
          >
            <Animated.View style={[g.modalOverlay, { opacity: userFadeAnim }]}>
              <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeUserModal} activeOpacity={1} />
              <Animated.View
                style={[
                  g.modalSheet,
                  { transform: [{ translateY: userSlideAnim.interpolate({ inputRange: [0, 1], outputRange: [SH * 0.5, 0] }) }] },
                ]}
              >
                <View style={g.sheetHandle} />

                <View style={g.sheetTitleRow}>
                  <View style={[g.sheetTitleIcon, { backgroundColor: C.primaryDim }]}>
                    <MaterialCommunityIcons name="account-outline" size={16} color={C.primary} />
                  </View>
                  <Text style={g.sheetTitle}>User Profile</Text>
                  <TouchableOpacity onPress={closeUserModal} style={g.sheetCloseBtn}>
                    <MaterialCommunityIcons name="close" size={15} color={C.textMuted} />
                  </TouchableOpacity>
                </View>

                <Divider />

                {/* Hero */}
                <View style={g.userDetailHero}>
                  <View style={g.userDetailAvatar}>
                    <Text style={g.userDetailAvatarTxt}>{user.username.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={g.userDetailName}>{user.username}</Text>
                  <View style={[g.syncPill, { backgroundColor: C.greenDim, alignSelf: 'center', marginTop: 4 }]}>
                    <View style={[g.syncPillDot, { backgroundColor: C.green }]} />
                    <Text style={[g.syncPillTxt, { color: C.greenDark }]}>Active</Text>
                  </View>
                </View>

                <Divider />

                {/* Detail rows */}
                {([
                  { icon: 'identifier', label: 'User ID', value: user.user_id },
                  { icon: 'account-outline', label: 'Username', value: user.username },
                  { icon: 'office-building-outline', label: 'Block Name', value: user.block_name },
                  ...(user.district_name ? [{ icon: 'map-marker-outline', label: 'District', value: user.district_name }] : []),
                  ...(user.address ? [{ icon: 'home-outline', label: 'Address', value: user.address }] : []),
                ] as { icon: string; label: string; value: string }[]).map((row) => (
                  <View key={row.label} style={g.userDetailRow}>
                    <View style={[g.userDetailRowIcon, { backgroundColor: C.primaryDim }]}>
                      <MaterialCommunityIcons name={row.icon as any} size={15} color={C.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={g.userDetailRowLabel}>{row.label}</Text>
                      <Text style={g.userDetailRowValue}>{row.value}</Text>
                    </View>
                  </View>
                ))}
              </Animated.View>
            </Animated.View>
          </Modal>
        </>
      )}

      {/* ── TABS ── */}
      <View style={g.tabBar}>
        {TABS.map(({ id, icon, label }) => {
          const active = tab === id;
          return (
            <TouchableOpacity
              key={id}
              style={[g.tab, active && g.tabActive]}
              onPress={() => setTab(id)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name={icon as any} size={15} color={active ? C.primary : C.textMuted} />
              <Text style={[g.tabTxt, active && g.tabTxtActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── CONTENT ── */}
      <View style={g.content}>
        {tab === 'collect' && (
          user
            ? <DataCollection userInfo={user} onDataSaved={() => { setRKey((k) => k + 1); setTab('sync'); }} />
            : <View style={g.centered}>
              <MaterialCommunityIcons name="account-alert-outline" size={36} color={C.red} />
              <Text style={[g.bigLabel, { color: C.red }]}>User Not Found</Text>
            </View>
        )}
        {tab === 'sync' && <SyncTab key={rKey} networkStatus={net} />}
        {tab === 'calendar' && <CalendarTab key={rKey} />}
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// LIGHT MAP STYLE
// ─────────────────────────────────────────────────────────────
const lightMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#F1F5FB' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F1F5FB' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B7AA1' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#E8EEFF' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#C7D8F8' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#F8FAFF' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#E6F4EA' }] },
];

// ─────────────────────────────────────────────────────────────
// LAYOUT CONSTANTS
// ─────────────────────────────────────────────────────────────
const CAL_CELL_W = Math.floor((SW - 80) / 7);

const SHADOW = {
  shadowColor: C.shadowColor,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07,
  shadowRadius: 8,
  elevation: 3,
};
const SHADOW_LG = {
  shadowColor: C.shadowColor,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 16,
  elevation: 6,
};

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const g = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // ── Header ──
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.bgCard,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
    ...SHADOW,
  },
  headerIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: C.primaryDim,
    borderWidth: 1, borderColor: C.primary + '25',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '800', color: C.text, letterSpacing: 0.1 },
  headerSub: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  netPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  netDot: { width: 5, height: 5, borderRadius: 3 },
  netPillTxt: { fontSize: 11, fontWeight: '700' },

  // ── User banner ──
  userBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.bgCard,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  userAvatar: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: C.primaryDim,
    borderWidth: 1.5, borderColor: C.primary + '35',
    alignItems: 'center', justifyContent: 'center',
  },
  userAvatarTxt: { fontSize: 13, fontWeight: '800', color: C.primary },
  userNameTxt: { fontSize: 13, fontWeight: '700', color: C.text },
  userSubTxt: { fontSize: 11, color: C.textMuted, marginTop: 1 },

  // ── User detail modal ──
  userDetailHero: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  userDetailAvatar: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: C.primaryDim,
    borderWidth: 2, borderColor: C.primary + '35',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  userDetailAvatarTxt: { fontSize: 26, fontWeight: '800', color: C.primary },
  userDetailName: { fontSize: 17, fontWeight: '800', color: C.text },
  userDetailRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  userDetailRowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: C.primaryDim },
  userDetailRowLabel: { fontSize: 10, fontWeight: '700', color: C.textMuted, letterSpacing: 0.4, marginBottom: 2 },
  userDetailRowValue: { fontSize: 14, fontWeight: '600', color: C.text },

  // ── Tab bar ──
  tabBar: {
    flexDirection: 'row', gap: 4,
    marginHorizontal: 14, marginTop: 12, marginBottom: 8,
    backgroundColor: C.bgCard,
    borderRadius: 14, padding: 4,
    borderWidth: 1, borderColor: C.border,
    ...SHADOW,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10,
  },
  tabActive: { backgroundColor: C.primaryDim, borderWidth: 1, borderColor: C.primary + '30' },
  tabTxt: { fontSize: 12, fontWeight: '600', color: C.textMuted },
  tabTxtActive: { color: C.primary, fontWeight: '800' },

  // ── Content ──
  content: { flex: 1, marginHorizontal: 14, marginBottom: 14, overflow: 'hidden' },

  // ── Section card ──
  sectionCard: {
    backgroundColor: C.bgCard,
    borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: C.border,
    padding: 16,
    ...SHADOW,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionHeaderIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: C.text, flex: 1 },

  gpsLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.greenDim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  gpsLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  gpsLiveTxt: { fontSize: 10, fontWeight: '800', color: C.greenDark },
  requiredBadge: { backgroundColor: '#FFF0F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  requiredTxt: { fontSize: 10, fontWeight: '700', color: '#E11D7A' },
  divider: { height: 1, backgroundColor: C.border },

  // ── Shared ──
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingRing: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 1.5, borderColor: C.primary + '30',
    backgroundColor: C.primaryDim,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  bigLabel: { fontSize: 16, fontWeight: '800', color: C.text },
  subLabel: { fontSize: 13, color: C.textSec, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, paddingHorizontal: 22, paddingVertical: 11,
    backgroundColor: C.primary, borderRadius: 10,
    ...SHADOW_LG,
  },
  retryTxt: { color: C.white, fontWeight: '800', fontSize: 13 },

  // ── Section label ──
  slRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  slText: { fontSize: 12, fontWeight: '700', color: C.textSec, letterSpacing: 0.2 },
  slRequired: { fontSize: 12, fontWeight: '800', color: C.red },

  // ── Dropdown ──
  dropTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: C.border, borderRadius: 11,
    backgroundColor: C.surfaceHigh,
    paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 13 : 11,
  },
  dropTriggerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dropTriggerText: { fontSize: 14, color: C.text, flex: 1 },
  dropIconBadge: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  // ── Sheet modal ──
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: C.overlay },
  modalSheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: C.borderMed,
    paddingBottom: Platform.OS === 'ios' ? 38 : 18,
    ...SHADOW_LG,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginTop: 12, marginBottom: 14 },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, marginBottom: 12 },
  sheetTitleIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: C.text },
  sheetCloseBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: C.surfaceMid, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetClearRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 12 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14 },
  sheetItemIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sheetItemText: { flex: 1, fontSize: 14, color: C.text, fontWeight: '500' },
  sheetCheck: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  sheetSep: { height: 1, backgroundColor: C.border, marginHorizontal: 18 },

  // ── Map ──
  mapCard: {
    height: 185, borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: C.border,
    marginTop: 14, backgroundColor: C.surfaceHigh,
  },
  mapControls: { position: 'absolute', top: 10, right: 10, gap: 6 },
  mapCtrlBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: C.white + 'EE',
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW,
  },
  coordRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, backgroundColor: C.greenDim,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
  },
  coordText: {
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11, color: C.greenDark, fontWeight: '600',
  },
  accBadge: { backgroundColor: C.greenDark + '18', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  accText: { fontSize: 10, fontWeight: '700', color: C.greenDark },
  markerOuter: { alignItems: 'center' },
  markerInner: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2.5, borderColor: C.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 8,
  },
  markerTail: { width: 2.5, height: 8, borderRadius: 2 },

  // ── Monitoring preview ──
  monPreviewCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 11, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  monPreviewIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  monPreviewLabel: { fontSize: 14, fontWeight: '700' },
  monPreviewSub: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  monPreviewClear: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  // ── Capture button ──
  captureBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surfaceHigh,
    borderRadius: 11, borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  captureBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  captureBtnIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.primaryDim, borderWidth: 1, borderColor: C.primary + '25',
    alignItems: 'center', justifyContent: 'center',
  },
  captureBtnTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  captureBtnSub: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  captureBtnArrow: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: C.primaryDim,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Single image capture ──
  singleImgWrapper: {
    width: '100%', height: 200,
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: C.border,
  },
  singleImgPreview: { width: '100%', height: '100%' },
  retakeBtn: {
    position: 'absolute', bottom: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.primary + 'DD',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8,
  },
  retakeTxt: { color: C.white, fontSize: 12, fontWeight: '700' },
  singleRemoveBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.red + 'CC',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Photo badge ──
  photoBadge: { backgroundColor: '#FFF0F9', borderWidth: 1, borderColor: '#FBCFE8', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  photoBadgeTxt: { fontSize: 11, fontWeight: '800', color: '#E11D7A' },

  // ── Save button ──
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.primary, paddingVertical: 15, borderRadius: 14, marginTop: 4,
    ...SHADOW_LG,
  },
  saveBtnOff: { backgroundColor: C.border, shadowOpacity: 0, elevation: 0 },
  saveTxt: { color: C.white, fontSize: 15, fontWeight: '800' },
  validationHint: { fontSize: 12, color: C.textMuted, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },

  // ── Sync list ──
  netBanner: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 12,
  },
  netBannerIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  netTitle: { fontSize: 13, fontWeight: '700' },
  netSub: { fontSize: 11, marginTop: 1 },
  listCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, backgroundColor: C.bgCard,
    borderRadius: 14, borderWidth: 1, borderColor: C.border, borderLeftWidth: 3,
    ...SHADOW,
  },
  listNumBadge: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  listNumTxt: { fontSize: 12, fontWeight: '800' },
  listTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' },
  listTypePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  listTypeTxt: { fontSize: 11, fontWeight: '700' },
  listMeta: { fontSize: 11, color: C.textMuted, flex: 1 },
  listDate: { fontSize: 12, color: C.textSec, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaTxt: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11, color: C.textMuted },
  syncPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexShrink: 0 },
  syncPillDot: { width: 6, height: 6, borderRadius: 3 },
  syncPillTxt: { fontSize: 10, fontWeight: '700' },
  syncFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 12, backgroundColor: C.bgCard,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  syncBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.primary, paddingVertical: 13, borderRadius: 12,
    ...SHADOW_LG,
  },
  syncBtnTxt: { color: C.white, fontSize: 14, fontWeight: '800' },

  // ── Calendar stats ──
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: C.bgCard, borderRadius: 12, padding: 10, borderWidth: 1, alignItems: 'center', gap: 4, ...SHADOW },
  statIconWrap: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statVal: { fontSize: 18, fontWeight: '800' },
  statLbl: { fontSize: 9, color: C.textMuted, fontWeight: '700', letterSpacing: 0.4, textAlign: 'center' },

  // ── Calendar ──
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  calNavBtn: { width: 32, height: 32, borderRadius: 9, backgroundColor: C.surfaceMid, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  calMonthTxt: { fontSize: 16, fontWeight: '800', color: C.text },
  calMonthSub: { fontSize: 11, color: C.textMuted, marginTop: 2, textAlign: 'center' },
  calDayNames: { flexDirection: 'row' },
  calDayName: { fontSize: 10, fontWeight: '700', color: C.textMuted, letterSpacing: 0.4 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  calDayNum: { fontSize: 13, fontWeight: '500', color: C.textSec },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  legendLbl: { fontSize: 10, color: C.textMuted },

  // ── Detail sheet ──
  detailSheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: C.borderMed,
    padding: 16, paddingBottom: Platform.OS === 'ios' ? 36 : 16,
    ...SHADOW_LG,
  },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  detailDate: { fontSize: 18, fontWeight: '800', color: C.text },
  detailCount: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  detailCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, backgroundColor: C.bgCard,
    borderRadius: 12, borderWidth: 1, borderColor: C.border, borderLeftWidth: 3,
  },
  detailCardIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});