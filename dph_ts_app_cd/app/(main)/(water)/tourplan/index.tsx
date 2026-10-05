import React, { useEffect, useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
  StatusBar,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getInspectionPlan, savePlanStatus, getInspectionPlanStatus } from '@/services/api';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
  user_id: string | number;
  username: string;
  phone_number: string;
  email?: string;
  hub_name?: string;
  hub_id: string | number;
}

interface StatusEntry {
  location_name: string;
  timestamp?: string;
  accepted: number;
  reason?: string;
  visited?: number;
  remarks?: string;
}

interface InspectionPlan {
  proposed_place: string;
  from: string;
  to: string;
  return_date?: string;
  hi_name?: string;
  district?: string;
  statusEntry: StatusEntry | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseDDMMYYYY = (str?: string): Date => {
  if (!str) return new Date(NaN);
  const parts = String(str).split('-');
  if (parts.length !== 3) return new Date(str);
  const [d, m, y] = parts;
  return new Date(`${y}-${m}-${d}`);
};

const norm = (s?: string): string =>
  String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

const getInitials = (name: string): string =>
  name.split(/[\s.]+/).filter(Boolean).map((w) => w[0].toUpperCase()).slice(0, 2).join('');

const REJECT_REASONS = ['Leave', 'Natural Disaster', 'Local Leave (Spl Govt Leave)'] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

const InfoRow = ({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  value: string;
}) => (
  <View style={infoStyles.row}>
    <View style={infoStyles.iconWrap}>
      <MaterialCommunityIcons name={icon} size={16} color="#3b82f6" />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  </View>
);

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 10, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  value: { fontSize: 14, color: '#1e293b', fontWeight: '600', marginTop: 1 },
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function TourPlan() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [inspectionPlan, setInspectionPlan] = useState<InspectionPlan[]>([]);
  const [planLoading, setPlanLoading] = useState<boolean>(true);

  const [acceptRemarks, setAcceptRemarks] = useState<string>('');
  const [rejectRemarks, setRejectRemarks] = useState<string>('');
  const [showRejectOptions, setShowRejectOptions] = useState<boolean>(false);
  const [selectedRejectReason, setSelectedRejectReason] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<InspectionPlan | null>(null);

  const navigation = useNavigation();

  useEffect(() => { loadData(); }, []);

