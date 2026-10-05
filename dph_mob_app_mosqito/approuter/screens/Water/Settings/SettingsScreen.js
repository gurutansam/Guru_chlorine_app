import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Calendar } from 'react-native-calendars';
import { getUserCounts } from '../../../api.js'; // API function

export default function SettingsScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [markedDates, setMarkedDates] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedCount, setSelectedCount] = useState(0);
  const isChlAdmin = user?.role === 'chl_admin';


  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const theme = styles(isDarkMode);

  const val = (obj, ...keys) =>
    keys.reduce((out, k) => (out != null ? out : obj?.[k]), null) ?? '-';

  const loadUserAndCounts = async () => {
    try {
      setLoading(true);
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

      // Fetch chlorine counts only
      const chlorineCounts = await getUserCounts(
        parsedUser.user_id,
        parsedUser.role,
        'chlorine'
      );

      const marked = {};
          Object.keys(chlorineCounts || {}).forEach((ddmmyyyy) => {
            const [dd, mm, yyyy] = ddmmyyyy.split('-');
            if (!dd || !mm || !yyyy) return;

            marked[`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`] = {
              marked: true,
              dotColor: '#4a90e2',
            };
          });

          setMarkedDates(marked);

        } catch (err) {
          console.error('❌ Error loading user or chlorine counts:', err);

        } finally {
          setLoading(false);
        }
      };


  useEffect(() => {
    loadUserAndCounts();
  }, []);

  const handleLogout = () => navigation.replace('AppHome');

