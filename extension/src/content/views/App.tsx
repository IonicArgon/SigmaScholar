import PlatformDetector from '../../components/PlatformDetector'
import './App.css'

function App() {
  const handlePlatformDetected = (platform: string) => {
    console.log(`SigmaScholar detected platform: ${platform}`)
  }

  return (
    <PlatformDetector onPlatformDetected={handlePlatformDetected} />
    // You can add logic here to communicate with your coworker's onboarding features
    console.log('Platform detected for potential integration:', platform)
  }
}

export default App
