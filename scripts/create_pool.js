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
const web3 = __importStar(require("@solana/web3.js"));
const anchor = __importStar(require("@project-serum/anchor"));
const spl_token_1 = require("@solana/spl-token");
const configs_1 = require("./configs");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        let currentSwapTokenA = 50 * 1e9;
        let currentSwapTokenB = 0.5 * 1e9;
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
        const transaction = new web3.Transaction();
        const amm = (0, configs_1.loadKeyPair)("AmmfCddqsSFYvyrsXYSYmvEQzStUg4Vi74ZJoSkdDsvC.json");
        // Setup pool
        // ### Get Swap Pool Authority
        const [swapAuthority, bump] = web3.PublicKey.findProgramAddressSync([amm.publicKey.toBuffer()], configs_1.MY_SWAP_PROGRAM_ID);
        const initialAccountTx = new web3.Transaction();
        const [tokenAccountPoolAddress, tpaci] = yield (0, configs_1.getTokenAccountCreateInstruction)(configs_1.poolMint, configs_1.owner.publicKey, configs_1.payer.publicKey);
        initialAccountTx.add(tpaci);
        const [tokenAAccountAddress, taci] = yield (0, configs_1.getTokenAccountCreateInstruction)(configs_1.tokenAMint, swapAuthority, configs_1.payer.publicKey);
        const [tokenBAccountAddress, tbci] = yield (0, configs_1.getTokenAccountCreateInstruction)(configs_1.tokenBMint, swapAuthority, configs_1.payer.publicKey);
        initialAccountTx.add(taci, tbci);
        // ### Pool Fee token
        const [tokenFeeAccountAddress, tfaci] = yield (0, configs_1.getTokenAccountCreateInstruction)(configs_1.poolMint, configs_1.feeOwner, configs_1.payer.publicKey);
        initialAccountTx.add(tfaci);
        // Cmt this after create accounts
        // const init = await connection.sendTransaction(initialAccountTx, [payer]);
        // console.log("🚀 ~ file: index.ts:113 ~ main ~ init:", init)
        // ### Mint to
        const mintATx = yield (0, spl_token_1.mintTo)(configs_1.connection, configs_1.payer, configs_1.tokenAMint, tokenAAccountAddress, configs_1.payer, currentSwapTokenA);
        console.log("🚀 ~ file: index.ts:125 ~ main ~ mintATx:", mintATx);
        const sendWrapSolTx = yield configs_1.connection.sendTransaction(new web3.Transaction().add(web3.SystemProgram.transfer({
            fromPubkey: configs_1.payer.publicKey,
            toPubkey: tokenBAccountAddress,
            lamports: currentSwapTokenB,
        }), (0, spl_token_1.createSyncNativeInstruction)(tokenBAccountAddress)), [configs_1.payer]);
        console.log("🚀 ~ file: index.ts:133 ~ main ~ sendWrapSolTx:", sendWrapSolTx);
        // ### Init swap pool
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
        const tx = yield configs_1.program.methods
            .setupPool(fees_input, new anchor.BN(constant_price))
            .accounts({
            amm: amm.publicKey,
            poolMint: configs_1.poolMint,
            swapAuthority: swapAuthority,
            tokenAAccount: tokenAAccountAddress,
            tokenBAccount: tokenBAccountAddress,
            feeAccount: tokenFeeAccountAddress,
            destination: tokenAccountPoolAddress,
            tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
        })
            .signers([amm])
            .rpc();
        console.log("🚀 ~ file: index.ts:202 ~ main ~ tx:", tx);
    });
}
main();
