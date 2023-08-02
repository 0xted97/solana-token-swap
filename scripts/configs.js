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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateAccount = exports.loadKeyPair = exports.getTokenAccountCreateInstruction = exports.program = exports.provider = exports.connection = exports.userTransferAuthority = exports.user = exports.amm = exports.feeOwner = exports.poolMint = exports.tokenBMint = exports.tokenAMint = exports.MY_SWAP_PROGRAM_ID = exports.owner = exports.payer = void 0;
const fs = __importStar(require("fs"));
const web3 = __importStar(require("@solana/web3.js"));
const anchor = __importStar(require("@project-serum/anchor"));
const spl_token_1 = require("@solana/spl-token");
const solana_swap_json_1 = __importDefault(require("./solana_swap.json"));
exports.payer = web3.Keypair.fromSecretKey(new Uint8Array([
    64, 234, 35, 93, 29, 252, 39, 34, 173, 40, 108, 255, 62, 67, 139, 163, 131,
    51, 67, 254, 90, 226, 255, 206, 171, 188, 223, 7, 34, 238, 16, 226, 145, 246,
    14, 109, 126, 163, 206, 135, 187, 156, 138, 27, 217, 250, 158, 110, 111, 181,
    223, 253, 214, 5, 198, 48, 84, 121, 247, 161, 66, 136, 91, 216,
]));
console.log("🚀 ~ file: configs.ts:15 ~ payer:", exports.payer.publicKey.toString());
exports.owner = loadKeyPair("ownyQHDpiCCNdMtTQW5YSg2ALN1NenHk2h2qLJr9nki.json");
exports.MY_SWAP_PROGRAM_ID = new web3.PublicKey("9CcZgrQxu4UE72Z7DqFxoGxkhicvqKNWmNbThtPRz62a");
exports.tokenAMint = new web3.PublicKey("To9y3LHENHDU4tU78ockkSZwVuxfvtgbSKPjqjXrNYt");
exports.tokenBMint = spl_token_1.NATIVE_MINT;
exports.poolMint = new web3.PublicKey("LPT41r7miPn1yce9n9iLS45tfaxhPQcETZgqFSVTTMp");
exports.feeOwner = new web3.PublicKey("HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN");
exports.amm = loadKeyPair("AmmfCddqsSFYvyrsXYSYmvEQzStUg4Vi74ZJoSkdDsvC.json");
exports.user = loadKeyPair("BobgjoUo9hYyArX3RDDzSCyXCR5nJqogXDZ54NsG4UWj.json");
exports.userTransferAuthority = loadKeyPair("Tempu59XExtLkUfbsUYzrhyGHAbRLW8HnyinZrsu53r.json");
exports.connection = new web3.Connection(web3.clusterApiUrl("devnet"));
exports.provider = new anchor.AnchorProvider(exports.connection, new anchor.Wallet(exports.payer), {});
exports.program = new anchor.Program(solana_swap_json_1.default, exports.MY_SWAP_PROGRAM_ID, exports.provider);
function getTokenAccountCreateInstruction(mint, owner, payer) {
    return __awaiter(this, void 0, void 0, function* () {
        let tokenAccountAddress = yield (0, spl_token_1.getAssociatedTokenAddress)(mint, // mint
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
exports.getTokenAccountCreateInstruction = getTokenAccountCreateInstruction;
function loadKeyPair(filename) {
    const secret = JSON.parse(fs.readFileSync(filename).toString());
    const secretKey = web3.Keypair.fromSecretKey(Uint8Array.from(secret));
    return secretKey;
}
exports.loadKeyPair = loadKeyPair;
const getOrCreateAccount = (connection, mint, owner, payer) => __awaiter(void 0, void 0, void 0, function* () {
    let tokenAccountAddress = yield (0, spl_token_1.getAssociatedTokenAddress)(mint, owner, true);
    const tokenAccountInstruction = (0, spl_token_1.createAssociatedTokenAccountInstruction)(payer, tokenAccountAddress, owner, mint);
    try {
        // Check account created?
        yield (0, spl_token_1.getAccount)(connection, tokenAccountAddress);
        return [tokenAccountAddress, null];
    }
    catch (error) {
        return [tokenAccountAddress, tokenAccountInstruction];
    }
});
exports.getOrCreateAccount = getOrCreateAccount;
