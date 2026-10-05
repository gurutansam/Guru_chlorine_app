import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser } from './../../api';
import { Ionicons } from '@expo/vector-icons';

export default function WaterLoginScreen({ navigation }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);


const handleLogin = async () => {
  if (!userId || !password) {
    Alert.alert('Please enter Email ID and password');
    return;
  }

  setLoading(true);
  try {
    let user;

    try {
      console.log("🔄 Attempting backend login with:", { userId, password });

      // Try backend first
      user = await loginUser(userId, password);

      console.log("✅ Backend login response:", user);

      // ✅ Check if module is "chlorination"
      if (!user?.module) {
        console.log("❌ No module field found in response");
        throw new Error('Access denied: No module assigned');
      }

      if (user.module.toLowerCase() !== 'chlorination') {
        console.log(`❌ Module mismatch: expected 'chlorination', got '${user.module}'`);
        throw new Error('Access denied: You are not authorized for chlorination module');
      }

    } catch (apiError) {
      console.warn('⚠️ Backend login failed:', apiError.message);

      // ❌ No fallback — block if backend fails
      throw new Error(apiError.message || 'Invalid credentials');
    }

    // Save user info
    console.log("💾 Saving user info to AsyncStorage:", user);
    await AsyncStorage.setItem('user_info', JSON.stringify(user));

    Alert.alert('Success', 'Login successful');
    navigation.replace('WaterFlow');

  } catch (error) {
    console.error('❌ Unexpected login error:', error);
    Alert.alert('Login Failed', error.message || 'Something went wrong');
  } finally {
    setLoading(false);
    console.log("✅ Login process completed");
  }
};



  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.headerBlob} />
          <View style={styles.logoContainer}>
              <Image
                  source={require('../../../assets/dph.png')} 
                  style={styles.logoImage}
                  resizeMode="contain"
                />
            <Text style={styles.logoText}>💧 Water Quality Analysis</Text>
            <Text style={styles.subText}>LOG IN</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Email </Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color="#777" style={styles.icon} />
              <TextInput
                placeholder="Enter E-mail ID"
                value={userId}
                onChangeText={setUserId}
                style={styles.input}
                placeholderTextColor="#aaa"
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#777" style={styles.icon} />
              <TextInput
                placeholder="Enter password"
                value={password}
                onChangeText={setPassword}
                style={[styles.input, { paddingRight: 35 }]} // space for the icon
                secureTextEntry={!showPassword}
                placeholderTextColor="#aaa"
              />
              <TouchableOpacity onPress={() => setShowPassword(prev => !prev)} style={styles.eyeIcon}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#777"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </TouchableOpacity>

            <View style={{ alignItems: 'flex-end', marginTop: 15 }}>
              <TouchableOpacity onPress={() => navigation.replace('Login')}>
                <Text style={styles.backButton}>← Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    paddingBottom: 40
  },
  headerBlob: {
    height: 260,
    backgroundColor: '#005493',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  logoContainer: {
    marginTop: -160,
    alignItems: 'center',
    marginBottom: 10,
  },
  logoImage: {
  width: 120,
  height: 80,
  marginBottom: 8,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#daefff',
  },
  subText: {
    fontSize: 14,
    color: '#c2e5ff',
    marginTop:20,
  },
card: {
  margin: 10,
  padding: 25,
  marginTop: 60,
  backgroundColor: '#fff',
  borderRadius: 20,
  elevation: 8,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.1,
  shadowRadius: 10,
},

  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
    color: '#444'
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 20,
    backgroundColor: '#fafafa',
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 45,
    fontSize: 15,
    color: '#333',
  },
  button: {
    backgroundColor: '#005493',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  eyeIcon: {
  position: 'absolute',
  right: 10,
  padding: 5,
  },
  backButton: {
  textAlign: 'center',
  color: '#005493',
  marginTop: 15,
  fontSize: 14,
  fontWeight: '600',
  textDecorationLine: 'none'
}
});
