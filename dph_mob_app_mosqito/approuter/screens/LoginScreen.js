// screens/CommonLoginScreen.js
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
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser } from './../api';
import { Ionicons } from '@expo/vector-icons';

export default function CommonLoginScreen({ navigation }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async () => {
      if (!userId || !password) {
        Alert.alert('Validation Error', 'Please enter Email ID and password');
        return;
      }

      setLoading(true);
      try {
        const user = await loginUser(userId, password);

        if (!user?.role) {
          throw new Error('Access denied: No role assigned');
        }

        await AsyncStorage.setItem('user_info', JSON.stringify(user));

      const role = user.role; // keep it as RWAL_hi_user
        if (
          role === 'hi_user' ||
          role === 'block_user' ||
          role === 'RWAL_hi_user'|| 
          role === 'special_user' || 
          role === 'DHO' ||
          role === 'chl_admin'||
          role === 'mos_admin'
        ) {
          navigation.replace('AppHome');
        } else {
          Alert.alert(
            'Access Denied',
            'You are not authorized to access this application'
          );
        }


      } catch (error) {
        console.error('Login error:', error);
        Alert.alert('Login Failed', error.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#e2eafc' }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={{ flex: 1, justifyContent: 'flex-start', paddingHorizontal: 20, paddingTop: 140 }}>
            <View style={styles.contentWrapper}>
              {/* --- Header Logos --- */}
              <View style={styles.logoRow}>
                <Image source={require('../../assets/dph.png')} style={styles.logoLeft}/>
                <Image source={require('../../assets/tnlogo.png')} style={styles.logoMiddle}/>
                <Image source={require('../../assets/nhm.png')} style={styles.logoRight}/>
              </View>

              <Text style={styles.subtitle}>
                Directorate of Public Health and Preventive Medicine
              </Text>

              {/* --- Login Form Card --- */}
              <View style={styles.card}>
                <Text style={styles.label}>Email</Text>
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
                    style={[styles.input, { paddingRight: 35 }]}
                    secureTextEntry={!showPassword}
                    placeholderTextColor="#aaa"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(prev => !prev)}
                    style={styles.eyeIcon}
                  >
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
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>


          {/* --- Footer --- */}
          <View style={styles.footerContainer}>
            <Text style={styles.footerNote}>Field Monitoring Application</Text>
            <Text style={styles.footerNoteOne}>Version 1.1.0.2</Text>
            <Text style={styles.footerNoteTwo}>
              Developed by <Text style={styles.footerNoteTwoBold}>TANSAM</Text>
            </Text>
          </View>

        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 140,
    backgroundColor: '#e2eafc',
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: '100%',
  },
  logoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  logoMiddle: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
    marginHorizontal: 10,
  },
  logoLeft: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
  },
  logoRight: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
  },
  subtitle: {
    fontSize: 19,
    color: '#000080',
    marginBottom: 40,
    fontFamily: 'Ubuntu_700Bold',
    textAlign: 'center',
    width: '90%',
  },
  card: {
    width: '95%',
    padding: 25,
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 25,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    alignSelf: 'center',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 7,
    color: '#444',
    fontFamily: 'Poppins_500Medium',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 18,
    backgroundColor: '#f5f8ff',
    height: 50,
  },
  icon: { marginRight: 10 },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#333',
    fontFamily: 'Poppins_400Regular',
  },
  button: {
    backgroundColor: '#005493',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 15,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  eyeIcon: { position: 'absolute', right: 10, padding: 5 },
  footerContainer: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    alignItems: 'center',
  },
  footerNote: {
    marginTop: 0,
    fontSize: 19,
    color: '#333',
    fontFamily: 'Ubuntu_400Regular',
    textAlign: 'center',
  },
  footerNoteOne: {
    fontSize: 16,
    color: '#555',
    fontFamily: 'Ubuntu_400Regular',
    textAlign: 'center',
    marginTop: 4,
  },
  footerNoteTwo: {
    fontSize: 16,
    color: '#555',
    fontFamily: 'Ubuntu_400Regular',
    textAlign: 'center',
    marginTop: 4,
  },
  footerNoteTwoBold: {
    fontFamily: 'Ubuntu_700Bold',
    color: '#000080',
  },
});
