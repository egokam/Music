import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

type TabRoute = BottomTabBarProps['state']['routes'][number];

export const CustomTabBar = ({
  state,
  navigation,
}: BottomTabBarProps) => {
  const navigateToRoute = (route: TabRoute, index: number) => {
    const isFocused = state.index === index;
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  return (
    <View style={{ position: 'absolute', left: 16, right: 16, bottom: 24 }}>
      <View style={{ height: 68, flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            flex: 1,
            height: '100%',
            marginRight: 12,
            paddingHorizontal: 12,
            borderRadius: 34,
            backgroundColor: '#1C1C1E',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {state.routes.map((route, index) => {
            if (route.name === 'Search') return null;

            const isFocused = state.index === index;
            const iconName =
              route.name === 'Home'
                ? isFocused ? 'home' : 'home-outline'
                : route.name === 'Radio'
                  ? isFocused ? 'radio' : 'radio-outline'
                  : route.name === 'Library'
                    ? isFocused ? 'albums' : 'albums-outline'
                    : null;
            if (!iconName) return null;

            return (
              <TouchableOpacity
                key={route.key}
                onPress={() => navigateToRoute(route, index)}
                accessibilityRole="button"
                accessibilityLabel={route.name}
                style={{
                  minWidth: 68,
                  paddingHorizontal: 8,
                  paddingVertical: 7,
                  borderRadius: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isFocused ? '#2C181C' : 'transparent',
                }}
              >
                <Ionicons name={iconName} size={23} color={isFocused ? '#FA243C' : '#8E8E93'} />
                <Text
                  style={{
                    color: isFocused ? '#FA243C' : '#8E8E93',
                    fontSize: 11,
                    marginTop: 2,
                  }}
                >
                  {route.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {state.routes.map((route, index) => {
          if (route.name !== 'Search') return null;
          const isFocused = state.index === index;

          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => navigateToRoute(route, index)}
              accessibilityRole="button"
              accessibilityLabel="Search"
              style={{
                width: 68,
                height: 68,
                borderRadius: 34,
                backgroundColor: '#1C1C1E',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={isFocused ? 'search' : 'search-outline'}
                size={26}
                color={isFocused ? '#FA243C' : 'white'}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};
