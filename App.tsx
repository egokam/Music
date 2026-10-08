import { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { tracks } from './src/data/tracks';
import { CustomTabBar } from './src/components/navigation/CustomTabBar';
import { PlayerOverlay } from './src/components/player/PlayerOverlay';
import { PlaybackContext } from './src/contexts/PlaybackContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { RadioScreen } from './src/screens/RadioScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import type { Track } from './src/types';
import './styles.css';

const Tab = createBottomTabNavigator();

export default function App() {
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerVisible, setPlayerVisible] = useState(false);
  const activeTrack = tracks[activeTrackIndex];

  const skipNext = () => {
    setActiveTrackIndex((currentIndex) => (currentIndex + 1) % tracks.length);
  };

  const skipPrevious = () => {
    setActiveTrackIndex((currentIndex) => (currentIndex - 1 + tracks.length) % tracks.length);
  };

  const playbackActions = {
    playTrack: (track: Track) => {
      const trackIndex = tracks.findIndex((item) => item.id === track.id);
      if (trackIndex < 0) return;
      setActiveTrackIndex(trackIndex);
      setIsPlaying(true);
    },
    playAllSongs: () => {
      setActiveTrackIndex(0);
      setIsPlaying(true);
    },
    shuffleSongs: () => {
      setActiveTrackIndex(Math.floor(Math.random() * tracks.length));
      setIsPlaying(true);
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PlaybackContext.Provider value={playbackActions}>
        <NavigationContainer>
          <Tab.Navigator
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{ headerShown: false }}
            initialRouteName="Library"
          >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Radio" component={RadioScreen} />
            <Tab.Screen name="Library" component={LibraryScreen} />
            <Tab.Screen name="Search" component={SearchScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      </PlaybackContext.Provider>
      <PlayerOverlay
        visible={playerVisible}
        track={activeTrack}
        isPlaying={isPlaying}
        onOpen={() => setPlayerVisible(true)}
        onClose={() => setPlayerVisible(false)}
        onTogglePlayback={() => setIsPlaying((playing) => !playing)}
        onSkipPrevious={skipPrevious}
        onSkipNext={skipNext}
      />
    </GestureHandlerRootView>
  );
}
