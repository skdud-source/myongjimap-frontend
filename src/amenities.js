// 편의시설 안내 문구용 목록 (홈 화면). 지도에 찍는 좌표는 백엔드 /api/facilities(DB facilities 표)에서 읽는다.
export const AMENITIES = [
  { type: 'store', buildingId: 'Y09', floor: '3F', name: '편의점', emoji: '🏪' },
  { type: 'printer', buildingId: 'Y02', floor: '5F', name: '프린터', emoji: '🖨️' },
  { type: 'printer', buildingId: 'Y09', floor: '4F', name: '프린터', emoji: '🖨️' },
  { type: 'printer', buildingId: 'Y05', floor: '1F', name: '프린터', emoji: '🖨️' },
  ...[
    ['Y05', ['1F', '4F']],
    ['Y09', ['B1F', '1F', '2F', '3F', '4F', '5F']],
    ['Y02', ['4F', '5F']],
  ].flatMap(([buildingId, floors]) =>
    floors.map((floor) => ({ type: 'restroom', buildingId, floor, name: '화장실', emoji: '🚻' })),
  ),
]

export const FILTERS = [
  { type: 'store', label: '편의점', emoji: '🏪' },
  { type: 'printer', label: '프린터', emoji: '🖨️' },
  { type: 'restroom', label: '화장실', emoji: '🚻' },
]

// 화면의 필터 종류 -> DB(facilities.facility_type) 시설 유형
export const FACILITY_TYPES_BY_FILTER = {
  store: ['CONVENIENCE', 'CAFE'],
  printer: ['PRINT'],
  restroom: ['TOILET'],
}
