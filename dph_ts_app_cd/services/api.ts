import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { User } from '../types/navigation';

export const BASE_URL = 'http://192.168.1.89:3000';

// ─── Types ────────────────────────────────────────────────────────────────────

type LoginResponse = {
  user?: User;
  message?: string;
};

type UserCountsResponse = Record<string, number>;

export type ChlorineData = {
  ppm: string;
  imageUri: string;
  latitude: number;
  longitude: number;
  samplingPoint: string;
  actualPPM: string;
  timestamp: string;
};

export type UserInfo = {
  role: string;
  user_id: string;
  username: string;
  hub_id?: string;
  hub_name?: string;
  block_id?: string;
  block_name?: string;
  hud_id?: string;
  hud_name?: string;
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InspectionPlan {
  user_id: string | number;
  proposed_place: string;
  from: string;
  to: string;
  return_date?: string;
  hi_name?: string;
  district?: string;
  [key: string]: unknown; // allow additional fields from API
}

export interface SavePlanStatusPayload {
  user_id: string | number;
  username: string;
  hub_name?: string;
  location_name: string;
  district?: string;
  hub_id: string | number;
  accepted: 0 | 1;
  reason: string;
  visited: number;
  remarks?: string;
}

export interface SavePlanStatusResponse {
  success: boolean;
  denied?: boolean;
  message?: string;
  error?: string;
  [key: string]: unknown;
}

export interface InspectionPlanStatus {
  location_name: string;
  timestamp?: string;
  accepted: number;
  reason?: string;
  visited?: number;
  remarks?: string;
  [key: string]: unknown;
}


export type PredictResponse = {
  ppm: number;
};

// ─── Login ────────────────────────────────────────────────────────────────────

export const loginUser = async (
  username: string,
  password: string
): Promise<User> => {
  console.log('📤 Sending login request to:', `${BASE_URL}/login`);

  const response = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  console.log('📥 Raw response status:', response.status);

  const text: string = await response.text();
  console.log('📄 Raw response body:', text);

  let data: LoginResponse = {};

  try {
    data = JSON.parse(text) as LoginResponse;
  } catch {
    console.warn('⚠️ Server returned non-JSON (probably HTML error page)');
  }

  if (!response.ok) {
    throw new Error(
      data?.message || `Server error ${response.status}. Please try again later`
    );
  }

  if (!data?.user) {
    throw new Error('Invalid login response from server');
  }

  await AsyncStorage.setItem('user_info', JSON.stringify(data.user));

  return data.user;
};

// ─── Chlorine: Predict ────────────────────────────────────────────────────────

export const CHLORINE_PREDICT_URL = 'http://192.168.1.89:5100/vfive_predict';

/**
 * Sends a captured image to the prediction endpoint.
 * Returns the predicted PPM value on success.
 * Throws a descriptive error string on failure (use humanizeError in the screen).
 */
export const predictChlorine = async (imageUri: string): Promise<number> => {
  console.log('🌐 Calling predict API with image:', imageUri);

  const fd = new FormData();
  fd.append('image', {
    uri: imageUri,
    name: 'photo.jpg',
    type: 'image/jpeg',
  } as any);

  try {
    const res = await fetch(CHLORINE_PREDICT_URL, {
      method: 'POST',
      body: fd,
    });

    console.log('📊 Predict response status:', res.status);

    const text = await res.text();
    console.log('📄 Predict raw response:', text);

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      // If parsing fails on a non-OK response, throw the raw status/text
      if (!res.ok) {
        throw new Error(`Server error (${res.status}): ${text.slice(0, 100)}`);
      }

      // If parsing fails on an OK response, it might be a plain number
      if (!isNaN(Number(text.trim())) && text.trim() !== '') {
        console.log('✅ Prediction success (parsed as number):', text);
        return Number(text.trim());
      }
      throw new Error(`Invalid JSON response from server (Status ${res.status}). Raw: ${text.slice(0, 100)}`);
    }

    if (!res.ok) {
      // If it's a 422 or other error but returned valid JSON, use the message from JSON
      const errorMsg = data?.message || data?.error || `Server error (${res.status})`;
      throw new Error(errorMsg);
    }

    if (data?.success === false) {
      const errorMsg = data?.message || data?.error || 'Prediction failed';
      throw new Error(errorMsg);
    }

    if (data?.ppm != null) {
      console.log('✅ Prediction success:', data.ppm);
      return Number(data.ppm);
    }

    // Fallback if success but no ppm
    throw new Error(data?.message || data?.error || 'Unexpected response format');
  } catch (error: any) {
    console.error('❌ Predict API Error:', error);
    throw error;
  }
};

