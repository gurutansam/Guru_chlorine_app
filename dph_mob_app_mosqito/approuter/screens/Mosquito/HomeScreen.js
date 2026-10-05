import { useState, useEffect, useRef  } from 'react';
import {View,Text,StyleSheet,Button, Alert,ActivityIndicator,Dimensions,} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import MapView, { Marker, LocalTile } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';

export default function MosquitoDashboard() {
  const [hasLocationPermission, setHasLocationPermission] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();
  const mapRef = useRef(null);


  const getLocationUpdates = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setHasLocationPermission(status === 'granted');

    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    });

    setLocation(loc.coords);
  };

const refreshLocation = async () => {
  setRefreshing(true);
  await getLocationUpdates();

  if (location && mapRef.current) {
    mapRef.current.animateToRegion(
      {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      },
      1000 // duration in ms
    );
  }

  setRefreshing(false);
};


  useEffect(() => {
    let subscription;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasLocationPermission(status === 'granted');

      if (status !== 'granted') return;

      subscription = await Location.watchPositionAsync(
  {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 1,
    timeInterval: 1000,
  },
  (loc) => {
    setLocation(loc.coords);
  }
);
    })();

    return () => {
      if (subscription) subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (hasLocationPermission === false) {
      Alert.alert(
        'Location Permission Denied',
        'Please enable location permission from settings to use this feature.',
        [{ text: 'OK' }]
      );
    }
  }, [hasLocationPermission]);

// MosquitoDashboard.js
const handleSubmit = async () => {
  if (!location || location.accuracy > 50) {
    Alert.alert('Invalid Location', 'Please wait for better GPS accuracy');
    return;
  }

  setLoading(true);

  try {
    // Save login location to AsyncStorage
    await AsyncStorage.setItem('user_login_location', JSON.stringify({
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: new Date().toISOString(),
    }));

    Alert.alert('Success', 'Login location captured!');
    navigation.navigate('MosquitoTabs', { screen: 'Home' });
  } catch (error) {
    console.error('Error saving login location:', error);
    Alert.alert('Error', 'Failed to save login location');
  } finally {
    setLoading(false);
  }
};

  if (hasLocationPermission === null) return <View />;

  if (hasLocationPermission === false)
    return (
      <Text style={styles.permissionText}>
        No access to location. Please enable permissions.
      </Text>
    );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mosquito Breeding Login Location</Text>

      {location ? (
        <>
<MapView
  ref={mapRef}
  style={styles.map}
  initialRegion={{
    latitude: location.latitude,
    longitude: location.longitude,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  }}
>

  <LocalTile
    pathTemplate={'/path/to/tiles/{z}/{x}/{y}.png'}
    tileSize={256}
    zIndex={0}
  />

  <Marker
    coordinate={{
      latitude: location.latitude,
      longitude: location.longitude,
    }}
    title="Your Location"
  />
</MapView>

          <Text style={styles.locationText}>
            📍 Lat: {location.latitude.toFixed(6)} | Lon: {location.longitude.toFixed(6)}
            {'\n'}
            Accuracy:{' '}
            {location.accuracy ? location.accuracy.toFixed(2) : 'N/A'} meters
          </Text>

          {location.accuracy > 50 && (
            <Text style={styles.accuracyWarning}>
              Waiting for better GPS accuracy (below 50 meters)...
            </Text>
          )}
        </>
      ) : (
        <Text style={styles.locationText}>Fetching location...</Text>
      )}

<View style={styles.buttonRow}>
  {loading ? (
    <ActivityIndicator size="small" color="#000" style={styles.button} />
  ) : (
    <View style={styles.button}>
      <Button
        title="Submit"
        color="#007AFF"
        onPress={handleSubmit}
        disabled={!location || location.accuracy > 50}
      />
    </View>
  )}

  {refreshing ? (
    <ActivityIndicator size="small" color="#888" style={styles.button} />
  ) : (
    <View style={styles.button}>
      <Button
        title="🔄 Refresh"
        color="#34C759"
        onPress={refreshLocation}
      />
    </View>
  )}
</View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    marginTop: 20,
    textAlign: 'center',
  },
  map: {
    width: Dimensions.get('window').width * 0.9,
    height: 300,
    borderRadius: 12,
  },
  locationText: {
    marginTop: 10,
    fontSize: 16,
    textAlign: 'center',
  },
  accuracyWarning: {
    color: 'red',
    marginTop: 5,
    fontWeight: 'bold',
  },
  permissionText: {
    flex: 1,
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
  },
  buttonRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginTop: 20,
  width: '90%',
},
button: {
  flex: 1,
  marginHorizontal: 5,
  borderRadius: 8,
  overflow: 'hidden',
}

});
