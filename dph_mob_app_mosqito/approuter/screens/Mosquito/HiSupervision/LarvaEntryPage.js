// LarvaEntryPage.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';


export default function LarvaEntryPage() {
  const navigation = useNavigation();
  const route = useRoute();
  const [role, setRole] = useState("");

  // states
  const [overallSourceCount, setOverallSourceCount] = useState("");
  const [loading, setLoading] = useState(false);
  const [sourceCount, setSourceCount] = useState("");
  const [sourceData, setSourceData] = useState([]);
  const [openDropdownIndex, setOpenDropdownIndex] = useState(null);
  const [cellWidth, setCellWidth] = useState(0);
  const [phc_name, setPhcName] = useState(null);
  const [village_name, setVillageName] = useState(null);
  const [image, setImage] = useState(null);
  const [geoLocation, setGeoLocation] = useState(null);
  const [workDropdownVisible, setWorkDropdownVisible] = useState(false);
  const [workType, setWorkType] = useState("Select Work Type");

  // user info
  const [userId, setUserId] = useState("");
  const [hiName, setHiName] = useState("Loading...");
  const [mobileNo, setMobileNo] = useState("");
  const [blockName, setBlockName] = useState("");
  const [districtName, setDistrictName] = useState("");

  const workOptions = ["Fever", "Dengue", "Routine ATP", "Scrub", "Scrub typus", "Malaria", "Filaria", "Chikungunya", "JE", "Lepto", "Rabies"];
  const rippleAnim = useRef(new Animated.Value(0)).current;

  const availableSources = [
    { id: 1, name: "Mud Pot" },
    { id: 2, name: "Grinding Stone" },
    { id: 3, name: "Upper Level / Lower Level Water Storage Tank" },
    { id: 4, name: "Drum / Barrel" },
    { id: 5, name: "Coconut Shells" },
    { id: 6, name: "Flower Pots" },
    { id: 7, name: "Concrete Pots" },
    { id: 8, name: "Plastic Items" },
    { id: 9, name: "Refrigerator / Fridge" },
    { id: 10, name: "Tyre" },
    { id: 11, name: "Others" },
  ];

  // load user info
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("user_info");
        if (stored) {
          const user = JSON.parse(stored);
          setHiName(user.username || "HI User");
          setMobileNo(user.phone_number || "");
          setBlockName(user.block_name || "");
          setDistrictName(user.hud_name || user.district_name || user.hub_name || "");
          setUserId(user.user_id || "");
          setUserId(user.user_id || "");
          setPhcName(route.params.selectedPhc || null);
          setVillageName(route.params.selectedVillage || null);
          setRole(user.role || "");
        }
      } catch (e) {
        console.log("Error loading user:", e);
      }
    })();
  }, []);

  // ripple animation (info button)
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(rippleAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      Animated.timing(rippleAnim, { toValue: 0, duration: 1500, useNativeDriver: true })
    ])).start();
  }, []);

  // derived total
  const totalEntered = sourceData.reduce((sum, row) => sum + Number(row.count || 0), 0);

  // rows
  const addRow = () => {
    if (!sourceCount) return Alert.alert("Required", "Please enter Total NOS first.");
    if (totalEntered >= Number(sourceCount)) return Alert.alert("Limit Reached", "Total NOS already entered.");
    setSourceData(prev => [...prev, { id: prev.length + 1, sourceNo: null, sourceName: "", count: "" }]);
  };


  const deleteRow = (index) => {
    const updated = sourceData.filter((_, i) => i !== index).map((r, i) => ({ ...r, id: i + 1 }));
    setSourceData(updated);
  };

  const updateData = (index, key, value) => {
    const updated = [...sourceData];
    updated[index][key] = value;
    // If sourceNo is updated, also set sourceName
    if (key === "sourceNo") {
      const selectedSource = availableSources.find(s => s.id === value);
      updated[index]["sourceName"] = selectedSource ? selectedSource.name : "";
    }

    setSourceData(updated);
  };

  // camera + location
  const openCamera = async () => {
    setLoading(true);

    try {
      // Request permissions
      const { status: camStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();

      if (camStatus !== "granted" || locStatus !== "granted") {
        Alert.alert("Permission Required", "Camera & Location access needed.");
        setLoading(false);
        return;
      }

      // Capture location
      let loc = null;
      try {
        loc = await Location.getCurrentPositionAsync({ accuracy: 5 });
        setGeoLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } catch (err) {
        console.log("Location error:", err);
      }

      // Open camera
      const photo = await ImagePicker.launchCameraAsync({
        quality: 1,
        base64: false, // we will generate base64 via ImageManipulator
      });

      if (photo.canceled) {
        setLoading(false);
        return;
      }

      const asset = photo.assets[0];

      // Resize + compress + get base64
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 800 } }], // adjust width as needed
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      // Set base64 (ready to send to server)
      const base64Image = `data:image/jpeg;base64,${manipulated.base64}`;
      setImage(base64Image);

      // Log or use the base64 string directly
      console.log("Base64 Image:", base64Image);

    } catch (err) {
      console.log("Camera error:", err);
      Alert.alert("Error", "Unable to open camera");
    } finally {
      setLoading(false);
    }
  };

  // navigate to preview screen (no submitFinalData passed)
  // const openFinalPreview = () => {
  //   if (totalEntered !== Number(sourceCount)) return Alert.alert("Incorrect Total", `Entered: ${totalEntered}, Required: ${sourceCount}`);
  //   if (!image) return Alert.alert("Missing Photo", "Please capture an image.");
  //   if (workType === "Select Work Type") return Alert.alert("Missing Work Type", "Please select work type.");

  // console.log("DATA SENT TO LarvaFinalConfirm PAGE:", {
  //   hiName,
  //   mobileNo,
  //   blockName,
  //   districtName,
  //   workType,
  //   image,
  //   geoLocation,
  //   sourceData,
  //   totalEntered,
  //   sourceCount,
  //   overallSourceCount,
  //   availableSources,
  //   userId,
  //   timestamp: new Date().toISOString()
  // });
  //   navigation.navigate("LarvaFinalConfirm", {
  //     hiName,
  //     mobileNo,
  //     blockName,
  //     districtName,
  //     workType,
  //     image,
  //     geoLocation,
  //     sourceData,
  //     totalEntered,
  //     sourceCount,
  //     overallSourceCount,
  //     availableSources,
  //     userId,
  //     timestamp: new Date().toISOString()
  //   });
  // };

  const submitLarvaEntry = async () => {
    if (!image || !geoLocation || workType === "Select Work Type") {
      Alert.alert("Missing Data", "Please fill all required fields");
      return;
    }

    setLoading(true);

    try {   // ✅ MUST HAVE TRY

      const payload = {
        user_id: userId,
        role,
        hi_name: hiName,
        mobile_no: mobileNo,
        block_name: blockName,
        district_name: districtName,
        phc_name,
        village_name,
        work_type: workType,
        image_base64: image,
        latitude: geoLocation.latitude,
        longitude: geoLocation.longitude,
        sources: sourceData,
        active_larval_source_count: sourceCount,
        overallSourceCount
      };

      // ==============================
      // ROLE BASED ENDPOINT
      // ==============================

      const specialRoles = ["special_user", "DHO", "chl_admin", "mos_admin", "block_user"];

      const apiUrl = specialRoles.includes(role)
        ? "http://192.168.1.145:3000/dashboard/dbc-special-data-entry-larval"
        : "http://192.168.1.145:3000/dashboard/save-larva-entry";

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          "Success",
          "Larva entry saved!",
          [{
            text: "OK",
            onPress: () => {
              setImage(null);
              setSourceData([]);
              setSourceCount("");
              setOverallSourceCount("");
              setGeoLocation(null);
              setWorkType("Select Work Type");

              navigation.navigate("HIFlow", { screen: "HIHome" });
            }
          }]
        );
      } else {
        Alert.alert("Error", data.message || "Something went wrong");
      }

    } catch (error) {   // ✅ now valid
      console.error("Submit error:", error);
      Alert.alert("Error", "Cannot connect to server");
    } finally {
      setLoading(false);
    }
  };


  return (
    <View style={styles.container}>
      {/* header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={26} color="black" />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Larva Entry by HI</Text>
        <View style={styles.waveWrapper}>
          <Animated.View style={[styles.wave, {
            opacity: rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
            transform: [{ scale: rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }]
          }]} />
          <TouchableOpacity style={styles.infoButton}>
            <Text style={styles.infoText}>i</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.bodyContainer}>
        <View style={styles.cardBox}>
          <Text style={styles.cardHeading}>Entry Details</Text>
          <Text style={styles.cardText}>Name: {hiName}</Text>
          {blockName ? <Text style={styles.cardText}>Block: {blockName}</Text> : null}
          {districtName ? <Text style={styles.cardText}>District: {districtName}</Text> : null}
          {phc_name ? <Text style={styles.cardText}>PHC: {phc_name}</Text> : null}
          {village_name ? <Text style={styles.cardText}>Village: {village_name}</Text> : null}

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Overall Source Count</Text>
              <TextInput
                style={styles.textInput}
                placeholder="E.g. 50"
                keyboardType="numeric"
                value={overallSourceCount}
                onChangeText={setOverallSourceCount}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Enter Active Source</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                placeholder="e.g. 10"
                value={sourceCount}
                onChangeText={setSourceCount}
              />
              {sourceCount && totalEntered !== Number(sourceCount) && (
                <Text style={{ color: 'red', marginTop: 6 }}>
                  Total entered ({totalEntered}) ≠ Required ({sourceCount})
                </Text>
              )}
            </View>
          </View>

          {/* Table */}
          {sourceData.length > 0 && (
            <>
              <View style={styles.tableHeader}>
                <Text style={styles.col1}>Sl.No</Text>
                <Text style={styles.col2}>Source</Text>
                <Text style={styles.col3}>NOS</Text>
                <Text style={[styles.col3, { flex: 0.8 }]}>Action</Text>
              </View>

              {sourceData.map((row, index) => {
                const filtered = availableSources.filter(opt => !sourceData.some((d, i) => d.sourceNo === opt.id && i !== index));
                return (
                  <View key={index} style={styles.tableRow}>
                    <Text style={styles.col1}>{row.id}</Text>

                    <View style={{ flex: 1.8, position: "relative" }}>
                      <TouchableOpacity
                        style={styles.dropdownCell}
                        onLayout={(e) => setCellWidth(e.nativeEvent.layout.width)}
                        onPress={() => setOpenDropdownIndex(openDropdownIndex === index ? null : index)}
                      >
                        <Text style={{ textAlign: "center" }}>{row.sourceNo ? availableSources.find(s => s.id === row.sourceNo)?.name : "Select"}</Text>
                      </TouchableOpacity>

                      {openDropdownIndex === index && (
                        <View style={[styles.dropdownBox1, { width: cellWidth }]}>
                          <ScrollView nestedScrollEnabled>
                            {filtered.map(opt => (
                              <TouchableOpacity
                                key={opt.id}
                                onPress={() => { updateData(index, "sourceNo", opt.id); setOpenDropdownIndex(null); }}
                                style={styles.dropdownOption}
                              >
                                <Text style={styles.dropdownOptionText}>{opt.name}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>

                    <TextInput
                      style={styles.countInput}
                      keyboardType="numeric"
                      placeholder="0"
                      value={row.count}
                      onChangeText={(val) => updateData(index, "count", val)}
                    />

                    <TouchableOpacity onPress={() => deleteRow(index)}>
                      <Ionicons name="trash" size={22} color="red" />
                    </TouchableOpacity>
                  </View>
                );
              })}

              <View style={[styles.tableRow, { backgroundColor: "#f1f1f1" }]}>
                <Text style={styles.col1}>-</Text>
                <Text style={styles.col2}>Total</Text>
                <Text style={styles.col3}>{totalEntered}</Text>
                <Text style={[styles.col3, { flex: 0.8 }]}></Text>
              </View>
            </>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: totalEntered >= Number(sourceCount) ? "#aaa" : "#28a745", marginTop: 15 }]}
            onPress={addRow}
            disabled={totalEntered >= Number(sourceCount)}
          >
            <Text style={styles.submitText}>+ Add Row</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.imgBtn} onPress={openCamera}>
            <Ionicons name="camera-outline" size={25} color="#007AFF" />
            <Text style={styles.imgBtnText}>Capture Image</Text>
          </TouchableOpacity>

          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={{ color: "white", marginTop: 10, fontWeight: "600" }}>Loading...</Text>
            </View>
          )}

          {image && (
            <View style={styles.imageContainer}>
              <Image source={{ uri: image }} style={styles.imageBox} />
            </View>
          )}

          {geoLocation ? (
            <View style={styles.geoSuccess}>
              <Ionicons name="location" size={18} color="green" />
              <Text style={{ color: "green", marginLeft: 6 }}>Lat: {geoLocation.latitude.toFixed(6)} | Lon: {geoLocation.longitude.toFixed(6)}</Text>
            </View>
          ) : (
            <Text style={{ color: "red", marginTop: 10 }}>Location not captured</Text>
          )}

          <TouchableOpacity style={styles.dropdownBox} onPress={() => setWorkDropdownVisible(!workDropdownVisible)}>
            <Text style={styles.dropdownText}>{workType}</Text>
            <Ionicons name={workDropdownVisible ? "chevron-up" : "chevron-down"} size={20} />
          </TouchableOpacity>

          {workDropdownVisible && (
            <View style={styles.dropdownList}>
              {workOptions.map(opt => (
                <TouchableOpacity key={opt} style={styles.dropdownItem} onPress={() => { setWorkType(opt); setWorkDropdownVisible(false); }}>
                  <Text style={styles.dropdownItemText}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: totalEntered === Number(sourceCount) && image && workType !== "Select Work Type" ? "#007AFF" : "#aaa", marginTop: 30 }]}
            onPress={submitLarvaEntry}
            disabled={totalEntered !== Number(sourceCount) || !image || workType === "Select Work Type"}
          >
            <Text style={styles.submitText}>SUBMIT ENTRY</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingTop: 50, paddingBottom: 15, backgroundColor: '#fff', elevation: 4 },
  pageTitle: { fontSize: 19, fontWeight: 'bold', color: "#111" },
  backBtn: { padding: 8 },
  waveWrapper: { position: 'relative' },
  wave: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: '#1976D2' },
  infoButton: { backgroundColor: "#1E90FF", width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  infoText: { color: 'white', fontWeight: "700", fontSize: 16 },
  bodyContainer: { paddingBottom: 50, alignItems: "center" },
  cardBox: { width: "94%", backgroundColor: "white", borderRadius: 12, padding: 16, marginTop: 16, elevation: 6 },
  cardHeading: { fontSize: 18, fontWeight: "bold", marginBottom: 12, color: "#1976D2" },
  cardText: { fontSize: 15, marginBottom: 6, color: "#333" },
  label: { marginTop: 8, fontWeight: "600", fontSize: 14 },
  textInput: { borderWidth: 1, borderColor: "#aaa", padding: 10, borderRadius: 8, marginTop: 6, backgroundColor: "#f0f8ff" },
  tableHeader: { marginTop: 16, flexDirection: "row", backgroundColor: "#e3f2fd", paddingVertical: 10, borderRadius: 8 },
  tableRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderColor: "#eee", position: "relative" },
  col1: { flex: 0.7, textAlign: "center", fontWeight: "600" },
  col2: { flex: 1.8, textAlign: "center", fontWeight: "600" },
  col3: { flex: 1, textAlign: "center", fontWeight: "600" },
  dropdownCell: { borderWidth: 1.2, borderColor: "#007AFF", borderRadius: 8, padding: 8, backgroundColor: "#f0f8ff" },
  dropdownBox1: { position: "absolute", top: -240, left: 0, backgroundColor: "#fff", borderRadius: 8, paddingVertical: 6, elevation: 20, zIndex: 9999, maxHeight: 220, borderWidth: 1, borderColor: "#1976D2" },
  dropdownOption: { padding: 10, borderBottomWidth: 1, borderColor: "#eee" },
  dropdownOptionText: { textAlign: "center", fontSize: 14 },
  countInput: { borderWidth: 1, borderColor: "#007AFF", borderRadius: 8, padding: 8, width: 60, textAlign: "center", backgroundColor: "#f0f8ff" },
  imgBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#e3f2fd", padding: 12, borderRadius: 10, marginTop: 14, justifyContent: "center" },
  imgBtnText: { marginLeft: 10, fontSize: 16, color: "#007AFF", fontWeight: "600" },
  imageContainer: { marginTop: 14, alignSelf: "center", width: 170, height: 200, borderRadius: 12, backgroundColor: "white", elevation: 6, paddingTop: 10, borderWidth: 2, borderColor: "#007AFF" },
  imageBox: { width: 150, height: 150, borderRadius: 12, alignSelf: "center" },
  geoSuccess: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  dropdownBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14, padding: 12, borderRadius: 12, borderWidth: 1.2, borderColor: "#007AFF", backgroundColor: "#f0f8ff" },
  dropdownText: { fontSize: 16, fontWeight: "600" },
  dropdownList: { marginTop: 8, backgroundColor: "white", borderRadius: 12, elevation: 6, overflow: "hidden" },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderColor: "#eee" },
  dropdownItemText: { fontSize: 15 },
  submitBtn: { paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 10 },
  submitText: { color: "white", fontSize: 16, fontWeight: "bold" },
  loadingOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", zIndex: 9999 },
});
