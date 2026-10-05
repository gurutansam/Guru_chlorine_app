import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ScrollView,
  Modal,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Calendar } from 'react-native-calendars';
import { getUserCounts } from '../../../api';

export default function SettingsScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [markedDates, setMarkedDates] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const [selectedDate, setSelectedDate] = useState('');
  const [dataType, setDataType] = useState('mosquito'); // 'mosquito', 'chlorine', 'hi'

  // Load user info and initial counts
  useEffect(() => {
    const loadUserAndCounts = async () => {
      try {
        const json = await AsyncStorage.getItem('user_info');
        if (!json) return;

        const parsedUser = JSON.parse(json);

        // Normalize district/hud/hub
        parsedUser.district_name =
          parsedUser.district_name?.trim() && parsedUser.district_name !== ''
            ? parsedUser.district_name
            : parsedUser.hud_name?.trim() && parsedUser.hud_name !== ''
            ? parsedUser.hud_name
            : parsedUser.hub_name?.trim() && parsedUser.hub_name !== ''
            ? parsedUser.hub_name
            : 'Unknown';

        setUser(parsedUser);

        // Load counts for selected data type
        await loadCounts(parsedUser, dataType);

      } catch (err) {
        console.error('Error loading user or date counts:', err);
      }
    };

    loadUserAndCounts();
  }, [dataType]);

  // Load counts and mark calendar dots
  const loadCounts = async (parsedUser, type) => {
    try {
      const counts = await getUserCounts(parsedUser.user_id, parsedUser.role, type);

      // Keep only DD-MM-YYYY keys for mosquito and HI
      const validCounts = {};
      Object.keys(counts || {}).forEach(key => {
        if (type === 'chlorine' || /^\d{2}-\d{2}-\d{4}$/.test(key)) {
          validCounts[key] = counts[key];
        }
      });

      // Map validCounts keys to YYYY-MM-DD for calendar dots
      const marked = {};
      Object.keys(validCounts).forEach(ddmmyyyy => {
        const [dd, mm, yyyy] = ddmmyyyy.split("-");
        const key = `${yyyy}-${mm}-${dd}`;
        marked[key] = { marked: true, dotColor: "#f72d4fff" };
      });

      setMarkedDates(marked);
    } catch (err) {
      console.error('Error loading counts:', err);
    }
  };

  const handleLogout = () => navigation.replace('AppHome');

  const handleDatePress = async (day) => {
    if (!user) return;

    const date = day.dateString; // YYYY-MM-DD
    const [yyyy, mm, dd] = date.split('-');
    const ddmmyyyy = `${dd}-${mm}-${yyyy}`;

    try {
      const counts = await getUserCounts(user.user_id, user.role, dataType);

      // Filter valid keys
      const validCounts = {};
      Object.keys(counts || {}).forEach(key => {
        if (dataType === 'chlorine' || /^\d{2}-\d{2}-\d{4}$/.test(key)) {
          validCounts[key] = counts[key];
        }
      });

      const count = validCounts[ddmmyyyy] || 0;
      setSelectedDate(ddmmyyyy);
      setSelectedCount(count);
      setModalVisible(true);
    } catch (err) {
      console.error(`❌ Error fetching ${dataType} count for date:`, err);
      setSelectedDate(ddmmyyyy);
      setSelectedCount(0);
      setModalVisible(true);
    }
  };

  if (!user) return <Text style={styles.loading}>Loading user info...</Text>;

  return (
    <ScrollView style={styles.container}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <Image source={require('./../../../../assets/user_icon.png')} style={styles.avatar} />
        <Text style={styles.name}>{user.username}</Text>
        <Text style={styles.userId}>User ID: {user.user_id}</Text>
      </View>

      {/* Info Rows */}
      <View style={styles.infoContainer}>
        <InfoRow label="Email" value={user.email || '-'} />
        <InfoRow label="District" value={user.district_name || '-'} />
        {user.block_name && <InfoRow label="Block" value={user.block_name} />}
        <InfoRow label="Phone" value={user.phone_number || '-'} />
        <InfoRow label="Status" value={user.status || '-'} />
      </View>

      {/* Calendar */}
      <View style={styles.calendarWrapper}>
        <Text style={styles.sectionTitle}>Data Collected (by Date)</Text>
        <Calendar
          markingType={'dot'}
          markedDates={markedDates}
          onDayPress={handleDatePress}
        />
      </View>

      {/* Logout Button */}
      <View style={styles.logoutWrapper}>
        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Back to Home</Text>
        </Pressable>
      </View>

      {/* Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🗓️ {selectedDate}</Text>
            <Text style={styles.modalText}>📊 Entries: {selectedCount}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f3f5', paddingTop: 40 },
  loading: { flex: 1, textAlign: 'center', marginTop: 100, fontSize: 18 },
  profileCard: { backgroundColor: '#232f3e', paddingVertical: 32, paddingHorizontal: 20, alignItems: 'center', borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 12, borderWidth: 2, borderColor: '#fff' },
  name: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  userId: { color: '#ccc', fontSize: 14, marginTop: 4 },
  infoContainer: { margin: 16, backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  infoLabel: { fontSize: 16, color: '#555', fontWeight: '600' },
  infoValue: { fontSize: 16, color: '#222', maxWidth: '60%', textAlign: 'right' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, marginLeft: 8, color: '#333' },
  calendarWrapper: { backgroundColor: '#fff', margin: 16, borderRadius: 12, padding: 16, elevation: 3 },
  logoutWrapper: { marginHorizontal: 20, marginBottom: 40, marginTop: 10 },
  logoutBtn: { backgroundColor: '#e53935', paddingVertical: 14, borderRadius: 10, alignItems: 'center', elevation: 3 },
  logoutBtnPressed: { backgroundColor: '#c62828' },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalBackdrop: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '80%', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  modalText: { fontSize: 16, marginVertical: 6, textAlign: 'center' },
  modalCloseButton: { marginTop: 20, backgroundColor: '#ff3030ff', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalCloseText: { color: '#fff', fontSize: 16 },
});
