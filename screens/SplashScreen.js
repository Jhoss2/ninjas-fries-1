const React = require('react');
const { View, StyleSheet } = require('react-native');
const { Video, ResizeMode } = require('expo-av');

const SplashScreen = ({ onFinish }) => {
  return (
    <View style={styles.splashContainer}>
      <Video
        source={require('../assets/lv_0_20260201104716.mp4')}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay={true}
        isLooping={false}
        onPlaybackStatusUpdate={(status) => {
          if (status.didJustFinish) onFinish();
        }}
        onError={() => onFinish()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
});

module.exports = SplashScreen;
