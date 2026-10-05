import React, { useState, useEffect } from "react";
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert 
} from "react-native";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function AppHomeScreen() {
  const navigation = useNavigation();
  const [checkerModalVisible, setCheckerModalVisible] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const loadUserRole = async () => {
      try {
        const userString = await AsyncStorage.getItem("user_info");
        console.log("AsyncStorage user:", userString);
        if (userString) {
          const user = JSON.parse(userString);
          console.log("Parsed user:", user);
          setUserRole(user.role); // Example: RWAL_hi_user
        }
      } catch (error) {
        console.log("Error loading user:", error);
      }
    };
    loadUserRole();
  }, []);

  // ✅ Logout handler
  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem("user_info");

      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Login" }],
        })
      );
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleCheckerPress = () => setCheckerModalVisible(true);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Field Monitoring App</Text>

      <View style={styles.grid}>
        {/* DBC Card */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: "#3b82f6" }]}
          onPress={handleCheckerPress}
        >
          <MaterialCommunityIcons name="bug" size={36} color="#fff" />
          <Text style={styles.cardTitle}>Domestic Breeding Checker</Text>
          <Text style={styles.cardSubtitle}>
            Monitor breeding sites in the field
          </Text>
        </TouchableOpacity>

        {/* AI Chlorination Card */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: "#FFD801" }]}
          onPress={() => navigation.navigate("WaterFlow")}
        >
          <MaterialCommunityIcons name="test-tube" size={36} color="#000" />
          <Text style={[styles.cardTitle, { color: "#000" }]}>
            AI Chlorination Check
          </Text>
          <Text style={[styles.cardSubtitle, { color: "#000" }]}>
            AI Based water chlorination analysis
          </Text>
        </TouchableOpacity>

        {/* Water Quality Analysis */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: "#f6f0f0ff" }]}
          onPress={() => {
            console.log("userRole:", userRole);
            if (!userRole) {
              Alert.alert("Loading", "Please wait while your role is being loaded.");
              return;
            }

            if (userRole === "RWAL_hi_user") {
              navigation.navigate("HiWaterLabHome");
            } else if (userRole === "hi_user") {
              Alert.alert("Access Denied", "You do not have permission to access this page.");
            } else {
              Alert.alert("Access Denied", "Unauthorized user.");
            }
          }}
        >
          <MaterialCommunityIcons
            name="map-marker"
            size={36}
            color="#26561aff"
          />
          <Text style={[styles.cardTitle, { color: "#26561aff", fontSize: 16 }]}>
            Water Quality Analysis
          </Text>
          <Text style={[styles.cardTitle, { color: "#26561aff", fontSize: 16 }]}>
            Advance Travel Program
          </Text>
        </TouchableOpacity>

        {/* Exit (Logout) Button */}
        <TouchableOpacity
          style={[
            styles.card,
            { backgroundColor: "#E5E7EB", paddingVertical: 12, alignItems: "center" },
          ]}
          onPress={handleLogout} // 👈 use the logout function
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <MaterialCommunityIcons name="arrow-left-bold" size={28} color="#933300ff" />
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#933300ff", marginLeft: 8 }}>
              Exit
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: "#933300ff", marginTop: 4 }}>
            Return to login
          </Text>
        </TouchableOpacity>
      </View>

      {/* Role Selection Modal */}
      <Modal
        transparent
        visible={checkerModalVisible}
        animationType="slide"
        onRequestClose={() => setCheckerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose your Role</Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: "#3b82f6" }]}
              onPress={() => {
                setCheckerModalVisible(false);
                navigation.navigate("MosquitoFlow");
              }}
            >
              <Text style={styles.modalButtonText}>DBC</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: "#5ABCD8" }]}
              onPress={() => {
                setCheckerModalVisible(false);
                navigation.navigate("HIFlow");
              }}
            >
              <Text style={styles.modalButtonText}>HI</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: "#F3F4F6" }]}
              onPress={() => setCheckerModalVisible(false)}
            >
              <Text style={[styles.modalButtonText, { color: "#111827" }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 30,
    color: "#1f2937",
    textAlign: "center",
  },
  grid: {
    width: "100%",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 15,
  },
  card: {
    width: "90%",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginTop: 10,
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#e5e7eb",
    textAlign: "center",
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 25,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
  modalButton: {
    width: "100%",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginVertical: 6,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
