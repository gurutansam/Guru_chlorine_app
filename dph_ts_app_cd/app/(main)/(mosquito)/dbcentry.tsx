import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_URL } from "../../../services/api";

const { width } = Dimensions.get("window");

// ─── Types ────────────────────────────────────────────────────────────────────
type UserInfo = {
  user_id: string;
  username: string;
  block_name: string;
  hud_name?: string;
  district_name?: string;
  hub_name?: string;
  role?: string;
};

type PhotoData = {
  uri: string;
  lat: number;
  long: number;
};

type DbcData = {
  name: string;
  visited: number;
  target: number;
};

// ─── Colors ───────────────────────────────────────────────────────────────────
const Colors = {
  primary: "#3B82F6",
  primaryLight: "#DBEAFE",
  success: "#10B981",
  successLight: "#D1FAE5",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  error: "#EF4444",
  errorLight: "#FEE2E2",

  bg: "#FFFFFF",
  bgSecondary: "#F9FAFB",
  bgTertiary: "#F3F4F6",

  text: "#111827",
  textSecondary: "#6B7280",
  textTertiary: "#9CA3AF",

  border: "#E5E7EB",
  borderLight: "#F3F4F6",
};

// ─── Info Row Component ───────────────────────────────────────────────────────
type InfoRowProps = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  value: string;
  iconColor?: string;
};

const InfoRow: React.FC<InfoRowProps> = ({
  icon,
  label,
  value,
  iconColor = Colors.primary,
}) => (
  <View style={styles.infoRow}>
    <View style={[styles.infoIcon, { backgroundColor: iconColor + "15" }]}>
      <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value || "Not assigned"}
      </Text>
    </View>
  </View>
);

// ─── Read-Only Field Component ────────────────────────────────────────────────
type ReadOnlyFieldProps = {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
};

const ReadOnlyField: React.FC<ReadOnlyFieldProps> = ({ label, value, icon }) => (
  <View style={styles.readOnlySection}>
    <View style={styles.fieldHeader}>
      <MaterialCommunityIcons name={icon} size={18} color={Colors.primary} />
      <Text style={styles.fieldLabel}>{label}</Text>
    </View>
    <View style={styles.readOnlyBox}>
      <Text style={styles.readOnlyText}>{value || "Not Selected"}</Text>
    </View>
  </View>
);

// ─── Photo Card Component ─────────────────────────────────────────────────────
type PhotoCardProps = {
  photo: PhotoData;
  index: number;
  onDelete: () => void;
};

const PhotoCard: React.FC<PhotoCardProps> = ({ photo, index, onDelete }) => (
  <View style={styles.photoCard}>
    <Image source={{ uri: photo.uri }} style={styles.photoImage} />
    <View style={styles.photoOverlay}>
      <View style={styles.photoInfo}>
        <Ionicons name="camera" size={14} color="#fff" />
        <Text style={styles.photoNumber}>#{index + 1}</Text>
      </View>
      <TouchableOpacity
        style={styles.photoDeleteBtn}
        onPress={onDelete}
        activeOpacity={0.7}
      >
        <Ionicons name="close-circle" size={24} color={Colors.error} />
      </TouchableOpacity>
    </View>
  </View>
);

// ─── DBC Row Component ────────────────────────────────────────────────────────
type DbcRowProps = {
  index: number;
  name: string;
  visited: string;
  target: number;
  onNameChange: (text: string) => void;
  onVisitedChange: (text: string) => void;
};

