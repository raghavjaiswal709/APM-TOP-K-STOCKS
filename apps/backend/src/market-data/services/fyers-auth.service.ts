// src/market-data/services/fyers-auth.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class FyersAuthService {
  private readonly logger = new Logger(FyersAuthService.name);
  private accessToken: string | null = null;
  private clientId: string;
  private secretKey: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.FYERS_CLIENT_ID || '';
    this.secretKey = process.env.FYERS_SECRET_ID || '';
    this.redirectUri = process.env.FYERS_REDIRECT_URI || 'https://daksphere.com/';
  }

  async getAccessToken(): Promise<string> {
    // Check if we already have a valid token
    const tokenPath = path.join(process.cwd(), 'data', 'access_token.json');
    
    try {
      if (fs.existsSync(tokenPath)) {
        const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        if (tokenData.expiry && new Date(tokenData.expiry) > new Date()) {
          this.logger.log('Using existing access token');
          this.accessToken = tokenData.token;
          return `${this.clientId}:${this.accessToken}`;
        }
      }
    } catch (error) {
      this.logger.error('Error reading token file:', error.message);
    }

    // Generate new token
    return await this.generateNewToken();
  }

  private async generateNewToken(): Promise<string> {
    try {
      // Generate auth URL
      const authUrl = `https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&response_type=code&state=None`;
      
      console.log('\n==== Fyers Authentication ====');
      console.log('Open this URL in your browser and log in:');
      console.log(authUrl);
      
      // Create readline interface for terminal input
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      // Get auth code from user (single line input)
      const authCode = await new Promise<string>((resolve) => {
        rl.question('\nEnter the auth code from the redirect URL: ', (answer) => {
          resolve(answer.trim());
          rl.close();
        });
      });

      // Generate appIdHash
      const appIdHash = `${this.secretKey}:${this.clientId}`;

      // Exchange auth code for access token
      const response = await axios.post('https://api-t1.fyers.in/api/v3/validate-authcode', {
        grant_type: 'authorization_code',
        appIdHash: appIdHash,
        code: authCode
      });

      if (response.data && response.data.s === 'ok') {
        this.accessToken = response.data.access_token;
        
        // Save token for future use
        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + 24); // Token valid for 24 hours
        
        const tokenDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(tokenDir)) {
          fs.mkdirSync(tokenDir, { recursive: true });
        }
        
        fs.writeFileSync(
          path.join(tokenDir, 'access_token.json'),
          JSON.stringify({
            token: this.accessToken,
            expiry: expiryDate.toISOString()
          })
        );
        
        this.logger.log('New access token generated and saved');
        return `${this.clientId}:${this.accessToken}`;
      } else {
        throw new Error(`Failed to generate token: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      this.logger.error('Error generating token:', error.message);
      throw new Error('Failed to authenticate with Fyers');
    }
  }
}
