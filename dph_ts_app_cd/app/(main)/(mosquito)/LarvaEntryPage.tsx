import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { useRoute, useNavigation } from "@react-navigation/native";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_URL } from "../../../services/api";

// ─── Types ────────────────────────────────────────────────────────────────────
type UserInfo = {
  user_id: string;
  username: string;
  phone_number?: string;
  block_name: string;
  hud_name?: string;
  district_name?: string;
  hub_name?: string;
  role?: string;
};

type SourceItem = {
  id: number;
  name: string;
};

type SourceData = {
  id: number;
  sourceNo: number | null;
  sourceName: string;
  count: string;
};

type GeoLocation = {
  latitude: number;
  longitude: number;
};

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: "#0A0F1E",
  bgCard: "#111827",
  bgElevated: "#1C2538",
  bgInput: "#161D2F",
  accent: "#00D4AA",
  accentDim: "rgba(0,212,170,0.12)",
  accentMid: "rgba(0,212,170,0.25)",
  success: "#00D4AA",
  successDim: "rgba(0,212,170,0.10)",
  warning: "#F59E0B",
  warningDim: "rgba(245,158,11,0.12)",
  error: "#FF5370",
  errorDim: "rgba(255,83,112,0.12)",
  textPrimary: "#F0F4FF",
  textSecondary: "#8899BB",
  textMuted: "#455070",
  border: "rgba(255,255,255,0.07)",
  borderAccent: "rgba(0,212,170,0.35)",
  overlay: "rgba(0,8,20,0.85)",
};

const AVAILABLE_SOURCES: SourceItem[] = [
  { id: 1, name: "Mud Pot" },
  { id: 2, name: "Grinding Stone" },
  { id: 3, name: "Upper/Lower Water Storage Tank" },
  { id: 4, name: "Drum / Barrel" },
  { id: 5, name: "Coconut Shells" },
  { id: 6, name: "Flower Pots" },
  { id: 7, name: "Concrete Pots" },
  { id: 8, name: "Plastic Items" },
  { id: 9, name: "Refrigerator / Fridge" },
  { id: 10, name: "Tyre" },
  { id: 11, name: "Others" },
];

const WORK_OPTIONS = [
  "Fever", "Dengue", "Routine ATP", "Scrub", "Scrub Typus",
  "Malaria", "Filaria", "Chikungunya", "JE", "Lepto", "Rabies",
];

// ─── Chip Badge ────────────────────────────────────────────────────────────────
const Chip = ({ label, color = C.accent }: { label: string; color?: string }) => (
  <View style={[chipStyles.wrap, { borderColor: color + "44", backgroundColor: color + "18" }]}>
    <View style={[chipStyles.dot, { backgroundColor: color }]} />
    <Text style={[chipStyles.text, { color }]}>{label}</Text>
  </View>
);
const chipStyles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, marginRight: 5 },
  text: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
});

// ─── Section Header ────────────────────────────────────────────────────────────
const SectionHeader = ({
  icon, title, badge,
}: { icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]; title: string; badge?: number }) => (
  <View style={sh.row}>
    <View style={sh.iconWrap}>
      <MaterialCommunityIcons name={icon} size={16} color={C.accent} />
    </View>
    <Text style={sh.title}>{title}</Text>
    {badge !== undefined && (
      <View style={sh.badge}><Text style={sh.badgeText}>{badge}</Text></View>
    )}
  </View>
);
const sh = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  iconWrap: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.accentDim, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.borderAccent },
  title: { fontSize: 14, fontWeight: "700", color: C.textPrimary, flex: 1, letterSpacing: 0.3 },
  badge: { backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.borderAccent, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: "700", color: C.accent },
});

// ─── Info Row ──────────────────────────────────────────────────────────────────
const InfoRow = ({ label, value, icon }: { label: string; value: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"] }) => (
  <View style={ir.row}>
    <MaterialCommunityIcons name={icon} size={14} color={C.accent} style={{ marginTop: 1 }} />
    <View style={{ flex: 1 }}>
      <Text style={ir.label}>{label}</Text>
      <Text style={ir.value}>{value || "—"}</Text>
    </View>
  </View>
);
const ir = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  label: { fontSize: 10, color: C.textMuted, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 },
  value: { fontSize: 13, color: C.textPrimary, fontWeight: "600" },
});

// ─── Selectable Dropdown Field ─────────────────────────────────────────────────
type SelectableFieldProps = {
  label: string;
  value: string | null;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
};

