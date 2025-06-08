export const fyersConfig = {
    clientId: process.env.FYERS_CLIENT_ID || '',
    secretId: process.env.FYERS_SECRET_ID || '',
    redirectUri: process.env.FYERS_REDIRECT_URI || 'http://127.0.0.1:5000',
    responseType: 'code',
    state: 'fyers',
    grantType: 'authorization_code',
  };
  