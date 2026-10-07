import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LibraryList } from '../components/library/LibraryList';
import { TopBar } from '../components/library/TopBar';

export const LibraryScreen = () => (
  <SafeAreaView className="flex-1 bg-black" edges={['top']}>
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 190 }}>
      <TopBar />
      <LibraryList />
      <View className="px-5 mt-6 mb-4">
        <Text className="text-white text-[22px] font-bold">Recently Added</Text>
      </View>
    </ScrollView>
  </SafeAreaView>
);
