import { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { tracks } from './src/data/tracks';
import { CustomTabBar } from './src/components/navigation/CustomTabBar';
import { PlayerOverlay } from './src/components/player/PlayerOverlay';
import { HomeScreen } from './src/screens/HomeScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { RadioScreen } from './src/screens/RadioScreen';
import { SearchScreen } from './src/screens/SearchScreen';
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
