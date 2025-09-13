import PlatformDetector from '../../components/PlatformDetector'
import './App.css'

function App() {
  const handlePlatformDetected = (platform: string) => {
    console.log(`SigmaScholar detected platform: ${platform}`)
  }

  return (
    <PlatformDetector onPlatformDetected={handlePlatformDetected} />
  )
}

export default App
