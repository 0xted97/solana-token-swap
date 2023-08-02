import * as web3 from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID, getMint, getAccount, mintTo, approve, createSyncNativeInstruction, createMintToInstruction, createApproveInstruction, } from "@solana/spl-token";
import {
  loadKeyPair, getTokenAccountCreateInstruction,
  program, connection,
  tokenAMint, tokenBMint, poolMint, MY_SWAP_PROGRAM_ID,
  amm,
  owner, payer, user, userTransferAuthority, getOrCreateAccount,
} from "./configs";

async function main() {
  const defaultSlippage = 0.5;
  const POOL_TOKEN_AMOUNT = 100000;

  // ### Get Swap Pool Authority
  const [swapAuthority] = web3.PublicKey.findProgramAddressSync(
    [amm.publicKey.toBuffer()],
    MY_SWAP_PROGRAM_ID
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

  const [poolMintInfo, swapTokenA, swapTokenB] = await Promise.all([
    getMint(connection, poolMint),
    getAccount(connection, tokenAAccountAddress),
    getAccount(connection, tokenBAccountAddress),
  ]);
  const supply = new anchor.BN(poolMintInfo.supply.toString()).toNumber(); // 1000000000, 10000000

  let tokenAAmount = Math.floor(
    (new anchor.BN(swapTokenA.amount.toString()).toNumber() * POOL_TOKEN_AMOUNT) / supply
  );
  tokenAAmount = tokenAAmount + (defaultSlippage * tokenAAmount)
  
  let tokenBAmount = Math.floor(
    (new anchor.BN(swapTokenB.amount.toString()).toNumber() * POOL_TOKEN_AMOUNT) / supply
  );
  tokenBAmount = tokenBAmount + (defaultSlippage * tokenBAmount)


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

  const [tokenPoolUserAccountAddress, tfci] = await getOrCreateAccount(
    connection,
    poolMint,
    user.publicKey,
    payer.publicKey
  );
  if (tfci) preTransaction.add(tfci);

  // Handle Token A Mint
  const mintToInstruction = createMintToInstruction(tokenAMint, tokenAUserAccountAddress, payer.publicKey, tokenAAmount);
  preTransaction.add(mintToInstruction);

  const approveIx = createApproveInstruction(
    tokenAUserAccountAddress,
    userTransferAuthority.publicKey, // delegate
    user.publicKey,
    tokenAAmount,
  );
  preTransaction.add(approveIx);

  // Handle Token B Mint
  preTransaction.add(
    web3.SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: tokenBUserAccountAddress,
      lamports: tokenBAmount,
    }),
    createSyncNativeInstruction(tokenBUserAccountAddress),
    createApproveInstruction(
      tokenBUserAccountAddress,
      userTransferAuthority.publicKey, // delegate
      user.publicKey,
      tokenBAmount,
    )
  );

  // Deposit
  const tx = await program.methods.depositAllTokenTypes(
    new anchor.BN(POOL_TOKEN_AMOUNT),
    new anchor.BN(tokenAAmount),
    new anchor.BN(tokenBAmount),
  ).accounts({
    amm: amm.publicKey,
    swapAuthority: swapAuthority,
    userTransferAuthorityInfo: userTransferAuthority.publicKey,
    sourceAInfo: tokenAUserAccountAddress,
    sourceBInfo: tokenBUserAccountAddress,
    tokenAAccount: tokenAAccountAddress,
    tokenBAccount: tokenBAccountAddress,
    poolMint: poolMint,
    destination: tokenPoolUserAccountAddress,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .signers([userTransferAuthority, user])
  .preInstructions(preTransaction.instructions)
  .rpc()
  console.log("🚀 ~ Provide liquidity Hash:", tx)

}
main();
