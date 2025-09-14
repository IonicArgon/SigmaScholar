import PlatformDetector from '../components/PlatformDetector'
import ShortsDetector from '../components/ShortsDetector'
import ExtractionDebugPanel from '../../components/ExtractionDebugPanel'
import './App.css'

function App() {
  const handlePlatformDetected = (_platform: string) => {
    // You can add logic here to communicate with your coworker's onboarding features
    // Platform detected for integration
  }

  return (
    <>
      {/* Your coworker can add onboarding components here without conflicts */}
      
      {/* Platform detection is isolated in its own component */}
      <PlatformDetector onPlatformDetected={handlePlatformDetected} />
      
      {/* YouTube Shorts quiz blocker */}
      <ShortsDetector />
      
      {/* Extraction debug panel */}
      <ExtractionDebugPanel />
    </>
  )
}

export default App