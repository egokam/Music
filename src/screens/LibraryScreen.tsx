import { ScrollView, Text, View } from 'react-native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LibraryList } from '../components/library/LibraryList';
import { TopBar } from '../components/library/TopBar';
import { usePlaybackActions } from '../contexts/PlaybackContext';
import { SongsScreen } from './SongsScreen';

type LibraryStackParamList = {
  LibraryHome: undefined;
  Songs: undefined;
};

const Stack = createNativeStackNavigator<LibraryStackParamList>();

const LibraryHomeScreen = ({
  navigation,
}: NativeStackScreenProps<LibraryStackParamList, 'LibraryHome'>) => (
  <SafeAreaView className="flex-1 bg-black" edges={['top']}>
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 190 }}>
      <TopBar />
      <LibraryList
        onSelectCategory={(title) => {
          if (title === 'Songs') navigation.navigate('Songs');
        }}
      />
      <View className="px-5 mt-6 mb-4">
        <Text className="text-white text-[22px] font-bold">Recently Added</Text>
      </View>
    </ScrollView>
  </SafeAreaView>
);

const SongsRoute = ({
  navigation,
}: NativeStackScreenProps<LibraryStackParamList, 'Songs'>) => {
  const { playTrack, playAllSongs, shuffleSongs } = usePlaybackActions();

  return (
    <SongsScreen
      onBack={() => navigation.goBack()}
      onSelectTrack={playTrack}
      onPlayAll={playAllSongs}
      onShuffle={shuffleSongs}
    />
  );
};

export const LibraryScreen = () => (
  <Stack.Navigator
    initialRouteName="LibraryHome"
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: '#000000' },
      animation: 'simple_push',
      animationDuration: 280,
      gestureEnabled: true,
      gestureDirection: 'horizontal',
      fullScreenGestureEnabled: true,
      animationMatchesGesture: true,
    }}
  >
    <Stack.Screen name="LibraryHome" component={LibraryHomeScreen} />
    <Stack.Screen name="Songs" component={SongsRoute} />
  </Stack.Navigator>
);
