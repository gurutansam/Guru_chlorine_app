import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ─── API ───────────────────────────────────────────────────────────────────────
import { predictChlorine, submitChlorineData, ChlorineData, UserInfo } from '../../../services/api';

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg: '#1d2e49',
  surface: '#0d1829',
  surfaceHigh: '#111f33',
  glass: 'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(255,255,255,0.08)',
  cyan: '#00d4ff',
  cyanDim: 'rgba(0,212,255,0.12)',
  cyanGlow: 'rgba(0,212,255,0.25)',
  emerald: '#00e5a0',
  emeraldDim: 'rgba(0,229,160,0.12)',
  emeraldGlow: 'rgba(0,229,160,0.25)',
  amber: '#ffb800',
  red: '#ff4d6a',
  redDim: 'rgba(255,77,106,0.12)',
  textPrimary: '#e8f4f8',
  textSec: '#6b8599',
  textMuted: '#3d5266',
  border: 'rgba(255,255,255,0.07)',
  borderFocus: 'rgba(0,212,255,0.4)',
};

// ─── Local Types ──────────────────────────────────────────────────────────────
// ChlorineData and UserInfo are now imported from api.ts

type LocationStatus = 'loading' | 'success' | 'failed';
type InstructionLang = 'ta' | 'en';

const INSTRUCTIONS = {
  ta: {
    title: 'புகைப்பட வழிமுறைகள்',
    points: [
      'பின்னணி வெற்று வெள்ளை காகிதமாக இருப்பதை உறுதிப்படுத்தவும்.',
      'படத்தில் சோதனைக் குழாய் (test tube) மட்டுமே தெரியுமாறு பார்த்துக்கொள்ளவும்.',
      'வெளிச்சம் மிக அதிகமாகவோ அல்லது மிகக் குறைவாகவோ இருப்பதைத் தவிர்க்கவும்.',
    ],
  },
  en: {
    title: 'Photo Capture Instructions',
    points: [
      'Ensure the background is plain white paper.',
      'Make sure only the test tube is captured in the picture.',
      'Avoid lighting that is too bright or too low.',
    ],
  },
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const SAMPLING_LABELS: Record<string, string> = {
  OHT: 'Over Head Tank',
  GLR: 'Ground Level Reservoir',
  SUMP: 'Sump',
  TAIL: 'Tail End',
  MID: 'Midpoint',
};

const SAMPLING_OPTIONS = [
  { label: 'Over Head Tank', value: 'OHT' },
  { label: 'Ground Level Reservoir', value: 'GLR' },
  { label: 'Sump', value: 'SUMP' },
  { label: 'Tail End', value: 'TAIL' },
  { label: 'Mid Point', value: 'MID' },
];

// ─── GlassCard ────────────────────────────────────────────────────────────────
const GlassCard: React.FC<{ children: React.ReactNode; style?: object; accent?: string }> = ({ children, style, accent }) => (
  <View style={[gc.card, accent ? { borderColor: accent + '44' } : {}, style]}>
    {accent && <View style={[gc.accentBar, { backgroundColor: accent }]} />}
    {children}
  </View>
);
const gc = StyleSheet.create({
  card: { backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder, borderRadius: 20, overflow: 'visible', marginBottom: 14 },
  accentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, borderRadius: 2 },
});

// ─── Label ────────────────────────────────────────────────────────────────────
const Label: React.FC<{ text: string }> = ({ text }) => (
  <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: C.textSec, marginBottom: 10, textTransform: 'uppercase' }}>{text}</Text>
);

// ─── DataTile ─────────────────────────────────────────────────────────────────
const DataTile: React.FC<{ icon: string; label: string; value: string }> = ({ icon, label, value }) => (
  <View style={dt.row}>
    <View style={dt.iconWrap}><Text style={dt.icon}>{icon}</Text></View>
    <View style={{ flex: 1 }}>
      <Text style={dt.label}>{label}</Text>
      <Text style={dt.value}>{value}</Text>
    </View>
  </View>
);
const dt = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.cyanDim, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  icon: { fontSize: 17 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: C.textSec, textTransform: 'uppercase', marginBottom: 2 },
  value: { fontSize: 14, fontWeight: '600', color: C.textPrimary },
});

// ─── SectionHeader ────────────────────────────────────────────────────────────
const SectionHeader: React.FC<{ title: string; accent: string }> = ({ title, accent }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent, marginRight: 10 }} />
    <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: C.textPrimary, textTransform: 'uppercase', marginRight: 12 }}>{title}</Text>
    <View style={{ flex: 1, height: 1, backgroundColor: accent + '33' }} />
  </View>
);

