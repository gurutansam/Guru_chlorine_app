import AsyncStorage from '@react-native-async-storage/async-storage';

// Use your actual IP address or domain
const BASE_URL = 'http://192.168.1.145:3000';
// const BASE_URL = 'http://192.168.137.108:3000';
// 
// Authentication
export const loginUser = async (username, password) => {
  console.log("📤 Sending login request to:", `${BASE_URL}/login`);

  const response = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  console.log("📥 Raw response status:", response.status);

  // 🔥 always read text first (safest)
  const text = await response.text();
  console.log("📄 Raw response body:", text);

  let data = {};

  // try JSON parse safely
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.warn("⚠️ Server returned non-JSON (probably HTML error page)");
  }

  // handle HTTP errors
  if (!response.ok) {
    throw new Error(
      data?.message ||
      `Server error ${response.status}. Please try again later`
    );
  }

  if (!data?.user) {
    throw new Error("Invalid login response from server");
  }

  await AsyncStorage.setItem('user_info', JSON.stringify(data.user));

  return data.user;
};


export const pushDataToServer = async (data) => {
  try {
    const response = await fetch(`${BASE_URL}/dashboard/datacollection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const contentType = response.headers.get('Content-Type') || '';
    const isJson = contentType.includes('application/json');
    const body = isJson ? await response.json() : await response.text();

    if (!response.ok) throw new Error(body?.message || 'Failed to push mosquito data');

    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    console.error('❌ Mosquito data push failed:', error);
    return { ok: false, status: 0, body: error.message };
  }
};
// Push data
export const pushChlorineDataByRole = async (data, user) => {
  try {
    // Decide endpoint based on user role or module
    const isHudCollector = user?.role === 'hi_user';
    const apiUrl = isHudCollector
      ? `${BASE_URL}/dashboard/chl_hud_datacollection`
      : `${BASE_URL}/dashboard/chl_datacollection`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const contentType = response.headers.get('Content-Type') || '';
    const isJson = contentType.includes('application/json');
    const body = isJson ? await response.json() : await response.text();

    if (!response.ok) throw new Error(body?.message || 'Failed to push data');

    return body;
  } catch (error) {
    console.error('❌ Chlorine data push failed:', error);
    throw error;
  }
};


// Get date-wise user count (returns totals per date in dd-mm-yyyy format)
export const getDatewiseUserCount = async (user_id) => {
  try {
    const endpoint = `${BASE_URL}/dashboard/datacollection/count-by-date?user_id=${user_id}`;
    const response = await fetch(endpoint);
    const data = await response.json();

    if (!response.ok) throw new Error(data.message || 'Failed to fetch user data counts');

    return data; // { "26-08-2025": 5, "27-08-2025": 3, ... }
  } catch (err) {
    console.error('❌ User count fetch error:', err);
    return {}; // fallback so UI won't crash
  }
};

export const getDatewiseUserCountDetails = async (user_id, date) => {
  try {
    const endpoint = `${BASE_URL}/dashboard/datacollection/details-by-date?user_id=${user_id}&date=${date}`;
    const response = await fetch(endpoint);
    const data = await response.json();
    return data; // should return { count: number }
  } catch (err) {
    console.error("API error:", err);
    return { count: 0 };
  }
};

export const getUserCounts = async (user_id, role, type) => {
  try {
    const endpoint = `${BASE_URL}/dashboard/daily-counts?user_id=${user_id}&role=${role}&type=${type}`;
    const response = await fetch(endpoint);

    const text = await response.text(); // always read raw text first
    console.log('📄 Raw response:', text);

    // Try parse JSON safely
    let data = {};
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.warn('⚠️ Response is not JSON:', text);
      return {}; // fallback
    }

    if (!response.ok) throw new Error(data.message || 'Failed to fetch counts');
    return data;
  } catch (err) {
    console.error('❌ User counts fetch error:', err);
    return {};
  }
};


// Push chlorine data (handles HUD and regular data)
export const pushChlorineData = async (data, user) => {
  try {
    const isHudCollector = user?.role === 'hi_user';
    const apiUrl = isHudCollector
      ? `${BASE_URL}/dashboard/chl_hud_datacollection`
      : `${BASE_URL}/dashboard/chl_datacollection`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const contentType = response.headers.get('Content-Type') || '';
    const isJson = contentType.includes('application/json');
    const body = isJson ? await response.json() : await response.text();

    if (!response.ok) throw new Error(body?.message || 'Failed to push chl data');

    return body;
  } catch (error) {
    console.error('❌ Chlorine data push failed:', error);
    throw error;
  }
};


//  Dashboard
export const getDashboardData = async () => {
  try {
    const response = await fetch(`${BASE_URL}/dashboard/data`);
    const data = await response.json();

    if (!response.ok) throw new Error(data.message || 'Failed to fetch dashboard data');

    return data;
  } catch (error) {
    console.error('❌ Dashboard data fetch failed:', error);
    throw error;
  }
};

// Get inspection plan
export const getInspectionPlan = async (user_id) => {
  try {
    const response = await fetch(`${BASE_URL}/dashboard/inspection-plan?user_id=${user_id}`);

    if (!response.ok) {
      throw new Error('Failed to fetch');
    }

    const data = await response.json();
    // console.log("Raw API response:", data);

    if (data.printablePlan && Array.isArray(data.printablePlan)) {
      // Filter plans to only include those for the current user
      const userPlans = data.printablePlan.filter(plan => plan.user_id === user_id);
      return userPlans;
    } else {
      console.warn("API returned no printablePlan array:", data);
      return [];
    }
  } catch (error) {
    console.error("❌ API call failed (getInspectionPlan):", error);
    return [];
  }
};

export const savePlanStatus = async (payload) => {
  try {
    const res = await fetch(`${BASE_URL}/dashboard/save-plan-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Save plan status failed');
    }

    return data;
  } catch (err) {
    console.error('❌ API error (savePlanStatus):', err);
    throw err;
  }
};

// export const getInspectionPlanStatus = async (user_id) => {
//   try {
//     const response = await fetch(`${BASE_URL}/dashboard/inspection-plan-status?user_id=${user_id}`);
//     const data = await response.json();

//     if (!response.ok) {
//       throw new Error(data.message || 'Failed to fetch inspection plan status');
//     }

//     return data;
//   } catch (err) {
//     console.error('❌ Error fetching inspection plan status:', err);
//     throw err;
//   }
// };

// ✅ Get saved inspection plan status for a user
// api/index.js
export const getInspectionPlanStatus = async (user_id) => {
  try {
    const response = await fetch(`${BASE_URL}/dashboard/get-save-plan-status?user_id=${user_id}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch inspection plan status');
    }

    return data;
  } catch (err) {
    console.error('❌ Error fetching inspection plan status:', err);
    throw err;
  }
};
