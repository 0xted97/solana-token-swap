import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaSwap } from "../target/types/solana_swap";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  mintTo,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  createSyncNativeInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  getMint,
  getAccount,
  createAccount,
  createAssociatedTokenAccount,
  approve
} from "@solana/spl-token";
import { TokenSwap } from "@solana/spl-token-swap";
import { TypeDef } from "@coral-xyz/anchor/dist/cjs/program/namespace/types";
import { assert } from "chai";
const CurveType = Object.freeze({
  ConstantPrice: 1,
});

async function getTokenAccountCreateInstruction(
  mint: anchor.web3.PublicKey,
  owner: anchor.web3.PublicKey,
  payer: anchor.web3.PublicKey
): Promise<[anchor.web3.PublicKey, anchor.web3.TransactionInstruction]> {
  let tokenAccountAddress = getAssociatedTokenAddressSync(
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

describe("solana-swap", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SolanaSwap as Program<SolanaSwap>;

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const { connection } = provider;





  // Generate account
  const payer = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array([
      198, 104, 7, 223, 36, 174, 98, 251, 220, 228, 244, 78, 146, 135, 36, 168,
      76, 225, 215, 233, 235, 170, 214, 40, 85, 89, 232, 144, 159, 135, 215,
      171, 130, 4, 232, 43, 132, 15, 226, 90, 93, 129, 94, 71, 84, 90, 102, 177,
      163, 41, 162, 128, 141, 151, 192, 111, 98, 168, 185, 32, 242, 97, 208, 82,
    ])
  );
  const ammAccount = anchor.web3.Keypair.generate();
  const owner = anchor.web3.Keypair.generate();
  const feeOwner = new anchor.web3.PublicKey(
    "HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN"
  );

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

  // Initial amount in each swap token
  let currentSwapTokenA = 100 * 1e9;
  let currentSwapTokenB = 100 * 1e9;
  let currentFeeAmount = 0;

  const SWAP_FEE = SWAP_PROGRAM_OWNER_FEE_ADDRESS ? 22273 : 22277;
  const HOST_SWAP_FEE = SWAP_PROGRAM_OWNER_FEE_ADDRESS
    ? Math.floor((SWAP_FEE * HOST_FEE_NUMERATOR) / HOST_FEE_DENOMINATOR)
    : 0;
  const SWAP_AMOUNT_IN = 100000;
  const SWAP_AMOUNT_OUT = SWAP_PROGRAM_OWNER_FEE_ADDRESS ? 90661 : 1000000;
  const OWNER_SWAP_FEE = SWAP_FEE - HOST_SWAP_FEE;
  const POOL_TOKEN_AMOUNT = 10000000;
  const DEFAULT_POOL_TOKEN_AMOUNT = 1000000000;




  before(async () => {
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        payer.publicKey,
        100000 * LAMPORTS_PER_SOL
      ),
      "confirmed"
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        owner.publicKey,
        100000 * LAMPORTS_PER_SOL
      ),
      "confirmed"
    );

    const found = PublicKey.findProgramAddressSync(
      [ammAccount.publicKey.toBuffer()],
      program.programId
    );
    authority = found[0];
    bumpSeed = found[1];

    // Create WRAP SOL
    // Create Pool Mint & Token Account Pool
    tokenPool = await createMint(
      connection,
      payer,
      authority,
      null,
      2
    );
    const transCreateTokenAccount = new Transaction();
    tokenAccountPool = getAssociatedTokenAddressSync(
      tokenPool,
      owner.publicKey,
      true
    );
    transCreateTokenAccount.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        tokenAccountPool,
        owner.publicKey,
        tokenPool
      )
    );


    const ownerKey = SWAP_PROGRAM_OWNER_FEE_ADDRESS || owner.publicKey.toString();
    feeAccount = await createAccount(connection, payer, tokenPool, new PublicKey(ownerKey), anchor.web3.Keypair.generate());

    // transCreateTokenAccount.add(
    //   createAssociatedTokenAccountInstruction(
    //     payer.publicKey,
    //     feeAccount,
    //     new PublicKey(ownerKey),
    //     tokenPool
    //   )
    // );


    // Create WSOL and Move Mint
    mintA = NATIVE_MINT;
    mintB = await createMint(
      provider.connection,
      payer,
      owner.publicKey,
      null,
      9
    );
    // Create Token Account WSOL and Move
    let AToken = await getTokenAccountCreateInstruction(mintA, authority, payer.publicKey);
    tokenAccountA = AToken[0];
    let BToken = await getTokenAccountCreateInstruction(mintB, authority, payer.publicKey);
    tokenAccountB = BToken[0];
    transCreateTokenAccount.add(AToken[1], BToken[1]);
    const tx = await provider.sendAndConfirm(transCreateTokenAccount, [payer]);
    console.log("🚀 ~ file: solana-swap.ts:178 ~ before ~ tx:", tx)

    const solTransferTransaction = new Transaction();
    solTransferTransaction.add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: tokenAccountA,
        lamports: currentSwapTokenA,
      }),
      createSyncNativeInstruction(tokenAccountA)
    );
    await provider.sendAndConfirm(solTransferTransaction, [payer]);
    await mintTo(
      provider.connection,
      payer,
      mintB,
      tokenAccountB,
      owner,
      currentSwapTokenB
    );
  });

  describe("Setup pool", async () => {
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
      const tx = await program.methods
        .setupPool(fees_input, new anchor.BN(constant_price))
        .accounts({
          amm: ammAccount.publicKey,
          poolMint: tokenPool,
          swapAuthority: authority,
          tokenAAccount: tokenAccountA,
          tokenBAccount: tokenAccountB,
          feeAccount: feeAccount, // feeAccount
          destination: tokenAccountPool,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([ammAccount])
        .rpc();
      const amm = await program.account.amm.fetch(ammAccount.publicKey);

      assert(amm.tokenProgramId.equals(TOKEN_PROGRAM_ID));
      assert(amm.poolMint.equals(tokenPool));
      assert(amm.tokenAMint.equals(mintA));
      assert(amm.tokenBMint.equals(mintB));
      assert(amm.tokenAAccount.equals(tokenAccountA));
      assert(amm.tokenBAccount.equals(tokenAccountB));
      assert(amm.constantPrice == amm.constantPrice);

      // Check some fees_input
    });
  });

  // describe("", async () => {
  //   it("it DepositAllTokenTypes Success", async () => {
  //     const [poolMintInfo, swapTokenA, swapTokenB] = await Promise.all([
  //       getMint(connection, tokenPool),
  //       getAccount(connection, tokenAccountA),
  //       getAccount(connection, tokenAccountB),
  //     ]);
  //     const supply = new anchor.BN(poolMintInfo.supply.toString()).toNumber();
  //     console.log("🚀 ~ file: solana-swap.ts:281 ~ it ~ swapTokenA:", swapTokenA.amount)
  //     console.log("🚀 ~ file: solana-swap.ts:281 ~ it ~ swapTokenB:", swapTokenB.amount)


  //     const tokenAAmount = Math.floor(
  //       (new anchor.BN(swapTokenA.amount.toString()).toNumber() * POOL_TOKEN_AMOUNT) / supply
  //     );
  //     const tokenBAmount = Math.floor(
  //       (new anchor.BN(swapTokenB.amount.toString()).toNumber() * POOL_TOKEN_AMOUNT) / supply
  //     );

  //     const userTransferAuthority = anchor.web3.Keypair.generate();
  //     // Creating depositor token a account
  //     // W-SOL
  //     const userAccountA = await createAccount(connection, payer, mintA, owner.publicKey);
  //     console.log("🚀 ~ file: solana-swap.ts:313 ~ it ~ userAccountA:", userAccountA)
  //     await provider.sendAndConfirm(new Transaction().add(
  //       SystemProgram.transfer({
  //         fromPubkey: payer.publicKey,
  //         toPubkey: userAccountA,
  //         lamports: tokenAAmount,
  //       }),
  //       createSyncNativeInstruction(userAccountA)
  //     ), [payer]);

  //     await approve(
  //       connection, payer,
  //       userAccountA,
  //       userTransferAuthority.publicKey,
  //       owner,
  //       tokenAAmount
  //     );

  //     // SPL-Token
  //     const userAccountB = await createAccount(connection, payer, mintB, owner.publicKey);
  //     await mintTo(connection, payer, mintB, userAccountB, owner, tokenAAmount);
  //     await approve(
  //       connection, payer,
  //       userAccountB,
  //       userTransferAuthority.publicKey,
  //       owner,
  //       tokenBAmount
  //     );


  //     // Creating depositor pool token account
  //     const newAccountPool = await createAccount(
  //       connection, payer, tokenPool, owner.publicKey, anchor.web3.Keypair.generate()
  //     );
  //     console.log("🚀 ~ file: solana-swap.ts:324 ~ it ~ supply:", supply)
  //     console.log("🚀 ~ file: solana-swap.ts:338 ~ it ~ tokenAAmount:", tokenAAmount)
  //     console.log("🚀 ~ file: solana-swap.ts:340 ~ it ~ tokenBAmount:", tokenBAmount)
  //     console.log("🚀 ~ file: solana-swap.ts:330 ~ it ~ POOL_TOKEN_AMOUNT:", POOL_TOKEN_AMOUNT)


  //     // Deposit
  //     const tx = await program.methods.depositAllTokenTypes(
  //       new anchor.BN(POOL_TOKEN_AMOUNT),
  //       new anchor.BN(tokenAAmount),
  //       new anchor.BN(tokenBAmount),
  //     ).accounts({
  //       amm: ammAccount.publicKey,
  //       swapAuthority: authority,
  //       userTransferAuthorityInfo: userTransferAuthority.publicKey,
  //       sourceAInfo: userAccountA,
  //       sourceBInfo: userAccountB,
  //       tokenAAccount: tokenAccountA,
  //       tokenBAccount: tokenAccountB,
  //       poolMint: tokenPool,
  //       destination: newAccountPool,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //     }).signers([userTransferAuthority]).rpc()
  //     console.log("🚀 ~ file: solana-swap.ts:345 ~ it ~ tx:", tx)

  //     let info;
  //     info = await getAccount(connection, userAccountA);
  //     console.log("🚀 ~ file: solana-swap.ts:354 ~ it ~ info:", info)
  //     assert(info.amount.toNumber() == 0);
  //     info = await getAccount(connection, userAccountB);
  //     assert(info.amount.toNumber() == 0);
  //     info = await getAccount(connection, tokenAccountA);
  //     assert(info.amount.toNumber() == currentSwapTokenA + tokenAAmount);
  //     currentSwapTokenA += tokenAAmount;

  //     info = await getAccount(connection, tokenAccountB);
  //     assert(info.amount.toNumber() == currentSwapTokenB + tokenBAmount);
  //     currentSwapTokenB += tokenBAmount;

  //     info = await getAccount(connection, newAccountPool);
  //     assert(info.amount.toNumber() == POOL_TOKEN_AMOUNT);

  //   });
  // });

  describe("Swap", async () => {
    it("Swap success", async () => {
      const userTransferAuthority = anchor.web3.Keypair.generate();

      const userAccountA = await createAccount(connection, payer, mintA, owner.publicKey);
      console.log("🚀 ~ file: solana-swap.ts:395 ~ it ~ userAccountA:", userAccountA)
      await provider.sendAndConfirm(new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: userAccountA,
          lamports: SWAP_AMOUNT_IN,
        }),
        createSyncNativeInstruction(userAccountA)
      ), [payer]);
      await approve(
        connection, payer,
        userAccountA,
        userTransferAuthority.publicKey,
        owner,
        SWAP_AMOUNT_IN
      );

      let userAccountB = await createAccount(connection, payer, mintB, owner.publicKey);

      let poolAccount = SWAP_PROGRAM_OWNER_FEE_ADDRESS
        ? await createAccount(connection, payer, tokenPool, owner.publicKey)
        : PublicKey.default;
      console.log("🚀 ~ file: solana-swap.ts:432 ~ it ~ SWAP_AMOUNT_OUT:", SWAP_AMOUNT_OUT)

      const tx = await program.methods.swap(
        new anchor.BN(SWAP_AMOUNT_IN),
        new anchor.BN(SWAP_AMOUNT_OUT),
      ).accounts({
        swapAuthority: authority,
        amm: ammAccount.publicKey,
        userTransferAuthority: userTransferAuthority.publicKey,
        sourceInfo: userAccountA,
        destinationInfo: userAccountB,
        swapSource: tokenAccountA,
        swapDestination: tokenAccountB,
        poolMint: tokenPool,
        feeAccount: feeAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        hostFeeAccount: PublicKey.default,
      })
        .signers([userTransferAuthority])
        .rpc();
      console.log("🚀 ~ file: solana-swap.ts:446 ~ it ~ tx:", tx)

      let info;
      info = await getAccount(connection, userAccountA);
      assert(info.amount.toNumber() == 0);

      info = await getAccount(connection, userAccountB);
      assert(info.amount.toNumber() == SWAP_AMOUNT_OUT);

      info = await getAccount(connection, tokenAccountA);
      assert(info.amount.toNumber() == currentSwapTokenA + SWAP_AMOUNT_IN);
      currentSwapTokenA += SWAP_AMOUNT_IN;

      info = await getAccount(connection, tokenAccountB);
      assert(info.amount.toNumber() == currentSwapTokenB - SWAP_AMOUNT_OUT);
      currentSwapTokenB -= SWAP_AMOUNT_OUT;

      info = await getAccount(connection, tokenAccountPool);
      assert(
        info.amount.toNumber() == DEFAULT_POOL_TOKEN_AMOUNT - POOL_TOKEN_AMOUNT
      );

      info = await getAccount(connection, feeAccount);
      assert(info.amount.toNumber() == currentFeeAmount + OWNER_SWAP_FEE);

      if (poolAccount != PublicKey.default) {
        info = await tokenPool.getAccountInfo(poolAccount);
        assert(info.amount.toNumber() == HOST_SWAP_FEE);
      }

    });
  });
});
