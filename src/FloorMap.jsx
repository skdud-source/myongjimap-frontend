
import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, ImageOverlay, Polyline, CircleMarker, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { fetchFacilities, fetchFloors, fetchNodes, fetchRoute, fetchSvgSize, svgUrl, ApiError, API_BASE_URL } from './api'
import { BUILDING_ID_BY_APP_ID, floorLabel } from './buildingMap'
import mascot from './assets/brand/mascot-only.png'
import { FILTERS, FACILITY_TYPES_BY_FILTER } from './amenities'

const TYPE_LABEL = {
  CLASSROOM: '강의실',
  ENTRANCE: '입구',
  ELEVATOR: '엘리베이터',
  CORRIDOR: '복도',
}

// 출발지/도착지로 선택할 수 있는 노드 유형 (복도는 경로 계산에만 사용)
const SELECTABLE_TYPES = ['CLASSROOM', 'ENTRANCE', 'ELEVATOR']

const ALGORITHM_LABEL = { dijkstra: '다익스트라', bfs: 'BFS' }

function nodeLabel(node) {
  if (node.node_type === 'CLASSROOM') return node.node_name || `강의실 ${node.node_id}`
  return `${TYPE_LABEL[node.node_type] || '위치'} ${floorLabel(node.floor_id)}`
}

function MapController({ bounds }) {
  const map = useMap()

  useEffect(() => {
    map.fitBounds(bounds)
  }, [map, bounds])

  return null
}

