import React, { JSX, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  StatusBar,
  Animated,
  PanResponder,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Calendar, DateData } from "react-native-calendars";
import { UserRole } from "../../types/navigation";
import { getUserCounts } from "../../services/api";

const SCREEN_HEIGHT = Dimensions.get("window").height;
// How far the user must drag down before the sheet dismisses
const SWIPE_DISMISS_THRESHOLD = 120;

// ─── Types ────────────────────────────────────────────────────────────────────
type UserInfo = {
  username: string;
  phone_number: string;
  role: UserRole;
  user_id: string;
  hud_name: string;
};

type CardItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  iconBg: string;
  iconColor: string;
  stripColor: string;
  badge: string;
  badgeBg: string;
  badgeText: string;
};

type MarkedDates = {
  [date: string]: {
    selected?: boolean;
    marked?: boolean;
    selectedColor?: string;
    dotColor?: string;
  };
};

type ChlorineCounts = {
  [ddmmyyyy: string]: number;
};

// ─── Cards Config ─────────────────────────────────────────────────────────────
const CARDS: CardItem[] = [
  {
    id: "dbc",
    title: "Domestic Breeding Checker",
    subtitle: "Monitor & inspect breeding sites in the field",
    icon: "bug-outline",
    iconBg: "#1D4ED8", iconColor: "#93C5FD", stripColor: "#3B82F6",
    badge: "DBC", badgeBg: "#DBEAFE", badgeText: "#1D4ED8",
  },
  {
    id: "chlorination",
    title: "AI Chlorination Check",
    subtitle: "AI-based water chlorination analysis",
    icon: "test-tube",
    iconBg: "#D97706", iconColor: "#FEF3C7", stripColor: "#F59E0B",
    badge: "AI", badgeBg: "#FEF9C3", badgeText: "#B45309",
  },
  {
    id: "water",
    title: "Water Quality Analysis",
    subtitle: "Advance Travel Program monitoring",
    icon: "water-check-outline",
    iconBg: "#065F46", iconColor: "#A7F3D0", stripColor: "#059669",
    badge: "ATP", badgeBg: "#D1FAE5", badgeText: "#065F46",
  },
];

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function HomeScreen(): JSX.Element {
  const router = useRouter();

  const [checkerModalVisible, setCheckerModalVisible] = useState<boolean>(false);
  const [profileModalVisible, setProfileModalVisible] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedCount, setSelectedCount] = useState<number>(0);
  const [dateOverlayVisible, setDateOverlayVisible] = useState<boolean>(false);

  // ─── Swipe-to-dismiss animation refs ────────────────────────────────────────
  // translateY drives the sheet position; starts at 0 (fully visible)
  const sheetTranslateY = useRef(new Animated.Value(0)).current;

  const closeProfileSheet = () => {
    // Animate the sheet down off-screen, then hide the modal
    Animated.timing(sheetTranslateY, {
      toValue: SCREEN_HEIGHT,
      duration: 280,
      useNativeDriver: true,
    }).start(() => {
      sheetTranslateY.setValue(0);   // reset for next open
      setProfileModalVisible(false);
      setDateOverlayVisible(false);
    });
  };

  const openProfileSheet = () => {
    sheetTranslateY.setValue(SCREEN_HEIGHT); // start off-screen
    setProfileModalVisible(true);
    Animated.spring(sheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  };

  // PanResponder that tracks drag on the handle / header area
  const panResponder = useRef(
    PanResponder.create({
      // Only capture downward vertical drags
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderMove: (_, gestureState) => {
        // Only follow finger downward (dy > 0)
        if (gestureState.dy > 0) {
          sheetTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > SWIPE_DISMISS_THRESHOLD || gestureState.vy > 0.5) {
          // Fast or far enough → dismiss
          Animated.timing(sheetTranslateY, {
            toValue: SCREEN_HEIGHT,
            duration: 240,
            useNativeDriver: true,
          }).start(() => {
            sheetTranslateY.setValue(0);
            setProfileModalVisible(false);
            setDateOverlayVisible(false);
          });
        } else {
          // Snap back to open position
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        }
      },
    })
  ).current;

  // ─── Load user + chlorine counts ────────────────────────────────────────────
  const loadUserAndCounts = async (): Promise<void> => {
    try {
      const json = await AsyncStorage.getItem("user_info");
      if (!json) return;

      const parsedUser = JSON.parse(json);
      setUserRole(parsedUser.role as UserRole);
      setUserInfo({
        username: parsedUser.username ?? parsedUser.name ?? "Officer",
        phone_number: parsedUser.phone_number ?? "—",
        role: parsedUser.role as UserRole,
        user_id: parsedUser.user_id ?? "—",
        hud_name: parsedUser.hud_name ?? "_",
      });

      const chlorineCounts: ChlorineCounts = await getUserCounts(
        parsedUser.user_id,
        parsedUser.role,
        "chlorine"
      );

      const marked: MarkedDates = {};
      Object.keys(chlorineCounts || {}).forEach((ddmmyyyy) => {
        const [dd, mm, yyyy] = ddmmyyyy.split("-");
        if (!dd || !mm || !yyyy) return;
        marked[`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`] = {
          marked: true,
          dotColor: "#4a90e2",
        };
      });
      setMarkedDates(marked);
    } catch (err) {
      console.error("❌ Error loading user or chlorine counts:", err);
    }
  };

  useEffect(() => {
    loadUserAndCounts();
  }, []);

  // ─── Calendar date press ─────────────────────────────────────────────────────
  const handleDatePress = async (day: DateData): Promise<void> => {
    if (!userInfo) return;

    const [yyyy, mm, dd] = day.dateString.split("-");
    const ddmmyyyy = `${dd}-${mm}-${yyyy}`;

    try {
      const chlorineCounts: ChlorineCounts = await getUserCounts(
        userInfo.user_id,
        userInfo.role,
        "chlorine"
      );
      const count = chlorineCounts?.[ddmmyyyy] || 0;
      setSelectedCount(count);
    } catch {
      setSelectedCount(0);
    }

    setSelectedDate(ddmmyyyy);
    setDateOverlayVisible(true);
  };

  // ─── Logout ──────────────────────────────────────────────────────────────────
  const handleLogout = (): void => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out", style: "destructive",
        onPress: async () => {
          try {
            await AsyncStorage.removeItem("user_info");
            router.replace("/");
          } catch (error) {
            console.error("Logout error:", error);
          }
        },
      },
    ]);
  };

  // ─── Water quality routing ───────────────────────────────────────────────────
  const handleWaterQualityPress = (): void => {
    if (!userRole) {
      Alert.alert("Loading", "Please wait while your role is being loaded.");
      return;
    }
    if (userRole === "RWAL_hi_user") {
      router.push("/(main)/(water)/tourplan");
    } else if (userRole === "hi_user") {
      Alert.alert("Access Denied", "You do not have permission to access this page.");
    } else {
      Alert.alert("Access Denied", "Unauthorized user.");
    }
  };

  const handleCardPress = (id: string): void => {
    if (id === "dbc") setCheckerModalVisible(true);
    else if (id === "chlorination") router.push("/(main)/(water)/Waterqualityscreen");
    else if (id === "water") handleWaterQualityPress();
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const getRoleLabel = (role: UserRole | null): string => {
    const map: Partial<Record<UserRole, string>> = {
      hi_user: "Health Inspector",
      RWAL_hi_user: "RWAL Inspector",
      block_user: "Block Officer",
      DHO: "District Health Officer",
      chl_admin: "CHL Admin",
      mos_admin: "MOS Admin",
      special_user: "Special Officer",
    };
    return role ? (map[role] ?? role) : "Loading...";
  };

  const getInitials = (name: string): string =>
    name
      .split(/[\s.]+/)
      .filter(Boolean)
      .map((w) => w[0].toUpperCase())
      .slice(0, 2)
      .join("");

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerCircle1} />
          <View style={styles.headerCircle2} />

          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>Good day,</Text>
              <Text style={styles.userName}>{userInfo?.username ?? "Officer"}</Text>
              <View style={styles.rolePill}>
                <View style={styles.roleIndicator} />
                <Text style={styles.roleText}>{getRoleLabel(userRole)}</Text>
              </View>
            </View>

            {/* Avatar opens the animated sheet */}
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={openProfileSheet}
            >
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitials}>
                  {getInitials(userInfo?.username ?? "O")}
                </Text>
              </View>
              <View style={styles.onlineDot} />
            </TouchableOpacity>
          </View>

          <View style={styles.statsStrip}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>3</Text>
              <Text style={styles.statLabel}>Modules</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>v2.1.1</Text>
              <Text style={styles.statLabel}>Version</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="check-circle-outline" size={18} color="#34D399" />
              <Text style={[styles.statLabel, { color: "#34D399", marginTop: 2 }]}>Active</Text>
            </View>
          </View>
        </View>

        {/* ── Body ── */}
        <View style={styles.body}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>Monitoring Modules</Text>
            <View style={styles.sectionLine} />
          </View>

          <View style={styles.cardsContainer}>
            {CARDS.map((card) => (
              <TouchableOpacity
                key={card.id}
                style={styles.card}
                onPress={() => handleCardPress(card.id)}
                activeOpacity={0.87}
              >
                <View style={[styles.cardStrip, { backgroundColor: card.stripColor }]} />
                <View style={[styles.iconBox, { backgroundColor: card.iconBg }]}>
                  <MaterialCommunityIcons name={card.icon} size={26} color={card.iconColor} />
                </View>
                <View style={styles.cardMid}>
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
                </View>
                <View style={styles.cardRight}>
                  <View style={[styles.badge, { backgroundColor: card.badgeBg }]}>
                    <Text style={[styles.badgeText, { color: card.badgeText }]}>{card.badge}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#CBD5E1" style={{ marginTop: 6 }} />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout-variant" size={18} color="#EF4444" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerApp}>Field Monitoring Application</Text>
            <Text style={styles.footerMeta}>Version 2.1.1 · Developed by TANSAM</Text>
            <Text style={styles.footerGov}>Government of Tamil Nadu · DPH&PM</Text>
          </View>
        </View>
      </ScrollView>

      {/* ══════════════════════════════════════
          Profile Modal  (Animated swipe-down)
      ══════════════════════════════════════ */}
      <Modal
        transparent
        visible={profileModalVisible}
        animationType="none"          // ← we handle animation ourselves
        onRequestClose={closeProfileSheet}
      >
        {/* Tapping the dim backdrop dismisses */}
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeProfileSheet}
        >
          {/* Stop press propagation so taps inside sheet don't close it */}
          <Animated.View
            style={[
              styles.profileSheet,
              { transform: [{ translateY: sheetTranslateY }] },
            ]}
            // Prevent the TouchableOpacity overlay from receiving taps
            onStartShouldSetResponder={() => true}
          >
            {/* ── Draggable handle area ── */}
            <View style={styles.handleArea} {...panResponder.panHandlers}>
              <View style={styles.sheetHandle} />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 32 }}
              keyboardShouldPersistTaps="handled"
              // Prevent ScrollView from stealing the PanResponder when at top
              scrollEventThrottle={16}
            >
              {/* Hero */}
              <View style={styles.profileHero}>
                <View style={styles.profileAvatarLarge}>
                  <Text style={styles.profileAvatarText}>
                    {getInitials(userInfo?.username ?? "O")}
                  </Text>
                </View>
                <Text style={styles.profileName}>{userInfo?.username ?? "—"}</Text>
                <View style={styles.profileRoleTag}>
                  <View style={styles.profileRoleDot} />
                  <Text style={styles.profileRoleTagText}>{getRoleLabel(userRole)}</Text>
                </View>
              </View>

              {/* Info cards */}
              <View style={styles.profileInfoGrid}>
                <View style={styles.profileInfoCard}>
                  <MaterialCommunityIcons name="phone-outline" size={20} color="#2563EB" />
                  <Text style={styles.profileInfoCardLabel}>Phone</Text>
                  <Text style={styles.profileInfoCardValue} numberOfLines={1}>
                    {userInfo?.phone_number ?? "—"}
                  </Text>
                </View>
                <View style={styles.profileInfoCard}>
                  <MaterialCommunityIcons name="home" size={20} color="#059669" />
                  <Text style={styles.profileInfoCardLabel}>HUD Name</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ maxWidth: "100%" }}
                  >
                    <Text style={[styles.profileInfoCardValue, { flexShrink: 0 }]}>
                      {userInfo?.hud_name ?? "—"}
                    </Text>
                  </ScrollView>
                </View>
              </View>

              {/* Calendar */}
              <View style={styles.profileCalendarSection}>
                <View style={styles.profileCalendarHeader}>
                  <MaterialCommunityIcons name="calendar-check-outline" size={18} color="#1a73e8" />
                  <Text style={styles.profileCalendarTitle}>Chlorine Data Collected</Text>
                </View>
                <Calendar
                  markingType="dot"
                  markedDates={markedDates}
                  onDayPress={handleDatePress}
                  theme={{
                    backgroundColor: "#fff",
                    calendarBackground: "#fff",
                    dayTextColor: "#111",
                    monthTextColor: "#111",
                    textDisabledColor: "#ccc",
                    arrowColor: "#1a73e8",
                    todayTextColor: "#1a73e8",
                    selectedDayBackgroundColor: "#1a73e8",
                    dotColor: "#1a73e8",
                    selectedDotColor: "#fff",
                    textDayFontWeight: "500",
                    textMonthFontWeight: "700",
                    textDayHeaderFontWeight: "600",
                    textDayFontSize: 13,
                    textMonthFontSize: 15,
                    textDayHeaderFontSize: 12,
                  }}
                />
              </View>

              {/* Close */}
              <TouchableOpacity
                style={styles.profileCloseBtn}
                activeOpacity={0.85}
                onPress={closeProfileSheet}
              >
                <Text style={styles.profileCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* ── Date count overlay (inside sheet, above calendar) ── */}
            {dateOverlayVisible && (
              <View style={styles.dateOverlayBackdrop}>
                <View style={styles.dateOverlayCard}>
                  <View style={styles.dateModalIconWrap}>
                    <MaterialCommunityIcons name="water-check-outline" size={32} color="#1a73e8" />
                  </View>
                  <Text style={styles.dateModalDate}> {selectedDate}</Text>
                  <Text style={styles.dateModalSub}>Chlorine entries recorded on this date</Text>
                  <View style={styles.dateModalCountBadge}>
                    <Text style={styles.dateModalCountNum}>{selectedCount}</Text>
                    <Text style={styles.dateModalCountLabel}>Chlorine{"\n"}Entries</Text>
                  </View>
                  <Text style={styles.dateModalStatus}>
                    {selectedCount > 0
                      ? `${selectedCount} record${selectedCount > 1 ? "s" : ""} submitted`
                      : "No records found for this date"}
                  </Text>
                  <TouchableOpacity
                    style={styles.dateModalCloseBtn}
                    onPress={() => setDateOverlayVisible(false)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.dateModalCloseTxt}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* ══════════════════════════════════════
          DBC Role Modal
      ══════════════════════════════════════ */}
      <Modal
        transparent
        visible={checkerModalVisible}
        animationType="fade"
        onRequestClose={() => setCheckerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.modalIconWrap}>
              <MaterialCommunityIcons name="bug-outline" size={30} color="#3B82F6" />
            </View>
            <Text style={styles.modalTitle}>Domestic Breeding Checker</Text>
            <Text style={styles.modalSub}>Select your inspection role to continue</Text>

            <TouchableOpacity
              style={[styles.roleBtn, { backgroundColor: "#EFF6FF" }]}
              onPress={() => { setCheckerModalVisible(false); router.push("/(main)/(mosquito)/dbcworker"); }}
            >
              <View style={[styles.roleBtnIcon, { backgroundColor: "#DBEAFE" }]}>
                <MaterialCommunityIcons name="bug" size={20} color="#1D4ED8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.roleBtnTitle, { color: "#1D4ED8" }]}>DBC</Text>
                <Text style={styles.roleBtnSub}>Domestic Breeding Checker</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#93C5FD" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleBtn, { backgroundColor: "#F0F9FF" }]}
              onPress={() => { setCheckerModalVisible(false); router.push("/(main)/(mosquito)/indexlayout"); }}
            >
              <View style={[styles.roleBtnIcon, { backgroundColor: "#BAE6FD" }]}>
                <MaterialCommunityIcons name="account-hard-hat-outline" size={20} color="#0369A1" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.roleBtnTitle, { color: "#0369A1" }]}>HI</Text>
                <Text style={styles.roleBtnSub}>Health Inspector</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#7DD3FC" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCheckerModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0F172A" },
  scrollContent: { flexGrow: 1, paddingBottom: 32 },

  /* ── Header ── */
  header: {
    backgroundColor: "#0F172A", paddingHorizontal: 24,
    paddingTop: 66, paddingBottom: 28, overflow: "hidden",
  },
  headerCircle1: {
    position: "absolute", width: 220, height: 220, borderRadius: 110,
    backgroundColor: "#1E3A5F", top: -60, right: -50, opacity: 0.6,
  },
  headerCircle2: {
    position: "absolute", width: 140, height: 140, borderRadius: 70,
    backgroundColor: "#1E40AF", top: 60, right: 80, opacity: 0.15,
  },
  headerTop: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 20,
  },
  greeting: { fontSize: 13, color: "#64748B", fontFamily: "Ubuntu_400Regular", letterSpacing: 0.4 },
  userName: { fontSize: 26, color: "#F1F5F9", fontFamily: "Ubuntu_700Bold", marginTop: 2, marginBottom: 8 },
  rolePill: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#1E293B",
    alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: "#334155",
  },
  roleIndicator: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#34D399", marginRight: 6 },
  roleText: { fontSize: 12, color: "#94A3B8", fontFamily: "Ubuntu_400Regular" },
  avatarBtn: { position: "relative", padding: 2 },
  avatarCircle: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: "#3B5BDB",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#4F6EF7",
  },
  avatarInitials: { fontSize: 16, color: "#fff", fontFamily: "Ubuntu_700Bold", letterSpacing: 0.5 },
  onlineDot: {
    position: "absolute", bottom: 2, right: 2, width: 10, height: 10,
    borderRadius: 5, backgroundColor: "#34D399", borderWidth: 2, borderColor: "#0F172A",
  },
  statsStrip: {
    flexDirection: "row", backgroundColor: "#1E293B", borderRadius: 16,
    padding: 16, alignItems: "center", justifyContent: "space-around",
    borderWidth: 1, borderColor: "#334155",
  },
  statItem: { alignItems: "center" },
  statNum: { fontSize: 18, color: "#F1F5F9", fontFamily: "Ubuntu_700Bold" },
  statLabel: { fontSize: 11, color: "#64748B", fontFamily: "Ubuntu_400Regular", marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: "#334155" },

  /* ── Body ── */
  body: {
    backgroundColor: "#F8FAFC", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 8, flex: 1, minHeight: "100%",
  },
  sectionRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 14,
  },
  sectionLabel: {
    fontSize: 11, color: "#94A3B8", fontFamily: "Ubuntu_700Bold",
    letterSpacing: 1.4, textTransform: "uppercase", marginRight: 12,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: "#E2E8F0" },

  cardsContainer: { paddingHorizontal: 20, gap: 12 },
  card: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 18, padding: 16, overflow: "hidden",
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 4, marginBottom: 2,
  },
  cardStrip: {
    position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
    borderTopLeftRadius: 18, borderBottomLeftRadius: 18,
  },
  iconBox: {
    width: 52, height: 52, borderRadius: 15, alignItems: "center",
    justifyContent: "center", marginLeft: 8, marginRight: 14,
  },
  cardMid: { flex: 1 },
  cardTitle: { fontSize: 14, fontFamily: "Ubuntu_700Bold", color: "#1E293B", marginBottom: 3 },
  cardSubtitle: { fontSize: 12, color: "#94A3B8", fontFamily: "Ubuntu_400Regular", lineHeight: 17 },
  cardRight: { alignItems: "flex-end", justifyContent: "center", gap: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontFamily: "Ubuntu_700Bold", letterSpacing: 0.4 },

  signOutBtn: {
    flexDirection: "row", alignItems: "center", alignSelf: "center",
    marginTop: 28, paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 14, backgroundColor: "#fff",
    borderWidth: 1, borderColor: "#FEE2E2", gap: 8,
    shadowColor: "#EF4444", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  signOutText: { fontSize: 14, color: "#EF4444", fontFamily: "Ubuntu_700Bold" },

  footer: { alignItems: "center", marginTop: 28, gap: 3 },
  footerApp: { fontSize: 13, color: "#64748B", fontFamily: "Ubuntu_400Regular" },
  footerMeta: { fontSize: 11, color: "#94A3B8", fontFamily: "Ubuntu_400Regular" },
  footerGov: { fontSize: 11, color: "#1D4ED8", fontFamily: "Ubuntu_700Bold", marginTop: 2 },

  /* ── Shared ── */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E2E8F0", alignSelf: "center" },

  /* ── Handle drag area (tall hit target) ── */
  handleArea: {
    width: "100%", paddingTop: 12, paddingBottom: 8,
    alignItems: "center", justifyContent: "center",
  },

  /* ── Profile Sheet ── */
  profileSheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: "92%",
  },
  profileHero: {
    alignItems: "center", paddingVertical: 24, paddingHorizontal: 20,
    backgroundColor: "#1a73e8", marginHorizontal: 16, marginTop: 12, borderRadius: 20,
  },
  profileAvatarLarge: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: "#3B5BDB",
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "#C7D2FE",
    shadowColor: "#3B5BDB", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 14, elevation: 10,
  },
  profileAvatarText: {
    fontSize: 26, fontWeight: "800", color: "#fff",
    letterSpacing: 1, fontFamily: "Ubuntu_700Bold",
  },
  profileName: {
    fontSize: 21, color: "#fff", fontFamily: "Ubuntu_700Bold",
    textAlign: "center", marginTop: 12, marginBottom: 8,
  },
  profileRoleTag: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20,
  },
  profileRoleDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4ade80", marginRight: 7 },
  profileRoleTagText: { fontSize: 13, color: "#fff", fontFamily: "Ubuntu_400Regular" },

  profileInfoGrid: {
    flexDirection: "row", flexWrap: "wrap",
    marginHorizontal: 16, marginTop: 16, gap: 10,
  },
  profileInfoCard: {
    width: "47.5%", backgroundColor: "#F9FAFB", borderRadius: 16,
    padding: 14, borderWidth: 1, borderColor: "#E5E7EB", gap: 4,
  },
  profileInfoCardLabel: {
    fontSize: 10, fontWeight: "700", color: "#9CA3AF",
    textTransform: "uppercase", letterSpacing: 0.8, marginTop: 4,
  },
  profileInfoCardValue: { fontSize: 13, fontWeight: "700", color: "#111827" },

  profileCalendarSection: {
    marginHorizontal: 16, marginTop: 16, backgroundColor: "#F9FAFB",
    borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#E5E7EB",
  },
  profileCalendarHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  profileCalendarTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },

  profileCloseBtn: {
    margin: 16, paddingVertical: 15, borderRadius: 16,
    backgroundColor: "#F8FAFC", alignItems: "center",
    borderWidth: 1, borderColor: "#E2E8F0",
  },
  profileCloseBtnText: { fontSize: 14, color: "#64748B", fontFamily: "Ubuntu_700Bold" },

  /* ── Date overlay (inside profile sheet) ── */
  dateOverlayBackdrop: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    justifyContent: "center", alignItems: "center", zIndex: 999,
  },
  dateOverlayCard: {
    backgroundColor: "#fff", borderRadius: 24, padding: 24,
    width: "88%", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
  },
  dateModalIconWrap: {
    width: 68, height: 68, borderRadius: 22, backgroundColor: "#EFF6FF",
    alignItems: "center", justifyContent: "center",
    marginBottom: 14, borderWidth: 1, borderColor: "#DBEAFE",
  },
  dateModalDate: { fontSize: 17, fontFamily: "Ubuntu_700Bold", color: "#0F172A", textAlign: "center", marginBottom: 4 },
  dateModalSub: { fontSize: 12, color: "#94A3B8", fontFamily: "Ubuntu_400Regular", textAlign: "center", marginBottom: 20 },
  dateModalCountBadge: {
    flexDirection: "row", alignItems: "center", alignSelf: "center",
    backgroundColor: "#EFF6FF", borderRadius: 20,
    paddingVertical: 16, paddingHorizontal: 36, gap: 14,
    borderWidth: 1, borderColor: "#BFDBFE", marginBottom: 16,
  },
  dateModalCountNum: { fontSize: 48, fontFamily: "Ubuntu_700Bold", color: "#1a73e8", lineHeight: 52 },
  dateModalCountLabel: { fontSize: 13, fontFamily: "Ubuntu_700Bold", color: "#1D4ED8", lineHeight: 18 },
  dateModalStatus: {
    fontSize: 13, color: "#64748B", fontFamily: "Ubuntu_400Regular",
    textAlign: "center", marginBottom: 24,
  },
  dateModalCloseBtn: {
    width: "50%", backgroundColor: "#e8431a",
    borderRadius: 14, paddingVertical: 14, alignItems: "center",
  },
  dateModalCloseTxt: { color: "#fff", fontSize: 15, fontFamily: "Ubuntu_700Bold", letterSpacing: 0.4 },

  /* ── DBC Modal ── */
  modalSheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 28, paddingBottom: 40, alignItems: "center",
  },
  modalIconWrap: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: "#EFF6FF",
    alignItems: "center", justifyContent: "center", marginBottom: 14,
  },
  modalTitle: { fontSize: 18, fontFamily: "Ubuntu_700Bold", color: "#0F172A", textAlign: "center" },
  modalSub: {
    fontSize: 13, color: "#94A3B8", fontFamily: "Ubuntu_400Regular",
    textAlign: "center", marginTop: 4, marginBottom: 22,
  },
  roleBtn: {
    flexDirection: "row", alignItems: "center", width: "100%",
    borderRadius: 16, padding: 14, marginBottom: 10,
  },
  roleBtnIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: "center", justifyContent: "center", marginRight: 14,
  },
  roleBtnTitle: { fontSize: 15, fontFamily: "Ubuntu_700Bold" },
  roleBtnSub: { fontSize: 12, color: "#64748B", fontFamily: "Ubuntu_400Regular", marginTop: 2 },
  cancelBtn: {
    marginTop: 6, width: "100%", paddingVertical: 14, borderRadius: 14,
    backgroundColor: "#F8FAFC", alignItems: "center",
    borderWidth: 1, borderColor: "#E2E8F0",
  },
  cancelBtnText: { fontSize: 14, color: "#64748B", fontFamily: "Ubuntu_700Bold" },
});