import React from 'react';
import AnimatedTextDot from '../../components/common/AnimatedTextDot';

const ANIMATION_DATA = [
  { text: 'ChemStock', bgColor: '#F72E75' },
  { text: 'QR-Enabled', bgColor: '#FF7800' },
  { text: 'Chain of Custody', bgColor: '#07B2F5' },
  { text: 'Smart Inventory', bgColor: '#F2C94C' },
  { text: 'Cospachem', bgColor: '#4CF294' },
];

export default function LoginScreen() {
  return (
    <AnimatedTextDot
      data={ANIMATION_DATA}
      loop={true}
      yOffset={-300}
      textSize={32}
      dotSize={32}
    />
  );
}