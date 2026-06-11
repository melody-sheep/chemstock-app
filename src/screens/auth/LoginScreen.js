// src/screens/auth/LoginScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  Animated,
  Easing,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  MapPin, 
  Truck, 
  Package, 
  Warehouse, 
  ClipboardText,
  Cube,
  Flask,
  Drop,
  Building
} from 'phosphor-react-native';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../styles/typography';
import CustomModal from '../../components/common/Modal';
import Button from '../../components/common/Button';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Define all floating particles with their properties
const PARTICLES = [
  { Icon: Flask, color: COLORS.primary, size: 28, initialX: '5%', initialY: '8%', speed: 4000, delay: 0 },
  { Icon: MapPin, color: COLORS.secondary, size: 24, initialX: '85%', initialY: '12%', speed: 3500, delay: 500 },
  { Icon: Truck, color: COLORS.primary, size: 30, initialX: '15%', initialY: '25%', speed: 4500, delay: 1000 },
  { Icon: Package, color: COLORS.secondary, size: 26, initialX: '75%', initialY: '30%', speed: 3800, delay: 1500 },
  { Icon: Warehouse, color: COLORS.primary, size: 32, initialX: '10%', initialY: '45%', speed: 4200, delay: 2000 },
  { Icon: ClipboardText, color: COLORS.secondary, size: 22, initialX: '80%', initialY: '50%', speed: 3600, delay: 2500 },
  { Icon: Cube, color: COLORS.primary, size: 28, initialX: '20%', initialY: '65%', speed: 3900, delay: 3000 },
  { Icon: Drop, color: COLORS.secondary, size: 24, initialX: '70%', initialY: '70%', speed: 4300, delay: 3500 },
  { Icon: Building, color: COLORS.primary, size: 26, initialX: '45%', initialY: '15%', speed: 3700, delay: 400 },
  { Icon: Flask, color: COLORS.secondary, size: 22, initialX: '55%', initialY: '85%', speed: 4100, delay: 800 },
  { Icon: MapPin, color: COLORS.primary, size: 28, initialX: '90%', initialY: '40%', speed: 4400, delay: 1200 },
  { Icon: Truck, color: COLORS.secondary, size: 24, initialX: '8%', initialY: '75%', speed: 3900, delay: 1800 },
];

export default function LoginScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [particleStates, setParticleStates] = useState(
    PARTICLES.map(() => ({
      exploded: false,
      scaleAnim: new Animated.Value(1),
      opacityAnim: new Animated.Value(0.08),
    }))
  );

  // Animation values for floating movement
  const floatAnims = useRef(PARTICLES.map(() => new Animated.Value(0))).current;
  const rotateAnims = useRef(PARTICLES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Start floating animations for each particle
    PARTICLES.forEach((particle, index) => {
      const createFloatingAnimation = () => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(floatAnims[index], {
              toValue: 1,
              duration: particle.speed,
              delay: particle.delay,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(floatAnims[index], {
              toValue: 0,
              duration: particle.speed,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        );
      };

      const createRotationAnimation = () => {
        return Animated.loop(
          Animated.timing(rotateAnims[index], {
            toValue: 1,
            duration: 8000 + (index * 500),
            easing: Easing.linear,
            useNativeDriver: true,
          })
        );
      };

      createFloatingAnimation().start();
      createRotationAnimation().start();
    });
  }, []);

  const handleParticleTap = (index) => {
    if (particleStates[index].exploded) return;

    // Animate explosion: scale up and increase opacity
    Animated.parallel([
      Animated.timing(particleStates[index].scaleAnim, {
        toValue: 2.5,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(particleStates[index].opacityAnim, {
        toValue: 0.6,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Reset after explosion
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(particleStates[index].scaleAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(particleStates[index].opacityAnim, {
            toValue: 0.08,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      }, 500);
    });
  };

  const handleGetStarted = () => {
    setModalVisible(true);
  };

  const handleLogin = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setModalVisible(false);
    }, 2000);
  };

  // Interpolate for floating movement
  const getTranslateY = (index) => {
    return floatAnims[index].interpolate({
      inputRange: [0, 1],
      outputRange: [0, -25 - (index % 3) * 5],
    });
  };

  // Interpolate for rotation
  const getSpin = (index) => {
    return rotateAnims[index].interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', `${index % 2 === 0 ? '360deg' : '-360deg'}`],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Background Floating Particles - Scattered across screen */}
        <View style={styles.backgroundParticles}>
          {PARTICLES.map((particle, index) => {
            const ParticleIcon = particle.Icon;
            
            return (
              <TouchableOpacity
                key={index}
                activeOpacity={0.7}
                onPress={() => handleParticleTap(index)}
                style={[
                  styles.particleWrapper,
                  {
                    top: particle.initialY,
                    left: particle.initialX,
                  },
                ]}
              >
                <Animated.View
                  style={{
                    transform: [
                      { translateY: getTranslateY(index) },
                      { rotate: getSpin(index) },
                      { scale: particleStates[index].scaleAnim },
                    ],
                  }}
                >
                  <Animated.View style={{ opacity: particleStates[index].opacityAnim }}>
                    <ParticleIcon
                      size={particle.size}
                      color={particle.color}
                      weight="light"
                    />
                  </Animated.View>
                </Animated.View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Bottom Left Corner Image */}
        <View style={styles.bottomLeftImageContainer}>
          <Image
            source={require('../../../assets/image/empty_box1.png')}
            style={styles.bottomLeftImage}
            resizeMode="contain"
          />
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../../assets/image/chemstock_png.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Header Text */}
          <View style={styles.header}>
            <Text style={styles.title}>ChemStock</Text>
            <Text style={styles.subtitle}>Securing the Chain of Custody</Text>
          </View>

          {/* Get Started Button */}
          <View style={styles.buttonContainer}>
            <Button
              title="Get Started"
              onPress={handleGetStarted}
              width={screenWidth - 48}
              height={56}
              backgroundColor={COLORS.primary}
              textColor={COLORS.textWhite}
              fontSize={18}
              borderRadius={8}
            />
          </View>
        </View>
      </View>

      {/* Bottom Sheet Modal - Clean version without handle */}
      <CustomModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        height={467}
        backgroundColor="#FFFFFF"
        backdropOpacity={0.2}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Welcome Back</Text>
          <Text style={styles.modalSubtitle}>
            Please enter your credentials to continue
          </Text>
          
          <View style={styles.modalButtonContainer}>
            <Button
              title="Login"
              onPress={handleLogin}
              loading={loading}
              width={screenWidth - 48}
              height={56}
              backgroundColor={COLORS.primary}
              textColor={COLORS.textWhite}
              fontSize={18}
              borderRadius={8}
            />
          </View>
        </View>
      </CustomModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backgroundParticles: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  particleWrapper: {
    position: 'absolute',
  },
  bottomLeftImageContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    zIndex: 1,
  },
  bottomLeftImage: {
    width: 120,
    height: 120,
    opacity: 0.9,
  },
  mainContent: {
    flex: 1,
    paddingTop: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 16,
  },
  logo: {
    width: 120,
    height: 120,
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    fontSize: TYPOGRAPHY.fontSize['4xl'],
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
  },
  buttonContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 0,
    marginBottom: 40,
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
    marginBottom: 48,
    textAlign: 'center',
  },
  modalButtonContainer: {
    alignItems: 'center',
    width: '100%',
  },
});