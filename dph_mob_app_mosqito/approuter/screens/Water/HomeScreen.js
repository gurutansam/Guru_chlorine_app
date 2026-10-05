import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import MapView, { Marker } from 'react-native-maps';

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

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export default function WaterQualityScreen({ navigation }) {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const styles = getStyles(isDarkMode);

  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('loading');
  const [actualPPM, setActualPPM] = useState('');
  const [samplingPoint, setSamplingPoint] = useState(null);
  const [ppmSubmitted, setPpmSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [instructionLang, setInstructionLang] = useState('ta'); // Default to Tamil ('ta')
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes = 300 seconds
  const [showTimerModal, setShowTimerModal] = useState(true);
  const timerIntervalRef = useRef(null);
  const mapRef = useRef(null);

  const [items, setItems] = useState([
    { label: 'Over Head Tank', value: 'OHT' },
    { label: 'Ground Level Reservoir', value: 'GLR' },
    { label: 'Sump', value: 'SUMP' },
    { label: 'Tail End', value: 'TAIL' },
    { label: 'Mid Point', value: 'MID' },
  ]);

  useEffect(() => {
    let locationInterval = null;

    const fetchLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission not granted');
        setLocationStatus('failed');
        return;
      }

      const isLocationEnabled = await Location.hasServicesEnabledAsync();
      if (!isLocationEnabled) {
        Alert.alert('Location Disabled', 'Please enable GPS/location services.');
        setLocationStatus('failed');
        return;
      }

      setLocationStatus('loading');

      locationInterval = setInterval(async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Highest,
            timeout: 10000,
            maximumAge: 5000,
          });

          if (loc?.coords?.accuracy <= 100) {
            clearInterval(locationInterval);
            setLocation(loc.coords);
            setLocationStatus('success');
          }
        } catch (err) {
          console.log('Still waiting for GPS...', err.message);
        }
      }, 3000);
    };

    fetchLocation();

    return () => {
      if (locationInterval) clearInterval(locationInterval);
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      setActualPPM('');
      setSamplingPoint('');
      setOpen(false);
      setTimeLeft(300);
      setShowTimerModal(true);

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            Alert.alert(
              '⏱️ Time Limit Reached',
              'The 5-minute testing window has ended. Returning to the home screen.',
              [
                {
                  text: 'OK',
                  onPress: () => navigation.navigate('AppHome'),
                },
              ]
            );
            navigation.navigate('AppHome');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      };
    }, [navigation])
  );

  const handlePPMSubmit = () => {
    if (!actualPPM) {
      Alert.alert('Missing Field', 'Please enter the Observed PPM value.');
      return;
    }
    setPpmSubmitted(true);
    Alert.alert('Submitted', `Observed PPM: ${actualPPM}`);
  };

  const handleCaptureAndPredict = async () => {
    if (!location) {
      Alert.alert('Invalid Location', 'Please wait for better GPS accuracy');
      return;
    }

    if (!actualPPM || !samplingPoint) {
      Alert.alert("Missing Info", "Please enter Observed PPM and select a sampling point.");
      return;
    }

    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (!cameraPermission.granted) {
      Alert.alert('Permission Denied', 'Camera access is required');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      base64: false,
      quality: 1,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      const photo = result.assets[0];
      const uri = photo.uri;

      setCapturedImage(uri);
      setLoading(true);

      try {
        const formData = new FormData();
        formData.append('image', {
          uri,
          name: 'photo.jpg',
          type: 'image/jpeg',
        });

        const response = await fetch('http://192.168.1.145:5100/vfive_predict', {
          method: 'POST',
          body: formData,
        });

        const contentType = response.headers.get('Content-Type');

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Server Error:', errorText);
          Alert.alert('Server Error', `Status: ${response.status}`);
          return;
        }

        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();

          console.log('📦 API Response:', data);

          // ✅ HANDLE VALIDATION ERROR FROM BACKEND
          if (data?.success === false) {
            Alert.alert(
              'Validation Error',
              data?.message || 'Something went wrong. Please try again.'
            );
            return;
          }

          // ✅ HANDLE SUCCESS RESPONSE
          if (data?.success === true && data?.ppm !== undefined) {
            const chlorineData = {
              ppm: data.ppm.toFixed(2),
              imageUri: uri,
              latitude: location.latitude,
              longitude: location.longitude,
              samplingPoint,
              actualPPM,
              timestamp: new Date().toISOString(),
            };

            await AsyncStorage.setItem(
              'chlorine_last_check',
              JSON.stringify(chlorineData)
            );

            const displayPpm = data.ppm > 3 ? '> 3.00' : `${data.ppm.toFixed(2)}`;

            Alert.alert(
              'Success',
              `Predicted: ${displayPpm} ppm`,
              [
                {
                  text: 'OK',
                  onPress: () =>
                    navigation.navigate('PreviewWaterScreen', {
                      resultData: chlorineData,
                    }),
                },
              ]
            );
          } else {
            // ⚠️ Unexpected structure
            Alert.alert(
              'Prediction Error',
              data?.message || 'No ppm value returned'
            );
          }
        } else {
          const text = await response.text();
          console.error('❌ Unexpected content:', text);
          Alert.alert('Error', 'Unexpected response from server');
        }
      } catch (err) {
        console.error('❌ Exception:', err);
        Alert.alert('Error', 'Failed to predict ppm.');
      } finally {
        setLoading(false);
      }
    }
  };

  const renderMap = () => {
    if (!location) return null;
    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        <Marker coordinate={location} title="Your Location" />
      </MapView>
    );
  };

  if (locationStatus === 'loading') {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#0A84FF" />
        <Text style={styles.loadingText}>📡 Getting GPS Location...</Text>
      </View>
    );
  }

  const isCaptureDisabled = !actualPPM || !samplingPoint || !location;
  const currentInstructions = INSTRUCTIONS[instructionLang] || INSTRUCTIONS.ta;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top Header with Floating Countdown Timer ── */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>💧 Water Quality Testing</Text>
          <TouchableOpacity
            style={[
              styles.floatingTimerBadge,
              timeLeft <= 60
                ? styles.timerBadgeRed
                : timeLeft <= 120
                ? styles.timerBadgeAmber
                : styles.timerBadgeBlue,
            ]}
            onPress={() => setShowTimerModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.floatingTimerText}>⏱️ {formatTime(timeLeft)}</Text>
          </TouchableOpacity>
        </View>

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
                      ? { color: '#EF4444' }
                      : timeLeft <= 120
                      ? { color: '#F59E0B' }
                      : { color: '#0A84FF' },
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

        {renderMap()}

        {/* 📋 Bilingual Instructions Box */}
        <View style={styles.instructionCard}>
          <View style={styles.instructionHeader}>
            <View style={styles.instructionTitleRow}>
              <Text style={styles.instructionTitle}>{currentInstructions.title}</Text>
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
            {currentInstructions.points.map((point, index) => (
              <View key={index} style={styles.instructionItem}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.instructionText}>{point}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Enter Observed PPM"
            placeholderTextColor={isDarkMode ? '#aaa' : '#888'}
            keyboardType="numeric"
            value={actualPPM}
            onChangeText={setActualPPM}
          />
          <TouchableOpacity style={styles.submitButton} onPress={handlePPMSubmit}>
            <Text style={styles.buttonText}>Submit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dropdownWrapper}>
          <DropDownPicker
            open={open}
            value={samplingPoint}
            items={items}
            setOpen={setOpen}
            setValue={setSamplingPoint}
            setItems={setItems}
            placeholder="Select Sampling Point"
            style={styles.dropdown}
            dropDownContainerStyle={{ borderColor: '#ccc', backgroundColor: isDarkMode ? '#222' : '#fff' }}
            textStyle={{ color: isDarkMode ? '#fff' : '#000' }}
            zIndex={3000}
            zIndexInverse={1000}
            listMode="SCROLLVIEW"
          />
        </View>

        <TouchableOpacity
          style={[styles.captureButton, isCaptureDisabled && { backgroundColor: '#ccc' }]}
          onPress={handleCaptureAndPredict}
          disabled={isCaptureDisabled || loading}
        >
          <Text style={styles.buttonText}>📷 Capture & Predict</Text>
        </TouchableOpacity>

        {loading && <ActivityIndicator style={{ marginTop: 15 }} size="large" color="#555" />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (isDarkMode) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#000' : '#fff',
    },
    scrollContent: {
      paddingTop: 55,
      paddingHorizontal: 15,
      paddingBottom: 35,
    },
    title: {
      fontSize: 22,
      fontWeight: 'bold',
      marginBottom: 15,
      textAlign: 'center',
      color: isDarkMode ? '#fff' : '#000',
    },
    map: {
      width: '100%',
      height: Dimensions.get('window').height * 0.26,
      marginBottom: 14,
      borderRadius: 12,
    },
    // Instruction Card Styles
    instructionCard: {
      backgroundColor: isDarkMode ? '#1a2332' : '#f0f7ff',
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? '#2c3e55' : '#cce3fd',
    },
    instructionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
      paddingBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? '#2c3e55' : '#e0effe',
    },
    instructionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    instructionIcon: {
      fontSize: 16,
      marginRight: 6,
    },
    instructionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: isDarkMode ? '#93c5fd' : '#1d4ed8',
    },
    langToggleContainer: {
      flexDirection: 'row',
      backgroundColor: isDarkMode ? '#0f172a' : '#e2e8f0',
      borderRadius: 20,
      padding: 2,
    },
    langButton: {
      paddingVertical: 3,
      paddingHorizontal: 10,
      borderRadius: 16,
    },
    langButtonActive: {
      backgroundColor: '#0A84FF',
    },
    langButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: isDarkMode ? '#94a3b8' : '#64748b',
    },
    langButtonTextActive: {
      color: '#ffffff',
      fontWeight: '700',
    },
    instructionList: {
      marginTop: 2,
    },
    instructionItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 5,
    },
    bulletPoint: {
      fontSize: 14,
      lineHeight: 18,
      marginRight: 6,
      color: isDarkMode ? '#60a5fa' : '#2563eb',
      fontWeight: 'bold',
    },
    instructionText: {
      fontSize: 12.5,
      lineHeight: 18,
      color: isDarkMode ? '#e2e8f0' : '#334155',
      fontWeight: 'bold',
      flex: 1,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 15,
      gap: 10,
      zIndex: 10,
    },
    input: {
      flex: 1,
      borderColor: '#ccc',
      borderWidth: 1,
      padding: 10,
      borderRadius: 10,
      color: isDarkMode ? '#fff' : '#000',
      backgroundColor: isDarkMode ? '#222' : '#fff',
    },
    submitButton: {
      backgroundColor: '#0A84FF',
      paddingVertical: 12,
      paddingHorizontal: 15,
      borderRadius: 10,
    },
    buttonText: {
      color: '#fff',
      fontWeight: '600',
    },
    dropdownWrapper: {
      zIndex: 3000,
      marginBottom: 20,
    },
    dropdown: {
      borderRadius: 10,
      borderColor: '#ccc',
      backgroundColor: isDarkMode ? '#222' : '#fff',
    },
    captureButton: {
      backgroundColor: '#34C759',
      paddingVertical: 15,
      borderRadius: 10,
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 15,
      fontSize: 16,
      color: isDarkMode ? '#fff' : '#444',
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    floatingTimerBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1,
    },
    timerBadgeBlue: {
      backgroundColor: isDarkMode ? 'rgba(10,132,255,0.2)' : '#E0F2FE',
      borderColor: '#0A84FF',
    },
    timerBadgeAmber: {
      backgroundColor: isDarkMode ? 'rgba(245,158,11,0.2)' : '#FEF3C7',
      borderColor: '#F59E0B',
    },
    timerBadgeRed: {
      backgroundColor: isDarkMode ? 'rgba(239,68,68,0.2)' : '#FEE2E2',
      borderColor: '#EF4444',
    },
    floatingTimerText: {
      fontSize: 13,
      fontWeight: '800',
      color: isDarkMode ? '#fff' : '#0F172A',
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    timerModalCard: {
      width: '100%',
      backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 15,
      elevation: 10,
    },
    timerModalIcon: {
      fontSize: 38,
      marginBottom: 8,
    },
    timerModalTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: isDarkMode ? '#F8FAFC' : '#0F172A',
      marginBottom: 6,
      textAlign: 'center',
    },
    timerModalSubtitle: {
      fontSize: 13,
      color: isDarkMode ? '#94A3B8' : '#64748B',
      textAlign: 'center',
      marginBottom: 16,
    },
    timerClockContainer: {
      backgroundColor: isDarkMode ? '#0F172A' : '#F0F9FF',
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 28,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDarkMode ? '#1E293B' : '#BAE6FD',
      marginBottom: 14,
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
      color: isDarkMode ? '#64748B' : '#0369A1',
      marginTop: 2,
    },
    timerModalNote: {
      fontSize: 12,
      lineHeight: 17,
      color: isDarkMode ? '#CBD5E1' : '#475569',
      textAlign: 'center',
      marginBottom: 20,
      paddingHorizontal: 8,
    },
    timerModalBtn: {
      backgroundColor: '#0A84FF',
      paddingVertical: 14,
      paddingHorizontal: 28,
      borderRadius: 12,
      width: '100%',
      alignItems: 'center',
    },
    timerModalBtnText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
    },
  });
