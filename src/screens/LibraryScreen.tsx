import { BackHandler, ScrollView, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LibraryList } from '../components/library/LibraryList';
import { TopBar } from '../components/library/TopBar';
import { usePlaybackActions } from '../contexts/PlaybackContext';
import { SongsScreen } from './SongsScreen';

export const LibraryScreen = () => {
  const [showSongs, setShowSongs] = useState(false);
  const { playTrack, playAllSongs, shuffleSongs } = usePlaybackActions();

  useEffect(() => {
    if (!showSongs) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowSongs(false);
      return true;
    });
    return () => subscription.remove();
  }, [showSongs]);

  if (showSongs) {
    return (
      <SongsScreen
        onBack={() => setShowSongs(false)}
        onSelectTrack={playTrack}
        onPlayAll={playAllSongs}
        onShuffle={shuffleSongs}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top']}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 190 }}>
        <TopBar />
        <LibraryList onSelectCategory={(title) => setShowSongs(title === 'Songs')} />
        <View className="px-5 mt-6 mb-4">
          <Text className="text-white text-[22px] font-bold">Recently Added</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
