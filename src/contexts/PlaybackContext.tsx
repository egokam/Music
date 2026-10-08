import { createContext, useContext } from 'react';
import type { Track } from '../types';

type PlaybackActions = {
  playTrack: (track: Track) => void;
  playAllSongs: () => void;
  shuffleSongs: () => void;
};

export const PlaybackContext = createContext<PlaybackActions | null>(null);

export const usePlaybackActions = () => {
  const actions = useContext(PlaybackContext);
  if (!actions) throw new Error('Playback actions are unavailable outside PlaybackContext.');
  return actions;
};
