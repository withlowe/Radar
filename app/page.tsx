"use client"

import { useState, useEffect, useRef } from "react"
import Radar from "../components/radar"
import { BASE64_RADAR_LOGO } from "../components/inline-logo"

export default function Page() {
  const [score, setScore] = useState(0)
  const [isGameOver, setIsGameOver] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const logoRef = useRef<HTMLDivElement>(null)

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

  const handleLogoError = () => {
    console.log("Logo failed to load, using base64 fallback")
    setLogoError(true)
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center p-0 bg-blue-600">
      <div className="w-full h-screen max-w-4xl relative">
        {!gameStarted ? (
          <div className="flex flex-col items-center justify-center h-full bg-gradient-to-b from-blue-600 to-blue-700 text-white">
            {/* Radar logo with base64 fallback */}
            <div className="mb-8 relative w-40 h-40">
              <img
                src={logoError ? BASE64_RADAR_LOGO : "/radar-logo.svg"}
                alt="Radar Logo"
                width={160}
                height={160}
                className="animate-pulse"
                onError={handleLogoError}
              />
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
            {/* Radar logo with base64 fallback */}
            <div className="mb-6 relative w-32 h-32">
              <img
                src={logoError ? BASE64_RADAR_LOGO : "/radar-logo.svg"}
                alt="Radar Logo"
                width={128}
                height={128}
                onError={handleLogoError}
              />
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