const SelectableField: React.FC<SelectableFieldProps> = ({
  label, value, icon, onPress, isLoading = false, disabled = false,
}) => (
  <TouchableOpacity
    style={[sf.wrap, disabled && sf.wrapDisabled]}
    onPress={onPress}
    activeOpacity={disabled || isLoading ? 1 : 0.7}
    disabled={disabled || isLoading}
  >
    <View style={sf.header}>
      <MaterialCommunityIcons name={icon} size={14} color={disabled ? C.textMuted : C.accent} />
      <Text style={[sf.label, disabled && { color: C.textMuted }]}>{label}</Text>
    </View>
    <View style={[sf.box, disabled && sf.boxDisabled]}>
      {isLoading ? (
        <>
          <ActivityIndicator size="small" color={C.accent} style={{ marginRight: 8 }} />
          <Text style={[sf.text, { color: C.textMuted }]}>Loading...</Text>
        </>
      ) : (
        <>
          <Text style={[sf.text, !value && { color: C.textMuted }, disabled && { color: C.textMuted }]}>
            {disabled ? "Select PHC first" : (value || "Tap to select")}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={disabled ? C.textMuted : C.accent} />
        </>
      )}
    </View>
  </TouchableOpacity>
);
const sf = StyleSheet.create({
  wrap: { marginBottom: 10 },
  wrapDisabled: { opacity: 0.5 },
  header: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  label: { fontSize: 11, fontWeight: "600", color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  box: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.bgInput, borderWidth: 1.5, borderColor: C.border, borderRadius: 10 },
  boxDisabled: { backgroundColor: C.bgElevated, borderColor: C.border },
  text: { fontSize: 13, color: C.textSecondary, fontWeight: "500", flex: 1 },
});

// ─── String-based Dropdown Modal (for PHC & HSC from API) ─────────────────────
type StringDropdownModalProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: string[];
  onSelect: (value: string) => void;
  selectedValue: string | null;
};

const StringDropdownModal: React.FC<StringDropdownModalProps> = ({
  visible, onClose, title, options, onSelect, selectedValue,
}) => (
  <Modal visible={visible} transparent animationType="slide">
    <TouchableOpacity style={sdrop.backdrop} activeOpacity={1} onPress={onClose}>
      <View style={sdrop.container}>
        <View style={sdrop.content}>
          <View style={sdrop.header}>
            <Text style={sdrop.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={C.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
            {options.length > 0 ? (
              options.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={[sdrop.option, selectedValue === item && sdrop.optionActive]}
                  onPress={() => { onSelect(item); onClose(); }}
                  activeOpacity={0.7}
                >
                  <View style={[sdrop.dot, selectedValue === item && sdrop.dotActive]} />
                  <Text style={[sdrop.optionText, selectedValue === item && sdrop.optionTextActive]}>
                    {item}
                  </Text>
                  {selectedValue === item && (
                    <Ionicons name="checkmark" size={18} color={C.accent} />
                  )}
                </TouchableOpacity>
              ))
            ) : (
              <View style={sdrop.emptyState}>
                <MaterialCommunityIcons name="database-off-outline" size={28} color={C.textMuted} />
                <Text style={sdrop.emptyText}>No options available</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </TouchableOpacity>
  </Modal>
);
const sdrop = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: C.overlay, justifyContent: "flex-end" },
  container: { flex: 1, justifyContent: "flex-end" },
  content: { backgroundColor: C.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: C.borderAccent, borderBottomWidth: 0, paddingVertical: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 16, fontWeight: "800", color: C.textPrimary },
  option: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 },
  optionActive: { backgroundColor: C.accentDim },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.textMuted },
  dotActive: { backgroundColor: C.accent },
  optionText: { fontSize: 14, color: C.textSecondary, fontWeight: "500", flex: 1 },
  optionTextActive: { color: C.accent, fontWeight: "700" },
  emptyState: { alignItems: "center", paddingVertical: 32, gap: 10 },
  emptyText: { fontSize: 14, color: C.textMuted, fontWeight: "500" },
});

// ─── Work Dropdown ─────────────────────────────────────────────────────────────
const WorkDropdown = ({
  value, isOpen, onToggle, options, onSelect,
}: { value: string; isOpen: boolean; onToggle: () => void; options: string[]; onSelect: (v: string) => void }) => {
  const isSelected = value !== "Select Work Type";
  return (
    <>
      {/* Trigger button */}
      <TouchableOpacity
        style={[wd.btn, isSelected && wd.btnSelected]}
        onPress={onToggle}
        activeOpacity={0.8}
      >
        <View style={{ flex: 1 }}>
          <Text style={wd.label}>Work Type</Text>
          <Text style={[wd.value, isSelected && { color: C.textPrimary }]}>{value}</Text>
        </View>
        <Ionicons
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={18}
          color={isSelected ? C.accent : C.textMuted}
        />
      </TouchableOpacity>

      {/* Modal bottom sheet — same pattern as StringDropdownModal */}
      <Modal visible={isOpen} transparent animationType="slide">
        <TouchableOpacity style={wd.backdrop} activeOpacity={1} onPress={onToggle}>
          <View style={wd.sheet}>
            {/* Header */}
            <View style={wd.header}>
              <Text style={wd.headerTitle}>Select Work Type</Text>
              <TouchableOpacity onPress={onToggle}>
                <Ionicons name="close" size={24} color={C.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[wd.item, value === opt && wd.itemActive]}
                  onPress={() => { onSelect(opt); onToggle(); }}
                  activeOpacity={0.7}
                >
                  <View style={[wd.dot, value === opt && wd.dotActive]} />
                  <Text style={[wd.itemText, value === opt && { color: C.accent, fontWeight: "700" }]}>
                    {opt}
                  </Text>
                  {value === opt && <Ionicons name="checkmark" size={18} color={C.accent} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};
const wd = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.bgInput, borderWidth: 1.5, borderColor: C.border, borderRadius: 14, gap: 10 },
  btnSelected: { borderColor: C.borderAccent, backgroundColor: C.accentDim },
  label: { fontSize: 10, color: C.textMuted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 },
  value: { fontSize: 14, fontWeight: "700", color: C.textMuted },
  // Modal sheet
  backdrop: { flex: 1, backgroundColor: C.overlay, justifyContent: "flex-end" },
  sheet: { backgroundColor: C.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: C.borderAccent, borderBottomWidth: 0, paddingVertical: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 16, fontWeight: "800", color: C.textPrimary },
  item: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 },
  itemActive: { backgroundColor: C.accentDim },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.textMuted },
  dotActive: { backgroundColor: C.accent },
  itemText: { fontSize: 14, color: C.textSecondary, fontWeight: "500", flex: 1 },
});

