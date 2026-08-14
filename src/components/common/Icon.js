// src/components/common/Icon.js
import React from 'react';
import Svg, { Path } from 'react-native-svg';
import {
  UserCircle,
  FileText,
  Bell,
  MapPin,
  Package,
  User as UserFill,
  TrayArrowDown,
  TrayArrowUp,
  CheckCircle,
  ArrowsClockwise,
  Warning,
  NavigationArrow,
  Users,
  House,
  Bookmark,
  GearSix,
  SquaresFour,
} from 'phosphor-react-native';
import PropTypes from 'prop-types';

export const ICONS = {
  warningTriangle: {
    svg: 'M235.07,189.09,147.61,37.22h0a22.75,22.75,0,0,0-39.22,0L20.93,189.09a21.53,21.53,0,0,0,0,21.72A22.35,22.35,0,0,0,40.55,222h174.9a22.35,22.35,0,0,0,19.6-11.19A21.53,21.53,0,0,0,235.07,189.09ZM224.66,204.8a10.46,10.46,0,0,1-9.21,5.2H40.55a10.46,10.46,0,0,1-9.21-5.2,9.51,9.51,0,0,1,0-9.72L118.79,43.21a10.75,10.75,0,0,1,18.42,0l87.46,151.87A9.51,9.51,0,0,1,224.66,204.8ZM122,144V104a6,6,0,0,1,12,0v40a6,6,0,0,1-12,0Zm16,36a10,10,0,1,1-10-10A10,10,0,0,1,138,180Z',
  },
  user: {
    svg: 'M224,57.37A103.47,103.47,0,0,0,128.58,24c-56.78,0-103.44,45.67-104,102.36C24.06,182,67,225.67,120.73,231.9a8,8,0,0,0,9-7.91,7.93,7.93,0,0,0-6.89-7.87c-45.61-5.71-78.88-43.73-78.84-89.94C44.08,80.45,82,42,128.48,42a86.67,86.67,0,0,1,79.82,53.47,8,8,0,0,0,14.86-6A102.69,102.69,0,0,0,224,57.37ZM144,152h-32a8,8,0,0,0,0,16h32a8,8,0,0,0,0-16Zm.57-72H112a8,8,0,0,0,0,16h31.43c14.27,0,25.78,9.63,26.79,22.39A24.16,24.16,0,0,1,146.86,144H112a8,8,0,0,0,0,16h34.86a40.5,40.5,0,0,0,39.57-33.48C189.9,110.28,170.71,80,144.57,80Z',
  },
  key: {
    svg: 'M216.57,39.43A80,80,0,0,0,83.91,120.78L28.69,176A15.86,15.86,0,0,0,24,187.31V216a16,16,0,0,0,16,16H72a8,8,0,0,0,8-8V208H96a8,8,0,0,0,8-8V184h16a8,8,0,0,0,5.66-2.34l9.56-9.57A79.73,79.73,0,0,0,160,176h.1A80,80,0,0,0,216.57,39.43ZM224,98.1c-1.09,34.09-29.75,61.86-63.89,61.9H160a63.7,63.7,0,0,1-23.65-4.51,8,8,0,0,0-8.84,1.68L116.69,168H96a8,8,0,0,0-8,8v16H72a8,8,0,0,0-8,8v16H40V187.31l58.83-58.82a8,8,0,0,0,1.68-8.84A63.72,63.72,0,0,1,96,95.92c0-34.14,27.81-62.8,61.9-63.89A64,64,0,0,1,224,98.1ZM192,76a12,12,0,1,1-12-12A12,12,0,0,1,192,76Z',
  },
  checkmark: {
    svg: 'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm45.66,85.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z',
  },
  checkmarkCircle: {
    svg: 'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm45.66,85.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z',
  },
  send: {
    svg: 'M231.87,114l-168-95.89A16,16,0,0,0,40.92,37.34L71.55,128,40.92,218.67A16,16,0,0,0,56,240a16.15,16.15,0,0,0,7.93-2.1l167.92-96.05a16,16,0,0,0,.05-27.89ZM56,224a.56.56,0,0,0,0-.12L85.74,136H144a8,8,0,0,0,0-16H85.74L56.06,32.16A.46.46,0,0,0,56,32l168,95.83Z',
  },
  arrowLeft: {
    svg: 'M222,128a6,6,0,0,1-6,6H54.49l61.75,61.76a6,6,0,1,1-8.48,8.48l-72-72a6,6,0,0,1,0-8.48l72-72a6,6,0,0,1,8.48,8.48L54.49,122H216A6,6,0,0,1,222,128Z',
  },
  arrowRight: {
    svg: 'M34,128a8,8,0,0,1,8-8H201.51L139.76,60.24a8,8,0,0,1,11.31-11.31l72,72a8,8,0,0,1,0,11.31l-72,72a8,8,0,0,1-11.31-11.31L201.51,136H42A8,8,0,0,1,34,128Z',
  },
  building: {
    svg: 'M216.49,111.51l-80-80a12,12,0,0,0-17,0l-80,80A12,12,0,0,0,36,120v96a4,4,0,0,0,4,4H216a4,4,0,0,0,4-4V120A12,12,0,0,0,216.49,111.51ZM212,212H44V120a4,4,0,0,1,1.17-2.83l80-80a4,4,0,0,1,5.66,0l80,80A4,4,0,0,1,212,120Z',
  },
  peopleGroup: {
    viewBox: '0 0 24 24',
    svg: 'M9.877 10.508Q9 9.63 9 8.385t.877-2.123T12 5.385t2.123.877T15 8.385t-.877 2.123t-2.123.877t-2.123-.877M5 18.616v-1.647q0-.619.36-1.158q.361-.54.97-.838q1.416-.679 2.834-1.018q1.417-.34 2.836-.34t2.837.34t2.832 1.018q.61.298.97.838q.361.539.361 1.158v1.646zm1-1h12v-.647q0-.332-.215-.625q-.214-.292-.593-.494q-1.234-.598-2.546-.916T12 14.616t-2.646.318t-2.546.916q-.38.202-.593.494Q6 16.637 6 16.97zm7.413-7.819Q14 9.21 14 8.385t-.587-1.413T12 6.385t-1.412.587T10 8.385t.588 1.412t1.412.588t1.413-.588M12 17.616',
  },
};