  const loadData = async (): Promise<void> => {
    try {
      const json = await AsyncStorage.getItem('user_info');
      if (json) {
        const parsedUser: User = JSON.parse(json);
        setUser(parsedUser);
        await refreshPlans(parsedUser.user_id);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
      setPlanLoading(false);
    }
  };

  const refreshPlans = async (userId?: string | number): Promise<void> => {
    const uid = userId ?? user?.user_id;
    if (!uid) return;
    setPlanLoading(true);
    try {
      const apiPlans = await getInspectionPlan(uid);
      const plans: InspectionPlan[] = (apiPlans ?? []).map((plan: any) => ({ ...plan, statusEntry: null }));
      const savedStatuses: StatusEntry[] = await getInspectionPlanStatus(uid);

      const latestByLocation: Record<string, StatusEntry> = {};
      if (Array.isArray(savedStatuses)) {
        savedStatuses.forEach((s) => {
          const key = norm(s.location_name);
          const t = s.timestamp ? new Date(s.timestamp) : new Date(0);
          const prev = latestByLocation[key];
          if (!prev || new Date(prev.timestamp ?? 0) < t) latestByLocation[key] = s;
        });
      }

      const today = new Date();
      const sortedPlans = plans.sort((a, b) =>
        parseDDMMYYYY(a.from).getTime() - parseDDMMYYYY(b.from).getTime()
      );

      let nextPlanToShow: InspectionPlan | null = null;
      for (const plan of sortedPlans) {
        const planStart  = parseDDMMYYYY(plan.from);
        const planReturn = parseDDMMYYYY(plan.return_date ?? plan.to);
        const statusKey  = norm(plan.proposed_place);
        const statusEntry: StatusEntry | null = latestByLocation[statusKey] ?? null;

        if (statusEntry) {
          if (Number(statusEntry.accepted) === 1 && !isNaN(planReturn.getTime()) && today <= planReturn) {
            nextPlanToShow = { ...plan, statusEntry }; break;
          } else if (Number(statusEntry.accepted) === 0 && !isNaN(planStart.getTime()) && today <= planStart) {
            nextPlanToShow = { ...plan, statusEntry }; break;
          }
        } else if (!isNaN(planStart.getTime()) && today <= planStart) {
          nextPlanToShow = { ...plan, statusEntry: null }; break;
        }
      }
      setInspectionPlan(nextPlanToShow ? [nextPlanToShow] : []);
    } catch (err) {
      console.error('Error refreshing plans:', err);
    } finally {
      setPlanLoading(false);
    }
  };

  const handleAccept = async (plan: InspectionPlan): Promise<void> => {
    if (!plan || !user) return Alert.alert('Error', 'No plan or user data');
    try {
      const res = await savePlanStatus({
        user_id: user.user_id, username: user.username, hub_name: user.hub_name,
        location_name: plan.proposed_place, district: plan.district ?? '',
        hub_id: user.hub_id, accepted: 1, reason: '', visited: 0,
        remarks: acceptRemarks.slice(0, 25) || '',
      });
      if (res?.denied) return Alert.alert('Denied', res.message ?? 'Action already submitted');
      Alert.alert('Success', 'Plan accepted successfully');
      setAcceptRemarks('');
      await refreshPlans();
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Failed to accept plan');
    }
  };

  const openRejectModal = (plan: InspectionPlan): void => {
    setSelectedPlan(plan);
    setSelectedRejectReason('');
    setRejectRemarks('');
    setShowRejectOptions(true);
  };

  const handleReject = async (plan: InspectionPlan | null): Promise<void> => {
    if (!plan) return Alert.alert('Error', 'No plan selected');
    if (!selectedRejectReason) return Alert.alert('Error', 'Please select a rejection reason');
    try {
      const res = await savePlanStatus({
        user_id: user!.user_id, username: user!.username, hub_name: user!.hub_name,
        location_name: plan.proposed_place, district: plan.district ?? '',
        hub_id: user!.hub_id, accepted: 0, reason: selectedRejectReason, visited: 0,
        remarks: rejectRemarks.slice(0, 25) || '',
      });
      if (res?.denied) return Alert.alert('Denied', res.message ?? 'Action already submitted');
      Alert.alert('Success', 'Plan rejected successfully');
      setShowRejectOptions(false);
      setSelectedRejectReason('');
      setRejectRemarks('');
      setSelectedPlan(null);
      await refreshPlans();
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Failed to reject plan');
    }
  };

  const handleSaveRemarks = async (plan: InspectionPlan): Promise<void> => {
    if (!plan) return Alert.alert('Error', 'No plan selected');
    if (!acceptRemarks.trim()) return Alert.alert('Error', 'Enter some remarks');
    try {
      const res = await savePlanStatus({
        user_id: user!.user_id, username: user!.username, hub_name: user!.hub_name,
        location_name: plan.proposed_place, district: plan.district ?? '',
        hub_id: user!.hub_id, accepted: (plan.statusEntry?.accepted ?? 0) as 0 | 1,
        reason: plan.statusEntry?.reason ?? '', visited: plan.statusEntry?.visited ?? 0,
        remarks: acceptRemarks.slice(0, 25),
      });
      if (res?.denied) return Alert.alert('Denied', res.message ?? 'Action already submitted');
      Alert.alert('Success', 'Remarks saved successfully');
      setAcceptRemarks('');
      await refreshPlans();
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Failed to save remarks');
    }
  };

  const handleLogout = (): void => navigation.navigate('home' as never);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerDecorCircle} />
        <View style={styles.headerDecorCircle2} />
        <TouchableOpacity style={styles.backBtn} onPress={handleLogout}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#94a3b8" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerBadge}>
            <MaterialCommunityIcons name="map-marker-path" size={14} color="#60a5fa" />
            <Text style={styles.headerBadgeText}>ATP</Text>
          </View>
          <Text style={styles.headerTitle}>Tour Plan</Text>
          <Text style={styles.headerSub}>Advance Travel Program</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── User Card ── */}
        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loaderText}>Loading profile…</Text>
          </View>
        ) : user ? (
          <View style={styles.userCard}>
            <View style={styles.userCardHeader}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{getInitials(user.username)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{user.username}</Text>
                <Text style={styles.userHub}>{user.hub_name ?? 'Unknown Hub'}</Text>
              </View>
              <View style={styles.activeChip}>
                <View style={styles.activeDot} />
                <Text style={styles.activeChipText}>Active</Text>
              </View>
            </View>

            <View style={styles.userDivider} />

            <InfoRow icon="phone-outline" label="Phone"   value={user.phone_number} />
            <InfoRow icon="email-outline" label="Email"   value={user.email ?? 'Not available'} />
            <InfoRow icon="identifier"    label="User ID" value={String(user.user_id)} />
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="account-off-outline" size={40} color="#cbd5e1" />
            <Text style={styles.emptyText}>No user data found</Text>
          </View>
        )}

        {/* ── Plans ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Upcoming Plans</Text>
          <View style={styles.sectionLine} />
        </View>

        {planLoading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loaderText}>Fetching plans…</Text>
          </View>
        ) : inspectionPlan.length > 0 ? (
          inspectionPlan.map((plan, index) => (
            <View key={index} style={styles.planCard}>

              {/* Plan header */}
              <View style={styles.planCardHeader}>
                <View style={styles.planIconWrap}>
                  <MaterialCommunityIcons name="map-marker-outline" size={22} color="#3b82f6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planPlace}>{plan.proposed_place}</Text>
                  {plan.district ? <Text style={styles.planDistrict}>{plan.district}</Text> : null}
                </View>
                {plan.statusEntry ? (
                  Number(plan.statusEntry.accepted) === 1 ? (
                    <View style={[styles.statusChip, styles.statusAccepted]}>
                      <MaterialCommunityIcons name="check-circle" size={12} color="#059669" />
                      <Text style={[styles.statusChipText, { color: '#059669' }]}>Accepted</Text>
                    </View>
                  ) : (
                    <View style={[styles.statusChip, styles.statusRejected]}>
                      <MaterialCommunityIcons name="close-circle" size={12} color="#dc2626" />
                      <Text style={[styles.statusChipText, { color: '#dc2626' }]}>Rejected</Text>
                    </View>
                  )
                ) : (
                  <View style={[styles.statusChip, styles.statusPending]}>
                    <MaterialCommunityIcons name="clock-outline" size={12} color="#d97706" />
                    <Text style={[styles.statusChipText, { color: '#d97706' }]}>Pending</Text>
                  </View>
                )}
              </View>

              {/* Date row */}
              <View style={styles.dateRow}>
                <View style={styles.dateItem}>
                  <MaterialCommunityIcons name="calendar-arrow-right" size={14} color="#64748b" />
                  <Text style={styles.dateLabel}>From</Text>
                  <Text style={styles.dateValue}>{plan.from}</Text>
                </View>
                <View style={styles.dateSep} />
                <View style={styles.dateItem}>
                  <MaterialCommunityIcons name="calendar-arrow-left" size={14} color="#64748b" />
                  <Text style={styles.dateLabel}>To</Text>
                  <Text style={styles.dateValue}>{plan.to}</Text>
                </View>
                <View style={styles.dateSep} />
                <View style={styles.dateItem}>
                  <MaterialCommunityIcons name="calendar-check" size={14} color="#64748b" />
                  <Text style={styles.dateLabel}>Return</Text>
                  <Text style={styles.dateValue}>{plan.return_date ?? '—'}</Text>
                </View>
              </View>

              {/* HI row */}
              {plan.hi_name ? (
                <View style={styles.hiRow}>
                  <MaterialCommunityIcons name="account-tie-outline" size={16} color="#64748b" />
                  <Text style={styles.hiText}>
                    HI: <Text style={{ color: '#1e293b', fontWeight: '700' }}>{plan.hi_name}</Text>
                  </Text>
                </View>
              ) : null}

              {/* Rejection reason */}
              {plan.statusEntry && Number(plan.statusEntry.accepted) === 0 && (
                <View style={styles.rejectionNote}>
                  <MaterialCommunityIcons name="information-outline" size={14} color="#b45309" />
                  <Text style={styles.rejectionText}>
                    Reason: {plan.statusEntry.reason ?? 'No reason given'}
                  </Text>
                </View>
              )}

              {/* Action buttons — only if no status yet */}
              {!plan.statusEntry && (
                <View style={styles.actionsWrap}>
                  <View style={styles.actionBtns}>
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => handleAccept(plan)}
                      activeOpacity={0.85}
                    >
                      <MaterialCommunityIcons name="check" size={16} color="#fff" />
                      <Text style={styles.acceptBtnText}>Accept</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => openRejectModal(plan)}
                      activeOpacity={0.85}
                    >
                      <MaterialCommunityIcons name="close" size={16} color="#fff" />
                      <Text style={styles.rejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.remarksRow}>
                    <View style={styles.remarksInputWrap}>
                      <MaterialCommunityIcons name="pencil-outline" size={16} color="#94a3b8" style={{ marginLeft: 10 }} />
                      <TextInput
                        style={styles.remarksInput}
                        placeholder="Add remarks (max 25 chars)"
                        placeholderTextColor="#94a3b8"
                        value={acceptRemarks}
                        onChangeText={(t) => setAcceptRemarks(t.slice(0, 25))}
                      />
                      <Text style={styles.charCount}>{acceptRemarks.length}/25</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.saveRemarksBtn}
                      onPress={() => handleSaveRemarks(plan)}
                      activeOpacity={0.85}
                    >
                      <MaterialCommunityIcons name="content-save-outline" size={16} color="#3b82f6" />
                      <Text style={styles.saveRemarksBtnText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="calendar-remove-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>No upcoming inspection plans found</Text>
            <Text style={styles.emptySubText}>Check back later for new assignments</Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Reject Modal ── */}
      <Modal
        visible={showRejectOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRejectOptions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <View style={styles.modalIconWrap}>
              <MaterialCommunityIcons name="close-circle-outline" size={28} color="#ef4444" />
            </View>
            <Text style={styles.modalTitle}>Reject Plan</Text>
            <Text style={styles.modalSub}>Select a reason for rejection</Text>

            {REJECT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[
                  styles.reasonOption,
                  selectedRejectReason === reason && styles.reasonSelected,
                ]}
                onPress={() => setSelectedRejectReason(reason)}
                activeOpacity={0.8}
              >
                <View style={[
                  styles.reasonRadio,
                  selectedRejectReason === reason && styles.reasonRadioSelected,
                ]}>
                  {selectedRejectReason === reason && <View style={styles.reasonRadioDot} />}
                </View>
                <Text style={[
                  styles.reasonText,
                  selectedRejectReason === reason && styles.reasonTextSelected,
                ]}>
                  {reason}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={[styles.remarksInputWrap, { marginTop: 10 }]}>
              <MaterialCommunityIcons name="pencil-outline" size={16} color="#94a3b8" style={{ marginLeft: 10 }} />
              <TextInput
                style={styles.remarksInput}
                placeholder="Optional remarks (max 25 chars)"
                placeholderTextColor="#94a3b8"
                value={rejectRemarks}
                onChangeText={(t) => setRejectRemarks(t.slice(0, 25))}
              />
              <Text style={styles.charCount}>{rejectRemarks.length}/25</Text>
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowRejectOptions(false);
                  setSelectedRejectReason('');
                  setRejectRemarks('');
                  setSelectedPlan(null);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, !selectedRejectReason && { opacity: 0.4 }]}
                onPress={() => handleReject(selectedPlan)}
                disabled={!selectedRejectReason}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="send-outline" size={16} color="#fff" />
                <Text style={styles.modalSubmitText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f1f5f9' },

  // Header
  header: {
    backgroundColor: '#0f172a', paddingTop: 56, paddingBottom: 24,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
  },
  headerDecorCircle: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: '#1e3a5f', top: -80, right: -40, opacity: 0.5,
  },
  headerDecorCircle2: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#1e40af', bottom: -40, left: 20, opacity: 0.15,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: '#1e293b',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#334155',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#1e3a5f', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, marginBottom: 6, borderWidth: 1, borderColor: '#2563eb',
  },
  headerBadgeText: { fontSize: 11, color: '#60a5fa', fontWeight: '700', letterSpacing: 0.8 },
  headerTitle:     { fontSize: 22, color: '#f1f5f9', fontWeight: '800', letterSpacing: 0.4 },
  headerSub:       { fontSize: 12, color: '#64748b', marginTop: 2 },

  scrollContent: { padding: 16, paddingTop: 20 },

  // Loader
  loaderWrap: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loaderText: { fontSize: 14, color: '#94a3b8' },

  // User card
  userCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 20,
    shadowColor: '#64748b', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  userCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  avatarCircle: {
    width: 52, height: 52, borderRadius: 16, backgroundColor: '#1d4ed8',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, color: '#fff', fontWeight: '800', letterSpacing: 0.5 },
  userName:   { fontSize: 17, color: '#0f172a', fontWeight: '700' },
  userHub:    { fontSize: 13, color: '#64748b', marginTop: 2 },
  activeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#f0fdf4', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: '#bbf7d0',
  },
  activeDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  activeChipText: { fontSize: 11, color: '#16a34a', fontWeight: '700' },
  userDivider:    { height: 1, backgroundColor: '#f1f5f9', marginBottom: 4 },

  // Section
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  sectionLabel:  {
    fontSize: 11, color: '#94a3b8', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1.2,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },

  // Plan card
  planCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 16,
    shadowColor: '#64748b', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  planCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  planIconWrap: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: '#eff6ff',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#bfdbfe',
  },
  planPlace:    { fontSize: 16, color: '#0f172a', fontWeight: '700' },
  planDistrict: { fontSize: 12, color: '#64748b', marginTop: 2 },

  statusChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  statusAccepted: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' },
  statusRejected: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  statusPending:  { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a' },

  // Dates
  dateRow: {
    flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 14,
    padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0',
  },
  dateItem:  { flex: 1, alignItems: 'center', gap: 3 },
  dateLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  dateValue: { fontSize: 13, color: '#1e293b', fontWeight: '700', textAlign: 'center' },
  dateSep:   { width: 1, backgroundColor: '#e2e8f0', marginHorizontal: 8 },

  hiRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9',
  },
  hiText: { fontSize: 13, color: '#64748b' },

  rejectionNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fffbeb', borderRadius: 10, padding: 10,
    marginTop: 10, borderWidth: 1, borderColor: '#fde68a',
  },
  rejectionText: { fontSize: 13, color: '#92400e', flex: 1 },

  // Actions
  actionsWrap: { marginTop: 16, gap: 12 },
  actionBtns:  { flexDirection: 'row', gap: 10 },
  acceptBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#059669', paddingVertical: 13, borderRadius: 14,
    shadowColor: '#059669', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#ef4444', paddingVertical: 13, borderRadius: 14,
    shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  rejectBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  remarksRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  remarksInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f8fafc', borderRadius: 12,
    borderWidth: 1, borderColor: '#e2e8f0', height: 46,
  },
  remarksInput:    { flex: 1, fontSize: 14, color: '#1e293b', paddingHorizontal: 8 },
  charCount:       { fontSize: 11, color: '#cbd5e1', marginRight: 10 },
  saveRemarksBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#eff6ff', paddingVertical: 13, paddingHorizontal: 16,
    borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe',
  },
  saveRemarksBtnText: { color: '#3b82f6', fontWeight: '700', fontSize: 14 },

  // Empty
  emptyState:   { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText:    { fontSize: 16, color: '#94a3b8', fontWeight: '600' },
  emptySubText: { fontSize: 13, color: '#cbd5e1' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0',
    alignSelf: 'center', marginBottom: 20,
  },
  modalIconWrap: {
    width: 60, height: 60, borderRadius: 20, backgroundColor: '#fef2f2',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#fecaca',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  modalSub:   { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 4, marginBottom: 20 },

  reasonOption: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, borderWidth: 1.5, borderColor: '#e2e8f0',
    borderRadius: 14, marginBottom: 10, backgroundColor: '#f8fafc',
  },
  reasonSelected:      { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
  reasonRadio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center',
  },
  reasonRadioSelected: { borderColor: '#3b82f6' },
  reasonRadioDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6' },
  reasonText:          { fontSize: 14, color: '#475569', fontWeight: '500', flex: 1 },
  reasonTextSelected:  { color: '#1d4ed8', fontWeight: '700' },

  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 15, borderRadius: 14,
    backgroundColor: '#f1f5f9', alignItems: 'center',
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  modalCancelText:  { fontSize: 15, color: '#64748b', fontWeight: '700' },
  modalSubmitBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 15, borderRadius: 14, backgroundColor: '#ef4444',
    shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  modalSubmitText: { fontSize: 15, color: '#fff', fontWeight: '700' },
});