// 백엔드 API 호출을 한 곳에 모아 둔 파일
// 백엔드 주소는 .env 의 VITE_API_BASE_URL 로 바꿀 수 있다. (바꾼 뒤에는 npm run dev 를 다시 실행)

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
).replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(message, kind = 'unknown', status = null) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind // 'network' | 'http' | 'data' | 'unknown'
    this.status = status
  }
}

async function request(path, params = {}) {
  const url = new URL(`${API_BASE_URL}${path}`)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value)
    }
  })

  let response
  try {
    response = await fetch(url)
  } catch {
    // 서버가 꺼져 있거나, 주소가 틀렸거나, CORS 때문에 막힌 경우
    throw new ApiError(
      '서버에 연결할 수 없어요. 백엔드 서버가 실행 중인지 확인해 주세요.',
      'network',
    )
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    // JSON 이 아닌 응답은 아래에서 처리한다
  }

  if (!response.ok) {
    throw new ApiError(
      (data && data.error) || `서버에서 오류가 발생했어요. (${response.status})`,
      'http',
      response.status,
    )
  }
  if (data === null) {
    throw new ApiError('서버 응답을 읽을 수 없어요.', 'data')
  }
  return data
}

function ensureArray(data) {
  if (!Array.isArray(data)) {
    throw new ApiError('서버가 보낸 데이터 형식이 올바르지 않아요.', 'data')
  }
  return data
}

// GET /api/floors?building_id=Y09  -> 층 목록 (층 번호 순)
export async function fetchFloors(buildingId) {
  return ensureArray(await request('/api/floors', { building_id: buildingId }))
}

// GET /api/nodes  -> 전체 노드 목록
export async function fetchNodes() {
  return ensureArray(await request('/api/nodes'))
}

// GET /api/route?from=..&to=..&algorithm=dijkstra|bfs  -> { algorithm, total_distance, nodes[] }
export async function fetchRoute(fromId, toId, algorithm = 'dijkstra') {
  const data = await request('/api/route', { from: fromId, to: toId, algorithm })
  if (!data || !Array.isArray(data.nodes) || data.nodes.length === 0) {
    throw new ApiError('서버가 보낸 경로 데이터가 올바르지 않아요.', 'data')
  }
  return data
}

// 도면 SVG 의 좌표계 크기를 읽는다.
// DB 의 노드 좌표(x, y)는 SVG 의 viewBox 기준이다. 이 SVG 들은 루트에 width/height 가 없어서
// <img> 로 읽으면 기본 크기(300x150 비율)가 되므로, 반드시 viewBox 를 직접 읽어야 한다.
export async function fetchSvgSize(url) {
  let response
  try {
    response = await fetch(url)
  } catch {
    throw new ApiError('도면 파일을 불러올 수 없어요.', 'network')
  }
  if (!response.ok) {
    throw new ApiError('도면 파일을 찾을 수 없어요.', 'http', response.status)
  }

  const text = await response.text()
  const svg = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement

  const box = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number)
  if (box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0) {
    return { width: box[2], height: box[3] }
  }

  const width = parseFloat(svg.getAttribute('width'))
  const height = parseFloat(svg.getAttribute('height'))
  if (width > 0 && height > 0) return { width, height }

  throw new ApiError('도면 크기를 알 수 없어요.', 'data')
}

// floors.svg_url (예: 'svg/함박관_1F.svg') -> 실제 접근 주소
export function svgUrl(svgPath) {
  return `${API_BASE_URL}/${encodeURI(svgPath)}`
}
