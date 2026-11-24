// 편의시설 안내 데이터 (팀원 개인 저장소의 2차 개선 내용을 통합)
// 층·건물 정보만 확정된 상태이며, 지도에 표시할 좌표는 DB 노드에서 읽는다.
// DB에 해당 시설 노드가 없으면 임의 좌표를 만들어 찍지 않고 "좌표 데이터 확인 필요"로 안내한다.
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

// 노드 이름·유형으로 편의시설 종류를 가려낸다. 해당하지 않으면 null
export function classifyAmenity(node) {
  const kind = String(node.node_type ?? '').toUpperCase()
  const label = String(node.node_name ?? '').toLowerCase()
  const text = `${kind} ${label}`
  if (/RESTROOM|TOILET|WC|화장실/i.test(text)) return 'restroom'
  if (/PRINTER|PRINT|프린터|인쇄/i.test(text)) return 'printer'
  if (/CAFE|CONVENIENCE|STORE|SHOP|편의점|카페/i.test(text)) return 'store'
  return null
}
