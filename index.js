// Filename: index.js
import { Connection, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

class HeliusSolanaService {
    constructor() {
        this.rpcUrl = process.env.HELIUS_RPC_URL;
        this.apiBaseUrl = process.env.HELIUS_API_BASE_URL;
        this.apiKey = process.env.HELIUS_API_KEY;

        if (!this.rpcUrl || !this.apiKey) {
            throw new Error('CRITICAL: Helius configuration missing in environment variables.');
        }

        this.connection = new Connection(this.rpcUrl, 'confirmed');
    }

    async getNetworkStatus() {
        try {
            const slot = await this.connection.getSlot();
            const blockTime = await this.connection.getBlockTime(slot);
            console.log(`[Network Status] Current Slot: ${slot}`);
            console.log(`[Network Status] Latest Block Time: ${new Date(blockTime * 1000).toISOString()}`);
            return { slot, blockTime };
        } catch (error) {
            console.error('Error fetching network status:', error.message);
            throw error;
        }
    }

    async getAccountBalance(address) {
        try {
            const publicKey = new PublicKey(address);
            const balanceLamports = await this.connection.getBalance(publicKey);
            const balanceSol = balanceLamports / 1e9;
            console.log(`[Balance] Address ${address}: ${balanceSol} SOL`);
            return balanceSol;
        } catch (error) {
            console.error(`Error fetching balance for ${address}:`, error.message);
            throw error;
        }
    }

    async getEnhancedTransactions(address) {
        try {
            const url = `${this.apiBaseUrl}/addresses/${address}/transactions?api-key=${this.apiKey}`;
            console.log(`[Helius API] Fetching parsed transactions for: ${address}`);
            
            const response = await axios.get(url);
            console.log(`[Helius API] Successfully retrieved ${response.data.length} transactions.`);
            return response.data;
        } catch (error) {
            console.error('Error fetching enhanced transactions from Helius API:', error.response?.data || error.message);
            throw error;
        }
    }
}

async function main() {
    try {
        const heliusService = new HeliusSolanaService();

        await heliusService.getNetworkStatus();

        const sampleAddress = '11111111111111111111111111111111';
        
        await heliusService.getAccountBalance(sampleAddress);
        
        const txs = await heliusService.getEnhancedTransactions(sampleAddress);
        console.log('Sample Transaction Data:', JSON.stringify(txs.slice(0, 1), null, 2));

    } catch (err) {
        console.error('Application execution failed:', err);
    }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
    main();
}

export default HeliusSolanaService;

