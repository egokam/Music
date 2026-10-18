import { useCallback, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const ACCENT = '#FA243C';
const ACCENT_LABEL = '#FA5265';
const INACTIVE = '#A1A1A8';
const BAR_HEIGHT = 68;
const BAR_PADDING = 4;
const HAS_GLASS = isLiquidGlassAvailable();

// Spring presets
const SETTLE = { damping: 17, stiffness: 210, mass: 0.8 };   // lens settling on a tab
const FOLLOW = { damping: 26, stiffness: 420, mass: 0.6 };   // lens chasing the finger (slight lag = stretch)
const LIFT = { damping: 15, stiffness: 260, mass: 0.6 };     // press / release

const ICONS = {
  Home: ['home', 'home-outline'],
  Radio: ['radio', 'radio-outline'],
  Library: ['albums', 'albums-outline'],
} as const;

type IconKey = keyof typeof ICONS;

const hapticTick = () => {
  Haptics.selectionAsync();
};

const rubberBand = (value: number, min: number, max: number) => {
  'worklet';
  if (value < min) return min - 0.25 * (1 - 1 / (1 + (min - value) * 2));
  if (value > max) return max + 0.25 * (1 - 1 / (1 + (value - max) * 2));
  return value;
};

const clamp = (v: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(v, min), max);
};

type TabItemProps = {
  name: string;
  itemIndex: number;
  position: SharedValue<number>;
  selected: boolean;
  onSelect: () => void;
};

const TabItem = ({ name, itemIndex, position, selected, onSelect }: TabItemProps) => {
  const [filled, outline] = ICONS[name as IconKey] ?? ICONS.Home;

  // 1 when the lens is exactly under this tab, 0 when a full slot away
  const progress = (p: number) => {
    'worklet';
    return interpolate(Math.abs(p - itemIndex), [0, 1], [1, 0], Extrapolation.CLAMP);
  };

  const activeIcon = useAnimatedStyle(() => ({ opacity: progress(position.value) }));
  const inactiveIcon = useAnimatedStyle(() => ({ opacity: 1 - progress(position.value) }));
  const label = useAnimatedStyle(() => ({
    color: interpolateColor(progress(position.value), [0, 1], [INACTIVE, ACCENT_LABEL]),
  }));

  return (
    <Pressable
      style={styles.item}
      accessibilityRole="tab"
      accessibilityLabel={name}
      accessibilityState={{ selected }}
      onPress={onSelect}
    >
      <View style={styles.iconBox}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, inactiveIcon]}>
          <Ionicons name={outline} size={24} color={INACTIVE} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, activeIcon]}>
          <Ionicons name={filled} size={24} color={ACCENT} />
        </Animated.View>
      </View>
      <Animated.Text style={[styles.label, label]}>{name}</Animated.Text>
    </Pressable>
  );
};

