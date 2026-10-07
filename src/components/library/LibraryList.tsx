import { View } from 'react-native';
import { libraryCategories } from '../../data/libraryCategories';
import { LibraryListItem } from './LibraryListItem';

export const LibraryList = () => (
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
