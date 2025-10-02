import React from 'react';
import { ScreenLayout } from '@/components/common';
import { useFilterStore } from '../stores/filterStore';
import { DrawerFilters } from '../components/DrawerFilters';
import type { FiltersScreenProps } from '@/types/navigation';

/**
 * FiltersScreen Component - Permanent Filters
 */
export const FiltersScreen: React.FC<FiltersScreenProps> = ({ navigation }) => {
  const { getPermanentFilterCount } = useFilterStore();

  const handleBackPress = () => {
    navigation.navigate('Map');
  };

  return (
    <ScreenLayout
      title="Permanent Filters"
      subtitle={`${getPermanentFilterCount()} permanent filters active`}
      onBackPress={handleBackPress}
      backButtonText="←"
      scrollable={false}
    >
      <DrawerFilters onClose={() => navigation.navigate('Map')} />
    </ScreenLayout>
  );
};

export default FiltersScreen;
