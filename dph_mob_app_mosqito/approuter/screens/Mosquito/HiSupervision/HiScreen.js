import { AntDesign, Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

export default function HiMonitoringForm() {
  const [userId, setUserId] = useState("");
  const [hiName, setHiName] = useState("");
  const [blockName, setBlockName] = useState("");
  const [districtName, setDistrictName] = useState("");

  const [phcList, setPhcList] = useState([]);
  const [villageList, setVillageList] = useState([]);
  const [filteredPhcList, setFilteredPhcList] = useState([]);
  const [filteredVillageList, setFilteredVillageList] = useState([]);

  const [loadingPhc, setLoadingPhc] = useState(true);
  const [loadingVillage, setLoadingVillage] = useState(false);

  const [showPhc, setShowPhc] = useState(false);
  const [showVillage, setShowVillage] = useState(false);
  const [selectedPhc, setSelectedPhc] = useState("");
  const [selectedVillage, setSelectedVillage] = useState("");

  const [showEntryButtons, setShowEntryButtons] = useState(false);

  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = themedStyles(isDark);

  // Load user info from AsyncStorage
  const fetchHISettings = async () => {
    try {
      const storedUser = await AsyncStorage.getItem("user_info");
      if (storedUser) {
        const user = JSON.parse(storedUser);
        setUserId(user.user_id || "");
        setHiName(user.username || "");
        setBlockName(user.block_name || "");
        setDistrictName(
          user.hud_name || user.district_name || user.hub_name || ""
        );
      }
    } catch (error) {
      console.log("Error fetching HI settings:", error);
    }
  };

  // Load user info on mount
  useEffect(() => {
    fetchHISettings();
  }, []);

  // Fetch PHC & Village data
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        setLoadingPhc(true);
        const [phcRes, villageRes] = await Promise.all([
          fetch("http://192.168.1.145:3000/dashboard/phc"),
          fetch("http://192.168.1.145:3000/dashboard/village"),
        ]);

        const phcData = await phcRes.json();
        const villageData = await villageRes.json();

        setPhcList(phcData.data || phcData || []);
        setVillageList(villageData.data || villageData || []);
      } catch (err) {
        console.log("Dropdown fetch error", err);
        Alert.alert("Error", "Failed to load location data. Please try again.");
      } finally {
        setLoadingPhc(false);
      }
    };

    fetchDropdownData();
  }, []);

  // Filter PHCs by block
  useEffect(() => {
    if (blockName && phcList.length > 0) {
      const filtered = phcList.filter(
        (p) => p.block_name?.toLowerCase() === blockName.toLowerCase()
      );
      setFilteredPhcList(filtered);
    } else {
      setFilteredPhcList([]);
    }
  }, [blockName, phcList]);

  // Filter villages when PHC changes
  useEffect(() => {
    if (selectedPhc && villageList.length > 0) {
      setLoadingVillage(true);
      const timer = setTimeout(() => {
        const filtered = villageList.filter(
          (v) => v.phc_name?.toLowerCase() === selectedPhc.toLowerCase()
        );
        setFilteredVillageList(filtered);
        setLoadingVillage(false);
      }, 300);

      return () => clearTimeout(timer);
    } else {
      setFilteredVillageList([]);
      setLoadingVillage(false);
    }
  }, [selectedPhc, villageList]);

  // Show entry buttons when basic info is loaded
  useEffect(() => {
    if (hiName || blockName) {
      setShowEntryButtons(true);
    }
  }, [hiName, blockName]);

  // Reset functions
  const resetPhc = () => {
    setSelectedPhc("");
    setSelectedVillage("");
    setShowPhc(false);
  };

  const resetVillage = () => {
    setSelectedVillage("");
    setShowVillage(false);
  };

  const resetAll = () => {
    Alert.alert("Reset Selections", "Clear all selected locations?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          setSelectedPhc("");
          setSelectedVillage("");
          setShowPhc(false);
          setShowVillage(false);
        },
      },
    ]);
  };

  const InfoCardSingle = () => (
    <View style={theme.singleCard}>
      {/* HI Name */}
      <View style={theme.cardRow}>
        <AntDesign name="user" size={22} color={isDark ? "#60a5fa" : "#3b82f6"} style={theme.icon} />
        <View>
          <Text style={theme.infoLabel}>HI Name</Text>
          <Text style={theme.infoValue}>{hiName || "Loading..."}</Text>
        </View>
      </View>

      {blockName && (
        <View style={theme.cardRow}>
          <MaterialIcons name="location-city" size={22} color={isDark ? "#60a5fa" : "#3b82f6"} style={theme.icon} />
          <View>
            <Text style={theme.infoLabel}>Block Name</Text>
            <Text style={theme.infoValue}>{blockName}</Text>
          </View>
        </View>
      )}

      <View style={theme.cardRow}>
        <MaterialIcons name="map" size={22} color={isDark ? "#60a5fa" : "#3b82f6"} style={theme.icon} />
        <View>
          <Text style={theme.infoLabel}>District</Text>
          <Text style={theme.infoValue}>{districtName || "N/A"}</Text>
        </View>
      </View>

      {/* PHC Dropdown */}
      <View style={theme.cardRow}>
        <MaterialIcons name="local-hospital" size={22} color={isDark ? "#60a5fa" : "#3b82f6"} style={theme.icon} />
        <View style={{ flex: 1 }}>
          <Text style={theme.infoLabel}>PHC (Optional)</Text>

          {loadingPhc ? (
            <View style={theme.loadingBox}>
              <ActivityIndicator size="small" color={isDark ? "#60a5fa" : "#3b82f6"} />
              <Text style={theme.loadingText}>Loading PHCs...</Text>
            </View>
          ) : selectedPhc ? (
            <View style={theme.selectedContainer}>
              <Text style={theme.selectedText}>{selectedPhc}</Text>
              <TouchableOpacity onPress={resetPhc} style={theme.resetButton}>
                <Ionicons name="close-circle" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={theme.dropDownBox} onPress={() => setShowPhc(!showPhc)}>
              <Text style={theme.dropText}>
                {filteredPhcList.length === 0 ? "No PHC available" : "Select PHC"}
              </Text>
            </TouchableOpacity>
          )}

          {showPhc && !selectedPhc && !loadingPhc && (
            <View style={theme.dropList}>
              {filteredPhcList.length > 0 ? (
                filteredPhcList.map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      setSelectedPhc(item.phc_name);
                      setSelectedVillage("");
                      setShowPhc(false);
                    }}
                  >
                    <Text style={theme.dropItem}>{item.phc_name}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={[theme.dropItem, { color: "#ef4444", textAlign: "center", padding: 12 }]}>
                  No PHC found for this block
                </Text>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Village Dropdown - Only when PHC selected */}
      {selectedPhc && (
        <View style={theme.cardRow}>
          <MaterialIcons name="home" size={22} color={isDark ? "#60a5fa" : "#3b82f6"} style={theme.icon} />
          <View style={{ flex: 1 }}>
            <Text style={theme.infoLabel}>Village / HSC (Optional)</Text>

            {loadingVillage ? (
              <View style={theme.loadingBox}>
                <ActivityIndicator size="small" color={isDark ? "#10b981" : "#059669"} />
                <Text style={theme.loadingText}>Loading villages...</Text>
              </View>
            ) : selectedVillage ? (
              <View style={theme.selectedContainer}>
                <Text style={theme.selectedText}>{selectedVillage}</Text>
                <TouchableOpacity onPress={resetVillage} style={theme.resetButton}>
                  <Ionicons name="close-circle" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={theme.dropDownBox} onPress={() => setShowVillage(!showVillage)}>
                <Text style={theme.dropText}>Select Village</Text>
              </TouchableOpacity>
            )}

            {showVillage && !loadingVillage && (
              <View style={theme.dropList}>
                {filteredVillageList.length > 0 ? (
                  filteredVillageList.map((item, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => {
                        setSelectedVillage(item.village_name);
                        setShowVillage(false);
                      }}
                    >
                      <Text style={theme.dropItem}>{item.village_name}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={[theme.dropItem, { color: "#ef4444", textAlign: "center", padding: 12 }]}>
                    No villages found
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Hint */}
      <View style={{ marginTop: 12, paddingHorizontal: 8 }}>
        <Text style={{ fontSize: 13, color: isDark ? "#94a3b8" : "#64748b", textAlign: "center", fontStyle: "italic" }}>
          {selectedPhc
            ? "Village selection is optional."
            : "PHC and Village are optional. You can proceed without selecting them."}
        </Text>
      </View>

      {/* Clear All */}
      {(selectedPhc || selectedVillage) && (
        <View style={{ marginTop: 16, alignItems: "center" }}>
          <TouchableOpacity onPress={resetAll} style={theme.resetAllButton}>
            <Text style={theme.resetAllText}>Clear All Selections</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Entry Buttons */}
      {showEntryButtons && (
        <View style={{ marginTop: 28, flexDirection: "row", justifyContent: "space-around", gap: 12 }}>
          <TouchableOpacity
            style={theme.entryButtonBlue}
            onPress={() =>
              navigation.navigate("DBCEntryPage", {
                selectedPhc: selectedPhc || "",
                selectedVillage: selectedVillage || "",
                hiName,
                blockName,
                districtName,
                userId,
              })
            }
          >
            <Text style={theme.entryButtonText}>DBC Entry</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={theme.entryButtonGreen}
            onPress={() =>
              navigation.navigate("LarvaEntryPage", {
                selectedPhc: selectedPhc || "",
                selectedVillage: selectedVillage || "",
                hiName,
                blockName,
                districtName,
                userId,
              })
            }
          >
            <Text style={theme.entryButtonText}>Larva Entry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={theme.container} keyboardShouldPersistTaps="handled">
        <Text style={theme.header}>HI Monitoring Dashboard</Text>
        <InfoCardSingle />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Styles remain exactly the same as before
const themedStyles = (isDark) =>
  StyleSheet.create({
    container: {
      padding: width * 0.04,
      paddingTop: width * 0.08,
      backgroundColor: isDark ? "#000" : "#f9fafb",
      flexGrow: 1,
    },
    header: {
      fontSize: width * 0.06,
      fontWeight: "bold",
      marginBottom: width * 0.05,
      textAlign: "center",
      color: isDark ? "#fff" : "#000",
    },
    singleCard: {
      backgroundColor: isDark ? "#1e1e1e" : "#fff",
      borderRadius: 14,
      padding: width * 0.05,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 5,
    },
    cardRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: width * 0.04,
    },
    icon: { marginRight: 12 },
    infoLabel: {
      fontSize: width * 0.038,
      fontWeight: "600",
      color: isDark ? "#bbb" : "#374151",
    },
    infoValue: {
      fontSize: width * 0.042,
      fontWeight: "bold",
      color: isDark ? "#fff" : "#111827",
      marginTop: 4,
    },
    dropDownBox: {
      marginTop: 6,
      padding: 14,
      borderWidth: 1.5,
      borderRadius: 10,
      backgroundColor: isDark ? "#1e293b" : "#f8fafc",
      borderColor: isDark ? "#334155" : "#cbd5e1",
      justifyContent: "center",
    },
    loadingBox: {
      marginTop: 6,
      padding: 14,
      borderRadius: 10,
      backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
      borderWidth: 1.5,
      borderColor: isDark ? "#334155" : "#e2e8f0",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    loadingText: {
      fontSize: 14,
      color: isDark ? "#94a3b8" : "#64748b",
      fontStyle: "italic",
    },
    selectedContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 4,
    },
    selectedText: {
      fontSize: 15,
      color: isDark ? "#60a5fa" : "#3b82f6",
      fontWeight: "600",
      flex: 1,
    },
    resetButton: { padding: 4 },
    dropText: {
      fontSize: 15,
      color: isDark ? "#e2e8f0" : "#1e293b",
    },
    dropList: {
      marginTop: 6,
      borderWidth: 1,
      borderRadius: 10,
      backgroundColor: isDark ? "#0f172a" : "#ffffff",
      borderColor: isDark ? "#334155" : "#e2e8f0",
      maxHeight: 220,
      elevation: 4,
    },
    dropItem: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      fontSize: 14.5,
      borderBottomWidth: 0.5,
      borderColor: "#47556950",
      color: isDark ? "#e2e8f0" : "#1e293b",
    },
    entryButtonBlue: {
      backgroundColor: "#2563eb",
      paddingHorizontal: 28,
      paddingVertical: 16,
      borderRadius: 12,
      minWidth: 140,
      alignItems: "center",
      elevation: 3,
    },
    entryButtonGreen: {
      backgroundColor: "#10b981",
      paddingHorizontal: 28,
      paddingVertical: 16,
      borderRadius: 12,
      minWidth: 140,
      alignItems: "center",
      elevation: 3,
    },
    entryButtonText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 16,
    },
    resetAllButton: {
      backgroundColor: isDark ? "#1e293b" : "#f3f4f6",
      paddingHorizontal: 20,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? "#475569" : "#d1d5db",
    },
    resetAllText: {
      color: isDark ? "#ef4444" : "#dc2626",
      fontSize: 13,
      fontWeight: "500",
    },
  });