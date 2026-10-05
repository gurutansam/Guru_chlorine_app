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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getInspectionPlan, savePlanStatus, getInspectionPlanStatus } from '../../api';
import { useNavigation } from '@react-navigation/native';

export default function HiWaterLabHome() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inspectionPlan, setInspectionPlan] = useState([]);
  const [planLoading, setPlanLoading] = useState(true);

  // separate remarks states so accept/reject don't clobber each other
  const [acceptRemarks, setAcceptRemarks] = useState('');
  const [rejectRemarks, setRejectRemarks] = useState('');

  const [showRejectOptions, setShowRejectOptions] = useState(false);
  const [selectedRejectReason, setSelectedRejectReason] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const navigation = useNavigation();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const json = await AsyncStorage.getItem('user_info');
      if (json) {
        const parsedUser = JSON.parse(json);
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

  // helper to parse dd-mm-yyyy into Date safely
  const parseDDMMYYYY = (str) => {
    if (!str) return new Date(NaN);
    const parts = String(str).split('-');
    if (parts.length !== 3) return new Date(str);
    const [d, m, y] = parts;
    return new Date(`${y}-${m}-${d}`);
  };

 const refreshPlans = async (userId = user?.user_id) => {
  if (!userId) return;
  setPlanLoading(true);

  try {
    const plans = await getInspectionPlan(userId);          // returns printablePlan[]
    const savedStatuses = await getInspectionPlanStatus(userId);

    // normalize helper: trim + collapse spaces
    const norm = (s) =>
      String(s || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();

    // 1) map of latest status per normalized location_name
    const latestByLocation = {};
    if (Array.isArray(savedStatuses)) {
      savedStatuses.forEach((s) => {
        const key = norm(s.location_name);
        const t = s.timestamp ? new Date(s.timestamp) : new Date(0);
        const prev = latestByLocation[key];
        if (!prev || new Date(prev.timestamp) < t) latestByLocation[key] = s;
      });
    }

    const parseDDMMYYYY = (str) => {
      if (!str) return new Date(NaN);
      const parts = String(str).split('-');
      if (parts.length !== 3) return new Date(str);
      const [d, m, y] = parts;
      return new Date(`${y}-${m}-${d}`);
    };

    const today = new Date();

    const sortedPlans = (plans || []).sort((a, b) => {
      const dateA = parseDDMMYYYY(a.from || '');
      const dateB = parseDDMMYYYY(b.from || '');
      return dateA - dateB;
    });

    let nextPlanToShow = null;

    for (let plan of sortedPlans) {
      const planStart = parseDDMMYYYY(plan.from || '');
      const planReturn = parseDDMMYYYY(plan.return_date || plan.to || '');
      const statusKey = norm(plan.proposed_place);
      const statusEntry = latestByLocation[statusKey] || null;

      if (statusEntry) {
        if (Number(statusEntry.accepted) === 1) {
          if (!isNaN(planReturn) && today <= planReturn) {
            nextPlanToShow = { ...plan, statusEntry };
            break;
          }
        } else if (Number(statusEntry.accepted) === 0) {
          if (!isNaN(planStart) && today <= planStart) {
            nextPlanToShow = { ...plan, statusEntry };
            break;
          }
        }
      } else {
        if (!isNaN(planStart) && today <= planStart) {
          nextPlanToShow = { ...plan, statusEntry: null };
          break;
        }
      }
    }

    setInspectionPlan(nextPlanToShow ? [nextPlanToShow] : []);
  } catch (err) {
    console.error('Error refreshing plans:', err);
  } finally {
    setPlanLoading(false);
  }
};


  const handleAccept = async (plan) => {
    if (!plan || !user) return Alert.alert('Error', 'No plan or user data');
    try {
      const payload = {
        user_id: user.user_id,
        username: user.username,
        hub_name: user.hub_name,
        location_name: plan.proposed_place,
        district: plan.district || '',
        hub_id: user.hub_id,
        accepted: 1,
        reason: '',
        visited: 0,
        remarks: acceptRemarks.slice(0, 25) || '',
      };

      const res = await savePlanStatus(payload);
      // check backend response for denial or success
      if (res && res.denied) {
        return Alert.alert('Denied', res.message || 'Action already submitted');
      }

      Alert.alert('Success', 'Plan accepted successfully');
      setAcceptRemarks('');
      await refreshPlans();
    } catch (error) {
      console.error('Accept error', error);
      Alert.alert('Error', error.message || 'Failed to accept plan');
    }
  };

  const openRejectModal = (plan) => {
    // reset reject-specific state BEFORE opening modal
    setSelectedPlan(plan);
    setSelectedRejectReason('');
    setRejectRemarks('');
    setShowRejectOptions(true);
  };

  const handleReject = async (plan) => {
    if (!plan) return Alert.alert('Error', 'No plan selected');
    if (!selectedRejectReason) return Alert.alert('Error', 'Please select a rejection reason');

    try {
      const payload = {
        user_id: user.user_id,
        username: user.username,
        hub_name: user.hub_name,
        location_name: plan.proposed_place,
        district: plan.district || '',
        hub_id: user.hub_id,
        accepted: 0,
        reason: selectedRejectReason,
        visited: 0,
        remarks: rejectRemarks.slice(0, 25) || '',
      };

      const res = await savePlanStatus(payload);
      if (res && res.denied) {
        return Alert.alert('Denied', res.message || 'Action already submitted');
      }

      Alert.alert('Success', 'Plan rejected successfully');

      setShowRejectOptions(false);
      setSelectedRejectReason('');
      setRejectRemarks('');
      setSelectedPlan(null);

      await refreshPlans();
    } catch (error) {
      console.error('Reject error', error);
      Alert.alert('Error', error.message || 'Failed to reject plan');
    }
  };

  const handleSaveRemarks = async (plan) => {
    if (!plan) return Alert.alert('Error', 'No plan selected');
    if (!acceptRemarks.trim()) return Alert.alert('Error', 'Enter some remarks');

    try {
      const payload = {
        user_id: user.user_id,
        username: user.username,
        hub_name: user.hub_name,
        location_name: plan.proposed_place,
        district: plan.district || '',
        hub_id: user.hub_id,
        accepted: plan.statusEntry?.accepted ?? 0,
        reason: plan.statusEntry?.reason ?? '',
        visited: plan.statusEntry?.visited ?? 0,
        remarks: acceptRemarks.slice(0, 25),
      };

      const res = await savePlanStatus(payload);
      if (res && res.denied) {
        return Alert.alert('Denied', res.message || 'Action already submitted');
      }

      Alert.alert('Success', 'Remarks saved successfully');
      setAcceptRemarks('');
      await refreshPlans();
    } catch (error) {
      console.error('Save remarks error', error);
      Alert.alert('Error', error.message || 'Failed to save remarks');
    }
  };

  const handleLogout = () => {
    navigation.navigate('AppHome');
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleLogout} style={{ marginRight: 15 }}>
          <Text style={{ color: 'red', fontWeight: 'bold' }}>Logout</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>ATP</Text>
      <Text style={styles.subHeading}>Advance Travel Program</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#1e3a8a" />
      ) : user ? (
        <View style={styles.userCard}>
          <Text style={styles.userTitle}>User Details</Text>
          <Text style={styles.userInfo}>👤 Username: {user.username}</Text>
          <Text style={styles.userInfo}>📞 Phone: {user.phone_number}</Text>
          <Text style={styles.userInfo}>📧 Email: {user.email || 'Not available'}</Text>
          <Text style={styles.userInfo}>🏢 Hub: {user.hub_name || 'Unknown'}</Text>
          <Text style={styles.userInfo}>🆔 User ID: {user.user_id}</Text>
        </View>
      ) : (
        <Text style={{ marginTop: 20 }}>No user data found</Text>
      )}

      {planLoading ? (
        <ActivityIndicator size="large" color="#1e3a8a" style={{ marginTop: 20 }} />
      ) : inspectionPlan.length > 0 ? (
        <View>
          <Text style={styles.sectionTitle}>Upcoming Plans</Text>
          {inspectionPlan.map((plan, index) => (
            <View key={index} style={styles.planCard}>
              <View style={styles.planItem}>
                <Text style={styles.planText}>📍 {plan.proposed_place}</Text>
                <Text style={styles.planText}>From: {plan.from}</Text>
                <Text style={styles.planText}>To: {plan.to}</Text>
                <Text style={styles.planText}>↩️ Return: {plan.return_date}</Text>
                <Text style={styles.planText}>👨‍⚕️ HI: {plan.hi_name}</Text>
              </View>

              {plan.statusEntry ? (
                <View style={{ marginTop: 10 }}>
                  {Number(plan.statusEntry.accepted) === 1 ? (
                    <Text style={{ color: 'green', fontWeight: 'bold' }}>✅ Accepted</Text>
                  ) : (
                    <Text style={{ color: 'red', fontWeight: 'bold' }}>
                      ❌ Rejected ({plan.statusEntry.reason || 'No reason given'})
                    </Text>
                  )}
                </View>
              ) : (
                <View>
                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={[styles.button, styles.acceptButton]}
                      onPress={() => handleAccept(plan)}
                    >
                      <Text style={styles.buttonText}>Accept</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.button, styles.rejectButton]}
                      onPress={() => openRejectModal(plan)}
                    >
                      <Text style={styles.buttonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Remarks input & Save button (for accept / general remarks) */}
                  <View style={{ marginTop: 12 }}>
                    <TextInput
                      style={styles.remarksInput}
                      placeholder="Enter remarks (max 25 chars)"
                      value={acceptRemarks}
                      onChangeText={(text) => setAcceptRemarks(text.slice(0, 25))}
                    />
                    <TouchableOpacity
                      style={[styles.button, { backgroundColor: '#2563eb', marginTop: 8 }]}
                      onPress={() => handleSaveRemarks(plan)}
                    >
                      <Text style={[styles.buttonText, { color: '#fff' }]}>Save Remarks</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ marginTop: 20 }}>No upcoming inspection plans found</Text>
      )}

      {/* Reject Options Modal */}
      <Modal
        visible={showRejectOptions}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRejectOptions(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Rejection Reason</Text>

            {['Leave', 'Natural Disaster', 'Local Leave (Spl Govt Leave)'].map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[
                  styles.reasonOption,
                  selectedRejectReason === reason && styles.selectedReason,
                ]}
                onPress={() => setSelectedRejectReason(reason)}
              >
                <Text>{reason}</Text>
              </TouchableOpacity>
            ))}

            <TextInput
              style={styles.remarksInput}
              placeholder="Enter remarks (optional, max 25 chars)"
              value={rejectRemarks}
              onChangeText={(text) => setRejectRemarks(text.slice(0, 25))}
            />

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowRejectOptions(false);
                  setSelectedRejectReason('');
                  setRejectRemarks('');
                  setSelectedPlan(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={() => handleReject(selectedPlan)}
                disabled={!selectedRejectReason}
              >
                <Text style={styles.modalButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        activeOpacity={0.7}
      >
        <Text style={styles.logoutButtonText}>Back to Home</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#f8fafc' },
  heading: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 4, color: '#1e40af', fontFamily: 'sans-serif-medium', textTransform: 'uppercase', letterSpacing: 1, marginTop:20 },
  subHeading: { fontSize: 16, textAlign: 'center', marginBottom: 24, color: '#64748b', fontFamily: 'sans-serif', letterSpacing: 0.5 },
  userCard: { padding: 20, backgroundColor: '#ffffff', borderRadius: 12, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 3, borderLeftWidth: 4, borderLeftColor: '#3b82f6' },
  userTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 8 },
  userInfo: { fontSize: 14, marginBottom: 6, color: '#334155', flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16, color: '#1e293b', marginTop: 8, paddingLeft: 4 },
  planCard: { backgroundColor: '#ffffff', padding: 18, borderRadius: 12, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  planItem: { marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 12 },
  planText: { fontSize: 15, marginBottom: 6, color: '#475569', lineHeight: 22 },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 12 },
  button: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, flex: 1, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  acceptButton: { backgroundColor: '#10b981', borderWidth: 1, borderColor: '#059669' },
  rejectButton: { backgroundColor: '#ef4444', borderWidth: 1, borderColor: '#dc2626' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15, letterSpacing: 0.5 },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 20 },
  modalContent: { backgroundColor: '#ffffff', padding: 24, borderRadius: 16, width: '100%', maxWidth: 400, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20, color: '#1e293b', textAlign: 'center' },
  reasonOption: { padding: 14, borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, marginBottom: 12, backgroundColor: '#f8fafc' },
  selectedReason: { backgroundColor: '#dbeafe', borderColor: '#3b82f6' },
  remarksInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, marginTop: 10, marginBottom: 10, backgroundColor: '#fff', fontSize: 14 },
  modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, gap: 12 },
  modalButton: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cancelButton: { backgroundColor: '#e2e8f0', borderWidth: 1, borderColor: '#cbd5e1' },
  submitButton: { backgroundColor: '#2563eb', borderWidth: 1, borderColor: '#1d4ed8' },
  modalButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  cancelButtonText: { color: '#334155', fontWeight: '600', fontSize: 15 },
  logoutButton: { backgroundColor: '#ef4444', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: '#dc2626' },
  logoutButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },
});