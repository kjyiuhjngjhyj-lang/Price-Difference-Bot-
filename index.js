// Filename: index.js
import { Connection, PublicKey, Keypair, VersionedTransaction } from '@solana/web3.js';
import axios from 'axios';
import dotenv from 'dotenv';
import bs58 from 'bs58';

dotenv.config();

class SolanaTradingBot {
    constructor() {
        this.rpcUrl = process.env.HELIUS_RPC_URL;
        this.apiKey = process.env.HELIUS_API_KEY;

        if (!this.rpcUrl || !this.apiKey) {
            throw new Error('CRITICAL: Helius configuration missing in environment variables.');
        }

        // Establish connection to Solana network via Helius RPC
        this.connection = new Connection(this.rpcUrl, 'confirmed');

        // Initialize wallet using the private key stored in environment variables
        if (!process.env.PRIVATE_KEY) {
            throw new Error('CRITICAL: PRIVATE_KEY is missing in environment variables.');
        }
        
        try {
            const secretKeyBytes = bs58.decode(process.env.PRIVATE_KEY);
            this.wallet = Keypair.fromSecretKey(secretKeyBytes);
            console.log(`[Init] Bot successfully initialized with wallet address: ${this.wallet.publicKey.toBase58()}`);
        } catch (error) {
            throw new Error('CRITICAL: Failed to decode PRIVATE_KEY. Ensure it is formatted in Base58.');
        }
    }

    // Fetch current wallet SOL balance
    async getWalletBalance() {
        try {
            const balanceLamports = await this.connection.getBalance(this.wallet.publicKey);
            const balanceSol = balanceLamports / 1e9;
            console.log(`[Balance] Current Wallet Balance: ${balanceSol} SOL`);
            return balanceSol;
        } catch (error) {
            console.error('Error fetching wallet balance:', error.message);
            throw error;
        }
    }

    // Professional swap execution function using Jupiter Aggregator V6 API
    async executeSwap(inputMint, outputMint, amountInSmallestUnit, slippageBps = 50) {
        try {
            console.log(`[Swap] Preparing trade: Swapping ${amountInSmallestUnit} from ${inputMint} to ${outputMint}...`);

            // 1. Fetch exact routing and price quote from Jupiter API
            const quoteUrl = `https://quote-jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountInSmallestUnit}&slippageBps=${slippageBps}`;
            const quoteResponse = await axios.get(quoteUrl);
            
            if (!quoteResponse.data || quoteResponse.data.error) {
                throw new Error(`Jupiter Quote Error: ${quoteResponse.data?.error || 'No route found'}`);
            }

            const quoteData = quoteResponse.data;
            console.log(`[Swap] Quote secured successfully. Expected output: ${quoteData.outAmount}`);

            // 2. Request serialized transaction payload from Jupiter Swap API
            const swapRequestBody = {
                quoteResponse: quoteData,
                userPublicKey: this.wallet.publicKey.toBase58(),
                wrapAndUnwrapSol: true,
                dynamicComputeUnitLimit: true,
                prioritizationFeeLamports: 'auto' // Automated priority fee for fast on-chain execution
            };

            const swapResponse = await axios.post('https://quote-jup.ag/v6/swap', swapRequestBody);
            
            if (!swapResponse.data || !swapResponse.data.swapTransaction) {
                throw new Error('Failed to retrieve swap transaction payload from Jupiter API.');
            }

            const { swapTransaction } = swapResponse.data;

            // 3. Deserialize, sign, and authorize the transaction
            const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
            const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
            
            transaction.sign([this.wallet]);

            // 4. Broadcast the transaction to the Solana network
            console.log('[Swap] Broadcasting transaction to the Solana network...');
            const rawTransaction = transaction.serialize();
            const txid = await this.connection.sendRawTransaction(rawTransaction, {
                skipPreflight: false,
                maxRetries: 3
            });

            console.log(`[Swap] Transaction broadcasted! Track on Solscan: https://solscan.io/tx/${txid}`);

            // 5. Await network confirmation
            const latestBlockHash = await this.connection.getLatestBlockhash();
            await this.connection.confirmTransaction({
                signature: txid,
                blockhash: latestBlockHash.blockhash,
                lastValidBlockHeight: latestBlockHash.lastValidBlockHeight
            }, 'confirmed');

            console.log(`[Swap] Transaction successfully confirmed on-chain!`);
            return txid;

        } catch (error) {
            console.error('[Swap Error] Execution failed:', error.response?.data || error.message);
            throw error;
        }
    }
}

async function main() {
    try {
        const bot = new SolanaTradingBot();

        // 1. Verify sufficient balance for gas and operations
        const balance = await bot.getWalletBalance();
        
        if (balance < 0.01) {
            console.log('[Warning] Wallet balance is too low. Please fund your wallet with SOL to cover network gas fees.');
            return;
        }

        // Official token mint addresses on Solana network
        const SOL_MINT = 'So11111111111111111111111111111111111111112';
        const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

        // Example execution: Swap 0.001 SOL (amount must be in lamports: 0.001 * 10^9 = 1000000)
        // Uncomment the line below when you are ready to execute real trades with live funds
        // await bot.executeSwap(SOL_MINT, USDC_MINT, 1000000, 50);

    } catch (err) {
        console.error('Application execution failed:', err);
    }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
    main();
}

export default SolanaTradingBot;
