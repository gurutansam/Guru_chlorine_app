import React, { JSX, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar,
  TextInput as RNTextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { loginUser } from '../services/api';
import { saveUser } from '../services/storage';
import { User, UserRole } from '../types/navigation';

const ALLOWED_ROLES: Readonly<UserRole[]> = [
  'hi_user', 'block_user', 'RWAL_hi_user',
  'special_user', 'DHO', 'chl_admin', 'mos_admin',
];

export default function LoginScreen(): JSX.Element {
  const router = useRouter();
  const passwordRef = useRef<RNTextInput>(null);

  const [userId, setUserId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [emailFocused, setEmailFocused] = useState<boolean>(false);
  const [passFocused, setPassFocused] = useState<boolean>(false);
  const [networkError, setNetworkError] = useState<boolean>(false);

  // Check if error is network-related
  const isNetworkError = (error: unknown): boolean => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('504') ||
        message.includes('503') ||
        message.includes('502') ||
        message.includes('connection') ||
        message.includes('enotfound') ||
        message.includes('cannot reach') ||
        message.includes('failed to fetch') ||
        message.includes('request failed') ||
        message.includes('gateway')
      );
    }
    return false;
  };

  const handleLogin = async (): Promise<void> => {
    if (!userId.trim() || !password.trim()) {
      Alert.alert('Validation Error', 'Please enter Email ID and password');
      return;
    }

    setLoading(true);
    setNetworkError(false);

    try {
      const user: User = await loginUser(userId, password);

      if (!user?.role) {
        throw new Error('Access denied: No role assigned');
      }

      if (!ALLOWED_ROLES.includes(user.role)) {
        setLoading(false);
        Alert.alert('Access Denied', 'You are not authorized');
        return;
      }

      await saveUser(user);
      router.replace('/(main)/home');

    } catch (error: unknown) {
      const isNetError = isNetworkError(error);
      setNetworkError(isNetError);

      if (isNetError) {
        // Network/Server error
        Alert.alert(
          'Connection Error',
          'Cannot reach server. Please check your network connectivity and try again.',
          [
            {
              text: 'Retry',
              onPress: () => {
                setNetworkError(false);
                handleLogin();
              },
              style: 'default',
            },
            {
              text: 'Cancel',
              onPress: () => {
                setNetworkError(false);
              },
              style: 'cancel',
            },
          ]
        );
      } else {
        // Other errors
        const message =
          error instanceof Error ? error.message : 'Something went wrong';
        Alert.alert('Login Failed', message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#EEF2FF" />

      {/* Background decorative blobs */}
      <View style={styles.blobTopRight} />
      <View style={styles.blobBottomLeft} />

      {/* Network Error Banner */}
      {networkError && (
        <View style={styles.errorBanner}>
          <View style={styles.errorBannerContent}>
            <Ionicons name="warning-outline" size={18} color="#DC2626" />
            <Text style={styles.errorBannerText}>Network Connection Error</Text>
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Header */}
          <View style={styles.headerSection}>
            <View style={styles.logoRow}>
              <View style={styles.logoWrapper}>
                <Image
                  source={require('../assets/images/dph.png')}
                  style={styles.logoLeft}
                />
              </View>
              <View style={[styles.logoWrapper, styles.logoMiddleWrapper]}>
                <Image
                  source={require('../assets/images/TN_logo.png')}
                  style={styles.logoMiddle}
                />
              </View>
              <View style={styles.logoWrapper}>
                <Image
                  source={require('../assets/images/nhm.png')}
                  style={styles.logoRight}
                />
              </View>
            </View>

            <Text style={styles.orgTitle}>
              Directorate of Public Health & Preventive Medicine
            </Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardHeading}>Welcome</Text>
            <Text style={styles.cardSubheading}>Sign in to continue</Text>

            {/* Email Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <View style={[
                styles.inputWrapper,
                emailFocused && styles.inputWrapperFocused,
              ]}>
                <View style={styles.iconCircle}>
                  <Ionicons name="mail-outline" size={16} color={emailFocused ? '#3B5BDB' : '#94A3B8'} />
                </View>
                <TextInput
                  placeholder="Enter your email"
                  value={userId}
                  onChangeText={setUserId}
                  style={styles.input}
                  placeholderTextColor="#CBD5E1"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={[
                styles.inputWrapper,
                passFocused && styles.inputWrapperFocused,
              ]}>
                <View style={styles.iconCircle}>
                  <Ionicons name="lock-closed-outline" size={16} color={passFocused ? '#3B5BDB' : '#94A3B8'} />
                </View>
                <TextInput
                  ref={passwordRef}
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  style={[styles.input, { paddingRight: 42 }]}
                  secureTextEntry={!showPassword}
                  placeholderTextColor="#CBD5E1"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  onFocus={() => setPassFocused(true)}
                  onBlur={() => setPassFocused(false)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(p => !p)}
                  style={styles.eyeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={styles.loginBtnInner}>
                  <Text style={styles.loginBtnText}>Sign In</Text>
                  <View style={styles.loginArrow}>
                    <Ionicons name="arrow-forward" size={16} color="#3B5BDB" />
                  </View>
                </View>
              )}
            </TouchableOpacity>

            {/* Secure badge */}
            <View style={styles.secureBadge}>
              <Ionicons name="shield-checkmark-outline" size={13} color="#64748B" />
              <Text style={styles.secureText}>Secured login · Government of Tamil Nadu |</Text>
              <Text style={styles.secureText}>DPH</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerApp}>Field Monitoring Application</Text>
            <Text style={styles.footerVersion}>Version 2.1.1</Text>
            <View style={styles.footerDevRow}>
              <Text style={styles.footerDev}>Developed by </Text>
              <Text style={styles.footerDevBold}>TANSAM</Text>
            </View>
            <Image
              source={require('../assets/images/tansamoldlogo.png')}
              style={styles.footerLogo}
            />
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EEF2FF',
  },

  /* Background blobs */
  blobTopRight: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 280,
    height: 220,
    borderRadius: 120,
    backgroundColor: '#C7D7FD',
    opacity: 0.6,
  },
  blobBottomLeft: {
    position: 'absolute',
    bottom: 40,
    left: -80,
    width: 250,
    height: 250,
    borderRadius: 120,
    backgroundColor: '#BFDBFE',
    opacity: 0.6,
  },

  /* Error Banner */
  errorBanner: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  errorBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorBannerText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
    flex: 1,
  },

  /* Scroll */
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 30,
  },

  /* Header */
  headerSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoWrapper: {
    width: 70,
    height: 70,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B5BDB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  logoMiddleWrapper: {
    width: 100,
    height: 100,
    borderRadius: 22,
    marginHorizontal: 12,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  logoLeft: { width: 78, height: 78, resizeMode: 'contain' },
  logoMiddle: { width: 96, height: 96, resizeMode: 'contain' },
  logoRight: { width: 88, height: 88, resizeMode: 'contain' },

  orgTitle: {
    fontSize: 18,
    color: '#1E3A8A',
    fontFamily: 'Ubuntu_700Bold',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  orgSubtitle: {
    fontSize: 15,
    color: '#3B5BDB',
    fontFamily: 'Ubuntu_400Regular',
    textAlign: 'center',
    marginTop: 2,
  },

  /* Card */
  card: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 26,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 12,
  },
  cardHeading: {
    fontSize: 22,
    color: '#2a3e5e',
    fontFamily: 'Ubuntu_700Bold',
    marginBottom: 4,
  },
  cardSubheading: {
    fontSize: 14,
    color: '#94A3B8',
    fontFamily: 'Ubuntu_400Regular',
    marginBottom: 28,
  },

  /* Fields */
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    height: 52,
    paddingHorizontal: 12,
  },
  inputWrapperFocused: {
    borderColor: '#3B5BDB',
    backgroundColor: '#F0F4FF',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    fontFamily: 'Ubuntu_400Regular',
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    padding: 4,
  },

  /* Login Button */
  loginBtn: {
    backgroundColor: '#3B5BDB',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#3B5BDB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  loginBtnDisabled: {
    opacity: 0.65,
  },
  loginBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Ubuntu_700Bold',
    letterSpacing: 0.5,
  },
  loginArrow: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Secure badge */
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  secureText: {
    fontSize: 11.5,
    color: '#94A3B8',
    fontFamily: 'Ubuntu_400Regular',
  },

  /* Footer */
  footer: {
    alignItems: 'center',
    marginTop: 52,
    paddingBottom: 10,
  },
  footerApp: {
    fontSize: 15,
    color: '#475569',
    fontFamily: 'Ubuntu_400Regular',
  },
  footerVersion: {
    fontSize: 12,
    color: '#94A3B8',
    fontFamily: 'Ubuntu_400Regular',
    marginTop: 3,
  },
  footerDevRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  footerDev: {
    fontSize: 12,
    color: '#94A3B8',
    fontFamily: 'Ubuntu_400Regular',
  },
  footerDevBold: {
    fontSize: 12,
    color: '#1E3A8A',
    fontFamily: 'Ubuntu_700Bold',
  },
  footerLogo: {
    width: 80,
    height: 40,
    resizeMode: 'contain',
    marginTop: 6,
    opacity: 0.9,
  },
});