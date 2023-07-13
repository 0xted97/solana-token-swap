import * as fs from "fs";
import * as web3 from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import { NATIVE_MINT, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress } from "@solana/spl-token";
import SolanaSwap from "./solana_swap.json";



export const payer = web3.Keypair.fromSecretKey(new Uint8Array([
  64, 234, 35, 93, 29, 252, 39, 34, 173, 40, 108, 255, 62, 67, 139, 163, 131,
  51, 67, 254, 90, 226, 255, 206, 171, 188, 223, 7, 34, 238, 16, 226, 145, 246,
  14, 109, 126, 163, 206, 135, 187, 156, 138, 27, 217, 250, 158, 110, 111, 181,
  223, 253, 214, 5, 198, 48, 84, 121, 247, 161, 66, 136, 91, 216,
]));
export const owner = loadKeyPair("ownyQHDpiCCNdMtTQW5YSg2ALN1NenHk2h2qLJr9nki.json");
export const MY_SWAP_PROGRAM_ID = new web3.PublicKey("9CcZgrQxu4UE72Z7DqFxoGxkhicvqKNWmNbThtPRz62a");
export const tokenAMint = new web3.PublicKey(
  "To9y3LHENHDU4tU78ockkSZwVuxfvtgbSKPjqjXrNYt"
);
export const tokenBMint = NATIVE_MINT;

export const poolMint = new web3.PublicKey(
  "LPT41r7miPn1yce9n9iLS45tfaxhPQcETZgqFSVTTMp"
);
export const feeOwner = new web3.PublicKey(
  "HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN"
);
export const amm = loadKeyPair(
  "AmmfCddqsSFYvyrsXYSYmvEQzStUg4Vi74ZJoSkdDsvC.json"
);

export const user = loadKeyPair("BobgjoUo9hYyArX3RDDzSCyXCR5nJqogXDZ54NsG4UWj.json");
export const userTransferAuthority = loadKeyPair("Tempu59XExtLkUfbsUYzrhyGHAbRLW8HnyinZrsu53r.json");

export const connection = new web3.Connection(web3.clusterApiUrl("devnet"));
export const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(payer), {});
export const program = new anchor.Program(SolanaSwap as anchor.Idl, MY_SWAP_PROGRAM_ID, provider);

export async function getTokenAccountCreateInstruction(
  mint: web3.PublicKey,
  owner: web3.PublicKey,
  payer: web3.PublicKey
): Promise<[web3.PublicKey, web3.TransactionInstruction]> {
  let tokenAccountAddress = await getAssociatedTokenAddress(
    mint, // mint
    owner, // owner
    true // allow owner off curve
  );

  const tokenAccountInstruction = createAssociatedTokenAccountInstruction(
    payer, // payer
    tokenAccountAddress, // ata
    owner, // owner
    mint // mint
  );
  return [tokenAccountAddress, tokenAccountInstruction];
}

export function loadKeyPair(filename: string): web3.Keypair {
  const secret = JSON.parse(fs.readFileSync(filename).toString()) as number[];
  const secretKey = web3.Keypair.fromSecretKey(Uint8Array.from(secret));
  return secretKey;
}