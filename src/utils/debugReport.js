// src/utils/debugReport.js
import { Share } from 'react-native';
import { getLogText } from './logger';

export const shareDebugLog = () =>
  Share.share({ title: 'ChemStock debug log', message: getLogText() });
