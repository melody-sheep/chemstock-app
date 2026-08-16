// src/constants/productCatalog.js
// Static reference catalog — there is no products table in the ERD
// (branch_inventory_table stores product nomenclature directly), so this
// stands in for a product master list. `name` defaults to `code` since no
// full display names exist yet; `image` is null until real product photos
// are supplied — both are single-line edits per entry when that happens.
export const PRODUCT_CATALOG = [
  { code: 'PWBS', name: 'PWBS', image: null },
  { code: 'FHVCO', name: 'FHVCO', image: null },
  { code: 'WLG', name: 'WLG', image: null },
  { code: 'GSSL', name: 'GSSL', image: null },
  { code: 'PGL', name: 'PGL', image: null },
  { code: 'DS', name: 'DS', image: null },
  { code: 'AMB', name: 'AMB', image: null },
  { code: 'AOL', name: 'AOL', image: null },
  { code: '7HWO', name: '7HWO', image: null },
  { code: 'TWNC', name: 'TWNC', image: null },
  { code: 'NC-s', name: 'NC-s', image: null },
  { code: '7HDT', name: '7HDT', image: null },
  { code: 'VNCM', name: 'VNCM', image: null },
  { code: '3VNMG', name: '3VNMG', image: null },
  { code: 'AIR2', name: 'AIR2', image: null },
  { code: 'BSCS', name: 'BSCS', image: null },
  { code: 'RSCS', name: 'RSCS', image: null },
  { code: 'PCB', name: 'PCB', image: null },
  { code: 'GSP', name: 'GSP', image: null },
  { code: 'TBC', name: 'TBC', image: null },
  { code: 'TBC-s', name: 'TBC-s', image: null },
  { code: 'MBG', name: 'MBG', image: null },
  { code: 'AMG', name: 'AMG', image: null },
  { code: 'HPDL', name: 'HPDL', image: null },
];

export default PRODUCT_CATALOG;
