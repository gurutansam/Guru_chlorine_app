import React, { useEffect, useState, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Modal,
  View,
  Text,
  Button,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

export default function DataCollectionScreen({ route }) {
  const navigation = useNavigation();
  const geoViewRef = useRef();

  const [selectedArea, setSelectedArea] = useState(
  () => route?.params?.formData?.selected_area || 'Unknown'
);

  const [monitoringArea, setMonitoringArea] = useState('Fever');
  const [location, setLocation] = useState(null);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [images, setImages] = useState([]);
  const [showTopBlur, setShowTopBlur] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [cameraInUse, setCameraInUse] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  // Fetch location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    })();
  }, []);

  // Load user info
  useEffect(() => {
    (async () => {
      try {
        const userJson = await AsyncStorage.getItem('user_info');
        if (userJson) setUserInfo(JSON.parse(userJson));
      } catch (err) {
        console.error('Error loading user info:', err);
      }
    })();
  }, []);

  // Pick image from camera
  const pickImage = async () => {
    if (cameraInUse) return;
    setCameraInUse(true);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Camera permission is required!');
      setCameraInUse(false);
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });
      if (!result.canceled && result.assets) setImages((prev) => [...prev, ...result.assets]);
    } catch (e) {
      console.error('Camera error:', e);
    } finally {
      setCameraInUse(false);
    }
  };

  // Navigate to preview
  const handlePreview = () => {
    const formData = { selected_area: selectedArea, monitoringArea, location, images, userInfo };

    navigation.navigate('PreviewScreen', { formData });
  };

  const onScroll = (event) => setShowTopBlur(event.nativeEvent.contentOffset.y > 5);

  if (!location) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text>Fetching your location...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
          {showTopBlur && <BlurView intensity={50} tint="light" style={styles.topBlur} />}
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() =>
                  navigation.navigate('MosquitoFlow', { screen: 'MosquitoTabs', params: { screen: 'Home' } })
                }
              >
                <Ionicons name="arrow-back" size={24} color="#007AFF" />
              </TouchableOpacity>
              <Text style={styles.title}>Data Collection</Text>
            </View>

            <MapView
              style={styles.map}
              region={{
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.002,
                longitudeDelta: 0.002,
              }}
              showsUserLocation
            >
              <Marker coordinate={location} title="You are here" />
            </MapView>

            {/* Confirm Location Button */}
            {!locationConfirmed ? (
              <View style={{ marginBottom: 15 }}>
                <Button title="Confirm Location" onPress={() => setLocationConfirmed(true)} />
              </View>
            ) : (
              <>
                {/* Picker below Confirm Location */}
                <View style={styles.pickerContainer}>
                  <Text style={styles.pickerLabel}>Select Monitoring Area:</Text>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={monitoringArea}
                      onValueChange={(val) => setMonitoringArea(val)}
                      mode="dropdown"
                    >
                      <Picker.Item label="Fever" value="Fever" />
                      <Picker.Item label="Dengue" value="Dengue" />
                      <Picker.Item label="Routine ATP" value="Routine ATP" />
                      <Picker.Item label="Scrub" value="Scrub" />
                    </Picker>
                  </View>
                </View>

                {/* Capture Image */}
                <View style={{ marginBottom: 10 }}>
                  <Button title="Capture Image" onPress={pickImage} />
                </View>

                {/* Image Previews */}
                <View style={styles.imagePreview}>
                  {images.map((img, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => {
                        setSelectedImage(img.uri);
                        setModalVisible(true);
                      }}
                    >
                      <Image source={{ uri: img.uri }} style={styles.image} />
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Preview Button */}
                {images.length > 0 && (
                  <View style={{ marginVertical: 10 }}>
                    <Button title="Preview Data" onPress={handlePreview} color="#28a745" />
                  </View>
                )}

                {/* Modal */}
                <Modal visible={modalVisible} transparent animationType="fade">
                  <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                      <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
                        <Ionicons name="close" size={30} color="red" />
                      </TouchableOpacity>
                      <View ref={geoViewRef} collapsable={false} style={styles.captureView}>
                        <Image source={{ uri: selectedImage }} style={styles.fullImage} />
                        <Text style={styles.geoText}>
                          Lat: {location.latitude.toFixed(6)}, Lon: {location.longitude.toFixed(6)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Modal>
              </>
            )}
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, flexGrow: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '600', textAlign: 'center', marginVertical: 15, color: '#333' },
  map: { width: '100%', height: 250, marginBottom: 10, borderRadius: 10 },
  pickerContainer: { marginBottom: 15 },
  pickerLabel: { fontSize: 16, marginBottom: 5, fontWeight: '500' },
  pickerWrapper: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, backgroundColor: '#fff' },
  imagePreview: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 10 },
  image: { width: 80, height: 80, marginRight: 10, marginBottom: 10, borderRadius: 5 },
  topBlur: { position: 'absolute', top: 0, left: 0, right: 0, height: 60, zIndex: 30 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 20 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    elevation: 3,
  },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' },
  modalContent: { position: 'relative', width: '90%', height: '80%', justifyContent: 'center', alignItems: 'center' },
  closeButton: { position: 'absolute', top: 40, right: 10, zIndex: 10, backgroundColor: 'rgba(197,197,197,0.97)', padding: 5, borderRadius: 20 },
  fullImage: { width: '100%', height: '100%', resizeMode: 'cover', borderRadius: 10 },
  captureView: { width: '100%', height: '85%', position: 'relative', justifyContent: 'flex-end' },
  geoText: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    color: 'white',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 14,
    borderRadius: 4,
  },
});