// focusNode: 홈 화면의 강의실 검색에서 고른 노드. 있으면 그 층을 먼저 열고 도착지로 선택해 둔다.
export default function FloorMap({ building, onBack, focusNode = null }) {
  const buildingId = BUILDING_ID_BY_APP_ID[building.id]
  const focusRef = useRef(focusNode)

  // ----- 서버에서 받아온 데이터 -----
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [floors, setFloors] = useState([])
  const [nodes, setNodes] = useState([])
  const [facilities, setFacilities] = useState([])
  const [floorId, setFloorId] = useState(null)

  // ----- 도면 이미지 크기 -----
  const [image, setImage] = useState(null) // { url, width, height } 또는 { url, failed: true }

  // ----- 길찾기 -----
  const [startId, setStartId] = useState('')
  const [endId, setEndId] = useState('')
  const [algorithm, setAlgorithm] = useState('dijkstra')
  const [route, setRoute] = useState(null)
  const [routeError, setRouteError] = useState('')
  const [routing, setRouting] = useState(false)

  // ----- 편의시설 필터 / 강의실 번호 고정 -----
  const [selectedAmenity, setSelectedAmenity] = useState(null)
  const [pinnedId, setPinnedId] = useState(null) // 클릭해서 번호를 고정해 둔 강의실

  // 건물이 바뀌거나 "다시 시도"를 누르면 층과 노드를 다시 불러온다
  useEffect(() => {
    let cancelled = false

    async function load() {
      setStatus('loading')
      setErrorMessage('')
      try {
        if (!buildingId) {
          throw new ApiError('이 건물의 데이터가 아직 연결되지 않았어요.', 'data')
        }
        const [floorList, allNodes] = await Promise.all([fetchFloors(buildingId), fetchNodes()])
        // 편의시설은 없어도 길찾기는 되어야 하므로, 실패해도 지도 전체를 막지 않는다
        const facilityList = await fetchFacilities().catch(() => [])
        if (cancelled) return
        if (floorList.length === 0) {
          throw new ApiError('이 건물의 층 정보가 아직 등록되지 않았어요.', 'data')
        }
        setFloors(floorList)
        setNodes(allNodes.filter((node) => node.building_id === buildingId))
        setFacilities(facilityList.filter((item) => item.building_id === buildingId))
        const focus = focusRef.current
        const focusFloor = focus && floorList.find((floor) => floor.floor_id === focus.floor_id)
        setFloorId(focusFloor ? focusFloor.floor_id : floorList[0].floor_id)
        if (focusFloor) setEndId(String(focus.node_id))
        setStatus('ready')
      } catch (error) {
        if (cancelled) return
        setErrorMessage(error.message || '데이터를 불러오지 못했어요.')
        setStatus('error')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [buildingId, reloadKey])

  const currentFloor = floors.find((floor) => floor.floor_id === floorId) || null
  const currentImageUrl = currentFloor && currentFloor.svg_url ? svgUrl(currentFloor.svg_url) : null

  // 층이 바뀌면 그 층의 도면(SVG) 크기를 읽는다. (층마다 도면 크기가 다르다)
  useEffect(() => {
    if (!currentImageUrl) return
    let cancelled = false
    // 노드 좌표는 SVG viewBox 기준이므로, 이미지 크기가 아니라 viewBox 크기를 읽는다
    fetchSvgSize(currentImageUrl)
      .then((size) => {
        if (!cancelled) setImage({ url: currentImageUrl, ...size })
      })
      .catch(() => {
        if (!cancelled) setImage({ url: currentImageUrl, failed: true })
      })
    return () => {
      cancelled = true
    }
  }, [currentImageUrl])

  const imageForFloor = image && image.url === currentImageUrl ? image : null
  const imageFailed = Boolean(currentFloor) && (!currentImageUrl || Boolean(imageForFloor && imageForFloor.failed))
  const imageReady = Boolean(imageForFloor && !imageForFloor.failed)

  const bounds = useMemo(
    () => (imageReady ? [[0, 0], [imageForFloor.height, imageForFloor.width]] : null),
    [imageReady, imageForFloor],
  )

  // DB 좌표는 SVG 기준(왼쪽 위가 원점, y 아래로 증가) -> Leaflet [lat, lng] (y 위로 증가)
  const toLatLng = (node) => [imageForFloor.height - node.y, node.x]

  // ----- 파생 데이터 -----
  const nodeById = useMemo(() => new Map(nodes.map((node) => [String(node.node_id), node])), [nodes])

  const selectableByFloor = useMemo(() => {
    return floors.map((floor) => ({
      floor,
      nodes: nodes
        .filter((node) => node.floor_id === floor.floor_id && SELECTABLE_TYPES.includes(node.node_type))
        .sort((a, b) => nodeLabel(a).localeCompare(nodeLabel(b), 'ko', { numeric: true })),
    })).filter((group) => group.nodes.length > 0)
  }, [floors, nodes])

  const floorNodes = nodes.filter(
    (node) => node.floor_id === floorId && SELECTABLE_TYPES.includes(node.node_type),
  )

  // 경로를 층별 구간으로 나눈다 (엘리베이터로 층이 바뀌면 구간이 나뉜다)
  const routeSegments = useMemo(() => {
    if (!route) return []
    const segments = []
    let current = null
    for (const node of route.nodes) {
      if (current && current.floorId === node.floor_id) {
        current.points.push(node)
      } else {
        current = { floorId: node.floor_id, points: [node] }
        segments.push(current)
      }
    }
    return segments
  }, [route])

  // 편의시설: 선택한 종류의 시설 중 현재 층에 등록된 것을 DB 좌표 그대로 지도에 표시한다.
  const floorShort = floorId ? floorLabel(floorId) : ''
  const amenityTypes = selectedAmenity ? FACILITY_TYPES_BY_FILTER[selectedAmenity] || [] : []
  const amenityNodes = facilities.filter(
    (item) =>
      item.floor_id === floorId &&
      amenityTypes.includes(item.facility_type) &&
      Number.isFinite(Number(item.x)) &&
      Number.isFinite(Number(item.y)),
  )
  const amenityMarker = FILTERS.find((item) => item.type === selectedAmenity)

  const routeFloorIds = new Set(routeSegments.map((segment) => segment.floorId))
  const startNode = nodeById.get(startId) || null
  const endNode = nodeById.get(endId) || null

  // ----- 동작 -----
  function clearRoute() {
    setRoute(null)
    setRouteError('')
  }

  function handleStartChange(value) {
    setStartId(value)
    clearRoute()
  }

  function handleEndChange(value) {
    setEndId(value)
    clearRoute()
  }

  function handleAlgorithmChange(value) {
    setAlgorithm(value)
    clearRoute()
  }

  // 지도에서 위치를 누르면 출발지 -> 도착지 순서로 선택된다
  function handlePickNode(node) {
    const id = String(node.node_id)
    // 강의실을 누르면 번호를 말풍선으로 고정한다. 같은 강의실을 다시 누르거나 층을 바꾸면 해제된다.
    if (node.node_type === 'CLASSROOM') setPinnedId((prev) => (prev === id ? null : id))
    clearRoute()
    if (!startId || (startId && endId)) {
      setStartId(id)
      setEndId('')
    } else if (id !== startId) {
      setEndId(id)
    }
  }

  function handleReset() {
    setStartId('')
    setEndId('')
    clearRoute()
  }

  async function handleFindRoute() {
    if (!startId || !endId) {
      setRoute(null)
      setRouteError('출발지와 도착지를 모두 선택해 주세요.')
      return
    }
    if (startId === endId) {
      setRoute(null)
      setRouteError('출발지와 도착지가 같아요. 다른 위치를 선택해 주세요.')
      return
    }

    setRouting(true)
    setRouteError('')
    try {
      const result = await fetchRoute(startId, endId, algorithm)
      setRoute(result)
      setFloorId(result.nodes[0].floor_id) // 출발지가 있는 층으로 이동
    } catch (error) {
      setRoute(null)
      setRouteError(error.message || '경로를 찾지 못했어요.')
    } finally {
      setRouting(false)
    }
  }

  // ----- 화면 -----
  const header = (
    <div className="floor-header">
      <button onClick={onBack}>← 뒤로</button>
      <h2>{building.name}</h2>
      <p>층별 실내 지도</p>
    </div>
  )

  if (status === 'loading') {
    return (
      <div className="floor-page">
        {header}
        <div className="map-notice with-mascot"><img src={mascot} alt="" /><p>지도 데이터를 불러오는 중이에요...</p></div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="floor-page">
        {header}
        <div className="selection-message" style={{ margin: '16px' }}>
          <img className="error-mascot" src={mascot} alt="" />
          {errorMessage}
          <p>백엔드 서버({API_BASE_URL})가 켜져 있는지 확인한 뒤 다시 시도해 주세요.</p>
          <button onClick={() => setReloadKey((key) => key + 1)}>다시 시도</button>
        </div>
      </div>
    )
  }

  let notice = '지도의 위치를 누르거나 아래에서 출발지와 도착지를 선택하세요.'
  if (routeError) {
    notice = routeError
  } else if (route) {
    const path = routeSegments.map((segment) => floorLabel(segment.floorId)).join(' → ')
    notice = `${ALGORITHM_LABEL[route.algorithm] || route.algorithm} 경로 · ${path} · 도면 기준 거리 ${route.total_distance}`
  } else if (endNode && !startNode) {
    notice = `도착지 ${nodeLabel(endNode)}이(가) 선택됐어요. 출발지를 선택하세요.`
  } else if (imageReady && floorNodes.length === 0) {
    notice = '이 층에는 아직 등록된 위치가 없어요.'
  }

  return (
    <div className="floor-page">
      {header}

      <div className="floor-tabs">
        {floors.map((floor) => (
          <button
            key={floor.floor_id}
            className={[
              floorId === floor.floor_id ? 'active' : '',
              routeFloorIds.has(floor.floor_id) ? 'on-route' : '',
            ].join(' ').trim()}
            onClick={() => {
              setFloorId(floor.floor_id)
              setPinnedId(null)
            }}
          >
            {floorLabel(floor.floor_id)}
          </button>
        ))}
      </div>

      <div className="amenity-filters" aria-label="편의시설 표시">
        {FILTERS.map((filter) => (
          <button
            key={filter.type}
            type="button"
            aria-pressed={selectedAmenity === filter.type}
            className={selectedAmenity === filter.type ? 'active' : ''}
            onClick={() => setSelectedAmenity(selectedAmenity === filter.type ? null : filter.type)}
          >
            {filter.emoji} {filter.label}
          </button>
        ))}
      </div>
      {selectedAmenity && (
        <p className="filter-status">
          {amenityMarker && amenityMarker.label} 표시 중
          {amenityNodes.length === 0
            ? ' · 이 층에는 등록된 시설이 없어요'
            : ` · 이 층 ${amenityNodes.length}곳`}
        </p>
      )}

      <div className="route-panel">
        <div className="route-row">
          <label>
            <span>출발지</span>
            <select value={startId} onChange={(event) => handleStartChange(event.target.value)}>
              <option value="">선택하세요</option>
              {selectableByFloor.map(({ floor, nodes: group }) => (
                <optgroup key={floor.floor_id} label={floorLabel(floor.floor_id)}>
                  {group.map((node) => (
                    <option key={node.node_id} value={node.node_id}>{nodeLabel(node)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label>
            <span>도착지</span>
            <select value={endId} onChange={(event) => handleEndChange(event.target.value)}>
              <option value="">선택하세요</option>
              {selectableByFloor.map(({ floor, nodes: group }) => (
                <optgroup key={floor.floor_id} label={floorLabel(floor.floor_id)}>
                  {group.map((node) => (
                    <option key={node.node_id} value={node.node_id}>{nodeLabel(node)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>

        <div className="route-row route-actions">
          <select
            value={algorithm}
            onChange={(event) => handleAlgorithmChange(event.target.value)}
            aria-label="경로 탐색 방식"
          >
            <option value="dijkstra">다익스트라 (최단 거리)</option>
            <option value="bfs">BFS (최소 이동 칸 수)</option>
          </select>
          <button className="route-find" onClick={handleFindRoute} disabled={routing}>
            {routing ? '찾는 중...' : '길찾기'}
          </button>
          <button className="route-reset" onClick={handleReset} disabled={routing}>
            초기화
          </button>
        </div>
      </div>

      <div className="map-wrapper">
        <div className="map-floor-indicator" aria-label={`현재 층 ${floorShort}`}>{floorShort}</div>
        {imageFailed && (
          <p className="map-notice">이 층의 도면을 불러오지 못했어요.</p>
        )}
        {!imageFailed && !imageReady && (
          <p className="map-notice">도면을 불러오는 중이에요...</p>
        )}

        {imageReady && (
          <MapContainer
            key={floorId}
            crs={L.CRS.Simple}
            bounds={bounds}
            maxBounds={bounds}
            maxBoundsViscosity={1}
            minZoom={-2}
            maxZoom={2}
            zoomSnap={0.25}
            style={{ height: '100%', width: '100%' }}
          >
            <MapController bounds={bounds} />

            <ImageOverlay url={currentImageUrl} bounds={bounds} />

            {floorNodes.map((node) => (
              <CircleMarker
                key={node.node_id}
                center={toLatLng(node)}
                radius={5}
                pathOptions={{ color: '#64748b', fillColor: '#ffffff', fillOpacity: 1, weight: 2 }}
                eventHandlers={{ click: () => handlePickNode(node) }}
              >
                {/* 고정된 강의실은 permanent 말풍선으로 계속 보인다 (key로 모드 변경 시 다시 그림) */}
                <Tooltip
                  key={String(pinnedId === String(node.node_id))}
                  permanent={pinnedId === String(node.node_id)}
                >
                  {nodeLabel(node)}
                </Tooltip>
              </CircleMarker>
            ))}

            {amenityNodes.map((node) => (
              <Marker
                key={`amenity-${node.facility_id}`}
                position={toLatLng(node)}
                icon={L.divIcon({
                  className: 'amenity-marker',
                  html: `<span>${amenityMarker ? amenityMarker.emoji : ''}</span>`,
                  iconSize: [34, 34],
                  iconAnchor: [17, 17],
                })}
              >
                <Tooltip>{node.facility_name} · {floorLabel(node.floor_id)}</Tooltip>
              </Marker>
            ))}

            {routeSegments
              .filter((segment) => segment.floorId === floorId)
              .map((segment, index) =>
                segment.points.length > 1 ? (
                  <Polyline
                    key={`line-${index}`}
                    positions={segment.points.map(toLatLng)}
                    pathOptions={{ color: '#2563eb', weight: 6 }}
                  />
                ) : (
                  // 엘리베이터만 지나가는 층
                  <CircleMarker
                    key={`pass-${index}`}
                    center={toLatLng(segment.points[0])}
                    radius={8}
                    pathOptions={{ color: 'white', fillColor: '#f59e0b', fillOpacity: 1, weight: 3 }}
                  />
                ),
              )}

            {startNode && startNode.floor_id === floorId && (
              <CircleMarker
                center={toLatLng(startNode)}
                radius={9}
                pathOptions={{ color: 'white', fillColor: '#16a34a', fillOpacity: 1, weight: 3 }}
              >
                <Tooltip permanent direction="top" offset={[0, -8]}>출발 · {nodeLabel(startNode)}</Tooltip>
              </CircleMarker>
            )}

            {endNode && endNode.floor_id === floorId && (
              <CircleMarker
                center={toLatLng(endNode)}
                radius={9}
                pathOptions={{ color: 'white', fillColor: '#dc2626', fillOpacity: 1, weight: 3 }}
              >
                <Tooltip permanent direction="bottom" offset={[0, 8]}>도착 · {nodeLabel(endNode)}</Tooltip>
              </CircleMarker>
            )}
          </MapContainer>
        )}
      </div>

      <div className="route-summary" aria-live="polite">
        <div className="route-endpoint">
          <small>출발지</small>
          <strong>{startNode ? nodeLabel(startNode) : '미선택'}</strong>
          {startNode && <em>{floorLabel(startNode.floor_id)}</em>}
        </div>
        <span className="route-arrow" aria-hidden="true">→</span>
        <div className="route-endpoint">
          <small>도착지</small>
          <strong>{endNode ? nodeLabel(endNode) : '미선택'}</strong>
          {endNode && <em>{floorLabel(endNode.floor_id)}</em>}
        </div>
      </div>

      <p className="map-notice">{notice}</p>
    </div>
  )
}
