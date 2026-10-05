import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { MaterialIcons } from '@expo/vector-icons';


const SyncDataScreen = () => {
  const [syncedData, setSyncedData] = useState({});
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    const loadSyncedData = async () => {
      try {
        const storedData = await AsyncStorage.getItem('mosquito_data');
        if (storedData) {
          const parsed = JSON.parse(storedData);
          const onlySynced = parsed.filter(item => item.synced);

          const groupedByDate = onlySynced.reduce((acc, item) => {
            if (!acc[item.date]) acc[item.date] = [];
            acc[item.date].push(item);
            return acc;
          }, {});

          setSyncedData(groupedByDate);
          const dates = Object.keys(groupedByDate);
          if (dates.length > 0) setSelectedDate(dates[0]);
        }
      } catch (error) {
        console.error('Failed to load synced data:', error);
      }
    };

    loadSyncedData();
  }, []);

  
  return (
    <View style={styles.container}>
      <Text style={styles.header}>📦 Synced Submissions</Text>

      {Object.keys(syncedData).length > 0 ? (
        <>
          <Text style={styles.subHeader}>Select Date</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={selectedDate}
              onValueChange={(value) => setSelectedDate(value)}
              style={styles.picker}
              dropdownIconColor="#1e3a8a"
            >
              {Object.keys(syncedData).map((date) => (
                <Picker.Item key={date} label={date} value={date} />
              ))}
            </Picker>
          </View>

          <FlatList
            data={syncedData[selectedDate]}
            keyExtractor={(item, index) => index.toString()}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item, index }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialIcons name="check-circle" size={20} color="#16a34a" />
                  <Text style={styles.cardTitle}>#{index + 1} - {item.time}</Text>
                </View>
                <Text style={styles.cardText}>{item.selected_area} </Text>

                <Text style={styles.cardText}>
                  Lat: {item.location?.latitude.toFixed(6)}, Lon: {item.location?.longitude.toFixed(6)}
                </Text>
              </View>
            )}
          />
        </>
      ) : (
        <Text style={styles.noData}>No synced data available</Text>
      )}
    </View>
  );
};

export default SyncDataScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e3a8a',
    textAlign: 'center',
    marginBottom: 20,
  },
  subHeader: {
    fontSize: 16,
    color: '#475569',
    marginBottom: 8,
    marginLeft: 4,
  },
  pickerWrapper: {
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    marginBottom: 20,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    paddingHorizontal: 8,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 14,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 16,
    color: '#1e293b',
  },
  cardText: {
    fontSize: 14,
    color: '#334155',
    marginTop: 2,
  },
  noData: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 40,
    fontWeight: '500',
  },
});
