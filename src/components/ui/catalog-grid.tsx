import { FlatList, type FlatListProps } from 'react-native';

export type CatalogGridProps<ItemT extends { id: string }> = Omit<FlatListProps<ItemT>, 'numColumns' | 'keyExtractor'> & {
  columns?: number;
};

export function CatalogGrid<ItemT extends { id: string }>({ columns = 2, ...props }: CatalogGridProps<ItemT>) {
  return <FlatList {...props} keyExtractor={(item) => item.id} numColumns={columns} />;
}
