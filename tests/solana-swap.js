"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const anchor = __importStar(require("@coral-xyz/anchor"));
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const chai_1 = require("chai");
const CurveType = Object.freeze({
    ConstantPrice: 1,
});
function getTokenAccountCreateInstruction(mint, owner, payer) {
    return __awaiter(this, void 0, void 0, function* () {
        let tokenAccountAddress = (0, spl_token_1.getAssociatedTokenAddressSync)(mint, // mint
        owner, // owner
        true // allow owner off curve
        );
        const tokenAccountInstruction = (0, spl_token_1.createAssociatedTokenAccountInstruction)(payer, // payer
        tokenAccountAddress, // ata
        owner, // owner
        mint // mint
        );
        return [tokenAccountAddress, tokenAccountInstruction];
    });
}
describe("solana-swap", () => {
    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());
    const program = anchor.workspace.SolanaSwap;
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const { connection } = provider;
    // Generate account
    const payer = anchor.web3.Keypair.fromSecretKey(new Uint8Array([
        64, 234, 35, 93, 29, 252, 39, 34, 173, 40, 108, 255, 62, 67, 139, 163, 131,
        51, 67, 254, 90, 226, 255, 206, 171, 188, 223, 7, 34, 238, 16, 226, 145, 246,
        14, 109, 126, 163, 206, 135, 187, 156, 138, 27, 217, 250, 158, 110, 111, 181,
        223, 253, 214, 5, 198, 48, 84, 121, 247, 161, 66, 136, 91, 216
    ]));
    const ammAccount = anchor.web3.Keypair.generate();
    const owner = anchor.web3.Keypair.generate();
    const feeOwner = new anchor.web3.PublicKey("HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN");
    let authority;
    let bumpSeed;
    let tokenPool = anchor.web3.Keypair.generate().publicKey;
    let tokenAccountPool;
    let feeAccount;
    const SWAP_PROGRAM_OWNER_FEE_ADDRESS = process.env.SWAP_PROGRAM_OWNER_FEE_ADDRESS;
    let mintA;
    let mintB;
    let tokenAccountA;
    let tokenAccountB;
    // Pool fees & Curve
    let constant_price = 10;
    const TRADING_FEE_NUMERATOR = 0;
    const TRADING_FEE_DENOMINATOR = 1;
    const OWNER_TRADING_FEE_NUMERATOR = 0;
    const OWNER_TRADING_FEE_DENOMINATOR = 1;
    const OWNER_WITHDRAW_FEE_NUMERATOR = 0;
    const OWNER_WITHDRAW_FEE_DENOMINATOR = 1;
    const HOST_FEE_NUMERATOR = 0;
    const HOST_FEE_DENOMINATOR = 1;
    // Initial amount in each swap token
    let currentSwapTokenA = 10 * 1e9;
    let currentSwapTokenB = 1 * 1e9;
    let currentFeeAmount = 0;
    const SWAP_FEE = 0;
    const HOST_SWAP_FEE = 0;
    const SWAP_AMOUNT_IN = 100000;
    const SWAP_AMOUNT_OUT = 10000;
    const OWNER_SWAP_FEE = 0;
    const POOL_TOKEN_AMOUNT = 10000000;
    const DEFAULT_POOL_TOKEN_AMOUNT = 1000000000;
    before(() => __awaiter(void 0, void 0, void 0, function* () {
        yield provider.connection.confirmTransaction(yield provider.connection.requestAirdrop(payer.publicKey, 100000 * web3_js_1.LAMPORTS_PER_SOL), "confirmed");
        // await provider.connection.confirmTransaction(
        //   await provider.connection.requestAirdrop(
        //     owner.publicKey,
        //     100000 * LAMPORTS_PER_SOL
        //   ),
        //   "confirmed"
        // );
        const found = web3_js_1.PublicKey.findProgramAddressSync([ammAccount.publicKey.toBuffer()], program.programId);
        authority = found[0];
        bumpSeed = found[1];
        // Create WRAP SOL
        // Create Pool Mint & Token Account Pool
        tokenPool = yield (0, spl_token_1.createMint)(connection, payer, authority, null, 9);
        const transCreateTokenAccount = new web3_js_1.Transaction();
        tokenAccountPool = (0, spl_token_1.getAssociatedTokenAddressSync)(tokenPool, owner.publicKey, true);
        transCreateTokenAccount.add((0, spl_token_1.createAssociatedTokenAccountInstruction)(payer.publicKey, tokenAccountPool, owner.publicKey, tokenPool));
        const ownerKey = SWAP_PROGRAM_OWNER_FEE_ADDRESS || owner.publicKey.toString();
        feeAccount = yield (0, spl_token_1.createAccount)(connection, payer, tokenPool, new web3_js_1.PublicKey(ownerKey), anchor.web3.Keypair.generate());
        // transCreateTokenAccount.add(
        //   createAssociatedTokenAccountInstruction(
        //     payer.publicKey,
        //     feeAccount,
        //     new PublicKey(ownerKey),
        //     tokenPool
        //   )
        // );
        // Create WSOL and Move Mint
        mintA = yield (0, spl_token_1.createMint)(provider.connection, payer, owner.publicKey, null, 9);
        mintB = spl_token_1.NATIVE_MINT;
        // Create Token Account WSOL and Move
        let AToken = yield getTokenAccountCreateInstruction(mintA, authority, payer.publicKey);
        tokenAccountA = AToken[0];
        let BToken = yield getTokenAccountCreateInstruction(mintB, authority, payer.publicKey);
        tokenAccountB = BToken[0];
        transCreateTokenAccount.add(AToken[1], BToken[1]);
        const tx = yield provider.sendAndConfirm(transCreateTokenAccount, [payer]);
        yield (0, spl_token_1.mintTo)(provider.connection, payer, mintA, tokenAccountA, owner, currentSwapTokenA);
        const solTransferTransaction = new web3_js_1.Transaction();
        solTransferTransaction.add(web3_js_1.SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: tokenAccountB,
            lamports: currentSwapTokenB,
        }), (0, spl_token_1.createSyncNativeInstruction)(tokenAccountB));
        yield provider.sendAndConfirm(solTransferTransaction, [payer]);
    }));
    describe("Setup pool", () => __awaiter(void 0, void 0, void 0, function* () {
        it("Is setup pool!", () => __awaiter(void 0, void 0, void 0, function* () {
            const fees_input = {
                tradeFeeNumerator: new anchor.BN(TRADING_FEE_NUMERATOR),
                tradeFeeDenominator: new anchor.BN(TRADING_FEE_DENOMINATOR),
                ownerTradeFeeNumerator: new anchor.BN(OWNER_TRADING_FEE_NUMERATOR),
                ownerTradeFeeDenominator: new anchor.BN(OWNER_TRADING_FEE_DENOMINATOR),
                ownerWithdrawFeeNumerator: new anchor.BN(OWNER_WITHDRAW_FEE_NUMERATOR),
                ownerWithdrawFeeDenominator: new anchor.BN(OWNER_WITHDRAW_FEE_DENOMINATOR),
                hostFeeNumerator: new anchor.BN(HOST_FEE_NUMERATOR),
                hostFeeDenominator: new anchor.BN(HOST_FEE_DENOMINATOR),
            };
            // Add your test here.
            const tx = yield program.methods
                .setupPool(fees_input, new anchor.BN(constant_price))
                .accounts({
                amm: ammAccount.publicKey,
                poolMint: tokenPool,
                swapAuthority: authority,
                tokenAAccount: tokenAccountA,
                tokenBAccount: tokenAccountB,
                feeAccount: feeAccount,
                destination: tokenAccountPool,
                tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
                systemProgram: web3_js_1.SystemProgram.programId,
            })
                .signers([ammAccount])
                .rpc();
            const amm = yield program.account.amm.fetch(ammAccount.publicKey);
            (0, chai_1.assert)(amm.tokenProgramId.equals(spl_token_1.TOKEN_PROGRAM_ID));
            (0, chai_1.assert)(amm.poolMint.equals(tokenPool));
            (0, chai_1.assert)(amm.tokenAMint.equals(mintA));
            (0, chai_1.assert)(amm.tokenBMint.equals(mintB));
            (0, chai_1.assert)(amm.tokenAAccount.equals(tokenAccountA));
            (0, chai_1.assert)(amm.tokenBAccount.equals(tokenAccountB));
            (0, chai_1.assert)(amm.constantPrice == amm.constantPrice);
            // Check some fees_input
        }));
    }));
    describe("", () => __awaiter(void 0, void 0, void 0, function* () {
        it("it DepositAllTokenTypes Success", () => __awaiter(void 0, void 0, void 0, function* () {
            const [poolMintInfo, swapTokenA, swapTokenB] = yield Promise.all([
                (0, spl_token_1.getMint)(connection, tokenPool),
                (0, spl_token_1.getAccount)(connection, tokenAccountA),
                (0, spl_token_1.getAccount)(connection, tokenAccountB),
            ]);
            const supply = new anchor.BN(poolMintInfo.supply.toString()).toNumber();
            const tokenAAmount = Math.floor((new anchor.BN(swapTokenA.amount.toString()).toNumber() * POOL_TOKEN_AMOUNT) / supply);
            const tokenBAmount = Math.floor((new anchor.BN(swapTokenB.amount.toString()).toNumber() * POOL_TOKEN_AMOUNT) / supply);
            const userTransferAuthority = anchor.web3.Keypair.generate();
            // Creating depositor token a account
            // SPL-Token
            const userAccountA = yield (0, spl_token_1.createAccount)(connection, payer, mintA, owner.publicKey);
            yield (0, spl_token_1.mintTo)(connection, payer, mintA, userAccountA, owner, tokenAAmount);
            yield (0, spl_token_1.approve)(connection, payer, userAccountA, userTransferAuthority.publicKey, owner, tokenAAmount);
            // W-SOL
            const userAccountB = yield (0, spl_token_1.createAccount)(connection, payer, mintB, owner.publicKey);
            console.log("🚀 ~ file: solana-swap.ts:313 ~ it ~ userAccountB:", userAccountB);
            yield provider.sendAndConfirm(new web3_js_1.Transaction().add(web3_js_1.SystemProgram.transfer({
                fromPubkey: payer.publicKey,
                toPubkey: userAccountB,
                lamports: tokenBAmount,
            }), (0, spl_token_1.createSyncNativeInstruction)(userAccountB)), [payer]);
            yield (0, spl_token_1.approve)(connection, payer, userAccountB, userTransferAuthority.publicKey, owner, tokenBAmount);
            // Creating depositor pool token account
            const newAccountPool = yield (0, spl_token_1.createAccount)(connection, payer, tokenPool, owner.publicKey, anchor.web3.Keypair.generate());
            console.log("🚀 ~ file: solana-swap.ts:324 ~ it ~ supply:", supply);
            console.log("🚀 ~ file: solana-swap.ts:338 ~ it ~ tokenAAmount:", tokenAAmount);
            console.log("🚀 ~ file: solana-swap.ts:340 ~ it ~ tokenBAmount:", tokenBAmount);
            console.log("🚀 ~ file: solana-swap.ts:330 ~ it ~ POOL_TOKEN_AMOUNT:", POOL_TOKEN_AMOUNT);
            // Deposit
            const tx = yield program.methods.depositAllTokenTypes(new anchor.BN(POOL_TOKEN_AMOUNT), new anchor.BN(tokenAAmount), new anchor.BN(tokenBAmount)).accounts({
                amm: ammAccount.publicKey,
                swapAuthority: authority,
                userTransferAuthorityInfo: userTransferAuthority.publicKey,
                sourceAInfo: userAccountA,
                sourceBInfo: userAccountB,
                tokenAAccount: tokenAccountA,
                tokenBAccount: tokenAccountB,
                poolMint: tokenPool,
                destination: newAccountPool,
                tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
            }).signers([userTransferAuthority]).rpc();
            console.log("🚀 ~ file: solana-swap.ts:345 ~ it ~ tx:", tx);
            let info;
            info = yield (0, spl_token_1.getAccount)(connection, userAccountA);
            console.log("🚀 ~ file: solana-swap.ts:354 ~ it ~ info:", info);
            (0, chai_1.assert)(info.amount == 0);
            info = yield (0, spl_token_1.getAccount)(connection, userAccountB);
            (0, chai_1.assert)(info.amount == 0);
            info = yield (0, spl_token_1.getAccount)(connection, tokenAccountA);
            (0, chai_1.assert)(info.amount == currentSwapTokenA + tokenAAmount);
            currentSwapTokenA += tokenAAmount;
            info = yield (0, spl_token_1.getAccount)(connection, tokenAccountB);
            (0, chai_1.assert)(info.amount == currentSwapTokenB + tokenBAmount);
            currentSwapTokenB += tokenBAmount;
            info = yield (0, spl_token_1.getAccount)(connection, newAccountPool);
            (0, chai_1.assert)(info.amount == POOL_TOKEN_AMOUNT);
        }));
    }));
    describe("Swap", () => __awaiter(void 0, void 0, void 0, function* () {
        it("Swap success", () => __awaiter(void 0, void 0, void 0, function* () {
            const userTransferAuthority = anchor.web3.Keypair.generate();
            const user = anchor.web3.Keypair.generate();
            const userAccountA = yield (0, spl_token_1.createAccount)(connection, payer, mintA, user.publicKey);
            yield (0, spl_token_1.mintTo)(connection, payer, mintA, userAccountA, owner, SWAP_AMOUNT_IN);
            yield (0, spl_token_1.approve)(connection, payer, userAccountA, userTransferAuthority.publicKey, user, SWAP_AMOUNT_IN);
            let userAccountB = yield (0, spl_token_1.createAccount)(connection, payer, mintB, user.publicKey);
            let poolAccount = SWAP_PROGRAM_OWNER_FEE_ADDRESS
                ? yield (0, spl_token_1.createAccount)(connection, payer, tokenPool, user.publicKey)
                : web3_js_1.PublicKey.default;
            const tx = yield program.methods.swap(new anchor.BN(SWAP_AMOUNT_IN), new anchor.BN(SWAP_AMOUNT_OUT)).accounts({
                swapAuthority: authority,
                amm: ammAccount.publicKey,
                userTransferAuthority: userTransferAuthority.publicKey,
                sourceInfo: userAccountA,
                destinationInfo: userAccountB,
                swapSource: tokenAccountA,
                swapDestination: tokenAccountB,
                poolMint: tokenPool,
                feeAccount: feeAccount,
                tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
                hostFeeAccount: web3_js_1.PublicKey.default,
            })
                .signers([userTransferAuthority])
                .rpc();
            let info;
            info = yield (0, spl_token_1.getAccount)(connection, userAccountA);
            (0, chai_1.assert)(info.amount == 0);
            info = yield (0, spl_token_1.getAccount)(connection, userAccountB);
            (0, chai_1.assert)(info.amount == SWAP_AMOUNT_OUT);
            info = yield (0, spl_token_1.getAccount)(connection, tokenAccountA);
            (0, chai_1.assert)(info.amount == currentSwapTokenA + SWAP_AMOUNT_IN);
            currentSwapTokenA += SWAP_AMOUNT_IN;
            info = yield (0, spl_token_1.getAccount)(connection, tokenAccountB);
            (0, chai_1.assert)(info.amount == currentSwapTokenB - SWAP_AMOUNT_OUT);
            currentSwapTokenB -= SWAP_AMOUNT_OUT;
            // info = await getAccount(connection, tokenAccountPool);
            // assert(
            //   info.amount == DEFAULT_POOL_TOKEN_AMOUNT - POOL_TOKEN_AMOUNT
            // );
            info = yield (0, spl_token_1.getAccount)(connection, feeAccount);
            (0, chai_1.assert)(info.amount == currentFeeAmount + OWNER_SWAP_FEE);
            if (poolAccount != web3_js_1.PublicKey.default) {
                info = yield (0, spl_token_1.getAccount)(connection, poolAccount);
                (0, chai_1.assert)(info.amount == HOST_SWAP_FEE);
            }
        }));
        it("Swap success 123", () => __awaiter(void 0, void 0, void 0, function* () {
            const userTransferAuthority = anchor.web3.Keypair.generate();
            const user = anchor.web3.Keypair.generate();
            const userAccountA = yield (0, spl_token_1.createAccount)(connection, payer, mintA, user.publicKey);
            yield (0, spl_token_1.mintTo)(connection, payer, mintA, userAccountA, owner, SWAP_AMOUNT_IN);
            yield (0, spl_token_1.approve)(connection, payer, userAccountA, userTransferAuthority.publicKey, user, SWAP_AMOUNT_IN);
            let userAccountB = yield (0, spl_token_1.createAccount)(connection, payer, mintB, user.publicKey);
            let poolAccount = SWAP_PROGRAM_OWNER_FEE_ADDRESS
                ? yield (0, spl_token_1.createAccount)(connection, payer, tokenPool, user.publicKey)
                : web3_js_1.PublicKey.default;
            const tx = yield program.methods.swap(new anchor.BN(SWAP_AMOUNT_IN), new anchor.BN(SWAP_AMOUNT_OUT)).accounts({
                swapAuthority: authority,
                amm: ammAccount.publicKey,
                userTransferAuthority: userTransferAuthority.publicKey,
                sourceInfo: userAccountA,
                destinationInfo: userAccountB,
                swapSource: tokenAccountA,
                swapDestination: tokenAccountB,
                poolMint: tokenPool,
                feeAccount: feeAccount,
                tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
                hostFeeAccount: web3_js_1.PublicKey.default,
            })
                .signers([userTransferAuthority])
                .rpc();
            let info;
            info = yield (0, spl_token_1.getAccount)(connection, userAccountA);
            (0, chai_1.assert)(info.amount == 0);
            info = yield (0, spl_token_1.getAccount)(connection, userAccountB);
            (0, chai_1.assert)(info.amount == SWAP_AMOUNT_OUT);
            info = yield (0, spl_token_1.getAccount)(connection, tokenAccountA);
            (0, chai_1.assert)(info.amount == currentSwapTokenA + SWAP_AMOUNT_IN);
            currentSwapTokenA += SWAP_AMOUNT_IN;
            info = yield (0, spl_token_1.getAccount)(connection, tokenAccountB);
            (0, chai_1.assert)(info.amount == currentSwapTokenB - SWAP_AMOUNT_OUT);
            currentSwapTokenB -= SWAP_AMOUNT_OUT;
            // info = await getAccount(connection, tokenAccountPool);
            // assert(
            //   info.amount == DEFAULT_POOL_TOKEN_AMOUNT - POOL_TOKEN_AMOUNT
            // );
            info = yield (0, spl_token_1.getAccount)(connection, feeAccount);
            (0, chai_1.assert)(info.amount == currentFeeAmount + OWNER_SWAP_FEE);
            if (poolAccount != web3_js_1.PublicKey.default) {
                info = yield (0, spl_token_1.getAccount)(connection, poolAccount);
                (0, chai_1.assert)(info.amount == HOST_SWAP_FEE);
            }
        }));
    }));
});
