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
        const SWAP_AMOUNT_IN = 200000;
        const SWAP_AMOUNT_OUT = 20000;
        // ### Get Swap Pool Authority
        const [swapAuthority] = web3.PublicKey.findProgramAddressSync([configs_1.amm.publicKey.toBuffer()], configs_1.MY_SWAP_PROGRAM_ID);
        const [tokenFeeAccountAddress, tfci] = yield (0, configs_1.getTokenAccountCreateInstruction)(configs_1.poolMint, configs_1.feeOwner, configs_1.payer.publicKey);
        const [tokenAAccountAddress] = yield (0, configs_1.getTokenAccountCreateInstruction)(configs_1.tokenAMint, swapAuthority, configs_1.payer.publicKey); // Pool A
        const [tokenBAccountAddress] = yield (0, configs_1.getTokenAccountCreateInstruction)(configs_1.tokenBMint, swapAuthority, configs_1.payer.publicKey); // Pool B
        const preTransaction = new web3.Transaction();
        const [tokenAUserAccountAddress, taci] = yield (0, configs_1.getOrCreateAccount)(configs_1.connection, configs_1.tokenAMint, configs_1.user.publicKey, configs_1.payer.publicKey);
        if (taci)
            preTransaction.add(taci);
        const [tokenBUserAccountAddress, tbci] = yield (0, configs_1.getOrCreateAccount)(configs_1.connection, configs_1.tokenBMint, configs_1.user.publicKey, configs_1.payer.publicKey);
        if (tbci)
            preTransaction.add(tbci);
        const mintToInstruction = (0, spl_token_1.createMintToInstruction)(configs_1.tokenAMint, tokenAUserAccountAddress, configs_1.payer.publicKey, SWAP_AMOUNT_IN);
        preTransaction.add(mintToInstruction);
        const approveIx = (0, spl_token_1.createApproveInstruction)(tokenAUserAccountAddress, configs_1.userTransferAuthority.publicKey, // delegate
        configs_1.user.publicKey, SWAP_AMOUNT_IN);
        preTransaction.add(approveIx);
        const tx = yield configs_1.program.methods.swap(new anchor.BN(SWAP_AMOUNT_IN), new anchor.BN(SWAP_AMOUNT_OUT)).accounts({
            swapAuthority: swapAuthority,
            amm: configs_1.amm.publicKey,
            userTransferAuthority: configs_1.userTransferAuthority.publicKey,
            sourceInfo: tokenAUserAccountAddress,
            destinationInfo: tokenBUserAccountAddress,
            swapSource: tokenAAccountAddress,
            swapDestination: tokenBAccountAddress,
            poolMint: configs_1.poolMint,
            feeAccount: tokenFeeAccountAddress,
            tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
            hostFeeAccount: web3.PublicKey.default,
        })
            .signers([configs_1.userTransferAuthority, configs_1.user])
            .preInstructions(preTransaction.instructions)
            .postInstructions([
            (0, spl_token_1.createCloseAccountInstruction)(tokenBUserAccountAddress, configs_1.user.publicKey, configs_1.user.publicKey)
        ])
            .rpc();
        console.log("🚀 ~ Swap Hash:", tx);
    });
}
main();
