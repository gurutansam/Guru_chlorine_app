import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Button, Image, StyleSheet, Text, View } from 'react-native';

export default function CapturePredictScreen() {
  const [image, setImage] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      base64: false,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setPrediction(null);
    }
  };

  const predictPPM = async () => {
    if (!image) return Alert.alert('No image selected');

    const formData = new FormData();
    formData.append("image", {
      uri: image,
      name: "photo.jpg",
      type: "image/jpeg",
    });

    setLoading(true);
    try {
      const response = await fetch('http://192.168.1.145:5100/vfive_predict', {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (response.ok) {
        if (result.success === false) {
          throw new Error(result.message || "Prediction failed");
        }
        setPrediction(result.ppm); // ✅ match backend response
      } else {
        throw new Error(result.error || "Prediction failed");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };



  return (
    <View style={styles.container}>
      <Button title="Capture Image" onPress={pickImage} />
      {image && <Image source={{ uri: image }} style={styles.image} />}
      {image && !loading && <Button title="Capture & Predict" onPress={predictPPM} />}
      {loading && <ActivityIndicator size="large" color="#0000ff" />}
      {prediction && (
        <Text style={styles.resultText}>
          Predicted Chlorine PPM: {parseFloat(prediction) > 3 ? '> 3.00' : prediction}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  image: { width: 300, height: 300, marginTop: 20, marginBottom: 20 },
  resultText: { fontSize: 18, fontWeight: 'bold', color: 'green', marginTop: 20 },
});
