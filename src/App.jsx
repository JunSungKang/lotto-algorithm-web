import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [allData, setAllData] = useState([])
  const [stats, setStats] = useState(null)
  const [selectedDraw, setSelectedDraw] = useState(null)
  const [nextDrawPrediction, setNextDrawPrediction] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/all.json')
      .then(res => res.json())
      .then(data => {
        setAllData(data)
        const analysis = analyzeHistoricalAccuracy(data)
        setStats(analysis)

        // Set default selected draw to latest
        if (analysis.results.length > 0) {
          setSelectedDraw(analysis.results[0].draw_no)
        }

        // Calculate next draw prediction
        const prediction = calculateExclusion(data)
        setNextDrawPrediction({
          draw_no: data[data.length - 1].draw_no + 1,
          exclusion_list: prediction
        })

        setLoading(false)
      })
      .catch(err => {
        console.error("Failed to load data:", err)
        setLoading(false)
      })
  }, [])

  const analyzeHistoricalAccuracy = (data) => {
    if (!data || data.length < 11) {
      return { results: [], totalDraws: 0, avgSuccessRate: '0.0', recent10SuccessRate: '0.0' }
    }

    data.sort((a, b) => a.draw_no - b.draw_no)

    const results = []
    let totalExcluded = 0
    let totalDraws = 0

    // Start from draw 1204 (index where we have enough data)
    const startIndex = data.findIndex(d => d.draw_no >= 1204)
    if (startIndex === -1 || startIndex < 10) {
      return { results: [], totalDraws: 0, avgSuccessRate: '0.0', recent10SuccessRate: '0.0' }
    }

    for (let i = startIndex; i < data.length; i++) {
      const currentDraw = data[i]
      const previousDraws = data.slice(0, i)

      const exclusionList = calculateExclusion(previousDraws)
      const actualNumbers = currentDraw.numbers.map(n => parseInt(n))
      const excluded = actualNumbers.filter(n => exclusionList.includes(n))

      const hitCount = excluded.length
      const successRate = ((6 - hitCount) / 6 * 100).toFixed(1)

      results.push({
        draw_no: currentDraw.draw_no,
        exclusion_list: exclusionList,
        actual_numbers: actualNumbers,
        excluded_numbers: excluded,
        hit_count: hitCount,
        success_rate: parseFloat(successRate)
      })

      totalExcluded += hitCount
      totalDraws++
    }

    const avgSuccessRate = totalDraws > 0 ? ((1 - totalExcluded / (totalDraws * 6)) * 100).toFixed(1) : '0.0'

    const recent10 = results.slice(-Math.min(10, results.length))
    const recent10Excluded = recent10.reduce((sum, r) => sum + r.hit_count, 0)
    const recent10SuccessRate = recent10.length > 0 ? ((1 - recent10Excluded / (recent10.length * 6)) * 100).toFixed(1) : '0.0'

    return {
      results: results.reverse(),
      totalDraws,
      avgSuccessRate,
      recent10SuccessRate
    }
  }

  const calculateExclusion = (previousDraws) => {
    const numCounts = {}
    const recentCounts = {}

    previousDraws.forEach(draw => {
      draw.numbers.forEach(n => {
        const num = parseInt(n)
        numCounts[num] = (numCounts[num] || 0) + 1
      })
    })

    const recent = previousDraws.slice(-10)
    recent.forEach(draw => {
      draw.numbers.forEach(n => {
        const num = parseInt(n)
        recentCounts[num] = (recentCounts[num] || 0) + 1
      })
    })

    const scores = []
    for (let n = 1; n <= 45; n++) {
      const score = (numCounts[n] || 0) + ((recentCounts[n] || 0) * 50)
      scores.push({ num: n, score })
    }

    scores.sort((a, b) => a.score - b.score)
    return scores.slice(0, 10).map(s => s.num).sort((a, b) => a - b)
  }

  const getBallColor = (n) => {
    if (n <= 10) return 'yellow'
    if (n <= 20) return 'blue'
    if (n <= 30) return 'red'
    if (n <= 40) return 'grey'
    return 'green'
  }

  const getSelectedDrawData = () => {
    if (!stats || !selectedDraw) return null
    return stats.results.find(r => r.draw_no === selectedDraw)
  }

  if (loading) return <div className="loading">데이터 분석 중...</div>

  const selectedData = getSelectedDrawData()

  return (
    <div className="container">
      <header className="header">
        <h1>로또 제외수 분석</h1>
        <p className="subtitle">통계 및 패턴 기반 제외수 예측 시스템</p>
      </header>

      {/* Main Section: Dashboard + Prediction */}
      <div className="main-section">
        {/* Dashboard (Left Side) */}
        <div className="dashboard">
          <div className="stat-box">
            <div className="stat-label">전체 평균 적중률</div>
            <div className="stat-value">{stats?.avgSuccessRate || '0.0'}%</div>
            <div className="stat-desc">총 {stats?.totalDraws || 0}회차</div>
          </div>
          <div className="stat-box highlight">
            <div className="stat-label">최근 10회 적중률</div>
            <div className="stat-value">{stats?.recent10SuccessRate || '0.0'}%</div>
            <div className="stat-desc">최신 성능</div>
          </div>
        </div>

        {/* Next Draw Prediction (Right Side) */}
        {nextDrawPrediction && (
          <div className="prediction-section">
            <h2>다음 회차 예측</h2>
            <div className="prediction-card">
              <div className="prediction-header">
                <span className="draw-badge">제 {nextDrawPrediction.draw_no}회</span>
                <span className="prediction-label">제외 추천 번호</span>
              </div>
              <div className="ball-container prediction-balls">
                {nextDrawPrediction.exclusion_list.map(n => (
                  <div key={n} className={`ball ${getBallColor(n)}`}>
                    {n}
                  </div>
                ))}
              </div>
              <p className="prediction-note">
                ✨ 통계 연구소의 독자적인 알고리즘으로 분석된 이번 회차 추천 제외수입니다
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Historical Verification */}
      <section className="section">
        <h2>과거 회차 검증</h2>
        <div className="verification-card">
          {stats && stats.results.length > 0 ? (
            <>
              <div className="select-container">
                <label htmlFor="draw-select">회차 선택:</label>
                <select
                  id="draw-select"
                  value={selectedDraw || ''}
                  onChange={(e) => setSelectedDraw(parseInt(e.target.value))}
                >
                  {stats.results.map(r => (
                    <option key={r.draw_no} value={r.draw_no}>
                      제 {r.draw_no}회
                    </option>
                  ))}
                </select>
              </div>

              {selectedData && (
                <div className="result-display">
                  <div className="result-section">
                    <h3>예측 제외수 (10개)</h3>
                    <div className="ball-container prediction-balls">
                      {selectedData.exclusion_list.map(n => (
                        <div
                          key={n}
                          className={`ball ${getBallColor(n)} ${selectedData.excluded_numbers.includes(n) ? 'hit' : ''}`}
                        >
                          {n}
                          {selectedData.excluded_numbers.includes(n) && <span className="hit-mark">✕</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="result-section">
                    <h3>실제 당첨번호 (6개)</h3>
                    <div className="ball-container">
                      {selectedData.actual_numbers.map(n => (
                        <div key={n} className={`ball ${getBallColor(n)}`}>
                          {n}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="result-summary">
                    <div className="summary-item">
                      <span className="summary-label">제외 실패 (당첨번호 포함):</span>
                      <span className="summary-value">
                        {selectedData.hit_count > 0 ? (
                          <span className="hit-text">{selectedData.excluded_numbers.join(', ')} ({selectedData.hit_count}개)</span>
                        ) : (
                          <span className="perfect-text">없음 (완벽 제외 ✓)</span>
                        )}
                      </span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">제외 성공률:</span>
                      <span className={`summary-value ${selectedData.success_rate === 100 ? 'perfect' : ''}`}>
                        {selectedData.success_rate}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="no-data-message">
              <p>📅 아직 당첨번호 추첨 전입니다</p>
              <p className="sub-message">
                {nextDrawPrediction?.draw_no}회차 추첨 후 검증 데이터가 업데이트됩니다
              </p>
            </div>
          )}
        </div>
      </section>

      <footer className="footer">
        <p>© 2025 Lotto Algorithm Lab. All Rights Reserved.</p>
      </footer>
    </div>
  )
}

export default App
