// src/components/common/LiveStatusPill.js
import React from 'react';
import { View, Text } from 'react-native';
import PropTypes from 'prop-types';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import { formatAsOf } from '../../utils/formatters';
import useSavedDataTime from '../../utils/savedDataTime';
import { COLORS } from '../../constants/colors';

/**
 * The small "Online" pill in a screen's header, following the real
 * connection state instead of always reading "Online".
 *
 * It draws with the styles the screen already had for its hardcoded pill
 * (pillStyle / dotStyle / textStyle), so the online look is unchanged. When
 * the app cannot reach the server it reads "Offline · as of 2:10 PM" (when the
 * screen's data was last loaded, else the last time it reached the server) in the warning colour — the same wording and colour the
 * dashboards and Stock screens use. Pass the offline* styles to override
 * that for a pill with its own background.
 */
export default function LiveStatusPill({
  pillStyle,
  dotStyle,
  textStyle,
  offlinePillStyle = null,
  offlineDotStyle = null,
  offlineTextStyle = null,
}) {
  const connection = useConnectionStatus();
  const offline = !connection.online;
  const savedAt = useSavedDataTime();

  return (
    <View style={[pillStyle, offline && offlinePillStyle]}>
      <View style={[dotStyle, offline && (offlineDotStyle || { backgroundColor: COLORS.warning })]} />
      <Text style={[textStyle, offline && (offlineTextStyle || { color: COLORS.warning })]} numberOfLines={1}>
        {offline ? `Offline · as of ${formatAsOf(savedAt ?? connection.lastOnlineAt)}` : 'Online'}
      </Text>
    </View>
  );
}

const stylePropType = PropTypes.oneOfType([PropTypes.object, PropTypes.array, PropTypes.number]);

LiveStatusPill.propTypes = {
  pillStyle: stylePropType,
  dotStyle: stylePropType,
  textStyle: stylePropType,
  offlinePillStyle: stylePropType,
  offlineDotStyle: stylePropType,
  offlineTextStyle: stylePropType,
};
