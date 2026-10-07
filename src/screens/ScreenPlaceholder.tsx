import { Text, View } from 'react-native';

export const ScreenPlaceholder = ({ title }: { title: string }) => (
  <View className="flex-1 items-center justify-center bg-black">
    <Text className="text-2xl font-bold text-white">{title}</Text>
  </View>
);