const DbcRow: React.FC<DbcRowProps> = ({
  index,
  name,
  visited,
  target,
  onNameChange,
  onVisitedChange,
}) => (
  <View style={styles.tableRow}>
    <View style={styles.cellWrapper}>
      <Text style={[styles.cellLabel, { fontSize: 11, marginBottom: 4 }]}>DBC Name</Text>
      <TextInput
        style={styles.cellInput}
        value={name}
        onChangeText={onNameChange}
        placeholder={`DBC ${index + 1}`}
        placeholderTextColor={Colors.textTertiary}
      />
    </View>
    <View style={styles.cellWrapper}>
      <Text style={[styles.cellLabel, { fontSize: 11, marginBottom: 4 }]}>Visited</Text>
      <TextInput
        style={styles.cellInput}
        value={visited}
        onChangeText={onVisitedChange}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={Colors.textTertiary}
      />
    </View>
    <View style={styles.cellWrapper}>
      <Text style={[styles.cellLabel, { fontSize: 11, marginBottom: 4 }]}>Target</Text>
      <View style={styles.cellReadOnly}>
        <Text style={styles.cellReadOnlyText}>{target}</Text>
      </View>
    </View>
  </View>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DBCEntryPage(): React.ReactNode {
  const route = useRoute();

  // User Info
  const [userId, setUserId] = useState<string>("");
  const [hiName, setHiName] = useState<string>("");
  const [blockName, setBlockName] = useState<string>("");
  const [districtName, setDistrictName] = useState<string>("");
  const [role, setRole] = useState<string>("");

  // DBC Data
  const [numDbcs, setNumDbcs] = useState<number>(5);
  const [dbcNames, setDbcNames] = useState<string[]>(
    Array(5)
      .fill("")
      .map((_, i) => `DBC ${i + 1}`)
  );
  const [dbcCounts, setDbcCounts] = useState<string[]>(Array(5).fill("0"));
  const [targets, setTargets] = useState<number[]>(Array(5).fill(50));

  // Form Fields
  const [verified, setVerified] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoData[]>([]);

  // States
  const [saving, setSaving] = useState<boolean>(false);
  const [processingPhoto, setProcessingPhoto] = useState<boolean>(false);

  // Navigation Params
  const [selectedPhc, setSelectedPhc] = useState<string>("");
  const [selectedVillage, setSelectedVillage] = useState<string>("");

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(30)).current;

  // Computed Values
  const totalVisited = dbcCounts.reduce(
    (sum, val) => sum + (Number(val) || 0),
    0
  );
  const totalTarget = targets.reduce((sum, val) => sum + val, 0);

  // ── Animations ─────────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(contentAnim, {
        toValue: 0,
        tension: 50,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, [contentAnim, headerAnim]);

  // ── Route Params ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (route.params) {
      const {
        selectedPhc: phc = "",
        selectedVillage: village = "",
        hiName: hi = "",
        blockName: block = "",
        districtName: district = "",
        userId: id = "",
      } = route.params as any;

      setSelectedPhc(phc);
      setSelectedVillage(village);
      if (hi) setHiName(hi);
      if (block) setBlockName(block);
      if (district) setDistrictName(district);
      if (id) setUserId(id);
    }
  }, [route.params]);

  // ── Permissions & Load User ───────────────────────────────────────────────
  useEffect(() => {
    const setupPermissions = async () => {
      await ImagePicker.requestCameraPermissionsAsync();
      await Location.requestForegroundPermissionsAsync();
    };
    setupPermissions();
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const stored = await AsyncStorage.getItem("user_info");
        if (stored) {
          const user: UserInfo = JSON.parse(stored);
          setUserId((prev) => prev || user.user_id || "");
          setHiName((prev) => prev || user.username || "");
          setBlockName((prev) => prev || user.block_name || "");
          setDistrictName(
            (prev) =>
              prev ||
              (user.hud_name || user.district_name || user.hub_name || "")
          );
          setRole(user.role || "");
        }
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleNumDbcsChange = (value: string): void => {
    const count = Number(value) || 0;
    setNumDbcs(count);
    setDbcCounts(Array(count).fill("0"));
    setTargets(Array(count).fill(50));
    setDbcNames(Array(count).fill("").map((_, i) => `DBC ${i + 1}`));
  };

  const handleDbcNameChange = (index: number, text: string): void => {
    const updated = [...dbcNames];
    updated[index] = text;
    setDbcNames(updated);
  };

  const handleDbcCountChange = (index: number, text: string): void => {
    const updated = [...dbcCounts];
    updated[index] = text;
    setDbcCounts(updated);
  };

  const takePhoto = async (): Promise<void> => {
    if (photos.length >= 10) {
      Alert.alert("Limit Reached", "Maximum 10 photos allowed");
      return;
    }

    try {
      setProcessingPhoto(true);

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]) {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        setPhotos((prev) => [
          ...prev,
          {
            uri: result.assets[0].uri,
            lat: loc.coords.latitude,
            long: loc.coords.longitude,
          },
        ]);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to take photo");
      console.error("Camera error:", error);
    } finally {
      setProcessingPhoto(false);
    }
  };

  const removePhoto = (index: number): void => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = (): void => {
    setNumDbcs(5);
    setDbcNames(Array(5).fill("").map((_, i) => `DBC ${i + 1}`));
    setDbcCounts(Array(5).fill("0"));
    setTargets(Array(5).fill(50));
    setVerified(null);
    setPhotos([]);
  };

  const saveData = async (): Promise<void> => {
    Alert.alert(
      "Confirm Save",
      `Save DBC entry with ${totalVisited} houses visited?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: async () => {
            try {
              setSaving(true);

              const photosBase64 = await Promise.all(
                photos.map(async (photo) => {
                  const base64 = await FileSystem.readAsStringAsync(
                    photo.uri,
                    { encoding: "base64" }
                  );
                  return {
                    base64: `data:image/jpeg;base64,${base64}`,
                    latitude: photo.lat,
                    longitude: photo.long,
                  };
                })
              );

              const payload = {
                hi_name: hiName || null,
                user_id: userId || null,
                block_name: blockName || null,
                district_name: districtName || null,
                phc_name: selectedPhc || null,
                village_name: selectedVillage || null,
                num_dbcs: numDbcs,
                role,
                dbc_data: dbcNames.map((name, i) => ({
                  name: name || `DBC ${i + 1}`,
                  visited: Number(dbcCounts[i] || 0),
                  target: targets[i],
                })),
                total_visited: totalVisited,
                total_target: totalTarget,
                verified,
                timestamp: new Date().toISOString(),
                photos: photosBase64.length > 0 ? photosBase64 : null,
              };

              console.log("DBC Entry Payload:", JSON.stringify(payload, null, 2));

              const specialRoles = [
                "special_user",
                "DHO",
                "chl_admin",
                "mos_admin",
                "block_user",
              ];
              const apiUrl = specialRoles.includes(role)
                ? `${BASE_URL}/dashboard/dbc-special-data-entry`
                : `${BASE_URL}/dashboard/hi-monitoring`;

              const res = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });

              const text = await res.text();
              let result: any;
              try {
                result = JSON.parse(text);
              } catch {
                result = {};
              }

              if (res.ok) {
                Alert.alert(
                  "Success!",
                  result?.message || "Data saved successfully!",
                  [{ text: "OK", onPress: () => resetForm() }]
                );
              } else {
                Alert.alert("Error", result?.message || "Failed to save data");
              }
            } catch (error) {
              console.error("Save error:", error);
              Alert.alert("Error", "Something went wrong. Please try again.");
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Header ────────────────────────────────────────────────────── */}
          <Animated.View
            style={[styles.header, { opacity: headerAnim }]}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerIcon}>
                <MaterialCommunityIcons
                  name="database-plus-outline"
                  size={32}
                  color={Colors.primary}
                />
              </View>
              <Text style={styles.headerTitle}>DBC Entry Form</Text>
              <Text style={styles.headerSubtitle}>
                Dengue Breeding Checker Data Collection
              </Text>
            </View>

            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(
                      ((totalVisited / totalTarget) * 100) || 0,
                      100
                    )}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {totalVisited} / {totalTarget} houses visited
            </Text>
          </Animated.View>

          {/* ── Main Content ──────────────────────────────────────────────── */}
          <Animated.View
            style={[
              styles.mainContent,
              {
                transform: [{ translateY: contentAnim }],
                opacity: headerAnim,
              },
            ]}
          >
            {/* Officer Details Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIcon}>
                  <MaterialCommunityIcons
                    name="account-badge-outline"
                    size={18}
                    color={Colors.primary}
                  />
                </View>
                <Text style={styles.sectionTitle}>Officer Details</Text>
              </View>

              <View style={styles.infoGrid}>
                <InfoRow
                  icon="account-circle-outline"
                  label="HI Name"
                  value={hiName}
                  iconColor={Colors.primary}
                />
                <InfoRow
                  icon="office-building-outline"
                  label="Block"
                  value={blockName}
                  iconColor={Colors.success}
                />
                <InfoRow
                  icon="map-outline"
                  label="District"
                  value={districtName}
                  iconColor={Colors.warning}
                />
              </View>
            </View>

            <View style={styles.divider} />

            {/* Location Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIcon}>
                  <MaterialCommunityIcons
                    name="map-search-outline"
                    size={18}
                    color={Colors.primary}
                  />
                </View>
                <Text style={styles.sectionTitle}>Location</Text>
              </View>

              <ReadOnlyField
                label="PHC"
                value={selectedPhc}
                icon="hospital-building"
              />
              <ReadOnlyField
                label="Village / HSC"
                value={selectedVillage}
                icon="home-city-outline"
              />
            </View>

            <View style={styles.divider} />

            {/* DBC Configuration */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIcon}>
                  <MaterialCommunityIcons
                    name="cog-outline"
                    size={18}
                    color={Colors.primary}
                  />
                </View>
                <Text style={styles.sectionTitle}>Configuration</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Number of DBCs</Text>
                <View style={styles.numericInput}>
                  <TextInput
                    style={styles.numericField}
                    keyboardType="numeric"
                    value={String(numDbcs)}
                    onChangeText={handleNumDbcsChange}
                    placeholder="5"
                  />
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            {/* DBC Data Table */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIcon}>
                  <MaterialCommunityIcons
                    name="home"
                    size={18}
                    color={Colors.primary}
                  />
                </View>
                <Text style={styles.sectionTitle}>Houses Visited</Text>
              </View>

              {Array.from({ length: numDbcs }).map((_, i) => (
                <DbcRow
                  key={i}
                  index={i}
                  name={dbcNames[i]}
                  visited={dbcCounts[i]}
                  target={targets[i]}
                  onNameChange={(text) => handleDbcNameChange(i, text)}
                  onVisitedChange={(text) => handleDbcCountChange(i, text)}
                />
              ))}

              <View style={styles.totalRow}>
                <View style={styles.totalCell}>
                  <Text style={styles.totalLabel}>TOTAL</Text>
                </View>
                <View style={styles.totalCell}>
                  <Text style={styles.totalValue}>{totalVisited}</Text>
                </View>
                <View style={styles.totalCell}>
                  <Text style={styles.totalValue}>{totalTarget}</Text>
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Verification Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIcon}>
                  <MaterialCommunityIcons
                    name="check-circle-outline"
                    size={18}
                    color={Colors.success}
                  />
                </View>
                <Text style={styles.sectionTitle}>Verification</Text>
              </View>

              <Text style={styles.inputLabel}>Verified by me</Text>
              <View style={styles.verificationButtons}>
                {["Yes", "No"].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.verifyButton,
                      verified === option && styles.verifyButtonActive,
                    ]}
                    onPress={() => setVerified(option)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={
                        verified === option
                          ? "radio-button-on"
                          : "radio-button-off"
                      }
                      size={20}
                      color={
                        verified === option ? Colors.primary : Colors.textTertiary
                      }
                    />
                    <Text
                      style={[
                        styles.verifyButtonText,
                        verified === option && styles.verifyButtonTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Photos Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIcon}>
                  <MaterialCommunityIcons
                    name="camera-outline"
                    size={18}
                    color={Colors.primary}
                  />
                </View>
                <Text style={styles.sectionTitle}>Supervisory Photos</Text>
                <Text style={styles.photoCount}>
                  {photos.length}/10
                </Text>
              </View>

              {photos.length > 0 && (
                <View style={styles.photoGrid}>
                  {photos.map((photo, index) => (
                    <PhotoCard
                      key={index}
                      photo={photo}
                      index={index}
                      onDelete={() => removePhoto(index)}
                    />
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={styles.photoButton}
                onPress={takePhoto}
                activeOpacity={0.8}
                disabled={processingPhoto}
              >
                <Ionicons
                  name="camera"
                  size={22}
                  color={Colors.primary}
                />
                <Text style={styles.photoButtonText}>Capture Photo</Text>
                <Text style={styles.photoButtonSubtext}>
                  {photos.length < 10
                    ? `${10 - photos.length} remaining`
                    : "Maximum reached"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.saveButton, styles.saveButtonPrimary]}
                onPress={saveData}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={18} color="#fff" />
                    <Text style={styles.saveButtonText}>Save Entry</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, styles.resetButtonSecondary]}
                onPress={resetForm}
                disabled={saving}
                activeOpacity={0.85}
              >
                <Ionicons name="refresh-outline" size={18} color={Colors.textSecondary} />
                <Text style={styles.resetButtonText}>Reset Form</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Loading Overlay */}
      {processingPhoto && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Processing photo...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },

  // ── Header ──
  header: {
    backgroundColor: Colors.bg,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerContent: {
    alignItems: "center",
    marginBottom: 16,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
  },

  progressBar: {
    height: 6,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 12,
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.success,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
  },

  // ── Main Content ──
  mainContent: {
    marginHorizontal: 16,
    marginTop: 20,
  },

  // ── Section ──
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    flex: 1,
  },
  photoCount: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
    backgroundColor: Colors.bgSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 20,
    marginHorizontal: -16,
  },

  // ── Info Grid ──
  infoGrid: {
    gap: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: "700",
  },

  // ── Read Only Field ──
  readOnlySection: {
    marginBottom: 12,
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
  },
  readOnlyBox: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  readOnlyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: "italic",
  },

  // ── Input ──
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 8,
  },
  numericInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  numericField: {
    flex: 1,
    height: 44,
    paddingHorizontal: 14,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
  },

  // ── Table ──
  tableRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  cellWrapper: {
    flex: 1,
  },
  cellLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  cellInput: {
    height: 44,
    paddingHorizontal: 10,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    fontSize: 14,
    color: Colors.text,
    fontWeight: "500",
  },
  cellReadOnly: {
    height: 44,
    paddingHorizontal: 10,
    backgroundColor: Colors.bgTertiary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cellReadOnlyText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
  },

  totalRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: Colors.successLight,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.success,
  },
  totalCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.success,
    textTransform: "uppercase",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.success,
  },

  // ── Verification ──
  verificationButtons: {
    flexDirection: "row",
    gap: 10,
  },
  verifyButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
  },
  verifyButtonActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  verifyButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  verifyButtonTextActive: {
    color: Colors.primary,
  },

  // ── Photos ──
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  photoCard: {
    width: "48%",
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Colors.bgSecondary,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  photoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "space-between",
    padding: 8,
  },
  photoInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  photoNumber: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  photoDeleteBtn: {
    alignSelf: "flex-end",
    backgroundColor: Colors.errorLight,
    borderRadius: 12,
    padding: 2,
  },

  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.primaryLight,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 12,
    borderStyle: "dashed",
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primary,
  },
  photoButtonSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    position: "absolute",
    right: 12,
  },

  // ── Actions ──
  actionButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  saveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  saveButtonPrimary: {
    backgroundColor: Colors.primary,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  resetButtonSecondary: {
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textSecondary,
  },

  // ── Loading ──
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  loadingBox: {
    backgroundColor: Colors.bg,
    paddingHorizontal: 24,
    paddingVertical: 32,
    borderRadius: 16,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
});