const handleDatePress = async (day) => {
  if (!user) return;

  const date = day.dateString; // YYYY-MM-DD
  const [yyyy, mm, dd] = date.split('-');
  const ddmmyyyy = `${dd}-${mm}-${yyyy}`;

  try {
    const chlorineCounts = await getUserCounts(
      user.user_id,
      user.role,
      'chlorine'
    );

    // 🔍 DEBUG LOGS (ADD HERE)
    console.log("📊 Stored chlorineCounts:", chlorineCounts);
    console.log("📅 Selected date:", ddmmyyyy);

    const count = chlorineCounts?.[ddmmyyyy] || 0;
    console.log("🔢 Matched count:", count);

    setSelectedCount(count);
    setSelectedDate(ddmmyyyy);
    setModalVisible(true);
  } catch (err) {
    console.error('❌ Error fetching chlorine count for date:', err);
    setSelectedCount(0);
    setSelectedDate(ddmmyyyy);
    setModalVisible(true);
  }
};



  if (loading) {
    return (
      <View style={theme.loadingContainer}>
        <ActivityIndicator color="#1a73e8" size="large" />
        <Text style={theme.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={theme.loadingContainer}>
        <Text style={theme.loadingText}>No user found. Please login again.</Text>
        <Pressable style={theme.logoutBtn} onPress={handleLogout}>
          <Text style={theme.logoutText}>Go to Home</Text>
        </Pressable>
      </View>
    );
  }

  const locationName =
    user?.district_name?.trim() && user.district_name !== ''
      ? user.district_name
      : user?.hud_name?.trim() && user.hud_name !== ''
      ? user.hud_name
      : user?.hub_name?.trim() && user.hub_name !== ''
      ? user.hub_name
      : 'Unknown';

  const locationLabel =
    user?.district_name?.trim() && user.district_name !== ''
      ? 'District'
      : user?.hud_name?.trim() && user.hud_name !== ''
      ? 'HUD'
      : user?.hub_name?.trim() && user.hub_name !== ''
      ? 'Hub'
      : 'Location';

  return (
    <ScrollView style={theme.container}>
      <View style={theme.profileCard}>
        <Image
          source={require('./../../../../assets/user_icon.png')}
          style={theme.avatar}
        />
        <Text style={theme.name}>{val(user, 'username', 'name')}</Text>
        <Text style={theme.userId}>User ID: {val(user, 'user_id')}</Text>
      </View>

      <View style={theme.infoContainer}>
        {!isChlAdmin && (
          <InfoRow
            label="Phone Number"
            value={val(user, 'phone_number')}
            theme={theme}
          />
        )}
         {isChlAdmin && (
          <InfoRow
            label="Role"
            value="Chlorine Administrator"
            theme={theme}
          />
        )}
        <InfoRow label="Status" value={val(user, 'status')} theme={theme} />
         {!isChlAdmin && (
          <InfoRow
            label={locationLabel}
            value={locationName}
            theme={theme}
          />
        )}
         <InfoRow label="Email" value={val(user, 'email')} theme={theme} />
        </View>

      <View style={theme.calendarWrapper}>
        <Text style={theme.sectionTitle}>Chlorine Data Collected (by Date)</Text>
        <Calendar
          markingType={'dot'}
          markedDates={markedDates}
          onDayPress={handleDatePress}
          theme={{
            backgroundColor: isDarkMode ? '#000' : '#fff',
            calendarBackground: isDarkMode ? '#000' : '#fff',
            dayTextColor: isDarkMode ? '#fff' : '#000',
            monthTextColor: isDarkMode ? '#fff' : '#000',
            textDisabledColor: isDarkMode ? '#666' : '#ccc',
            arrowColor: '#1a73e8',
          }}
        />
      </View>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={theme.modalBackdrop}>
          <View style={theme.modalContent}>
            <Text style={theme.modalTitle}>🗓️ {selectedDate}</Text>
            <Text style={theme.modalText}>💧 Chlorine Entries: {selectedCount}</Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={theme.modalCloseButton}
            >
              <Text style={theme.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={theme.logoutWrapper}>
        <Pressable
          style={({ pressed }) => [theme.logoutBtn, pressed && theme.logoutBtnPressed]}
          onPress={handleLogout}
        >
          <Text style={theme.logoutText}>Back to Home</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const InfoRow = ({ label, value, theme }) => (
  <View style={theme.infoRow}>
    <Text style={theme.infoLabel}>{label}</Text>
    <Text style={theme.infoValue}>{value || '-'}</Text>
  </View>
);

const styles = (isDarkMode) =>
  StyleSheet.create({
    container: {
      paddingBottom: 60,
      backgroundColor: isDarkMode ? '#000' : '#f5f7fb',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#000' : '#f5f7fb',
    },
    loadingText: {
      fontSize: 16,
      color: isDarkMode ? '#fff' : '#444',
      marginTop: 10,
    },
    profileCard: {
      backgroundColor: '#1a73e8',
      paddingVertical: 80,
      paddingHorizontal: 20,
      alignItems: 'center',
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
    },
    avatar: {
      width: 90,
      height: 90,
      borderRadius: 45,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: '#fff',
    },
    name: {
      fontSize: 20,
      color: '#fff',
      fontWeight: 'bold',
    },
    userId: {
      fontSize: 14,
      color: isDarkMode ? '#ccc' : '#e0e0e0',
      marginTop: 4,
    },
    infoContainer: {
      margin: 16,
      backgroundColor: isDarkMode ? '#121212' : '#ffffff',
      borderRadius: 12,
      padding: 16,
      elevation: 2,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginVertical: 8,
    },
    infoLabel: {
      fontWeight: '600',
      color: isDarkMode ? '#bbb' : '#444',
    },
    infoValue: {
      color: isDarkMode ? '#fff' : '#222',
      fontWeight: '500',
    },
    calendarWrapper: {
      backgroundColor: isDarkMode ? '#121212' : '#fff',
      margin: 16,
      borderRadius: 12,
      padding: 16,
      elevation: 3,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 10,
      color: isDarkMode ? '#fff' : '#000',
    },
    logoutWrapper: {
      marginTop: 30,
      alignItems: 'center',
      marginBottom: 50,
    },
    logoutBtn: {
      backgroundColor: '#ff0000be',
      paddingVertical: 14,
      paddingHorizontal: 120,
      borderRadius: 10,
      alignItems: 'center',
    },
    logoutBtnPressed: {
      backgroundColor: '#f75e5eff',
    },
    logoutText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 16,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: '#000000aa',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: isDarkMode ? '#1e1e1e' : '#fff',
      borderRadius: 16,
      padding: 20,
      width: '80%',
      alignItems: 'center',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 10,
      color: isDarkMode ? '#fff' : '#000',
    },
    modalText: {
      fontSize: 16,
      marginVertical: 4,
      textAlign: 'center',
      color: isDarkMode ? '#ddd' : '#000',
    },
    modalCloseButton: {
      marginTop: 20,
      backgroundColor: '#ff3030ff',
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
    },
    modalCloseText: {
      color: '#fff',
      fontSize: 16,
    },
  });
