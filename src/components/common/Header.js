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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Icon from './Icon';
import UserAvatar from './UserAvatar';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import { formatClockTime } from '../../utils/formatters';
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
  backButtonText = null,
  showOnlineStatus = false,
  showProfileIcon = false,
  onProfilePress = null,
  profilePhotoUrl = null,
  showDocumentIcon = false,
  onDocumentPress = null,
  showNotificationIcon = false,
  onNotificationPress = null,
  notificationCount = 0,
  title = null,
  titleAlign = 'center',
  height = 56,
  backgroundColor = '#03045E',
  textColor = '#FFFFFF',
  paddingHorizontal = SPACING.lg,
  onBackPress = null,
}) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const connection = useConnectionStatus();

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
    // Outer View reserves the status-bar (wifi/battery/notifications) area
    // above the bar's own visible content, painted in the same
    // backgroundColor so there's no white flash above a colored header.
    // The inner row keeps the exact `height` callers already pass, so
    // nothing inside gets squeezed by the added top inset.
    <View
      style={[
        styles.header,
        {
          height: height + insets.top,
          paddingTop: insets.top,
          backgroundColor: backgroundColor,
        },
      ]}
    >
      <View style={[styles.headerRow, { height, paddingHorizontal }]}>
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
            {backButtonText && (
              <Text style={[styles.backText, { color: textColor }]}>
                {backButtonText}
              </Text>
            )}
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
              <UserAvatar
                photoUrl={profilePhotoUrl}
                size={28}
                iconName="profile"
                iconColor={textColor}
                iconWeight="fill"
                backgroundColor="transparent"
                glyphRatio={0.8}
              />
            </TouchableOpacity>
            {title && title !== '' && (
              <Text style={[styles.leftTitle, { color: textColor }]}>
                {title}
              </Text>
            )}
          </View>
        )}

        {!showProfileIcon && !showBackButton && titleAlign === 'left' && title && title !== '' && (
          <Text style={[styles.leftTitle, { color: textColor }]}>
            {title}
          </Text>
        )}
      </View>

      {/* Center Section */}
      <View style={styles.centerSection}>
        {!showProfileIcon && titleAlign === 'center' && title && title !== '' && (
          <Text style={[styles.title, { color: textColor }]}>
            {title}
          </Text>
        )}
      </View>

      {/* Right Section */}
      <View style={styles.rightSection}>
        {showOnlineStatus && (
          <View style={styles.onlineContainer}>
            <View style={[styles.onlineDot, !connection.online && styles.onlineDotOffline]} />
            <Text style={[styles.onlineText, { color: textColor }, !connection.online && styles.onlineTextOffline]}>
              {connection.online ? 'Online' : `Offline · ${formatClockTime(connection.lastOnlineAt)}`}
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
                style={styles.notificationButton}
                onPress={onNotificationPress}
                activeOpacity={0.7}
                accessibilityLabel={notificationCount > 0 ? `Notifications, ${notificationCount} unread` : 'Notifications'}
                accessibilityRole="button"
              >
                <Icon name="notification" size={22} color={textColor} weight="fill" />
                {notificationCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
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
  profilePhotoUrl: PropTypes.string,
  showDocumentIcon: PropTypes.bool,
  onDocumentPress: PropTypes.func,
  showNotificationIcon: PropTypes.bool,
  onNotificationPress: PropTypes.func,
  notificationCount: PropTypes.number,
  title: PropTypes.string,
  titleAlign: PropTypes.oneOf(['left', 'center']),
  height: PropTypes.number,
  backgroundColor: PropTypes.string,
  textColor: PropTypes.string,
  paddingHorizontal: PropTypes.number,
  onBackPress: PropTypes.func,
};

const styles = StyleSheet.create({
  header: {
    width: screenWidth,
    // Always paints above sibling content (e.g. a collapsing secondary
    // header/scroll area animating underneath it) regardless of mount order.
    zIndex: 20,
    elevation: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  onlineDotOffline: { backgroundColor: COLORS.warning },
  onlineTextOffline: { color: COLORS.warning },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
  },
  notificationButton: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  notificationBadgeText: {
    fontSize: 9,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#FFFFFF',
  },
});