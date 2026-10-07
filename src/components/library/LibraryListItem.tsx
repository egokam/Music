import type { ComponentProps } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const LibraryListItem = ({
  title,
  icon,
  isLast,
}: {
  title: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  isLast: boolean;
}) => (
  <TouchableOpacity className="flex-row items-center pl-5 active:bg-zinc-900">
    <View className="w-10 items-start">
      <Ionicons name={icon} size={24} color="#FA243C" />
    </View>
    <View
      className={`flex-1 flex-row items-center justify-between py-[14px] pr-5 ${
        !isLast ? 'border-b border-[#2C2C2E]' : ''
      }`}
    >
      <Text className="text-white text-[20px]">{title}</Text>
      <Ionicons name="chevron-forward" size={20} color="#3A3A3C" />
    </View>
  </TouchableOpacity>
);
