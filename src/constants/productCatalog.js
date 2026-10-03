// src/constants/productCatalog.js
// Static reference catalog — there is no products table in the ERD
// (branch_inventory_table stores product nomenclature directly), so this
// stands in for a product master list. `name` defaults to `code` since no
// full display names exist yet.
// PCB has no product photo (none was provided) and was dropped from the
// catalog entirely rather than left imageless — see PRODUCT_IMAGES below.
const CATALOG_ENTRIES = [
  { code: 'PWBS', name: 'PWBS' },
  { code: 'FHVCO', name: 'FHVCO' },
  { code: 'WLG', name: 'WLG' },
  { code: 'GSSL', name: 'GSSL' },
  { code: 'PGL', name: 'PGL' },
  { code: 'DS', name: 'DS' },
  { code: 'AMB', name: 'AMB' },
  { code: 'AOL', name: 'AOL' },
  { code: '7HWO', name: '7HWO' },
  { code: 'TWNC', name: 'TWNC' },
  { code: 'NC-s', name: 'NC-s' },
  { code: '7HDT', name: '7HDT' },
  { code: 'VNCM', name: 'VNCM' },
  { code: '3VNMG', name: '3VNMG' },
  { code: 'AIR2', name: 'AIR2' },
  { code: 'TBC', name: 'TBC' },
  { code: 'TBC-s', name: 'TBC-s' },
  { code: 'MBG', name: 'MBG' },
  { code: 'AMG', name: 'AMG' },
];

// Real product photos, assets/product_images/<code>.png. Metro's `require()`
// needs a literal string per call (can't be built from a variable), so this
// can't be generated from CATALOG_ENTRIES in a loop — one line per product.
const PRODUCT_IMAGES = {
  PWBS: require('../../assets/product_images/PWBS.png'),
  FHVCO: require('../../assets/product_images/FHVCO.png'),
  WLG: require('../../assets/product_images/WLG.png'),
  GSSL: require('../../assets/product_images/GSSL.png'),
  PGL: require('../../assets/product_images/PGL.png'),
  DS: require('../../assets/product_images/DS.png'),
  AMB: require('../../assets/product_images/AMB.png'),
  AOL: require('../../assets/product_images/AOL.png'),
  '7HWO': require('../../assets/product_images/7HWO.png'),
  TWNC: require('../../assets/product_images/TWNC.png'),
  'NC-s': require('../../assets/product_images/NC-s.png'),
  '7HDT': require('../../assets/product_images/7HDT.png'),
  VNCM: require('../../assets/product_images/VNCM.png'),
  '3VNMG': require('../../assets/product_images/3VNMG.png'),
  AIR2: require('../../assets/product_images/AIR2.png'),
  TBC: require('../../assets/product_images/TBC.png'),
  'TBC-s': require('../../assets/product_images/TBC-s.png'),
  MBG: require('../../assets/product_images/MBG.png'),
  AMG: require('../../assets/product_images/AMG.png'),
};

// Cycling tint, used as a background behind the image (and as the sole
// visual for any future catalog entry that's added without a photo yet).
const PLACEHOLDER_TINTS = [
  '#F9D6D6', '#D6E9FB', '#D3F5DE', '#FBEACB',
  '#E3D6FB', '#CFF3EF', '#FBD6EC', '#DDF5CB',
];

export const PRODUCT_CATALOG = CATALOG_ENTRIES.map((entry, index) => ({
  ...entry,
  image: PRODUCT_IMAGES[entry.code] || null,
  tint: PLACEHOLDER_TINTS[index % PLACEHOLDER_TINTS.length],
}));

export default PRODUCT_CATALOG;
