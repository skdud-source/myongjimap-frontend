
import { useEffect, useMemo, useState } from 'react'
import './App.css'
import FloorMap from './FloorMap'
import { fetchNodes } from './api'
import { APP_ID_BY_BUILDING_ID, floorLabel } from './buildingMap'
import { AMENITIES } from './amenities'
import logo from './assets/brand/logo-horizontal.png'
import mascot from './assets/brand/mascot-only.png'

const buildings = [
  { id: 1, short: '5', name: '5공학관', desc: '전공 강의실 · 층별 프린터', floors: '1F 4F', color: 'navy' },
  { id: 2, short: '함', name: '함박관', desc: '교양 강의실 · 학생식당 · 프린터', floors: 'B1F–5F', color: 'orange' },
  { id: 3, short: '창', name: '창조관', desc: '교양 강의실 · 프린터', floors: '4F 5F', color: 'blue' },
]

const MAX_SEARCH_RESULTS = 20

function App() {
  const [selectedBuilding, setSelectedBuilding] = useState(null)
  const [focusNode, setFocusNode] = useState(null) // 검색에서 고른 강의실

  // ----- 강의실 검색 -----
  const [query, setQuery] = useState('')
  const [classrooms, setClassrooms] = useState(null) // null: 아직 불러오는 중
  const [searchError, setSearchError] = useState('')

  // 검색에 쓸 강의실 목록을 백엔드(/api/nodes)에서 한 번 불러온다
  useEffect(() => {
    let cancelled = false
    fetchNodes()
      .then((nodes) => {
        if (!cancelled) {
          setClassrooms(nodes.filter((node) => node.node_type === 'CLASSROOM' && node.node_name))
        }
      })
      .catch((error) => {
        if (!cancelled) setSearchError(error.message || '검색 데이터를 불러오지 못했어요.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const keyword = query.replace(/\s+/g, '').toUpperCase()

  // 강의실 번호의 일부만 입력해도 찾는다. (예: 9119, y9119, Y91)
  const results = useMemo(() => {
    if (!keyword || !classrooms) return []
    return classrooms
      .filter((node) => node.node_name.toUpperCase().includes(keyword))
      .sort((a, b) => a.node_name.localeCompare(b.node_name, 'ko', { numeric: true }))
      .slice(0, MAX_SEARCH_RESULTS)
  }, [keyword, classrooms])

  function buildingOf(node) {
    return buildings.find((building) => building.id === APP_ID_BY_BUILDING_ID[node.building_id])
  }

  function handlePickResult(node) {
    const building = buildingOf(node)
    if (!building) return
    setFocusNode(node)
    setSelectedBuilding(building)
  }

  if (selectedBuilding) {
  return (
    <FloorMap
      building={selectedBuilding}
      focusNode={focusNode}
      onBack={() => {
        setSelectedBuilding(null)
        setFocusNode(null)
      }}
    />
  )
}
  return (
    <div className="app">
      <header className="header">
        <h1><img className="header-logo" src={logo} alt="MyongjiMap" /></h1>
        <p>명지대 자연캠퍼스 실내 길찾기</p>
      </header>

      <main className="content">
        <div className="mascot-greeting">
          <img src={mascot} alt="" />
          <span className="speech-bubble">마루와 함께 출발해 볼까요?</span>
        </div>
        <div className="search-box">
          <span>⌕</span>
          <input
            placeholder="강의실 검색 (예: Y9119)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="강의실 검색"
          />
        </div>

        {keyword && (
          <div className="search-results">
            {searchError ? (
              <div className="search-message with-mascot"><img src={mascot} alt="" /><p>{searchError}</p></div>
            ) : classrooms === null ? (
              <p className="search-message">검색 데이터를 불러오는 중이에요...</p>
            ) : results.length === 0 ? (
              <div className="search-message with-mascot"><img src={mascot} alt="" /><p>‘{query.trim()}’에 해당하는 강의실이 없어요.</p></div>
            ) : (
              results.map((node) => {
                const building = buildingOf(node)
                return (
                  <button
                    key={node.node_id}
                    className="search-result"
                    onClick={() => handlePickResult(node)}
                  >
                    <strong>{node.node_name}</strong>
                    <small>
                      {building ? building.name : node.building_id} · {floorLabel(node.floor_id)}
                    </small>
                  </button>
                )
              })
            )}
          </div>
        )}

        <h3>건물 선택</h3>

        <div className="building-list">
          {buildings.map((building) => (
            <button
              key={building.id}
              className="building-card"
              onClick={() => setSelectedBuilding(building)}
            >
              <span className={`building-icon ${building.color}`}>
                {building.short}
              </span>

              <span className="building-info">
                <strong>{building.name}</strong>
                <small>{building.desc}</small>
              </span>

              <span className="floor-badge">{building.floors}</span>
            </button>
          ))}
        </div>

        <h3>편의시설 위치</h3>

        <div className="amenity-list" aria-label="편의시설 위치 안내">
          {AMENITIES.filter((place) => place.type !== 'restroom').map((place) => {
            const placeBuilding = buildings.find(
              (item) => item.id === APP_ID_BY_BUILDING_ID[place.buildingId],
            )
            return (
              <p key={`${place.type}-${place.buildingId}-${place.floor}`}>
                {place.emoji} {place.name}은 {placeBuilding ? placeBuilding.name : place.buildingId} {place.floor}에 있습니다.
              </p>
            )
          })}
          <p>🚻 화장실은 각 건물의 모든 안내 대상 층에 있습니다.</p>
        </div>
      </main>

      <footer className="footer">
        명지맵 · 캠퍼스 실내 길찾기
      </footer>
    </div>
  )
}

export default App
