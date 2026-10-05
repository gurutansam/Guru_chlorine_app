// PushToServerButton.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { ActivityIndicator, Alert, Button } from 'react-native';

// Define your server URL here
const SERVER_URL = 'http://192.168.1.145:3000/api/endpoint';

export default function PushToServerButton() {
  const [isPushing, setIsPushing] = React.useState(false);

  const pushAllToServer = async () => {
    console.log("🚀 pushAllToServer called");   // <--- log at start
    setIsPushing(true);

    try {
      const storedData = await AsyncStorage.getItem('mosquito_data');
      console.log("📦 Raw storedData:", storedData); // <--- log raw data

      if (!storedData) {
        Alert.alert('No data', 'There is no data to push to server');
        return;
      }

      const data = JSON.parse(storedData);
      console.log("✅ Parsed data:", data);

      const unsyncedData = data.filter(item => !item.synced);
      console.log("🔍 Unsynced items:", unsyncedData);

      if (unsyncedData.length === 0) {
        Alert.alert('All data synced', 'All data is already on the server');
        return;
      }

      let updatedData = [...data];
      let successCount = 0;

      for (const item of unsyncedData) {
        try {
          console.log("➡️ Sending item:", item);

          const response = await fetch(SERVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
          });

          const resText = await response.text();
          console.log("⬅️ Server response:", response.status, resText);

          if (response.ok) {
            updatedData = updatedData.map(d =>
              d.date === item.date && d.time === item.time
                ? { ...d, synced: true }
                : d
            );
            successCount++;
          } else {
            console.error("❌ Server rejected:", response.status, resText);
          }
        } catch (error) {
          console.error(`⚠️ Error pushing item ${item.date} ${item.time}:`, error);
        }
      }

      await AsyncStorage.setItem('mosquito_data', JSON.stringify(updatedData));
      Alert.alert('Push Complete', `Successfully pushed ${successCount} of ${unsyncedData.length} entries`);
    } catch (error) {
      console.error('Push all error:', error);
      Alert.alert('Error', 'Failed to push data to server');
    } finally {
      setIsPushing(false);
    }
  };

  return isPushing ? (
    <ActivityIndicator size="small" />
  ) : (
    <Button
      title="Push All to Server"
      onPress={pushAllToServer}
      color="#4CAF50"
    />
  );
}