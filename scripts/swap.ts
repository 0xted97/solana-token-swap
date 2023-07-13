import * as fs from "fs";
import * as web3 from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import { mintTo, TOKEN_PROGRAM_ID, approve, createCloseAccountInstruction } from "@solana/spl-token";

import {
  loadKeyPair, getTokenAccountCreateInstruction,
  program, connection,
  tokenAMint, tokenBMint, poolMint, MY_SWAP_PROGRAM_ID,
  feeOwner,
  amm,
  owner, payer, user, userTransferAuthority,
} from "./configs";



async function main() {
  const SWAP_AMOUNT_IN = 200000;
  const SWAP_AMOUNT_OUT = 20000;

  // ### Get Swap Pool Authority
  const [swapAuthority] = web3.PublicKey.findProgramAddressSync(
    [amm.publicKey.toBuffer()],
    MY_SWAP_PROGRAM_ID
  );
  const [tokenFeeAccountAddress, tfci] =
    await getTokenAccountCreateInstruction(
      poolMint,
      feeOwner,
      payer.publicKey
    );

  const [tokenAAccountAddress] = await getTokenAccountCreateInstruction(
    tokenAMint,
    swapAuthority,
    payer.publicKey
  ); // Pool A
  const [tokenBAccountAddress] = await getTokenAccountCreateInstruction(
    tokenBMint,
    swapAuthority,
    payer.publicKey
  ); // Pool B

  const [tokenAUserAccountAddress, taci] = await getTokenAccountCreateInstruction(
    tokenAMint,
    user.publicKey,
    payer.publicKey
  );
  const [tokenBUserAccountAddress, tbci] = await getTokenAccountCreateInstruction(
    tokenBMint,
    user.publicKey,
    payer.publicKey
  );

  // Create WSOL Account for User if user Close Account
  const createWSOLTx = new web3.Transaction();
  createWSOLTx.add(tbci);

  const createAccountWSOL = await connection.sendTransaction(createWSOLTx, [payer]);
  console.log("🚀 ~ Create Account Hash:", createAccountWSOL)


  await mintTo(connection, payer, tokenAMint, tokenAUserAccountAddress, payer, SWAP_AMOUNT_IN);

  await approve(
    connection, payer,
    tokenAUserAccountAddress,
    userTransferAuthority.publicKey,
    user,
    SWAP_AMOUNT_IN
  );

  const tx = await program.methods.swap(
    new anchor.BN(SWAP_AMOUNT_IN),
    new anchor.BN(SWAP_AMOUNT_OUT),
  ).accounts({
    swapAuthority: swapAuthority,
    amm: amm.publicKey,
    userTransferAuthority: userTransferAuthority.publicKey,
    sourceInfo: tokenAUserAccountAddress,
    destinationInfo: tokenBUserAccountAddress,
    swapSource: tokenAAccountAddress,
    swapDestination: tokenBAccountAddress,
    poolMint: poolMint,
    feeAccount: tokenFeeAccountAddress,
    tokenProgram: TOKEN_PROGRAM_ID,
    hostFeeAccount: web3.PublicKey.default,
  })
    .signers([userTransferAuthority])
    .rpc();
  console.log("🚀 ~ Swap Hash:", tx)

  // Unwrap SOL for user
  let closeAccountWSOl = new web3.Transaction();
  closeAccountWSOl.add(
    createCloseAccountInstruction(
      tokenBUserAccountAddress,
      user.publicKey,
      user.publicKey,
    )
  );
  closeAccountWSOl.feePayer = payer.publicKey;

  console.log(`Close Hash: ${await connection.sendTransaction(closeAccountWSOl, [payer, user])}`);
}
main();