// Icons with multiple fixed colors baked in (flat illustration style) —
// unlike ICONS above, each path has its own hardcoded fill and ignores the
// `color`/`weight`/`duotoneColor` props entirely.
const MULTICOLOR_ICONS = {
  boxPackage: {
    viewBox: '0 0 80 80',
    paths: [
      { d: 'M12 34h56v32H12z', fill: '#f2c94c' },
      { d: 'M12 34h56l-8-20H20z', fill: '#f2994a' },
      { d: 'm46 34l-2-20h-8l-2 20z', fill: '#219653' },
      { d: 'M46 34v10a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V34z', fill: '#6fcf97' },
    ],
  },
};

// Hand-traced duotone icons — two layered paths (a background "fill" shape
// and a foreground "stroke" shape), each rendered with its own color prop
// (`duotoneColor` for the fill layer, `color` for the stroke layer), full
// opacity. Callers pass whatever color pair they need per usage.
const DUOTONE_ICONS = {
  packageHex: {
    fillPath: 'M224,80l-96,56L32,80l96-56Z',
    strokePath: 'M240,200a8,8,0,0,1-8,8H216v16a8,8,0,0,1-16,0V208H184a8,8,0,0,1,0-16h16V176a8,8,0,0,1,16,0v16h16A8,8,0,0,1,240,200Zm-20-78.91-92,53.65L36,121.09A8,8,0,0,0,28,134.91l96,56a8,8,0,0,0,8.06,0l96-56A8,8,0,1,0,220,121.09ZM24,80a8,8,0,0,1,4-6.91l96-56a8,8,0,0,1,8.06,0l96,56a8,8,0,0,1,0,13.82l-96,56a8,8,0,0,1-8.06,0l-96-56A8,8,0,0,1,24,80Zm23.88,0L128,126.74,208.12,80,128,33.26ZM140,215.76l-12,7L36,169.09A8,8,0,0,0,28,182.91l96,56a8,8,0,0,0,8.06,0l16-9.33A8,8,0,1,0,140,215.76Z',
  },
  successCircle: {
    fillPath: 'M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z',
    strokePath: 'M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z',
  },
  returnBox: {
    fillPath: 'M224,56V200a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V56a8,8,0,0,1,8-8H216A8,8,0,0,1,224,56Z',
    strokePath: 'M184,104v32a8,8,0,0,1-8,8H99.31l10.35,10.34a8,8,0,0,1-11.32,11.32l-24-24a8,8,0,0,1,0-11.32l24-24a8,8,0,0,1,11.32,11.32L99.31,128H168V104a8,8,0,0,1,16,0Zm48-48V200a16,16,0,0,1-16,16H40a16,16,0,0,1-16-16V56A16,16,0,0,1,40,40H216A16,16,0,0,1,232,56ZM216,200V56H40V200H216Z',
  },
  alertTriangle: {
    fillPath: 'M215.46,216H40.54C27.92,216,20,202.79,26.13,192.09L113.59,40.22c6.3-11,22.52-11,28.82,0l87.46,151.87C236,202.79,228.08,216,215.46,216Z',
    strokePath: 'M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z',
  },
  compassTarget: {
    fillPath: 'M128,32a96,96,0,1,0,96,96A96,96,0,0,0,128,32Zm16,112L80,176l32-64,64-32Z',
    strokePath: 'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM172.42,72.84l-64,32a8.05,8.05,0,0,0-3.58,3.58l-32,64A8,8,0,0,0,80,184a8.1,8.1,0,0,0,3.58-.84l64-32a8.05,8.05,0,0,0,3.58-3.58l32-64a8,8,0,0,0-10.74-10.74ZM138,138,97.89,158.11,118,118l40.15-20.07Z',
  },
  agentsGroup: {
    fillPath: 'M136,108A52,52,0,1,1,84,56,52,52,0,0,1,136,108Z',
    strokePath: 'M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z',
  },
};

