import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { pushDataToServer } from '../../../api';

export default function DataList() {
  const [collectedData, setCollectedData] = useState([]);
  const [pushing, setPushing] = useState(false);


  const loadData = async () => {
    try {
      const storedData = await AsyncStorage.getItem('mosquito_data');
      if (storedData) {
        const parsed = JSON.parse(storedData);
        const onlyUnsynced = parsed.filter(item => !item.synced);
        setCollectedData(onlyUnsynced);
      } else {
        setCollectedData([]);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const pushUnsyncedData = async () => {
    setPushing(true);
    try {
      const storedData = await AsyncStorage.getItem('mosquito_data');
      const allData = storedData ? JSON.parse(storedData) : [];
      const unsynced = allData.filter(item => !item.synced);

      if (unsynced.length === 0) {
        Alert.alert('Info', 'All data is already synced');
        setPushing(false);
        return;
      }

      let successCount = 0;
      const updatedData = allData.map(item => ({ ...item }));

      for (const item of unsynced) {
        try {
          const imageUri = item.images?.[0]?.uri || '';
          let base64Image = '';

          if (imageUri) {
            base64Image = await FileSystem.readAsStringAsync(imageUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          }

          // Include all extra fields in JSON, even if not displayed
          const jsonData = {
            user_id: item.user_id,
            username: item.username,
            block_name: item.block_name?.trim() || 'N/A',
            district_name: item.district_name || item.hud_name || item.hub_name || '',
            geolocation: item.location || {},
            user_geolocation: item.loggedInGeoLocation || {},
            address: item.address || 'N/A',
            date: item.date,
            time: item.time,
            selected_area: item.selected_area || 'None',
            monitoringArea: item.monitoringArea || 'Unknown', // ✅ included
            image_base64: base64Image,
          };

          console.log('📤 Pushing JSON:', jsonData);

          const { ok, status, body } = await pushDataToServer(jsonData);

          if (ok) {
            const index = updatedData.findIndex(
              d => d.date === item.date && d.time === item.time
            );
            if (index !== -1) updatedData[index].synced = true;
            successCount++;
          }
        } catch (err) {
          console.warn('Push failed for one item:', err.message || err);
        }
      }

      const remainingUnsynced = updatedData.filter(item => !item.synced);
      await AsyncStorage.setItem('mosquito_data', JSON.stringify(remainingUnsynced));
      setCollectedData(remainingUnsynced);

      Alert.alert(
        'Done',
        `Successfully pushed ${successCount} of ${unsynced.length} entries.`
      );
    } catch (error) {
      console.error('Bulk push failed:', error);
      Alert.alert('Error', 'Something went wrong while pushing data.');
    } finally {
      setPushing(false);
    }
  };

  const renderItem = ({ item, index }) => (
  <View style={[styles.card, styles.unsyncedCard]}>
    <Text style={styles.date}>
      #{index + 1} • {item.date} {item.time}
    </Text>
    <Text style={styles.selected_area}>{item.selected_area}</Text>
    <Text style={styles.details}>
      Lat: {item.location?.latitude?.toFixed(6)}, Lon: {item.location?.longitude?.toFixed(6)}
    </Text>
    <Text style={styles.syncStatus}>
      {item.synced ? '✅ Synced' : '⚠ Not Synced'}
    </Text>
  </View>
);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Unsynced Data List</Text>

      <FlatList
        data={collectedData}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <Text style={styles.empty}>No unsynced data found.</Text>
        }
      />

      <TouchableOpacity
        style={styles.pushButton}
        onPress={pushUnsyncedData}
        disabled={pushing}
      >
        {pushing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.pushButtonText}>Push Unsynced Data</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  date: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  // areaType: { fontSize: 16, marginBottom: 2 },
  unsyncedCard: { borderLeftColor: '#FFC107', borderLeftWidth: 5 },
  syncStatus: { fontSize: 12, color: '#666', marginTop: 5 },
  pushButton: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 3,
  },
  pushButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    color: '#999',
    marginTop: 100,
    fontSize: 16,
  },
});
