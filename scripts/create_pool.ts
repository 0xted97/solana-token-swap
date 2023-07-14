import * as fs from "fs";
import * as web3 from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import { NATIVE_MINT, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, mintTo, createSyncNativeInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import SolanaSwap from "./solana_swap.json";
import { TypeDef } from "@project-serum/anchor/dist/cjs/program/namespace/types";

import {
  loadKeyPair, getTokenAccountCreateInstruction,
  MY_SWAP_PROGRAM_ID, amm, connection, program,
  payer, owner, feeOwner, tokenAMint, tokenBMint, poolMint,
} from "./configs";

async function main() {
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
  const amm = loadKeyPair(
    "AmmfCddqsSFYvyrsXYSYmvEQzStUg4Vi74ZJoSkdDsvC.json"
  );
  // Setup pool
  // ### Get Swap Pool Authority
  const [swapAuthority, bump] = web3.PublicKey.findProgramAddressSync(
    [amm.publicKey.toBuffer()],
    MY_SWAP_PROGRAM_ID
  );

  const initialAccountTx = new web3.Transaction();
  const [tokenAccountPoolAddress, tpaci] =
    await getTokenAccountCreateInstruction(
      poolMint,
      owner.publicKey,
      payer.publicKey
    );

  initialAccountTx.add(tpaci);

  const [tokenAAccountAddress, taci] = await getTokenAccountCreateInstruction(
    tokenAMint,
    swapAuthority,
    payer.publicKey
  );
  const [tokenBAccountAddress, tbci] = await getTokenAccountCreateInstruction(
    tokenBMint,
    swapAuthority,
    payer.publicKey
  );
  initialAccountTx.add(taci, tbci);

  // ### Pool Fee token
  const [tokenFeeAccountAddress, tfaci] =
    await getTokenAccountCreateInstruction(
      poolMint,
      feeOwner,
      payer.publicKey
    );
  initialAccountTx.add(tfaci);
  // Cmt this after create accounts
  // const init = await connection.sendTransaction(initialAccountTx, [payer]);
  // console.log("🚀 ~ file: index.ts:113 ~ main ~ init:", init)
  // ### Mint to
  const mintATx = await mintTo(
    connection,
    payer,
    tokenAMint,
    tokenAAccountAddress,
    payer,
    currentSwapTokenA,
  );
  console.log("🚀 ~ file: index.ts:125 ~ main ~ mintATx:", mintATx)

  const sendWrapSolTx = await connection.sendTransaction(new web3.Transaction().add(
    web3.SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: tokenBAccountAddress,
      lamports: currentSwapTokenB,
    }),
    createSyncNativeInstruction(tokenBAccountAddress),
  ), [payer]);
  console.log("🚀 ~ file: index.ts:133 ~ main ~ sendWrapSolTx:", sendWrapSolTx)

  // ### Init swap pool
  const fees_input: TypeDef<
    {
      name: "FeesInput";
      type: {
        kind: "struct";
        fields: [
          {
            name: "tradeFeeNumerator";
            type: "u64";
          },
          {
            name: "tradeFeeDenominator";
            type: "u64";
          },
          {
            name: "ownerTradeFeeNumerator";
            type: "u64";
          },
          {
            name: "ownerTradeFeeDenominator";
            type: "u64";
          },
          {
            name: "ownerWithdrawFeeNumerator";
            type: "u64";
          },
          {
            name: "ownerWithdrawFeeDenominator";
            type: "u64";
          },
          {
            name: "hostFeeNumerator";
            type: "u64";
          },
          {
            name: "hostFeeDenominator";
            type: "u64";
          }
        ];
      };
    },
    Record<string, number>
  > = {
    tradeFeeNumerator: new anchor.BN(TRADING_FEE_NUMERATOR),
    tradeFeeDenominator: new anchor.BN(TRADING_FEE_DENOMINATOR),
    ownerTradeFeeNumerator: new anchor.BN(OWNER_TRADING_FEE_NUMERATOR),
    ownerTradeFeeDenominator: new anchor.BN(OWNER_TRADING_FEE_DENOMINATOR),
    ownerWithdrawFeeNumerator: new anchor.BN(OWNER_WITHDRAW_FEE_NUMERATOR),
    ownerWithdrawFeeDenominator: new anchor.BN(
      OWNER_WITHDRAW_FEE_DENOMINATOR
    ),
    hostFeeNumerator: new anchor.BN(HOST_FEE_NUMERATOR),
    hostFeeDenominator: new anchor.BN(HOST_FEE_DENOMINATOR),
  };

  const tx = await program.methods
    .setupPool(fees_input, new anchor.BN(constant_price))
    .accounts({
      amm: amm.publicKey,
      poolMint: poolMint,
      swapAuthority: swapAuthority,
      tokenAAccount: tokenAAccountAddress,
      tokenBAccount: tokenBAccountAddress,
      feeAccount: tokenFeeAccountAddress, // feeAccount
      destination: tokenAccountPoolAddress,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: web3.SystemProgram.programId,
    })
    .signers([amm])
    .rpc();
  console.log("🚀 ~ file: index.ts:202 ~ main ~ tx:", tx)
}
main();