export const CustomTabBar = ({ state, navigation }: BottomTabBarProps) => {
  const mainRoutes = useMemo(
    () => state.routes.filter((route) => route.name !== 'Search'),
    [state.routes],
  );
  const searchRoute = state.routes.find((route) => route.name === 'Search');
  const activeMainIndex = mainRoutes.findIndex((r) => r.key === state.routes[state.index]?.key);
  const count = mainRoutes.length;

  // Lens state (all UI-thread)
  const position = useSharedValue(Math.max(activeMainIndex, 0)); // where the lens is (fractional)
  const target = useSharedValue(Math.max(activeMainIndex, 0));   // where it is heading
  const lift = useSharedValue(0);                                // 0 = resting, 1 = picked up
  const lensOpacity = useSharedValue(activeMainIndex >= 0 ? 1 : 0);
  const dragging = useSharedValue(false);
  const grab = useSharedValue(0);
  const pressed = useSharedValue(0);
  const slotSV = useSharedValue(0);
  const countSV = useSharedValue(count);
  const activeSV = useSharedValue(Math.max(activeMainIndex, 0));

  // Keep the lens in sync with real navigation state (deep links, back, etc.)
  useEffect(() => {
    countSV.value = count;
    activeSV.value = Math.max(activeMainIndex, 0);
    if (dragging.value) return;
    if (activeMainIndex < 0) {
      lensOpacity.value = withTiming(0, { duration: 160 });
      return;
    }
    lensOpacity.value = withTiming(1, { duration: 100 });
    target.value = activeMainIndex;
    position.value = withSpring(activeMainIndex, SETTLE);
  }, [activeMainIndex, count, activeSV, countSV, dragging, lensOpacity, position, target]);

  // Haptic tick every time the lens crosses into a new tab while dragging
  useAnimatedReaction(
    () => Math.round(position.value),
    (current, previous) => {
      if (dragging.value && previous !== null && current !== previous) {
        scheduleOnRN(hapticTick);
      }
    },
    [],
  );

  const selectMainTab = useCallback(
    (mainIndex: number) => {
      const route = mainRoutes[mainIndex];
      if (!route) return;
      const routeIndex = state.routes.findIndex((r) => r.key === route.key);
      if (state.index === routeIndex) return;

      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (event.defaultPrevented) {
        const back = Math.max(activeMainIndex, 0);
        target.value = back;
        position.value = withSpring(back, SETTLE);
        return;
      }
      navigation.navigate(route.name);
    },
    [activeMainIndex, mainRoutes, navigation, position, state.index, state.routes, target],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        // Let a normal press reach each tab. The pan only takes over after
        // the finger moves horizontally far enough to count as a drag.
        .activeOffsetX([-10, 10])
        .failOffsetY([-16, 16])
        .shouldCancelWhenOutside(false)
        .onStart((e) => {
          const slot = slotSV.value;
          if (slot <= 0) return;
          const idx = clamp(Math.floor(e.x / slot), 0, countSV.value - 1);
          pressed.value = idx;
          const onLens = lensOpacity.value > 0.5 && Math.round(position.value) === idx;
          if (onLens) {
            // Pick the lens up exactly where the finger grabbed it (no jump)
            grab.value = position.value - (e.x / slot - 0.5);
            dragging.value = true;
            lift.value = withSpring(1, LIFT);
          }
        })
        .onUpdate((e) => {
          const slot = slotSV.value;
          if (slot <= 0) return;
          if (!dragging.value) {
            if (Math.abs(e.translationX) < 10) return;
            // Drag started from a different tab: the lens flies to the finger
            dragging.value = true;
            grab.value = 0;
            lensOpacity.value = withTiming(1, { duration: 100 });
            lift.value = withSpring(1, LIFT);
          }
          const raw = e.x / slot - 0.5 + grab.value;
          const next = rubberBand(raw, 0, countSV.value - 1);
          target.value = next;
          position.value = withSpring(next, FOLLOW);
        })
        .onEnd((e) => {
          const slot = slotSV.value;
          if (slot <= 0) return;
          const max = countSV.value - 1;
          let next: number;
          if (dragging.value) {
            // Momentum: a flick carries the lens a bit further
            next = clamp(Math.round(position.value + (e.velocityX / slot) * 0.08), 0, max);
            dragging.value = false;
            lift.value = withSpring(0, LIFT);
          } else {
            next = pressed.value;
            lift.value = withSequence(withTiming(0.7, { duration: 90 }), withSpring(0, LIFT));
          }
          lensOpacity.value = withTiming(1, { duration: 100 });
          target.value = next;
          position.value = withSpring(next, SETTLE);
          scheduleOnRN(selectMainTab, next);
        })
        .onFinalize((_e, success) => {
          if (success) return;
          dragging.value = false;
          lift.value = withSpring(0, LIFT);
          target.value = activeSV.value;
          position.value = withSpring(activeSV.value, SETTLE);
        }),
    [activeSV, countSV, dragging, grab, lensOpacity, lift, position, pressed, selectMainTab, slotSV, target],
  );

  const lensStyle = useAnimatedStyle(() => {
    const l = lift.value;
    // Stretch while travelling, relax on arrival
    const travel = Math.min(Math.abs(target.value - position.value), 1);
    const grow = 1 + l * 0.14;
    return {
      opacity: lensOpacity.value,
      width: slotSV.value,
      transform: [
        { translateX: position.value * slotSV.value },
        { scaleX: grow * (1 + travel * 0.12) },
        { scaleY: grow * (1 - travel * 0.05) },
      ],
      // Resting: soft frosted fill. Lifted: clearer, brighter rim, soft shadow.
      backgroundColor: `rgba(255,255,255,${0.15 - l * 0.07})`,
      borderColor: `rgba(255,255,255,${0.16 + l * 0.26})`,
      shadowOpacity: l * 0.35,
    };
  });

  return (
    <View style={styles.root} pointerEvents="box-none">
      <GlassContainer spacing={8} style={styles.row}>
        {/* Main capsule */}
        <View style={styles.barWrap}>
          <GlassView
            glassEffectStyle="regular"
            colorScheme="dark"
            style={[StyleSheet.absoluteFill, styles.capsule, !HAS_GLASS && styles.capsuleFallback]}
          />

          <GestureDetector gesture={gesture}>
            <View
              style={styles.track}
              onLayout={(e) => {
                slotSV.value = e.nativeEvent.layout.width / Math.max(count, 1);
              }}
            >
              <Animated.View pointerEvents="none" style={[styles.lens, lensStyle]} />

              {mainRoutes.map((route, mainIndex) => (
                <TabItem
                  key={route.key}
                  name={route.name}
                  itemIndex={mainIndex}
                  position={position}
                  selected={activeMainIndex === mainIndex}
                  onSelect={() => selectMainTab(mainIndex)}
                />
              ))}
            </View>
          </GestureDetector>
        </View>

        {/* Search bubble */}
        {searchRoute ? (
          <GlassView
            isInteractive
            glassEffectStyle="regular"
            colorScheme="dark"
            style={[styles.searchGlass, !HAS_GLASS && styles.capsuleFallback]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Search"
              accessibilityState={{ selected: state.routes[state.index]?.key === searchRoute.key }}
              style={styles.center}
              onPress={() => {
                const focused = state.routes[state.index]?.key === searchRoute.key;
                const event = navigation.emit({
                  type: 'tabPress',
                  target: searchRoute.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) navigation.navigate(searchRoute.name);
              }}
            >
              <Ionicons
                name={state.routes[state.index]?.key === searchRoute.key ? 'search' : 'search-outline'}
                size={26}
                color={state.routes[state.index]?.key === searchRoute.key ? ACCENT_LABEL : '#FFFFFF'}
              />
            </Pressable>
          </GlassView>
        ) : null}
      </GlassContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 16, right: 16, bottom: 24 },
  row: { height: BAR_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 12 },
  barWrap: { flex: 1, height: BAR_HEIGHT }, // no overflow:hidden so the lifted lens can extend past the edges
  capsule: { borderRadius: BAR_HEIGHT / 2 },
  capsuleFallback: { backgroundColor: 'rgba(32,32,36,0.92)' },
  track: { flex: 1, flexDirection: 'row', margin: BAR_PADDING },
  lens: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: (BAR_HEIGHT - BAR_PADDING * 2) / 2,
    borderWidth: StyleSheet.hairlineWidth * 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconBox: { width: 28, height: 26 },
  center: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  label: { fontSize: 10.5, fontWeight: '600', marginTop: 2, letterSpacing: 0.1 },
  searchGlass: { width: BAR_HEIGHT, height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2 },
});
