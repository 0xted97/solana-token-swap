import * as fs from "fs";
import * as web3 from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import { mintTo, TOKEN_PROGRAM_ID, approve, createCloseAccountInstruction, createMintToInstruction, createApproveInstruction } from "@solana/spl-token";

import {
  loadKeyPair, getTokenAccountCreateInstruction,
  program, connection,
  tokenAMint, tokenBMint, poolMint, MY_SWAP_PROGRAM_ID,
  feeOwner,
  amm,
  owner, payer, user, userTransferAuthority, getOrCreateAccount,
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

  const preTransaction = new web3.Transaction();


  const [tokenAUserAccountAddress, taci] = await getOrCreateAccount(
    connection,
    tokenAMint,
    user.publicKey,
    payer.publicKey
  );
  if (taci) preTransaction.add(taci);
  const [tokenBUserAccountAddress, tbci] = await getOrCreateAccount(
    connection,
    tokenBMint,
    user.publicKey,
    payer.publicKey
  );
  if (tbci) preTransaction.add(tbci);


  const mintToInstruction = createMintToInstruction(tokenAMint, tokenAUserAccountAddress, payer.publicKey, SWAP_AMOUNT_IN);
  preTransaction.add(mintToInstruction);

  const approveIx = createApproveInstruction(
    tokenAUserAccountAddress,
    userTransferAuthority.publicKey, // delegate
    user.publicKey,
    SWAP_AMOUNT_IN,
  );
  preTransaction.add(approveIx);


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
    .signers([userTransferAuthority, user])
    .preInstructions(preTransaction.instructions)
    .postInstructions([
      createCloseAccountInstruction(
        tokenBUserAccountAddress,
        user.publicKey,
        user.publicKey,
      )
    ])
    .rpc();
  console.log("🚀 ~ Swap Hash:", tx)
}
main();
