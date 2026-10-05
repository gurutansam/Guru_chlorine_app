import { AntDesign, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRoute } from "@react-navigation/native";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

export default function DBCEntryPage() {
  const route = useRoute();
  const [role, setRole] = useState("");

  const [userId, setUserId] = useState("");
  const [hiName, setHiName] = useState("");
  const [blockName, setBlockName] = useState("");
  const [districtName, setDistrictName] = useState("");

  const [numDbcs, setNumDbcs] = useState(5);
  const [dbcNames, setDbcNames] = useState(Array(5).fill("").map((_, i) => `DBC ${i + 1}`));
  const [dbcCounts, setDbcCounts] = useState(Array(5).fill(0));
  const [targets, setTargets] = useState(Array(5).fill(50));
  const [verified, setVerified] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);

  // Received from previous screen
  const [selectedPhc, setSelectedPhc] = useState("");
  const [selectedVillage, setSelectedVillage] = useState("");

  const totalVisited = dbcCounts.reduce((a, b) => a + Number(b || 0), 0);
  const totalTarget = targets.reduce((a, b) => a + Number(b || 0), 0);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = themedStyles(isDark);

  // Get passed data from HiMonitoringForm
  useEffect(() => {
    if (route.params) {
      const {
        selectedPhc = "",
        selectedVillage = "",
        hiName: passedHiName,
        blockName: passedBlockName,
        districtName: passedDistrictName,
        userId: passedUserId,
      } = route.params;

      setSelectedPhc(selectedPhc);
      setSelectedVillage(selectedVillage);

      if (passedHiName) setHiName(passedHiName);
      if (passedBlockName) setBlockName(passedBlockName);
      if (passedDistrictName) setDistrictName(passedDistrictName);
      if (passedUserId) setUserId(passedUserId);
    }
  }, [route.params]);

  useEffect(() => {
    (async () => {
      await ImagePicker.requestCameraPermissionsAsync();
      await Location.requestForegroundPermissionsAsync();
    })();
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const stored = await AsyncStorage.getItem("user_info");

        if (stored) {
          const user = JSON.parse(stored);
          setUserId(prev => prev || user.user_id || "");
          setHiName(prev => prev || user.username || "");
          setBlockName(prev => prev || user.block_name || "");
          setDistrictName(prev => prev || (user.hud_name || user.district_name || user.hub_name || ""));
          setRole(user.role || "");

        }
      } catch (e) {
        console.log("AsyncStorage error:", e);
      }
    };
    loadUser();
  }, []);

  const takePhoto = async () => {
    if (photos.length >= 10) {
      Alert.alert("Limit reached", "Maximum 10 photos allowed");
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]) {
        setProcessingPhoto(true);
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setPhotos(prev => [...prev, {
          uri: result.assets[0].uri,
          lat: loc.coords.latitude,
          long: loc.coords.longitude
        }]);
      }
    } catch (e) {
      Alert.alert("Error", "Failed to take photo");
    } finally {
      setProcessingPhoto(false);
    }
  };
  const saveData = async () => {
    Alert.alert("Confirm Save", "Save this DBC entry?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Save",
        onPress: async () => {
          try {
            setSaving(true);

            const photosBase64 = await Promise.all(
              photos.map(async (p) => {
                const base64 = await FileSystem.readAsStringAsync(p.uri, {
                  encoding: "base64",
                });
                return {
                  base64: `data:image/jpeg;base64,${base64}`,
                  latitude: p.lat,
                  longitude: p.long,
                };
              })
            );

            const payload = {
              hi_name: hiName || null,
              user_id: userId || null,
              block_name: blockName || null,
              district_name: districtName || null,
              phc_name: selectedPhc || null,           // null if not selected
              village_name: selectedVillage || null,   // null if not selected
              num_dbcs: numDbcs,
              role,
              dbc_data: dbcCounts.map((count, i) => ({
                name: dbcNames[i] || `DBC ${i + 1}`,
                visited: Number(count || 0),
                target: targets[i],
              })),
              total_visited: totalVisited,
              total_target: totalTarget,
              verified,
              timestamp: new Date().toISOString(),
              photos: photosBase64.length > 0 ? photosBase64 : null,
            };

            let apiUrl = "http://192.168.1.145:3000/dashboard/hi-monitoring";

            if (
              role === "special_user" ||
              role === "DHO" ||
              role === "chl_admin" ||
              role === "mos_admin" ||
              role === "block_user"
            ) {
              apiUrl = "http://192.168.1.145:3000/dashboard/dbc-special-data-entry";
            }

            const res = await fetch(apiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });


            const text = await res.text();
            let result;
            try {
              result = JSON.parse(text);
            } catch { }

            if (res.ok) {
              Alert.alert("Success!", result?.message || "Data saved successfully!", [
                { text: "OK", onPress: () => resetForm() } // Reset on OK
              ]);
            } else {
              Alert.alert("Error", result?.message || "Failed to save data");
            }
          } catch (e) {
            console.log("Save error:", e);
            Alert.alert("Error", "Something went wrong. Please try again.");
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  // Add this function inside your component (below saveData)
  const resetForm = () => {
    setNumDbcs(5);
    setDbcNames(Array(5).fill("").map((_, i) => `DBC ${i + 1}`));
    setDbcCounts(Array(5).fill(0));
    setTargets(Array(5).fill(50));
    setVerified(null);
    setPhotos([]);
    // Note: selectedPhc & selectedVillage stay (user might want to enter again in same area)
    // If you want to clear them too, uncomment below:
    // setSelectedPhc("");
    // setSelectedVillage("");
  };

  const InfoCardSingle = () => (
    <View style={theme.singleCard}>
      <View style={theme.cardRow}>
        <AntDesign name="user" size={22} color={isDark ? "#60a5fa" : "#3b82f6"} style={theme.icon} />
        <View>
          <Text style={theme.infoLabel}>HI Name</Text>
          <Text style={theme.infoValue}>{hiName || "—"}</Text>
        </View>
      </View>

      {blockName ? (
        <View style={theme.cardRow}>
          <MaterialIcons name="location-city" size={22} color={isDark ? "#60a5fa" : "#3b82f6"} style={theme.icon} />
          <View>
            <Text style={theme.infoLabel}>Block Name</Text>
            <Text style={theme.infoValue}>{blockName}</Text>
          </View>
        </View>
      ) : null}

      <View style={theme.cardRow}>
        <MaterialIcons name="map" size={22} color={isDark ? "#60a5fa" : "#3b82f6"} style={theme.icon} />
        <View>
          <Text style={theme.infoLabel}>District</Text>
          <Text style={theme.infoValue}>{districtName || "—"}</Text>
        </View>
      </View>

      {/* PHC - Read Only */}
      <View style={theme.cardRow}>
        <MaterialIcons name="local-hospital" size={22} color={isDark ? "#60a5fa" : "#3b82f6"} style={theme.icon} />
        <View style={{ flex: 1 }}>
          <Text style={theme.infoLabel}>PHC</Text>
          <View style={theme.readOnlyBox}>
            <Text style={theme.readOnlyText}>
              {selectedPhc || "Not Selected"}
            </Text>
          </View>
        </View>
      </View>

      {/* Village - Read Only */}
      <View style={theme.cardRow}>
        <MaterialIcons name="home" size={22} color={isDark ? "#60a5fa" : "#3b82f6"} style={theme.icon} />
        <View style={{ flex: 1 }}>
          <Text style={theme.infoLabel}>Village / HSC</Text>
          <View style={theme.readOnlyBox}>
            <Text style={theme.readOnlyText}>
              {selectedVillage || "Not Selected"}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={theme.container} keyboardShouldPersistTaps="handled">
        <Text style={theme.header}>HI Monitoring – DBC Entry</Text>
        <InfoCardSingle />

        <View style={theme.inputRow}>
          <Text style={theme.label}>No. of DBCs:</Text>
          <TextInput
            style={theme.inputBox}
            keyboardType="numeric"
            value={String(numDbcs)}
            onChangeText={(val) => {
              const count = Number(val) || 0;
              setNumDbcs(count);
              setDbcCounts(Array(count).fill(0));
              setTargets(Array(count).fill(50));
              setDbcNames(Array(count).fill("").map((_, i) => `DBC ${i + 1}`));
            }}
          />
        </View>

        <Text style={[theme.label, { marginBottom: 10 }]}>Houses visited by DBC:</Text>
        <View style={[theme.tableRow, theme.tableHeader]}>
          <Text style={[theme.cell, { flex: 1 }]}>Name</Text>
          <Text style={[theme.cell, { flex: 1 }]}>Visited</Text>
          <Text style={[theme.cell, { flex: 1 }]}>Target</Text>
        </View>

        {Array.from({ length: numDbcs }).map((_, i) => (
          <View style={theme.tableRow} key={i}>
            <TextInput
              style={[theme.cellInput, { flex: 1 }]}
              value={dbcNames[i]}
              onChangeText={(t) => {
                const n = [...dbcNames];
                n[i] = t;
                setDbcNames(n);
              }}
            />
            <TextInput
              style={[theme.cellInput, { flex: 1 }]}
              keyboardType="numeric"
              value={String(dbcCounts[i])}
              onChangeText={(t) => {
                const n = [...dbcCounts];
                n[i] = t;
                setDbcCounts(n);
              }}
            />
            <TextInput
              style={[theme.cellInput, { flex: 1, backgroundColor: isDark ? "#1e293b" : "#e5e7eb" }]}
              editable={false}
              value={String(targets[i])}
            />
          </View>
        ))}

        <View style={[theme.tableRow, theme.totalRow]}>
          <Text style={[theme.cell, { flex: 1, fontWeight: "700" }]}>Total</Text>
          <Text style={[theme.cell, { flex: 1 }]}>{totalVisited}</Text>
          <Text style={[theme.cell, { flex: 1 }]}>{totalTarget}</Text>
        </View>

        <View style={theme.verifiedSection}>
          <Text style={theme.label}>Verified by me:</Text>
          <View style={theme.buttonRow}>
            <TouchableOpacity
              style={[theme.verifyButton, verified === "Yes" && theme.selectedButton]}
              onPress={() => setVerified("Yes")}
            >
              <Text style={{ color: verified === "Yes" ? "#fff" : isDark ? "#fff" : "#000" }}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[theme.verifyButton, verified === "No" && theme.selectedButton]}
              onPress={() => setVerified("No")}
            >
              <Text style={{ color: verified === "No" ? "#fff" : isDark ? "#fff" : "#000" }}>No</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={theme.photoSection}>
          <Text style={theme.label}>Supervisory Photos (max 10)</Text>
          <View style={theme.photoGrid}>
            {photos.map((p, i) => (
              <View key={i} style={theme.photoWrapper}>
                <Image source={{ uri: p.uri }} style={theme.photo} />
                <TouchableOpacity
                  style={theme.cancelButton}
                  onPress={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                >
                  <MaterialIcons name="cancel" size={24} color="#ef4444" />


                </TouchableOpacity>
              </View>
            ))}
          </View>
          <TouchableOpacity style={theme.photoButton} onPress={takePhoto}>
            <Text style={{ fontWeight: "600", color: isDark ? "#fff" : "#000" }}>Take Photo</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={theme.saveButton} onPress={saveData}>
          <Text style={theme.saveText}>Save Entry</Text>
        </TouchableOpacity>

        {(saving || processingPhoto) && (
          <View style={[StyleSheet.absoluteFill, theme.loaderOverlay]}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={theme.loaderText}>
              {saving ? "Saving..." : "Processing photo..."}
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const themedStyles = (isDark) =>
  StyleSheet.create({
    container: { padding: width * 0.04, paddingTop: width * 0.08, backgroundColor: isDark ? "#000" : "#f9fafb" },
    header: { fontSize: width * 0.06, fontWeight: "bold", marginBottom: width * 0.05, textAlign: "center", color: isDark ? "#fff" : "#000" },
    singleCard: {
      backgroundColor: isDark ? "#1e1e1e" : "#fff",
      borderRadius: 12,
      padding: width * 0.04,
      marginBottom: width * 0.06,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    cardRow: { flexDirection: "row", alignItems: "center", marginBottom: width * 0.03 },
    icon: { marginRight: 10 },
    infoLabel: { fontSize: width * 0.035, fontWeight: "600", color: isDark ? "#bbb" : "#374151" },
    infoValue: { fontSize: width * 0.04, fontWeight: "bold", color: isDark ? "#fff" : "#111827", marginTop: 2 },
    inputRow: { flexDirection: "row", alignItems: "center", marginBottom: width * 0.04 },
    inputBox: {
      borderWidth: 1,
      borderColor: "#cbd5e1",
      borderRadius: 8,
      padding: width * 0.025,
      width: width * 0.2,
      marginLeft: width * 0.03,
      textAlign: "center",
      color: isDark ? "#fff" : "#000",
      backgroundColor: isDark ? "#1e293b" : "#fff",
    },
    label: { marginBottom: 6, fontWeight: "600", color: isDark ? "#fff" : "#374151", fontSize: width * 0.035 },
    tableRow: { flexDirection: "row", marginBottom: width * 0.02, alignItems: "center" },
    tableHeader: { backgroundColor: isDark ? "#334155" : "#e2e8f0", padding: width * 0.03, borderRadius: 6 },
    totalRow: { backgroundColor: isDark ? "#064e3b" : "#d1fae5", padding: width * 0.03, borderRadius: 6 },
    cell: { textAlign: "center", fontSize: width * 0.035, color: isDark ? "#fff" : "#000" },
    cellInput: {
      borderWidth: 1,
      borderColor: "#475569",
      borderRadius: 6,
      padding: width * 0.02,
      textAlign: "center",
      marginHorizontal: 2,
      fontSize: width * 0.035,
      color: isDark ? "#fff" : "#000",
      backgroundColor: isDark ? "#1e293b" : "#fff",
    },
    verifiedSection: { marginVertical: width * 0.05 },
    buttonRow: { flexDirection: "row", gap: width * 0.03, justifyContent: "space-around", marginVertical: 10 },
    verifyButton: {
      flex: 1,
      paddingVertical: width * 0.035,
      backgroundColor: isDark ? "#334155" : "#e2e8f0",
      borderRadius: 10,
      alignItems: "center",
    },
    selectedButton: { backgroundColor: "#3b82f6" },
    photoSection: { marginBottom: width * 0.05 },
    photoGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: width * 0.03 },
    photoWrapper: { position: "relative", margin: width * 0.01 },
    photo: { width: width * 0.2, height: width * 0.2, borderRadius: 8 },
    cancelButton: { position: "absolute", top: -6, right: -6, backgroundColor: "#fff", borderRadius: 10 },
    photoButton: {
      backgroundColor: "#fbbf24",
      paddingVertical: width * 0.035,
      borderRadius: 10,
      alignItems: "center",
    },
    saveButton: {
      backgroundColor: "#10b981",
      paddingVertical: width * 0.03,
      borderRadius: 12,
      alignItems: "center",
      marginBottom: width * 0.1,
      width: "100%",
    },
    saveText: { color: "#fff", fontWeight: "bold", fontSize: width * 0.045 },
    loaderOverlay: {
      backgroundColor: isDark ? "#000000aa" : "#ffffffaa",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
    },
    loaderText: { color: "#3b82f6", marginTop: 15, fontSize: 18, fontWeight: "bold" },

    readOnlyBox: {
      padding: 14,
      borderRadius: 8,
      backgroundColor: isDark ? "#1e293b" : "#f3f4f6",
      borderWidth: 1,
      borderColor: isDark ? "#334155" : "#d1d5db",
      marginTop: 6,
    },
    readOnlyText: {
      fontSize: 15,
      color: isDark ? "#94a3b8" : "#4b5563",
      fontStyle: "italic",
    },
  });