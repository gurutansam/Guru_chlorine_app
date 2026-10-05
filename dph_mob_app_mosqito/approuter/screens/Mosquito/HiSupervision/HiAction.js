import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function HiAction() {
  const navigation = useNavigation();
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState(null);


  const [actionData, setActionData] = useState([]);
  const [selectedRowId, setSelectedRowId] = useState(null);

  const [selectedActions, setSelectedActions] = useState({});
  const [actionImages, setActionImages] = useState({});
  const [actionLocations, setActionLocations] = useState({});
  const [lockRows, setLockRows] = useState({});

  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);

  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [modalViewData, setModalViewData] = useState({ type: "", row: null });

  const [locationLoader, setLocationLoader] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedRowData, setSelectedRowData] = useState(null);
  const [sourceActions, setSourceActions] = useState({});



  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const sortedData = [...actionData].sort(
    (a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)
  );
  const paginatedData = sortedData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );


  useEffect(() => {
    const loadRole = async () => {
      const user = await AsyncStorage.getItem("user_info");
      if (user) {
        const parsed = JSON.parse(user);
        setUserRole(parsed.role);
        setUserId(parsed.user_id);
      }
    };
    loadRole();
  }, []);

  // ---------- FETCH DATA ----------
  /* ================= FETCH DATA (FIXED) ================= */
  const fetchData = async () => {
    try {
      const [res1, res2] = await Promise.all([
        fetch("http://192.168.1.145:3000/dashboard/get-larva-entries"),
        fetch("http://192.168.1.145:3000/dashboard/get-special-larva-entries")
      ]);

      if (!res1.ok || !res2.ok) {
        throw new Error("One of the APIs failed");
      }

      const data1 = await res1.json();
      const data2 = await res2.json();

      // 🔹 Normalize SECOND API if column names differ
      const normalizedSpecialData = data2.map(item => ({
        ...item,
        // ensure same keys used in UI
        id: item.id,
        work_type: item.work_type,
        submitted_at: item.submitted_at,
        latitude: item.latitude,
        longitude: item.longitude,
        image_path: item.image_path,
        action_date: item.action_date,
        action_image_path: item.action_image_path,
        action_location: item.action_location,
        sources: item.sources
      }));

      // 🔹 Merge both tables
      const mergedData = [...data1, ...normalizedSpecialData].filter(
        item => String(item.user_id) === String(userId)
      );


      // 🔹 Apply SAME filter logic
      const filtered = mergedData.filter(x =>
        x.work_type !== "Routine ATP" &&
        [
          "Fever",
          "Dengue",
          "Scrub typus",
          "Malaria",
          "Filaria",
          "Chikungunya",
          "JE",
          "Lepto",
          "Rabies",
          "Scrub"
        ].includes(x.work_type)
      );

      setActionData(filtered);

      // 🔒 Lock rows + restore locations
      const locked = {};
      const locations = {};

      filtered.forEach(item => {
        if (item.action_date || item.action_image_path) {
          locked[item.id] = true;
        }
        if (item.action_location) {
          try {
            locations[item.id] = JSON.parse(item.action_location);
          } catch { }
        }
      });

      setLockRows(locked);
      setActionLocations(locations);

    } catch (err) {
      console.log("Fetch error:", err);
      alert("Unable to load action data");
    }
  };


  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId]);


  // const refreshData = async () => {
  //   try {
  //     const [res1, res2] = await Promise.all([
  //       fetch("http://192.168.1.145:3000/dashboard/get-larva-entries"),
  //       fetch("http://192.168.1.145:3000/dashboard/get-special-larva-entries")
  //     ]);

  //     const data1 = await res1.json();
  //     const data2 = await res2.json();

  //     const mergedData = [...data1, ...data2];

  //     const filtered = mergedData.filter(x =>
  //       x.work_type !== "Routine ATP" &&
  //       [
  //         "Fever",
  //         "Dengue",
  //         "Scrub typus",
  //         "Malaria",
  //         "Filaria",
  //         "Chikungunya",
  //         "JE",
  //         "Lepto",
  //         "Rabies",
  //         "Scrub"
  //       ].includes(x.work_type)
  //     );

  //     setActionData(filtered);

  //   } catch (error) {
  //     console.log(error);
  //     alert("Failed refreshing data");
  //   }
  // };



  // ---------- GET LOCATION ----------
  const getLocation = async () => {
    setLocationLoader(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      alert("Location permission denied");
      setLocationLoader(false);
      return null;
    }

    try {
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      setLocationLoader(false);
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      };
    } catch (err) {
      console.log(err);
      setLocationLoader(false);
      alert("Unable to capture location");
      return null;
    }
  };

  // ---------- TAKE PHOTO ----------
  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      alert("Camera access denied");
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.assets || result.assets.length === 0) return null;
    let pic = result.assets[0];
    return `data:${pic.mimeType};base64,${pic.base64}`;
  };

  // ---------- OPEN ACTION MODAL ----------
  const openActionModal = (rowObj) => {
    let normalizedSources = [];

    if (Array.isArray(rowObj.sources)) {
      normalizedSources = rowObj.sources;
    } else if (typeof rowObj.sources === "string") {
      try {
        normalizedSources = JSON.parse(rowObj.sources);
      } catch (e) {
        normalizedSources = [];
      }
    }

    setSelectedRowId(rowObj.id);
    setSelectedRowData({
      ...rowObj,
      sources: normalizedSources
    });
    setActionModalVisible(true);
  };


  // ---------- SELECT CHECKBOX ACTION ----------
  const toggleAction = (actionName) => {
    setSelectedActions(prev => {
      const arr = prev[selectedRowId] || [];
      if (arr.includes(actionName)) {
        return { ...prev, [selectedRowId]: arr.filter(a => a !== actionName) };
      } else {
        return { ...prev, [selectedRowId]: [...arr, actionName] };
      }
    });
  };

  // ---------- ACTION NEXT PROCESS ----------
  const startActionFlow = async (rowId) => {
    if (!selectedActions[rowId] || selectedActions[rowId].length === 0) {
      return alert("Select at least one action");
    }

    let loc = await getLocation();
    if (!loc) return;

    setActionLocations(prev => ({ ...prev, [rowId]: loc }));

    let img = await takePhoto();
    if (!img) return;

    setActionImages(prev => ({ ...prev, [rowId]: img }));
    setSelectedImage(img);

    setActionModalVisible(false);
    setPreviewModalVisible(true);
  };

  // ---------- SUBMIT ACTION TO SERVER ----------
  /* ================= SUBMIT ACTION (FIXED) ================= */
  const submitAction = async () => {
    try {
      const sourceActionData = selectedRowData.sources.map(src => ({
        sourceName: src.sourceName,
        count: src.count,
        action: sourceActions[selectedRowId]?.[src.sourceName]?.action || "Not Selected"
      }));

      if (sourceActionData.some(x => x.action === "Not Selected")) {
        alert("Please select Destroyed or Treated for all sources");
        return;
      }

      const body = {
        rowId: selectedRowId,
        selectedActions: selectedActions[selectedRowId],
        sourceActions: sourceActionData,
        image_base64: actionImages[selectedRowId],
        location: actionLocations[selectedRowId],
        role: userRole || ""
      };

      const response = await fetch(
        "http://192.168.1.145:3000/dashboard/save-action",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text);
      }

      alert("Action submitted successfully");

      setLockRows(prev => ({ ...prev, [selectedRowId]: true }));
      setPreviewModalVisible(false);
      setSelectedRowId(null);

      await fetchData(); // ✅ NOW WORKS

    } catch (err) {
      console.log("Submit error:", err);
      alert("Something went wrong. Please try again.");
    }
  };
  // ---------- OPEN VIEW MODAL ----------
  const openView = (type, rowObj) => {
    setModalViewData({ type: type, row: rowObj });
    setViewModalVisible(true);
  };

  const actionTakenCount = Object.values(lockRows).filter(x => x === true).length;
  const pendingCount = actionData.length - actionTakenCount;

  // DATE FILTER HELPERS
  const isSameDay = (d1, d2) =>
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();

  const getWeekStartDate = () => {
    const today = new Date();
    const day = today.getDay(); // Sunday=0
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    return new Date(today.setDate(diff));
  };
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ x: 0, y: 0, animated: true });
  }, [currentPage]);

  const today = new Date();
  const weekStart = getWeekStartDate();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // ===== TODAY =====
  const todayRows = actionData.filter(x => isSameDay(new Date(x.submitted_at), today));
  const todayTaken = todayRows.filter(x => lockRows[x.id]).length;
  const todayPending = todayRows.length - todayTaken;

  // ===== THIS WEEK =====
  const thisWeekRows = actionData.filter(x => new Date(x.submitted_at) >= weekStart);
  const thisWeekTaken = thisWeekRows.filter(x => lockRows[x.id]).length;
  const thisWeekPending = thisWeekRows.length - thisWeekTaken;

  // ===== THIS MONTH =====
  const thisMonthRows = actionData.filter(x => new Date(x.submitted_at) >= monthStart);
  const thisMonthTaken = thisMonthRows.filter(x => lockRows[x.id]).length;
  const thisMonthPending = thisMonthRows.length - thisMonthTaken;

  // Go to previous page
  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  // Go to next page
  const goToNextPage = () => {
    const totalPages = Math.ceil(actionData.length / rowsPerPage);
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };


  return (
    <>
      {/* HEADER TOP BAR */}
      <View style={styles.topHeader}>

        {/* LEFT BACK BUTTON */}
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back-outline" size={28} color="#FFF" />
        </TouchableOpacity>

        {/* MIDDLE TITLE */}
        <Text style={styles.topTitle}>HI Action Dashboard</Text>

        {/* RIGHT MENU / OPTIONS ICON */}
        <TouchableOpacity onPress={() => setInfoModalVisible(true)}>
          <Ionicons name="information-circle-outline" size={28} color="#FFF" />
        </TouchableOpacity>


      </View>

      <ScrollView style={{ marginTop: 55 }}>

        {/* OVERALL SUMMARY */}
        <View style={styles.cardContainer}>
          <View style={[styles.summaryCard, { backgroundColor: "#2ECC71" }]}>
            <Text style={styles.cardTitle}>Total Taken</Text>
            <Text style={styles.cardValue}>{actionTakenCount}</Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: "#E74C3C" }]}>
            <Text style={styles.cardTitle}>Total Pending</Text>
            <Text style={styles.cardValue}>{pendingCount}</Text>
          </View>
        </View>


        {/* TODAY SUMMARY */}
        <View style={styles.cardContainer}>
          <View style={[styles.summaryCard, { backgroundColor: "#3498DB" }]}>
            <Text style={styles.cardTitle}>Today Taken</Text>
            <Text style={styles.cardValue}>{todayTaken}</Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: "#9B59B6" }]}>
            <Text style={styles.cardTitle}>Today Pending</Text>
            <Text style={styles.cardValue}>{todayPending}</Text>
          </View>
        </View>


        {/* WEEK SUMMARY */}
        <View style={styles.cardContainer}>
          <View style={[styles.summaryCard, { backgroundColor: "#1ABC9C" }]}>
            <Text style={styles.cardTitle}>Week Taken</Text>
            <Text style={styles.cardValue}>{thisWeekTaken}</Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: "#E67E22" }]}>
            <Text style={styles.cardTitle}>Week Pending</Text>
            <Text style={styles.cardValue}>{thisWeekPending}</Text>
          </View>
        </View>


        {/* MONTH SUMMARY */}
        <View style={styles.cardContainer}>
          <View style={[styles.summaryCard, { backgroundColor: "#00C16E" }]}>
            <Text style={styles.cardTitle}>Month Taken</Text>
            <Text style={styles.cardValue}>{thisMonthTaken}</Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: "#FF3D00" }]}>
            <Text style={styles.cardTitle}>Month Pending</Text>
            <Text style={styles.cardValue}>{thisMonthPending}</Text>
          </View>
        </View>


        {/* REFRESH SECTION ABOVE HEADER */}
        <View style={styles.refreshContainer}>
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchData}>
            <Ionicons name="refresh-circle" size={38} color="#FFF" />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <ScrollView style={styles.bodyContainer}>

            {/* HEADER */}
            <View style={styles.tableHeader}>
              <Text style={styles.headerCell}>Sl.No</Text>
              <Text style={styles.headerCell}>Work</Text>
              <Text style={styles.headerCell}>Reg Date</Text>
              <Text style={styles.headerCell}>Location</Text>
              <Text style={styles.headerCell}>Image</Text>
              <Text style={styles.headerCell}>Action Taken</Text>
              <Text style={styles.headerCell}>Action Date</Text>
              <Text style={styles.headerCell}>Action Place</Text>
              <Text style={styles.headerCell}>Action Image</Text>
            </View>

            {/* ROWS */}
            {paginatedData.map((item, index) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={styles.rowCell}>{(currentPage - 1) * rowsPerPage + index + 1}</Text>

                <Text style={styles.rowCell}>{item.work_type}</Text>
                <Text style={styles.rowCell}>{item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : "--"}</Text>

                {/* REGISTERED LOCATION VIEW */}
                <TouchableOpacity style={styles.iconCell} onPress={() => openView("register_location", item)}>
                  <Ionicons name="location-outline" size={22} color="#0057D9" />
                </TouchableOpacity>

                {/* REGISTERED IMAGE VIEW */}
                <TouchableOpacity style={styles.iconCell} onPress={() => openView("register_image", item)}>
                  <Ionicons name="image-outline" size={22} color="#0057D9" />
                </TouchableOpacity>

                {/* ACTION BUTTON */}
                <TouchableOpacity
                  disabled={lockRows[item.id]}
                  style={[styles.dropdownBox, lockRows[item.id] ? { backgroundColor: "#999" } : {}]}
                  onPress={() => openActionModal(item)}>
                  <Text style={{ fontSize: 12 }}>{lockRows[item.id] ? "Done" : "Start"}</Text>
                </TouchableOpacity>

                <Text style={styles.rowCell}>{item.action_date ? new Date(item.action_date).toLocaleDateString() : "--"}</Text>

                {/* ACTION LOCATION VIEW */}
                <TouchableOpacity
                  style={styles.iconCell}
                  disabled={!actionLocations[item.id]}
                  onPress={() => openView("action_location", item)}>
                  <Ionicons name="location-outline" size={22} color={actionLocations[item.id] ? "#007AFF" : "#CCC"} />
                </TouchableOpacity>

                {/* ACTION IMAGE VIEW */}
                <TouchableOpacity style={styles.iconCell} disabled={!item.action_image_path} onPress={() => openView("action_image", item)}>
                  <Ionicons name="image-outline" size={22} color={item.action_image_path ? "#007AFF" : "#CCC"} />
                </TouchableOpacity>
              </View>
            ))}



          </ScrollView>


          {/* =================== ACTION MODAL =================== */}
          <Modal visible={actionModalVisible} transparent>
            <View style={styles.modalWrapper}>
              <View style={styles.actionModalBox}>
                <Text style={styles.title}>Select Action</Text>
                {["Anti Larval Work", "Source Reduction", "Fogging"].map(txt => (
                  <TouchableOpacity key={txt} style={styles.choiceBtn} onPress={() => toggleAction(txt)}>
                    <Ionicons
                      name={selectedActions[selectedRowId]?.includes(txt) ? "checkbox-outline" : "square-outline"}
                      size={24} color="#007AFF"
                    />
                    <Text style={styles.choiceText}>{txt}</Text>
                  </TouchableOpacity>
                ))}

                {/* SHOW SOURCES WHEN SOURCE REDUCTION SELECTED */}
                {selectedActions[selectedRowId]?.includes("Source Reduction") &&
                  Array.isArray(selectedRowData?.sources) && (
                    <View style={{ marginTop: 12, padding: 8, backgroundColor: "#F1F5FF", borderRadius: 8 }}>

                      <Text style={{ fontWeight: "bold", fontSize: 15, marginBottom: 8, color: "#112859" }}>
                        Source Details:
                      </Text>

                      {selectedRowData?.sources?.map((src, idx) => (
                        <View key={idx} style={{ marginBottom: 12, padding: 10, backgroundColor: "#f0f6ff", borderRadius: 8 }}>

                          <Text style={{ fontSize: 16, marginBottom: 8, fontWeight: "bold" }}>
                            🔹 {src.sourceName} ({src.count})
                          </Text>

                          {/* RADIO OPTIONS */}
                          <View style={{ flexDirection: "row", alignItems: "center" }}>

                            {/* Destroyed */}
                            <TouchableOpacity
                              style={{ flexDirection: "row", alignItems: "center", marginRight: 20 }}
                              onPress={() =>
                                setSourceActions(prev => ({
                                  ...prev,
                                  [selectedRowData.id]: {
                                    ...(prev[selectedRowData.id] || {}),
                                    [src.sourceName]: {
                                      action: "Destroyed"
                                    }
                                  }
                                }))
                              }
                            >
                              <View
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: 20,
                                  borderWidth: 2,
                                  borderColor: "#0057D9",
                                  justifyContent: "center",
                                  alignItems: "center"
                                }}
                              >
                                {sourceActions[selectedRowData.id]?.[src.sourceName]?.action === "Destroyed" && (
                                  <View
                                    style={{
                                      width: 10,
                                      height: 10,
                                      borderRadius: 20,
                                      backgroundColor: "#0057D9"
                                    }}
                                  />
                                )}
                              </View>

                              <Text style={{ marginLeft: 6 }}>Destroyed</Text>
                            </TouchableOpacity>


                            {/* Treated */}
                            <TouchableOpacity
                              style={{ flexDirection: "row", alignItems: "center" }}
                              onPress={() =>
                                setSourceActions(prev => ({
                                  ...prev,
                                  [selectedRowData.id]: {
                                    ...(prev[selectedRowData.id] || {}),
                                    [src.sourceName]: {
                                      action: "Treated"
                                    }
                                  }
                                }))
                              }
                            >
                              <View
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: 20,
                                  borderWidth: 2,
                                  borderColor: "#0057D9",
                                  justifyContent: "center",
                                  alignItems: "center"
                                }}
                              >
                                {sourceActions[selectedRowData.id]?.[src.sourceName]?.action === "Treated" && (
                                  <View
                                    style={{
                                      width: 10,
                                      height: 10,
                                      borderRadius: 20,
                                      backgroundColor: "#0057D9"
                                    }}
                                  />
                                )}
                              </View>

                              <Text style={{ marginLeft: 6 }}>Treated</Text>
                            </TouchableOpacity>

                          </View>
                        </View>
                      ))}

                    </View>
                  )}


                <TouchableOpacity style={styles.closeBtn} onPress={() => startActionFlow(selectedRowId)}>
                  <Text style={styles.closeText}>Next</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.closeBtn, { backgroundColor: '#999' }]} onPress={() => setActionModalVisible(false)}>
                  <Text style={styles.closeText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* =================== PREVIEW MODAL =================== */}
          <Modal transparent visible={previewModalVisible} animationType="fade">
            <View style={styles.modalWrapper}>
              <View style={styles.actionModalBox}>
                <Text style={{ fontWeight: 'bold', fontSize: 16 }}>Preview</Text>

                {selectedRowId && (
                  <>
                    <Text style={{ marginTop: 10, fontWeight: "bold" }}>Selected Actions:</Text>
                    <View style={{ marginTop: 10 }}>
                      <Text style={{ fontWeight: "bold", marginBottom: 6 }}>Source Details:</Text>

                      {Array.isArray(selectedRowData?.sources) &&
                        selectedRowData.sources.map((src, idx) => {

                          const selectedAction =
                            sourceActions[selectedRowId]?.[src.sourceName]?.action || "Not Selected";

                          return (
                            <View
                              key={idx}
                              style={{
                                flexDirection: "row",
                                justifyContent: "space-between",
                                paddingVertical: 6,
                                borderBottomWidth: 1,
                                borderColor: "#ddd",
                              }}
                            >
                              <Text style={{ width: "40%" }}>{src.sourceName}</Text>
                              <Text style={{ width: "20%", textAlign: "center" }}>{src.count}</Text>
                              <Text
                                style={{
                                  width: "40%",
                                  textAlign: "right",
                                  fontWeight: "bold",
                                  color: selectedAction === "Destroyed"
                                    ? "red"
                                    : selectedAction === "Treated"
                                      ? "green"
                                      : "gray"
                                }}
                              >
                                {selectedAction}
                              </Text>
                            </View>
                          );
                        })}
                    </View>


                    <Text style={{ marginTop: 10, fontWeight: "bold", marginBottom: 5 }}>Action Taken Location:</Text>

                    {actionLocations[selectedRowId] ? (
                      <MapView
                        style={styles.mapView}
                        region={{
                          latitude: Number(actionLocations[selectedRowId].latitude),
                          longitude: Number(actionLocations[selectedRowId].longitude),
                          latitudeDelta: 0.004,
                          longitudeDelta: 0.004,
                        }}
                      >
                        <Marker coordinate={{
                          latitude: Number(actionLocations[selectedRowId].latitude),
                          longitude: Number(actionLocations[selectedRowId].longitude)
                        }} />
                      </MapView>
                    ) : (
                      <Text style={{ color: "red", marginBottom: 10 }}>Location not captured</Text>
                    )}

                    <Text style={{ marginTop: 10, fontWeight: "bold", marginBottom: 5 }}>Action Taken Image:</Text>
                    {actionImages[selectedRowId] ? (
                      <Image
                        source={{ uri: actionImages[selectedRowId] }}
                        style={{ width: "100%", height: 200, borderRadius: 10 }}
                        resizeMode="contain"
                      />
                    ) : (
                      <Text style={{ color: "red" }}>No image captured</Text>
                    )}

                    <TouchableOpacity style={styles.closeBtn} onPress={submitAction}>
                      <Text style={styles.closeText}>Submit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.closeBtn, { backgroundColor: '#999', marginTop: 5 }]} onPress={() => setPreviewModalVisible(false)}>
                      <Text style={styles.closeText}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </Modal>

          {/* =================== VIEW MODAL =================== */}
          <Modal visible={viewModalVisible} transparent>
            <View style={styles.modalWrapper}>
              <View style={styles.actionModalBox}>
                <Text style={styles.title}>Details View</Text>

                {/* Registered Location */}
                {modalViewData.type === "register_location" &&
                  modalViewData.row?.latitude &&
                  <MapView
                    style={styles.mapView}
                    region={{
                      latitude: Number(modalViewData.row.latitude),
                      longitude: Number(modalViewData.row.longitude),
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    }}
                  >
                    <Marker coordinate={{
                      latitude: Number(modalViewData.row.latitude),
                      longitude: Number(modalViewData.row.longitude)
                    }} />
                  </MapView>
                }

                {/* Registered Image */}
                {modalViewData.type === "register_image" &&
                  modalViewData.row?.image_path &&
                  <Image source={{ uri: `http://192.168.1.145:3000${modalViewData.row.image_path}` }} style={styles.previewImage} />
                }

                {/* Action Image */}
                {modalViewData.type === "action_image" &&
                  modalViewData.row?.action_image_path &&
                  <Image source={{ uri: `http://192.168.1.145:3000${modalViewData.row.action_image_path}` }} style={styles.previewImage} />
                }

                {/* Action Taken Location */}
                {modalViewData.type === "action_location" &&
                  modalViewData.row &&
                  actionLocations[modalViewData.row.id] && (
                    <>
                      <Text style={{ fontWeight: "bold", marginBottom: 5 }}>Action Taken Location</Text>
                      <MapView
                        style={styles.mapView}
                        region={{
                          latitude: Number(actionLocations[modalViewData.row.id].latitude),
                          longitude: Number(actionLocations[modalViewData.row.id].longitude),
                          latitudeDelta: 0.005,
                          longitudeDelta: 0.005,
                        }}
                      >
                        <Marker coordinate={{
                          latitude: Number(actionLocations[modalViewData.row.id].latitude),
                          longitude: Number(actionLocations[modalViewData.row.id].longitude),
                        }} />
                      </MapView>
                    </>
                  )
                }

                <TouchableOpacity style={styles.closeBtn} onPress={() => setViewModalVisible(false)}>
                  <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>

              </View>
            </View>
          </Modal>
          {/* ================= INFO MODAL ================= */}
          <Modal visible={infoModalVisible} transparent animationType="fade">
            <View style={styles.modalWrapper}>
              <View style={styles.infoModalBox}>

                <Text style={styles.title}>Information</Text>

                <Text style={styles.infoText}>
                  This dashboard is used to capture field activity details:
                  {'\n'}✔ Action taken type
                  {'\n'}✔ Location captured
                  {'\n'}✔ Image evidence
                </Text>

                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setInfoModalVisible(false)}
                >
                  <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>

              </View>
            </View>
          </Modal>


        </ScrollView>
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginVertical: 10 }}>
          <TouchableOpacity onPress={goToPrevPage}>
            <Ionicons name="arrow-back-outline" size={24} color="" />
          </TouchableOpacity>

          <Text style={{ alignSelf: 'center', fontSize: 16 }}>
            Page {currentPage} of {Math.ceil(actionData.length / rowsPerPage)}
          </Text>

          <TouchableOpacity onPress={goToNextPage}>
            <Ionicons name="arrow-forward-outline" size={24} color="" />
          </TouchableOpacity>
        </View>

      </ScrollView>
    </>
  );
}


