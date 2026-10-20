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
    // accessible={false}: otherwise Android treats this whole layer as one
    // tappable control and drags that start on empty background don't scroll.
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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