// ─── Chlorine: Submit ─────────────────────────────────────────────────────────

/**
 * Submits collected chlorine data to the appropriate endpoint
 * based on the user's role.
 */
export const submitChlorineData = async (
  chlorineData: ChlorineData,
  userInfo: UserInfo,
  address: string
): Promise<void> => {
  const base64Image = await FileSystem.readAsStringAsync(chlorineData.imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const d = new Date(chlorineData.timestamp);

  const pad = (n: number) => String(n).padStart(2, '0');

  const mysqlTimestamp =
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  const displayPpm = parseFloat(chlorineData.ppm) > 3 ? '> 3.00' : chlorineData.ppm;

  const payload: Record<string, any> = {
    ppm: displayPpm,
    base64Image,
    latitude: chlorineData.latitude,
    longitude: chlorineData.longitude,
    role: userInfo.role,
    timestamp: mysqlTimestamp,
    user_id: userInfo.user_id,
    username: userInfo.username,
    actualPPM: chlorineData.actualPPM,
    samplingPoint: chlorineData.samplingPoint,
    address: address || '',
  };

  console.log('🟡 Submitting Payload (summary):', {
    ...payload,
    base64Image: `[Base64 String: ${base64Image.length} chars]`
  });

  let apiUrl = `${BASE_URL}/dashboard/chl_datacollection`;

  switch (userInfo.role) {
    case 'hi_user':
      payload.block_id = userInfo.block_id;
      payload.block_name = userInfo.block_name;
      payload.hud_id = userInfo.hud_id;
      payload.hud_name = userInfo.hud_name;
      apiUrl = `${BASE_URL}/dashboard/chl_hud_datacollection`;
      break;

    case 'block_user':
      payload.block_id = userInfo.block_id;
      payload.block_name = userInfo.block_name;
      payload.hud_id = userInfo.hud_id;
      payload.hud_name = userInfo.hud_name;
      apiUrl = `${BASE_URL}/dashboard/chl_block_datacollection`;
      break;

    case 'special_user':
    case 'DHO':
    case 'chl_special_admin':
      apiUrl = `${BASE_URL}/dashboard/chl_special_datacollection`;
      break;

    case 'chl_admin':
      delete payload.hub_id;
      delete payload.hub_name;
      apiUrl = `${BASE_URL}/dashboard/chl_special_datacollection`;
      break;

    default:
      payload.hub_id = userInfo.hub_id;
      payload.hub_name = userInfo.hub_name;
  }

  console.log('📤 Submitting to:', apiUrl);

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Server rejected the data (status ${res.status}). Please try again.`);
  }
};
// ----------------------- get User count ------------------
export const getUserCounts = async (
  user_id: string,
  role: string,
  type: string
): Promise<UserCountsResponse> => {
  try {
    const endpoint = `${BASE_URL}/dashboard/daily-counts?user_id=${user_id}&role=${role}&type=${type}`;

    console.log('🌐 Fetching counts from:', endpoint);

    const response = await fetch(endpoint);

    const text = await response.text(); // always read raw text first
    console.log('📄 Raw response:', text);

    // Try parse JSON safely
    let data: UserCountsResponse = {};

    try {
      data = JSON.parse(text);
    } catch {
      console.warn('⚠️ Response is not JSON:', text);
      return {}; // fallback
    }

    if (!response.ok) {
      throw new Error((data as any)?.message || 'Failed to fetch counts');
    }

    console.log('✅ Parsed counts:', data);

    return data;
  } catch (err) {
    console.error('❌ User counts fetch error:', err);
    return {};
  }
};

export const getUserOverallCounts = async (user_id: string): Promise<any> => {
  try {
    const endpoint = `${BASE_URL}/dashboard/user-overall-counts?user_id=${user_id}`;
    const response = await fetch(endpoint);
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('❌ User overall counts fetch error:', err);
    return null;
  }
};

// ────────────────────────── DBC Worker ──────────────────────────────────────────────────
type ApiResponse<T = any> = {
  ok: boolean;
  status: number;
  body: T | string;
};

export const pushDataToServer = async <T = any>(
  data: T
): Promise<ApiResponse> => {
  try {
    const response = await fetch(`${BASE_URL}/dashboard/datacollection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const contentType = response.headers.get('Content-Type') || '';
    const isJson = contentType.includes('application/json');

    const body = isJson
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw new Error(
        (body as any)?.message || 'Failed to push mosquito data'
      );
    }

    return {
      ok: response.ok,
      status: response.status,
      body,
    };
  } catch (error: any) {
    console.error('❌ Mosquito data push failed:', error);

    return {
      ok: false,
      status: 0,
      body: error.message || 'Unknown error',
    };
  }
};

