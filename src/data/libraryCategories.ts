import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

export type LibraryCategory = {
  id: string;
  title: string;
  icon: ComponentProps<typeof Ionicons>['name'];
};

export const libraryCategories: LibraryCategory[] = [
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
