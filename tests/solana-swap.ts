import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaSwap } from "../target/types/solana_swap";
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint, createAccount, mintTo, NATIVE_MINT, TOKEN_PROGRAM_ID, createSyncNativeInstruction, createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync, getAccount } from "@solana/spl-token";
import { TypeDef } from "@coral-xyz/anchor/dist/cjs/program/namespace/types";
import { expect, assert } from "chai";
const CurveType = Object.freeze({
  ConstantPrice: 1,
});

describe("solana-swap", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SolanaSwap as Program<SolanaSwap>;

  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider);

  // Initial amount in each swap token
  let currentSwapTokenA = 10 * LAMPORTS_PER_SOL;
  let currentSwapTokenB = 1000000;
  let currentFeeAmount = 0;

  // Generate account
  const payer = anchor.web3.Keypair.fromSecretKey(new Uint8Array([198, 104, 7, 223, 36, 174, 98, 251, 220, 228, 244, 78, 146, 135, 36, 168, 76, 225, 215, 233, 235, 170, 214, 40, 85, 89, 232, 144, 159, 135, 215, 171, 130, 4, 232, 43, 132, 15, 226, 90, 93, 129, 94, 71, 84, 90, 102, 177, 163, 41, 162, 128, 141, 151, 192, 111, 98, 168, 185, 32, 242, 97, 208, 82]));
  const ammAccount = anchor.web3.Keypair.generate();
  const owner = anchor.web3.Keypair.generate();
  const feeOwner = new anchor.web3.PublicKey('HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN');



  let authority: PublicKey;
  let bumpSeed: number;
  let tokenPool = anchor.web3.Keypair.generate().publicKey;
  let tokenAccountPool: PublicKey;
  let feeAccount: PublicKey;
  const SWAP_PROGRAM_OWNER_FEE_ADDRESS =
    process.env.SWAP_PROGRAM_OWNER_FEE_ADDRESS;
  let mintA: PublicKey;
  let mintB: PublicKey;
  let tokenAccountA: PublicKey;
  let tokenAccountB: PublicKey;

  // Pool fees & Curve
  let constant_price = 10;
  const TRADING_FEE_NUMERATOR = 25;
  const TRADING_FEE_DENOMINATOR = 10000;
  const OWNER_TRADING_FEE_NUMERATOR = 5;
  const OWNER_TRADING_FEE_DENOMINATOR = 10000;
  const OWNER_WITHDRAW_FEE_NUMERATOR = SWAP_PROGRAM_OWNER_FEE_ADDRESS ? 0 : 1;
  const OWNER_WITHDRAW_FEE_DENOMINATOR = SWAP_PROGRAM_OWNER_FEE_ADDRESS ? 0 : 6;
  const HOST_FEE_NUMERATOR = 20;
  const HOST_FEE_DENOMINATOR = 100;

  beforeEach(async () => {
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(payer.publicKey, 100000 * LAMPORTS_PER_SOL),
      'confirmed'
    );

    const found = PublicKey.findProgramAddressSync(
      [ammAccount.publicKey.toBuffer()],
      program.programId
    );
    authority = found[0];
    console.log("🚀 ~ file: solana-swap.ts:68 ~ beforeEach ~ authority:", authority)
    bumpSeed = found[1];

    // Create WRAP SOL
    // Create Pool Mint & Token Account Pool
    tokenPool = await createMint(
      provider.connection,
      payer,
      authority,
      null,
      9,
    );
    const transCreateTokenAccount = new Transaction();
    tokenAccountPool = getAssociatedTokenAddressSync(tokenPool, authority, true);
    transCreateTokenAccount.add(createAssociatedTokenAccountInstruction(payer.publicKey, tokenAccountPool, authority, tokenPool));

    feeAccount = getAssociatedTokenAddressSync(tokenPool, feeOwner, true);
    transCreateTokenAccount.add(createAssociatedTokenAccountInstruction(payer.publicKey, feeAccount, feeOwner, tokenPool));

    // Create WSOL and Move Mint
    mintA = NATIVE_MINT;
    mintB = await createMint(
      provider.connection,
      payer,
      owner.publicKey,
      null,
      9,
    );
    // Create Token Account WSOL and Move
    tokenAccountA = getAssociatedTokenAddressSync(mintA, authority, true);
    transCreateTokenAccount.add(createAssociatedTokenAccountInstruction(payer.publicKey, tokenAccountA, authority, mintA));
    tokenAccountB = getAssociatedTokenAddressSync(mintB, authority, true);
    transCreateTokenAccount.add(createAssociatedTokenAccountInstruction(payer.publicKey, tokenAccountB, authority, mintB));

    const tx = await provider.sendAndConfirm(transCreateTokenAccount, [payer]);


    const solTransferTransaction = new Transaction()
    solTransferTransaction.add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: tokenAccountA,
        lamports: currentSwapTokenA
      }),
      createSyncNativeInstruction(tokenAccountA),
    );
    await provider.sendAndConfirm(solTransferTransaction, [payer]);
    await mintTo(provider.connection, payer, mintB, tokenAccountB, owner, currentSwapTokenB);


  })


  it("Is setup pool!", async () => {
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
    // Add your test here.
    const tx = await program.methods.setupPool(fees_input, new anchor.BN(constant_price)).accounts({
      amm: ammAccount.publicKey,
      poolMint: tokenPool,
      swapAuthority: authority,
      tokenAAccount: tokenAccountA,
      tokenBAccount: tokenAccountB,
      feeAccount: feeAccount, // feeAccount
      destination: tokenAccountPool,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }).signers([ammAccount]).rpc();
    const amm = await program.account.amm.fetch(ammAccount.publicKey);

    assert(amm.tokenProgramId.equals(TOKEN_PROGRAM_ID));
    assert(amm.poolMint.equals(tokenPool));
    assert(amm.tokenAMint.equals(mintA));
    assert(amm.tokenBMint.equals(mintB));
    assert(amm.tokenAAccount.equals(tokenAccountA));
    assert(amm.tokenBAccount.equals(tokenAccountB));
    assert(amm.constantPrice == amm.constantPrice);
    
    
    console.log("🚀 ~ file: solana-swap.ts:199 ~ it ~ tokenAccountPool:", await provider.connection.getAccountInfo(tokenAccountPool))

    // Check some fees_input
  });
});
