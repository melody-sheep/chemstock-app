// src/components/common/Header.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import PropTypes from 'prop-types';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const { width: screenWidth } = Dimensions.get('window');

// Thicker/bolder arrow left icon
const ArrowLeftBold = ({ size = 24, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} fill={color} viewBox="0 0 256 256">
    <Path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z" />
  </Svg>
);

export default function Header({
  showBackButton = false,
  backButtonText = 'Back',
  showOnlineStatus = false,
  title = null,
  height = 56,
  backgroundColor = '#03045E',
  textColor = '#FFFFFF',
  onBackPress = null,
}) {
  const navigation = useNavigation();

  const handleBackPress = () => {
    try {
      if (onBackPress) {
        onBackPress();
      } else {
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error in header back button:', error);
    }
  };

  return (
    <View
      style={[
        styles.header,
        {
          height: height,
          backgroundColor: backgroundColor,
          paddingHorizontal: SPACING.lg,
        },
      ]}
    >
      {/* Left Section */}
      <View style={styles.leftSection}>
        {showBackButton && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackPress}
            activeOpacity={0.7}
          >
            <ArrowLeftBold size={20} color={textColor} />
            <Text style={[styles.backText, { color: textColor }]}>
              {backButtonText}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Center Section */}
      <View style={styles.centerSection}>
        {title && title !== '' && (
          <Text style={[styles.title, { color: textColor }]}>
            {title}
          </Text>
        )}
      </View>

      {/* Right Section */}
      <View style={styles.rightSection}>
        {showOnlineStatus && (
          <View style={styles.onlineContainer}>
            <View style={styles.onlineDot} />
            <Text style={[styles.onlineText, { color: textColor }]}>
              Online
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

Header.propTypes = {
  showBackButton: PropTypes.bool,
  backButtonText: PropTypes.string,
  showOnlineStatus: PropTypes.bool,
  title: PropTypes.string,
  height: PropTypes.number,
  backgroundColor: PropTypes.string,
  textColor: PropTypes.string,
  onBackPress: PropTypes.func,
};

Header.defaultProps = {
  showBackButton: false,
  backButtonText: 'Back',
  showOnlineStatus: false,
  title: null,
  height: 56,
  backgroundColor: '#03045E',
  textColor: '#FFFFFF',
  onBackPress: null,
};

const styles = StyleSheet.create({
  header: {
    width: screenWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 0,
  },
  leftSection: {
    flexShrink: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    height: '100%',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  rightSection: {
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: '100%',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xs,
    paddingRight: SPACING.sm,
  },
  backText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginLeft: SPACING.xs,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    textAlign: 'center',
  },
  onlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xs,
    paddingLeft: SPACING.sm,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: SPACING.xs,
  },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
  },
});