
import { useState } from 'react'
import './App.css'
import FloorMap from './FloorMap'

const buildings = [
  { id: 1, short: '5', name: '5공학관', desc: '전공 강의실 · 층별 프린터', floors: '1F 4F', color: 'navy' },
  { id: 2, short: '함', name: '함박관', desc: '교양 강의실 · 학생식당 · 프린터', floors: 'B1F–5F', color: 'orange' },
  { id: 3, short: '창', name: '창조관', desc: '교양 강의실 · 프린터', floors: '4F 5F', color: 'blue' },
]

function App() {
  const [selectedBuilding, setSelectedBuilding] = useState(null)
  if (selectedBuilding) {
  return (
    <FloorMap
      building={selectedBuilding}
      onBack={() => setSelectedBuilding(null)}
    />
  )
}
  return (
    <div className="app">
      <header className="header">
        <h1>📍 명지맵</h1>
        <p>명지대 자연캠퍼스 실내 길찾기</p>
      </header>

      <main className="content">
        <div className="search-box">
          <span>⌕</span>
          <input placeholder="강의실, 학과 사무실, 편의시설 검색" />
        </div>

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

        <h3>편의시설 바로 찾기</h3>

        <div className="facility-list">
          {[
            ['☕', '카페'],
            ['🖨️', '프린터'],
            ['🚻', '화장실'],
            ['📚', '자습공간'],
          ].map(([icon, name]) => (
            <button key={name} className="facility-card">
              <span>{icon}</span>
              <small>{name}</small>
            </button>
          ))}
        </div>

        
      </main>

      <footer className="footer">
        ♿ 배리어프리 경로 지원 예정
      </footer>
    </div>
  )
}

export default App
