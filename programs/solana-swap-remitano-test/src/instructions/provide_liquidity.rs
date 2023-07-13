use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};

use crate::{curve::calculator::RoundDirection, errors::SwapError, states::amm::*, utils::*};

pub fn deposit_all_token_types(
    ctx: Context<DepositAllTokenTypes>,
    pool_token_amount: u64,
    maximum_token_a_amount: u64, // SOL
    maximum_token_b_amount: u64,
) -> Result<()> {
    let amm = &mut ctx.accounts.amm;

    let curve = build_curve(amm.constant_price).unwrap();
    let calculator = curve.calculator;
    if !calculator.allows_deposits() {
        return Err(SwapError::UnsupportedCurveOperation.into());
    }

    // Validate accounts input
    check_accounts(
        amm,
        ctx.program_id.key(),
        amm.to_account_info(),
        ctx.accounts.swap_authority.to_account_info(),
        ctx.accounts.token_a_account.to_account_info(),
        ctx.accounts.token_b_account.to_account_info(),
        ctx.accounts.pool_mint.to_account_info(),
        ctx.accounts.token_program.to_account_info(),
        Some(ctx.accounts.source_a_info.to_account_info()),
        Some(ctx.accounts.source_b_info.to_account_info()),
        None,
    )?;

    let current_pool_mint_supply = u128::try_from(ctx.accounts.pool_mint.supply).unwrap();
    // try to add more or new
    let (pool_token_amount, pool_mint_supply) = if current_pool_mint_supply > 0 {
        (
            u128::try_from(pool_token_amount).unwrap(),
            current_pool_mint_supply,
        )
    } else {
        (calculator.new_pool_supply(), calculator.new_pool_supply())
    };
    msg!("pool_token_amount: {}", pool_token_amount);
    msg!("pool_mint_supply: {}", pool_mint_supply);
    // Still check slippage
    let results = calculator
        .pool_tokens_to_trading_tokens(
            pool_token_amount,
            pool_mint_supply,
            u128::try_from(ctx.accounts.token_a_account.amount).unwrap(),
            u128::try_from(ctx.accounts.token_b_account.amount).unwrap(),
            RoundDirection::Ceiling,
        )
        .ok_or(SwapError::ZeroTradingTokens)?;

    let token_a_amount = u64::try_from(results.token_a_amount).unwrap();
    msg!("token_a_amount: {}", token_a_amount);
    if token_a_amount > maximum_token_a_amount {
        return Err(SwapError::ExceededSlippage.into());
    }
    if token_a_amount == 0 {
        return Err(SwapError::ZeroTradingTokens.into());
    }
    let token_b_amount = u64::try_from(results.token_b_amount).unwrap();
    msg!("token_b_amount: {}", token_b_amount);
    if token_b_amount > maximum_token_b_amount {
        return Err(SwapError::ExceededSlippage.into());
    }
    if token_b_amount == 0 {
        return Err(SwapError::ZeroTradingTokens.into());
    }

    let pool_amount_token = u64::try_from(pool_token_amount).unwrap();

    let seeds = &[
        &amm.to_account_info().key().to_bytes(),
        &[amm.bump_seed][..],
    ];

    // Transfer token
    token::transfer(
        ctx.accounts
            .into_transfer_to_token_a_context()
            .with_signer(&[&seeds[..]]),
        token_a_amount,
    )?;

    token::transfer(
        ctx.accounts
            .into_transfer_to_token_b_context()
            .with_signer(&[&seeds[..]]),
        token_b_amount,
    )?;
    // Mint LP

    token::mint_to(
        ctx.accounts
            .into_mint_to_context()
            .with_signer(&[&seeds[..]]),
        pool_amount_token,
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct DepositAllTokenTypes<'info> {
    pub amm: Account<'info, Amm>,
    /// CHECK: Safe
    pub swap_authority: AccountInfo<'info>,
    /// CHECK: Safe
    #[account(signer)]
    pub user_transfer_authority_info: AccountInfo<'info>,
    /// CHECK: Safe
    #[account(mut)]
    pub source_a_info: AccountInfo<'info>, // User
    /// CHECK: Safe
    #[account(mut)]
    pub source_b_info: AccountInfo<'info>, // User

    #[account(mut)]
    pub token_a_account: Account<'info, TokenAccount>, // Pool: WRAP SOL
    #[account(mut)]
    pub token_b_account: Account<'info, TokenAccount>, // Pool: Any SPL Token

    #[account(mut)]
    pub pool_mint: Account<'info, Mint>,

    /// CHECK: Safe
    #[account(mut)]
    pub destination: AccountInfo<'info>,

    /// CHECK: Safe
    pub token_program: Program<'info, Token>,
}

impl<'info> DepositAllTokenTypes<'info> {
    fn into_transfer_to_token_a_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.source_a_info.to_account_info().clone(),
            to: self.token_a_account.to_account_info().clone(),
            authority: self.user_transfer_authority_info.clone(),
        };
        CpiContext::new(self.token_program.to_account_info().clone(), cpi_accounts)
    }

    fn into_transfer_to_token_b_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.source_b_info.to_account_info().clone(),
            to: self.token_b_account.to_account_info().clone(),
            authority: self.user_transfer_authority_info.clone(),
        };
        CpiContext::new(self.token_program.to_account_info().clone(), cpi_accounts)
    }

    fn into_mint_to_context(&self) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
        let cpi_accounts = MintTo {
            mint: self.pool_mint.to_account_info().clone(),
            to: self.destination.to_account_info().clone(),
            authority: self.swap_authority.clone(),
        };
        CpiContext::new(self.token_program.to_account_info().clone(), cpi_accounts)
    }
}
