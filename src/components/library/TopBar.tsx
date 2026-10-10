import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export const TopBar = ({ onProfilePress }: { onProfilePress: () => void }) => (
  <View className="flex-row justify-between items-center px-5 pt-2 pb-2">
    <Text className="text-white text-[34px] font-bold tracking-normal">Library</Text>

    <TouchableOpacity
      onPress={onProfilePress}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel="Open developer profile"
      style={{ width: 48, height: 48, borderRadius: 24, overflow: 'hidden' }}
    >
      <LinearGradient colors={['#514A68', '#262331']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="person" size={27} color="white" />
      </LinearGradient>
    </TouchableOpacity>
  </View>
);


