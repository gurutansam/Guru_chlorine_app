import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getDatewiseUserCount } from '../../api';

export default function MainScreen({ navigation }) {
  const [totalCollection, setTotalCollection] = useState(0);
  const [todayCollected, setTodayCollected] = useState(0);
  const [totalPushed, setTotalPushed] = useState(0);
  const [isPushing, setIsPushing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // Area Data States
  const [huds, setHuds] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [phcs, setPhcs] = useState([]);
  const [hscs, setHscs] = useState([]);

  const [selectedHUD, setSelectedHUD] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedPHC, setSelectedPHC] = useState(null);
  const [selectedHSC, setSelectedHSC] = useState(null);

  const [showHUD, setShowHUD] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [showPHC, setShowPHC] = useState(false);
  const [showHSC, setShowHSC] = useState(false);

  // Fetch datewise counts
  const getTodayDateString = () => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const json = await AsyncStorage.getItem('user_info');
        const user = JSON.parse(json);
        if (!user?.user_id) return;

        const data = await getDatewiseUserCount(user.user_id);
        const entries = Object.entries(data || {});
        const today = getTodayDateString();

        const total = entries.reduce((sum, [, count]) => sum + count, 0);
        const todayCount = data[today] || 0;

        setTotalCollection(total);
        setTodayCollected(todayCount);
        setTotalPushed(total);
      } catch (err) {
        console.error('Failed to fetch counts:', err);
      }
    };

    fetchCounts();
  }, []);

  // ======================================================================
  // FETCH FUNCTIONS
  // ======================================================================

  const fetchHUDs = async () => {
    const res = await fetch("http://192.168.1.145:3000/dashboard/hud");
    setHuds(await res.json());
  };

  const fetchBlocks = async (hud_id) => {
    console.log("Fetching blocks for HUD:", hud_id);
    const res = await fetch("http://192.168.1.145:3000/dashboard/hud-blocks");
    const data = await res.json();

    // Filter client-side
    const filtered = data.filter(b => b.hud_id === hud_id);

    // console.log("Filtered Blocks:", filtered);
    setBlocks(filtered);
  };

  const fetchPHCs = async (block_id) => {
    // console.log("Fetching PHCs for Block:", block_id);

    // Fetch ALL PHCs
    const res = await fetch("http://192.168.1.145:3000/dashboard/phc");
    const data = await res.json();

    // Filter based on the selected block
    const filtered = data.filter(phc => phc.block_id === block_id);

    // console.log("Filtered PHCs:", filtered);
    setPhcs(filtered);
  };


  const fetchHSCs = async (phc_id) => {
    try {
      // Fetch all villages
      const res = await fetch("http://192.168.1.145:3000/dashboard/village");
      const data = await res.json();

      // Filter based on the selected PHC
      const filtered = data.filter(village => village.phc_id === phc_id);

      // console.log("Filtered Villages:", filtered);

      setHscs(filtered);
    } catch (err) {
      console.error("Failed to fetch villages:", err);
      setHscs([]);
    }
  };


  // ======================================================================
  // SELECTION HANDLERS
  // ======================================================================
  const handleHUDSelect = (hud) => {
    setSelectedHUD(hud);
    setShowHUD(false);

    // Reset children
    setSelectedBlock(null);
    setSelectedPHC(null);
    setSelectedHSC(null);

    fetchBlocks(hud.hud_id);
  };

  const handleBlockSelect = (blk) => {
    setSelectedBlock(blk);
    setShowBlock(false);

    setSelectedPHC(null);
    setSelectedHSC(null);

    fetchPHCs(blk.block_id);
  };

  const handlePHCSelect = (p) => {
    setSelectedPHC(p);
    setShowPHC(false);

    setSelectedHSC(null);

    fetchHSCs(p.phc_id);
  };

  const handleHSCSelect = (h) => {
    setSelectedHSC(h);
    setShowHSC(false);
  };

  // ======================================================================
  // UI
  // ======================================================================

  const limitedScroll = (items, renderItem) => {
    if (!items || items.length === 0) return null; // prevents unnecessary renders
    return (
      <View style={styles.dropdownList}>
        <ScrollView style={{ maxHeight: 200 }}>
          {items.map((item, index) => renderItem(item, index))}
        </ScrollView>
      </View>
    );
  };


  return (
    <View style={styles.container}>

      {/* ================================================================ */}
      {/* HEADER */}
      {/* ================================================================ */}
      <View style={styles.imageRow}>
        <Image source={require('./../../../assets/TN_logo.png')} style={styles.logoLeft} resizeMode="contain" />
        <Image source={require('../../../assets/dph.png')} style={styles.logoRight} resizeMode="contain" />
      </View>

      <Text style={styles.title}>DBC Dashboard</Text>

      {/* COUNTS CARDS */}
      <View style={styles.cardRow}>
        <View style={[styles.card, styles.squareCard, { backgroundColor: '#26A69A' }]}>
          <Text style={styles.cardTitle}>Total Data</Text>
          <Text style={styles.cardValue}>{totalCollection}</Text>
        </View>

        <View style={[styles.card, styles.squareCard, { backgroundColor: '#10b981' }]}>
          <Text style={styles.cardTitle}>Today</Text>
          <Text style={styles.cardValue}>{todayCollected}</Text>
        </View>

        <View style={[styles.card, styles.squareCard, { backgroundColor: '#f59e0b' }]}>
          <Text style={styles.cardTitle}>Pushed</Text>
          <Text style={styles.cardValue}>{totalPushed}</Text>
        </View>
      </View>

      {/* BUTTONS */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#6366f1' }]}
          onPress={() => setIsPushing(true)}
          disabled={isPushing || todayCollected === 0}
        >
          {isPushing ? <ActivityIndicator color="#fff" /> :
            <>
              <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
              <Text style={styles.pushButtonText}>Push Data</Text>
            </>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#22c55e' }]}
          onPress={() => { setModalVisible(true); fetchHUDs(); }}
        >
          <Ionicons name="document-text-outline" size={20} color="#fff" />
          <Text style={styles.pushButtonText}>Take Data</Text>
        </TouchableOpacity>
      </View>

      {/* SHOW DATA LIST */}
      <View style={styles.centeredButtonWrapper}>
        <TouchableOpacity
          style={styles.centeredButton}
          onPress={() => navigation.navigate("MosquitoDataFlow", { screen: "DataList" })}
        >
          <Ionicons name="reader-outline" size={20} color="#fff" />
          <Text style={styles.buttonText}>Show Data List</Text>
        </TouchableOpacity>
      </View>

      {/* ================================================================ */}
      {/* AREA SELECT MODAL */}
      {/* ================================================================ */}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>

            <Text style={styles.modalTitle}>Select Area</Text>

            {/* HUD */}
            <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowHUD(!showHUD)}>
              <Text style={styles.dropdownButtonText}>
                {selectedHUD ? selectedHUD.hud_name : "Select HUD"}
              </Text>
              <Ionicons name={showHUD ? "chevron-up" : "chevron-down"} size={18} color="#fff" />
            </TouchableOpacity>

            {showHUD &&
              limitedScroll(huds, (hud) => (
                <TouchableOpacity
                  key={hud.hud_id}
                  style={styles.dropdownItem}
                  onPress={() => handleHUDSelect(hud)}
                >
                  <Text style={styles.dropdownItemText}>{hud.hud_name}</Text>
                </TouchableOpacity>
              ))
            }

            {/* BLOCK */}
            {selectedHUD && (
              <>
                <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowBlock(!showBlock)}>
                  <Text style={styles.dropdownButtonText}>
                    {selectedBlock ? selectedBlock.block_name : "Select Block"}
                  </Text>
                  <Ionicons name={showBlock ? "chevron-up" : "chevron-down"} size={18} color="#fff" />
                </TouchableOpacity>

                {showBlock &&
                  limitedScroll(blocks, (blk) => (
                    <TouchableOpacity
                      key={blk.block_id}
                      style={styles.dropdownItem}
                      onPress={() => handleBlockSelect(blk)}
                    >
                      <Text style={styles.dropdownItemText}>{blk.block_name}</Text>
                    </TouchableOpacity>
                  ))
                }
              </>
            )}

            {/* PHC */}
            {selectedBlock && (
              <>
                <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowPHC(!showPHC)}>
                  <Text style={styles.dropdownButtonText}>
                    {selectedPHC ? selectedPHC.phc_name : "Select PHC"}
                  </Text>
                  <Ionicons name={showPHC ? "chevron-up" : "chevron-down"} size={18} color="#fff" />
                </TouchableOpacity>

                {showPHC &&
                  limitedScroll(phcs, (p) => (
                    <TouchableOpacity
                      key={p.phc_id}
                      style={styles.dropdownItem}
                      onPress={() => handlePHCSelect(p)}
                    >
                      <Text style={styles.dropdownItemText}>{p.phc_name}</Text>
                    </TouchableOpacity>
                  ))
                }
              </>
            )}

            {/* HSC */}
            {selectedPHC && (
              <>
                <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowHSC(!showHSC)}>
                  <Text style={styles.dropdownButtonText}>
                    {selectedHSC ? selectedHSC.village_name : "Select Village"}
                  </Text>
                  <Ionicons name={showHSC ? "chevron-up" : "chevron-down"} size={18} color="#fff" />
                </TouchableOpacity>

                {showHSC &&
                  limitedScroll(hscs, (h, index) => (
                    <TouchableOpacity
                      key={`${h.village_id}_${index}`} // <-- make key unique for React
                      style={styles.dropdownItem}
                      onPress={() => handleHSCSelect(h)}
                    >
                      <Text style={styles.dropdownItemText}>{h.village_name}</Text>
                    </TouchableOpacity>
                  ))
                }
              </>
            )}


            {/* CONTINUE BUTTON */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>

              {/* Continue Button */}
              <TouchableOpacity
                style={[
                  styles.areaButton,
                  {
                    backgroundColor: (selectedHUD || selectedBlock || selectedPHC || selectedHSC) ? 'green' : '#94a3b8', // active if any selected
                    flex: 1,
                    marginRight: 5,
                  }
                ]}
                disabled={!(selectedHUD || selectedBlock || selectedPHC || selectedHSC)}
                onPress={() => {
                  setModalVisible(false);
                  navigation.navigate("DataCollection", {
                    formData: {
                      hud_name: selectedHUD?.hud_name || '',
                      block_name: selectedBlock?.block_name || '',
                      phc_name: selectedPHC?.phc_name || '',
                      village_name: selectedHSC?.village_name || '',
                      selected_area: [
                        selectedHUD?.hud_name,
                        selectedBlock?.block_name,
                        selectedPHC?.phc_name,
                        selectedHSC?.village_name
                      ].filter(Boolean).join(' > ') || 'None'

                    }
                  });
                }}
              >
                <Text style={styles.areaButtonText}>
                  {[
                    selectedHUD?.hud_name,
                    selectedBlock?.block_name,
                    selectedPHC?.phc_name,
                    selectedHSC?.village_name
                  ].filter(Boolean).join(' > ') || 'Continue'}
                </Text>

              </TouchableOpacity>

              {/* Close Button */}
              <TouchableOpacity
                style={[
                  styles.areaButton,
                  { backgroundColor: 'red', flex: 1, marginLeft: 5 }
                ]}
                onPress={() => {
                  setModalVisible(false);

                  // Reset all dropdown selections
                  setSelectedHUD(null);
                  setSelectedBlock(null);
                  setSelectedPHC(null);
                  setSelectedHSC(null);

                  setShowHUD(false);
                  setShowBlock(false);
                  setShowPHC(false);
                  setShowHSC(false);
                }}
              >
                <Text style={styles.areaButtonText}>Cancel</Text>
              </TouchableOpacity>

            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ======================================================================
// STYLES
// ======================================================================
const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 40, backgroundColor: '#f9fafb' },

  imageRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 26 },
  logoLeft: { width: 120, height: 120 },
  logoRight: { width: 120, height: 120 },

  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },

  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  card: { borderRadius: 12, padding: 20, elevation: 4 },
  cardTitle: { color: '#fff', fontSize: 16 },
  cardValue: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  squareCard: { width: '30%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },

  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  actionButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', padding: 14, borderRadius: 10, marginHorizontal: 5 },
  pushButtonText: { color: '#fff', fontSize: 16, marginLeft: 8 },

  centeredButtonWrapper: { alignItems: 'center', marginVertical: 10 },
  centeredButton: { flexDirection: 'row', backgroundColor: '#3b82f6', padding: 12, borderRadius: 10, width: '70%', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 16, marginLeft: 8 },

  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', paddingHorizontal: 20 },
  modalContainer: { backgroundColor: '#fff', padding: 20, borderRadius: 10 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },

  areaButton: { padding: 12, borderRadius: 8, marginTop: 10 },
  areaButtonText: { color: '#fff', textAlign: 'center', fontSize: 16 },

  dropdownButton: {
    backgroundColor: "#2563eb",
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
  },

  dropdownButtonText: { color: "#fff", fontSize: 16 },

  dropdownList: {
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    marginBottom: 10,
    paddingBottom: 6,
    elevation: 4,
  },

  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },

  dropdownItemText: {
    fontSize: 15,
    color: "#111",
  },
  areaButton: { padding: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

});