// ─── Source Dropdown Modal ─────────────────────────────────────────────────────
type SourceDropdownModalProps = {
  visible: boolean;
  onClose: () => void;
  options: SourceItem[];
  onSelect: (source: SourceItem) => void;
  selectedId: number | null;
};

const SourceDropdownModal: React.FC<SourceDropdownModalProps> = ({
  visible, onClose, options, onSelect, selectedId,
}) => (
  <Modal visible={visible} transparent animationType="fade">
    <TouchableOpacity style={sdm.backdrop} activeOpacity={1} onPress={onClose}>
      <View style={sdm.container}>
        <View style={sdm.content}>
          <View style={sdm.header}>
            <Text style={sdm.title}>Select Source</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={C.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
            {options.map((source) => (
              <TouchableOpacity
                key={source.id}
                style={[sdm.option, selectedId === source.id && sdm.optionActive]}
                onPress={() => { onSelect(source); onClose(); }}
                activeOpacity={0.7}
              >
                <View style={[sdm.dot, selectedId === source.id && sdm.dotActive]} />
                <Text style={[sdm.optionText, selectedId === source.id && sdm.optionTextActive]}>
                  {source.name}
                </Text>
                {selectedId === source.id && (
                  <Ionicons name="checkmark" size={18} color={C.accent} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </TouchableOpacity>
  </Modal>
);
const sdm = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: C.overlay, justifyContent: "flex-end" },
  container: { flex: 1, justifyContent: "flex-end" },
  content: { backgroundColor: C.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: C.borderAccent, borderBottomWidth: 0, paddingVertical: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 16, fontWeight: "800", color: C.textPrimary },
  option: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 },
  optionActive: { backgroundColor: C.accentDim },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.textMuted },
  dotActive: { backgroundColor: C.accent },
  optionText: { fontSize: 14, color: C.textSecondary, fontWeight: "500", flex: 1 },
  optionTextActive: { color: C.accent, fontWeight: "700" },
});

// ─── Source Row ────────────────────────────────────────────────────────────────
type SourceRowProps = {
  row: SourceData;
  index: number;
  onSourceSelect: (source: SourceItem) => void;
  onCountChange: (count: string) => void;
  onDelete: () => void;
  filteredSources: SourceItem[];
  isDropdownOpen: boolean;
  onDropdownToggle: () => void;
};

const SourceRow: React.FC<SourceRowProps> = ({
  row, index, onSourceSelect, onCountChange, onDelete,
  filteredSources, isDropdownOpen, onDropdownToggle,
}) => {
  const selected = AVAILABLE_SOURCES.find((s) => s.id === row.sourceNo);
  return (
    <>
      <View style={sr.row}>
        <View style={sr.slNo}>
          <Text style={sr.slNoText}>{row.id}</Text>
        </View>
        <TouchableOpacity
          style={[sr.nameBtn, isDropdownOpen && sr.nameBtnActive]}
          onPress={onDropdownToggle}
          activeOpacity={0.7}
        >
          <Text style={[sr.nameBtnText, !selected && { color: C.textMuted }]} numberOfLines={1}>
            {selected?.name || "Tap to select"}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={C.accent} />
        </TouchableOpacity>
        <TextInput
          style={sr.countInput}
          keyboardType="numeric"
          placeholder="0"
          value={row.count}
          onChangeText={onCountChange}
          placeholderTextColor={C.textMuted}
        />
        <TouchableOpacity style={sr.deleteBtn} onPress={onDelete} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={15} color={C.error} />
        </TouchableOpacity>
      </View>
      <SourceDropdownModal
        visible={isDropdownOpen}
        onClose={onDropdownToggle}
        options={filteredSources}
        onSelect={onSourceSelect}
        selectedId={row.sourceNo}
      />
    </>
  );
};
const sr = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, gap: 8 },
  slNo: { width: 26, height: 26, borderRadius: 7, backgroundColor: C.accentDim, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.borderAccent },
  slNoText: { fontSize: 11, fontWeight: "800", color: C.accent },
  nameBtn: { flex: 1.5, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 8, backgroundColor: C.bgInput, borderWidth: 1, borderColor: C.border, borderRadius: 9, gap: 6 },
  nameBtnActive: { borderColor: C.accent, backgroundColor: C.accentDim },
  nameBtnText: { fontSize: 11, fontWeight: "600", color: C.textPrimary, flex: 1 },
  countInput: { flex: 0.8, height: 36, backgroundColor: C.bgInput, borderWidth: 1, borderColor: C.border, borderRadius: 9, fontSize: 14, fontWeight: "700", color: C.accent, textAlign: "center" },
  deleteBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.errorDim, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.error + "44" },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function LarvaEntryPage(): React.ReactNode {
  const route = useRoute();
  const navigation = useNavigation();

  // User Info
  const [userId, setUserId] = useState("");
  const [hiName, setHiName] = useState("Loading...");
  const [mobileNo, setMobileNo] = useState("");
  const [blockName, setBlockName] = useState("");
  const [districtName, setDistrictName] = useState("");
  const [role, setRole] = useState("");

  // PHC & Village (string-based, matching HiMonitoringForm pattern)
  const [phcName, setPhcName] = useState<string | null>(null);
  const [villageName, setVillageName] = useState<string | null>(null);

  // API data
  const [allPhcList, setAllPhcList] = useState<any[]>([]);
  const [allVillageList, setAllVillageList] = useState<any[]>([]);
  const [filteredPhcList, setFilteredPhcList] = useState<string[]>([]);
  const [filteredVillageList, setFilteredVillageList] = useState<string[]>([]);
  const [loadingPhc, setLoadingPhc] = useState(true);
  const [loadingVillage, setLoadingVillage] = useState(false);

  // Modal visibility
  const [phcModalOpen, setPhcModalOpen] = useState(false);
  const [hscModalOpen, setHscModalOpen] = useState(false);

  // Form fields
  const [overallSourceCount, setOverallSourceCount] = useState("");
  const [sourceCount, setSourceCount] = useState("");
  const [sourceData, setSourceData] = useState<SourceData[]>([]);
  const [workType, setWorkType] = useState("Select Work Type");
  const [image, setImage] = useState<string | null>(null);
  const [geoLocation, setGeoLocation] = useState<GeoLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [workDropdownOpen, setWorkDropdownOpen] = useState(false);
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  const totalEntered = sourceData.reduce((s, r) => s + (Number(r.count) || 0), 0);

  const isFormValid =
    image && geoLocation &&
    workType !== "Select Work Type" &&
    sourceCount !== "" &&
    totalEntered === Number(sourceCount);

  const progressPct = (() => {
    let score = 0;
    if (image) score += 25;
    if (geoLocation) score += 25;
    if (workType !== "Select Work Type") score += 25;
    if (sourceCount !== "" && totalEntered === Number(sourceCount)) score += 25;
    return score;
  })();

  // ── Animations ─────────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 14, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // ── Fetch PHC & Village lists on mount (same as HiMonitoringForm) ──────────
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        setLoadingPhc(true);
        const [phcRes, villageRes] = await Promise.all([
          fetch(`${BASE_URL}/dashboard/phc`),
          fetch(`${BASE_URL}/dashboard/village`),
        ]);
        const phcData = await phcRes.json();
        const villageData = await villageRes.json();
        setAllPhcList(phcData.data || phcData || []);
        setAllVillageList(villageData.data || villageData || []);
      } catch (err) {
        console.error("Dropdown fetch error", err);
        Alert.alert("Error", "Failed to load location data. Please try again.");
      } finally {
        setLoadingPhc(false);
      }
    };
    fetchDropdownData();
  }, []);

  // ── Load user info ─────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem("user_info");
        if (stored) {
          const u: UserInfo = JSON.parse(stored);
          setUserId(u.user_id || "");
          setHiName(u.username || "HI User");
          setMobileNo(u.phone_number || "");
          setBlockName(u.block_name || "");
          setDistrictName(u.hud_name || u.district_name || u.hub_name || "");
          setRole(u.role || "");
        }
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, []);

  // ── Filter PHC list by blockName (once both are available) ─────────────────
  useEffect(() => {
    if (blockName && allPhcList.length > 0) {
      const filtered = allPhcList
        .filter((p) => p.block_name?.toLowerCase() === blockName.toLowerCase())
        .map((p) => p.phc_name as string)
        .filter(Boolean);
      setFilteredPhcList(filtered);
    } else {
      setFilteredPhcList([]);
    }
  }, [blockName, allPhcList]);

  // ── Filter Village list when PHC changes ───────────────────────────────────
  useEffect(() => {
    if (phcName && allVillageList.length > 0) {
      setLoadingVillage(true);
      const timer = setTimeout(() => {
        const filtered = allVillageList
          .filter((v) => v.phc_name?.toLowerCase() === phcName.toLowerCase())
          .map((v) => v.village_name as string)
          .filter(Boolean);
        setFilteredVillageList(filtered);
        setLoadingVillage(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setFilteredVillageList([]);
      setLoadingVillage(false);
    }
  }, [phcName, allVillageList]);

  // ── Permissions ────────────────────────────────────────────────────────────
  useEffect(() => {
    ImagePicker.requestCameraPermissionsAsync();
    Location.requestForegroundPermissionsAsync();
  }, []);

  // ── Sync Larval Sources when Active Count is 0 ─────────────────────────────
  useEffect(() => {
    if (sourceCount === "0") {
      setSourceData([]);
    }
  }, [sourceCount]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handlePhcSelect = (name: string) => {
    setPhcName(name);
    // Reset village when PHC changes
    setVillageName(null);
  };

  const handleVillageSelect = (name: string) => {
    setVillageName(name);
  };

  const handleAddRow = () => {
    if (!sourceCount) { Alert.alert("Required", "Please enter Active Sources count first."); return; }
    if (totalEntered >= Number(sourceCount)) { Alert.alert("Limit Reached", "All active sources accounted for."); return; }
    setSourceData(p => [...p, { id: p.length + 1, sourceNo: null, sourceName: "", count: "" }]);
  };

  const handleDeleteRow = (i: number) => {
    setSourceData(prev => prev.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, id: idx + 1 })));
  };

  const handleSourceUpdate = (i: number, source: SourceItem) => {
    const upd = [...sourceData];
    upd[i].sourceNo = source.id;
    upd[i].sourceName = source.name;
    setSourceData(upd);
  };

  const openCamera = async () => {
    setLoading(true);
    try {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      const loc = await Location.requestForegroundPermissionsAsync();
      if (cam.status !== "granted" || loc.status !== "granted") {
        Alert.alert("Permissions Required", "Camera & Location access needed.");
        setLoading(false); return;
      }
      try {
        const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setGeoLocation({ latitude: l.coords.latitude, longitude: l.coords.longitude });
      } catch (e) { console.error(e); }
      const photo = await ImagePicker.launchCameraAsync({ quality: 1, base64: false });
      if (photo.canceled) { setLoading(false); return; }
      const m = await ImageManipulator.manipulateAsync(
        photo.assets[0].uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      setImage(`data:image/jpeg;base64,${m.base64}`);
    } catch { Alert.alert("Error", "Unable to open camera"); }
    finally { setLoading(false); }
  };

  const submitEntry = async () => {
    if (!isFormValid) { Alert.alert("Incomplete", "Please complete all required fields."); return; }
    Alert.alert("Confirm Submission", `Submit entry with ${totalEntered} active sources?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Submit", onPress: async () => {
          try {
            setLoading(true);
            const now = new Date();
            const payload = {
              user_id: userId, role, hi_name: hiName, mobile_no: mobileNo,
              block_name: blockName, district_name: districtName,
              phc_name: phcName,
              village_name: villageName,
              work_type: workType,
              image_base64: image,
              latitude: geoLocation?.latitude,
              longitude: geoLocation?.longitude,
              sources: sourceData,
              active_larval_source_count: sourceCount,
              overallSourceCount,
              entry_date: now.toISOString().split("T")[0],
              entry_time: now.toLocaleTimeString([], { hour12: false }),
            };
            const special = ["special_user", "DHO", "chl_admin", "mos_admin", "block_user"];
            const url = special.includes(role)
              ? `${BASE_URL}/dashboard/dbc-special-data-entry-larval`
              : `${BASE_URL}/dashboard/save-larva-entry`;

            console.log("Submitting to URL:", url);
            console.log("Payload:", JSON.stringify({ ...payload, image_base64: "DATA_REDACTED_FOR_CLARITY" }, null, 2));

            const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const data = await res.json();

            console.log("Response Status:", res.status);
            console.log("Response Data:", data);

            if (res.ok) {
              Alert.alert("Success 🎉", "Larva entry saved successfully!", [
                { text: "OK", onPress: () => { resetForm(); navigation.goBack(); } }
              ]);
            } else Alert.alert("Error", data.message || "Failed to save entry");
          } catch (error) {
            console.error("Submission error:", error);
            Alert.alert("Error", "Cannot connect to server");
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setImage(null); setSourceData([]); setSourceCount(""); setOverallSourceCount("");
    setGeoLocation(null); setWorkType("Select Work Type");
    setPhcName(null); setVillageName(null);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Top Bar ─────────────────────────────────────────────────── */}
          <Animated.View style={[s.topBar, { opacity: fadeAnim }]}>
            <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={20} color={C.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.topLabel}>FIELD OPERATIONS</Text>
              <Text style={s.topTitle}>Larva Entry</Text>
            </View>
            <Chip
              label={isFormValid ? "READY" : `${progressPct}%`}
              color={isFormValid ? C.success : C.warning}
            />
          </Animated.View>

          {/* ── Progress Bar ─────────────────────────────────────────────── */}
          <View style={s.progressWrap}>
            <View style={s.progressTrack}>
              <Animated.View style={[s.progressFill, { width: `${progressPct}%` as any }]} />
            </View>
            <Text style={s.progressLabel}>Form completion: {progressPct}%</Text>
          </View>

          <Animated.View style={[s.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

            {/* ── Hero Banner ──────────────────────────────────────────── */}
            <View style={s.heroBanner}>
              <View style={s.heroBannerAccent} />
              <View style={s.heroBugIcon}>
                <MaterialCommunityIcons name="bug-check-outline" size={26} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.heroTitle}>Larval Inspection</Text>
                <Text style={s.heroSub}>Source tracking & geo-tagged evidence</Text>
              </View>
              <View style={s.heroStats}>
                <Text style={s.heroStatNum}>{sourceData.length}</Text>
                <Text style={s.heroStatLabel}>Sources</Text>
              </View>
            </View>

            {/* ── Officer Details ──────────────────────────────────────── */}
            <View style={s.card}>
              <SectionHeader icon="account-badge-outline" title="Officer Details" />
              <View style={s.infoGrid}>
                <InfoRow label="HI Name" value={hiName} icon="account-circle-outline" />
                {blockName && <InfoRow label="Block" value={blockName} icon="office-building-outline" />}
                {districtName && <InfoRow label="District" value={districtName} icon="map-marker-outline" />}
              </View>
            </View>

            {/* ── Location (PHC & HSC dropdowns) ──────────────────────── */}
            <View style={s.card}>
              <SectionHeader icon="map-search-outline" title="Location" />

              {/* PHC */}
              <SelectableField
                label="PHC"
                value={phcName}
                icon="hospital-building"
                isLoading={loadingPhc}
                onPress={() => setPhcModalOpen(true)}
                disabled={loadingPhc}
              />

              {/* HSC / Village — only visible after PHC is selected */}
              {phcName && (
                <SelectableField
                  label="Village / HSC"
                  value={villageName}
                  icon="home-city-outline"
                  isLoading={loadingVillage}
                  onPress={() => setHscModalOpen(true)}
                  disabled={loadingVillage}
                />
              )}

              {/* Helper hint */}
              {!phcName && !loadingPhc && (
                <View style={s.helperText}>
                  <Ionicons name="information-circle-outline" size={16} color={C.warning} />
                  <Text style={s.helperTextContent}>Select PHC first to unlock Village / HSC</Text>
                </View>
              )}
            </View>

            {/* ── PHC Modal ────────────────────────────────────────────── */}
            <StringDropdownModal
              visible={phcModalOpen}
              onClose={() => setPhcModalOpen(false)}
              title="Select PHC"
              options={filteredPhcList}
              onSelect={handlePhcSelect}
              selectedValue={phcName}
            />

            {/* ── Village / HSC Modal ──────────────────────────────────── */}
            <StringDropdownModal
              visible={hscModalOpen}
              onClose={() => setHscModalOpen(false)}
              title="Select Village / HSC"
              options={filteredVillageList}
              onSelect={handleVillageSelect}
              selectedValue={villageName}
            />

            {/* ── Source Count ─────────────────────────────────────────── */}
            <View style={s.card}>
              <SectionHeader icon="counter" title="Source Count" />
              <View style={s.row2}>
                <View style={s.half}>
                  <Text style={s.fieldLabel}>Overall Sources</Text>
                  <TextInput
                    style={s.input}
                    keyboardType="numeric"
                    placeholder="e.g. 50"
                    value={overallSourceCount}
                    onChangeText={setOverallSourceCount}
                    placeholderTextColor={C.textMuted}
                  />
                </View>
                <View style={s.half}>
                  <Text style={s.fieldLabel}>Active Sources</Text>
                  <TextInput
                    style={[s.input, sourceCount ? { borderColor: C.borderAccent } : {}]}
                    keyboardType="numeric"
                    placeholder="e.g. 10"
                    value={sourceCount}
                    onChangeText={setSourceCount}
                    placeholderTextColor={C.textMuted}
                  />
                </View>
              </View>
              {sourceCount && totalEntered !== Number(sourceCount) && (
                <View style={s.alertBox}>
                  <Ionicons name="warning-outline" size={14} color={C.error} />
                  <Text style={s.alertText}>
                    {totalEntered} entered · {Number(sourceCount) - totalEntered} remaining
                  </Text>
                </View>
              )}
              {sourceCount !== "" && totalEntered === Number(sourceCount) && (
                <View style={[s.alertBox, { backgroundColor: C.successDim, borderColor: C.accent + "44" }]}>
                  <Ionicons name="checkmark-circle-outline" size={14} color={C.success} />
                  <Text style={[s.alertText, { color: C.success }]}>
                    {totalEntered === 0 ? "No active sources found" : `All ${totalEntered} sources accounted for`}
                  </Text>
                </View>
              )}
            </View>

            {/* ── Sources Table ─────────────────────────────────────────── */}
            <View style={s.card}>
              <SectionHeader icon="clipboard-list-outline" title="Larval Sources" badge={sourceData.length} />

              {sourceData.length > 0 ? (
                <>
                  <View style={s.tableHead}>
                    <Text style={[s.tableHeadCell, { width: 34 }]}>SL</Text>
                    <Text style={[s.tableHeadCell, { flex: 1.5 }]}>Source Name</Text>
                    <Text style={[s.tableHeadCell, { flex: 0.8 }]}>Count</Text>
                    <Text style={[s.tableHeadCell, { width: 36 }]}>Del</Text>
                  </View>
                  <View style={s.tableBody}>
                    {sourceData.map((row, idx) => {
                      const filtered = AVAILABLE_SOURCES.filter(
                        opt => !sourceData.some((d, i) => d.sourceNo === opt.id && i !== idx)
                      );
                      return (
                        <SourceRow
                          key={idx} row={row} index={idx}
                          onSourceSelect={source => handleSourceUpdate(idx, source)}
                          onCountChange={c => {
                            const upd = [...sourceData];
                            upd[idx].count = c;
                            setSourceData(upd);
                          }}
                          onDelete={() => handleDeleteRow(idx)}
                          filteredSources={filtered}
                          isDropdownOpen={openDropdownIndex === idx}
                          onDropdownToggle={() => setOpenDropdownIndex(openDropdownIndex === idx ? null : idx)}
                        />
                      );
                    })}
                    <View style={s.totalRow}>
                      <View style={{ width: 34 }} />
                      <Text style={[s.totalLabel, { flex: 1.5 }]}>Total</Text>
                      <Text style={[s.totalValue, { flex: 0.8 }]}>{totalEntered}</Text>
                      <View style={{ width: 36 }} />
                    </View>
                  </View>
                </>
              ) : (
                <View style={s.emptyState}>
                  <MaterialCommunityIcons name="playlist-plus" size={32} color={C.textMuted} />
                  <Text style={s.emptyTitle}>No sources added</Text>
                  <Text style={s.emptySub}>Enter active source count, then add rows</Text>
                </View>
              )}

              <TouchableOpacity
                style={[s.addBtn, (!sourceCount || totalEntered >= Number(sourceCount)) && s.addBtnDisabled]}
                onPress={handleAddRow}
                disabled={!sourceCount || totalEntered >= Number(sourceCount)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={18} color={(!sourceCount || totalEntered >= Number(sourceCount)) ? C.textMuted : C.bg} />
                <Text style={[s.addBtnText, (!sourceCount || totalEntered >= Number(sourceCount)) && { color: C.textMuted }]}>
                  Add Source Row
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── Work Type ─────────────────────────────────────────────── */}
            <View style={s.card}>
              <SectionHeader icon="briefcase-outline" title="Work Type" />
              <WorkDropdown
                value={workType}
                isOpen={workDropdownOpen}
                onToggle={() => setWorkDropdownOpen(v => !v)}
                options={WORK_OPTIONS}
                onSelect={v => { setWorkType(v); setWorkDropdownOpen(false); }}
              />
            </View>

            {/* ── Capture & Location ────────────────────────────────────── */}
            <View style={s.card}>
              <SectionHeader icon="camera-outline" title="Capture & Location" />
              <TouchableOpacity
                style={[s.cameraBtn, image && s.cameraBtnDone]}
                onPress={openCamera}
                disabled={loading}
                activeOpacity={0.8}
              >
                <View style={[s.cameraIconWrap, image && { backgroundColor: C.accentDim }]}>
                  <Ionicons name={image ? "camera" : "camera-outline"} size={22} color={image ? C.accent : C.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cameraBtnTitle, image && { color: C.accent }]}>
                    {image ? "Photo Captured" : "Take a Photo"}
                  </Text>
                  <Text style={s.cameraBtnSub}>
                    {image ? "Tap to retake" : "Opens camera + captures GPS"}
                  </Text>
                </View>
                {image
                  ? <Ionicons name="checkmark-circle" size={20} color={C.success} />
                  : <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
                }
              </TouchableOpacity>

              {image && (
                <View style={s.imageWrap}>
                  <Image source={{ uri: image }} style={s.imagePreview} resizeMode="cover" />
                  <View style={s.imageOverlay}>
                    <Chip label="CAPTURED" color={C.success} />
                  </View>
                </View>
              )}

              {geoLocation ? (
                <View style={s.locationSuccess}>
                  <View style={s.locationPing} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.locationSuccessLabel}>GPS Location Acquired</Text>
                    <Text style={s.locationCoords}>
                      {geoLocation.latitude.toFixed(6)}, {geoLocation.longitude.toFixed(6)}
                    </Text>
                  </View>
                  <Ionicons name="navigate" size={16} color={C.accent} />
                </View>
              ) : (
                <View style={s.locationPending}>
                  <Ionicons name="locate-outline" size={16} color={C.textMuted} />
                  <Text style={s.locationPendingText}>Waiting for GPS fix...</Text>
                </View>
              )}
            </View>

            {/* ── Action Buttons ────────────────────────────────────────── */}
            <View style={s.actions}>
              <TouchableOpacity style={s.resetBtn} onPress={resetForm} disabled={loading} activeOpacity={0.8}>
                <Ionicons name="refresh-outline" size={18} color={C.textSecondary} />
                <Text style={s.resetBtnText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.submitBtn, !isFormValid && s.submitBtnDisabled]}
                onPress={submitEntry}
                disabled={!isFormValid || loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator size="small" color={C.bg} />
                  : <>
                    <Text style={[s.submitBtnText, !isFormValid && { color: C.textMuted }]}>Submit Entry</Text>
                    <Ionicons name="arrow-forward" size={18} color={!isFormValid ? C.textMuted : C.bg} />
                  </>
                }
              </TouchableOpacity>
            </View>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {loading && (
        <View style={s.loadingOverlay}>
          <View style={s.loadingCard}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={s.loadingText}>Processing...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, paddingBottom: 40 },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: C.bgCard, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
  topLabel: { fontSize: 9, fontWeight: "700", color: C.textMuted, letterSpacing: 1.2 },
  topTitle: { fontSize: 18, fontWeight: "800", color: C.textPrimary, letterSpacing: -0.3 },
  progressWrap: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.bgCard, borderBottomWidth: 1, borderBottomColor: C.border },
  progressTrack: { height: 3, backgroundColor: C.border, borderRadius: 3, overflow: "hidden", marginBottom: 5 },
  progressFill: { height: "100%", backgroundColor: C.accent, borderRadius: 3 },
  progressLabel: { fontSize: 10, color: C.textMuted, fontWeight: "600", letterSpacing: 0.3 },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  heroBanner: { flexDirection: "row", alignItems: "center", backgroundColor: C.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, gap: 12, overflow: "hidden" },
  heroBannerAccent: { position: "absolute", top: 0, left: 0, width: 3, height: "100%", backgroundColor: C.accent, borderRadius: 2 },
  heroBugIcon: { width: 46, height: 46, borderRadius: 13, backgroundColor: C.accentDim, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.borderAccent },
  heroTitle: { fontSize: 15, fontWeight: "800", color: C.textPrimary, marginBottom: 2 },
  heroSub: { fontSize: 11, color: C.textMuted, fontWeight: "500" },
  heroStats: { alignItems: "center" },
  heroStatNum: { fontSize: 22, fontWeight: "900", color: C.accent, lineHeight: 26 },
  heroStatLabel: { fontSize: 10, color: C.textMuted, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  card: { backgroundColor: C.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  infoGrid: { gap: 0 },
  helperText: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.warningDim, borderRadius: 10, borderWidth: 1, borderColor: C.warning + "44", marginTop: 8 },
  helperTextContent: { fontSize: 12, color: C.warning, fontWeight: "500", flex: 1 },
  row2: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 7 },
  input: { height: 46, paddingHorizontal: 14, backgroundColor: C.bgInput, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, fontSize: 16, color: C.textPrimary, fontWeight: "600" },
  alertBox: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: C.errorDim, borderRadius: 10, borderWidth: 1, borderColor: C.error + "44" },
  alertText: { fontSize: 12, color: C.error, fontWeight: "600", flex: 1 },
  tableHead: { flexDirection: "row", backgroundColor: C.bgElevated, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, marginBottom: 6, alignItems: "center" },
  tableHeadCell: { fontSize: 10, fontWeight: "800", color: C.accent, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.6 },
  tableBody: { backgroundColor: C.bgInput, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: C.border, marginBottom: 10 },
  totalRow: { flexDirection: "row", backgroundColor: C.accentDim, paddingHorizontal: 12, paddingVertical: 11, alignItems: "center", borderTopWidth: 1.5, borderTopColor: C.borderAccent },
  totalLabel: { fontSize: 12, fontWeight: "700", color: C.accent, textAlign: "center" },
  totalValue: { fontSize: 16, fontWeight: "900", color: C.accent, textAlign: "center" },
  emptyState: { alignItems: "center", paddingVertical: 28, gap: 8 },
  emptyTitle: { fontSize: 14, fontWeight: "700", color: C.textSecondary },
  emptySub: { fontSize: 12, color: C.textMuted, textAlign: "center" },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, backgroundColor: C.accent, borderRadius: 12, marginTop: 4 },
  addBtnDisabled: { backgroundColor: C.bgElevated },
  addBtnText: { fontSize: 14, fontWeight: "700", color: C.bg },
  cameraBtn: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: C.bgInput, borderRadius: 13, borderWidth: 1.5, borderColor: C.border, marginBottom: 12 },
  cameraBtnDone: { borderColor: C.borderAccent, backgroundColor: C.accentDim },
  cameraIconWrap: { width: 42, height: 42, borderRadius: 11, backgroundColor: C.bgElevated, alignItems: "center", justifyContent: "center" },
  cameraBtnTitle: { fontSize: 14, fontWeight: "700", color: C.textSecondary, marginBottom: 2 },
  cameraBtnSub: { fontSize: 11, color: C.textMuted },
  imageWrap: { borderRadius: 13, overflow: "hidden", marginBottom: 12, borderWidth: 1.5, borderColor: C.borderAccent },
  imagePreview: { width: "100%", height: 200 },
  imageOverlay: { position: "absolute", top: 10, right: 10 },
  locationSuccess: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, backgroundColor: C.accentDim, borderRadius: 12, borderWidth: 1, borderColor: C.borderAccent },
  locationPing: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent },
  locationSuccessLabel: { fontSize: 11, fontWeight: "700", color: C.accent, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  locationCoords: { fontSize: 12, color: C.textSecondary, fontWeight: "600" },
  locationPending: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13, backgroundColor: C.bgInput, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  locationPendingText: { fontSize: 12, color: C.textMuted, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  resetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 14, paddingHorizontal: 18, backgroundColor: C.bgCard, borderWidth: 1.5, borderColor: C.border, borderRadius: 13 },
  resetBtnText: { fontSize: 14, fontWeight: "700", color: C.textSecondary },
  submitBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, backgroundColor: C.accent, borderRadius: 13 },
  submitBtnDisabled: { backgroundColor: C.bgElevated },
  submitBtnText: { fontSize: 15, fontWeight: "800", color: C.bg },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: C.overlay, justifyContent: "center", alignItems: "center", zIndex: 999 },
  loadingCard: { backgroundColor: C.bgCard, paddingHorizontal: 28, paddingVertical: 32, borderRadius: 20, alignItems: "center", gap: 14, borderWidth: 1, borderColor: C.borderAccent },
  loadingText: { fontSize: 14, fontWeight: "700", color: C.textPrimary },
});