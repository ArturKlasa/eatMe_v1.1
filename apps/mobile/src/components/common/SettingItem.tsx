import React from 'react';
import { View, Text, Switch } from 'react-native';
import { commonStyles, switchConfig } from '@/styles';

interface SettingItemProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  customStyles?: {
    container?: any;
    label?: any;
    description?: any;
  };
}

/**
 * Reusable Setting Item Component
 *
 * Provides consistent toggle/switch setting row
 * with label, description, and switch control
 */
export const SettingItem: React.FC<SettingItemProps> = ({
  label,
  description,
  value,
  onValueChange,
  customStyles = {},
}) => {
  return (
    <View style={[commonStyles.forms.settingItem, customStyles.container]}>
      <View style={commonStyles.forms.settingText}>
        <Text style={[commonStyles.forms.settingLabel, customStyles.label]}>{label}</Text>
        {description && (
          <Text style={[commonStyles.forms.settingDescription, customStyles.description]}>
            {description}
          </Text>
        )}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={switchConfig.trackColors} />
    </View>
  );
};
