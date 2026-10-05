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
  useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Calendar } from 'react-native-calendars';
import { getUserCounts } from '../../../api'; // default type = 'hi'

export default function HiSettingsScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [markedDates, setMarkedDates] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const [selectedDate, setSelectedDate] = useState('');
  const [larvalCount, setLarvalCount] = useState(0);


  const dataType = 'hi'; // always HI
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  const themeColors = {
    background: isDarkMode ? '#000' : '#f2f3f5',
    cardBg: isDarkMode ? '#1e1e1e' : '#fff',
    textPrimary: isDarkMode ? '#fff' : '#222',
    textSecondary: isDarkMode ? '#bbb' : '#555',
    headerBg: isDarkMode ? '#333' : '#232f3e',
    border: isDarkMode ? '#444' : '#eee',
  };

useEffect(() => {
  const loadUserAndDates = async () => {
    try {
      const json = await AsyncStorage.getItem('user_info');
      if (!json) return;

      const parsedUser = JSON.parse(json);

      parsedUser.district_name =
        parsedUser.district_name?.trim() && parsedUser.district_name !== ''
          ? parsedUser.district_name
          : parsedUser.hud_name?.trim() && parsedUser.hud_name !== ''
          ? parsedUser.hud_name
          : parsedUser.hub_name?.trim() && parsedUser.hub_name !== ''
          ? parsedUser.hub_name
          : 'Unknown';

      setUser(parsedUser);

      // 🔹 ONLY HI COUNTS FOR CALENDAR DOTS
      const hiCounts = await getUserCounts(
        parsedUser.user_id,
        parsedUser.role,
        'hi'
      );

      const marked = {};

      Object.keys(hiCounts || {}).forEach((key) => {
        if (!key) return;

        let calendarKey = '';

        if (key.includes('T')) {
          calendarKey = key.slice(0, 10); // YYYY-MM-DD
        } else if (/^\d{2}-\d{2}-\d{4}$/.test(key)) {
          const [dd, mm, yyyy] = key.split('-');
          calendarKey = `${yyyy}-${mm}-${dd}`;
        } else {
          return;
        }

        marked[calendarKey] = {
          marked: true,
          dotColor: '#f72d4fff',
        };
      });

      setMarkedDates(marked);
    } catch (err) {
      console.error('Error loading user or date counts:', err);
    }
  };

  loadUserAndDates();
}, []);


  const handleLogout = () => navigation.replace('AppHome');

 const handleDatePress = async (day) => {
  if (!user) return;

  try {
    const date = day.dateString;
    const [yyyy, mm, dd] = date.split('-');
    const formattedDate = `${dd}-${mm}-${yyyy}`;

    // 🔹 HI count
    const hiCounts = await getUserCounts(
      user.user_id,
      user.role,
      'hi'
    );

    // 🔹 Larval count
    const larvalCounts = await getUserCounts(
      user.user_id,
      user.role,
      'larval'
    );

    setSelectedDate(date);
    setSelectedCount(hiCounts?.[formattedDate] || 0);
    setLarvalCount(larvalCounts?.[formattedDate] || 0);
    setModalVisible(true);

  } catch (err) {
    console.error('Error fetching counts for selected date:', err);
    setSelectedCount(0);
    setLarvalCount(0);
    setModalVisible(true);
  }
};


  if (!user)
    return (
      <Text style={[styles.loading, { color: themeColors.textPrimary, backgroundColor: themeColors.background }]}>
        Loading user info...
      </Text>
    );
   const isMosAdmin = user.role === 'mos_admin';

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={[styles.profileCard, { backgroundColor: themeColors.headerBg }]}>
        <Image source={require('./../../../../assets/user_icon.png')} style={styles.avatar} />
        <Text style={[styles.name, { color: '#fff' }]}>{user.username}</Text>
        <Text style={[styles.userId, { color: '#ccc' }]}>User ID: {user.user_id}</Text>
      </View>

      <View style={[styles.infoContainer, { backgroundColor: themeColors.cardBg }]}>

          <InfoRow label="Email" value={user.email || '-'} themeColors={themeColors} />

          
          {isMosAdmin && (
            <InfoRow
              label="Role"
              value="Mosquito Administrator"
              themeColors={themeColors}
            />
          )}

          {/* HIDE DISTRICT FOR mos_admin */}
          {!isMosAdmin && (
            <InfoRow
              label="District"
              value={user.district_name || '-'}
              themeColors={themeColors}
            />
          )}

          {/* HIDE BLOCK FOR mos_admin */}
          {!isMosAdmin && user.block_name && (
            <InfoRow
              label="Block"
              value={user.block_name}
              themeColors={themeColors}
            />
          )}

          {/* HIDE PHONE FOR mos_admin */}
          {!isMosAdmin && (
            <InfoRow
              label="Phone"
              value={user.phone_number || '-'}
              themeColors={themeColors}
            />
          )}

          <InfoRow label="Status" value={user.status || '-'} themeColors={themeColors} />

        </View>


      <View style={[styles.calendarWrapper, { backgroundColor: themeColors.cardBg }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Data Collected (by Date)</Text>
        <Calendar markingType={'dot'} markedDates={markedDates} onDayPress={handleDatePress} theme={{
          backgroundColor: themeColors.cardBg,
          calendarBackground: themeColors.cardBg,
          dayTextColor: themeColors.textPrimary,
          monthTextColor: themeColors.textPrimary,
          arrowColor: themeColors.textPrimary,
          textSectionTitleColor: themeColors.textPrimary,
        }} />
      </View>

      <View style={styles.logoutWrapper}>
        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Back to Home</Text>
        </Pressable>
      </View>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.cardBg }]}>
            <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>🗓️ {selectedDate}</Text>
           <Text style={[styles.modalText, { color: themeColors.textPrimary }]}>
               HI Monitoring Entries: {selectedCount}
            </Text>

            <Text style={[styles.modalText, { color: themeColors.textPrimary }]}>
               Larval Entries: {larvalCount}
            </Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function InfoRow({ label, value, themeColors }) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: themeColors.border }]}>
      <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: themeColors.textPrimary }]}>{value || '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 40 },
  loading: { flex: 1, textAlign: 'center', marginTop: 100, fontSize: 18 },
  profileCard: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  name: { fontSize: 22, fontWeight: 'bold' },
  userId: { fontSize: 14, marginTop: 4 },
  infoContainer: { margin: 16, borderRadius: 12, padding: 16, elevation: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  infoLabel: { fontSize: 16, fontWeight: '600' },
  infoValue: { fontSize: 16, maxWidth: '60%', textAlign: 'right' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, marginLeft: 8 },
  calendarWrapper: { margin: 16, borderRadius: 12, padding: 16, elevation: 3 },
  logoutWrapper: { marginHorizontal: 20, marginBottom: 40, marginTop: 10 },
  logoutBtn: { backgroundColor: '#e53935', paddingVertical: 14, borderRadius: 10, alignItems: 'center', elevation: 3 },
  logoutBtnPressed: { backgroundColor: '#c62828' },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalBackdrop: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', alignItems: 'center' },
  modalContent: { borderRadius: 16, padding: 20, width: '80%', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  modalText: { fontSize: 16, marginVertical: 6, textAlign: 'center' },
  modalCloseButton: { marginTop: 20, backgroundColor: '#ff3030ff', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalCloseText: { color: '#fff', fontSize: 16 },
});
