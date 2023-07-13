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
        const POOL_TOKEN_AMOUNT = 10000000;
        // ### Get Swap Pool Authority
        const [swapAuthority] = web3.PublicKey.findProgramAddressSync([configs_1.amm.publicKey.toBuffer()], configs_1.MY_SWAP_PROGRAM_ID);
        const [tokenAAccountAddress] = yield (0, configs_1.getTokenAccountCreateInstruction)(configs_1.tokenAMint, swapAuthority, configs_1.payer.publicKey); // Pool A
        const [tokenBAccountAddress] = yield (0, configs_1.getTokenAccountCreateInstruction)(configs_1.tokenBMint, swapAuthority, configs_1.payer.publicKey); // Pool B
        const [poolMintInfo, swapTokenA, swapTokenB] = yield Promise.all([
            (0, spl_token_1.getMint)(configs_1.connection, configs_1.poolMint),
            (0, spl_token_1.getAccount)(configs_1.connection, tokenAAccountAddress),
            (0, spl_token_1.getAccount)(configs_1.connection, tokenBAccountAddress),
        ]);
        console.log("🚀 ~ file: provide_liquidity.ts:83 ~ main ~ tokenAAccountAddress:", tokenAAccountAddress);
        console.log("🚀 ~ file: provide_liquidity.ts:84 ~ main ~ tokenBAccountAddress:", tokenBAccountAddress);
        const supply = new anchor.BN(poolMintInfo.supply.toString()).toNumber(); // 1000000000, 10000000
        const tokenAAmount = Math.floor((new anchor.BN(swapTokenA.amount.toString()).toNumber() * POOL_TOKEN_AMOUNT) / supply);
        console.log("🚀 ~ file: provide_liquidity.ts:92 ~ main ~ tokenAAmount:", tokenAAmount);
        const tokenBAmount = Math.floor((new anchor.BN(swapTokenB.amount.toString()).toNumber() * POOL_TOKEN_AMOUNT) / supply);
        console.log("🚀 ~ file: provide_liquidity.ts:96 ~ main ~ tokenBAmount:", tokenBAmount);
        const initialAccountTx = new web3.Transaction();
        const [tokenAUserAccountAddress, taci] = yield (0, configs_1.getTokenAccountCreateInstruction)(configs_1.tokenAMint, configs_1.user.publicKey, configs_1.payer.publicKey);
        const [tokenBUserAccountAddress, tbci] = yield (0, configs_1.getTokenAccountCreateInstruction)(configs_1.tokenBMint, configs_1.user.publicKey, configs_1.payer.publicKey);
        const [tokenPoolUserAccountAddress, tfci] = yield (0, configs_1.getTokenAccountCreateInstruction)(configs_1.poolMint, configs_1.user.publicKey, configs_1.payer.publicKey);
        initialAccountTx.add(tfci);
        // const init = await connection.sendTransaction(initialAccountTx, [payer]);
        // console.log("🚀 ~ file: index.ts:113 ~ main ~ init:", init)
        // await mintTo(connection, payer, tokenAMint, tokenAUserAccountAddress, payer, tokenAAmount);
        // await approve(
        //   connection, payer,
        //   tokenAUserAccountAddress,
        //   userTransferAuthority.publicKey,
        //   user,
        //   tokenAAmount
        // );
        // const sendWrapSolTx = await connection.sendTransaction(new web3.Transaction().add(
        //   web3.SystemProgram.transfer({
        //     fromPubkey: payer.publicKey,
        //     toPubkey: tokenBUserAccountAddress,
        //     lamports: tokenBAmount,
        //   }),
        //   createSyncNativeInstruction(tokenBUserAccountAddress),
        // ), [payer]);
        // await approve(
        //   connection, payer,
        //   tokenBUserAccountAddress,
        //   userTransferAuthority.publicKey,
        //   user,
        //   tokenBAmount
        // );
        // Deposit
        const tx = yield configs_1.program.methods.depositAllTokenTypes(new anchor.BN(POOL_TOKEN_AMOUNT), new anchor.BN(tokenAAmount), new anchor.BN(tokenBAmount + 1e8)).accounts({
            amm: configs_1.amm.publicKey,
            swapAuthority: swapAuthority,
            userTransferAuthorityInfo: configs_1.userTransferAuthority.publicKey,
            sourceAInfo: tokenAUserAccountAddress,
            sourceBInfo: tokenBUserAccountAddress,
            tokenAAccount: tokenAAccountAddress,
            tokenBAccount: tokenBAccountAddress,
            poolMint: configs_1.poolMint,
            destination: tokenPoolUserAccountAddress,
            tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
        }).signers([configs_1.userTransferAuthority]).rpc();
        console.log("🚀 ~ file: provide_liquidity.ts:152 ~ main ~ tx:", tx);
    });
}
main();