// src/components/common/Header.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import PropTypes from 'prop-types';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import Icon from './Icon';
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
  showProfileIcon = false,
  onProfilePress = null,
  showDocumentIcon = false,
  onDocumentPress = null,
  showNotificationIcon = false,
  onNotificationPress = null,
  title = null,
  height = 56,
  backgroundColor = '#03045E',
  textColor = '#FFFFFF',
  paddingHorizontal = SPACING.lg,
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
          paddingHorizontal: paddingHorizontal,
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
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ArrowLeftBold size={20} color={textColor} />
            <Text style={[styles.backText, { color: textColor }]}>
              {backButtonText}
            </Text>
          </TouchableOpacity>
        )}

        {showProfileIcon && (
          <View style={styles.profileRow}>
            <TouchableOpacity
              onPress={onProfilePress}
              activeOpacity={0.7}
              accessibilityLabel="Profile"
              accessibilityRole="button"
            >
              <Icon name="profile" size={28} color={textColor} weight="fill" />
            </TouchableOpacity>
            {title && title !== '' && (
              <Text style={[styles.leftTitle, { color: textColor }]}>
                {title}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Center Section */}
      <View style={styles.centerSection}>
        {!showProfileIcon && title && title !== '' && (
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

        {(showDocumentIcon || showNotificationIcon) && (
          <View style={styles.rightIconsRow}>
            {showDocumentIcon && (
              <TouchableOpacity
                onPress={onDocumentPress}
                activeOpacity={0.7}
                accessibilityLabel="Documents"
                accessibilityRole="button"
              >
                <Icon name="document" size={22} color={textColor} weight="fill" />
              </TouchableOpacity>
            )}
            {showNotificationIcon && (
              <TouchableOpacity
                onPress={onNotificationPress}
                activeOpacity={0.7}
                accessibilityLabel="Notifications"
                accessibilityRole="button"
              >
                <Icon name="notification" size={22} color={textColor} weight="fill" />
              </TouchableOpacity>
            )}
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
  showProfileIcon: PropTypes.bool,
  onProfilePress: PropTypes.func,
  showDocumentIcon: PropTypes.bool,
  onDocumentPress: PropTypes.func,
  showNotificationIcon: PropTypes.bool,
  onNotificationPress: PropTypes.func,
  title: PropTypes.string,
  height: PropTypes.number,
  backgroundColor: PropTypes.string,
  textColor: PropTypes.string,
  paddingHorizontal: PropTypes.number,
  onBackPress: PropTypes.func,
};

const styles = StyleSheet.create({
  header: {
    width: screenWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 0,
    // Always paints above sibling content (e.g. a collapsing secondary
    // header/scroll area animating underneath it) regardless of mount order.
    zIndex: 20,
    elevation: 20,
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
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginLeft: SPACING.sm,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    textAlign: 'center',
  },
  rightIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
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