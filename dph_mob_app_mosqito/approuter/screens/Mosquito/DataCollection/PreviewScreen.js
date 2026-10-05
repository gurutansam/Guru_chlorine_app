import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, Image, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';

export default function PreviewScreen({ route }) {
  const navigation = useNavigation();
  const { formData } = route.params || {};

  const [address, setAddress] = useState('Fetching address...');
  const [loadingAddress, setLoadingAddress] = useState(true);

  // Reverse geocode
  useEffect(() => {
    (async () => {
      if (!formData?.location) {
        setAddress('Location not available');
        setLoadingAddress(false);
        return;
      }
      try {
        const [reverseGeocode] = await Location.reverseGeocodeAsync({
          latitude: formData.location.latitude,
          longitude: formData.location.longitude,
        });
        if (reverseGeocode) {
          const formattedAddress = `${reverseGeocode.name || ''} ${reverseGeocode.street || ''}, ${reverseGeocode.city || ''}, ${reverseGeocode.region || ''} ${reverseGeocode.postalCode || ''}`.trim();
          setAddress(formattedAddress || 'Address not found');
        } else setAddress('Address not found');
      } catch (e) {
        console.error('Reverse geocode failed:', e);
        setAddress('Failed to fetch address');
      } finally {
        setLoadingAddress(false);
      }
    })();
  }, [formData?.location]);

  const handleSubmit = async () => {
    try {
      const userInfo = formData.userInfo;
      if (!userInfo || !userInfo.user_id || !userInfo.username) {
        Alert.alert('Missing User Info', 'User information is incomplete or not found');
        return;
      }

      const now = new Date();
      const date = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth()+1).padStart(2,'0')}-${now.getFullYear()}`;
      const time = now.toTimeString().split(' ')[0];

      const districtName = userInfo.district_name?.trim() || userInfo.hud_name?.trim() || userInfo.hub_name?.trim() || 'Unknown';
      const blockName = userInfo.block_name?.trim() || 'N/A';

      const completeData = {
        user_id: userInfo.user_id,
        username: userInfo.username,
        district_name: districtName,
        block_name: blockName,
        date,
        time,
        selected_area: formData.selected_area || formData.village_name || formData.phc_name || formData.block_name || formData.hud_name || 'none',
        monitoringArea: formData.monitoringArea || 'Unknown', 
        location: formData.location,
        address: address || 'N/A',
        images: (formData.images || []).map(img => ({ uri: img.uri })),
        synced: false,
      };

      const existingData = await AsyncStorage.getItem('mosquito_data');
      const parsedData = existingData ? JSON.parse(existingData) : [];
      const updatedData = [...parsedData, completeData];
      await AsyncStorage.setItem('mosquito_data', JSON.stringify(updatedData));

      Alert.alert('Saved', 'Data saved locally. You can sync later.');
      navigation.reset({
        index: 0,
        routes: [{ name: 'DataCollection', params: { key: Date.now().toString() } }],
      });
    } catch (error) {
      console.error('Local save error:', error);
      Alert.alert('Error', 'Failed to save data locally. Please try again.');
    }
  };

  if (!formData) {
    return (
      <View style={styles.fallbackContainer}>
        <Text style={styles.fallbackText}>Missing form data.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <BlurView intensity={80} tint="light" style={styles.stickyHeader}>
        <Text style={styles.header}>Preview Data Collection</Text>
      </BlurView>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={{ height: 90 }} />

        {/* User Info Cards */}
        {formData.userInfo && <Card label="User ID" value={formData.userInfo.user_id} />}
        {formData.userInfo && <Card label="Name" value={formData.userInfo.username} />}
        {formData.userInfo && (
          <Card
            label="District"
            value={formData.userInfo.district_name?.trim() || formData.userInfo.hud_name?.trim() || formData.userInfo.hub_name?.trim() || 'Unknown'}
          />
        )}
        {formData.userInfo?.block_name && <Card label="Block" value={formData.userInfo.block_name} />}

        {/* Area Type and Monitoring Area */}
<Card label="Selected Area" value={formData.selected_area || 'None'} />

        <Card label="Monitoring Area" value={formData.monitoringArea || 'Unknown'} />

        {/* Location */}
        <Card
          label="Coordinates"
          value={`Lat: ${formData.location.latitude.toFixed(6)}, Lon: ${formData.location.longitude.toFixed(6)}`}
        />
        <Card
          label="Resolved Address"
          value={loadingAddress ? <ActivityIndicator color="#3b82f6" /> : address}
        />

        {/* Images */}
        <View style={[styles.card, styles.imageCard]}>
          <Text style={styles.label}>Images</Text>
          {formData.images?.length > 0 ? (
            <ScrollView horizontal>
              {formData.images.map((img, i) => (
                <Image key={i} source={{ uri: img.uri }} style={styles.image} />
              ))}
            </ScrollView>
          ) : (
            <Text>No images captured.</Text>
          )}
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.flexButton}>
            <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.button}>
              <MaterialIcons name="edit" size={20} color="#fff" />
              <Text style={styles.buttonText}>Edit</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSubmit} style={styles.flexButton}>
            <LinearGradient colors={['#16a34a', '#15803d']} style={styles.button}>
              <MaterialIcons name="check" size={20} color="#fff" />
              <Text style={styles.buttonText}>Submit</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function Card({ label, value }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, height: 90, justifyContent: 'center', alignItems: 'center', zIndex: 10, paddingTop: 40, backgroundColor: 'rgba(255,255,255,0.8)' },
  header: { fontSize: 18, fontWeight: 'bold' },
  card: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 10, marginBottom: 12 },
  label: { fontSize: 14, color: '#555' },
  value: { fontSize: 16, fontWeight: '500', color: '#111', marginTop: 5 },
  imageCard: { paddingBottom: 16 },
  image: { width: 100, height: 100, marginRight: 10, borderRadius: 8 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  flexButton: { flex: 1, marginHorizontal: 5 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: '#fff', marginLeft: 8, fontWeight: '600' },
  fallbackContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  fallbackText: { fontSize: 16, color: 'red', fontWeight: '500' },
});