const styles = StyleSheet.create({
  bodyContainer: { flex: 1, padding: 10, marginTop: 10, backgroundColor: "#F6F8FB" },
  tableHeader: { flexDirection: "row", backgroundColor: "#112859", padding: 10, borderRadius: 6 },
  headerCell: { width: 130, color: "#FFF", fontWeight: "bold", textAlign: "center" },
  tableRow: { flexDirection: "row", backgroundColor: "#FFF", borderRadius: 6, padding: 10, marginTop: 8, elevation: 2 },
  rowCell: { width: 130, textAlign: "center" },
  iconCell: { width: 130, alignItems: "center" },
  dropdownBox: { width: 130, paddingVertical: 7, borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: "#004AD9" },
  modalWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: "rgba(0,0,0,.5)" },
  actionModalBox: { width: "88%", backgroundColor: "#FFF", padding: 15, borderRadius: 12 },
  title: { fontWeight: "bold", fontSize: 17, marginBottom: 12, textAlign: "center" },
  closeBtn: { backgroundColor: "#0057D9", padding: 10, marginTop: 9, borderRadius: 7, alignItems: "center" },
  closeText: { color: "#FFF", fontWeight: "bold" },
  mapView: { width: "100%", height: 200, borderRadius: 8, marginVertical: 8 },
  previewImage: { width: "100%", height: 200, marginTop: 8, borderRadius: 10 },
  choiceBtn: { flexDirection: "row", alignItems: "center", marginVertical: 6 },
  choiceText: { marginLeft: 10, fontSize: 15 },
  topHeader: {
    width: "100%",
    height: 55,
    backgroundColor: "#112859",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    marginTop: 25,
  },

  topTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  infoModalBox: {
    width: "85%",
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 12,
  },
  infoText: {
    fontSize: 14,
    color: "#222",
    marginTop: 10,
    lineHeight: 22
  },
  cardContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 10,
    marginTop: 35,
  },

  summaryCard: {
    width: "48%",
    padding: 15,
    borderRadius: 12,
    elevation: 3,
  },

  cardTitle: {
    fontSize: 16,
    color: "#FFF",
    fontWeight: "600",
  },

  cardValue: {
    fontSize: 30,
    fontWeight: "900",
    color: "#FFF",
    textAlign: "right",
  },
  refreshContainer: {
    width: "100%",
    alignItems: "flex-end",
    paddingRight: 12,
    marginBottom: 5,
    marginTop: 10,
  },

  refreshBtn: {
    backgroundColor: "#0057D9",
    padding: 6,
    borderRadius: 50,
  },
});