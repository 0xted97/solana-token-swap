use anchor_lang::prelude::*;
use anchor_spl::token::{self, spl_token::native_mint::ID, Mint, MintTo, Token, TokenAccount};
use solana_program::program_option::COption;

use crate::{errors::SwapError, states::amm::*};

pub fn setup_pool(
    ctx: Context<SetupPool>,
    fees_input: FeesInput,
    constant_price: u64,
) -> Result<()> {
    // Is Initialized?
    if ctx.accounts.amm.is_initialized {
        return err!(SwapError::AlreadyInUse);
    }
    // Validate swap_authority
    let (swap_authority, bump_seed) =
        Pubkey::find_program_address(&[&ctx.accounts.amm.to_account_info().key().to_bytes()], ctx.program_id);

    let seeds = &[&ctx.accounts.amm.to_account_info().key.to_bytes(), &[bump_seed][..]];

    if ctx.accounts.swap_authority.key() != swap_authority {
        return Err(SwapError::InvalidProgramAddress.into());
    }

    // Check is Wrapped SOL Mint.
    if ctx.accounts.token_a_account.mint != ID {
        return Err(SwapError::InvalidProgramAddress.into());
    }

    // Check owner tokens token
    if ctx.accounts.swap_authority.key() != ctx.accounts.token_a_account.owner.key() {
        return Err(SwapError::InvalidOwner.into());
    }
    if ctx.accounts.swap_authority.key() != ctx.accounts.token_b_account.owner.key() {
        return Err(SwapError::InvalidOwner.into());
    }
    if ctx.accounts.token_a_account.mint == ctx.accounts.token_b_account.mint.key() {
        return Err(SwapError::RepeatedMint.into());
    }
    if ctx.accounts.swap_authority.key() == ctx.accounts.fee_account.owner
        && ctx.accounts.swap_authority.key() == ctx.accounts.destination.owner
    {
        return Err(SwapError::InvalidOutputOwner.into());
    }
    // Check owner LP Mint?
    if COption::Some(ctx.accounts.swap_authority.key()) != ctx.accounts.pool_mint.mint_authority {
        return Err(SwapError::InvalidOwner.into());
    }

    // Validate pool
    let curve = build_curve(constant_price).unwrap();
    curve.calculator.validate_supply(
        ctx.accounts.token_a_account.amount,
        ctx.accounts.token_b_account.amount,
    )?;
    curve.calculator.validate()?;
    let fees = build_fees(&fees_input)?;
    fees.validate()?;

    // Check delegate?
    if ctx.accounts.token_a_account.delegate.is_some()
        || ctx.accounts.token_b_account.delegate.is_some()
    {
        return Err(SwapError::InvalidDelegate.into());
    }
    if ctx.accounts.token_a_account.close_authority.is_some()
        || ctx.accounts.token_b_account.close_authority.is_some()
    {
        return Err(SwapError::InvalidCloseAuthority.into());
    }
    if ctx.accounts.pool_mint.supply != 0 {
        return Err(SwapError::InvalidSupply.into());
    }
    if ctx.accounts.pool_mint.freeze_authority.is_some() {
        return Err(SwapError::InvalidFreezeAuthority.into());
    }
    if ctx.accounts.pool_mint.key() != ctx.accounts.fee_account.mint {
        return Err(SwapError::IncorrectPoolMint.into());
    }

    let initial_amount = curve.calculator.new_pool_supply();
    // Mint LP Token
    token::mint_to(
        ctx.accounts
            .into_mint_to_context()
            .with_signer(&[&seeds[..]]),
        u64::try_from(initial_amount).unwrap(),
    )?;

    let amm = &mut ctx.accounts.amm;

    // Update AMM state
    amm.is_initialized = true;
    amm.bump_seed = bump_seed;
    amm.constant_price = constant_price;
    amm.fees_input = fees_input;

    amm.pool_mint = ctx.accounts.pool_mint.key();
    amm.token_a_mint = ctx.accounts.token_a_account.mint.key();
    amm.token_b_mint = ctx.accounts.token_b_account.mint.key();

    amm.token_a_account = ctx.accounts.token_a_account.key();
    amm.token_b_account = ctx.accounts.token_b_account.key();
    amm.pool_fee_account = ctx.accounts.fee_account.key();

    amm.token_program_id = ctx.accounts.token_program.key();

    Ok(())
}

#[derive(Accounts)]
pub struct SetupPool<'info> {
    /// CHECK: Safe
    pub swap_authority: AccountInfo<'info>,

    #[account(init, payer=initializer, space=999)]
    pub amm: Account<'info, Amm>,

    pub token_a_account: Account<'info, TokenAccount>, // WRAP SOL
    pub token_b_account: Account<'info, TokenAccount>,   // Any SPL Token

    #[account(mut)]
    pub pool_mint: Account<'info, Mint>,

    #[account(mut)]
    pub fee_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub destination: Account<'info, TokenAccount>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'info> SetupPool<'info> {
    fn into_mint_to_context(&self) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
        let cpi_accounts = MintTo {
            mint: self.pool_mint.to_account_info().clone(),
            to: self.destination.to_account_info().clone(),
            authority: self.swap_authority.clone(),
        };
        CpiContext::new(self.token_program.to_account_info().clone(), cpi_accounts)
    }
}
