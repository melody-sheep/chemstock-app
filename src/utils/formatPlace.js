// src/utils/formatPlace.js

/**
 * One readable line for a reverse-geocoded place, e.g.
 * "Iponan National HS, Iponan Road, Cagayan de Oro". Returns null when there's
 * no place to describe.
 */
export function formatPlace(place) {
  if (!place) return null;
  return [place.name, place.street, place.subregion || place.city].filter(Boolean).join(', ');
}
