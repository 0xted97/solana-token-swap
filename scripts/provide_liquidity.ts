import * as web3 from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID, getMint, getAccount, } from "@solana/spl-token";
import {
  loadKeyPair, getTokenAccountCreateInstruction,
  program, connection,
  tokenAMint, tokenBMint, poolMint, MY_SWAP_PROGRAM_ID,
  feeOwner,
  amm,
  owner, payer, user, userTransferAuthority,
} from "./configs";

async function main() {
  const POOL_TOKEN_AMOUNT = 10000000;

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
  console.log("🚀 ~ file: provide_liquidity.ts:83 ~ main ~ tokenAAccountAddress:", tokenAAccountAddress)
  console.log("🚀 ~ file: provide_liquidity.ts:84 ~ main ~ tokenBAccountAddress:", tokenBAccountAddress)
  const supply = new anchor.BN(poolMintInfo.supply.toString()).toNumber(); // 1000000000, 10000000

  const tokenAAmount = Math.floor(
    (new anchor.BN(swapTokenA.amount.toString()).toNumber() * POOL_TOKEN_AMOUNT) / supply
  );
  console.log("🚀 ~ file: provide_liquidity.ts:92 ~ main ~ tokenAAmount:", tokenAAmount)
  const tokenBAmount = Math.floor(
    (new anchor.BN(swapTokenB.amount.toString()).toNumber() * POOL_TOKEN_AMOUNT) / supply
  );
  console.log("🚀 ~ file: provide_liquidity.ts:96 ~ main ~ tokenBAmount:", tokenBAmount)

  const initialAccountTx = new web3.Transaction();
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
  const [tokenPoolUserAccountAddress, tfci] = await getTokenAccountCreateInstruction(
    poolMint,
    user.publicKey,
    payer.publicKey
  );
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
  const tx = await program.methods.depositAllTokenTypes(
    new anchor.BN(POOL_TOKEN_AMOUNT),
    new anchor.BN(tokenAAmount),
    new anchor.BN(tokenBAmount + 1e8),
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
  }).signers([userTransferAuthority]).rpc()
  console.log("🚀 ~ file: provide_liquidity.ts:152 ~ main ~ tx:", tx)
}
main();
