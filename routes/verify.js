const Results = require('../models/Results');



async function processVerifyLogic(results) {
    const https = require('https');
    const axios = require('axios');
    const { HttpsProxyAgent } = require('https-proxy-agent');
  
    // Proxy configuration
    const proxyHost = 'brd.superproxy.io';
    const proxyPort = '33335';
    const proxyUsername = 'brd-customer-hl_0083dc41-zone-recrd_residential-country-in';
    const proxyPassword = 'ks2flzwvbw7g';
    const proxyUrl = `http://${proxyUsername}:${proxyPassword}@${proxyHost}:${proxyPort}`;
    const httpsAgent = new HttpsProxyAgent(proxyUrl);
  
    for (const result of results) {
      if (result.orderLink) {
        console.log(`Checking payment for: ${result.orderLink}`);
  
        let success = false;
  
        try {
          const response = await axios.get(result.orderLink, {
            httpsAgent: httpsAgent,
            maxRedirects: 0,
            validateStatus: (status) => status < 400 || status === 302, // Allow redirects and 302 responses
          });
  
          const isPaymentDone = response.status === 302;
          console.log(`Payment for ${result.resultId}: ${isPaymentDone ? 'Done' : 'Not Done'}`);
          result.Completion = isPaymentDone ? 'Done' : 'Not Done';
          success = true;
        } catch (err) {
          console.error(`Error processing payment for ${result.resultId} on first attempt: ${err.message}`);
        }
  
        // Retry logic
        if (!success) {
          let attempts = 1;
          while (attempts < 3) {
            try {
              console.log(`Retrying payment for ${result.resultId}, attempt ${attempts + 1}`);
              const response = await axios.get(result.orderLink, {
                httpsAgent: httpsAgent,
                maxRedirects: 0,
                validateStatus: (status) => status < 400 || status === 302,
              });
  
              const isPaymentDone = response.status === 302;
              console.log(`Payment for ${result.resultId}: ${isPaymentDone ? 'Done' : 'Not Done'}`);
              result.Completion = isPaymentDone ? 'Done' : 'Not Done';
              success = true;
              break;
            } catch (err) {
              attempts++;
              console.error(`Error processing payment for ${result.resultId} on retry ${attempts}: ${err.message}`);
              if (attempts >= 3) {
                result.Completion = 'Error';
                console.log(`Payment for ${result.resultId} marked as Error after 3 attempts.`);
              }
            }
          }
        }

      
      
      // Determine completionStatus
      if (success) {
        if (result.paymentStatus === 'Paid' && result.Completion === 'Done') {
            result.completionStatus = 'Verified Done';
        } else if (result.paymentStatus === 'Paid' && result.Completion === 'Not Done') {
            result.completionStatus = 'Verified Not Done';
        } else if(result.paymentStatus === 'Unpaid' && result.Completion === 'Done'){ 
            result.completionStatus = 'Unattempted';
        }
    } else {
        result.completionStatus = 'Error';
    }
} else {
    console.log(`No payment link found for result ID: ${result.resultId}`);
    result.Completion = 'No Link';
    result.completionStatus = 'Error'; // No link to verify
}
}

return results;
}

  module.exports = { processVerifyLogic };
