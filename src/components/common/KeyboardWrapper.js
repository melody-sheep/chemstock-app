// src/components/common/KeyboardWrapper.js
import React from 'react';
import {
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet,
  View,
} from 'react-native';

export default function KeyboardWrapper({ children }) {
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        {children}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});