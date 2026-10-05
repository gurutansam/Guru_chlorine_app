import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function PreviewWaterScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState(null);

  const samplingPointLabels = {
    OHT: 'Over Head Tank',
    GLR: 'Ground Level Reservoir',
    SUMP: 'Sump',
    TAIL: 'Tail End',
    MID: 'Midpoint',
  };

  useEffect(() => {
    (async () => {
      try {
        const storedData = await AsyncStorage.getItem('chlorine_last_check');
        const user = await AsyncStorage.getItem('user_info');

        if (storedData) {
          const parsedData = JSON.parse(storedData);
          setData(parsedData);

          if (parsedData.latitude && parsedData.longitude) {
            const [addr] = await Location.reverseGeocodeAsync({
              latitude: parsedData.latitude,
              longitude: parsedData.longitude,
            });

            if (addr) {
              const fullAddress = `${addr.name || ''}, ${addr.street || ''}, ${addr.city || ''}, ${addr.region || ''}, ${addr.postalCode || ''}`;
              setAddress(fullAddress.trim());
            }
          }
        }

        if (user) setUserInfo(JSON.parse(user));
      } catch (err) {
        console.error('[Preview] Error loading data:', err);
      }
    })();
  }, []);

  const handlePushToServer = async () => {
    if (!data || !userInfo) {
      Alert.alert('Error', 'Cannot push: Missing data or user info.');
      return;
    }

    setLoading(true);

    try {
      // Convert image to Base64
      const base64Image = await FileSystem.readAsStringAsync(data.imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const dt = new Date(data.timestamp);
      const mysqlTimestamp = dt.toISOString().slice(0, 19).replace('T', ' ');

      const displayPpm = parseFloat(data.ppm) > 3 ? '> 3.00' : data.ppm;

      // Build common payload
      const payload = {
        ppm: displayPpm,
        base64Image,
        latitude: data.latitude,
        longitude: data.longitude,
        role: userInfo.role,
        timestamp: mysqlTimestamp,
        user_id: userInfo.user_id,
        username: userInfo.username,
        actualPPM: data.actualPPM,
        samplingPoint: data.samplingPoint,
        address: address || '',
      };


      let apiUrl = 'http://192.168.1.145:3000/dashboard/chl_datacollection';

      switch (userInfo.role) {

        // ================= HI USER =================
        case 'hi_user':
          payload.block_id = userInfo.block_id;
          payload.block_name = userInfo.block_name;

          payload.hud_id = userInfo.hud_id;
          payload.hud_name = userInfo.hud_name;

          apiUrl = 'http://192.168.1.145:3000/dashboard/chl_hud_datacollection';
          break;


        // ================= BLOCK USER =================
        case 'block_user':
          payload.block_id = userInfo.block_id;
          payload.block_name = userInfo.block_name;

          payload.hud_id = userInfo.hud_id;
          payload.hud_name = userInfo.hud_name;

          apiUrl = 'http://192.168.1.145:3000/dashboard/chl_block_datacollection';
          break;


        // ================= SPECIAL / DHO / ADMIN =================
        case 'special_user':
        case 'DHO':
        case 'chl_special_admin':

          apiUrl = 'http://192.168.1.145:3000/dashboard/chl_special_datacollection';
          break;
        case 'chl_admin':
          // 🔒 ONLY HERE → remove hub info
          delete payload.hub_id;
          delete payload.hub_name;

          apiUrl = 'http://192.168.1.145:3000/dashboard/chl_special_datacollection';
          break;

        // ================= DEFAULT =================
        default:
          payload.hub_id = userInfo.hub_id;
          payload.hub_name = userInfo.hub_name;
      }

      // Send data to server
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await AsyncStorage.removeItem('chlorine_last_check');
        Alert.alert('Success', 'Data pushed to server', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        const errorText = await res.text();
        console.error('[Push] Server error:', errorText);
        Alert.alert('Error', 'Failed to push data');
      }
    } catch (error) {
      console.error('[Push] Network error:', error);
      Alert.alert('Network Error', 'Check your connection');
    } finally {
      setLoading(false);
    }
  };


  if (!data || !userInfo) {
    return (
      <View style={styles.loadingView}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading data...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>Water Sample Preview</Text>

        <Image source={{ uri: data.imageUri }} style={styles.image} />

        <Section title="Water Quality Details">
          <Data label="AI Predicted PPM" value={parseFloat(data.ppm) > 3 ? '> 3.00' : data.ppm} emoji="💧" />
          <Data label="Observed PPM" value={data.actualPPM} emoji="🧪" />
          <Data
            label="Sampling Point"
            value={samplingPointLabels[data.samplingPoint] || data.samplingPoint}
            emoji="🚰"
          />
        </Section>

        <Section title="Location Details">
          <Data
            label="📌"
            value={` Latitude: ${Number(data.latitude).toFixed(3)} ; Longitude: ${Number(
              data.longitude
            ).toFixed(3)}`}
            inline
          />
          <Data label="Timestamp" value={new Date(data.timestamp).toLocaleString()} emoji="⏰" />
          {address && <Data label="Address" value={address} emoji="📍" />}
        </Section>

        <Section title="User Info">

          {/* HI USER */}
          {userInfo.role === 'hi_user' && (
            <>
              <Data label="Block ID" value={userInfo.block_id} emoji="🏢" />
              <Data label="Block Name" value={userInfo.block_name} emoji="🏛️" />
            </>
          )}

          {/* BLOCK USER */}
          {userInfo.role === 'block_user' && (
            <>
              <Data label="HUD ID" value={userInfo.hud_id} emoji="🏢" />
              <Data label="HUD Name" value={userInfo.hud_name} emoji="🏛️" />
              <Data label="Block ID" value={userInfo.block_id} emoji="🏢" />
              <Data label="Block Name" value={userInfo.block_name} emoji="🏛️" />
            </>
          )}

          {/* DEFAULT (hub / special / admin etc) */}
          {!['hi_user', 'block_user', 'chl_special_admin', 'chl_admin'].includes(userInfo.role) && (
            <>
              <Data label="Hub ID" value={userInfo.hub_id} emoji="🏢" />
              <Data label="Hub Name" value={userInfo.hub_name} emoji="🏛️" />
            </>
          )}

          <Data label="User ID" value={userInfo.user_id} emoji="🆔" />
          <Data
            label={userInfo.role === 'chl_admin' ? 'Chlorine Admin' : 'HI Officer'}
            value={userInfo.username}
            emoji={userInfo.role === 'chl_admin' ? '🧑‍💼' : '👨‍⚕️'}
          />


        </Section>
        <Pressable style={styles.button} onPress={handlePushToServer} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Submit</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const Section = ({ title, children }) => (
  <View style={styles.card}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.divider} />
    {children}
  </View>
);

const Data = ({ label, value, emoji, inline }) => (
  <View style={inline ? styles.inlineData : null}>
    <Text style={styles.dataText}>
      {emoji} <Text style={styles.label}>{label}</Text>: {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f9fafb',
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    color: '#0c3d81e0',
    marginBottom: 20,
    marginTop: 24,
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  dataText: {
    fontSize: 16,
    color: '#1661c4ff',
    marginBottom: 8,
  },
  label: {
    fontWeight: '600',
    color: '#1f2937',
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 40,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 9,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  loadingView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
    color: '#6b7280',
  },
  inlineData: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
  },
  inlineText: {
    textAlign: 'left',
  },
});
