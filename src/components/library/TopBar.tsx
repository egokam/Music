import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const TopBar = () => (
  <View className="flex-row justify-between items-center px-5 pt-2 pb-2">
    <Text className="text-white text-[34px] font-bold tracking-normal">Library</Text>

    <TouchableOpacity className="w-[42px] h-[42px] bg-[#2C2C2E] rounded-full items-center justify-center" accessibilityLabel="Profile">
        <Ionicons name="person" size={24} color="white" />
    </TouchableOpacity>
  </View>
);


