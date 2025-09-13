import PlatformDetector from '../components/PlatformDetector'
import ExtractionDebugPanel from '../../components/ExtractionDebugPanel'
import '../../index.css'
import './App.css'

function App() {
  const handlePlatformDetected = (platform: string) => {
    // You can add logic here to communicate with your coworker's onboarding features
    console.log('Platform detected for potential integration:', platform)
  }

  return (
    <>
      {/* Your coworker can add onboarding components here without conflicts */}
      
      {/* Platform detection is isolated in its own component */}
      <PlatformDetector onPlatformDetected={handlePlatformDetected} />
      <ExtractionDebugPanel />
    </>
  )
}

export default App