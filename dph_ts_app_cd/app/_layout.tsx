import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { View, PanResponder, AppState, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, Ubuntu_400Regular, Ubuntu_700Bold } from '@expo-google-fonts/ubuntu';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../context/ThemeContext';

SplashScreen.preventAutoHideAsync();

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes idle timeout

export default function RootLayout() {
  const router = useRouter();
  const lastActivityRef = useRef<number>(Date.now());
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [fontsLoaded] = useFonts({
    Ubuntu_400Regular,
    Ubuntu_700Bold,
  });

  const handleLogout = useCallback(async () => {
    try {
      const userInfo = await AsyncStorage.getItem('user_info');
      if (userInfo) {
        await AsyncStorage.removeItem('user_info');
        router.replace('/');
        Alert.alert(
          'Session Expired',
          'You have been logged out due to 15 minutes of inactivity. Please log in again.'
        );
      }
    } catch (e) {
      console.warn('Error during session timeout logout:', e);
    }
  }, [router]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
    }
    timeoutTimerRef.current = setTimeout(() => {
      handleLogout();
    }, IDLE_TIMEOUT_MS);
  }, [handleLogout]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => {
          resetTimer();
          return false;
        },
        onMoveShouldSetPanResponderCapture: () => {
          resetTimer();
          return false;
        },
      }),
    [resetTimer]
  );

  useEffect(() => {
    resetTimer();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed >= IDLE_TIMEOUT_MS) {
          handleLogout();
        } else {
          resetTimer();
        }
      }
    });

    return () => {
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
      subscription.remove();
    };
  }, [resetTimer, handleLogout]);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        <ThemeProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </ThemeProvider>
      </View>
    </SafeAreaProvider>
  );
}