import { getUserCounts, getLarvaCounts, getActionCounts, getUserOverallCounts } from "../../../services/api";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Modal,
  Animated,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Calendar } from "react-native-calendars";
import { useEffect, useState, useRef, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { height } = Dimensions.get("window");
const MODAL_HEIGHT = height * 0.35;


export default function DashboardScreen() {
  const router = useRouter();

  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [currentMonth, setCurrentMonth] = useState(today);
  const [dbcCounts, setDbcCounts] = useState<any>({});
  const [larvaCounts, setLarvaCounts] = useState<any>({});
  const [selectedDBC, setSelectedDBC] = useState(0);
  const [selectedLarva, setSelectedLarva] = useState(0);
  const [totalDBC, setTotalDBC] = useState(0);
  const [totalLarva, setTotalLarva] = useState(0);
  const [actionCounts, setActionCounts] = useState<any>({});
  const [totalAction, setTotalAction] = useState(0);
  const [selectedAction, setSelectedAction] = useState(0);
  const [markedDates, setMarkedDates] = useState<any>({});

  const [overallStats, setOverallStats] = useState<any>(null);

  // Profile Modal States
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [userInfo, setUserInfo] = useState<any>({ name: "", hudName: "" });
  const slideAnim = useRef(new Animated.Value(MODAL_HEIGHT)).current;


  useEffect(() => {
    const dbcTotal = Object.values(dbcCounts).reduce(
      (sum: number, val: any) => sum + Number(val || 0),
      0
    );

    const larvaTotal = Object.values(larvaCounts).reduce(
      (sum: number, val: any) => sum + Number(val || 0),
      0
    );

    const actionTotal = Object.values(actionCounts).reduce(
      (sum: number, val: any) => sum + Number(val || 0),
      0
    );

    setTotalDBC(dbcTotal);
    setTotalLarva(larvaTotal);
    setTotalAction(actionTotal);

    // Mark dates with data on calendar
    const marked: any = { [today]: { marked: true, dotColor: "#3B82F6" } };
    Object.keys(dbcCounts).forEach((date) => {
      marked[date] = { marked: true, dotColor: "#3B82F6" };
    });
    setMarkedDates(marked);
  }, [dbcCounts, larvaCounts, actionCounts, today]);

  useEffect(() => {
    setSelectedDBC(dbcCounts[selectedDate] || 0);
    setSelectedLarva(larvaCounts[selectedDate] || 0);
    setSelectedAction(actionCounts[selectedDate] || 0);
  }, [selectedDate, dbcCounts, larvaCounts, actionCounts]);

  const fetchCounts = async () => {
    try {
      const storedUser = await AsyncStorage.getItem("user_info");
      if (!storedUser) return;

      const user = JSON.parse(storedUser);

      // 🔵 Fetch raw responses from the services/api
      const dbcRes = await getUserCounts(
        user.user_id,
        user.role,
        "mosquito"
      );

      const larvaRes = await getLarvaCounts(user.user_id);
      const actionRes = await getActionCounts(user.user_id);

      const overallRes = await getUserOverallCounts(user.user_id);
      if (overallRes && overallRes.success) {
        setOverallStats(overallRes.data);
      }

      const dbcFormatted: any = {};
      const larvaFormatted: any = {};
      const actionFormatted: any = {};

      // 💡 Convert keys from DD-MM-YYYY to YYYY-MM-DD for the Calendar
      Object.keys(dbcRes).forEach((date) => {
        const parts = date.split("-");
        if (parts.length === 3 && parts[2].length === 4) {
          const key = `${parts[2]}-${parts[1]}-${parts[0]}`;
          dbcFormatted[key] = dbcRes[date];
        } else {
          dbcFormatted[date] = dbcRes[date];
        }
      });

      Object.keys(larvaRes).forEach((date) => {
        const parts = date.split("-");
        if (parts.length === 3 && parts[2].length === 4) {
          const key = `${parts[2]}-${parts[1]}-${parts[0]}`;
          larvaFormatted[key] = larvaRes[date];
        } else {
          larvaFormatted[date] = larvaRes[date];
        }
      });

      Object.keys(actionRes).forEach((date) => {
        const parts = date.split("-");
        if (parts.length === 3 && parts[2].length === 4) {
          const key = `${parts[2]}-${parts[1]}-${parts[0]}`;
          actionFormatted[key] = actionRes[date];
        } else {
          actionFormatted[date] = actionRes[date];
        }
      });

      setDbcCounts(dbcFormatted);
      setLarvaCounts(larvaFormatted);
      setActionCounts(actionFormatted);
    } catch (err) {
      console.log("❌ Count error", err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchCounts();
    }, [])
  );


  // Profile Modal Animation Functions
  const openProfileModal = async () => {
    try {
      const storedUser = await AsyncStorage.getItem("user_info");
      if (storedUser) {
        const user = JSON.parse(storedUser);
        setUserInfo({
          name: user.username || "User",
          hudName: user.hud_name || user.hud || "Not Assigned",
        });
      }
    } catch (err) {
      console.log("Error fetching user info:", err);
    }

    setProfileModalVisible(true);
    slideAnim.setValue(MODAL_HEIGHT);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start();
  };

  const closeProfileModal = () => {
    Animated.timing(slideAnim, {
      toValue: MODAL_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setProfileModalVisible(false);
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* 🔷 NAVBAR */}
        <View style={styles.navbar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#111" />
          </TouchableOpacity>

          <Text style={styles.navTitle}>DBC Dashboard</Text>

          <TouchableOpacity onPress={openProfileModal}>
            <LinearGradient
              colors={["#3B82F6", "#1E40AF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileButton}
            >
              <Ionicons name="person" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* 🔷 COUNT CARDS */}
        <View style={styles.cardRow}>

          <View style={[styles.card, styles.blueCard]}>
            <Text style={styles.cardTitle}>DBC Data</Text>
            <Text style={styles.cardValue}>
              {overallStats ? overallStats.dbc.overall : totalDBC}
            </Text>
          </View>

          <View style={[styles.card, styles.greenCard]}>
            <Text style={styles.cardTitle}>Larva</Text>
            <Text style={styles.cardValue}>
              {overallStats ? overallStats.larva.overall : totalLarva}
            </Text>
          </View>

          <View style={[styles.card, styles.orangeCard]}>
            <Text style={styles.cardTitle}>Action taken</Text>
            <Text style={styles.cardValue}>
              {overallStats ? overallStats.action.overall : totalAction}
            </Text>
          </View>

        </View>

        {/* 🔷 CALENDAR - MONTH VIEW */}
        <View style={styles.calendarContainer}>

          {/* TODAY BUTTON */}
          <View style={styles.monthHeader}>
            <TouchableOpacity
              style={styles.todayBtn}
              onPress={() => {
                setSelectedDate(today);
                setCurrentMonth(today);
              }}
            >
              <Text style={styles.todayText}>📅 Today</Text>
            </TouchableOpacity>
          </View>

          {/* CALENDAR COMPONENT */}
          <Calendar
            current={currentMonth}
            onDayPress={(day) => {
              setSelectedDate(day.dateString);
            }}
            onMonthChange={(month) => {
              setCurrentMonth(month.dateString);
            }}
            markedDates={{
              ...markedDates,
              [selectedDate]: {
                selected: true,
                selectedColor: "#3B82F6",
                selectedTextColor: "#fff",
              },
            }}
            theme={{
              backgroundColor: "#fff",
              calendarBackground: "#fff",
              textSectionTitleColor: "#111",
              textSectionTitleDisabledColor: "#999",
              selectedDayBackgroundColor: "#3B82F6",
              selectedDayTextColor: "#fff",
              todayTextColor: "#3B82F6",
              todayBackgroundColor: "#E0F2FE",
              dayTextColor: "#111",
              textDisabledColor: "#999",
              dotColor: "#3B82F6",
              selectedDotColor: "#fff",
              monthTextColor: "#111",
              indicatorColor: "#3B82F6",
              arrowColor: "#3B82F6",
              disabledArrowColor: "#999",
            }}
            style={styles.calendar}
          />

          <View style={styles.selectedDateInfo}>
            <View style={styles.infoPair}>
              <Text style={styles.infoLabel}>Selected Date</Text>
              <Text style={styles.infoValue}>
                {new Date(selectedDate).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </Text>
            </View>
            <View style={styles.infoPair}>
              <Text style={styles.infoLabel}>DBC</Text>
              <Text style={styles.infoValue}>
                {selectedDate === today && overallStats ? overallStats.dbc.today : selectedDBC}
              </Text>
            </View>
            <View style={styles.infoPair}>
              <Text style={styles.infoLabel}>Larva</Text>
              <Text style={styles.infoValue}>
                {selectedDate === today && overallStats ? overallStats.larva.today : selectedLarva}
              </Text>
            </View>
            <View style={styles.infoPair}>
              <Text style={styles.infoLabel}>Action Taken</Text>
              <Text style={styles.infoValue}>
                {selectedDate === today && overallStats ? overallStats.action.today : selectedAction}
              </Text>
            </View>
          </View>

        </View>

        {/* 🔷 ACTION LIST */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          {/* DBC Entry Action */}
          <TouchableOpacity
            style={styles.modernActionButton}
            onPress={() => router.push("/(main)/(mosquito)/dbcentry")}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#3B82F6", "#1E40AF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionGradient}
            >
              <View style={styles.actionIconContainer}>
                <MaterialCommunityIcons name="database-plus" size={28} color="#fff" />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionMainText}>DBC Entry</Text>
                <Text style={styles.actionSubText}>Record mosquito data</Text>
              </View>
              <View style={styles.actionArrow}>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Larva Entry Action */}
          <TouchableOpacity
            style={styles.modernActionButton}
            onPress={() => router.push("/(main)/(mosquito)/LarvaEntryPage")}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#10B981", "#047857"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionGradient}
            >
              <View style={styles.actionIconContainer}>
                <MaterialCommunityIcons name="water-percent-alert" size={28} color="#fff" />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionMainText}>Larva Entry</Text>
                <Text style={styles.actionSubText}>Log larva findings</Text>
              </View>
              <View style={styles.actionArrow}>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* HI Action Taken */}
          <TouchableOpacity
            style={styles.modernActionButton}
            onPress={() => router.push("/(main)/(mosquito)/actiontaken")}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#F59E0B", "#D97706"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionGradient}
            >
              <View style={styles.actionIconContainer}>
                <MaterialCommunityIcons name="check-circle" size={28} color="#fff" />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionMainText}>HI Action</Text>
                <Text style={styles.actionSubText}>Record action taken</Text>
              </View>
              <View style={styles.actionArrow}>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

        </View>

      </ScrollView>

      {/* 🔷 PROFILE MODAL - MINIMAL */}
      <Modal
        visible={profileModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeProfileModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeProfileModal}
        >
          <Animated.View
            style={[
              styles.profileModalCard,
              {
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={styles.modalContent}
            >
              {/* Handle Bar */}
              <View style={styles.handleBar} />

              {/* Profile Icon at Top */}
              <View style={styles.iconSection}>
                <LinearGradient
                  colors={["#3B82F6", "#1E40AF"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.profileIconBox}
                >
                  <Ionicons name="person" size={36} color="#fff" />
                </LinearGradient>
              </View>

              {/* User Name */}
              <View style={styles.infoRow}>
                <Text style={styles.label}>Name</Text>
                <Text style={styles.value}>{userInfo.name}</Text>
              </View>

              {/* HUD Name */}
              <View style={styles.infoRow}>
                <Text style={styles.label}>HUD Name</Text>
                <Text style={styles.value}>{userInfo.hudName}</Text>
              </View>

            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },

  navbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },

  navTitle: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },

  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  cardTitle: {
    color: "#E5E7EB",
    fontSize: 12,
  },

  cardValue: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 6,
  },

  calendarContainer: {
    marginTop: 20,
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#fff",
    elevation: 4,
    paddingBottom: 16,
  },

  monthHeader: {
    alignItems: "flex-end",
    padding: 10,
  },

  todayBtn: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },

  todayText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },

  calendar: {
    paddingHorizontal: 10,
  },

  selectedDateInfo: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },

  infoPair: {
    alignItems: "center",
  },

  infoLabel: {
    fontSize: 11,
    color: "#999",
    fontWeight: "600",
    marginBottom: 4,
  },

  infoValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
  },

  section: {
    marginTop: 30,
    paddingHorizontal: 16,
    marginBottom: 30,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },

  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 10,
    gap: 10,
    elevation: 2,
  },

  actionText: {
    fontSize: 15,
    fontWeight: "600",
  },

  modernActionButton: {
    borderRadius: 16,
    marginBottom: 14,
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },

  actionGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 14,
  },

  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },

  actionTextContainer: {
    flex: 1,
  },

  actionMainText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
  },

  actionSubText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.85)",
    fontWeight: "500",
  },

  actionArrow: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },

  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 20,
  },

  card: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    marginHorizontal: 4,
  },

  blueCard: {
    backgroundColor: "#3B82F6",
  },

  greenCard: {
    backgroundColor: "#10B981",
  },

  orangeCard: {
    backgroundColor: "#F59E0B",
  },

  // Minimal Profile Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },

  profileModalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: MODAL_HEIGHT,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },

  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  handleBar: {
    width: 48,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },

  iconSection: {
    alignItems: "center",
    marginBottom: 32,
  },

  profileIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },

  infoRow: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },

  label: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  value: {
    fontSize: 18,
    color: "#0F172A",
    fontWeight: "700",
  },
});