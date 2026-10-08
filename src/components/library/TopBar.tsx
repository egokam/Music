import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const TopBar = () => (
  <View className="flex-row justify-between items-center px-5 pt-2 pb-2">
    <Text className="text-white text-[34px] font-bold tracking-normal">Library</Text>

    <View className="flex-row items-center">
      <View className="flex-row items-center bg-[#1C1C1E] rounded-full px-4 py-2 mr-3">
        <TouchableOpacity className="mr-4" accessibilityLabel="Library options">
          <Ionicons name="list" size={20} color="white" />
        </TouchableOpacity>
        <TouchableOpacity accessibilityLabel="More library options">
          <Ionicons name="ellipsis-horizontal" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity className="w-[42px] h-[42px] bg-[#2C2C2E] rounded-full items-center justify-center" accessibilityLabel="Profile">
        <Ionicons name="person" size={24} color="white" />
      </TouchableOpacity>
    </View>
  </View>
);


