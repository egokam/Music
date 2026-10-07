import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import './styles.css';

// ==========================================
// 1. البيانات (تم تغيير الأيقونات لتطابق النمط الخطي)
// ==========================================
const libraryCategories = [
  { id: '1', title: 'Playlists', icon: 'list-outline' },
  { id: '2', title: 'Artists', icon: 'mic-outline' },
  { id: '3', title: 'Albums', icon: 'albums-outline' },
  { id: '4', title: 'Songs', icon: 'musical-note' }, 
  { id: '5', title: 'TV & Movies', icon: 'tv-outline' },
  { id: '6', title: 'Music Videos', icon: 'videocam-outline' },
  { id: '7', title: 'Genres', icon: 'color-filter-outline' },
  { id: '8', title: 'Compilations', icon: 'copy-outline' },
  { id: '9', title: 'Composers', icon: 'musical-notes-outline' },
  { id: '10', title: 'Downloaded', icon: 'arrow-down-circle-outline' },
];

// ==========================================
// 2. المكونات (تم تعديل الهوامش والأحجام)
// ==========================================

const TopBar = () => (
  <View className="flex-row justify-between items-center px-5 pt-2 pb-2">
    <Text className="text-white text-[34px] font-bold tracking-normal">Library</Text>
    
    <View className="flex-row items-center">
      {/* الجزيرة */}
      <View className="flex-row items-center bg-[#1C1C1E] rounded-full px-4 py-2 mr-3">
        <TouchableOpacity className="mr-4">
          <Ionicons name="list" size={20} color="white" />
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="ellipsis-horizontal" size={20} color="white" />
        </TouchableOpacity>
      </View>
      
      {/* أيقونة الملف الشخصي بالحجم المطابق */}
      <TouchableOpacity className="w-[42px] h-[42px] bg-[#2C2C2E] rounded-full items-center justify-center">
        <Ionicons name="person" size={24} color="white" />
      </TouchableOpacity>
    </View>
  </View>
);

const LibraryListItem = ({ title, icon, isLast }: { title: string, icon: any, isLast: boolean }) => (
  <TouchableOpacity className="flex-row items-center pl-5 active:bg-zinc-900">
    <View className="w-10 items-start">
      <Ionicons name={icon} size={24} color="#FA243C" />
    </View>
    <View className={`flex-1 flex-row items-center justify-between py-[14px] pr-5 ${!isLast ? 'border-b border-[#2C2C2E]' : ''}`}>
      <Text className="text-white text-[20px]">{title}</Text>
      <Ionicons name="chevron-forward" size={20} color="#3A3A3C" />
    </View>
  </TouchableOpacity>
);

const LibraryList = () => (
  <View className="mt-2">
    {libraryCategories.map((item, index) => (
      <LibraryListItem 
        key={item.id} 
        title={item.title} 
        icon={item.icon} 
        isLast={index === libraryCategories.length - 1} 
      />
    ))}
  </View>
);

// تم تكبير شريط التنقل وتوسيع المسافات الداخلية
const CustomTabBar = ({ state, navigation }: any) => {
  return (
    <View className="absolute bottom-6 left-4 right-4 flex-row items-center h-[68px]">
      <View className="flex-1 flex-row bg-[#1C1C1E] rounded-[34px] justify-between items-center h-full mr-4 px-6">
        {state.routes.map((route: any, index: number) => {
          if (route.name === 'Search') return null;

          const isFocused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          let iconName: any;
          if (route.name === 'Home') iconName = isFocused ? 'home' : 'home-outline';
          if (route.name === 'Radio') iconName = isFocused ? 'radio' : 'radio-outline';
          if (route.name === 'Library') iconName = isFocused ? 'albums' : 'albums-outline';

          return (
            <TouchableOpacity 
              key={route.key} 
              onPress={onPress} 
              className={`items-center justify-center px-4 py-2 rounded-full ${isFocused ? 'bg-[#2C181C]' : ''}`}
            >
              <Ionicons name={iconName} size={24} color={isFocused ? '#FA243C' : '#8E8E93'} />
              <Text className={`text-[11px] mt-0.5 ${isFocused ? 'text-[#FA243C]' : 'text-[#8E8E93]'}`}>
                {route.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {state.routes.map((route: any, index: number) => {
        if (route.name !== 'Search') return null;
        const isFocused = state.index === index;
        const onPress = () => navigation.navigate(route.name);
        
        return (
          <TouchableOpacity 
            key={route.key} 
            onPress={onPress} 
            className="w-[68px] h-[68px] bg-[#1C1C1E] rounded-full items-center justify-center"
          >
            <Ionicons name={isFocused ? "search" : "search-outline"} size={26} color={isFocused ? '#FA243C' : 'white'} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ==========================================
// 3. الشاشات والتوجيه
// ==========================================

const LibraryScreen = () => {
  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top']}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
        <TopBar />
        <LibraryList />
        
        <View className="px-5 mt-6 mb-4">
          <Text className="text-white text-[22px] font-bold">Recently Added</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const ScreenPlaceholder = ({ title }: { title: string }) => (
  <View className="flex-1 items-center justify-center bg-black">
    <Text className="text-2xl font-bold text-white">{title}</Text>
  </View>
);

const HomeScreen = () => <ScreenPlaceholder title="Home" />;
const RadioScreen = () => <ScreenPlaceholder title="Radio" />;
const SearchScreen = () => <ScreenPlaceholder title="Search" />;

const Tab = createBottomTabNavigator();

export default function App() {
  return (
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
  );
}