import { Ionicons } from '@expo/vector-icons';
import AVRoutePickerView from 'react-native-avroutepickerview';
import { Alert, Platform, TouchableOpacity, UIManager, View } from 'react-native';

const hasIOSRoutePicker = () => {
  if (Platform.OS !== 'ios') return false;
  try {
    return Boolean(UIManager.getViewManagerConfig('AVRoutePicker'));
  } catch {
    return false;
  }
};

export const PlayerOutputRouteButton = () => {
  if (hasIOSRoutePicker()) {
    return (
      <View
        accessibilityLabel="Choose an audio output"
        style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}
      >
        <AVRoutePickerView
          color="rgba(255,255,255,0.68)"
          activeColor="#FA5265"
          style={{ width: 38, height: 38 }}
          accessibilityLabel="Choose an AirPlay audio output"
        />
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={() => Alert.alert(
        'Audio output',
        Platform.OS === 'ios'
          ? 'Install the iOS development build to choose an AirPlay output.'
          : 'Choose Bluetooth or connected audio devices from your system audio controls.',
      )}
      accessibilityRole="button"
      accessibilityLabel="Audio output options"
      hitSlop={10}
      style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name="radio-outline" size={26} color="rgba(255,255,255,0.68)" />
    </TouchableOpacity>
  );
};
