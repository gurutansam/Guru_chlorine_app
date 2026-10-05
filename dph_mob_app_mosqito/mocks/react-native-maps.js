import React from 'react';
import { View, Text } from 'react-native';

const MapView = ({ children, style }) => (
  <View style={[{ backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', minHeight: 200 }, style]}>
    <Text style={{ color: '#64748b', fontWeight: 'bold' }}>[Map View Placeholder (Web Mode)]</Text>
    {children}
  </View>
);

export const Marker = ({ children }) => <View>{children}</View>;
export const LocalTile = () => null;

export default MapView;
