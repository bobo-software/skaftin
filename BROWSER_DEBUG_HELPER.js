/**
 * 🔍 Browser Debug Helper for SuperTokens Session Issues
 * 
 * USAGE:
 * 1. Open your live site: https://skaftin.bobosoftware.co.za
 * 2. Press F12 to open DevTools
 * 3. Go to Console tab
 * 4. Copy and paste this entire file into the console
 * 5. Press Enter
 * 
 * This will display:
 * - All cookies for your domain
 * - SuperTokens specific cookies
 * - Cookie attributes (Secure, SameSite, Domain, etc.)
 * - Potential issues
 */

(function() {
  console.log('\n🔍 ===== SuperTokens Session Debug =====\n');
  
  // Get all cookies
  const cookies = document.cookie.split(';').map(c => c.trim());
  
  console.log('📊 All Cookies:', cookies.length);
  console.log('-----------------------------------');
  
  if (cookies.length === 0 || (cookies.length === 1 && cookies[0] === '')) {
    console.log('⚠️  WARNING: No cookies found!');
    console.log('   This could mean:');
    console.log('   1. You are not logged in');
    console.log('   2. Cookies are being blocked');
    console.log('   3. Cookie domain is misconfigured');
    console.log('\n');
  } else {
    cookies.forEach((cookie, index) => {
      const [name, value] = cookie.split('=');
      console.log(`${index + 1}. ${name}:`, value ? value.substring(0, 50) + '...' : '(empty)');
    });
    console.log('\n');
  }
  
  // Check for SuperTokens cookies
  console.log('🍪 SuperTokens Cookies:');
  console.log('-----------------------------------');
  
  const stCookies = {
    sAccessToken: cookies.find(c => c.startsWith('sAccessToken=')),
    sRefreshToken: cookies.find(c => c.startsWith('sRefreshToken=')),
    sFrontToken: cookies.find(c => c.startsWith('sFrontToken=')),
  };
  
  Object.entries(stCookies).forEach(([name, value]) => {
    if (value) {
      console.log(`✅ ${name}: Present`);
    } else {
      console.log(`❌ ${name}: Missing`);
    }
  });
  
  console.log('\n');
  
  // Check issues
  console.log('⚠️  Potential Issues:');
  console.log('-----------------------------------');
  
  let hasIssues = false;
  
  if (!stCookies.sAccessToken) {
    console.log('❌ sAccessToken is missing - You may need to login');
    hasIssues = true;
  }
  
  if (!stCookies.sRefreshToken) {
    console.log('❌ sRefreshToken is missing - Session refresh will not work');
    hasIssues = true;
  }
  
  if (!stCookies.sFrontToken) {
    console.log('❌ sFrontToken is missing - SuperTokens SDK may not work properly');
    hasIssues = true;
  }
  
  // Check if running on correct domain
  const currentDomain = window.location.hostname;
  if (!currentDomain.includes('bobosoftware.co.za')) {
    console.log(`❌ Running on unexpected domain: ${currentDomain}`);
    console.log('   Expected: skaftin.bobosoftware.co.za');
    hasIssues = true;
  }
  
  // Check protocol
  if (window.location.protocol !== 'https:') {
    console.log(`❌ Not using HTTPS: ${window.location.protocol}`);
    console.log('   SuperTokens requires HTTPS in production');
    hasIssues = true;
  }
  
  if (!hasIssues) {
    console.log('✅ No obvious issues detected');
  }
  
  console.log('\n');
  
  // Detailed cookie inspection (only works in Application tab)
  console.log('🔬 Detailed Cookie Inspection:');
  console.log('-----------------------------------');
  console.log('To see detailed cookie attributes:');
  console.log('1. Open DevTools → Application tab');
  console.log('2. Click "Cookies" in the left sidebar');
  console.log('3. Look for cookies under:');
  console.log('   • https://skaftin.bobosoftware.co.za');
  console.log('   • .bobosoftware.co.za');
  console.log('\n');
  console.log('Check these attributes for each SuperTokens cookie:');
  console.log('  ✓ Domain: .bobosoftware.co.za');
  console.log('  ✓ Path: /');
  console.log('  ✓ Secure: Yes (checkmark)');
  console.log('  ✓ HttpOnly: Yes (checkmark)');
  console.log('  ✓ SameSite: None');
  console.log('  ✓ Expires: Future date (not expired)');
  console.log('\n');
  
  // Test fetch with credentials
  console.log('🧪 Testing API Connection:');
  console.log('-----------------------------------');
  console.log('Testing connection to backend...\n');
  
  const apiUrl = 'https://skaftinplatform.bobosoftware.co.za/api/health';
  
  fetch(apiUrl, {
    method: 'GET',
    credentials: 'include',
  })
    .then(response => {
      console.log(`✅ Backend reachable: ${apiUrl}`);
      console.log(`   Status: ${response.status}`);
      console.log(`   OK: ${response.ok}`);
      return response.json();
    })
    .then(data => {
      console.log('   Response:', data);
    })
    .catch(error => {
      console.log(`❌ Backend connection failed: ${error.message}`);
      console.log('   This could indicate:');
      console.log('   1. Backend is down');
      console.log('   2. CORS is blocking the request');
      console.log('   3. Network connectivity issue');
    })
    .finally(() => {
      console.log('\n');
      console.log('🎯 Next Steps:');
      console.log('-----------------------------------');
      console.log('1. If cookies are missing: Try logging in');
      console.log('2. If cookies exist but not working:');
      console.log('   → Check cookie attributes in Application tab');
      console.log('   → Check backend logs for cookie configuration');
      console.log('3. If CORS errors in console:');
      console.log('   → Check backend CORS configuration');
      console.log('   → Verify SUPERTOKENS_WEBSITE_DOMAIN env var');
      console.log('4. Share this output + backend logs for help');
      console.log('\n🔍 ===== Debug Complete =====\n');
    });
  
})();

