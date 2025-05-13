"use client"

import { useState, useEffect } from "react"
import Radar from "../components/radar"

export default function Page() {
  const [score, setScore] = useState(0)
  const [isGameOver, setIsGameOver] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Check if we can use fullscreen API
  useEffect(() => {
    setIsFullscreen(
      document.fullscreenEnabled ||
        !!(document as any).webkitFullscreenEnabled ||
        !!(document as any).mozFullScreenEnabled ||
        !!(document as any).msFullscreenEnabled,
    )
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      // Go fullscreen
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen()
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        ;(document.documentElement as any).webkitRequestFullscreen()
      } else if ((document.documentElement as any).mozRequestFullScreen) {
        ;(document.documentElement as any).mozRequestFullScreen()
      } else if ((document.documentElement as any).msRequestFullscreen) {
        ;(document.documentElement as any).msRequestFullscreen()
      }
    }
  }

  const handleGameOver = () => {
    console.log("Game over triggered")
    setIsGameOver(true)
  }

  const handlePause = () => {
    console.log("Pause triggered")
    setIsPaused(!isPaused)
  }

  const handleScoreUpdate = (newScore: number) => {
    setScore(newScore)
  }

  const handleRestart = () => {
    setIsGameOver(false)
    setScore(0)
    // Force a complete remount of the Radar component to reset all state
    setGameStarted(false)
    setTimeout(() => {
      setGameStarted(true)
    }, 10)
  }

  const handleStartGame = () => {
    setGameStarted(true)
    // Try to go fullscreen on game start
    if (isFullscreen) {
      toggleFullscreen()
    }
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center p-0 bg-blue-600">
      <div className="w-full h-screen max-w-4xl relative">
        {!gameStarted ? (
          <div className="flex flex-col items-center justify-center h-full bg-gradient-to-b from-blue-600 to-blue-700 text-white">
            {/* Radar logo */}
            <div className="mb-8 relative w-40 h-40">
              <svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Outer circle */}
                <circle cx="80" cy="80" r="78" stroke="white" strokeWidth="2" fill="none" />

                {/* Middle circle */}
                <circle cx="80" cy="80" r="50" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.7" />

                {/* Inner circle */}
                <circle cx="80" cy="80" r="20" stroke="white" strokeWidth="1" fill="none" strokeOpacity="0.5" />

                {/* Center dot */}
                <circle cx="80" cy="80" r="3" fill="white" />

                {/* Radar sweep */}
                <path d="M80 80 L80 2" stroke="white" strokeWidth="2">
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0 80 80"
                    to="360 80 80"
                    dur="4s"
                    repeatCount="indefinite"
                  />
                </path>

                {/* Crosshairs */}
                <line x1="80" y1="10" x2="80" y2="150" stroke="white" strokeWidth="1" strokeOpacity="0.5" />
                <line x1="10" y1="80" x2="150" y2="80" stroke="white" strokeWidth="1" strokeOpacity="0.5" />

                {/* Blip */}
                <circle cx="110" cy="50" r="4" fill="white" opacity="0.8">
                  <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" />
                </circle>
              </svg>
            </div>

            {/* Game title */}
            <h1 className="text-6xl font-semibold tracking-wider mb-16">RADAR</h1>

            {/* Start button */}
            <button
              onClick={handleStartGame}
              className="w-64 py-4 bg-white text-blue-600 rounded-lg font-bold text-lg mb-16 hover:bg-blue-100 transition-colors"
            >
              START
            </button>

            {/* Bottom text */}
            <p className="text-lg font-mono tracking-wide mt-8">STAY IN RADAR TO SCORE</p>
          </div>
        ) : !isGameOver ? (
          <Radar score={score} onPause={handlePause} onGameOver={handleGameOver} onScoreUpdate={handleScoreUpdate} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full bg-gradient-to-b from-blue-600 to-blue-700 text-white">
            {/* Radar logo */}
            <div className="mb-6 relative w-32 h-32">
              <svg width="128" height="128" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Outer circle */}
                <circle cx="80" cy="80" r="78" stroke="white" strokeWidth="2" fill="none" />

                {/* Middle circle */}
                <circle cx="80" cy="80" r="50" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.7" />

                {/* Inner circle */}
                <circle cx="80" cy="80" r="20" stroke="white" strokeWidth="1" fill="none" strokeOpacity="0.5" />

                {/* Center dot */}
                <circle cx="80" cy="80" r="3" fill="white" />

                {/* Crosshairs */}
                <line x1="80" y1="10" x2="80" y2="150" stroke="white" strokeWidth="1" strokeOpacity="0.5" />
                <line x1="10" y1="80" x2="150" y2="80" stroke="white" strokeWidth="1" strokeOpacity="0.5" />
              </svg>
            </div>

            <h1 className="text-5xl font-medium font-mono tracking-wider mb-4">GAME OVER</h1>
            <p className="text-2xl mb-8 font-mono">SCORE: {score}</p>

            <button
              onClick={handleRestart}
              className="w-64 py-4 bg-white text-blue-600 rounded-lg font-medium text-lg hover:bg-blue-100 transition-colors"
            >
              PLAY AGAIN
            </button>
          </div>
        )}

        {isPaused && (
          <div className="absolute inset-0 bg-blue-600/90 flex items-center justify-center z-50">
            <div className="bg-blue-800 p-8 rounded-lg text-white">
              <h2 className="text-2xl font-medium mb-4">Game Paused</h2>
              <button onClick={handlePause} className="px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg">
                Resume
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
