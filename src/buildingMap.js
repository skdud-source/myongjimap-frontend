// 백엔드 DB 의 building_id 와 화면(App.jsx)의 건물 id(1, 2, 3)를 연결하는 표
export const BUILDING_ID_BY_APP_ID = { 1: 'Y05', 2: 'Y09', 3: 'Y02' }

export const APP_ID_BY_BUILDING_ID = Object.fromEntries(
  Object.entries(BUILDING_ID_BY_APP_ID).map(([appId, buildingId]) => [buildingId, Number(appId)]),
)

// 'Y09_B1F' -> 'B1F'
export function floorLabel(floorId) {
  return floorId.split('_')[1] || floorId
}
