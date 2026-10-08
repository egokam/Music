// Reanimated shared-value writes and worklet callbacks are intentional in this component.
/* eslint-disable react-hooks/immutability, react-hooks/refs */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import ReanimatedAnimated, { cancelAnimation, interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import type { Track } from '../../types';

export const PlayerOverlay = ({
  visible,
  track,
  isPlaying,
  onOpen,
  onClose,
  onTogglePlayback,
  onSkipPrevious,
  onSkipNext,
}: {
  visible: boolean;
  track: Track;
  isPlaying: boolean;
  onOpen: () => void;
  onClose: () => void;
  onTogglePlayback: () => void;
  onSkipPrevious: () => void;
  onSkipNext: () => void;
}) => {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const progress = useSharedValue(0);
  const gestureStartProgress = useSharedValue(1);
  const gestureChanged = useSharedValue(false);
  const lyricsProgress = useSharedValue(0);
  const trackTransition = useSharedValue(1);
  const trackTransitionGeneration = useRef(0);
  const onCloseRef = useRef(onClose);
  const [displayTrack, setDisplayTrack] = useState(track);
  const [lyricsView, setLyricsView] = useState({ trackId: track.id, expanded: false });
  const lyricsExpanded = lyricsView.trackId === displayTrack.id && lyricsView.expanded;
  const lyrics = displayTrack.lyrics ?? [];
  const hasLyrics = lyrics.some((line) => line.trim().length > 0);

  const miniTop = Math.max(0, windowHeight - 160);
  const miniBottom = Math.max(0, windowHeight - miniTop - 58);
  const collapseDistance = Math.max(miniTop, 1);
  const artworkSize = Math.min(windowWidth * 0.64, 300);
  const artworkTop = 114 + Math.min(windowHeight * 0.03, 26);
  const titleTop = artworkTop + artworkSize + 106;
  const controlsCenter = titleTop + 172;
  const lyricsArtworkTop = 154;
  const lyricsTitleTop = lyricsArtworkTop + 12;
  const lyricsTextTop = lyricsArtworkTop + 72 + 28;
  const lyricsHeight = lyrics.reduce(
    (height, line) => height + (line.trim().length > 0 ? 44 : 40),
    0,
  );
  const lyricsProgressTop = Math.min(
    lyricsTextTop + lyricsHeight + 24,
    Math.max(lyricsTextTop + 44 + 24, windowHeight - 260),
  );
  const lyricsControlsCenter = lyricsProgressTop + 32 + 28 + 24;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const commitTrackChange = useCallback((nextTrack: Track, generation: number) => {
    if (generation !== trackTransitionGeneration.current) return;
    setDisplayTrack(nextTrack);
  }, []);

  useEffect(() => {
    if (displayTrack.id === track.id) {
      trackTransitionGeneration.current += 1;
      cancelAnimation(trackTransition);
      trackTransition.value = withTiming(1, { duration: 180 });
      return;
    }

    const generation = ++trackTransitionGeneration.current;
    cancelAnimation(trackTransition);
    trackTransition.value = withTiming(0, { duration: 150 }, (finished) => {
      if (finished) scheduleOnRN(commitTrackChange, track, generation);
    });
  }, [commitTrackChange, displayTrack.id, track, trackTransition]);

  useEffect(() => {
    if (!visible) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }

    progress.value = withSpring(1, {
      stiffness: 210,
      damping: 29,
      mass: 0.9,
    });
  }, [visible, progress]);

  useEffect(() => {
    lyricsProgress.value = withTiming(lyricsExpanded && hasLyrics ? 1 : 0, {
      duration: 220,
    });
  }, [hasLyrics, lyricsExpanded, lyricsProgress]);

  useEffect(() => {
    lyricsProgress.value = withTiming(0, { duration: 0 });
  }, [displayTrack.id, lyricsProgress]);

  const closeOnJS = useCallback(() => {
    onCloseRef.current();
  }, []);

  const closeWithAnimation = useCallback(
    (velocityY = 0) => {
      'worklet';
      progress.value = withSpring(
        0,
        {
          stiffness: 210,
          damping: 29,
          mass: 0.9,
          velocity: -velocityY / collapseDistance,
        },
        (finished) => {
          if (finished) scheduleOnRN(closeOnJS);
        },
      );
    },
    [closeOnJS, collapseDistance, progress],
  );

  useEffect(() => {
    if (!visible) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeWithAnimation();
      return true;
    });

    return () => subscription.remove();
  }, [closeWithAnimation, visible]);

  const restoreExpandedPlayer = useCallback(
    (velocityY = 0) => {
      'worklet';
      progress.value = withSpring(1, {
        stiffness: 210,
        damping: 29,
        mass: 0.9,
        velocity: -velocityY / collapseDistance,
      });
    },
    [collapseDistance, progress],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(8)
        .failOffsetX([-12, 12])
        .onBegin(() => {
          gestureChanged.value = false;
          gestureStartProgress.value = progress.value;
        })
        .onUpdate((event) => {
          const pullDistance = Math.max(0, event.translationY);
          if (pullDistance > 0) {
            gestureChanged.value = true;
            progress.value = Math.max(
              0,
              Math.min(1, gestureStartProgress.value - pullDistance / collapseDistance),
            );
          }
        })
        .onEnd((event) => {
          const pullDistance = Math.max(0, event.translationY);
          if (pullDistance <= 0) return;

          if (pullDistance > 110 || event.velocityY > 950) {
            closeWithAnimation(event.velocityY);
          } else {
            restoreExpandedPlayer(event.velocityY);
          }
        })
        .onFinalize((_event, success) => {
          if (visible && !success && gestureChanged.value && progress.value < 1) {
            restoreExpandedPlayer();
          }
        }),
    [
      closeWithAnimation,
      collapseDistance,
      gestureChanged,
      gestureStartProgress,
      progress,
      restoreExpandedPlayer,
      visible,
    ],
  );

  const frameStyle = useAnimatedStyle(() => ({
    left: interpolate(progress.value, [0, 1], [16, 0]),
    right: interpolate(progress.value, [0, 1], [16, 0]),
    top: interpolate(progress.value, [0, 1], [miniTop, 0]),
    bottom: interpolate(progress.value, [0, 1], [miniBottom, 0]),
    borderTopLeftRadius: interpolate(progress.value, [0, 1], [32, 40]),
    borderTopRightRadius: interpolate(progress.value, [0, 1], [32, 40]),
    borderBottomLeftRadius: interpolate(progress.value, [0, 1], [32, 0]),
    borderBottomRightRadius: interpolate(progress.value, [0, 1], [32, 0]),
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 0.42]),
  }));
  const artworkBackgroundStyle = useAnimatedStyle(() => ({
    opacity: progress.value * trackTransition.value,
  }));
  const dimStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));
  const expandedContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.62, 1], [0, 0, 1]) * trackTransition.value,
  }));
  const artworkStyle = useAnimatedStyle(() => {
    const expandedLeft = interpolate(
      lyricsProgress.value,
      [0, 1],
      [(windowWidth - artworkSize) / 2, 30],
    );
    const expandedTop = interpolate(lyricsProgress.value, [0, 1], [artworkTop, lyricsArtworkTop]);
    const expandedSize = interpolate(lyricsProgress.value, [0, 1], [artworkSize, 72]);

    return {
      left: interpolate(progress.value, [0, 1], [12, expandedLeft]),
      top: interpolate(progress.value, [0, 1], [9, expandedTop]),
      width: interpolate(progress.value, [0, 1], [40, expandedSize]),
      height: interpolate(progress.value, [0, 1], [40, expandedSize]),
      borderRadius: interpolate(progress.value, [0, 1], [8, 18]),
      opacity: trackTransition.value,
    };
  });
  const titleStyle = useAnimatedStyle(() => {
    const expandedLeft = interpolate(lyricsProgress.value, [0, 1], [30, 122]);
    const expandedTop = interpolate(lyricsProgress.value, [0, 1], [titleTop, lyricsTitleTop]);
    const expandedRight = interpolate(lyricsProgress.value, [0, 1], [138, 138]);

    return {
      left: interpolate(progress.value, [0, 1], [60, expandedLeft]),
      top: interpolate(progress.value, [0, 1], [12, expandedTop]),
      right: interpolate(progress.value, [0, 1], [112, expandedRight]),
      opacity: trackTransition.value,
    };
  });
  const titleTextStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(
      progress.value,
      [0, 1],
      [14, interpolate(lyricsProgress.value, [0, 1], [23, 21])],
    ),
  }));
  const artistTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], ['#A1A1A6', '#D0CFCC']),
    fontSize: interpolate(
      progress.value,
      [0, 1],
      [12, interpolate(lyricsProgress.value, [0, 1], [18, 16])],
    ),
  }));
  const playStyle = useAnimatedStyle(() => {
    const fullCenter = interpolate(
      lyricsProgress.value,
      [0, 1],
      [controlsCenter, lyricsControlsCenter],
    );

    return {
      left: interpolate(progress.value, [0, 1], [windowWidth - 136, windowWidth / 2 - 26]),
      top: interpolate(progress.value, [0, 1], [3, fullCenter - 26]),
      width: interpolate(progress.value, [0, 1], [48, 52]),
      opacity: trackTransition.value,
    };
  });
  const nextStyle = useAnimatedStyle(() => {
    const fullCenter = interpolate(
      lyricsProgress.value,
      [0, 1],
      [controlsCenter, lyricsControlsCenter],
    );

    return {
      left: interpolate(progress.value, [0, 1], [windowWidth - 88, windowWidth - 88]),
      top: interpolate(progress.value, [0, 1], [7, fullCenter - 22]),
      opacity: trackTransition.value,
    };
  });
  const playIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [23 / 52, 1]) }],
  }));
  const nextIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.5, 1]) }],
  }));
  const actionsStyle = useAnimatedStyle(() => ({
    top:
      interpolate(lyricsProgress.value, [0, 1], [titleTop + 4, lyricsTitleTop + 4]),
    opacity: interpolate(progress.value, [0, 0.72, 1], [0, 0, 1]) * trackTransition.value,
  }));

  const expandedProgressStyle = useAnimatedStyle(() => ({
    top: interpolate(lyricsProgress.value, [0, 1], [titleTop + 88, lyricsProgressTop]),
  }));
  const expandedTransportStyle = useAnimatedStyle(() => {
    const center = interpolate(lyricsProgress.value, [0, 1], [controlsCenter, lyricsControlsCenter]);
    return { top: center - 26 };
  });
  const expandedVolumeStyle = useAnimatedStyle(() => {
    const center = interpolate(lyricsProgress.value, [0, 1], [controlsCenter, lyricsControlsCenter]);
    return { top: center + 54 };
  });
  const expandedActionsStyle = useAnimatedStyle(() => {
    const center = interpolate(lyricsProgress.value, [0, 1], [controlsCenter, lyricsControlsCenter]);
    return { top: center + 100 };
  });
  const lyricsPanelStyle = useAnimatedStyle(() => ({
    top: lyricsTextTop,
    height: interpolate(
      lyricsProgress.value,
      [0, 1],
      [0, Math.max(0, lyricsProgressTop - lyricsTextTop - 24)],
    ),
    opacity: lyricsProgress.value,
  }));

  const toggleLyrics = () => {
    if (!hasLyrics) return;
    const nextExpanded = !lyricsExpanded;
    setLyricsView({ trackId: displayTrack.id, expanded: nextExpanded });
  };

  return (
    <ReanimatedAnimated.View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 }}
    >
      <ReanimatedAnimated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#000000',
          },
          backdropStyle,
        ]}
      />
      <GestureDetector gesture={panGesture}>
        <ReanimatedAnimated.View
          pointerEvents="auto"
          style={[
            {
              position: 'absolute',
              overflow: 'hidden',
              backgroundColor: 'rgba(28, 28, 30, 0.96)',
              shadowColor: '#000000',
              shadowOpacity: 0.28,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 12,
            },
            frameStyle,
          ]}
        >
          <ReanimatedAnimated.Image
            source={{ uri: displayTrack.artwork }}
            resizeMode="cover"
            blurRadius={32}
            style={[
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              },
              artworkBackgroundStyle,
            ]}
          />
          <ReanimatedAnimated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(14, 12, 11, 0.46)',
              },
              dimStyle,
            ]}
          />

          <TouchableOpacity
            activeOpacity={1}
            onPress={visible ? undefined : onOpen}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Full music player' : 'Open music player'}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />

          <ReanimatedAnimated.View
            pointerEvents={visible ? 'auto' : 'none'}
            style={[
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              },
              expandedContentStyle,
            ]}
          >
            {lyricsExpanded && hasLyrics ? (
              <ReanimatedAnimated.View
                pointerEvents="none"
                style={[
                  { position: 'absolute', left: 30, right: 30, overflow: 'hidden' },
                  lyricsPanelStyle,
                ]}
              >
                  {lyrics.map((line, index) =>
                  line.trim().length === 0 ? (
                    <View key={displayTrack.id + '-lyric-gap-' + index} style={{ height: 40 }} />
                  ) : (
                    <Text
                      key={displayTrack.id + '-lyric-' + index}
                      style={{
                        color: '#FFFFFF',
                        fontSize: 22,
                        lineHeight: 32,
                        fontWeight: '700',
                        marginBottom: 12,
                      }}
                    >
                      {line}
                    </Text>
                  ),
                )}
              </ReanimatedAnimated.View>
            ) : null}

            <ReanimatedAnimated.View
              style={[
                { position: 'absolute', left: 30, right: 30 },
                expandedProgressStyle,
              ]}
            >
                <View
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    overflow: 'hidden',
                  }}
                >
                  <View style={{ width: '0%', height: '100%', backgroundColor: 'white' }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: '600' }}>
                    0:00
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: '600' }}>
                    -{displayTrack.duration}
                  </Text>
                </View>
            </ReanimatedAnimated.View>

            <ReanimatedAnimated.View
              style={[
                {
                  position: 'absolute',
                  left: 30,
                  right: 30,
                  height: 52,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 12,
                },
                expandedTransportStyle,
              ]}
            >
                <TouchableOpacity
                  onPress={onSkipPrevious}
                  accessibilityRole="button"
                  accessibilityLabel="Previous track"
                  hitSlop={12}
                >
                  <Ionicons name="play-skip-back" size={44} color="white" />
                </TouchableOpacity>
                <View style={{ width: 52, height: 52 }} />
                <View style={{ width: 44, height: 44 }} />
            </ReanimatedAnimated.View>

            <ReanimatedAnimated.View
              style={[
                {
                  position: 'absolute',
                  left: 30,
                  right: 30,
                  height: 24,
                  flexDirection: 'row',
                  alignItems: 'center',
                },
                expandedVolumeStyle,
              ]}
            >
                <Ionicons name="volume-low" size={20} color="rgba(255,255,255,0.6)" />
                <View
                  style={{
                    flex: 1,
                    height: 6,
                    marginHorizontal: 10,
                    borderRadius: 3,
                    backgroundColor: 'rgba(255,255,255,0.25)',
                  }}
                >
                  <View
                    style={{
                      width: '34%',
                      height: '100%',
                      backgroundColor: 'rgba(255,255,255,0.68)',
                    }}
                  />
                </View>
                <Ionicons name="volume-high" size={20} color="rgba(255,255,255,0.72)" />
            </ReanimatedAnimated.View>

            <ReanimatedAnimated.View
              style={[
                {
                  position: 'absolute',
                  left: 30,
                  right: 30,
                  height: 48,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                },
                expandedActionsStyle,
              ]}
            >
                <TouchableOpacity
                  onPress={toggleLyrics}
                  disabled={!hasLyrics}
                  accessibilityRole="button"
                  accessibilityLabel={lyricsExpanded ? 'Hide lyrics' : 'Show lyrics'}
                  accessibilityState={{ disabled: !hasLyrics, selected: lyricsExpanded }}
                  hitSlop={10}
                  style={{
                    padding: 8,
                    borderRadius: 28,
                    backgroundColor: lyricsExpanded ? 'rgba(255,255,255,0.78)' : 'transparent',
                    opacity: hasLyrics ? 1 : 0.34,
                  }}
                >
                  <Ionicons
                    name="chatbox-ellipses-outline"
                    size={25}
                    color={lyricsExpanded ? '#34291C' : 'rgba(255,255,255,0.68)'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="AirPlay output"
                  hitSlop={10}
                  style={{ padding: 8 }}
                >
                  <Ionicons name="radio-outline" size={26} color="rgba(255,255,255,0.68)" />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Queue and shuffle"
                  hitSlop={10}
                  style={{ padding: 8 }}
                >
                  <Ionicons name="list" size={28} color="rgba(255,255,255,0.68)" />
                  <View
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: 'rgba(255,255,255,0.13)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="shuffle" size={13} color="rgba(255,255,255,0.84)" />
                  </View>
                </TouchableOpacity>
            </ReanimatedAnimated.View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => closeWithAnimation()}
              accessibilityRole="button"
              accessibilityLabel="Drag down or tap to collapse player"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 114,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
              }}
            >
              <View
                style={{
                  width: 66,
                  height: 6,
                  borderRadius: 6,
                  backgroundColor: 'rgba(255, 255, 255, 0.36)',
                }}
              />
            </TouchableOpacity>
          </ReanimatedAnimated.View>

          <ReanimatedAnimated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                overflow: 'hidden',
                backgroundColor: '#343438',
              },
              artworkStyle,
            ]}
          >
            <ReanimatedAnimated.Image
              source={{ uri: displayTrack.artwork }}
              resizeMode="cover"
              accessibilityLabel={displayTrack.album + ' album artwork'}
              style={{ width: '100%', height: '100%' }}
            />
          </ReanimatedAnimated.View>

          <ReanimatedAnimated.View
            pointerEvents="none"
            style={[
              { position: 'absolute' },
              titleStyle,
            ]}
          >
            <ReanimatedAnimated.Text
              numberOfLines={1}
              style={[
                { color: 'white', fontWeight: '700' },
                titleTextStyle,
              ]}
            >
              {displayTrack.title}
            </ReanimatedAnimated.Text>
            <ReanimatedAnimated.Text
              numberOfLines={1}
              style={[
                { marginTop: 3 },
                artistTextStyle,
              ]}
            >
              {displayTrack.artist}
            </ReanimatedAnimated.Text>
          </ReanimatedAnimated.View>

          <ReanimatedAnimated.View
            pointerEvents={visible ? 'auto' : 'none'}
            style={[
              {
                position: 'absolute',
                left: 0,
                right: 0,
                height: 44,
                opacity: 0,
              },
              actionsStyle,
            ]}
          >
            <View style={{ position: 'absolute', right: 30, flexDirection: 'row' }}>
              <TouchableOpacity
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Add to favorites"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: 'rgba(255, 255, 255, 0.13)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8,
                }}
              >
                <Ionicons name="star-outline" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="More player options"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: 'rgba(255, 255, 255, 0.13)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="ellipsis-horizontal" size={22} color="white" />
              </TouchableOpacity>
            </View>
          </ReanimatedAnimated.View>

          <ReanimatedAnimated.View
            pointerEvents="box-none"
            style={[
              {
                position: 'absolute',
                width: 52,
                height: 52,
                alignItems: 'center',
                justifyContent: 'center',
              },
              playStyle,
            ]}
          >
            <TouchableOpacity
              onPress={onTogglePlayback}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
              style={{ width: '100%', height: 52, alignItems: 'center', justifyContent: 'center' }}
            >
              <ReanimatedAnimated.View style={playIconStyle}>
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={52} color="white" />
              </ReanimatedAnimated.View>
            </TouchableOpacity>
          </ReanimatedAnimated.View>

          <ReanimatedAnimated.View
            pointerEvents="box-none"
            style={[
              {
                position: 'absolute',
                width: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
              },
              nextStyle,
            ]}
          >
            <TouchableOpacity
              onPress={onSkipNext}
              accessibilityRole="button"
              accessibilityLabel="Next track"
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <ReanimatedAnimated.View style={nextIconStyle}>
                <Ionicons name="play-skip-forward" size={44} color="white" />
              </ReanimatedAnimated.View>
            </TouchableOpacity>
          </ReanimatedAnimated.View>
        </ReanimatedAnimated.View>
      </GestureDetector>
    </ReanimatedAnimated.View>
  );
};
