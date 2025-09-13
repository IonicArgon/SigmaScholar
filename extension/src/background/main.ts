// Background script for SigmaScholar extension

// Listen for messages from extension pages
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ONBOARDING_COMPLETE') {
    console.log('Onboarding completed:', message);
    
    // Update extension badge or perform other background tasks
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#28a745' });
    
    // Clear badge after 3 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 3000);
    
    sendResponse({ success: true });
  }
  
  return true; // Keep message channel open for async response
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('SigmaScholar extension installed');
});