// ─── PPM Gauge ────────────────────────────────────────────────────────────────
const PPMGauge: React.FC<{ predicted: string; observed: string }> = ({ predicted, observed }) => {
  const val = parseFloat(predicted);
  const color = val < 0.2 ? C.red : val > 1.0 ? C.amber : C.emerald;
  const status = val < 0.2 ? 'LOW' : val > 1.0 ? 'HIGH' : 'OPTIMAL';
  const icon = val < 0.2 ? '▼' : val > 1.0 ? '▲' : '●';

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const p = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.05, duration: 900, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
    ]));
    p.start();
    return () => p.stop();
  }, [pulseAnim]);

  return (
    <GlassCard accent={color} style={{ padding: 20, marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[gg.lbl, { color: C.textSec }]}>AI PREDICTED</Text>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Text style={[gg.big, { color }]}>{val > 3 ? '> 3.00' : predicted}</Text>
          </Animated.View>
          <Text style={gg.unit}>ppm</Text>
          <View style={[gg.badge, { backgroundColor: color + '22', borderColor: color + '55', borderWidth: 1 }]}>
            <Text style={[gg.badgeTxt, { color }]}>{icon} {status}</Text>
          </View>
        </View>

        <View style={{ width: 40, alignItems: 'center', height: 100, justifyContent: 'center' }}>
          <View style={{ flex: 1, width: 1, backgroundColor: color + '33' }} />
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: color + '22', borderWidth: 1, borderColor: color + '44', alignItems: 'center', justifyContent: 'center', marginVertical: 4 }}>
            <Text style={{ fontSize: 10, color, fontWeight: '800' }}>VS</Text>
          </View>
          <View style={{ flex: 1, width: 1, backgroundColor: color + '33' }} />
        </View>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[gg.lbl, { color: C.textSec }]}>OBSERVED</Text>
          <Text style={[gg.big, { color: C.textPrimary }]}>{observed}</Text>
          <Text style={gg.unit}>ppm</Text>
          <View style={[gg.badge, { backgroundColor: C.glass, borderColor: C.border, borderWidth: 1 }]}>
            <Text style={[gg.badgeTxt, { color: C.textSec }]}>● MANUAL</Text>
          </View>
        </View>
      </View>
    </GlassCard>
  );
};
const gg = StyleSheet.create({
  lbl: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6, textTransform: 'uppercase' },
  big: { fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 46 },
  unit: { fontSize: 12, fontWeight: '600', color: C.textSec, marginTop: 2, marginBottom: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
});

// ─── GPS Pill ─────────────────────────────────────────────────────────────────
const GPSPill: React.FC<{ accuracy?: number }> = ({ accuracy }) => {
  const dot = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(dot, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(dot, { toValue: 0.4, duration: 800, useNativeDriver: true }),
    ])).start();
  }, [dot]);
  return (
    <View style={{ position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,229,160,0.15)', borderWidth: 1, borderColor: 'rgba(0,229,160,0.3)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
      <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.emerald, marginRight: 6, opacity: dot }} />
      <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: C.emerald }}>
        GPS LOCKED{accuracy ? `  ±${accuracy.toFixed(0)}m` : ''}
      </Text>
    </View>
  );
};

