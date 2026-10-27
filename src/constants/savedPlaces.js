// src/constants/savedPlaces.js
// Offline place list for the delivery map's search bar. Searched first, so it
// works without a connection. Add branches and known landmarks here, e.g.:
//   { id: 'bulua-hs', name: 'Bulua High School', detail: 'Bulua, Cagayan de Oro', latitude: 8.0, longitude: 124.0 }
// Left empty for now. Places picked from the online search are also remembered on
// the phone (see utils/placeSearch.js) and searched right after this list.
export const SAVED_PLACES = [];
