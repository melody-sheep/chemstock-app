// src/constants/productCatalog.js
// Static reference catalog — there is no products table in the ERD
// (branch_inventory_table stores product nomenclature directly), so this
// stands in for a product master list. `name` defaults to `code` since no
// full display names exist yet; `image` is null until real product photos
// are supplied — both are single-line edits per entry when that happens.
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
  { code: 'BSCS', name: 'BSCS' },
  { code: 'RSCS', name: 'RSCS' },
  { code: 'PCB', name: 'PCB' },
  { code: 'GSP', name: 'GSP' },
  { code: 'TBC', name: 'TBC' },
  { code: 'TBC-s', name: 'TBC-s' },
  { code: 'MBG', name: 'MBG' },
  { code: 'AMG', name: 'AMG' },
  { code: 'HPDL', name: 'HPDL' },
];

// No per-product photography exists yet, so every card would otherwise show
// the exact same placeholder graphic. Cycling a tint behind that placeholder
// gives each catalog product a distinct look on the browse grid until real
// photos replace it — swap in a real `image` per entry when that happens,
// `tint` is simply ignored once `image` is set to a real photo.
const PLACEHOLDER_TINTS = [
  '#F9D6D6', '#D6E9FB', '#D3F5DE', '#FBEACB',
  '#E3D6FB', '#CFF3EF', '#FBD6EC', '#DDF5CB',
];

export const PRODUCT_CATALOG = CATALOG_ENTRIES.map((entry, index) => ({
  ...entry,
  image: null,
  tint: PLACEHOLDER_TINTS[index % PLACEHOLDER_TINTS.length],
}));

export default PRODUCT_CATALOG;