// ─── API Functions ────────────────────────────────────────────────────────────

// Get inspection plan
export const getInspectionPlan = async (
  user_id: string | number
): Promise<InspectionPlan[]> => {
  try {
    const response = await fetch(
      `${BASE_URL}/dashboard/inspection-plan?user_id=${user_id}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch');
    }

    const data = await response.json();

    if (data.printablePlan && Array.isArray(data.printablePlan)) {
      // Filter plans to only include those for the current user
      const userPlans: InspectionPlan[] = data.printablePlan.filter(
        (plan: InspectionPlan) => plan.user_id === user_id
      );
      return userPlans;
    } else {
      console.warn('API returned no printablePlan array:', data);
      return [];
    }
  } catch (error) {
    console.error('❌ API call failed (getInspectionPlan):', error);
    return [];
  }
};

export const savePlanStatus = async (
  payload: SavePlanStatusPayload
): Promise<SavePlanStatusResponse> => {
  try {
    const res = await fetch(`${BASE_URL}/dashboard/save-plan-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data: SavePlanStatusResponse = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error ?? 'Save plan status failed');
    }

    return data;
  } catch (err) {
    console.error('❌ API error (savePlanStatus):', err);
    throw err;
  }
};

export const getInspectionPlanStatus = async (
  user_id: string | number
): Promise<InspectionPlanStatus[]> => {
  try {
    const response = await fetch(
      `${BASE_URL}/dashboard/get-save-plan-status?user_id=${user_id}`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message ?? 'Failed to fetch inspection plan status');
    }

    return data;
  } catch (err) {
    console.error('❌ Error fetching inspection plan status:', err);
    throw err;
  }
};

export const getLarvaCounts = async (
  user_id: string
): Promise<UserCountsResponse> => {
  try {
    const endpoint = `${BASE_URL}/dashboard/larva-counts?user_id=${user_id}`;

    console.log('🌐 Fetching LARVA counts from:', endpoint);

    const response = await fetch(endpoint);

    const text = await response.text();
    console.log('📄 Larva Raw response:', text);

    let data: UserCountsResponse = {};

    try {
      data = JSON.parse(text);
    } catch {
      console.warn('⚠️ Larva response is not JSON:', text);
      return {};
    }

    if (!response.ok) {
      throw new Error((data as any)?.message || 'Failed to fetch larva counts');
    }

    console.log('✅ Larva counts:', data);

    return data;

  } catch (err) {
    console.error('❌ Larva counts fetch error:', err);
    return {};
  }
};

export const getActionCounts = async (
  user_id: string
): Promise<UserCountsResponse> => {
  try {
    const endpoint = `${BASE_URL}/dashboard/action-counts?user_id=${user_id}`;

    console.log('🌐 Fetching ACTION counts from:', endpoint);

    const response = await fetch(endpoint);

    const text = await response.text();
    console.log('📄 Action Raw response:', text);

    let data: UserCountsResponse = {};

    try {
      data = JSON.parse(text);
    } catch {
      console.warn('⚠️ Action response is not JSON:', text);
      return {};
    }

    if (!response.ok) {
      throw new Error((data as any)?.message || 'Failed to fetch action counts');
    }

    console.log('✅ Action counts:', data);

    return data;

  } catch (err) {
    console.error('❌ Action counts fetch error:', err);
    return {};
  }
};