// ─── Step Progress ────────────────────────────────────────────────────────────
const StepProgress: React.FC<{ step: 1 | 2 }> = ({ step }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
    {[{ n: 1, label: 'CAPTURE' }, { n: 2, label: 'PREVIEW' }].map((s, i) => (
      <React.Fragment key={s.n}>
        <View style={{ alignItems: 'center' }}>
          <View style={[{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }, s.n <= step ? { backgroundColor: C.cyan } : { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.textMuted }]}>
            {s.n < step
              ? <Text style={{ color: C.bg, fontSize: 12, fontWeight: '800' }}>✓</Text>
              : <Text style={{ fontSize: 14, fontWeight: '800', color: s.n <= step ? C.bg : C.textMuted }}>{s.n}</Text>
            }
          </View>
          <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: s.n <= step ? C.cyan : C.textMuted }}>{s.label}</Text>
        </View>
        {i < 1 && (
          <View style={{ flex: 1, paddingHorizontal: 8, paddingBottom: 18 }}>
            <View style={{ height: 1.5, borderRadius: 2, backgroundColor: step >= 2 ? C.cyan : C.textMuted + '44' }} />
          </View>
        )}
      </React.Fragment>
    ))}
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function WaterQualityScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('loading');
  const [address, setAddress] = useState<string | null>(null);
  const [actualPPM, setActualPPM] = useState('');
  const [samplingPoint, setSamplingPoint] = useState<string | null>(null);
  const [instructionLang, setInstructionLang] = useState<InstructionLang>('ta'); // Default to Tamil ('ta')
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes = 300 seconds
  const [showTimerModal, setShowTimerModal] = useState(true);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasTimedOutRef = useRef(false);
  const [chlorineData, setChlorineData] = useState<ChlorineData | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const previewAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const modalAnim = useRef(new Animated.Value(0)).current;

  const openModal = () => {
    setModalVisible(true);
    Animated.timing(modalAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  };

  const closeModal = () => {
    Animated.timing(modalAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setModalVisible(false));
  };

  const refreshLocation = async () => {
    setLocationStatus('loading');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant location permission in settings.');
        setLocationStatus('failed');
        return;
      }

      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last?.coords) {
          setLocation(last.coords);
          setLocationStatus('success');
          reverseGeocode(last.coords.latitude, last.coords.longitude);
        }
      } catch {}

      const locPromise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
      const loc = await Promise.race([locPromise, timeoutPromise]);

      if (loc && 'coords' in loc && loc.coords) {
        setLocation(loc.coords);
        setLocationStatus('success');
        reverseGeocode(loc.coords.latitude, loc.coords.longitude);
      } else {
        setLocationStatus((prev) => (prev === 'loading' ? 'failed' : prev));
      }
    } catch {
      setLocationStatus('failed');
    }
  };

  useEffect(() => {
    AsyncStorage.getItem('user_info').then(u => { if (u) setUserInfo(JSON.parse(u)); });
    Animated.spring(headerAnim, { toValue: 1, tension: 40, friction: 8, useNativeDriver: true }).start();
  }, [headerAnim]);

  useEffect(() => {
    let subscriber: Location.LocationSubscription | null = null;
    let isMounted = true;

    const go = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) setLocationStatus('failed');
          return;
        }

        const on = await Location.hasServicesEnabledAsync();
        if (!on) {
          if (isMounted) setLocationStatus('failed');
          return;
        }

        // ── 1. Try last known position instantly ──────────────────────────────
        try {
          const last = await Location.getLastKnownPositionAsync();
          if (last?.coords && isMounted) {
            setLocation(last.coords);
            setLocationStatus('success');
            reverseGeocode(last.coords.latitude, last.coords.longitude);
          }
        } catch { }

        // ── 2. Fast race with 5s timeout ──────────────────────────────────────
        try {
          const locPromise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
          const loc = await Promise.race([locPromise, timeoutPromise]);
          if (loc && 'coords' in loc && loc.coords && isMounted) {
            setLocation(loc.coords);
            setLocationStatus('success');
            reverseGeocode(loc.coords.latitude, loc.coords.longitude);
          } else if (isMounted) {
            setLocationStatus((prev) => (prev === 'loading' ? 'failed' : prev));
          }
        } catch {
          if (isMounted) setLocationStatus((prev) => (prev === 'loading' ? 'failed' : prev));
        }

        // ── 3. Watch for continuous updates in the background ────────────────
        subscriber = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 2000, distanceInterval: 0 },
          (loc) => {
            if (loc?.coords && isMounted) {
              setLocation(loc.coords);
              setLocationStatus('success');
            }
          }
        );
      } catch {
        if (isMounted) setLocationStatus('failed');
      }
    };

    go();
    return () => {
      isMounted = false;
      subscriber?.remove();
    };
  }, []);

  useFocusEffect(useCallback(() => {
    setTimeLeft(300);
    hasTimedOutRef.current = false;
    setShowTimerModal(true);

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    timerIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setActualPPM('');
      setSamplingPoint(null);
      setChlorineData(null);
      previewAnim.setValue(0);
    };
  }, [previewAnim]));

  useEffect(() => {
    if (timeLeft === 0 && !hasTimedOutRef.current) {
      hasTimedOutRef.current = true;
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      Alert.alert(
        '⏱️ Time Limit Reached',
        'The 5-minute testing window has ended. Returning to the home screen.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(main)/home'),
          },
        ],
        { cancelable: false }
      );
    }
  }, [timeLeft, router]);

  const revealPreview = () => {
    Animated.spring(previewAnim, { toValue: 1, tension: 45, friction: 9, useNativeDriver: true }).start();
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const [addr] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (addr) setAddress([addr.name, addr.street, addr.city, addr.region, addr.postalCode].filter(Boolean).join(', '));
    } catch { }
  };

  // ─── Capture & Predict ────────────────────────────────────────────────────
  const handleCaptureAndPredict = async () => {
    console.log('🚀 handleCaptureAndPredict START');

    if (!location) return Alert.alert('📡 No GPS', 'Please wait for GPS signal.');
    if (!actualPPM) return Alert.alert('Missing Info', 'Please enter Observed PPM.');
    if (!samplingPoint) return Alert.alert('Missing Info', 'Please select a sampling point.');

    try {
      console.log('📸 Requesting camera permission...');
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return Alert.alert('Permission Denied', 'Camera access is required.');

      console.log('📸 Launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        quality: 1,
        allowsEditing: false,
        base64: false,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        console.log('⚠️ Camera cancelled or no image');
        return;
      }

      const uri = result.assets[0].uri;
      console.log('📷 Image captured:', uri);

      setLoading(true);

      // ── API call via api.ts ──────────────────────────────────────────────
      const ppm = await predictChlorine(uri);
      // ────────────────────────────────────────────────────────────────────

      console.log('✅ Prediction success:', ppm);

      const cd: ChlorineData = {
        ppm: ppm.toFixed(2),
        imageUri: uri,
        latitude: location.latitude,
        longitude: location.longitude,
        samplingPoint: samplingPoint!,
        actualPPM,
        timestamp: new Date().toISOString(),
      };

      await AsyncStorage.setItem('chlorine_last_check', JSON.stringify(cd));
      setChlorineData(cd);
      reverseGeocode(location.latitude, location.longitude);

      // ✅ ADD THIS LOG HERE (Analysis Complete Time)
      const now = new Date();
      console.log(
        '🧪 ANALYSIS COMPLETED AT:',
        now.toLocaleDateString(),
        now.toLocaleTimeString()
      );


      revealPreview();

    } catch (err: any) {
      console.log('🔥 ERROR:', err?.message);
      
      const humanizeError = (msg: string) => {
        const m = msg.toLowerCase();
        if (m.includes('other object detected')) {
          return 'Foreign object detected. Please ensure only the test tube on plain white paper is in the camera frame.';
        }
        if (m.includes('no tube detected') || m.includes('no object')) {
          return 'No test tube detected. Please ensure the test tube is vertically centered and clearly visible.';
        }
        if (m.includes('wrong background')) {
          return 'Invalid background. Please place the test tube against a clean white sheet of paper.';
        }
        if (m.includes('network') || m.includes('fetch') || m.includes('failed to fetch')) {
          return 'Cannot reach AI Prediction Server (guru_backend_ai on port 5100). Please check your connection.';
        }
        return msg;
      };

      Alert.alert(
        'Prediction Failed', 
        humanizeError(err?.message || 'Something went wrong. Please try again.')
      );
    } finally {
      console.log('🏁 handleCaptureAndPredict END');
      setLoading(false);
    }
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!chlorineData || !userInfo) { Alert.alert('Error', 'Missing data or user info.'); return; }
    
    console.log('📤 PREPARING SUBMISSION:', {
      ppm: chlorineData.ppm,
      observed: chlorineData.actualPPM,
      samplingPoint: chlorineData.samplingPoint,
      location: `${chlorineData.latitude}, ${chlorineData.longitude}`,
      user: userInfo.username,
      role: userInfo.role
    });

    setSubmitting(true);
    try {
      // ── API call via api.ts ──────────────────────────────────────────────
      await submitChlorineData(chlorineData, userInfo, address || '');
      // ────────────────────────────────────────────────────────────────────

      await AsyncStorage.removeItem('chlorine_last_check');
      Alert.alert(
        '✅ Submitted',
        'Data pushed to server successfully.',
        [{
          text: 'Done',
          onPress: () => {
            setActualPPM('');
            setSamplingPoint(null);
            setChlorineData(null);
            setAddress(null);
          },
        }]
      );
    } catch (err: any) {
      // submitChlorineData throws with a descriptive message on server errors
      const isNetwork = err?.message?.toLowerCase().includes('network') || err?.message?.toLowerCase().includes('fetch');
      if (isNetwork) {
        Alert.alert('Network Error', 'Check your connection and try again.');
      } else {
        Alert.alert('Error', err?.message || 'Server rejected the data. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isCaptureDisabled = !actualPPM || !samplingPoint || !location || loading;
  const hasPreview = chlorineData !== null;

  // ── GPS Loading ──
  if (locationStatus === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <View style={styles.gpsLoader}>
          <View style={styles.gpsRing1} />
          <View style={styles.gpsRing2} />
          <ActivityIndicator size="large" color={C.cyan} />
        </View>
        <Text style={styles.gpsTitle}>Acquiring Signal</Text>
        <Text style={styles.gpsSub}>Waiting for GPS lock…</Text>

        <View style={{ marginTop: 32, width: '100%', gap: 12 }}>
          <TouchableOpacity
            style={{ backgroundColor: C.cyan, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
            onPress={refreshLocation}
          >
            <Text style={{ color: C.bg, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 }}>RETRY GPS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
            onPress={() => {
              setLocation({
                latitude: 13.0827,
                longitude: 80.2707,
                altitude: null,
                accuracy: 10,
                altitudeAccuracy: null,
                heading: null,
                speed: null,
              });
              setLocationStatus('success');
              setAddress('Chennai, Tamil Nadu');
            }}
          >
            <Text style={{ color: C.textSec, fontWeight: '700', fontSize: 13 }}>USE DEFAULT / SKIP GPS</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header with Floating Timer ── */}
        <Animated.View style={[styles.header, {
          opacity: headerAnim,
          transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
        }]}>
          <View>
            <Text style={styles.headerEyebrow}>TNDPHPM  ·  FIELD UNIT</Text>
            <Text style={styles.headerTitle}>Chlorine{'\n'}Detection</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            <View style={styles.headerBadge}>
              <Text style={{ fontSize: 28 }}>💧</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.floatingTimerBadge,
                timeLeft <= 60
                  ? styles.timerBadgeRed
                  : timeLeft <= 120
                  ? styles.timerBadgeAmber
                  : styles.timerBadgeCyan,
              ]}
              onPress={() => setShowTimerModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.floatingTimerText}>⏱️ {formatTime(timeLeft)}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── 5-Minute Countdown Modal Popup ── */}
        <Modal
          visible={showTimerModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowTimerModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.timerModalCard}>
              <Text style={styles.timerModalIcon}>⏱️</Text>
              <Text style={styles.timerModalTitle}>5-Minute Test Window</Text>
              <Text style={styles.timerModalSubtitle}>
                {instructionLang === 'ta'
                  ? 'குளோரினேஷன் சோதனைக்கான 5 நிமிட கவுண்ட்டவுன் தொடங்கியது.'
                  : 'Chlorination testing countdown of 5 minutes has started.'}
              </Text>

              <View style={styles.timerClockContainer}>
                <Text
                  style={[
                    styles.timerClockDigits,
                    timeLeft <= 60
                      ? { color: C.red }
                      : timeLeft <= 120
                      ? { color: C.amber }
                      : { color: C.cyan },
                  ]}
                >
                  {formatTime(timeLeft)}
                </Text>
                <Text style={styles.timerClockLabel}>TIME REMAINING</Text>
              </View>

              <Text style={styles.timerModalNote}>
                {instructionLang === 'ta'
                  ? 'சோதனைக் குழாயை வெள்ளை காகிதத்தில் வைத்து, PPM பதிவிட்டு 5 நிமிடத்திற்குள் படத்தை எடுக்கவும். நேரம் முடிந்ததும் முகப்புப் பக்கத்திற்கு தானாக திரும்பும்.'
                  : 'Please fill observed PPM and capture the photo within 5 mins. You will automatically be returned to the home screen when time expires.'}
              </Text>

              <TouchableOpacity
                style={styles.timerModalBtn}
                onPress={() => setShowTimerModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.timerModalBtnText}>
                  {instructionLang === 'ta' ? 'சோதனையைத் தொடங்கு' : 'Proceed to Test'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── Steps ── */}
        <StepProgress step={hasPreview ? 2 : 1} />

        {/* ── GPS Location Preview Card ── */}
        {location ? (
          <View style={styles.mapWrap}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#091322', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }]}>
              {/* Radar circles */}
              <View style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1, borderColor: 'rgba(0,212,255,0.08)' }} />
              <View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 1, borderColor: 'rgba(0,212,255,0.15)' }} />
              <View style={{ position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: 'rgba(0,212,255,0.25)' }} />
              <View style={{ position: 'absolute', width: '100%', height: 1, backgroundColor: 'rgba(0,212,255,0.1)' }} />
              <View style={{ position: 'absolute', height: '100%', width: 1, backgroundColor: 'rgba(0,212,255,0.1)' }} />

              {/* Pin with pulse */}
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,229,160,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.emerald }}>
                  <Text style={{ fontSize: 22 }}>📍</Text>
                </View>
                {address ? (
                  <Text numberOfLines={1} style={{ fontSize: 11, color: C.textPrimary, fontWeight: '700', marginTop: 8, maxWidth: 260, backgroundColor: 'rgba(13,24,41,0.9)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                    {address}
                  </Text>
                ) : null}
              </View>
            </View>

            <GPSPill accuracy={location.accuracy ?? undefined} />
            <TouchableOpacity style={styles.refreshBtn} onPress={refreshLocation}>
              <Text style={styles.refreshTxt}>↻</Text>
            </TouchableOpacity>
            <View style={styles.mapCoordBox}>
              <Text style={styles.mapCoordTxt}>{location.latitude.toFixed(4)}°N</Text>
              <Text style={styles.mapCoordTxt}>{location.longitude.toFixed(4)}°E</Text>
            </View>
          </View>
        ) : (
          <GlassCard accent={C.amber} style={{ padding: 16, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ color: C.amber, fontWeight: '800', fontSize: 13, marginBottom: 2 }}>GPS SIGNAL NOT LOCKED</Text>
                <Text style={{ color: C.textSec, fontSize: 12 }}>Enable GPS or tap Retry / Default to proceed.</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={{ backgroundColor: C.cyan, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 }}
                  onPress={refreshLocation}
                >
                  <Text style={{ color: C.bg, fontWeight: '800', fontSize: 12 }}>RETRY</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 }}
                  onPress={() => {
                    setLocation({
                      latitude: 13.0827,
                      longitude: 80.2707,
                      altitude: null,
                      accuracy: 10,
                      altitudeAccuracy: null,
                      heading: null,
                      speed: null,
                    });
                    setLocationStatus('success');
                    setAddress('Chennai, Tamil Nadu');
                  }}
                >
                  <Text style={{ color: C.textPrimary, fontWeight: '700', fontSize: 12 }}>DEFAULT</Text>
                </TouchableOpacity>
              </View>
            </View>
          </GlassCard>
        )}

        {/* ── Instructions Box ── */}
        <GlassCard accent={C.cyan} style={styles.instructionCard}>
          <View style={styles.instructionHeader}>
            <View style={styles.instructionTitleRow}>
              <Text style={styles.instructionTitle}>
                {INSTRUCTIONS[instructionLang].title}
              </Text>
            </View>

            {/* Language Switcher */}
            <View style={styles.langToggleContainer}>
              <TouchableOpacity
                style={[
                  styles.langButton,
                  instructionLang === 'ta' && styles.langButtonActive,
                ]}
                onPress={() => setInstructionLang('ta')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.langButtonText,
                    instructionLang === 'ta' && styles.langButtonTextActive,
                  ]}
                >
                  தமிழ்
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.langButton,
                  instructionLang === 'en' && styles.langButtonActive,
                ]}
                onPress={() => setInstructionLang('en')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.langButtonText,
                    instructionLang === 'en' && styles.langButtonTextActive,
                  ]}
                >
                  English
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.instructionList}>
            {INSTRUCTIONS[instructionLang].points.map((point, index) => (
              <View key={index} style={styles.instructionItem}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.instructionText}>{point}</Text>
              </View>
            ))}
          </View>
        </GlassCard>

        {/* ── Observed PPM ── */}
        <GlassCard accent={actualPPM ? C.cyan : undefined} style={{ padding: 18 }}>
          <Label text="Observed PPM Value" />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              style={[styles.ppmInput, actualPPM && { color: C.cyan }]}
              placeholder="0.00"
              placeholderTextColor={C.textMuted}
              keyboardType="decimal-pad"
              value={actualPPM}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9.]/g, '');
                if ((cleaned.match(/\./g) || []).length > 1) return;
                setActualPPM(cleaned);
              }}
            />
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.textSec, marginLeft: 8 }}>ppm</Text>
          </View>
        </GlassCard>

        {/* ── Sampling Point ── */}
        <GlassCard accent={samplingPoint ? C.emerald : undefined} style={{ padding: 18 }}>
          <Label text="Sampling Point" />
          <TouchableOpacity style={styles.dropdownBtn} onPress={openModal} activeOpacity={0.8}>
            <Text style={[styles.dropdownText, !samplingPoint && { color: C.textMuted }]}>
              {samplingPoint
                ? SAMPLING_OPTIONS.find(o => o.value === samplingPoint)?.label
                : 'Select sampling point'}
            </Text>
          </TouchableOpacity>
        </GlassCard>

        {modalVisible && (
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
            <Animated.View style={[styles.modalBox, {
              transform: [{ translateY: modalAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }],
              opacity: modalAnim,
            }]}>
              <Text style={styles.modalTitle}>Select Sampling Point</Text>
              {SAMPLING_OPTIONS.map(opt => (
                <TouchableOpacity key={opt.value} style={styles.modalItem} onPress={() => { setSamplingPoint(opt.value); closeModal(); }}>
                  <Text style={styles.modalItemText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </Animated.View>
          </View>
        )}

        {/* ── Capture Button ── */}
        <TouchableOpacity
          style={[styles.captureBtn, isCaptureDisabled && styles.captureBtnOff]}
          onPress={handleCaptureAndPredict}
          disabled={isCaptureDisabled}
          activeOpacity={0.8}
        >
          {loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator color={C.bg} size="small" style={{ marginRight: 10 }} />
              <Text style={styles.captureBtnTxt}>ANALYSING IMAGE…</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.captureBtnIcon}>{hasPreview ? '↺' : '⬡'}</Text>
              <Text style={styles.captureBtnTxt}>{hasPreview ? 'RETAKE & PREDICT' : 'CAPTURE & PREDICT'}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Preview (animated reveal) ── */}
        {hasPreview && chlorineData && (
          <Animated.View style={{
            opacity: previewAnim,
            transform: [{ translateY: previewAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
          }}>
            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.divLine} />
              <View style={styles.divPill}>
                <Text style={styles.divPillTxt}>ANALYSIS COMPLETE</Text>
              </View>
              <View style={styles.divLine} />
            </View>

            {/* Image with scan-frame overlay */}
            <View style={styles.imgWrap}>
              <Image source={{ uri: chlorineData.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <View style={styles.cornerTL} /><View style={styles.cornerTR} />
              <View style={styles.cornerBL} /><View style={styles.cornerBR} />
              <View style={styles.imgBadge}>
                <View style={styles.imgDot} />
                <Text style={styles.imgBadgeTxt}>SAMPLE CAPTURED</Text>
              </View>
            </View>

            {/* PPM Gauge */}
            <PPMGauge predicted={chlorineData.ppm} observed={chlorineData.actualPPM} />

            {/* Water Quality */}
            <GlassCard accent={C.cyan} style={{ padding: 18 }}>
              <SectionHeader title="Water Quality" accent={C.cyan} />
              <DataTile icon="🤖" label="AI Predicted" value={`${parseFloat(chlorineData.ppm) > 3 ? '> 3.00' : chlorineData.ppm} ppm`} />
              <DataTile icon="🧪" label="Observed" value={`${chlorineData.actualPPM} ppm`} />
              <DataTile icon="🚰" label="Sampling Point" value={SAMPLING_LABELS[chlorineData.samplingPoint] || chlorineData.samplingPoint} />
            </GlassCard>

            {/* Location */}
            <GlassCard accent={C.emerald} style={{ padding: 18 }}>
              <SectionHeader title="Location" accent={C.emerald} />
              <DataTile icon="📡" label="Coordinates" value={`${chlorineData.latitude.toFixed(5)}°N  ${chlorineData.longitude.toFixed(5)}°E`} />
              <DataTile icon="⏱" label="Captured At" value={new Date(chlorineData.timestamp).toLocaleString()} />
              {address && <DataTile icon="📍" label="Address" value={address} />}
            </GlassCard>

            {/* Officer Details */}
            {userInfo && (
              <GlassCard accent={C.amber} style={{ padding: 18 }}>
                <SectionHeader title="Officer Details" accent={C.amber} />
                {userInfo.role === 'hi_user' && (
                  <>
                    <DataTile icon="🏢" label="Block ID" value={userInfo.block_id || '—'} />
                    <DataTile icon="🏛" label="Block Name" value={userInfo.block_name || '—'} />
                  </>
                )}
                {userInfo.role === 'block_user' && (
                  <>
                    <DataTile icon="🏢" label="HUD ID" value={userInfo.hud_id || '—'} />
                    <DataTile icon="🏛" label="HUD Name" value={userInfo.hud_name || '—'} />
                    <DataTile icon="🏢" label="Block ID" value={userInfo.block_id || '—'} />
                    <DataTile icon="🏛" label="Block Name" value={userInfo.block_name || '—'} />
                  </>
                )}
                {!['hi_user', 'block_user', 'chl_special_admin', 'chl_admin'].includes(userInfo.role) && (
                  <>
                    <DataTile icon="🏢" label="Hub ID" value={userInfo.hub_id || '—'} />
                    <DataTile icon="🏛" label="Hub Name" value={userInfo.hub_name || '—'} />
                  </>
                )}
                <DataTile icon="🆔" label="User ID" value={userInfo.user_id} />
                <DataTile
                  icon={userInfo.role === 'chl_admin' ? '🧑‍💼' : '👨‍⚕️'}
                  label={userInfo.role === 'chl_admin' ? 'Chlorine Admin' : 'HI Officer'}
                  value={userInfo.username}
                />
              </GlassCard>
            )}

            {/* Submit */}
            <Pressable
              style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator color={C.bg} size="small" style={{ marginRight: 10 }} />
                  <Text style={styles.submitTxt}>TRANSMITTING…</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.submitIcon}>↑</Text>
                  <Text style={styles.submitTxt}>SUBMIT TO SERVER</Text>
                </View>
              )}
            </Pressable>
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {!modalVisible && (
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={18} color="#00d4ff" style={{ marginRight: 8 }} />
          <Text style={styles.backText}>BACK</Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },

  // GPS loader
  gpsLoader: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  gpsRing1: { position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 1, borderColor: C.cyan + '33' },
  gpsRing2: { position: 'absolute', width: 70, height: 70, borderRadius: 35, borderWidth: 1, borderColor: C.cyan + '66' },
  gpsTitle: { fontSize: 20, fontWeight: '800', color: C.textPrimary, letterSpacing: 0.5, marginBottom: 6 },
  gpsSub: { fontSize: 13, color: C.textSec, letterSpacing: 0.3 },

  // Header
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: Platform.OS === 'ios' ? 52 : 20, marginBottom: 28 },
  headerEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: C.textSec, marginBottom: 6, textTransform: 'uppercase' },
  headerTitle: { fontSize: 34, fontWeight: '900', color: C.textPrimary, lineHeight: 38, letterSpacing: -0.8 },
  headerBadge: { width: 56, height: 56, borderRadius: 18, backgroundColor: C.cyanDim, borderWidth: 1, borderColor: C.cyan + '33', alignItems: 'center', justifyContent: 'center' },

  // Map
  mapWrap: { height: 220, borderRadius: 20, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: C.border },
  mapCoordBox: { position: 'absolute', top: 12, right: 12, alignItems: 'flex-end', backgroundColor: 'rgba(8,15,26,0.75)', padding: 8, borderRadius: 10 },
  mapCoordTxt: { fontSize: 11, fontWeight: '700', color: C.cyan, letterSpacing: 0.5 },
  refreshBtn: { position: 'absolute', top: 12, left: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  refreshTxt: { color: '#00d4ff', fontSize: 18, fontWeight: 'bold' },

  // Instructions
  instructionCard: { padding: 14, marginBottom: 14 },
  instructionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  instructionTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  instructionTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5, color: C.cyan, textTransform: 'uppercase' },
  langToggleContainer: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 16, padding: 2, borderWidth: 1, borderColor: C.border },
  langButton: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 14 },
  langButtonActive: { backgroundColor: C.cyan },
  langButtonText: { fontSize: 11, fontWeight: '700', color: C.textSec },
  langButtonTextActive: { color: C.bg, fontWeight: '800' },
  instructionList: { marginTop: 2 },
  instructionItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  bulletPoint: { fontSize: 14, lineHeight: 18, marginRight: 6, color: C.cyan, fontWeight: 'bold' },
  instructionText: { fontSize: 12.5, lineHeight: 18, color: C.textPrimary, fontWeight: 'bold', flex: 1 },

  // PPM input
  ppmInput: { flex: 1, fontSize: 32, fontWeight: '900', letterSpacing: -1, color: C.textPrimary },

  // Capture button
  captureBtn: { backgroundColor: C.cyan, borderRadius: 18, paddingVertical: 18, alignItems: 'center', marginTop: 6, marginBottom: 4, shadowColor: C.cyan, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  captureBtnOff: { backgroundColor: C.surfaceHigh, shadowOpacity: 0, elevation: 0 },
  captureBtnIcon: { fontSize: 20, color: C.bg, marginRight: 10, fontWeight: '900' },
  captureBtnTxt: { fontSize: 14, fontWeight: '900', letterSpacing: 1.5, color: C.bg, textTransform: 'uppercase' },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  divLine: { flex: 1, height: 1, backgroundColor: C.border },
  divPill: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: C.emeraldDim, borderRadius: 20, borderWidth: 1, borderColor: C.emerald + '44', marginHorizontal: 12 },
  divPillTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, color: C.emerald, textTransform: 'uppercase' },

  // Image
  imgWrap: { height: 220, borderRadius: 20, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: C.border },
  cornerTL: { position: 'absolute', top: 12, left: 12, width: 20, height: 20, borderTopWidth: 2, borderLeftWidth: 2, borderColor: C.cyan, borderTopLeftRadius: 6 },
  cornerTR: { position: 'absolute', top: 12, right: 12, width: 20, height: 20, borderTopWidth: 2, borderRightWidth: 2, borderColor: C.cyan, borderTopRightRadius: 6 },
  cornerBL: { position: 'absolute', bottom: 12, left: 12, width: 20, height: 20, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: C.cyan, borderBottomLeftRadius: 6 },
  cornerBR: { position: 'absolute', bottom: 12, right: 12, width: 20, height: 20, borderBottomWidth: 2, borderRightWidth: 2, borderColor: C.cyan, borderBottomRightRadius: 6 },
  imgBadge: { position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,229,160,0.15)', borderWidth: 1, borderColor: 'rgba(0,229,160,0.35)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  imgDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.emerald, marginRight: 6 },
  imgBadgeTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: C.emerald },

  // Submit
  submitBtn: { backgroundColor: C.emerald, borderRadius: 18, paddingVertical: 18, alignItems: 'center', marginTop: 4, shadowColor: C.emerald, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  submitIcon: { fontSize: 18, color: C.bg, marginRight: 10, fontWeight: '900' },
  submitTxt: { fontSize: 14, fontWeight: '900', letterSpacing: 1.5, color: C.bg, textTransform: 'uppercase' },

  // Dropdown
  dropdownBtn: { backgroundColor: C.glass, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16 },
  dropdownText: { fontSize: 15, color: C.textPrimary },

  // Modal
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 9999, elevation: 9999 },
  modalBox: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 100 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: C.textPrimary, marginBottom: 12 },
  modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  modalItemText: { fontSize: 15, color: C.textPrimary },

  // Back button
  backBtn: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: '#111f33', borderRadius: 16, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 10, zIndex: 9999 },
  backIcon: { fontSize: 18, color: '#00d4ff', marginRight: 8, fontWeight: '900' },
  backText: { fontSize: 13, fontWeight: '900', letterSpacing: 1.5, color: '#00d4ff' },

  // Floating Timer Badge
  floatingTimerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: C.surface,
  },
  timerBadgeCyan: {
    borderColor: C.cyan,
    backgroundColor: C.cyanDim,
  },
  timerBadgeAmber: {
    borderColor: C.amber,
    backgroundColor: 'rgba(255,184,0,0.15)',
  },
  timerBadgeRed: {
    borderColor: C.red,
    backgroundColor: C.redDim,
  },
  floatingTimerText: {
    fontSize: 12,
    fontWeight: '800',
    color: C.textPrimary,
    letterSpacing: 0.5,
  },

  // Modal Backdrop & Card
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,15,26,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  timerModalCard: {
    width: '100%',
    backgroundColor: C.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.glassBorder,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  timerModalIcon: {
    fontSize: 38,
    marginBottom: 8,
  },
  timerModalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: C.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  timerModalSubtitle: {
    fontSize: 13,
    color: C.textSec,
    textAlign: 'center',
    marginBottom: 18,
  },
  timerClockContainer: {
    backgroundColor: C.bg,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },
  timerClockDigits: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  timerClockLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: C.cyan,
    marginTop: 4,
  },
  timerModalNote: {
    fontSize: 12,
    lineHeight: 18,
    color: C.textSec,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 6,
  },
  timerModalBtn: {
    backgroundColor: C.cyan,
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    shadowColor: C.cyan,
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
  },
  timerModalBtnText: {
    color: C.bg,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});