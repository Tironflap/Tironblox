chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'AUTO_FILL_USER_ID') {
    // Could open popup with pre-filled ID in future
    console.log('Detected Roblox user:', message.userId);
  }
});