// Icons rendered directly via phosphor-react-native — these support weight
// variants (thin/light/regular/bold/fill/duotone), unlike the hand-traced
// paths above which are fixed to a single style.
const PHOSPHOR_ICONS = {
  profile: UserCircle,
  document: FileText,
  notification: Bell,
  location: MapPin,
  package: Package,
  person: UserFill,
  trayDown: TrayArrowDown,
  trayUp: TrayArrowUp,
  checkCircle: CheckCircle,
  returns: ArrowsClockwise,
  warning: Warning,
  navigation: NavigationArrow,
  users: Users,
  home: House,
  bookmark: Bookmark,
  settings: GearSix,
  grid: SquaresFour,
};

const ICON_NAMES = [
  'warningTriangle', 'user', 'key', 'checkmark',
  'checkmarkCircle', 'send', 'arrowLeft', 'arrowRight', 'building',
  'profile', 'document', 'notification', 'location',
  'package', 'person', 'trayDown', 'trayUp', 'checkCircle', 'returns',
  'warning', 'navigation', 'users', 'home', 'bookmark', 'settings', 'grid',
  'boxPackage', 'peopleGroup',
  'packageHex', 'successCircle', 'returnBox', 'alertTriangle', 'compassTarget', 'agentsGroup',
];

export default function Icon({
  name,
  size = 20,
  color = '#757575',
  style = {},
  stroke = null,
  strokeWidth = 0,
  weight = 'regular',
  duotoneColor = null,
  duotoneOpacity = 0.2,
}) {
  console.log(`🎨 [Icon] Rendering name="${name}" size=${size} weight=${weight}`);
  try {
    if (!name) {
      console.warn(`Icon name is required. Available: ${ICON_NAMES.join(', ')}`);
      return null;
    }

    const multicolorIcon = MULTICOLOR_ICONS[name];
    if (multicolorIcon) {
      return (
        <Svg width={size} height={size} viewBox={multicolorIcon.viewBox} style={style}>
          {multicolorIcon.paths.map((p, i) => (
            <Path key={i} d={p.d} fill={p.fill} />
          ))}
        </Svg>
      );
    }

    const duotoneIcon = DUOTONE_ICONS[name];
    if (duotoneIcon) {
      return (
        <Svg width={size} height={size} viewBox="0 0 256 256" style={style}>
          <Path d={duotoneIcon.fillPath} fill={duotoneColor || color} />
          <Path d={duotoneIcon.strokePath} fill={color} />
        </Svg>
      );
    }

    const PhosphorIcon = PHOSPHOR_ICONS[name];
    if (PhosphorIcon) {
      // duotoneColor/duotoneOpacity only affect weight="duotone" — Phosphor
      // ignores them for every other weight, so it's safe to always pass.
      return (
        <PhosphorIcon
          size={size}
          color={color}
          weight={weight}
          style={style}
          duotoneColor={duotoneColor ?? color}
          duotoneOpacity={duotoneOpacity}
        />
      );
    }

    if (!ICONS[name]) {
      console.warn(`Icon "${name}" not found. Available: ${ICON_NAMES.join(', ')}`);
      return null;
    }
    return (
      <Svg
        width={size}
        height={size}
        viewBox={ICONS[name].viewBox || '0 0 256 256'}
        fill={color}
        stroke={stroke || color}
        strokeWidth={strokeWidth}
        style={style}
      >
        <Path d={ICONS[name].svg} />
      </Svg>
    );
  } catch (error) {
    console.error(`🔴 [Icon] CAUGHT error rendering name="${name}":`, error?.message);
    console.error('🔴 [Icon] Stack:', error?.stack);
    return null;
  }
}

Icon.propTypes = {
  name: PropTypes.oneOf(ICON_NAMES).isRequired,
  size: PropTypes.number,
  color: PropTypes.string,
  style: PropTypes.object,
  stroke: PropTypes.string,
  strokeWidth: PropTypes.number,
  weight: PropTypes.oneOf(['thin', 'light', 'regular', 'bold', 'fill', 'duotone']),
  duotoneColor: PropTypes.string,
  duotoneOpacity: PropTypes.number,
};