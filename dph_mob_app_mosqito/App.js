import React, { useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  AppState,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Ubuntu_400Regular, Ubuntu_700Bold } from '@expo-google-fonts/ubuntu';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import CommonLoginScreen from './approuter/screens/LoginScreen';
import AppHomeScreen from './approuter/screens/HomeScreen';
import MosquitoDashboard from './approuter/screens/Mosquito/HomeScreen';
import CapturePredictScreen from './approuter/screens/Water/CapturePredictScreen';
import PreviewWaterScreen from './approuter/screens/Water/PreviewWaterScreen';
import WaterDashboard from './approuter/screens/Water/HomeScreen';
import DataCollectionScreen from './approuter/screens/Mosquito/DataCollection/DataCollection';
import DataListScreen from './approuter/screens/Mosquito/DataCollection/DataList';
import PreviewScreen from './approuter/screens/Mosquito/DataCollection/PreviewScreen';
import HiWaterLabHome from './approuter/screens/inspection_HI/HiWaterLabHome';
import { ThemeProvider, useThemeContext } from './approuter/context/ThemeContext';
import HiScreen from './approuter/screens/Mosquito/HiSupervision/HiScreen';
import HiAction from './approuter/screens/Mosquito/HiSupervision/HiAction';
import HiSettingsScreen from './approuter/screens/Mosquito/HiSupervision/SettingsScreen';
import DBCEntryPage from './approuter/screens/Mosquito/HiSupervision/DBCEntryPage';
import LarvaEntryPage from './approuter/screens/Mosquito/HiSupervision/LarvaEntryPage';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// ----------------- MOSQUITO TABS -----------------
function MosquitoTabs() {
  const HomeScreen = require('./approuter/screens/Mosquito/MainScreen').default;
  const SettingsScreen = require('./approuter/screens/Mosquito/Settings/SettingsScreen').default;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: 'gray',
        tabBarIcon: ({ color, size }) => {
          let iconName = route.name === 'Home' ? 'home' : 'settings';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

// ----------------- MOSQUITO STACK -----------------
function MosquitoStackScreen() {
  const MosquitoStack = createStackNavigator();

  return (
    <MosquitoStack.Navigator screenOptions={{ headerShown: false }}>
      <MosquitoStack.Screen name="MosquitoDashboard" component={MosquitoDashboard} />
      <MosquitoStack.Screen name="MosquitoTabs" component={MosquitoTabs} />
    </MosquitoStack.Navigator>
  );
}

// ----------------- REDIRECT COMPONENT -----------------
function RedirectToMosquitoHome({ navigation }) {
  React.useEffect(() => {
    navigation.navigate('MosquitoFlow', {
      screen: 'MosquitoTabs',
      params: { screen: 'Home' },
    });
  }, [navigation]);

  return null;
}

// ----------------- MOSQUITO DATA TABS -----------------
function MosquitoDataTabs() {
  const SyncDataScreen = require('./approuter/screens/Mosquito/DataCollection/SyncData').default;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: 'gray',
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Home') iconName = 'home';
          else if (route.name === 'DataList') iconName = 'list';
          else if (route.name === 'SyncData') iconName = 'cloud-upload';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={RedirectToMosquitoHome} options={{ headerShown: false }} />
      <Tab.Screen name="DataList" component={DataListScreen} />
      <Tab.Screen name="SyncData" component={SyncDataScreen} />
    </Tab.Navigator>
  );
}

// ----------------- WATER TABS -----------------
function WaterTabs() {
  const SettingsScreen = require('./approuter/screens/Water/Settings/SettingsScreen').default;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#0284c7',
        tabBarInactiveTintColor: 'gray',
        tabBarIcon: ({ color, size }) => {
          let iconName = route.name === 'WaterHome' ? 'water' : 'settings';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="WaterHome" component={WaterDashboard} options={{ title: 'Home' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

// ----------------- HI SUPERVISION TABS -----------------
function HISupervisionTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#10b981',
        tabBarInactiveTintColor: 'gray',
        tabBarIcon: ({ color, size }) => {
          let iconName;

          if (route.name === 'HIHome') {
            iconName = 'home';
          } else if (route.name === 'HIAction') {
            iconName = 'person'; // 👈 user icon here
          } else if (route.name === 'HISettings') {
            iconName = 'settings';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="HIHome" component={HiScreen} />
      <Tab.Screen name="HIAction" component={HiAction} />
      <Tab.Screen name="HISettings" component={HiSettingsScreen} />
    </Tab.Navigator>
  );
}


// ----------------- APP CONTAINER -----------------
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes idle timeout

function AppContainer() {
  const { theme } = useThemeContext();
  const navigationRef = useNavigationContainerRef();
  const lastActivityRef = useRef(Date.now());
  const timeoutTimerRef = useRef(null);

  const handleLogout = useCallback(async () => {
    try {
      const userInfo = await AsyncStorage.getItem('user_info');
      if (userInfo) {
        await AsyncStorage.removeItem('user_info');
        if (navigationRef.isReady()) {
          navigationRef.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        }
        Alert.alert(
          'Session Expired',
          'You have been logged out due to 15 minutes of inactivity. Please log in again.'
        );
      }
    } catch (e) {
      console.warn('Error during session timeout logout:', e);
    }
  }, [navigationRef]);

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

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <NavigationContainer ref={navigationRef} theme={theme}>
        <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={CommonLoginScreen} />
         <Stack.Screen 
        name="AppHome" 
        component={AppHomeScreen} 
        options={{ 
          title: "Dashboard", 
          headerLeft: () => null // 🔥 removes back arrow
        }} 
      />
          <Stack.Screen name="MosquitoFlow" component={MosquitoStackScreen} />
          <Stack.Screen name="WaterFlow" component={WaterTabs} />
          <Stack.Screen name="DataCollection" component={DataCollectionScreen} />
          <Stack.Screen name="MosquitoDataFlow" component={MosquitoDataTabs} />
          <Stack.Screen name="PreviewScreen" component={PreviewScreen} />
          <Stack.Screen name="CapturePredict" component={CapturePredictScreen} />
          <Stack.Screen name="PreviewWaterScreen" component={PreviewWaterScreen} />
          <Stack.Screen name="DBCEntryPage" component={DBCEntryPage} />
          <Stack.Screen name="LarvaEntryPage" component={LarvaEntryPage} />
          <Stack.Screen name="HiWaterLabHome" component={HiWaterLabHome} />
          <Stack.Screen name="HIFlow" component={HISupervisionTabs} />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

// ----------------- APP ENTRY -----------------
export default function App() {
  const [fontsLoaded] = useFonts({
    Ubuntu_400Regular,
    Ubuntu_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContainer />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// ----------------- STYLES -----------------
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, backgroundColor: '#e2eafc' },
  title: { fontSize: 22, marginBottom: 30, fontFamily: 'Ubuntu_700Bold' },
  button: { width: '82%', paddingVertical: 12, borderRadius: 10, marginVertical: 10, alignItems: 'center' },
  buttonText: { color: '#000000', fontSize: 18, fontFamily: 'Ubuntu_400Regular' },
  logoRow: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', width: '120%', marginBottom: 20 },
  logoMiddle: { width: 130, height: 120, resizeMode: 'contain', marginTop: -20 },
  logoLeft: { width: 130, height: 100, resizeMode: 'contain', marginBottom:20 },
  logoRight: { width: 130, height: 100, resizeMode: 'contain', marginBottom:20 },
  subtitle: { fontSize: 19, color: '#000080', marginBottom: 10, fontFamily: 'Ubuntu_700Bold', textAlign: 'center', width: '90%' },
  footerContainer: { position: 'absolute', bottom: 20, width: '100%', alignItems: 'center' },
  footerNote: { marginTop: 50, fontSize: 19, color: '#333', fontFamily: 'Ubuntu_400Regular', textAlign: 'center' },
  footerNoteOne: { fontSize: 16, color: '#555', fontFamily: 'Ubuntu_400Regular', textAlign: 'center', marginTop: 4 },
  footerNoteTwo: { fontSize: 16, color: '#555', fontFamily: 'Ubuntu_400Regular', textAlign: 'center', marginTop: 4 },
  footerNoteTwoBold: { fontFamily: 'Ubuntu_700Bold', color: '#000080' },
});
