// src/components/common/BrandedQRCode.js
import React from 'react';
import PropTypes from 'prop-types';
import QRCode from 'react-native-qrcode-svg';

const LOGO = require('../../../assets/ChemStockLogo.png');

/**
 * Every QR code the app draws: the code with the ChemStock logo in the
 * centre. Use this instead of importing react-native-qrcode-svg directly, so
 * all generated codes carry the same mark.
 *
 * The logo covers the middle of the code, so error correction is set to the
 * highest level ("H", up to 30% of the code recoverable). The logo takes
 * about 5% of the area, which leaves a wide margin for scanning.
 *
 * `value` is unchanged by the logo — the encoded text is exactly what a
 * plain QRCode would hold, so existing printed codes and scanners still work.
 */
export default function BrandedQRCode({ value, size = 200, getRef = undefined }) {
  return (
    <QRCode
      value={value}
      size={size}
      ecl="H"
      logo={LOGO}
      logoSize={Math.round(size * 0.22)}
      logoBackgroundColor="#FFFFFF"
      logoMargin={3}
      logoBorderRadius={6}
      getRef={getRef}
    />
  );
}

BrandedQRCode.propTypes = {
  value: PropTypes.string.isRequired,
  size: PropTypes.number,
  getRef: PropTypes.func,
};
